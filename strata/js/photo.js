"use strict";
/* Terrain Gen Photo → terrain.
   Auto mode: Claude classifies the image (sketch, contour map, shaded relief, satellite, ground photo), reads a 32×32 height plan,
   the light direction, water and every man-made feature (roads by material, rivers, bridges, buildings by material, props).
   Without AI, a local analyzer classifies every pixel and picks the right reconstruction (see below). Shaded relief is
   integrated along the light direction (shape from shading) and checked against land cover, so hills are never inverted. */
const PHOTO_MODES={
  auto:{n:'Auto (AI decides)',d:'Reads any map, sketch, contour, shaded relief or photo'},
  shaded:{n:'Shaded relief / hillshade',d:'Hills from their shadows (light direction is detected)'},
  depth:{n:'Ground-level photo',d:'Skyline, lakes and slopes become a top-down map'},
  aerial:{n:'Map or satellite',d:'Land cover, shading and water shape the land'},
  height:{n:'Heightmap image',d:'Brightness is height (DEMs, grayscale maps)'},
  sketch:{n:'Ridge sketch',d:'Dark pen strokes become ridgelines'},
  contour:{n:'Contour map',d:'AI reads topographic lines into heights'}
};
const REF={img:null,url:null,lum:null,rgb:null,water:null,R:0,ai:null,status:''};
function pickPhoto(){$('#fileIn').value='';$('#fileIn').click()}
$('#fileIn').addEventListener('change',async e=>{
  const f=e.target.files&&e.target.files[0];if(!f)return;
  if(!/^image\//.test(f.type)){toast('Choose an image file','warn');return}
  try{await loadRef(f);sfx('pop');if(typeof renderSheet==='function')renderSheet();if(S.photo.quick!==false)buildFromPhoto()}catch(err){toast('Could not read that image','warn')}
});
function loadRef(blob){return new Promise((res,rej)=>{const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{if(REF.url)URL.revokeObjectURL(REF.url);REF.img=img;REF.url=url;REF.ai=null;REF.status='';analyzeRef();$('#refImg').src=url;$('#refPin').hidden=!S.photo.pin;res()};img.onerror=rej;img.src=url})}
function analyzeRef(){
  const R=256,c=document.createElement('canvas');c.width=c.height=R;const x=c.getContext('2d'),img=REF.img,s=Math.min(img.naturalWidth,img.naturalHeight);
  x.drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,R,R);const d=x.getImageData(0,0,R,R).data;
  REF.R=R;REF.lum=new Float32Array(R*R);REF.rgb=new Float32Array(R*R*3);REF.water=new Float32Array(R*R);
  for(let k=0;k<R*R;k++){const r=d[k*4],g=d[k*4+1],b=d[k*4+2];REF.lum[k]=(.2126*toLin(r)+.7152*toLin(g)+.0722*toLin(b))**(1/2.2);REF.rgb[k*3]=r;REF.rgb[k*3+1]=g;REF.rgb[k*3+2]=b;
    REF.water[k]=b>r+18&&b>=g-6&&b>60?1:0}
  blurField(REF.water,R,2);REF.cls=new Uint8Array(R*R);for(let k=0;k<R*R;k++)REF.cls[k]=classify(REF.rgb[k*3],REF.rgb[k*3+1],REF.rgb[k*3+2]);
  analyzeFull();
}
async function refBlob(){const c=document.createElement('canvas'),img=REF.img,m=1280,sc=Math.min(1,m/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.round(img.naturalWidth*sc);c.height=Math.round(img.naturalHeight*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return new Promise(r=>c.toBlob(r,'image/jpeg',.88))}
function minmax(f,R,r,useMax){const a=new Float32Array(f.length),o=new Float32Array(f.length);
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){let v=useMax?-1e9:1e9;for(let d=-r;d<=r;d++){const x=f[j*R+clamp(i+d,0,R-1)];v=useMax?Math.max(v,x):Math.min(v,x)}a[j*R+i]=v}
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){let v=useMax?-1e9:1e9;for(let d=-r;d<=r;d++){const x=a[clamp(j+d,0,R-1)*R+i];v=useMax?Math.max(v,x):Math.min(v,x)}o[j*R+i]=v}return o}
function removeThin(f,R,r){return minmax(minmax(minmax(minmax(f,R,r,false),R,r,true),R,r,true),R,r,false)}
/* shape from shading: shading ≈ slope toward the light; integrate it (Poisson, multigrid-lite via coarse-to-fine Jacobi) */
function shadeToHeight(L,R,azDeg){
  const a=(azDeg??45)*Math.PI/180,lx=Math.cos(a),ly=Math.sin(a);let mean=0;for(const v of L)mean+=v;mean/=L.length;
  const gx=new Float32Array(R*R),gy=new Float32Array(R*R);for(let k=0;k<L.length;k++){const s=L[k]-mean;gx[k]=s*lx;gy[k]=s*ly}
  const div=new Float32Array(R*R);for(let j=1;j<R-1;j++)for(let i=1;i<R-1;i++){const k=j*R+i;div[k]=(gx[k+1]-gx[k-1]+gy[k+R]-gy[k-R])*.5}
  let h=new Float32Array(R*R);const solve=(h,div,R,it)=>{const t=new Float32Array(R*R);for(let n=0;n<it;n++){for(let j=1;j<R-1;j++)for(let i=1;i<R-1;i++){const k=j*R+i;t[k]=(h[k-1]+h[k+1]+h[k-R]+h[k+R]-div[k])*.25}h.set(t)}return h};
  const r2=R>>2,d2=resample(div,R,r2);let h2=solve(new Float32Array(r2*r2),d2.map(v=>v*16),r2,500);h=resample(h2,r2,R);h=solve(h,div,R,160);return normalizeField(h);
}
function correl(a,b){let ma=0,mb=0;for(let i=0;i<a.length;i++){ma+=a[i];mb+=b[i]}ma/=a.length;mb/=b.length;let s=0,sa=0,sb=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;s+=x*y;sa+=x*x;sb+=y*y}return s/Math.sqrt(sa*sb||1)}
function sketchField(R){
  const L=resample(REF.lum,REF.R,R),ink=new Float32Array(R*R);let mean=0;for(const v of L)mean+=v;mean/=L.length;
  const thr=Math.min(mean*.7,.45),INF=1e9;for(let k=0;k<ink.length;k++)ink[k]=(S.photo.invert?L[k]>1-thr:L[k]<thr)?0:INF;
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){const k=j*R+i;if(i>0)ink[k]=Math.min(ink[k],ink[k-1]+1);if(j>0)ink[k]=Math.min(ink[k],ink[k-R]+1);if(i>0&&j>0)ink[k]=Math.min(ink[k],ink[k-R-1]+1.414);if(i<R-1&&j>0)ink[k]=Math.min(ink[k],ink[k-R+1]+1.414)}
  for(let j=R-1;j>=0;j--)for(let i=R-1;i>=0;i--){const k=j*R+i;if(i<R-1)ink[k]=Math.min(ink[k],ink[k+1]+1);if(j<R-1)ink[k]=Math.min(ink[k],ink[k+R]+1);if(i<R-1&&j<R-1)ink[k]=Math.min(ink[k],ink[k+R+1]+1.414);if(i>0&&j<R-1)ink[k]=Math.min(ink[k],ink[k+R-1]+1.414)}
  const n=makeNoise(S.seed+3),spread=R*.12,o=new Float32Array(R*R);
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){const k=j*R+i,t=clamp(ink[k]/spread,0,1);o[k]=Math.pow(1-t,1.8)*(.8+.2*ridged(n,i/R*5,j/R*5,5,.5))+.05*(fbm(n,i/R*3,j/R*3,4,.5)*.5+.5)}
  return o;
}
function aiGridField(R){
  const g=REF.ai&&REF.ai.heights;if(!Array.isArray(g)||!g.length)return null;const n=g.length,m=(g[0]||[]).length||n,f=new Float32Array(n*m);
  for(let j=0;j<n;j++)for(let i=0;i<m;i++)f[j*m+i]=clamp((+((g[j]||[])[i])||0)/100,0,1);
  const sq=Math.max(n,m),fs=new Float32Array(sq*sq);for(let j=0;j<sq;j++)for(let i=0;i<sq;i++)fs[j*sq+i]=f[Math.min(n-1,Math.floor(j/sq*n))*m+Math.min(m-1,Math.floor(i/sq*m))];
  return blurField(resample(fs,sq,R),R,Math.round(R/64)+2);
}
/* ---------------- local image understanding (works with or without AI) ----------------
   Every pixel is classified (sky, water, snow, vegetation, rock, dry ground, deep shadow), the image type is detected
   (ground photo with a skyline, top-down map/satellite, grayscale heightmap, hillshade or sketch), and the terrain is
   rebuilt with the method that fits that type. A final pass always makes it look like real land: detail, weathering,
   water kept low and level, trees only where the image shows vegetation, and colors taken from the image. */
