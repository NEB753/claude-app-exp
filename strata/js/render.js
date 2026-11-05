"use strict";
/* Strata render: three.js scene, look materials, terrain/base/water meshes, camera, picking. Renders only when dirty. */
const canvas=$('#view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0,0);
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xcfdde2,1000,6000);
const camera=new THREE.PerspectiveCamera(40,1,1,40000);
const hemi=new THREE.HemisphereLight(0xdfeaf2,0x4a4032,.32);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff1dc,1.9);sun.castShadow=true;sun.shadow.bias=-.0003;sun.shadow.normalBias=.8;scene.add(sun,sun.target);
const pmrem=new THREE.PMREMGenerator(renderer);
let dirty=true,lastInteract=performance.now();
const markDirty=()=>{dirty=true};
const touch=()=>{lastInteract=performance.now();dirty=true};

function buildEnv(dark){
  const c=document.createElement('canvas');c.width=8;c.height=256;const g=c.getContext('2d'),gr=g.createLinearGradient(0,0,0,256);
  if(dark){gr.addColorStop(0,'#0a1220');gr.addColorStop(.47,'#2c3d50');gr.addColorStop(.53,'#1b222a');gr.addColorStop(1,'#08090b')}
  else{gr.addColorStop(0,'#5f8fbd');gr.addColorStop(.46,'#e9f0f4');gr.addColorStop(.54,'#b3a68f');gr.addColorStop(1,'#3e382d')}
  g.fillStyle=gr;g.fillRect(0,0,8,256);
  const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;
  const s=new THREE.Scene();s.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide})));
  const sm=new THREE.Mesh(new THREE.SphereGeometry(5,16,8),new THREE.MeshBasicMaterial({color:new THREE.Color(9,8,6.5)}));sm.position.set(26,28,22);s.add(sm);
  const rt=pmrem.fromScene(s,.035);if(scene.environment)scene.environment.dispose();scene.environment=rt.texture;tex.dispose();
}
function detailTexture(){
  const T=256,c=document.createElement('canvas');c.width=c.height=T;const x=c.getContext('2d'),img=x.createImageData(T,T),rnd=mulberry32(9),a=new Float32Array(T*T);
  for(let i=0;i<a.length;i++)a[i]=rnd();
  for(let p=0;p<2;p++){const b=new Float32Array(a.length);for(let j=0;j<T;j++)for(let i=0;i<T;i++){let s=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++)s+=a[((j+dj+T)%T)*T+((i+di+T)%T)];b[j*T+i]=s/9}a.set(b)}
  for(let i=0;i<a.length;i++){const v=Math.round(255*clamp(.9+(a[i]-.5)*.55+(rnd()-.5)*.05,0,1));img.data[i*4]=img.data[i*4+1]=img.data[i*4+2]=v;img.data[i*4+3]=255}
  x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(30,30);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
}
function waterNormalTexture(){
  const T=256,c=document.createElement('canvas');c.width=c.height=T;const x=c.getContext('2d'),img=x.createImageData(T,T),n=makeNoise(5),h=new Float32Array(T*T);
  const per=(i,j,f)=>{const a=i/T*Math.PI*2,b=j/T*Math.PI*2;return n(Math.cos(a)*f+9,Math.sin(a)*f+Math.cos(b)*f*.7+Math.sin(b)*f*.7)};
  for(let j=0;j<T;j++)for(let i=0;i<T;i++)h[j*T+i]=per(i,j,1.6)*.6+per(i,j,3.4)*.3+per(i,j,7)*.15;
  for(let j=0;j<T;j++)for(let i=0;i<T;i++){const dx=h[j*T+(i+1)%T]-h[j*T+(i+T-1)%T],dy=h[((j+1)%T)*T+i]-h[((j+T-1)%T)*T+i],o=(j*T+i)*4;
    img.data[o]=clamp(128-dx*180,0,255);img.data[o+1]=clamp(128-dy*180,0,255);img.data[o+2]=255;img.data[o+3]=255}
  x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(10,10);return t;
}
const detailTex=detailTexture(),waterNTex=waterNormalTexture();
/* contour-line injection shared by every terrain look */
function cloudTexture(){const T=128,c=document.createElement('canvas');c.width=c.height=T;const x=c.getContext('2d'),img=x.createImageData(T,T),n=makeNoise(77);
  for(let j=0;j<T;j++)for(let i=0;i<T;i++){const a=i/T*Math.PI*2,b=j/T*Math.PI*2,v=n(Math.cos(a)*1.3+5,Math.sin(a)*1.3+Math.cos(b)*1.3)*.6+n(Math.cos(a)*2.6,Math.sin(b)*2.6+Math.sin(a)*2.6)*.4,o=(j*T+i)*4;img.data[o]=img.data[o+1]=img.data[o+2]=clamp(128+v*170,0,255);img.data[o+3]=255}
  x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t}
