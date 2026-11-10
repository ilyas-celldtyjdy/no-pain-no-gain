/* Fonctions pures : calculs de charges, récupération, score de force. Testées dans tests.html */
const fmtKg=v=>(Math.round(v*10)/10).toString().replace(".",",");
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const e1rm=(kg,reps)=>kg*(1+reps/30);
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function prescription(ex,p){
  const g=GOAL_P[p.goal][ex.t];
  let s=g.s; const lv=+p.level;
  if(lv===1) s=Math.max(2,s-1);
  if(lv===3 && ex.t==="c") s+=1;
  let r=g.r.slice();
  if(ex.time) r=[30,60];
  const rest=g.rest+(+state.profile.age>=50?15:0);
  return {sets:s,reps:r,rest};
}
const ASSIST={pectoraux:{triceps:.5,delt_ant:.5},dos:{biceps:.5,grandrond:.5,delt_post:.3,avb_flech:.3},rhomboides:{dos:.4,trap_moy:.5,delt_post:.4,biceps:.4,avb_flech:.3},trap_moy:{rhomboides:.5,delt_post:.3},delt_ant:{triceps:.4,delt_lat:.3,trap_sup:.2},quadriceps:{fessiers:.5},ischios:{fessiers:.5,lombaires:.4},lombaires:{ischios:.5,fessiers:.3},trap_sup:{avb_flech:.4},grandrond:{dos:.3}};
const MAJOR=["pectoraux","delt_ant","delt_lat","delt_post","trap_sup","trap_moy","trap_inf","dos","rhomboides","grandrond","petitrond","lombaires","biceps","triceps","avb_flech","avb_ext","abdos","obliques","quadriceps","ischios","fessiers","mollets"];
function recovery(){
  const f={}; MAJOR.forEach(m=>f[m]=0);
  const now=Date.now();
  for(const s of state.sessions){
    const h=(now-s.date)/36e5; if(h>72) continue;
    const k=1-h/72;
    if(s.manual) for(const m of (s.muscles||[])) if(m in f) f[m]+=6*8*k; // séance validée sans détail : ~6 séries par muscle
    for(const x of s.exercises){
      const ex=EXMAP[x.exId]; if(!ex||!(ex.m in f)) continue;
      const n=x.sets.length*(x.effort==="hard"?1.2:x.effort==="easy"?.8:1);
      f[ex.m]+=n*8*k;
      if(ex.t==="c") for(const [m,w] of Object.entries(ASSIST[ex.m]||{})) f[m]+=n*8*w*k;
    }
  }
  const r={}; for(const m of MAJOR) r[m]=Math.max(0,Math.round(100-f[m])); return r;
}
const SCORE_LIFTS=[["Développé couché",["dc_barre","dc_halt"],1.75],["Squat / presse",["squat","presse","goblet"],2.25],["Soulevé de terre",["sdt","sdt_roumain","sdt_halt"],2.5],["Rowing",["rowing_barre","rowing_halt","tirage_horiz"],1.5],["Développé épaules",["dm_barre","dm_halt","ep_machine"],1.1]];
function strengthScore(){
  const p=state.profile, bw=+p.poids; if(!bw) return null;
  const fem=p.sexe==="f";
  const best={};
  for(const s of state.sessions) for(const x of s.exercises) for(const z of x.sets){ if(z.kg>0&&z.reps>0&&z.reps<=15){ const v=e1rm(z.kg,z.reps); if(!best[x.exId]||v>best[x.exId]) best[x.exId]=v; } }
  const parts=[];
  for(const [name,ids,ref] of SCORE_LIFTS){
    let v=0, id0=null;
    for(const id of ids){ if(best[id]){ let b=best[id]; const ex=EXMAP[id];
      if(id==="presse") b*=.55; if(id==="goblet") b*=1.4; if(ex.eq==="haltere"&&id!=="goblet") b*=2; // une haltère par main // équivalences approximatives
      if(id==="ep_machine"||id==="tirage_horiz") b*=.85;
      if(b>v){v=b;id0=id;} } }
    if(!v) continue;
    const pct=Math.min(100,Math.round(v/bw/(ref*(fem?.65:1))*100));
    parts.push({name,pct,v});
  }
  if(!parts.length) return {score:null,parts};
  return {score:Math.round(parts.reduce((a,x)=>a+x.pct,0)/parts.length),parts};
}

/* ----- Données : version, migrations, import, CSV ----- */
const DATA_VERSION=2;
// Migrations de format : MIGRATIONS[n] transforme les données de la version n-1 vers n.
const MIGRATIONS={ 2:o=>o }; // v1 -> v2 : ajout du champ "v", structure inchangée
function migrateData(o){
  if(!o||typeof o!=="object"||Array.isArray(o)) return {};
  let v=+o.v||1;
  while(v<DATA_VERSION){ v++; if(MIGRATIONS[v]) o=MIGRATIONS[v](o)||o; }
  o.v=DATA_VERSION; return o;
}
// Vérifie la structure d'un fichier importé ; renvoie les données nettoyées ou lève une erreur lisible
function parseImport(text){
  let o; try{ o=JSON.parse(text); }catch(e){ throw new Error("Ce fichier n'est pas un JSON valide."); }
  if(!o||o.app!=="no-pain-no-gain"||!o.data) throw new Error("Ce fichier n'est pas une sauvegarde No Pain No Gain.");
  const d=migrateData(Object.assign({v:o.version},o.data));
  if(!d.profile||typeof d.profile!=="object") throw new Error("Profil manquant dans la sauvegarde.");
  if(!Array.isArray(d.sessions)) throw new Error("Liste de séances manquante dans la sauvegarde.");
  const ok=d.sessions.every(s=>s&&typeof s.id==="string"&&typeof s.date==="number"&&Array.isArray(s.exercises));
  if(!ok) throw new Error("Certaines séances sont corrompues.");
  return d;
}
function csvCell(v){ const s=String(v==null?"":v); return /[";\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
function sessionsToCsv(sessions){
  const rows=[["date","séance","exercice","série","charge_kg","reps_ou_secondes","ressenti","note_exercice","note_séance"]];
  for(const s of sessions) for(const x of s.exercises) x.sets.forEach((z,i)=>rows.push([new Date(s.date).toISOString().slice(0,10),s.title,(EXMAP[x.exId]||{n:x.name}).n,i+1,z.kg,z.reps,x.effort||"",x.note||"",s.note||""]));
  return "﻿"+rows.map(r=>r.map(csvCell).join(";")).join("\r\n");
}
