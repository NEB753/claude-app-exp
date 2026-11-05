"use strict";
/* Strata main: parameter routing, generation, touch input (sculpt dabs, double-tap focus, long-press quick actions), autosave, loop, boot. */
let regenT=0,regenArmed=true,recolorQ=false;
function regenerate(push=true){const old=H?H.slice():null;if(push)pushUndo();genHeights();genMoist();clearLayers(false);S.structs=[];S.source='gen';fluidSync();updateAll();morphFrom(old);saveSoon();crumb()}
function regenSoon(commit){
  if(regenArmed){pushUndo();regenArmed=false}clearTimeout(regenT);
  if(N>257&&!commit){drawPreview();return}
  regenT=setTimeout(()=>{const old=H.slice();genHeights();genMoist();clearLayers(false);S.structs=[];fluidSync();updateAll();if(commit)morphFrom(old);saveSoon();drawPreview()},N>257?0:90);
}
function recolorSoon(){if(recolorQ)return;recolorQ=true;requestAnimationFrame(()=>{recolorQ=false;updateAll();renderFacts();saveSoon()})}
function applyPreset(name){const p=PRESETS[name];if(!p)return false;pushUndo();S.preset=name;S.shape={cone:0,crater:0,...p.shape};S.biome={...p.biome};S.macro={x:clamp(p.shape.ridges/.9,0,1),y:clamp((p.shape.warp-.12)/.55,0,1)};regenerate(false);frame(true);renderSheet();return true}
function setRes(r){if(r===N)return;pushUndo();H=resample(H,N,r);PC=resample(PC,N,r,3);PW=resample(PW,N,r);SM=resample(SM,N,r);WM=resample(WM,N,r);N=r;genMoist();buildGeometry();terrain.material=MATS[S.view.look]||MATS.natural;fluidSync();updateAll()}
async function setQuality(q){
  if(!QUALITY[q]||q===S.quality)return;S.quality=q;const Q=QUALITY[q];
  if(SR.running)simStop(false);FL.R=0;LV.R=0;SN.R=0;WD.R=0;for(const k in OV)hideOverlay(k);
  busy(true,'Switching to '+Q.label+'…',.4);await nextFrame();
  try{setRes(Q.res);applyQuality();if(S.exp.tex>Q.tex)S.exp.tex=Q.tex;ensureScatterMeshes();updateWater();buildScatter()}finally{busy(false)}
  crumb();renderSheet();saveSoon();toast(Q.label+' · '+Q.res+'² grid','ok');
}
function onParam(k,v,commit){
  const [g,f]=k.split('.');
  if(g==='shape'){
    if(f==='maxH'){const r=S.shape.maxH/prevMaxH;for(let i=0;i<H.length;i++)H[i]*=r;prevMaxH=S.shape.maxH;fluidSync();updateAll();saveSoon()}
    else if(f==='world'){updateAll();placeCamera();saveSoon()}
    else{if(PRESETS[S.preset]&&PRESETS[S.preset].shape[f]!==S.shape[f])S.preset='Custom';regenSoon(commit)}
    renderFacts();return}
  if(g==='biome'){recolorSoon();if(f==='sea'){updateWater();scatterSoon(500)}return}
  if(g==='view'){if(f==='vex'){updateAll();placeCamera()}else if(f==='contours')updateContourInterval();else if(f==='anim')touch();else{rebuildBase();updateWater();fitSun()}saveSoon();return}
  if(g==='brush'){drawHud();placeRing(hoverP);return}
  if(g==='scatter'){scatterSoon(commit?0:220);saveSoon();return}
  if(g==='exp'){if(f==='depth'){rebuildBase();updateWater()}if(['target','fmt','base'].includes(f))renderSheet();else renderExportFacts();saveSoon();return}
  if(g==='auto'){renderHead();if(S.auto)scheduleAuto();saveSoon();return}
  if(g==='photo'){if(f==='pin')$('#refPin').hidden=!S.photo.pin||!REF.url;saveSoon();return}
  if(g==='sim'||g==='fluid'||g==='lava'||g==='snow'||g==='wind'||g==='ero'){saveSoon();return}
  saveSoon();
}

