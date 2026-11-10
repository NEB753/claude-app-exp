"use strict";
/* Strata scatter: procedural low-poly assets placed by rules (altitude band, slope, moisture, wetness, clusters, painted mask). */
function colored(g,rgb){g=g.index?g.toNonIndexed():g;const n=g.attributes.position.count,c=new Float32Array(n*3),l=rgb.map(toLin);for(let i=0;i<n;i++){c[i*3]=l[0];c[i*3+1]=l[1];c[i*3+2]=l[2]}g.setAttribute('color',new THREE.BufferAttribute(c,3));if(g.attributes.uv)g.deleteAttribute('uv');return g}
function mergeGeos(list){
  let n=0;for(const g of list)n+=g.attributes.position.count;
  const pos=new Float32Array(n*3),col=new Float32Array(n*3),nor=new Float32Array(n*3);let o=0;
  for(const g of list){if(!g.attributes.normal)g.computeVertexNormals();pos.set(g.attributes.position.array,o*3);col.set(g.attributes.color.array,o*3);nor.set(g.attributes.normal.array,o*3);o+=g.attributes.position.count}
  const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(pos,3));m.setAttribute('color',new THREE.BufferAttribute(col,3));m.setAttribute('normal',new THREE.BufferAttribute(nor,3));return m;
}
const G=THREE;
function assetGeos(){
  const A={};
  A.conifer=mergeGeos([
    colored(new G.CylinderGeometry(.035,.055,.26,6).translate(0,.13,0),[92,64,42]),
    colored(new G.ConeGeometry(.33,.46,7).translate(0,.42,0),[42,74,44]),
    colored(new G.ConeGeometry(.26,.40,7).translate(0,.62,0),[48,82,48]),
    colored(new G.ConeGeometry(.17,.34,7).translate(0,.84,0),[56,92,54])]);
  A.broadleaf=mergeGeos([
    colored(new G.CylinderGeometry(.04,.065,.46,6).translate(0,.23,0),[96,70,48]),
    colored(new G.IcosahedronGeometry(.3,0).translate(0,.66,0),[78,108,50]),
    colored(new G.IcosahedronGeometry(.21,0).translate(.17,.54,.08),[88,116,54]),
    colored(new G.IcosahedronGeometry(.22,0).translate(-.15,.57,-.1),[70,100,46])]);
  A.bush=mergeGeos([colored(new G.IcosahedronGeometry(.5,0).scale(1,.62,1).translate(0,.28,0),[70,98,52]),colored(new G.IcosahedronGeometry(.34,0).scale(1,.7,1).translate(.3,.22,.12),[82,108,56])]);
  const blades=[];for(let i=0;i<6;i++){const a=i/6*Math.PI*2;blades.push(colored(new G.ConeGeometry(.045,.55+(i%3)*.12,3).translate(0,.28,0).rotateZ(Math.cos(a)*.35).rotateX(Math.sin(a)*.35).translate(Math.cos(a)*.08,0,Math.sin(a)*.08),[108+i*4,132,62]))}
  A.grass=mergeGeos(blades);
  const bo=new G.IcosahedronGeometry(.5,1),bp=bo.attributes.position,bn=makeNoise(3);
  for(let i=0;i<bp.count;i++){const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i),s=.78+.32*bn(x*2.2+y*1.3,z*2.2-y)+.06*bn(x*7,z*7);bp.setXYZ(i,x*s,y*s*.72+.2,z*s)}
  A.boulder=mergeGeos([colored(bo,[132,128,121])]);
  A.cabin=mergeGeos([
    colored(new G.BoxGeometry(1,.6,.74).translate(0,.3,0),[132,90,56]),
    colored(new G.CylinderGeometry(.58,.58,1.12,3).rotateZ(Math.PI/2).rotateX(-Math.PI/2).scale(1,.62,.82).translate(0,.74,0),[78,54,40]),
    colored(new G.BoxGeometry(.13,.38,.13).translate(.3,.98,.12),[120,116,110]),
    colored(new G.BoxGeometry(.2,.36,.02).translate(0,.18,.38),[60,40,28]),
    colored(new G.BoxGeometry(.16,.14,.02).translate(-.3,.36,.38),[200,214,220])]);
  const tw=[];for(const [x,z] of [[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3]])tw.push(colored(new G.BoxGeometry(.06,1.4,.06).translate(x,.7,z),[110,78,50]));
  tw.push(colored(new G.BoxGeometry(.8,.06,.8).translate(0,1.4,0),[138,96,60]),colored(new G.BoxGeometry(.8,.18,.04).translate(0,1.52,.38),[124,86,54]),colored(new G.BoxGeometry(.8,.18,.04).translate(0,1.52,-.38),[124,86,54]),
    colored(new G.ConeGeometry(.62,.42,4).rotateY(Math.PI/4).translate(0,1.95,0),[82,56,40]));
  for(const [x,z] of [[-.34,-.34],[.34,-.34],[-.34,.34],[.34,.34]])tw.push(colored(new G.BoxGeometry(.05,.34,.05).translate(x,1.6,z),[110,78,50]));
  A.tower=mergeGeos(tw);
  // bridge: unit length along X (scaled per instance), deck, rails, piers
  const br=[colored(new G.BoxGeometry(1,.06,.22).translate(0,0,0),[128,90,58]),colored(new G.BoxGeometry(1,.1,.02).translate(0,.08,.11),[104,74,48]),colored(new G.BoxGeometry(1,.1,.02).translate(0,.08,-.11),[104,74,48])];
  for(const x of [-.5,-.17,.17,.5])for(const z of [.1,-.1])br.push(colored(new G.BoxGeometry(.03,.14,.03).translate(x,.07,z),[96,68,44]));
  for(const x of [-.32,0,.32])br.push(colored(new G.BoxGeometry(.05,1,.05).translate(x,-.53,.08),[86,62,42]),colored(new G.BoxGeometry(.05,1,.05).translate(x,-.53,-.08),[86,62,42]));
  A.bridge=mergeGeos(br);
  A.pine=mergeGeos([colored(new G.CylinderGeometry(.03,.05,.62,6).translate(0,.31,0),[104,72,48]),colored(new G.ConeGeometry(.24,.34,7).translate(0,.6,0),[34,62,44]),colored(new G.ConeGeometry(.18,.3,7).translate(0,.78,0),[40,70,48]),colored(new G.ConeGeometry(.1,.22,6).translate(0,.95,0),[46,78,52])]);
  A.birch=mergeGeos([colored(new G.CylinderGeometry(.028,.04,.6,6).translate(0,.3,0),[226,222,212]),colored(new G.BoxGeometry(.06,.02,.06).translate(0,.22,0),[50,46,44]),colored(new G.IcosahedronGeometry(.22,0).scale(1,1.25,1).translate(0,.72,0),[122,152,72]),colored(new G.IcosahedronGeometry(.16,0).translate(.12,.56,.05),[134,160,78])]);
  A.log=mergeGeos([colored(new G.CylinderGeometry(.055,.07,1,6).rotateZ(Math.PI/2).translate(0,.06,0),[98,74,52]),colored(new G.CylinderGeometry(.02,.03,.22,5).rotateZ(.9).translate(.2,.14,.04),[92,70,50]),colored(new G.CylinderGeometry(.07,.07,.02,6).rotateZ(Math.PI/2).translate(.505,.06,0),[170,140,100])]);
  A.snag=mergeGeos([colored(new G.CylinderGeometry(.03,.06,1,6).translate(0,.5,0),[120,110,100]),colored(new G.CylinderGeometry(.01,.02,.3,4).rotateZ(.8).translate(.08,.7,0),[110,100,90])]);
  A.fern=mergeGeos([colored(new G.ConeGeometry(.5,.35,6).translate(0,.17,0),[70,110,50])]);A.flowers=mergeGeos([colored(new G.ConeGeometry(.3,.4,5).translate(0,.2,0),[200,190,70])]);
  A.branches=mergeGeos([colored(new G.CylinderGeometry(.02,.03,1,4).rotateZ(Math.PI/2).rotateY(.4).translate(0,.03,0),[100,80,60]),colored(new G.CylinderGeometry(.015,.02,.7,4).rotateZ(Math.PI/2).rotateY(-.8).translate(.1,.03,.1),[100,80,60])]);
  A.stump=mergeGeos([colored(new G.CylinderGeometry(.1,.14,.18,7).translate(0,.09,0),[104,80,58]),colored(new G.CylinderGeometry(.1,.1,.01,7).translate(0,.185,0),[176,146,104])]);
  A.house=mergeGeos([colored(new G.BoxGeometry(1,.72,.8).translate(0,.36,0),[214,206,196]),colored(new G.CylinderGeometry(.6,.6,1.12,3).rotateZ(Math.PI/2).rotateX(-Math.PI/2).scale(1,.7,.86).translate(0,.92,0),[92,64,52]),
    colored(new G.BoxGeometry(.2,.4,.02).translate(-.2,.2,.41),[70,48,34]),colored(new G.BoxGeometry(.18,.16,.02).translate(.22,.45,.41),[200,214,224]),colored(new G.BoxGeometry(.18,.16,.02).translate(.22,.45,-.41),[200,214,224]),colored(new G.BoxGeometry(.14,.4,.14).translate(-.32,1.08,-.15),[150,90,74])]);
  const fz=[];for(const x of [-.5,0,.5])fz.push(colored(new G.BoxGeometry(.05,.3,.05).translate(x,.15,0),[118,86,58]));fz.push(colored(new G.BoxGeometry(1,.04,.03).translate(0,.22,0),[132,96,64]),colored(new G.BoxGeometry(1,.04,.03).translate(0,.11,0),[132,96,64]));A.fence=mergeGeos(fz);
  A.well=mergeGeos([colored(new G.CylinderGeometry(.22,.24,.22,10).translate(0,.11,0),[140,136,128]),colored(new G.BoxGeometry(.03,.4,.03).translate(.18,.4,0),[110,80,54]),colored(new G.BoxGeometry(.03,.4,.03).translate(-.18,.4,0),[110,80,54]),colored(new G.ConeGeometry(.3,.18,4).rotateY(Math.PI/4).translate(0,.66,0),[96,64,48])]);
  A.lamp=mergeGeos([colored(new G.CylinderGeometry(.015,.025,.7,5).translate(0,.35,0),[50,52,56]),colored(new G.BoxGeometry(.07,.09,.07).translate(0,.72,0),[255,224,140])]);
  A.crate=mergeGeos([colored(new G.BoxGeometry(.28,.28,.28).translate(0,.14,0),[150,110,70]),colored(new G.BoxGeometry(.2,.2,.22).translate(.22,.1,.1),[140,100,62])]);
  A.haybale=mergeGeos([colored(new G.CylinderGeometry(.18,.18,.3,10).rotateZ(Math.PI/2).translate(0,.18,0),[212,182,96])]);
  return A;
}
const ASSETS=assetGeos();
const scatterMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:0,flatShading:true,envMapIntensity:.45});
/* ---- high-detail models for Pro and Ultra: layered drooping conifer skirts, branching broadleaf crowns built from
   noise-displaced leaf clusters, curved grass blades, eroded boulders with lichen, barked logs. Vertex colors carry
   ambient occlusion (darker inside and low in the crown) so the forests read with depth. */
