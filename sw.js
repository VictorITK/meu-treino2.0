const CACHE="meu-treino-v5";
const ASSETS=[
 "./","./index.html","./manifest.json","./icon-180.png","./icon-512.png",
 "./css/app.css","./js/app.js",
 "./images/exercises/supino-maquina.svg","./images/exercises/puxada-frontal.svg",
 "./images/exercises/remada-maquina.svg","./images/exercises/desenvolvimento.svg",
 "./images/exercises/rosca-biceps.svg","./images/exercises/triceps-maquina.svg",
 "./images/exercises/leg-press.svg","./images/exercises/extensora.svg",
 "./images/exercises/flexora.svg","./images/exercises/abdutora.svg",
 "./images/exercises/adutora.svg","./images/exercises/panturrilha.svg",
 "./images/exercises/generico.svg"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("meu-treino-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}
   return response;
 }).catch(()=>caches.match("./index.html"))));
});