const CL={sky:0,water:1,snow:2,veg:3,rock:4,dry:5,dark:6};
function rgb2hsv(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d>1e-6){h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360}return[h,mx?d/mx:0,mx]}
function hsv2rgb(h,s,v){const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1))};return[f(5)*255,f(3)*255,f(1)*255]}
function classify(r,g,b){const[h,s,v]=rgb2hsv(r,g,b);
  if(v>.8&&s<.14)return CL.snow;
  if(s>.13&&h>=172&&h<=250&&b>r+10)return CL.water;
  if(s>.13&&h>=52&&h<172&&v>.07)return CL.veg;
  if(v<.15)return CL.dark;
  if(s>.24&&h>=18&&h<52&&v>.38)return CL.dry;
  return CL.rock}
function dist2D(mask,R){const INF=1e9,d=new Float32Array(R*R);for(let k=0;k<d.length;k++)d[k]=mask[k]>.5?0:INF;
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){const k=j*R+i;if(i>0)d[k]=Math.min(d[k],d[k-1]+1);if(j>0)d[k]=Math.min(d[k],d[k-R]+1);if(i>0&&j>0)d[k]=Math.min(d[k],d[k-R-1]+1.414);if(i<R-1&&j>0)d[k]=Math.min(d[k],d[k-R+1]+1.414)}
  for(let j=R-1;j>=0;j--)for(let i=R-1;i>=0;i--){const k=j*R+i;if(i<R-1)d[k]=Math.min(d[k],d[k+1]+1);if(j<R-1)d[k]=Math.min(d[k],d[k+R]+1);if(i<R-1&&j<R-1)d[k]=Math.min(d[k],d[k+R+1]+1.414);if(i>0&&j<R-1)d[k]=Math.min(d[k],d[k+R-1]+1.414)}
  return d}
function variance(f){let m=0;for(const v of f)m+=v;m/=f.length;let s=0;for(const v of f)s+=(v-m)*(v-m);return s/f.length}
/* full-frame analysis (whole picture, stretched to a square) used for ground photos and colors */
function analyzeFull(){
  const R=256,c=document.createElement('canvas');c.width=c.height=R;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(REF.img,0,0,R,R);const d=x.getImageData(0,0,R,R).data;
  const F={R,rgb:new Float32Array(R*R*3),lum:new Float32Array(R*R),sat:new Float32Array(R*R),cls:new Uint8Array(R*R),sky:new Uint8Array(R*R),ys:new Float32Array(R)};
  let satSum=0;for(let k=0;k<R*R;k++){const r=d[k*4],g=d[k*4+1],b=d[k*4+2],[h,s,v]=rgb2hsv(r,g,b);F.rgb[k*3]=r;F.rgb[k*3+1]=g;F.rgb[k*3+2]=b;F.lum[k]=(.2126*toLin(r)+.7152*toLin(g)+.0722*toLin(b))**(1/2.2);F.sat[k]=s;satSum+=s;F.cls[k]=classify(r,g,b)}
  /* sky: flood fill from the top edge through sky-like, smooth pixels */
  /* sky and clouds are smooth; snow and rock on a mountain have texture and a sharp silhouette against the sky */
  const G=new Float32Array(R*R);for(let j=1;j<R-1;j++)for(let i=1;i<R-1;i++){const k=j*R+i;G[k]=Math.abs(F.lum[k+1]-F.lum[k-1])+Math.abs(F.lum[k+R]-F.lum[k-R])}
  const skyLike=k=>{const r=F.rgb[k*3],g=F.rgb[k*3+1],b=F.rgb[k*3+2],[h,s,v]=rgb2hsv(r,g,b);if(G[k]>.09)return false;
    return(v>.4&&b>=r-6&&h>=160&&h<=270&&s<.85)||(v>.6&&s<.28)||(v>.45&&s<.5&&(h<50||h>300)&&r>=b)/* clouds, haze, sunset glow */};
  const st=[];for(let i=0;i<R;i++)if(skyLike(i)){F.sky[i]=1;st.push(i)}
  while(st.length){const k=st.pop(),i=k%R,j=(k/R)|0;for(const[n,ok]of[[k-1,i>0],[k+1,i<R-1],[k+R,j<R-1],[k-R,j>0]]){if(!ok||F.sky[n]||!skyLike(n))continue;if(Math.abs(F.lum[n]-F.lum[k])>.1)continue;F.sky[n]=1;st.push(n)}}
  /* skyline per column: lowest sky pixel that still has mostly sky above it (small unfilled clouds are tolerated) */
  let skyN=0,cols=0;for(let i=0;i<R;i++){let c=0,ys=0;for(let y=0;y<R;y++){if(F.sky[y*R+i])c++;if(F.sky[y*R+i]&&c/(y+1)>=.8)ys=y+1;if(y-ys>R*.25)break}F.ys[i]=ys;if(ys>2)cols++;for(let y=0;y<ys;y++)F.sky[y*R+i]=1}
  {const t=Array.from(F.ys);for(let i=0;i<R;i++){const w=t.slice(Math.max(0,i-6),i+7).sort((a,b)=>a-b);F.ys[i]=w[w.length>>1]}}
  for(const v of F.sky)skyN+=v;
  F.skyFrac=skyN/(R*R);F.skyCols=cols/R;F.satMean=satSum/(R*R);
  for(let k=0;k<R*R;k++)if(F.sky[k])F.cls[k]=CL.sky;
  /* image type */
  const lb=blurField(F.lum.slice(),R,4),hp=new Float32Array(R*R);for(let k=0;k<hp.length;k++)hp[k]=F.lum[k]-lb[k];
  const hpr=variance(hp)/(variance(F.lum)||1);let ink=0,lm=0;for(const v of F.lum){if(v<.35)ink++;lm+=v}lm/=R*R;ink/=R*R;
  /* heightmaps keep most of their variance at large scales; hillshades are mostly slope detail around a mid gray */
  const lfr=variance(blurField(F.lum.slice(),R,24))/(variance(F.lum)||1);
  F.kind=F.satMean>=.08&&F.skyFrac>.06&&(F.skyCols>.6||(F.skyFrac>.14&&F.skyCols>.3))?'perspective':F.satMean<.08?(lm>.68&&ink<.2?'sketch':(hpr>.3||lfr<.75)?'shaded':'height'):'aerial';
  F.hpr=hpr;F.lfr=lfr;REF.F=F;
}
function classFrac(F,c){let n=0,t=0;for(let k=0;k<F.cls.length;k++){if(F.cls[k]===CL.sky)continue;t++;if(F.cls[k]===c)n++}return t?n/t:0}

