"use strict";
/* Strata core: math, noise, presets, state and terrain fields. Heights (H) are meters. */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const lerp=(a,b,t)=>a+(b-a)*t;
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
const fmt=n=>Math.round(n).toLocaleString('en-US');
const toLin=c=>Math.pow(c/255,2.2);
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function makeNoise(seed){
  const rnd=mulberry32(seed>>>0),p=new Uint8Array(256);for(let i=0;i<256;i++)p[i]=i;
  for(let i=255;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=p[i];p[i]=p[j];p[j]=t}
  const perm=new Uint8Array(512);for(let i=0;i<512;i++)perm[i]=p[i&255];
  const GX=[1,-1,1,-1,1,-1,0,0],GY=[1,1,-1,-1,0,0,1,-1],F2=.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
  return function(x,y){
    const s=(x+y)*F2,i=Math.floor(x+s),j=Math.floor(y+s),t=(i+j)*G2,x0=x-(i-t),y0=y-(j-t),i1=x0>y0?1:0,j1=1-i1;
    const x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2,ii=i&255,jj=j&255;let n=0,q;
    let t0=.5-x0*x0-y0*y0;if(t0>0){q=perm[ii+perm[jj]]&7;t0*=t0;n+=t0*t0*(GX[q]*x0+GY[q]*y0)}
    let t1=.5-x1*x1-y1*y1;if(t1>0){q=perm[ii+i1+perm[jj+j1]]&7;t1*=t1;n+=t1*t1*(GX[q]*x1+GY[q]*y1)}
    let t2=.5-x2*x2-y2*y2;if(t2>0){q=perm[ii+1+perm[jj+1]]&7;t2*=t2;n+=t2*t2*(GX[q]*x2+GY[q]*y2)}
    return 70*n;
  }
}
function fbm(n,x,y,oct,gain){let s=0,a=1,f=1,norm=0;for(let o=0;o<oct;o++){s+=a*n(x*f+o*17.3,y*f-o*9.1);norm+=a;a*=gain;f*=2.02}return s/norm}
function ridged(n,x,y,oct,gain){let s=0,a=1,f=1,norm=0,w=1;for(let o=0;o<oct;o++){let v=1-Math.abs(n(x*f+o*31.7,y*f+o*11.9));v*=v;v*=w;w=clamp(v*2,0,1);s+=a*v;norm+=a;a*=gain;f*=2.02}return s/norm}
function hash2(x,y,s){let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296}
let WF1=0,WF2=0,WID=0;
function worley(x,y,s,jit){const ix=Math.floor(x),iy=Math.floor(y);let f1=9,f2=9;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=ix+i,cy=iy+j,px=cx+.5+(hash2(cx,cy,s)-.5)*jit,py=cy+.5+(hash2(cx,cy,s+7)-.5)*jit,d=Math.hypot(px-x,py-y);if(d<f1){f2=f1;f1=d;WID=hash2(cx,cy,s+13)}else if(d<f2)f2=d}
  WF1=f1;WF2=f2;return f1}
/* safe octave count: finest noise at least ~5 cells wide */
const octCap=(oct,R,freq)=>Math.max(1,Math.min(oct,Math.floor(Math.log2((R/5)/Math.max(freq,.1)/1.01))+1));

