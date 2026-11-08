"use strict";
/* Strata tools: sculpt brushes, landform stamps, erosion (droplet + thermal), undo. */
const TOOLS=[
  ['raise','Raise','<path d="M12 19V5M6 11l6-6 6 6"/>'],
  ['lower','Lower','<path d="M12 5v14M6 13l6 6 6-6"/>'],
  ['smooth','Smooth','<path d="M3 14c3-5 6-5 9 0s6 5 9 0"/>'],
  ['flatten','Flatten','<path d="M3 15h18M7 9h10"/>'],
  ['roughen','Roughen','<path d="M3 15l3-5 3 6 3-8 3 7 3-4 3 4"/>'],
  ['terrace','Terrace','<path d="M3 19h5v-4h4v-4h4V7h5"/>'],
  ['erode','Erode','<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/><path d="M10 15l2 2 2-3"/>'],
  ['stamp','Stamp','<path d="M8 4h8l-2 6h4v4H6v-4h4z"/><path d="M5 20h14"/>'],
  ['paint','Paint','<path d="M19 3l-9 9"/><path d="M10 12c-3 0-5 2-5 5 0 2-2 3-2 3s5 1 7-1 2-4 0-7z"/>'],
  ['plant','Plant','<path d="M12 21v-8"/><path d="M12 13c0-4 3-7 7-7 0 4-3 7-7 7zM12 15c0-3-2-5-6-5 0 3 2 5 6 5z"/>'],
  ['pinch','Pinch','<path d="M4 18l8-12 8 12"/><path d="M9 18l3-5 3 5"/>'],
  ['crease','Crease','<path d="M3 6l9 12 9-12"/>'],
  ['smudge','Smudge','<path d="M4 14c3-3 6-3 9 0s5 3 7 1"/><path d="M16 7l4 4"/>'],
  ['mask','Mask','<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M4 14l10-10M8 20l12-12"/>']
];
const TOOL_CATS={shape:{n:'Shape',t:['raise','lower','smooth','flatten','pinch','crease','smudge','terrace']},detail:{n:'Detail',t:['roughen','erode','stamp']},surface:{n:'Surface',t:['paint','plant','mask']}};
const BRUSH_SHAPES={soft:'Soft',sharp:'Sharp',plateau:'Plateau',spray:'Spray'};
const SYMS={none:'Off',x:'Mirror ↔',z:'Mirror ↕',r3:'Radial 3',r4:'Radial 4',r6:'Radial 6'};
const STAMPS={mountain:'Mountain',volcano:'Volcano',crater:'Crater',mesa:'Mesa',ridge:'Ridge',dune:'Dune',basin:'Lake basin'};
let stroke=null;
function stampProfile(type,d,ax,ay,rn){
  switch(type){
    case'mountain':return Math.pow(clamp(1-d,0,1),1.7)*(.75+.25*Math.abs(rn(ax*2.5,ay*2.5)))+.06*rn(ax*6,ay*6)*(1-d);
    case'volcano':{const c=Math.pow(clamp(1-d,0,1),1.5);return c-.55*(1-smooth(.08,.22,d))*c*1.6}
    case'crater':return d<1?(-.55*(1-smooth(0,.7,d))+.35*Math.exp(-Math.pow((d-.75)/.12,2))):0;
    case'mesa':return 1-smooth(.62,.82,d+.04*rn(ax*4,ay*4));
    case'ridge':{const along=Math.abs(ay);return Math.pow(clamp(1-Math.abs(ax)*2.6,0,1),1.5)*(1-smooth(.6,1,along))*(.8+.2*rn(ay*5,0))}
    case'dune':{const x=ax*2.2;return clamp((x<0?1+x*1.8:1-x*.6),0,1)*(1-smooth(.5,1,Math.abs(ay)))*.55}
    case'basin':return -(1-smooth(.2,1,d))*.6;
  }return 0;
}
/* Terrain-aware brushes. With Realism above 0, the brush does not push clay: Raise lifts the crust along fractal
   ridges and spurs (world-anchored, so neighbouring dabs continue the same ridge), Lower cuts branching valleys,
   Roughen adds rock where slopes are steep and keeps meadows smooth. When the stroke ends, the touched area is
   weathered: slopes settle to their angle of repose and rain carves gullies, so new land joins the old naturally. */
