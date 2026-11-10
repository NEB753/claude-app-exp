"use strict";
/* Strata simulations: one runner for Water, Lava, Snow, Wind and Erosion.
   Each sim works on a coarser grid (QUALITY.sim), shows a live overlay or terrain update, reports progress and bakes itself in. */
const SIM_LEVELS={quick:{n:'Quick',k:.35},medium:{n:'Medium',k:1},long:{n:'Long',k:2.6},endless:{n:'Until I stop',k:Infinity}};
const SR={kind:null,running:false,steps:0,target:1,lastSync:0,lastVis:0};
const OV={};
function ensureOverlay(name,R,mat){
  if(OV[name]&&OV[name].R===R)return OV[name];
  if(OV[name]){scene.remove(OV[name].mesh);OV[name].mesh.geometry.dispose()}
  const g=new THREE.BufferGeometry(),idx=new Uint32Array((R-1)*(R-1)*6);let q=0;
  for(let j=0;j<R-1;j++)for(let i=0;i<R-1;i++){const a=j*R+i,b=a+R,c=a+1,d=b+1;idx[q++]=a;idx[q++]=b;idx[q++]=c;idx[q++]=c;idx[q++]=b;idx[q++]=d}
  const pos=new Float32Array(R*R*3),nor=new Float32Array(R*R*3);for(let k=0;k<R*R;k++)nor[k*3+1]=1;
  g.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(R*R*4),4).setUsage(THREE.DynamicDrawUsage));g.setIndex(new THREE.BufferAttribute(idx,1));
  const mesh=new THREE.Mesh(g,mat);mesh.frustumCulled=false;mesh.renderOrder=3;mesh.visible=false;scene.add(mesh);OV[name]={mesh,R};return OV[name];
}
const lavaMat=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,toneMapped:false});
const snowMat=new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,depthWrite:false,roughness:.75,envMapIntensity:.6});
function writeOverlay(name,R,surf,colorFn){
  const o=ensureOverlay(name,R,name==='lava'?lavaMat:snowMat),pos=o.mesh.geometry.attributes.position.array,col=o.mesh.geometry.attributes.color.array,W=S.shape.world,vex=S.view.vex;let any=false;
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){const k=j*R+i,y=surf(k);pos[k*3]=(i/(R-1)-.5)*W;pos[k*3+1]=y*vex;pos[k*3+2]=(j/(R-1)-.5)*W;if(colorFn(k,col,k*4))any=true}
  o.mesh.geometry.attributes.position.needsUpdate=o.mesh.geometry.attributes.color.needsUpdate=true;o.mesh.visible=any;dirty=true;
}
function hideOverlay(name){if(OV[name]){OV[name].mesh.visible=false;dirty=true}}
// apply a coarse-grid height delta onto H
function coarseWriteBack(R,b,b0){const d=new Float32Array(R*R);let any=false;for(let k=0;k<d.length;k++){d[k]=b[k]-b0[k];if(d[k]!==0)any=true}if(!any)return false;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i;H[k]=Math.max(0,H[k]+sampleField(d,R,i/(N-1)*(R-1),j/(N-1)*(R-1)))}b0.set(b);return true}
function refreshTerrain(){updateRegion(0,0,N-1,N-1);for(const a of ['position','normal','color'])geo.attributes[a].updateRange.count=-1;baseDirty=true}

/* ---------------- lava ---------------- */
const LV={R:0,b:null,b0:null,L:null,T:null,solid:null,steps:0,auto:null};
function lavaInit(){const R=QUALITY[S.quality].sim;LV.R=R;LV.b=resample(H,N,R);LV.b0=LV.b.slice();LV.L=new Float32Array(R*R);LV.T=new Float32Array(R*R);LV.solid=new Float32Array(R*R);LV.IN=new Float32Array(R*R);LV.OUT=new Float32Array(R*R);LV.HT=new Float32Array(R*R);LV.steps=0;
  let best=0,bk=0;const bl=blurField(LV.b.slice(),R,2);for(let k=0;k<bl.length;k++)if(bl[k]>best){best=bl[k];bk=k}LV.auto={u:(bk%R)/(R-1),v:Math.floor(bk/R)/(R-1)}}
