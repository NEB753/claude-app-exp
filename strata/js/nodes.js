"use strict";
/* Strata Nodes: a small resolution-independent heightfield graph. Every node outputs a Float32Array (R*R), values ~0..1. */
const P_=(label,min,max,step,def)=>({label,min,max,step,def});
const NODE_TYPES={
  noise:{cat:'Generate',label:'Noise',color:'#5b8def',ins:[],params:{scale:P_('Scale',.5,12,.1,3),oct:P_('Detail',1,8,1,6),rough:P_('Roughness',.3,.7,.01,.5),seed:P_('Seed',0,999,1,1)},
    fn(c,_,p){const n=makeNoise(c.seed+p.seed*131),o=octCap(p.oct,c.R,p.scale);return grid(c.R,(u,v)=>fbm(n,u*p.scale,v*p.scale,o,p.rough)*.5+.5)}},
  ridged:{cat:'Generate',label:'Ridged',color:'#5b8def',ins:[],params:{scale:P_('Scale',.5,10,.1,2.4),oct:P_('Detail',1,8,1,6),rough:P_('Roughness',.3,.7,.01,.5),seed:P_('Seed',0,999,1,2)},
    fn(c,_,p){const n=makeNoise(c.seed+p.seed*131),o=octCap(p.oct,c.R,p.scale);return grid(c.R,(u,v)=>ridged(n,u*p.scale,v*p.scale,o,p.rough))}},
  mountain:{cat:'Generate',label:'Mountain',color:'#5b8def',ins:[],params:{x:P_('Center X',0,1,.01,.5),y:P_('Center Y',0,1,.01,.5),radius:P_('Radius',.1,1,.01,.45),sharp:P_('Sharpness',.6,3,.05,1.5),ridges:P_('Ridges',0,1,.01,.6),seed:P_('Seed',0,999,1,3)},
    fn(c,_,p){const n=makeNoise(c.seed+p.seed*131);return grid(c.R,(u,v)=>{const dx=u-p.x,dy=v-p.y,d=Math.hypot(dx,dy)/p.radius,a=Math.atan2(dy,dx),w=d*(1+.25*n(Math.cos(a)*2+5,Math.sin(a)*2));const b=Math.pow(clamp(1-w,0,1),p.sharp);return b*(1-p.ridges*.45)+b*p.ridges*.45*ridged(n,u*4,v*4,5,.5)})}},
  volcano:{cat:'Generate',label:'Volcano',color:'#5b8def',ins:[],params:{x:P_('Center X',0,1,.01,.5),y:P_('Center Y',0,1,.01,.5),radius:P_('Radius',.1,1,.01,.42),crater:P_('Crater',0,1,.01,.5),gullies:P_('Gullies',0,1,.01,.5),seed:P_('Seed',0,999,1,4)},
    fn(c,_,p){const n=makeNoise(c.seed+p.seed*131);return grid(c.R,(u,v)=>{const dx=u-p.x,dy=v-p.y,d=Math.hypot(dx,dy)/p.radius,a=Math.atan2(dy,dx);const cone=Math.pow(clamp(1-d,0,1),1.5),g=1-p.gullies*.25*Math.abs(n(Math.cos(a)*6,Math.sin(a)*6+d*2));return Math.max(0,cone*g-p.crater*.5*(1-smooth(.06,.2,d)))})}},
  dunes:{cat:'Generate',label:'Dunes',color:'#5b8def',ins:[],params:{wave:P_('Wavelength',.02,.3,.005,.08),angle:P_('Wind angle',0,180,1,30),warp:P_('Warp',0,1,.01,.5),seed:P_('Seed',0,999,1,5)},
    fn(c,_,p){const n=makeNoise(c.seed+p.seed*131),a=p.angle*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);return grid(c.R,(u,v)=>{const t=(u*ca+v*sa)/p.wave+fbm(n,u*3,v*3,3,.5)*p.warp*4,f=t-Math.floor(t);return (f<.72?f/.72:(1-f)/.28)*(.6+.4*(fbm(n,u*2+9,v*2,2,.5)*.5+.5))})}},
  cells:{cat:'Generate',label:'Cells',color:'#5b8def',ins:[],params:{scale:P_('Scale',2,30,.5,8),jitter:P_('Jitter',0,1,.01,.9),mode:{label:'Shape',options:['Hills','Cracks','Plates'],def:'Hills'},seed:P_('Seed',0,999,1,6)},
    fn(c,_,p){const sd=c.seed+p.seed*131;return grid(c.R,(u,v)=>{worley(u*p.scale,v*p.scale,sd,p.jitter);return p.mode==='Cracks'?clamp((WF2-WF1)*2,0,1):p.mode==='Plates'?.25+WID*.6-(1-smooth(0,.05,WF2-WF1))*.15:clamp(1-WF1*1.25,0,1)})}},
  gradient:{cat:'Generate',label:'Gradient',color:'#5b8def',ins:[],params:{angle:P_('Angle',0,360,1,90),start:P_('Start',0,1,.01,0),end:P_('End',0,1,.01,1)},
    fn(c,_,p){const a=p.angle*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);return grid(c.R,(u,v)=>{const t=(u-.5)*ca+(v-.5)*sa+.5;return smooth(p.start,p.end,t)})}},
  constant:{cat:'Generate',label:'Constant',color:'#5b8def',ins:[],params:{value:P_('Value',0,1,.01,.5)},fn(c,_,p){return new Float32Array(c.R*c.R).fill(p.value)}},
  warp:{cat:'Modify',label:'Warp',color:'#a46be8',ins:['In'],params:{strength:P_('Strength',0,.4,.005,.08),scale:P_('Scale',.5,10,.1,2.5),seed:P_('Seed',0,999,1,7)},
    fn(c,[a],p){const n=makeNoise(c.seed+p.seed*131),R=c.R;return grid(R,(u,v)=>{const wx=fbm(n,u*p.scale,v*p.scale,4,.5)*p.strength,wy=fbm(n,u*p.scale+19,v*p.scale-7,4,.5)*p.strength;return sampleField(a,R,(u+wx)*(R-1),(v+wy)*(R-1))})}},
  terrace:{cat:'Modify',label:'Terrace',color:'#a46be8',ins:['In'],params:{steps:P_('Steps',2,20,1,7),sharp:P_('Sharpness',0,1,.01,.7),mix:P_('Mix',0,1,.01,1)},
    fn(c,[a],p){return map(a,h=>{const t=h*p.steps,k=Math.floor(t),f=t-k,e=lerp(f,smooth(.5-p.sharp*.45,.5+p.sharp*.45,f),p.sharp);return lerp(h,(k+e)/p.steps,p.mix)})}},
  levels:{cat:'Modify',label:'Levels',color:'#a46be8',ins:['In'],params:{lo:P_('In low',0,1,.01,0),hi:P_('In high',0,1,.01,1),gamma:P_('Gamma',.2,4,.05,1)},
    fn(c,[a],p){return map(a,h=>Math.pow(clamp((h-p.lo)/Math.max(p.hi-p.lo,.001),0,1),p.gamma))}},
  invert:{cat:'Modify',label:'Invert',color:'#a46be8',ins:['In'],params:{},fn(c,[a]){return map(a,h=>1-h)}},
  blur:{cat:'Modify',label:'Blur',color:'#a46be8',ins:['In'],params:{radius:P_('Radius',0,8,1,2)},fn(c,[a],p){return blurField(a.slice(),c.R,Math.round(p.radius*c.R/257*2))}},
  height:{cat:'Modify',label:'Scale height',color:'#a46be8',ins:['In'],params:{mul:P_('Multiply',0,2,.01,1),add:P_('Offset',-1,1,.01,0)},fn(c,[a],p){return map(a,h=>h*p.mul+p.add)}},
  normalize:{cat:'Modify',label:'Normalize',color:'#a46be8',ins:['In'],params:{},fn(c,[a]){return normalizeField(a.slice())}},
  hydraulic:{cat:'Erosion',label:'Rain erosion',color:'#2fa38a',ins:['In'],params:{drops:P_('Raindrops (k)',5,200,5,50),power:P_('Carving',.2,2,.05,1),seed:P_('Seed',0,999,1,8)},
    fn(c,[a],p){const h=a.slice(),R=c.R;erodeDroplets(h,R,Math.round(p.drops*1000*(R/257)**2),p.power,mulberry32(c.seed+p.seed*131),null,1);return h},heavy:true},
  thermal:{cat:'Erosion',label:'Weathering',color:'#2fa38a',ins:['In'],params:{talus:P_('Talus angle',10,60,1,32),passes:P_('Passes',1,60,1,20)},
    fn(c,[a],p){const h=a.slice(),R=c.R,tal=Math.tan(p.talus*Math.PI/180)/(c.hw*(R-1));for(let i=0;i<p.passes;i++)thermalPass(h,R,tal);return h},heavy:true},
  hmask:{cat:'Mask',label:'Height mask',color:'#d9902f',ins:['In'],params:{lo:P_('From',0,1,.01,.3),hi:P_('To',0,1,.01,.7),feather:P_('Feather',0,.5,.01,.08)},
    fn(c,[a],p){return map(a,h=>smooth(p.lo-p.feather,p.lo+p.feather,h)*(1-smooth(p.hi-p.feather,p.hi+p.feather,h)))}},
  smask:{cat:'Mask',label:'Slope mask',color:'#d9902f',ins:['In'],params:{lo:P_('Min angle',0,80,1,25),hi:P_('Max angle',0,90,1,90),feather:P_('Feather',0,20,1,5)},
    fn(c,[a],p){const R=c.R,o=new Float32Array(R*R),k=c.hw*.5;for(let j=0;j<R;j++)for(let i=0;i<R;i++){const dx=a[j*R+Math.min(i+1,R-1)]-a[j*R+Math.max(i-1,0)],dy=a[Math.min(j+1,R-1)*R+i]-a[Math.max(j-1,0)*R+i],ang=Math.atan(Math.hypot(dx,dy)*(R-1)*k)*180/Math.PI;o[j*R+i]=smooth(p.lo-p.feather,p.lo+p.feather,ang)*(1-smooth(p.hi-p.feather,p.hi+p.feather,ang))}return o}},
  combine:{cat:'Combine',label:'Combine',color:'#e8661c',ins:['A','B','Mask'],params:{mode:{label:'Blend',options:['Add','Subtract','Multiply','Max','Min','Mix','Screen','Difference'],def:'Max'},amount:P_('Amount',0,1,.01,.5)},
    fn(c,[a,b,m],p){const R=c.R,o=new Float32Array(R*R);a=a||o;b=b||o;
      for(let k=0;k<o.length;k++){const x=a[k],y=b[k];let r;switch(p.mode){case'Add':r=x+y*p.amount;break;case'Subtract':r=x-y*p.amount;break;case'Multiply':r=lerp(x,x*y,p.amount);break;case'Max':r=lerp(x,Math.max(x,y),p.amount*2>1?1:p.amount*2);break;case'Min':r=lerp(x,Math.min(x,y),p.amount);break;case'Screen':r=lerp(x,1-(1-x)*(1-y),p.amount);break;case'Difference':r=lerp(x,Math.abs(x-y),p.amount);break;default:r=lerp(x,y,p.amount)}
        o[k]=m?lerp(x,r,m[k]):r}return o}},
  output:{cat:'Output',label:'Terrain output',color:'#1f8f5f',ins:['Height'],params:{norm:{label:'Normalize',options:['On','Off'],def:'On'}},fn(c,[a],p){if(!a)return new Float32Array(c.R*c.R);const o=a.slice();if(p.norm==='On')normalizeField(o);for(let k=0;k<o.length;k++)o[k]=clamp(o[k],0,1.5);return o}}
};
function grid(R,f){const o=new Float32Array(R*R);for(let j=0;j<R;j++){const v=j/(R-1);for(let i=0;i<R;i++)o[j*R+i]=f(i/(R-1),v)}return o}
function map(a,f){const o=new Float32Array(a.length);for(let k=0;k<a.length;k++)o[k]=f(a[k]);return o}