/* Ground photo → top-down: the skyline sets the far mountain crests, the mountain face between crest and base is laid out
   toward the viewer, lakes become level water at the mountain foot, and the foreground becomes gentle near ground. */
function perspectiveField(R){
  const F=REF.F,Rf=F.R,ys=Array.from(F.ys);for(let p=0;p<3;p++)for(let i=1;i<Rf-1;i++)ys[i]=(ys[i-1]+ys[i]*2+ys[i+1])/4;
  let ysMin=1e9,ysMax=0;for(const y of ys){ysMin=Math.min(ysMin,y);ysMax=Math.max(ysMax,y)}
  /* lake band: rows below the skyline that are mostly water (reflections of the mountains included) */
  const ai=REF.ai,noW=ai&&ai.water_level!=null&&+ai.water_level<=0,L=findLakes(F,ysMax,noW),isW=L.mask,lake=L.lake,yl0=L.y0,yl1=L.y1;
  const ybG=lake?yl0:Math.min(Rf-8,ysMax+.32*(Rf-ysMax)),yb=ys.map(y=>Math.max(y+Rf*.08,lake?yl0:ybG));
  let aMax=0;const a=yb.map((b,i)=>{const v=(b-ys[i])/Rf;aMax=Math.max(aMax,v);return v});
  const vc=.1,vb=lake?.4:.46,lb=blurField(F.lum.slice(),Rf,3),n=makeNoise(S.seed+21);
  const f=new Float32Array(R*R),wat=new Float32Array(R*R),veg=new Float32Array(R*R),snow=new Float32Array(R*R),dk=new Float32Array(R*R);
  const lakeV1=lake?vb+(1-vb)*Math.min(.8,(yl1-yl0)/(Rf-yl0)*1.25):vb;
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){const u=i/(R-1),v=j/(R-1),xf=u*(Rf-1),xi=Math.round(xf),k=j*R+i;
    let y,h;const hc=.3+.7*(aMax>0?a[xi]/aMax:.5);
    if(v<vc){y=ys[xi]+1;h=hc*(1-.45*(vc-v)/vc)}
    else if(v<vb){const t=(v-vc)/(vb-vc);y=ys[xi]+t*(yb[xi]-ys[xi]);h=hc*Math.pow(1-t,1.55)}
    else{const t=(v-vb)/(1-vb);y=lake&&v<lakeV1?yl0+((v-vb)/(lakeV1-vb))*(yl1-yl0):(lake?yl1:yb[xi])+Math.pow(lake?(v-lakeV1)/(1-lakeV1):t,1.25)*(Rf-1-(lake?yl1:yb[xi]));h=.035+.03*(fbm(n,u*5,v*5,4,.5)*.5+.5)}
    const yi=clamp(Math.round(y),0,Rf-1),pk=yi*Rf+xi,c=F.cls[pk];
    if(v<vb)h+=(F.lum[pk]-lb[pk])*hc*.7;/* rock faces, gullies and snow chutes from the photo become relief */
    if(isW[pk]&&v>=vb*.9){wat[k]=1;h=0}
    f[k]=Math.max(0,h);veg[k]=c===CL.veg?1:c===CL.dark&&v>vc?.5:c===CL.snow?-.6:0;snow[k]=c===CL.snow&&v>=vc?1:0;dk[k]=c===CL.veg&&F.lum[pk]<.33?1:0}
  return{f:blurField(f,R,Math.max(1,Math.round(R/96))),water:blurField(wat,R,1),veg:blurField(veg,R,Math.round(R/64)+1),snow,dark:dk,relief:aMax};
}
/* Ground photo → 3D by depth perception. Depth for every pixel comes from three cues:
   atmospheric haze (dark-channel prior: farther land is washed toward the sky color), the ground plane below the horizon,
   and height in the frame. Walking down each image column, a nearer layer can hide a farther one but never the reverse,
   and slopes can't be steeper than real rock or forest. Every visible pixel is then projected through a pinhole camera
   (≈65° lens) to a top-down position and height, so far peaks land far away and tall, near hills close and low, and the
   valleys between ridges open up. Hidden backsides are filled smoothly. */
function pushPull(val,known,G){
  const lv=[{v:val,w:known,G}];let v=val,w=known,g=G;
  while(g>1){const h=Math.ceil(g/2),nv=new Float32Array(h*h),nw=new Float32Array(h*h);
    for(let j=0;j<g;j++)for(let i=0;i<g;i++){const k=j*g+i,q=(j>>1)*h+(i>>1);nv[q]+=v[k]*w[k];nw[q]+=w[k]}
    for(let q=0;q<nv.length;q++){if(nw[q]>0)nv[q]/=nw[q];nw[q]=Math.min(1,nw[q])}lv.push({v:nv,w:nw,G:h});v=nv;w=nw;g=h}
  for(let l=lv.length-2;l>=0;l--){const A=lv[l],B=lv[l+1];for(let j=0;j<A.G;j++)for(let i=0;i<A.G;i++){const k=j*A.G+i;if(A.w[k]>=1)continue;
    const bv=B.G<2?B.v[0]:sampleField(B.v,B.G,clamp(i/2-.25,0,B.G-1),clamp(j/2-.25,0,B.G-1));A.v[k]=A.v[k]*A.w[k]+bv*(1-A.w[k]);A.w[k]=1}}
  return lv[0].v}
