const DB_NAME="meuTreinoDB", DB_VERSION=1, DATA_KEY="appState";
const REST_SECONDS=40;
const DEFAULTS={A:[
 {name:"Supino na máquina",sets:3,min:8,max:12,rest:REST_SECONDS,image:"images/exercises/supino-maquina.svg"},
 {name:"Puxada frontal",sets:3,min:8,max:12,rest:REST_SECONDS,image:"images/exercises/puxada-frontal.svg"},
 {name:"Remada sentada",sets:3,min:8,max:12,rest:REST_SECONDS,image:"images/exercises/remada-maquina.svg"},
 {name:"Desenvolvimento de ombros na máquina",sets:3,min:8,max:12,rest:REST_SECONDS,image:"images/exercises/desenvolvimento.svg"},
 {name:"Voador peitoral",sets:3,min:10,max:15,rest:REST_SECONDS,image:"images/exercises/supino-maquina.svg"},
 {name:"Rosca direta com halteres",sets:2,min:10,max:15,rest:REST_SECONDS,image:"images/exercises/rosca-biceps.svg"},
 {name:"Rosca martelo com halteres",sets:2,min:10,max:15,rest:REST_SECONDS,image:"images/exercises/rosca-biceps.svg"},
 {name:"Tríceps na polia com corda",sets:2,min:10,max:15,rest:REST_SECONDS,image:"images/exercises/triceps-maquina.svg"}
],B:[
 {name:"Leg Press",sets:4,min:8,max:12,rest:REST_SECONDS,image:"images/exercises/leg-press.svg"},
 {name:"Cadeira flexora",sets:3,min:10,max:15,rest:REST_SECONDS,image:"images/exercises/flexora.svg"},
 {name:"Cadeira extensora",sets:3,min:10,max:15,rest:REST_SECONDS,image:"images/exercises/extensora.svg"},
 {name:"Hip thrust / máquina de glúteos",sets:3,min:8,max:12,rest:REST_SECONDS,image:"images/exercises/leg-press.svg"},
 {name:"Cadeira abdutora",sets:2,min:12,max:15,rest:REST_SECONDS,image:"images/exercises/abdutora.svg"},
 {name:"Panturrilha na máquina ou no leg press",sets:3,min:10,max:15,rest:REST_SECONDS,image:"images/exercises/panturrilha.svg"},
 {name:"Abdominal na máquina OU Pallof Press",sets:2,min:10,max:15,rest:REST_SECONDS,image:"images/exercises/generico.svg"}
]};
let state={version:3,workout:"A",workouts:{A:[],B:[]},exercises:structuredClone(DEFAULTS),sessions:[],weights:[],photos:[],settings:{defaultRest:REST_SECONDS,soundEnabled:true,autoStartRest:true,theme:"auto"},nextWorkout:"A"};
let timer={remaining:REST_SECONDS,id:null,running:false};
let audioCtx=null, timerCycle=0, calendarDate=new Date(), modalOpen=false;

