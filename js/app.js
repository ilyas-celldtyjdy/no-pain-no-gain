/* ============ STOCKAGE (100 % local : localStorage) ============ */
const LS_KEY="coachmuscu.v1";
let storageOk=true;
function lsGet(){
  let raw=null;
  try{ raw=localStorage.getItem(LS_KEY); if(!raw) return {}; return migrateData(JSON.parse(raw)); }
  catch(e){ // données illisibles : on en garde une copie avant qu'elles soient écrasées
    if(raw){ try{ localStorage.setItem(LS_KEY+".corrompu",raw); }catch(_){} }
    return {};
  }
}
function lsSet(o){
  try{ o.v=DATA_VERSION; localStorage.setItem(LS_KEY,JSON.stringify(o)); storageOk=true; return true; }
  catch(e){
    if(storageOk){ storageOk=false; toast("⚠️ Impossible d'enregistrer sur cet appareil (stockage plein ou navigation privée). Exporte tes données depuis l'onglet Joueur !"); }
    return false;
  }
}
let state = Object.assign({profile:{sexe:"",poids:"",taille:"",age:"",weights:[],goal:"hypertrophie",level:"1",focus:"full",equip:"salle",duration:"60"},sessions:[],current:null,lastExport:0}, lsGet());
migrateMuscles();
function persistLocal(){ return lsSet({profile:state.profile,sessions:state.sessions,current:state.current,lastExport:state.lastExport||0}); }
function saveProfile(){ persistLocal(); }
async function saveSession(s){
  state.sessions.push(s); state.sessions.sort((a,b)=>a.date-b.date);
  persistLocal(); askPersist();
}
async function deleteSession(id){
  state.sessions=state.sessions.filter(s=>s.id!==id); persistLocal();
}
// Demande au navigateur de ne pas effacer les données automatiquement (stockage persistant)
let persisted=null;
async function askPersist(){
  try{
    if(!navigator.storage||!navigator.storage.persist) return;
    persisted=(await navigator.storage.persisted())||(await navigator.storage.persist());
  }catch(e){ persisted=null; }
  renderSync();
}
function renderSync(){
  const el=$("#sync"); if(!el) return;
  const last=state.lastExport?"Dernier export : "+new Date(state.lastExport).toLocaleDateString("fr-FR"):"Aucun export pour l'instant";
  el.textContent="Sauvegarde : sur cet appareil"+(persisted===true?" (stockage protégé)":persisted===false?" (le navigateur peut les effacer)":"")+". "+last+".";
  const w=$("#exportWarn");
  if(w) w.style.display=(state.sessions.length&&(!state.lastExport||Date.now()-state.lastExport>30*864e5))?"block":"none";
}