const lavaVents=()=>S.lava.vents.length?S.lava.vents:[LV.auto];
function lavaStep(){
  const R=LV.R,{b,L,T,IN,OUT,HT}=LV,sea=seaLevel(),P=S.lava,nb=[-1,1,-R,R];
  for(const v of lavaVents()){const ci=Math.round(v.u*(R-1)),cj=Math.round(v.v*(R-1));for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const i=ci+di,j=cj+dj;if(i<1||j<1||i>=R-1||j>=R-1)continue;const k=j*R+i,add=P.rate*.9*(di||dj?.5:1);T[k]=(T[k]*L[k]+add)/(L[k]+add);L[k]+=add}}
  IN.fill(0);OUT.fill(0);HT.fill(0);const dn=[0,0,0,0];
  for(let j=1;j<R-1;j++)for(let i=1;i<R-1;i++){const k=j*R+i,l=L[k];if(l<.01)continue;
    const h=b[k]+l,yl=(1-T[k])*1.6+.12,flu=P.fluid*(.12+.88*T[k]*T[k]);let sum=0;
    for(let q=0;q<4;q++){const n=k+nb[q],d=h-(b[n]+L[n])-yl;dn[q]=d>0?d:0;sum+=dn[q]}
    if(sum<=0)continue;const mv=Math.min(l*.9,sum*.45)*flu;OUT[k]+=mv;
    for(let q=0;q<4;q++)if(dn[q]>0){const a=mv*dn[q]/sum,n=k+nb[q];IN[n]+=a;HT[n]+=a*T[k]}}
  const cool=P.cool*.006;
  for(let k=0;k<L.length;k++){const kept=L[k]-OUT[k],nl=kept+IN[k];if(nl<=1e-5){L[k]=0;continue}T[k]=(T[k]*kept+HT[k])/nl;L[k]=nl;
    T[k]-=cool*(1+.6/(nl+.3))*(b[k]<sea?6:1);if(T[k]<.1){b[k]+=L[k];LV.solid[k]+=L[k];L[k]=0;T[k]=0}}
  LV.steps++;
}
function lavaVis(){const R=LV.R;writeOverlay('lava',R,k=>LV.b[k]+LV.L[k]+.15,(k,c,o)=>{const l=LV.L[k];if(l<.03){c[o+3]=0;return false}const t=LV.T[k],g=smooth(.25,.9,t);
  c[o]=lerp(.16,lerp(1.0,1.6,g),smooth(.15,.45,t));c[o+1]=lerp(.11,lerp(.22,.75,g),smooth(.15,.45,t));c[o+2]=lerp(.09,lerp(.04,.2,g),smooth(.15,.45,t));c[o+3]=clamp(.6+l*.2,0,1);return true})}
function lavaPaint(){const R=LV.R;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,s=sampleField(LV.solid,R,i/(N-1)*(R-1),j/(N-1)*(R-1));if(s<.05)continue;const w=smooth(.05,1.5,s),v=.85+.3*hash2(i,j,7);
  PC[k*3]=lerp(PW[k]>0?PC[k*3]:44,44*v,w);PC[k*3+1]=lerp(PW[k]>0?PC[k*3+1]:40,40*v,w);PC[k*3+2]=lerp(PW[k]>0?PC[k*3+2]:39,39*v,w);PW[k]=Math.max(PW[k],w);SM[k]=Math.min(SM[k],1-w)}}
function lavaSync(){if(coarseWriteBack(LV.R,LV.b,LV.b0)){lavaPaint();refreshTerrain()}}
function lavaBake(){if(!LV.R)return;for(let k=0;k<LV.L.length;k++){LV.b[k]+=LV.L[k];LV.solid[k]+=LV.L[k];LV.L[k]=0}coarseWriteBack(LV.R,LV.b,LV.b0);lavaPaint();hideOverlay('lava');updateAll();saveSoon()}
function lavaClear(){if(!LV.R)return;LV.L.fill(0);LV.T.fill(0);hideOverlay('lava')}
function addVent(p){const l=S.lava.vents,n=l.findIndex(v=>Math.hypot(v.u-p.u,v.v-p.v)<.03);if(n>=0){l.splice(n,1);toast('Vent removed')}else if(l.length>=8)toast('8 vents is the limit','warn');else{l.push({u:+p.u.toFixed(4),v:+p.v.toFixed(4)});toast('Lava vent placed','ok')}updateSpringMarkers();saveSoon();if(S.tab==='simulate')renderSheet()}