function shadeGeo(g,fn){if(g.index){g.computeVertexNormals();g=g.toNonIndexed()}else g.computeVertexNormals();const p=g.attributes.position,n=p.count,c=new Float32Array(n*3);for(let i=0;i<n;i++){const r=fn(p.getX(i),p.getY(i),p.getZ(i));c[i*3]=toLin(r[0]);c[i*3+1]=toLin(r[1]);c[i*3+2]=toLin(r[2])}g.setAttribute('color',new THREE.BufferAttribute(c,3));if(g.attributes.uv)g.deleteAttribute('uv');return g}
function displace(g,amp,freq,seed,keepBottom){const p=g.attributes.position,n=makeNoise(seed);for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),l=Math.hypot(x,y,z)||1,d=1+amp*(n(x*freq+seed,z*freq-y*freq)*.7+n(x*freq*2.3,y*freq*2.3+z)*.3);p.setXYZ(i,x*d,keepBottom&&y<0?y*.35:y*d,z*d)}return g}
const mixc=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
function assetGeosHD(){
  const A={},rn=mulberry32(77);
  /* conifer: 9 drooping skirts, jittered rims, dark core to sunlit tips */
  const con=[shadeGeo(new G.CylinderGeometry(.03,.06,.5,7,1).translate(0,.25,0),(x,y)=>mixc([70,50,36],[104,76,52],y/.5))];
  for(let t=0;t<7;t++){const f=t/6,r=.36*(1-f*.82)+.04,h=.2+.06*(1-f),y=.22+f*.7,cg=new G.ConeGeometry(r,h,11,1,true);const p=cg.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),yy=p.getY(i),z=p.getZ(i),rim=yy<-h*.3?1:0,a=Math.atan2(z,x),j=1+.18*Math.sin(a*7+t*1.7)*rim;p.setXYZ(i,x*j,yy-rim*.05*(1+Math.sin(a*5+t)),z*j)}
    con.push(shadeGeo(cg.translate(0,y,0),(x,yy,z)=>{const out=Math.min(1,Math.hypot(x,z)/r),lo=(yy-y+h/2)/h;return mixc([22,44,30],[58+12*f,98+10*f,60],clamp(out*.75+lo*.25,0,1))}))}
  A.conifer=mergeGeos(con);
  const pin=[shadeGeo(new G.CylinderGeometry(.025,.05,.7,7,1).translate(0,.35,0),(x,y)=>mixc([84,60,42],[122,86,58],y/.7))];
  for(let t=0;t<6;t++){const f=t/5,r=.24*(1-f*.7)+.03,h=.16,y=.5+f*.45,cg=new G.ConeGeometry(r,h,9,1,true);displace(cg,.12,6,t+3);pin.push(shadeGeo(cg.translate(0,y,0),(x,yy,z)=>mixc([20,40,32],[48,82,58],clamp(Math.hypot(x,z)/r,0,1))))}
  A.pine=mergeGeos(pin);
  /* broadleaf: trunk + 3 limbs, crown of 9 leaf clusters */
  const bl=[shadeGeo(new G.CylinderGeometry(.035,.07,.5,8,1).translate(0,.25,0),()=>[92,68,48])];
  for(let b=0;b<3;b++){const a=b/3*Math.PI*2+.4;bl.push(shadeGeo(new G.CylinderGeometry(.014,.028,.3,6).translate(0,.15,0).rotateZ(.7).rotateY(a).translate(0,.42,0),()=>[88,64,44]))}
  for(let c=0;c<7;c++){const a=c/7*Math.PI*2*1.618,rr=c?(.12+.1*rn()):0,cy=.66+(c?(rn()-.3)*.18:.08),s=c?.15+.07*rn():.24,ico=displace(new G.IcosahedronGeometry(s,1),.22,5,c*7+1);
    bl.push(shadeGeo(ico.translate(Math.cos(a)*rr,cy,Math.sin(a)*rr),(x,y,z)=>{const up=clamp((y-.5)/.4,0,1),out=clamp(Math.hypot(x,z)/.36,0,1);return mixc([40,62,30],[104+c*3,140,62],clamp(up*.6+out*.4,0,1))}))}
  A.broadleaf=mergeGeos(bl);
  const bi=[shadeGeo(new G.CylinderGeometry(.024,.038,.72,10,6).translate(0,.36,0),(x,y,z)=>{const band=Math.sin(y*58+Math.atan2(z,x)*2)>.82;return band?[54,50,46]:[232,228,218]})];
  for(let c=0;c<6;c++){const a=c*2.4,rr=c?.09:0,cy=.62+c*.045,s=.12+.04*rn(),ico=displace(new G.IcosahedronGeometry(s,1),.2,6,c+40).scale(1,1.3,1);bi.push(shadeGeo(ico.translate(Math.cos(a)*rr,cy,Math.sin(a)*rr),(x,y,z)=>mixc([70,104,46],[150,176,86],clamp((y-.5)/.4,0,1))))}
  A.birch=mergeGeos(bi);
  const bu=[];for(let c=0;c<4;c++){const a=c*1.9,rr=c?.22+.08*rn():0,s=c?.22+.1*rn():.34,ico=displace(new G.IcosahedronGeometry(s,1),.25,5,c+60).scale(1,.72,1);bu.push(shadeGeo(ico.translate(Math.cos(a)*rr,s*.5,Math.sin(a)*rr),(x,y,z)=>mixc([40,64,34],[96,124,62],clamp(y/.5,0,1))))}
  A.bush=mergeGeos(bu);
  /* grass: 14 curved three-segment blades */
  const gb=[];for(let i=0;i<10;i++){const a=i/10*Math.PI*2+rn(),len=.45+rn()*.35,lean=.25+rn()*.35,bg=new G.PlaneGeometry(.035,len,1,3).translate(0,len/2,0),p=bg.attributes.position;
    for(let v=0;v<p.count;v++){const y=p.getY(v),t=y/len;p.setXYZ(v,p.getX(v)*(1-t*.85),y,t*t*lean)}bg.rotateY(a).translate(Math.cos(a)*.07,0,Math.sin(a)*.07);
    gb.push(shadeGeo(bg,(x,y)=>mixc([58,82,34],[150,170,82],clamp(y/.7,0,1))))}
  A.grass=mergeGeos(gb);
  const bo=new G.IcosahedronGeometry(.5,2),bp=bo.attributes.position,bn=makeNoise(3);
  for(let i=0;i<bp.count;i++){const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i),s=.8+.28*bn(x*2.2+y*1.3,z*2.2-y)+.08*bn(x*6,z*6+y*3)+.03*bn(x*15,y*15);bp.setXYZ(i,x*s,Math.max(-.12,y*s*.7)+.18,z*s*(.9+.1*bn(y*3,x)))}
  A.boulder=mergeGeos([shadeGeo(bo,(x,y,z)=>{const top=clamp((y-.25)/.3,0,1),li=bn(x*5+9,z*5)>.35?top:0;return mixc(mixc([92,90,86],[146,142,134],clamp(y/.5,0,1)),[118,128,74],li*.7)})]);
  A.log=mergeGeos([shadeGeo(new G.CylinderGeometry(.06,.075,1,12,4).rotateZ(Math.PI/2).translate(0,.065,0),(x,y,z)=>{const r=Math.sin(Math.atan2(z,y-.065)*14)*.5+.5;return mixc([70,52,38],[112,86,60],r)}),
    shadeGeo(new G.CylinderGeometry(.075,.075,.02,12).rotateZ(Math.PI/2).translate(.505,.065,0),(x,y,z)=>{const d=Math.hypot(y-.065,z);return Math.sin(d*160)>0?[186,150,104]:[160,124,84]})]);
  A.stump=mergeGeos([shadeGeo(new G.CylinderGeometry(.1,.15,.2,12,2).translate(0,.1,0),()=>[96,74,54]),shadeGeo(new G.CylinderGeometry(.1,.1,.01,12).translate(0,.205,0),(x,y,z)=>Math.sin(Math.hypot(x,z)*120)>0?[184,150,106]:[158,124,86])]);
  for(const k in ASSETS)if(!A[k])A[k]=ASSETS[k];
  return A;
}
let ASSETS_HD=null;const scatterMatHD=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:0,envMapIntensity:.5,side:THREE.DoubleSide});
const hdTier=()=>false;/* billboards replaced the near/far model swap */