/* ---------------- data ---------------- */
const PALETTES={
  temperate:{name:'Temperate',sand:[194,178,128],lush:[74,104,44],dry:[138,130,72],alpine:[112,100,78],rock:[114,108,100],rock2:[84,80,76],snow:[236,240,244],seabed:[118,108,82]},
  arid:{name:'Arid',sand:[218,186,132],lush:[176,134,86],dry:[200,152,98],alpine:[164,106,70],rock:[152,86,58],rock2:[116,64,46],snow:[240,232,220],seabed:[150,120,82]},
  tundra:{name:'Tundra',sand:[150,146,130],lush:[98,112,82],dry:[132,130,106],alpine:[122,120,110],rock:[100,102,106],rock2:[74,78,84],snow:[243,246,250],seabed:[90,96,96]},
  volcanic:{name:'Volcanic',sand:[72,66,62],lush:[64,88,42],dry:[86,78,66],alpine:[60,56,54],rock:[46,44,44],rock2:[30,28,28],snow:[214,210,204],seabed:[42,42,42]},
  autumn:{name:'Autumn',sand:[196,176,128],lush:[156,104,38],dry:[176,128,56],alpine:[122,98,74],rock:[118,108,98],rock2:[86,78,72],snow:[240,240,244],seabed:[110,100,80]}
};
const PRESETS={
  'Alpine':{shape:{freq:2.2,oct:7,gain:.5,ridges:.72,warp:.25,peaks:1.8,island:0,terrace:0,tsteps:6,maxH:520,world:3800},biome:{palette:'temperate',sea:.06,snow:.62,rock:.55,lush:.7,beach:.01}},
  'Archipelago':{shape:{freq:3.2,oct:6,gain:.5,ridges:.25,warp:.45,peaks:1.25,island:.85,terrace:0,tsteps:6,maxH:170,world:2600},biome:{palette:'temperate',sea:.32,snow:.97,rock:.75,lush:.85,beach:.02}},
  'Rolling hills':{shape:{freq:1.6,oct:5,gain:.45,ridges:.1,warp:.2,peaks:1.1,island:0,terrace:0,tsteps:6,maxH:130,world:2200},biome:{palette:'temperate',sea:.04,snow:1,rock:.9,lush:.9,beach:.01}},
  'Canyon mesas':{shape:{freq:2,oct:6,gain:.5,ridges:.3,warp:.35,peaks:1,island:0,terrace:.85,tsteps:7,maxH:240,world:2600},biome:{palette:'arid',sea:0,snow:1,rock:.45,lush:.3,beach:0}},
  'Dune sea':{shape:{freq:4.2,oct:4,gain:.38,ridges:.9,warp:.65,peaks:1,island:0,terrace:0,tsteps:6,maxH:60,world:1400},biome:{palette:'arid',sea:0,snow:1,rock:1.2,lush:0,beach:0}},
  'Volcano isle':{shape:{freq:3,oct:6,gain:.5,ridges:.45,warp:.2,peaks:1.25,cone:.88,crater:.55,island:.9,terrace:0,tsteps:6,maxH:760,world:2400},biome:{palette:'volcanic',sea:.22,snow:.86,rock:.5,lush:.75,beach:.012}},
  'Frozen ridge':{shape:{freq:2.8,oct:7,gain:.52,ridges:.9,warp:.3,peaks:1.5,island:0,terrace:0,tsteps:6,maxH:480,world:3800},biome:{palette:'tundra',sea:.1,snow:.38,rock:.5,lush:.35,beach:.005}},
  'Autumn valley':{shape:{freq:1.9,oct:6,gain:.48,ridges:.4,warp:.4,peaks:1.4,island:0,terrace:0,tsteps:6,maxH:320,world:3000},biome:{palette:'autumn',sea:.08,snow:.9,rock:.6,lush:.75,beach:.008}}
};
const SHAPE_RANGES={freq:[.8,6,.05],oct:[3,8,1],gain:[.3,.65,.01],ridges:[0,1,.01],warp:[0,1,.01],peaks:[.6,3,.05],cone:[0,1,.01],crater:[0,1,.01],island:[0,1,.01],terrace:[0,1,.01],tsteps:[3,14,1],maxH:[20,1200,5],world:[400,8000,50]};
const QUALITY={
  battery:{label:'Battery saver',sub:'129² grid · 1× pixels · no shadows',res:129,dpr:1,shadow:0,scatter:.3,sim:97,tex:1024,undoMB:40},
  balanced:{label:'Balanced',sub:'257² grid · 2× pixels · soft shadows',res:257,dpr:2,shadow:2048,scatter:.7,sim:129,tex:2048,undoMB:90},
  pro:{label:'Pro',sub:'513² grid · sharp shadows · dense forests',res:513,dpr:2.5,shadow:2048,scatter:1.25,sim:193,tex:2048,undoMB:160},
  ultra:{label:'Ultra',sub:'1025² grid · for iPhone 17 Pro-class chips',res:1025,dpr:3,shadow:4096,scatter:2,sim:257,tex:4096,undoMB:220}
};
const SCATTER_TYPES={
  conifer:{label:'Conifers',max:9000,perKm:1300,unit:17,def:{on:true,density:.55,lo:.06,hi:.78,slope:38,size:1.6,cluster:.6}},
  broadleaf:{label:'Broadleaf trees',max:6000,perKm:900,unit:13,def:{on:true,density:.4,lo:.0,hi:.42,slope:26,size:1.6,cluster:.5}},
  bush:{label:'Bushes',max:9000,perKm:1500,unit:3.2,def:{on:true,density:.45,lo:0,hi:.6,slope:40,size:1.8,cluster:.35}},
  grass:{label:'Grass tufts',max:22000,perKm:4200,unit:1.3,def:{on:true,density:.55,lo:0,hi:.5,slope:30,size:2,cluster:.25}},
  boulder:{label:'Boulders',max:4000,perKm:420,unit:4.5,def:{on:true,density:.35,lo:0,hi:1,slope:75,size:1.6,cluster:.2}},
  deadfall:{label:'Fallen trees & stumps',max:3000,perKm:240,unit:9,def:{on:true,density:.35,lo:0,hi:.7,slope:28,size:1.4,cluster:.65}},
  structure:{label:'Buildings & props',max:60,unit:8,def:{on:true,count:6,size:1.6}}
};
const PAINTS={grass:{n:'Grass',c:[78,106,46]},meadow:{n:'Meadow',c:[136,138,68]},sand:{n:'Sand',c:[208,188,138]},dirt:{n:'Dirt',c:[104,80,56]},gravel:{n:'Gravel',c:[150,140,124]},cobble:{n:'Cobblestone',c:[122,114,104]},clay:{n:'Clay',c:[168,104,70]},asphalt:{n:'Asphalt',c:[62,62,64]},mud:{n:'Wet mud',c:[70,58,44]},rock:{n:'Rock',c:[118,112,104]},basalt:{n:'Basalt',c:[50,47,46]},snow:{n:'Snow',c:[238,242,246]},erase:{n:'Erase',c:null}};
const LOOKS={natural:{n:'Natural',d:'Biome colors, soft daylight'},clay:{n:'Clay',d:'Matte studio clay, reads shape only'},titanium:{n:'Titanium',d:'Brushed metal, mirror reflections'},copper:{n:'Copper',d:'Anodized copper sculpture'},heat:{n:'Elevation',d:'Height-colored map'}};

