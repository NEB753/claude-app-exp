"use strict";
/* Terrain Gen Photo → terrain.
   Auto mode: Claude classifies the image (sketch, contour map, shaded relief, satellite, ground photo), reads a 32×32 height plan,
   the light direction, water and every man-made feature (roads by material, rivers, bridges, buildings by material, props).
   Shaded relief is reconstructed by integrating the shading along the light direction (shape from shading), then checked
   against water (always lowest) and the AI plan, and flipped automatically if hills came out inverted. */
const PHOTO_MODES={
  auto:{n:'Auto (AI decides)',d:'Reads any map, sketch, contour, shaded relief or photo'},
  shaded:{n:'Shaded relief / hillshade',d:'Hills from their shadows (light direction is detected)'},
  depth:{n:'Ground-level photo',d:'AI turns a perspective view into a top-down plan'},
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
  blurField(REF.water,R,2);
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
    J.step(0);await nextFrame();
    if(mode!=='height'&&mode!=='sketch'&&P.ai&&!REF.ai)await aiReadRef(J);
    const ai=REF.ai&&mode!=='height'&&mode!=='sketch'?REF.ai:null;
    if(mode==='auto')mode=!ai?'shaded':ai.style==='contour'?'contour':ai.style==='sketch'?'sketch':ai.style==='ground_photo'||ai.view==='perspective'?'depth':'shaded';
    J.step(2,'Planning heights ('+PHOTO_MODES[mode].n.toLowerCase()+')');await nextFrame();
    const R=N;let L=resample(REF.lum,REF.R,R);if(P.invert&&mode!=='sketch')for(let k=0;k<L.length;k++)L[k]=1-L[k];
    if(P.thin&&mode!=='sketch'&&mode!=='height')L=removeThin(L,R,Math.max(2,Math.round(R/128)));
    const base=ai?aiGridField(R):null;let f;
    if(mode==='height')f=blurField(L.slice(),R,Math.round(P.blur*R/257));
    else if(mode==='sketch')f=sketchField(R);
    else if(mode==='shaded'){const lr=Math.min(R,257),Ls=resample(L,R,lr);let sh=resample(shadeToHeight(Ls,lr,ai&&ai.light_from_deg!=null?(+ai.light_from_deg+90)%360:45),lr,R);
      if(base){for(let k=0;k<sh.length;k++)sh[k]=base[k]*.65+sh[k]*.35}f=sh}
    else{f=base||blurField(L.slice(),R,Math.round(P.blur*R/257)+2);const n=makeNoise(S.seed+9);for(let j=0;j<R;j++)for(let i=0;i<R;i++)f[j*R+i]+=P.detail*.08*fbm(n,i/R*9,j/R*9,5,.5)}
    normalizeField(f);
    J.step(3);await nextFrame();
    const W2=resample(REF.water,REF.R,R);let wsum=0;for(const v of W2)wsum+=v;let flipped=false;
    if(mode!=='sketch'){let score=0;if(base)score+=correl(f,base)*2;if(wsum>R*R*.01){let hw=0,hl=0,nw=0,nl=0;for(let k=0;k<f.length;k++){if(W2[k]>.5){hw+=f[k];nw++}else{hl+=f[k];nl++}}score+=(hl/nl-hw/nw)*4}
      if(score<-.15){for(let k=0;k<f.length;k++)f[k]=1-f[k];flipped=true}}
    J.step(4);await nextFrame();
    H=new Float32Array(N*N);const mh=S.shape.maxH*(.3+P.height*1.4);for(let k=0;k<H.length;k++)H[k]=f[k]*mh;prevMaxH=S.shape.maxH;
    S.source='photo';S.preset='Photo';clearLayers(false);S.structs=[];computeStats();
    const aerial=mode==='height'||mode==='shaded'||(ai&&ai.view==='aerial');
    if(P.colors&&aerial){const C=resample(REF.rgb,REF.R,N,3);for(let k=0;k<N*N;k++){PC[k*3]=C[k*3];PC[k*3+1]=C[k*3+1];PC[k*3+2]=C[k*3+2];PW[k]=.8}}
    if(aerial&&wsum>R*R*.01){let wl=0,c=0;for(let k=0;k<f.length;k++)if(W2[k]>.6){wl+=f[k];c++}if(c){S.biome.sea=clamp(wl/c+.02,0,.6)*(mh/S.shape.maxH)}}
    J.step(5);await nextFrame();
    if(ai){
      if(PALETTES[ai.palette])S.biome.palette=ai.palette;
      const wl=clamp((+ai.water_level||0)/100,0,.6);if(wl>0)S.biome.sea=Math.max(S.biome.sea,wl*(mh/S.shape.maxH));
      if(ai.snow_line!=null)S.biome.snow=clamp(+ai.snow_line/100*(mh/S.shape.maxH),.2,1);
      if(ai.vegetation!=null)S.biome.lush=clamp(+ai.vegetation,0,1);
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
    genMoist();fluidSync();updateAll();morphFrom(old);frame(true);saveSoon();
    J.done((flipped?'Hills were inverted in the image data, so they were flipped right side up. ':'')+(REF.ai?'Built from the AI reading.':'Built from the image (AI off).'));
  }catch(err){J.fail('Could not build: '+(err.message||err))}
  if(typeof renderSheet==='function')renderSheet();
}
function carveRiverQuiet(pts,depth,width){const W=S.shape.world,rad=Math.max(1.5,width/W*(N-1));let prev=Infinity;
  const all=[];for(let q=0;q<pts.length-1;q++){const a=pts[q],b=pts[q+1],n=Math.max(2,Math.ceil(Math.hypot(b.u-a.u,b.v-a.v)*(N-1)/(rad*.5)));for(let t=0;t<n;t++)all.push({u:lerp(a.u,b.u,t/n),v:lerp(a.v,b.v,t/n)})}
  for(const p of all){const cx=p.u*(N-1),cy=p.v*(N-1);const bed=Math.max(0,Math.min(prev,hAt(cx,cy)-depth));prev=bed+depth*.1;
    const i0=Math.max(0,Math.floor(cx-rad*2)),i1=Math.min(N-1,Math.ceil(cx+rad*2)),j0=Math.max(0,Math.floor(cy-rad*2)),j1=Math.min(N-1,Math.ceil(cy+rad*2));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d=Math.hypot(i-cx,j-cy)/rad,k=j*N+i;if(d>2)continue;const w=1-smooth(.6,2,d),t=bed+Math.pow(d/2,1.6)*depth*1.4;if(H[k]>t)H[k]=lerp(H[k],t,w);if(d<1.2){WM[k]=Math.max(WM[k],.9*(1-d/1.2));SM[k]=Math.min(SM[k],smooth(.6,1.4,d))}}}}
