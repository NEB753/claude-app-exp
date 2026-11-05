"use strict";
/* Strata export: engine-ready packages (Blender/Godot GLB with PBR maps, Unreal landscape kit, Unity terrain kit, 3D-print OBJ, custom).
   Terrain UVs are one seamless 0-1 square; normal maps are baked in tangent space from the full-resolution heights so decimated meshes keep their detail. */
const EXPORT_TARGETS={
  blender:{n:'Blender',d:'GLB with albedo, normal and AO/roughness maps, plus scatter',o:{fmt:'glb',pbr:true,atlas:true,scatter:true,base:true,masks:false}},
  unreal:{n:'Unreal Engine 5',d:'Landscape heightmap, layer weightmaps, foliage CSV and asset meshes',o:{fmt:'unreal',pbr:true,atlas:true,scatter:true,masks:false}},
  unity:{n:'Unity',d:'RAW 16-bit heightmap, splat layers and tree positions',o:{fmt:'unity',pbr:true,atlas:true,scatter:true,masks:false}},
  godot:{n:'Godot',d:'GLB with PBR maps and scatter, tiles for streaming',o:{fmt:'glb',pbr:true,atlas:true,scatter:true,base:false,masks:false}},
  print:{n:'3D print',d:'Watertight OBJ with a solid base',o:{fmt:'obj',pbr:false,scatter:false,base:true,masks:false,tiles:1}},
  custom:{n:'Custom',d:'Choose every option yourself',o:{}}
};
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8,c=0xFFFFFFFF){for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);return c}
const enc=new TextEncoder();
function zip(files){
  const parts=[],cen=[];let off=0;const d=new Date(),dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1)),dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate());
  for(const f of files){
    const name=enc.encode(f.name),data=f.data instanceof Uint8Array?f.data:enc.encode(f.data),crc=(crc32(data)^0xFFFFFFFF)>>>0;
    const lh=new DataView(new ArrayBuffer(30));lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(10,dt,true);lh.setUint16(12,dd,true);lh.setUint32(14,crc,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,name.length,true);
    parts.push(new Uint8Array(lh.buffer),name,data);
    const ch=new DataView(new ArrayBuffer(46));ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(12,dt,true);ch.setUint16(14,dd,true);ch.setUint32(16,crc,true);ch.setUint32(20,data.length,true);ch.setUint32(24,data.length,true);ch.setUint16(28,name.length,true);ch.setUint32(42,off,true);
    cen.push(new Uint8Array(ch.buffer),name);off+=30+name.length+data.length;
  }
  const cs=cen.reduce((a,b)=>a+b.length,0),end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cs,true);end.setUint32(16,off,true);
  return new Blob([...parts,...cen,new Uint8Array(end.buffer)],{type:'application/zip'});
}
async function deflate(u8){
  if(window.CompressionStream){try{const s=new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'));return new Uint8Array(await new Response(s).arrayBuffer())}catch(e){}}
  const n=Math.ceil(u8.length/65535)||1,out=new Uint8Array(2+u8.length+n*5+4);out[0]=0x78;out[1]=1;let o=2;
  for(let b=0;b<n;b++){const s=b*65535,l=Math.min(65535,u8.length-s);out[o++]=b===n-1?1:0;out[o++]=l&255;out[o++]=l>>8;out[o++]=~l&255;out[o++]=(~l>>8)&255;out.set(u8.subarray(s,s+l),o);o+=l}
  let a=1,b2=0;for(let i=0;i<u8.length;i++){a=(a+u8[i])%65521;b2=(b2+a)%65521}const ad=((b2<<16)|a)>>>0;out[o++]=ad>>>24;out[o++]=(ad>>>16)&255;out[o++]=(ad>>>8)&255;out[o++]=ad&255;return out;
}
async function png16(vals,w,h){
  const raw=new Uint8Array(h*(1+w*2));for(let j=0;j<h;j++){const r=j*(1+w*2);for(let i=0;i<w;i++){const v=vals[j*w+i];raw[r+1+i*2]=v>>8;raw[r+2+i*2]=v&255}}
  const chunk=(type,data)=>{const b=new Uint8Array(12+data.length),dv=new DataView(b.buffer);dv.setUint32(0,data.length);b.set(enc.encode(type),4);b.set(data,8);dv.setUint32(8+data.length,(crc32(b.subarray(4,8+data.length))^0xFFFFFFFF)>>>0);return b};
  const ih=new Uint8Array(13),dv=new DataView(ih.buffer);dv.setUint32(0,w);dv.setUint32(4,h);ih[8]=16;ih[9]=0;
  const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',await deflate(raw)),chunk('IEND',new Uint8Array(0))];
  const len=parts.reduce((a,b)=>a+b.length,0),out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out;
}
const canvasBytes=c=>new Promise((res,rej)=>c.toBlob(b=>b?b.arrayBuffer().then(a=>res(new Uint8Array(a))):rej(new Error('Image encoding failed')),'image/png'));
async function grayPNG(R,fn){const c=document.createElement('canvas');c.width=c.height=R;const x=c.getContext('2d'),img=x.createImageData(R,R);for(let k=0;k<R*R;k++){const v=clamp(fn(k)*255,0,255);img.data[k*4]=img.data[k*4+1]=img.data[k*4+2]=v;img.data[k*4+3]=255}x.putImageData(img,0,0);return canvasBytes(c)}
const bil=(a,k,fx,fy,o,s)=>lerp(lerp(a[k*s+o],a[(k+1)*s+o],fx),lerp(a[(k+N)*s+o],a[(k+N+1)*s+o],fx),fy);
async function bakeTexture(T,onProg){
  const c=document.createElement('canvas');c.width=c.height=T;const x=c.getContext('2d'),img=x.createImageData(T,T),d=img.data,cell=S.shape.world/(N-1),dn=makeNoise(991);
  for(let py=0;py<T;py++){
    const v=(py+.5)/T,gy=v*(N-1);
    for(let px=0;px<T;px++){
      const u=(px+.5)/T,gx=u*(N-1),h=hAt(gx,gy),hl=hAt(gx-1,gy),hr=hAt(gx+1,gy),hu=hAt(gx,gy-1),hd=hAt(gx,gy+1);
      let nx=hl-hr,ny=2*cell,nz=hu-hd;ny/=Math.hypot(nx,ny,nz);
      const ao=clamp(1+((h-(hl+hr+hu+hd)/4)/cell)*1.4,.66,1.12),ii=Math.min(gx|0,N-2),jj=Math.min(gy|0,N-2),fx=gx-ii,fy=gy-jj,k=jj*N+ii;
      const col=colorAt(h,ny,moistAt(u,v),ao,bil(PC,k,fx,fy,0,3),bil(PC,k,fx,fy,1,3),bil(PC,k,fx,fy,2,3),bil(PW,k,fx,fy,0,1),bil(WM,k,fx,fy,0,1));
      const det=1+dn(u*520,v*520)*.07+dn(u*1900,v*1900)*.05,o=(py*T+px)*4;
      d[o]=clamp(col[0]*det,0,255);d[o+1]=clamp(col[1]*det,0,255);d[o+2]=clamp(col[2]*det,0,255);d[o+3]=255;
    }
    if(py%(T>2048?24:48)===0){onProg(py/T*.5);await nextFrame()}
  }
  x.putImageData(img,0,0);return canvasBytes(c);
}
/* tangent-space normal map (glTF/OpenGL: +Y = image up) and ORM map (R ambient occlusion, G roughness, B metal) */
async function bakeNormalORM(T,s,onProg){
  const vex=S.view.vex,cell=S.shape.world/(N-1),Ms=(N-1)/s+1,cn=document.createElement('canvas'),co=document.createElement('canvas');cn.width=cn.height=co.width=co.height=T;
  const xn=cn.getContext('2d'),xo=co.getContext('2d'),imn=xn.createImageData(T,T),imo=xo.createImageData(T,T),dn=imn.data,dO=imo.data;
  const L=(i,j)=>H[clamp(j,0,Ms-1)*s*N+clamp(i,0,Ms-1)*s];
  const lowAt=(gx,gy)=>{const x=clamp(gx/s,0,Ms-1.001),y=clamp(gy/s,0,Ms-1.001),i=x|0,j=y|0,fx=x-i,fy=y-j;return lerp(lerp(L(i,j),L(i+1,j),fx),lerp(L(i,j+1),L(i+1,j+1),fx),fy)};
  const nrm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;v[0]/=l;v[1]/=l;v[2]/=l;return v},dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  for(let py=0;py<T;py++){const v=(py+.5)/T,gy=v*(N-1);
    for(let px=0;px<T;px++){const u=(px+.5)/T,gx=u*(N-1),o=(py*T+px)*4;
      const Nh=nrm([-(hAt(gx+1,gy)-hAt(gx-1,gy))*vex,2*cell,-(hAt(gx,gy+1)-hAt(gx,gy-1))*vex]);
      const lx=(lowAt(gx+s,gy)-lowAt(gx-s,gy))*vex,lz=(lowAt(gx,gy+s)-lowAt(gx,gy-s))*vex,c2=2*cell*s;
      const Nl=nrm([-lx,c2,-lz]),Tg=[c2,lx,0];const tdn=dot(Tg,Nl);Tg[0]-=Nl[0]*tdn;Tg[1]-=Nl[1]*tdn;Tg[2]-=Nl[2]*tdn;nrm(Tg);
      const B=[Nl[1]*Tg[2]-Nl[2]*Tg[1],Nl[2]*Tg[0]-Nl[0]*Tg[2],Nl[0]*Tg[1]-Nl[1]*Tg[0]];
      dn[o]=clamp((dot(Nh,Tg)*.5+.5)*255,0,255);dn[o+1]=clamp((dot(Nh,B)*.5+.5)*255,0,255);dn[o+2]=clamp((dot(Nh,Nl)*.5+.5)*255,0,255);dn[o+3]=255;
      const h=hAt(gx,gy);let a3=0,a8=0;for(let q=0;q<8;q++){const a=q/8*6.283,c=Math.cos(a),sn=Math.sin(a);a3+=hAt(gx+c*3,gy+sn*3);a8+=hAt(gx+c*9,gy+sn*9)}a3/=8;a8/=8;
      const ao=clamp(1+(h-a3)/(cell*3)*1.1+(h-a8)/(cell*9)*.8,.4,1);const ii=Math.min(gx|0,N-2),jj=Math.min(gy|0,N-2),k=jj*N+ii,wet=WM[k],snow=S.biome.snow<1?smooth(S.biome.snow-.03,S.biome.snow+.03,h/S.shape.maxH):0;
      dO[o]=ao*255;dO[o+1]=clamp(.93-wet*.45-snow*.25,.2,1)*255;dO[o+2]=0;dO[o+3]=255;
    }
    if(py%(T>2048?24:48)===0){onProg(.5+py/T*.4);await nextFrame()}}
  xn.putImageData(imn,0,0);xo.putImageData(imo,0,0);return{normal:await canvasBytes(cn),orm:await canvasBytes(co)};
}
function terrainArrays(s,vex,ia,ja,ib,jb){
  const Mm=(N-1)/s+1;ia=ia||0;ja=ja||0;ib=ib==null?Mm-1:ib;jb=jb==null?Mm-1:jb;const w=ib-ia+1,h=jb-ja+1,W=S.shape.world,cell=W/(N-1);
  const pos=new Float32Array(w*h*3),nor=new Float32Array(w*h*3),uv=new Float32Array(w*h*2),idx=new Uint32Array((w-1)*(h-1)*6);
  for(let jj=0;jj<h;jj++)for(let ii=0;ii<w;ii++){const i=(ia+ii)*s,j=(ja+jj)*s,k=jj*w+ii;pos[k*3]=(i/(N-1)-.5)*W;pos[k*3+1]=H[j*N+i]*vex;pos[k*3+2]=(j/(N-1)-.5)*W;
    const hl=H[j*N+Math.max(i-s,0)],hr=H[j*N+Math.min(i+s,N-1)],hu=H[Math.max(j-s,0)*N+i],hd=H[Math.min(j+s,N-1)*N+i];let nx=(hl-hr)*vex,ny=2*cell*s,nz=(hu-hd)*vex;const l=1/Math.hypot(nx,ny,nz);nor[k*3]=nx*l;nor[k*3+1]=ny*l;nor[k*3+2]=nz*l;
    uv[k*2]=(ia+ii)/(Mm-1);uv[k*2+1]=(ja+jj)/(Mm-1)}
  let q=0;for(let j=0;j<h-1;j++)for(let i=0;i<w-1;i++){const a=j*w+i,b=a+w,c=a+1,d=b+1;idx[q++]=a;idx[q++]=b;idx[q++]=c;idx[q++]=c;idx[q++]=b;idx[q++]=d}
  return{pos,nor,uv,idx,Mm,w,h};
}
function makeGLB(parts,images,materials,samplers){
  const chunks=[],bvs=[],acc=[];let off=0;
  const addBV=(arr,target)=>{const u8=arr instanceof Uint8Array?arr:new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength);const pad=(4-off%4)%4;if(pad){chunks.push(new Uint8Array(pad));off+=pad}const bv={buffer:0,byteOffset:off,byteLength:u8.length};if(target)bv.target=target;bvs.push(bv);chunks.push(u8);off+=u8.length;return bvs.length-1};
  const addAcc=(arr,type,comp,target,mm)=>{const n={VEC4:4,VEC3:3,VEC2:2,SCALAR:1}[type],a={bufferView:addBV(arr,target),componentType:comp,count:arr.length/n,type};
    if(mm){const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<arr.length;i+=3)for(let c=0;c<3;c++){if(arr[i+c]<mn[c])mn[c]=arr[i+c];if(arr[i+c]>mx[c])mx[c]=arr[i+c]}a.min=mn;a.max=mx}acc.push(a);return acc.length-1};
  const meshes=[],nodes=[];
  for(const p of parts){const at={POSITION:addAcc(p.pos,'VEC3',5126,34962,true),NORMAL:addAcc(p.nor,'VEC3',5126,34962)};if(p.uv)at.TEXCOORD_0=addAcc(p.uv,'VEC2',5126,34962);if(p.col)at.COLOR_0=addAcc(p.col,'VEC4',5126,34962);
    meshes.push({name:p.name,primitives:[{attributes:at,indices:addAcc(p.idx,'SCALAR',5125,34963),material:p.mat}]});const mi=meshes.length-1;
    if(p.instances){const kids=[];for(let i=0;i<p.instances.length;i++){const s=p.instances[i];nodes.push({name:p.name+'_'+i,mesh:mi,translation:s.t,rotation:s.r,scale:s.s});kids.push(nodes.length-1)}nodes.push({name:p.name,children:kids,_root:1})}
    else nodes.push({name:p.name,mesh:mi,_root:1})}
  const imgs=images.map((im,i)=>({name:im.name,bufferView:addBV(im.data),mimeType:'image/png'}));
  const roots=nodes.map((n,i)=>n._root?i:-1).filter(i=>i>=0);for(const n of nodes)delete n._root;
  const json={asset:{version:'2.0',generator:'Terrain Gen Studio V1'},scene:0,scenes:[{name:'Strata',nodes:roots}],nodes,meshes,materials,accessors:acc,bufferViews:bvs,buffers:[{byteLength:0}]};
  if(imgs.length){json.images=imgs;json.samplers=samplers||[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071},{magFilter:9728,minFilter:9728,wrapS:33071,wrapT:33071}];json.textures=images.map((im,i)=>({source:i,sampler:im.nearest?1:0}))}
  const pad=(4-off%4)%4;if(pad){chunks.push(new Uint8Array(pad));off+=pad}json.buffers[0].byteLength=off;
  let js=enc.encode(JSON.stringify(json));const jp=(4-js.length%4)%4;if(jp){const t=new Uint8Array(js.length+jp);t.set(js);t.fill(32,js.length);js=t}
  const total=12+8+js.length+8+off,out=new Uint8Array(total),dv=new DataView(out.buffer);
  dv.setUint32(0,0x46546C67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);dv.setUint32(12,js.length,true);dv.setUint32(16,0x4E4F534A,true);out.set(js,20);
  let o=20+js.length;dv.setUint32(o,off,true);dv.setUint32(o+4,0x004E4942,true);o+=8;for(const c of chunks){out.set(c,o);o+=c.length}return out;
}
/* palette atlas: replace scatter vertex colors with UVs into a tiny nearest-filtered texture (engine friendly, one material) */
async function scatterAtlas(parts){
  const map=new Map(),keyOf=(r,g,b)=>((Math.round(Math.pow(r,1/2.2)*15))<<8)|((Math.round(Math.pow(g,1/2.2)*15))<<4)|Math.round(Math.pow(b,1/2.2)*15);
  for(const p of parts)for(let i=0;i<p.col.length;i+=4){const k=keyOf(p.col[i],p.col[i+1],p.col[i+2]);if(!map.has(k))map.set(k,map.size)}
  const n=map.size,A=Math.max(4,1<<Math.ceil(Math.log2(Math.ceil(Math.sqrt(n))))),c=document.createElement('canvas');c.width=c.height=A;const x=c.getContext('2d'),img=x.createImageData(A,A);
  for(const [k,i] of map){const o=i*4;img.data[o]=((k>>8)&15)*17;img.data[o+1]=((k>>4)&15)*17;img.data[o+2]=(k&15)*17;img.data[o+3]=255}x.putImageData(img,0,0);
  for(const p of parts){const uv=new Float32Array(p.col.length/2);for(let i=0,v=0;i<p.col.length;i+=4,v+=2){const id=map.get(keyOf(p.col[i],p.col[i+1],p.col[i+2]));uv[v]=((id%A)+.5)/A;uv[v+1]=(Math.floor(id/A)+.5)/A}p.uv=uv;delete p.col}
  return{data:await canvasBytes(c),size:A,colors:n};
}
function makeOBJ(t,base,yb,name){
  const L=[`# Strata Terrain Studio export`,`# ${t.Mm}x${t.Mm} grid, units: meters, Y up`,`mtllib ${name}.mtl`,'o Terrain'],f3=n=>n.toFixed(3),f4=n=>n.toFixed(4),f5=n=>n.toFixed(5),nv=t.pos.length/3;
  for(let k=0;k<nv;k++)L.push(`v ${f3(t.pos[k*3])} ${f3(t.pos[k*3+1])} ${f3(t.pos[k*3+2])}`);
  for(let k=0;k<nv;k++)L.push(`vt ${f5(t.uv[k*2])} ${f5(1-t.uv[k*2+1])}`);
  for(let k=0;k<nv;k++)L.push(`vn ${f4(t.nor[k*3])} ${f4(t.nor[k*3+1])} ${f4(t.nor[k*3+2])}`);
  L.push('usemtl Terrain','s 1');
  for(let q=0;q<t.idx.length;q+=3){const a=t.idx[q]+1,b=t.idx[q+1]+1,c=t.idx[q+2]+1;L.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`)}
  if(base){
    const per=perimeter(t.Mm),P=per.length,W=S.shape.world,vb=nv,vtb=nv,vnb=nv;L.push('o Base');
    const topIdx=per.map(([i,j])=>j*t.Mm+i+1);
    for(const [i,j] of per){const k=j*t.Mm+i;L.push(`v ${f3(t.pos[k*3])} ${f3(yb)} ${f3(t.pos[k*3+2])}`)}
    L.push(`v 0 ${f3(yb)} 0`);const ctr=vb+P+1;let total=0,acc=0,top=yb;const lens=[];
    for(let q=0;q<P;q++){const a=topIdx[q]-1,b=topIdx[(q+1)%P]-1,l=Math.hypot(t.pos[b*3]-t.pos[a*3],t.pos[b*3+2]-t.pos[a*3+2]);lens.push(l);total+=l;top=Math.max(top,t.pos[a*3+1])}
    const span=Math.max(1,top-yb);
    for(let q=0;q<P;q++){const a=topIdx[q]-1,b=topIdx[(q+1)%P]-1,u0=acc/total,u1=(acc+lens[q])/total;acc+=lens[q];L.push(`vt ${f5(u0)} ${f5((t.pos[a*3+1]-yb)/span)}`,`vt ${f5(u1)} ${f5((t.pos[b*3+1]-yb)/span)}`,`vt ${f5(u1)} 0`,`vt ${f5(u0)} 0`)}
    for(const [i,j] of per){const k=j*t.Mm+i;L.push(`vt ${f5(t.pos[k*3]/W+.5)} ${f5(.5-t.pos[k*3+2]/W)}`)}L.push('vt 0.5 0.5');
    L.push('vn 0 0 -1','vn 1 0 0','vn 0 0 1','vn -1 0 0','vn 0 -1 0');
    const side=q=>{const [i,j]=per[q],[i2,j2]=per[(q+1)%P];if(j===0&&j2===0)return 1;if(i===t.Mm-1&&i2===t.Mm-1)return 2;if(j===t.Mm-1&&j2===t.Mm-1)return 3;return 4};
    L.push('usemtl Base','s off');
    for(let q=0;q<P;q++){const tA=topIdx[q],tB=topIdx[(q+1)%P],bA=vb+1+q,bB=vb+1+(q+1)%P,T0=vtb+q*4+1,n=vnb+side(q);L.push(`f ${tA}/${T0}/${n} ${tB}/${T0+1}/${n} ${bB}/${T0+2}/${n}`,`f ${tA}/${T0}/${n} ${bB}/${T0+2}/${n} ${bA}/${T0+3}/${n}`)}
    const vtBot=vtb+P*4,nb=vnb+5;for(let q=0;q<P;q++){const a=vb+1+q,b=vb+1+(q+1)%P;L.push(`f ${ctr}/${vtBot+P+1}/${nb} ${a}/${vtBot+q+1}/${nb} ${b}/${vtBot+(q+1)%P+1}/${nb}`)}
  }
  return L.join('\n')+'\n';
}
/* ---------------- layer weights (engine splat / weightmaps) ---------------- */
function layerWeights(){
  const b=S.biome,maxH=S.shape.maxH,sea=b.sea,cell=S.shape.world/(N-1),out={grass:new Float32Array(N*N),rock:new Float32Array(N*N),sand:new Float32Array(N*N),snow:new Float32Array(N*N),wet:new Float32Array(N*N)};
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,h=H[k],hn=h/maxH,dx=H[j*N+Math.min(i+1,N-1)]-H[j*N+Math.max(i-1,0)],dy=H[Math.min(j+1,N-1)*N+i]-H[Math.max(j-1,0)*N+i],ny=2*cell/Math.hypot(dx,dy,2*cell),slope=1-ny,t=sea>=1?0:clamp((hn-sea)/(1-sea),0,1);
    const thr=b.rock*.42*(1-.35*smooth(.4,.9,t));let rock=smooth(thr-.05,thr+.05,slope),snow=b.snow<1?smooth(b.snow-.03,b.snow+.03,hn)*(1-smooth(.3,.5,slope)):0,sand=sea>0?(1-smooth(sea,sea+b.beach+.002,hn)):0;
    if(PW[k]>.3){const r=PC[k*3],g=PC[k*3+1],bb=PC[k*3+2];if(r>200&&g>200&&bb>200)snow=Math.max(snow,PW[k]);else if(r>g*1.05&&g>bb)sand=Math.max(sand,PW[k]*.8);else if(Math.abs(r-g)<12&&Math.abs(g-bb)<12)rock=Math.max(rock,PW[k])}
    const wet=WM[k];let grass=Math.max(0,1-rock-snow-sand-wet*.5);const sum=grass+rock+snow+sand+wet*.5||1;
    out.grass[k]=grass/sum;out.rock[k]=rock/sum;out.sand[k]=sand/sum;out.snow[k]=snow/sum;out.wet[k]=wet*.5/sum}
  return out;
}
function instanceRows(){const rows=[],q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3(),e=new THREE.Euler(),m=new THREE.Matrix4();
  for(const t of [...TREE_KEYS,...STRUCT_KEYS]){const mesh=SCAT[t];if(!mesh)continue;for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);m.decompose(p,q,s);e.setFromQuaternion(q,'YXZ');const u=(SCATTER_TYPES[parentOf(t)]||SCATTER_TYPES.structure).unit;rows.push({t,x:p.x,y:p.y,z:p.z,yaw:e.y,sx:s.x/u,sy:s.y/u,sz:s.z/u})}}return rows}
function assetPartsAtOrigin(){const out=[];for(const t of [...TREE_KEYS,...STRUCT_KEYS]){const g=ASSETS[t],n=g.attributes.position.count,col=new Float32Array(n*4);for(let i=0;i<n;i++){col[i*4]=g.attributes.color.array[i*3];col[i*4+1]=g.attributes.color.array[i*3+1];col[i*4+2]=g.attributes.color.array[i*3+2];col[i*4+3]=1}
  const idx=new Uint32Array(n);for(let i=0;i<n;i++)idx[i]=i;const sc=SCATTER_TYPES[parentOf(t)]?SCATTER_TYPES[parentOf(t)].unit:SCATTER_TYPES.structure.unit,pos=new Float32Array(g.attributes.position.array.length);for(let i=0;i<pos.length;i++)pos[i]=g.attributes.position.array[i]*sc;
  out.push({name:'SM_'+t[0].toUpperCase()+t.slice(1),pos,nor:g.attributes.normal.array.slice(),col,idx,mat:0})}return out}

/* ---------------- main ---------------- */
async function exportNow(){
  const e={...S.exp,...(EXPORT_TARGETS[S.exp.target]||{}).o};if(S.exp.target==='custom')Object.assign(e,S.exp);
  const vex=S.view.vex,name=`terraingen-${S.name||S.preset}`.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+$/,'').slice(0,40)||'terraingen',files=[],tex=Math.min(e.tex,QUALITY[S.quality].tex);
  busy(true,'Preparing export…',.02);const EJ=job('Export for '+((EXPORT_TARGETS[S.exp.target]||{}).n||'Custom'),['Baking textures','Writing files','Compressing','Saving']);
  const onProg=p=>prog(`Baking textures… ${Math.round(p*100)}%`,p);
  try{
    const meta={app:'Terrain Gen Studio V1',name:S.name,seed:S.seed,preset:S.preset,worldSizeMeters:S.shape.world,minHeightMeters:+stats.lo.toFixed(2),maxHeightMeters:+stats.hi.toFixed(2),verticalExaggeration:vex,seaLevelMeters:+seaLevel().toFixed(2),gridResolution:N};
    const albedo=await bakeTexture(tex,onProg);
    if(e.fmt==='unreal'){
      const sizes=[127,253,505,1009,2017,4033],U=sizes.reduce((a,b)=>Math.abs(b-N)<Math.abs(a-N)?b:a),Hu=resample(H,N,U),span=(stats.hi-stats.lo)||1,v16=new Uint16Array(U*U);
      for(let k=0;k<U*U;k++)v16[k]=Math.round(clamp((Hu[k]*vex-stats.lo*vex)/(span*vex),0,1)*65535);
      files.push({name:`Heightmap/${name}_height_${U}.png`,data:await png16(v16,U,U)});
      prog('Writing layer weightmaps…',.92);await nextFrame();const lw=layerWeights();
      for(const [k,arr] of Object.entries(lw)){const r=resample(arr,N,U);files.push({name:`Weightmaps/${name}_${k}.png`,data:await grayPNG(U,i=>r[i])})}
      const nm=await bakeNormalORM(tex,1,onProg);files.push({name:`Textures/T_${name}_BaseColor.png`,data:albedo},{name:`Textures/T_${name}_Normal.png`,data:nm.normal},{name:`Textures/T_${name}_ORM.png`,data:nm.orm});
      const zs=span*vex*100/512,xy=S.shape.world*100/(U-1);
      const rows=instanceRows();files.push({name:`Foliage/${name}_instances.csv`,data:'Type,X_cm,Y_cm,Z_cm,Yaw_deg,ScaleX,ScaleY,ScaleZ\n'+rows.map(r=>`${r.t},${((r.x+S.shape.world/2)*100).toFixed(1)},${((r.z+S.shape.world/2)*100).toFixed(1)},${(r.y*100).toFixed(1)},${(-r.yaw*180/Math.PI).toFixed(2)},${r.sx.toFixed(3)},${r.sz.toFixed(3)},${r.sy.toFixed(3)}`).join('\n')});
      const ap=assetPartsAtOrigin(),at=await scatterAtlas(ap);files.push({name:`Foliage/${name}_assets.glb`,data:makeGLB(ap,[{name:'palette',data:at.data,nearest:true}],[{name:'M_StrataPalette',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.9}}])});
      files.push({name:`${name}_unreal.json`,data:JSON.stringify({...meta,landscape:{heightmapSize:U,recommendedSectionSize:'63x63 quads, 4 sections per component',scaleX_cm:+xy.toFixed(3),scaleY_cm:+xy.toFixed(3),scaleZ:+zs.toFixed(4),locationZ_cm:+(stats.lo*vex*100+256*zs).toFixed(1),layers:Object.keys(lw)}},null,2)});
      files.push({name:'README.txt',data:`Strata → Unreal Engine 5\n\n1. Landscape mode → Import from File → Heightmap/${name}_height_${U}.png (16-bit).\n2. Set Scale X/Y = ${xy.toFixed(2)}, Scale Z = ${zs.toFixed(3)}, Location Z = ${(stats.lo*vex*100+256*zs).toFixed(0)} (also in ${name}_unreal.json).\n3. Create a landscape material with layers grass, rock, sand, snow, wet and import the matching Weightmaps/*.png.\n   Or plug Textures/T_${name}_BaseColor/Normal/ORM straight into a material using landscape UVs (0-1 across the landscape).\n4. Foliage/${name}_assets.glb holds SM_ meshes (palette texture). Foliage/${name}_instances.csv lists every tree, rock and building in Unreal units (cm, X/Y from the landscape corner, Z absolute, yaw in degrees) for PCG, Python or a Data Table.\n`});
    }else if(e.fmt==='unity'){
      const span=(stats.hi-stats.lo)||1,raw=new Uint8Array(N*N*2);for(let k=0;k<N*N;k++){const v=Math.round(clamp((H[k]-stats.lo)/span,0,1)*65535);raw[k*2]=v&255;raw[k*2+1]=v>>8}
      files.push({name:`${name}_height_${N}.raw`,data:raw},{name:`${name}_albedo.png`,data:albedo});
      const lw=layerWeights();for(const [k,arr] of Object.entries(lw))files.push({name:`Splat/${name}_${k}.png`,data:await grayPNG(N,i=>arr[i])});
      if(e.pbr){const nm=await bakeNormalORM(tex,1,onProg);files.push({name:`${name}_normal.png`,data:nm.normal})}
      const rows=instanceRows();files.push({name:`${name}_trees.csv`,data:'Type,PosX01,PosZ01,Height01,RotationY_deg,Scale\n'+rows.map(r=>`${r.t},${(r.x/S.shape.world+.5).toFixed(5)},${(.5-r.z/S.shape.world).toFixed(5)},${((r.y/vex-stats.lo)/span).toFixed(5)},${(-r.yaw*180/Math.PI).toFixed(2)},${r.sy.toFixed(3)}`).join('\n')});
      const ap=assetPartsAtOrigin(),at=await scatterAtlas(ap);files.push({name:`${name}_assets.glb`,data:makeGLB(ap,[{name:'palette',data:at.data,nearest:true}],[{name:'StrataPalette',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.9}}])});
      files.push({name:'README.txt',data:`Strata → Unity\n\nTerrain → Import Raw: ${name}_height_${N}.raw, Depth 16-bit, Byte Order Windows, Resolution ${N}.\nTerrain Width/Length = ${S.shape.world} m, Height = ${span.toFixed(1)} m (place terrain at Y = ${stats.lo.toFixed(1)}).\nPaint layers from Splat/*.png (grass, rock, sand, snow, wet) or use ${name}_albedo.png as a single layer sized ${S.shape.world} m.\n${name}_trees.csv positions are normalized 0-1 for TreeInstance; Z is flipped so row 0 of the heightmap is north.\n`});
    }else if(e.fmt==='height'){
      const span=stats.hi-stats.lo||1,v16=new Uint16Array(N*N),raw=new Uint8Array(N*N*2);
      for(let k=0;k<N*N;k++){const v=Math.round((H[k]-stats.lo)/span*65535);v16[k]=v;raw[k*2]=v&255;raw[k*2+1]=v>>8}
      files.push({name:`${name}_height16.png`,data:await png16(v16,N,N)},{name:`${name}_height16_le.r16`,data:raw},{name:`${name}_albedo.png`,data:albedo});
      files.push({name:'README.txt',data:`Strata heightmap\n\n16-bit grayscale: black = ${meta.minHeightMeters} m, white = ${meta.maxHeightMeters} m, ${meta.worldSizeMeters} m wide.\n`});
    }else{
      const s=e.detail||1,tiles=e.fmt==='glb'?(e.tiles||1):1,t=terrainArrays(s,vex),yb=stats.lo*vex-Math.max(e.depth,S.shape.maxH*.04);
      let nm=null;if(e.pbr&&e.fmt==='glb')nm=await bakeNormalORM(tex,s,onProg);
      prog('Writing mesh…',.93);await nextFrame();
      if(e.fmt==='glb'){
        const parts=[],images=[{name:'albedo',data:albedo}];const mat={name:'Terrain',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.92}};
        if(nm){images.push({name:'normal',data:nm.normal},{name:'orm',data:nm.orm});mat.normalTexture={index:1};mat.occlusionTexture={index:2};mat.pbrMetallicRoughness.metallicRoughnessTexture={index:2};mat.pbrMetallicRoughness.roughnessFactor=1}
        const materials=[mat,{name:'Base',pbrMetallicRoughness:{baseColorFactor:[...PALETTES[S.biome.palette].rock2.map(v=>toLin(v*.6)),1],metallicFactor:0,roughnessFactor:1}}];
        if(tiles>1){const Mm=(N-1)/s+1,st=(Mm-1)/tiles;for(let ty=0;ty<tiles;ty++)for(let tx=0;tx<tiles;tx++){const a=terrainArrays(s,vex,tx*st,ty*st,(tx+1)*st,(ty+1)*st);parts.push({name:`Terrain_${tx}_${ty}`,pos:a.pos,nor:a.nor,uv:a.uv,idx:a.idx,mat:0})}}
        else parts.push({name:'Terrain',pos:t.pos,nor:t.nor,uv:t.uv,idx:t.idx,mat:0});
        if(e.base){const b=baseArrays(s,vex,yb);parts.push({name:'Base',pos:b.pos,nor:b.nor,uv:b.uv,idx:b.idx,mat:1})}
        if(e.scatter&&S.scatter.on){const sp=scatterExportParts(QUALITY[S.quality].scatter>1?30000:16000);if(sp.length){
          if(e.atlas){const at=await scatterAtlas(sp);images.push({name:'scatter_palette',data:at.data,nearest:true});materials.push({name:'ScatterPalette',pbrMetallicRoughness:{baseColorTexture:{index:images.length-1},metallicFactor:0,roughnessFactor:.9}})}
          else materials.push({name:'Scatter',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.9}});
          for(const p of sp)parts.push({...p,mat:materials.length-1})}}
        files.push({name:`${name}.glb`,data:makeGLB(parts,images,materials)});
      }else{
        files.push({name:`${name}.obj`,data:makeOBJ(t,e.base,yb,name)},{name:`${name}_albedo.png`,data:albedo});
        const bc=PALETTES[S.biome.palette].rock2.map(v=>(v*.6/255).toFixed(4)).join(' ');
        files.push({name:`${name}.mtl`,data:`newmtl Terrain\nKa 1 1 1\nKd 1 1 1\nKs 0 0 0\nillum 1\nmap_Kd ${name}_albedo.png\n\nnewmtl Base\nKa 1 1 1\nKd ${bc}\nKs 0 0 0\nillum 1\n`});
      }
      files.push({name:`${name}.json`,data:JSON.stringify({...meta,vertices:t.pos.length/3,triangles:t.idx.length/3,tiles,uv:'Terrain: one seamless 0-1 island shared by all tiles. Base and scatter use their own materials.'},null,2)});
      const tgt=EXPORT_TARGETS[S.exp.target]?EXPORT_TARGETS[S.exp.target].n:'';
      files.push({name:'README.txt',data:`Strata mesh export${tgt?' for '+tgt:''}\n\nUnits are meters, Y up. Terrain UVs are one seamless 0-1 square; the ${tex}px textures map 1:1.\n${nm?'Normal map is tangent-space (OpenGL, +Y up) baked from the full-resolution heights, so lower mesh detail keeps its look. ORM = R ambient occlusion, G roughness, B metal.\n':''}${tiles>1?`Terrain is split into ${tiles}x${tiles} tiles that share edges and UV space.\n`:''}${e.base?'A solid base closes the mesh'+(e.fmt==='obj'?' (watertight, ready for slicing)':'')+'.\n':''}\nBlender: File > Import > ${e.fmt==='glb'?'glTF 2.0':'Wavefront (.obj)'}. Godot: drop the .glb into the project.\n`});
    }
    if(e.masks){prog('Writing masks…',.96);await nextFrame();files.push(...await maskFiles(name))}
    files.push({name:`${name}_info.json`,data:JSON.stringify(meta,null,2)});
    EJ.step(2);prog('Compressing…',.99);await nextFrame();EJ.step(3);
    await saveFile(`${name}-${S.exp.target}.zip`,zip(files));EJ.done(name+'.zip');
  }catch(err){EJ.fail(err.message||String(err));toast('Export failed: '+(err.message||err),'warn')}
  finally{busy(false)}
}
async function maskFiles(name){
  const out=[],cell=S.shape.world/(N-1),sea=seaLevel();
  out.push({name:`masks/${name}_slope.png`,data:await grayPNG(N,k=>{const i=k%N,j=(k/N)|0;const dx=H[j*N+Math.min(i+1,N-1)]-H[j*N+Math.max(i-1,0)],dy=H[Math.min(j+1,N-1)*N+i]-H[Math.max(j-1,0)*N+i];return Math.atan(Math.hypot(dx,dy)/(2*cell))/(Math.PI/2)})});
  out.push({name:`masks/${name}_water_wetness.png`,data:await grayPNG(N,k=>Math.max(WM[k],H[k]<sea?1:0))});
  out.push({name:`masks/${name}_vegetation_density.png`,data:await grayPNG(N,k=>clamp(SM[k],0,1)*(H[k]<sea?0:1)*(.3+.7*M[k]))});
  out.push({name:`masks/${name}_snow.png`,data:await grayPNG(N,k=>S.biome.snow>=1?0:smooth(S.biome.snow-.03,S.biome.snow+.03,H[k]/S.shape.maxH))});
  return out;
}
async function saveFile(name,blob){
  const dl=window.claude&&claude.use?await claude.use('downloads').catch(()=>null):null;
  if(dl){
    try{await dl.save({filename:name,data:blob});toast('Saved '+name,'ok');celebrate()}
    catch(e){toast(e&&e.code==='declined'?'Save cancelled':e&&e.code==='too_large'?'File too large. Lower the detail or texture size.':'Could not save: '+((e&&e.message)||'unknown error'),'warn')}
    return;
  }
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('Downloading '+name,'ok');celebrate();
}
