"use strict";
/* Terrain Gen Towns: a medieval-to-colonial settlement editor.
   Buildings and props are built procedurally from wall, roof, door and window pieces and textured from one painted atlas
   (plaster, timber frame, stone, brick, planks, clapboard; clay tile, thatch, slate, shingle). Every type × wall × roof
   combination is one InstancedMesh, so hundreds of buildings cost a handful of draw calls. Roads are painted and
   graded into the land (bridges over water), walls and palisades follow the ground with towers and automatic gates,
   and the generator grows hamlets, villages, towns and cities along terrain-following streets. Castles, keeps and
   gatehouses are open: you can walk through gates and courtyards in first person. */
const TW={tool:'place',item:'cottage',cat:'Homes',wall:'auto',roof:'auto',sel:-1,g:null,meshes:{},geos:{},thumbs:{},rk:'cobble',rw:5,wk:'stone',gen:{size:'village',era:'medieval',layout:'organic',walls:true,castle:false,farms:true},dirtyWalls:true,ver:0};
const TOWN_DEF=()=>({b:[],roads:[],walls:[]});
/* ---------------- texture atlas (4×4 tiles, painted once) ---------------- */
const AT={plaster:0,timber:1,stone:2,brick:3,planks:4,clap:5,rtile:6,thatch:7,slate:8,shingle:9,door:10,win:11,cobble:12,beam:13,iron:14,ashlar:15};
function paintAtlas(T){
  const c=document.createElement('canvas');c.width=c.height=T*4;const x=c.getContext('2d'),r=mulberry32(4242),n=makeNoise(808);
  const tile=(id,fn)=>{const ox=(id%4)*T,oy=((id/4)|0)*T;x.save();x.beginPath();x.rect(ox,oy,T,T);x.clip();x.translate(ox,oy);fn(T);x.restore()};
  const speck=(a,col)=>{for(let i=0;i<T*T/40;i++){x.fillStyle=col.replace('A',(a*r()).toFixed(3));x.fillRect(r()*T,r()*T,1+r()*2,1+r()*2)}};
  const grain=(base,amp)=>{const im=x.getImageData(0,0,T,T);for(let j=0;j<T;j++)for(let i=0;i<T;i++){const o=(j*T+i)*4,v=(n(i/T*6,j/T*6)*.6+n(i/T*24,j/T*24)*.4)*amp;im.data[o]=clamp(base[0]+v,0,255);im.data[o+1]=clamp(base[1]+v,0,255);im.data[o+2]=clamp(base[2]+v,0,255);im.data[o+3]=255}x.putImageData(im,0,0)};
  tile(AT.plaster,S=>{grain([226,218,200],26);speck(.12,'rgba(90,70,50,A)');x.fillStyle='rgba(120,100,70,.08)';x.fillRect(0,S*.85,S,S*.15)});
  tile(AT.timber,S=>{grain([228,220,200],22);speck(.1,'rgba(90,70,50,A)');x.strokeStyle='#4a3424';x.lineCap='square';const b=S*.07;x.lineWidth=b;x.strokeRect(b/2,b/2,S-b,S-b);x.beginPath();x.moveTo(S/2,0);x.lineTo(S/2,S);x.moveTo(0,S/2);x.lineTo(S,S/2);x.moveTo(b,b);x.lineTo(S/2,S/2);x.moveTo(S-b,S-b);x.lineTo(S/2,S/2);x.stroke()});
  tile(AT.stone,S=>{grain([150,146,138],20);const rows=6;for(let j=0;j<rows;j++){let i=-r()*S*.2;const h=S/rows;while(i<S){const w=S*(.16+r()*.16),g=118+r()*58|0;x.fillStyle=`rgb(${g},${g-4+r()*6|0},${g-10})`;x.fillRect(i+2,j*h+2,w-4,h-4);x.fillStyle='rgba(255,255,255,.08)';x.fillRect(i+2,j*h+2,w-4,3);i+=w}}speck(.18,'rgba(40,40,40,A)')});
  tile(AT.brick,S=>{x.fillStyle='#b9b0a0';x.fillRect(0,0,S,S);const rows=12,h=S/rows;for(let j=0;j<rows;j++)for(let i=-(j%2)*.5;i<4;i++){const R=150+r()*40|0;x.fillStyle=`rgb(${R},${70+r()*25|0},${52+r()*18|0})`;x.fillRect(i*S/4+2,j*h+2,S/4-4,h-4)}speck(.15,'rgba(30,20,10,A)')});
  tile(AT.planks,S=>{const k=7;for(let i=0;i<k;i++){const g=110+r()*40|0;x.fillStyle=`rgb(${g},${g*.72|0},${g*.48|0})`;x.fillRect(i*S/k,0,S/k,S);x.fillStyle='rgba(0,0,0,.35)';x.fillRect(i*S/k,0,2,S);for(let q=0;q<6;q++){x.fillStyle='rgba(60,35,15,.25)';x.fillRect(i*S/k+r()*S/k,r()*S,1,S*.2)}}});
  tile(AT.clap,S=>{const k=10;for(let j=0;j<k;j++){const g=232+r()*14|0;x.fillStyle=`rgb(${g},${g},${g-6})`;x.fillRect(0,j*S/k,S,S/k);x.fillStyle='rgba(0,0,0,.18)';x.fillRect(0,(j+1)*S/k-3,S,3)}speck(.06,'rgba(80,80,80,A)')});
  tile(AT.rtile,S=>{x.fillStyle='#8a3f26';x.fillRect(0,0,S,S);const rows=9,h=S/rows,cols=8;for(let j=0;j<rows;j++)for(let i=0;i<cols+1;i++){const cx=(i+(j%2)*.5)*S/cols,g=r()*30;x.fillStyle=`rgb(${170+g|0},${78+g*.6|0},${48})`;x.beginPath();x.ellipse(cx,j*h+h*.55,S/cols*.48,h*.62,0,0,Math.PI);x.fill();x.fillStyle='rgba(0,0,0,.2)';x.fillRect(cx-S/cols*.48,j*h+h*.9,S/cols*.96,2)}});
  tile(AT.thatch,S=>{grain([170,140,80],30);for(let i=0;i<S*3;i++){const px=r()*S,py=r()*S,l=6+r()*16,g=r()*60;x.strokeStyle=`rgba(${120+g|0},${95+g*.8|0},${45},.6)`;x.lineWidth=1;x.beginPath();x.moveTo(px,py);x.lineTo(px+(r()-.5)*3,py+l);x.stroke()}for(let j=1;j<5;j++){x.fillStyle='rgba(60,40,10,.25)';x.fillRect(0,j*S/5,S,3)}});
  tile(AT.slate,S=>{x.fillStyle='#3e434a';x.fillRect(0,0,S,S);const rows=10,h=S/rows,cols=7;for(let j=0;j<rows;j++)for(let i=-1;i<cols+1;i++){const g=r()*24;x.fillStyle=`rgb(${70+g|0},${76+g|0},${86+g|0})`;x.fillRect((i+(j%2)*.5)*S/cols+1,j*h+1,S/cols-2,h*1.1)}speck(.15,'rgba(0,0,0,A)')});
  tile(AT.shingle,S=>{x.fillStyle='#4a3a2c';x.fillRect(0,0,S,S);const rows=11,h=S/rows;for(let j=0;j<rows;j++){let i=-r()*10;while(i<S){const w=S*(.08+r()*.07),g=r()*40;x.fillStyle=`rgb(${110+g|0},${84+g*.8|0},${60+g*.5|0})`;x.fillRect(i+1,j*h,w-2,h*1.15);i+=w}}});
  tile(AT.door,S=>{const k=5;for(let i=0;i<k;i++){const g=90+r()*25|0;x.fillStyle=`rgb(${g},${g*.66|0},${g*.42|0})`;x.fillRect(i*S/k,0,S/k,S);x.fillStyle='rgba(0,0,0,.4)';x.fillRect(i*S/k,0,2,S)}x.fillStyle='#2b2b2e';x.fillRect(0,S*.2,S,S*.05);x.fillRect(0,S*.72,S,S*.05);x.beginPath();x.arc(S*.78,S*.5,S*.04,0,7);x.fill()});
  tile(AT.win,S=>{x.fillStyle='#e8e2d4';x.fillRect(0,0,S,S);const m=S*.1;const g=x.createLinearGradient(0,0,S,S);g.addColorStop(0,'#40566a');g.addColorStop(.5,'#7d97a8');g.addColorStop(1,'#2c3b48');x.fillStyle=g;x.fillRect(m,m,S-2*m,S-2*m);x.fillStyle='#e8e2d4';x.fillRect(S/2-S*.03,m,S*.06,S-2*m);x.fillRect(m,S/2-S*.03,S-2*m,S*.06)});
  tile(AT.cobble,S=>{x.fillStyle='#6e675e';x.fillRect(0,0,S,S);for(let i=0;i<220;i++){const g=100+r()*60|0;x.fillStyle=`rgb(${g},${g-6},${g-14})`;x.beginPath();x.ellipse(r()*S,r()*S,6+r()*10,5+r()*8,r()*3,0,7);x.fill()}});
  tile(AT.beam,S=>{grain([82,58,40],26);for(let i=0;i<30;i++){x.fillStyle='rgba(30,18,8,.3)';x.fillRect(0,r()*S,S,1)}});
  tile(AT.iron,S=>{grain([60,62,66],18)});
  tile(AT.ashlar,S=>{grain([196,188,170],16);for(let j=0;j<4;j++){x.fillStyle='rgba(90,80,60,.35)';x.fillRect(0,j*S/4,S,2);for(let i=0;i<3;i++)x.fillRect(((i+(j%2)*.5)*S/3)%S,j*S/4,2,S/4)}});
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
}
let townAtlas=null;const townMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:0,envMapIntensity:.5,side:THREE.DoubleSide});
function ensureAtlas(){if(!townAtlas){townAtlas=paintAtlas(256);townMat.map=townAtlas;townMat.needsUpdate=true}}
/* ---------------- geometry builder ---------------- */
class GB{constructor(){this.p=[];this.n=[];this.uv=[];this.c=[]}
  _uv(tile,u,v){const ins=.012,tx=tile%4,ty=(tile/4)|0;return[(tx+ins+u*(1-2*ins))/4,1-(ty+ins+v*(1-2*ins))/4]}
  tri(a,b,c,ta,tb,tc,tile,col){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
    for(const [p,t] of [[a,ta],[b,tb],[c,tc]]){this.p.push(p[0],p[1],p[2]);this.n.push(nx,ny,nz);const q=this._uv(tile,t[0],t[1]);this.uv.push(q[0],q[1]);const cc=col||[1,1,1];this.c.push(cc[0],cc[1],cc[2])}}
  quad(a,b,c,d,tile,col,uv){const U=uv||[[0,0],[1,0],[1,1],[0,1]];this.tri(a,b,c,U[0],U[1],U[2],tile,col);this.tri(a,c,d,U[0],U[2],U[3],tile,col)}
  /* a vertical wall from (x0,z0) to (x1,z1) seen from outside left→right, split into texture-sized cells */
  wall(x0,z0,x1,z1,y0,y1,tile,ts,col){const L=Math.hypot(x1-x0,z1-z0),nu=Math.max(1,Math.round(L/ts)),nv=Math.max(1,Math.round((y1-y0)/ts));
    for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i/nu,b=(i+1)/nu,ya=y0+(y1-y0)*j/nv,yb=y0+(y1-y0)*(j+1)/nv;
      this.quad([lerp(x0,x1,a),ya,lerp(z0,z1,a)],[lerp(x0,x1,b),ya,lerp(z0,z1,b)],[lerp(x0,x1,b),yb,lerp(z0,z1,b)],[lerp(x0,x1,a),yb,lerp(z0,z1,a)],tile,col)}}
  box(cx,cz,w,d,y0,y1,tile,top,ts,col){const x0=cx-w/2,x1=cx+w/2,z0=cz-d/2,z1=cz+d/2,t=ts||3;
    this.wall(x0,z1,x1,z1,y0,y1,tile,t,col);this.wall(x1,z1,x1,z0,y0,y1,tile,t,col);this.wall(x1,z0,x0,z0,y0,y1,tile,t,col);this.wall(x0,z0,x0,z1,y0,y1,tile,t,col);
    this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],top??tile,col)}
  /* oriented box between two ground points (walls, bridge decks) */
  obox(x0,z0,x1,z1,th,y0,y1,tile,ts,col){const dx=x1-x0,dz=z1-z0,L=Math.hypot(dx,dz)||1,nx=-dz/L*th/2,nz=dx/L*th/2;
    this.wall(x0+nx,z0+nz,x1+nx,z1+nz,y0,y1,tile,ts,col);this.wall(x1-nx,z1-nz,x0-nx,z0-nz,y0,y1,tile,ts,col);this.wall(x1+nx,z1+nz,x1-nx,z1-nz,y0,y1,tile,ts,col);this.wall(x0-nx,z0-nz,x0+nx,z0+nz,y0,y1,tile,ts,col);
    this.quad([x0+nx,y1,z0+nz],[x1+nx,y1,z1+nz],[x1-nx,y1,z1-nz],[x0-nx,y1,z0-nz],tile,col)}
  gable(w,d,yb,h,o,tile,wallTile,alongZ){if(alongZ){/* ridge along z: gables face front/back */
      const W=w/2+o,D=d/2+o;this.quad([W,yb,D],[W,yb,-D],[0,yb+h,-D],[0,yb+h,D],tile);this.quad([-W,yb,-D],[-W,yb,D],[0,yb+h,D],[0,yb+h,-D],tile);
      const hh=h*(w/2)/(W);this.tri([-w/2,yb,d/2],[w/2,yb,d/2],[0,yb+hh,d/2],[0,0],[1,0],[.5,1],wallTile);this.tri([w/2,yb,-d/2],[-w/2,yb,-d/2],[0,yb+hh,-d/2],[0,0],[1,0],[.5,1],wallTile);return}
    const W=w/2+o,D=d/2+o;this.quad([-W,yb,D],[W,yb,D],[W,yb+h,0],[-W,yb+h,0],tile);this.quad([W,yb,-D],[-W,yb,-D],[-W,yb+h,0],[W,yb+h,0],tile);
    const hh=h*(d/2)/D;this.tri([w/2,yb,d/2],[w/2,yb,-d/2],[w/2,yb+hh,0],[0,0],[1,0],[.5,1],wallTile);this.tri([-w/2,yb,-d/2],[-w/2,yb,d/2],[-w/2,yb+hh,0],[0,0],[1,0],[.5,1],wallTile)}
  hip(w,d,yb,h,o,tile){const W=w/2+o,D=d/2+o,r=Math.min(W,D)*.98,rx=Math.max(0,W-r),rz=Math.max(0,D-r);
    this.quad([-W,yb,D],[W,yb,D],[rx,yb+h,rz],[-rx,yb+h,rz],tile);this.quad([W,yb,-D],[-W,yb,-D],[-rx,yb+h,-rz],[rx,yb+h,-rz],tile);
    this.quad([W,yb,D],[W,yb,-D],[rx,yb+h,-rz],[rx,yb+h,rz],tile);this.quad([-W,yb,-D],[-W,yb,D],[-rx,yb+h,rz],[-rx,yb+h,-rz],tile)}
  prism(cx,cz,r0,r1,y0,y1,seg,tile,ts,col){for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2,nv=Math.max(1,Math.round((y1-y0)/(ts||3)));
      for(let j=0;j<nv;j++){const ya=y0+(y1-y0)*j/nv,yb=y0+(y1-y0)*(j+1)/nv,ra=lerp(r0,r1,j/nv),rb=lerp(r0,r1,(j+1)/nv);
        this.quad([cx+Math.cos(b)*ra,ya,cz+Math.sin(b)*ra],[cx+Math.cos(a)*ra,ya,cz+Math.sin(a)*ra],[cx+Math.cos(a)*rb,yb,cz+Math.sin(a)*rb],[cx+Math.cos(b)*rb,yb,cz+Math.sin(b)*rb],tile,col,[[i/seg,0],[(i+1)/seg,0],[(i+1)/seg,1],[i/seg,1]])}}}
  cone(cx,cz,r,y,h,seg,tile){for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2;this.tri([cx+Math.cos(b)*r,y,cz+Math.sin(b)*r],[cx+Math.cos(a)*r,y,cz+Math.sin(a)*r],[cx,y+h,cz],[0,0],[1,0],[.5,1],tile)}}
  disc(cx,cz,r,y,seg,tile){for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2;this.tri([cx,y,cz],[cx+Math.cos(b)*r,y,cz+Math.sin(b)*r],[cx+Math.cos(a)*r,y,cz+Math.sin(a)*r],[.5,.5],[1,.5],[.5,1],tile)}}
  /* door/window decals on a facade: face given by outward normal (nx,nz) and centre */
  decal(cx,cz,nx,nz,w,y0,y1,tile){const rx=-nz,rz=nx,o=.03,px=cx+nx*o,pz=cz+nz*o;this.quad([px-rx*w/2,y0,pz-rz*w/2],[px+rx*w/2,y0,pz+rz*w/2],[px+rx*w/2,y1,pz+rz*w/2],[px-rx*w/2,y1,pz-rz*w/2],tile)}
  merlons(x0,z0,x1,z1,y,th,step){const L=Math.hypot(x1-x0,z1-z0),n=Math.max(1,Math.floor(L/step));for(let i=0;i<n;i+=2){const a=(i+.15)/n,b=(i+.85)/n;this.obox(lerp(x0,x1,a),lerp(z0,z1,a),lerp(x0,x1,b),lerp(z0,z1,b),th,y,y+1,AT.stone,2)}}
  build(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.computeBoundingSphere();return g}}