function autoQuality(){const d=window.devicePixelRatio||1,c=navigator.hardwareConcurrency||4;return d>=3&&c>=4?'pro':d>=2?'balanced':'battery'}
const scatterDefaults=()=>{const o={};for(const k in SCATTER_TYPES)o[k]={...SCATTER_TYPES[k].def};return o};
const DEF=()=>({v:2,preset:'Alpine',seed:4127,source:'gen',quality:autoQuality(),
  shape:{cone:0,crater:0,...PRESETS.Alpine.shape},biome:{...PRESETS.Alpine.biome},macro:{x:.6,y:.35},
  tool:'raise',paint:'grass',stamp:'mountain',plant:'add',brush:{size:240,strength:.5,falloff:.7,mirror:false,hold:false,shape:'soft',sym:'none',lazy:.25,cat:'shape'},maskMode:'add',
  ero:{drops:60000,power:1,talus:34,passes:30},
  fluid:{rain:.35,flow:.7,carve:.5,evap:.25,springs:[]},
  lava:{rate:.6,cool:.45,fluid:.6,vents:[]},snow:{fall:.5,repose:36,melt:.35,line:.45,addHeight:false},wind:{dir:60,power:.6,supply:.5},
  sim:{level:'medium',autoBake:true},weather:{power:.6,dir:60},
  scatter:{on:true,forest:1,types:scatterDefaults()},structs:[],
  view:{vex:1,sunEl:34,sunAz:135,water:true,base:true,wire:false,shadows:true,contours:false,look:'natural',anim:true,clouds:true,mask:true,tod:.35,post:false},
  cam:{grade:'natural',vig:.3,grain:.03,tilt:0,focus:.5,expo:1,lens:1,grid:false,hq:true,mode:'photo',move:'turntable',dur:8},
  exp:{target:'blender',fmt:'glb',detail:1,base:true,depth:40,tex:2048,scatter:true,masks:true,pbr:true,tiles:1,atlas:true},
  photo:{mode:'auto',height:.6,blur:2,invert:false,detail:.2,colors:false,ai:true,pin:false,scatter:true,thin:true,quick:true},
  graph:null,auto:true,tab:'create',sub:{create:'generate',sim:'water'},mode:'orbit',name:'Untitled terrain'});