function perspectiveDepth(R){
  const F=REF.F,Rf=F.R,W0=REF.img.naturalWidth||4,H0=REF.img.naturalHeight||3,hf=65*Math.PI/180,fx=(Rf/2)/Math.tan(hf/2),fy=fx*W0/H0,cx=(Rf-1)/2;
  const ys=Array.from(F.ys);for(let p=0;p<3;p++)for(let i=1;i<Rf-1;i++)ys[i]=(ys[i-1]+ys[i]*2+ys[i+1])/4;
  let ysMax=0;for(const y of ys)ysMax=Math.max(ysMax,y);
  const ai=REF.ai,noW=ai&&ai.water_level!=null&&+ai.water_level<=0,LK=findLakes(F,ysMax,noW);
  let yh=Math.min(Rf*.72,ysMax+Rf*.02);if(LK.lake)yh=Math.min(yh,LK.y0-2);yh=Math.max(yh,Rf*.08);
  const dmin=.07,camH=dmin*(Rf-1-yh)/fy;
  /* airlight: the sky just above the skyline */
  let A=[0,0,0],an=0;for(let i=0;i<Rf;i++)for(let y=Math.max(0,Math.round(ys[i])-8);y<ys[i];y++){const k=y*Rf+i;if(!F.sky[k])continue;A[0]+=F.rgb[k*3];A[1]+=F.rgb[k*3+1];A[2]+=F.rgb[k*3+2];an++}
  A=an>20?A.map(v=>Math.max(60,v/an)):[225,230,235];
  const dc=new Float32Array(Rf*Rf);for(let k=0;k<dc.length;k++)dc[k]=Math.min(F.rgb[k*3]/A[0],F.rgb[k*3+1]/A[1],F.rgb[k*3+2]/A[2]);
  const dm=minmax(dc,Rf,3,false),hz=new Float32Array(Rf*Rf).fill(NaN),vals=[];
  for(let k=0;k<hz.length;k++){const c=F.cls[k];if(c===CL.sky||c===CL.snow||c===CL.water)continue;hz[k]=-Math.log(Math.max(.05,1-.95*clamp(dm[k],0,1)));vals.push(hz[k])}
  vals.sort((a,b)=>a-b);const p95=vals.length?vals[Math.floor(vals.length*.95)]||1:1,p5=vals.length?vals[Math.floor(vals.length*.05)]:0;
  for(let i=0;i<Rf;i++){let last=NaN;for(let y=Rf-1;y>=0;y--){const k=y*Rf+i;if(isNaN(hz[k]))hz[k]=last;else{hz[k]=clamp((hz[k]-p5)/((p95-p5)||1),0,1);last=hz[k]}}
    let up=NaN;for(let y=0;y<Rf;y++){const k=y*Rf+i;if(isNaN(hz[k]))hz[k]=up;else up=hz[k]}for(let y=0;y<Rf;y++)if(isNaN(hz[y*Rf+i]))hz[y*Rf+i]=.5}/* snow takes the depth of the rock under it */
  blurField(hz,Rf,3);
  /* raw distance (0..1 of the map depth) */
  const raw=new Float32Array(Rf*Rf);
  for(let i=0;i<Rf;i++)for(let y=0;y<Rf;y++){const k=y*Rf+i,yy=Math.max(y,ys[i]);let D;
    if(yy<yh){const g=.35+.6*Math.pow((yh-yy)/Math.max(yh,1),.6);D=.55*hz[k]+.45*g}
    else{const dp=clamp((camH*fy/Math.max(.5,yy-yh)-dmin)/(1-dmin),0,1);D=F.cls[k]===CL.water?dp:Math.min(dp,lerp(dp,hz[k],.35))}
    raw[k]=dmin+(1-dmin)*clamp(D,0,1)}
  blurField(raw,Rf,2);
  /* occlusion order + slope limit, top to bottom */
  const dist=new Float32Array(Rf*Rf);
  for(let i=0;i<Rf;i++){let prev=-1;for(let y=Math.floor(ys[i]);y<Rf;y++){const k=y*Rf+i,c=F.cls[k],tn=c===CL.veg||c===CL.dark?.75:c===CL.snow?1:1.25;
    const allow=prev<0?raw[k]:prev-prev/(fy*tn);const d=Math.max(dmin,Math.min(raw[k],allow));dist[k]=d;prev=d}}
  /* project and splat (keep the highest surface seen in each cell) */
  const G=Math.min(256,Math.max(160,R)),hm=new Float32Array(G*G),kn=new Float32Array(G*G),cv=new Float32Array(G*G),cs=new Float32Array(G*G),cw=new Float32Array(G*G),cd=new Float32Array(G*G),cn=new Float32Array(G*G);let Ymax=0;
  for(let i=0;i<Rf;i++)for(let y=Math.ceil(ys[i]);y<Rf;y++){const k=y*Rf+i,d=dist[k];if(!(d>0))continue;const c=F.cls[k];
    const Y=Math.max(0,camH+(yh-y)/fy*d),u=.5+(i-cx)/Rf*(.6+.4*Math.sqrt(d)),v=1-d,gi=Math.round(u*(G-1)),gj=Math.round(v*(G-1));if(gi<0||gj<0||gi>=G||gj>=G)continue;
    const q=gj*G+gi;if(!kn[q]||Y>hm[q]){hm[q]=Y;kn[q]=1}cn[q]++;if(c===CL.veg)cv[q]++;else if(c===CL.dark)cv[q]+=.5;if(c===CL.snow)cs[q]++;if(LK.mask[k])cw[q]++;if(c===CL.veg&&F.lum[k]<.33)cd[q]++;Ymax=Math.max(Ymax,Y)}
  for(let q=0;q<G*G;q++)if(cn[q]){cv[q]/=cn[q];cs[q]/=cn[q];cw[q]/=cn[q];cd[q]/=cn[q];if(cw[q]>.4)hm[q]=0}
  const known=kn.slice(),filled=pushPull(hm,kn,G),fillA=a=>pushPull(a,known.slice(),G);
  /* hidden backsides settle a little below the ridges that hide them */
  for(let q=0;q<G*G;q++)if(!known[q])filled[q]*=.82;
  const f=resample(filled,G,R),water=resample(fillA(cw),G,R),veg=resample(fillA(cv),G,R),snow=resample(fillA(cs),G,R),dark=resample(fillA(cd),G,R);
  for(let k=0;k<f.length;k++){f[k]=Math.max(0,f[k]/(Ymax||1));water[k]=water[k]>.45?1:0}
  for(let k=0;k<veg.length;k++)if(snow[k]>.4)veg[k]=-.6;
  blurField(f,R,Math.max(1,Math.round(R/128)));
  return{f,water:blurField(water,R,1),veg:blurField(veg,R,Math.round(R/96)+1),snow,dark,maxH:clamp(Ymax*S.shape.world,80,1500),eye:{h:camH/(Ymax||1),yh,fy}};
}
/* Top-down image → heights: shape from shading in the light direction that agrees best with land cover
   (water low, snow and bare rock high), blended with that land-cover prior and the distance from water. */
