"use strict";
/* Terrain Gen node guide: every node has a short explanation and a looping animated preview of its main setting sweeping
   (rendered live, like a GIF), plus an animated "how to wire" demo. Animations run only while cards are on screen. */
const NODE_DOCS={
  noise:['Smooth fractal noise. The base of most landscapes.','Low Scale = continents, high Scale = hills. Detail adds small bumps.'],
  ridged:['Sharp crests from folded noise, like mountain chains.','Blend into Noise with Combine → Max for alpine ranges.'],
  billow:['Puffy, rounded bumps (absolute noise).','Great for dunes, clouds of hills, or lunar ground under Craters.'],
  mountain:['A single peak with ridges you can place.','Move Center X/Y to compose; raise Sharpness for a spire.'],
  volcano:['A cone with a summit crater and gullies.','Feed into Weathering for softened flanks.'],
  dunes:['Asymmetric ridges shaped by wind.','Wind angle sets direction; Warp makes them wander.'],
  cells:['Cellular patterns: hills, cracks or plates.','Plates + Terrace makes basalt columns; Cracks makes mud flats.'],
  islandmask:['A soft island shape with noisy coastline.','Plug into Combine → Multiply to turn any terrain into an island.'],
  craters:['Impact craters with raised rims, on top of an optional base.','Stack two: big sparse craters, then small dense ones.'],
  gradient:['A straight ramp across the map.','Use as a Combine mask to fade one terrain into another.'],
  constant:['A flat value.','Handy as a Combine input or to lift everything.'],
  warp:['Pushes the input sideways with noise.','Small Strength makes natural, less grid-like shapes.'],
  twist:['Swirls the input around a center.','Big angles make spiral ranges and whirlpool basins.'],
  terrace:['Turns slopes into steps.','High Sharpness = mesas; low = gentle rice terraces.'],
  stratify:['Rock layers that resist erosion differently.','Before Weathering, gives banded cliffs like badlands.'],
  canyon:['Cuts winding canyon networks into the input.','Thin Width + high Depth = slot canyons.'],
  levels:['Remaps the height range and contrast.','Gamma above 1 flattens valleys and sharpens peaks.'],
  curve:['Draw your own height response curve.','A dip in the middle makes plateaus; an S-curve adds contrast.'],
  clamp:['Cuts heights above a ceiling or below a floor.','Ceiling creates flat-topped mesas instantly.'],
  fold:['Folds heights around a value, turning peaks into ridges.','Combine with Twist for alien spires.'],
  tilt:['Tilts the whole input in a direction.','Makes rivers drain one way when followed by Rivers.'],
  invert:['Flips heights: peaks become pits.','Invert a mask to select its opposite.'],
  blur:['Softens the input.','A small blur before Rivers gives cleaner channels.'],
  height:['Multiplies and offsets heights.','Use Offset to sink terrain under the sea.'],
  normalize:['Stretches values to fill 0–1.','Use after Combine so the result uses the full height range.'],
  hydraulic:['Rain droplets carve gullies and drop sediment.','Put it near the end of the graph; it is the slowest node.'],
  thermal:['Steep slopes crumble down to the talus angle.','Lower angle = rounder, older hills.'],
  rivers:['Finds where water collects and carves river channels.','Lower Threshold = more, smaller streams.'],
  sediment:['Fills valley floors with deposits.','After Rivers, gives flat floodplains.'],
  hmask:['Selects a height band (white) as a mask.','Use as Combine mask to add snow-only detail on peaks.'],
  smask:['Selects slopes between two angles.','Mask cliffs to add Stratify only on steep faces.'],
  flowmask:['Shows where water flows (bright = more water).','Use as a mask for wet sediment or vegetation.'],
  curvature:['Highlights ridges or valleys.','Mask Ridges to sharpen crests; Valleys to fill gullies.'],
  combine:['Mixes A and B with a blend mode, optionally through a mask.','Max keeps the taller of both; Mix + mask fades between them.'],
  output:['Sends the result to the 3D terrain.','Only one output; everything wired into it is built.']
};
let NG={raf:0,vis:new Set(),base:null,base2:null,io:null,t0:0,demo:null};
function ngBase(){if(NG.base)return;const R=48;NG.base=normalizeField(genField(R,{freq:2.4,oct:5,gain:.5,ridges:.5,warp:.2,peaks:1.2,island:0,terrace:0,cone:.3,crater:0,tsteps:6},7));NG.base2=normalizeField(genField(R,{freq:4,oct:4,gain:.5,ridges:.9,warp:.1,peaks:1,island:0,terrace:0,cone:0,crater:0,tsteps:6},19))}
function ngSweep(type){const ps=NODE_TYPES[type].params;for(const k in ps){const d=ps[k];if(d.options||d.curve||k==='seed')continue;return k}return null}
function ngRender(cv,type,t){
  const R=48,T=NODE_TYPES[type],p=defParams(type),k=ngSweep(type);if(k){const d=T.params[k];p[k]=lerp(d.min,d.max,.15+.7*(.5+.5*Math.sin(t)))}
  if(type==='curve')p.pts=[[0,0],[.35,.5+.4*Math.sin(t)],[.7,.75],[1,1]];
  if(type==='hydraulic')p.drops=Math.round(10+40*(.5+.5*Math.sin(t)));if(type==='thermal')p.passes=Math.round(2+18*(.5+.5*Math.sin(t)));
  const ctx={R,seed:3,hw:.12};let f;try{f=T.fn(ctx,[NG.base,NG.base2,type==='combine'?NODE_TYPES.gradient.fn(ctx,[],{angle:0,start:.3,end:.7}):null],p)}catch(e){f=NG.base}
  const mask=T.cat==='Mask';if(mask){const c2=cv.getContext('2d'),img=c2.createImageData(R,R);for(let i=0;i<R*R;i++){const v=clamp(f[i],0,1)*255;img.data[i*4]=v*.95;img.data[i*4+1]=v*.85;img.data[i*4+2]=v*.4;img.data[i*4+3]=255}cv.width=cv.height=R;c2.putImageData(img,0,0)}
  else drawRelief(cv,normalizeField(f.slice()),R,'temperate');
}
function ngLoop(now){
  if($('#ng').hidden){NG.raf=0;return}NG.raf=requestAnimationFrame(ngLoop);const t=(now-NG.t0)/1000;
  if(NG.demo)drawWireDemo(NG.demo,t);
  const t0=performance.now();let i=0;for(const cv of NG.vis){if(performance.now()-t0>5)break;const last=+cv.dataset.last||0,slow=cv.dataset.slow?650:110;if(now-last<slow)continue;cv.dataset.last=now;ngRender(cv,cv.dataset.type,t*1.2+i);i++}
}
function drawWireDemo(cv,t){
  const c=cv.getContext('2d'),W=cv.width=cv.clientWidth*2,H=cv.height=cv.clientHeight*2,cs=getComputedStyle(document.documentElement),acc=cs.getPropertyValue('--accent').trim(),gold=cs.getPropertyValue('--gold').trim(),ink=cs.getPropertyValue('--ink').trim(),node=cs.getPropertyValue('--node-head').trim()||'#fff';
  c.clearRect(0,0,W,H);const ph=(t%6)/6,boxes=[[.06,.2,'Noise'],[.38,.52,'Warp'],[.7,.2,'Output']];
  const bw=W*.24,bh=H*.36,pt=(i,o)=>{const [x,y]=boxes[i];return o?[x*W+bw,y*H+bh*.5]:[x*W,y*H+bh*.5]};
  const wire=(a,b,f)=>{c.strokeStyle=acc;c.lineWidth=5;c.beginPath();const dx=Math.max(40,(b[0]-a[0])*.5);const N=30;for(let s=0;s<=N*f;s++){const u=s/N,x=Math.pow(1-u,3)*a[0]+3*Math.pow(1-u,2)*u*(a[0]+dx)+3*(1-u)*u*u*(b[0]-dx)+u*u*u*b[0],y=Math.pow(1-u,3)*a[1]+3*Math.pow(1-u,2)*u*a[1]+3*(1-u)*u*u*b[1]+u*u*u*b[1];s?c.lineTo(x,y):c.moveTo(x,y)}c.stroke()};
  const f1=clamp((ph-.1)/.3,0,1),f2=clamp((ph-.45)/.3,0,1);wire(pt(0,1),pt(1,0),f1);wire(pt(1,1),pt(2,0),f2);
  boxes.forEach(([x,y,l],i)=>{c.fillStyle=node;c.strokeStyle=i===2&&ph>.8?gold:'rgba(0,0,0,.12)';c.lineWidth=i===2&&ph>.8?6:2;c.beginPath();c.roundRect(x*W,y*H,bw,bh,18);c.fill();c.stroke();c.fillStyle=ink;c.font=`600 ${H*.09}px system-ui`;c.fillText(l,x*W+16,y*H+H*.12);
    c.fillStyle=acc;for(const o of [0,1]){if(i===0&&!o||i===2&&o)continue;const [px,py]=pt(i,o);c.beginPath();c.arc(px,py,9,0,7);c.fill()}});
  const from=ph<.45?pt(0,1):pt(1,1),to=ph<.45?pt(1,0):pt(2,0),ff=ph<.45?f1:f2,fx=lerp(from[0],to[0],ff),fy=lerp(from[1],to[1],ff)+Math.sin(ff*3.14)*-20;
  if(ph<.8){c.fillStyle='rgba(255,255,255,.8)';c.strokeStyle=gold;c.lineWidth=4;c.beginPath();c.arc(fx,fy+26,22,0,7);c.fill();c.stroke()}
  c.fillStyle=ink;c.font=`500 ${H*.08}px system-ui`;c.fillText(ph<.45?'1. Tap an output dot, then an input dot':ph<.8?'2. Chain nodes left to right':'3. Output builds the land',W*.06,H*.95);
}
function openNodeGuide(focusType){
  ngBase();const cats={};for(const [k,T] of Object.entries(NODE_TYPES))(cats[T.cat]=cats[T.cat]||[]).push(k);
  const el=$('#ng');el.innerHTML=`<div class="hh"><h2>Node guide</h2><button class="ibtn press" id="ngClose" aria-label="Close guide">${svg('<path d="M6 6l12 12M18 6 6 18"/>',2.2)}</button></div>
  <div class="hbody"><div class="ngdemo"><canvas id="ngDemo"></canvas></div>
  <p class="tip">Nodes are recipes: each one makes or changes a height map and passes it to the right. Build from big shapes to small details, and put erosion near the end. Every preview below is live: it shows the node's main setting sweeping from low to high.</p>
  ${Object.entries(cats).map(([c,ks])=>`<h3 class="ngcat">${c}</h3><div class="ngcards">${ks.map(k=>{const T=NODE_TYPES[k],d=NODE_DOCS[k]||['',''],sw=ngSweep(k);return `<div class="ngcard" id="ng_${k}"><canvas data-type="${k}" ${T.heavy?'data-slow="1"':''} width="48" height="48"></canvas><div><b><i style="background:${T.color}"></i>${T.label}</b><p>${d[0]}</p><small>${sw?'Animating: '+T.params[sw].label+' · ':''}${d[1]}</small>${k!=='output'?`<button class="dd metal press" data-ngadd="${k}"><span>Add to graph</span></button>`:''}</div></div>`}).join('')}</div>`).join('')}</div>`;
  el.hidden=false;NG.demo=$('#ngDemo');NG.vis.clear();NG.t0=performance.now();
  NG.io&&NG.io.disconnect();NG.io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)NG.vis.add(e.target);else NG.vis.delete(e.target)}),{root:$('#ng .hbody')});
  $$('canvas[data-type]',el).forEach(cv=>{ngRender(cv,cv.dataset.type,0);NG.io.observe(cv)});
  $('#ngClose').onclick=()=>{el.hidden=true};
  $$('[data-ngadd]',el).forEach(b=>b.onclick=()=>{el.hidden=true;if(S.tab!=='create'||S.sub.create!=='nodes')switchTab('create','nodes');setTimeout(()=>addNode(b.dataset.ngadd),60);toast(NODE_TYPES[b.dataset.ngadd].label+' added','ok')});
  if(focusType){const c=$('#ng_'+focusType);c&&c.scrollIntoView({block:'center'})}
  if(!NG.raf)NG.raf=requestAnimationFrame(ngLoop);
}