let TN=null,TNs=-1;
function terrainNoise(){if(TNs!==S.seed){TN=makeNoise(S.seed+4242);TNs=S.seed}return TN}
function bbAdd(i0,j0,i1,j1){if(!stroke)return;const b=stroke.bb;if(!b)stroke.bb=[i0,j0,i1,j1];else{b[0]=Math.min(b[0],i0);b[1]=Math.min(b[1],j0);b[2]=Math.max(b[2],i1);b[3]=Math.max(b[3],j1)}}
function weatherRegion(bb,nat){if(!bb||nat<=0)return;const pad=6,i0=Math.max(1,bb[0]-pad),j0=Math.max(1,bb[1]-pad),i1=Math.min(N-2,bb[2]+pad),j1=Math.min(N-2,bb[3]+pad);
  const cell=S.shape.world/(N-1),tal=Math.tan((40-8*nat)*Math.PI/180)*cell,nb=[-1,1,-N,N];
  for(let p=0;p<Math.round(2+5*nat);p++)for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*N+i;if(MK[k]>.5)continue;let mx=0,lo=-1;for(let q=0;q<4;q++){const d=H[k]-H[k+nb[q]];if(d>mx){mx=d;lo=k+nb[q]}}if(mx>tal){const mv=(mx-tal)*.25;H[k]-=mv;H[lo]+=mv}}
  const cx=(i0+i1)/2,cy=(j0+j1)/2,r=Math.max(i1-i0,j1-j0)/2,drops=Math.round(Math.min(9000,(i1-i0)*(j1-j0)*.35*nat));
  if(drops>20)erodeDroplets(H,N,drops,.8,mulberry32((S.seed*7+drops)|0),{x:cx,y:cy,r},S.shape.maxH);
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(H[j*N+i]<0)H[j*N+i]=0;markRegion(i0-1,j0-1,i1+1,j1+1)}
function brushAt(cx,cy,amt,p){
  const W=S.shape.world,g=(N-1)/W,rad=Math.max(1,S.brush.size*g),fall=S.brush.falloff,tool=S.tool,st=S.brush.strength*amt,rate=S.shape.maxH*.012;
  const i0=Math.max(0,Math.floor(cx-rad)),i1=Math.min(N-1,Math.ceil(cx+rad)),j0=Math.max(0,Math.floor(cy-rad)),j1=Math.min(N-1,Math.ceil(cy+rad));
  if(i0>i1||j0>j1)return;
  if(tool==='erode'){erodeDroplets(H,N,Math.round(40*st+6),1.2,stroke.rng,{x:cx,y:cy,r:rad},S.shape.maxH);markRegion(i0-2,j0-2,i1+2,j1+2);return}
  let src=null,sw=0;if(tool==='smooth'||tool==='pinch'||tool==='smudge'){sw=i1-i0+5;src=new Float32Array(sw*(j1-j0+5));for(let j=j0-2;j<=j1+2;j++)for(let i=i0-2;i<=i1+2;i++)src[(j-j0+2)*sw+(i-i0+2)]=H[clamp(j,0,N-1)*N+clamp(i,0,N-1)]}
  const rn=stroke&&stroke.noise,pc=tool==='paint'&&PAINTS[S.paint].c,step=S.shape.maxH/10,nat=S.brush.nat??.75,tn=terrainNoise(),cell=W/(N-1),lam=Math.max(cell*6,S.brush.size*.55);bbAdd(i0,j0,i1,j1);
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
    const d=Math.hypot(i-cx,j-cy)/rad;if(d>=1)continue;
    const sh=S.brush.shape;let w=sh==='sharp'?Math.pow(1-d,2.4):sh==='plateau'?1-smooth(.72,1,d):fall<=.01?1:1-smooth(1-fall,1,d);if(sh==='spray')w*=hash2(i,j,(stroke&&stroke.sprayS)||1)>.6?1:.12;
    const k=j*N+i,s=w*st*(tool==='mask'||tool==='paint'||tool==='plant'?1:1-MK[k]);if(s<=0)continue;
    switch(tool){
      case'raise':{if(nat>0){const wx=i*cell/lam,wy=j*cell/lam,rg=ridged(tn,wx,wy,4,.5),up=.3+1.05*rg*rg;H[k]+=s*rate*lerp(1,up,nat)}else H[k]+=s*rate;break}
      case'lower':{if(nat>0){const wx=i*cell/lam,wy=j*cell/lam,v=1-Math.abs(fbm(tn,wx*.8+31,wy*.8,4,.5)),vm=.35+1.1*Math.pow(v,3);H[k]=Math.max(0,H[k]-s*rate*lerp(1,vm,nat))}else H[k]=Math.max(0,H[k]-s*rate);break}
      case'smooth':{let sum=0;for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++)sum+=src[(j-j0+2+dj)*sw+(i-i0+2+di)];H[k]=lerp(H[k],sum/25,clamp(s*.6,0,1));break}
      case'flatten':H[k]=lerp(H[k],stroke.flatH,clamp(s*.35,0,1));break;
      case'roughen':{if(nat>0){const sl=Math.min(1,Math.hypot(H[k+(i<N-1?1:0)]-H[k-(i>0?1:0)],H[k+(j<N-1?N:0)]-H[k-(j>0?N:0)])/(2*cell)),wx=i*cell/(lam*.45),wy=j*cell/(lam*.45),r=(ridged(tn,wx+11,wy,4,.55)-.45)*1.6+fbm(tn,wx*2.3,wy*2.3,3,.5)*.5;H[k]=Math.max(0,H[k]+r*s*rate*1.2*lerp(1,.25+1.4*sl,nat))}else H[k]=Math.max(0,H[k]+rn(i*.35,j*.35)*s*rate*1.2);break}
      case'terrace':{const t=H[k]/step,k0=Math.floor(t),f=t-k0;H[k]=lerp(H[k],(k0+smooth(.4,.6,f))*step,clamp(s*.3,0,1));break}
      case'paint':{const k3=k*3,t=clamp(s*.5,0,1);if(pc){if(PW[k]<.02){PC[k3]=pc[0];PC[k3+1]=pc[1];PC[k3+2]=pc[2]}else{PC[k3]=lerp(PC[k3],pc[0],t);PC[k3+1]=lerp(PC[k3+1],pc[1],t);PC[k3+2]=lerp(PC[k3+2],pc[2],t)}PW[k]=Math.min(1,PW[k]+s*.4)}else PW[k]=Math.max(0,PW[k]-s*.4);break}
      case'pinch':{let sum=0;for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++)sum+=src[(j-j0+2+dj)*sw+(i-i0+2+di)];H[k]=Math.max(0,H[k]+(H[k]-sum/25)*clamp(s*.9,0,1));break}
      case'crease':H[k]=Math.max(0,H[k]-Math.pow(w,2.5)*st*rate*1.6*(1-MK[k]));break;
      case'smudge':{const dx=(stroke&&stroke.dir?stroke.dir[0]:0)*rad*.35,dy=(stroke&&stroke.dir?stroke.dir[1]:0)*rad*.35,si=Math.round(i-dx),sj=Math.round(j-dy);const v=si>=i0-2&&si<=i1+2&&sj>=j0-2&&sj<=j1+2?src[(sj-j0+2)*sw+(si-i0+2)]:H[clamp(sj,0,N-1)*N+clamp(si,0,N-1)];H[k]=lerp(H[k],v,clamp(s*.55,0,1));break}
      case'mask':MK[k]=clamp(MK[k]+(S.maskMode==='add'?1:-1)*s*.6,0,1);break;
      case'plant':SM[k]=clamp(SM[k]+(S.plant==='add'?1:-1)*s*.5,0,S.plant==='add'?2.5:1);break;
      case'channel':H[k]=Math.max(0,H[k]-s*s*rate*1.6);WM[k]=Math.min(1,WM[k]+s*.3);break;
    }
  }
  markRegion(i0-1,j0-1,i1+1,j1+1);
}
function stampAt(p){
  const W=S.shape.world,g=(N-1)/W,rad=Math.max(2,S.brush.size*g),amp=Math.min(S.brush.size*1.1,S.shape.maxH*1.2)*S.brush.strength*1.6,rot=Math.random()*Math.PI*2,rn=makeNoise((Math.random()*1e9)|0),cs=Math.cos(rot),sn=Math.sin(rot);
  const go=(cx,cy)=>{i0=Math.max(0,Math.floor(cx-rad)),i1=Math.min(N-1,Math.ceil(cx+rad)),j0=Math.max(0,Math.floor(cy-rad)),j1=Math.min(N-1,Math.ceil(cy+rad));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const dx=(i-cx)/rad,dy=(j-cy)/rad,d=Math.hypot(dx,dy);if(d>=1.15)continue;const ax=dx*cs-dy*sn,ay=dx*sn+dy*cs,v=stampProfile(S.stamp,d,ax,ay,rn)*amp,k=j*N+i;
      H[k]=Math.max(0,H[k]+v)}
    markRegion(i0-1,j0-1,i1+1,j1+1)};
  for(const [x,y] of symPoints(p.gx,p.gy))go(x,y);
}
function symPoints(gx,gy){const c=(N-1)/2,o=[[gx,gy]],sy=S.brush.mirror&&S.brush.sym==='none'?'x':S.brush.sym;
  if(sy==='x')o.push([N-1-gx,gy]);else if(sy==='z')o.push([gx,N-1-gy]);else if(sy&&sy[0]==='r'){const n=+sy.slice(1),dx=gx-c,dy=gy-c;for(let q=1;q<n;q++){const a=q/n*Math.PI*2,cs=Math.cos(a),sn=Math.sin(a);o.push([c+dx*cs-dy*sn,c+dx*sn+dy*cs])}}return o}
