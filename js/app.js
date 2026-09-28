const DB_NAME="meuTreinoDB", DB_VERSION=3, DATA_KEY="appState", OUTBOX_KEY="outbox";
const REST_SECONDS=40;
const APP_VERSION=10;
const PLACEHOLDER_EXERCISE_IMAGE="data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><rect width="800" height="450" fill="#111827"/><g fill="white"><circle cx="280" cy="225" r="54"/><circle cx="520" cy="225" r="54"/><rect x="325" y="210" width="150" height="30" rx="15"/></g><text x="400" y="335" fill="#9ca3af" font-family="Arial" font-size="26" text-anchor="middle">Imagem do exercício</text></svg>`);
const EXERCISE_GROUPS=["Peito","Costas","Ombros","Bíceps","Tríceps","Quadríceps","Posterior de coxa","Glúteos","Adutores","Panturrilhas","Abdômen","Corpo inteiro"];
const DEFAULTS={A:[
{name:"Supino na máquina",group:"Peito",muscles:"Peitoral, tríceps, deltoide anterior",equipment:"Máquinas",sets:3,min:8,max:12,rir:2,rest:40},
{name:"Puxada frontal",group:"Costas",muscles:"Dorsais, bíceps",equipment:"Máquinas",sets:3,min:8,max:12,rir:2,rest:40},
{name:"Remada sentada",group:"Costas",muscles:"Dorsais, romboides, bíceps",equipment:"Máquinas",sets:3,min:8,max:12,rir:2,rest:40},
{name:"Desenvolvimento de ombros na máquina",group:"Ombros",muscles:"Deltoides, tríceps",equipment:"Máquinas",sets:3,min:8,max:12,rir:2,rest:40},
{name:"Voador peitoral",group:"Peito",muscles:"Peitoral",equipment:"Máquinas",sets:3,min:10,max:15,rir:2,rest:40},
{name:"Rosca direta com halteres",group:"Bíceps",muscles:"Bíceps",equipment:"Halteres",sets:2,min:10,max:15,rir:2,rest:40},
{name:"Rosca martelo com halteres",group:"Bíceps",muscles:"Bíceps, braquial",equipment:"Halteres",sets:2,min:10,max:15,rir:2,rest:40},
{name:"Tríceps na polia com corda",group:"Tríceps",muscles:"Tríceps",equipment:"Polias",sets:2,min:10,max:15,rir:2,rest:40}
],B:[
{name:"Leg Press",group:"Quadríceps",muscles:"Quadríceps, glúteos",equipment:"Máquinas",sets:4,min:8,max:12,rir:2,rest:40},
{name:"Cadeira flexora",group:"Posterior de coxa",muscles:"Isquiotibiais",equipment:"Máquinas",sets:3,min:10,max:15,rir:2,rest:40},
{name:"Cadeira extensora",group:"Quadríceps",muscles:"Quadríceps",equipment:"Máquinas",sets:3,min:10,max:15,rir:2,rest:40},
{name:"Hip thrust / máquina de glúteos",group:"Glúteos",muscles:"Glúteos, posterior",equipment:"Máquinas",sets:3,min:8,max:12,rir:2,rest:40},
{name:"Cadeira abdutora",group:"Glúteos",muscles:"Glúteos médio e mínimo",equipment:"Máquinas",sets:2,min:12,max:15,rir:2,rest:40},
{name:"Panturrilha na máquina ou no leg press",group:"Panturrilhas",muscles:"Gastrocnêmio, sóleo",equipment:"Máquinas",sets:3,min:10,max:15,rir:2,rest:40},
{name:"Abdominal na máquina OU Pallof Press",group:"Abdômen",muscles:"Core",equipment:"Máquinas",sets:2,min:10,max:15,rir:2,rest:40}
]};
let state={version:APP_VERSION,workout:"A",workouts:{A:[],B:[]},exercises:structuredClone(DEFAULTS),exerciseBank:[],sessions:[],weights:[],photos:[],profile:{height:null,name:""},settings:{defaultRest:40,soundEnabled:true,autoStartRest:true,theme:"auto",rememberAccount:true},nextWorkout:"A",trash:[],audit:[],ai:[]};
let timer={remaining:40,id:null,running:false}, audioCtx=null,timerCycle=0,calendarDate=new Date(), currentUser=null, online=navigator.onLine;
let backendStatus={exerciseBank:"unknown",ai:"unknown",youtube:"unknown"};
const $=id=>document.getElementById(id);
const uid=()=>crypto.randomUUID?.()||Date.now()+"-"+Math.random();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const fmtTime=s=>String(Math.floor(Math.max(0,s)/60)).padStart(2,"0")+":"+String(Math.max(0,s)%60).padStart(2,"0");
const dateBR=iso=>iso?new Date(iso+"T12:00:00").toLocaleDateString("pt-BR"):"—";
const timeBR=iso=>iso?new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"—";
const getRestSeconds=()=>{const n=Number(state.settings?.defaultRest);return Number.isFinite(n)&&n>=5&&n<=600?Math.round(n):40};
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)}
function modal(title,body,buttons=""){const root=$("modalRoot");root.innerHTML=`<div class="modal-backdrop"><div class="modal"><button class="modal-close" onclick="closeModal()">×</button><h2>${title}</h2>${body}${buttons}</div></div>`}
function closeModal(){$("modalRoot").innerHTML=""}
window.closeModal=closeModal;

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains("kv"))db.createObjectStore("kv");if(!db.objectStoreNames.contains("photos"))db.createObjectStore("photos",{keyPath:"id"})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function dbGet(key){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction("kv","readonly").objectStore("kv").get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function dbSet(key,val){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction("kv","readwrite").objectStore("kv").put(val,key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
async function photoPut(p){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction("photos","readwrite").objectStore("photos").put(p);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
async function photoAll(){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction("photos","readonly").objectStore("photos").getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
async function photoDelete(id){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction("photos","readwrite").objectStore("photos").delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}


function normalizeExerciseRow(e){
  return {
    id:e.id||uid(), name:e.name, slug:e.slug||slugify(e.name), group:e.group_name||e.group||"Corpo inteiro",
    muscles:e.muscles||"", secondary_muscles:e.secondary_muscles||"", movement_type:e.movement_type||"",
    equipment:e.equipment||"", difficulty:e.difficulty||"Iniciante", exercise_type:e.exercise_type||"Musculação",
    description:e.description||"", instructions:e.instructions||"", image_url:e.image_url||"",
    video_url:e.video_url||"", active:e.active!==false, sets:Number(e.sets)||3, min:Number(e.min_reps??e.min)||8,
    max:Number(e.max_reps??e.max)||12, rir:Number.isFinite(Number(e.rir))?Number(e.rir):2,
    rest:Number(e.rest_seconds??e.rest)||getRestSeconds(), custom:!e.is_official && !!e.user_id, is_official:!!e.is_official
  };
}
function slugify(v){return String(v||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function exerciseImage(e){return e.image_url||e.imageUrl||PLACEHOLDER_EXERCISE_IMAGE;}
function localExerciseBank(){return allExercises().map(normalizeExerciseRow);}
async function loadExerciseBank(){
  if(!sb){backendStatus.exerciseBank="local";state.exerciseBank=localExerciseBank();return state.exerciseBank}
  try{
    const [officialRes,customRes]=await Promise.all([
      sb.from("exercises").select("*").eq("is_official",true).eq("active",true).order("group_name").order("name"),
      currentUser?sb.from("exercises").select("*").eq("user_id",currentUser.id).eq("active",true).order("name"):Promise.resolve({data:[],error:null})
    ]);
    if(officialRes.error)throw officialRes.error;
    if(customRes.error)throw customRes.error;
    state.exerciseBank=[...(officialRes.data||[]),...(customRes.data||[])].map(normalizeExerciseRow);
    backendStatus.exerciseBank=state.exerciseBank.length?"ok":"empty";
    await dbSet(DATA_KEY,state);
    return state.exerciseBank;
  }catch(e){
    backendStatus.exerciseBank="error";
    console.error("Banco remoto indisponível:",e);
    state.exerciseBank=state.exerciseBank.length?state.exerciseBank:localExerciseBank();
    return state.exerciseBank;
  }
}
async function fetchGeneratorPool(){
  if(!sb||!currentUser||!online)return state.exerciseBank.length?state.exerciseBank:localExerciseBank();
  const [officialRes,customRes]=await Promise.all([
    sb.from("exercises").select("*").eq("is_official",true).eq("active",true),
    sb.from("exercises").select("*").eq("user_id",currentUser.id).eq("active",true)
  ]);
  if(officialRes.error)throw officialRes.error;
  if(customRes.error)throw customRes.error;
  const bank=[...(officialRes.data||[]),...(customRes.data||[])].map(normalizeExerciseRow);
  state.exerciseBank=bank;
  backendStatus.exerciseBank=bank.length?"ok":"empty";
  await dbSet(DATA_KEY,state);
  return bank;
}
async function insertCustomExerciseToSupabase(e){
  if(!sb||!currentUser)return e;
  const payload={id:e.id,name:e.name,slug:slugify(e.name),description:e.description||null,group_name:e.group,muscles:e.muscles||null,secondary_muscles:e.secondary_muscles||null,movement_type:e.movement_type||null,equipment:e.equipment||null,difficulty:e.difficulty||"Iniciante",exercise_type:e.exercise_type||"Musculação",instructions:e.instructions||null,image_url:e.image_url||null,video_url:e.video_url||null,active:true,user_id:currentUser.id};
  const {data,error}=await sb.from("exercises").insert(payload).select("*").single();
  if(error)throw error;
  return normalizeExerciseRow(data);
}
function selectedLabels(id){return selectedValues(id);}
function setSelectValue(id,value){
  const el=$(id); if(!el)return;
  if(el.multiple){const vals=new Set(Array.isArray(value)?value:[]);[...el.options].forEach(o=>o.selected=vals.has(o.value))}
  else el.value=value;
}
function renderChoiceChips(){
  ["smartGroups","smartGoal","smartTime","smartEquipment","smartLevel"].forEach(id=>{
    const select=$(id),wrap=document.querySelector(`[data-choice-container="${id}"]`); if(!select||!wrap)return;
    wrap.innerHTML=[...select.options].map(o=>`<button type="button" class="choice-chip ${o.selected?"selected":""}" data-choice="${esc(o.value)}">${esc(o.textContent)}</button>`).join("");
    wrap.querySelectorAll("[data-choice]").forEach(btn=>btn.onclick=()=>{
      const val=btn.dataset.choice;
      if(select.multiple){
        const opt=[...select.options].find(o=>o.value===val); if(opt)opt.selected=!opt.selected;
      }else select.value=val;
      btn.classList.toggle("selected",select.multiple?[...select.selectedOptions].some(o=>o.value===val):select.value===val);
      if(id==="smartTime")$("smartCustomTimeWrap").classList.toggle("hidden",select.value!=="custom");
    });
  });
}
function setSmartStatus(msg,type=""){
  const el=$("smartStatus");el.textContent=msg;el.classList.toggle("hidden",!msg);el.classList.toggle("error",type==="error");
}
function clearSmartStatus(){setSmartStatus("")}
function sanitizeState(){
 state.settings=Object.assign({defaultRest:40,soundEnabled:true,autoStartRest:true,theme:"auto",rememberAccount:true},state.settings||{});
 const r=Number(state.settings.defaultRest);state.settings.defaultRest=Number.isFinite(r)&&r>=5&&r<=600?Math.round(r):40;
 state.profile=Object.assign({height:null,name:""},state.profile||{});
 state.sessions=Array.isArray(state.sessions)?state.sessions:[];
 state.weights=Array.isArray(state.weights)?state.weights:[];
 state.photos=Array.isArray(state.photos)?state.photos:[];
 state.trash=Array.isArray(state.trash)?state.trash:[];state.audit=Array.isArray(state.audit)?state.audit:[];state.ai=Array.isArray(state.ai)?state.ai:[];
 state.exercises=state.exercises||structuredClone(DEFAULTS); state.exerciseBank=Array.isArray(state.exerciseBank)?state.exerciseBank:[];
 for(const w of ["A","B"]) state.exercises[w]=(state.exercises[w]||[]).map(e=>({...e,rest:(Number.isFinite(Number(e.rest))&&Number(e.rest)>=5?Math.round(Number(e.rest)):getRestSeconds()),custom:!!e.custom,favorite:!!e.favorite}));
}
async function save(){sanitizeState();state.version=APP_VERSION;await dbSet(DATA_KEY,state);await dbSet(OUTBOX_KEY,{pending:true,at:new Date().toISOString()});if(online&&currentUser)syncNow().catch(console.warn)}
async function loadState(){
 const saved=await dbGet(DATA_KEY);
 if(saved){state=Object.assign(state,saved);sanitizeState()}
 const old=localStorage.getItem("meuTreinoPWA");
 if(!saved&&old){try{const o=JSON.parse(old);state.workout=o.workout||"A";state.sessions=o.logs?.length?[{id:uid(),start:o.logs[0].date,end:o.logs.at(-1).date,workout:o.workout,sets:o.logs.map(x=>({exercise:x.exercise,set:x.set,weight:x.weight,reps:x.reps,rest:40})),cardio:null,notes:"",durationMin:0}]:[];sanitizeState();await dbSet(DATA_KEY,state);localStorage.removeItem("meuTreinoPWA");toast("Dados antigos migrados para o armazenamento local.")}catch(e){console.warn(e)}}
 state.photos=await photoAll();
}
function snapshot(){return JSON.parse(JSON.stringify({...state,photos:state.photos.map(p=>({...p,data:undefined}))}))}
function audit(action,type,id,before=null,after=null){state.audit.unshift({id:uid(),action,type,record_id:id,date:new Date().toISOString(),before,after});state.audit=state.audit.slice(0,500)}

async function initSupabase(){
 const c=window.MEU_TREINO_CONFIG||{};
 if(!c.SUPABASE_URL||c.SUPABASE_URL.includes("SEU-PROJETO")) return null;
 if(!window.supabase)return null;
 return window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce",experimental:{passkey:true}}});
}
let sb=null;
async function syncNow(){
 if(!sb||!currentUser||!online)return;
 const payload=snapshot();
 const {error}=await sb.from("user_snapshots").upsert({user_id:currentUser.id,data:payload,updated_at:new Date().toISOString()},{onConflict:"user_id"});
 if(error){console.warn(error);toast("Falha na sincronização; os dados locais foram preservados.");return}
 state.syncUpdatedAt=new Date().toISOString();await dbSet(DATA_KEY,state);await dbSet(OUTBOX_KEY,{pending:false,at:state.syncUpdatedAt});
 toast("☁️ Sincronizado");
}
async function pullRemote(){
 if(!sb||!currentUser||!online)return false;
 const {data,error}=await sb.from("user_snapshots").select("data,updated_at").eq("user_id",currentUser.id).maybeSingle();
 if(error){console.warn(error);return false}
 if(!data?.data)return false;
 const local=await dbGet(DATA_KEY);
 const localTime=local?.syncUpdatedAt||"";
 if(localTime && data.updated_at<=localTime)return false;
 const remote=data.data||{};
 const localExercises=local?.exercises||state.exercises;
 const remoteExercises=remote.exercises||{};
 const localCount=(localExercises?.A?.length||0)+(localExercises?.B?.length||0);
 const remoteCount=(remoteExercises?.A?.length||0)+(remoteExercises?.B?.length||0);
 state=Object.assign(state,remote);
 // Proteção contra snapshots antigos/vazios: nunca apague os treinos locais
 // apenas porque a nuvem possui A/B vazios.
 if(remoteCount===0 && localCount>0) state.exercises=structuredClone(localExercises);
 // Se ambos vierem vazios, recupera o treino A/B padrão do aplicativo.
 if((state.exercises?.A?.length||0)+(state.exercises?.B?.length||0)===0){
   state.exercises=structuredClone(DEFAULTS);
 }
 state.syncUpdatedAt=data.updated_at;
 sanitizeState();
 await dbSet(DATA_KEY,state);
 return remoteCount===0 && localCount>0;
}
async function setupAuth(){
 sb=await initSupabase();
 if(!sb){showLoggedOut();return}
 const {data}=await sb.auth.getSession();if(data.session){currentUser=data.session.user;await afterLogin()}else showLoggedOut();
 sb.auth.onAuthStateChange(async(_event,session)=>{currentUser=session?.user||null;if(currentUser)await afterLogin();else showLoggedOut()});
}
async function afterLogin(){
 const restoredLocal=await pullRemote();
 await loadExerciseBank();
 $("authView").classList.add("hidden");$("appShell").classList.remove("hidden");
 $("userLabel").textContent=currentUser?.email||state.profile.name||"Conta";
 if(!state.profile.name && currentUser?.user_metadata?.name){state.profile.name=currentUser.user_metadata.name;}
 // Se a nuvem trouxe um snapshot vazio/antigo, preserve os treinos locais
 // e sincronize a versão recuperada para a conta.
 if(restoredLocal || ((state.exercises?.A?.length||0)+(state.exercises?.B?.length||0)===0)){
   sanitizeState();
   await dbSet(DATA_KEY,state);
   await syncNow();
 } else if(!state.profile.name && currentUser?.user_metadata?.name){
   await save();
 }
 renderAll();checkLocalImportOffer();
}
function showLoggedOut(){$("authView").classList.remove("hidden");$("appShell").classList.add("hidden")}
async function signup(e){e.preventDefault();if(!sb)return toast("Configure o Supabase em js/config.js.");const name=$("signupName").value.trim(),email=$("signupEmail").value.trim(),p=$("signupPassword").value,p2=$("signupPassword2").value;if(p!==p2)return toast("As senhas não conferem.");const {error}=await sb.auth.signUp({email,password:p,options:{data:{name},emailRedirectTo:location.href}});if(error)return toast(error.message);state.profile.name=name;await save();toast("Conta criada. Verifique o e-mail se a confirmação estiver ativa.")}
async function login(e){
  e.preventDefault();if(!sb)return toast("Configure o Supabase em js/config.js.");
  const remember=$("rememberAccount")?.checked!==false;
  localStorage.setItem("meuTreinoRemember",String(remember));state.settings.rememberAccount=remember;
  const {error}=await sb.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
  if(error)toast(error.message);else await dbSet(DATA_KEY,state);
}
async function forgot(){if(!sb)return toast("Configure o Supabase.");const email=prompt("Digite seu e-mail:");if(!email)return;const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.href});toast(error?error.message:"Link de recuperação enviado.")}
async function logout(){if(sb)await sb.auth.signOut()}
async function loginWithPasskey(){
  if(!sb)return toast("Configure o Supabase em js/config.js.");
  if(!sb.auth.signInWithPasskey)return toast("Atualize o Supabase e habilite Passkeys no projeto.");
  try{
    const {data,error}=await sb.auth.signInWithPasskey();
    if(error)throw error;
    currentUser=data?.user||currentUser;toast("🔐 Login por biometria realizado.");
  }catch(e){
    console.error(e);
    toast(e?.message||"Não foi possível entrar com Face ID/biometria.");
  }
}
async function registerPasskey(){
  if(!sb||!currentUser)return toast("Faça login primeiro.");
  if(!sb.auth.registerPasskey)return toast("A versão do Supabase usada pelo app não oferece Passkeys.");
  try{
    const {data,error}=await sb.auth.registerPasskey();
    if(error)throw error;
    toast(`🔐 Passkey ativada${data?.friendly_name?": "+data.friendly_name:""}.`);
    renderSettings();
  }catch(e){console.error(e);toast(e?.message||"Não foi possível ativar a biometria.")}
}
async function renderPasskeys(){
  const box=$("passkeySettings");if(!box)return;
  if(!currentUser){box.innerHTML="";return}
  if(!sb?.auth?.passkey?.list){box.innerHTML=`<div><b>🔐 Face ID / biometria</b><div class="muted small">Disponível após habilitar Passkeys no Supabase.</div></div>`;return}
  try{
    const {data,error}=await sb.auth.passkey.list();
    if(error)throw error;
    const items=(data||[]).map(p=>`<div class="passkey-item"><span>🔐 ${esc(p.friendly_name||"Passkey")}<small class="muted"> · ${dateBR((p.created_at||"").slice(0,10))}</small></span></div>`).join("");
    box.innerHTML=`<div><b>🔐 Login com Face ID / biometria</b><div class="muted small">A biometria é processada pelo dispositivo. O app não recebe nem armazena sua biometria.</div>${items?`<div class="passkey-list">${items}</div>`:""}<button id="registerPasskeyBtn" type="button" class="passkey-btn">${items?"➕ Adicionar outra biometria":"🔐 Ativar login com Face ID / biometria"}</button></div>`;
    $("registerPasskeyBtn").onclick=registerPasskey;
  }catch(e){
    console.warn(e);box.innerHTML=`<div><b>🔐 Face ID / biometria</b><div class="muted small">Não foi possível consultar as passkeys agora.</div><button id="registerPasskeyBtn" type="button" class="passkey-btn">🔐 Ativar login com Face ID / biometria</button></div>`;
    $("registerPasskeyBtn").onclick=registerPasskey;
  }
}


function checkLocalImportOffer(){dbGet(DATA_KEY).then(local=>{if(!local||!currentUser)return;const meaningful=(local.sessions?.length||local.weights?.length||local.photos?.length||local.profile?.height);if(meaningful&&!local.migratedToAccount){modal("Dados encontrados neste dispositivo",`<p>Encontramos dados salvos neste dispositivo. Deseja importar esses dados para sua conta?</p><p class="muted small">Os dados locais não serão apagados antes da confirmação de sincronização.</p>`,`<div class="actions"><button onclick="closeModal()">Agora não</button><button class="primary" onclick="importLocalToAccount()">Importar dados</button></div>`)}})}
window.importLocalToAccount=async()=>{closeModal();if(!currentUser)return;await syncNow();state.migratedToAccount=true;await save();toast("Dados locais associados à sua conta.")}
function applyTheme(){const s=state.settings.theme;if(s==="dark"||(s==="auto"&&matchMedia("(prefers-color-scheme:dark)").matches))document.body.classList.add("dark");else document.body.classList.remove("dark")}
function showView(id){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$(id)?.classList.add("active");document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===id));({homeView:renderDashboard,workoutView:renderWorkout,historyView:renderHistory,weightView:renderWeight,exerciseView:renderExercises,photosView:renderPhotos,evolutionView:renderEvolution,calendarView:renderCalendar,settingsView:renderSettings}[id]||(()=>{}))()}
function totals(){const sets=state.sessions.flatMap(s=>s.sets||[]);return{sessions:state.sessions.length,sets:sets.length,volume:sets.reduce((a,x)=>a+(+x.weight||0)*(+x.reps||0),0),muscleMin:state.sessions.reduce((a,s)=>a+(+s.durationMin||0),0),cardioMin:state.sessions.reduce((a,s)=>a+(+s.cardio?.time||0),0),km:state.sessions.reduce((a,s)=>a+(+s.cardio?.distance||0),0)}}
function renderDashboard(){const t=totals(),last=state.sessions.at(-1),w=state.weights.at(-1);$("dashboard").innerHTML=`<div class="dashboard-card"><span class="muted">Próximo treino</span><b>${state.nextWorkout==="A"?"A — Superiores":"B — Inferiores"}</b></div><div class="dashboard-card"><span class="muted">Último treino</span><b>${last?last.workout+" — "+dateBR(last.start):"—"}</b></div><div class="dashboard-card"><span class="muted">Peso atual</span><b>${w?Number(w.weight).toFixed(1).replace(".",",")+" kg":"—"}</b></div><div class="dashboard-card"><span class="muted">Treinos</span><b>${t.sessions}</b></div><div class="dashboard-card"><span class="muted">Séries</span><b>${t.sets}</b></div><div class="dashboard-card"><span class="muted">Cardio</span><b>${t.km.toFixed(2).replace(".",",")} km</b></div>`}

function lastForExercise(name){return state.sessions.flatMap(s=>(s.sets||[]).map(x=>({...x,date:s.start}))).filter(x=>x.exercise===name).at(-1)}
function renderWorkout(){const arr=state.exercises[state.workout]||[];$("workoutTitle").textContent=state.workout==="A"?"A — Superiores":"B — Inferiores";$("tabA").classList.toggle("active",state.workout==="A");$("tabB").classList.toggle("active",state.workout==="B");$("workoutExercises").innerHTML=arr.map((e,ei)=>{const last=lastForExercise(e.name);let rows="";for(let s=0;s<e.sets;s++){const d=e.current?.[s]||{};rows+=`<div class="set-row" data-e="${ei}" data-s="${s}"><b>${s+1}</b><input class="weight" inputmode="decimal" placeholder="kg" value="${esc(d.weight??last?.weight??"")}"><input class="reps" inputmode="numeric" placeholder="reps" value="${esc(d.reps??"")}"><input class="rir" inputmode="numeric" placeholder="RIR" value="${esc(d.rir??e.rir??"")}"><button class="done ${d.done?"completed":""}">${d.done?"✓":"✓"}</button></div>`}return `<article class="exercise"><div class="exercise-head"><div class="exercise-info"><div class="exercise-details"><div class="exercise-name"><strong>${esc(e.name)}</strong></div><div class="muted">${e.sets} séries · ${e.min}–${e.max} reps · RIR ${esc(e.rir??"—")} · descanso ${getRestSeconds()}s</div>${last?`<div class="last-load">Último treino: ${esc(last.weight)} kg × ${esc(last.reps)}</div>`:""}</div></div><button class="edit-exercise" data-e="${ei}">Editar</button></div><div class="set-head"><span>#</span><span>Carga</span><span>Reps</span><span>RIR</span><span></span></div>${rows}<div class="video-actions"><button class="exercise-info-btn" data-e="${ei}">🎥 Ver execução</button></div></article>`}).join("");$("workoutExercises").querySelectorAll(".edit-exercise").forEach(b=>b.onclick=()=>editWorkoutExercise(+b.dataset.e));$("workoutExercises").querySelectorAll(".exercise-info-btn").forEach(b=>b.onclick=()=>openExercise(+b.dataset.e));$("workoutExercises").querySelectorAll(".set-row").forEach(bindSetRow);renderWorkoutSummary();loadCardioDraft()}
function bindSetRow(row){const ei=+row.dataset.e,s=+row.dataset.s,e=state.exercises[state.workout][ei],inputs=row.querySelectorAll("input");inputs.forEach((inp,i)=>inp.onchange=()=>{e.current=e.current||[];e.current[s]=e.current[s]||{};e.current[s][["weight","reps","rir"][i]]=inp.value;save()});row.querySelector(".done").onclick=async()=>{const vals=[...inputs].map(x=>x.value);if(!vals[0]||!vals[1])return toast("Informe carga e repetições.");e.current=e.current||[];e.current[s]={weight:vals[0],reps:vals[1],rir:vals[2]||e.rir,done:true};await save();row.querySelector(".done").classList.add("completed");await initAudio();if(state.settings.autoStartRest)startTimer();toast("✓ Série registrada")}}
function renderWorkoutSummary(){const sets=state.exercises[state.workout].reduce((a,e)=>a+(e.current||[]).filter(x=>x?.done).length,0),vol=state.exercises[state.workout].reduce((a,e)=>a+(e.current||[]).reduce((b,x)=>b+(+x?.weight||0)*(+x?.reps||0),0),0);$("workoutSummary").innerHTML=`<div class="stat"><b>${sets}</b><div class="muted">séries concluídas</div></div><div class="stat"><b>${vol.toFixed(0)} kg</b><div class="muted">volume</div></div><div class="stat"><b>${state.exercises[state.workout].length}</b><div class="muted">exercícios</div></div>`}
function loadCardioDraft(){const c=state._cardio||{};for(const [id,key] of [["cardioType","type"],["cardioTime","time"],["cardioDistance","distance"],["cardioCalories","calories"],["cardioSpeed","speed"],["cardioHR","hr"],["cardioNotes","notes"]])if($(id))$(id).value=c[key]??""}
function readCardio(){return{type:$("cardioType").value,time:+$("cardioTime").value||0,distance:+$("cardioDistance").value||0,calories:+$("cardioCalories").value||0,speed:+$("cardioSpeed").value||0,hr:+$("cardioHR").value||0,notes:$("cardioNotes").value}}
async function finishWorkout(){const now=new Date(),start=state._workoutStart||now.toISOString(),sets=[];state.exercises[state.workout].forEach(e=>(e.current||[]).forEach((x,i)=>{if(x?.done)sets.push({exercise:e.name,set:i+1,weight:x.weight,reps:x.reps,rir:x.rir,rest:getRestSeconds()})}));if(!sets.length)return toast("Conclua pelo menos uma série.");const durationMin=Math.max(1,Math.round((now-new Date(start))/60000)),id=uid();const session={id,start,end:now.toISOString(),workout:state.workout,sets,cardio:readCardio(),notes:$("workoutNotes").value,durationMin};state.sessions.push(session);audit("CREATE","workout_session",id,null,session);state.exercises[state.workout].forEach(e=>delete e.current);state.nextWorkout=state.workout==="A"?"B":"A";delete state._workoutStart;state._cardio=null;await save();toast("Treino salvo no histórico.");showView("historyView")}

function renderHistory(){const list=$("historyList");list.innerHTML=state.sessions.length?[...state.sessions].reverse().map(s=>`<article class="history-item"><div class="history-main"><div><strong>Treino ${s.workout}</strong><div class="muted">${dateBR(s.start)} · ${timeBR(s.start)}</div></div><div><strong>${s.durationMin||0} min</strong><div class="muted">${s.sets.length} séries</div></div></div><div class="muted">${s.cardio?.type||"Sem cardio"} · ${s.cardio?.time||0} min · ${s.cardio?.distance||0} km</div><div class="history-details">${s.sets.map(x=>`<div>${esc(x.exercise)} — ${esc(x.weight)} kg × ${esc(x.reps)} · RIR ${esc(x.rir??"—")}</div>`).join("")}<p>${esc(s.notes||"")}</p><button class="danger delete-session" data-id="${s.id}">Enviar para lixeira</button></div></article>`).join(""):'<div class="card muted">Nenhum treino salvo ainda.</div>';list.querySelectorAll(".history-item").forEach(x=>x.onclick=e=>{if(e.target.classList.contains("delete-session"))return;x.classList.toggle("open")});list.querySelectorAll(".delete-session").forEach(b=>b.onclick=async e=>{e.stopPropagation();trashRecord("workout_session",b.dataset.id)});const names=[...new Set(state.sessions.flatMap(s=>s.sets.map(x=>x.exercise)))];$("exerciseHistorySelect").innerHTML=names.length?names.map(n=>`<option>${esc(n)}</option>`).join(""):"<option>Nenhum exercício</option>";renderExerciseHistory()}
function renderExerciseHistory(){const n=$("exerciseHistorySelect").value;const sets=state.sessions.flatMap(s=>s.sets.map(x=>({...x,date:s.start}))).filter(x=>x.exercise===n);$("exerciseHistory").innerHTML=sets.length?`<div class="card">${sets.map(x=>`<div><strong>${dateBR(x.date)}</strong> — ${x.weight} kg × ${x.reps} · RIR ${x.rir??"—"}</div>`).join("")}</div>`:'<div class="card muted">Sem registros.</div>'}

function bmiInfo(weight,height){const w=Number(weight),h=Number(String(height).replace(",","."));if(!Number.isFinite(w)||w<=0||!Number.isFinite(h)||h<=0)return null;const bmi=w/(h*h);let classification=bmi<18.5?"Abaixo do peso":bmi<25?"Peso normal":bmi<30?"Sobrepeso":bmi<35?"Obesidade grau I":bmi<40?"Obesidade grau II":"Obesidade grau III";return{value:bmi,classification}}
function updateBmiPreview(){const typed=$("weightInput")?.value,weight=typed?Number(typed):state.weights.at(-1)?.weight,bmi=bmiInfo(weight,state.profile.height);$("currentBmi").innerHTML=bmi?`<div class="stat"><b>${bmi.value.toFixed(1).replace(".",",")}</b><div class="muted">IMC · ${bmi.classification}</div></div>`:`<div class="stat"><b>—</b><div class="muted">IMC · informe peso e altura</div></div>`}
function renderWeight(){const a=state.weights;$("heightInput").value=state.profile.height??"";updateBmiPreview();if(!a.length)$("weightStats").innerHTML='<div class="stat"><b>—</b><div class="muted">Sem dados</div></div>'.repeat(4);else{const vals=a.map(x=>+x.weight),initial=vals[0],current=vals.at(-1),max=Math.max(...vals),min=Math.min(...vals),diff=current-initial,pct=initial?diff/initial*100:0;$("weightStats").innerHTML=`<div class="stat"><b>${initial.toFixed(1)} kg</b><div class="muted">Inicial</div></div><div class="stat"><b>${current.toFixed(1)} kg</b><div class="muted">Atual</div></div><div class="stat"><b>${max.toFixed(1)} kg</b><div class="muted">Maior</div></div><div class="stat"><b>${min.toFixed(1)} kg</b><div class="muted">Menor</div></div><div class="stat"><b>${diff.toFixed(1)} kg</b><div class="muted">Diferença</div></div><div class="stat"><b>${pct.toFixed(1)}%</b><div class="muted">Variação</div></div>`}$("weightList").innerHTML=[...a].reverse().map(w=>`<div class="history-item"><strong>${Number(w.weight).toFixed(1)} kg</strong> · ${dateBR(w.date)} · ${w.time||""}<div class="muted">${esc(w.notes||"")}</div><button class="danger" data-weight="${w.id}">Enviar para lixeira</button></div>`).join("");$("weightList").querySelectorAll("[data-weight]").forEach(b=>b.onclick=()=>trashRecord("weight_record",b.dataset.weight));drawChart($("weightChart"),a.map(x=>({label:dateBR(x.date),value:+x.weight})))}
async function addWeight(){const w=+$("weightInput").value;if(!w)return toast("Informe o peso.");const item={id:uid(),date:$("weightDate").value||today(),time:$("weightTime").value||new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),weight:w,notes:$("weightNotes").value};state.weights.push(item);state.weights.sort((a,b)=>a.date.localeCompare(b.date));audit("CREATE","weight_record",item.id,null,item);await save();$("weightInput").value="";$("weightNotes").value="";renderWeight();toast("Peso salvo.")}
async function saveHeight(){const h=Number(String($("heightInput").value).replace(",","."));if(!h||h<0.5||h>2.5)return toast("Informe uma altura válida.");state.profile.height=h;audit("UPDATE","profile","profile",null,{height:h});await save();renderWeight();toast("Altura salva.")}
function drawChart(canvas,data){if(!canvas)return;const c=canvas.getContext("2d"),dpr=devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;c.width=w*dpr;c.height=h*dpr;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);if(!data.length){c.fillStyle="#6b7280";c.fillText("Sem dados",15,30);return}const pad=28,vals=data.map(x=>x.value),min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;c.strokeStyle=getComputedStyle(document.body).getPropertyValue("--border");c.beginPath();c.moveTo(pad,10);c.lineTo(pad,h-pad);c.lineTo(w-10,h-pad);c.stroke();c.strokeStyle="#4f46e5";c.lineWidth=3;c.beginPath();data.forEach((x,i)=>{const px=pad+(w-pad-15)*(i/Math.max(1,data.length-1)),py=10+(max-x.value)/range*(h-pad-20);i?c.lineTo(px,py):c.moveTo(px,py)});c.stroke()}


function allExercises(){return [...state.exercises.A.map((e,i)=>({...e,workout:"A",idx:i})),...state.exercises.B.map((e,i)=>({...e,workout:"B",idx:i}))]}
function renderExercises(){
  const q=($("exerciseSearch").value||"").toLowerCase(),g=$("exerciseFilter").value;
  const source=state.exerciseBank.length?state.exerciseBank:localExerciseBank();
  const arr=source.filter(e=>(!q||e.name.toLowerCase().includes(q)||String(e.muscles).toLowerCase().includes(q)||String(e.secondary_muscles).toLowerCase().includes(q))&&(!g||e.group===g));
  $("exerciseList").innerHTML=arr.map(e=>`<article class="exercise-card">
    <img class="exercise-thumb" src="${esc(exerciseImage(e))}" alt="Imagem de ${esc(e.name)}" onerror="this.src=PLACEHOLDER_EXERCISE_IMAGE">
    <div class="exercise-head"><div><strong>${esc(e.name)}</strong><div class="exercise-meta"><span class="pill">${esc(e.group)}</span><span class="pill">${esc(e.equipment||"")}</span>${e.is_official?'<span class="pill">Oficial</span>':'<span class="pill">Personalizado</span>'}</div>
    <div class="muted">${esc(e.muscles||"")} · ${esc(e.movement_type||"")} · ${esc(e.difficulty||"")}</div></div>
    <button data-open-bank-ex="${esc(e.id)}">Abrir</button></div>
  </article>`).join("")||`<div class="empty-state">${backendStatus.exerciseBank==="empty"?"O banco oficial está vazio. Execute o arquivo supabase/migration-v9.sql no SQL Editor do Supabase.":backendStatus.exerciseBank==="error"?"Não foi possível consultar o banco. Verifique se a migração do Supabase foi executada.":"Nenhum exercício encontrado."}</div>`;
  $("exerciseList").querySelectorAll("[data-open-bank-ex]").forEach(b=>b.onclick=()=>openBankExercise(b.dataset.openBankEx));
}
function openBankExercise(id){
  const e=state.exerciseBank.find(x=>String(x.id)===String(id));if(!e)return;
  const video=e.video_url?`<div class="video-box"><a target="_blank" rel="noopener" href="${esc(e.video_url)}"><button>🎥 Abrir vídeo</button></a></div>`:"";
  modal(esc(e.name),`<img class="exercise-thumb" src="${esc(exerciseImage(e))}" alt="Imagem de ${esc(e.name)}" onerror="this.src=PLACEHOLDER_EXERCISE_IMAGE"><p><b>Grupo:</b> ${esc(e.group)}</p><p><b>Músculos:</b> ${esc(e.muscles||"")}</p><p><b>Equipamento:</b> ${esc(e.equipment||"")}</p><p><b>Dificuldade:</b> ${esc(e.difficulty||"")}</p><p>${esc(e.description||"")}</p><p>${esc(e.instructions||"")}</p>${video}`);
}
function openExercise(i,w=state.workout){
  const e=state.exercises[w][i];if(!e)return;
  const video=e.video_id?`<div class="video-box"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(e.video_id)}" title="Execução de ${esc(e.name)}" allowfullscreen></iframe><div class="video-actions"><a href="${esc(e.youtube_url||"https://www.youtube.com/watch?v="+e.video_id)}" target="_blank" rel="noopener"><button>Assistir no YouTube</button></a><button onclick="chooseVideo('${w}',${i})">🔄 Trocar vídeo</button></div></div>`:`<div class="card"><div class="muted">Nenhum vídeo cadastrado.</div><button onclick="chooseVideo('${w}',${i})">🔎 Buscar no YouTube</button></div>`;
  modal(esc(e.name),`<img class="exercise-thumb" src="${esc(exerciseImage(e))}" alt="Imagem de ${esc(e.name)}" onerror="this.src=PLACEHOLDER_EXERCISE_IMAGE"><p><b>Grupo:</b> ${esc(e.group)}</p><p><b>Músculos:</b> ${esc(e.muscles||"")}</p><p><b>Equipamento:</b> ${esc(e.equipment||"")}</p><p>${esc(e.description||"")}</p><p>${esc(e.instructions||"")}</p>${video}<div class="actions"><button onclick="editExerciseFull('${w}',${i})">✏️ Editar</button>${e.custom?`<button class="danger" onclick="deleteExercise('${w}',${i})">Excluir</button>`:""}</div>`)
}
async function addExercise(){
  const name=prompt("Nome do exercício:");if(!name)return;
  const group=prompt("Grupo muscular:","Corpo inteiro")||"Corpo inteiro",equipment=prompt("Equipamento:","Máquinas")||"Máquinas";
  const e={id:uid(),name,slug:slugify(name),group,equipment,muscles:"",secondary_muscles:"",movement_type:"",difficulty:"Iniciante",exercise_type:"Musculação",description:"",instructions:"",image_url:"",video_url:"",sets:3,min:10,max:12,rir:2,rest:getRestSeconds(),custom:true,is_official:false,active:true};
  try{
    const remote=await insertCustomExerciseToSupabase(e);Object.assign(e,remote);
  }catch(err){console.warn(err);if(sb&&currentUser)return toast("Não foi possível salvar o exercício no Supabase.")}
  state.exerciseBank.push(normalizeExerciseRow(e));state.exercises[state.workout].push(e);
  audit("CREATE","exercise",e.id,null,e);await save();renderExercises();renderWorkout();toast("Exercício salvo no banco.");
}
function editWorkoutExercise(i){const e=state.exercises[state.workout][i];const sets=Number(prompt("Séries:",e.sets)),min=Number(prompt("Repetições mínimas:",e.min)),max=Number(prompt("Repetições máximas:",e.max)),rir=Number(prompt("RIR padrão:",e.rir??2));if([sets,min,max,rir].some(x=>!Number.isFinite(x)||x<0))return;e.sets=sets;e.min=min;e.max=max;e.rir=rir;save();renderWorkout()}
function editExerciseFull(w,i){closeModal();const e=state.exercises[w][i];const name=prompt("Nome:",e.name);if(name===null)return;e.name=name;e.group=prompt("Grupo muscular:",e.group)||e.group;e.equipment=prompt("Equipamento:",e.equipment)||e.equipment;e.muscles=prompt("Músculos:",e.muscles)||e.muscles;e.description=prompt("Descrição:",e.description)||e.description;e.instructions=prompt("Instruções:",e.instructions)||e.instructions;e.custom=true;audit("UPDATE","exercise",e.id,null,e);save();renderExercises();renderWorkout()}
async function deleteExercise(w,i){closeModal();const e=state.exercises[w][i];if(!confirm("Enviar este exercício personalizado para a lixeira?"))return;state.trash.push({id:uid(),type:"exercise",deletedAt:new Date().toISOString(),record:e,workout:w});state.exercises[w].splice(i,1);state.exerciseBank=state.exerciseBank.filter(x=>x.id!==e.id);audit("DELETE","exercise",e.id,e,null);if(sb&&currentUser)await sb.from("exercises").update({active:false}).eq("id",e.id).eq("user_id",currentUser.id);await save();renderExercises();renderWorkout()}
window.editExerciseFull=editExerciseFull;window.deleteExercise=deleteExercise;
async function chooseVideo(w,i){const e=state.exercises[w][i];closeModal();const q=prompt("Buscar no YouTube:",`${e.name} execução correta`);if(!q)return;toast("Buscando vídeos...");if(!sb)return toast("Configure o Supabase/Edge Function para busca automática.");const {data,error}=await sb.functions.invoke("youtube-search",{body:{query:q}});if(error||!data?.items?.length)return toast("Nenhum vídeo encontrado.");modal("Escolha um vídeo",data.items.slice(0,3).map((v,n)=>`<div class="exercise-card"><b>${esc(v.title)}</b><div class="muted">${esc(v.channel||"")}</div><img src="${esc(v.thumbnail||"")}" style="width:100%;border-radius:10px;margin-top:7px"><div class="actions"><a target="_blank" rel="noopener" href="${esc(v.url)}"><button>Visualizar</button></a><button class="primary" onclick="useVideo('${w}',${i},${n})">Usar este vídeo</button></div></div>`).join(""),"");window.__videoChoices=data.items;window.useVideo=(ww,ii,n)=>{const v=window.__videoChoices[n];state.exercises[ww][ii].video_id=v.videoId;state.exercises[ww][ii].youtube_url=v.url;state.exercises[ww][ii].video_title=v.title;state.exercises[ww][ii].video_channel=v.channel;state.exercises[ww][ii].video_thumbnail=v.thumbnail;state.exercises[ww][ii].video_status="active";audit("UPDATE","exercise_video",state.exercises[ww][ii].id,null,v);save();closeModal();renderExercises();renderWorkout();toast("Vídeo salvo.")}}
window.chooseVideo=chooseVideo;

function renderPhotos(){const photos=state.photos;$("photoGallery").innerHTML=photos.length?photos.map(p=>`<div class="photo-tile"><img src="${p.data}" alt="${esc(p.type)}"><div class="photo-caption">${dateBR(p.date)} · ${esc(p.type)}</div><button class="danger" data-photo="${p.id}">Lixeira</button></div>`).join(""):'<div class="card muted">Nenhuma foto registrada.</div>';$("photoGallery").querySelectorAll("img").forEach(i=>i.onclick=()=>modal("Foto",`<img src="${i.src}" style="width:100%;border-radius:12px">`));$("photoGallery").querySelectorAll("[data-photo]").forEach(b=>b.onclick=()=>trashRecord("photo",b.dataset.photo))}
async function addPhoto(){const f=$("photoFile").files[0];if(!f)return toast("Selecione uma foto.");const data=await fileToDataURL(f);const p={id:uid(),date:$("photoDate").value||today(),type:$("photoType").value,notes:$("photoNotes").value,data};await photoPut(p);state.photos.push(p);state.photos.sort((a,b)=>a.date.localeCompare(b.date));audit("CREATE","photo",p.id,null,{...p,data:"[local image]"});await save();$("photoFile").value="";renderPhotos();toast("Foto salva localmente.")}
function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}