/* ---------------- input ---------------- */
const ptrs=new Map();let gesture=null,hoverP=null,lpT=0,lastTap={t:0,x:0,y:0},sculptHideT=0;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  closePanel(true);closeQuick();camAnim=null;try{canvas.setPointerCapture(e.pointerId)}catch(_){}ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,t0:performance.now()});touch();clearTimeout(lpT);
  if(ptrs.size>=2){if(stroke){if(performance.now()-stroke.t0<260&&undoS.length){restore(undoS.pop());syncUndo()}endStroke(true)}startNav();return}
  const sculpt=S.mode==='sculpt'&&(e.pointerType!=='mouse'||e.button===0)&&!e.altKey;
  if(sculpt){const p=pick(e.clientX,e.clientY);if(p){
    if(S.tool==='spring'){addSpring(p);return}
    if(S.tool==='vent'){addVent(p);return}
    if(S.tool==='stamp'){pushUndo();stroke={t0:performance.now(),noise:makeNoise(1),rng:Math.random};stampAt(p);stroke=null;afterEdit();placeRing(p);haptic(14);return}
    beginStroke(p,e);return}}
  gesture={kind:(e.button===1||e.shiftKey||(e.pointerType==='mouse'&&e.button===2&&e.ctrlKey))?'pan':'orbit',x:e.clientX,y:e.clientY};
  if(e.pointerType!=='mouse'||e.button===0)lpT=setTimeout(()=>{const pt=ptrs.get(e.pointerId);if(pt&&ptrs.size===1&&Math.hypot(pt.x-pt.x0,pt.y-pt.y0)<9){gesture=null;openQuick(pt.x,pt.y)}},480);
});
canvas.addEventListener('pointermove',e=>{
  const pt=ptrs.get(e.pointerId);
  if(!pt){if(S.mode==='sculpt'&&e.pointerType==='mouse'){hoverP=pick(e.clientX,e.clientY);placeRing(hoverP,['spring','vent'].includes(S.tool)?S.shape.world*.01:null);showReadout(hoverP)}return}
  const dx=e.clientX-pt.x,dy=e.clientY-pt.y;pt.x=e.clientX;pt.y=e.clientY;if(Math.hypot(pt.x-pt.x0,pt.y-pt.y0)>9)clearTimeout(lpT);
  if(stroke){stroke.cx=e.clientX;stroke.cy=e.clientY;stroke.pressure=e.pointerType==='pen'?e.pressure:0;return}
  if(gesture&&gesture.kind==='multi'){navMulti();return}
  if(!gesture)return;const k=SET.sens||1;
  if(gesture.kind==='orbit'){cam.theta-=dx*.006*k;cam.phi-=dy*.005*k*(SET.invertY?-1:1);placeCamera()}else panBy(dx,dy);
});
function endPtr(e){clearTimeout(lpT);const pt=ptrs.get(e.pointerId);ptrs.delete(e.pointerId);
  if(stroke&&ptrs.size===0)endStroke();
  if(pt&&!stroke&&gesture&&gesture.kind==='orbit'&&ptrs.size===0&&e.type==='pointerup'){const moved=Math.hypot(pt.x-pt.x0,pt.y-pt.y0),dt=performance.now()-pt.t0;
    if(moved<10&&dt<300){const now=performance.now();if(now-lastTap.t<320&&Math.hypot(pt.x-lastTap.x,pt.y-lastTap.y)<34){lastTap.t=0;const p=pick(pt.x,pt.y);if(p){focusAt(p);haptic(10)}}else lastTap={t:now,x:pt.x,y:pt.y}}}
  if(ptrs.size===0)gesture=null;else if(gesture&&gesture.kind==='multi'&&ptrs.size===1){const [p]=ptrs.values();gesture={kind:'orbit',x:p.x,y:p.y}}}
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('pointerleave',()=>{if(!stroke&&S.mode==='sculpt'&&!ptrs.size){placeRing(null);$('#readout').hidden=true}});
canvas.addEventListener('wheel',e=>{e.preventDefault();camAnim=null;cam.r*=Math.exp(e.deltaY*.0012);placeCamera()},{passive:false});
function startNav(){clearTimeout(lpT);const a=[...ptrs.values()];gesture={kind:'multi',d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mx:(a[0].x+a[1].x)/2,my:(a[0].y+a[1].y)/2,ang:Math.atan2(a[1].y-a[0].y,a[1].x-a[0].x)}}
function navMulti(){
  const a=[...ptrs.values()];if(a.length<2)return;
  const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2,ang=Math.atan2(a[1].y-a[0].y,a[1].x-a[0].x);
  if(gesture.d>0&&d>0)cam.r*=gesture.d/d;let da=ang-gesture.ang;if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;cam.theta+=da;
  cam.phi-=(my-gesture.my)*.004*(SET.invertY?-1:1);panBy(mx-gesture.mx,0);Object.assign(gesture,{d,mx,my,ang});placeCamera();
}
function panBy(dx,dy){const k=cam.r*.0016*(SET.sens||1),s=Math.sin(cam.theta),c=Math.cos(cam.theta);cam.target.x-=c*dx*k+s*dy*k;cam.target.z-=-s*dx*k+c*dy*k;placeCamera()}
function beginStroke(p,e){
  pushUndo();stroke={t0:performance.now(),last:performance.now(),cx:e.clientX,cy:e.clientY,flatH:hAt(p.gx,p.gy),noise:makeNoise((Math.random()*1e9)|0),rng:mulberry32((Math.random()*1e9)|0),lp:p,pressure:e.pointerType==='pen'?e.pressure:0};
  applyBrush(p,1);placeRing(p);showReadout(p);
  clearTimeout(sculptHideT);sculptHideT=setTimeout(()=>{if(stroke)document.body.classList.add('sculpting')},260);
}
function afterEdit(){if(baseDirty)rebuildBase();computeStats();updateWater();fluidSync();scatterSoon(160);saveSoon();renderFacts()}
function endStroke(cancel){stroke=null;clearTimeout(sculptHideT);document.body.classList.remove('sculpting');afterEdit();if(!hoverP){placeRing(null);$('#readout').hidden=true}}
function strokeTick(now){
  if(!stroke)return;const dt=Math.min(.05,(now-stroke.last)/1000);stroke.last=now;
  const p=pick(stroke.cx,stroke.cy);if(!p)return;const W=S.shape.world,spacing=Math.max(S.brush.size*.22,W/(N-1)*.8),lp=stroke.lp,dist=Math.hypot(p.x-lp.x,p.z-lp.z);
  if(dist>=spacing){const n=Math.min(40,Math.floor(dist/spacing));for(let i=1;i<=n;i++){const t=i*spacing/dist,x=lerp(lp.x,p.x,t),z=lerp(lp.z,p.z,t);const ip={x,z,gx:(x/W+.5)*(N-1),gy:(z/W+.5)*(N-1)};applyBrush(ip,1);stroke.lp=ip}}
  else if(S.brush.hold&&['raise','lower','smooth','roughen','paint','plant','erode','terrace','flatten'].includes(S.tool))applyBrush(p,dt*5);
  placeRing(p);showReadout(p);
}
function showReadout(p){const el=$('#readout');if(!p||SR.running){el.hidden=true;return}const h=hAt(p.gx,p.gy),sl=slopeDeg(p.gx,p.gy);el.textContent=`${fmtLen(h)} · ${Math.round(sl)}° · ⌀ ${fmtLen(S.brush.size*2)}`;el.hidden=false}