const GRAPH_TEMPLATES={
  'Alpine range':()=>mkGraph([['m','mountain',40,30,{radius:.6,sharp:1.3,ridges:.8}],['r','ridged',40,200,{scale:2.6}],['c','combine',220,110,{mode:'Max',amount:.5}],['w','warp',400,110,{strength:.06}],['e','hydraulic',580,110,{drops:60}],['o','output',760,110,{}]],[['m','c',0],['r','c',1],['c','w',0],['w','e',0],['e','o',0]]),
  'Volcanic island':()=>mkGraph([['v','volcano',40,30,{radius:.38,crater:.55}],['n','noise',40,200,{scale:4,oct:6}],['c','combine',220,110,{mode:'Add',amount:.25}],['g','gradient',220,280,{angle:0,start:.0,end:.0}],['t','thermal',400,110,{talus:30,passes:12}],['e','hydraulic',580,110,{drops:40}],['o','output',760,110,{}]],[['v','c',0],['n','c',1],['c','t',0],['t','e',0],['e','o',0]]),
  'Desert dunes':()=>mkGraph([['d','dunes',40,30,{wave:.07,angle:35,warp:.6}],['n','noise',40,200,{scale:1.6,oct:4}],['c','combine',220,110,{mode:'Multiply',amount:.6}],['b','blur',400,110,{radius:1}],['o','output',580,110,{}]],[['d','c',0],['n','c',1],['c','b',0],['b','o',0]]),
  'Canyonlands':()=>mkGraph([['n','noise',40,30,{scale:2.2,oct:6}],['w','warp',220,30,{strength:.1}],['t','terrace',400,30,{steps:7,sharp:.85}],['k','cells',40,220,{scale:6,mode:'Cracks'}],['c','combine',580,110,{mode:'Subtract',amount:.35}],['e','hydraulic',760,110,{drops:40}],['o','output',940,110,{}]],[['n','w',0],['w','t',0],['t','c',0],['k','c',1],['c','e',0],['e','o',0]]),
  'Masked snow peaks':()=>mkGraph([['r','ridged',40,30,{scale:3}],['h','hmask',220,200,{lo:.55,hi:1,feather:.1}],['b','blur',220,30,{radius:3}],['c','combine',400,110,{mode:'Mix',amount:1}],['o','output',580,110,{}]],[['r','h',0],['r','b',0],['b','c',0],['r','c',1],['h','c',2],['c','o',0]])
};
function mkGraph(nodes,links){const id={};const g={nodes:[],links:[],sel:null,view:{x:20,y:20,z:.82}};let n=1;
  for(const [key,type,x,y,p] of nodes){const nid='n'+(n++);id[key]=nid;g.nodes.push({id:nid,type,x,y,p:{...defParams(type),...p}})}
  for(const [a,b,port] of links)g.links.push({from:id[a],to:id[b],port});return g}
