/* ============ BIBLIOTHÈQUE D'EXERCICES ============ */
// eq: barre, haltere, machine, poulie, pdc ; t: c = polyarticulaire, i = isolation ; lv: niveau minimal (1-3)
const EX = [
 // Pectoraux
 {id:"dc_barre",n:"Développé couché barre",m:"pectoraux",eq:"barre",t:"c",lv:1,cue:"Omoplates serrées, barre vers le bas des pecs, pieds ancrés au sol."},
 {id:"dc_halt",n:"Développé couché haltères",m:"pectoraux",eq:"haltere",t:"c",lv:1,cue:"Descends lentement jusqu'à l'étirement des pecs, remonte en rapprochant les haltères."},
 {id:"di_halt",n:"Développé incliné haltères",m:"pectoraux",eq:"haltere",t:"c",lv:1,cue:"Banc à 30°, coudes à ~45° du buste."},
 {id:"di_barre",n:"Développé incliné barre",m:"pectoraux",eq:"barre",t:"c",lv:2,cue:"Banc à 30°, barre vers le haut des pecs."},
 {id:"pec_machine",n:"Presse pectoraux machine",m:"pectoraux",eq:"machine",t:"c",lv:1,cue:"Poignées à hauteur de poitrine, dos collé au dossier."},
 {id:"pompes",n:"Pompes",m:"pectoraux",eq:"pdc",t:"c",lv:1,cue:"Corps gainé en planche, poitrine proche du sol."},
 {id:"dips",n:"Dips",m:"pectoraux",eq:"pdc",t:"c",lv:2,cue:"Buste penché en avant pour cibler les pecs, descends jusqu'à 90° aux coudes."},
 {id:"ecarte_halt",n:"Écarté haltères",m:"pectoraux",eq:"haltere",t:"i",lv:1,cue:"Bras légèrement fléchis, ouvre jusqu'à sentir l'étirement."},
 {id:"pec_deck",n:"Pec deck",m:"pectoraux",eq:"machine",t:"i",lv:1,cue:"Serre en contractant les pecs, contrôle le retour."},
 {id:"vis_a_vis",n:"Écarté poulie vis-à-vis",m:"pectoraux",eq:"poulie",t:"i",lv:2,cue:"Croise les mains devant toi, garde les coudes fixes."},
 // Dos
 {id:"tractions",n:"Tractions",m:"dos",eq:"pdc",t:"c",lv:2,cue:"Tire la poitrine vers la barre, descends bras tendus."},
 {id:"rowing_barre",n:"Rowing barre",m:"rhomboides",eq:"barre",t:"c",lv:2,cue:"Dos plat penché à ~45°, tire la barre vers le nombril."},
 {id:"rowing_halt",n:"Rowing haltère un bras",m:"dos",eq:"haltere",t:"c",lv:1,cue:"Appui sur un banc, tire le coude vers la hanche."},
 {id:"tirage_vert",n:"Tirage vertical",m:"dos",eq:"poulie",t:"c",lv:1,cue:"Tire la barre vers le haut de la poitrine, buste légèrement incliné."},
 {id:"tirage_horiz",n:"Tirage horizontal",m:"rhomboides",eq:"poulie",t:"c",lv:1,cue:"Poitrine sortie, ramène les coudes en arrière, serre les omoplates."},
 {id:"rowing_machine",n:"Rowing machine",m:"rhomboides",eq:"machine",t:"c",lv:1,cue:"Poitrine contre l'appui, tire en serrant les omoplates."},
 {id:"rowing_inverse",n:"Rowing inversé",m:"rhomboides",eq:"pdc",t:"c",lv:1,cue:"Sous une barre basse ou table solide, corps gainé, tire la poitrine vers la barre."},
 {id:"pullover_poulie",n:"Pull-over poulie",m:"grandrond",eq:"poulie",t:"i",lv:2,cue:"Bras quasi tendus, ramène la barre vers les cuisses."},
 // Épaules
 {id:"dm_halt",n:"Développé militaire haltères",m:"delt_ant",eq:"haltere",t:"c",lv:1,cue:"Assis ou debout, pousse au-dessus de la tête sans cambrer."},
 {id:"dm_barre",n:"Développé militaire barre",m:"delt_ant",eq:"barre",t:"c",lv:2,cue:"Debout, fessiers et abdos serrés, barre au-dessus de la tête."},
 {id:"ep_machine",n:"Développé épaules machine",m:"delt_ant",eq:"machine",t:"c",lv:1,cue:"Poignées à hauteur d'épaules, pousse sans verrouiller les coudes."},
 {id:"pike_pushup",n:"Pompes piquées",m:"delt_ant",eq:"pdc",t:"c",lv:2,cue:"Hanches hautes en V inversé, tête vers le sol entre les mains."},
 {id:"elev_lat",n:"Élévations latérales",m:"delt_lat",eq:"haltere",t:"i",lv:1,cue:"Monte les coudes jusqu'à hauteur d'épaules, sans élan."},
 {id:"elev_lat_poulie",n:"Élévations latérales poulie",m:"delt_lat",eq:"poulie",t:"i",lv:2,cue:"Poulie basse, un bras à la fois, tension constante."},
 {id:"oiseau",n:"Oiseau (arrière d'épaule)",m:"delt_post",eq:"haltere",t:"i",lv:1,cue:"Buste penché, ouvre les bras sur les côtés en serrant les omoplates."},
 {id:"face_pull",n:"Face pull",m:"delt_post",eq:"poulie",t:"i",lv:1,cue:"Corde à hauteur du visage, tire vers le front en ouvrant les coudes."},
 // Biceps
 {id:"curl_halt",n:"Curl haltères",m:"biceps",eq:"haltere",t:"i",lv:1,cue:"Coudes collés au corps, supination en montant."},
 {id:"curl_barre",n:"Curl barre",m:"biceps",eq:"barre",t:"i",lv:1,cue:"Coudes fixes, pas de balancier du buste."},
 {id:"curl_marteau",n:"Curl marteau",m:"biceps",eq:"haltere",t:"i",lv:1,cue:"Prise neutre (pouces vers le haut)."},
 {id:"curl_poulie",n:"Curl poulie",m:"biceps",eq:"poulie",t:"i",lv:1,cue:"Tension continue, contrôle la descente."},
 {id:"curl_machine",n:"Curl pupitre machine",m:"biceps",eq:"machine",t:"i",lv:1,cue:"Bras bien à plat sur le pupitre, extension complète en bas."},
 {id:"chin_up",n:"Tractions supination",m:"biceps",eq:"pdc",t:"c",lv:2,cue:"Paumes vers toi, menton au-dessus de la barre."},
 // Triceps
 {id:"ext_poulie",n:"Extension triceps poulie",m:"triceps",eq:"poulie",t:"i",lv:1,cue:"Coudes collés au buste, pousse vers le bas jusqu'à l'extension complète."},
 {id:"barre_front",n:"Barre au front",m:"triceps",eq:"barre",t:"i",lv:2,cue:"Coudes pointés vers le plafond, descends vers le front lentement."},
 {id:"ext_halt",n:"Extension nuque haltère",m:"triceps",eq:"haltere",t:"i",lv:1,cue:"Haltère tenu à deux mains derrière la tête, coudes serrés."},
 {id:"kickback",n:"Kickback haltère",m:"triceps",eq:"haltere",t:"i",lv:1,cue:"Buste penché, bras parallèle au sol, tends l'avant-bras vers l'arrière."},
 {id:"dips_banc",n:"Dips entre deux bancs",m:"triceps",eq:"pdc",t:"c",lv:1,cue:"Mains derrière toi sur un banc, descends jusqu'à 90° aux coudes."},
 {id:"pompes_serrees",n:"Pompes serrées",m:"triceps",eq:"pdc",t:"c",lv:1,cue:"Mains sous les épaules, coudes le long du corps."},
 {id:"tri_machine",n:"Dips machine",m:"triceps",eq:"machine",t:"c",lv:1,cue:"Pousse vers le bas en gardant le buste droit."},
 // Quadriceps
 {id:"squat",n:"Squat barre",m:"quadriceps",eq:"barre",t:"c",lv:2,cue:"Pieds largeur d'épaules, dos gainé, descends au moins à la parallèle."},
 {id:"goblet",n:"Goblet squat",m:"quadriceps",eq:"haltere",t:"c",lv:1,cue:"Haltère contre la poitrine, coudes entre les genoux en bas."},
 {id:"presse",n:"Presse à cuisses",m:"quadriceps",eq:"machine",t:"c",lv:1,cue:"Bas du dos collé, ne verrouille pas les genoux en haut."},
 {id:"fentes_halt",n:"Fentes haltères",m:"quadriceps",eq:"haltere",t:"c",lv:1,cue:"Grand pas, genou arrière proche du sol, buste droit."},
 {id:"bulgare",n:"Squat bulgare",m:"quadriceps",eq:"haltere",t:"c",lv:2,cue:"Pied arrière sur un banc, descends verticalement."},
 {id:"squat_pdc",n:"Squat au poids du corps",m:"quadriceps",eq:"pdc",t:"c",lv:1,cue:"Descends lentement, talons au sol, poitrine haute."},
 {id:"fentes_pdc",n:"Fentes marchées",m:"quadriceps",eq:"pdc",t:"c",lv:1,cue:"Alterne les jambes en avançant, genou arrière frôle le sol."},
 {id:"leg_ext",n:"Leg extension",m:"quadriceps",eq:"machine",t:"i",lv:1,cue:"Monte jusqu'à l'extension, marque une pause en haut."},
 // Ischios
 {id:"sdt_roumain",n:"Soulevé de terre roumain",m:"ischios",eq:"barre",t:"c",lv:2,cue:"Jambes quasi tendues, pousse les hanches en arrière, dos plat."},
 {id:"sdt_halt",n:"Soulevé de terre roumain haltères",m:"ischios",eq:"haltere",t:"c",lv:1,cue:"Haltères le long des cuisses, hanches en arrière, dos plat."},
 {id:"sdt",n:"Soulevé de terre",m:"ischios",eq:"barre",t:"c",lv:3,cue:"Barre contre les tibias, dos neutre, pousse le sol avec les jambes."},
 {id:"leg_curl",n:"Leg curl",m:"ischios",eq:"machine",t:"i",lv:1,cue:"Ramène les talons vers les fessiers, contrôle le retour."},
 {id:"good_morning_pdc",n:"Good morning unilatéral",m:"ischios",eq:"pdc",t:"i",lv:1,cue:"Sur une jambe, bascule le buste en avant dos plat, l'autre jambe tendue derrière."},
 // Fessiers
 {id:"hip_thrust",n:"Hip thrust barre",m:"fessiers",eq:"barre",t:"c",lv:1,cue:"Haut du dos sur un banc, pousse les hanches vers le plafond, serre en haut."},
 {id:"hip_thrust_halt",n:"Hip thrust haltère",m:"fessiers",eq:"haltere",t:"c",lv:1,cue:"Haltère sur les hanches, pousse et serre les fessiers en haut."},
 {id:"pont_fessier",n:"Pont fessier",m:"fessiers",eq:"pdc",t:"i",lv:1,cue:"Allongé, pieds au sol, monte les hanches et tiens 1 s."},
 {id:"abducteurs",n:"Machine abducteurs",m:"fessiers",eq:"machine",t:"i",lv:1,cue:"Ouvre les jambes en contrôlant, buste légèrement penché en avant."},
 {id:"kickback_poulie",n:"Kickback fessier poulie",m:"fessiers",eq:"poulie",t:"i",lv:1,cue:"Jambe tendue vers l'arrière, sans cambrer le dos."},
 // Mollets
 {id:"mollets_machine",n:"Mollets debout machine",m:"mollets",eq:"machine",t:"i",lv:1,cue:"Amplitude complète : étirement en bas, pointe de pied en haut."},
 {id:"mollets_halt",n:"Mollets haltère un pied",m:"mollets",eq:"haltere",t:"i",lv:1,cue:"Sur une marche, une main en appui, monte le plus haut possible."},
 {id:"mollets_pdc",n:"Élévations mollets",m:"mollets",eq:"pdc",t:"i",lv:1,cue:"Sur une marche, descends le talon puis monte lentement."},
 // Abdos
 {id:"planche",n:"Gainage planche",m:"abdos",eq:"pdc",t:"i",lv:1,cue:"Corps aligné, serre fessiers et abdos. Reps = secondes.",time:true},
 {id:"crunch_poulie",n:"Crunch poulie",m:"abdos",eq:"poulie",t:"i",lv:1,cue:"À genoux, enroule le buste vers le bas en contractant les abdos."},
 {id:"releve_jambes",n:"Relevé de jambes suspendu",m:"abdos",eq:"pdc",t:"i",lv:2,cue:"Suspendu à une barre, monte les genoux ou jambes sans balancer."},
 {id:"crunch",n:"Crunch",m:"abdos",eq:"pdc",t:"i",lv:1,cue:"Bas du dos au sol, enroule le haut du buste."},
 // Trapèzes
 {id:"shrug_barre",n:"Shrugs barre",m:"trap_sup",eq:"barre",t:"i",lv:1,cue:"Bras tendus, monte les épaules vers les oreilles, marque 1 s en haut. Ne roule pas les épaules."},
 {id:"shrug_halt",n:"Shrugs haltères",m:"trap_sup",eq:"haltere",t:"i",lv:1,cue:"Haltères le long du corps, hausse les épaules bien haut puis descends lentement."},
 {id:"shrug_machine",n:"Shrugs machine",m:"trap_sup",eq:"machine",t:"i",lv:1,cue:"Dos droit, hausse les épaules à la verticale sans plier les coudes."},
 {id:"farmer",n:"Marche du fermier",m:"trap_sup",eq:"haltere",t:"c",lv:1,time:true,cue:"Haltères lourds, épaules basses et gainage serré, marche à petits pas. Reps = secondes."},
 {id:"y_raise",n:"Y raise sur banc incliné",m:"trap_inf",eq:"haltere",t:"i",lv:1,cue:"Allongé ventre sur un banc incliné, monte les bras en Y, pouces vers le haut, omoplates serrées."},
 {id:"scap_pull",n:"Tractions scapulaires",m:"trap_inf",eq:"pdc",t:"i",lv:1,cue:"Suspendu bras tendus, abaisse et rapproche les omoplates pour monter de quelques cm, sans plier les coudes."},
 // Bas du dos
 {id:"hyperext",n:"Extensions lombaires (banc 45°)",m:"lombaires",eq:"pdc",t:"i",lv:1,cue:"Hanches calées sur le coussin, descends dos plat puis remonte jusqu'à l'alignement, sans te cambrer en haut."},
 {id:"good_morning",n:"Good morning barre",m:"lombaires",eq:"barre",t:"c",lv:2,cue:"Barre sur les trapèzes, genoux légèrement fléchis, bascule le buste dos plat en poussant les hanches en arrière. Charge légère."},
 {id:"superman",n:"Superman",m:"lombaires",eq:"pdc",t:"i",lv:1,cue:"Allongé sur le ventre, décolle bras et jambes ensemble, regard vers le sol, tiens 2 s en haut."},
 {id:"bird_dog",n:"Bird dog",m:"lombaires",eq:"pdc",t:"i",lv:1,cue:"À quatre pattes, tends le bras et la jambe opposés sans bouger le bassin, puis change de côté."},
 // Avant-bras
 {id:"wrist_curl",n:"Curl poignets haltères",m:"avb_flech",eq:"haltere",t:"i",lv:1,cue:"Avant-bras posés sur les cuisses, paumes vers le haut, enroule les poignets sur toute l'amplitude."},
 {id:"rev_wrist",n:"Extension poignets",m:"avb_ext",eq:"haltere",t:"i",lv:1,cue:"Avant-bras sur les cuisses, paumes vers le bas, relève le dos de la main, charge légère."},
 {id:"rev_curl",n:"Curl inversé barre",m:"avb_ext",eq:"barre",t:"i",lv:1,cue:"Prise en pronation (paumes vers le bas), coudes collés, monte la barre sans balancer."},
 {id:"wrist_poulie",n:"Curl poignets poulie",m:"avb_flech",eq:"poulie",t:"i",lv:1,cue:"Assis, avant-bras sur les cuisses, enroule les poignets contre la résistance du câble."},
 {id:"rev_wrist_poulie",n:"Extension poignets poulie",m:"avb_ext",eq:"poulie",t:"i",lv:1,cue:"Assis, avant-bras sur les cuisses, paumes vers le bas, relève le dos de la main contre le câble."},
 {id:"dead_hang",n:"Suspension à la barre",m:"avb_flech",eq:"pdc",t:"i",lv:1,time:true,cue:"Suspendu bras tendus, serre fort la barre, épaules actives. Reps = secondes."},
 // Épaules : compléments
 {id:"elev_front",n:"Élévations frontales haltères",m:"delt_ant",eq:"haltere",t:"i",lv:1,cue:"Bras presque tendus, monte jusqu'à hauteur des yeux sans balancer le buste."},
 {id:"elev_front_poulie",n:"Élévations frontales poulie",m:"delt_ant",eq:"poulie",t:"i",lv:1,cue:"Dos à la poulie basse, câble entre les jambes, monte la poignée devant toi jusqu'aux yeux."},
 {id:"elev_lat_machine",n:"Élévations latérales machine",m:"delt_lat",eq:"machine",t:"i",lv:1,cue:"Coudes contre les coussins, monte jusqu'à l'horizontale, descends lentement."},
 {id:"rear_delt_machine",n:"Pec deck inversé",m:"delt_post",eq:"machine",t:"i",lv:1,cue:"Face au dossier, bras presque tendus, ouvre vers l'arrière sans serrer les omoplates à fond."},
 {id:"prone_w",n:"W au sol",m:"delt_post",eq:"pdc",t:"i",lv:1,cue:"Allongé sur le ventre, coudes pliés en W, décolle bras et mains du sol en tournant les pouces vers le plafond."},
 // Trapèze moyen
 {id:"t_raise",n:"T raise sur banc incliné",m:"trap_moy",eq:"haltere",t:"i",lv:1,cue:"Ventre sur un banc incliné, ouvre les bras en T à l'horizontale, pouces vers le haut, serre les omoplates."},
 {id:"row_large",n:"Tirage horizontal prise large",m:"trap_moy",eq:"poulie",t:"c",lv:1,cue:"Barre large, tire vers le bas des pectoraux coudes écartés, serre les omoplates 1 s."},
 {id:"prone_t",n:"T au sol",m:"trap_moy",eq:"pdc",t:"i",lv:1,cue:"Allongé sur le ventre, bras en croix, décolle les bras en serrant les omoplates, tiens 2 s."},
 // Grand rond, petit rond
 {id:"pullover_halt",n:"Pull-over haltère",m:"grandrond",eq:"haltere",t:"i",lv:1,cue:"Allongé sur un banc, haltère tenu à deux mains, descends derrière la tête bras presque tendus puis ramène au-dessus de la poitrine."},
 {id:"rot_ext_poulie",n:"Rotation externe poulie",m:"petitrond",eq:"poulie",t:"i",lv:1,cue:"Coude collé au flanc plié à 90°, tourne l'avant-bras vers l'extérieur sans décoller le coude. Charge légère."},
 {id:"rot_ext_halt",n:"Rotation externe haltère",m:"petitrond",eq:"haltere",t:"i",lv:1,cue:"Allongé sur le côté, coude sur la hanche plié à 90°, monte l'haltère en tournant l'épaule. Charge légère."},
 // Obliques
 {id:"bucheron_poulie",n:"Bûcheron poulie",m:"obliques",eq:"poulie",t:"i",lv:1,cue:"Bras tendus, tire le câble en diagonale de haut en bas en tournant le buste, hanches stables."},
 {id:"flexion_lat_halt",n:"Flexion latérale haltère",m:"obliques",eq:"haltere",t:"i",lv:1,cue:"Haltère d'un côté, penche le buste sur le côté puis remonte en contractant le côté opposé."},
 {id:"russian_twist",n:"Russian twist",m:"obliques",eq:"pdc",t:"i",lv:1,cue:"Assis buste incliné en arrière, pieds décollés si possible, tourne les épaules d'un côté à l'autre."},
 {id:"gainage_lat",n:"Gainage latéral",m:"obliques",eq:"pdc",t:"i",lv:1,time:true,cue:"Sur l'avant-bras, coude sous l'épaule, corps aligné, hanches hautes. Reps = secondes par côté."},
 // Cardio (finisher)
 {id:"rameur_hiit",n:"Rameur (intervalles)",m:"cardio",eq:"machine",t:"i",lv:1,time:true,cue:"Alterne 30 s fort / 30 s calme. Pousse avec les jambes, puis tire avec le dos et les bras."},
 {id:"velo_hiit",n:"Vélo (intervalles)",m:"cardio",eq:"machine",t:"i",lv:1,time:true,cue:"Alterne 30 s à fond / 30 s tranquille, résistance assez élevée."},
 {id:"burpees",n:"Burpees",m:"cardio",eq:"pdc",t:"i",lv:1,time:true,cue:"Mains au sol, pieds en arrière, ramène les pieds puis saute bras en l'air. Garde un rythme régulier."},
 {id:"mountain",n:"Mountain climbers",m:"cardio",eq:"pdc",t:"i",lv:1,time:true,cue:"En position de pompe, ramène vite les genoux vers la poitrine en alternance, hanches basses."},
 {id:"ab_machine",n:"Crunch machine",m:"abdos",eq:"machine",t:"i",lv:1,cue:"Enroule le buste en expirant, contrôle le retour."},
];
// Charge de départ ≈ ratio × poids de corps (homme, niveau intermédiaire, ~8 reps). Haltères : par main.
const START = {dc_barre:.75,dc_halt:.25,di_halt:.22,di_barre:.6,pec_machine:.6,ecarte_halt:.12,pec_deck:.4,vis_a_vis:.15,
 rowing_barre:.6,rowing_halt:.3,tirage_vert:.6,tirage_horiz:.6,rowing_machine:.55,pullover_poulie:.25,
 dm_halt:.18,dm_barre:.45,ep_machine:.4,elev_lat:.08,elev_lat_poulie:.06,oiseau:.07,face_pull:.25,
 curl_halt:.14,curl_barre:.3,curl_marteau:.15,curl_poulie:.25,curl_machine:.25,
 ext_poulie:.3,barre_front:.3,ext_halt:.25,kickback:.08,tri_machine:.6,
 squat:1,goblet:.3,presse:1.8,fentes_halt:.2,bulgare:.15,leg_ext:.5,
 sdt_roumain:.8,sdt_halt:.3,sdt:1.2,leg_curl:.4,hip_thrust:1,hip_thrust_halt:.35,abducteurs:.5,kickback_poulie:.15,
 mollets_machine:1,mollets_halt:.2,crunch_poulie:.4,ab_machine:.4,
 shrug_barre:.8,shrug_halt:.3,shrug_machine:.8,farmer:.35,y_raise:.03,good_morning:.35,
 wrist_curl:.1,rev_wrist:.05,rev_curl:.25,wrist_poulie:.15,
 elev_front:.07,elev_front_poulie:.06,elev_lat_machine:.25,rear_delt_machine:.25,t_raise:.03,row_large:.45,
 pullover_halt:.15,rot_ext_poulie:.05,rot_ext_halt:.03,rev_wrist_poulie:.08,bucheron_poulie:.15,flexion_lat_halt:.25};