/* ---------------- quick actions (long-press the terrain) ---------------- */
function openQuick(x,y){
  const p=pick(x,y);if(!p)return;haptic(16);const q=$('#quick');
  const acts=[['Focus',IC.focus,()=>focusAt(p)],['Spring',IC.spring,()=>{addSpring(p);if(S.tab!=='simulate')switchTab('simulate','water')}],['Lava vent',IC.vent,()=>{addVent(p);if(S.tab!=='simulate')switchTab('simulate','lava')}],
    [STAMPS[S.stamp],IC.stamp,()=>{pushUndo();stroke={rng:Math.random};stampAt(p);stroke=null;afterEdit()}],['Cabin',IC.cabin,()=>{if(!S.structs.length)S.structs=structList.slice();S.structs.push({u:p.u,v:p.v,type:'cabin',rot:Math.random()*6.28});S.scatter.on=true;S.scatter.types.structure.on=true;buildScatter();saveSoon();toast('Cabin placed','ok')}],
    ['Info',IC.info,()=>toast(`${fmtLen(hAt(p.gx,p.gy))} high · ${Math.round(slopeDeg(p.gx,p.gy))}° slope${hAt(p.gx,p.gy)<seaLevel()?' · under water':''}`)]];
  const R=86,n=acts.length,a0=-Math.PI*.92,a1=-Math.PI*.08;q.style.left=x+'px';q.style.top=y+'px';
  q.innerHTML='<i class="dot"></i>'+acts.map(([l,ic],i)=>`<button class="glass press" data-q="${i}" aria-label="${esc(l)}">${svg(ic)}<small>${esc(l)}</small></button>`).join('');
  const bs=$$('button',q);bs.forEach((b,i)=>{const a=lerp(a0,a1,i/(n-1)),bx=clamp(x+Math.cos(a)*R,34,innerWidth-34)-x,by=clamp(y+Math.sin(a)*R,40,innerHeight-40)-y;b.style.transitionDelay=(i*25)+'ms';b.onclick=()=>{closeQuick();acts[i][2]()};requestAnimationFrame(()=>{b.style.transform=`translate(${bx}px,${by}px) scale(1)`})});
  q.classList.add('on');$('#menuLayer').classList.add('on');$('#menuLayer').onpointerdown=e=>{if(e.target===$('#menuLayer'))closeQuick()};q.style.zIndex=45;
}
function closeQuick(){const q=$('#quick');if(!q.classList.contains('on'))return;q.classList.remove('on');$$('button',q).forEach(b=>{b.style.transitionDelay='0ms';b.style.transform='translate(0,0) scale(.3)'});setTimeout(()=>{if(!q.classList.contains('on'))q.innerHTML=''},300);if(!popEl)$('#menuLayer').classList.remove('on')}

