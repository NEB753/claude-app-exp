"use strict";
/* Terrain Gen vegetation renderer: realistic billboards baked from CC0 Poly Haven models (fir, pine, two broadleaf
   species, shrubs, a dead snag, ferns, grass, wildflowers) with albedo + normal atlases, so every sprite is lit by the
   real sun direction and casts a correct shadow. Sprites turn around their trunk to face you and lean back with the
   view pitch so they hold their shape from above. Branches and fallen logs are ground decals; boulders are real meshes
   textured with a scanned boulder. All of them share the instance data of the scatter system (no copies). */
const VEG={conifer:{a:'tree',c:[0,1,2],hf:1},pine:{a:'tree',c:[4,5,6],hf:1},broadleaf:{a:'tree',c:[7,8,9,10],hf:.95},birch:{a:'tree',c:[11,9],hf:1},bush:{a:'tree',c:[12,13,14,15],hf:.55},snag:{a:'tree',c:[3],hf:1},
  grass:{a:'ground',c:[2,3],hf:.55},fern:{a:'ground',c:[0,1],hf:.6},flowers:{a:'ground',c:[4,5],hf:.55},branches:{a:'ground',c:[6],decal:true},log:{a:'ground',c:[7],decal:true}};
const VFILL={tree:[.98,.98,.98,.98,.98,.98,.98,.794,.593,.98,.863,.863,.98,.853,.819,.98],ground:[.424,.3,.584,.316,.669,.512,.962,.962]},VGRID={tree:[4,4],ground:[4,2]};
const BB={};let vegState='none',vegQ='',vegTex={},rockMesh=null;
const BB_VS=`attribute vec2 aV;uniform vec2 uGrid;varying vec2 vAUv;varying vec3 vRt;varying vec3 vUp;varying vec3 vNr;
`;
function bbVertex(sh,decal){sh.uniforms.uGrid={value:new THREE.Vector2(...VGRID[decal.a])};
  const cellUv=`{float cx=mod(aV.x,uGrid.x),cy=floor(aV.x/uGrid.x);vAUv=vec2((cx+uv.x)/uGrid.x,1.-(cy+1.-uv.y)/uGrid.y);}`;
  if(decal.decal){sh.vertexShader=BB_VS+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+cellUv+'transformed.xz*=aV.y;');return}
  sh.vertexShader=BB_VS+sh.vertexShader
    .replace('#include <begin_vertex>',`#include <begin_vertex>
      ${cellUv}
      vec3 iPos=vec3(instanceMatrix[3]);float sc=length(instanceMatrix[1].xyz)*aV.y;
      vec3 toC=cameraPosition-iPos;vec3 fw=normalize(vec3(toC.x,0.,toC.z)+vec3(1e-4,0.,0.));vec3 rt=normalize(cross(vec3(0.,1.,0.),fw));
      float pit=asin(clamp(normalize(toC).y,-1.,1.))*.5;vec3 up=cos(pit)*vec3(0.,1.,0.)-sin(pit)*fw;vec3 nr=cos(pit)*fw+sin(pit)*vec3(0.,1.,0.);
      vec3 wPos=iPos+rt*(position.x*sc)+up*(position.y*sc);
      vRt=normalize((viewMatrix*vec4(rt,0.)).xyz);vUp=normalize((viewMatrix*vec4(up,0.)).xyz);vNr=normalize((viewMatrix*vec4(nr,0.)).xyz);`)
    .replace('#include <project_vertex>','vec4 mvPosition=viewMatrix*vec4(wPos,1.);gl_Position=projectionMatrix*mvPosition;')
    .replace('#include <worldpos_vertex>','vec4 worldPosition=vec4(wPos,1.);')}