function aerialField(R,ai,forceShade){
  const F=REF.F,L0=resample(REF.lum,REF.R,R);let L=L0;if(S.photo.thin)L=removeThin(L,R,Math.max(2,Math.round(R/128)));
  const SQ=REF.cls,Rs=REF.R,PRI={[CL.water]:0,[CL.dry]:.16,[CL.veg]:.32,[CL.dark]:.36,[CL.rock]:.6,[CL.snow]:.92,[CL.sky]:.5};
  const pr=new Float32Array(Rs*Rs),wm=new Float32Array(Rs*Rs),vg=new Float32Array(Rs*Rs);for(let k=0;k<pr.length;k++){pr[k]=PRI[SQ[k]];wm[k]=SQ[k]===CL.water?1:0;vg[k]=SQ[k]===CL.veg?1:SQ[k]===CL.dark?.5:0}
  const prior=blurField(resample(pr,Rs,R),R,Math.round(R/24)+2),water=blurField(resample(wm,Rs,R),R,1),veg=blurField(resample(vg,Rs,R),R,Math.round(R/64)+1);
  let wn=0;for(const v of water)if(v>.5)wn++;const hasW=wn>R*R*.01;
  const lr=Math.min(R,193),Ls=resample(L,R,lr),pl=resample(prior,R,lr);let best=null,bc=0;
  const gray=F&&F.satMean<.08,az=ai&&ai.light_from_deg!=null?[(+ai.light_from_deg+90)%360]:gray?[45]:[0,45,90,135,180,225,270,315];/* gray hillshades: cartographic light from the northwest */
  for(const z of az){const sh=shadeToHeight(Ls,lr,z),c=correl(sh,pl)||0;if(!best||Math.abs(c)>Math.abs(bc)){bc=c;best=sh}}
  let sfs=resample(best,lr,R);if(gray&&!(ai&&ai.light_from_deg!=null))bc=Math.abs(bc);if(bc<0)for(let k=0;k<sfs.length;k++)sfs[k]=1-sfs[k];
  const wS=forceShade?.7:clamp(.25+Math.abs(bc)*.9,.25,.6);let dW=null;if(hasW){const m=resample(water,R,R);dW=dist2D(m,R);let mx=0;for(const v of dW)mx=Math.max(mx,v);for(let k=0;k<dW.length;k++)dW[k]=Math.pow(dW[k]/(mx||1),.6)}
  const f=new Float32Array(R*R);for(let k=0;k<f.length;k++)f[k]=sfs[k]*wS+prior[k]*(1-wS)*(dW?.65:1)+(dW?dW[k]*(1-wS)*.35:0);
  return{f:normalizeField(f),water,veg,snow:null,dark:null,flipped:bc<0};
}
/* Lakes in ground photos: distant mountains turn blue in haze and cloud seas look like water, so a lake must be a wide,
   clearly colored region whose shoreline is level and sits below the whole skyline. Its reflections are filled in. */
function findLakes(F,ysMax,noW){
  const R=F.R,cand=new Uint8Array(R*R),mask=new Uint8Array(R*R),comp=new Int32Array(R*R).fill(-1);
  if(!noW)for(let k=0;k<cand.length;k++){if(F.cls[k]===CL.sky)continue;const r=F.rgb[k*3],g=F.rgb[k*3+1],b=F.rgb[k*3+2],[h,sa,v]=rgb2hsv(r,g,b);cand[k]=h>=158&&h<=250&&sa>.3&&v>.3&&b>r+25?1:0}
  let y0=R,y1=-1,id=0;
  for(let s0=0;s0<cand.length;s0++){if(!cand[s0]||comp[s0]>=0)continue;const st=[s0],px=[];comp[s0]=id;
    while(st.length){const k=st.pop();px.push(k);const i=k%R,j=(k/R)|0;for(const[n,ok]of[[k-1,i>0],[k+1,i<R-1],[k+R,j<R-1],[k-R,j>0]])if(ok&&cand[n]&&comp[n]<0){comp[n]=id;st.push(n)}}
    id++;if(px.length<R*R*.02)continue;
    const top=new Float32Array(R).fill(-1);let lo=R,hi=-1;for(const k of px){const i=k%R,j=(k/R)|0;if(top[i]<0||j<top[i])top[i]=j;lo=Math.min(lo,i);hi=Math.max(hi,i)}
    const t=[];for(let i=0;i<R;i++)if(top[i]>=0)t.push(top[i]);t.sort((a,b)=>a-b);const tl=t.slice(Math.floor(t.length*.1),Math.ceil(t.length*.9)),m=tl.reduce((a,b)=>a+b,0)/tl.length,sd=Math.sqrt(tl.reduce((a,b)=>a+(b-m)**2,0)/tl.length);
    if((hi-lo)/R<.3||sd>R*.04||m<ysMax+R*.02)continue;
    for(const k of px)mask[k]=1;y0=Math.min(y0,Math.round(m));for(const k of px)y1=Math.max(y1,(k/R)|0)}
  const lake=y1-y0>=3;
  if(lake)for(let y=y0;y<=y1;y++){let a=R,b=-1,n=0;for(let i=0;i<R;i++)if(mask[y*R+i]){a=Math.min(a,i);b=Math.max(b,i);n++}if(n>R*.25)for(let i=a;i<=b;i++)mask[y*R+i]=1}/* reflections */
  for(let k=0;k<F.cls.length;k++){if(mask[k])F.cls[k]=CL.water;else if(F.cls[k]===CL.water)F.cls[k]=CL.rock}/* blue haze on land stays land */
  return{mask,lake,y0,y1};
}
/* make any result look like real land */
function beautify(f,R,water,detail){
  normalizeField(f);const n=makeNoise(S.seed+33),rel=blurField(f.slice(),R,Math.round(R/48)+1);
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){const k=j*R+i,u=i/R,v=j/R;f[k]+=rel[k]*(.08+.12*detail)*(ridged(n,u*7,v*7,5,.5)-.45)+.012*fbm(n,u*14+3,v*14,3,.5)}
  for(let k=0;k<f.length;k++)f[k]=Math.max(0,f[k]);normalizeField(f);
  weatherField(f,R,{weather:.55,world:S.shape.world,maxH:S.shape.maxH*(.3+S.photo.height*1.4)},S.seed);
  if(!water)return 0;let wn=0;const ws=[];for(let k=0;k<f.length;k++)if(water[k]>.5){ws.push(f[k]);wn++}
  if(wn<R*R*.006)return 0;ws.sort((a,b)=>a-b);const sea=clamp(ws[Math.floor(ws.length*.85)]+.012,.02,.55);
  for(let k=0;k<f.length;k++){if(water[k]>.5)f[k]=Math.max(0,Math.min(f[k],sea-.012-.03*smooth(.5,1,water[k])));else if(water[k]<.2&&f[k]<sea+.006)f[k]=sea+.006+(f[k]-sea)*.15}
  blurField(f,R,1);return sea}