const SCAT={};let scatterCounts={};
/* level of detail: on Pro/Ultra the master meshes (all instances, light models) are split every time the camera moves
   far enough: instances near the camera draw with the detailed models and cast shadows; the rest use the light models
   without shadows. Zoomed out, almost everything is light, which keeps big forests smooth. */
const NEAR={},FAR={};const lodPos=new THREE.Vector3(1e9,1e9,1e9);let lodT=0;
function ensureLOD(){const hd=hdTier();if(hd&&!ASSETS_HD)ASSETS_HD=assetGeosHD();
  for(const t of TREE_KEYS){const base=SCAT[t];if(!base)continue;base.visible=!hd;
    if(!hd){for(const P of [NEAR,FAR])if(P[t]){scene.remove(P[t]);P[t].dispose();delete P[t]}continue}
    const max=base.userData.max,nmax=Math.min(max,t==='grass'?5000:t==='bush'||t==='boulder'?2500:1800);
    if(!FAR[t]||FAR[t].userData.max!==max){if(FAR[t]){scene.remove(FAR[t]);FAR[t].dispose()}const m=new THREE.InstancedMesh(ASSETS[t],scatterMat,max);m.userData.max=max;m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(max*3),3);m.castShadow=false;m.receiveShadow=true;scene.add(m);FAR[t]=m}
    if(!NEAR[t]||NEAR[t].userData.max!==nmax){if(NEAR[t]){scene.remove(NEAR[t]);NEAR[t].dispose()}const m=new THREE.InstancedMesh(ASSETS_HD[t],scatterMatHD,nmax);m.userData.max=nmax;m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(nmax*3),3);m.castShadow=t!=='grass'&&t!=='log'&&t!=='stump';m.receiveShadow=true;scene.add(m);NEAR[t]=m}}}