function defParams(type){const o={},ps=NODE_TYPES[type].params;for(const k in ps)o[k]=ps[k].def;return o}

/* ---------------- evaluation ---------------- */
const nodeCache=new Map();
function evalGraph(g,R,onlyOut){
  const out=g.nodes.find(n=>n.type==='output');const ctx={R,seed:S.seed,hw:S.shape.maxH/S.shape.world};
  const res={},sig={};
  const run=n=>{if(res[n.id])return res[n.id];
    const T=NODE_TYPES[n.type],ins=T.ins.map((_,i)=>{const l=g.links.find(l=>l.to===n.id&&l.port===i);const src=l&&g.nodes.find(x=>x.id===l.from);return src?run(src):null});
    const key=n.type+JSON.stringify(n.p)+T.ins.map((_,i)=>{const l=g.links.find(l=>l.to===n.id&&l.port===i);return l?sig[l.from]:'-'}).join('|')+R+':'+S.seed;
    sig[n.id]=hashStr(key);const c=nodeCache.get(n.id);
    if(c&&c.sig===sig[n.id]&&c.R===R){res[n.id]=c.data;return c.data}
    let data;if(T.ins.length&&!ins[0]&&n.type!=='combine')data=new Float32Array(R*R);else data=T.fn(ctx,ins,n.p);
    nodeCache.set(n.id,{sig:sig[n.id],R,data});res[n.id]=data;return data};
  if(onlyOut)return out?run(out):null;
  for(const n of g.nodes)run(n);return res;
}
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
async function buildFromGraph(silent){
  const g=S.graph;if(!g)return;const out=g.nodes.find(n=>n.type==='output');if(!out){toast('Add a Terrain output node first');return}
  if(!silent)pushUndo();const old=H.slice();
  const heavy=g.nodes.some(n=>NODE_TYPES[n.type].heavy);if(heavy||N>257)busy(true,'Building terrain from nodes…',.3);await nextFrame();
  try{const f=evalGraph(g,N,true);H=new Float32Array(N*N);for(let k=0;k<f.length;k++)H[k]=f[k]*S.shape.maxH;prevMaxH=S.shape.maxH}
  finally{busy(false)}
  S.source='nodes';S.preset='Node graph';clearLayers(true);fluidSync();updateAll();morphFrom(old);saveSoon();if(!silent)toast('Terrain built from nodes');
}