const LOWER = new Set(["quadriceps","ischios","fessiers","mollets"]);
const EXMAP = Object.fromEntries(EX.map(e=>[e.id,e]));
const MUSCLE_LABEL = {pectoraux:"Pectoraux",delt_ant:"Deltoïde antérieur",delt_lat:"Deltoïde latéral",delt_post:"Deltoïde postérieur",trap_sup:"Trapèze supérieur",trap_moy:"Trapèze moyen",trap_inf:"Trapèze inférieur",dos:"Grand dorsal",rhomboides:"Milieu du dos",grandrond:"Grand rond",petitrond:"Petit rond",lombaires:"Lombaires",biceps:"Biceps",triceps:"Triceps",avb_flech:"Avant-bras fléchisseurs",avb_ext:"Avant-bras extenseurs",abdos:"Abdos",obliques:"Obliques",quadriceps:"Quadriceps",ischios:"Ischios",fessiers:"Fessiers",mollets:"Mollets",cardio:"Cardio"};
// Précision affichée dans la liste des muscles
const MUSCLE_HINT = {rhomboides:"rhomboïdes",petitrond:"et infra-épineux",avb_flech:"face intérieure",avb_ext:"face extérieure",abdos:"grand droit"};
// Anciens noms (versions précédentes) -> nouveaux muscles
const OLD_M = {epaules:["delt_ant","delt_lat","delt_post"],trapezes:["trap_sup","trap_moy","trap_inf"],avantbras:["avb_flech","avb_ext"]};
function normMuscles(a){ if(!Array.isArray(a)) return a; const o=[]; for(const m of a) for(const x of (OLD_M[m]||[m])) if(!o.includes(x)) o.push(x); return o; }
function migrateMuscles(){ const p=state.profile; if(p) p.muscles=normMuscles(p.muscles); for(const x of state.sessions||[]) if(x.muscles) x.muscles=normMuscles(x.muscles); }
// Pas de charge réalistes en salle (± et progression)
const STEP = {barre:2.5,haltere:2,machine:5,poulie:2.5,pdc:2.5};
const EQ_LABEL = {barre:"Barre",haltere:"Haltères",machine:"Machine",poulie:"Poulie",pdc:"Poids du corps"};