function applyBrush(p,amt){
  const pr=stroke&&stroke.pressure?clamp(stroke.pressure*1.6,.2,1.6):1;
  for(const [x,y] of symPoints(p.gx,p.gy))brushAt(x,y,amt*pr,p);
}

/* ---------------- erosion ---------------- */
// Droplet hydraulic erosion. h: height array (any units), hs: height scale converting to 0..1 working units.
function erodeDroplets(h,R,drops,power,rnd,region,hs){
  const inv=1/(hs||1),sc=hs||1,Rr=2,offs=[],wts=[];let ws=0;
  for(let dj=-Rr;dj<=Rr;dj++)for(let di=-Rr;di<=Rr;di++){const d=Math.hypot(di,dj);if(d<=Rr){offs.push(dj*R+di,di,dj);const w=Rr-d+.0001;wts.push(w);ws+=w}}
  for(let q=0;q<wts.length;q++)wts[q]/=ws;
  const inertia=.05,cap=4,minSlope=.01,dep=.3,ero=.3*power,evap=.015,grav=4,life=45;
  for(let dd=0;dd<drops;dd++){
    let x,y;if(region){const a=rnd()*6.283,r=Math.sqrt(rnd())*region.r;x=region.x+Math.cos(a)*r;y=region.y+Math.sin(a)*r;if(x<1||y<1||x>R-3||y>R-3)continue}else{x=1+rnd()*(R-3);y=1+rnd()*(R-3)}
    let dx=0,dy=0,speed=1,wat=1,sed=0;
    for(let l=0;l<life;l++){
      const i=x|0,j=y|0,fx=x-i,fy=y-j,k=j*R+i,h00=h[k]*inv,h10=h[k+1]*inv,h01=h[k+R]*inv,h11=h[k+R+1]*inv;
      const gx=(h10-h00)*(1-fy)+(h11-h01)*fy,gy=(h01-h00)*(1-fx)+(h11-h10)*fx,hh=lerp(lerp(h00,h10,fx),lerp(h01,h11,fx),fy);
      dx=dx*inertia-gx*(1-inertia);dy=dy*inertia-gy*(1-inertia);const len=Math.hypot(dx,dy);if(len<1e-9)break;dx/=len;dy/=len;
      const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=R-2||ny>=R-2)break;
      const ni=nx|0,nj=ny|0,nfx=nx-ni,nfy=ny-nj,nk=nj*R+ni,nh=lerp(lerp(h[nk],h[nk+1],nfx),lerp(h[nk+R],h[nk+R+1],nfx),nfy)*inv;
      const dh=nh-hh,c=Math.max(-dh,minSlope)*speed*wat*cap;
      if(sed>c||dh>0){const amt=dh>0?Math.min(dh,sed):(sed-c)*dep;sed-=amt;const a=amt*sc;h[k]+=a*(1-fx)*(1-fy);h[k+1]+=a*fx*(1-fy);h[k+R]+=a*(1-fx)*fy;h[k+R+1]+=a*fx*fy}
      else{const amt=Math.min((c-sed)*ero,-dh);for(let q=0;q<wts.length;q++){const ii=i+offs[q*3+1],jj=j+offs[q*3+2];if(ii<0||jj<0||ii>=R||jj>=R)continue;const kk=jj*R+ii,dw=amt*wts[q]*sc,take=h[kk]<dw?h[kk]:dw;h[kk]-=take;sed+=take*inv}}
      speed=Math.sqrt(Math.max(0,speed*speed-dh*grav));wat*=1-evap;x=nx;y=ny;
    }
  }
}
function thermalPass(h,R,tal){const nb=[-1,1,-R,R];for(let j=1;j<R-1;j++)for(let i=1;i<R-1;i++){const k=j*R+i;let maxD=0,lo=-1;for(let q=0;q<4;q++){const d=h[k]-h[k+nb[q]];if(d>maxD){maxD=d;lo=k+nb[q]}}if(maxD>tal){const mv=(maxD-tal)*.25;h[k]-=mv;h[lo]+=mv}}}
async function runErosion(kind,amount){
  pushUndo();const scale=(N/257)**2,label=kind==='thermal'?'Weathering slopes':kind==='hydraulic'?'Rain is falling':'Working';busy(true,label+'…',0);
  try{
    if(kind==='hydraulic'){const total=Math.round((amount||S.ero.drops)*scale),rnd=mulberry32((S.seed*31+total)|0),ch=5000;
      for(let d=0;d<total;d+=ch){erodeDroplets(H,N,Math.min(ch,total-d),S.ero.power,rnd,null,S.shape.maxH);prog(label+'… '+Math.round(d/total*100)+'%',d/total);await nextFrame()}}
    else if(kind==='thermal'){const tal=Math.tan(S.ero.talus*Math.PI/180)*S.shape.world/(N-1),P=amount||S.ero.passes;for(let p=0;p<P;p++){thermalPass(H,N,tal);if(p%4===3){prog(label+'… '+Math.round(p/P*100)+'%',p/P);await nextFrame()}}}
    else if(kind==='smooth'){blurField(H,N,1)}
    else if(kind==='sharpen'){const b=blurField(H.slice(),N,1);for(let k=0;k<H.length;k++)H[k]=Math.max(0,H[k]+(H[k]-b[k])*.6)}
  }finally{busy(false)}
  for(let k=0;k<H.length;k++)if(H[k]<0)H[k]=0;
  updateAll();saveSoon();if(typeof renderSheet==='function')renderSheet();toast(kind==='hydraulic'?'Rainfall carved new channels':kind==='thermal'?'Slopes settled':'Done');
}