/* ---------------- snow ---------------- */
const SN={R:0,b:null,D:null,steps:0};
function snowInit(){const R=QUALITY[S.quality].sim;SN.R=R;SN.b=resample(H,N,R);if(!SN.D||SN.D.length!==R*R)SN.D=new Float32Array(R*R);SN.steps=0}
function snowStep(){
  const R=SN.R,{b,D}=SN,P=S.snow,maxH=S.shape.maxH,sea=seaLevel(),l=S.shape.world/(R-1),tal=Math.tan(P.repose*Math.PI/180)*l,nb=[-1,1,-R,R];
  for(let k=0;k<D.length;k++){if(b[k]<sea){D[k]=0;continue}const hn=(b[k]-sea)/maxH,f=.02+smooth(P.line-.12,P.line+.1,hn);D[k]+=P.fall*.03*f;const ml=P.line-.18;if(hn<ml)D[k]=Math.max(0,D[k]-P.melt*.05*(1-hn/Math.max(ml,.01)))}
  for(let pass=0;pass<2;pass++)for(let j=1;j<R-1;j++)for(let i=1;i<R-1;i++){const k=j*R+i;if(D[k]<=0)continue;const s=b[k]+D[k];let mx=0,lo=-1;for(let q=0;q<4;q++){const n=k+nb[q],d=s-(b[n]+D[n]);if(d>mx){mx=d;lo=n}}if(mx>tal){const mv=Math.min(D[k],(mx-tal)*.3);D[k]-=mv;D[lo]+=mv}}
  SN.steps++;
}
function snowVis(){const R=SN.R;writeOverlay('snow',R,k=>SN.b[k]+SN.D[k]+.25,(k,c,o)=>{const d=SN.D[k];if(d<.01){c[o+3]=0;return false}c[o]=.93;c[o+1]=.96;c[o+2]=1;c[o+3]=clamp(smooth(.01,.35,d)*.96,0,.96);return true})}
function snowBake(){if(!SN.R)return;const R=SN.R,D=SN.D;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,d=sampleField(D,R,i/(N-1)*(R-1),j/(N-1)*(R-1));if(d<.01)continue;const w=smooth(.01,.5,d);
  PC[k*3]=lerp(PW[k]>0?PC[k*3]:240,240,w);PC[k*3+1]=lerp(PW[k]>0?PC[k*3+1]:244,244,w);PC[k*3+2]=lerp(PW[k]>0?PC[k*3+2]:248,248,w);PW[k]=Math.max(PW[k],w*.97);if(S.snow.addHeight)H[k]+=d*.6;SM[k]=Math.min(SM[k],1-w*.6)}
  D.fill(0);hideOverlay('snow');updateAll();saveSoon()}
function snowClear(){if(SN.D)SN.D.fill(0);hideOverlay('snow')}

