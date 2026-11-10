/* Fonctions annexes : favoris, refaire une séance, annulation, notes, rappels, écran allumé, hors-ligne.
   Chargé avant app.js : ne contient que des déclarations ; le câblage se fait dans initExtras() une fois la page prête. */

function refreshAll(){ renderProgress(); renderHud(); renderQuests(); renderTodayPlan(); renderFavs(); }

/* ----- Toast avec bouton « Annuler » ----- */
function toastUndo(msg,onUndo){
  const t=$("#toast"); clearTimeout(t._h);
  t.textContent=msg+" "; t.style.display="block"; t.style.pointerEvents="auto";
  const b=document.createElement("button"); b.className="toast-undo"; b.textContent="Annuler";
  b.onclick=()=>{ t.style.display="none"; t.style.pointerEvents=""; onUndo(); };
  t.appendChild(b);
  t._h=setTimeout(()=>{ t.style.display="none"; t.style.pointerEvents=""; },7000);
}

/* ----- Suppression annulable d'une séance ----- */
function undoableDelete(id){
  const s=state.sessions.find(x=>x.id===id); if(!s) return;
  deleteSession(id); refreshAll();
  toastUndo("Séance supprimée.",()=>{
    state.sessions.push(s); state.sessions.sort((a,b)=>a.date-b.date); persistLocal(); refreshAll(); toast("Séance restaurée ✅");
  });
}

/* ----- Favoris et « refaire cette séance » ----- */
function toggleFav(id){
  const s=state.sessions.find(x=>x.id===id); if(!s) return;
  s.fav=!s.fav; persistLocal(); renderProgress(); renderFavs();
  toast(s.fav?"⭐ Ajoutée aux favoris (onglet Créer)":"Retirée des favoris");
}
function redoSession(id){
  const s=state.sessions.find(x=>x.id===id); if(!s) return;
  const go=()=>{
    const items=[];
    for(const x of s.exercises){
      const ex=EXMAP[x.exId]; if(!ex) continue;
      const pr=prescription(ex,state.profile); pr.sets=Math.max(1,x.sets.length);
      items.push(makeItem(ex,pr));
    }
    if(!items.length){ toast("Les exercices de cette séance n'existent plus"); return; }
    const est=Math.round(items.reduce((a,it)=>a+exMinutes(it.pr),0)+8);
    state.current={id:uid(),created:Date.now(),title:s.title,goal:s.goal||state.profile.goal,est,warm:8,exercises:items};
    persistLocal(); renderSession(); show("session"); window.scrollTo(0,0);
    toast("Séance « "+s.title+" » prête — les charges suivent ta progression 💪");
  };
  if(state.current&&state.current.exercises.some(x=>x.sets.some(z=>z.done))) confirmSheet("Une séance est en cours avec des séries validées. La remplacer ?","Remplacer",go);
  else go();
}
function renderFavs(){
  const el=$("#favs"); if(!el) return;
  const seen=new Set(), L=[];
  for(const s of state.sessions.slice().reverse()) if(s.fav&&!seen.has(s.title)){ seen.add(s.title); L.push(s); }
  if(!L.length){ el.style.display="none"; el.innerHTML=""; return; }
  el.style.display="block";
  el.innerHTML=`<label class="f" style="margin-top:0">⭐ Mes séances favorites</label>`+L.map(s=>`<div class="tp-it"><div><b>${esc(s.title)}</b><small>${s.exercises.length} exercice${s.exercises.length>1?"s":""} · ${fmtDate(s.date)}</small></div><button class="btn primary small" data-favgo="${esc(s.id)}">Lancer</button></div>`).join("");
}

