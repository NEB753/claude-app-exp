"use strict";
/* Strata main: parameter routing, generation, input, persistence (IndexedDB), render loop and boot. */
let regenT=0,regenArmed=true,recolorQ=false;
function regenerate(push=true){if(push)pushUndo();genHeights();genMoist();clearLayers(false);S.structs=[];S.source='gen';fluidSync();updateAll();saveSoon();crumb()}
function regenSoon(commit){
  if(regenArmed){pushUndo();regenArmed=false}clearTimeout(regenT);
  if(N>257&&!commit){drawPreview();return}
  regenT=setTimeout(()=>{regenerate(false);drawPreview()},N>257?0:90);
}
function recolorSoon(){if(recolorQ)return;recolorQ=true;requestAnimationFrame(()=>{recolorQ=false;updateAll();renderFacts();saveSoon()})}
function applyPreset(name){const p=PRESETS[name];if(!p)return false;pushUndo();S.preset=name;S.shape={cone:0,crater:0,...p.shape};S.biome={...p.biome};S.macro={x:clamp(p.shape.ridges/.9,0,1),y:clamp((p.shape.warp-.12)/.55,0,1)};regenerate(false);frame();renderSheet();return true}
function setRes(r){if(r===N)return;pushUndo();H=resample(H,N,r);PC=resample(PC,N,r,3);PW=resample(PW,N,r);SM=resample(SM,N,r);WM=resample(WM,N,r);N=r;genMoist();buildGeometry();fluidSync();updateAll()}
async function setQuality(q){
  if(!QUALITY[q]||q===S.quality)return;S.quality=q;const Q=QUALITY[q];
  if(FL.running)fluidSetRunning(false);FL.R=0;
  busy(true,'Switching to '+Q.label+'…',.4);await nextFrame();
  try{setRes(Q.res);applyQuality();if(S.exp.tex>Q.tex)S.exp.tex=Q.tex;ensureScatterMeshes();updateWater();buildScatter()}finally{busy(false)}
  crumb();renderSheet();saveSoon();toast(Q.label+' · '+Q.res+'² grid');
}
function startOver(){pushUndo();const keepQ=S.quality,tab=S.tab;S=DEF();S.quality=keepQ;S.tab=tab;if(N!==QUALITY[keepQ].res){N=QUALITY[keepQ].res;buildGeometry()}
  S.graph=GRAPH_TEMPLATES['Alpine range']();nodeCache.clear();FL.running=false;FL.R=0;$('#simChip').hidden=true;regenerate(false);updateSpringMarkers();setLook('natural');frame();renderSheet();toast('Fresh start')}
function onParam(k,v,commit){
  const [g,f]=k.split('.');
  if(g==='shape'){
    if(f==='maxH'){const r=S.shape.maxH/prevMaxH;for(let i=0;i<H.length;i++)H[i]*=r;prevMaxH=S.shape.maxH;fluidSync();updateAll();saveSoon()}
    else if(f==='world'){updateAll();placeCamera();saveSoon()}
    else{S.preset=S.preset==='Custom'||PRESETS[S.preset]?(S.preset==='Custom'?'Custom':S.preset):S.preset;regenSoon(commit)}
    renderFacts();return}
  if(g==='biome'){recolorSoon();if(f==='sea'){updateWater();scatterSoon(500)}return}
  if(g==='view'){if(f==='vex'){updateAll();placeCamera()}else if(f==='contours'){updateContourInterval()}else if(f==='anim'){touch()}else{rebuildBase();updateWater();fitSun()}saveSoon();return}
  if(g==='brush'){placeRing(hoverP);return}
  if(g==='scatter'){scatterSoon(commit?0:200);saveSoon();return}
  if(g==='exp'){if(f==='depth'){rebuildBase();updateWater()}if(f==='fmt'||f==='base')renderSheet();else renderExportFacts();saveSoon();return}
  if(g==='auto'){renderHead();if(S.auto)scheduleAuto();saveSoon();return}
  if(g==='photo'){if(f==='pin'){$('#refPin').hidden=!S.photo.pin||!REF.url}saveSoon();return}
  saveSoon();
}