const VARIANTS={conifer:['conifer','pine'],broadleaf:['broadleaf','birch'],deadfall:['log','stump']};
let S=DEF();
let N=257,H,M,PC,PW,SM,WM,MK,DF,mNoise,stats={lo:0,hi:1,water:0};
let prevMaxH=S.shape.maxH;

/* ---------------- fields ---------------- */
function genField(R,sh,seed){
  const n=makeNoise(seed),n2=makeNoise(seed*7+13),out=new Float32Array(R*R),oct=octCap(sh.oct,R,sh.freq);let lo=1e9,hi=-1e9;
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){
    const x=i/(R-1)*sh.freq,y=j/(R-1)*sh.freq;let wx=0,wy=0;
    if(sh.warp>0){wx=fbm(n2,x+5.2,y+1.3,4,.5)*sh.warp*1.6;wy=fbm(n2,x-3.7,y+8.1,4,.5)*sh.warp*1.6}
    const a=fbm(n,x+wx,y+wy,oct,sh.gain)*.5+.5,b=sh.ridges>0?ridged(n,x+wx+3.3,y+wy-7.7,oct,sh.gain):0,h=lerp(a,b,sh.ridges);
    out[j*R+i]=h;if(h<lo)lo=h;if(h>hi)hi=h;
  }
  const inv=1/(hi-lo||1),st=sh.tsteps||6;
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){
    const k=j*R+i,dx=i/(R-1)-.5,dy=j/(R-1)-.5,d=Math.sqrt(dx*dx+dy*dy)*2;let h=(out[k]-lo)*inv;
    if(sh.cone>0)h=lerp(h,h*.3+.7*Math.pow(clamp(1-d*1.15,0,1),1.6),sh.cone);
    if(sh.crater>0)h=Math.max(0,h-sh.crater*.4*(1-smooth(.05,.15,d)));
    h=Math.pow(h,sh.peaks);
    if(sh.island>0){const m=1-smooth(.3,1,d);h=lerp(h,h*m-.08*(1-m),sh.island)}
    if(sh.terrace>0){const t=h*st,k0=Math.floor(t),f=t-k0,f2=smooth(.55,.95,f)*.85+f*.15;h=lerp(h,(k0+f2)/st,sh.terrace)}
    out[k]=Math.max(0,h);
  }
  return out;
}
function blurField(f,R,passes){if(passes<=0)return f;let a=f,b=new Float32Array(f.length);
  for(let p=0;p<passes;p++){
    for(let j=0;j<R;j++){const r=j*R;for(let i=0;i<R;i++)b[r+i]=(a[r+(i>0?i-1:i)]+a[r+i]*2+a[r+(i<R-1?i+1:i)])*.25}
    for(let j=0;j<R;j++){const u=(j>0?j-1:j)*R,d=(j<R-1?j+1:j)*R,r=j*R;for(let i=0;i<R;i++)a[r+i]=(b[u+i]+b[r+i]*2+b[d+i])*.25}
  }return a}