/* ---------------- wind (dune migration) ---------------- */
const WD={R:0,b:null,b0:null,steps:0};
function windInit(){const R=QUALITY[S.quality].sim;WD.R=R;WD.b=resample(H,N,R);WD.b0=WD.b.slice();WD.steps=0}
function windStep(){
  const R=WD.R,b=WD.b,P=S.wind,a=P.dir*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),hop=2+Math.round(P.power*4),l=S.shape.world/(R-1),q=.35*P.supply*Math.max(.3,S.shape.maxH/120),tanS=Math.tan(15*Math.PI/180)*l,sea=seaLevel();
  const rnd=Math.random,picks=Math.round(R*R*.04);
  const shelter=(i,j)=>{const h=b[j*R+i];for(let s=1;s<=10;s++){const ii=(Math.round(i-dx*s)%R+R)%R,jj=(Math.round(j-dy*s)%R+R)%R;if(b[jj*R+ii]-h>tanS*s)return true}return false};
  for(let p=0;p<picks;p++){const i=1+(rnd()*(R-2))|0,j=1+(rnd()*(R-2))|0,k=j*R+i;if(b[k]<sea+.5||b[k]<=q||shelter(i,j))continue;b[k]-=q;
    let x=i,y=j,land=false;for(let h=0;h<6;h++){x+=dx*hop;y+=dy*hop;x=(x+R)%R;y=(y+R)%R;const ii=Math.round(x)%R,jj=Math.round(y)%R;
      if(shelter(ii,jj)||rnd()<.45||b[jj*R+ii]<sea){b[jj*R+ii]+=q;land=true;break}}
    if(!land){const ii=clamp(Math.round(x),0,R-1),jj=clamp(Math.round(y),0,R-1);b[jj*R+ii]+=q}}
  thermalPass(b,R,Math.tan(33*Math.PI/180)*l);WD.steps++;
}
function windSync(){if(coarseWriteBack(WD.R,WD.b,WD.b0))refreshTerrain()}
function windBake(){if(!WD.R)return;windSync();updateAll();saveSoon()}

/* ---------------- erosion as a sim ---------------- */
const ER={done:0,rnd:null};
function erodeInit(){ER.done=0;ER.rnd=mulberry32((S.seed*31+Date.now())|0)}
function erodeStep(){const n=Math.round(1800*(N/257)**2);erodeDroplets(H,N,n,S.ero.power,ER.rnd,null,S.shape.maxH);ER.done+=n}
function erodeBake(){for(let k=0;k<H.length;k++)if(H[k]<0)H[k]=0;updateAll();saveSoon()}

/* ---------------- runner ---------------- */
const SIMDEF={
  water:{title:'Water',icon:'water',init(){if(!FL.R)fluidInit();else fluidSync();S.view.water=true},step:fluidStep,vis:()=>updateWater(true),sync(){if(S.fluid.carve>0&&fluidWriteBack())refreshTerrain()},bake:fluidBake,clear:fluidClear,base:900,info:()=>fmtTime(FL.time)+' simulated',
    ready:()=>S.fluid.springs.length||S.fluid.rain>0?null:'Add rain, or place a spring on high ground first'},
  lava:{title:'Lava',init:lavaInit,step:lavaStep,vis:lavaVis,sync:lavaSync,bake:lavaBake,clear:lavaClear,base:700,info:()=>`${lavaVents().length} vent${lavaVents().length===1?'':'s'} · ${Math.round(LV.steps)} steps`},
  snow:{title:'Snow',init:snowInit,step:snowStep,vis:snowVis,sync:null,bake:snowBake,clear:snowClear,base:420,info:()=>`${SN.steps} snowfalls`},
  wind:{title:'Wind',init:windInit,step:windStep,vis:null,sync:windSync,bake:windBake,clear:null,base:360,info:()=>`${WD.steps} gusts`},
  erode:{title:'Erosion',init:erodeInit,step:erodeStep,vis:null,sync:refreshTerrain,bake:erodeBake,clear:null,base:0,info:()=>`${Math.round(ER.done/1000)}k raindrops`}
};
function simTarget(kind){const k=SIM_LEVELS[S.sim.level].k;if(kind==='erode')return k===Infinity?Infinity:Math.max(4,Math.round(S.ero.drops*(N/257)**2/(1800*(N/257)**2)*k));return SIMDEF[kind].base*k}
function simStart(kind){
  const d=SIMDEF[kind];const why=d.ready&&d.ready();if(why){toast(why,'warn');return}
  if(SR.running&&SR.kind!==kind)simStop(true);
  SR.job=job(d.title,['Simulating','Baking']);pushUndo();d.init();simSound(kind);Object.assign(SR,{kind,running:true,steps:0,target:simTarget(kind),lastSync:performance.now(),lastVis:0});
  const ring=$('#simRing');ring.classList.remove('done');ring.classList.toggle('spin',SR.target===Infinity);$('#simTitle').textContent=d.title;$('#simStop').textContent='Done';$('#simChip').hidden=false;
  if(S.tab==='simulate')renderSheet();touch();haptic(10);
}
function simStop(bake){
  if(!SR.kind)return;const d=SIMDEF[SR.kind];SR.running=false;loopsOff();if(d.end)d.end();
  if(bake){busy(true,'Baking '+d.title.toLowerCase()+'…',.6);try{d.bake()}finally{busy(false)}simDoneFx(d.title+' baked into the terrain')}
  else{$('#simChip').hidden=true;toast(d.title+' paused');if(SR.job){SR.job.done('Paused');SR.job=null}}
  if(S.tab==='simulate')renderSheet();
}
function simDoneFx(msg){sfx('chime');if(SR.job){SR.job.done('Baked into the land');SR.job=null}const ring=$('#simRing');ring.classList.remove('spin');ring.querySelector('.fg').style.strokeDashoffset=0;ring.classList.add('done');$('#simText').textContent='Baked';$('#simStop').textContent='OK';
  celebrate();toast(msg,'ok');setTimeout(()=>{if(!SR.running)$('#simChip').hidden=true},1800)}
