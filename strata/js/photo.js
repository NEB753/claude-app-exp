"use strict";
/* Strata Photo: turn a reference image into terrain. Grayscale heightmap, ridge sketch, or an AI reading of a photo or contour map
   (a coarse top-down height plan plus vegetation, rocks, water and structures) blended with the photo's own fine detail. */
const PHOTO_MODES={
  depth:{n:'Landscape photo',d:'AI reads the scene into a top-down plan, photo adds detail'},
  height:{n:'Heightmap image',d:'Brightness becomes height (satellite DEMs, grayscale maps)'},
  sketch:{n:'Ridge sketch',d:'Dark strokes on paper become mountain ridges'},
  contour:{n:'Contour map',d:'AI reads topographic lines into heights'}
};
const REF={img:null,url:null,lum:null,rgb:null,R:0,ai:null,status:''};
function pickPhoto(){$('#fileIn').value='';$('#fileIn').click()}
$('#fileIn').addEventListener('change',async e=>{
  const f=e.target.files&&e.target.files[0];if(!f)return;
  if(!/^image\//.test(f.type)){toast('Choose an image file');return}
  try{await loadRef(f);toast('Reference loaded');if(typeof renderSheet==='function')renderSheet()}catch(err){toast('Could not read that image')}
});
function loadRef(blob){return new Promise((res,rej)=>{const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{if(REF.url)URL.revokeObjectURL(REF.url);REF.img=img;REF.url=url;REF.ai=null;analyzeRef();$('#refImg').src=url;$('#refPin').hidden=!S.photo.pin;res()};img.onerror=rej;img.src=url})}
function analyzeRef(){
  const R=256,c=document.createElement('canvas');c.width=c.height=R;const x=c.getContext('2d'),img=REF.img,s=Math.min(img.naturalWidth,img.naturalHeight);
  x.drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,R,R);const d=x.getImageData(0,0,R,R).data;
  REF.R=R;REF.lum=new Float32Array(R*R);REF.rgb=new Float32Array(R*R*3);
  for(let k=0;k<R*R;k++){const r=d[k*4],g=d[k*4+1],b=d[k*4+2];REF.lum[k]=(.2126*toLin(r)+.7152*toLin(g)+.0722*toLin(b))**(1/2.2);REF.rgb[k*3]=r;REF.rgb[k*3+1]=g;REF.rgb[k*3+2]=b}
}
async function refBlob(){const c=document.createElement('canvas'),img=REF.img,m=768,sc=Math.min(1,m/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.round(img.naturalWidth*sc);c.height=Math.round(img.naturalHeight*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return new Promise(r=>c.toBlob(r,'image/jpeg',.85))}
function sketchField(R){
  // dark strokes → ridges via distance transform
  const L=resample(REF.lum,REF.R,R),ink=new Float32Array(R*R);let mean=0;for(const v of L)mean+=v;mean/=L.length;
  const thr=Math.min(mean*.7,.45),INF=1e9;for(let k=0;k<ink.length;k++)ink[k]=(S.photo.invert?L[k]>1-thr:L[k]<thr)?0:INF;
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){const k=j*R+i;if(i>0)ink[k]=Math.min(ink[k],ink[k-1]+1);if(j>0)ink[k]=Math.min(ink[k],ink[k-R]+1);if(i>0&&j>0)ink[k]=Math.min(ink[k],ink[k-R-1]+1.414);if(i<R-1&&j>0)ink[k]=Math.min(ink[k],ink[k-R+1]+1.414)}
  for(let j=R-1;j>=0;j--)for(let i=R-1;i>=0;i--){const k=j*R+i;if(i<R-1)ink[k]=Math.min(ink[k],ink[k+1]+1);if(j<R-1)ink[k]=Math.min(ink[k],ink[k+R]+1);if(i<R-1&&j<R-1)ink[k]=Math.min(ink[k],ink[k+R+1]+1.414);if(i>0&&j<R-1)ink[k]=Math.min(ink[k],ink[k+R-1]+1.414)}
  const n=makeNoise(S.seed+3),spread=R*.12,o=new Float32Array(R*R);
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){const k=j*R+i,t=clamp(ink[k]/spread,0,1);o[k]=Math.pow(1-t,1.8)*(.8+.2*ridged(n,i/R*5,j/R*5,5,.5))+.05*(fbm(n,i/R*3,j/R*3,4,.5)*.5+.5)}
  return o;
}
function aiGridField(R){
  const g=REF.ai&&REF.ai.heights;if(!g||!g.length)return null;const n=g.length,m=g[0].length,f=new Float32Array(n*m);
  for(let j=0;j<n;j++)for(let i=0;i<m;i++)f[j*m+i]=clamp((+g[j][i]||0)/100,0,1);
  const sq=Math.max(n,m),fs=new Float32Array(sq*sq);for(let j=0;j<sq;j++)for(let i=0;i<sq;i++)fs[j*sq+i]=f[Math.min(n-1,Math.floor(j/sq*n))*m+Math.min(m-1,Math.floor(i/sq*m))];
  const up=resample(fs,sq,R);return blurField(up,R,Math.round(R/48)+2);
}
async function aiReadRef(){
  const sample=await getSample();if(!sample){REF.status='The AI reader works when this app is opened in Claude. Using brightness only.';return false}
  let lim=null;try{lim=sample.limits?await sample.limits():null}catch(e){}
  if(lim&&lim.images===false){REF.status='Image reading is not available here. Using brightness only.';return false}
  const contour=S.photo.mode==='contour';
  const prompt=`You turn a reference image into a terrain plan for a 3D landscape generator.
${contour?'The image is a topographic contour map. Count contour lines inward to estimate relative elevation.':'The image is a photo or artwork of a landscape. Imagine looking straight down at the scene: the bottom of the image is the near edge of the terrain and the horizon is the far edge. Mountains on the horizon become high ground along the top rows.'}
Return only JSON with this shape:
{"heights": 20 arrays of 20 integers 0-100 (row 0 = far/top edge), "water_level": 0-100 (height below which there is water, 0 if none), "palette": one of "temperate","arid","tundra","volcanic","autumn", "snow_line": 0-100 or 100 for none, "vegetation": 0-1, "scatter": {"conifer":0-1,"broadleaf":0-1,"bush":0-1,"grass":0-1,"boulder":0-1}, "structures": [{"x":0-1,"y":0-1,"type":"cabin" or "tower"}] (only buildings you can see, at most 8), "summary": one sentence describing what you saw}`;
  REF.status='Reading the image…';if(typeof renderSheet==='function'&&S.tab==='photo')renderSheet();
  try{
    const blob=await refBlob(),r=await sample.json(prompt,{images:[blob],modelTier:'default'});
    if(!r||!Array.isArray(r.heights))throw new Error('No height plan came back');
    REF.ai=r;REF.status=r.summary?'AI: '+String(r.summary).slice(0,220):'Image read.';return true;
  }catch(e){REF.status=(e&&e.code==='not_granted')?'Allow Claude access to read images, or the brightness method is used.':(e&&e.code==='rate_limited')?'The AI is busy. Wait a minute, or build from brightness now.':'The AI could not read this image ('+((e&&e.message)||'error')+'). Using brightness only.';return false}
}
async function buildFromPhoto(){
  if(!REF.img){pickPhoto();return}
  const P=S.photo,mode=P.mode;pushUndo();
  if((mode==='depth'||mode==='contour')&&P.ai&&!REF.ai){busy(true,'Claude is reading the image…',.25);try{await aiReadRef()}finally{busy(false)}}
  busy(true,'Shaping terrain…',.6);await nextFrame();
  try{
    const R=N,L=resample(REF.lum,REF.R,R);if(P.invert&&mode!=='sketch')for(let k=0;k<L.length;k++)L[k]=1-L[k];
    let f;
    if(mode==='height'){f=blurField(L.slice(),R,Math.round(P.blur*R/257))}
    else if(mode==='sketch'){f=sketchField(R)}
    else{
      const base=aiGridField(R),det=L.slice(),bl=blurField(L.slice(),R,Math.round(6*R/257)+1);
      for(let k=0;k<det.length;k++)det[k]=det[k]-bl[k];
      if(base){f=base;for(let k=0;k<f.length;k++)f[k]=f[k]+det[k]*P.detail*.6}
      else{ // fallback: bright = high, sky rows pushed back as distant ridges
        f=blurField(L.slice(),R,Math.round(P.blur*R/257)+2);const n=makeNoise(S.seed+9);for(let j=0;j<R;j++)for(let i=0;i<R;i++){const k=j*R+i;f[k]=f[k]*.7+(1-j/R)*.25+.08*fbm(n,i/R*4,j/R*4,4,.5)+det[k]*P.detail*.5}}
    }
    normalizeField(f);const n2=makeNoise(S.seed+21);
    for(let j=0;j<R;j++)for(let i=0;i<R;i++){const k=j*R+i;f[k]=clamp(f[k]+fbm(n2,i/R*14,j/R*14,3,.5)*.012,0,1)}
    H=new Float32Array(N*N);const mh=S.shape.maxH*(.3+P.height*1.4);for(let k=0;k<H.length;k++)H[k]=f[k]*mh;
    S.source='photo';S.preset='Photo';clearLayers(false);
    if(P.colors){const C=resample(REF.rgb,REF.R,N,3);for(let k=0;k<N*N;k++){PC[k*3]=C[k*3];PC[k*3+1]=C[k*3+1];PC[k*3+2]=C[k*3+2];PW[k]=.85}}
    const ai=REF.ai;
    if(ai&&(mode==='depth'||mode==='contour')){
      if(PALETTES[ai.palette])S.biome.palette=ai.palette;
      const wl=clamp((+ai.water_level||0)/100,0,.6);S.biome.sea=wl>0?wl*(stats.hi>0?1:1)*(mh/S.shape.maxH):0;
      if(ai.snow_line!=null)S.biome.snow=clamp(+ai.snow_line/100*(mh/S.shape.maxH),.2,1);
      if(ai.vegetation!=null)S.biome.lush=clamp(+ai.vegetation,0,1);
      if(P.scatter&&ai.scatter){for(const t of ['conifer','broadleaf','bush','grass','boulder'])if(ai.scatter[t]!=null){S.scatter.types[t].density=clamp(+ai.scatter[t],0,1);S.scatter.types[t].on=+ai.scatter[t]>.03}S.scatter.on=true}
      S.structs=Array.isArray(ai.structures)?ai.structures.slice(0,12).map((s,i)=>({u:clamp(+s.x,.03,.97),v:clamp(+s.y,.03,.97),type:s.type==='tower'?'tower':'cabin',rot:i*1.7})):[];
    }
    genMoist();fluidSync();updateAll();frame();saveSoon();
  }finally{busy(false)}
  toast(REF.ai?'Terrain built from the AI reading and photo':'Terrain built from the image');if(typeof renderSheet==='function')renderSheet();
}