function normalizeField(f){let lo=1e9,hi=-1e9;for(let i=0;i<f.length;i++){if(f[i]<lo)lo=f[i];if(f[i]>hi)hi=f[i]}const inv=1/(hi-lo||1);for(let i=0;i<f.length;i++)f[i]=(f[i]-lo)*inv;return f}
function resample(arr,oldN,newN,ch=1){
  if(oldN===newN)return arr.slice();const out=new Float32Array(newN*newN*ch);
  for(let j=0;j<newN;j++)for(let i=0;i<newN;i++){
    const gx=Math.min(i/(newN-1)*(oldN-1),oldN-1.001),gy=Math.min(j/(newN-1)*(oldN-1),oldN-1.001),a=gx|0,b=gy|0,fx=gx-a,fy=gy-b;
    for(let c=0;c<ch;c++){const k=(b*oldN+a)*ch+c,r=oldN*ch;out[(j*newN+i)*ch+c]=lerp(lerp(arr[k],arr[k+ch],fx),lerp(arr[k+r],arr[k+r+ch],fx),fy)}
  }return out}
function sampleField(f,R,gx,gy){gx=clamp(gx,0,R-1.001);gy=clamp(gy,0,R-1.001);const i=gx|0,j=gy|0,fx=gx-i,fy=gy-j,k=j*R+i;return lerp(lerp(f[k],f[k+1],fx),lerp(f[k+R],f[k+R+1],fx),fy)}
const hAt=(gx,gy)=>sampleField(H,N,gx,gy);
const moistAt=(u,v)=>clamp(fbm(mNoise,u*3.2+9,v*3.2-4,4,.5)*.7+.5,0,1);
function genMoist(){mNoise=makeNoise(S.seed+77);M=new Float32Array(N*N);for(let j=0;j<N;j++)for(let i=0;i<N;i++)M[j*N+i]=moistAt(i/(N-1),j/(N-1))}
function clearLayers(keepMasks){PC=new Float32Array(N*N*3);PW=new Float32Array(N*N);if(!keepMasks){SM=new Float32Array(N*N).fill(1);WM=new Float32Array(N*N);MK=new Float32Array(N*N);DF=new Float32Array(N*N)}if(!MK||MK.length!==N*N)MK=new Float32Array(N*N);if(!DF||DF.length!==N*N)DF=new Float32Array(N*N)}
function genHeights(){const f=genField(N,S.shape,S.seed);H=new Float32Array(N*N);for(let k=0;k<f.length;k++)H[k]=f[k]*S.shape.maxH;prevMaxH=S.shape.maxH}
function computeStats(){let lo=1e9,hi=-1e9,w=0;const sea=S.biome.sea*S.shape.maxH;for(let k=0;k<H.length;k++){const h=H[k];if(h<lo)lo=h;if(h>hi)hi=h;if(h<sea)w++}stats={lo,hi,water:w/H.length}}
const seaLevel=()=>S.biome.sea*S.shape.maxH;

