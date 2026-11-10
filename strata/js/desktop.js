"use strict";
/* Terrain Gen desktop workspace (wide screens): an Inspector column with a live minimap you can click to fly to,
   a height histogram with the sea line, precise numbers, quick world controls, layer toggles and a frame meter;
   plus a full keyboard map (press ? to see it). Hidden on phones, where the sheet carries everything. */
const DESK={fps:0,frames:0,t0:performance.now(),stats:null,open:true};
const isDesk=()=>matchMedia('(min-width:1100px) and (pointer:fine)').matches;
document.body.insertAdjacentHTML('beforeend',`<aside id="insp" class="glass" aria-label="Inspector" hidden>
  <div class="ih"><b>Inspector</b><span class="grow"></span><span class="tag" id="iFps">— fps</span><button class="ibtn press" id="iHide" aria-label="Hide inspector"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg></button></div>
  <div class="ib" id="iBody"></div></aside>
  <button id="inspShow" class="glass press" hidden aria-label="Show inspector"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m15 6-6 6 6 6"/></svg></button>
  <div id="keys" class="glass" hidden role="dialog" aria-label="Keyboard shortcuts"></div>`);
const KEYMAP=[['1–6','Create · Sculpt · Simulate · Biome · Towns · Export'],['N','New world'],['V','Variation (new seed)'],['S','Sculpt brush on / off'],['[  ]','Brush smaller / larger'],['Shift + [  ]','Strength down / up'],
  ['Ctrl/⌘ Z','Undo · Shift for redo'],['F','Frame the terrain'],['C','Camera & render mode'],['W','Walk in first person'],['H','Hide all panels'],['I','Inspector'],[',','Settings'],['P','Pick a photo'],['Space','Run / pause the simulation'],['?','This list']];