const CU={uContour:{value:0},uInterval:{value:25},uLine:{value:new THREE.Color(0x1b2228)},uTime:{value:0},uClouds:{value:1},uCloudTex:{value:cloudTexture()},uWorld:{value:3000}};
function withContours(mat){
  mat.extensions={derivatives:true};
  mat.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,CU);
    sh.vertexShader='varying float vWY;varying vec2 vWXZ;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec4 wpS=modelMatrix*vec4(transformed,1.0);vWY=wpS.y;vWXZ=wpS.xz;');
    sh.fragmentShader='varying float vWY;varying vec2 vWXZ;uniform float uContour;uniform float uInterval;uniform vec3 uLine;uniform float uTime;uniform float uClouds;uniform sampler2D uCloudTex;uniform float uWorld;\n'+sh.fragmentShader.replace('#include <fog_fragment>',
      `if(uContour>.5){float c=vWY/uInterval;float w=max(fwidth(c),1e-4);float f=abs(fract(c-.5)-.5)/w;float ln=1.-min(f,1.);float idx=floor(c+.5);float maj=1.-step(.01,abs(mod(idx,5.)));gl_FragColor.rgb=mix(gl_FragColor.rgb,uLine,ln*mix(.32,.72,maj));}if(uClouds>.5){float cl=texture2D(uCloudTex,vWXZ/uWorld*1.15+vec2(uTime*.0045,uTime*.0028)).r;gl_FragColor.rgb*=mix(1.,.74,smoothstep(.56,.78,cl));}
#include <fog_fragment>`);
  };
  return mat;
}
const MATS={
  natural:withContours(new THREE.MeshStandardMaterial({vertexColors:true,map:detailTex,roughness:.9,metalness:0,envMapIntensity:.55})),
  clay:withContours(new THREE.MeshStandardMaterial({color:new THREE.Color(0xcdbca9).convertSRGBToLinear(),roughness:.95,metalness:0,envMapIntensity:.5})),
  titanium:withContours(new THREE.MeshStandardMaterial({color:new THREE.Color(0xd5d9de).convertSRGBToLinear(),map:detailTex,roughness:.3,metalness:1,envMapIntensity:1.15})),
  copper:withContours(new THREE.MeshStandardMaterial({color:new THREE.Color(0xe08a55).convertSRGBToLinear(),map:detailTex,roughness:.34,metalness:1,envMapIntensity:1.1})),
  heat:withContours(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:0,envMapIntensity:.5}))
};
const baseMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,envMapIntensity:.4});
const waterMat=new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,roughness:.05,metalness:0,normalMap:waterNTex,normalScale:new THREE.Vector2(.35,.35),envMapIntensity:1.25,depthWrite:false});
let geo,terrain,baseMesh,waterMesh,waterWall;
const wallMat=new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,roughness:.1,depthWrite:false,side:THREE.DoubleSide});
const ringGeo=new THREE.BufferGeometry();ringGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(65*3),3));
const ring=new THREE.Line(ringGeo,new THREE.LineBasicMaterial({color:0xff7a2e,depthTest:false,transparent:true,opacity:.95}));ring.renderOrder=10;ring.visible=false;ring.frustumCulled=false;scene.add(ring);
const springMesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,16,10),new THREE.MeshStandardMaterial({color:0x5cc8ff,emissive:0x1d7fd0,emissiveIntensity:1.4,roughness:.2}),16);springMesh.count=0;springMesh.frustumCulled=false;scene.add(springMesh);