/* ----- Export / import ----- */
function exportPayload(){ return {app:"no-pain-no-gain",version:DATA_VERSION,exportedAt:new Date().toISOString(),data:{profile:state.profile,sessions:state.sessions,current:state.current}}; }
function downloadFile(name,text,type){
  const url=URL.createObjectURL(new Blob([text],{type})), a=document.createElement("a");
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function exportJson(){
  downloadFile("no-pain-no-gain-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(exportPayload(),null,1),"application/json");
  state.lastExport=Date.now(); persistLocal(); renderSync(); toast("Sauvegarde téléchargée ✅");
}
function importJson(file){
  const r=new FileReader();
  r.onerror=()=>toast("Lecture du fichier impossible");
  r.onload=()=>{
    let d; try{ d=parseImport(String(r.result)); }catch(e){ toast("❌ "+e.message); return; }
    confirmSheet(`Restaurer cette sauvegarde (${d.sessions.length} séance${d.sessions.length>1?"s":""}) ? Tes données actuelles seront remplacées (une copie de sécurité est gardée).`,"Restaurer",()=>{
      try{ localStorage.setItem(LS_KEY+".avant-import",JSON.stringify(exportPayload())); }catch(e){}
      state.profile=Object.assign(state.profile,d.profile); state.sessions=d.sessions.sort((a,b)=>a.date-b.date); state.current=d.current||null;
      migrateMuscles(); persistLocal();
      renderChips(); renderBody(); renderProfile(); renderSession(); renderProgress(); renderHud(); renderQuests(); renderTodayPlan(); renderSync();
      toast("Sauvegarde restaurée ✅");
    });
  };
  r.readAsText(file);
}
// Export CSV : une ligne par série, ouvrable dans Excel / Sheets
function exportCsv(){
  if(!state.sessions.length){ toast("Aucune séance à exporter"); return; }
  downloadFile("no-pain-no-gain-historique.csv",sessionsToCsv(state.sessions),"text/csv;charset=utf-8");
}

/* ============ THÈME ============ */
function applyTheme(){
  const t=state.profile.theme==="light"?"light":"dark";
  document.documentElement.setAttribute("data-theme",t);
  const b=document.getElementById("themeBtn");
  if(b){ b.innerHTML=t==="light"?"🌙":"☀️"; b.setAttribute("aria-label",t==="light"?"Passer en mode sombre":"Passer en mode clair"); }
  const m=document.querySelector('meta[name=theme-color]'); if(m) m.content=t==="light"?"#f4f5f2":"#0f1113";
}
document.getElementById("themeBtn").onclick=()=>{
  state.profile.theme=state.profile.theme==="light"?"dark":"light";
  applyTheme(); saveProfile();
};
applyTheme();

/* ============ UTILITAIRES ============ */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function toast(msg){const t=$("#toast");t.textContent=msg;t.style.display="block";clearTimeout(t._h);t._h=setTimeout(()=>t.style.display="none",msg.length>60?4500:2200)}
function fmtDate(ts){return new Date(ts).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}

/* ============ GÉNÉRATION ============ */
function candidates(muscle,p,used){
  const allow=EQUIP_ALLOW[p.equip], lv=+p.level;
  return EX.filter(e=>e.m===muscle && allow.includes(e.eq) && e.lv<=lv && !used.has(e.id));
}
function pickFor(muscle,p,used,preferCompound){
  let c=candidates(muscle,p,used); if(!c.length) return null;
  // préférence pour les exercices déjà faits (meilleur suivi), puis variété
  const done=new Set(state.sessions.flatMap(s=>s.exercises.map(x=>x.exId)));
  const pool=preferCompound&&c.some(e=>e.t==="c")?c.filter(e=>e.t==="c"):c;
  const ranked=shuffle(pool).sort((a,b)=>(done.has(b.id)?1:0)-(done.has(a.id)?1:0));
  return Math.random()<0.7?ranked[0]:pool[Math.floor(Math.random()*pool.length)];
}
function exMinutes(pr){return (pr.sets*(40+pr.rest)+90)/60}
/* ============ RÉCUPÉRATION MUSCULAIRE ============ */
// Chaque série dure fatigue le muscle principal (et à moitié les muscles qui aident), récupération linéaire sur ~72 h.
const FOCUS_MUSCLES={full:["pectoraux","dos","rhomboides","delt_ant","biceps","triceps","quadriceps","ischios","fessiers"],haut:["pectoraux","dos","rhomboides","delt_ant","delt_lat"],bas:["quadriceps","ischios","fessiers"],push:["pectoraux","delt_ant","triceps"],pull:["dos","rhomboides","biceps"],bras:["biceps","triceps","delt_lat"]};
function focusScore(f,r){const ms=FOCUS_MUSCLES[f]; return ms.reduce((a,m)=>a+r[m],0)/ms.length;}
function autoFocus(){
  const r=recovery();
  if(Object.values(r).every(v=>v>=95)) return "full";
  return Object.keys(FOCUS_MUSCLES).filter(f=>f!=="full").sort((a,b)=>focusScore(b,r)-focusScore(a,r))[0];
}
let recovOpen=false;
function renderRecovery(){
  const r=recovery(), el=$("#recov"); if(!el) return;
  if(!state.sessions.length){ el.innerHTML=`<div class="sub" style="margin:0">Après tes premières séances, tu verras ici quels muscles sont reposés.</div>`; return; }
  const tired=MAJOR.filter(m=>r[m]<80).sort((a,b)=>r[a]-r[b]);
  el.innerHTML=`<div class="rec-sum">Zone conseillée : <b>${FOCUS_TITLE[autoFocus()]}</b></div>
    <div class="rec-pills">${tired.length?tired.map(m=>`<span class="pill ${r[m]<50?"low":"mid"}">${MUSCLE_LABEL[m]} ${r[m]} %</span>`).join(""):`<span class="pill ok">Tous tes muscles sont reposés</span>`}</div>
    <button class="linkbtn" id="recovBtn" style="margin:8px 0 0;padding:4px 0">${recovOpen?"Masquer le détail ▲":"Voir le détail ▼"}</button>
    ${recovOpen?`<div class="rec-grid" style="margin-top:6px">${MAJOR.map(m=>{const v=r[m], st=v>=80?"ok":v>=50?"mid":"low";
    return `<div class="rv-row"><span>${MUSCLE_LABEL[m]}</span><div class="bar"><i class="${st}" style="width:${v}%"></i></div><b>${v}%</b></div>`}).join("")}</div>
    <div class="sub" style="margin:8px 0 0">Estimation d'après tes séances des 3 derniers jours.</div>`:""}`;
  $("#recovBtn").onclick=()=>{recovOpen=!recovOpen;renderRecovery();};
}

/* ============ GÉNÉRATEUR : SÉANCES TYPES ============ */
// Familles de mouvements -> exercices par ordre de préférence (le 1er dispo selon matériel/niveau est privilégié)
const PAT = {
  HPUSH:["dc_barre","dc_halt","pec_machine","pompes"],
  IPUSH:["di_halt","di_barre","pec_machine","pompes"],
  VPUSH:["dm_barre","dm_halt","ep_machine","pike_pushup"],
  VPUSH2:["dm_halt","ep_machine","pike_pushup"],
  VPULL:["tractions","tirage_vert","rowing_inverse"],
  HPULL:["rowing_barre","rowing_halt","tirage_horiz","rowing_machine","rowing_inverse"],
  HPULL2:["tirage_horiz","rowing_halt","rowing_machine","rowing_inverse"],
  CHESTISO:["vis_a_vis","pec_deck","ecarte_halt","pompes"],
  LATRAISE:["elev_lat","elev_lat_poulie","pike_pushup"],
  REAR:["face_pull","oiseau","prone_w","rowing_inverse"],
  BICEPS:["curl_barre","curl_halt","curl_poulie","curl_machine","chin_up"],
  BICEPS2:["curl_marteau","curl_poulie","curl_halt","chin_up"],
  TRICEPS:["ext_poulie","barre_front","ext_halt","tri_machine","pompes_serrees"],
  TRICEPS2:["ext_halt","kickback","ext_poulie","dips_banc"],
  DIPS:["dips","tri_machine","dips_banc"],
  PULLOVER:["pullover_poulie","rowing_halt","rowing_inverse"],
  SQUAT:["squat","presse","goblet","squat_pdc"],
  SQUAT2:["presse","goblet","bulgare","squat_pdc"],
  LUNGE:["bulgare","fentes_halt","fentes_pdc"],
  HINGE:["sdt_roumain","sdt_halt","good_morning_pdc"],
  LEGCURL:["leg_curl","good_morning_pdc","sdt_halt"],
  LEGEXT:["leg_ext","fentes_pdc","squat_pdc"],
  GLUTE:["hip_thrust","hip_thrust_halt","pont_fessier"],
  GLUTE2:["abducteurs","kickback_poulie","pont_fessier"],
  CALF:["mollets_machine","mollets_halt","mollets_pdc"],
  CORE:["releve_jambes","crunch_poulie","ab_machine","crunch"],
  CORE2:["planche","crunch","ab_machine"],
  CARDIO:["rameur_hiit","velo_hiit","burpees"],
  CARDIO2:["mountain","burpees","velo_hiit"],
  TRAPS:["shrug_barre","shrug_halt","shrug_machine","farmer"],
  TRAPS2:["farmer","shrug_halt","shrug_machine"],
  TRAPMID:["row_large","t_raise","prone_t"],
  TRAPMID2:["t_raise","prone_t","row_large"],
  TRAPLOW:["y_raise","scap_pull"],
  TRAPLOW2:["scap_pull","y_raise"],
  LATS2:["rowing_halt","tirage_vert","tractions"],
  RHOMB:["rowing_machine","tirage_horiz","rowing_inverse","rowing_barre"],
  TERES:["pullover_poulie","pullover_halt"],
  TERES2:["pullover_halt","pullover_poulie"],
  EXTROT:["rot_ext_poulie","rot_ext_halt","face_pull"],
  EXTROT2:["rot_ext_halt","face_pull","rot_ext_poulie"],
  FRONTRAISE:["elev_front","elev_front_poulie","pike_pushup"],
  LATRAISE2:["elev_lat_machine","elev_lat_poulie","elev_lat"],
  REAR2:["rear_delt_machine","oiseau","prone_w","face_pull"],
  OBLIQ:["bucheron_poulie","flexion_lat_halt","russian_twist"],
  OBLIQ2:["gainage_lat","russian_twist","bucheron_poulie"],
  LOWBACK:["hyperext","good_morning","superman"],
  LOWBACK2:["superman","bird_dog"],
  FOREARM:["wrist_curl","wrist_poulie","dead_hang"],
  FOREARM2:["rev_curl","rev_wrist","rev_wrist_poulie"],
  GRIP:["dead_hang","wrist_poulie","wrist_curl"],
};
// Séances types (inspirées des splits Upper/Lower, Push/Pull/Legs, Full body) :
// r = rôle (main = gros exercice de base, acc = complémentaire, iso = isolation), opt = sauté si pas le temps
const TPL = {
  haut:[{s:["HPUSH"],r:"main"},{s:["HPULL"],r:"main"},{s:["IPUSH","VPULL"],r:"acc"},{s:["VPUSH2","HPULL2"],r:"acc",opt:1},
        {s:["LATRAISE","REAR"],r:"iso"},{s:["BICEPS","TRICEPS"],r:"iso"},{s:["CHESTISO","BICEPS2"],r:"iso",opt:1},{s:["CORE"],r:"iso",opt:1}],
  bas:[{s:["SQUAT"],r:"main"},{s:["HINGE"],r:"main"},{s:["LUNGE","LEGCURL"],r:"acc"},{s:["GLUTE","LEGEXT"],r:"acc"},
       {s:["CALF","CORE"],r:"iso"},{s:["SQUAT2"],r:"acc",opt:1},{s:["GLUTE2","CORE2"],r:"iso",opt:1}],
  full:[{s:["SQUAT"],r:"main"},{s:["HPUSH"],r:"main"},{s:["HINGE","HPULL"],r:"acc"},{s:["VPUSH2","VPULL"],r:"acc"},
        {s:["LUNGE","CORE"],r:"acc",opt:1},{s:["BICEPS","TRICEPS"],r:"iso",opt:1},{s:["LATRAISE","CALF"],r:"iso",opt:1}],
  push:[{s:["HPUSH"],r:"main"},{s:["VPUSH"],r:"main"},{s:["IPUSH","LATRAISE"],r:"acc"},{s:["DIPS","CHESTISO"],r:"acc"},
        {s:["TRICEPS","CORE"],r:"iso"},{s:["TRICEPS2","LATRAISE"],r:"iso",opt:1}],
  pull:[{s:["VPULL"],r:"main"},{s:["HPULL"],r:"main"},{s:["HPULL2","PULLOVER"],r:"acc"},{s:["REAR","BICEPS"],r:"iso"},
        {s:["BICEPS2","CORE"],r:"iso"},{s:["HINGE"],r:"acc",opt:1}],
  bras:[{s:["VPUSH"],r:"main"},{s:["BICEPS","TRICEPS"],r:"acc"},{s:["LATRAISE","REAR"],r:"iso"},{s:["BICEPS2","TRICEPS2"],r:"iso"},
        {s:["DIPS","CORE"],r:"acc",opt:1},{s:["CHESTISO","LATRAISE"],r:"iso",opt:1}],
};
// [séries, reps min, reps max, repos (s) après la série ou après le tour de superset/circuit]
const RX = {
  force:       {main:[5,3,5,180], acc:[3,6,8,120],  iso:[3,8,12,90]},
  hypertrophie:{main:[4,6,10,150],acc:[3,8,12,90],  iso:[3,10,15,60]},
  seche:       {main:[3,8,12,90], acc:[3,10,12,75], iso:[3,12,15,60], fin:[3,30,40,30]},
  endurance:   {main:[3,12,15,60],acc:[3,15,20,45], iso:[3,15,20,45], fin:[3,30,45,30]},
};
const COACH = {
  force:"Peu de reps, charges lourdes, longs repos (3 min et plus sur les gros exercices) pour être frais à chaque série. Pas de superset sur les exercices de base. Dès que tu réussis toutes tes reps, ajoute un peu de charge.",
  hypertrophie:"Les gros exercices d'abord, avec 2 à 3 min de repos. Ensuite les compléments en duos (superset) pour garder une séance d'environ 1 h. Finis chaque série avec 1-2 reps en réserve. Pour progresser, vise au moins ~10 séries par muscle et par semaine.",
  seche:"Gros exercices d'abord pour garder ta force, puis des duos enchaînés (superset) pour garder le rythme, et un circuit final pour finir en intensité. La muscu sert surtout à garder ton muscle pendant que tu perds du gras : c'est un léger déficit calorique qui fait baisser le gras.",
  endurance:"Reps élevées, repos courts (moins de 90 s) et circuits enchaînés : tu travailles l'endurance musculaire et le cardio en même temps.",
};
function patList(pat){ if(pat.startsWith("M:")){ const m=pat.slice(2); return EX.filter(e=>e.m===m).sort((a,b)=>(a.t==="c"?0:1)-(b.t==="c"?0:1)).map(e=>e.id); } return PAT[pat]||[]; }
function pickPat(pat,p,used){
  const allow=EQUIP_ALLOW[p.equip], lv=+p.level;
  const cand=patList(pat).map(id=>EXMAP[id]).filter(e=>e&&allow.includes(e.eq)&&!used.has(e.id));
  let ok=cand.filter(e=>e.lv<=lv);
  // rien à ce niveau avec ce matériel (ex. biceps au poids du corps en débutant) : on prend la variante juste au-dessus
  if(!ok.length) ok=cand.filter(e=>e.lv<=lv+1);
  if(!ok.length) return null;
  // un peu de variété d'une séance à l'autre, sans remplacer une charge par du poids du corps
  const alt=ok.length>1&&(ok[1].eq!=="pdc"||ok[0].eq==="pdc");
  return (alt&&Math.random()<0.35)?ok[1]:ok[0];
}
function blockSeconds(b){
  // ~40 s par série, 15 s pour passer d'un exercice à l'autre dans un superset, pas de repos après la dernière série
  const work=b.items.reduce((a,it)=>a+(EXMAP[it.exId].time?it.reps[1]:40),0)+(b.items.length-1)*15;
  return b.sets*work+(b.sets-1)*b.rest+45;
}
function generate(){
  const p=Object.assign({},state.profile), goal=p.goal, rx=RX[goal], lv=+p.level, old=+p.age>=50;
  const isAuto=p.focus==="auto"; if(isAuto) p.focus=autoFocus();
  const rec=recovery(), tired=(p.focus==="custom"?(p.muscles||[]):(FOCUS_MUSCLES[p.focus]||[])).filter(m=>rec[m]<55);
  const warm=old?10:8, budget=(+p.duration-warm)*60;
  // 1) transformer le modèle selon l'objectif
  const isCustom=p.focus==="custom"&&(p.muscles||[]).length;
  if(p.focus==="custom"&&!isCustom) p.focus="full";
  let tpl=(isCustom?customTemplate(p.muscles):TPL[p.focus]).map(b=>({...b,s:b.s.slice()}));
  if(goal==="force") tpl=tpl.flatMap(b=>b.s.map((s,i)=>({s:[s],r:b.r,opt:b.opt||(i>0&&b.r==="iso")})));
  if(goal==="endurance"){ // regroupe les duos en circuits de 3-4 exercices
    const out=[]; let cur=null;
    for(const b of tpl){
      if(b.r==="main"){out.push(b);continue}
      if(cur&&cur.s.length+b.s.length<=4){cur.s.push(...b.s); cur.opt=cur.opt&&b.opt;}
      else {cur={s:b.s.slice(),r:"acc",opt:b.opt}; out.push(cur);}
    }
    tpl=out;
  }
  if(rx.fin) tpl.push({s:["CARDIO","CORE2","CARDIO2"],r:"fin"});
  // 2) choisir les exercices
  const used=new Set(); let blocks=[];
  for(const b of tpl){
    const [sets0,lo,hi,rest0]=rx[b.r];
    let sets=sets0;
    if(b.r==="main"&&lv===1) sets=Math.max(3,sets-1);
    if(b.r==="main"&&lv===3) sets+=1;
    const items=[];
    for(const pat of b.s){
      const ex=pickPat(pat,p,used); if(!ex) continue;
      used.add(ex.id);
      const reps=ex.time?(b.r==="fin"?[lo,hi]:[30,60]):[lo,hi];
      items.push({exId:ex.id,reps});
    }
    if(!items.length) continue;
    blocks.push({r:b.r,opt:!!b.opt,sets,rest:rest0+(old?15:0),items});
  }
  // 3) tenir dans le temps : le circuit final est gardé, on remplit avec le reste dans l'ordre
  const fin=blocks.find(b=>b.r==="fin");
  let left=budget-(fin?blockSeconds(fin):0), chosen=[];
  for(const b of blocks){
    if(b.r==="fin") continue;
    const bt=blockSeconds(b);
    if(bt<=left+150 || chosen.length<2){chosen.push(b); left-=bt;} // ~2 min de tolérance
  }
  // s'il reste du temps, une série de plus sur les blocs principaux
  for(const b of chosen){
    if(b.r==="iso") continue;
    const add=blockSeconds({...b,sets:b.sets+1})-blockSeconds(b);
    if(add<=left && b.sets<(b.r==="main"?6:4)){b.sets++; left-=add;}
  }
  for(const b of chosen){ // puis les isolations, si du temps reste
    if(b.r!=="iso") continue;
    const add=blockSeconds({...b,sets:b.sets+1})-blockSeconds(b);
    if(add<=left && b.sets<4){b.sets++; left-=add;}
  }
  if(fin) chosen.push(fin);
  // 4) construire la séance
  const list=[], meta=[];
  chosen.forEach((b,bi)=>{
    const L=String.fromCharCode(65+bi), n=b.items.length;
    const type=b.r==="fin"?"finisher":n===1?"single":n===2?"superset":"circuit";
    meta.push({label:L,type,r:b.r,sets:b.sets,rest:b.rest,ids:b.items.map(i=>i.exId)});
    b.items.forEach((it,k)=>{
      const ex=EXMAP[it.exId];
      const pr={sets:b.sets,reps:it.reps,rest:k===n-1?b.rest:0};
      const item=makeItem(ex,pr);
      item.blk=n>1?L+(k+1):L; item.type=type; item.role=b.r;
      item.next=n>1?b.items[(k+1)%n].exId:null;
      list.push(item);
    });
  });
  const total=Math.round((budget-left)/60+warm);
  detailId=null; detailTemp=null;
  const why=[];
  if(isAuto) why.push(`Mode auto : j'ai choisi « ${FOCUS_TITLE[p.focus]} » car ce sont tes muscles les plus reposés.`);
  const usedMin=Math.round((budget-left)/60+warm);
  if(usedMin<+p.duration-10) why.push(`Séance plus courte que prévu (≈ ${usedMin} min) : pour ${isCustom&&p.muscles.length<=2?"ces muscles":"cette sélection"}, plus de séries n'apporterait pas grand-chose. Ajoute un muscle pour une séance plus longue.`);
  if(isCustom){
    const allowEq=EQUIP_ALLOW[p.equip], miss=p.muscles.filter(m=>!list.some(it=>EXMAP[it.exId].m===m));
    const noEq=miss.filter(m=>!EX.some(e=>e.m===m&&allowEq.includes(e.eq))), noTime=miss.filter(m=>!noEq.includes(m));
    if(noEq.length) why.push(`Pas d'exercice avec ton matériel pour : ${noEq.map(m=>MUSCLE_LABEL[m].toLowerCase()).join(", ")}. Choisis « Salle complète » pour les travailler.`);
    if(noTime.length) why.push(`Pas assez de temps pour tout couvrir : ${noTime.map(m=>MUSCLE_LABEL[m].toLowerCase()).join(", ")} ${noTime.length>1?"ne sont":"n'est"} pas dans la séance. Allonge la durée ou choisis moins de muscles.`);
  }
  if(tired.length) why.push(`Attention : ${tired.map(m=>MUSCLE_LABEL[m].toLowerCase()).join(", ")} encore fatigué${tired.length>1?"s":""} de tes dernières séances. Garde 1-2 reps de plus en réserve, ou choisis une autre zone.`);
  if(!list.length){ toast(why.find(w=>w.startsWith("Pas d'exercice"))||"Aucun exercice possible avec cette sélection. Change de matériel ou de muscles."); return; }
  state.current={id:uid(),created:Date.now(),title:isCustom?customTitle(p.muscles):FOCUS_TITLE[p.focus],goal,why,est:Math.min(total,+p.duration),warm,blocks:meta,exercises:list};
  persistLocal(); renderSession(); show("session"); window.scrollTo(0,0);
}
function lastPerf(exId){
  for(let i=state.sessions.length-1;i>=0;i--){
    const x=state.sessions[i].exercises.find(e=>e.exId===exId);
    if(x && x.sets.some(s=>s.done)) return x;
  }
  return null;
}
function suggestion(exId,pr){
  const ex=EXMAP[exId], last=lastPerf(exId);
  if(ex.time){ // gainage, cardio : on suit la durée, pas la charge
    if(!last) return {kg:"",msg:""};
    const best=Math.max(...last.sets.filter(z=>z.done).map(z=>+z.reps||0));
    return {kg:"",msg:best?`🎯 Objectif du jour : dépasser ${best} s, ou aller plus fort sur la même durée.`:""};
  }
  if(!last){
    const est=startLoad(ex);
    if(est) return {kg:est,msg:`Charge de départ estimée d'après ton profil : ${fmtKg(est)} kg${ex.eq==="haltere"?" par haltère":""}. Ajuste si tu as plus ou moins de ~2 reps en réserve.`};
    return {kg:"",msg:ex.eq==="pdc"?"":"Première fois : choisis une charge où tu finis la série avec ~2 reps en réserve. (Renseigne ton profil pour une estimation.)"};
  }
  const done=last.sets.filter(s=>s.done);
  const top=Math.max(...done.map(s=>+s.kg||0));
  const allHit=done.length>=pr.sets && done.every(s=>(+s.reps||0)>=pr.reps[1]);
  if(ex.eq==="pdc"||!top){
    const best=Math.max(...done.map(s=>+s.reps||0));
    return {kg:"",msg:allHit?`🎯 Objectif du jour : +1 rep par série, ou ajoute un peu de lest.`:`🎯 Objectif du jour : battre ton meilleur score de ${best} reps.`};
  }
  const inc=STEP[ex.eq]||2.5, eff=last.effort;
  const snap=v=>Math.max(inc,Math.round(v/inc)*inc);
  if(allHit && eff==="easy") return {kg:top+2*inc,msg:`🎯 Objectif du jour : tout validé et facile la dernière fois → grosse marche à ${fmtKg(top+2*inc)} kg 🚀`};
  if(allHit && eff==="hard") return {kg:top,msg:`🎯 Objectif du jour : tout validé mais c'était dur → on consolide à ${fmtKg(top)} kg avant de monter.`};
  if(allHit) return {kg:top+inc,msg:`🎯 Objectif du jour : tout validé la dernière fois → monte à ${fmtKg(top+inc)} kg 💪`};
  if(eff==="hard"){ const d=snap(top*0.92); if(d<top) return {kg:d,msg:`🎯 Objectif du jour : c'était trop dur la dernière fois → on redescend à ${fmtKg(d)} kg pour faire toutes tes reps.`}; }
  return {kg:top,msg:`🎯 Objectif du jour : garde ${fmtKg(top)} kg et ajoute 1 rep par série, jusqu'à ${pr.reps[1]} reps partout.`};
}
function startLoad(ex){
  const p=state.profile, bw=+p.poids, r=START[ex.id];
  if(!bw||!r) return null;
  let k=bw*r*({1:.7,2:1,3:1.3}[p.level]||1);
  if(p.sexe==="f") k*=LOWER.has(ex.m)?.8:.55;
  if(+p.age>=50) k*=.85;
  k*=({force:1.1,hypertrophie:1,seche:.85,endurance:.75}[p.goal]||1);
  const step=STEP[ex.eq]||2.5;
  return Math.max(step,Math.round(k/step)*step);
}
function makeItem(ex,pr){
  const sg=suggestion(ex.id,pr);
  return {exId:ex.id,name:ex.n,planKg:sg.kg,sets:Array.from({length:pr.sets},()=>({kg:sg.kg===""?"":sg.kg,reps:"",done:false})),pr,hint:sg.msg};
}

/* ============ RENDU : CRÉER ============ */
function renderChips(){
  $$(".chips[data-key]").forEach(el=>{
    const k=el.dataset.key;
    el.innerHTML=OPTS[k].map(([v,l])=>`<button class="chip ${state.profile[k]===v?"on":""}" data-v="${v}">${l}</button>`).join("");
  });
  renderBodyMap();
}
document.addEventListener("click",e=>{
  const c=e.target.closest(".chips[data-key] .chip"); if(!c) return;
  const k=c.parentElement.dataset.key; state.profile[k]=c.dataset.v; if(k==="focus") state.profile.muscles=PRESET_M[c.dataset.v]||[]; saveProfile(); renderChips(); renderProfile();
});
function renderBody(){
  const p=state.profile;
  $("#pPoids").value=p.poids||""; $("#pTaille").value=p.taille||""; $("#pAge").value=p.age||"";
  renderBmi();
}
function renderBmi(){
  const p=state.profile, w=+p.poids, h=+p.taille/100;
  if(!w||!h){$("#bmi").innerHTML="Ces infos servent à estimer tes charges de départ et à adapter repos et échauffement.";return}
  const b=w/(h*h);
  const cat=b<18.5?"maigreur":b<25?"corpulence normale":b<30?"surpoids":"obésité";
  $("#bmi").innerHTML=`IMC : <b>${fmtKg(Math.round(b*10)/10)}</b> (${cat}). L'IMC ne distingue pas muscle et graisse : avec beaucoup de muscle, il surestime.`;
}
function renderScore(){
  const el=$("#score"), sc=strengthScore();
  if(!sc){el.innerHTML=`<label class="f" style="margin-top:0">Score de force</label><div class="sub" style="margin:0">Renseigne ton poids pour calculer ton score.</div>`;return}
  if(sc.score===null){el.innerHTML=`<label class="f" style="margin-top:0">Score de force</label><div class="sub" style="margin:0">Fais des exercices de base (développé couché, squat, soulevé de terre, rowing, développé épaules) pour obtenir ton score.</div>`;return}
  const lvl=sc.score<40?"Débutant":sc.score<65?"Intermédiaire":sc.score<85?"Avancé":"Élite";
  el.innerHTML=`<label class="f" style="margin-top:0">Score de force</label>
    <div class="score-top"><div class="score-num">${sc.score}</div><div><b>${lvl}</b><small>sur 100 · d'après ton 1RM estimé rapporté à ton poids</small></div></div>
    ${sc.parts.map(x=>`<div class="rv-row"><span>${x.name}</span><div class="bar"><i class="ok" style="width:${x.pct}%"></i></div><b>${x.pct}</b></div>`).join("")}
    <div class="sub" style="margin:8px 0 0">Estimation indicative : 100 = niveau très avancé pour ton poids${state.profile.sexe==="f"?" (barème adapté femme)":""}.</div>`;
}
function renderProfile(){
  renderScore(); renderHud();
  const p=state.profile, S=state.sessions;
  renderPlayer();
  const first=S.length?S[0].date:null;
  const weeks=first?Math.max(1,(Date.now()-first)/(7*864e5)):0;
  $("#profStats").innerHTML=`
    <div class="stat"><b>${S.length}</b><small>séance${S.length>1?"s":""}</small></div>
    <div class="stat"><b>${S.length?fmtKg(Math.round(S.length/weeks*10)/10):0}</b><small>par semaine</small></div>
    <div class="stat"><b>${first?new Date(first).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):"—"}</b><small>1re séance</small></div>`;
  const rec={};
  for(const s of S) for(const x of s.exercises) for(const z of x.sets){
    if(z.kg>0 && (!rec[x.exId] || z.kg>rec[x.exId].kg || (z.kg===rec[x.exId].kg && z.reps>rec[x.exId].reps))) rec[x.exId]={kg:z.kg,reps:z.reps,d:s.date};
  }
  const ids=Object.keys(rec).filter(id=>EXMAP[id]).sort((a,b)=>rec[b].kg-rec[a].kg);
  $("#records").innerHTML=ids.length?ids.map(id=>`<div class="rec"><div class="ra">${artSvg(id)}</div>
      <div class="rn">${esc(EXMAP[id].n)}<small>${rec[id].reps} reps · ${fmtDate(rec[id].d)}</small></div>
      <div class="rv">${fmtKg(rec[id].kg)} kg</div></div>`).join("")
    :`<div class="empty">Tes meilleures charges apparaîtront ici après ta première séance.</div>`;
  $("#nudge").style.display=(p.poids&&p.age&&p.sexe)?"none":"block";
  renderRecovery();
}
$("#nudge").onclick=()=>{show("profile");window.scrollTo(0,0)};
function bindBody(id,key){
  $(id).addEventListener("change",e=>{
    let v=e.target.value.replace(",",".").trim();
    if(v!==""&&!(+v>0)){e.target.value=state.profile[key]||"";return}
    state.profile[key]=v;
    if(key==="poids"&&v){
      const W=state.profile.weights=(state.profile.weights||[]).slice();
      const today=new Date().toDateString();
      const last=W[W.length-1];
      if(last&&new Date(last.d).toDateString()===today) last.kg=+v; else W.push({d:Date.now(),kg:+v});
    }
    saveProfile(); renderBmi(); renderProgress(); renderProfile();
  });
}
bindBody("#pPoids","poids"); bindBody("#pTaille","taille"); bindBody("#pAge","age");
$("#gen").onclick=()=>{
  if(state.current && state.current.exercises.some(x=>x.sets.some(s=>s.done))){
    confirmSheet("Une séance est en cours avec des séries validées. La remplacer par une nouvelle ?","Remplacer",generate);
  } else generate();
};

/* ============ ILLUSTRATIONS (silhouettes SVG dessinées en code) ============ */
// Points : h tête, s épaule, p hanche, k/f genou/pied (1 = devant, 2 = derrière), e/w coude/main.
// props : ["bench",x1,y1,x2,y2] ["bar",x1,y1,x2,y2] ["cable",x1,y1,x2,y2] ["post",x,y1,y2] ["pad",x,y] ["step",x1,x2]
// load : où dessiner la charge (main par défaut)
const P = (o)=>Object.assign({k2:o.k1,f2:o.f1,e2:o.e1,w2:o.w1,props:[]},o);
const POSES = {
 bench:   P({h:[20,55],s:[27,57],p:[54,57],k1:[68,50],f1:[72,86],e1:[29,45],w1:[29,33],props:[["bench",16,62,64,62]]}),
 incline: P({h:[24,30],s:[29,37],p:[50,61],k1:[67,57],f1:[72,86],e1:[38,28],w1:[40,16],props:[["bench",22,42,48,68],["bench",48,68,64,68]]}),
 skull:   P({h:[20,55],s:[27,57],p:[54,57],k1:[68,50],f1:[72,86],e1:[29,40],w1:[20,44],props:[["bench",16,62,64,62]]}),
 fly:     P({h:[20,55],s:[27,57],p:[54,57],k1:[68,50],f1:[72,86],e1:[18,46],w1:[14,38],e2:[38,46],w2:[42,38],props:[["bench",16,62,64,62]]}),
 pushup:  P({h:[20,60],s:[27,65],p:[55,71],k1:[70,77],f1:[85,85],e1:[27,76],w1:[27,87]}),
 pike:    P({h:[29,78],s:[33,70],p:[54,44],k1:[65,66],f1:[75,87],e1:[28,79],w1:[24,87]}),
 dips:    P({h:[50,18],s:[50,28],p:[52,54],k1:[48,68],f1:[58,77],e1:[40,38],w1:[46,52],props:[["bar",34,53,66,53],["post",36,53,88],["post",64,53,88]]}),
 benchdip:P({h:[40,32],s:[40,42],p:[40,66],k1:[60,64],f1:[63,87],e1:[28,48],w1:[28,58],props:[["bench",10,58,30,58]]}),
 pullup:  P({h:[50,27],s:[50,36],p:[50,61],k1:[51,75],f1:[46,87],e1:[37,24],w1:[42,10],e2:[63,24],w2:[58,10],props:[["bar",26,10,74,10]]}),
 hang:    P({h:[50,29],s:[50,36],p:[50,60],k1:[66,60],f1:[66,77],e1:[44,22],w1:[44,10],e2:[56,22],w2:[56,10],props:[["bar",30,10,70,10]]}),
 row:     P({h:[67,30],s:[59,35],p:[38,47],k1:[45,66],f1:[41,87],e1:[46,40],w1:[52,55]}),
 rowOne:  P({h:[67,30],s:[59,35],p:[38,47],k1:[45,66],f1:[41,87],e1:[46,40],w1:[52,55],e2:[66,47],w2:[70,60],props:[["bench",62,62,88,62]]}),
 rearfly: P({h:[67,30],s:[59,35],p:[38,47],k1:[45,66],f1:[41,87],e1:[52,26],w1:[44,20]}),
 kickback:P({h:[67,30],s:[59,35],p:[38,47],k1:[45,66],f1:[41,87],e1:[47,40],w1:[33,41]}),
 pulldown:P({h:[48,30],s:[48,40],p:[46,62],k1:[64,62],f1:[64,84],e1:[38,30],w1:[40,18],e2:[58,30],w2:[56,18],props:[["bench",34,63,58,63],["bar",30,18,66,18],["cable",48,18,48,4]]}),
 seatrow: P({h:[36,34],s:[38,44],p:[38,66],k1:[56,58],f1:[72,70],e1:[28,52],w1:[46,56],props:[["bench",28,67,48,67],["cable",46,56,92,60]]}),
 inverted:P({h:[73,49],s:[66,55],p:[42,70],k1:[30,79],f1:[17,87],e1:[60,45],w1:[70,43],props:[["post",70,43,88],["pad",70,43]]}),
 ohp:     P({h:[50,22],s:[50,32],p:[50,57],k1:[50,72],f1:[50,87],e1:[42,23],w1:[44,10]}),
 seatOhp: P({h:[40,24],s:[40,34],p:[40,60],k1:[58,60],f1:[58,84],e1:[32,24],w1:[34,12],props:[["bench",30,61,50,61],["bench",30,26,30,61]]}),
 lateral: P({h:[50,20],s:[50,30],p:[50,57],k1:[46,72],f1:[44,87],k2:[54,72],f2:[56,87],e1:[38,32],w1:[25,33],e2:[62,32],w2:[75,33]}),
 latCable:P({h:[50,20],s:[50,30],p:[50,57],k1:[46,72],f1:[44,87],k2:[54,72],f2:[56,87],e1:[38,32],w1:[25,33],e2:[56,44],w2:[56,56],props:[["cable",25,33,82,86]]}),
 facepull:P({h:[48,22],s:[48,32],p:[48,57],k1:[48,72],f1:[48,87],e1:[42,24],w1:[58,22],props:[["cable",58,22,94,22]]}),
 curl:    P({h:[48,22],s:[48,32],p:[48,57],k1:[48,72],f1:[48,87],e1:[50,47],w1:[61,37]}),
 curlCab: P({h:[48,22],s:[48,32],p:[48,57],k1:[48,72],f1:[48,87],e1:[50,47],w1:[61,37],props:[["cable",61,37,84,86]]}),
 preacher:P({h:[36,26],s:[38,36],p:[38,60],k1:[56,60],f1:[56,84],e1:[54,46],w1:[60,32],props:[["bench",30,61,50,61],["bench",46,40,58,50]]}),
 pushdown:P({h:[46,22],s:[46,32],p:[46,57],k1:[46,72],f1:[46,87],e1:[50,46],w1:[60,57],props:[["cable",60,57,66,4]]}),
 overhead:P({h:[50,22],s:[50,32],p:[50,57],k1:[50,72],f1:[50,87],e1:[55,13],w1:[42,20]}),
 squat:   P({h:[52,34],s:[48,44],p:[33,65],k1:[57,66],f1:[52,87],e1:[40,54],w1:[44,44],load:[44,43]}),
 goblet:  P({h:[52,34],s:[48,44],p:[33,65],k1:[57,66],f1:[52,87],e1:[56,57],w1:[58,48]}),
 squatBw: P({h:[52,34],s:[48,44],p:[33,65],k1:[57,66],f1:[52,87],e1:[60,46],w1:[73,46]}),
 lunge:   P({h:[50,22],s:[50,32],p:[50,58],k1:[66,68],f1:[66,87],k2:[42,84],f2:[30,87],e1:[50,46],w1:[50,58]}),
 bulgare: P({h:[50,24],s:[50,34],p:[48,60],k1:[64,67],f1:[64,87],k2:[38,80],f2:[24,62],e1:[50,47],w1:[50,59],props:[["bench",12,64,32,64]]}),
 press:   P({h:[22,36],s:[26,44],p:[38,70],k1:[55,50],f1:[71,61],e1:[33,59],w1:[39,68],props:[["bench",16,40,34,74],["bar",68,46,78,72]]}),
 legext:  P({h:[36,28],s:[36,38],p:[38,60],k1:[56,60],f1:[76,56],e1:[40,50],w1:[45,60],props:[["bench",30,61,56,61],["bench",30,30,30,61],["pad",78,58]]}),
 rdl:     P({h:[70,36],s:[62,40],p:[40,46],k1:[45,66],f1:[42,87],e1:[62,54],w1:[60,67]}),
 deadlift:P({h:[67,33],s:[60,40],p:[38,54],k1:[53,67],f1:[45,87],e1:[58,57],w1:[56,73],load:[55,79]}),
 legcurl: P({h:[16,52],s:[25,56],p:[51,56],k1:[67,56],f1:[60,40],e1:[18,63],w1:[11,63],props:[["bench",14,61,70,61],["pad",60,39]]}),
 gm:      P({h:[72,40],s:[64,42],p:[44,48],k1:[46,68],f1:[46,87],k2:[30,46],f2:[15,46],e1:[64,56],w1:[64,67]}),
 thrust:  P({h:[19,49],s:[28,54],p:[52,52],k1:[68,54],f1:[68,87],e1:[38,47],w1:[50,47],load:[52,44],props:[["bench",8,58,28,58]]}),
 bridge:  P({h:[16,82],s:[24,81],p:[48,67],k1:[64,61],f1:[70,87],e1:[32,86],w1:[42,87]}),
 abduct:  P({h:[50,24],s:[50,34],p:[50,60],k1:[33,67],f1:[29,86],k2:[67,67],f2:[71,86],e1:[40,48],w1:[37,59],e2:[60,48],w2:[63,59],props:[["bench",36,62,64,62],["pad",28,67],["pad",72,67]]}),
 glutekick:P({h:[63,27],s:[58,35],p:[46,56],k1:[48,72],f1:[48,87],k2:[32,66],f2:[18,74],e1:[66,44],w1:[73,50],props:[["cable",18,74,4,87],["post",76,40,88]]}),
 calf:    P({h:[50,16],s:[50,26],p:[50,52],k1:[50,68],f1:[52,82],e1:[50,40],w1:[50,52],props:[["step",40,64]]}),
 calfMach:P({h:[50,16],s:[50,26],p:[50,52],k1:[50,68],f1:[52,82],e1:[44,20],w1:[52,22],props:[["step",40,64],["bar",36,24,64,24],["post",36,24,88]]}),
 plank:   P({h:[20,70],s:[28,72],p:[56,73],k1:[70,78],f1:[84,85],e1:[28,86],w1:[39,86]}),
 crunch:  P({h:[28,65],s:[34,72],p:[50,84],k1:[64,68],f1:[73,86],e1:[34,60],w1:[26,63]}),
 crunchCab:P({h:[71,60],s:[63,54],p:[47,64],k1:[47,86],f1:[29,86],e1:[66,45],w1:[70,54],props:[["cable",70,54,72,4]]}),
 abMach:  P({h:[51,34],s:[45,40],p:[40,61],k1:[58,61],f1:[58,84],e1:[54,44],w1:[52,34],props:[["bench",30,62,50,62]]}),
 seatPress:P({h:[36,26],s:[36,36],p:[38,60],k1:[56,62],f1:[56,84],e1:[46,44],w1:[60,38],props:[["bench",30,61,48,61],["bench",30,28,30,61],["post",68,10,88],["pad",60,38]]}),
 pecdeck: P({h:[36,26],s:[36,36],p:[38,60],k1:[56,62],f1:[56,84],e1:[48,34],w1:[56,24],props:[["bench",30,61,48,61],["bench",30,28,30,61],["pad",50,30]]}),
 seatDip: P({h:[40,24],s:[40,34],p:[40,60],k1:[58,60],f1:[58,84],e1:[30,46],w1:[42,58],props:[["bench",30,61,50,61],["pad",42,58]]}),
 machRow: P({h:[56,28],s:[52,36],p:[38,60],k1:[56,60],f1:[60,84],e1:[36,40],w1:[50,42],props:[["bench",30,61,48,61],["bench",60,30,60,50],["pad",50,42]]}),
 cablefly:P({h:[48,22],s:[48,32],p:[48,57],k1:[52,72],f1:[56,87],k2:[44,72],f2:[40,87],e1:[60,38],w1:[70,44],props:[["cable",70,44,94,8]]}),
 jump:    P({h:[50,13],s:[50,23],p:[50,49],k1:[46,65],f1:[44,80],k2:[54,65],f2:[56,80],e1:[41,13],w1:[38,3],e2:[59,13],w2:[62,3]}),
 mountain:P({h:[20,58],s:[27,63],p:[52,68],k1:[38,72],f1:[50,85],k2:[68,76],f2:[84,85],e1:[27,75],w1:[27,87]}),
 bike:    P({h:[60,24],s:[54,32],p:[38,50],k1:[55,57],f1:[50,76],k2:[47,64],f2:[42,82],e1:[62,38],w1:[68,42],props:[["post",40,52,88],["post",70,42,88],["bar",64,42,74,42],["bench",34,52,44,52]]}),
 rower:   P({h:[34,36],s:[36,46],p:[38,66],k1:[56,58],f1:[72,70],e1:[28,54],w1:[46,56],props:[["bar",20,78,92,78],["bench",30,68,46,68],["bench",72,62,76,76]]}),
 pullover:P({h:[56,24],s:[53,32],p:[46,57],k1:[48,72],f1:[46,87],e1:[62,45],w1:[66,58],props:[["cable",66,58,88,6]]}),
 shrug:   P({h:[48,19],s:[48,28],p:[48,57],k1:[48,72],f1:[48,87],e1:[50,43],w1:[51,56]}),
 shrugMach:P({h:[48,19],s:[48,28],p:[48,57],k1:[48,72],f1:[48,87],e1:[50,43],w1:[51,56],props:[["post",62,10,88],["bar",50,56,62,56]]}),
 farmer:  P({h:[50,22],s:[50,32],p:[50,57],k1:[58,72],f1:[62,87],k2:[42,72],f2:[38,87],e1:[52,45],w1:[53,57],e2:[48,45],w2:[47,57]}),
 yraise:  P({h:[66,42],s:[58,48],p:[34,64],k1:[24,76],f1:[16,87],e1:[68,36],w1:[76,26],props:[["bench",28,72,64,52]]}),
 deadhang:P({h:[50,24],s:[50,32],p:[50,57],k1:[50,70],f1:[50,82],e1:[47,20],w1:[46,9],e2:[53,20],w2:[54,9],props:[["bar",30,9,70,9]]}),
 hyperext:P({h:[70,36],s:[62,43],p:[44,60],k1:[33,71],f1:[22,82],e1:[58,52],w1:[64,47],props:[["bench",30,80,52,62],["pad",24,84]]}),
 gmBar:   P({h:[72,42],s:[64,43],p:[44,50],k1:[47,69],f1:[45,87],e1:[58,50],w1:[64,40],load:[64,40]}),
 superman:P({h:[22,74],s:[30,78],p:[56,81],k1:[70,79],f1:[84,74],e1:[18,74],w1:[8,70]}),
 birddog: P({h:[26,56],s:[34,62],p:[60,62],k1:[74,60],f1:[88,58],k2:[60,87],f2:[74,87],e1:[22,58],w1:[10,56],e2:[34,75],w2:[34,87]}),
 wristcurl:P({h:[38,24],s:[40,34],p:[38,60],k1:[58,60],f1:[58,84],e1:[46,58],w1:[60,55],props:[["bench",28,61,50,61]]}),
 wristCab:P({h:[38,24],s:[40,34],p:[38,60],k1:[58,60],f1:[58,84],e1:[46,58],w1:[60,55],props:[["bench",28,61,50,61],["cable",60,55,70,86]]}),
 frontraise:P({h:[48,22],s:[48,32],p:[48,57],k1:[48,72],f1:[48,87],e1:[58,33],w1:[70,32]}),
 frontCab:P({h:[48,22],s:[48,32],p:[48,57],k1:[48,72],f1:[48,87],e1:[58,33],w1:[70,32],props:[["cable",70,32,38,84]]}),
 proneW:  P({h:[22,78],s:[30,80],p:[56,82],k1:[70,84],f1:[84,85],e1:[34,72],w1:[24,70]}),
 proneT:  P({h:[22,78],s:[30,80],p:[56,82],k1:[70,84],f1:[84,85],e1:[31,72],w1:[32,63]}),
 traise:  P({h:[66,42],s:[58,48],p:[34,64],k1:[24,76],f1:[16,87],e1:[61,38],w1:[63,28],props:[["bench",28,72,64,52]]}),
 pullHalt:P({h:[24,59],s:[32,61],p:[54,61],k1:[66,61],f1:[72,87],e1:[22,53],w1:[12,56],props:[["bench",18,66,58,66]]}),
 rotCab:  P({h:[48,22],s:[48,32],p:[48,57],k1:[48,72],f1:[48,87],e1:[49,45],w1:[61,44],props:[["post",92,30,88],["cable",61,44,90,44]]}),
 rotSide: P({h:[18,77],s:[26,79],p:[52,81],k1:[68,83],f1:[84,85],e1:[40,75],w1:[40,64]}),
 chop:    P({h:[50,22],s:[50,32],p:[50,57],k1:[56,72],f1:[60,87],k2:[44,72],f2:[40,87],e1:[60,46],w1:[66,58],props:[["cable",66,58,92,8]]}),
 sidebend:P({h:[43,23],s:[45,33],p:[50,57],k1:[50,72],f1:[50,87],e1:[50,46],w1:[53,58]}),
 twist:   P({h:[32,50],s:[37,58],p:[50,80],k1:[64,66],f1:[78,72],e1:[48,62],w1:[58,60]}),
 sideplank:P({h:[20,64],s:[27,70],p:[52,77],k1:[68,81],f1:[86,86],e1:[27,86],w1:[37,86],e2:[38,73],w2:[46,75]}),
};
// exercice -> [pose, charge] ; charge : plate (barre), db (haltère), none
const ART = {
 dc_barre:["bench","plate"],dc_halt:["bench","db"],di_halt:["incline","db"],di_barre:["incline","plate"],pec_machine:["seatPress","none"],
 pompes:["pushup","none"],dips:["dips","none"],ecarte_halt:["fly","db"],pec_deck:["pecdeck","none"],vis_a_vis:["cablefly","none"],
 tractions:["pullup","none"],rowing_barre:["row","plate"],rowing_halt:["rowOne","db"],tirage_vert:["pulldown","none"],tirage_horiz:["seatrow","none"],
 rowing_machine:["machRow","none"],rowing_inverse:["inverted","none"],pullover_poulie:["pullover","none"],
 dm_halt:["seatOhp","db"],dm_barre:["ohp","plate"],ep_machine:["seatOhp","none"],pike_pushup:["pike","none"],elev_lat:["lateral","db"],
 elev_lat_poulie:["latCable","none"],oiseau:["rearfly","db"],face_pull:["facepull","none"],
 curl_halt:["curl","db"],curl_barre:["curl","plate"],curl_marteau:["curl","db"],curl_poulie:["curlCab","none"],curl_machine:["preacher","none"],chin_up:["pullup","none"],
 ext_poulie:["pushdown","none"],barre_front:["skull","plate"],ext_halt:["overhead","db"],kickback:["kickback","db"],dips_banc:["benchdip","none"],
 pompes_serrees:["pushup","none"],tri_machine:["seatDip","none"],
 squat:["squat","plate"],goblet:["goblet","db"],presse:["press","none"],fentes_halt:["lunge","db"],bulgare:["bulgare","db"],squat_pdc:["squatBw","none"],
 fentes_pdc:["lunge","none"],leg_ext:["legext","none"],
 sdt_roumain:["rdl","plate"],sdt_halt:["rdl","db"],sdt:["deadlift","plate"],leg_curl:["legcurl","none"],good_morning_pdc:["gm","none"],
 hip_thrust:["thrust","plate"],hip_thrust_halt:["thrust","db"],pont_fessier:["bridge","none"],abducteurs:["abduct","none"],kickback_poulie:["glutekick","none"],
 mollets_machine:["calfMach","none"],mollets_halt:["calf","db"],mollets_pdc:["calf","none"],
 planche:["plank","none"],rameur_hiit:["rower","none"],velo_hiit:["bike","none"],burpees:["jump","none"],mountain:["mountain","none"],crunch_poulie:["crunchCab","none"],releve_jambes:["hang","none"],crunch:["crunch","none"],ab_machine:["abMach","none"],
 shrug_barre:["shrug","plate"],shrug_halt:["shrug","db"],shrug_machine:["shrugMach","none"],farmer:["farmer","db"],y_raise:["yraise","db"],scap_pull:["deadhang","none"],
 hyperext:["hyperext","none"],good_morning:["gmBar","plate"],superman:["superman","none"],bird_dog:["birddog","none"],
 wrist_curl:["wristcurl","db"],rev_wrist:["wristcurl","db"],rev_curl:["curl","plate"],wrist_poulie:["wristCab","none"],rev_wrist_poulie:["wristCab","none"],dead_hang:["deadhang","none"],
 elev_front:["frontraise","db"],elev_front_poulie:["frontCab","none"],elev_lat_machine:["lateral","none"],rear_delt_machine:["pecdeck","none"],prone_w:["proneW","none"],
 t_raise:["traise","db"],row_large:["seatrow","none"],prone_t:["proneT","none"],pullover_halt:["pullHalt","db"],rot_ext_poulie:["rotCab","none"],rot_ext_halt:["rotSide","db"],
 bucheron_poulie:["chop","none"],flexion_lat_halt:["sidebend","db"],russian_twist:["twist","none"],gainage_lat:["sideplank","none"],
};
function artSvg(exId){
  const [pn,load]=ART[exId]||["ohp","none"]; const q=POSES[pn];
  const L=(a,b,cls)=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${cls}"/>`;
  let o=`<line x1="4" y1="89" x2="96" y2="89" class="a-floor"/>`;
  for(const pr of q.props){
    const [t,...v]=pr;
    if(t==="bench") o+=`<line x1="${v[0]}" y1="${v[1]}" x2="${v[2]}" y2="${v[3]}" class="a-bench"/>`;
    if(t==="bar") o+=`<line x1="${v[0]}" y1="${v[1]}" x2="${v[2]}" y2="${v[3]}" class="a-bar"/>`;
    if(t==="cable") o+=`<line x1="${v[0]}" y1="${v[1]}" x2="${v[2]}" y2="${v[3]}" class="a-cable"/><circle cx="${v[2]}" cy="${v[3]}" r="3.5" class="a-pulley"/>`;
    if(t==="post") o+=`<line x1="${v[0]}" y1="${v[1]}" x2="${v[0]}" y2="${v[2]}" class="a-bench" style="stroke-width:2.5"/>`;
    if(t==="pad") o+=`<circle cx="${v[0]}" cy="${v[1]}" r="3.6" class="a-pad"/>`;
    if(t==="step") o+=`<rect x="${v[0]}" y="83" width="${v[1]-v[0]}" height="6" rx="1.5" class="a-step"/>`;
  }
  // membres arrière (estompés), puis corps, puis membres avant
  o+=`<g class="a-back">${L(q.p,q.k2,"a-limb")}${L(q.k2,q.f2,"a-limb")}${L(q.s,q.e2,"a-limb")}${L(q.e2,q.w2,"a-limb")}</g>`;
  o+=L(q.s,q.p,"a-torso")+L(q.h,q.s,"a-limb")+`<circle cx="${q.h[0]}" cy="${q.h[1]}" r="6" class="a-head"/>`;
  o+=L(q.p,q.k1,"a-limb")+L(q.k1,q.f1,"a-limb")+L(q.s,q.e1,"a-limb")+L(q.e1,q.w1,"a-limb");
  const at=q.load||q.w1;
  if(load==="plate") o+=`<circle cx="${at[0]}" cy="${at[1]}" r="7.5" class="a-plate"/><circle cx="${at[0]}" cy="${at[1]}" r="2" class="a-hub"/>`;
  if(load==="db"){ o+=`<rect x="${at[0]-5.5}" y="${at[1]-3}" width="11" height="6" rx="2" class="a-db"/>`;
    if(q.w2!==q.w1 && !q.load) o+=`<rect x="${q.w2[0]-5.5}" y="${q.w2[1]-3}" width="11" height="6" rx="2" class="a-db a-dbback"/>`; }
  return `<svg viewBox="0 0 100 94" aria-hidden="true">${o}</svg>`;
}

/* ============ RENDU : SÉANCE ============ */
let detailId=null, detailTemp=null, muscleFilter="all";
function bestKg(exId){
  let b=0; for(const s of state.sessions){ const x=s.exercises.find(e=>e.exId===exId); if(x) for(const z of x.sets) if(z.kg>b) b=z.kg; }
  return b;
}
function currentItem(exId){ return state.current ? state.current.exercises.find(x=>x.exId===exId) : null; }
function doneCount(x){ return x.sets.filter(s=>s.done).length; }
function tile(exId,num){
  const ex=EXMAP[exId], x=currentItem(exId), d=x?doneCount(x):0;
  const badge = x ? `<span class="t-badge ${d&&d>=x.sets.length?"full":d?"part":""}">${d?`${d}/${x.sets.length}`:(x.blk||num||"•")}</span>` : "";
  return `<button class="tile" data-ex="${exId}">${badge}<div class="t-art">${artSvg(exId)}</div><div class="t-name">${esc(ex.n)}</div></button>`;
}
const BLK_NAME={single:"Exercice",superset:"Superset (duo enchaîné)",circuit:"Circuit",finisher:"Circuit final"};
function fmtRest(r){return r>=60?`${Math.floor(r/60)} min${r%60?" "+r%60:""}`:`${r} s`}
function blkInfo(b){
  if(b.type==="single") return `${b.sets} séries · repos ${fmtRest(b.rest)} entre les séries`;
  return `${b.sets} tours · enchaîne les ${b.ids.length} exercices sans pause, puis repos ${fmtRest(b.rest)}`;
}
function renderSession(){
  const el=$("#session");
  $("#sessTitle").style.display=detailId?"none":"";
  if(detailId){ renderDetail(); return; }
  const c=state.current;
  const anyDone=c && c.exercises.some(x=>x.sets.some(s=>s.done));
  let h="";
  if(c && c.exercises.length && c.plan!==false){
    const goalL=Object.fromEntries(OPTS.goal)[c.goal];
    const tot=c.exercises.reduce((a,x)=>a+x.sets.length,0), dn=c.exercises.reduce((a,x)=>a+doneCount(x),0);
    h+=`<div class="card sess-head">
        <div class="sh-t">${esc(c.title)}${goalL?` <span>${esc(goalL)}</span>`:""}</div>
        <div class="sh-m">≈ ${c.est||"?"} min · ${c.exercises.length} exercices · échauffement ${c.warm||8} min inclus</div>
        <div class="sh-p"><div class="bar"><i class="ok" style="width:${tot?Math.round(dn/tot*100):0}%"></i></div><b>${dn} / ${tot} séries</b></div>
        <div class="sh-xp"><span>⚡ ${dn*XP.set} XP gagnés</span><span>+${XP.session} XP à la fin</span></div>
        ${c.started?`<div class="sh-m" style="margin-top:6px">⏱ Commencée il y a ${Math.max(1,Math.round((Date.now()-c.started)/60000))} min</div>`:""}
        ${(()=>{const nx=nextUnfinished(null); return nx?`<button class="btn primary next-b" data-go="${nx.exId}" style="margin-top:12px"><small>${dn?"▶ Continuer":"▶ Commencer la séance"}</small>${esc(EXMAP[nx.exId].n)}</button>`:""})()}
      </div>`;
    if(c.blocks){
      if(COACH[c.goal]) h+=`<details class="coach"${c.why&&c.why.length?" open":""}><summary>🧠 Pourquoi cette séance</summary><div class="coach-b">${(c.why||[]).map(w=>`<p class="why">${esc(w)}</p>`).join("")}<p>${esc(COACH[c.goal])}</p></div></details>`;
      h+=`<div class="warm">🔥 <b>Échauffement ${c.warm||8} min</b> : 5 min de cardio léger, puis 1-2 séries légères du premier exercice.</div>`;
      for(const b of c.blocks){
        const ids=b.ids.filter(id=>currentItem(id));
        if(!ids.length) continue;
        h+=`<div class="blk"><div class="blk-h"><span class="blk-l">${b.label}</span><div><b>${b.type==="single"&&b.r==="main"?"Exercice de base":BLK_NAME[b.type]}</b><small>${blkInfo(b)}</small></div></div>
          <div class="grid">${ids.map(id=>tile(id)).join("")}</div></div>`;
      }
      const extra=c.exercises.filter(x=>!c.blocks.some(b=>b.ids.includes(x.exId)));
      if(extra.length) h+=`<div class="blk"><div class="blk-h"><span class="blk-l">+</span><div><b>Ajoutés</b><small>Exercices ajoutés pendant la séance</small></div></div><div class="grid">${extra.map(x=>tile(x.exId)).join("")}</div></div>`;
    } else {
      h+=`<div class="grid">${c.exercises.map((x,i)=>tile(x.exId,i+1)).join("")}</div>`;
    }
  }
  const muscles=[["all","Tous"],...Object.entries(MUSCLE_LABEL)];
  const list=EX.filter(e=>muscleFilter==="all"||e.m===muscleFilter);
  if(!c || !c.exercises.length) h+=`<div class="card empty-cta"><b>Aucune séance prévue</b><p>Crée une séance adaptée à ton objectif, ou touche un exercice ci-dessous pour une séance libre.</p><button class="btn primary" id="goCreate">Créer une séance</button></div>`;
  h+=`<h2>${c&&c.exercises.length?"Ajouter un exercice":"Tous les exercices"}</h2>
    <div class="chips scroll" id="mf">${muscles.map(([v,l])=>`<button class="chip ${muscleFilter===v?"on":""}" data-m="${v}">${l}</button>`).join("")}</div>
    ${Object.keys(MUSCLE_LABEL).filter(m=>muscleFilter==="all"||m===muscleFilter).map(m=>{const L=list.filter(e=>e.m===m); if(!L.length) return "";
      return `<div class="mg"><div class="mg-h"><b>${MUSCLE_LABEL[m]}</b><span>${L.length} exercice${L.length>1?"s":""}</span></div><div class="grid">${L.map(e=>tile(e.id)).join("")}</div></div>`;}).join("")}`;
  if(c && c.exercises.length) h+=`<div class="card note-card"><label class="f" style="margin-top:0" for="sessNote">📝 Note de séance</label><textarea id="sessNote" rows="2" maxlength="500" placeholder="Sensations, douleurs, énergie…">${esc(c.note||"")}</textarea></div>`;
  if(anyDone) h+=`<div class="finish-bar"><button class="btn primary" id="finish">Terminer et enregistrer</button></div>`;
  el.innerHTML=h;
  if(anyDone) $("#finish").onclick=finish;
  const gc=$("#goCreate"); if(gc) gc.onclick=()=>{show("create");window.scrollTo(0,0)};
}
function openDetail(exId){
  detailId=exId;
  const x=currentItem(exId);
  detailTemp = x ? null : makeItem(EXMAP[exId],prescription(EXMAP[exId],state.profile));
  renderSession(); window.scrollTo(0,0);
}
function detailItem(){ return currentItem(detailId) || detailTemp; }
function commitTemp(){
  if(!detailTemp) return;
  if(!state.current) state.current={id:uid(),created:Date.now(),title:"Séance libre",goal:state.profile.goal,est:null,plan:false,exercises:[]};
  state.current.exercises.push(detailTemp); detailTemp=null;
}
function lastLine(exId){
  for(let i=state.sessions.length-1;i>=0;i--){
    const s=state.sessions[i], x=s.exercises.find(e=>e.exId===exId);
    if(!x||!x.sets.length) continue;
    const kgs=[...new Set(x.sets.map(z=>z.kg))], ex=EXMAP[exId], u=ex&&ex.time?" s":"";
    const body=kgs.length===1
      ? (kgs[0]?`${fmtKg(kgs[0])} kg × `+x.sets.map(z=>z.reps+u).join(" · "):x.sets.map(z=>z.reps).join(" · ")+(u?" s":" reps"))
      : x.sets.map(z=>`${fmtKg(z.kg)}×${z.reps}`).join(" · ");
    const eff={easy:" · 😌 facile",ok:" · 💪 correct",hard:" · 🥵 dur"}[x.effort]||"";
    return `<div class="last"><span>Dernière fois · ${fmtDate(s.date)}</span><b>${body}</b>${eff?`<small>${eff.slice(3)}</small>`:""}</div>`;
  }
  return "";
}
function activeIdx(x){ return x.sets.findIndex(z=>!z.done); }
function markStart(){ if(state.current&&!state.current.started) state.current.started=Date.now(); }
// Prochain exercice non terminé dans l'ordre de la séance (après x, puis en reprenant du début)
function nextUnfinished(x){
  const L=state.current?state.current.exercises:[]; if(!L.length) return null;
  const i0=x?L.indexOf(x):-1;
  for(let k=1;k<=L.length;k++){ const y=L[(i0+k+L.length)%L.length]; if(y!==x && y.sets.some(z=>!z.done)) return y; }
  return null;
}
// Où aller après une série validée : partenaire de superset, même exercice, ou exercice suivant
function nextTarget(x){
  if(x.next){ const p=currentItem(x.next); if(p&&p.sets.some(z=>!z.done)) return p; }
  if(x.sets.some(z=>!z.done)) return x;
  return nextUnfinished(x);
}
function targetLabel(t,x){
  if(!t) return "";
  const j=activeIdx(t);
  return (t===x?"":EXMAP[t.exId].n+" · ")+"série "+(j+1)+(t.sets[j]&&t.sets[j].kg!==""?" · "+fmtKg(+t.sets[j].kg)+" kg":"");
}
function warmupHtml(x,ex){
  if(ex.t!=="c"||ex.eq==="pdc"||ex.time) return "";
  if(!(x.role==="main"||(!x.role&&ex.eq==="barre"))) return "";
  const W=parseFloat(x.sets[0].kg); if(!W) return "";
  const st=STEP[ex.eq]||2.5, snap=v=>Math.max(st,Math.round(v/st)*st);
  const rows=[[.5,8],[.7,4]]; if(W>=60||(state.current&&state.current.goal==="force")) rows.push([.85,2]);
  const ok=rows.filter(([p])=>snap(W*p)<W && !(ex.eq==="barre"&&W*p<20));
  if(!ok.length) return "";
  return `<details class="wu" open><summary>🔥 Échauffement : ${ok.length} série${ok.length>1?"s":""} légère${ok.length>1?"s":""} avant de commencer</summary>
    ${ok.map(([p,r],i)=>`<div class="wu-r"><span>${i+1}</span><b>${fmtKg(snap(W*p))} kg × ${r}</b><small>${Math.round(p*100)} %</small></div>`).join("")}
    <p>Pourcentages de ta charge de travail. Environ 1 min de repos entre elles ; elles ne comptent pas dans tes séries.</p></details>`;
}
function renderDetail(){
  const x=detailItem(), ex=EXMAP[detailId], pr=x.pr, isBw=ex.eq==="pdc";
  const unit=ex.time?"s":"reps";
  const rest=pr.rest===0?"":fmtRest(pr.rest);
  const best=bestKg(detailId), inPlan=!!currentItem(detailId);
  const blkTag=x.blk?`<span class="d-blk">${x.blk}${x.type&&x.type!=="single"?" · "+BLK_NAME[x.type]:""}</span>`:"";
  const dn=doneCount(x), j=activeIdx(x), n=x.sets.length;
  // pré-remplissage de la série active à partir de la précédente
  if(j>=0){ const a=x.sets[j], pv=j>0?x.sets[j-1]:null;
    if(a.kg===""&&pv&&pv.kg!=="") a.kg=pv.kg;
    if(a.reps==="") a.reps=pv&&pv.reps!==""?pv.reps:String(pr.reps[1]); }
  const partner=x.next&&currentItem(x.next)&&currentItem(x.next).sets.some(z=>!z.done)?EXMAP[x.next]:null;
  const after=j<0?nextUnfinished(x):null;
  let panel;
  if(j>=0){
    const a=x.sets[j];
    const stp=(f,lbl,val)=>`<div class="stp"><small>${lbl}</small><div class="stp-r"><button class="stp-b" data-st="${f}|-1" aria-label="Moins">−</button><input data-f="${f}" data-j="${j}" inputmode="decimal" value="${esc(val)}" aria-label="${lbl}"><button class="stp-b" data-st="${f}|1" aria-label="Plus">+</button></div></div>`;
    panel=`<div class="active">
      <div class="act-h"><b>Série ${j+1} <span>/ ${n}</span></b><span>Objectif ${pr.reps[0]}-${pr.reps[1]} ${unit}</span></div>
      <div class="stps${ex.time?" one":""}">${ex.time?"":stp("kg",isBw?"Lest (kg)":"Charge (kg)",a.kg===""?"":a.kg)}${stp("reps",ex.time?"Secondes":"Répétitions",a.reps)}</div>
      <button class="btn primary big" data-act="valid">✓ Valider la série ${j+1}</button>
      <div class="act-f">${pr.rest===0&&partner?`Puis enchaîne sans pause : <b>${esc(partner.n)}</b>`:rest?`Puis ${rest} de repos (minuteur automatique)`:""}</div>
    </div>`;
  } else {
    panel=`<div class="active done-st">
      <div class="act-h"><b>✓ Exercice terminé</b><span>${n} / ${n} séries</span></div>
      <div class="eff"><small>Ressenti (ajuste ta prochaine charge)</small><div class="chips">${[["easy","😌 Facile"],["ok","💪 Correct"],["hard","🥵 Dur"]].map(([v,l])=>`<button class="chip ${x.effort===v?"on":""}" data-eff="${v}">${l}</button>`).join("")}</div></div>
      ${partner?`<button class="btn primary big next-b" data-go="${partner.id}"><small>Enchaîne avec</small>${esc(partner.n)} →</button>`
        :after?`<button class="btn primary big next-b" data-go="${after.exId}"><small>Exercice suivant</small>${esc(EXMAP[after.exId].n)} →</button>`
        :(inPlan||state.current&&state.current.exercises.includes(x))?`<button class="btn primary big" data-act="finishnow">Terminer et enregistrer la séance</button>`:""}
    </div>`;
  }
  $("#session").innerHTML=`
    <button class="back" id="back">← Retour aux exercices</button>
    <div class="ex">
      <div class="d-top"><div class="d-art">${artSvg(detailId)}</div>
        <div class="d-info">${blkTag}
          <div class="ex-name">${esc(ex.n)}</div>
          <div class="ex-meta"><b>${pr.sets} × ${pr.reps[0]}-${pr.reps[1]} ${unit}</b><br>${rest?"repos "+rest:"sans repos, enchaîne"}</div>
          <div class="d-tags"><span class="tag">${MUSCLE_LABEL[ex.m]}</span>${!isBw&&best?`<span class="tag">🏆 ${fmtKg(best)} kg</span>`:""}</div>
        </div></div>
      ${lastLine(detailId)}
      ${x.hint&&!dn?`<div class="hint">${esc(x.hint)}</div>`:""}
      ${!dn?warmupHtml(x,ex):""}
      ${panel}
      <div class="note-ex"><label for="exNote">📝 Note sur cet exercice</label><input id="exNote" maxlength="300" placeholder="Réglage machine, sensation…" value="${esc(x.note||"")}"></div>
      <details class="cue-d"><summary>💡 Conseil technique</summary><div class="cue">${esc(ex.cue)}</div></details>
      <div class="all-h">Toutes les séries <span>(touche une valeur pour corriger)</span></div>
      <table class="sets"><tbody>
      ${x.sets.map((z,k)=>`<tr class="${z.done?"isdone":""}${k===j?" cur":""}" data-j="${k}">
        <td class="sn">${k+1}</td>
        ${ex.time?`<td class="x"></td>`:`<td><input inputmode="decimal" data-f="kg" value="${esc(z.kg)}" placeholder="${isBw?"0":"kg"}" aria-label="Charge série ${k+1}"></td>
        <td class="x">×</td>`}
        <td><input inputmode="numeric" data-f="reps" value="${esc(z.reps)}" placeholder="${pr.reps[0]}-${pr.reps[1]}" aria-label="${ex.time?"Secondes":"Répétitions"} série ${k+1}"></td>
        <td><button class="done-btn ${z.done?"on":""}" data-act="done" aria-label="${z.done?"Annuler":"Valider"} la série ${k+1}">✓</button></td></tr>`).join("")}
      </tbody></table>
      <div class="set-tools"><span>${dn} / ${n} séries validées</span>
        <div>${n>1?`<button class="btn ghost small" data-act="rmset" aria-label="Retirer une série">− Série</button>`:""}<button class="btn ghost small" data-act="addset">+ Série</button></div></div>
    </div>
    <button class="btn ghost" id="back2">Retour aux exercices</button>
    ${inPlan?`<button class="linkbtn danger" data-act="del">Retirer cet exercice de la séance</button>`:""}`;
  $("#back").onclick=$("#back2").onclick=closeDetail;
}
// Après une série validée : enchaînement superset, ou minuteur de repos vers la suite
function afterValidate(x){
  const t=nextTarget(x);
  if(x.pr.rest===0 && t && t!==x){ renderSession(); toast("Enchaîne : "+EXMAP[t.exId].n+" →"); openDetail(t.exId); return; }
  renderSession();
  if(t && x.pr.rest>0) startTimer(x.pr.rest, targetLabel(t,x), t.exId, x.exId);
  else if(!t) toast("Dernière série faite ! Tu peux terminer la séance 💪");
}
function closeDetail(){ detailId=null; detailTemp=null; renderSession(); window.scrollTo(0,0); }
$("#session").addEventListener("input",e=>{
  const inp=e.target.closest("input[data-f]"); if(!inp||!detailId) return;
  const x=detailItem(), j=inp.dataset.j!=null?+inp.dataset.j:+inp.closest("tr").dataset.j;
  x.sets[j][inp.dataset.f]=inp.value.replace(",",".");
  commitTemp(); persistLocal();
});
$("#session").addEventListener("click",e=>{
  const t=e.target.closest(".tile"); if(t){ openDetail(t.dataset.ex); return; }
  const g=e.target.closest("[data-go]"); if(g){ openDetail(g.dataset.go); return; }
  const st=e.target.closest("[data-st]");
  if(st&&detailId){ const x=detailItem(), j=activeIdx(x); if(j<0) return; const [f,d]=st.dataset.st.split("|"), ex=EXMAP[detailId];
    const step=f==="kg"?(STEP[ex.eq]||2.5):(ex.time?5:1);
    const v=Math.max(0,Math.round(((parseFloat(String(x.sets[j][f]).replace(",","."))||0)+(+d)*step)*100)/100);
    x.sets[j][f]=String(v); commitTemp(); persistLocal(); renderSession(); return; }
  const ef=e.target.closest("[data-eff]"); if(ef&&detailId){ const x=detailItem(); x.effort=x.effort===ef.dataset.eff?null:ef.dataset.eff; commitTemp(); persistLocal(); renderSession(); return; }
  const m=e.target.closest("#mf .chip"); if(m){ muscleFilter=m.dataset.m; renderSession(); return; }
  const b=e.target.closest("[data-act]"); if(!b||!detailId) return;
  const x=detailItem(), act=b.dataset.act;
  if(act==="done"||act==="valid"){
    const j=act==="valid"?activeIdx(x):+b.closest("tr").dataset.j; if(j<0) return;
    const s=x.sets[j];
    if(!s.done && s.reps===""){ s.reps=String(x.pr.reps[1]); }
    s.done=!s.done;
    // la charge validée est reprise sur les séries suivantes encore à la valeur prévue (ou vides)
    if(s.done && s.kg!==""){ for(let k=j+1;k<x.sets.length;k++){ const z=x.sets[k]; if(!z.done && (z.kg===""||String(z.kg)===String(x.planKg))) z.kg=s.kg; } }
    commitTemp(); if(s.done) markStart(); persistLocal();
    if(s.done){
      xpFloat("+"+XP.set+" XP", b);
      const prev=game().best[x.exId], useKg=x.sets.some(z=>+z.kg>0), v=useKg?+s.kg||0:+s.reps||0;
      if(prev!=null && v>prev && !x.recShown){ x.recShown=true; const nm=EXMAP[x.exId].n; setTimeout(()=>toast("🏆 Nouveau record : "+nm+" ! +"+XP.record+" XP"),400); }
    }
    if(s.done) afterValidate(x); else renderSession();
    return;
  }
  if(act==="finishnow"){ closeDetail(); finish(); return; }
  if(act==="del"){ const id=detailId; confirmSheet(`Retirer « ${EXMAP[id].n} » de la séance ?`,"Retirer",()=>{ state.current.exercises=state.current.exercises.filter(y=>y.exId!==id); persistLocal(); closeDetail(); }); return; }
  if(act==="addset"){ const last=x.sets[x.sets.length-1]; x.sets.push({kg:last?last.kg:"",reps:"",done:false}); x.pr.sets=x.sets.length; }
  if(act==="rmset" && x.sets.length>1){ x.sets.pop(); x.pr.sets=x.sets.length; }
  if(!detailTemp) persistLocal();
  renderSession();
});
function showSummary(before,after,s){
  const gain=after.xp-before.xp, up=after.level>before.level;
  const newB=after.badges.filter(b=>b.done&&!before.badges.find(x=>x.id===b.id).done);
  const recs=after.records-before.records, nSets=s.exercises.reduce((a,x)=>a+x.sets.length,0);
  const ton=s.exercises.reduce((a,x)=>a+x.sets.reduce((b,z)=>b+setVol(z),0),0);
  const pct=(after.xp-after.cur)/(after.nxt-after.cur)*100;
  $("#sheet").innerHTML=`<div class="sum">
    <div class="sum-k">Séance terminée</div>
    ${up?`<div class="lvl-up"><span class="hex big">${after.level}</span><div><b>Niveau ${after.level} atteint !</b><small>Rang : ${after.rank}</small></div></div>`:""}
    <div class="sum-xp">+<span id="xpCount">${gain}</span> XP</div>
    ${segBar(pct,"big")}
    <div class="sum-sub">Niveau ${after.level} · encore ${after.nxt-after.xp} XP pour le niveau ${after.level+1}</div>
    ${(()=>{const parts=[["séance",XP.session],["séries",nSets*XP.set]]; if(after.todayDone&&!before.todayDone) parts.push(["jour d'entraînement",XP.day]);
      if(recs) parts.push(["record"+(recs>1?"s":""),recs*XP.record]); if(newB.length) parts.push(["succès",newB.length*XP.badge]);
      const rest=gain-parts.reduce((a,p)=>a+p[1],0); if(rest>0) parts.push(["défi réussi",rest]);
      return `<div class="sum-br">${parts.map(([l,v])=>`<span>+${v} ${l}</span>`).join("")}</div>`;})()}
    <div class="sum-grid">
      <div><b>${s.duration?s.duration+" min":"—"}</b><small>durée</small></div>
      <div><b>${nSets}</b><small>séries</small></div>
      <div><b>${ton>=1000?fmtKg(Math.round(ton/100)/10)+" t":Math.round(ton)+" kg"}</b><small>soulevés</small></div>
      <div><b>${recs}</b><small>record${recs>1?"s":""}</small></div>
    </div>
    ${newB.length?`<div class="sum-b"><small>Succès débloqué${newB.length>1?"s":""}</small>${newB.map(b=>`<div class="sum-bi"><span>${b.i}</span><b>${b.n}</b></div>`).join("")}</div>`:""}
    <button class="btn primary" id="mOk">Continuer</button></div>`;
  openModal(); $("#mOk").onclick=closeModal;
  // compteur d'XP animé (désactivé si l'utilisateur préfère moins d'animations)
  const reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches, el=$("#xpCount");
  if(!reduce&&el&&gain>0){ const t0=performance.now(); const step=t=>{const k=Math.min(1,(t-t0)/900); el.textContent=Math.round(gain*(1-Math.pow(1-k,3))); if(k<1) requestAnimationFrame(step);}; el.textContent="0"; requestAnimationFrame(step); }
}
async function finish(){
  const c=state.current;
  const exercises=c.exercises.map(x=>({exId:x.exId,name:x.name,...(x.effort?{effort:x.effort}:{}),...(x.note?{note:String(x.note).slice(0,300)}:{}),sets:x.sets.filter(s=>s.done).map(s=>({kg:+s.kg||0,reps:+s.reps||0,done:true}))})).filter(x=>x.sets.length);
  if(!exercises.length){toast("Valide au moins une série (✓) avant d'enregistrer");return}
  const dur=c.started?Math.max(1,Math.round((Date.now()-c.started)/60000)):null;
  const s={id:c.id,date:Date.now(),title:c.title,goal:c.goal,exercises,...(c.note?{note:String(c.note).slice(0,500)}:{}),...(dur?{duration:dur}:{})};
  const before=game();
  state.current=null; detailId=null; detailTemp=null; stopTimer();
  await saveSession(s);
  const after=game();
  renderSession(); renderProgress(); renderHud(); renderQuests(); show("progress"); window.scrollTo(0,0);
  showSummary(before,after,s);
}


/* ============ MINUTEUR DE REPOS ============ */
let tH=null,tEnd=0,tDur=0,tTarget=null,tFrom=null,actx=null,beeps=[];
// Son de fin de repos : programmé au moment du clic (les navigateurs exigent un geste de l'utilisateur)
function audioCtx(){ try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==="suspended") actx.resume(); }catch(e){ actx=null; } return actx; }
function cancelBeeps(){ beeps.forEach(o=>{try{o.stop()}catch(e){}}); beeps=[]; }
function scheduleBeeps(){
  cancelBeeps(); const a=audioCtx(); if(!a) return;
  try{
    const t0=a.currentTime+Math.max(0,(tEnd-Date.now())/1000);
    [0,.28,.56].forEach((d,i)=>{ const o=a.createOscillator(), g=a.createGain();
      o.type="sine"; o.frequency.value=i===2?1320:880;
      g.gain.setValueAtTime(0.0001,t0+d); g.gain.exponentialRampToValueAtTime(0.3,t0+d+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+d+0.2);
      o.connect(g); g.connect(a.destination); o.start(t0+d); o.stop(t0+d+0.22); beeps.push(o); });
  }catch(e){}
}
function startTimer(sec,label,target,from){
  tDur=sec; tEnd=Date.now()+sec*1000; tTarget=target||null; tFrom=from||null;
  $("#tnext").innerHTML=label?"Ensuite : <b>"+esc(label)+"</b>":"";
  $("#timer").style.display="block"; document.body.classList.add("timing");
  scheduleBeeps(); tick(); clearInterval(tH); tH=setInterval(tick,250);
}
function tick(){
  const ms=Math.max(0,tEnd-Date.now()), left=Math.ceil(ms/1000);
  $("#tval").textContent=Math.floor(left/60)+":"+String(left%60).padStart(2,"0");
  $("#tbar").style.width=(tDur?Math.min(100,ms/(tDur*1000)*100):0)+"%";
  if(ms<=0){
    const tg=tTarget, fr=tFrom; beeps=[]; stopTimer();
    toast("⏰ Repos terminé, c'est reparti !");
    try{navigator.vibrate&&navigator.vibrate([250,120,250])}catch(e){}
    if(tg && fr && detailId===fr && tg!==fr && $("#v-session").classList.contains("on")) openDetail(tg);
  }
}
function stopTimer(){ clearInterval(tH); cancelBeeps(); $("#timer").style.display="none"; document.body.classList.remove("timing"); }
$("#tskip").onclick=()=>stopTimer();
$("#tplus").onclick=()=>{ tEnd+=30000; tDur+=30; scheduleBeeps(); tick(); };
$("#tminus").onclick=()=>{ tEnd=Math.max(Date.now()+1000,tEnd-15000); scheduleBeeps(); tick(); };