function simTick(now){
  if(!SR.running)return;const d=SIMDEF[SR.kind],t0=performance.now();let n=0;
  while(performance.now()-t0<7&&n<16&&SR.steps<SR.target){d.step();SR.steps++;n++;if(SR.kind==='erode')break}
  if(d.vis&&now-SR.lastVis>33){d.vis();SR.lastVis=now}
  const every=N>=1025?2200:N>=513?900:450;if(d.sync&&now-SR.lastSync>every){d.sync();SR.lastSync=now}
  const p=SR.target===Infinity?0:SR.steps/SR.target;$('#simRing .fg').style.strokeDashoffset=94.25*(1-(SR.target===Infinity?.25:p));
  $('#simText').textContent=(SR.target===Infinity?'':Math.round(p*100)+'% · ')+d.info();
  const inf=$('#simInfo');if(inf&&S.sub.sim===SR.kind)inf.textContent=d.info();
  if(SR.job&&SR.target!==Infinity)SR.job.prog(p);
  const card=$('#simProg');if(card)card.style.strokeDashoffset=207.3*(1-(SR.target===Infinity?.25:p));
  touch();
  if(SR.steps>=SR.target){SR.running=false;loopsOff();if(d.end)d.end();if(S.sim.autoBake){d.bake();simDoneFx(d.title+' finished and baked')}else{if(d.sync)d.sync();toast(d.title+' finished · tap Bake to keep it');$('#simChip').hidden=true}if(S.tab==='simulate')renderSheet()}
}
$('#simStop').onclick=()=>{if(SR.running)simStop(true);else $('#simChip').hidden=true};

