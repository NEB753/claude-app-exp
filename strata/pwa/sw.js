/* Terrain Gen offline cache: the page is network-first (so updates arrive), scripts, fonts and three.js are cache-first. */
const V='terraingen-v1.1';
const SHELL=['./','./index.html','js/core.js','js/audio.js','js/render.js','js/scatter.js','js/tools.js','js/fluid.js','js/sims.js','js/nodes.js','js/nodes2.js','js/photo.js','js/export.js','js/ai.js','js/jobs.js','js/ui.js','js/guides.js','js/fp.js','js/camera.js','js/home.js','js/main.js','https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.hostname==='api.anthropic.com')return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(V).then(x=>x.put('./index.html',c));return res}).catch(()=>caches.match('./index.html')));return}
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok&&(u.origin===location.origin||/cdnjs|jsdelivr|gstatic|googleapis/.test(u.hostname))){const c=res.clone();caches.open(V).then(x=>x.put(r,c))}return res})));
});