/* facade windows on all four walls of a w×d block */
function windowsOn(g,w,d,fl,fh,skipFrontCenter,tile){const sides=[[0,d/2,0,1,w],[w/2,0,1,0,d],[0,-d/2,0,-1,w],[-w/2,0,-1,0,d]];
  for(const [cx,cz,nx,nz,L] of sides){const k=Math.max(1,Math.floor((L-1)/2.6));for(let f=0;f<fl;f++)for(let i=0;i<k;i++){const t=(i+.5)/k-.5;if(skipFrontCenter&&f===0&&nz===1&&Math.abs(t*L)<1.1)continue;const px=cx+(-nz)*t*L,pz=cz+nx*t*L;g.decal(px,pz,nx,nz,.9,f*fh+1.1,f*fh+2.2,tile||AT.win)}}}
function houseGeo(o){const g=new GB(),H=o.fl*o.fh;g.box(0,0,o.w,o.d,-1.2,H,o.wall,AT.beam,o.ts||2.6);g.box(0,0,o.w+.3,o.d+.3,-1.2,.35,AT.stone,AT.stone,2);
  g.decal(0,o.d/2+.15,0,1,o.doorW||1.2,0,o.doorH||2.1,AT.door);if(o.win!==false)windowsOn(g,o.w,o.d,o.fl,o.fh,true);
  const rh=(o.alongZ?o.w:o.d)/2*o.pitch;if(o.hipRoof)g.hip(o.w,o.d,H,rh,.45,o.roof);else g.gable(o.w,o.d,H,rh,.45,o.roof,o.wall,o.alongZ);
  for(let i=0;i<(o.chim||0);i++){const cx=(i?-1:1)*o.w*.3;g.box(cx,-o.d*.15,.7,.7,H,H+rh+1,AT.stone,AT.stone,2)}
  return g}
/* ---------------- catalog ---------------- */
const TOWN_CAT={
  Homes:{cottage:'Cottage',timberhouse:'Timber house',townhouse:'Townhouse',longhouse:'Longhouse',farmhouse:'Farmhouse',manor:'Manor',colonial:'Colonial house',rowhouse:'Row houses'},
  Work:{barn:'Barn',stable:'Stable',smithy:'Smithy',windmill:'Windmill',watermill:'Watermill',granary:'Granary',warehouse:'Warehouse',workshop:'Workshop',stall:'Market stall'},
  Civic:{church:'Church',chapel:'Chapel',tavern:'Tavern',townhall:'Town hall',markethall:'Market hall',well:'Well',fountain:'Fountain',lighthouse:'Lighthouse',dock:'Dock'},
  Defense:{watchtower:'Watchtower',walltower:'Round tower',gatehouse:'Gatehouse',keep:'Keep',castle:'Castle',fort:'Wooden fort'},
  Props:{fence:'Fence',cart:'Cart',barrels:'Barrels',crates:'Crates',haybale:'Hay bales',lamp:'Lamp post',sign:'Signpost',bench:'Bench',woodpile:'Woodpile',statue:'Statue',grave:'Graves'}};
const TOWN_NAME={};for(const c in TOWN_CAT)Object.assign(TOWN_NAME,TOWN_CAT[c]);
const WALLS={plaster:['Plaster',AT.plaster],timber:['Timber frame',AT.timber],stone:['Stone',AT.stone],brick:['Brick',AT.brick],wood:['Wood planks',AT.planks],clap:['Clapboard',AT.clap]};
const ROOFS={thatch:['Thatch',AT.thatch],tile:['Clay tile',AT.rtile],slate:['Slate',AT.slate],shingle:['Shingle',AT.shingle]};
const DEF_STYLE={cottage:['plaster','thatch'],timberhouse:['timber','tile'],townhouse:['timber','slate'],longhouse:['wood','thatch'],farmhouse:['plaster','thatch'],manor:['stone','slate'],colonial:['clap','shingle'],rowhouse:['brick','slate'],
  barn:['wood','shingle'],stable:['wood','thatch'],smithy:['stone','slate'],windmill:['plaster','thatch'],watermill:['stone','tile'],granary:['wood','thatch'],warehouse:['stone','tile'],workshop:['timber','tile'],stall:['wood','tile'],
  church:['stone','slate'],chapel:['stone','slate'],tavern:['timber','tile'],townhall:['stone','slate'],markethall:['timber','tile'],lighthouse:['plaster','slate'],dock:['wood','shingle'],watchtower:['wood','shingle'],walltower:['stone','slate'],gatehouse:['stone','slate'],keep:['stone','slate']};