function buildGeometry(){
  if(terrain){scene.remove(terrain);geo.dispose()}
  geo=new THREE.BufferGeometry();
  const pos=new Float32Array(N*N*3),uv=new Float32Array(N*N*2),idx=new Uint32Array((N-1)*(N-1)*6);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i;uv[k*2]=i/(N-1);uv[k*2+1]=1-j/(N-1)}
  let q=0;for(let j=0;j<N-1;j++)for(let i=0;i<N-1;i++){const a=j*N+i,b=a+N,c=a+1,d=b+1;idx[q++]=a;idx[q++]=b;idx[q++]=c;idx[q++]=c;idx[q++]=b;idx[q++]=d}
  for(const [name,arr] of [['position',pos],['normal',new Float32Array(N*N*3)],['color',new Float32Array(N*N*3)]]){const at=new THREE.BufferAttribute(arr,3);at.setUsage(THREE.DynamicDrawUsage);geo.setAttribute(name,at)}
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(new THREE.BufferAttribute(idx,1));
  terrain=new THREE.Mesh(geo,MATS[S.view.look]||MATS.natural);terrain.castShadow=terrain.receiveShadow=true;terrain.frustumCulled=false;scene.add(terrain);
}
let baseDirty=false;
function updateRegion(i0,j0,i1,j1){
  i0=clamp(i0|0,0,N-1);j0=clamp(j0|0,0,N-1);i1=clamp(Math.ceil(i1),0,N-1);j1=clamp(Math.ceil(j1),0,N-1);
  const pos=geo.attributes.position.array,nor=geo.attributes.normal.array,col=geo.attributes.color.array,W=S.shape.world,cell=W/(N-1),vex=S.view.vex,colors=S.view.look==='natural'||S.view.look==='heat';
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
    const k=j*N+i,h=H[k],k3=k*3;
    pos[k3]=(i/(N-1)-.5)*W;pos[k3+1]=h*vex;pos[k3+2]=(j/(N-1)-.5)*W;
    const hl=H[j*N+(i>0?i-1:i)],hr=H[j*N+(i<N-1?i+1:i)],hu=H[(j>0?j-1:j)*N+i],hd=H[(j<N-1?j+1:j)*N+i];
    let nx=(hl-hr)*vex,ny=2*cell,nz=(hu-hd)*vex;const l=1/Math.hypot(nx,ny,nz);nx*=l;ny*=l;nz*=l;
    nor[k3]=nx;nor[k3+1]=ny;nor[k3+2]=nz;
    if(colors){const ao=clamp(1+((h-(hl+hr+hu+hd)/4)/cell)*1.4,.66,1.12),c=colorAt(h,ny,M[k],ao,PC[k3],PC[k3+1],PC[k3+2],PW[k],WM[k]);
      col[k3]=toLin(c[0]);col[k3+1]=toLin(c[1]);col[k3+2]=toLin(c[2]);if(S.view.mask&&MK[k]>.01){const t=MK[k]*.55;col[k3]=lerp(col[k3],.9,t);col[k3+1]=lerp(col[k3+1],.52,t);col[k3+2]=lerp(col[k3+2],.06,t)}}
  }
  for(const a of ['position','normal','color']){const at=geo.attributes[a];at.updateRange.offset=j0*N*3;at.updateRange.count=(j1-j0+1)*N*3;at.needsUpdate=true}
  if(i0===0||j0===0||i1===N-1||j1===N-1)baseDirty=true;
  dirty=true;
}
function updateAll(){
  updateRegion(0,0,N-1,N-1);for(const a of ['position','normal','color'])geo.attributes[a].updateRange.count=-1;
  computeStats();rebuildBase();updateWater();fitSun();updateContourInterval();if(typeof scatterSoon==='function')scatterSoon();
}
function setLook(l){S.view.look=LOOKS[l]?l:'natural';terrain.material=MATS[S.view.look];updateAll()}
function updateContourInterval(){const r=Math.max(stats.hi-stats.lo,1)*S.view.vex,steps=[1,2,5,10,20,25,50,100,200,250,500];let iv=steps[steps.length-1];for(const s of steps)if(r/s<=40){iv=s;break}CU.uInterval.value=iv;CU.uContour.value=S.view.contours?1:0;dirty=true}