/* ---------------- input ---------------- */
const ptrs=new Map();let gesture=null,hoverP=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  closePanel();try{canvas.setPointerCapture(e.pointerId)}catch(_){}ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});touch();
  if(ptrs.size>=2){if(stroke){if(performance.now()-stroke.t0<260&&undoS.length){restore(undoS.pop());syncUndo()}endStroke(true)}startNav();return}
  const sculpt=S.mode==='sculpt'&&(e.pointerType!=='mouse'||e.button===0)&&!e.altKey;
  if(sculpt){const p=pick(e.clientX,e.clientY);if(p){
    if(S.tool==='spring'){addSpring(p);gesture=null;return}
    if(S.tool==='stamp'){pushUndo();stroke={t0:performance.now(),noise:makeNoise(1),rng:Math.random,baseH:hAt(p.gx,p.gy)};stampAt(p);stroke=null;afterEdit();placeRing(p);return}
    beginStroke(p,e);return}}
  gesture={kind:(e.button===1||e.shiftKey||(e.pointerType==='mouse'&&e.button===2&&e.ctrlKey))?'pan':'orbit',x:e.clientX,y:e.clientY};
});
canvas.addEventListener('pointermove',e=>{
  const pt=ptrs.get(e.pointerId);
  if(!pt){if(S.mode==='sculpt'&&e.pointerType==='mouse'){hoverP=pick(e.clientX,e.clientY);placeRing(hoverP,S.tool==='spring'?S.shape.world*.01:null);showReadout(hoverP)}return}
  const dx=e.clientX-pt.x,dy=e.clientY-pt.y;pt.x=e.clientX;pt.y=e.clientY;
  if(stroke){stroke.cx=e.clientX;stroke.cy=e.clientY;stroke.pressure=e.pointerType==='pen'?e.pressure:0;return}
  if(gesture&&gesture.kind==='multi'){navMulti();return}
  if(!gesture)return;
  if(gesture.kind==='orbit'){cam.theta-=dx*.006;cam.phi-=dy*.005;placeCamera()}else panBy(dx,dy);
});
function endPtr(e){ptrs.delete(e.pointerId);if(stroke&&ptrs.size===0)endStroke();if(ptrs.size===0)gesture=null;else if(gesture&&gesture.kind==='multi'&&ptrs.size===1){const [p]=ptrs.values();gesture={kind:'orbit',x:p.x,y:p.y}}}
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('pointerleave',()=>{if(!stroke&&S.mode==='sculpt'&&!ptrs.size){placeRing(null);$('#readout').hidden=true}});
canvas.addEventListener('wheel',e=>{e.preventDefault();cam.r*=Math.exp(e.deltaY*.0012);placeCamera()},{passive:false});
function startNav(){const a=[...ptrs.values()];gesture={kind:'multi',d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mx:(a[0].x+a[1].x)/2,my:(a[0].y+a[1].y)/2,ang:Math.atan2(a[1].y-a[0].y,a[1].x-a[0].x)}}
function navMulti(){
  const a=[...ptrs.values()];if(a.length<2)return;
  const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2,ang=Math.atan2(a[1].y-a[0].y,a[1].x-a[0].x);
  if(gesture.d>0&&d>0)cam.r*=gesture.d/d;let da=ang-gesture.ang;if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;cam.theta+=da;
  cam.phi-=(my-gesture.my)*.004;panBy(mx-gesture.mx,0);Object.assign(gesture,{d,mx,my,ang});placeCamera();
}
function panBy(dx,dy){const k=cam.r*.0016,s=Math.sin(cam.theta),c=Math.cos(cam.theta);cam.target.x-=c*dx*k+s*dy*k;cam.target.z-=-s*dx*k+c*dy*k;placeCamera()}
function beginStroke(p,e){
  pushUndo();stroke={t0:performance.now(),last:performance.now(),cx:e.clientX,cy:e.clientY,flatH:hAt(p.gx,p.gy),noise:makeNoise((Math.random()*1e9)|0),rng:mulberry32((Math.random()*1e9)|0),p,pressure:e.pointerType==='pen'?e.pressure:0};
  applyBrush(p,.6);placeRing(p);showReadout(p);
}
function afterEdit(){if(baseDirty){rebuildBase()}computeStats();updateWater();fluidSync();if(S.tool==='plant'||S.scatter.on)scatterSoon(120);saveSoon();renderFacts()}
function endStroke(cancel){stroke=null;afterEdit();if(!hoverP){placeRing(null);$('#readout').hidden=true}}
function strokeTick(now){
  if(!stroke||!stroke.cx)return;const dt=Math.min(.05,(now-stroke.last)/1000);stroke.last=now;
  const p=pick(stroke.cx,stroke.cy);if(!p)return;stroke.p=p;applyBrush(p,dt*9);placeRing(p);showReadout(p);
}
function showReadout(p){
  const el=$('#readout');if(!p||FL.running){el.hidden=true;return}
  const h=hAt(p.gx,p.gy),sl=slopeDeg(p.gx,p.gy);
  el.textContent=`${fmt(h)} m · ${Math.round(sl)}° · ⌀ ${fmt(S.brush.size*2)} m`;el.hidden=false;
}
addEventListener('keydown',e=>{
  if(e.target.closest&&e.target.closest('textarea,input'))return;
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
  if(e.key==='['||e.key===']'){S.brush.size=clamp(S.brush.size*(e.key===']'?1.15:.87),5,S.shape.world*.3);placeRing(hoverP);return}
  if(e.key===' '&&S.tab==='fluid'){e.preventDefault();fluidSetRunning(!FL.running);return}
  const t=TOOLS[+e.key-1];if(t)setTool(t[0]);if(e.key==='0')setTool(TOOLS[9][0]);
});
$('#undo').onclick=undo;$('#redo').onclick=redo;