/* ============ RENDU : PROGRÈS ============ */
function renderProgress(){
  renderPlanning();
  const S=state.sessions;
  const week=S.filter(s=>s.date>Date.now()-7*864e5).length;
  const vol=S.reduce((a,s)=>a+s.exercises.reduce((b,x)=>b+x.sets.reduce((c,z)=>c+z.kg*z.reps,0),0),0);
  $("#stats").innerHTML=`
    <div class="stat"><b>${S.length}</b><small>séances</small></div>
    <div class="stat"><b>${week}</b><small>sur 7 jours</small></div>
    <div class="stat"><b>${vol>=1000?fmtKg(vol/1000)+" t":Math.round(vol)+" kg"}</b><small>soulevés au total</small></div>`;
  // exercices présents dans l'historique, du plus fréquent au moins fréquent
  const cnt={}; S.forEach(s=>s.exercises.forEach(x=>{cnt[x.exId]=(cnt[x.exId]||0)+1}));
  const ids=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]);
  const sel=$("#exSel"), prev=sel.value;
  const W=state.profile.weights||[];
  if(W.length) ids.unshift("__poids");
  if(!ids.length){
    sel.innerHTML=`<option>—</option>`; sel.disabled=true;
    $("#chart").innerHTML=`<div class="empty">Enregistre ta première séance pour voir ta progression ici.</div>`;
    $("#exDetail").textContent="";
  } else {
    sel.disabled=false;
    sel.innerHTML=ids.map(id=>id==="__poids"?`<option value="__poids">⚖️ Poids de corps</option>`:`<option value="${id}">${esc((EXMAP[id]||{n:id}).n)} (${cnt[id]})</option>`).join("");
    if(ids.includes(prev)) sel.value=prev;
    drawChart(sel.value);
  }
  $("#hist").innerHTML=S.length?S.slice().reverse().map(s=>{
    const v=s.exercises.reduce((b,x)=>b+x.sets.reduce((c,z)=>c+z.kg*z.reps,0),0);
    const n=s.exercises.reduce((b,x)=>b+x.sets.length,0);
    const open=openHist===s.id;
    return `<div class="hist-wrap"><div class="hist-item"><button class="hist-open" data-open="${s.id}" aria-expanded="${open}"><div class="t">${esc(s.title)} <span class="chev">${open?"▲":"▼"}</span></div><div class="d">${fmtDate(s.date)}${s.duration?` · ${s.duration} min`:""}${s.manual?" · validée sans détail":` · ${s.exercises.length} exo${s.exercises.length>1?"s":""} · ${n} séries${v?` · ${Math.round(v)} kg`:""}`}</div></button>
      <button class="iconbtn" data-fav="${s.id}" aria-pressed="${!!s.fav}" aria-label="${s.fav?"Retirer des favoris":"Ajouter aux favoris"}">${s.fav?"⭐":"☆"}</button><button class="iconbtn" data-redo="${s.id}" aria-label="Refaire cette séance">🔁</button><button class="iconbtn" data-del="${s.id}" aria-label="Supprimer la séance">🗑</button></div>
      ${open?`<div class="hist-detail">${s.note?`<div class="hd-note">📝 ${esc(s.note)}</div>`:""}${s.exercises.map(x=>{const ex=EXMAP[x.exId]; const kgs=[...new Set(x.sets.map(z=>z.kg))];
        const body=kgs.length===1?(kgs[0]?fmtKg(kgs[0])+" kg × ":"")+x.sets.map(z=>z.reps).join(" · "):x.sets.map(z=>fmtKg(z.kg)+"×"+z.reps).join(" · ");
        return `<div class="hd-row"><div class="ra">${ex?artSvg(x.exId):""}</div><div><b>${esc(ex?ex.n:x.name)}</b><small>${body}${x.effort?" · "+{easy:"facile",ok:"correct",hard:"dur"}[x.effort]:""}${x.note?" · 📝 "+esc(x.note):""}</small></div></div>`}).join("")}</div>`:""}</div>`;
  }).join(""):`<div class="empty">Aucune séance pour l'instant.</div>`;
}
$("#exSel").onchange=e=>drawChart(e.target.value);
let openHist=null;
$("#hist").addEventListener("click",e=>{
  const o=e.target.closest("[data-open]"); if(o){ openHist=openHist===o.dataset.open?null:o.dataset.open; renderProgress(); return; }
  const f=e.target.closest("[data-fav]"); if(f){ toggleFav(f.dataset.fav); return; }
  const r=e.target.closest("[data-redo]"); if(r){ redoSession(r.dataset.redo); return; }
  const b=e.target.closest("[data-del]"); if(!b) return;
  undoableDelete(b.dataset.del);
});
function drawChart(exId){
  const isBody=exId==="__poids";
  const ex=EXMAP[exId]||{eq:"barre"};
  const bw=ex.eq==="pdc";
  const pts=isBody?(state.profile.weights||[]).map(w=>({d:w.d,v:w.kg,top:null,body:true})):state.sessions.map(s=>{
    const x=s.exercises.find(e=>e.exId===exId); if(!x) return null;
    if(bw||x.sets.every(z=>!z.kg)){ return {d:s.date,v:Math.max(...x.sets.map(z=>z.reps)),top:null}; }
    const best=x.sets.reduce((a,z)=>e1rm(z.kg,z.reps)>e1rm(a.kg,a.reps)?z:a);
    return {d:s.date,v:e1rm(best.kg,best.reps),top:best};
  }).filter(Boolean);
  const isReps=!isBody && pts.length && pts[0].top===null;
  const unit=isReps?(ex.time?" s":" reps"):" kg";
  const W=360,H=210,L=38,R=12,T=22,B=28;
  const vals=pts.map(p=>p.v); let lo=Math.min(...vals),hi=Math.max(...vals);
  const pad=Math.max(1,(hi-lo)*0.15); lo=Math.max(0,lo-pad); hi=hi+pad;
  const xs=i=>pts.length===1?(L+W-R)/2:L+i*(W-L-R)/(pts.length-1);
  const ys=v=>T+(H-T-B)*(1-(v-lo)/(hi-lo));
  const ticks=4, grid=[];
  for(let k=0;k<=ticks;k++){const v=lo+(hi-lo)*k/ticks; grid.push(`<line x1="${L}" x2="${W-R}" y1="${ys(v)}" y2="${ys(v)}" style="stroke:var(--line)" stroke-width="1"/><text x="${L-8}" y="${ys(v)+4}" style="fill:var(--muted)" font-size="11" text-anchor="end">${(hi-lo)<8?fmtKg(Math.round(v*10)/10):Math.round(v)}</text>`)}
  const path=pts.map((p,i)=>`${i?"L":"M"}${xs(i)},${ys(p.v)}`).join(" ");
  const step=Math.max(1,Math.ceil(pts.length/4));
  const xl=pts.map((p,i)=>(i%step===0||i===pts.length-1)?`<text x="${xs(i)}" y="${H-10}" style="fill:var(--muted)" font-size="11" text-anchor="${pts.length>1&&i===0?"start":pts.length>1&&i===pts.length-1?"end":"middle"}">${new Date(p.d).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</text>`:"").join("");
  const lastI=pts.length-1;
  $("#chart").innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Progression">
    ${grid.join("")}${xl}
    <defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accentText);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--accentText);stop-opacity:0"/></linearGradient></defs>
    ${pts.length>1?`<path d="${path} L${xs(lastI)},${H-B} L${xs(0)},${H-B} Z" fill="url(#areaG)"/>`:""}
    <path d="${path}" fill="none" style="stroke:var(--accentText)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p,i)=>`<circle cx="${xs(i)}" cy="${ys(p.v)}" r="${i===lastI?5.5:4}" style="fill:${i===lastI?"var(--accentText)":"var(--panel)"};stroke:var(--accentText)" stroke-width="2"/>`).join("")}
    <text x="${xs(lastI)}" y="${ys(pts[lastI].v)-12}" style="fill:var(--ink);font-family:var(--fd)" font-size="16" font-weight="800" text-anchor="${pts.length>1?"end":"middle"}">${fmtKg(pts[lastI].v)}${unit}</text>
    <line id="xh" x1="0" x2="0" y1="${T}" y2="${H-B}" style="stroke:var(--line2);display:none" stroke-width="1" stroke-dasharray="3 3"/>
    <rect x="${L}" y="0" width="${W-L-R}" height="${H}" fill="transparent" id="hit"/>
  </svg><div class="tip" id="tip"></div>`;
  const svg=$("#chart svg"), tip=$("#tip"), xh=$("#xh");
  const showAt=ev=>{
    const r=svg.getBoundingClientRect(); const cx=(ev.clientX-r.left)/r.width*W;
    let bi=0,bd=1e9; pts.forEach((p,i)=>{const d=Math.abs(xs(i)-cx); if(d<bd){bd=d;bi=i}});
    const p=pts[bi];
    xh.setAttribute("x1",xs(bi)); xh.setAttribute("x2",xs(bi)); xh.style.display="";
    tip.innerHTML=`<b>${fmtKg(p.v)}${unit}</b> ${isBody?"":isReps?"max":"1RM estimé"}<br>${fmtDate(p.d)}${p.top?` · meilleure série ${fmtKg(p.top.kg)} kg × ${p.top.reps}`:""}`;
    tip.style.left=(xs(bi)/W*r.width)+"px"; tip.style.top=(ys(p.v)/H*r.height)+"px"; tip.style.display="block";
  };
  $("#hit").addEventListener("pointermove",showAt);
  $("#hit").addEventListener("pointerdown",showAt);
  $("#hit").addEventListener("pointerleave",()=>{tip.style.display="none";xh.style.display="none"});
  const first=pts[0], last=pts[lastI];
  const diff=last.v-first.v;
  if(isBody){ $("#exDetail").innerHTML=`Courbe : ton poids de corps (mis à jour quand tu le modifies dans ton profil).${pts.length>1?` Évolution : <b style="color:var(--ink)">${diff>=0?"+":""}${fmtKg(diff)} kg</b>`:""}`; return; }
  $("#exDetail").innerHTML=isReps
    ? `Courbe : répétitions max par séance.${pts.length>1?` Évolution : <b style="color:var(--ink)">${diff>=0?"+":""}${Math.round(diff)}${unit}</b>`:""}`
    : `Courbe : 1RM estimé (charge max théorique sur 1 rep, calculée depuis ta meilleure série).${pts.length>1?` Évolution : <b style="color:var(--ink)">${diff>=0?"+":""}${fmtKg(diff)} kg</b> (${diff>=0?"+":""}${Math.round(diff/first.v*100)} %)`:""}`;
}

/* ============ NUTRITION ============ */
// Valeurs moyennes approximatives par portion : [nom, kcal, protéines, glucides, lipides]
const FOODS = [
  ["Blanc de poulet cuit · 150 g",248,46,0,5],["2 œufs",140,12,1,10],["Steak haché 5 % · 125 g",165,26,0,6],
  ["Thon en boîte · 100 g",115,26,0,1],["Saumon · 125 g",260,25,0,17],["Skyr · 150 g",95,16,6,0],
  ["Fromage blanc 0 % · 200 g",100,15,8,0],["Whey · 30 g",120,24,2,2],["Lait demi-écrémé · 250 ml",115,8,12,4],
  ["Riz cuit · 200 g",260,5,56,1],["Pâtes cuites · 200 g",300,11,60,2],["Flocons d'avoine · 60 g",225,8,36,4],
  ["Pain complet · 2 tranches",150,6,26,2],["Patate douce · 200 g",180,3,41,0],["Lentilles cuites · 200 g",230,18,40,1],
  ["Banane",105,1,27,0],["Pomme",80,0,21,0],["Amandes · 30 g",175,6,6,15],["Avocat · ½",120,2,6,11],
  ["Beurre de cacahuète · 20 g",120,5,3,10],["Légumes · 200 g",60,3,10,0],["Huile d'olive · 1 c. à soupe",90,0,0,10],
];
const ACT = [["1.2","Sédentaire","peu de marche, travail assis"],["1.375","Léger","1-3 séances / semaine"],["1.55","Modéré","3-5 séances / semaine"],["1.725","Très actif","6-7 séances ou travail physique"]];
const NGOAL = {seche:{k:-0.17,p:2.0,lbl:"Perte de gras : léger déficit (~ -17 %)"},hypertrophie:{k:0.08,p:1.8,lbl:"Prise de muscle : léger surplus (~ +8 %)"},force:{k:0.05,p:1.8,lbl:"Force : léger surplus (~ +5 %)"},endurance:{k:0,p:1.6,lbl:"Endurance : maintien"}};
const todayKey=()=>{const d=new Date();return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate()};
function needs(){
  const p=state.profile, w=+p.poids, h=+p.taille, a=+p.age;
  if(!w||!h||!a||!p.sexe) return null;
  const bmr=Math.round(10*w+6.25*h-5*a+(p.sexe==="f"?-161:5)); // Mifflin-St Jeor
  const act=+(p.activite||"1.55"), tdee=Math.round(bmr*act);
  const g=NGOAL[p.goal]||NGOAL.hypertrophie;
  const bmi=w/((h/100)**2);
  let k=g.k, note="";
  if(p.goal==="seche"&&bmi<18.5){k=0;note="Ton IMC est déjà bas : je te conseille le maintien plutôt qu'un déficit. Parles-en à un professionnel de santé si tu veux perdre du poids.";}
  let kcal=Math.round(tdee*(1+k)/10)*10;
  if(kcal<bmr){kcal=Math.round(bmr/10)*10;}
  const prot=Math.round(w*g.p), fat=Math.round(Math.max(w*0.9,kcal*0.22/9));
  const carb=Math.max(0,Math.round((kcal-prot*4-fat*9)/4));
  const water=Math.round((w*0.035+0.5)*10)/10;
  return {bmr,tdee,kcal,prot,fat,carb,water,lbl:g.lbl,ppk:g.p,note,w,h,a,act,k,sexe:p.sexe,raw:Math.round(tdee*(1+k))};
}
function foodLog(){
  const p=state.profile;
  if(!p.food||p.food.d!==todayKey()) p.food={d:todayKey(),items:[]};
  return p.food;
}
let calcOpen=false, allFoods=false;
const QUICK=[0,1,9,5,7,15]; // poulet, œufs, riz, skyr, whey, banane
function calcDetail(n){
  const actL=ACT.find(x=>+x[0]===n.act), pct=Math.round(n.k*100);
  const step=(t,f,r)=>`<div class="cstep"><div class="cs-t">${t}</div><div class="cs-f">${f}</div><div class="cs-r">${r}</div></div>`;
  return `<div class="calc">
    ${step("1. Métabolisme de base",`Ce que ton corps brûle au repos (formule de Mifflin-St Jeor) :<br>10 × ${fmtKg(n.w)} kg + 6,25 × ${n.h} cm − 5 × ${n.a} ans ${n.sexe==="f"?"− 161":"+ 5"}`,`= ${n.bmr} kcal`)}
    ${step("2. Dépense de la journée",`Métabolisme × niveau d'activité « ${actL?actL[1]:""} » :<br>${n.bmr} × ${String(n.act).replace(".",",")}`,`= ${n.tdee} kcal`)}
    ${step("3. Ajustement à ton objectif",pct===0?`Maintien : on garde la dépense telle quelle.`:`${pct>0?"Surplus":"Déficit"} de ${Math.abs(pct)} % :<br>${n.tdee} × ${String(1+n.k).replace(".",",")}`,`= ${n.raw} kcal`)}
    ${n.kcal!==n.raw?step("4. Arrondi","Arrondi à la dizaine"+(n.kcal>n.raw+10?", sans descendre sous ton métabolisme de base":""),`= ${n.kcal} kcal`):""}
    <div class="cs-sep">Répartition</div>
    ${step("Protéines",`${fmtKg(n.ppk)} g × ${fmtKg(n.w)} kg = ${n.prot} g`,`${n.prot*4} kcal`)}
    ${step("Lipides",`~0,9 g × ${fmtKg(n.w)} kg (au moins 22 % des calories) = ${n.fat} g`,`${n.fat*9} kcal`)}
    ${step("Glucides",`Le reste : (${n.kcal} − ${n.prot*4} − ${n.fat*9}) ÷ 4 = ${n.carb} g`,`${n.carb*4} kcal`)}
    <div class="sub" style="margin:8px 0 0">1 g de protéines ou de glucides = 4 kcal · 1 g de lipides = 9 kcal.</div>
  </div>`;
}
function renderNutrition(){
  const p=state.profile, n=needs(), el=$("#nutri");
  if(!n){
    el.innerHTML=`<div class="card nudge" id="nNudge">👤 Renseigne ton <b>poids, taille, âge et sexe</b> dans le Profil pour calculer tes besoins. →</div>`;
    $("#nNudge").onclick=()=>{show("profile");window.scrollTo(0,0)};
    return;
  }
  const log=foodLog(), tot=log.items.reduce((a,f)=>({k:a.k+f[1],p:a.p+f[2],c:a.c+f[3],f:a.f+f[4]}),{k:0,p:0,c:0,f:0});
  const bar=(lbl,v,t,u)=>{const pct=Math.min(100,Math.round(v/t*100));return `<div class="mrow"><div class="mtop"><span>${lbl}</span><b>${Math.round(v)} / ${t} ${u}</b></div><div class="bar"><i class="${v>t*1.1?"mid":"ok"}" style="width:${pct}%"></i></div></div>`};
  const left=n.kcal-Math.round(tot.k);
  el.innerHTML=`
    <div class="card">
      <label class="f" style="margin-top:0">Mon activité</label>
      <div class="chips" id="actChips">${ACT.map(([v,l,d])=>`<button class="chip ${(p.activite||"1.55")===v?"on":""}" data-act-lvl="${v}" title="${d}">${l}</button>`).join("")}</div>
      <div class="sub" style="margin:8px 0 0">${ACT.find(a=>a[0]===(p.activite||"1.55"))[2]}</div>
    </div>
    <div class="card">
      <label class="f" style="margin-top:0">Mes besoins par jour</label>
      <div class="kcal-big"><b>${n.kcal}</b><span>kcal / jour</span><button class="calc-btn" id="calcBtn" aria-expanded="${calcOpen}">${calcOpen?"−":"+"}</button></div>
      ${calcOpen?calcDetail(n):""}
      <div class="sub" style="margin:4px 0 10px">${n.lbl}${n.note?`<br><span style="color:var(--warn)">${esc(n.note)}</span>`:""}</div>
      <div class="macro3">
        <div><b>${n.prot} g</b><small>Protéines<br>${fmtKg(n.ppk)} g/kg</small></div>
        <div><b>${n.carb} g</b><small>Glucides<br>énergie</small></div>
        <div><b>${n.fat} g</b><small>Lipides<br>hormones</small></div>
      </div>
      <div class="sub" style="margin:10px 0 0">Métabolisme de base ${n.bmr} kcal · dépense estimée ${n.tdee} kcal · eau ~${fmtKg(n.water)} L/jour.<br>C'est une estimation : si ton poids ne bouge pas comme prévu en 2-3 semaines, ajuste de ±150 kcal.</div>
    </div>
    <h2>Aujourd'hui</h2>
    <div class="card">
      <div class="kcal-left ${left<0?"over":""}"><b>${Math.abs(left)}</b> kcal ${left>=0?"restantes":"au-dessus de l'objectif"}</div>
      ${bar("Calories",tot.k,n.kcal,"kcal")}${bar("Protéines",tot.p,n.prot,"g")}${bar("Glucides",tot.c,n.carb,"g")}${bar("Lipides",tot.f,n.fat,"g")}
      ${log.items.length?`<div class="flist">${log.items.map((f,i)=>`<div class="fitem"><div><b>${esc(f[0])}</b><small>${f[1]} kcal · P ${f[2]} g · G ${f[3]} g · L ${f[4]} g</small></div><button class="iconbtn" data-fdel="${i}" aria-label="Retirer">✕</button></div>`).join("")}</div>`:`<div class="sub" style="margin:12px 0 0">Ajoute ce que tu manges avec les boutons ci-dessous.</div>`}
    </div>
    <label class="f">Ajout rapide</label>
    <div class="fgrid">${FOODS.map((f,i)=>[f,i]).filter(([f,i])=>allFoods||QUICK.includes(i)).map(([f,i])=>`<button class="fadd" data-fadd="${i}"><b>+ ${esc(f[0].split(" · ")[0])}</b><small>${f[0].includes(" · ")?esc(f[0].split(" · ")[1])+" · ":""}${f[1]} kcal · ${f[2]} g P</small></button>`).join("")}</div>
    <button class="linkbtn" id="fMore">${allFoods?"Voir moins d'aliments ▲":"Voir tous les aliments ▼"}</button>
    <button class="btn ghost" id="fCustom" style="margin-top:6px">+ Aliment personnalisé</button>
    <h2>Conseils</h2>
    <div class="card tips">
      <p>🥩 <b>Protéines</b> : réparties sur 3 à 5 repas, environ 20 à 40 g par repas.</p>
      <p>⚖️ <b>Le rythme</b> : en perte de gras, vise environ 0,5 à 1 % de ton poids par semaine ; plus lent si tu es déjà sec, pour garder ton muscle.</p>
      <p>🍚 <b>Autour de l'entraînement</b> : un repas avec glucides + protéines 1 à 3 h avant, et un repas protéiné dans les heures qui suivent.</p>
      <p>💧 <b>Eau</b> : bois régulièrement, un peu plus les jours d'entraînement.</p>
      <p class="sub" style="margin:6px 0 0">Ces repères sont généraux et ne remplacent pas l'avis d'un médecin ou d'un diététicien.</p>
    </div>`;
}
$("#nutri").addEventListener("click",e=>{
  if(e.target.closest("#fMore")){allFoods=!allFoods; renderNutrition(); return;}
  if(e.target.closest("#calcBtn")){calcOpen=!calcOpen; renderNutrition(); return;}
  const a=e.target.closest("[data-act-lvl]"); if(a){state.profile.activite=a.dataset.actLvl; saveProfile(); renderNutrition(); return;}
  const f=e.target.closest("[data-fadd]"); if(f){ const log=foodLog(); log.items.push(FOODS[+f.dataset.fadd].slice()); saveProfile(); renderNutrition(); toast("Ajouté : "+FOODS[+f.dataset.fadd][0].split(" · ")[0]); return;}
  const d=e.target.closest("[data-fdel]"); if(d){ const log=foodLog(); log.items.splice(+d.dataset.fdel,1); saveProfile(); renderNutrition(); return;}
  if(e.target.closest("#fCustom")){
    $("#sheet").innerHTML=`<h2 style="margin-top:0">Aliment personnalisé</h2>
      <label class="fld"><small>Nom</small><input id="cfN" placeholder="Ex : Sandwich jambon" style="text-align:left"></label>
      <div class="grid3" style="grid-template-columns:repeat(4,1fr);margin-top:10px">
        <label class="fld"><small>kcal</small><input id="cfK" inputmode="numeric"></label>
        <label class="fld"><small>Prot. g</small><input id="cfP" inputmode="decimal"></label>
        <label class="fld"><small>Gluc. g</small><input id="cfC" inputmode="decimal"></label>
        <label class="fld"><small>Lip. g</small><input id="cfF" inputmode="decimal"></label>
      </div>
      <div class="row" style="margin-top:14px"><button class="btn ghost" id="mCancel">Annuler</button><button class="btn primary" id="mOk">Ajouter</button></div>`;
    openModal(); $("#mCancel").onclick=closeModal;
    $("#mOk").onclick=()=>{
      const num=id=>Math.max(0,+($(id).value||"0").replace(",",".")||0);
      const name=($("#cfN").value||"Aliment").trim().slice(0,40);
      let k=num("#cfK"); const P=num("#cfP"),C=num("#cfC"),F=num("#cfF");
      if(!k) k=Math.round(P*4+C*4+F*9);
      foodLog().items.push([name,Math.round(k),Math.round(P),Math.round(C),Math.round(F)]);
      saveProfile(); closeModal(); renderNutrition();
    };
  }
});

/* ============ JEU : XP, NIVEAUX, DÉFIS, SUCCÈS, STATS ============ */
// Tout est recalculé depuis l'historique réel : rien n'est stocké en double, donc rien ne peut se désynchroniser.
const XP = {set:10, session:100, record:50, day:50, badge:100, dq:30, dqAll:40};
// Quêtes du jour : 3 exercices au poids du corps, à faire n'importe où, remis à zéro à minuit
const DAILY = [
  {id:"push",  n:"pompes",  goal:20, art:"pompes",    knee:true},
  {id:"abs",   n:"abdos",   goal:20, art:"crunch"},
  {id:"squat", n:"squats",  goal:30, art:"squat_pdc"},
];
function dailyToday(){ const p=state.profile; p.daily=p.daily||{}; const k=dayKey(Date.now()); return p.daily[k]||(p.daily[k]={}); }
const RANKS = [[1,"Recrue"],[5,"Combattant"],[10,"Vétéran"],[15,"Élite"],[20,"Champion"],[30,"Légende"]];
const LOWER_M = ["quadriceps","ischios","fessiers","mollets"];
function weekStart(ts){ const d=new Date(ts); d.setHours(0,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d.getTime(); }
function dayKey(ts){ const d=new Date(ts); return d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate(); }
function xpForLevel(L){ return 125*L*(L-1); } // niv.2 = 250 XP, niv.3 = 750, niv.5 = 2500, niv.10 = 11 250
function levelFromXp(xp){ let L=1; while(xpForLevel(L+1)<=xp) L++; return L; }
function rankOf(L){ let r=RANKS[0][1]; for(const [l,n] of RANKS) if(L>=l) r=n; return r; }
const setVol=z=>(+z.kg||0)*(+z.reps||0);

// Défis de la semaine : 1 défi de régularité + 2 défis tournants, choisis selon le numéro de semaine
const CHALLENGES = [
  {id:"s3",  t:"Fais 3 séances",                    goal:3,    xp:300, m:w=>w.sessions},
  {id:"s4",  t:"Fais 4 séances",                    goal:4,    xp:400, m:w=>w.sessions},
  {id:"sets",t:"Valide 40 séries",                  goal:40,   xp:250, m:w=>w.sets},
  {id:"rec1",t:"Bats 1 record",                     goal:1,    xp:200, m:w=>w.records},
  {id:"rec3",t:"Bats 3 records",                    goal:3,    xp:350, m:w=>w.records},
  {id:"legs",t:"Fais 10 séries de jambes",          goal:10,   xp:200, m:w=>w.legSets},
  {id:"ton", t:"Soulève 5 tonnes au total",         goal:5000, xp:250, m:w=>w.tonnage, unit:"kg"},
  {id:"eff", t:"Note ton ressenti sur 8 exercices", goal:8,    xp:150, m:w=>w.rated},
  {id:"long",t:"Fais une séance de 45 min ou plus", goal:1,    xp:150, m:w=>w.long},
  {id:"core",t:"Fais 6 séries d'abdos",             goal:6,    xp:150, m:w=>w.coreSets},
];
function weekChallenges(ws){
  const n=Math.round(ws/(7*864e5)), pool=CHALLENGES.slice(2);
  const a=pool[n%pool.length]; let b=pool[(n*3+4)%pool.length]; if(b===a) b=pool[(n+1)%pool.length];
  return [CHALLENGES[n%2], a, b];
}
const BADGES = [
  {id:"first", i:"🎯", n:"Premier pas",        d:"Termine ta première séance",            m:c=>c.sessions, g:1},
  {id:"s10",   i:"🔁", n:"Habitué",            d:"Termine 10 séances",                    m:c=>c.sessions, g:10},
  {id:"s25",   i:"⚙️", n:"Acharné",            d:"Termine 25 séances",                    m:c=>c.sessions, g:25},
  {id:"s50",   i:"🤖", n:"Machine",            d:"Termine 50 séances",                    m:c=>c.sessions, g:50},
  {id:"s100",  i:"👑", n:"Légende de la salle",d:"Termine 100 séances",                   m:c=>c.sessions, g:100},
  {id:"rec1",  i:"🏆", n:"Record battu",       d:"Bats ton premier record",               m:c=>c.records,  g:1},
  {id:"rec10", i:"💥", n:"Briseur de records", d:"Bats 10 records",                       m:c=>c.records,  g:10},
  {id:"rec50", i:"🚀", n:"Inarrêtable",        d:"Bats 50 records",                       m:c=>c.records,  g:50},
  {id:"kg100", i:"🏋️", n:"Club des 100",       d:"Valide une série à 100 kg ou plus",     m:c=>c.maxKg,    g:100},
  {id:"t10",   i:"🧱", n:"10 tonnes",          d:"Soulève 10 tonnes au total",            m:c=>c.tonnage,  g:10000},
  {id:"t100",  i:"🏔️", n:"100 tonnes",         d:"Soulève 100 tonnes au total",           m:c=>c.tonnage,  g:100000},
  {id:"wk3",   i:"📅", n:"Régulier",           d:"Fais 3 séances dans la même semaine",   m:c=>c.bestWeek, g:3},
  {id:"str4",  i:"🔥", n:"Sur la lancée",      d:"4 semaines d'affilée avec 2 séances ou plus", m:c=>c.streak, g:4},
  {id:"str8",  i:"🛡️", n:"Discipline de fer",  d:"8 semaines d'affilée avec 2 séances ou plus", m:c=>c.streak, g:8},
  {id:"all",   i:"🧩", n:"Polyvalent",         d:"Travaille 10 muscles différents",  m:c=>c.muscles,  g:10},
  {id:"early", i:"🌅", n:"Lève-tôt",           d:"Termine une séance avant 9 h",          m:c=>c.early,    g:1},
  {id:"night", i:"🌙", n:"Oiseau de nuit",     d:"Termine une séance après 21 h",         m:c=>c.night,    g:1},
  {id:"quest", i:"🎖️", n:"Chasseur de défis",  d:"Réussis 5 défis de la semaine",         m:c=>c.challengesDone, g:5},
];
let _gameKey=null, _game=null;
function game(){
  const S=state.sessions.slice().sort((a,b)=>a.date-b.date);
  const dl=state.profile.daily||{};
  const key=S.length+"|"+(S.length?S[S.length-1].id+S[S.length-1].date:"")+"|"+(state.profile.poids||"")+"|"+weekStart(Date.now())+"|"+JSON.stringify(dl);
  if(key===_gameKey) return _game;
  // records : charge max (ou reps max au poids du corps) dépassée par rapport aux séances précédentes
  const best={};
  let records=0, tonnage=0, sets=0, maxKg=0; const muscles=new Set(), days=new Set(), weeks={};
  for(const s of S){
    let rec=0;
    for(const x of s.exercises){
      const ex=EXMAP[x.exId]; if(ex&&ex.m!=="cardio") muscles.add(ex.m);
      const useKg=x.sets.some(z=>+z.kg>0);
      const v=Math.max(0,...x.sets.map(z=>useKg?+z.kg||0:+z.reps||0));
      if(best[x.exId]!=null && v>best[x.exId]) rec++;
      if(best[x.exId]==null||v>best[x.exId]) best[x.exId]=v;
      for(const z of x.sets){ tonnage+=setVol(z); sets++; if(+z.kg>maxKg) maxKg=+z.kg; }
    }
    records+=rec; days.add(dayKey(s.date));
    const ws=weekStart(s.date); (weeks[ws]=weeks[ws]||[]).push({s,rec});
  }
  const weekStats=ws=>{
    const L=weeks[ws]||[]; const w={sessions:L.length,sets:0,records:0,legSets:0,tonnage:0,rated:0,long:0,coreSets:0};
    for(const {s,rec} of L){ w.records+=rec; if((s.duration||0)>=45) w.long++;
      for(const x of s.exercises){ const ex=EXMAP[x.exId]; if(x.effort) w.rated++;
        for(const z of x.sets){ w.sets++; w.tonnage+=setVol(z); if(ex&&LOWER_M.includes(ex.m)) w.legSets++; if(ex&&ex.m==="abdos") w.coreSets++; } } }
    return w;
  };
  let challengesDone=0, challengeXp=0, bestWeek=0;
  for(const ws of Object.keys(weeks).map(Number)){
    const w=weekStats(ws); bestWeek=Math.max(bestWeek,w.sessions);
    for(const c of weekChallenges(ws)) if(c.m(w)>=c.goal){ challengesDone++; challengeXp+=c.xp; }
  }
  // série de semaines avec 2 séances ou plus (la semaine en cours compte dès qu'elle est validée)
  let streak=0; const W=7*864e5; let ws=weekStart(Date.now());
  if(((weeks[ws]||[]).length)<2) ws=weekStart(ws-W/2);
  while((weeks[ws]||[]).length>=2){ streak++; ws=weekStart(ws-W/2); }
  const dqFull=Object.values(dl).filter(d=>DAILY.every(q=>(+d[q.id]||0)>=q.goal)).length;
  const ctx={sessions:S.length,records,maxKg,tonnage,bestWeek,streak,muscles:muscles.size,challengesDone,dqFull,
    early:S.some(s=>new Date(s.date).getHours()<9)?1:0, night:S.some(s=>new Date(s.date).getHours()>=21)?1:0};
  const badges=BADGES.map(b=>{const v=b.m(ctx); return {...b,v,done:v>=b.g};});
  const nb=badges.filter(b=>b.done).length;
  // quêtes du jour réussies (historique conservé jour par jour)
  let dqXp=0;
  for(const d of Object.values(dl)){ const n=DAILY.filter(q=>(+d[q.id]||0)>=q.goal).length; dqXp+=n*XP.dq+(n===DAILY.length?XP.dqAll:0); }
  const xp=S.length*XP.session+sets*XP.set+records*XP.record+days.size*XP.day+challengeXp+nb*XP.badge+dqXp;
  const level=levelFromXp(xp);
  const thisWeek=weekStart(Date.now());
  _game={xp,level,rank:rankOf(level),cur:xpForLevel(level),nxt:xpForLevel(level+1),records,tonnage,sets,badges,nbBadges:nb,best,
    week:weekStats(thisWeek),challenges:weekChallenges(thisWeek),todayDone:days.has(dayKey(Date.now())),ctx};
  _gameKey=key; return _game;
}
// Stats du personnage (0-100), sur tes dernières semaines
function playerStats(){
  const now=Date.now(), S28=state.sessions.filter(s=>s.date>now-28*864e5), S14=state.sessions.filter(s=>s.date>now-14*864e5);
  let sets=0, endu=0; const ms=new Set();
  for(const s of S28) for(const x of s.exercises){ const ex=EXMAP[x.exId];
    for(const z of x.sets){ sets++; if((ex&&ex.time)||(+z.reps||0)>=12) endu++; } }
  for(const s of S14) for(const x of s.exercises){ const ex=EXMAP[x.exId]; if(ex&&ex.m!=="cardio") ms.add(ex.m); }
  const sc=strengthScore(); const c=v=>Math.max(0,Math.min(100,Math.round(v)));
  return [
    {k:"Force",v:c(sc&&sc.score!=null?sc.score:0)},
    {k:"Endurance",v:c(endu/60*100)},
    {k:"Régularité",v:c(S28.length/16*100)},
    {k:"Volume",v:c(sets/200*100)},
    {k:"Polyvalence",v:c(ms.size/14*100)},
  ];
}
function radarSvg(stats){
  const N=stats.length, cx=110, cy=104, R=74;
  const pt=(i,r)=>{const a=-Math.PI/2+i*2*Math.PI/N; return [cx+r*Math.cos(a), cy+r*Math.sin(a)];};
  const poly=r=>stats.map((_,i)=>pt(i,r).map(v=>v.toFixed(1)).join(",")).join(" ");
  let g=""; for(const f of [.25,.5,.75,1]) g+=`<polygon points="${poly(R*f)}" class="rd-grid"/>`;
  stats.forEach((_,i)=>{const [x,y]=pt(i,R); g+=`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="rd-grid"/>`;});
  const pts=stats.map((s,i)=>pt(i,R*Math.max(.05,s.v/100)));
  const lbl=stats.map((s,i)=>{const [x,y]=pt(i,R+14); const anchor=Math.abs(x-cx)<8?"middle":x>cx?"start":"end";
    const y0=y<cy-20?y-14:y>cy+20?y+6:y-6;
    return `<text x="${x.toFixed(1)}" y="${y0.toFixed(1)}" text-anchor="${anchor}" class="rd-l">${s.k}<tspan x="${x.toFixed(1)}" dy="15" class="rd-v">${s.v}</tspan></text>`;}).join("");
  return `<svg viewBox="-58 -14 336 238" class="radar" role="img" aria-label="Statistiques : ${stats.map(s=>s.k+" "+s.v).join(", ")}">${g}<polygon points="${pts.map(p=>p.map(v=>v.toFixed(1)).join(",")).join(" ")}" class="rd-val"/>${pts.map(([x,y])=>`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" class="rd-dot"/>`).join("")}${lbl}</svg>`;
}
function segBar(pct,cls){ return `<div class="seg ${cls||""}"><i style="width:${Math.max(0,Math.min(100,pct))}%"></i></div>`; }
function renderHud(){
  const g=game(), p=state.profile, el=$("#hud"); if(!el) return;
  const pct=(g.xp-g.cur)/(g.nxt-g.cur)*100;
  el.innerHTML=`<button class="hud-btn" id="hudBtn" aria-label="Niveau ${g.level}, ${g.rank} : voir ta fiche joueur">
    <span class="hex">${g.level}</span>
    <span class="hud-t"><b>${esc(p.prenom||"Joueur")}</b>${segBar(pct,"thin")}</span></button>`;
  $("#hudBtn").onclick=()=>{show("profile");window.scrollTo(0,0)};
}
function renderQuests(){
  const el=$("#quests"); if(!el) return;
  const g=game(), wk=g.week;
  el.innerHTML=`<label class="f">Défis de la semaine</label>
    <div class="dq-sum"><span>Nouveaux défis chaque lundi</span></div>
    ${g.challenges.map(ch=>{const v=ch.m(wk), ok=v>=ch.goal; const shown=ch.unit?`${fmtKg(Math.round(Math.min(v,ch.goal)/100)/10)} / ${ch.goal/1000} t`:`${Math.min(v,ch.goal)} / ${ch.goal}`;
      return `<div class="q ${ok?"done":""}"><div class="q-i">${ok?"✓":"◇"}</div><div class="q-b"><b>${ch.t}</b>${segBar(v/ch.goal*100)}<small>${shown}</small></div><span class="q-xp">${ok?"Gagné":"+"+ch.xp+" XP"}</span></div>`;}).join("")}`;
}

function renderPlayer(){
  const el=$("#player"); if(!el) return;
  const g=game(), p=state.profile, pct=(g.xp-g.cur)/(g.nxt-g.cur)*100;
  el.innerHTML=`<div class="card pl-card">
      <div class="pl-top"><div class="pl-av"><span>${esc((p.prenom||"?").trim().charAt(0).toUpperCase()||"?")}</span><em>${g.level}</em></div>
        <div class="pl-id"><input id="pName" class="name-in" placeholder="Ton pseudo" maxlength="30" value="${esc(p.prenom||"")}" aria-label="Ton pseudo">
          <div class="pl-rank">Niveau ${g.level} · ${g.rank}</div></div></div>
      <div class="pl-xp"><div class="pl-xp-t"><span>Expérience</span><b>${g.xp-g.cur} / ${g.nxt-g.cur} XP</b></div>${segBar(pct,"big")}
        <small>${g.xp} XP au total · encore ${g.nxt-g.xp} XP pour le niveau ${g.level+1}</small></div>
    </div>
    <h2>Statistiques</h2>
    <div class="card">${radarSvg(playerStats())}
      <div class="sub" style="margin:4px 0 0;font-size:13px">Sur tes 4 dernières semaines : force (score de force), endurance (séries longues), régularité (16 séances = 100), volume (200 séries = 100), polyvalence (muscles travaillés).</div></div>
    <h2>Succès <span class="h-c">${g.nbBadges} / ${g.badges.length}</span></h2>
    <div class="badges">${g.badges.map(b=>{const pr=Math.min(1,b.v/b.g);
      return `<div class="bdg ${b.done?"on":""}"><div class="bdg-i">${b.i}</div><b>${b.n}</b><small>${b.done?"Débloqué":esc(b.d)}</small>${b.done?"":segBar(pr*100,"thin")}</div>`;}).join("")}</div>
    <div class="sub" style="margin:12px 0 0;font-size:13px">Gagner de l'XP : ${XP.set} par série validée, ${XP.session} par séance, ${XP.day} par jour d'entraînement, ${XP.record} par record battu, ${XP.badge} par succès, plus le bonus de chaque défi réussi.</div>`;
  $("#pName").addEventListener("change",e=>{state.profile.prenom=e.target.value.trim().slice(0,30); saveProfile(); renderProfile(); renderHud();});
}
// Petit « +10 XP » qui s'envole du bouton validé
function xpFloat(txt,anchor){
  try{ const r=(anchor||document.body).getBoundingClientRect(), f=document.createElement("div");
    f.className="xp-float"; f.textContent=txt; f.style.left=(r.left+r.width/2)+"px"; f.style.top=(r.top-4)+"px";
    document.body.appendChild(f); setTimeout(()=>f.remove(),1200); }catch(e){}
}

/* ============ PLANNING ============ */
// Séances prévues : {id, date:"AAAA-MM-JJ", focus, duration, time, repeat (chaque semaine), skip:[dates retirées]}
const ymd=d=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const fromYmd=k=>{const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d)};
const MONTHS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
let calMonth=(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)})(), calSel=ymd(Date.now());
function plans(){ return state.profile.plans||(state.profile.plans=[]); }
function plansOn(key){
  const wd=fromYmd(key).getDay();
  return plans().filter(p=>p.date===key||(p.repeat&&key>p.date&&fromYmd(p.date).getDay()===wd&&!(p.skip||[]).includes(key)))
    .sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
}
function sessionsOn(key){ return state.sessions.filter(s=>ymd(s.date)===key); }
// Une séance prévue est « faite » si une séance de la même zone a été enregistrée ce jour-là
function planDone(p,key){
  const S=sessionsOn(key); if(!S.length) return false;
  return p.focus==="auto"||S.some(s=>s.planId===p.id||s.title===FOCUS_TITLE[p.focus]);
}
function planLabel(p){ return p.focus==="auto"?"Séance auto (muscles reposés)":FOCUS_TITLE[p.focus]; }
function durLabel(d){ return (Object.fromEntries(OPTS.duration))[d]||d+" min"; }
function fmtDay(key){ return fromYmd(key).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}); }
function renderPlanning(){
  const el=$("#planning"); if(!el) return;
  const y=calMonth.getFullYear(), m=calMonth.getMonth(), today=ymd(Date.now());
  const first=(new Date(y,m,1).getDay()+6)%7, days=new Date(y,m+1,0).getDate();
  let cells=""; for(let i=0;i<first;i++) cells+=`<div class="cd empty"></div>`;
  for(let d=1;d<=days;d++){
    const key=ymd(new Date(y,m,d)), S=sessionsOn(key), P=plansOn(key).filter(p=>!planDone(p,key));
    const marks=(S.length?`<i class="mk done"></i>`:"")+(P.length?`<i class="mk plan"></i>`:"");
    cells+=`<button class="cd${key===today?" today":""}${key===calSel?" sel":""}${key<today?" past":""}" data-day="${key}" aria-label="${fmtDay(key)}${S.length?`, ${S.length} séance faite`:""}${P.length?`, ${P.length} prévue`:""}"><span>${d}</span><div class="mks">${marks}</div></button>`;
  }
  // détail du jour sélectionné
  const S=sessionsOn(calSel), P=plansOn(calSel), isPast=calSel<today;
  const dayItems=[
    ...S.map(s=>`<div class="pl-it done"><span class="pl-dot done"></span><div><b>${esc(s.title)}</b><small>${s.manual?"Validée sans détail":"Faite"}${s.duration?` · ${s.duration} min`:""}${s.manual?"":" · "+(n=>n+" série"+(n>1?"s":""))(s.exercises.reduce((a,x)=>a+x.sets.length,0))}</small></div>
      <div class="pl-act"><button class="iconbtn" data-sdel="${s.id}" aria-label="Supprimer cette séance">✕</button></div></div>`),
    ...P.filter(p=>!planDone(p,calSel)).map(p=>`<div class="pl-it"><span class="pl-dot"></span><div><b>${esc(planLabel(p))}</b><small>${p.time?p.time.replace(":","h")+" · ":""}${durLabel(p.duration)}${p.repeat?" · chaque "+fromYmd(p.date).toLocaleDateString("fr-FR",{weekday:"long"}):""}${isPast?" · manquée":""}</small></div>
      <div class="pl-act">${calSel===today?`<button class="btn primary small" data-plgo="${p.id}">Lancer</button>`:""}${calSel<=today?`<button class="btn ghost small" data-plok="${p.id}" aria-label="Valider cette séance comme faite">✓ Fait</button>`:""}<button class="iconbtn" data-pldel="${p.id}" aria-label="Retirer cette séance prévue">✕</button></div></div>`)
  ].join("");
  // prochaines séances prévues (14 jours)
  const up=[]; for(let i=0;i<14&&up.length<4;i++){ const k=ymd(Date.now()+i*864e5); for(const p of plansOn(k)) if(!planDone(p,k)&&up.length<4) up.push({p,k}); }
  el.innerHTML=`
    <div class="cal-h"><button class="iconbtn" data-mon="-1" aria-label="Mois précédent">‹</button><b>${MONTHS[m]} ${y}</b><button class="iconbtn" data-mon="1" aria-label="Mois suivant">›</button></div>
    <div class="cal-w">${["L","M","M","J","V","S","D"].map(d=>`<span>${d}</span>`).join("")}</div>
    <div class="cal">${cells}</div>
    <div class="cal-leg"><span><i class="mk done"></i> faite</span><span><i class="mk plan"></i> prévue</span></div>
    <div class="pl-day"><div class="pl-day-h">${fmtDay(calSel)}</div>
      ${dayItems||`<div class="sub" style="margin:4px 0 0;font-size:13.5px">${isPast?"Aucune séance ce jour-là.":"Rien de prévu pour l'instant."}</div>`}
      <div class="pl-btns">${calSel<=today?`<button class="btn ${S.length?"ghost":"primary"}" id="plOk">✓ ${S.length?"Valider une autre séance":"Valider une séance ce jour"}</button>`:""}${isPast?"":`<button class="btn ghost" id="plAdd">+ Planifier une séance</button>`}</div>
    </div>
    ${up.length?`<div class="pl-up"><div class="pl-day-h">Prochaines séances prévues</div>${up.map(({p,k})=>`<button class="pl-upi" data-day="${k}"><b>${k===today?"Aujourd'hui":fromYmd(k).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}${p.time?" · "+p.time.replace(":","h"):""}</b><span>${esc(planLabel(p))} · ${durLabel(p.duration)}</span></button>`).join("")}</div>`:""}`;
  const add=$("#plAdd"); if(add) add.onclick=()=>planForm(calSel);
  const ok=$("#plOk"); if(ok) ok.onclick=()=>validateForm(calSel);
}
function planForm(key){
  const f={focus:(state.profile.focus&&state.profile.focus!=="custom")?state.profile.focus:"full",duration:state.profile.duration||"60",time:"",repeat:false};
  const draw=()=>{
    $("#sheet").innerHTML=`<h2 style="margin-top:0">Planifier une séance</h2>
      <div class="sub" style="margin:-4px 0 8px">${fmtDay(key)}</div>
      <label class="f">Zone travaillée</label>
      <div class="chips">${OPTS.focus.map(([v,l])=>`<button class="chip ${f.focus===v?"on":""}" data-pf="focus" data-v="${v}">${l}</button>`).join("")}</div>
      <label class="f">Durée</label>
      <div class="chips">${OPTS.duration.map(([v,l])=>`<button class="chip ${f.duration===v?"on":""}" data-pf="duration" data-v="${v}">${l}</button>`).join("")}</div>
      <div class="pl-row"><label class="fld" style="flex:1"><small>Heure (facultatif)</small><input type="time" id="pfTime" value="${esc(f.time)}"></label>
        <button class="pl-rep ${f.repeat?"on":""}" id="pfRep" aria-pressed="${f.repeat}"><span>${f.repeat?"✓":""}</span>Chaque ${fromYmd(key).toLocaleDateString("fr-FR",{weekday:"long"})}</button></div>
      <div class="row" style="margin-top:16px"><button class="btn ghost" id="mCancel">Annuler</button><button class="btn primary" id="mOk">Planifier</button></div>`;
    $("#mCancel").onclick=closeModal;
    $("#pfTime").onchange=e=>{f.time=e.target.value;};
    $("#pfRep").onclick=()=>{f.time=$("#pfTime").value; f.repeat=!f.repeat; draw();};
    $("#mOk").onclick=()=>{ f.time=$("#pfTime").value;
      plans().push({id:uid(),date:key,focus:f.focus,duration:f.duration,time:f.time||"",repeat:f.repeat,skip:[]});
      saveProfile(); closeModal(); renderPlanning(); renderTodayPlan(); toast("Séance planifiée 📅"); };
    $("#sheet").querySelectorAll("[data-pf]").forEach(b=>b.onclick=()=>{f.time=$("#pfTime").value; f[b.dataset.pf]=b.dataset.v; draw();});
  };
  draw(); openModal();
}
function removePlan(id,key){
  const p=plans().find(x=>x.id===id); if(!p) return;
  const del=()=>{ state.profile.plans=plans().filter(x=>x.id!==id); saveProfile(); closeModal(); renderPlanning(); renderTodayPlan(); };
  if(!p.repeat){ confirmSheet(`Retirer « ${planLabel(p)} » du ${fmtDay(key)} ?`,"Retirer",del); return; }
  $("#sheet").innerHTML=`<p style="margin-top:0;font-size:16px">« ${esc(planLabel(p))} » est prévue chaque ${fromYmd(p.date).toLocaleDateString("fr-FR",{weekday:"long"})}.</p>
    <button class="btn ghost" id="pOnce">Retirer seulement le ${fromYmd(key).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}</button>
    <button class="btn ghost" id="pAll" style="margin-top:8px">Retirer toutes les semaines</button>
    <button class="linkbtn" id="mCancel" style="margin-top:8px">Annuler</button>`;
  openModal(); $("#mCancel").onclick=closeModal; $("#pAll").onclick=del;
  $("#pOnce").onclick=()=>{ if(key===p.date){ // première occurrence : on décale le début d'une semaine
      p.date=ymd(fromYmd(p.date).getTime()+7*864e5+3600e3); } else { (p.skip=p.skip||[]).push(key); }
    saveProfile(); closeModal(); renderPlanning(); renderTodayPlan(); };
}
function launchPlan(p){
  state.profile.focus=p.focus; state.profile.duration=p.duration; saveProfile(); renderChips();
  if(state.current&&state.current.exercises.some(x=>x.sets.some(s=>s.done))) confirmSheet("Une séance est en cours avec des séries validées. La remplacer par la séance prévue ?","Remplacer",generate);
  else generate();
}
$("#planning").addEventListener("click",e=>{
  const d=e.target.closest("[data-day]"); if(d){ calSel=d.dataset.day; const dt=fromYmd(calSel); calMonth=new Date(dt.getFullYear(),dt.getMonth(),1); renderPlanning(); return; }
  const mo=e.target.closest("[data-mon]"); if(mo){ calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()+(+mo.dataset.mon),1); renderPlanning(); return; }
  const g=e.target.closest("[data-plgo]"); if(g){ const p=plans().find(x=>x.id===g.dataset.plgo); if(p) launchPlan(p); return; }
  const r=e.target.closest("[data-pldel]"); if(r){ removePlan(r.dataset.pldel,calSel); return; }
  const o=e.target.closest("[data-plok]"); if(o){ const p=plans().find(x=>x.id===o.dataset.plok); if(p) validateForm(calSel,p.focus==="auto"?"full":p.focus,p.duration,p.id); return; }
  const sd=e.target.closest("[data-sdel]"); if(sd){ const ss=state.sessions.find(x=>x.id===sd.dataset.sdel);
    confirmSheet(`Supprimer « ${ss?ss.title:"cette séance"} » du ${fmtDay(calSel)} ? L'XP gagnée sera retirée.`,"Supprimer",async()=>{ await deleteSession(sd.dataset.sdel); renderProgress(); renderHud(); renderQuests(); renderTodayPlan(); }); return; }
});
// Valider un jour : enregistre une séance « sans détail » (faite hors de l'appli ou pas notée)
function validateForm(key,focus,dur,planId){
  const f={ms:new Set(focus&&PRESET_M[focus]?PRESET_M[focus]:[]),duration:dur||state.profile.duration||"60",list:false};
  const titleOf=()=>{ const ms=MAJOR.filter(m=>f.ms.has(m)); if(!ms.length) return "Séance libre"; const pr=matchPreset(ms); return pr?FOCUS_TITLE[pr]:customTitle(ms); };
  const draw=()=>{
    const ms=MAJOR.filter(m=>f.ms.has(m));
    $("#sheet").innerHTML=`<h2 style="margin-top:0">Valider une séance</h2>
      <div class="sub" style="margin:-4px 0 8px">${fmtDay(key)}</div>
      <label class="f">Muscles travaillés</label>
      <div class="bodymap vbm"><div class="bm-views"><figure>${bodySvg("front",f.ms)}<figcaption>Face</figcaption></figure><figure>${bodySvg("back",f.ms)}<figcaption>Dos</figcaption></figure></div>
        <div class="bm-sel">${ms.length?`<span class="v-title">${esc(titleOf())}</span><button class="linkbtn bm-clear" id="vClear">Tout effacer</button>`:`<span class="sub" style="font-size:13px">Touche les muscles travaillés. Rien de sélectionné = cardio ou autre sport.</span>`}</div><button type="button" class="linkbtn bl-toggle" id="vList">${f.list?"Masquer la liste des muscles ▲":"Choisir dans la liste des muscles ▼"}</button>${f.list?muscleList(f.ms,"data-vm"):""}</div>
      <label class="f">Durée</label>
      <div class="chips">${OPTS.duration.map(([v,l])=>`<button class="chip ${f.duration===v?"on":""}" data-vf="duration" data-v="${v}">${l}</button>`).join("")}</div>
      <p class="sub" style="font-size:13px;margin:12px 0 0">Elle compte pour ton planning, ta régularité, ta récupération, tes défis et ton XP. Sans le détail des séries, elle n'apparaît pas dans tes records ni tes courbes.</p>
      <div class="row" style="margin-top:14px"><button class="btn ghost" id="mCancel">Annuler</button><button class="btn primary" id="mOk">Valider</button></div>`;
    $("#mCancel").onclick=closeModal;
    const vc=$("#vClear"); if(vc) vc.onclick=()=>{ f.ms.clear(); draw(); };
    $("#vList").onclick=()=>{ f.list=!f.list; draw(); };
    $("#sheet").querySelectorAll("[data-vm]").forEach(b=>b.onclick=()=>{ const m=b.dataset.vm; f.ms.has(m)?f.ms.delete(m):f.ms.add(m); draw(); });
    $("#sheet").querySelectorAll("[data-vf]").forEach(b=>b.onclick=()=>{ f[b.dataset.vf]=b.dataset.v; draw(); });
    $("#sheet").querySelectorAll(".mu[data-m]").forEach(g=>{
      const t=()=>{ const m=g.dataset.m; f.ms.has(m)?f.ms.delete(m):f.ms.add(m); draw(); };
      g.addEventListener("click",t); g.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); t(); } });
    });
    $("#mOk").onclick=async()=>{
      const before=game().xp, today=ymd(Date.now());
      const date=key===today?Date.now():fromYmd(key).getTime()+12*36e5;
      const s={id:uid(),date,title:titleOf(),goal:state.profile.goal,exercises:[],muscles:MAJOR.filter(m=>f.ms.has(m)),duration:+f.duration,manual:true,...(planId?{planId}:{})};
      closeModal(); await saveSession(s);
      renderProgress(); renderHud(); renderQuests(); renderTodayPlan(); renderRecovery();
      toast(`✓ Séance validée · +${game().xp-before} XP`);
    };
  };
  draw(); openModal();
}
// Bandeau « Prévu aujourd'hui » sur l'onglet Créer
function renderTodayPlan(){
  const el=$("#todayPlan"); if(!el) return;
  const k=ymd(Date.now()), P=plansOn(k).filter(p=>!planDone(p,k));
  if(!P.length){ el.style.display="none"; el.innerHTML=""; return; }
  el.style.display="block";
  el.innerHTML=`<label class="f">Prévu aujourd'hui</label>${P.map(p=>`<div class="tp-it"><div><b>${esc(planLabel(p))}</b><small>${p.time?p.time.replace(":","h")+" · ":""}${durLabel(p.duration)}</small></div><button class="btn primary small" data-tpgo="${p.id}">Préparer</button></div>`).join("")}`;
}
$("#todayPlan").addEventListener("click",e=>{ const b=e.target.closest("[data-tpgo]"); if(!b) return; const p=plans().find(x=>x.id===b.dataset.tpgo); if(p) launchPlan(p); });