function bbFragment(sh,nor){sh.uniforms.uNor={value:nor};
  sh.fragmentShader='varying vec2 vAUv;varying vec3 vRt;varying vec3 vUp;varying vec3 vNr;uniform sampler2D uNor;\n'+sh.fragmentShader
    .replace('#include <map_fragment>','vec4 texelColor=mapTexelToLinear(texture2D(map,vAUv));diffuseColor*=texelColor;diffuseColor.rgb*=1.5;')
    .replace('#include <emissivemap_fragment>',nor?'#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*.16;/* light through leaves */':'#include <emissivemap_fragment>')
    .replace('#include <normal_fragment_maps>',nor?'{vec3 nb=texture2D(uNor,vAUv).xyz*2.-1.;nb=normalize(mix(vec3(0.,0.,1.),nb,.35));normal=normalize(nb.x*vRt+nb.y*vUp+nb.z*vNr);}':'')}
function vegMaterial(atlas,decal){const t=vegTex[atlas],m=new THREE.MeshStandardMaterial({map:t.map,alphaTest:.42,side:THREE.DoubleSide,roughness:1,metalness:0,envMapIntensity:.22});
  const spec={a:atlas,decal};m.onBeforeCompile=sh=>{bbVertex(sh,spec);bbFragment(sh,decal?null:t.nor)};
  const d=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:t.map,alphaTest:.42,side:THREE.DoubleSide});d.onBeforeCompile=sh=>{bbVertex(sh,spec);sh.fragmentShader='varying vec2 vAUv;\n'+sh.fragmentShader.replace('#include <map_fragment>','vec4 texelColor=texture2D(map,vAUv);diffuseColor*=texelColor;')};
  if(decal){m.polygonOffset=true;m.polygonOffsetFactor=-2;m.polygonOffsetUnits=-2}return{m,d}}
function loadVegTextures(){const q=(QUALITY[S.quality]||{}),hi=S.quality==='pro'||S.quality==='ultra',tag=hi?'2k':'1k';if(vegQ===tag&&vegState!=='none')return;vegQ=tag;vegState='loading';
  const L=(u,srgb)=>new Promise((res,rej)=>new THREE.TextureLoader().load(u,t=>{t.encoding=srgb?THREE.sRGBEncoding:THREE.LinearEncoding;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());res(t)},undefined,rej));
  Promise.all([L(`tex/veg_trees_${tag}.png`,true),L(`tex/veg_trees_nor_${tag}.jpg`,false),L(`tex/veg_ground_${tag}.png`,true),L(`tex/veg_ground_nor_${tag}.jpg`,false),L('tex/boulder_diff_1k.jpg',true)]).then(([tm,tn,gm,gn,rk])=>{
    for(const o of Object.values(vegTex))for(const t of Object.values(o))t&&t.dispose&&t.dispose();vegTex={tree:{map:tm,nor:tn},ground:{map:gm,nor:gn},rock:{map:rk}};
    for(const k in BB){scene.remove(BB[k]);BB[k].dispose&&BB[k].dispose()}for(const k in BB)delete BB[k];if(rockMesh){scene.remove(rockMesh);rockMesh=null}
    vegState='ready';vegSync()}).catch(e=>{vegState='failed';console.warn('Vegetation atlas unavailable; using simple models',e)})}