/* ---------------- editor ---------------- */
let GE=null; // {el, inner, svg}
let connectFrom=null,thumbT=0,autoT=0;
function renderGraphEditor(host){
  const g=S.graph;host.innerHTML=`<div class="gbar">
    <button class="dd metal press" id="gAdd">${svg('<path d="M12 5v14M5 12h14"/>',2.4)}<span>Add node</span></button>
    <button class="dd metal press" id="gTpl"><span>Templates</span>${svg('<path d="m6 9 6 6 6-6"/>',2.4)}</button>
    <span style="flex:1"></span>
    <button class="dd anodized press" id="gBuild"><span>Build</span></button></div>
    <div class="graph" id="graph"><div class="graph-inner" id="gInner"><svg class="wires" id="gWires"></svg></div><div class="ginfo" id="gInfo"></div></div>
    <div id="gInspector"></div>`;
  GE={el:$('#graph'),inner:$('#gInner'),svg:$('#gWires')};
  for(const n of g.nodes)GE.inner.appendChild(nodeEl(n));
  applyGraphView();drawWires();renderInspector();scheduleThumbs(0);bindGraphGestures();
  $('#gAdd').onclick=e=>openMenu(e.currentTarget,addMenuItems(),v=>addNode(v));
  $('#gTpl').onclick=e=>openMenu(e.currentTarget,Object.keys(GRAPH_TEMPLATES).map(k=>({v:k,label:k})),v=>{S.graph=GRAPH_TEMPLATES[v]();nodeCache.clear();renderSheet();buildFromGraph();});
  $('#gBuild').onclick=()=>buildFromGraph();
  $('#gInfo').textContent=connectFrom?'Tap an input to connect':'Drag nodes · pinch to zoom · tap a port to wire';
}
function addMenuItems(){const cats={};for(const [k,T] of Object.entries(NODE_TYPES)){if(k==='output'&&S.graph.nodes.some(n=>n.type==='output'))continue;(cats[T.cat]=cats[T.cat]||[]).push({v:k,label:T.label,sw:T.color})}
  const items=[];for(const c in cats){items.push({head:c});items.push(...cats[c])}return items}