/* ============ SILHOUETTE : CHOIX DES MUSCLES ============ */
// Muscles de chaque raccourci : quand la sélection correspond exactement, on garde la séance type du raccourci
const PRESET_M = {
  full:["pectoraux","delt_ant","delt_lat","dos","rhomboides","biceps","triceps","abdos","quadriceps","ischios","fessiers","mollets"],
  haut:["pectoraux","delt_ant","delt_lat","delt_post","dos","rhomboides","biceps","triceps"],
  bas:["quadriceps","ischios","fessiers","mollets"],
  push:["pectoraux","delt_ant","delt_lat","triceps"],
  pull:["delt_post","dos","rhomboides","grandrond","biceps"],
  bras:["delt_ant","delt_lat","delt_post","biceps","triceps"],
};
// Regroupement pour la liste des muscles (petites zones plus faciles à toucher)
const MUSCLE_GROUPS = [["Pectoraux",["pectoraux"]],["Épaules",["delt_ant","delt_lat","delt_post"]],["Trapèzes",["trap_sup","trap_moy","trap_inf"]],
  ["Dos",["dos","rhomboides","grandrond","petitrond","lombaires"]],["Bras",["biceps","triceps","avb_flech","avb_ext"]],
  ["Abdos",["abdos","obliques"]],["Jambes",["quadriceps","ischios","fessiers","mollets"]]];