/* shaded relief preview of a 0..1 field */
function drawRelief(cv,f,R,pal){
  const P=PALETTES[pal||S.biome.palette],sea=S.biome.sea,ctx=cv.getContext('2d'),w=cv.width=R,h=cv.height=R,img=ctx.createImageData(w,h),d=img.data;
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){
    const k=j*R+i,v=f[k],dx=f[j*R+Math.min(i+1,R-1)]-f[j*R+Math.max(i-1,0)],dy=f[Math.min(j+1,R-1)*R+i]-f[Math.max(j-1,0)*R+i];
    const sh=clamp(.78-(dx*1.1+dy*.7)*R*.09,.25,1.25);let c;
    if(sea>0&&v<sea)c=[40,96,120];else{const t=sea>=1?v:(v-sea)/(1-sea);c=t<.45?P.lush:t<.7?P.dry:t<.86?P.rock:P.snow;c=[lerp(c[0],P.rock[0],t*.4),lerp(c[1],P.rock[1],t*.4),lerp(c[2],P.rock[2],t*.4)]}
    const o=k*4;d[o]=c[0]*sh;d[o+1]=c[1]*sh;d[o+2]=c[2]*sh;d[o+3]=255;
  }
  ctx.putImageData(img,0,0);
}

/* ---------------- coloring ---------------- */
const C3=[0,0,0];
const HEAT=[[22,44,96],[34,120,150],[96,176,104],[226,208,92],[222,112,52],[246,240,232]];
function colorAt(h,ny,m,ao,pr,pg,pb,pw,wet){
  const b=S.biome,maxH=S.shape.maxH,hn=h/maxH,sea=b.sea,slope=1-ny;let r,g,bl;
  if(S.view.look==='heat'){const t=clamp((h-stats.lo)/((stats.hi-stats.lo)||1),0,.9999)*(HEAT.length-1),i=t|0,f=t-i,A=HEAT[i],B=HEAT[i+1];
    C3[0]=lerp(A[0],B[0],f)*ao;C3[1]=lerp(A[1],B[1],f)*ao;C3[2]=lerp(A[2],B[2],f)*ao;return C3}
  const P=PALETTES[b.palette];
  if(sea>0&&hn<sea){
    const dep=clamp((sea-hn)/Math.max(sea,.01),0,1),t=smooth(0,.35,dep),dk=1-.45*dep;
    r=lerp(P.sand[0],P.seabed[0],t)*dk;g=lerp(P.sand[1],P.seabed[1],t)*dk;bl=lerp(P.sand[2],P.seabed[2],t)*dk;
  }else{
    const t=sea>=1?0:clamp((hn-sea)/(1-sea),0,1),wetn=clamp(b.lush*(.55+.9*m)-t*.8+wet*.5,0,1);
    r=lerp(P.dry[0],P.lush[0],wetn);g=lerp(P.dry[1],P.lush[1],wetn);bl=lerp(P.dry[2],P.lush[2],wetn);
    const al=smooth(.5,.85,t);r=lerp(r,P.alpine[0],al);g=lerp(g,P.alpine[1],al);bl=lerp(bl,P.alpine[2],al);
    if(b.beach>0&&sea>0){const be=(1-smooth(sea,sea+b.beach,hn))*(1-smooth(.15,.3,slope));r=lerp(r,P.sand[0],be);g=lerp(g,P.sand[1],be);bl=lerp(bl,P.sand[2],be)}
    const thr=b.rock*.42*(1-.35*smooth(.4,.9,t)),rk=smooth(thr-.05,thr+.05,slope);
    if(rk>0){const s=(Math.sin(h*.09+m*4)*.5+.5)*.8;r=lerp(r,lerp(P.rock[0],P.rock2[0],s),rk);g=lerp(g,lerp(P.rock[1],P.rock2[1],s),rk);bl=lerp(bl,lerp(P.rock[2],P.rock2[2],s),rk)}
    if(b.snow<1){const sl=b.snow+(m-.5)*.08,sn=smooth(sl-.03,sl+.03,hn)*(1-smooth(.3,.5,slope));r=lerp(r,P.snow[0],sn);g=lerp(g,P.snow[1],sn);bl=lerp(bl,P.snow[2],sn)}
    if(wet>.02){const w=Math.min(wet,1);r*=1-.42*w;g*=1-.28*w;bl*=1-.30*w}
  }
  if(pw>0){r=lerp(r,pr,pw);g=lerp(g,pg,pw);bl=lerp(bl,pb,pw)}
  C3[0]=clamp(r*ao,0,255);C3[1]=clamp(g*ao,0,255);C3[2]=clamp(bl*ao,0,255);return C3;
}