addEventListener('keydown',e=>{
  if(e.target.closest&&e.target.closest('textarea,input'))return;
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
  if(e.key==='['||e.key===']'){S.brush.size=clamp(S.brush.size*(e.key===']'?1.15:.87),5,S.shape.world*.3);drawHud();placeRing(hoverP);return}
  if(e.key===' '&&S.tab==='simulate'){e.preventDefault();const k=S.sub.sim;if(SR.running&&SR.kind===k)simStop(false);else simStart(k);return}
  if(e.key==='f'){frame(true);return}
  const t=TOOLS[+e.key-1];if(t)setTool(t[0]);if(e.key==='0')setTool(TOOLS[9][0]);
});
$('#undo').onclick=undo;$('#redo').onclick=redo;

/* ---------------- autosave ---------------- */
let saveT=0;
function saveSoon(){clearTimeout(saveT);saveT=setTimeout(()=>{saveProject(false).catch(()=>{})},1500)}
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveProject(true).catch(()=>{});else touch()});

/* ---------------- loop & boot ---------------- */
let lastAnim=0;
function loop(now){
  camTick(now);morphTick(now);strokeTick(now);simTick(now);
  const idle=now-lastInteract>15000;
  if(S.view.anim&&waterMesh&&waterMesh.visible&&!idle&&!document.hidden&&now-lastAnim>33){lastAnim=now;waterNTex.offset.x=(now*.000012)%1;waterNTex.offset.y=(now*.000007)%1;dirty=true}
  if(dirty){dirty=false;renderer.render(scene,camera)}
  requestAnimationFrame(loop);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{applyTheme()});
new MutationObserver(()=>applyTheme()).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
(async function boot(){
  if(!window.THREE)return;
  applySettings();measureInsets();
  const restored=await loadCurrent();
  if(!restored){S=DEF();S.name='My first terrain';N=QUALITY[S.quality].res;genHeights();clearLayers(false);curId=newId()}
  if(!S.graph)S.graph=GRAPH_TEMPLATES['Alpine range']();
  if(!PC||PC.length!==N*N*3||!SM||SM.length!==N*N||!WM||WM.length!==N*N)clearLayers(false);
  S.mode='orbit';prevMaxH=S.shape.maxH;genMoist();
  applyTheme();buildGeometry();terrain.material=MATS[S.view.look]||MATS.natural;applyQuality();updateAll();frame();
  ensureScatterMeshes();buildScatter();updateSpringMarkers();
  setMode('orbit');sheetState=DETENT_DEFAULT[S.tab]||'half';layoutSheet();renderSheet('enter');syncUndo();
  requestAnimationFrame(loop);
  toast(restored?'Welcome back · '+S.name:'Drag to orbit · double-tap to zoom in · long-press for quick actions');
  if(!restored)saveProject(true).catch(()=>{});
})();