function muscleList(sel,attr){
  return `<div class="bm-list">${MUSCLE_GROUPS.map(([g,ms])=>`<div class="bl-g"><span class="bl-h">${g}</span><div class="bl-c">${ms.map(m=>
    `<button type="button" class="chip bl-chip${sel.has(m)?" on":""}" ${attr}="${m}" aria-pressed="${sel.has(m)}">${MUSCLE_LABEL[m]}${MUSCLE_HINT[m]?` <small>${MUSCLE_HINT[m]}</small>`:""}</button>`).join("")}</div></div>`).join("")}</div>`;
}
function selMuscles(){ const p=state.profile; return p.focus==="custom"?(p.muscles||[]):(PRESET_M[p.focus]||[]); }
function matchPreset(ms){
  const k=ms.slice().sort().join(",");
  for(const [f,l] of Object.entries(PRESET_M)) if(l.slice().sort().join(",")===k) return f;
  return null;
}
function toggleMuscle(m){
  const cur=new Set(selMuscles());
  cur.has(m)?cur.delete(m):cur.add(m);
  const ms=MAJOR.filter(x=>cur.has(x));
  const p=state.profile;
  if(!ms.length){ p.focus="auto"; p.muscles=[]; }
  else { const pr=matchPreset(ms); p.focus=pr||"custom"; p.muscles=ms; }
  saveProfile(); renderChips(); renderBodyMap();
}
// Dessin : formes simples, côté gauche dessiné puis copié en miroir
const BODY = {
  neutral:`<ellipse cx="60" cy="17" rx="10.5" ry="12.5"/><rect x="54" y="27" width="12" height="10" rx="3"/>
    <path d="M38,41 Q60,35 82,41 L87,60 Q83,96 79,121 L83,137 Q60,143 37,137 L41,121 Q37,96 33,60 Z"/>`,
  neutralSide:`<path d="M28,53 Q20,70 22,93 L34,93 Q36,72 39,56 Z"/>
    <ellipse cx="22" cy="130" rx="4.6" ry="6.2"/><path d="M38,134 Q34,170 42,196 L57,196 Q61,168 60,138 Z"/>
    <ellipse cx="49.5" cy="197" rx="7" ry="5"/><path d="M43,199 Q40,222 45,240 L54,240 Q57,220 56,199 Z"/><ellipse cx="50" cy="244" rx="6.5" ry="3.6"/>`,
  front:{
    center:[["abdos",`<path d="M50,75 Q60,72 70,75 L71,118 Q60,125 49,118 Z"/>`]],
    side:[["pectoraux",`<path d="M59,45 Q47,42 40,49 Q36,60 41,69 Q50,75 59,71 Z"/>`],
          ["delt_lat",`<path d="M31,41.2 Q25,43.5 25.5,50.5 Q26,57.5 31,58.8 Q28.6,50 31,41.2 Z"/>`],
          ["delt_ant",`<path d="M31,41.2 Q38,40.6 41.8,45.5 Q43.4,51 40,56 Q36,59.4 31,58.8 Q28.6,50 31,41.2 Z"/>`],
          ["trap_sup",`<path d="M54,30 Q48,35 41,40 Q47,42.5 55,40.5 Z"/>`],
          ["biceps",`<ellipse cx="29" cy="77" rx="5.6" ry="12.5"/>`],
          ["avb_flech",`<path d="M22,92 Q16,108 18,125 L26,125 Q30,108 33,92 Z"/>`],
          ["obliques",`<path d="M41,73 Q37.6,86 39.6,100 Q41.6,111 48.4,119 L49,76.5 Q45,74 41,73 Z"/>`],
          ["quadriceps",`<path d="M41,140 Q37,165 43,192 Q49,197 56,192 Q60,168 58,141 Q50,136 41,140 Z"/>`],
          ["mollets",`<ellipse cx="48.5" cy="221" rx="5.6" ry="16"/>`]],
    deco:`<path d="M60,77 L60,119 M51,88 L69,88 M51,100 L69,100 M51,110 L69,110"/>`,
  },
  back:{
    center:[["lombaires",`<path d="M53,103 Q60,99 67,103 L68,121 Q60,126 52,121 Z"/>`]],
    side:[["delt_lat",`<path d="M31,41.2 Q25,43.5 25.5,50.5 Q26,57.5 31,58.8 Q28.6,50 31,41.2 Z"/>`],
          ["delt_post",`<path d="M31,41.2 Q38,40.6 41.8,45.5 Q43.4,51 40,56 Q36,59.4 31,58.8 Q28.6,50 31,41.2 Z"/>`],
          ["trap_sup",`<path d="M60,28 L54,30.5 Q47,35.5 40.5,40.5 Q47,42.3 53,42 L60,41.5 Z"/>`],
          ["trap_moy",`<path d="M60,41.5 L53,42 Q47,42.3 42.5,43.8 Q49,47 54.5,51.3 L60,53 Z"/>`],
          ["rhomboides",`<path d="M52.4,51.8 Q50.2,52.8 50.2,56 Q50.2,62.5 52.6,68 L57,70.6 Q53.6,63 52.4,51.8 Z"/>`],
          ["trap_inf",`<path d="M60,53 L53,51.4 Q54.6,63 60,78 Z"/>`],
          ["petitrond",`<path d="M44.2,46.8 Q42.8,52 43.6,58.6 L50.2,60 Q50.6,53.8 49.8,49 Q47.2,47 44.2,46.8 Z"/>`],
          ["grandrond",`<path d="M43.6,59.4 Q42.4,63.6 44,67.6 L50.6,68.8 L50.3,60.8 Z"/>`],
          ["dos",`<path d="M43.6,68.4 Q38,74 38.8,85 Q46,97 56,102 L58.9,71.4 L53,69.2 L50.8,69.6 Z"/>`],
          ["obliques",`<path d="M39.4,87.5 Q46,98.4 55.4,103 L52,104.6 L52,121 Q45.4,120 41.8,113 Q38.6,100 39.4,87.5 Z"/>`],
          ["triceps",`<ellipse cx="28.5" cy="78" rx="5.6" ry="13"/>`],
          ["avb_ext",`<path d="M22,92 Q16,108 18,125 L26,125 Q30,108 33,92 Z"/>`],
          ["fessiers",`<ellipse cx="50" cy="138" rx="10" ry="10"/>`],
          ["ischios",`<path d="M41,150 Q38,170 43,192 Q49,196 56,192 Q60,172 58,150 Q50,146 41,150 Z"/>`],
          ["mollets",`<ellipse cx="48.5" cy="219" rx="6.6" ry="15"/>`]],
    deco:`<path d="M60,78 L60,101"/>`,
  },
};
function bodySvg(view,sel,recM){
  const V=BODY[view];
  if(!sel){ sel=new Set(selMuscles()); const auto=state.profile.focus==="auto"; recM=auto&&state.sessions.length?new Set(FOCUS_MUSCLES[autoFocus()]):new Set(); }
  recM=recM||new Set();
  const mus=(m,shape)=>{ const on=sel.has(m), rc=recM.has(m);
    return `<g class="mu${on?" on":""}${rc?" rc":""}" data-m="${m}" role="button" tabindex="0" aria-pressed="${on}" aria-label="${MUSCLE_LABEL[m]}${on?" (sélectionné)":""}">${shape}</g>`; };
  return `<svg viewBox="8 0 104 250" class="bm-svg" aria-label="Silhouette ${view==="front"?"de face":"de dos"}">
    <g class="bn">${BODY.neutral}${BODY.neutralSide}<g transform="translate(120,0) scale(-1,1)">${BODY.neutralSide}</g></g>
    ${V.center.map(([m,s])=>mus(m,s)).join("")}
    ${V.side.map(([m,s])=>mus(m,s)+`<g transform="translate(120,0) scale(-1,1)">${mus(m,s)}</g>`).join("")}
    <g class="bm-deco">${V.deco}</g></svg>`;
}
let bmListOpen=false;
function renderBodyMap(){
  const el=$("#bodymap"); if(!el) return;
  const ms=selMuscles(), f=state.profile.focus;
  el.innerHTML=`<div class="bm-views"><figure>${bodySvg("front")}<figcaption>Face</figcaption></figure><figure>${bodySvg("back")}<figcaption>Dos</figcaption></figure></div>
    <div class="bm-sel">${f==="auto"
      ? `<span class="sub" style="font-size:13px">Mode auto : ${state.sessions.length?`je choisis les muscles les plus reposés (en pointillés : <b>${FOCUS_TITLE[autoFocus()]}</b>).`:"je choisis selon ta récupération."} Touche un muscle pour choisir toi-même.</span>`
      : `${ms.map(m=>`<button class="bm-chip" data-mx="${m}" aria-label="Retirer ${MUSCLE_LABEL[m]}">${MUSCLE_LABEL[m]} <span aria-hidden="true">✕</span></button>`).join("")}<button class="linkbtn bm-clear" id="bmClear">Tout effacer</button>`}</div>
    <button class="linkbtn bl-toggle" id="bmList" aria-expanded="${bmListOpen}">${bmListOpen?"Masquer la liste des muscles ▲":"Choisir dans la liste des muscles ▼"}</button>
    ${bmListOpen?muscleList(new Set(f==="auto"?[]:ms),"data-mt"):""}`;
  $("#bmList").onclick=()=>{ bmListOpen=!bmListOpen; renderBodyMap(); };
  const c=$("#bmClear"); if(c) c.onclick=()=>{ state.profile.focus="auto"; state.profile.muscles=[]; saveProfile(); renderChips(); renderBodyMap(); };
}
$("#bodymap").addEventListener("click",e=>{
  const x=e.target.closest("[data-mx]"); if(x){ toggleMuscle(x.dataset.mx); return; }
  const t=e.target.closest("[data-mt]"); if(t){ toggleMuscle(t.dataset.mt); return; }
  const g=e.target.closest(".mu[data-m]"); if(g) toggleMuscle(g.dataset.m);
});
$("#bodymap").addEventListener("keydown",e=>{ const g=e.target.closest(".mu[data-m]"); if(g&&(e.key==="Enter"||e.key===" ")){ e.preventDefault(); toggleMuscle(g.dataset.m); } });