function partitionLOD(force){if(!hdTier()||!SCAT.conifer)return;const cp=camera.position,R=Math.max(240,S.shape.world*.1),R2=R*R;
  for(const t of TREE_KEYS){const b=SCAT[t],nr=NEAR[t],fr=FAR[t];if(!b||!nr||!fr)continue;const A=b.instanceMatrix.array,C=b.instanceColor.array,NA=nr.instanceMatrix.array,NC=nr.instanceColor.array,FA=fr.instanceMatrix.array,FC=fr.instanceColor.array;let ni=0,fi=0;const nm=nr.userData.max;
    for(let i=0;i<b.count;i++){const o=i*16,dx=A[o+12]-cp.x,dy=A[o+13]-cp.y,dz=A[o+14]-cp.z;if(dx*dx+dy*dy+dz*dz<R2&&ni<nm){NA.set(A.subarray(o,o+16),ni*16);NC.set(C.subarray(i*3,i*3+3),ni*3);ni++}else{FA.set(A.subarray(o,o+16),fi*16);FC.set(C.subarray(i*3,i*3+3),fi*3);fi++}}
    nr.count=ni;fr.count=fi;nr.instanceMatrix.needsUpdate=fr.instanceMatrix.needsUpdate=true;nr.instanceColor.needsUpdate=fr.instanceColor.needsUpdate=true}
  lodPos.copy(cp);dirty=true;shadowDirty()}