const UPGRADE={cottage:'timberhouse',timberhouse:'townhouse',farmhouse:'manor',chapel:'church',watchtower:'walltower',walltower:'keep',stall:'markethall',longhouse:'farmhouse',colonial:'manor',workshop:'warehouse'};
const FOOT={cottage:4,timberhouse:4.6,townhouse:4.5,longhouse:7,farmhouse:7,manor:9,colonial:7,rowhouse:9,barn:8,stable:6,smithy:4.5,windmill:4,watermill:6,granary:3,warehouse:9,workshop:5,stall:2.5,church:11,chapel:6,tavern:6.5,townhall:9,markethall:7,well:1.6,fountain:3,lighthouse:4,dock:7,watchtower:3,walltower:3.6,gatehouse:6,keep:9,castle:30,fort:26,fence:3,cart:2,barrels:1.2,crates:1.2,haybale:1.5,lamp:.6,sign:.6,bench:1.2,woodpile:1.5,statue:1.2,grave:2};
const isProp=t=>t in TOWN_CAT.Props;
function townGeo(type,wall,roof){
  const k=type+'|'+wall+'|'+roof;if(TW.geos[k])return TW.geos[k];const wt=(WALLS[wall]||WALLS.plaster)[1],rt=(ROOFS[roof]||ROOFS.tile)[1];let g;
  const H=o=>houseGeo({wall:wt,roof:rt,fh:3,...o});
  switch(type){
    case'cottage':g=H({w:6,d:5,fl:1,pitch:1.15,chim:1});break;
    case'timberhouse':g=H({w:7,d:6,fl:2,pitch:1,chim:1});break;
    case'townhouse':g=H({w:5,d:8,fl:3,pitch:1.3,alongZ:true,chim:1});break;
    case'longhouse':g=H({w:13,d:5.5,fl:1,fh:2.6,pitch:1.35});break;
    case'farmhouse':g=H({w:9,d:6,fl:1,fh:3.4,pitch:1.15,chim:1});g.box(5.8,-.5,3.2,4,-1,2.6,wt,AT.beam);g.gable(3.2,4,2.6,1.6,.3,rt,wt);break;
    case'manor':g=H({w:15,d:9,fl:2,fh:3.4,pitch:.7,hipRoof:true,chim:2,doorW:1.8,doorH:2.6});break;
    case'colonial':g=H({w:11,d:7,fl:2,fh:3.2,pitch:.55,hipRoof:true,chim:2,doorW:1.4});break;
    case'rowhouse':{g=new GB();for(let i=0;i<3;i++){const ox=(i-1)*4.6;g.box(ox,0,4.5,8,-1.2,9,wt,AT.beam,2.6);g.decal(ox,4.15,0,1,1.1,0,2.1,AT.door);for(let f=0;f<3;f++)for(const s of [-1,1]){if(f===0&&s===-1)continue;g.decal(ox+s*1.2,4.02,0,1,.85,f*3+1.1,f*3+2.2,AT.win)}}
      g.gable(13.8,8,9,3.6,.4,rt,wt);for(let i=0;i<3;i++)g.box((i-1)*4.6,-1,.7,.7,9,13.5,AT.brick,AT.stone,2);break}
    case'barn':g=H({w:12,d:8,fl:1,fh:5,pitch:1.2,win:false,doorW:3.2,doorH:3.6});break;
    case'stable':{g=H({w:11,d:5,fl:1,fh:2.8,pitch:.8,win:false,doorW:1.4});for(const x of [-3.5,3.5])g.decal(x,2.53,0,1,1.4,0,2.1,AT.door);break}
    case'smithy':{g=H({w:6.5,d:6,fl:1,fh:3,pitch:1});g.box(2.2,-1.5,1.4,1.4,0,7,AT.stone,AT.stone,2);g.box(-1.5,4,1.2,1,0,1,AT.iron,AT.iron,2);break}
    case'windmill':{g=new GB();g.prism(0,0,3.2,2.4,-1,9,8,wt,3);g.cone(0,0,3,9,3.4,8,rt);g.decal(0,3.15,0,1,1.1,0,2.1,AT.door);
      for(let i=0;i<4;i++){const a=i*Math.PI/2+.4,cx=Math.cos(a)*3.6,cy=9.2+Math.sin(a)*3.6;const ux=Math.cos(a),uy=Math.sin(a),px=-uy*.6,py=ux*.6;
        g.quad([cx-ux*3.2-px,cy-uy*3.2-py,3.3],[cx+ux*3.2-px,cy+uy*3.2-py,3.3],[cx+ux*3.2+px,cy+uy*3.2+py,3.3],[cx-ux*3.2+px,cy-uy*3.2+py,3.3],AT.planks)}
      g.box(0,3.1,.4,.6,8.9,9.5,AT.beam,AT.beam);break}
    case'watermill':{g=H({w:8,d:6,fl:2,pitch:1,chim:1});for(let i=0;i<10;i++){const a=i/10*Math.PI*2,y=1.6+Math.sin(a)*2.4,z=Math.cos(a)*2.4;g.obox(4.3,z,5.3,z,.25,y-.15,y+.15,AT.planks,2)}g.prism(4.8,0,.3,.3,1.3,1.9,6,AT.beam);break}
    case'granary':{g=new GB();for(const [x,z] of [[-1.8,-1.4],[1.8,-1.4],[-1.8,1.4],[1.8,1.4]])g.box(x,z,.35,.35,-1,1.2,AT.stone,AT.stone);g.box(0,0,4.2,3.4,1.2,3.8,wt,AT.beam,2.6);g.gable(4.2,3.4,3.8,1.8,.35,rt,wt);break}
    case'warehouse':g=H({w:15,d:9,fl:2,fh:3.6,pitch:.7,doorW:3,doorH:3});break;
    case'workshop':g=H({w:7,d:6,fl:1,fh:3.2,pitch:.9,doorW:2.2});break;
    case'stall':{g=new GB();for(const [x,z] of [[-1.4,-.9],[1.4,-.9],[-1.4,.9],[1.4,.9]])g.box(x,z,.15,.15,-.3,2.3,AT.beam,AT.beam);g.box(0,.3,2.8,1,.85,1,AT.planks,AT.planks);g.gable(3.2,2.2,2.3,.6,.15,rt,AT.planks);break}
    case'church':{g=new GB();g.box(0,-2,9,16,-1.2,8,wt,AT.beam,3);g.gable(9,16,8,6,.5,rt,wt,true);for(const z of [-7,-3.5,0,3.5])for(const s of [-1,1])g.decal(s*4.5,z-2,s,0,1.1,3,6.2,AT.win);
      g.box(0,7.6,4.6,4.6,-1.2,18,wt,AT.beam,3);g.hip(4.6,4.6,18,8,.3,rt);g.decal(0,9.9,0,1,1.6,0,3.2,AT.door);g.decal(0,9.9,0,1,1,12,14,AT.win);break}
    case'chapel':{g=H({w:6,d:10,fl:1,fh:5,pitch:1.2,alongZ:true});g.box(0,5.2,1.4,.6,5,8.6,wt,AT.stone,2);break}
    case'tavern':{g=H({w:10,d:8,fl:2,fh:3.2,pitch:1,chim:2,doorW:1.6});g.box(3.6,4.6,.12,.12,3,4.2,AT.beam,AT.beam);g.obox(3.6,4.7,3.6,5.6,.08,3.4,4.1,AT.planks,1);break}
    case'townhall':{g=H({w:15,d:10,fl:2,fh:3.6,pitch:.65,hipRoof:true,doorW:2,doorH:2.8});g.box(0,0,3,3,7.2,12,wt,AT.beam,2.6);g.hip(3,3,12,3,.2,rt);g.decal(0,1.52,0,1,1.2,9.4,10.6,AT.iron);break}
    case'markethall':{g=new GB();for(let i=0;i<4;i++)for(const z of [-2.6,2.6])g.box(-4.5+i*3,z,.5,.5,-1,3,AT.stone,AT.stone,2);g.box(0,0,11,6.4,3,6,wt,AT.beam,2.6);windowsOn(g,11,6.4,1,3,false);g.box(0,0,11,6.4,2.9,3.05,AT.beam,AT.beam);g.hip(11,6.4,6,2.6,.45,rt);g.quad([-5.5,3,3.2],[5.5,3,3.2],[5.5,3,-3.2],[-5.5,3,-3.2],AT.beam);break}
    case'well':{g=new GB();g.prism(0,0,1.1,1.1,-.5,.9,10,AT.stone,1.5);for(const x of [-.9,.9])g.box(x,0,.15,.15,.9,2.4,AT.beam,AT.beam);g.gable(2.4,1.6,2.4,.7,.1,rt,AT.planks);break}
    case'fountain':{g=new GB();g.prism(0,0,2.8,2.8,-.4,.7,16,AT.ashlar,1.5);g.disc(0,0,2.6,.55,16,AT.win);g.prism(0,0,.35,.25,.5,2.6,8,AT.ashlar,1.5);g.prism(0,0,.9,.9,1.8,2,10,AT.ashlar,1.5);break}
    case'lighthouse':{g=new GB();g.prism(0,0,3.2,2.1,-1,18,10,wt,3);g.prism(0,0,1.6,1.6,18,20,8,AT.win,2);g.cone(0,0,2,20,2.6,8,rt);g.decal(0,3.15,0,1,1.1,-1,2.1,AT.door);g.prism(0,0,2.6,2.6,17.8,18.1,12,AT.iron,1);break}
    case'dock':{g=new GB();g.box(0,0,4,14,.8,1.1,AT.planks,AT.planks,2);for(let z=-6;z<=6;z+=3)for(const x of [-1.8,1.8])g.prism(x,z,.2,.2,-4,1.3,6,AT.beam);break}
    case'watchtower':{g=new GB();g.box(0,0,3.6,3.6,-1,10,wt,AT.planks,2.6);g.box(0,0,4.6,4.6,10,10.4,AT.planks,AT.planks);for(const [x,z] of [[-2.1,-2.1],[2.1,-2.1],[-2.1,2.1],[2.1,2.1]])g.box(x,z,.2,.2,10.4,12.4,AT.beam,AT.beam);g.hip(4.6,4.6,12.4,2.2,.3,rt);g.decal(0,1.83,0,1,1,0,2,AT.door);break}
    case'walltower':{g=new GB();g.prism(0,0,3.6,3.3,-1.5,11,12,wt,3);g.prism(0,0,3.6,3.6,11,12.2,12,wt,2);g.cone(0,0,3.9,12.2,4.5,12,rt);for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;g.decal(Math.cos(a)*3.4,Math.sin(a)*3.4,Math.cos(a),Math.sin(a),.35,6,7.6,AT.win)}break}
    case'gatehouse':{g=new GB();for(const s of [-1,1]){g.box(s*4,0,3.5,6,-1.5,11,wt,AT.stone,3);g.merlons(s*4-1.75,3,s*4+1.75,3,11,.6,.8);g.merlons(s*4-1.75,-3,s*4+1.75,-3,11,.6,.8)}
      g.box(0,0,4.5,6,7,11,wt,AT.stone,3);g.merlons(-2.25,3,2.25,3,11,.6,.8);g.merlons(-2.25,-3,2.25,-3,11,.6,.8);g.decal(0,3.05,0,1,4.3,6.2,7,AT.iron);break}
    case'keep':{g=new GB();g.box(0,0,12,12,-1.5,18,wt,AT.stone,3);for(const [a,b,c,d] of [[-6,6,6,6],[6,6,6,-6],[6,-6,-6,-6],[-6,-6,-6,6]])g.merlons(a,b,c,d,18,.8,.9);g.decal(0,6.05,0,1,2,0,3.2,AT.door);
      for(const [cx,cz,nx,nz] of [[0,6,0,1],[6,0,1,0],[0,-6,0,-1],[-6,0,-1,0]])for(const y of [7,11,14.5])for(const t of [-3,3])g.decal(cx+(-nz)*t,cz+nx*t,nx,nz,.4,y,y+1.6,AT.win);break}
    case'fence':{g=new GB();for(const x of [-1.5,0,1.5])g.box(x,0,.12,.12,-.3,1.1,AT.beam,AT.beam);for(const y of [.45,.9])g.box(0,0,3.1,.06,y,y+.1,AT.planks,AT.planks);break}
    case'cart':{g=new GB();g.box(0,0,2.2,1.3,.7,1.2,AT.planks,AT.planks,1.5);for(const s of [-1,1]){const zc=s*.72;for(let i=0;i<8;i++){const a=i/8*Math.PI*2,b=(i+1)/8*Math.PI*2;g.quad([Math.cos(a)*.6,.6+Math.sin(a)*.6,zc],[Math.cos(b)*.6,.6+Math.sin(b)*.6,zc],[Math.cos(b)*.6,.6+Math.sin(b)*.6,zc+s*.08],[Math.cos(a)*.6,.6+Math.sin(a)*.6,zc+s*.08],AT.beam)}}g.box(1.8,0,1.6,.1,.75,.85,AT.beam,AT.beam);break}
    case'barrels':{g=new GB();for(const [x,z] of [[0,0],[.75,.1],[.35,.7]])g.prism(x,z,.33,.38,0,.95,10,AT.planks,1);break}
    case'crates':{g=new GB();g.box(0,0,.9,.9,0,.9,AT.planks,AT.planks,1);g.box(.95,.2,.7,.7,0,.7,AT.planks,AT.planks,1);g.box(.3,.1,.6,.6,.9,1.5,AT.planks,AT.planks,1);break}
    case'haybale':{g=new GB();for(const [x,z] of [[0,0],[1.3,.2]])g.prism(x,z,.6,.6,0,1.1,10,AT.thatch,1.2);break}
    case'lamp':{g=new GB();g.box(0,0,.12,.12,-.3,3,AT.iron,AT.iron);g.box(0,0,.4,.4,3,3.5,AT.win,AT.iron,1);g.cone(0,0,.32,3.5,.3,4,AT.iron);break}
    case'sign':{g=new GB();g.box(0,0,.14,.14,-.3,2.4,AT.beam,AT.beam);g.box(.6,0,1.1,.06,1.9,2.3,AT.planks,AT.planks,1);g.box(-.5,0,.9,.06,1.4,1.75,AT.planks,AT.planks,1);break}
    case'bench':{g=new GB();g.box(0,0,1.8,.45,.45,.52,AT.planks,AT.planks,1);for(const x of [-.75,.75])g.box(x,0,.1,.4,0,.45,AT.beam,AT.beam);break}
    case'woodpile':{g=new GB();for(let r=0;r<3;r++)for(let i=0;i<4-r;i++)g.obox(-.9,(i-(3-r)/2)*.32,.9,(i-(3-r)/2)*.32,.3,r*.28,r*.28+.3,AT.beam,1);break}
    case'statue':{g=new GB();g.box(0,0,1.2,1.2,-.3,1.1,AT.ashlar,AT.ashlar,1.2);g.box(0,0,.5,.4,1.1,2.6,AT.ashlar,AT.ashlar,1.2);g.prism(0,0,.22,.22,2.6,3.1,8,AT.ashlar,1);break}
    case'grave':{g=new GB();for(let i=0;i<3;i++)g.box((i-1)*1,0,.6,.15,-.2,.8,AT.ashlar,AT.ashlar,1);break}
    default:g=H({w:6,d:5,fl:1,pitch:1});
  }
  return TW.geos[k]=g.build();
}
function styleOf(b){const d=DEF_STYLE[b.t]||['plaster','tile'];return[b.wall&&b.wall!=='auto'?b.wall:d[0],b.roof&&b.roof!=='auto'?b.roof:d[1]]}
/* ---------------- placement on the land ---------------- */
const uv2w=(u,v)=>({x:(u-.5)*S.shape.world,z:(v-.5)*S.shape.world});
function groundAt(u,v,r){const W=S.shape.world,g=(N-1)/W;let lo=1e9;for(const [dx,dz] of [[0,0],[r,0],[-r,0],[0,r],[0,-r]])lo=Math.min(lo,hAt(clamp(u*(N-1)+dx*g,0,N-1),clamp(v*(N-1)+dz*g,0,N-1)));return Math.max(lo,seaLevel()+.2)}
function flattenFoot(b){const W=S.shape.world,g=(N-1)/W,r=(FOOT[b.t]||4)*(b.s||1)*1.15,cx=b.u*(N-1),cy=b.v*(N-1),R=r*g,h=groundAt(b.u,b.v,r*.6)+.15;
  const i0=Math.max(0,Math.floor(cx-R*1.8)),i1=Math.min(N-1,Math.ceil(cx+R*1.8)),j0=Math.max(0,Math.floor(cy-R*1.8)),j1=Math.min(N-1,Math.ceil(cy+R*1.8));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d=Math.hypot(i-cx,j-cy)/R,k=j*N+i;if(d>1.8)continue;const w=1-smooth(.8,1.8,d);H[k]=lerp(H[k],h,w*.9);SM[k]=Math.min(SM[k],smooth(1.1,1.8,d))}
  markRegion(i0,j0,i1,j1)}