// Séance construite à partir d'une sélection libre : gros muscles d'abord, puis compléments en supersets
const MUSCLE_PATS = {
  pectoraux:["HPUSH","IPUSH","CHESTISO","DIPS"],
  dos:["VPULL","LATS2","VPULL"], rhomboides:["HPULL","RHOMB","HPULL2"], grandrond:["TERES","TERES2"], petitrond:["EXTROT","EXTROT2"],
  lombaires:["LOWBACK","LOWBACK2"], trap_sup:["TRAPS","TRAPS2"], trap_moy:["TRAPMID","TRAPMID2"], trap_inf:["TRAPLOW","TRAPLOW2"],
  delt_ant:["VPUSH","FRONTRAISE","VPUSH2"], delt_lat:["LATRAISE","LATRAISE2"], delt_post:["REAR2","REAR"],
  biceps:["BICEPS","BICEPS2","BICEPS"], triceps:["TRICEPS","DIPS","TRICEPS2"], avb_flech:["FOREARM","GRIP"], avb_ext:["FOREARM2","FOREARM2"],
  quadriceps:["SQUAT","LUNGE","LEGEXT","SQUAT2"], ischios:["HINGE","LEGCURL","HINGE"], fessiers:["GLUTE","LUNGE","GLUTE2"],
  mollets:["CALF","CALF"], abdos:["CORE","CORE2"], obliques:["OBLIQ","OBLIQ2"],
};
const BIG = ["quadriceps","pectoraux","dos","rhomboides","ischios","fessiers","delt_ant"];
function customTemplate(ms){
  const order=[...BIG.filter(m=>ms.includes(m)), ...MAJOR.filter(m=>!BIG.includes(m)&&ms.includes(m))];
  const per=ms.length===1?5:ms.length===2?4:ms.length<=4?3:2;
  const tpl=[]; let mains=0; const rest=[];
  order.forEach(m=>{
    const n=BIG.includes(m)?per:Math.max(1,per-1);
    const pats=[...MUSCLE_PATS[m],"M:"+m,"M:"+m,"M:"+m].slice(0,n);
    pats.forEach((pat,i)=>{
      if(i===0&&BIG.includes(m)&&mains<2){ tpl.push({s:[pat],r:"main"}); mains++; }
      else rest.push({pat,r:BIG.includes(m)?"acc":"iso",round:i});
    });
  });
  rest.sort((a,b)=>a.round-b.round);
  for(let i=0;i<rest.length;i+=2){
    const a=rest[i], b=rest[i+1];
    tpl.push({s:b?[a.pat,b.pat]:[a.pat], r:a.r==="acc"||(b&&b.r==="acc")?"acc":"iso", opt:i>=4});
  }
  if(!tpl.length) tpl.push({s:[MUSCLE_PATS[order[0]][0]],r:"main"});
  return tpl;
}
function customTitle(ms){
  if(ms.length<=3) return ms.map(m=>MUSCLE_LABEL[m]).join(" · ");
  return "Séance ciblée ("+ms.length+" muscles)";
}