function lodTick(now){if(!hdTier()||now-lodT<160)return;const R=Math.max(240,S.shape.world*.1);if(camera.position.distanceTo(lodPos)>R*.22){lodT=now;partitionLOD()}}
const TREE_KEYS=['conifer','pine','broadleaf','birch','bush','grass','boulder','log','stump','snag','fern','flowers','branches'];
const STRUCT_KEYS=['cabin','house','tower','bridge','fence','well','lamp','crate','haybale'];
const MAT_TINT={wood:[1,1,1],brick:[1.3,.66,.55],stone:[1,1,1.04],metal:[.82,.9,1.05],clay:[1.22,.86,.66]};
const parentOf=k=>({pine:'conifer',birch:'broadleaf',log:'deadfall',stump:'deadfall'})[k]||k;
function ensureScatterMeshes(){
  const q=QUALITY[S.quality].scatter;
  for(const t of TREE_KEYS){
    const max=Math.round(SCATTER_TYPES[parentOf(t)].max*q*(t==='grass'||t==='bush'||t==='boulder'?1:.6));
    if(SCAT[t]&&SCAT[t].userData.max===max)continue;
    if(SCAT[t]){scene.remove(SCAT[t]);SCAT[t].dispose()}
    const m=new THREE.InstancedMesh(ASSETS[t],scatterMat,max);m.userData.max=max;m.count=0;m.frustumCulled=false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(max*3),3);
    m.castShadow=t!=='grass'&&t!=='log'&&t!=='stump';m.receiveShadow=true;scene.add(m);SCAT[t]=m;
  }
  for(const t of STRUCT_KEYS)if(!SCAT[t]){const m=new THREE.InstancedMesh(ASSETS[t],scatterMat,80);m.count=0;m.frustumCulled=false;m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(240),3);m.castShadow=m.receiveShadow=true;scene.add(m);SCAT[t]=m}
}
let scatterT=0;
function scatterSoon(ms){clearTimeout(scatterT);scatterT=setTimeout(buildScatter,ms==null?250:ms)}
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),_c=new THREE.Color();
function slopeDeg(gx,gy){const cell=S.shape.world/(N-1),dx=hAt(gx+1,gy)-hAt(gx-1,gy),dy=hAt(gx,gy+1)-hAt(gx,gy-1);return Math.atan(Math.hypot(dx,dy)/(2*cell))*180/Math.PI}
function buildScatter(){
  if(!H)return;ensureScatterMeshes();ecoCompute();
  const on=S.scatter.on,W=S.shape.world,area=(W/1000)**2,sea=seaLevel(),vex=S.view.vex,q=QUALITY[S.quality].scatter,hiT=Math.max(stats.hi,sea+1),cell=W/(N-1),forest=S.scatter.forest??1,fd=(typeof FL!=='undefined'&&FL.R&&FL.d)?FL:null,E=ECO,tl=E.tl,rel=Math.max(stats.hi-sea,1);
  scatterCounts={};const used={};for(const k of TREE_KEYS)used[k]=0;
  ECO_TYPES.forEach((t,ti)=>{
    const cfg=S.scatter.types[t],T=SCATTER_TYPES[t],vars=VARIANTS[t]||[t],map=E[t];
    if(!on||!cfg||!cfg.on||cfg.density<=0||!map){scatterCounts[t]=0;return}
    /* how much of the map suits this type sets how many to place; each spot is accepted by its local suitability */
    let mean=0;const smp=[];for(let k=0;k<map.length;k+=3){mean+=map[k];smp.push(map[k])}mean/=smp.length;smp.sort((a,b)=>a-b);const norm=Math.max(smp[Math.floor(smp.length*.97)]||0,.04);
    const fm=t==='grass'||t==='boulder'||t==='flowers'?1:forest,cap=vars.reduce((a,v)=>a+SCAT[v].userData.max,0),target=Math.min(cap,Math.round(cfg.density*fm*T.perKm*area*q*clamp(mean/norm*1.5,0,1)));
    const rng=mulberry32((S.seed*13+ti*977)>>>0);let placed=0;const tries=target*7,ou=rng(),ov=rng(),jit=1/Math.sqrt(Math.max(1,tries))*.9;
    for(let a=0;a<tries&&placed<target;a++){
      const u=clamp(((ou+a*.7548776662)%1)+(rng()-.5)*jit,0,.9999),v=clamp(((ov+a*.5698402910)%1)+(rng()-.5)*jit,0,.9999),gx=u*(N-1),gy=v*(N-1);
      let p=clamp(ecoAt(map,u,v)/norm,0,1);if(rng()>p)continue;
      const h=hAt(gx,gy),s0=T.unit*cfg.size*(.68+rng()*.64),rr=Math.max(.7,s0*.3/cell);let hmin=h;for(const [ox,oy] of [[rr,0],[-rr,0],[0,rr],[0,-rr]])hmin=Math.min(hmin,hAt(gx+ox,gy+oy));
      if(hmin<sea+.5+(t==='grass'||t==='flowers'?0:s0*.03))continue;
      if(fd&&sampleField(FL.d,FL.R,u*(FL.R-1),v*(FL.R-1))>.04)continue;
      const tn=(h-sea)/(hiT-sea);if(tn<cfg.lo||tn>cfg.hi)continue;const sl=slopeDeg(gx,gy);if(sl>cfg.slope)continue;
      const k=(gy|0)*N+(gx|0);if(SM[k]<.05&&t!=='boulder')continue;
      if(PW[k]>.25){const r=PC[k*3],g=PC[k*3+1];if(!(g>r*1.12)&&rng()<smooth(.25,.6,PW[k]))continue}
      const Fl=ecoAt(E.F,u,v),hn=(h-sea)/rel,tree=t==='conifer'||t==='broadleaf';
      let s=s0;if(tree)s*=lerp(.55,1.12,Fl)*(1-.55*smooth(tl-.12,tl,hn));if(t==='snag')s*=.7+rng()*.5;
      let vk=vars[0];if(vars.length>1){const r=rng();vk=t==='conifer'?(r<.25+hn*.45?'pine':'conifer'):t==='broadleaf'?(r<(S.biome.palette==='tundra'||S.biome.palette==='autumn'?.45:.22)?'birch':'broadleaf'):(r<.72?'log':'stump')}
      const mesh=SCAT[vk];if(used[vk]>=mesh.userData.max)continue;
      const x=(u-.5)*W,z=(v-.5)*W,flat=vk==='log'||t==='branches',sink=(t==='boulder'?.3:flat?0:.04)+Math.tan(sl*Math.PI/180)*(t==='grass'||t==='flowers'||t==='fern'?.08:flat?0:.18);
      if(flat){/* lie on the slope */const dx=hAt(gx+1,gy)-hAt(gx-1,gy),dz=hAt(gx,gy+1)-hAt(gx,gy-1);_p.set(-dx*vex,2*cell,-dz*vex).normalize();_q.setFromUnitVectors(_s.set(0,1,0),_p);_e.set(0,rng()*6.283,0);_q.multiply(new THREE.Quaternion().setFromEuler(_e))}
      else{_e.set(t==='boulder'?rng()*6:(rng()-.5)*.08,rng()*6.283,t==='boulder'?rng()*6:(rng()-.5)*.08);_q.setFromEuler(_e)}
      _p.set(x,h*vex-s*sink+(flat?.12:0),z);_s.set(s,s*(t==='boulder'?.7+rng()*.5:1),s);_m.compose(_p,_q,_s);mesh.setMatrixAt(used[vk],_m);if(!mesh.userData.off||mesh.userData.off.length<mesh.userData.max)mesh.userData.off=new Float32Array(mesh.userData.max);mesh.userData.off[used[vk]]=-s*sink+(flat?.12:0);
      vegCell(vk,used[vk],rng);
      const br=.84+rng()*.3,m=M[k],dry=t==='grass'||t==='bush'||t==='flowers'?(1-m)*.22:0;_c.setRGB(br*(1+dry),br*(1+dry*.5),br*(1-dry*.4));
      if(S.biome.palette==='autumn'&&(vk==='broadleaf'||vk==='birch'||t==='bush')){const r=rng();_c.setRGB(br*(1.7+r*.6),br*(1.0+r*.25),br*.5)}
      if(S.biome.palette==='arid'&&(t==='grass'||t==='bush'))_c.setRGB(br*1.25,br*1.08,br*.7);
      if(S.biome.palette==='tundra'&&t!=='boulder')_c.multiplyScalar(.88);if(vk==='birch')_c.setRGB(br*1.12,br*1.12,br*.92);
      mesh.setColorAt(used[vk],_c);used[vk]++;placed++;
    }
    scatterCounts[t]=placed;
  });
  for(const k of TREE_KEYS){const mesh=SCAT[k];mesh.count=used[k];mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true}
  ensureLOD();partitionLOD(true);
  {const f=resample(ECO.F,ECO.E,N);blurField(f,N,Math.max(1,Math.round(N/96)));let diff=!FSH||FSH.length!==f.length?1:0;if(!diff)for(let k=0;k<f.length;k+=97)diff=Math.max(diff,Math.abs(f[k]-FSH[k]));FSH=on&&S.scatter.types.conifer.on?f:null;if(diff>.02)recolorSoon()}
  placeStructures(on);loadVegTextures();vegSync();dirty=true;shadowDirty();
  if(typeof onScatterBuilt==='function')onScatterBuilt();
}
const ECO_TYPES=['conifer','broadleaf','bush','grass','boulder','deadfall','snag','fern','flowers','branches'];
/* fast path after sculpting: move existing instances onto the new ground (and hide ones now under water) instead of re-placing everything */
function scatterReseat(){if(!H||!SCAT.conifer)return;const W=S.shape.world,vex=S.view.vex,sea=seaLevel();
  for(const k of TREE_KEYS){const m=SCAT[k],off=m.userData.off;if(!m.count||!off)continue;const a=m.instanceMatrix.array;
    for(let i=0;i<m.count;i++){const o=i*16,x=a[o+12],z=a[o+14],gx=(x/W+.5)*(N-1),gy=(z/W+.5)*(N-1),h=hAt(gx,gy);a[o+13]=h<sea+.4&&k!=='grass'?-1e6:h*vex+off[i]}m.instanceMatrix.needsUpdate=true}
  placeStructures(S.scatter.on);vegSync();shadowDirty();dirty=true}