/* ---------------- base / skirt ---------------- */
function perimeter(Mm){const p=[];for(let i=0;i<Mm;i++)p.push([i,0]);for(let j=1;j<Mm;j++)p.push([Mm-1,j]);for(let i=Mm-2;i>=0;i--)p.push([i,Mm-1]);for(let j=Mm-2;j>=1;j--)p.push([0,j]);return p}
function baseArrays(s,vex,yb){
  const Mm=(N-1)/s+1,W=S.shape.world,per=perimeter(Mm),P=per.length;
  const pts=per.map(([a,b])=>{const i=a*s,j=b*s;return[(i/(N-1)-.5)*W,H[j*N+i]*vex,(j/(N-1)-.5)*W]});
  let total=0,top=yb;const lens=pts.map((a,q)=>{const b=pts[(q+1)%P];const l=Math.hypot(b[0]-a[0],b[2]-a[2]);total+=l;if(a[1]>top)top=a[1];return l});
  const span=Math.max(top-yb,1),pos=[],nor=[],uv=[],col=[],idx=[];
  const Pl=PALETTES[S.biome.palette],ct=Pl.dry.map(v=>toLin(v*.6)),cb=Pl.rock2.map(v=>toLin(v*.36));
  let acc=0;
  for(let q=0;q<P;q++){
    const a=pts[q],b=pts[(q+1)%P],dx=b[0]-a[0],dz=b[2]-a[2],l=lens[q]||1;
    let ox=dz/l,oz=-dx/l;const mx=(a[0]+b[0])/2,mz=(a[2]+b[2])/2;if(ox*mx+oz*mz<0){ox=-ox;oz=-oz}
    const v0=pos.length/3,u0=acc/total,u1=(acc+l)/total;acc+=l;
    pos.push(a[0],a[1],a[2],b[0],b[1],b[2],b[0],yb,b[2],a[0],yb,a[2]);
    for(let t=0;t<4;t++)nor.push(ox,0,oz);
    uv.push(u0,(a[1]-yb)/span,u1,(b[1]-yb)/span,u1,0,u0,0);
    col.push(...ct,...ct,...cb,...cb);
    if(-dz*ox+dx*oz>0)idx.push(v0,v0+3,v0+1,v0+1,v0+3,v0+2);else idx.push(v0,v0+1,v0+3,v0+1,v0+2,v0+3);
  }
  const c0=pos.length/3;pos.push(0,yb,0);nor.push(0,-1,0);uv.push(.5,.5);col.push(...cb);
  for(let q=0;q<P;q++){const a=pts[q];pos.push(a[0],yb,a[2]);nor.push(0,-1,0);uv.push(a[0]/W+.5,a[2]/W+.5);col.push(...cb)}
  const a0=pts[0],a1=pts[1],flip=(a0[2]*a1[0]-a0[0]*a1[2])>0;
  for(let q=0;q<P;q++){const p1=c0+1+q,p2=c0+1+(q+1)%P;if(flip)idx.push(c0,p2,p1);else idx.push(c0,p1,p2)}
  return{pos:new Float32Array(pos),nor:new Float32Array(nor),uv:new Float32Array(uv),col:new Float32Array(col),idx:new Uint32Array(idx)};
}
const baseBottom=()=>stats.lo*S.view.vex-Math.max(S.exp.depth,S.shape.maxH*.04);
function rebuildBase(){
  baseDirty=false;if(baseMesh){scene.remove(baseMesh);baseMesh.geometry.dispose();baseMesh=null}
  if(!S.view.base)return;
  const b=baseArrays(1,S.view.vex,baseBottom()),g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(b.pos,3));g.setAttribute('normal',new THREE.BufferAttribute(b.nor,3));g.setAttribute('color',new THREE.BufferAttribute(b.col,3));g.setIndex(new THREE.BufferAttribute(b.idx,1));
  baseMesh=new THREE.Mesh(g,baseMat);baseMesh.receiveShadow=true;scene.add(baseMesh);dirty=true;
}