/* ============ MODALE ============ */
function openModal(){$("#modal").style.display="flex"}
function closeModal(){$("#modal").style.display="none"}
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
function confirmSheet(msg,okLabel,fn){
  $("#sheet").innerHTML=`<p style="margin-top:0;font-size:16px">${esc(msg)}</p><div class="row"><button class="btn ghost" id="mCancel">Annuler</button><button class="btn primary" id="mOk">${esc(okLabel)}</button></div>`;
  openModal(); $("#mCancel").onclick=closeModal; $("#mOk").onclick=()=>{closeModal();fn()};
}

/* ============ NAVIGATION ============ */
function show(v){
  document.querySelectorAll(".xp-float").forEach(f=>f.remove());
  $$(".view").forEach(el=>el.classList.toggle("on",el.id==="v-"+v));
  $$("nav.tabs button").forEach(b=>b.classList.toggle("on",b.dataset.v===v));
  if(v==="progress") renderProgress();
  if(v==="profile") renderProfile();
  if(v==="create"){ renderRecovery(); renderQuests(); renderTodayPlan(); renderFavs(); }
  if(v==="nutrition") renderNutrition();
}
$$("nav.tabs button").forEach(b=>b.onclick=()=>{ if(b.dataset.v==="session"&&$("#v-session").classList.contains("on")&&detailId){closeDetail();return} show(b.dataset.v);window.scrollTo(0,0)});

renderChips(); renderBody(); renderProfile(); renderSession(); renderProgress(); renderHud(); renderQuests(); renderTodayPlan(); renderFavs(); renderSync(); askPersist();
if(state.current) show("session");