/* ---------------- toast / busy ---------------- */
let toastT=0;function toast(t,kind){const el=$('#toast');el.innerHTML=(kind==='ok'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>':kind==='warn'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/></svg>':'')+'<span></span>';el.lastChild.textContent=t;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>el.hidden=true,kind==='warn'?3800:2600);if(kind==='ok')haptic(12,'success');if(kind==='warn')haptic(12,'warn')}
/* haptics: native (Capacitor test app) → Android vibrate → iOS 18 Safari switch-control tick */
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let _hapEl=null,_hapT=0,_capH;
function capHaptics(){if(_capH!==undefined)return _capH;const C=window.Capacitor;_capH=C&&C.isNativePlatform&&C.isNativePlatform()?(C.Plugins&&C.Plugins.Haptics)||(C.registerPlugin&&C.registerPlugin('Haptics'))||null:null;return _capH}
function haptic(ms,kind){
  if(!SET.haptics)return;const now=performance.now();if(now-_hapT<(ms<=5?45:30))return;_hapT=now;ms=ms||8;
  try{const H=capHaptics();if(H){if(kind==='success')H.notification({type:'SUCCESS'});else if(kind==='warn')H.notification({type:'WARNING'});else if(ms<=5)H.selectionChanged?H.selectionChanged():H.impact({style:'LIGHT'});else H.impact({style:ms>14?'HEAVY':ms>9?'MEDIUM':'LIGHT'});return}
    if(navigator.vibrate){navigator.vibrate(ms);return}
    if(IOS){if(!_hapEl){_hapEl=document.createElement('label');_hapEl.setAttribute('aria-hidden','true');_hapEl.style.cssText='position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';const i=document.createElement('input');i.type='checkbox';i.setAttribute('switch','');i.tabIndex=-1;_hapEl.appendChild(i);document.body.appendChild(_hapEl)}_hapEl.click()}}catch(e){}}
function celebrate(){const c=$('#celebrate');if(!c||SET.reduceMotion)return;const cols=['var(--gold)','var(--gold-hi)','var(--accent-hi)','var(--blue)','#fff'];let h='';for(let i=0;i<22;i++){const a=Math.random()*6.283,d=70+Math.random()*90;h+=`<i style="background:${cols[i%5]};--x:${Math.cos(a)*d}px;--y:${Math.sin(a)*d-40}px;--r:${Math.random()*540}deg;animation-delay:${Math.random()*.08}s"></i>`}c.innerHTML=h;c.classList.remove('go');void c.offsetWidth;c.classList.add('go')}
/* device settings (per browser), separate from the project */
const SET_DEF={sound:true,volume:.6,uiLarge:false,adaptive:true,theme:'',units:'m',invertY:false,sens:1,leftHand:false,reduceMotion:false,apiKey:'',model:'claude-opus-5-5',haptics:true,hints:true};
let SET={...SET_DEF};try{SET={...SET_DEF,...JSON.parse(localStorage.getItem('strata.settings')||'{}')}}catch(e){}
function saveSettings(){try{localStorage.setItem('strata.settings',JSON.stringify(SET))}catch(e){}}
const fmtLen=m=>SET.units==='ft'?fmt(m*3.28084)+' ft':fmt(m)+' m';
function busy(on,t,p){$('#busy').hidden=!on;if(t)$('#busyText').textContent=t;$('#busyBar').style.width=((p||0)*100)+'%'}
const prog=(t,p)=>{$('#busyText').textContent=t;$('#busyBar').style.width=(clamp(p,0,1)*100)+'%'};
const svg=(p,w)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w||2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