/* ---------------- weather & events ---------------- */
const EV={};
function simSound(k){loopsOff();const m={water:['rain'],storm:['rain','wind'],lava:['lava'],snow:['wind'],blizzard:['wind'],wind:['wind'],tornado:['wind'],erode:['erode'],quake:['quake'],slide:['quake','erode']}[k]||[];m.forEach((n,i)=>loopOn(n,k==='snow'?.4:k==='slide'&&i===0?.5:1))}
function regionLoop(u,v,r,fn){const cx=u*(N-1),cy=v*(N-1),R=r*(N-1),i0=Math.max(0,Math.floor(cx-R)),i1=Math.min(N-1,Math.ceil(cx+R)),j0=Math.max(0,Math.floor(cy-R)),j1=Math.min(N-1,Math.ceil(cy+R));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d=Math.hypot(i-cx,j-cy)/R;if(d<1)fn(j*N+i,d,i,j)}updateRegion(i0-1,j0-1,i1+1,j1+1)}
// earthquake: a fault scarp grows in increments, the camera shakes, slopes along the fault collapse
Object.assign(SIMDEF,{
 quake:{title:'Earthquake',init(){const r=Math.random,a=r()*Math.PI;EV.q={nx:Math.cos(a),ny:Math.sin(a),cx:.35+r()*.3,cy:.35+r()*.3,th:S.shape.maxH*.07*(.4+S.weather.power),done:0,sx:r()<.5?1:-1}},
  step(){const q=EV.q;q.done++;if(q.done%2)return;const f0=smooth(0,1,(q.done-2)/30),f1=smooth(0,1,q.done/30),dd=(f1-f0)*q.th;if(dd<=0)return;
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){const u=i/(N-1),v=j/(N-1),d=(u-q.cx)*q.nx+(v-q.cy)*q.ny,k=j*N+i;H[k]=Math.max(0,H[k]+dd*smooth(-.006,.006,d*q.sx)*Math.exp(-Math.abs(d)*2.2)*(1-MK[k]))}
    if(q.done%6===0){const tal=Math.tan(33*Math.PI/180)*S.shape.world/(N-1);thermalPass(H,N,tal)}},
  end(){if(!FP.on)placeCamera()},vis(){const a=SR.running?(1-SR.steps/SR.target)*S.shape.world*.0025*(.5+S.weather.power):0;if(!FP.on&&a>0){placeCamera();camera.position.x+=(Math.random()-.5)*a;camera.position.y+=(Math.random()-.5)*a;dirty=true}},
  sync:refreshTerrain,bake(){updateAll();scatterSoon(100);saveSoon()},base:32,info:()=>`Magnitude ${(5.2+S.weather.power*3).toFixed(1)}`},
 tornado:{title:'Tornado',init(){const r=Math.random,a=(S.weather.dir+(r()-.5)*40)*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a);EV.t={x0:.5-dx*.55,y0:.5-dy*.55,dx,dy,w:.025+.035*S.weather.power,ph:r()*9};
    if(!EV.funnel){const g=new THREE.CylinderGeometry(1,.12,1,24,8,true).translate(0,.5,0);EV.funnel=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x9aa3a6,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide}));EV.funnel.renderOrder=5;scene.add(EV.funnel)}EV.funnel.visible=true},
  pos(){const t=SR.steps/SR.target,e=EV.t,w=Math.sin(t*9+e.ph)*.06;return{u:clamp(e.x0+e.dx*t*1.1-e.dy*w,0,1),v:clamp(e.y0+e.dy*t*1.1+e.dx*w,0,1)}},
  step(){const p=SIMDEF.tornado.pos(),e=EV.t,dirt=PAINTS.dirt.c,pw=S.weather.power;regionLoop(p.u,p.v,e.w,(k,d)=>{const f=1-d*d;DF[k]=Math.max(DF[k],f*.9);SM[k]*=1-f*.5;H[k]=Math.max(0,H[k]-f*.25*pw);if(f>.35){PC[k*3]=lerp(PW[k]>0?PC[k*3]:dirt[0],dirt[0],.5);PC[k*3+1]=lerp(PW[k]>0?PC[k*3+1]:dirt[1],dirt[1],.5);PC[k*3+2]=lerp(PW[k]>0?PC[k*3+2]:dirt[2],dirt[2],.5);PW[k]=Math.max(PW[k],f*.28)}})},
  vis(){const p=SIMDEF.tornado.pos(),W=S.shape.world,h=hAt(p.u*(N-1),p.v*(N-1))*S.view.vex,R=EV.t.w*W;EV.funnel.position.set((p.u-.5)*W,h,(p.v-.5)*W);EV.funnel.scale.set(R*1.3,S.shape.maxH*1.6+R*4,R*1.3);EV.funnel.rotation.y+=.4;emitDust({x:(p.u-.5)*W,z:(p.v-.5)*W,gx:p.u*(N-1),gy:p.v*(N-1)},6,[.5,.46,.4]);dirty=true},
  end(){if(EV.funnel)EV.funnel.visible=false},sync:null,bake(){if(EV.funnel)EV.funnel.visible=false;updateAll();buildScatter();saveSoon()},base:160,info:()=>'EF'+Math.round(1+S.weather.power*4)+' tornado'},
 slide:{title:'Rockslide',init(){let best=-1,bk=null;const rng=Math.random;for(let a=0;a<400;a++){const u=.1+rng()*.8,v=.1+rng()*.8,s=slopeDeg(u*(N-1),v*(N-1));if(s>best){best=s;bk={u,v}}}EV.s={...(EV.at||bk),r:.05+.05*S.weather.power};EV.at=null;EV.s0=H.slice()},
  step(){const e=EV.s,tal=Math.tan(22*Math.PI/180)*S.shape.world/(N-1),cx=e.u*(N-1),cy=e.v*(N-1),R=e.r*(N-1)*1.6,i0=Math.max(1,Math.floor(cx-R)),i1=Math.min(N-2,Math.ceil(cx+R)),j0=Math.max(1,Math.floor(cy-R)),j1=Math.min(N-2,Math.ceil(cy+R)),nb=[-1,1,-N,N];
    for(let pass=0;pass<3;pass++)for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*N+i,w=1-smooth(.6,1,Math.hypot(i-cx,j-cy)/R);if(w<=0||MK[k]>.5)continue;let mx=0,lo=-1;for(let q=0;q<4;q++){const d=H[k]-H[k+nb[q]];if(d>mx){mx=d;lo=k+nb[q]}}if(mx>tal){const mv=(mx-tal)*.35*w;H[k]-=mv;H[lo]+=mv}}
    updateRegion(i0-1,j0-1,i1+1,j1+1);if(SR.steps%3===0)emitDust({x:(e.u-.5)*S.shape.world,z:(e.v-.5)*S.shape.world,gx:cx,gy:cy},10,[.55,.53,.5])},
  sync:null,bake(){const e=EV.s,rk=PAINTS.rock.c;regionLoop(e.u,e.v,e.r*2,(k)=>{const g=H[k]-EV.s0[k];if(g>.3){const w=smooth(.3,4,g);PC[k*3]=rk[0];PC[k*3+1]=rk[1];PC[k*3+2]=rk[2];PW[k]=Math.max(PW[k],w*.8);SM[k]=Math.min(SM[k],1-w*.7)}if(g<-.3)DF[k]=Math.max(DF[k],.4)});updateAll();scatterSoon(100);saveSoon()},base:40,info:()=>'Cliff collapse'},
 storm:{title:'Hurricane',init(){EV.st={rain:S.fluid.rain,carve:S.fluid.carve};S.fluid.rain=.95;S.fluid.carve=.7;if(!FL.R)fluidInit();else fluidSync();S.view.water=true},
  step(){fluidStep();if(SR.steps%12===0){const r=Math.random,u=r(),v=r(),h=hAt(u*(N-1),v*(N-1)),sea=seaLevel(),exposed=h<sea+S.shape.maxH*.18||slopeDeg(u*(N-1),v*(N-1))<8;if(exposed)regionLoop(u,v,.03+.03*S.weather.power,(k,d)=>{DF[k]=Math.max(DF[k],(1-d)*.7)})}},
  vis:()=>updateWater(true),sync(){if(fluidWriteBack())refreshTerrain()},end(){if(EV.st){S.fluid.rain=EV.st.rain;S.fluid.carve=EV.st.carve}},bake(){fluidBake();if(EV.st){S.fluid.rain=EV.st.rain;S.fluid.carve=EV.st.carve}buildScatter()},base:520,info:()=>'Category '+Math.round(1+S.weather.power*4)+' · '+fmtTime(FL.time)},
 blizzard:{title:'Blizzard',init(){snowInit();EV.bz=S.snow.fall},step(){S.snow.fall=1;snowStep();S.snow.fall=EV.bz;const R=SN.R,D=SN.D,a=S.weather.dir*Math.PI/180,dx=Math.round(Math.cos(a)),dy=Math.round(Math.sin(a)),f=.08*(.4+S.weather.power);
    for(let j=1;j<R-1;j++)for(let i=1;i<R-1;i++){const k=j*R+i,n=k+dy*R+dx;if(SN.b[n]+D[n]<SN.b[k]+D[k]+2){const m=D[k]*f;D[k]-=m;D[n]+=m}}},
  vis:snowVis,sync:null,end(){S.snow.fall=EV.bz??S.snow.fall},bake:snowBake,clear:snowClear,base:360,info:()=>`${SN.steps} gusts of snow`}
});