/* palette from the image: class colors pulled into believable ranges */
function paletteFromImage(base){
  const F=REF.F,acc={};for(let k=0;k<F.cls.length;k++){const c=F.cls[k];if(c===CL.sky)continue;(acc[c]=acc[c]||[]).push(k)}
  const avg=(ks,lo,hi)=>{if(!ks||ks.length<F.R*F.R*.004)return null;const s=ks.map(k=>F.lum[k]).sort((a,b)=>a-b),a=s[Math.floor(s.length*lo)],b=s[Math.min(s.length-1,Math.floor(s.length*hi))];let r=0,g=0,bl=0,n=0;for(const k of ks){const l=F.lum[k];if(l<a||l>b)continue;r+=F.rgb[k*3];g+=F.rgb[k*3+1];bl+=F.rgb[k*3+2];n++}return n?[r/n,g/n,bl/n]:null};
  const fit=(c,hr,sr,vr)=>{if(!c)return null;let[h,s,v]=rgb2hsv(...c);if(hr){if(h<hr[0]||h>hr[1]){const d0=Math.min(Math.abs(h-hr[0]),360-Math.abs(h-hr[0])),d1=Math.min(Math.abs(h-hr[1]),360-Math.abs(h-hr[1]));h=d0<d1?hr[0]:hr[1]}}s=clamp(s,sr[0],sr[1]);v=clamp(v,vr[0],vr[1]);return hsv2rgb(h,s,v).map(Math.round)};
  const mix=(a,b,t)=>a.map((x,i)=>Math.round(lerp(x,b[i],t)));const P=PALETTES[base]||PALETTES.temperate;
  const veg=avg(acc[CL.veg],.15,.85),dry=avg(acc[CL.dry],.1,.9),rock=avg((acc[CL.rock]||[]).concat(acc[CL.dark]||[]),.25,.9),snow=avg(acc[CL.snow],.3,1);
  const lush=fit(veg,[30,135],[.22,.72],[.2,.55])||P.lush,dr=fit(dry,[22,58],[.2,.6],[.38,.75])||mix(lush,[176,150,92],.5);let rk=fit(rock,null,[0,.22],[.3,.62])||P.rock;
  {const[h,sa,v]=rgb2hsv(...rk);if(h>170&&h<270)rk=hsv2rgb(h,Math.min(sa,.06),v).map(Math.round)}/* distant haze makes rock look blue; real rock is near neutral */
  const sn=snow?fit(snow,null,[0,.08],[.88,.97]):P.snow,sand=dry?fit(dry,[28,52],[.18,.45],[.6,.85]):mix(rk,[206,188,140],.6);
  return{name:'From photo',lush,dry:dr,alpine:mix(rk,lush,.35),rock:rk,rock2:rk.map(v=>Math.round(v*.7)),snow:sn,sand,seabed:mix(sand,rk,.45).map(v=>Math.round(v*.72))};
}
function usePhotoPalette(p){PALETTES.photo=p;S.biome.custom=p;S.biome.palette='photo'}