const $=id=>document.getElementById(id);
const uid=()=>crypto.randomUUID?.()||Date.now()+"-"+Math.random();
const fmtTime=s=>String(Math.floor(Math.max(0,s)/60)).padStart(2,"0")+":"+String(Math.max(0,s)%60).padStart(2,"0");
const today=()=>new Date().toISOString().slice(0,10);
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function dateBR(iso){return iso?new Date(iso+"T12:00:00").toLocaleDateString("pt-BR"):"—"}
function timeBR(iso){return iso?new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"—"}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains("kv"))r.result.createObjectStore("kv");if(!r.result.objectStoreNames.contains("photos"))r.result.createObjectStore("photos",{keyPath:"id"})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function dbGet(key){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction("kv","readonly").objectStore("kv").get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function dbSet(key,val){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction("kv","readwrite").objectStore("kv").put(val,key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
async function photoPut(p){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction("photos","readwrite").objectStore("photos").put(p);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
async function photoAll(){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction("photos","readonly").objectStore("photos").getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
async function photoDelete(id){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction("photos","readwrite").objectStore("photos").delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}

function sanitizeState(){
 state.settings=Object.assign({defaultRest:REST_SECONDS,soundEnabled:true,autoStartRest:true,theme:"auto"},state.settings||{});
 state.settings.defaultRest=REST_SECONDS;
 for(const workout of ["A","B"]){
  state.exercises[workout]=(state.exercises?.[workout]||[]).map(e=>({name:e.name,sets:e.sets,min:e.min,max:e.max,rest:REST_SECONDS,image:e.image||findImage(e.name)}));
 }
 for(const session of state.sessions||[]){
  session.sets=(session.sets||[]).map(x=>({exercise:x.exercise,set:x.set,weight:x.weight,reps:x.reps,rest:REST_SECONDS}));
 }
 state.workouts=state.workouts||{A:[],B:[]};
}
async function loadState(){
 const saved=await dbGet(DATA_KEY);
 if(saved){state=Object.assign(state,saved);sanitizeState();await dbSet(DATA_KEY,state);return}
 const old=localStorage.getItem("meuTreinoPWA");
 if(old){
  try{
   const o=JSON.parse(old);
   state.workout=o.workout||"A";
   state.exercises=structuredClone(DEFAULTS);
   state.sessions=[];
   if(o.logs?.length){state.sessions=[{id:uid(),start:o.logs[0].date,end:o.logs.at(-1).date,workout:o.workout,sets:o.logs.map(x=>({exercise:x.exercise,set:x.set,weight:x.weight,reps:x.reps,rest:REST_SECONDS})),cardio:null,notes:"",durationMin:0}]}
   sanitizeState();await dbSet(DATA_KEY,state);localStorage.removeItem("meuTreinoPWA");toast("Dados da versão anterior migrados.");
  }catch(e){console.warn(e)}
 }
}
function findImage(name){const map={"Supino máquina":"images/exercises/supino-maquina.svg","Puxada frontal":"images/exercises/puxada-frontal.svg","Remada máquina":"images/exercises/remada-maquina.svg","Desenvolvimento máquina":"images/exercises/desenvolvimento.svg","Rosca bíceps":"images/exercises/rosca-biceps.svg","Tríceps máquina":"images/exercises/triceps-maquina.svg","Leg press":"images/exercises/leg-press.svg","Cadeira extensora":"images/exercises/extensora.svg","Cadeira flexora":"images/exercises/flexora.svg","Cadeira abdutora":"images/exercises/abdutora.svg","Cadeira adutora":"images/exercises/adutora.svg","Panturrilha":"images/exercises/panturrilha.svg"};return map[name]||"images/exercises/generico.svg"}
async function save(){sanitizeState();state.version=3;await dbSet(DATA_KEY,state)}

function applyTheme(){const s=state.settings.theme;if(s==="dark"||(s==="auto"&&matchMedia("(prefers-color-scheme:dark)").matches))document.body.classList.add("dark");else document.body.classList.remove("dark")}
function showView(id){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$(id).classList.add("active");document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===id));if(id==="homeView")renderDashboard();if(id==="historyView")renderHistory();if(id==="weightView")renderWeight();if(id==="photosView")renderPhotos();if(id==="evolutionView")renderEvolution();if(id==="calendarView")renderCalendar();if(id==="settingsView")renderSettings();if(id==="workoutView")renderWorkout()}
function totals(){const sets=state.sessions.flatMap(s=>s.sets||[]);return{sessions:state.sessions.length,sets:sets.length,volume:sets.reduce((a,x)=>a+(+x.weight||0)*(+x.reps||0),0),muscleMin:state.sessions.reduce((a,s)=>a+(+s.durationMin||0),0),cardioMin:state.sessions.reduce((a,s)=>a+(+s.cardio?.time||0),0),km:state.sessions.reduce((a,s)=>a+(+s.cardio?.distance||0),0)}}

function renderDashboard(){const t=totals(), last=state.sessions.at(-1), w=state.weights.at(-1);$("dashboard").innerHTML=`
<div class="dashboard-card"><span class="muted">Próximo treino</span><b>${state.nextWorkout==="A"?"A — Superiores":"B — Inferiores"}</b></div>
<div class="dashboard-card"><span class="muted">Último treino</span><b>${last?last.workout+" — "+dateBR(last.start):"—"}</b></div>
<div class="dashboard-card"><span class="muted">Peso atual</span><b>${w?Number(w.weight).toFixed(1).replace(".",",")+" kg":"—"}</b></div>
<div class="dashboard-card"><span class="muted">Treinos</span><b>${t.sessions}</b></div>
<div class="dashboard-card"><span class="muted">Séries</span><b>${t.sets}</b></div>
<div class="dashboard-card"><span class="muted">Esteira/cardio</span><b>${t.km.toFixed(2).replace(".",",")} km</b></div>
<div class="dashboard-card"><span class="muted">Tempo treinando</span><b>${Math.floor(t.muscleMin/60)}h ${t.muscleMin%60}m</b></div>`}

function lastForExercise(name){const sets=state.sessions.flatMap(s=>(s.sets||[]).map(x=>({...x,date:s.start}))).filter(x=>x.exercise===name);return sets.at(-1)}
function exerciseSuggestion(e){const last=lastForExercise(e.name);if(!last)return"";return +last.reps>=+e.max?`Você atingiu ${e.max} reps. Considere avaliar uma progressão de carga.`:""}
function renderWorkout(){
 $("workoutTitle").textContent=state.workout==="A"?"A — Superiores":"B — Inferiores";
 $("tabA").classList.toggle("active",state.workout==="A");$("tabB").classList.toggle("active",state.workout==="B");
 const arr=state.exercises[state.workout];$("workoutExercises").innerHTML=arr.map((e,ei)=>{
  const last=lastForExercise(e.name), suggestion=exerciseSuggestion(e);
  let rows="";
  for(let s=0;s<e.sets;s++){const d=e.current?.[s]||{};rows+=`<div class="set-row" data-e="${ei}" data-s="${s}"><b>${s+1}</b><input class="weight" inputmode="decimal" placeholder="kg" value="${esc(d.weight??last?.weight??"")}"><input class="reps" inputmode="numeric" placeholder="reps" value="${esc(d.reps??"")}"><button class="done ${d.done?"completed":""}">${d.done?"✓":"✓"}</button></div>`}
  return `<article class="exercise"><div class="exercise-head"><div class="exercise-info"><img class="exercise-image" src="${e.image||findImage(e.name)}" alt="${esc(e.name)}"><div class="exercise-details"><div class="exercise-name"><strong>${esc(e.name)}</strong></div><div class="muted">${e.sets} séries · ${e.min}–${e.max} reps · descanso ${REST_SECONDS}s</div>${last?`<div class="last-load">Último treino: ${esc(last.weight)} kg × ${esc(last.reps)}</div>`:""}${suggestion?`<div class="suggestion">💡 ${suggestion}</div>`:""}</div></div><button class="edit-exercise" data-e="${ei}">Editar</button></div><div class="set-head"><span>#</span><span>Carga</span><span>Reps</span><span></span></div>${rows}</article>`}).join("");
 $("workoutExercises").querySelectorAll(".exercise-image").forEach(img=>img.onclick=()=>openImageModal(img.src,img.alt));
 $("workoutExercises").querySelectorAll(".edit-exercise").forEach(b=>b.onclick=()=>editExercise(+b.dataset.e));
 $("workoutExercises").querySelectorAll(".set-row").forEach(row=>bindSetRow(row));
 renderWorkoutSummary();
 loadCardioDraft();
}
function bindSetRow(row){
 const ei=+row.dataset.e,s=+row.dataset.s,e=state.exercises[state.workout][ei];
 const inputs=row.querySelectorAll("input");
 inputs.forEach((inp,i)=>inp.onchange=()=>{e.current=e.current||[];e.current[s]=e.current[s]||{};e.current[s][["weight","reps"][i]]=inp.value;save()});
 row.querySelector(".done").onclick=async()=>{const vals=[...inputs].map(x=>x.value);if(!vals[0]||!vals[1]){toast("Informe carga e repetições.");return}e.current=e.current||[];e.current[s]={weight:vals[0],reps:vals[1],done:true};await save();row.querySelector(".done").classList.add("completed");await initAudio();if(state.settings.autoStartRest)startTimer();toast("✓ Série registrada")};
}
function renderWorkoutSummary(){const sets=state.exercises[state.workout].reduce((a,e)=>a+(e.current||[]).filter(x=>x?.done).length,0);const vol=state.exercises[state.workout].reduce((a,e)=>a+(e.current||[]).reduce((b,x)=>b+(+x?.weight||0)*(+x?.reps||0),0),0);$("workoutSummary").innerHTML=`<div class="stat"><b>${sets}</b><div class="muted">séries concluídas</div></div><div class="stat"><b>${vol.toFixed(0)} kg</b><div class="muted">volume</div></div><div class="stat"><b>${state.exercises[state.workout].length}</b><div class="muted">exercícios</div></div>`}
function loadCardioDraft(){const c=state._cardio||{};["Type","Time","Distance","Calories","Speed","Notes"].forEach(x=>{const id="cardio"+x;const el=$(id);if(el)el.value=c[x.toLowerCase()]??""})}
function readCardio(){return{type:$("cardioType").value,time:+$("cardioTime").value||0,distance:+$("cardioDistance").value||0,calories:+$("cardioCalories").value||0,speed:+$("cardioSpeed").value||0,notes:$("cardioNotes").value}}

async function finishWorkout(){
 const now=new Date(), start=state._workoutStart||now.toISOString(), sets=[];
 state.exercises[state.workout].forEach(e=>(e.current||[]).forEach((x,i)=>{if(x?.done)sets.push({exercise:e.name,set:i+1,weight:x.weight,reps:x.reps,rest:REST_SECONDS})}));
 if(!sets.length){toast("Conclua pelo menos uma série.");return}
 const durationMin=Math.max(1,Math.round((now-new Date(start))/60000));
 state.sessions.push({id:uid(),start,end:now.toISOString(),workout:state.workout,sets,cardio:readCardio(),notes:$("workoutNotes").value,durationMin});
 state.exercises[state.workout].forEach(e=>delete e.current);
 state.nextWorkout=state.workout==="A"?"B":"A";delete state._workoutStart;state._cardio=null;await save();toast("Treino salvo no histórico.");showView("historyView")
}

function renderHistory(){
 const list=$("historyList");if(!state.sessions.length){list.innerHTML='<div class="card muted">Nenhum treino salvo ainda.</div>'}else list.innerHTML=[...state.sessions].reverse().map(s=>`<article class="history-item"><div class="history-main"><div><strong>Treino ${s.workout}</strong><div class="muted">${dateBR(s.start)} · ${timeBR(s.start)}</div></div><div><strong>${s.durationMin||0} min</strong><div class="muted">${s.sets.length} séries</div></div></div><div class="muted">${s.cardio?.type||"Sem cardio"} · ${s.cardio?.time||0} min · ${s.cardio?.distance||0} km</div><div class="history-details">${s.sets.map(x=>`<div>${esc(x.exercise)} — ${esc(x.weight)} kg × ${esc(x.reps)}</div>`).join("")}${s.notes?`<p><b>Obs.:</b> ${esc(s.notes)}</p>`:""}<button class="danger delete-session" data-id="${s.id}">Excluir</button></div></article>`).join("");
 list.querySelectorAll(".history-item").forEach(x=>x.onclick=e=>{if(e.target.classList.contains("delete-session"))return;x.classList.toggle("open")});
 list.querySelectorAll(".delete-session").forEach(b=>b.onclick=async e=>{e.stopPropagation();if(confirm("Excluir este treino?")){state.sessions=state.sessions.filter(s=>s.id!==b.dataset.id);await save();renderHistory()}});
 const names=[...new Set(state.sessions.flatMap(s=>s.sets.map(x=>x.exercise)))];$("exerciseHistorySelect").innerHTML=names.length?names.map(n=>`<option>${esc(n)}</option>`).join(""):"<option>Nenhum exercício</option>";renderExerciseHistory()
}
function renderExerciseHistory(){const n=$("exerciseHistorySelect").value;const sets=state.sessions.flatMap(s=>s.sets.map(x=>({...x,date:s.start}))).filter(x=>x.exercise===n);$("exerciseHistory").innerHTML=sets.length?`<div class="card">${sets.map(x=>`<div><strong>${dateBR(x.date)}</strong> — ${x.weight} kg × ${x.reps}</div>`).join("")}</div>`:'<div class="card muted">Sem registros.</div>'}

function renderWeight(){const a=state.weights;if(!a.length){$("weightStats").innerHTML='<div class="stat"><b>—</b><div class="muted">Peso inicial</div></div>'.repeat(4)}else{const vals=a.map(x=>+x.weight),initial=vals[0],current=vals.at(-1),max=Math.max(...vals),min=Math.min(...vals),diff=current-initial,pct=initial?diff/initial*100:0;$("weightStats").innerHTML=`<div class="stat"><b>${initial.toFixed(1)} kg</b><div class="muted">Inicial</div></div><div class="stat"><b>${current.toFixed(1)} kg</b><div class="muted">Atual</div></div><div class="stat"><b>${max.toFixed(1)} kg</b><div class="muted">Maior</div></div><div class="stat"><b>${min.toFixed(1)} kg</b><div class="muted">Menor</div></div><div class="stat"><b>${diff.toFixed(1)} kg</b><div class="muted">Diferença</div></div><div class="stat"><b>${pct.toFixed(1)}%</b><div class="muted">Variação</div></div>`}
 $("weightList").innerHTML=[...a].reverse().map(w=>`<div class="history-item"><strong>${Number(w.weight).toFixed(1)} kg</strong> · ${dateBR(w.date)} · ${w.time||""}<div class="muted">${esc(w.notes||"")}</div></div>`).join("");drawChart($("weightChart"),a.map(x=>({label:dateBR(x.date),value:+x.weight})))}
async function addWeight(){const w=+$("weightInput").value;if(!w)return toast("Informe o peso.");state.weights.push({id:uid(),date:$("weightDate").value||today(),time:$("weightTime").value||new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),weight:w,notes:$("weightNotes").value});state.weights.sort((a,b)=>a.date.localeCompare(b.date));await save();$("weightInput").value="";$("weightNotes").value="";renderWeight();toast("Peso salvo.")}

function drawChart(canvas,data){if(!canvas)return;const c=canvas.getContext("2d"),dpr=devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;c.width=w*dpr;c.height=h*dpr;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);if(!data.length){c.fillStyle="#6b7280";c.fillText("Sem dados",15,30);return}const pad=28, vals=data.map(x=>x.value),min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;c.strokeStyle=getComputedStyle(document.body).getPropertyValue("--border");c.beginPath();c.moveTo(pad,10);c.lineTo(pad,h-pad);c.lineTo(w-10,h-pad);c.stroke();c.strokeStyle="#4f46e5";c.lineWidth=3;c.beginPath();data.forEach((x,i)=>{const px=pad+(w-pad-15)*(i/Math.max(1,data.length-1)),py=10+(max-x.value)/range*(h-pad-20);i?c.lineTo(px,py):c.moveTo(px,py)});c.stroke();c.fillStyle=getComputedStyle(document.body).getPropertyValue("--text");data.forEach((x,i)=>{const px=pad+(w-pad-15)*(i/Math.max(1,data.length-1)),py=10+(max-x.value)/range*(h-pad-20);c.beginPath();c.arc(px,py,4,0,Math.PI*2);c.fill();if(i===data.length-1)c.fillText(String(x.value),px-10,py-10)})}

function renderPhotos(){const photos=state.photos; $("photoGallery").innerHTML=photos.length?photos.map(p=>`<div class="photo-tile"><img src="${p.data}" alt="${esc(p.type)}"><div class="photo-caption">${dateBR(p.date)} · ${esc(p.type)}</div><button class="danger delete-photo" data-id="${p.id}">Excluir</button></div>`).join(""):'<div class="card muted">Nenhuma foto registrada.</div>';$("photoGallery").querySelectorAll("img").forEach(i=>i.onclick=()=>openImageModal(i.src,i.alt));$("photoGallery").querySelectorAll(".delete-photo").forEach(b=>b.onclick=async()=>{if(confirm("Excluir foto?")){await photoDelete(b.dataset.id);state.photos=state.photos.filter(x=>x.id!==b.dataset.id);await save();renderPhotos()}});const opts=photos.map(p=>`<option value="${p.id}">${dateBR(p.date)} — ${p.type}</option>`).join("");$("comparePhotoA").innerHTML=opts;$("comparePhotoB").innerHTML=opts;renderCompare()}
function renderCompare(){const a=state.photos.find(p=>p.id===$("comparePhotoA").value),b=state.photos.find(p=>p.id===$("comparePhotoB").value);$("photoCompare").innerHTML=(a||b)?`${a?`<div><div class="muted">${dateBR(a.date)}</div><img src="${a.data}"></div>`:""}${b?`<div><div class="muted">${dateBR(b.date)}</div><img src="${b.data}"></div>`:""}`:""}

function renderEvolution(){const t=totals();const a=state.sessions.filter(s=>s.workout==="A").length,b=state.sessions.filter(s=>s.workout==="B").length;$("evolutionStats").innerHTML=`<div class="stat"><b>${t.sessions}</b><div class="muted">Treinos</div></div><div class="stat"><b>${a}</b><div class="muted">Treinos A</div></div><div class="stat"><b>${b}</b><div class="muted">Treinos B</div></div><div class="stat"><b>${t.sets}</b><div class="muted">Séries</div></div><div class="stat"><b>${t.muscleMin} min</b><div class="muted">Musculação</div></div><div class="stat"><b>${t.cardioMin} min</b><div class="muted">Cardio</div></div><div class="stat"><b>${t.km.toFixed(1)} km</b><div class="muted">Distância</div></div><div class="stat"><b>${t.volume.toFixed(0)} kg</b><div class="muted">Volume</div></div>`;drawChart($("evolutionWeightChart"),state.weights.map(x=>({label:x.date,value:+x.weight})));drawChart($("volumeChart"),state.sessions.map(s=>({label:dateBR(s.start),value:s.sets.reduce((a,x)=>a+(+x.weight||0)*(+x.reps||0),0)})));const names=[...new Set(state.sessions.flatMap(s=>s.sets.map(x=>x.exercise)))];$("exerciseProgress").innerHTML=`<div class="section-title">Progressão de carga</div>`+(names.length?names.map(n=>{const ss=state.sessions.flatMap(s=>s.sets.filter(x=>x.exercise===n).map(x=>({...x,date:s.start})));const max=Math.max(...ss.map(x=>+x.weight||0));return `<div class="history-item"><strong>${esc(n)}</strong><div class="muted">Maior carga registrada: ${max} kg · ${ss.length} séries</div></div>`}).join(""):"<div class='muted'>Sem dados suficientes.</div>")}

function renderCalendar(){const y=calendarDate.getFullYear(),m=calendarDate.getMonth();$("calendarMonth").textContent=new Date(y,m,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();let html=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(x=>`<div class="head">${x}</div>`).join("");for(let i=0;i<first;i++)html+="<div></div>";for(let d=1;d<=days;d++){const iso=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,s=state.sessions.filter(x=>x.start.slice(0,10)===iso);html+=`<div class="${s.length?"trained":""}" data-date="${iso}">${d}${s.length?`<br>✓ ${s.map(x=>x.workout).join("/")}`:""}</div>`}$("calendarGrid").innerHTML=html;$("calendarGrid").querySelectorAll("[data-date]").forEach(x=>x.onclick=()=>{$("calendarDetails").innerHTML=state.sessions.filter(s=>s.start.slice(0,10)===x.dataset.date).map(s=>`<div class="card"><strong>Treino ${s.workout}</strong><div>${dateBR(s.start)} · ${s.durationMin} min · ${s.sets.length} séries</div></div>`).join("")||"<div class='card muted'>Nenhum treino.</div>"})}

function renderSettings(){$("defaultRest").value=REST_SECONDS;$("soundEnabled").checked=state.settings.soundEnabled;$("autoStartRest").checked=state.settings.autoStartRest;$("themeSelect").value=state.settings.theme}
function editExercise(i){const e=state.exercises[state.workout][i],name=prompt("Nome do exercício:",e.name);if(name===null)return;const sets=+prompt("Séries:",e.sets),min=+prompt("Repetições mínimas:",e.min),max=+prompt("Repetições máximas:",e.max);if(!name||[sets,min,max].some(x=>!Number.isFinite(x)||x<1))return;e.name=name;e.sets=sets;e.min=min;e.max=max;e.rest=REST_SECONDS;e.image=e.image||findImage(name);e.current=[];save();renderWorkout()}
async function addExercise(){const name=prompt("Nome do exercício:");if(!name)return;const sets=+prompt("Séries:","3")||3,min=+prompt("Repetições mínimas:","10")||10,max=+prompt("Repetições máximas:","12")||12;state.exercises[state.workout].push({name,sets,min,max,rest:REST_SECONDS,image:findImage(name)});await save();renderWorkout()}

async function initAudio(){if(!state.settings.soundEnabled)return false;try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")await audioCtx.resume();return audioCtx.state==="running"}catch(e){console.warn("AudioContext:",e);return false}}
function beep(cycle=timerCycle){
 if(cycle!==timerCycle||!state.settings.soundEnabled||!audioCtx||audioCtx.state!=="running")return;
 const now=audioCtx.currentTime;
 [[0,660],[.18,880]].forEach(([o,f])=>{const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.frequency.value=f;osc.type="sine";g.gain.setValueAtTime(.0001,now+o);g.gain.exponentialRampToValueAtTime(.18,now+o+.02);g.gain.exponentialRampToValueAtTime(.0001,now+o+.18);osc.connect(g).connect(audioCtx.destination);osc.start(now+o);osc.stop(now+o+.2)});
}
function timerRender(){$("time").textContent=fmtTime(timer.remaining);$("timerState").textContent=timer.running?"Descansando…":timer.remaining===0?"Descanso concluído":"Pronto"}
async function startTimer(sec=REST_SECONDS){
 await initAudio();
 clearInterval(timer.id);
 timerCycle++;
 const cycle=timerCycle;
 timer.remaining=Math.max(1,Number(sec)||REST_SECONDS);
 timer.running=true;
 timerRender();
 timer.id=setInterval(()=>{
  if(!timer.running)return;
  timer.remaining--;
  if(timer.remaining<=0){
   clearInterval(timer.id);timer.id=null;timer.running=false;timer.remaining=0;timerRender();
   beep(cycle);
   if(navigator.vibrate)navigator.vibrate([200,100,200]);
   toast("🔊 Descanso finalizado");
  }else timerRender();
 },1000);
}
function pauseTimer(){clearInterval(timer.id);timer.id=null;timer.running=false;timerCycle++;timerRender()}
function resetTimer(){pauseTimer();timer.remaining=REST_SECONDS;timerRender()}

function ensureImageModal(){
 if($("exerciseImageModal"))return;
 const style=document.createElement("style");style.id="exercise-image-modal-style";style.textContent=`
#exerciseImageModal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:env(safe-area-inset-top) 16px env(safe-area-inset-bottom);background:rgba(0,0,0,.88);overscroll-behavior:contain}
#exerciseImageModal.open{display:flex}
#exerciseImageModal .image-modal-content{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:100%;touch-action:none}
#exerciseImageModal img{display:block;max-width:100%;max-height:calc(100vh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));width:auto;height:auto;object-fit:contain;border-radius:12px}
#exerciseImageModal .image-modal-close{position:absolute;top:max(12px,env(safe-area-inset-top));right:8px;width:52px;height:52px;border:0;border-radius:50%;font-size:32px;line-height:1;background:rgba(0,0,0,.72);color:#fff;z-index:2;cursor:pointer}
body.image-modal-open{overflow:hidden}
`;
 document.head.appendChild(style);
 const modal=document.createElement("div");modal.id="exerciseImageModal";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.innerHTML=`<div class="image-modal-content"><button class="image-modal-close" type="button" aria-label="Fechar imagem">×</button><img alt=""></div>`;
 document.body.appendChild(modal);
 modal.querySelector(".image-modal-close").onclick=closeImageModal;
 modal.addEventListener("click",e=>{if(e.target===modal||e.target.classList.contains("image-modal-content"))closeImageModal()});
}
function openImageModal(src,alt=""){
 ensureImageModal();const modal=$("exerciseImageModal"),img=modal.querySelector("img");img.src=src;img.alt=alt;modal.classList.add("open");document.body.classList.add("image-modal-open");modalOpen=true;history.pushState({exerciseImageModal:true},"");}
function closeImageModal(){
 const modal=$("exerciseImageModal");if(!modal)return;
 modal.classList.remove("open");document.body.classList.remove("image-modal-open");modal.querySelector("img").removeAttribute("src");modalOpen=false;
 if(history.state?.exerciseImageModal)history.back();
}
window.addEventListener("popstate",()=>{if(modalOpen){const modal=$("exerciseImageModal");modal?.classList.remove("open");document.body.classList.remove("image-modal-open");if(modal)modal.querySelector("img").removeAttribute("src");modalOpen=false}});

async function exportBackup(){
 sanitizeState();
 const payload={format:"meu-treino-backup",version:3,exportedAt:new Date().toISOString(),state,photos:state.photos};
 const blob=new Blob([JSON.stringify(payload)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`meu-treino-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("Backup exportado.")
}
async function importBackupFile(file){try{const data=JSON.parse(await file.text());if(data.format!=="meu-treino-backup")throw Error("Formato inválido");if(!confirm("Importar este backup substituirá os dados atuais. Continuar?"))return;state=Object.assign(state,data.state);state.photos=data.photos||[];sanitizeState();for(const p of state.photos)await photoPut(p);await save();applyTheme();renderDashboard();toast("Backup restaurado.")}catch(e){toast("Não foi possível importar o backup.")}}

function setDefaults(){const d=new Date();$("weightDate").value=today();$("weightTime").value=d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});$("photoDate").value=today()}
async function startWorkout(){state._workoutStart=new Date().toISOString();await save();showView("workoutView");await initAudio();toast(`Treino ${state.workout} iniciado.`)}

async function init(){
 await loadState();state.photos=await photoAll();applyTheme();setDefaults();timer.remaining=REST_SECONDS;timerRender();renderDashboard();ensureImageModal();
 document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
 $("startWorkoutBtn").onclick=startWorkout;$("finishWorkoutBtn").onclick=finishWorkout;
 $("tabA").onclick=async()=>{state.workout="A";await save();renderWorkout()};$("tabB").onclick=async()=>{state.workout="B";await save();renderWorkout()};
 $("startTimer").onclick=()=>startTimer();$("pauseTimer").onclick=pauseTimer;$("resumeTimer").onclick=()=>{if(timer.remaining>0&&!timer.running)startTimer(timer.remaining)};$("resetTimer").onclick=resetTimer;$("plus10").onclick=()=>{timer.remaining+=10;timerRender()};$("plus30").onclick=()=>{timer.remaining+=30;timerRender()};
 $("settingsBtn").onclick=()=>showView("settingsView");
 $("exerciseHistorySelect").onchange=renderExerciseHistory;$("addWeightBtn").onclick=addWeight;$("addPhotoBtn").onclick=async()=>{const f=$("photoFile").files[0];if(!f)return toast("Selecione uma foto.");const data=await fileToDataURL(f);const p={id:uid(),date:$("photoDate").value||today(),type:$("photoType").value,notes:$("photoNotes").value,data};await photoPut(p);state.photos.push(p);state.photos.sort((a,b)=>a.date.localeCompare(b.date));await save();$("photoFile").value="";renderPhotos();toast("Foto salva localmente.")};
 $("comparePhotoA").onchange=renderCompare;$("comparePhotoB").onchange=renderCompare;
 $("prevMonth").onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar()};$("nextMonth").onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar()};
 $("defaultRest").onchange=async e=>{state.settings.defaultRest=REST_SECONDS;timer.remaining=REST_SECONDS;timerRender();await save()};$("soundEnabled").onchange=async e=>{state.settings.soundEnabled=e.target.checked;if(e.target.checked)await initAudio();await save()};$("autoStartRest").onchange=async e=>{state.settings.autoStartRest=e.target.checked;await save()};$("themeSelect").onchange=async e=>{state.settings.theme=e.target.value;applyTheme();await save()};
 $("exportBackup").onclick=exportBackup;$("importBackup").onclick=()=>$("backupFile").click();$("backupFile").onchange=e=>e.target.files[0]&&importBackupFile(e.target.files[0]);$("addExerciseBtn").onclick=addExercise;
 $("resetAllBtn").onclick=async()=>{if(confirm("Apagar todos os dados locais, incluindo fotos?")){indexedDB.deleteDatabase(DB_NAME);localStorage.removeItem("meuTreinoPWA");location.reload()}};
 $("installBox").style.display=/iPhone|iPad|iPod/i.test(navigator.userAgent)&&!window.navigator.standalone?"block":"none";
 navigator.serviceWorker?.register("./sw.js").catch(console.warn);
}
function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
window.addEventListener("DOMContentLoaded",init);