function townMeshFor(key,need){let m=TW.meshes[key];if(m&&m.userData.cap>=need)return m;const cap=Math.max(16,Math.ceil(need*1.5));if(m){scene.remove(m);m.dispose()}const [t,w,r]=key.split('|');ensureAtlas();
  m=new THREE.InstancedMesh(townGeo(t,w,r),townMat,cap);m.userData.cap=cap;m.count=0;m.castShadow=!isProp(t);m.receiveShadow=true;m.frustumCulled=false;m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(cap*3),3);scene.add(m);return TW.meshes[key]=m}
const _tm=new THREE.Matrix4(),_tq=new THREE.Quaternion(),_te=new THREE.Euler(),_tp=new THREE.Vector3(),_ts=new THREE.Vector3(),_tc=new THREE.Color();
function townSync(){
  const T=S.town;if(!T)return;const groups={};
  for(let i=0;i<T.b.length;i++){const b=T.b[i];if(b.t==='castle'||b.t==='fort')continue;const [w,r]=styleOf(b);const k=b.t+'|'+w+'|'+r;(groups[k]=groups[k]||[]).push(i)}
  for(const k in TW.meshes)if(!groups[k])TW.meshes[k].count=0;
  const vex=S.view.vex;
  for(const k in groups){const ids=groups[k],m=townMeshFor(k,ids.length);ids.forEach((i,n)=>{const b=T.b[i],{x,z}=uv2w(b.u,b.v),s=b.s||1;
      _tq.setFromEuler(_te.set(0,b.r||0,0));_tp.set(x,groundAt(b.u,b.v,(FOOT[b.t]||3)*s*.5)*vex,z);_ts.set(s,s,s);_tm.compose(_tp,_tq,_ts);m.setMatrixAt(n,_tm);
      const tint=b.tint||1;m.setColorAt(n,_tc.setRGB(tint,tint,tint));});m.count=ids.length;m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true}
  if(TW.dirtyWalls)buildWallMesh();townSelRing();dirty=true;shadowDirty();if(typeof renderTownStats==='function')renderTownStats()}
/* ---------------- walls, palisades, gates, bridges (one merged mesh) ---------------- */
let wallMesh=null;
function segHit(a,b,c,d){const r=(b.x-a.x)*(d.z-c.z)-(b.z-a.z)*(d.x-c.x);if(Math.abs(r)<1e-9)return null;const t=((c.x-a.x)*(d.z-c.z)-(c.z-a.z)*(d.x-c.x))/r,s=((c.x-a.x)*(b.z-a.z)-(c.z-a.z)*(b.x-a.x))/r;return t>=0&&t<=1&&s>=0&&s<=1?t:null}
function buildWallMesh(){TW.dirtyWalls=false;if(wallMesh){scene.remove(wallMesh);wallMesh.geometry.dispose();wallMesh=null}const T=S.town;if(!T||(!T.walls.length&&!T.roads.some(r=>r.bridges&&r.bridges.length)))return;ensureAtlas();
  const g=new GB(),W=S.shape.world,vex=S.view.vex,gh=(x,z)=>groundAt(x/W+.5,z/W+.5,1)*vex;
  const roadSegs=[];for(const r of T.roads)for(let i=0;i<r.pts.length-1;i++)roadSegs.push([uv2w(...r.pts[i]),uv2w(...r.pts[i+1])]);
  for(const wl of T.walls){const P=wl.pts.map(p=>uv2w(p[0],p[1]));if(wl.closed&&P.length>2)P.push(P[0]);const stone=wl.kind!=='palisade',hgt=stone?7:4.5,th=stone?2.2:.6;
    for(let s=0;s<P.length-1;s++){const a=P[s],b=P[s+1],L=Math.hypot(b.x-a.x,b.z-a.z);if(L<.5)continue;
      /* gates where roads cross */const cuts=[];for(const [c,d] of roadSegs){const t=segHit(a,b,c,d);if(t!=null)cuts.push(t)}
      const step=stone?6:3,n=Math.max(1,Math.ceil(L/step));
      for(let i=0;i<n;i++){const t0=i/n,t1=(i+1)/n,tm=(t0+t1)/2;if(cuts.some(c=>Math.abs(c-tm)*L<4.5))continue;const x0=lerp(a.x,b.x,t0),z0=lerp(a.z,b.z,t0),x1=lerp(a.x,b.x,t1),z1=lerp(a.z,b.z,t1),y=Math.min(gh(x0,z0),gh(x1,z1));
        if(stone){g.obox(x0,z0,x1,z1,th,y-2,y+hgt,AT.stone,3);g.merlons(x0,z0,x1,z1,y+hgt,th*.45,.9)}
        else{const k=Math.max(1,Math.round(L/n/.5));for(let q=0;q<k;q++){const tt=lerp(t0,t1,(q+.5)/k),px=lerp(a.x,b.x,tt),pz=lerp(a.z,b.z,tt),py=gh(px,pz);g.prism(px,pz,.26,.26,py-1,py+hgt,5,AT.beam,2);g.cone(px,pz,.26,py+hgt,.6,5,AT.beam)}}}
      for(const c of cuts){const cx=lerp(a.x,b.x,c),cz=lerp(a.z,b.z,c),y=gh(cx,cz),ang=Math.atan2(b.z-a.z,b.x-a.x);g.mergeGeo(townGeo('gatehouse',stone?'stone':'wood','slate'),cx,y,cz,ang)}
      if(stone)for(const p of [a,b]){const y=gh(p.x,p.z);g.prism(p.x,p.z,3.4,3.1,y-2,y+hgt+3,10,AT.stone,3);g.prism(p.x,p.z,3.5,3.5,y+hgt+3,y+hgt+4,10,AT.stone,2);g.cone(p.x,p.z,3.8,y+hgt+4,3.6,10,AT.slate)}}}
  /* bridges recorded by roads that cross water */
  for(const r of T.roads)for(const br of (r.bridges||[])){const a=uv2w(...br[0]),b=uv2w(...br[1]),y=Math.max(gh(a.x,a.z),gh(b.x,b.z),(seaLevel()+2.5)*vex),L=Math.hypot(b.x-a.x,b.z-a.z),wd=(r.w||5)+1;
    g.obox(a.x,a.z,b.x,b.z,wd,y-.5,y,r.kind==='dirt'||r.kind==='gravel'?AT.planks:AT.ashlar,3);
    const dx=(b.x-a.x)/L,dz=(b.z-a.z)/L,nx=-dz*wd/2,nz=dx*wd/2;g.obox(a.x+nx,a.z+nz,b.x+nx,b.z+nz,.3,y,y+1,AT.ashlar,2);g.obox(a.x-nx,a.z-nz,b.x-nx,b.z-nz,.3,y,y+1,AT.ashlar,2);
    for(let t=8;t<L-4;t+=10){const px=a.x+dx*t,pz=a.z+dz*t;g.obox(px-nx*.8,pz-nz*.8,px+nx*.8,pz+nz*.8,1.4,seaLevel()*vex-8,y-.5,AT.stone,3)}}
  wallMesh=new THREE.Mesh(g.build(),townMat);wallMesh.castShadow=wallMesh.receiveShadow=true;scene.add(wallMesh)}