function addNode(type){const g=S.graph,v=g.view,r=GE.el.getBoundingClientRect(),id='n'+Date.now().toString(36);
  const n={id,type,x:(-v.x+r.width/2-66)/v.z,y:(-v.y+r.height/2-60)/v.z,p:defParams(type)};g.nodes.push(n);
  const sel=g.nodes.find(x=>x.id===g.sel);if(sel&&NODE_TYPES[type].ins.length){g.links.push({from:sel.id,to:id,port:0});n.x=sel.x+170;n.y=sel.y}
  g.sel=id;GE.inner.appendChild(nodeEl(n));refreshGraph();}
function nodeEl(n){
  const T=NODE_TYPES[n.type],el=document.createElement('div');el.className='node'+(S.graph.sel===n.id?' sel':'');el.dataset.id=n.id;el.style.left=n.x+'px';el.style.top=n.y+'px';
  el.innerHTML=`<div class="nh"><i style="background:${T.color}"></i><span>${T.label}</span></div><canvas width="64" height="40"></canvas>`;
  T.ins.forEach((name,i)=>{const p=document.createElement('div');p.className='port in';p.dataset.port=i;p.style.top=(34+i*24)+'px';p.innerHTML=T.ins.length>1?`<small style="left:-30px;text-align:right;width:26px">${name}</small>`:'';el.appendChild(p)});
  if(n.type!=='output'){const p=document.createElement('div');p.className='port out';p.style.top='34px';el.appendChild(p)}
  return el;
}
function applyGraphView(){const v=S.graph.view;GE.inner.style.transform=`translate(${v.x}px,${v.y}px) scale(${v.z})`}
function portPos(n,kind,i){const T=NODE_TYPES[n.type];return kind==='out'?{x:n.x+132,y:n.y+46}:{x:n.x,y:n.y+46+i*24}}
function drawWires(){
  const g=S.graph;let h='';for(const l of g.links){const a=g.nodes.find(n=>n.id===l.from),b=g.nodes.find(n=>n.id===l.to);if(!a||!b)continue;const p=portPos(a,'out'),q=portPos(b,'in',l.port),dx=Math.max(40,Math.abs(q.x-p.x)*.5);
    h+=`<path d="M${p.x} ${p.y}C${p.x+dx} ${p.y} ${q.x-dx} ${q.y} ${q.x} ${q.y}"/>`}
  GE.svg.innerHTML=h;
  $$('.port',GE.inner).forEach(pe=>pe.classList.remove('on','target','src'));
  for(const l of g.links){const a=GE.inner.querySelector(`.node[data-id="${l.from}"] .port.out`),b=GE.inner.querySelector(`.node[data-id="${l.to}"] .port.in[data-port="${l.port}"]`);a&&a.classList.add('on');b&&b.classList.add('on')}
  if(connectFrom){$$('.port.in',GE.inner).forEach(p=>p.classList.add('target'));const so=GE.inner.querySelector(`.node[data-id="${connectFrom}"] .port.out`);so&&so.classList.add('src')}
}
function refreshGraph(){$$('.node',GE.inner).forEach(e=>e.classList.toggle('sel',e.dataset.id===S.graph.sel));drawWires();renderInspector();scheduleThumbs();scheduleAuto();saveSoon()}
function scheduleThumbs(ms){clearTimeout(thumbT);thumbT=setTimeout(drawThumbs,ms==null?120:ms)}
function drawThumbs(){if(!GE||!document.body.contains(GE.el))return;const res=evalGraph(S.graph,72);
  for(const n of S.graph.nodes){const cv=GE.inner.querySelector(`.node[data-id="${n.id}"] canvas`);if(!cv||!res[n.id])continue;const f=res[n.id],R=72,ctx=cv.getContext('2d');cv.width=R;cv.height=Math.round(R*.62);const img=ctx.createImageData(R,cv.height);
    let lo=1e9,hi=-1e9;for(const x of f){if(x<lo)lo=x;if(x>hi)hi=x}const inv=1/((hi-lo)||1),y0=Math.round((R-cv.height)/2);
    for(let j=0;j<cv.height;j++)for(let i=0;i<R;i++){const k=(j+y0)*R+i,v=(f[k]-lo)*inv,dx=f[(j+y0)*R+Math.min(i+1,R-1)]-f[k],sh=clamp(.75+v*.35-dx*inv*9,0,1.3),o=(j*R+i)*4;img.data[o]=img.data[o+1]=img.data[o+2]=clamp(v*200*sh+30,0,255);img.data[o+3]=255}
    ctx.putImageData(img,0,0)}}