const bbQuad=(()=>{const g=new THREE.PlaneGeometry(1,1);g.translate(0,.5,0);return g})(),decalQuad=(()=>{const g=new THREE.PlaneGeometry(1,1);g.rotateX(-Math.PI/2);return g})();
function rockGeometry(detail){const g=new THREE.IcosahedronGeometry(.5,detail),p=g.attributes.position,n=makeNoise(31);for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),s=.78+.24*n(x*2.1+y,z*2.1-y)+.1*n(x*5,z*5+y*4)+.04*n(x*13,y*13+z);p.setXYZ(i,x*s*1.05,Math.max(-.1,y*s*.72)+.16,z*s*(.88+.1*n(y*3,x)))}g.computeVertexNormals();return g}
function rockMaterial(){const m=new THREE.MeshStandardMaterial({map:vegTex.rock.map,roughness:.95,metalness:0,envMapIntensity:.45});
  m.onBeforeCompile=sh=>{sh.vertexShader='varying vec3 vOP;varying vec3 vON;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOP=position;vON=normal;');
    sh.fragmentShader='varying vec3 vOP;varying vec3 vON;\n'+sh.fragmentShader.replace('#include <map_fragment>',`{vec3 w=pow(abs(normalize(vON)),vec3(4.));w/=w.x+w.y+w.z;vec3 q=vOP*1.6;
      vec4 c=mapTexelToLinear(texture2D(map,q.zy))*w.x+mapTexelToLinear(texture2D(map,q.xz))*w.y+mapTexelToLinear(texture2D(map,q.xy))*w.z;float moss=smoothstep(.55,.9,normalize(vON).y);diffuseColor.rgb*=mix(c.rgb,c.rgb*vec3(.72,.95,.55),moss*.5)*1.6;}`)};return m}
/* point the render meshes at the scatter instance data */
function vegSync(){if(vegState!=='ready'||!SCAT.conifer)return;
  for(const [t,V] of Object.entries(VEG)){const base=SCAT[t];if(!base)continue;
    if(!BB[t]||BB[t].userData.max!==base.userData.max){if(BB[t])scene.remove(BB[t]);const mt=vegMaterial(V.a,!!V.decal),mesh=new THREE.InstancedMesh(V.decal?decalQuad:bbQuad,mt.m,base.userData.max);mesh.customDepthMaterial=mt.d;mesh.userData.max=base.userData.max;
      mesh.instanceMatrix=base.instanceMatrix;mesh.instanceColor=base.instanceColor;mesh.frustumCulled=false;mesh.castShadow=!V.decal&&V.a==='tree';mesh.receiveShadow=!!V.decal;/* a sprite's sun-facing shadow copy would shade its own camera-facing face */mesh.renderOrder=V.decal?1:0;
      if(!base.userData.av||base.userData.av.length<base.userData.max*2)base.userData.av=new Float32Array(base.userData.max*2);mesh.geometry=(V.decal?decalQuad:bbQuad).clone();mesh.geometry.setAttribute('aV',new THREE.InstancedBufferAttribute(base.userData.av,2));scene.add(mesh);BB[t]=mesh}
    BB[t].count=base.count;BB[t].geometry.attributes.aV.needsUpdate=true;base.visible=false}
  const rb=SCAT.boulder;if(rb){const det=S.quality==='pro'||S.quality==='ultra'?3:(QUALITY[S.quality]||{}).lite?1:2;if(!rockMesh||rockMesh.userData.max!==rb.userData.max||rockMesh.userData.det!==det){if(rockMesh)scene.remove(rockMesh);rockMesh=new THREE.InstancedMesh(rockGeometry(det),rockMaterial(),rb.userData.max);rockMesh.userData.max=rb.userData.max;rockMesh.userData.det=det;
      rockMesh.instanceMatrix=rb.instanceMatrix;rockMesh.instanceColor=rb.instanceColor;rockMesh.frustumCulled=false;rockMesh.castShadow=rockMesh.receiveShadow=true;scene.add(rockMesh)}rockMesh.count=rb.count;rb.visible=false}
  dirty=true;shadowDirty()}
/* per-instance sprite choice: atlas cell and the quad size that gives the wanted height */
function vegCell(t,idx,rng){const V=VEG[t],base=SCAT[t];if(!V||!base)return;if(!base.userData.av||base.userData.av.length<base.userData.max*2)base.userData.av=new Float32Array(base.userData.max*2);
  const c=V.c[(rng()*V.c.length)|0],f=VFILL[V.a][c]||1;base.userData.av[idx*2]=c;base.userData.av[idx*2+1]=V.decal?1/f:V.hf/f}