GB.prototype.mergeGeo=function(src,cx,cy,cz,ang){const p=src.attributes.position,n=src.attributes.normal,uv=src.attributes.uv,col=src.attributes.color,c=Math.cos(ang),s=Math.sin(ang);
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);this.p.push(cx+x*c-z*s,cy+p.getY(i),cz+x*s+z*c);const nx=n.getX(i),nz=n.getZ(i);this.n.push(nx*c-nz*s,n.getY(i),nx*s+nz*c);this.uv.push(uv.getX(i),uv.getY(i));this.c.push(col.getX(i),col.getY(i),col.getZ(i))}};
/* ---------------- roads ---------------- */
const ROAD_KIND={dirt:['Dirt path','dirt',3],gravel:['Gravel road','gravel',4],cobble:['Cobblestone','cobblestone',5],paved:['Paved','stone',6]};
function chaikin(P,it){for(let k=0;k<it;k++){const o=[P[0]];for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1];o.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}o.push(P[P.length-1]);P=o}return P}
function addRoad(pts,kind,width){if(pts.length<2)return;const K=ROAD_KIND[kind]||ROAD_KIND.dirt,w=width||K[2],sea=seaLevel(),r={pts,kind,w,bridges:[]};
  /* split into dry runs (graded + paved into the land) and wet runs (bridges) */
  let run=[],wet=null;const dense=[];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*S.shape.world/4));for(let t=0;t<n;t++)dense.push([lerp(a[0],b[0],t/n),lerp(a[1],b[1],t/n)])}dense.push(pts[pts.length-1]);
  const isWet=p=>hAt(p[0]*(N-1),p[1]*(N-1))<sea+.4;
  for(const p of dense){if(isWet(p)){if(run.length>1)buildRoad(run.map(q=>({u:q[0],v:q[1]})),w,K[1]);if(!wet)wet=[run.length?run[run.length-1]:p];run=[]}else{if(wet){wet.push(p);r.bridges.push([wet[0],p]);wet=null}run.push(p)}}
  if(run.length>1)buildRoad(run.map(q=>({u:q[0],v:q[1]})),w,K[1]);S.town.roads.push(r);TW.dirtyWalls=true}
function nearestRoad(u,v){let best=null,bd=1e9;for(const r of S.town.roads)for(let i=0;i<r.pts.length-1;i++){const a=r.pts[i],b=r.pts[i+1],dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1e-9,t=clamp(((u-a[0])*dx+(v-a[1])*dy)/L2,0,1),px=a[0]+dx*t,py=a[1]+dy*t,d=Math.hypot(u-px,v-py);if(d<bd){bd=d;best={d:d*S.shape.world,px,py,ang:Math.atan2(dy,dx),r}}}return best}
/* ---------------- add / edit buildings ---------------- */
function townAdd(t,u,v,rot,opt){const b={t,u,v,r:rot||0,s:1,wall:TW.wall,roof:TW.roof,...opt};if(t==='castle'||t==='fort')return addCompound(t,u,v,rot,b);S.town.b.push(b);if(!isProp(t))flattenFoot(b);return S.town.b.length-1}
function addCompound(t,u,v,rot,b0){const W=S.shape.world,c=Math.cos(rot||0),s=Math.sin(rot||0),P=(x,z)=>[u+(x*c+z*s)/W,v+(-x*s+z*c)/W];
  if(t==='castle'){const R=28;S.town.b.push({t:'keep',u,v,r:rot,s:1,wall:b0.wall,roof:b0.roof});const ring=[P(-R,-R),P(R,-R),P(R,R),P(-R,R)];S.town.walls.push({pts:ring,kind:'stone',closed:true});
    S.town.b.push({t:'gatehouse',u:P(0,R)[0],v:P(0,R)[1],r:rot,s:1});S.town.b.push({t:'well',u:P(10,10)[0],v:P(10,10)[1],r:0,s:1});S.town.b.push({t:'stable',u:P(-14,-12)[0],v:P(-14,-12)[1],r:rot,s:1});
    const gh=groundAt(u,v,R);const g=(N-1)/W;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=(i/(N-1)-u)*W,z=(j/(N-1)-v)*W,d=Math.max(Math.abs(x*c-z*s),Math.abs(x*s+z*c));if(d<R+8){const k=j*N+i,w=1-smooth(R-2,R+8,d);H[k]=lerp(H[k],gh,w*.85)}}markRegion(0,0,N-1,N-1)}
  else{const R=20,ring=[P(-R,-R),P(R,-R),P(R,R),P(-R,R)];S.town.walls.push({pts:ring,kind:'palisade',closed:true});for(const [x,z] of [[-R,-R],[R,-R],[R,R],[-R,R]]){const p=P(x,z);S.town.b.push({t:'watchtower',u:p[0],v:p[1],r:rot,s:1,wall:'wood',roof:'shingle'})}
    S.town.b.push({t:'longhouse',u,v,r:rot,s:1});S.town.b.push({t:'smithy',u:P(-9,8)[0],v:P(-9,8)[1],r:rot,s:1});addRoad([P(0,R-6),P(0,R+18)],'dirt',4)}
  {const W2=S.shape.world,g=(N-1)/W2,cx=u*(N-1),cy=v*(N-1),RR=(t==='castle'?44:32)*g;for(let j=Math.max(0,Math.floor(cy-RR));j<=Math.min(N-1,Math.ceil(cy+RR));j++)for(let i=Math.max(0,Math.floor(cx-RR));i<=Math.min(N-1,Math.ceil(cx+RR));i++)if(Math.hypot(i-cx,j-cy)<RR)SM[j*N+i]=0}/* no trees in the courtyard */
  TW.dirtyWalls=true;return S.town.b.length-1}
function townPick(u,v){let best=-1,bd=1e9;S.town.b.forEach((b,i)=>{const d=Math.hypot(b.u-u,b.v-v)*S.shape.world,r=(FOOT[b.t]||3)*(b.s||1)*1.1;if(d<r&&d<bd){bd=d;best=i}});return best}
/* ---------------- settlement generator ---------------- */
const SIZES={hamlet:{n:9,r:110,main:2,side:1},village:{n:28,r:230,main:3,side:3},town:{n:80,r:420,main:4,side:6},city:{n:190,r:680,main:5,side:10}};
function bestSpot(rng){const sea=seaLevel();let best=null,bs=-1e9;for(let a=0;a<500;a++){const u=.12+rng()*.76,v=.12+rng()*.76,gx=u*(N-1),gy=v*(N-1),h=hAt(gx,gy);if(h<sea+3)continue;const sl=slopeDeg(gx,gy);
  let near=0;for(let q=0;q<10;q++){const aa=q/10*6.28,d=.06;const hh=hAt(clamp(gx+Math.cos(aa)*d*(N-1),0,N-1),clamp(gy+Math.sin(aa)*d*(N-1),0,N-1));if(hh<sea+.5)near=1}
  const sc=-sl*2-Math.abs(h/(stats.hi||1)-.25)*30+near*14+rng()*6;if(sc>bs){bs=sc;best={u,v}}}return best||{u:.5,v:.5}}
function growRoad(u,v,ang,len,rng){const W=S.shape.world,step=12,pts=[[u,v]];let a=ang;for(let d=0;d<len;d+=step){let bestA=a,bc=1e9;for(const da of [-.35,-.18,0,.18,.35]){const aa=a+da,nu=u+Math.cos(aa)*step/W,nv=v+Math.sin(aa)*step/W;if(nu<.03||nv<.03||nu>.97||nv>.97)continue;const s=slopeDeg(nu*(N-1),nv*(N-1))+Math.abs(da)*6+(hAt(nu*(N-1),nv*(N-1))<seaLevel()+.5?25:0);if(s<bc){bc=s;bestA=aa}}
    if(bc>=1e9)break;a=bestA+(rng()-.5)*.08;u+=Math.cos(a)*step/W;v+=Math.sin(a)*step/W;pts.push([u,v])}return pts.length>1?chaikin(pts,1):null}
