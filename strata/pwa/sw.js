/* Terrain Gen offline cache. App code (page + scripts) is network-first so every update arrives immediately and the
   cache is only the offline fallback. Textures and three.js are cache-first (they never change for a given URL).
   The cache name carries a build id stamped by build-web.sh, so a new deploy clears the old one. */
const V='terraingen-__BUILD__';
const SHELL=['./','./index.html','js/core.js','js/audio.js','js/render.js','js/scatter.js','js/tools.js','js/fluid.js','js/sims.js','js/nodes.js','js/nodes2.js','js/photo.js','js/export.js','js/ai.js','js/jobs.js','js/ui.js','js/guides.js','js/fp.js','js/camera.js','js/home.js','js/town.js','js/help.js','js/desktop.js','js/main.js','https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).catch(()=>{}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.hostname==='api.anthropic.com')return;
  const code=r.mode==='navigate'||(u.origin===location.origin&&/\.(js|html|webmanifest)$|\/$/.test(u.pathname));
  if(code){e.respondWith(fetch(r,{cache:'no-cache'}).then(res=>{if(res.ok){const c=res.clone();caches.open(V).then(x=>x.put(r.mode==='navigate'?'./index.html':r,c))}return res}).catch(()=>caches.match(r.mode==='navigate'?'./index.html':r)));return}
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok&&(u.origin===location.origin||/cdnjs|jsdelivr|gstatic|googleapis|polyhaven/.test(u.hostname))){const c=res.clone();caches.open(V).then(x=>x.put(r,c))}return res})));
});