/* ---------------- water surface (sea + simulated fluid) ---------------- */
let WR=0;
function buildWater(R){
  if(waterMesh){scene.remove(waterMesh);waterMesh.geometry.dispose()}
  WR=R;const g=new THREE.BufferGeometry(),idx=new Uint32Array((R-1)*(R-1)*6);let q=0;
  for(let j=0;j<R-1;j++)for(let i=0;i<R-1;i++){const a=j*R+i,b=a+R,c=a+1,d=b+1;idx[q++]=a;idx[q++]=b;idx[q++]=c;idx[q++]=c;idx[q++]=b;idx[q++]=d}
  const uv=new Float32Array(R*R*2);for(let j=0;j<R;j++)for(let i=0;i<R;i++){uv[(j*R+i)*2]=i/(R-1);uv[(j*R+i)*2+1]=j/(R-1)}
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(R*R*3),3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(R*R*3),3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(R*R*4),4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(new THREE.BufferAttribute(idx,1));
  waterMesh=new THREE.Mesh(g,waterMat);waterMesh.renderOrder=2;waterMesh.frustumCulled=false;waterMesh.receiveShadow=true;scene.add(waterMesh);
}
const WSH=[.42,.78,.80],WDP=[.03,.20,.30],WFOAM=[.92,.97,1];
function updateWater(fast){
  const R=(typeof FL!=='undefined'&&FL.R)?FL.R:QUALITY[S.quality].sim;if(R!==WR)buildWater(R);
  const show=S.view.water;waterMesh.visible=show;if(!show){if(waterWall)waterWall.visible=false;dirty=true;return}
  const pos=waterMesh.geometry.attributes.position.array,col=waterMesh.geometry.attributes.color.array,nor=waterMesh.geometry.attributes.normal.array,W=S.shape.world,vex=S.view.vex,sea=seaLevel(),fd=(typeof FL!=='undefined'&&FL.d&&FL.R===R)?FL.d:null;
  let any=false;
  for(let j=0;j<R;j++)for(let i=0;i<R;i++){
    const k=j*R+i,gx=i/(R-1)*(N-1),gy=j/(R-1)*(N-1),tb=hAt(gx,gy);
    let depth=Math.max(0,sea-tb);if(fd)depth=Math.max(depth,fd[k]);
    const wet=depth>.03;if(wet)any=true;
    pos[k*3]=(i/(R-1)-.5)*W;pos[k*3+1]=(wet?tb+depth:tb-2)*vex;pos[k*3+2]=(j/(R-1)-.5)*W;
    nor[k*3]=0;nor[k*3+1]=1;nor[k*3+2]=0;
    const t=smooth(0,18,depth),foam=1-smooth(.03,.6,depth);
    col[k*4]=lerp(lerp(WSH[0],WDP[0],t),WFOAM[0],foam*.6);col[k*4+1]=lerp(lerp(WSH[1],WDP[1],t),WFOAM[1],foam*.6);col[k*4+2]=lerp(lerp(WSH[2],WDP[2],t),WFOAM[2],foam*.6);
    col[k*4+3]=wet?clamp(.35+smooth(.03,3,depth)*.55+foam*.1,0,.93):0;
  }
  const gA=waterMesh.geometry.attributes;gA.position.needsUpdate=gA.color.needsUpdate=gA.normal.needsUpdate=true;
  // soft normals from surface so rivers catch light
  for(let j=1;j<R-1;j++)for(let i=1;i<R-1;i++){const k=j*R+i;if(col[k*4+3]===0)continue;const dx=pos[(k-1)*3+1]-pos[(k+1)*3+1],dz=pos[(k-R)*3+1]-pos[(k+R)*3+1],c=2*W/(R-1),l=1/Math.hypot(dx,c,dz);nor[k*3]=dx*l;nor[k*3+1]=c*l;nor[k*3+2]=dz*l}
  waterMesh.visible=any;if(!fast)updateWaterWall(any&&S.view.base&&sea>stats.lo);dirty=true;
}
function updateWaterWall(on){
  if(waterWall){scene.remove(waterWall);waterWall.geometry.dispose();waterWall=null}
  if(!on)return;
  const R=WR,W=S.shape.world,vex=S.view.vex,yb=baseBottom(),sea=seaLevel(),pos=[],col=[],idx=[];
  const edge=(i,j)=>{const gx=i/(R-1)*(N-1),gy=j/(R-1)*(N-1),tb=hAt(gx,gy);return{x:(i/(R-1)-.5)*W,z:(j/(R-1)-.5)*W,top:Math.max(sea,tb)*vex,wet:sea>tb}};
  const per=perimeter(R);
  for(let q=0;q<per.length;q++){const a=edge(...per[q]),b=edge(...per[(q+1)%per.length]);if(!a.wet&&!b.wet)continue;const v=pos.length/3;
    pos.push(a.x,a.wet?sea*vex:yb,a.z,b.x,b.wet?sea*vex:yb,b.z,b.x,yb,b.z,a.x,yb,a.z);
    col.push(.2,.55,.62,.55,.2,.55,.62,.55,.02,.12,.2,.8,.02,.12,.2,.8);idx.push(v,v+1,v+2,v,v+2,v+3,v,v+2,v+1,v,v+3,v+2)}
  if(!pos.length)return;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(col),4));g.setIndex(idx);g.computeVertexNormals();
  waterWall=new THREE.Mesh(g,wallMat);waterWall.renderOrder=1;scene.add(waterWall);
}