function scheduleAuto(){clearTimeout(autoT);if(!S.auto)return;const heavy=S.graph.nodes.some(n=>NODE_TYPES[n.type].heavy);if(N>257&&heavy)return;autoT=setTimeout(()=>buildFromGraph(true),heavy?700:260)}
function renderInspector(){
  const box=$('#gInspector');if(!box)return;const n=S.graph.nodes.find(x=>x.id===S.graph.sel);
  if(!n){box.innerHTML=`<p class="hint">Tap a node to edit it. Build sends the Terrain output to the 3D view. ${N>257?'Heavy nodes (erosion) build only when you tap Build at this grid size.':''}</p>
    ${tg('auto','Live build','Rebuild the terrain as you edit')}`;bindToggles(box);return}
  const T=NODE_TYPES[n.type];let h=`<div class="label">${T.cat} · ${T.label}</div>`;
  for(const [k,d] of Object.entries(T.params)){if(d.options)h+=`<div class="row"><label>${d.label}</label><button class="dd wide metal press" data-nopt="${k}" style="grid-column:span 3"><span>${n.p[k]}</span>${svg('<path d="m6 9 6 6 6-6"/>',2.4)}</button></div>`;
    else h+=sliderRow('node.'+k,d.label,d.min,d.max,d.step,n.p[k],d.def)}
  h+=`<div class="btns"><button class="btn plain press" id="nDup">Duplicate</button>${n.type!=='output'?'<button class="btn plain press" id="nDel" style="color:var(--bad)">Delete</button>':''}</div>`;
  box.innerHTML=h;
  bindSliders(box,(k,v)=>{n.p[k.slice(5)]=v;scheduleThumbs(60);scheduleAuto();saveSoon()},k=>NODE_TYPES[n.type].params[k.slice(5)].def);
  $$('[data-nopt]',box).forEach(b=>b.onclick=()=>{const k=b.dataset.nopt;openMenu(b,T.params[k].options.map(o=>({v:o,label:o})),v=>{n.p[k]=v;renderInspector();scheduleThumbs(0);scheduleAuto()},n.p[k])});
  const dup=$('#nDup');if(dup)dup.onclick=()=>{if(n.type==='output')return toast('There is only one output');const c={id:'n'+Date.now().toString(36),type:n.type,x:n.x+30,y:n.y+150,p:{...n.p}};S.graph.nodes.push(c);S.graph.sel=c.id;GE.inner.appendChild(nodeEl(c));refreshGraph()};
  const del=$('#nDel');if(del)del.onclick=()=>{S.graph.nodes=S.graph.nodes.filter(x=>x.id!==n.id);S.graph.links=S.graph.links.filter(l=>l.from!==n.id&&l.to!==n.id);S.graph.sel=null;nodeCache.delete(n.id);const ne=GE.inner.querySelector(`.node[data-id="${n.id}"]`);ne.classList.add('bye');setTimeout(()=>ne.remove(),200);refreshGraph()};
}
function bindGraphGestures(){
  const el=GE.el,pts=new Map();let drag=null,pinch=null,moved=false;
  el.onpointerdown=e=>{
    try{el.setPointerCapture(e.pointerId)}catch(_){}pts.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;
    if(pts.size===2){const [a,b]=[...pts.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:S.graph.view.z,mx:(a.x+b.x)/2,my:(a.y+b.y)/2,vx:S.graph.view.x,vy:S.graph.view.y};drag=null;return}
    const port=e.target.closest('.port'),ne=e.target.closest('.node');
    if(port){drag={kind:'port',port,node:ne.dataset.id};return}
    if(ne){const n=S.graph.nodes.find(x=>x.id===ne.dataset.id);drag={kind:'node',n,el:ne,sx:e.clientX,sy:e.clientY,ox:n.x,oy:n.y,head:!!e.target.closest('.nh')||true};return}
    drag={kind:'pan',sx:e.clientX,sy:e.clientY,ox:S.graph.view.x,oy:S.graph.view.y};
  };
  el.onpointermove=e=>{const p=pts.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;const v=S.graph.view;
    if(pinch&&pts.size>=2){const [a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y),z=clamp(pinch.z*d/pinch.d,.35,1.8),r=el.getBoundingClientRect(),mx=pinch.mx-r.left,my=pinch.my-r.top;
      v.x=mx-(mx-pinch.vx)*z/pinch.z+((a.x+b.x)/2-pinch.mx);v.y=my-(my-pinch.vy)*z/pinch.z+((a.y+b.y)/2-pinch.my);v.z=z;applyGraphView();return}
    if(!drag)return;const dx=e.clientX-(drag.sx??e.clientX),dy=e.clientY-(drag.sy??e.clientY);if(Math.abs(dx)+Math.abs(dy)>4)moved=true;
    if(drag.kind==='node'&&moved){drag.n.x=drag.ox+dx/v.z;drag.n.y=drag.oy+dy/v.z;drag.el.style.left=drag.n.x+'px';drag.el.style.top=drag.n.y+'px';drawWires()}
    else if(drag.kind==='pan'&&moved){v.x=drag.ox+dx;v.y=drag.oy+dy;applyGraphView()}
  };
  const end=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!drag)return;const d=drag;drag=null;
    if(d.kind==='port'){const isOut=d.port.classList.contains('out');
      if(isOut){connectFrom=connectFrom===d.node?null:d.node}
      else{const port=+d.port.dataset.port,existing=S.graph.links.findIndex(l=>l.to===d.node&&l.port===port);
        if(connectFrom&&connectFrom!==d.node){if(existing>=0)S.graph.links.splice(existing,1);if(!createsCycle(connectFrom,d.node))S.graph.links.push({from:connectFrom,to:d.node,port});else toast('That link would make a loop');connectFrom=null}
        else if(existing>=0){S.graph.links.splice(existing,1);toast('Link removed')}}
      $('#gInfo').textContent=connectFrom?'Tap an input port to connect':'Drag nodes · pinch to zoom · tap a port to wire';refreshGraph();return}
    if(d.kind==='node'){if(!moved){S.graph.sel=d.n.id;refreshGraph()}else saveSoon();return}
    if(d.kind==='pan'&&!moved){S.graph.sel=null;connectFrom=null;refreshGraph()}else saveSoon()};
  el.onpointerup=end;el.onpointercancel=end;
  el.onwheel=e=>{e.preventDefault();const v=S.graph.view,r=el.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,z=clamp(v.z*Math.exp(-e.deltaY*.0015),.35,1.8);v.x=mx-(mx-v.x)*z/v.z;v.y=my-(my-v.y)*z/v.z;v.z=z;applyGraphView()};
}
function createsCycle(from,to){const g=S.graph,seen=new Set();const up=id=>{if(id===to)return true;if(seen.has(id))return false;seen.add(id);return g.links.filter(l=>l.to===id).some(l=>up(l.from))};return up(from)}