/* ============ OPTIONS ============ */
const OPTS = {
  sexe:[["h","Homme"],["f","Femme"]],
  goal:[["hypertrophie","Prise de muscle"],["force","Force"],["seche","Perte de gras"],["endurance","Endurance"]],
  level:[["1","Débutant"],["2","Intermédiaire"],["3","Avancé"]],
  focus:[["auto","✨ Auto (muscles reposés)"],["full","Corps complet"],["haut","Haut du corps"],["bas","Bas du corps"],["push","Push (pecs/épaules/triceps)"],["pull","Pull (dos/biceps)"],["bras","Bras & épaules"]],
  equip:[["salle","Salle complète"],["machines","Machines & poulies"],["halteres","Haltères"],["pdc","Poids du corps"]],
  duration:[["30","30 min"],["45","45 min"],["60","1 h"],["75","1 h 15"],["90","1 h 30"]],
};
const EQUIP_ALLOW = {salle:["barre","haltere","machine","poulie","pdc"],machines:["machine","poulie","pdc"],halteres:["haltere","pdc"],pdc:["pdc"]};
const FOCUS_TITLE = {full:"Corps complet",haut:"Haut du corps",bas:"Bas du corps",push:"Push",pull:"Pull",bras:"Bras & épaules"};
// sets, reps [min,max], repos (s) — polyarticulaire / isolation
const GOAL_P = {
  force:      {c:{s:5,r:[3,5],rest:180},  i:{s:3,r:[8,10],rest:90}},
  hypertrophie:{c:{s:4,r:[6,10],rest:120},i:{s:3,r:[10,15],rest:75}},
  seche:      {c:{s:3,r:[10,12],rest:75}, i:{s:3,r:[12,15],rest:45}},
  endurance:  {c:{s:3,r:[12,15],rest:60}, i:{s:3,r:[15,20],rest:45}},
};