function renderEvolution(){const t=totals(),a=state.sessions.filter(s=>s.workout==="A").length,b=state.sessions.filter(s=>s.workout==="B").length;$("evolutionStats").innerHTML=`<div class="stat"><b>${t.sessions}</b><div class="muted">Treinos</div></div><div class="stat"><b>${a}</b><div class="muted">Treinos A</div></div><div class="stat"><b>${b}</b><div class="muted">Treinos B</div></div><div class="stat"><b>${t.sets}</b><div class="muted">Séries</div></div><div class="stat"><b>${t.muscleMin} min</b><div class="muted">Musculação</div></div><div class="stat"><b>${t.cardioMin} min</b><div class="muted">Cardio</div></div>`;drawChart($("evolutionWeightChart"),state.weights.map(x=>({label:x.date,value:+x.weight})));drawChart($("volumeChart"),state.sessions.map(s=>({label:dateBR(s.start),value:s.sets.reduce((a,x)=>a+(+x.weight||0)*(+x.reps||0),0)})));$("exerciseProgress").innerHTML='<div class="section-title">Progressão de carga</div>'+[...new Set(state.sessions.flatMap(s=>s.sets.map(x=>x.exercise)))].map(n=>{const ss=state.sessions.flatMap(s=>s.sets.filter(x=>x.exercise===n)),max=Math.max(...ss.map(x=>+x.weight||0));return `<div class="history-item"><strong>${esc(n)}</strong><div class="muted">Maior carga: ${max} kg · ${ss.length} séries</div></div>`}).join("")}
function renderCalendar(){const y=calendarDate.getFullYear(),m=calendarDate.getMonth();$("calendarMonth").textContent=new Date(y,m,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();let h=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(x=>`<div class="head">${x}</div>`).join("");for(let i=0;i<first;i++)h+="<div></div>";for(let d=1;d<=days;d++){const iso=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,s=state.sessions.filter(x=>x.start.slice(0,10)===iso);h+=`<div class="${s.length?"trained":""}" data-date="${iso}">${d}${s.length?`<br>✓ ${s.map(x=>x.workout).join("/")}`:""}</div>`}$("calendarGrid").innerHTML=h;$("calendarGrid").querySelectorAll("[data-date]").forEach(x=>x.onclick=()=>{$("calendarDetails").innerHTML=state.sessions.filter(s=>s.start.slice(0,10)===x.dataset.date).map(s=>`<div class="card"><strong>Treino ${s.workout}</strong><div>${dateBR(s.start)} · ${s.durationMin} min · ${s.sets.length} séries</div></div>`).join("")})}

function renderSettings(){$("defaultRest").value=getRestSeconds();$("rememberAccount") && ($("rememberAccount").checked=state.settings.rememberAccount!==false);$("soundEnabled").checked=state.settings.soundEnabled;$("autoStartRest").checked=state.settings.autoStartRest;$("themeSelect").value=state.settings.theme;$("accountInfo").textContent=currentUser?`${state.profile.name||"Usuário"} · ${currentUser.email}`:"Modo local";$("settingsExtra").innerHTML=`<div class="card"><div class="section-title">Sincronização</div><div class="muted">${online?"🟢 Online":"🔴 Offline"} · ${state.syncUpdatedAt?`última sincronização: ${new Date(state.syncUpdatedAt).toLocaleString("pt-BR")}`:"ainda não sincronizado"}</div></div>`}
function renderAll(){applyTheme();renderDashboard();renderWorkout();renderWeight();renderExercises();renderPhotos();renderEvolution();renderCalendar();renderSettings()}
function renderTrash(){const arr=state.trash||[];modal("🗑️ Lixeira",arr.length?arr.map(x=>`<div class="history-item"><strong>${esc(x.type)}</strong><div class="muted">${new Date(x.deletedAt).toLocaleString("pt-BR")}</div><div class="actions"><button onclick="restoreTrash('${x.id}')">Restaurar</button><button class="danger" onclick="permanentTrash('${x.id}')">Excluir permanentemente</button></div></div>`).join(""):'<p class="muted">Lixeira vazia.</p>')}
async function trashRecord(type,id){if(!confirm("Tem certeza que deseja excluir este registro? Ele irá para a Lixeira."))return;let record=null;if(type==="workout_session"){const i=state.sessions.findIndex(x=>x.id===id);if(i<0)return;record=state.sessions.splice(i,1)[0]}else if(type==="weight_record"){const i=state.weights.findIndex(x=>x.id===id);if(i<0)return;record=state.weights.splice(i,1)[0]}else if(type==="photo"){const i=state.photos.findIndex(x=>x.id===id);if(i<0)return;record=state.photos.splice(i,1)[0];await photoDelete(id)}else return;state.trash.push({id:uid(),type,record,deletedAt:new Date().toISOString()});audit("DELETE",type,id,record,null);await save();renderAll();toast("Registro enviado para a Lixeira.")}
window.trashRecord=trashRecord;
window.restoreTrash=async id=>{const i=state.trash.findIndex(x=>x.id===id);if(i<0)return;const x=state.trash[i];if(x.type==="workout_session")state.sessions.push(x.record);if(x.type==="weight_record")state.weights.push(x.record);if(x.type==="photo"){state.photos.push(x.record);await photoPut(x.record)}state.trash.splice(i,1);audit("RESTORE",x.type,x.record.id,null,x.record);await save();closeModal();renderAll();toast("Registro restaurado.")};
window.permanentTrash=async id=>{const i=state.trash.findIndex(x=>x.id===id);if(i<0)return;if(!confirm("Excluir permanentemente?"))return;const x=state.trash.splice(i,1)[0];audit("PERMANENT_DELETE",x.type,x.record.id,x.record,null);await save();renderTrash();toast("Excluído permanentemente.")};
function renderAudit(){modal("🧾 Histórico de alterações",(state.audit||[]).map(a=>`<div class="history-item"><strong>${esc(a.action)} · ${esc(a.type)}</strong><div class="muted">${new Date(a.date).toLocaleString("pt-BR")}</div><div class="small">${a.before?esc(JSON.stringify(a.before)):''}${a.after?` → ${esc(JSON.stringify(a.after))}`:''}</div></div>`).join("")||'<p class="muted">Sem alterações registradas.</p>')}


function selectedValues(id){return [...($(id)?.selectedOptions||[])].map(o=>o.value)}
function estimateExerciseMinutes(e,rest){
  const sets=Number(e.sets)||3;
  return sets*1.15+Math.max(0,sets-1)*(rest/60)+0.5;
}
function goalPrescription(goal,e){
  if(goal==="Força")return {sets:3,min:4,max:8,rir:2};
  if(goal==="Resistência muscular")return {sets:2,min:12,max:20,rir:2};
  if(goal==="Manutenção")return {sets:2,min:8,max:15,rir:3};
  if(goal==="Variar o treino")return {sets:2,min:8,max:15,rir:2};
  return {sets:(e.group==="Peito"||e.group==="Costas")?3:2,min:8,max:12,rir:2};
}
function difficultyAllowed(ex,level){
  const rank={Iniciante:1,Intermediário:2,Avançado:3};
  return (rank[ex.difficulty]||1)<=(rank[level]||1);
}
function buildSmartWorkout(pool,{groups,goal,time,eq,level,avoid,variety}){
  let candidates=pool.filter(e=>e.active!==false)
    .filter(e=>!groups.length||groups.includes(e.group))
    .filter(e=>!eq.length||eq.includes("Academia completa")||eq.includes(e.equipment))
    .filter(e=>difficultyAllowed(e,level))
    .filter(e=>!avoid.some(a=>e.name.toLowerCase().includes(a)||String(e.muscles).toLowerCase().includes(a)));
  if(!candidates.length)return null;
  const recent=new Set(state.sessions.slice(-3).flatMap(s=>(s.sets||[]).map(x=>x.exercise)));
  const selected=[],used=new Set(),targetGroups=groups.length?groups.filter(g=>g!=="Corpo inteiro"):["Corpo inteiro"];
  const score=e=>{
    let v=0;
    if(variety&&recent.has(e.name))v-=100;
    if(e.movement_type==="compound"||/press|supino|remada|puxada|agach|leg press|terra|hip thrust/i.test(e.name))v+=8;
    if(e.is_official)v+=2;
    if(targetGroups.includes(e.group))v+=5;
    return v;
  };
  candidates.sort((a,b)=>score(b)-score(a));
  const prescriptionFor=e=>({...e,...goalPrescription(goal,e),rest:getRestSeconds()});
  // First guarantee coverage of selected groups when possible.
  for(const g of targetGroups){
    const candidate=candidates.find(e=>e.group===g&&!used.has(e.id||e.name));
    if(candidate){
      const x=prescriptionFor(candidate),cost=estimateExerciseMinutes(x,x.rest);
      if(selected.reduce((a,e)=>a+estimateExerciseMinutes(e,e.rest),2)+cost<=time){
        selected.push(x);used.add(x.id||x.name);
      }
    }
  }
  // Then fill remaining time, balancing groups and avoiding duplicates.
  for(const e of candidates){
    const key=e.id||e.name;if(used.has(key))continue;
    const x=prescriptionFor(e);
    const cost=estimateExerciseMinutes(x,x.rest);
    if(selected.reduce((a,z)=>a+estimateExerciseMinutes(z,z.rest),2)+cost>time)continue;
    const count=selected.filter(z=>z.group===x.group).length;
    if(targetGroups.length>1&&count>=3)continue;
    selected.push(x);used.add(key);
  }
  if(!selected.length){
    const x=prescriptionFor(candidates[0]);selected.push(x);
  }
  const estimated=Math.ceil(selected.reduce((a,e)=>a+estimateExerciseMinutes(e,e.rest),2));
  return {exercises:selected,estimatedMinutes:Math.min(time,estimated)};
}
async function generateSmart(){
  clearSmartStatus();
  const groups=selectedValues("smartGroups"),goal=$("smartGoal").value;
  const time=$("smartTime").value==="custom"?Math.max(10,Math.min(180,+$("smartCustomTime").value||45)):+$("smartTime").value;
  const eq=selectedValues("smartEquipment"),level=$("smartLevel").value;
  const avoid=$("smartAvoid").value.toLowerCase().split(",").map(x=>x.trim()).filter(Boolean);
  const variety=$("smartVariety").checked;
  const btn=$("generateSmartBtn");btn.disabled=true;btn.textContent="⏳ GERANDO TREINO...";
  setSmartStatus("Buscando exercícios compatíveis no banco...");
  try{
    const pool=await fetchGeneratorPool();
    if(!pool.length){
      setSmartStatus("O banco de exercícios está vazio. Execute supabase/migration-v9.sql no SQL Editor do Supabase e tente novamente.","error");
      return;
    }
    setSmartStatus("Filtrando exercícios e montando uma sessão que caiba no tempo...");
    const built=buildSmartWorkout(pool,{groups,goal,time,eq,level,avoid,variety});
    if(!built){
      $("smartResult").innerHTML="";setSmartStatus("Não encontramos exercícios compatíveis com esses critérios. Tente alterar os filtros.","error");return;
    }
    const r={
      id:uid(),name:`Treino Inteligente — ${groups.join(" + ")||"Corpo inteiro"}`,goal,time,level,
      rest:getRestSeconds(),groups,equipment:eq,exercises:built.exercises,
      estimatedMinutes:built.estimatedMinutes,
      reason:`O treino foi montado usando o banco de exercícios, filtros selecionados, nível, equipamento, tempo disponível e histórico recente quando solicitado. Exercícios duplicados foram evitados.`
    };
    renderSmartResult(r);setSmartStatus("TREINO GERADO");
  }catch(e){
    console.error(e);$("smartResult").innerHTML="";
    const msg=String(e?.message||e||"");
    const schemaHint=/column .* does not exist|schema cache|relation .* does not exist/i.test(msg)
      ? "O banco do Supabase ainda não está na estrutura desta versão. Execute supabase/migration-v9.sql no SQL Editor."
      : "Não foi possível consultar o banco de exercícios. Verifique a conexão e as permissões do Supabase.";
    setSmartStatus(schemaHint,"error");
  }finally{
    btn.disabled=false;btn.textContent="🤖 GERAR TREINO";
  }
}
function renderSmartResult(r){
  const exerciseHtml=r.exercises.map((e,i)=>{
    const current=e.current||[];
    let rows="";
    for(let s=0;s<e.sets;s++){
      const d=current[s]||{};
      rows+=`<div class="set-row smart-set-row" data-e="${i}" data-s="${s}"><b>${s+1}</b><input class="smart-weight" inputmode="decimal" placeholder="kg" value="${esc(d.weight??"")}"><input class="smart-reps" inputmode="numeric" placeholder="${e.min}-${e.max}" value="${esc(d.reps??"")}"><input class="smart-rir" inputmode="numeric" placeholder="${e.rir}" value="${esc(d.rir??e.rir??"")}"><button class="done ${d.done?"completed":""}" type="button">${d.done?"✓":"✓"}</button></div>`;
    }
    return `<div class="result-exercise"><img src="${esc(exerciseImage(e))}" alt="Imagem de ${esc(e.name)}" onerror="this.src=PLACEHOLDER_EXERCISE_IMAGE"><div class="result-copy"><strong>${i+1}. ${esc(e.name)}</strong><div class="exercise-meta"><span class="pill">${esc(e.group)}</span><span class="pill">${esc(e.equipment||"")}</span></div><div>${e.sets} séries · ${e.min}-${e.max} reps · RIR ${e.rir} · ${r.rest}s</div></div><div class="smart-preview-sets" style="grid-column:1/-1"><div class="set-head"><span>#</span><span>Carga</span><span>Reps</span><span>RIR</span><span></span></div>${rows}</div></div>`;
  }).join("");
  $("smartResult").innerHTML=`<div class="card"><h2>${esc(r.name)}</h2><div class="muted">${esc(r.goal)} · ${r.time} min · ${esc(r.level)} · estimado ${r.estimatedMinutes} min · descanso ${r.rest}s</div>${exerciseHtml}<p><b>💡 Critérios usados</b><br>${esc(r.reason)}</p><div class="actions"><button class="primary" id="useSmartWorkoutBtn">✅ Usar este treino</button><button id="regenerateSmartBtn">🔄 Gerar outra opção</button><button id="adjustSmartBtn">✏️ Ajustar</button><button id="cancelSmartBtn">❌ Cancelar</button></div></div>`;
  window.__smart=r;
  $("smartResult").querySelectorAll(".smart-set-row").forEach(row=>{
    const ei=+row.dataset.e,si=+row.dataset.s,inputs=row.querySelectorAll("input");
    inputs.forEach((inp,ii)=>inp.onchange=()=>{r.exercises[ei].current=r.exercises[ei].current||[];r.exercises[ei].current[si]=r.exercises[ei].current[si]||{};r.exercises[ei].current[si][["weight","reps","rir"][ii]]=inp.value});
    row.querySelector(".done").onclick=()=>{const vals=[...inputs].map(x=>x.value);if(!vals[0]||!vals[1])return toast("Informe carga e repetições.");r.exercises[ei].current=r.exercises[ei].current||[];r.exercises[ei].current[si]={weight:vals[0],reps:vals[1],rir:vals[2]||r.exercises[ei].rir,done:true};row.querySelector(".done").classList.add("completed");toast("✓ Série registrada no treino gerado")};
  });
  $("useSmartWorkoutBtn").onclick=useSmartWorkout;$("regenerateSmartBtn").onclick=generateSmart;
  $("adjustSmartBtn").onclick=()=>showView("smartView");$("cancelSmartBtn").onclick=()=>{$("smartResult").innerHTML="";clearSmartStatus()};
}
async function useSmartWorkout(){
  const r=window.__smart;if(!r)return;
  const copy=r.exercises.map(e=>({...e,id:e.id||uid(),custom:false,rest:r.rest}));
  state.exercises.A=copy.map(e=>({...e,group:e.group,custom:false}));
  state.workout="A";state.nextWorkout="B";
  audit("CREATE","ai_generated_workout",r.id,null,r);
  if(sb&&currentUser){
    try{
      const {data:w,error}=await sb.from("workouts").insert({id:uid(),user_id:currentUser.id,name:r.name,workout_type:"SMART",is_active:true}).select().single();
      if(error)throw error;
      const rows=copy.map((e,i)=>({workout_id:w.id,exercise_id:e.id,position:i,sets:e.sets,min_reps:e.min,max_reps:e.max,rir:e.rir,rest_seconds:e.rest}));
      const ins=await sb.from("workout_exercises").insert(rows);
      if(ins.error)throw ins.error;
    }catch(e){console.warn("Não foi possível salvar o treino normalizado; snapshot local será mantido.",e)}
  }
  await save();toast("Treino salvo e carregado na área de treino.");showView("workoutView");
}
async function askAI(prompt){
  if(!prompt)return;
  if(!sb){toast("Configure o Supabase para usar a IA.");return}
  addBubble("user",prompt);addBubble("ai","Pensando...");
  const context={question:prompt,workout:state.workout,exercises:(state.exerciseBank.length?state.exerciseBank:allExercises()).slice(0,100),recentSessions:state.sessions.slice(-5),settings:{defaultRest:getRestSeconds()}};
  try{
    const {data,error}=await sb.functions.invoke("ai-chat",{body:context});
    const bubbles=[...document.querySelectorAll(".bubble.ai")];
    const answer=data?.answer||"";
    if(error){
      backendStatus.ai="error";
      const detail=error?.context?.body?.error||error?.message||"Erro desconhecido";
      if(bubbles.length)bubbles.at(-1).textContent=`IA indisponível: ${detail}`;
      return;
    }
    if(!answer){
      backendStatus.ai="error";
      if(bubbles.length)bubbles.at(-1).textContent="A função da IA respondeu sem conteúdo. Verifique a Edge Function ai-chat e o secret OPENAI_API_KEY.";
      return;
    }
    backendStatus.ai="ok";
    if(bubbles.length)bubbles.at(-1).textContent=answer;
    state.ai.push({id:uid(),date:new Date().toISOString(),question:prompt,answer});await save();
  }catch(e){
    backendStatus.ai="error";
    const bubbles=[...document.querySelectorAll(".bubble.ai")];
    if(bubbles.length)bubbles.at(-1).textContent=`IA indisponível: ${e?.message||e}`;
    console.error("Pergunte à IA:",e);
  }
}
function addBubble(type,text){const el=document.createElement("div");el.className=`bubble ${type}`;el.textContent=text;$("aiMessages").appendChild(el);el.scrollIntoView({behavior:"smooth"})}

function initAudio(){if(!state.settings.soundEnabled)return Promise.resolve(false);try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")return audioCtx.resume().then(()=>audioCtx.state==="running");return Promise.resolve(audioCtx.state==="running")}catch(e){return Promise.resolve(false)}}
function beep(cycle=timerCycle){if(cycle!==timerCycle||!state.settings.soundEnabled||!audioCtx||audioCtx.state!=="running")return;const now=audioCtx.currentTime;[[0,660],[.18,880],[.36,660]].forEach(([o,f])=>{const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.frequency.value=f;osc.type="sine";g.gain.setValueAtTime(.0001,now+o);g.gain.exponentialRampToValueAtTime(.18,now+o+.02);g.gain.exponentialRampToValueAtTime(.0001,now+o+.16);osc.connect(g).connect(audioCtx.destination);osc.start(now+o);osc.stop(now+o+.2)})}
function timerRender(){$("time").textContent=fmtTime(timer.remaining);$("timerState").textContent=timer.running?"Descansando…":timer.remaining===0?"Descanso concluído":"Pronto"}
async function startTimer(sec=getRestSeconds()){await initAudio();clearInterval(timer.id);timerCycle++;const cycle=timerCycle;timer.remaining=Math.max(1,Number(sec)||getRestSeconds());timer.running=true;timerRender();timer.id=setInterval(()=>{if(!timer.running)return;timer.remaining--;if(timer.remaining<=0){clearInterval(timer.id);timer.id=null;timer.running=false;timer.remaining=0;timerRender();beep(cycle);navigator.vibrate?.([200,100,200]);toast("🔊 Descanso finalizado")}else timerRender()},1000)}
function pauseTimer(){clearInterval(timer.id);timer.id=null;timer.running=false;timerCycle++;timerRender()}
function resetTimer(){pauseTimer();timer.remaining=getRestSeconds();timerRender()}

function exportBackup(){sanitizeState();const payload={format:"meu-treino-backup",version:7,exportedAt:new Date().toISOString(),state,photos:state.photos};const blob=new Blob([JSON.stringify(payload)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`meu-treino-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("Backup exportado.")}
async function importBackupFile(file){try{const d=JSON.parse(await file.text());if(d.format!=="meu-treino-backup")throw Error();if(!confirm("Importar este backup substituirá os dados locais. Continuar?"))return;state=Object.assign(state,d.state);state.photos=d.photos||[];sanitizeState();for(const p of state.photos)await photoPut(p);await save();renderAll();toast("Backup restaurado.")}catch(e){toast("Backup inválido ou corrompido.")}}
async function clearLocal(){if(!confirm("Limpar somente os dados deste dispositivo? Os dados da conta permanecerão na nuvem."))return;indexedDB.deleteDatabase(DB_NAME);location.reload()}

function editSettings(){
 const old=state.settings.defaultRest;
 $("defaultRest").onchange=async e=>{const v=Math.round(Number(e.target.value));if(!Number.isFinite(v)||v<5||v>600){e.target.value=old;return toast("Use um valor entre 5 e 600 segundos.")}state.settings.defaultRest=v;timer.remaining=v;timerRender();await save();renderWorkout();toast(`Descanso padrão: ${v}s`)}
}

async function startWorkout(){state._workoutStart=new Date().toISOString();await save();showView("workoutView");await initAudio();toast(`Treino ${state.workout} iniciado.`)}

function setDefaults(){const d=new Date();$("weightDate").value=today();$("weightTime").value=d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});$("photoDate").value=today()}

function wire(){
 document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
 $("startWorkoutBtn").onclick=startWorkout;$("finishWorkoutBtn").onclick=finishWorkout;$("tabA").onclick=async()=>{state.workout="A";await save();renderWorkout()};$("tabB").onclick=async()=>{state.workout="B";await save();renderWorkout()};
 $("startTimer").onclick=()=>startTimer();$("pauseTimer").onclick=pauseTimer;$("resumeTimer").onclick=()=>{if(timer.remaining>0&&!timer.running)startTimer(timer.remaining)};$("resetTimer").onclick=resetTimer;$("plus10").onclick=()=>{timer.remaining+=10;timerRender()};$("plus30").onclick=()=>{timer.remaining+=30;timerRender()};
 $("settingsBtn").onclick=()=>showView("settingsView");$("exerciseHistorySelect").onchange=renderExerciseHistory;
 $("weightInput").oninput=updateBmiPreview;$("heightInput").oninput=updateBmiPreview;$("addWeightBtn").onclick=addWeight;$("saveHeightBtn").onclick=saveHeight;
 $("addPhotoBtn").onclick=addPhoto;$("prevMonth").onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar()};$("nextMonth").onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar()};
 $("defaultRest").onchange=async e=>{const v=Math.round(Number(e.target.value));if(!Number.isFinite(v)||v<5||v>600){e.target.value=getRestSeconds();return toast("Use um valor entre 5 e 600 segundos.")}state.settings.defaultRest=v;timer.remaining=v;timerRender();await save();renderWorkout();toast(`Descanso padrão: ${v}s`)};
 $("soundEnabled").onchange=async e=>{state.settings.soundEnabled=e.target.checked;if(e.target.checked)await initAudio();await save()};$("autoStartRest").onchange=async e=>{state.settings.autoStartRest=e.target.checked;await save()};$("themeSelect").onchange=async e=>{state.settings.theme=e.target.value;applyTheme();await save()};
 $("exportBackup").onclick=exportBackup;$("importBackup").onclick=()=>$("backupFile").click();$("backupFile").onchange=e=>e.target.files[0]&&importBackupFile(e.target.files[0]);$("addExerciseBtn").onclick=addExercise;
 $("exerciseSearch").oninput=renderExercises;$("exerciseFilter").onchange=renderExercises;$("syncBtn").onclick=syncNow;$("trashBtn").onclick=renderTrash;$("auditBtn").onclick=renderAudit;$("clearLocalBtn").onclick=clearLocal;$("logoutBtn").onclick=logout;
 $("loginTab").onclick=()=>{$("loginTab").classList.add("active");$("signupTab").classList.remove("active");$("loginForm").classList.remove("hidden");$("signupForm").classList.add("hidden")};$("signupTab").onclick=()=>{$("signupTab").classList.add("active");$("loginTab").classList.remove("active");$("signupForm").classList.remove("hidden");$("loginForm").classList.add("hidden")};
 $("loginForm").onsubmit=login;$("signupForm").onsubmit=signup;$("forgotPasswordBtn").onclick=forgot;$("passkeyLoginBtn").onclick=loginWithPasskey;$("rememberAccount").onchange=async e=>{state.settings.rememberAccount=e.target.checked;localStorage.setItem("meuTreinoRemember",String(e.target.checked));await dbSet(DATA_KEY,state)};
 $("aiForm").onsubmit=e=>{e.preventDefault();const q=$("aiInput").value.trim();$("aiInput").value="";askAI(q)};document.querySelectorAll("[data-ai]").forEach(b=>b.onclick=()=>askAI(b.dataset.ai));
 $("smartTime").onchange=()=>{$("smartCustomTimeWrap").classList.toggle("hidden",$("smartTime").value!=="custom")};$("generateSmartBtn").onclick=generateSmart;
 document.querySelectorAll(".bottom-nav button").forEach(b=>b.onclick=()=>showView(b.dataset.view));
}
function renderAIHistory(){if(state.ai?.length)$("aiMessages").innerHTML=state.ai.slice(-10).map(x=>`<div class="bubble user">${esc(x.question)}</div><div class="bubble ai">${esc(x.answer)}</div>`).join("")}
window.addEventListener("online",()=>{online=true;toast("🟢 Internet reconectada");syncNow().catch(console.warn)});
window.addEventListener("offline",()=>{online=false;toast("🔴 Offline: dados serão mantidos localmente.")});
window.addEventListener("DOMContentLoaded",async()=>{await loadState();sanitizeState();if($("rememberAccount"))$("rememberAccount").checked=state.settings.rememberAccount!==false;wire();setDefaults();timer.remaining=getRestSeconds();timerRender();renderAIHistory();if(/iPhone|iPad|iPod/i.test(navigator.userAgent)&&!navigator.standalone)$("installBox").style.display="block";else $("installBox").style.display="none";navigator.serviceWorker?.register("./sw.js").catch(console.warn);await setupAuth()});