/* ---------------- undo ---------------- */
const undoS=[],redoS=[];
const snap=()=>({town:JSON.stringify(S.town||{b:[],roads:[],walls:[]}),N,H:H.slice(),PC:PC.slice(),PW:PW.slice(),SM:SM.slice(),WM:WM.slice(),MK:MK.slice(),DF:DF.slice(),maxH:S.shape.maxH});
const undoLimit=()=>clamp(Math.floor(QUALITY[S.quality].undoMB*1048576/(N*N*48)),3,16);
function pushUndo(){undoS.push(snap());while(undoS.length>undoLimit())undoS.shift();redoS.length=0;syncUndo()}
function restore(s){if(s.town){S.town=JSON.parse(s.town);TW.dirtyWalls=true;TW.sel=-1}const resChanged=s.N!==N;N=s.N;H=s.H;PC=s.PC;PW=s.PW;SM=s.SM;WM=s.WM;MK=s.MK||new Float32Array(N*N);DF=s.DF||new Float32Array(N*N);S.shape.maxH=prevMaxH=s.maxH;if(resChanged){genMoist();buildGeometry()}if(typeof fluidSync==='function')fluidSync();updateAll();if(typeof renderSheet==='function')renderSheet();saveSoon()}
function undo(){if(!undoS.length)return;redoS.push(snap());restore(undoS.pop());syncUndo();toast('Undone')}
function redo(){if(!redoS.length)return;undoS.push(snap());restore(redoS.pop());syncUndo();toast('Redone')}
function syncUndo(){$('#undo').disabled=!undoS.length;$('#redo').disabled=!redoS.length}