function generateSettlement(o){
  pushUndo();o={...TW.gen,...o};const rng=mulberry32((S.seed*17+Date.now())>>>0),Z=SIZES[o.size]||SIZES.village,W=S.shape.world,col=o.era==='colonial';
  const c=o.center||bestSpot(rng),R=Z.r,rk=o.size==='hamlet'?'dirt':o.size==='village'?'gravel':'cobble';const startB=S.town.b.length;
  const occ=[];const free=(u,v,r)=>{for(const q of occ)if(Math.hypot(q[0]-u,q[1]-v)*W<q[2]+r)return false;return true};
  const tryB=(t,u,v,rot,o2)=>{const r=(FOOT[t]||4)*1.05;if(u<.02||v<.02||u>.98||v>.98)return false;const gx=u*(N-1),gy=v*(N-1);if(hAt(gx,gy)<seaLevel()+1.2||slopeDeg(gx,gy)>(isProp(t)?24:16))return false;if(!free(u,v,r))return false;
    const rd=nearestRoad(u,v);if(rd&&rd.d<r*.75+(rd.r.w||5)/2)return false;occ.push([u,v,r]);townAdd(t,u,v,rot,{wall:'auto',roof:'auto',...o2});return true};
  /* plaza */const plaza=col?['townhall','church','markethall']:['church','tavern','markethall','well'];
  /* streets: main roads radiate and follow gentle ground; side streets branch off */
  const roads=[];const mainA=rng()*6.28;
  if(o.layout==='grid'){const sp=o.size==='city'?52:46,ang=mainA,cs=Math.cos(ang),sn=Math.sin(ang),n=Math.ceil(R/sp);for(let i=-n;i<=n;i++){for(const dir of [0,1]){const p=[];for(let t=-n;t<=n;t++){const a=dir?i:t,b=dir?t:i,x=a*sp,z=b*sp;if(Math.hypot(x,z)>R*1.05)continue;p.push([c.u+(x*cs-z*sn)/W,c.v+(x*sn+z*cs)/W])}if(p.length>1)roads.push(p)}}}
  else{for(let i=0;i<Z.main;i++){const a=mainA+i/Z.main*6.28+(rng()-.5)*.4,p=growRoad(c.u,c.v,a,R*1.25,rng);if(p)roads.push(p)}
    const mains=roads.slice();for(let i=0;i<Z.side;i++){const m=mains[(rng()*mains.length)|0];if(!m)break;const k=2+((rng()*(m.length-3))|0);if(!m[k]||!m[k+1])continue;const a=Math.atan2(m[k+1][1]-m[k][1],m[k+1][0]-m[k][0])+(rng()<.5?1:-1)*(1.2+rng()*.6),p=growRoad(m[k][0],m[k][1],a,R*(.35+rng()*.45),rng);if(p)roads.push(p)}}
  for(const p of roads)addRoad(p,rk,ROAD_KIND[rk][2]);
  /* civic heart */plaza.forEach((t,i)=>{const a=mainA+.6+i*1.6,d=(t==='church'?26:20);for(let k=0;k<6;k++){const aa=a+k*.3;if(tryB(t,c.u+Math.cos(aa)*d/W,c.v+Math.sin(aa)*d/W,Math.atan2(-Math.cos(aa),-Math.sin(aa))))break}});
  if(!col)tryB('fountain',c.u,c.v,0);
  /* homes along streets, facing the road; denser and taller toward the centre */
  let placed=S.town.b.length-startB;const homes=col?['colonial','colonial','rowhouse','workshop','colonial']:o.size==='city'||o.size==='town'?['townhouse','timberhouse','townhouse','rowhouse','workshop','tavern']:['cottage','timberhouse','cottage','farmhouse','workshop'];
  for(let pass=0;pass<4&&placed<Z.n;pass++)for(const r of S.town.roads.slice(-roads.length)){for(let i=0;i<r.pts.length-1&&placed<Z.n;i++){const a=r.pts[i],b=r.pts[i+1],ang=Math.atan2(b[1]-a[1],b[0]-a[0]),L=Math.hypot(b[0]-a[0],b[1]-a[1])*W;
      for(let t=0;t<L&&placed<Z.n;t+=9+rng()*5){for(const side of [-1,1]){const pu=a[0]+(b[0]-a[0])*t/L,pv=a[1]+(b[1]-a[1])*t/L,dc=Math.hypot(pu-c.u,pv-c.v)*W;if(dc>R)continue;
        const inner=dc<R*.45,typ=dc>R*.75&&!col&&rng()<.45?(rng()<.5?'farmhouse':'barn'):inner&&(o.size==='town'||o.size==='city')?homes[(rng()*3)|0]:homes[(rng()*homes.length)|0];
        const off=((r.w||5)/2+(FOOT[typ]||4)*.85+1.5)/W,nu=pu+Math.cos(ang+side*Math.PI/2)*off,nv=pv+Math.sin(ang+side*Math.PI/2)*off;
        if(tryB(typ,nu,nv,side>0?Math.PI-ang:-ang,{}))placed++}}}}
  /* outskirts: farms, mill, props */
  if(o.farms){for(let i=0;i<Z.n*.15;i++){const a=rng()*6.28,d=R*(.85+rng()*.5);const u=c.u+Math.cos(a)*d/W,v=c.v+Math.sin(a)*d/W;if(tryB(rng()<.5?'barn':'farmhouse',u,v,Math.atan2(-Math.cos(a),-Math.sin(a))))paintField(u,v,a,rng);}
    for(let i=0;i<1+Z.n/60;i++){const a=rng()*6.28,d=R*(.7+rng()*.4);tryB('windmill',c.u+Math.cos(a)*d/W,c.v+Math.sin(a)*d/W,a)}}
  for(let i=0;i<Z.n*.5;i++){const b=S.town.b[startB+((rng()*(S.town.b.length-startB))|0)];if(!b||isProp(b.t))continue;const p=['barrels','crates','haybale','woodpile','fence','cart','lamp','bench'][(rng()*8)|0],a=b.r+rng()*6.28,d=(FOOT[b.t]||4)+2;tryB(p,b.u+Math.cos(a)*d/W,b.v+Math.sin(a)*d/W,b.r)}
  /* walls with towers; gates appear where streets cross */
  if(o.walls&&(o.size==='town'||o.size==='city'||o.size==='village')){const ring=[];const n=o.size==='city'?14:10;for(let i=0;i<n;i++){const a=i/n*6.28,rr=R*(1.02+(rng()-.5)*.12);ring.push([c.u+Math.cos(a)*rr/W,c.v+Math.sin(a)*rr/W])}S.town.walls.push({pts:ring,kind:o.size==='village'||col?'palisade':'stone',closed:true})}
  if(o.castle){let best=null,bh=-1;for(let a=0;a<60;a++){const aa=rng()*6.28,d=R*(.4+rng()*.9),u=c.u+Math.cos(aa)*d/W,v=c.v+Math.sin(aa)*d/W;if(u<.08||v<.08||u>.92||v>.92)continue;const h=hAt(u*(N-1),v*(N-1));if(h>bh&&slopeDeg(u*(N-1),v*(N-1))<22){bh=h;best={u,v,a:aa}}}
    if(best){addCompound('castle',best.u,best.v,Math.atan2(c.u-best.u,c.v-best.v),{});addRoad(growRoad(best.u,best.v,Math.atan2(c.v-best.v,c.u-best.u),Math.hypot(c.u-best.u,c.v-best.v)*W,rng)||[[best.u,best.v],[c.u,c.v]],'cobble',5)}}
  /* streets and yards stay open: thin the forest inside the settlement, keep gardens and a few trees */
  {const g=(N-1)/W,cx=c.u*(N-1),cy=c.v*(N-1),RR=R*1.05*g;for(let j=Math.max(0,Math.floor(cy-RR));j<=Math.min(N-1,Math.ceil(cy+RR));j++)for(let i=Math.max(0,Math.floor(cx-RR));i<=Math.min(N-1,Math.ceil(cx+RR));i++){const d=Math.hypot(i-cx,j-cy)/RR;if(d<1)SM[j*N+i]=Math.min(SM[j*N+i],.08+.5*smooth(.7,1,d))}}
  S.scatter.on=true;TW.dirtyWalls=true;afterTownEdit(true);return{u:c.u,v:c.v,count:S.town.b.length-startB}}
function paintField(u,v,a,rng){const W=S.shape.world,g=(N-1)/W,L=40+rng()*40,D=30+rng()*30,cs=Math.cos(a),sn=Math.sin(a),cx=u*(N-1),cy=v*(N-1),R=Math.hypot(L,D)*g,cols=[[176,150,70],[120,140,60],[150,118,72]],cc=cols[(rng()*3)|0];
  for(let j=Math.max(0,Math.floor(cy-R));j<=Math.min(N-1,Math.ceil(cy+R));j++)for(let i=Math.max(0,Math.floor(cx-R));i<=Math.min(N-1,Math.ceil(cx+R));i++){const x=(i-cx)/g,z=(j-cy)/g,lx=x*cs+z*sn,lz=-x*sn+z*cs;if(Math.abs(lx)>L/2+8||Math.abs(lz)>D/2+8)continue;const k=j*N+i,stripe=(Math.floor(lz/3)%2)?1:.9;
    PC[k*3]=cc[0]*stripe;PC[k*3+1]=cc[1]*stripe;PC[k*3+2]=cc[2]*stripe;PW[k]=Math.max(PW[k],.55*(1-smooth(L/2,L/2+8,Math.abs(lx)))*(1-smooth(D/2,D/2+8,Math.abs(lz))));SM[k]=Math.min(SM[k],.15)}
  markRegion(Math.floor(cx-R),Math.floor(cy-R),Math.ceil(cx+R),Math.ceil(cy+R))}
function afterTownEdit(full){flushRegion();computeStats();updateWater();fluidSync();townSync();if(full)scatterSoon(60);else scatterReseat();saveSoon();if(S.tab==='town')renderSheet()}
/* ---------------- pointer tools ---------------- */
const townLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffc94a,depthTest:false,transparent:true,opacity:.95}));townLine.renderOrder=11;townLine.frustumCulled=false;scene.add(townLine);
const selRing=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffd27a,depthTest:false,transparent:true}));selRing.renderOrder=11;selRing.frustumCulled=false;scene.add(selRing);
function drawLine(pts){const W=S.shape.world,vex=S.view.vex,a=new Float32Array(pts.length*3);pts.forEach((p,i)=>{a[i*3]=(p[0]-.5)*W;a[i*3+1]=hAt(p[0]*(N-1),p[1]*(N-1))*vex+3;a[i*3+2]=(p[1]-.5)*W});townLine.geometry.setAttribute('position',new THREE.BufferAttribute(a,3));townLine.geometry.setDrawRange(0,pts.length);townLine.visible=pts.length>1;dirty=true}
function townSelRing(){const b=S.town&&S.town.b[TW.sel];if(!b||S.tab!=='town'){selRing.visible=false;return}const W=S.shape.world,r=(FOOT[b.t]||3)*(b.s||1)*1.2,a=new Float32Array(49*3),y=groundAt(b.u,b.v,r*.5)*S.view.vex+.6,{x,z}=uv2w(b.u,b.v);
  for(let i=0;i<=48;i++){const t=i/48*Math.PI*2;a[i*3]=x+Math.cos(t)*r;a[i*3+1]=y;a[i*3+2]=z+Math.sin(t)*r}selRing.geometry.setAttribute('position',new THREE.BufferAttribute(a,3));selRing.visible=true;dirty=true}