function renderInspector(){
  const b=$('#iBody');if(!b||$('#insp').hidden)return;const W=S.shape.world;
  b.innerHTML=`<canvas id="iMap" width="256" height="256" title="Click to fly there"></canvas>
  <div class="ilab">Heights <span id="iRange"></span></div><canvas id="iHist" width="300" height="70"></canvas>
  <div class="igrid" id="iStats"></div>
  <div class="ilab">World</div>
  <div class="row" style="grid-template-columns:70px 1fr auto"><label>Seed</label><input class="field" id="iSeed" inputmode="numeric" value="${S.seed}" style="height:30px;padding:4px 8px"><button class="btn plain press" id="iDice" style="min-width:0;min-height:30px;padding:4px 10px">${svg(IC.dice)}</button></div>
  ${sliderRow('shape.maxH','Max height',20,2500,5,null,null,m)}${sliderRow('shape.world','World size',400,12000,50,null,null,m)}${sliderRow('biome.sea','Sea level',0,.6,.005,null,null,v=>fmtLen(v*S.shape.maxH))}${sliderRow('shape.weather','Weathering',0,1,.01,null,.5,pct)}
  <div class="ilab">Layers</div>${tg('view.water','Water')}${tg('view.shadows','Shadows')}${tg('view.contours','Contours')}${tg('view.clouds','Cloud shadows')}${tg('scatter.on','Trees & props')}${tg('view.post','Render mode')}
  <div class="btns" style="margin-top:8px"><button class="btn plain press" id="iKeys">Shortcuts  ?</button><button class="btn plain press" id="iShot">Screenshot</button></div>`;
  bindSliders(b);bindToggles(b);
  const si=$('#iSeed',b);si.onchange=()=>{const v=parseInt(si.value,10);if(!isNaN(v)){S.seed=Math.abs(v)%1e9;regenerate()}};$('#iDice',b).onclick=()=>{newVariation();si.value=S.seed};
  $('#iKeys',b).onclick=toggleKeys;$('#iShot',b).onclick=()=>{if(typeof takePhoto==='function'){camEnter();setTimeout(takePhoto,400)}};
  const map=$('#iMap',b);map.onclick=e=>{const r=map.getBoundingClientRect(),u=(e.clientX-r.left)/r.width,v=(e.clientY-r.top)/r.height,W=S.shape.world;animateCam({r:cam.r,phi:cam.phi,theta:cam.theta,tx:(u-.5)*W,ty:hAt(u*(N-1),v*(N-1))*S.view.vex,tz:(v-.5)*W},700);sfx('pop')};
  DESK.stats=null;drawInspector();
}
function drawInspector(){
  if($('#insp').hidden||!H)return;DESK.stats=stats;const R=128,f=resample(H,N,R),mx=stats.hi||1;for(let k=0;k<f.length;k++)f[k]/=mx;
  const map=$('#iMap');if(map){const c=document.createElement('canvas');drawRelief(c,f,R);const x=map.getContext('2d');x.imageSmoothingEnabled=true;x.drawImage(c,0,0,256,256);
    const W=S.shape.world,u=cam.target.x/W+.5,v=cam.target.z/W+.5,a=-cam.theta;x.save();x.translate(u*256,v*256);x.rotate(a);x.fillStyle='rgba(255,214,120,.95)';x.beginPath();x.moveTo(0,-9);x.lineTo(6,7);x.lineTo(-6,7);x.closePath();x.fill();x.restore()}
  const hc=$('#iHist');if(hc){const x=hc.getContext('2d'),bins=new Float32Array(60);for(const v of H)bins[Math.min(59,Math.floor(v/(mx||1)*59.999))]++;let bm=0;for(const v of bins)bm=Math.max(bm,v);
    x.clearRect(0,0,300,70);const cs=getComputedStyle(document.documentElement),ac=cs.getPropertyValue('--accent').trim(),gd=cs.getPropertyValue('--gold').trim();
    for(let i=0;i<60;i++){const h=Math.sqrt(bins[i]/(bm||1))*64;x.fillStyle=ac;x.globalAlpha=.85;x.fillRect(i*5,68-h,4,h)}x.globalAlpha=1;
    const sx=seaLevel()/(mx||1)*300;if(S.biome.sea>0){x.fillStyle='#4aa3d8';x.fillRect(sx,0,2,70)}x.fillStyle=gd;x.fillRect(0,68,300,2)}
  const st=$('#iStats');if(st){const cnt=Object.values(scatterCounts).reduce((a,b)=>a+(b||0),0),W=S.shape.world;
    st.innerHTML=`<span>Area</span><b>${(W*W/1e6).toFixed(2)} km²</b><span>Low · high</span><b>${fmtLen(stats.lo)} · ${fmtLen(stats.hi)}</b><span>Under water</span><b>${Math.round(stats.water*100)}%</b><span>Grid</span><b>${N}² · ${(W/(N-1)).toFixed(1)} m</b><span>Triangles</span><b>${fmt((N-1)*(N-1)*2)}</b><span>Plants & props</span><b>${fmt(cnt)}</b><span>Textures</span><b>${typeof texState!=='undefined'?texState+' · '+(texPlan(S.quality).d):'—'}</b>`;
    $('#iRange').textContent=fmtLen(stats.lo)+' – '+fmtLen(stats.hi)}
}
function inspTick(now){DESK.frames++;if(now-DESK.t0>800){DESK.fps=Math.round(DESK.frames*1000/(now-DESK.t0));DESK.frames=0;DESK.t0=now;const e=$('#iFps');if(e)e.textContent=DESK.fps+' fps';if(DESK.stats!==stats)drawInspector();else{const map=$('#iMap');if(map&&camAnim)drawInspector()}}}
function layoutDesk(){const on=isDesk()&&SET.inspector!==false;$('#insp').hidden=!on;$('#inspShow').hidden=!isDesk()||on;document.body.classList.toggle('desk-insp',on);if(on)renderInspector();if(typeof resize==='function')resize()}
$('#iHide').onclick=()=>{SET.inspector=false;saveSettings();layoutDesk()};$('#inspShow').onclick=()=>{SET.inspector=true;saveSettings();layoutDesk()};
matchMedia('(min-width:1100px) and (pointer:fine)').addEventListener?.('change',layoutDesk);
function toggleKeys(){const k=$('#keys');if(k.hidden){k.innerHTML=`<div class="ih"><b>Keyboard</b><span class="grow"></span><button class="ibtn press" id="keysX" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="kgrid">${KEYMAP.map(([a,b])=>`<kbd>${a}</kbd><span>${b}</span>`).join('')}</div>`;k.hidden=false;$('#keysX').onclick=toggleKeys}else k.hidden=true}
addEventListener('keydown',e=>{
  if(e.target.closest&&e.target.closest('textarea,input,select'))return;if(e.metaKey||e.ctrlKey||e.altKey)return;const k=e.key;
  if(k==='?'){toggleKeys();return}
  if(['1','2','3','4','5','6'].includes(k)&&!e.shiftKey&&S.mode!=='sculpt'){switchTab(TABS[+k-1][0]);return}
  if(k==='n'){newWorld();return}if(k==='v'){newVariation();return}
  if(k==='s'){setMode(S.mode==='sculpt'?'orbit':'sculpt');return}
  if(e.shiftKey&&(k==='{'||k==='}')){S.brush.strength=clamp(S.brush.strength+(k==='}'?.05:-.05),.05,1);drawHud();toast('Strength '+Math.round(S.brush.strength*100)+'%');return}
  if(k==='c'){camEnter();return}if(k==='w'&&typeof fpEnter==='function'){fpEnter();return}
  if(k==='h'){document.body.classList.toggle('clear');return}if(k==='i'){SET.inspector=SET.inspector===false;saveSettings();layoutDesk();return}
  if(k===','){openSettings();return}if(k==='p'){switchTab('create','photo');pickPhoto();return}
  if(k==='Escape'){if(!$('#keys').hidden)toggleKeys();else if(!$('#settingsWin').hidden)closeSettings()}
});