/* ----- Rappels des séances planifiées (notifications locales ; l'appli doit rester ouverte) ----- */
function notifSupported(){ return "Notification" in window; }
function remindersOn(){ return !!(state.profile&&state.profile.reminders)&&notifSupported()&&Notification.permission==="granted"; }
async function setReminders(on){
  if(on){
    if(!notifSupported()){ toast("Les notifications ne sont pas supportées par ce navigateur"); return false; }
    let perm=Notification.permission;
    if(perm==="default") perm=await Notification.requestPermission();
    if(perm!=="granted"){ toast("Notifications refusées : autorise-les dans les réglages du navigateur"); state.profile.reminders=false; persistLocal(); return false; }
  }
  state.profile.reminders=!!on; persistLocal(); return true;
}
function checkReminders(){
  if(!remindersOn()) return;
  const now=new Date(), key=ymd(now), hm=String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");
  let seen; try{ seen=JSON.parse(localStorage.getItem("npng.notified")||"[]"); }catch(e){ seen=[]; }
  for(const p of plansOn(key)){
    if(!p.time||p.time!==hm||planDone(p,key)) continue;
    const id=p.id+"|"+key; if(seen.includes(id)) continue;
    seen.push(id);
    const title="C'est l'heure de ta séance 💪", opts={body:planLabel(p),icon:"icons/icon-192.png",tag:id};
    try{
      if(navigator.serviceWorker&&navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r=>r.showNotification(title,opts));
      else new Notification(title,opts);
    }catch(e){}
  }
  try{ localStorage.setItem("npng.notified",JSON.stringify(seen.slice(-50))); }catch(e){}
}

/* ----- Écran allumé pendant une séance (Wake Lock) ----- */
let wakeLock=null;
async function syncWakeLock(){
  try{
    const need=!!(state.current&&state.current.started)&&document.visibilityState==="visible";
    if(need&&!wakeLock&&navigator.wakeLock){
      wakeLock=await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release",()=>{ wakeLock=null; });
    } else if(!need&&wakeLock){ await wakeLock.release(); wakeLock=null; }
  }catch(e){ wakeLock=null; }
}

/* ----- Carte « Données » de l'onglet Joueur ----- */
function renderDataCard(){
  const el=$("#dataCard"); if(!el) return;
  el.innerHTML=`<label class="f" style="margin-top:0">Données</label>
    <div class="sub" id="sync" style="margin:0 0 10px">Sauvegarde : sur cet appareil</div>
    <div class="warn-box" id="exportWarn" style="display:none">⚠️ Tes données ne sont que sur cet appareil. Pense à exporter une sauvegarde : si le navigateur est vidé, tout est perdu.</div>
    <div class="data-btns">
      <button class="btn ghost" id="bExport">⬇ Sauvegarder (JSON)</button>
      <button class="btn ghost" id="bImport">⬆ Restaurer</button>
      <button class="btn ghost" id="bCsv">📄 Historique (CSV)</button>
    </div>
    <input type="file" id="fImport" accept="application/json,.json" hidden>
    <label class="chk"><input type="checkbox" id="cRemind" ${remindersOn()?"checked":""}> <span>Rappels des séances planifiées <small>(notification à l'heure prévue, tant que l'appli est ouverte)</small></span></label>
    <p class="legal">⚠️ Cette appli donne des conseils généraux d'entraînement et de nutrition ; ce n'est pas un avis médical. En cas de douleur, de maladie ou de doute, consulte un professionnel de santé.</p>`;
  $("#bExport").onclick=exportJson;
  $("#bCsv").onclick=exportCsv;
  $("#bImport").onclick=()=>$("#fImport").click();
  $("#fImport").onchange=e=>{ const f=e.target.files[0]; if(f) importJson(f); e.target.value=""; };
  $("#cRemind").onchange=async e=>{ const ok=await setReminders(e.target.checked); if(!ok) e.target.checked=false; };
  renderSync();
}

/* ----- Câblage ----- */
function initExtras(){
  // notes
  $("#session").addEventListener("input",e=>{
    if(e.target.id==="sessNote"&&state.current){ state.current.note=e.target.value; persistLocal(); }
    else if(e.target.id==="exNote"&&detailId){ const x=detailItem(); if(x){ x.note=e.target.value; commitTemp(); persistLocal(); } }
  });
  // favoris
  $("#favs").addEventListener("click",e=>{ const b=e.target.closest("[data-favgo]"); if(b) redoSession(b.dataset.favgo); });
  renderDataCard();
  // rappels, écran allumé
  setInterval(checkReminders,20000); checkReminders();
  setInterval(syncWakeLock,5000); document.addEventListener("visibilitychange",syncWakeLock);
  // hors-ligne
  if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(()=>{});
}
document.addEventListener("DOMContentLoaded",initExtras);