/* ---------------- light / theme / quality ---------------- */
function fitSun(){
  const W=S.shape.world,c=sun.shadow.camera,e=S.view.sunEl*Math.PI/180,a=S.view.sunAz*Math.PI/180,d=W*1.6,Q=QUALITY[S.quality];
  sun.position.set(Math.cos(e)*Math.sin(a)*d,Math.sin(e)*d+stats.hi*.5,Math.cos(e)*Math.cos(a)*d);sun.target.position.set(0,0,0);
  c.left=c.bottom=-W*.75;c.right=c.top=W*.75;c.near=1;c.far=d*2.6;c.updateProjectionMatrix();
  const low=1-smooth(5,45,S.view.sunEl);sun.color.setRGB(1,1-.2*low,1-.42*low);sun.intensity=1.25+.8*smooth(4,30,S.view.sunEl);
  const sh=S.view.shadows&&Q.shadow>0;
  if(sh&&sun.shadow.mapSize.x!==Q.shadow){sun.shadow.mapSize.set(Q.shadow,Q.shadow);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
  sun.castShadow=sh;terrain.receiveShadow=terrain.castShadow=sh;
  for(const m of Object.values(MATS)){m.wireframe=S.view.wire;m.needsUpdate=true}dirty=true;
}
function applyTheme(){
  const cs=getComputedStyle(document.documentElement),sky=cs.getPropertyValue('--sky-b').trim()||'#bccdd8',col=new THREE.Color(sky);
  scene.fog.color.copy(col).convertSRGBToLinear();const dark=col.getHSL({}).l<.4;hemi.intensity=dark?.25:.32;
  ring.material.color.set(cs.getPropertyValue('--gold').trim()||'#d9ae4a');CU.uLine.value.set(dark?0xe8eef2:0x1b2228);buildEnv(dark);
  const tc=document.querySelector('meta[name=theme-color]');if(tc)tc.content=sky;dirty=true;
}
function applyQuality(){const Q=QUALITY[S.quality];renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,Q.dpr));resize();fitSun()}

