"use strict";
/* Strata export: GLB / OBJ / heightmap zips with baked albedo, masks and optional scatter. */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8,c=0xFFFFFFFF){for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);return c}
const enc=new TextEncoder();
function zip(files){
  const parts=[],cen=[];let off=0;const d=new Date(),dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1)),dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate());
  for(const f of files){
    const name=enc.encode(f.name),data=f.data instanceof Uint8Array?f.data:enc.encode(f.data),crc=(crc32(data)^0xFFFFFFFF)>>>0;
    const lh=new DataView(new ArrayBuffer(30));lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(8,0,true);lh.setUint16(10,dt,true);lh.setUint16(12,dd,true);lh.setUint32(14,crc,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,name.length,true);
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
const bil=(a,k,fx,fy,o,s)=>lerp(lerp(a[k*s+o],a[(k+1)*s+o],fx),lerp(a[(k+N)*s+o],a[(k+N+1)*s+o],fx),fy);
async function bakeTexture(T,onProg){
  const c=document.createElement('canvas');c.width=c.height=T;const x=c.getContext('2d'),img=x.createImageData(T,T),d=img.data,cell=S.shape.world/(N-1),dn=makeNoise(991);
  for(let py=0;py<T;py++){
    const v=(py+.5)/T,gy=v*(N-1);
    for(let px=0;px<T;px++){
      const u=(px+.5)/T,gx=u*(N-1),h=hAt(gx,gy),hl=hAt(gx-1,gy),hr=hAt(gx+1,gy),hu=hAt(gx,gy-1),hd=hAt(gx,gy+1);
      let nx=hl-hr,ny=2*cell,nz=hu-hd;ny/=Math.hypot(nx,ny,nz);
      const ao=clamp(1+((h-(hl+hr+hu+hd)/4)/cell)*1.4,.66,1.12);
      const ii=Math.min(gx|0,N-2),jj=Math.min(gy|0,N-2),fx=gx-ii,fy=gy-jj,k=jj*N+ii;
      const col=colorAt(h,ny,moistAt(u,v),ao,bil(PC,k,fx,fy,0,3),bil(PC,k,fx,fy,1,3),bil(PC,k,fx,fy,2,3),bil(PW,k,fx,fy,0,1),bil(WM,k,fx,fy,0,1));
      const det=1+dn(u*520,v*520)*.07+dn(u*1900,v*1900)*.05,o=(py*T+px)*4;
      d[o]=clamp(col[0]*det,0,255);d[o+1]=clamp(col[1]*det,0,255);d[o+2]=clamp(col[2]*det,0,255);d[o+3]=255;
    }
    if(py%(T>2048?32:64)===0){onProg(py/T);await nextFrame()}
  }
  x.putImageData(img,0,0);return canvasBytes(c);
}
function terrainArrays(s,vex){
  const Mm=(N-1)/s+1,W=S.shape.world,cell=W/(N-1),pos=new Float32Array(Mm*Mm*3),nor=new Float32Array(Mm*Mm*3),uv=new Float32Array(Mm*Mm*2),idx=new Uint32Array((Mm-1)*(Mm-1)*6);
  for(let jj=0;jj<Mm;jj++)for(let ii=0;ii<Mm;ii++){
    const i=ii*s,j=jj*s,k=jj*Mm+ii;pos[k*3]=(i/(N-1)-.5)*W;pos[k*3+1]=H[j*N+i]*vex;pos[k*3+2]=(j/(N-1)-.5)*W;
    const hl=H[j*N+Math.max(i-s,0)],hr=H[j*N+Math.min(i+s,N-1)],hu=H[Math.max(j-s,0)*N+i],hd=H[Math.min(j+s,N-1)*N+i];
    let nx=(hl-hr)*vex,ny=2*cell*s,nz=(hu-hd)*vex;const l=1/Math.hypot(nx,ny,nz);nor[k*3]=nx*l;nor[k*3+1]=ny*l;nor[k*3+2]=nz*l;
    uv[k*2]=ii/(Mm-1);uv[k*2+1]=jj/(Mm-1);
  }
  let q=0;for(let j=0;j<Mm-1;j++)for(let i=0;i<Mm-1;i++){const a=j*Mm+i,b=a+Mm,c=a+1,d=b+1;idx[q++]=a;idx[q++]=b;idx[q++]=c;idx[q++]=c;idx[q++]=b;idx[q++]=d}
  return{pos,nor,uv,idx,Mm};
}
function makeGLB(parts,png,baseColor){
  const chunks=[],bvs=[],acc=[];let off=0;
  const addBV=(arr,target)=>{const u8=arr instanceof Uint8Array?arr:new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength);const pad=(4-off%4)%4;if(pad){chunks.push(new Uint8Array(pad));off+=pad}const bv={buffer:0,byteOffset:off,byteLength:u8.length};if(target)bv.target=target;bvs.push(bv);chunks.push(u8);off+=u8.length;return bvs.length-1};
  const addAcc=(arr,type,comp,target,mm)=>{const n={VEC3:3,VEC2:2,SCALAR:1}[type],a={bufferView:addBV(arr,target),componentType:comp,count:arr.length/n,type};
    if(mm){const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<arr.length;i+=3)for(let c=0;c<3;c++){if(arr[i+c]<mn[c])mn[c]=arr[i+c];if(arr[i+c]>mx[c])mx[c]=arr[i+c]}a.min=mn;a.max=mx}acc.push(a);return acc.length-1};
  const meshes=[],nodes=[];
  for(const p of parts){const at={POSITION:addAcc(p.pos,'VEC3',5126,34962,true),NORMAL:addAcc(p.nor,'VEC3',5126,34962)};if(p.uv)at.TEXCOORD_0=addAcc(p.uv,'VEC2',5126,34962);if(p.col)at.COLOR_0=addAcc(p.col,'VEC4',5126,34962);const prim={attributes:at,indices:addAcc(p.idx,'SCALAR',5125,34963),material:p.mat};meshes.push({name:p.name,primitives:[prim]});nodes.push({name:p.name,mesh:meshes.length-1})}
  const img=addBV(png);
  const json={asset:{version:'2.0',generator:'Strata Terrain Studio'},scene:0,scenes:[{name:'Strata',nodes:nodes.map((_,i)=>i)}],nodes,meshes,
    materials:[{name:'Terrain',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.92}},{name:'Base',pbrMetallicRoughness:{baseColorFactor:baseColor,metallicFactor:0,roughnessFactor:1}},{name:'Scatter',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.9}}],
    textures:[{source:0,sampler:0}],images:[{name:'albedo',bufferView:img,mimeType:'image/png'}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],accessors:acc,bufferViews:bvs,buffers:[{byteLength:0}]};
  const pad=(4-off%4)%4;if(pad){chunks.push(new Uint8Array(pad));off+=pad}json.buffers[0].byteLength=off;
  let js=enc.encode(JSON.stringify(json));const jp=(4-js.length%4)%4;if(jp){const t=new Uint8Array(js.length+jp);t.set(js);t.fill(32,js.length);js=t}
  const total=12+8+js.length+8+off,out=new Uint8Array(total),dv=new DataView(out.buffer);
  dv.setUint32(0,0x46546C67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);dv.setUint32(12,js.length,true);dv.setUint32(16,0x4E4F534A,true);out.set(js,20);
  let o=20+js.length;dv.setUint32(o,off,true);dv.setUint32(o+4,0x004E4942,true);o+=8;for(const c of chunks){out.set(c,o);o+=c.length}return out;
}
function makeOBJ(t,base,yb,name){
  const L=[`# Strata Terrain Sculptor export`,`# ${t.Mm}x${t.Mm} grid, units: meters, Y up`,`mtllib ${name}.mtl`,'o Terrain'],f3=n=>n.toFixed(3),f4=n=>n.toFixed(4),f5=n=>n.toFixed(5);
  const nv=t.pos.length/3;
  for(let k=0;k<nv;k++)L.push(`v ${f3(t.pos[k*3])} ${f3(t.pos[k*3+1])} ${f3(t.pos[k*3+2])}`);
  for(let k=0;k<nv;k++)L.push(`vt ${f5(t.uv[k*2])} ${f5(1-t.uv[k*2+1])}`);
  for(let k=0;k<nv;k++)L.push(`vn ${f4(t.nor[k*3])} ${f4(t.nor[k*3+1])} ${f4(t.nor[k*3+2])}`);
  L.push('usemtl Terrain','s 1');
  for(let q=0;q<t.idx.length;q+=3){const a=t.idx[q]+1,b=t.idx[q+1]+1,c=t.idx[q+2]+1;L.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`)}
  if(base){
    // Watertight: wall tops reuse terrain vertices; bottoms and a center vertex close the shell.
    const per=perimeter(t.Mm),P=per.length,W=S.shape.world;let vb=nv,vtb=nv,vnb=nv;
    L.push('o Base');
    const topIdx=per.map(([i,j])=>j*t.Mm+i+1);
    for(const [i,j] of per){const k=j*t.Mm+i;L.push(`v ${f3(t.pos[k*3])} ${f3(yb)} ${f3(t.pos[k*3+2])}`)}
    L.push(`v 0 ${f3(yb)} 0`);const ctr=vb+P+1;
    let total=0,acc=0,top=yb;const lens=[];for(let q=0;q<P;q++){const a=topIdx[q]-1,b=topIdx[(q+1)%P]-1,l=Math.hypot(t.pos[b*3]-t.pos[a*3],t.pos[b*3+2]-t.pos[a*3+2]);lens.push(l);total+=l;top=Math.max(top,t.pos[a*3+1])}
    const span=Math.max(1,top-yb);
    // vts: per wall segment 4, then bottom per perimeter vertex + center
    for(let q=0;q<P;q++){const a=topIdx[q]-1,b=topIdx[(q+1)%P]-1,u0=acc/total,u1=(acc+lens[q])/total;acc+=lens[q];L.push(`vt ${f5(u0)} ${f5((t.pos[a*3+1]-yb)/span)}`,`vt ${f5(u1)} ${f5((t.pos[b*3+1]-yb)/span)}`,`vt ${f5(u1)} 0`,`vt ${f5(u0)} 0`)}
    for(const [i,j] of per){const k=j*t.Mm+i;L.push(`vt ${f5(t.pos[k*3]/W+.5)} ${f5(.5-t.pos[k*3+2]/W)}`)}L.push('vt 0.5 0.5');
    L.push('vn 0 0 -1','vn 1 0 0','vn 0 0 1','vn -1 0 0','vn 0 -1 0');
    const side=q=>{const [i,j]=per[q],[i2,j2]=per[(q+1)%P];if(j===0&&j2===0)return 1;if(i===t.Mm-1&&i2===t.Mm-1)return 2;if(j===t.Mm-1&&j2===t.Mm-1)return 3;return 4};
    L.push('usemtl Base','s off');
    for(let q=0;q<P;q++){
      const tA=topIdx[q],tB=topIdx[(q+1)%P],bA=vb+1+q,bB=vb+1+(q+1)%P,T0=vtb+q*4+1,n=vnb+side(q);
      // perimeter runs counter-clockwise seen from below, so this order faces outward
      L.push(`f ${tA}/${T0}/${n} ${tB}/${T0+1}/${n} ${bB}/${T0+2}/${n}`,`f ${tA}/${T0}/${n} ${bB}/${T0+2}/${n} ${bA}/${T0+3}/${n}`);
    }
    const vtBot=vtb+P*4,nb=vnb+5;
    for(let q=0;q<P;q++){const a=vb+1+q,b=vb+1+(q+1)%P;L.push(`f ${ctr}/${vtBot+P+1}/${nb} ${a}/${vtBot+q+1}/${nb} ${b}/${vtBot+(q+1)%P+1}/${nb}`)}
  }
  return L.join('\n')+'\n';
}
async function exportNow(){
  const e=S.exp,vex=S.view.vex,name=`strata-${S.preset}-${S.seed}`.toLowerCase().replace(/[^a-z0-9]+/g,'-'),files=[];
  busy(true,'Preparing export…',.05);
  try{
    const prog=f=>{$('#busyText').textContent=`Baking texture… ${Math.round(f*100)}%`;$('#busyBar').style.width=(f*100)+'%'};
    const meta={app:'Strata Terrain Sculptor',seed:S.seed,preset:S.preset,worldSizeMeters:S.shape.world,minHeightMeters:+stats.lo.toFixed(2),maxHeightMeters:+stats.hi.toFixed(2),verticalExaggeration:vex,seaLevelMeters:+(S.biome.sea*S.shape.maxH).toFixed(2),gridResolution:N};
    if(e.fmt==='height'){
      const span=stats.hi-stats.lo||1,v16=new Uint16Array(N*N),raw=new Uint8Array(N*N*2);
      for(let k=0;k<N*N;k++){const v=Math.round((H[k]-stats.lo)/span*65535);v16[k]=v;raw[k*2]=v&255;raw[k*2+1]=v>>8}
      files.push({name:`${name}_height16.png`,data:await png16(v16,N,N)},{name:`${name}_height16_le.r16`,data:raw});
      files.push({name:`${name}_albedo.png`,data:await bakeTexture(e.tex,prog)});
      files.push({name:`${name}.json`,data:JSON.stringify({...meta,heightmap:{bits:16,black:'minHeightMeters',white:'maxHeightMeters',size:N}},null,2)});
      files.push({name:'README.txt',data:`Strata heightmap export\n\n${name}_height16.png  16-bit grayscale, black = ${meta.minHeightMeters} m, white = ${meta.maxHeightMeters} m\n${name}_height16_le.r16  same data as raw little-endian 16-bit (Unity: Import Raw, Windows byte order)\n${name}_albedo.png  color map that lines up with the heightmap\n\nTerrain is ${meta.worldSizeMeters} m wide. Unreal: Z scale = ${((stats.hi-stats.lo)*100/512).toFixed(2)} for a height range of ${(stats.hi-stats.lo).toFixed(1)} m.\n`});
    }else{
      const t=terrainArrays(e.detail,vex),yb=stats.lo*vex-Math.max(e.depth,S.shape.maxH*.04);
      const png=await bakeTexture(e.tex,prog);$('#busyText').textContent='Writing mesh…';await nextFrame();
      if(e.fmt==='glb'){
        const parts=[{name:'Terrain',pos:t.pos,nor:t.nor,uv:t.uv,idx:t.idx,mat:0}];
        if(e.base){const b=baseArrays(e.detail,vex,yb);parts.push({name:'Base',pos:b.pos,nor:b.nor,uv:b.uv,idx:b.idx,mat:1})}
        const bc=PALETTES[S.biome.palette].rock2.map(v=>toLin(v*.6));
        if(e.scatter&&S.scatter.on){for(const sp of scatterExportParts(QUALITY[S.quality].scatter>1?30000:16000))parts.push({name:sp.name,pos:sp.pos,nor:sp.nor,col:sp.col,idx:sp.idx,mat:2})}
        files.push({name:`${name}.glb`,data:makeGLB(parts,png,[...bc,1])});
      }else{
        files.push({name:`${name}.obj`,data:makeOBJ(t,e.base,yb,name)});
        const bc=PALETTES[S.biome.palette].rock2.map(v=>(v*.6/255).toFixed(4)).join(' ');
        files.push({name:`${name}.mtl`,data:`newmtl Terrain\nKa 1 1 1\nKd 1 1 1\nKs 0 0 0\nillum 1\nmap_Kd ${name}_albedo.png\n\nnewmtl Base\nKa 1 1 1\nKd ${bc}\nKs 0 0 0\nillum 1\n`});
      }
      files.push({name:`${name}_albedo.png`,data:png},{name:`${name}.json`,data:JSON.stringify({...meta,vertices:t.pos.length/3,triangles:t.idx.length/3,uv:'Terrain: one planar 0-1 island, no seams or overlap. Base: own material.'},null,2)});
      files.push({name:'README.txt',data:`Strata mesh export\n\nUnits are meters, Y is up. The terrain surface is UV-unwrapped as a single 0-1 square with no seams or overlapping islands, so the ${e.tex}px albedo texture maps 1:1.\n${e.base?'A solid base closes the mesh'+(e.fmt==='obj'?' (watertight, ready for slicing / 3D printing)':'')+'. It uses its own "Base" material.\n':''}\nBlender: File > Import > ${e.fmt==='glb'?'glTF 2.0':'Wavefront (.obj)'}.\nUnity / Godot / Unreal: drag the ${e.fmt==='glb'?'.glb':'.obj and .png'} into your project.\n`});
    }
    if(e.masks){$('#busyText').textContent='Writing masks…';await nextFrame();files.push(...await maskFiles(name))}
    await saveFile(`${name}-${e.fmt}.zip`,zip(files));
  }catch(err){toast('Export failed: '+(err.message||err))}
  finally{busy(false)}
}
async function saveFile(name,blob){
  const dl=window.claude&&claude.use?await claude.use('downloads').catch(()=>null):null;
  if(dl){
    try{await dl.save({filename:name,data:blob});toast('Saved '+name)}
    catch(e){toast(e&&e.code==='declined'?'Save cancelled':e&&e.code==='too_large'?'File too large. Lower the detail or texture size.':'Could not save: '+((e&&e.message)||'unknown error'))}
    return;
  }
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('Downloading '+name);
}

async function maskFiles(name){
  const out=[],cell=S.shape.world/(N-1),sea=seaLevel();
  const write=async(label,fn)=>{const c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d'),img=x.createImageData(N,N);
    for(let k=0;k<N*N;k++){const v=clamp(fn(k)*255,0,255);img.data[k*4]=img.data[k*4+1]=img.data[k*4+2]=v;img.data[k*4+3]=255}x.putImageData(img,0,0);out.push({name:`masks/${name}_${label}.png`,data:await canvasBytes(c)})};
  await write('slope',k=>{const i=k%N,j=(k/N)|0;const dx=H[j*N+Math.min(i+1,N-1)]-H[j*N+Math.max(i-1,0)],dy=H[Math.min(j+1,N-1)*N+i]-H[Math.max(j-1,0)*N+i];return Math.atan(Math.hypot(dx,dy)/(2*cell))/(Math.PI/2)});
  await write('water_wetness',k=>Math.max(WM[k],H[k]<sea?1:0));
  await write('vegetation_density',k=>clamp(SM[k],0,1)*(H[k]<sea?0:1)*(.3+.7*M[k]));
  await write('snow',k=>S.biome.snow>=1?0:smooth(S.biome.snow-.03,S.biome.snow+.03,H[k]/S.shape.maxH));
  return out;
}