/* ---------------- persistence (IndexedDB, falls back silently) ---------------- */
const DB={p:null,open(){if(this.p)return this.p;this.p=new Promise((res,rej)=>{try{const r=indexedDB.open('strata',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}});return this.p},
  async get(k){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('kv').objectStore('kv').get(k);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)})},
  async set(k,v){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)})}};
let saveT=0;
function saveSoon(){clearTimeout(saveT);saveT=setTimeout(()=>{if(!H)return;const st=JSON.parse(JSON.stringify(S));DB.set('project',{S:st,N,H,PC:Uint8Array.from(PC),PW:Uint8Array.from(PW,v=>v*255),SM:Uint8Array.from(SM,v=>clamp(v*100,0,255)),WM:Uint8Array.from(WM,v=>v*255)}).catch(()=>{})},1200)}
async function load(){try{
  const d=await DB.get('project');if(!d||!d.S||!d.H||d.H.length!==d.N*d.N)return false;const def=DEF(),s=d.S;
  S={...def,...s,shape:{...def.shape,...s.shape},biome:{...def.biome,...s.biome},brush:{...def.brush,...s.brush},ero:{...def.ero,...s.ero},fluid:{...def.fluid,...s.fluid},view:{...def.view,...s.view},exp:{...def.exp,...s.exp},photo:{...def.photo,...s.photo},
    scatter:{on:s.scatter?s.scatter.on!==false:true,types:Object.fromEntries(Object.entries(scatterDefaults()).map(([k,v])=>[k,{...v,...(s.scatter&&s.scatter.types&&s.scatter.types[k])}]))}};
  if(!QUALITY[S.quality])S.quality=autoQuality();
  N=d.N;H=d.H;PC=Float32Array.from(d.PC);PW=Float32Array.from(d.PW,v=>v/255);SM=Float32Array.from(d.SM,v=>v/100);WM=Float32Array.from(d.WM,v=>v/255);return true;
}catch(e){return false}}

/* ---------------- loop & boot ---------------- */
let lastAnim=0;
function loop(now){
  strokeTick(now);fluidTick(now);
  const idle=now-lastInteract>15000;
  if(S.view.anim&&waterMesh&&waterMesh.visible&&!idle&&!document.hidden&&now-lastAnim>33){lastAnim=now;waterNTex.offset.x=(now*.000012)%1;waterNTex.offset.y=(now*.000007)%1;dirty=true}
  if(dirty){dirty=false;renderer.render(scene,camera)}
  requestAnimationFrame(loop);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)touch()});
(async function boot(){
  if(!window.THREE)return;
  measureInsets();
  const restored=await load();
  if(!restored){S=DEF();N=QUALITY[S.quality].res;genHeights();clearLayers(false)}
  if(!S.graph)S.graph=GRAPH_TEMPLATES['Alpine range']();
  if(!PC||PC.length!==N*N*3||!SM||SM.length!==N*N)clearLayers(false);
  S.mode='orbit';prevMaxH=S.shape.maxH;genMoist();
  applyTheme();buildGeometry();terrain.material=MATS[S.view.look]||MATS.natural;applyQuality();updateAll();frame();
  ensureScatterMeshes();buildScatter();updateSpringMarkers();
  setMode('orbit');sheetState=DETENT_DEFAULT[S.tab]||'half';layoutSheet();renderSheet();syncUndo();
  requestAnimationFrame(loop);
  toast(restored?'Welcome back. Your terrain was restored.':'Drag to orbit · pick a creation tool below');
})();