/* ---------------- camera ---------------- */
const cam={theta:.75,phi:.98,r:5000,target:new THREE.Vector3()};let viewShift=0,viewShiftX=0,lastLA=0;
function frame(anim){const W=S.shape.world,to={r:W*1.5,phi:.98,theta:cam.theta,tx:0,ty:(stats.lo+(stats.hi-stats.lo)*.25)*S.view.vex,tz:0};if(anim)animateCam(to,700);else{cam.r=to.r;cam.phi=to.phi;cam.target.set(to.tx,to.ty,to.tz);placeCamera()}}
let camAnim=null;const easeIO=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function animateCam(to,ms){const from={r:cam.r,phi:cam.phi,theta:cam.theta,tx:cam.target.x,ty:cam.target.y,tz:cam.target.z};let dt=to.theta-from.theta;dt=((dt+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;to.theta=from.theta+dt;camAnim={from,to,t0:performance.now(),ms:SET.reduceMotion?1:ms}}
function camTick(now){if(!camAnim)return;const a=camAnim,t=clamp((now-a.t0)/a.ms,0,1),e=easeIO(t),f=a.from,o=a.to;cam.r=lerp(f.r,o.r,e);cam.phi=lerp(f.phi,o.phi,e);cam.theta=lerp(f.theta,o.theta,e);cam.target.set(lerp(f.tx,o.tx,e),lerp(f.ty,o.ty,e),lerp(f.tz,o.tz,e));placeCamera();if(t>=1)camAnim=null}
function focusAt(p){const W=S.shape.world,h=hAt(p.gx,p.gy)*S.view.vex;animateCam({r:Math.max(W*.22,cam.r*.45),phi:Math.min(cam.phi,1.05),theta:cam.theta,tx:p.x,ty:h,tz:p.z},650)}
/* morph: animate vertices from an old height field to the current one */
let morph=null;
function morphFrom(oldH){if(!oldH||oldH.length!==H.length||N>513||SET.reduceMotion)return;morph={old:oldH,t0:performance.now(),ms:520}}
function morphTick(now){if(!morph)return;const t=clamp((now-morph.t0)/morph.ms,0,1),e=easeIO(t),pos=geo.attributes.position.array,nor=geo.attributes.normal.array,vex=S.view.vex,o=morph.old,cell=S.shape.world/(N-1);
  const hAtM=k=>lerp(o[k],H[k],e);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,k3=k*3;pos[k3+1]=hAtM(k)*vex;const hl=hAtM(j*N+(i>0?i-1:i)),hr=hAtM(j*N+(i<N-1?i+1:i)),hu=hAtM((j>0?j-1:j)*N+i),hd=hAtM((j<N-1?j+1:j)*N+i);let nx=(hl-hr)*vex,ny=2*cell,nz=(hu-hd)*vex;const l=1/Math.hypot(nx,ny,nz);nor[k3]=nx*l;nor[k3+1]=ny*l;nor[k3+2]=nz*l}
  for(const a of ['position','normal']){geo.attributes[a].updateRange.count=-1;geo.attributes[a].needsUpdate=true}dirty=true;
  if(t>=1){morph=null;updateRegion(0,0,N-1,N-1);for(const a of ['position','normal','color'])geo.attributes[a].updateRange.count=-1}}
function placeCamera(){
  const W=S.shape.world;cam.phi=clamp(cam.phi,.1,1.5);cam.r=clamp(cam.r,W*.04,W*4);
  cam.target.x=clamp(cam.target.x,-W*.7,W*.7);cam.target.z=clamp(cam.target.z,-W*.7,W*.7);
  const sp=Math.sin(cam.phi);camera.position.set(cam.target.x+cam.r*sp*Math.sin(cam.theta),cam.target.y+cam.r*Math.cos(cam.phi),cam.target.z+cam.r*sp*Math.cos(cam.theta));
  camera.lookAt(cam.target);camera.near=Math.max(.5,cam.r*.004);camera.far=W*10;camera.updateProjectionMatrix();
  scene.fog.near=cam.r*1.15;scene.fog.far=cam.r+W*2.6;
  if(typeof SCAT!=='undefined'&&SCAT.grass){const v=cam.r<W*1.15;if(SCAT.grass.visible!==v)SCAT.grass.visible=v}
  const la=Math.round((cam.theta*180/Math.PI)%360);if(Math.abs(la-lastLA)>2){lastLA=la;const r=document.documentElement.style;r.setProperty('--la',(210+la)+'deg');r.setProperty('--lx',(50+Math.sin(cam.theta)*30).toFixed(0)+'%')}
  touch();
}
function setViewShift(px,pxX){viewShift=px;viewShiftX=pxX||0;resize()}
function resize(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;
  const o=Math.max(0,Math.round(viewShift)),ox=Math.max(0,Math.round(viewShiftX));if((o>0||ox>0)&&!(typeof FP!=='undefined'&&FP.on))camera.setViewOffset(w+2*ox,h+2*o,2*ox,2*o,w,h);else camera.clearViewOffset();
  camera.updateProjectionMatrix();dirty=true;
}
addEventListener('resize',()=>{resize();if(typeof layoutSheet==='function')layoutSheet()});

/* ---------------- picking ---------------- */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
function pick(cx,cy){
  const r=canvas.getBoundingClientRect();ndc.set((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
  const o=ray.ray.origin,d=ray.ray.direction,W=S.shape.world,vex=S.view.vex,top=stats.hi*vex+1;
  let t=0;if(o.y>top){if(d.y>=0)return null;t=(o.y-top)/-d.y}
  const step=W/(N-1)*.6,maxT=t+W*4;let prev=t;
  const below=tt=>{const x=o.x+d.x*tt,z=o.z+d.z*tt;if(Math.abs(x)>W/2||Math.abs(z)>W/2)return null;return o.y+d.y*tt<hAt((x/W+.5)*(N-1),(z/W+.5)*(N-1))*vex};
  for(;t<maxT;t+=step){const b=below(t);if(b){let a0=prev,a1=t;for(let k=0;k<10;k++){const m=(a0+a1)/2;if(below(m))a1=m;else a0=m}const x=o.x+d.x*a1,z=o.z+d.z*a1;return{x,z,gx:(x/W+.5)*(N-1),gy:(z/W+.5)*(N-1),u:x/W+.5,v:z/W+.5}}prev=t;if(o.y+d.y*t<stats.lo*vex-10&&d.y<0)break}
  return null;
}
function placeRing(p,rad){
  if(!p){ring.visible=false;dirty=true;return}
  const W=S.shape.world,a=ringGeo.attributes.position.array,vex=S.view.vex;rad=rad||S.brush.size;
  for(let q=0;q<=64;q++){const t=q/64*Math.PI*2,x=p.x+Math.cos(t)*rad,z=p.z+Math.sin(t)*rad;a[q*3]=x;a[q*3+2]=z;a[q*3+1]=hAt((x/W+.5)*(N-1),(z/W+.5)*(N-1))*vex+S.shape.maxH*.01+1}
  ringGeo.attributes.position.needsUpdate=true;ring.visible=true;dirty=true;
}
const ventMesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,16,10),new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,.7,.15),toneMapped:false}),8);ventMesh.count=0;ventMesh.frustumCulled=false;scene.add(ventMesh);
function updateSpringMarkers(){
  const m=new THREE.Matrix4(),W=S.shape.world,s=W*.006;
  const put=(mesh,list,max)=>{mesh.count=Math.min(list.length,max);for(let i=0;i<mesh.count;i++){const sp=list[i],h=hAt(sp.u*(N-1),sp.v*(N-1))*S.view.vex;m.makeScale(s,s,s);m.setPosition((sp.u-.5)*W,h+s,(sp.v-.5)*W);mesh.setMatrixAt(i,m)}mesh.instanceMatrix.needsUpdate=true};
  put(springMesh,S.fluid.springs,16);put(ventMesh,S.lava.vents,8);dirty=true;
}