function townActive(){return S.tab==='town'&&TW.tool!=='view'&&!FP.on}
function townPointerDown(e){if(!townActive()||ptrs.size>1||(e.pointerType==='mouse'&&e.button!==0))return false;const p=pick(e.clientX,e.clientY);if(!p)return false;const u=p.gx/(N-1),v=p.gy/(N-1);
  if(TW.tool==='road'||TW.tool==='wall'){TW.g={kind:TW.tool,pts:[[u,v]],x0:e.clientX,y0:e.clientY};drawLine(TW.g.pts);haptic(6);return true}
  if(TW.pickGen){TW.pickGen=false;runGen({u,v});return true}
  if(TW.tool==='place'){pushUndo();let rot=cam.theta;const rd=nearestRoad(u,v);if(rd&&rd.d<30&&rd.d>1)rot=Math.atan2(rd.px-u,rd.py-v);
    const i=townAdd(TW.item,u,v,rot);TW.sel=i;TW.g={kind:'rot',i,u,v,x0:e.clientX,y0:e.clientY};flushRegion();townSync();sfx('thud');haptic(12);emitDust(p,16,[.55,.5,.42]);return true}
  if(TW.tool==='select'||TW.tool==='erase'){const i=townPick(u,v);if(TW.tool==='erase'){if(i>=0){pushUndo();S.town.b.splice(i,1);TW.sel=-1;afterTownEdit();sfx('close');haptic(10);return true}
      /* erase a wall or road near the touch */let hit=-1;S.town.walls.forEach((w,wi)=>{for(const q of w.pts)if(Math.hypot(q[0]-u,q[1]-v)*S.shape.world<25)hit=wi});if(hit>=0){pushUndo();S.town.walls.splice(hit,1);TW.dirtyWalls=true;afterTownEdit();sfx('close');return true}return false}
    if(i>=0){TW.sel=i;TW.g={kind:'move',i,du:S.town.b[i].u-u,dv:S.town.b[i].v-v,moved:false};townSelRing();renderSheet();sfx('pop');haptic(8);return true}TW.sel=-1;townSelRing();renderSheet();return false}
  return false}
function townPointerMove(e){const g=TW.g;if(!g)return;const p=pick(e.clientX,e.clientY);if(!p)return;const u=p.gx/(N-1),v=p.gy/(N-1);
  if(g.kind==='road'||g.kind==='wall'){const l=g.pts[g.pts.length-1];if(Math.hypot(l[0]-u,l[1]-v)*S.shape.world>6){g.pts.push([u,v]);drawLine(g.pts);tickAt(Math.min(1,g.pts.length/60))}}
  else if(g.kind==='rot'){if(Math.hypot(e.clientX-g.x0,e.clientY-g.y0)>14){const b=S.town.b[g.i];b.r=Math.atan2(u-g.u,v-g.v);townSync()}}
  else if(g.kind==='move'){if(!g.moved){pushUndo();g.moved=true}const b=S.town.b[g.i];b.u=u+g.du;b.v=v+g.dv;townSync()}}
function townPointerUp(){const g=TW.g;TW.g=null;if(!g)return;townLine.visible=false;
  if(g.kind==='road'&&g.pts.length>1){pushUndo();addRoad(chaikin(g.pts,2),TW.rk,TW.rw);afterTownEdit(true);toast(ROAD_KIND[TW.rk][0]+' added','ok');sfx('chime')}
  else if(g.kind==='wall'&&g.pts.length>1){pushUndo();const P=g.pts,closed=Math.hypot(P[0][0]-P[P.length-1][0],P[0][1]-P[P.length-1][1])*S.shape.world<40;S.town.walls.push({pts:chaikin(P,1).filter((q,i)=>i%3===0),kind:TW.wk,closed});TW.dirtyWalls=true;afterTownEdit();toast((TW.wk==='stone'?'Stone wall':'Palisade')+(closed?' ring':'')+' built','ok');sfx('chime')}
  else if(g.kind==='rot'||g.kind==='move'){const b=S.town.b[g.i];if(b&&!isProp(b.t)&&(g.kind==='rot'||g.moved))flattenFoot(b);afterTownEdit();if(S.tab==='town')renderSheet()}}
/* ---------------- panel ---------------- */
const TOWN_TOOLS=[['place','Place','<path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'],['road','Road','<path d="M8 3 5 21M16 3l3 18M12 4v3M12 11v3M12 18v2"/>'],['wall','Wall','<path d="M3 20h18M3 20V9h3V6h3v3h6V6h3v3h3v11"/>'],['select','Select','<path d="M5 3l14 8-6 2-2 6z"/>'],['erase','Erase','<path d="M7 21h10M5 15l9-9 5 5-9 9H7z"/>']];
let thumbR=null;
function townThumb(t){if(TW.thumbs[t])return TW.thumbs[t];try{ensureAtlas();if(!thumbR){thumbR={r:new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}),s:new THREE.Scene(),c:new THREE.PerspectiveCamera(30,1,.1,500)};thumbR.r.setSize(96,96);thumbR.r.outputEncoding=THREE.sRGBEncoding;thumbR.r.toneMapping=THREE.ACESFilmicToneMapping;
      thumbR.s.add(new THREE.HemisphereLight(0xeef4ff,0x6b5a44,.9));const d=new THREE.DirectionalLight(0xfff1dc,1.5);d.position.set(4,8,6);thumbR.s.add(d)}
    const [w,r]=styleOf({t,wall:TW.wall,roof:TW.roof}),geo=t==='castle'?townGeo('keep','stone','slate'):t==='fort'?townGeo('watchtower','wood','shingle'):townGeo(t,w,r),m=new THREE.Mesh(geo,townMat);thumbR.s.add(m);geo.computeBoundingSphere();const bs=geo.boundingSphere,R=bs.radius*1.05;
    thumbR.c.position.set(bs.center.x+R*2.6,bs.center.y+R*1.7,bs.center.z+R*3.2);thumbR.c.lookAt(bs.center);thumbR.r.render(thumbR.s,thumbR.c);TW.thumbs[t]=thumbR.r.domElement.toDataURL();thumbR.s.remove(m)}catch(e){TW.thumbs[t]=''}return TW.thumbs[t]}
function townHead(){return`<h2>Towns</h2><span class="grow"></span><button class="dd anodized press" id="twGen">${svg('<path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z"/>',1.8)}<span>Generate</span></button>`}
function townPanelHTML(){const t=TW.tool,b=S.town.b[TW.sel];let h=`<div class="tools tw-tools">${TOWN_TOOLS.map(([k,l,p])=>`<button class="tool press${t===k?' anodized':''}" data-twt="${k}" aria-pressed="${t===k}">${svg(p)}${l}</button>`).join('')}</div>`;
  if(t==='place'){h+=`<div class="chips">${Object.keys(TOWN_CAT).map(c=>`<button class="chipb press" data-twc="${c}" aria-pressed="${TW.cat===c}">${c}</button>`).join('')}</div>
    <div class="twgrid">${Object.entries(TOWN_CAT[TW.cat]).map(([k,n])=>`<button class="twcard press" data-twi="${k}" aria-pressed="${TW.item===k}"><img alt="" src="${townThumb(k)}"><span>${n}</span></button>`).join('')}</div>
    <p class="hint">Tap the land to place. Keep your finger down and drag to turn it. Buildings near a road face it.</p>${styleChips()}`}
  else if(t==='road')h+=`<div class="chips">${Object.entries(ROAD_KIND).map(([k,v])=>`<button class="chipb press" data-twr="${k}" aria-pressed="${TW.rk===k}">${v[0]}</button>`).join('')}</div>${sliderRow('tw.rw','Width',2,14,.5,TW.rw,5,v=>v+' m')}<p class="hint">Draw with one finger. Roads are graded into the land; over water they become bridges.</p>`;
  else if(t==='wall')h+=`<div class="chips"><button class="chipb press" data-tww="stone" aria-pressed="${TW.wk==='stone'}">Stone wall</button><button class="chipb press" data-tww="palisade" aria-pressed="${TW.wk==='palisade'}">Palisade</button></div><p class="hint">Draw the line of the wall. End near where you started to close a ring. Towers go on the corners and a gate opens wherever a road crosses.</p>`;
  else if(t==='select'){if(b){h+=`<div class="twsel"><img alt="" src="${townThumb(b.t)}"><div><b>${TOWN_NAME[b.t]||b.t}</b><small>Drag it on the map to move it.</small></div></div>
      ${sliderRow('tw.rot','Rotate',0,359,1,Math.round(((b.r||0)*180/Math.PI%360+360)%360),0,v=>v+'°')}${sliderRow('tw.scale','Size',.6,1.8,.05,b.s||1,1,v=>(+v).toFixed(2)+'×')}${styleChips(b)}
      <div class="btns">${UPGRADE[b.t]?`<button class="btn anodized press" id="twUp">Upgrade to ${TOWN_NAME[UPGRADE[b.t]]}</button>`:''}<button class="btn plain press" id="twDup">Duplicate</button><button class="btn plain press" id="twDel" style="color:var(--bad)">Remove</button></div>`}
    else h+=`<p class="hint">Tap a building to select it.</p>`}
  else if(t==='erase')h+=`<p class="hint">Tap a building, wall or prop to remove it. Undo brings it back.</p>`;
  const G=TW.gen;h+=acc('Generate a settlement',`${seg('tw.size',[['hamlet','Hamlet'],['village','Village'],['town','Town'],['city','City']])}<div style="height:8px"></div>${seg('tw.era',[['medieval','Medieval'],['colonial','Colonial']])}<div style="height:8px"></div>${seg('tw.layout',[['organic','Organic streets'],['grid','Grid']])}
    ${tg('tw.walls','Town walls','Stone for towns and cities, palisade for villages')}${tg('tw.castle','Castle on the high ground')}${tg('tw.farms','Farms, fields and mills')}
    <div class="btns"><button class="btn anodized press" id="twGo">Build at the best spot</button><button class="btn plain press" id="twHere">Tap to choose…</button></div>${prompt_('townPrompt','Describe a town… e.g. a walled harbour town')}`,false);
  h+=`<div class="facts" id="twStats"></div><div class="btns"><button class="btn plain press" id="twClear">Clear town</button></div>`;return h}
function styleChips(b){const w=b?(b.wall||'auto'):TW.wall,r=b?(b.roof||'auto'):TW.roof;return`<div class="label">Walls</div><div class="chips"><button class="chipb press" data-tws="auto" aria-pressed="${w==='auto'}">Auto</button>${Object.entries(WALLS).map(([k,v])=>`<button class="chipb press" data-tws="${k}" aria-pressed="${w===k}">${v[0]}</button>`).join('')}</div>
  <div class="label">Roof</div><div class="chips"><button class="chipb press" data-twf="auto" aria-pressed="${r==='auto'}">Auto</button>${Object.entries(ROOFS).map(([k,v])=>`<button class="chipb press" data-twf="${k}" aria-pressed="${r===k}">${v[0]}</button>`).join('')}</div>`}
function renderTownStats(){const el=$('#twStats');if(!el||!S.town)return;const T=S.town,bld=T.b.filter(b=>!isProp(b.t)).length,km=T.roads.reduce((a,r)=>{let L=0;for(let i=0;i<r.pts.length-1;i++)L+=Math.hypot(r.pts[i+1][0]-r.pts[i][0],r.pts[i+1][1]-r.pts[i][1]);return a+L*S.shape.world},0);
  el.innerHTML=`<span>Buildings</span><span>${bld}</span><span>Props</span><span>${T.b.length-bld}</span><span>Roads</span><span>${fmtLen(km)}</span><span>Walls</span><span>${T.walls.length}</span>`}
