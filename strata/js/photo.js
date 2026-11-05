"use strict";
/* Strata Photo: reference image → terrain.
   AI reading returns a scene plan: view type, a coarse height grid, water, palette, vegetation, and FEATURES (roads, rivers, bridges, buildings)
   so man-made lines are built as roads/bridges instead of being mistaken for ridges. Thin lines are also filtered out of brightness data. */
const PHOTO_MODES={
  depth:{n:'Landscape photo',d:'AI reads terrain, water, forests, roads, bridges and buildings'},
  height:{n:'Heightmap image',d:'Brightness becomes height (DEMs, grayscale maps)'},
  sketch:{n:'Ridge sketch',d:'Dark pen strokes on paper become ridgelines'},
  contour:{n:'Contour map',d:'AI reads topographic lines into heights'}
};
const REF={img:null,url:null,lum:null,rgb:null,R:0,ai:null,status:''};
function pickPhoto(){$('#fileIn').value='';$('#fileIn').click()}
$('#fileIn').addEventListener('change',async e=>{
  const f=e.target.files&&e.target.files[0];if(!f)return;
  if(!/^image\//.test(f.type)){toast('Choose an image file','warn');return}
  try{await loadRef(f);toast('Reference loaded','ok');if(typeof renderSheet==='function')renderSheet()}catch(err){toast('Could not read that image','warn')}
});
function loadRef(blob){return new Promise((res,rej)=>{const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{if(REF.url)URL.revokeObjectURL(REF.url);REF.img=img;REF.url=url;REF.ai=null;REF.status='';analyzeRef();$('#refImg').src=url;$('#refPin').hidden=!S.photo.pin;res()};img.onerror=rej;img.src=url})}
function analyzeRef(){
  const R=256,c=document.createElement('canvas');c.width=c.height=R;const x=c.getContext('2d'),img=REF.img,s=Math.min(img.naturalWidth,img.naturalHeight);
  x.drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,R,R);const d=x.getImageData(0,0,R,R).data;
  REF.R=R;REF.lum=new Float32Array(R*R);REF.rgb=new Float32Array(R*R*3);
  for(let k=0;k<R*R;k++){const r=d[k*4],g=d[k*4+1],b=d[k*4+2];REF.lum[k]=(.2126*toLin(r)+.7152*toLin(g)+.0722*toLin(b))**(1/2.2);REF.rgb[k*3]=r;REF.rgb[k*3+1]=g;REF.rgb[k*3+2]=b}
}
async function refBlob(){const c=document.createElement('canvas'),img=REF.img,m=1024,sc=Math.min(1,m/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.round(img.naturalWidth*sc);c.height=Math.round(img.naturalHeight*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return new Promise(r=>c.toBlob(r,'image/jpeg',.86))}
/* morphological open+close removes lines thinner than ~2r pixels (roads, fences, power lines) */
function minmax(f,R,r,useMax){const a=new Float32Array(f.length),o=new Float32Array(f.length);
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){let v=useMax?-1e9:1e9;for(let d=-r;d<=r;d++){const x=f[j*R+clamp(i+d,0,R-1)];v=useMax?Math.max(v,x):Math.min(v,x)}a[j*R+i]=v}
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){let v=useMax?-1e9:1e9;for(let d=-r;d<=r;d++){const x=a[clamp(j+d,0,R-1)*R+i];v=useMax?Math.max(v,x):Math.min(v,x)}o[j*R+i]=v}return o}
function removeThin(f,R,r){return minmax(minmax(minmax(minmax(f,R,r,false),R,r,true),R,r,true),R,r,false)}
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
  return blurField(resample(fs,sq,R),R,Math.round(R/48)+2);
}
const PHOTO_PROMPT=contour=>`You convert a reference image into a plan for a 3D terrain generator. Work out what is natural ground and what is man-made.
${contour?'The image is a topographic contour map: count lines inward to estimate elevation.':'First decide the view: "aerial" if it looks down on the land (map, drone, satellite), or "perspective" if it is a ground-level photo or painting. For perspective views imagine looking straight down: the bottom of the image is the near edge, the horizon the far edge, so distant mountains become high ground along the top rows.'}
Roads, tracks, paths, fences and power lines are NOT hills or ridges: list them as roads. Bridges are NOT plateaus: list them as bridges with both ends. Buildings, cabins and towers go in buildings.
All x,y coordinates are 0-1 in the top-down plan (x left→right, y top/far→bottom/near).
Return only JSON:
{"view":"aerial"|"perspective","heights":[20 rows of 20 integers 0-100, row 0 = top/far],"water_level":0-100 (0 if no water),"palette":"temperate"|"arid"|"tundra"|"volcanic"|"autumn","snow_line":0-100 (100 = none),"vegetation":0-1,
"scatter":{"conifer":0-1,"broadleaf":0-1,"bush":0-1,"grass":0-1,"boulder":0-1},
"roads":[[[x,y],[x,y],...]],"rivers":[[[x,y],...]],"bridges":[{"x1":0-1,"y1":0-1,"x2":0-1,"y2":0-1}],"buildings":[{"x":0-1,"y":0-1,"type":"cabin"|"tower"}],
"summary":"one sentence of what you saw, naming roads/bridges/buildings if any"}`;
async function aiReadRef(){
  const mode=await aiMode();if(!mode){REF.status='AI is off: open this app in Claude, or add an API key in Settings. Using brightness with roads filtered out.';return false}
  REF.status='Reading the image…';if(typeof renderSheet==='function'&&S.tab==='create')renderSheet();
  try{
    const r=await aiJSON(PHOTO_PROMPT(S.photo.mode==='contour'),{images:[await refBlob()]});
    if(!r||!Array.isArray(r.heights))throw new Error('no height plan came back');
    REF.ai=r;const f=[];if(r.roads&&r.roads.length)f.push(r.roads.length+' road'+(r.roads.length>1?'s':''));if(r.rivers&&r.rivers.length)f.push(r.rivers.length+' river'+(r.rivers.length>1?'s':''));if(r.bridges&&r.bridges.length)f.push(r.bridges.length+' bridge'+(r.bridges.length>1?'s':''));if(r.buildings&&r.buildings.length)f.push(r.buildings.length+' building'+(r.buildings.length>1?'s':''));
    REF.status=(r.summary?String(r.summary).slice(0,240):'Image read.')+(f.length?'\nFound: '+f.join(', ')+'.':'');return true;
  }catch(e){REF.status=e&&e.code==='not_granted'?'Allow AI access for this page, or the brightness method is used.':e&&e.code==='rate_limited'?'The AI is busy. Wait a minute, or build from brightness now.':'The AI could not read this image ('+((e&&e.message)||'error')+'). Using brightness with roads filtered out.';return false}
}
const pts01=a=>(Array.isArray(a)?a:[]).map(p=>Array.isArray(p)?{u:clamp(+p[0],0,1),v:clamp(+p[1],0,1)}:{u:clamp(+p.x,0,1),v:clamp(+p.y,0,1)}).filter(p=>!isNaN(p.u+p.v));
function buildRoad(points,width){
  // flatten a gently graded bed along the path, paint packed dirt, keep vegetation off it
  if(points.length<2)return;const W=S.shape.world,rad=Math.max(1.2,width/W*(N-1)),dirt=[112,92,68];
  const pts=[];for(let q=0;q<points.length-1;q++){const a=points[q],b=points[q+1],n=Math.max(2,Math.ceil(Math.hypot(b.u-a.u,b.v-a.v)*(N-1)/(rad*.5)));for(let t=0;t<n;t++)pts.push({u:lerp(a.u,b.u,t/n),v:lerp(a.v,b.v,t/n)})}pts.push(points[points.length-1]);
  const hs=pts.map(p=>hAt(p.u*(N-1),p.v*(N-1)));for(let pass=0;pass<6;pass++)for(let q=1;q<hs.length-1;q++)hs[q]=(hs[q-1]+hs[q]*2+hs[q+1])/4;
  pts.forEach((p,q)=>{const cx=p.u*(N-1),cy=p.v*(N-1),i0=Math.max(0,Math.floor(cx-rad*2.2)),i1=Math.min(N-1,Math.ceil(cx+rad*2.2)),j0=Math.max(0,Math.floor(cy-rad*2.2)),j1=Math.min(N-1,Math.ceil(cy+rad*2.2));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d=Math.hypot(i-cx,j-cy)/rad,k=j*N+i;if(d>2.2)continue;const w=1-smooth(.9,2.2,d);H[k]=lerp(H[k],Math.max(hs[q],seaLevel()+.3),w*.85);
      if(d<1.1){const pw=1-smooth(.7,1.1,d);PC[k*3]=dirt[0];PC[k*3+1]=dirt[1];PC[k*3+2]=dirt[2];PW[k]=Math.max(PW[k],pw*.9);SM[k]=Math.min(SM[k],smooth(.9,1.6,d))}}});
}
async function buildFromPhoto(){
  if(!REF.img){pickPhoto();return}
  const P=S.photo,mode=P.mode,old=H.slice();pushUndo();
  if((mode==='depth'||mode==='contour')&&P.ai&&!REF.ai){busy(true,'Reading the image…',.25);try{await aiReadRef()}finally{busy(false)}}
  busy(true,'Shaping terrain…',.55);await nextFrame();
  try{
    const R=N;let L=resample(REF.lum,REF.R,R);if(P.invert&&mode!=='sketch')for(let k=0;k<L.length;k++)L[k]=1-L[k];
    if(P.thin&&mode!=='sketch')L=removeThin(L,R,Math.max(2,Math.round(R/128)));
    let f;const ai=(mode==='depth'||mode==='contour')?REF.ai:null;
    if(mode==='height')f=blurField(L.slice(),R,Math.round(P.blur*R/257));
    else if(mode==='sketch')f=sketchField(R);
    else{const base=ai?aiGridField(R):null,n=makeNoise(S.seed+9);
      if(base){f=base;for(let j=0;j<R;j++)for(let i=0;i<R;i++){const k=j*R+i;f[k]+=P.detail*.08*fbm(n,i/R*9,j/R*9,5,.5)}
        if(ai.view==='aerial'){const bl=blurField(L.slice(),R,Math.round(6*R/257)+1);for(let k=0;k<f.length;k++)f[k]+=(L[k]-bl[k])*P.detail*.25}}
      else{f=blurField(L.slice(),R,Math.round(P.blur*R/257)+2);for(let j=0;j<R;j++)for(let i=0;i<R;i++){const k=j*R+i;f[k]=f[k]*.7+(1-j/R)*.25+.08*fbm(n,i/R*4,j/R*4,4,.5)}}}
    normalizeField(f);
    H=new Float32Array(N*N);const mh=S.shape.maxH*(.3+P.height*1.4);for(let k=0;k<H.length;k++)H[k]=f[k]*mh;prevMaxH=S.shape.maxH;
    S.source='photo';S.preset='Photo';clearLayers(false);S.structs=[];computeStats();
    const aerial=mode==='height'||(ai&&ai.view==='aerial');
    if(P.colors&&aerial){const C=resample(REF.rgb,REF.R,N,3);for(let k=0;k<N*N;k++){PC[k*3]=C[k*3];PC[k*3+1]=C[k*3+1];PC[k*3+2]=C[k*3+2];PW[k]=.8}}
    if(ai){
      if(PALETTES[ai.palette])S.biome.palette=ai.palette;
      const wl=clamp((+ai.water_level||0)/100,0,.6);S.biome.sea=wl>0?wl*(mh/S.shape.maxH):0;
      if(ai.snow_line!=null)S.biome.snow=clamp(+ai.snow_line/100*(mh/S.shape.maxH),.2,1);
      if(ai.vegetation!=null)S.biome.lush=clamp(+ai.vegetation,0,1);
      if(P.scatter&&ai.scatter){for(const t of ['conifer','broadleaf','bush','grass','boulder'])if(ai.scatter[t]!=null){S.scatter.types[t].density=clamp(+ai.scatter[t],0,1);S.scatter.types[t].on=+ai.scatter[t]>.03}S.scatter.on=true}
      computeStats();const W=S.shape.world;
      S.fluid.springs=[];for(const rv of (ai.rivers||[]).slice(0,6)){const p=pts01(rv);if(p.length>=2){carveRiverQuiet(p,Math.max(4,mh*.04),W*.018);const a=p[0],z=p[p.length-1],src=hAt(a.u*(N-1),a.v*(N-1))>=hAt(z.u*(N-1),z.v*(N-1))?a:z;S.fluid.springs.push({u:src.u,v:src.v,rate:1.2})}}updateSpringMarkers();
      for(const rd of (ai.roads||[]).slice(0,10)){const p=pts01(rd);if(p.length>=2)buildRoad(p,Math.max(6,W*.006))}
      const st=[];
      for(const b of (ai.buildings||[]).slice(0,16))if(b&&!isNaN(+b.x))st.push({u:clamp(+b.x,.03,.97),v:clamp(+b.y,.03,.97),type:b.type==='tower'?'tower':'cabin',rot:st.length*1.7});
      for(const b of (ai.bridges||[]).slice(0,8))if(b&&!isNaN(+b.x1))st.push({type:'bridge',u:(+b.x1+ +b.x2)/2,v:(+b.y1+ +b.y2)/2,u1:clamp(+b.x1,0,1),v1:clamp(+b.y1,0,1),u2:clamp(+b.x2,0,1),v2:clamp(+b.y2,0,1)});
      S.structs=st;if(st.length){S.scatter.on=true;S.scatter.types.structure.on=true}
    }
    genMoist();fluidSync();updateAll();morphFrom(old);frame(true);saveSoon();
  }finally{busy(false)}
  toast(REF.ai&&(mode==='depth'||mode==='contour')?'Built from the AI reading':'Built from the image','ok');if(typeof renderSheet==='function')renderSheet();
}
function carveRiverQuiet(pts,depth,width){const W=S.shape.world,rad=Math.max(1.5,width/W*(N-1));let prev=Infinity;
  const all=[];for(let q=0;q<pts.length-1;q++){const a=pts[q],b=pts[q+1],n=Math.max(2,Math.ceil(Math.hypot(b.u-a.u,b.v-a.v)*(N-1)/(rad*.5)));for(let t=0;t<n;t++)all.push({u:lerp(a.u,b.u,t/n),v:lerp(a.v,b.v,t/n)})}
  for(const p of all){const cx=p.u*(N-1),cy=p.v*(N-1);const bed=Math.max(0,Math.min(prev,hAt(cx,cy)-depth));prev=bed+depth*.1;
    const i0=Math.max(0,Math.floor(cx-rad*2)),i1=Math.min(N-1,Math.ceil(cx+rad*2)),j0=Math.max(0,Math.floor(cy-rad*2)),j1=Math.min(N-1,Math.ceil(cy+rad*2));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d=Math.hypot(i-cx,j-cy)/rad,k=j*N+i;if(d>2)continue;const w=1-smooth(.6,2,d),t=bed+Math.pow(d/2,1.6)*depth*1.4;if(H[k]>t)H[k]=lerp(H[k],t,w);if(d<1.2){WM[k]=Math.max(WM[k],.9*(1-d/1.2));SM[k]=Math.min(SM[k],smooth(.6,1.4,d))}}}}
