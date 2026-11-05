"use strict";
/* Strata scatter: procedural low-poly assets placed by rules (altitude band, slope, moisture, wetness, clusters, painted mask). */
function colored(g,rgb){g=g.index?g.toNonIndexed():g;const n=g.attributes.position.count,c=new Float32Array(n*3),l=rgb.map(toLin);for(let i=0;i<n;i++){c[i*3]=l[0];c[i*3+1]=l[1];c[i*3+2]=l[2]}g.setAttribute('color',new THREE.BufferAttribute(c,3));if(g.attributes.uv)g.deleteAttribute('uv');return g}
function mergeGeos(list){
  let n=0;for(const g of list)n+=g.attributes.position.count;
  const pos=new Float32Array(n*3),col=new Float32Array(n*3);let o=0;
  for(const g of list){pos.set(g.attributes.position.array,o*3);col.set(g.attributes.color.array,o*3);o+=g.attributes.position.count}
  const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(pos,3));m.setAttribute('color',new THREE.BufferAttribute(col,3));m.computeVertexNormals();return m;
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
  return A;
}
const ASSETS=assetGeos();
const scatterMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:0,flatShading:true,envMapIntensity:.45});
const SCAT={};let scatterCounts={};
function ensureScatterMeshes(){
  const q=QUALITY[S.quality].scatter;
  for(const t of ['conifer','broadleaf','bush','grass','boulder']){
    const max=Math.round(SCATTER_TYPES[t].max*q);
    if(SCAT[t]&&SCAT[t].userData.max===max)continue;
    if(SCAT[t]){scene.remove(SCAT[t]);SCAT[t].dispose()}
    const m=new THREE.InstancedMesh(ASSETS[t],scatterMat,max);m.userData.max=max;m.count=0;m.frustumCulled=false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(max*3),3);
    m.castShadow=t!=='grass';m.receiveShadow=true;scene.add(m);SCAT[t]=m;
  }
  for(const t of ['cabin','tower'])if(!SCAT[t]){const m=new THREE.InstancedMesh(ASSETS[t],scatterMat,60);m.count=0;m.frustumCulled=false;m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(180),3);m.castShadow=m.receiveShadow=true;scene.add(m);SCAT[t]=m}
}
let scatterT=0;
function scatterSoon(ms){clearTimeout(scatterT);scatterT=setTimeout(buildScatter,ms==null?250:ms)}
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),_c=new THREE.Color();
function slopeDeg(gx,gy){const cell=S.shape.world/(N-1),dx=hAt(gx+1,gy)-hAt(gx-1,gy),dy=hAt(gx,gy+1)-hAt(gx,gy-1);return Math.atan(Math.hypot(dx,dy)/(2*cell))*180/Math.PI}
function buildScatter(){
  if(!H)return;ensureScatterMeshes();
  const on=S.scatter.on,W=S.shape.world,area=(W/1000)**2,maxH=S.shape.maxH,sea=seaLevel(),vex=S.view.vex,q=QUALITY[S.quality].scatter,hiT=Math.max(stats.hi,sea+1);
  scatterCounts={};
  const types=['conifer','broadleaf','bush','grass','boulder'];
  types.forEach((t,ti)=>{
    const mesh=SCAT[t],cfg=S.scatter.types[t],T=SCATTER_TYPES[t];
    if(!on||!cfg.on||cfg.density<=0){mesh.count=0;scatterCounts[t]=0;return}
    const target=Math.min(mesh.userData.max,Math.round(cfg.density*T.perKm*area*q)),rng=mulberry32((S.seed*13+ti*977)>>>0),cn=makeNoise(S.seed+ti*101+7);
    let placed=0;const tries=target*6;
    for(let a=0;a<tries&&placed<target;a++){
      const u=rng(),v=rng(),gx=u*(N-1),gy=v*(N-1),h=hAt(gx,gy);
      if(h<sea+.5)continue;
      const tn=(h-sea)/(hiT-sea);if(tn<cfg.lo||tn>cfg.hi)continue;
      const sl=slopeDeg(gx,gy);if(sl>cfg.slope)continue;
      const k=(gy|0)*N+(gx|0),wet=WM[k],m=M[k];
      let p=SM[k];
      const cl=fbm(cn,u*7,v*7,3,.5)*.5+.5;p*=lerp(1,smooth(.42,.62,cl),cfg.cluster);
      if(t==='conifer')p*=1-smooth(.5,.85,wet);
      if(t==='broadleaf')p*=lerp(.45,1.3,m)*(1-smooth(.7,.95,wet));
      if(t==='bush')p*=lerp(.6,1.2,m)+wet*.8;
      if(t==='grass')p*=lerp(.4,1.2,m)*(1-smooth(.6,.9,wet));
      if(t==='boulder')p*=.35+smooth(12,40,sl)*1.2;
      p*=1-smooth(.85,1,(1-cfg.hi)>0?tn/cfg.hi:0)*.6;
      if(rng()>p)continue;
      const s=T.unit*cfg.size*(.68+rng()*.64),x=(u-.5)*W,z=(v-.5)*W,sink=t==='boulder'?.3:.08;
      _e.set(t==='boulder'?rng()*6:(rng()-.5)*.1,rng()*6.283,t==='boulder'?rng()*6:(rng()-.5)*.1);_q.setFromEuler(_e);
      _p.set(x,h*vex-s*sink,z);_s.set(s,s*(t==='boulder'?.7+rng()*.5:1),s);_m.compose(_p,_q,_s);mesh.setMatrixAt(placed,_m);
      const br=.82+rng()*.32,dry=t==='grass'||t==='bush'?(1-m)*.22:0;_c.setRGB(br*(1+dry),br*(1+dry*.5),br*(1-dry*.4));
      if(S.biome.palette==='autumn'&&(t==='broadleaf'||t==='bush')){const r=rng();_c.setRGB(br*(1.9+r*.6),br*(1.0+r*.3),br*.45)}
      if(S.biome.palette==='tundra'&&t!=='boulder')_c.multiplyScalar(.85);
      mesh.setColorAt(placed,_c);placed++;
    }
    mesh.count=placed;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;scatterCounts[t]=placed;
  });
  placeStructures(on);dirty=true;
  if(typeof onScatterBuilt==='function')onScatterBuilt();
}
function autoStructs(count){
  const rng=mulberry32((S.seed*31+5+(S.seed2||0)*977)>>>0),W=S.shape.world,sea=seaLevel(),cands=[];
  for(let a=0;a<900;a++){const u=.06+rng()*.88,v=.06+rng()*.88,gx=u*(N-1),gy=v*(N-1),h=hAt(gx,gy);if(h<sea+2)continue;const sl=slopeDeg(gx,gy);if(sl>9)continue;cands.push({u,v,sl:sl+rng()*4})}
  cands.sort((a,b)=>a.sl-b.sl);const out=[],minD=.09;
  for(const c of cands){if(out.length>=count)break;if(out.every(o=>Math.hypot(o.u-c.u,o.v-c.v)>minD))out.push({u:c.u,v:c.v,type:out.length%4===3?'tower':'cabin',rot:rng()*6.283})}
  return out;
}
let structList=[];
function placeStructures(on){
  const cfg=S.scatter.types.structure,W=S.shape.world,vex=S.view.vex;
  structList=!on||!cfg.on?[]:(S.structs.length?S.structs:autoStructs(cfg.count));
  const counts={cabin:0,tower:0};
  for(const st of structList){const mesh=SCAT[st.type]||SCAT.cabin,t=SCAT[st.type]?st.type:'cabin',gx=st.u*(N-1),gy=st.v*(N-1),s=SCATTER_TYPES.structure.unit*cfg.size;
    let lo=1e9;for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1],[0,0]])lo=Math.min(lo,hAt(gx+dx*s/W*(N-1)*.5,gy+dy*s/W*(N-1)*.5));
    _q.setFromEuler(_e.set(0,st.rot||0,0));_p.set((st.u-.5)*W,lo*vex-s*.05,(st.v-.5)*W);_s.set(s,s,s);_m.compose(_p,_q,_s);mesh.setMatrixAt(counts[t],_m);mesh.setColorAt(counts[t],_c.setRGB(1,1,1));counts[t]++}
  for(const t of ['cabin','tower']){SCAT[t].count=counts[t];SCAT[t].instanceMatrix.needsUpdate=true;if(SCAT[t].instanceColor)SCAT[t].instanceColor.needsUpdate=true}
  scatterCounts.structure=structList.length;
}
/* merged world-space geometry for export: trees, bushes, boulders, structures (grass skipped to keep files light) */
function scatterExportParts(limit){
  const out=[];let budget=limit||20000;
  for(const t of ['conifer','broadleaf','bush','boulder','cabin','tower']){
    const mesh=SCAT[t];if(!mesh||!mesh.count||budget<=0)continue;const n=Math.min(mesh.count,budget);budget-=n;
    const g=ASSETS[t],gp=g.attributes.position.array,gn=g.attributes.normal.array,gc=g.attributes.color.array,vc=g.attributes.position.count;
    const pos=new Float32Array(n*vc*3),nor=new Float32Array(n*vc*3),col=new Float32Array(n*vc*4),nm=new THREE.Matrix3(),v=new THREE.Vector3(),ic=new THREE.Color();
    for(let i=0;i<n;i++){mesh.getMatrixAt(i,_m);nm.getNormalMatrix(_m);if(mesh.instanceColor)ic.fromArray(mesh.instanceColor.array,i*3);else ic.setRGB(1,1,1);
      for(let k=0;k<vc;k++){const o=(i*vc+k);v.fromArray(gp,k*3).applyMatrix4(_m);pos[o*3]=v.x;pos[o*3+1]=v.y;pos[o*3+2]=v.z;v.fromArray(gn,k*3).applyMatrix3(nm).normalize();nor[o*3]=v.x;nor[o*3+1]=v.y;nor[o*3+2]=v.z;
        col[o*4]=gc[k*3]*ic.r;col[o*4+1]=gc[k*3+1]*ic.g;col[o*4+2]=gc[k*3+2]*ic.b;col[o*4+3]=1}}
    const idx=new Uint32Array(n*vc);for(let i=0;i<idx.length;i++)idx[i]=i;
    out.push({name:SCATTER_TYPES[t]?SCATTER_TYPES[t].label:t[0].toUpperCase()+t.slice(1),pos,nor,col,idx,count:n});
  }
  return out;
}