function townBind(b){const sel=()=>S.town.b[TW.sel];
  $$('[data-twt]',b).forEach(x=>x.onclick=()=>{TW.tool=x.dataset.twt;if(TW.tool!=='select')TW.sel=-1;townSelRing();renderSheet()});
  $$('[data-twc]',b).forEach(x=>x.onclick=()=>{TW.cat=x.dataset.twc;renderSheet()});
  $$('[data-twi]',b).forEach(x=>x.onclick=()=>{TW.item=x.dataset.twi;$$('[data-twi]',b).forEach(y=>y.setAttribute('aria-pressed',y===x));haptic(6)});
  $$('[data-twr]',b).forEach(x=>x.onclick=()=>{TW.rk=x.dataset.twr;TW.rw=ROAD_KIND[TW.rk][2];renderSheet()});
  $$('[data-tww]',b).forEach(x=>x.onclick=()=>{TW.wk=x.dataset.tww;renderSheet()});
  $$('[data-tws]',b).forEach(x=>x.onclick=()=>{const v=x.dataset.tws;if(sel()&&TW.tool==='select'){pushUndo();sel().wall=v;townSync()}else{TW.wall=v;TW.thumbs={}}renderSheet()});
  $$('[data-twf]',b).forEach(x=>x.onclick=()=>{const v=x.dataset.twf;if(sel()&&TW.tool==='select'){pushUndo();sel().roof=v;townSync()}else{TW.roof=v;TW.thumbs={}}renderSheet()});
  const on=(id,f)=>{const el=$('#'+id,b);if(el)el.onclick=f};
  on('twUp',()=>{const s=sel();if(!s)return;pushUndo();s.t=UPGRADE[s.t];flattenFoot(s);afterTownEdit();sfx('chime');toast('Upgraded to '+TOWN_NAME[s.t],'ok')});
  on('twDup',()=>{const s=sel();if(!s)return;pushUndo();const d=(FOOT[s.t]||4)*2.4/S.shape.world;TW.sel=townAdd(s.t,s.u+Math.cos(-s.r)*d,s.v+Math.sin(-s.r)*d,s.r,{wall:s.wall,roof:s.roof,s:s.s});afterTownEdit()});
  on('twDel',()=>{pushUndo();S.town.b.splice(TW.sel,1);TW.sel=-1;afterTownEdit()});
  on('twClear',e=>openMenu(e.currentTarget,[{v:1,label:'Remove all buildings, walls and roads records',sub:'Painted roads stay on the land; Undo restores everything'},{v:0,label:'Cancel'}],y=>{if(!y)return;pushUndo();S.town=TOWN_DEF();TW.sel=-1;TW.dirtyWalls=true;afterTownEdit(true)}));
  on('twGo',()=>runGen());on('twHere',()=>{TW.pickGen=true;toast('Tap the land where the settlement should be')});
  renderTownStats()}
function townSliderChange(k,v,commit){const s=S.town.b[TW.sel];if(k==='tw.rw')TW.rw=v;else if(k==='tw.rot'&&s){s.r=v*Math.PI/180;townSync()}else if(k==='tw.scale'&&s){s.s=v;townSync()}if(commit&&s)saveSoon()}
function runGen(center){const J=job('Building a '+TW.gen.size,['Finding a good spot','Laying out streets','Raising buildings','Walls, farms and props'],{window:false});
  setTimeout(()=>{try{J.step(1);const r=generateSettlement(center?{center}:{});J.done(r.count+' buildings placed');focusAt({x:(r.u-.5)*S.shape.world,z:(r.v-.5)*S.shape.world,gx:r.u*(N-1),gy:r.v*(N-1)});sfx('chime');celebrate&&celebrate()}catch(e){J.fail(e.message)}},30)}
/* getK/setK fallbacks for tw.* keys used by the shared slider/seg/toggle components */
function twGetK(k){const f=k.split('.')[1],b=S.town&&S.town.b[TW.sel];if(f==='rw')return TW.rw;if(f==='rot')return b?Math.round((((b.r||0)*180/Math.PI)%360+360)%360):0;if(f==='scale')return b?b.s||1:1;return TW.gen[f]}
/* ---------------- AI: plan or describe a settlement ---------------- */
AI_TOOLS.push({name:'build_town',description:'Builds a settlement on the terrain: procedural streets that follow the land, buildings facing the streets, optional walls, castle and farms. Medieval to colonial only. center_u/center_v are 0-1 (omit to pick the best flat spot near water). Optionally list specific buildings to add (types: '+Object.keys(TOWN_NAME).join(', ')+').',
  inputSchema:{type:'object',properties:{size:{type:'string',enum:['hamlet','village','town','city']},era:{type:'string',enum:['medieval','colonial']},layout:{type:'string',enum:['organic','grid']},walls:{type:'boolean'},castle:{type:'boolean'},farms:{type:'boolean'},center_u:{type:'number'},center_v:{type:'number'},
    buildings:{type:'array',items:{type:'object',properties:{type:{type:'string'},u:{type:'number'},v:{type:'number'},rotation_deg:{type:'number'},walls:{type:'string',enum:Object.keys(WALLS)},roof:{type:'string',enum:Object.keys(ROOFS)}}}}}},
  execute:i=>{const o={};for(const k of ['size','era','layout','walls','castle','farms'])if(i[k]!=null)o[k]=i[k];if(i.center_u!=null&&i.center_v!=null)o.center={u:clamp(+i.center_u,.05,.95),v:clamp(+i.center_v,.05,.95)};
    const r=(i.size||i.center_u!=null||!(i.buildings&&i.buildings.length))?generateSettlement(o):{count:0};let n=0;for(const b of (i.buildings||[]).slice(0,80))if(TOWN_NAME[b.type]&&b.u!=null){townAdd(b.type,clamp(+b.u,.02,.98),clamp(+b.v,.02,.98),(+b.rotation_deg||0)*Math.PI/180,{wall:b.walls||'auto',roof:b.roof||'auto'});n++}
    afterTownEdit(true);switchTab('town');return`Placed ${r.count+n} buildings`}});
/* ---------------- photo: roofs seen from above become buildings ---------------- */
function roofsFromImage(){if(!REF.rgb||!REF.R)return 0;const R=REF.R,m=new Uint8Array(R*R),kind=new Uint8Array(R*R);
  for(let k=0;k<R*R;k++){const r=REF.rgb[k*3],g=REF.rgb[k*3+1],b=REF.rgb[k*3+2],[h,s,v]=rgb2hsv(r,g,b);if(s>.38&&(h<22||h>340)&&v>.3&&v<.9){m[k]=1;kind[k]=1}else if(s<.12&&v>.18&&v<.42){m[k]=1;kind[k]=2}else if(h>22&&h<45&&s>.2&&s<.5&&v>.35&&v<.7){m[k]=1;kind[k]=3}}
  const seen=new Uint8Array(R*R);let n=0;
  for(let s0=0;s0<R*R;s0++){if(!m[s0]||seen[s0])continue;const st=[s0],px=[];seen[s0]=1;while(st.length){const k=st.pop();px.push(k);const i=k%R,j=(k/R)|0;for(const q of [k-1,k+1,k-R,k+R]){if(q<0||q>=R*R||seen[q]||!m[q]||kind[q]!==kind[s0])continue;if(Math.abs(q%R-i)>1)continue;seen[q]=1;st.push(q)}}
    if(px.length<6||px.length>R*R*.02)continue;let mx=0,my=0;for(const k of px){mx+=k%R;my+=(k/R)|0}mx/=px.length;my/=px.length;let sxx=0,syy=0,sxy=0;for(const k of px){const dx=k%R-mx,dy=((k/R)|0)-my;sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy}
    const ang=.5*Math.atan2(2*sxy,sxx-syy);
    const areaM=px.length*(S.shape.world/R)**2,u=(mx+.5)/R,v=(my+.5)/R;if(areaM<25||areaM>3000)continue;
    const t=areaM>900?'warehouse':areaM>400?(kind[s0]===2?'church':'barn'):areaM>140?'timberhouse':'cottage',roof=kind[s0]===1?'tile':kind[s0]===2?'slate':'thatch';
    townAdd(t,u,v,Math.PI/2-ang,{wall:'auto',roof});n++;if(n>220)break}
  return n}

/* ---------------- export: buildings as instanced meshes with atlas colours baked into the vertices ---------------- */
let tileAvg=null;
function atlasTileColors(){if(tileAvg)return tileAvg;ensureAtlas();const c=townAtlas.image,x=c.getContext('2d'),T=c.width/4;tileAvg=[];for(let t=0;t<16;t++){const d=x.getImageData((t%4)*T,((t/4)|0)*T,T,T).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=64){r+=d[i];g+=d[i+1];b+=d[i+2];n++}tileAvg.push([toLin(r/n),toLin(g/n),toLin(b/n)])}return tileAvg}
function bakedParts(geo){const p=geo.attributes.position,uv=geo.attributes.uv,col=geo.attributes.color,n=p.count,TA=atlasTileColors(),c=new Float32Array(n*4),idx=new Uint32Array(n);
  for(let i=0;i<n;i++){const tx=Math.min(3,Math.floor(uv.getX(i)*4)),ty=Math.min(3,Math.floor((1-uv.getY(i))*4)),a=TA[ty*4+tx];c[i*4]=a[0]*col.getX(i);c[i*4+1]=a[1]*col.getY(i);c[i*4+2]=a[2]*col.getZ(i);c[i*4+3]=1;idx[i]=i}
  return{pos:p.array.slice(),nor:geo.attributes.normal.array.slice(),col,idx,colA:c}}
function townExportParts(){const out=[],q=new THREE.Quaternion(),pp=new THREE.Vector3(),sc=new THREE.Vector3(),m=new THREE.Matrix4();
  for(const k in TW.meshes){const mesh=TW.meshes[k];if(!mesh.count)continue;const b=bakedParts(mesh.geometry),inst=[];
    for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);m.decompose(pp,q,sc);inst.push({t:[+pp.x.toFixed(3),+pp.y.toFixed(3),+pp.z.toFixed(3)],r:[+q.x.toFixed(5),+q.y.toFixed(5),+q.z.toFixed(5),+q.w.toFixed(5)],s:[+sc.x.toFixed(3),+sc.y.toFixed(3),+sc.z.toFixed(3)]})}
    const nm=k.split('|');out.push({name:'Town_'+nm[0]+'_'+nm[1]+'_'+nm[2],pos:b.pos,nor:b.nor,col:b.colA,idx:b.idx,instances:inst,count:inst.length})}
  if(wallMesh){const b=bakedParts(wallMesh.geometry);out.push({name:'Town_walls_bridges',pos:b.pos,nor:b.nor,col:b.colA,idx:b.idx,instances:[{t:[0,0,0],r:[0,0,0,1],s:[1,1,1]}],count:1})}
  return out}
