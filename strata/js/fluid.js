"use strict";
/* Strata Fluid Gen: shallow-water "virtual pipes" simulation with sediment transport on a coarser grid (FL.R).
   Water flows downhill, pools into lakes, drains to the sea and carves the terrain when Carve > 0. */
const FL={R:0,b:null,b0:null,d:null,s:null,fL:null,fR:null,fT:null,fB:null,u:null,v:null,wet:null,time:0,steps:0,lastSync:0,lastWater:0};
function fluidInit(){
  const R=QUALITY[S.quality].sim,n=R*R;FL.R=R;
  FL.b=resample(H,N,R);FL.b0=FL.b.slice();
  for(const k of ['d','s','fL','fR','fT','fB','u','v','wet'])FL[k]=new Float32Array(n);
  FL.time=0;FL.steps=0;
}
function fluidSync(){if(!FL.R)return;FL.b=resample(H,N,FL.R);FL.b0=FL.b.slice()}
function fluidClear(){if(!FL.R)return;for(const k of ['d','s','fL','fR','fT','fB','u','v','wet'])FL[k].fill(0);FL.time=0;FL.steps=0;updateWater()}
function fluidStep(){
  const R=FL.R,n=R*R,{b,d,s,fL,fR,fT,fB,u,v,wet}=FL,l=S.shape.world/(R-1),g=9.81,sea=seaLevel(),F=S.fluid;
  let dmax=.1;for(let k=0;k<n;k++){if(b[k]>=sea&&d[k]>dmax)dmax=d[k]}
  const dt=Math.min(4,.45*l/Math.sqrt(g*dmax)),rain=F.rain*.0016*dt,K=dt*g/l;
  // sources
  if(rain>0)for(let k=0;k<n;k++)if(b[k]>=sea)d[k]+=rain;
  for(const sp of F.springs){const ci=Math.round(sp.u*(R-1)),cj=Math.round(sp.v*(R-1)),add=F.flow*(sp.rate||1)*.6*dt;
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=R||j>=R)continue;d[j*R+i]+=add*(di||dj?.08:.36)}}
  // ocean boundary
  if(sea>0)for(let k=0;k<n;k++)if(b[k]<sea)d[k]=sea-b[k];
  // outflow flux
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){
    const k=j*R+i,hk=b[k]+d[k];
    const hl=i>0?b[k-1]+d[k-1]:b[k],hr=i<R-1?b[k+1]+d[k+1]:b[k],ht=j>0?b[k-R]+d[k-R]:b[k],hb=j<R-1?b[k+R]+d[k+R]:b[k];
    let a=Math.max(0,fL[k]*.995+K*(hk-hl)),c=Math.max(0,fR[k]*.995+K*(hk-hr)),e=Math.max(0,fT[k]*.995+K*(hk-ht)),f=Math.max(0,fB[k]*.995+K*(hk-hb));
    const sum=(a+c+e+f)*dt;if(sum>d[k]&&sum>0){const sc=d[k]/sum;a*=sc;c*=sc;e*=sc;f*=sc}
    fL[k]=a;fR[k]=c;fT[k]=e;fB[k]=f;
  }
  // depth + velocity
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){
    const k=j*R+i,inL=i>0?fR[k-1]:0,inR=i<R-1?fL[k+1]:0,inT=j>0?fB[k-R]:0,inB=j<R-1?fT[k+R]:0;
    const out=fL[k]+fR[k]+fT[k]+fB[k],d0=d[k];d[k]=Math.max(0,d[k]+dt*(inL+inR+inT+inB-out));
    const da=(d0+d[k])*.5+1e-4;u[k]=((inL-fL[k])+(fR[k]-inR))*.5/da;v[k]=((inT-fT[k])+(fB[k]-inB))*.5/da;
    const sp=Math.hypot(u[k],v[k]);if(sp>12){u[k]*=12/sp;v[k]*=12/sp}
  }
  // erosion / deposition
  const carve=F.carve;
  if(carve>0){
    const Kc=.06*carve,Ks=.35,Kd=.4;
    for(let j=1;j<R-1;j++)for(let i=1;i<R-1;i++){
      const k=j*R+i;if(b[k]<sea||d[k]<.01)continue;
      const gx=(b[k+1]-b[k-1])/(2*l),gy=(b[k+R]-b[k-R])/(2*l),sinA=Math.max(.04,Math.sqrt(gx*gx+gy*gy)/Math.sqrt(1+gx*gx+gy*gy));
      const C=Kc*sinA*Math.hypot(u[k],v[k])*Math.min(d[k],2);
      if(C>s[k]){const e=Math.min(Ks*(C-s[k]),.2*d[k]+.02);b[k]-=e;s[k]+=e}else{const dp=Kd*(s[k]-C);b[k]+=dp;s[k]-=dp}
    }
    // semi-Lagrangian sediment advection
    if(!FL.s2||FL.s2.length!==n)FL.s2=new Float32Array(n);const s2=FL.s2;
    for(let j=0;j<R;j++)for(let i=0;i<R;i++){const k=j*R+i;s2[k]=sampleField(s,R,i-u[k]*dt/l,j-v[k]*dt/l)}
    s.set(s2);
  }
  // evaporation, wetness memory
  const ev=1-F.evap*.004*dt;
  for(let k=0;k<n;k++){if(b[k]>=sea){d[k]*=ev;if(d[k]<1e-4)d[k]=0}const w=Math.min(1,d[k]/.6);wet[k]=w>wet[k]?lerp(wet[k],w,.2):wet[k]*.9995}
  FL.time+=dt;FL.steps++;
}
function fluidWriteBack(){
  // apply terrain change from the coarse sim grid onto H
  const R=FL.R,delta=new Float32Array(R*R);let any=false;
  for(let k=0;k<delta.length;k++){delta[k]=FL.b[k]-FL.b0[k];if(delta[k]!==0)any=true}
  if(!any)return false;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i;H[k]=Math.max(0,H[k]+sampleField(delta,R,i/(N-1)*(R-1),j/(N-1)*(R-1)))}
  FL.b0=FL.b.slice();return true;
}
function fluidBake(){
  if(!FL.R)return;fluidWriteBack();
  const w=resample(FL.wet,FL.R,N);blurField(w,N,1);for(let k=0;k<WM.length;k++)WM[k]=Math.max(WM[k]*.5,clamp(w[k]*1.4,0,1));
  updateAll();scatterSoon(200);saveSoon();
}
const fmtTime=s=>s<120?`${Math.round(s)} s`:s<7200?`${Math.round(s/60)} min`:`${(s/3600).toFixed(1)} h`;
function addSpring(p){
  const list=S.fluid.springs,near=list.findIndex(s=>Math.hypot(s.u-p.u,s.v-p.v)<.03);
  if(near>=0){list.splice(near,1);toast('Spring removed')}else if(list.length>=16)toast('16 springs is the limit');else{list.push({u:+p.u.toFixed(4),v:+p.v.toFixed(4),rate:1});toast('Spring placed')}
  updateSpringMarkers();saveSoon();if(S.tab==='simulate'&&typeof renderSheet==='function')renderSheet();
}
function carvePath(points,depth,width){
  // carve a smooth downhill channel through a polyline of {u,v} points (0..1)
  pushUndo();const W=S.shape.world,rad=Math.max(1.5,width/W*(N-1));let prevH=Infinity;
  const pts=[];for(let q=0;q<points.length-1;q++){const a=points[q],b=points[q+1],steps=Math.max(2,Math.ceil(Math.hypot(b.u-a.u,b.v-a.v)*(N-1)/(rad*.5)));for(let t=0;t<steps;t++)pts.push({u:lerp(a.u,b.u,t/steps),v:lerp(a.v,b.v,t/steps)})}
  if(points.length)pts.push(points[points.length-1]);
  for(const p of pts){const cx=p.u*(N-1),cy=p.v*(N-1);let bed=Math.min(prevH,hAt(cx,cy)-depth);bed=Math.max(0,bed);prevH=bed+depth*.15;
    const i0=Math.max(0,Math.floor(cx-rad*2)),i1=Math.min(N-1,Math.ceil(cx+rad*2)),j0=Math.max(0,Math.floor(cy-rad*2)),j1=Math.min(N-1,Math.ceil(cy+rad*2));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d=Math.hypot(i-cx,j-cy)/rad,k=j*N+i;if(d>2)continue;const w=1-smooth(.6,2,d),target=bed+Math.pow(d/2,1.6)*depth*1.4;if(H[k]>target)H[k]=lerp(H[k],target,w);if(d<1.1)WM[k]=Math.max(WM[k],.85*(1-d/1.1))}}
  fluidSync();updateAll();saveSoon();
}
function heightGrid(n){const out=[];for(let j=0;j<n;j++){const row=[];for(let i=0;i<n;i++){const h=hAt((i+.5)/n*(N-1),(j+.5)/n*(N-1));row.push(Math.round((h-stats.lo)/((stats.hi-stats.lo)||1)*9))}out.push(row.join(''))}return out}