function autoStructs(count){
  const rng=mulberry32((S.seed*31+5+(S.seed2||0)*977)>>>0),W=S.shape.world,sea=seaLevel(),cands=[];
  for(let a=0;a<900;a++){const u=.06+rng()*.88,v=.06+rng()*.88,gx=u*(N-1),gy=v*(N-1),h=hAt(gx,gy);if(h<sea+2)continue;const sl=slopeDeg(gx,gy);if(sl>9)continue;cands.push({u,v,sl:sl+rng()*4})}
  cands.sort((a,b)=>a.sl-b.sl);const out=[],minD=.09;
  for(const c of cands){if(out.length>=count)break;if(out.every(o=>Math.hypot(o.u-c.u,o.v-c.v)>minD))out.push({u:c.u,v:c.v,type:['cabin','house','cabin','tower','house'][out.length%5],mat:['wood','wood','stone','brick'][out.length%4],rot:rng()*6.283})}
  return out;
}
let structList=[];
function placeStructures(on){
  const cfg=S.scatter.types.structure,W=S.shape.world,vex=S.view.vex;
  structList=!on||!cfg.on?[]:(S.structs.length?S.structs:autoStructs(cfg.count));
  const counts={};for(const k of STRUCT_KEYS)counts[k]=0;
  for(const st of structList){if(st.type==='bridge'){placeBridge(st,counts,vex,W,cfg);continue}
    const t=SCAT[st.type]?st.type:'cabin',mesh=SCAT[t];if(counts[t]>=80)continue;const small={crate:.45,haybale:.6,lamp:.7,well:.8,fence:1}[t]||1,gx=st.u*(N-1),gy=st.v*(N-1),s=SCATTER_TYPES.structure.unit*cfg.size*small;
    let lo=1e9;for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1],[0,0]])lo=Math.min(lo,hAt(gx+dx*s/W*(N-1)*.5,gy+dy*s/W*(N-1)*.5));
    const tint=MAT_TINT[st.mat]||MAT_TINT.wood;_q.setFromEuler(_e.set(0,st.rot||0,0));_p.set((st.u-.5)*W,Math.max(lo,seaLevel())*vex-s*.05,(st.v-.5)*W);_s.set(s,s,s);_m.compose(_p,_q,_s);mesh.setMatrixAt(counts[t],_m);mesh.setColorAt(counts[t],_c.setRGB(...tint));counts[t]++}
  for(const t of STRUCT_KEYS){SCAT[t].count=counts[t];SCAT[t].instanceMatrix.needsUpdate=true;if(SCAT[t].instanceColor)SCAT[t].instanceColor.needsUpdate=true}
  scatterCounts.structure=structList.length;
}
/* export: one mesh per asset type plus per-instance transforms (glTF node instancing keeps files small) */
function scatterExportParts(limit){
  const out=[];let budget=limit||20000;const q=new THREE.Quaternion(),p=new THREE.Vector3(),sc=new THREE.Vector3();
  for(const t of [...TREE_KEYS.filter(k=>k!=='grass'),...STRUCT_KEYS]){
    const mesh=SCAT[t];if(!mesh||!mesh.count||budget<=0)continue;const n=Math.min(mesh.count,budget);budget-=n;
    const g=ASSETS[t],vc=g.attributes.position.count,col=new Float32Array(vc*4);for(let i=0;i<vc;i++){col[i*4]=g.attributes.color.array[i*3];col[i*4+1]=g.attributes.color.array[i*3+1];col[i*4+2]=g.attributes.color.array[i*3+2];col[i*4+3]=1}
    const idx=new Uint32Array(vc);for(let i=0;i<vc;i++)idx[i]=i;const inst=[];
    for(let i=0;i<n;i++){mesh.getMatrixAt(i,_m);_m.decompose(p,q,sc);inst.push({t:[+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3)],r:[+q.x.toFixed(5),+q.y.toFixed(5),+q.z.toFixed(5),+q.w.toFixed(5)],s:[+sc.x.toFixed(3),+sc.y.toFixed(3),+sc.z.toFixed(3)]})}
    out.push({name:t[0].toUpperCase()+t.slice(1),pos:g.attributes.position.array.slice(),nor:g.attributes.normal.array.slice(),col,idx,instances:inst,count:n});
  }
  if(typeof townExportParts==='function')out.push(...townExportParts());
  return out;
}
function placeBridge(st,counts,vex,W,cfg){
  const m=SCAT.bridge;if(counts.bridge>=60)return;
  const u1=st.u1??st.u-.03,v1=st.v1??st.v,u2=st.u2??st.u+.03,v2=st.v2??st.v,x1=(u1-.5)*W,z1=(v1-.5)*W,x2=(u2-.5)*W,z2=(v2-.5)*W,len=Math.hypot(x2-x1,z2-z1)||W*.02;
  const h1=hAt(u1*(N-1),v1*(N-1)),h2=hAt(u2*(N-1),v2*(N-1)),deck=Math.max(h1,h2,seaLevel()+2)+1.2,wid=SCATTER_TYPES.structure.unit*cfg.size*.9;
  _q.setFromEuler(_e.set(0,-Math.atan2(z2-z1,x2-x1),0));_p.set((x1+x2)/2,deck*vex,(z1+z2)/2);_s.set(len*1.08,wid*.9,wid);_m.compose(_p,_q,_s);m.setMatrixAt(counts.bridge,_m);m.setColorAt(counts.bridge,_c.setRGB(1,1,1));counts.bridge++;
}