/* sculpt dust: a small particle burst at the brush, only alive while sculpting */
const DUST={n:220,i:0,alive:0};
(function(){const g=new THREE.BufferGeometry(),n=DUST.n;g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3).setUsage(THREE.DynamicDrawUsage));
  DUST.v=new Float32Array(n*3);DUST.life=new Float32Array(n);DUST.pts=new THREE.Points(g,new THREE.PointsMaterial({size:6,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.85,depthWrite:false}));DUST.pts.frustumCulled=false;DUST.pts.visible=false;scene.add(DUST.pts)})();
function emitDust(p,count,rgb){const W=S.shape.world,pos=DUST.pts.geometry.attributes.position.array,col=DUST.pts.geometry.attributes.color.array,r=S.brush.size,h=hAt(p.gx,p.gy)*S.view.vex;DUST.pts.material.size=Math.max(2,W*.0018);
  const c=rgb||[.62,.52,.4];for(let q=0;q<count;q++){const i=DUST.i=(DUST.i+1)%DUST.n,a=Math.random()*6.283,d=Math.sqrt(Math.random())*r;pos[i*3]=p.x+Math.cos(a)*d;pos[i*3+1]=h+Math.random()*r*.05;pos[i*3+2]=p.z+Math.sin(a)*d;
    DUST.v[i*3]=Math.cos(a)*r*.15;DUST.v[i*3+1]=r*(.25+Math.random()*.4);DUST.v[i*3+2]=Math.sin(a)*r*.15;DUST.life[i]=.6+Math.random()*.5;const b=.85+Math.random()*.3;col[i*3]=c[0]*b;col[i*3+1]=c[1]*b;col[i*3+2]=c[2]*b}
  DUST.alive=1.2;DUST.pts.visible=true}
function dustTick(dt){if(DUST.alive<=0)return;DUST.alive-=dt;const pos=DUST.pts.geometry.attributes.position.array,g=S.brush.size*.9;
  for(let i=0;i<DUST.n;i++){if(DUST.life[i]<=0)continue;DUST.life[i]-=dt;DUST.v[i*3+1]-=g*dt;pos[i*3]+=DUST.v[i*3]*dt;pos[i*3+1]+=DUST.v[i*3+1]*dt;pos[i*3+2]+=DUST.v[i*3+2]*dt;if(DUST.life[i]<=0)pos[i*3+1]=-1e6}
  DUST.pts.geometry.attributes.position.needsUpdate=true;if(DUST.alive<=0)DUST.pts.visible=false;dirty=true}