const PHOTO_PROMPT=hint=>`You convert a reference image into an exact plan for a 3D terrain generator. Study it closely before answering.
1. Classify "style": "sketch" (hand drawn), "contour" (topographic lines), "shaded" (hillshade / shaded relief), "satellite" (aerial photo), "painting", or "ground_photo" (perspective from the ground).${hint?' The user says: '+hint+'.':''}
2. For shaded relief and aerial images, hills are lit on the side facing the light and shadowed on the far side. Find the light direction (compass bearing the light comes FROM, 0 = top of image, 90 = right, 315 = top-left, which is the cartographic default) and make sure lit-then-shadowed bumps are HILLS, not pits. Water is always the lowest ground. Valleys hold rivers and roads; ridges rarely do.
3. For ground photos imagine looking straight down: image bottom = near edge, horizon = far edge.
4. Man-made lines are NOT terrain: roads, tracks, paths, fences and power lines go in roads; bridges go in bridges with both ends; buildings in buildings; small objects in props.
All x,y are 0-1 in the top-down plan (x left→right, y top/far→bottom/near).
Return only JSON:
{"style":"...","view":"aerial"|"perspective","light_from_deg":0-359 or null,"heights":[32 rows of 32 integers 0-100, row 0 = top],"water_level":0-100 (0 if none),
"palette":"temperate"|"arid"|"tundra"|"volcanic"|"autumn","snow_line":0-100 (100 none),"vegetation":0-1,
"scatter":{"conifer":0-1,"broadleaf":0-1,"bush":0-1,"grass":0-1,"boulder":0-1,"deadfall":0-1},
"roads":[{"material":"dirt"|"gravel"|"cobblestone"|"stone"|"clay"|"asphalt"|"metal"|"wood","width_m":3-20,"points":[[x,y],...]}],
"rivers":[[[x,y],...]],"bridges":[{"x1":0,"y1":0,"x2":0,"y2":0,"material":"wood"|"stone"|"metal"}],
"buildings":[{"x":0,"y":0,"type":"house"|"cabin"|"barn"|"shed"|"church"|"tower","material":"wood"|"brick"|"stone"|"metal"|"clay"}],
"props":[{"x":0,"y":0,"type":"fence"|"well"|"lamp"|"crate"|"haybale"|"bench"}],
"summary":"one sentence naming what you saw, including any roads, bridges and buildings"}`;
async function aiReadRef(J){
  const mode=await aiMode();if(!mode){REF.status='AI is off: open this app in Claude, or add an API key in Settings. Using shading and brightness only.';return false}
  try{J&&J.step(1,'Claude is studying the image…');
    const r=await aiJSON(PHOTO_PROMPT(S.photo.mode!=='auto'?PHOTO_MODES[S.photo.mode].n:''),{images:[await refBlob()]});
    if(!r||!Array.isArray(r.heights))throw new Error('no height plan came back');
    REF.ai=r;const f=[];const c=(a,n)=>{if(a&&a.length)f.push(a.length+' '+n+(a.length>1?'s':''))};c(r.roads,'road');c(r.rivers,'river');c(r.bridges,'bridge');c(r.buildings,'building');c(r.props,'prop');
    REF.status=`${r.style?r.style.replace('_',' ')+' · ':''}${r.summary?String(r.summary).slice(0,220):'Image read.'}${f.length?'\nFound: '+f.join(', ')+'.':''}`;return true;
  }catch(e){REF.status=e&&e.code==='not_granted'?'Allow AI access for this page, or shading and brightness are used.':e&&e.code==='rate_limited'?'The AI is busy. Building from shading and brightness.':'The AI could not read this image ('+((e&&e.message)||'error')+'). Using shading and brightness.';return false}
}
const pts01=a=>(Array.isArray(a)?a:[]).map(p=>Array.isArray(p)?{u:clamp(+p[0],0,1),v:clamp(+p[1],0,1)}:{u:clamp(+p.x,0,1),v:clamp(+p.y,0,1)}).filter(p=>!isNaN(p.u+p.v));
const ROAD_COL={dirt:[112,92,68],gravel:[150,140,124],cobblestone:[122,114,104],stone:[138,134,128],clay:[168,104,70],asphalt:[62,62,64],metal:[120,126,132],wood:[132,98,66]};
function buildRoad(points,width,material){
  if(points.length<2)return;const W=S.shape.world,rad=Math.max(1.2,width/W*(N-1)),col=ROAD_COL[material]||ROAD_COL.dirt,cobble=material==='cobblestone'||material==='stone';
  const pts=[];for(let q=0;q<points.length-1;q++){const a=points[q],b=points[q+1],n=Math.max(2,Math.ceil(Math.hypot(b.u-a.u,b.v-a.v)*(N-1)/(rad*.5)));for(let t=0;t<n;t++)pts.push({u:lerp(a.u,b.u,t/n),v:lerp(a.v,b.v,t/n)})}pts.push(points[points.length-1]);
  const hs=pts.map(p=>hAt(p.u*(N-1),p.v*(N-1)));for(let pass=0;pass<6;pass++)for(let q=1;q<hs.length-1;q++)hs[q]=(hs[q-1]+hs[q]*2+hs[q+1])/4;
  pts.forEach((p,q)=>{const cx=p.u*(N-1),cy=p.v*(N-1),i0=Math.max(0,Math.floor(cx-rad*2.2)),i1=Math.min(N-1,Math.ceil(cx+rad*2.2)),j0=Math.max(0,Math.floor(cy-rad*2.2)),j1=Math.min(N-1,Math.ceil(cy+rad*2.2));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d=Math.hypot(i-cx,j-cy)/rad,k=j*N+i;if(d>2.2)continue;const w=1-smooth(.9,2.2,d);H[k]=lerp(H[k],Math.max(hs[q],seaLevel()+.3),w*.85);
      if(d<1.1){const pw=1-smooth(.7,1.1,d),v=cobble?.82+.36*hash2(i,j,5):1;PC[k*3]=col[0]*v;PC[k*3+1]=col[1]*v;PC[k*3+2]=col[2]*v;PW[k]=Math.max(PW[k],pw*.92);SM[k]=Math.min(SM[k],smooth(.9,1.6,d))}}});
}
async function buildFromPhoto(){
  if(!REF.img){pickPhoto();return}
  const P=S.photo,old=H.slice();pushUndo();let mode=P.mode;
  const J=job('Building from your image',['Reading pixels','Asking Claude to study the image','Planning heights','Checking hills are not inverted','Shaping terrain','Placing roads, rivers & bridges','Adding buildings, props & plants'],{window:true,img:REF.url});
  try{
    J.step(0);await nextFrame();if(!REF.F)analyzeRef();const F=REF.F;
    if(mode!=='height'&&mode!=='sketch'&&P.ai&&!REF.ai)await aiReadRef(J);
    const ai=REF.ai&&mode!=='height'&&mode!=='sketch'?REF.ai:null;
    if(mode==='auto'){/* trust a clear skyline over the AI's label; otherwise prefer the AI's reading of the style */
      const aiPersp=ai&&(ai.style==='ground_photo'||ai.view==='perspective');
      mode=F.kind==='perspective'&&(F.skyFrac>.1||aiPersp||!ai)?'depth':ai?(aiPersp&&F.skyFrac>.03?'depth':ai.style==='contour'?'contour':ai.style==='sketch'?'sketch':ai.style==='shaded'?'shaded':F.kind==='height'?'height':'aerial')
        :F.kind==='perspective'?'depth':F.kind}
    J.step(2,'Planning heights ('+PHOTO_MODES[mode].n.toLowerCase()+')');await nextFrame();
    const R=N,base=ai&&mode!=='height'&&mode!=='sketch'?aiGridField(R):null;let r,flipped=false;
    if(mode==='depth'){try{r=perspectiveDepth(R)}catch(e){console.warn(e)}if(!r||!r.f||r.f.some(v=>isNaN(v)))r=perspectiveField(R)}
    else if(mode==='aerial'||mode==='shaded')r=aerialField(R,ai,mode==='shaded');
    else if(mode==='sketch')r={f:sketchField(R)};
    else{let L=resample(REF.lum,REF.R,R);if(P.invert)for(let k=0;k<L.length;k++)L[k]=1-L[k];r={f:blurField(L,R,Math.round(P.blur*R/257)+(mode==='height'?0:2))};if(mode==='contour'&&base)r.f=base}
    let f=r.f;flipped=!!r.flipped;
    if(P.invert&&(mode==='depth'||mode==='aerial'||mode==='shaded'))for(let k=0;k<f.length;k++)f[k]=1-f[k];
    if(base&&mode!=='contour'){normalizeField(f);const w=mode==='depth'?.22:.38;for(let k=0;k<f.length;k++)f[k]=f[k]*(1-w)+base[k]*w}
    J.step(3);await nextFrame();
    if(P.blur>0&&mode!=='height')blurField(f,R,Math.round(P.blur*R/514));
    J.step(4);await nextFrame();
    if(mode==='depth'&&r.maxH)S.shape.maxH=Math.round(r.maxH);else if(mode==='depth'&&r.relief!=null)S.shape.maxH=Math.round(clamp(S.shape.world*(.07+.42*r.relief),120,1200));/* peaks as tall as they look in the photo */
    const sea=beautify(f,R,r.water||null,P.detail);
    H=new Float32Array(N*N);const mh=S.shape.maxH*(.3+P.height*1.4);for(let k=0;k<H.length;k++)H[k]=f[k]*mh;prevMaxH=S.shape.maxH;
    S.source='photo';S.preset='Photo';clearLayers(false);S.structs=[];
    /* water only where the image has it: no leftover sea from the last landscape */
    S.biome.sea=sea>0?clamp(sea*mh/S.shape.maxH,0,.6):0;S.biome.beach=sea>0?.006:0;computeStats();
    const aerial=mode==='height'||mode==='shaded'||mode==='aerial';
    if(P.colors&&aerial){const C=resample(REF.rgb,REF.R,N,3);for(let k=0;k<N*N;k++){PC[k*3]=C[k*3];PC[k*3+1]=C[k*3+1];PC[k*3+2]=C[k*3+2];PW[k]=.8}}
    /* plants follow the picture: trees where it shows vegetation, open ground elsewhere */
    if(r.veg){for(let k=0;k<N*N;k++)SM[k]=clamp(.04+r.veg[k]*1.9,0,2)}
    if(r.snow){let sh=[];for(let k=0;k<N*N;k++)if(r.snow[k]>.5)sh.push(f[k]);if(sh.length>N*N*.01){sh.sort((a,b)=>a-b);S.biome.snow=clamp(sh[Math.floor(sh.length*.4)]*mh/S.shape.maxH,.2,1)}else S.biome.snow=1}
    if(P.palette!==false&&mode!=='height'&&mode!=='sketch'&&mode!=='contour')usePhotoPalette(paletteFromImage(ai&&PALETTES[ai.palette]?ai.palette:'temperate'));
    if(P.scatter&&r.veg&&!(ai&&ai.scatter)){const vf=classFrac(F,CL.veg)+classFrac(F,CL.dark)*.4,dkF=r.dark?r.dark.reduce((a,b)=>a+b,0)/(N*N):0,T=S.scatter.types;
      T.conifer.density=clamp(vf*1.4*(.35+dkF*3),0,.9);T.broadleaf.density=clamp(vf*1.2*(1-dkF*2),0,.8);T.grass.density=clamp(.25+vf,0,.9);T.bush.density=clamp(vf*.9,0,.7);T.boulder.density=clamp(classFrac(F,CL.rock)*.8,0,.6);
      for(const t of ['conifer','broadleaf','bush','grass','boulder'])T[t].on=T[t].density>.03;S.biome.lush=clamp(.25+vf*1.3,0,1);S.scatter.on=true}
    J.step(5);await nextFrame();
    if(ai){
      if(!P.palette&&PALETTES[ai.palette])S.biome.palette=ai.palette;
      if(ai.vegetation!=null&&!r.veg)S.biome.lush=clamp(+ai.vegetation,0,1);
      if(P.scatter&&ai.scatter){for(const t of ['conifer','broadleaf','bush','grass','boulder','deadfall'])if(ai.scatter[t]!=null&&S.scatter.types[t]){S.scatter.types[t].density=clamp(+ai.scatter[t],0,1);S.scatter.types[t].on=+ai.scatter[t]>.03}S.scatter.on=true}
      computeStats();const W=S.shape.world;S.fluid.springs=[];
      for(const rv of (ai.rivers||[]).slice(0,6)){const p=pts01(rv);if(p.length>=2){carveRiverQuiet(p,Math.max(4,mh*.04),W*.018);const a=p[0],z=p[p.length-1],src=hAt(a.u*(N-1),a.v*(N-1))>=hAt(z.u*(N-1),z.v*(N-1))?a:z;S.fluid.springs.push({u:src.u,v:src.v,rate:1.2})}}updateSpringMarkers();
      for(const rd of (ai.roads||[]).slice(0,14)){const p=pts01(Array.isArray(rd)?rd:rd.points);if(p.length>=2)buildRoad(p,clamp(+(rd.width_m||8),3,24)*Math.max(1,W/3000),rd.material||'dirt')}
      J.step(6);await nextFrame();
      const st=[],bt={house:'house',cabin:'cabin',barn:'house',shed:'cabin',church:'house',tower:'tower'},pt={fence:'fence',well:'well',lamp:'lamp',crate:'crate',haybale:'haybale',bench:'crate'};
      for(const b of (ai.buildings||[]).slice(0,24))if(b&&!isNaN(+b.x))st.push({u:clamp(+b.x,.03,.97),v:clamp(+b.y,.03,.97),type:bt[b.type]||'house',mat:b.material||'wood',rot:st.length*1.7});
      for(const b of (ai.props||[]).slice(0,30))if(b&&!isNaN(+b.x))st.push({u:clamp(+b.x,.02,.98),v:clamp(+b.y,.02,.98),type:pt[b.type]||'crate',rot:Math.random()*6.28});
      for(const b of (ai.bridges||[]).slice(0,8))if(b&&!isNaN(+b.x1))st.push({type:'bridge',mat:b.material,u:(+b.x1+ +b.x2)/2,v:(+b.y1+ +b.y2)/2,u1:clamp(+b.x1,0,1),v1:clamp(+b.y1,0,1),u2:clamp(+b.x2,0,1),v2:clamp(+b.y2,0,1)});
      S.structs=st;if(st.length){S.scatter.on=true;S.scatter.types.structure.on=true}
    }else J.step(6);
    genMoist();fluidSync();updateAll();morphFrom(old);
    if(mode==='depth'){/* open where the photographer stood: near edge, eye height, looking into the scene */
      const W=S.shape.world,vex=S.view.vex,gz=hAt((N-1)/2,(N-1)*.97)*vex,eye=Math.max(gz+W*.02,(r.eye?r.eye.h*S.shape.maxH*(.3+P.height*1.4):0)*vex+gz*.5),ph=1.5,rr=W*.6;
      animateCam({r:rr,phi:ph,theta:0,tx:0,ty:eye-rr*Math.cos(ph),tz:W*.52-rr*Math.sin(ph)},1100)}else frame(true);/* open on the photographer's view */
    saveSoon();
    J.done((flipped?'Hills were inverted in the image, so they were flipped right side up. ':'')+'Read as '+PHOTO_MODES[mode].n.toLowerCase()+(REF.ai?', guided by the AI reading.':'.'));
  }catch(err){console.error(err);J.fail('Could not build: '+(err.message||err))}
  if(typeof renderSheet==='function')renderSheet();
}
function carveRiverQuiet(pts,depth,width){const W=S.shape.world,rad=Math.max(1.5,width/W*(N-1));let prev=Infinity;
  const all=[];for(let q=0;q<pts.length-1;q++){const a=pts[q],b=pts[q+1],n=Math.max(2,Math.ceil(Math.hypot(b.u-a.u,b.v-a.v)*(N-1)/(rad*.5)));for(let t=0;t<n;t++)all.push({u:lerp(a.u,b.u,t/n),v:lerp(a.v,b.v,t/n)})}
  for(const p of all){const cx=p.u*(N-1),cy=p.v*(N-1);const bed=Math.max(0,Math.min(prev,hAt(cx,cy)-depth));prev=bed+depth*.1;
    const i0=Math.max(0,Math.floor(cx-rad*2)),i1=Math.min(N-1,Math.ceil(cx+rad*2)),j0=Math.max(0,Math.floor(cy-rad*2)),j1=Math.min(N-1,Math.ceil(cy+rad*2));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d=Math.hypot(i-cx,j-cy)/rad,k=j*N+i;if(d>2)continue;const w=1-smooth(.6,2,d),t=bed+Math.pow(d/2,1.6)*depth*1.4;if(H[k]>t)H[k]=lerp(H[k],t,w);if(d<1.2){WM[k]=Math.max(WM[k],.9*(1-d/1.2));SM[k]=Math.min(SM[k],smooth(.6,1.4,d))}}}}
