"use strict";
/* Terrain Gen ecology: where plants and debris actually grow (in the spirit of Gaea / World Creator ecosystem masks).
   1. Site factors on a coarse grid: altitude above sea vs. the treeline, slope, water flow, moisture (flow, nearby water,
      concave hollows, shade side vs. sun side), and talus below cliffs.
   2. Species suitability from those factors: conifers tolerate cold and moderate slopes up to the treeline; broadleaf
      wants low, gentle, moist ground; shrubs take edges and rocky slopes; grass and wildflowers open flats; ferns the
      moist forest floor; snags stand near the treeline; boulders gather below cliffs, on high ground and in riverbeds.
   3. A growth simulation: seeds land where conditions are good and forests spread to neighbours over decades while
      poor sites thin out, giving connected stands with soft, natural edges instead of evenly sprinkled trees.
   4. Debris follows the forest: fallen logs and branches under old stands, more along edges and after storms.
   Painting with Plant (and photo vegetation masks) raises the chance trees establish; towns and roads clear ground. */
let ECO=null,ecoKey='';
function ecoCompute(){
  const E=Math.min(N,192),W=S.shape.world,cell=W/(E-1),sea=seaLevel(),h=resample(H,N,E),rel=Math.max(stats.hi-sea,1),P=S.biome.palette;
  const key=[N,E,S.seed,sea.toFixed(2),rel.toFixed(1),S.biome.snow,S.biome.lush,P,S.view.sunAz|0,S.scatter.forest,H[(N*N/3)|0].toFixed(2),H[(N*N*2/3)|0].toFixed(2),stats.hi.toFixed(1)].join('|');
  const n=E*E,hn=new Float32Array(n),sl=new Float32Array(n),m=new Float32Array(n);
  for(let k=0;k<n;k++)hn[k]=(h[k]-sea)/rel;
  for(let j=0;j<E;j++)for(let i=0;i<E;i++){const k=j*E+i,dx=(h[j*E+Math.min(i+1,E-1)]-h[j*E+Math.max(i-1,0)])/(2*cell),dz=(h[Math.min(j+1,E-1)*E+i]-h[Math.max(j-1,0)*E+i])/(2*cell);sl[k]=Math.atan(Math.hypot(dx,dz))*180/Math.PI}
  /* water flow and nearby water */
  const acc=flowAccum(h,E),flow=new Float32Array(n),lmax=Math.log(n);for(let k=0;k<n;k++)flow[k]=clamp(Math.log(acc[k])/lmax*1.6,0,1);
  const wet=new Float32Array(n),wm=resample(WM,N,E);for(let k=0;k<n;k++)wet[k]=h[k]<sea+.3||wm[k]>.5?1:0;const dW=dist2D(wet,E);
  const conc=blurField(h.slice(),E,3);for(let k=0;k<n;k++)conc[k]=clamp((conc[k]-h[k])/(rel*.02),-1,1);
  const az=(S.view.sunAz||135)*Math.PI/180,sx=Math.sin(az),sz=-Math.cos(az),mo=resample(M,N,E);
  for(let j=0;j<E;j++)for(let i=0;i<E;i++){const k=j*E+i,dx=h[j*E+Math.min(i+1,E-1)]-h[j*E+Math.max(i-1,0)],dz=h[Math.min(j+1,E-1)*E+i]-h[Math.max(j-1,0)*E+i],g=Math.hypot(dx,dz)||1,expo=-(dx*sx+dz*sz)/g*smooth(5,25,sl[k]);
    const near=1-smooth(0,90/cell,dW[k]);m[k]=clamp(.32*mo[k]+.32*flow[k]+.22*near+.12*conc[k]-.16*expo+.28*(S.biome.lush-.5)+.1,0,1)}
  /* treeline from the snow line (or high on the tallest peaks when there is no snow) */
  const snowHn=S.biome.snow>=1?1.15:(S.biome.snow*S.shape.maxH-sea)/rel,tl=clamp(snowHn-.08,.18,1.05);
  /* cliffs and the talus below them */
  const cliff=new Float32Array(n);for(let k=0;k<n;k++)cliff[k]=sl[k]>42?1:0;const talus=blurField(cliff.slice(),E,Math.max(2,Math.round(60/cell)));
  const pal={arid:{c:.07,b:.1,g:.55,r:1.6,f:.4},tundra:{c:.75,b:.25,g:.8,r:1.4,f:.5},volcanic:{c:.5,b:.45,g:.7,r:1.5,f:.4},autumn:{c:.8,b:1.3,g:1,r:1,f:1},temperate:{c:1,b:1,g:1,r:1,f:1},photo:{c:1,b:1,g:1,r:1,f:1}}[P]||{c:1,b:1,g:1,r:1,f:1};
  const sm=resample(SM,N,E),nz=makeNoise(S.seed+313);
  const Sc=new Float32Array(n),Sb=new Float32Array(n);
  for(let j=0;j<E;j++)for(let i=0;i<E;i++){const k=j*E+i,a=hn[k],s=sl[k],mm=m[k],dry=h[k]<sea+.3;if(dry){continue}
    Sc[k]=pal.c*smooth(.0,.06,a)*(1-smooth(tl-.06,tl+.02,a))*(1-smooth(30,42,s))*(.3+.7*mm)*(.55+.6*Math.min(1,a/Math.max(tl,.2)));
    Sb[k]=pal.b*smooth(.0,.03,a)*(1-smooth(tl*.5,tl*.72,a))*(1-smooth(20,31,s))*Math.pow(mm,.75)}
  /* growth: seeds, spread, competition, die-back on poor sites */
  const G=Math.min(E,128),sc=resample(Sc,E,G),sb=resample(Sb,E,G),smg=resample(sm,E,G),suit=new Float32Array(G*G),F=new Float32Array(G*G),T=new Float32Array(G*G),rng=mulberry32(S.seed*97+11),fo=S.scatter.forest??1;
  const pn=makeNoise(S.seed+77);for(let k=0;k<G*G;k++){const pu=(k%G)/G,pv=((k/G)|0)/G,patch=clamp(.55+.75*fbm(pn,pu*5,pv*5,4,.5),0,1.2);/* clearings, burns, old windthrow */suit[k]=clamp(Math.pow(Math.max(sc[k],sb[k]),.7)*1.1*patch*Math.min(2.2,smg[k]),0,1);if(rng()<.05*suit[k])F[k]=.5+.4*rng()}
  for(let it=0;it<34;it++){T.set(F);for(let j=0;j<G;j++)for(let i=0;i<G;i++){const k=j*G+i,nb=(T[j*G+Math.max(i-1,0)]+T[j*G+Math.min(i+1,G-1)]+T[Math.max(j-1,0)*G+i]+T[Math.min(j+1,G-1)*G+i])*.25,s=suit[k];
      F[k]=clamp(T[k]+.32*T[k]*(1-T[k])*s+.42*Math.max(0,nb-T[k])*s-.1*(1-s)*T[k],0,1)}}
  const Fe=resample(F,G,E);/* the growth sim decides the shape of the stands; how much forest there is follows how suitable the land is */
  {let ms=0,nl=0;const vals=[];for(let k=0;k<G*G;k++){ms+=suit[k];nl++}for(let k=0;k<n;k++)if(h[k]>=sea+.3)vals.push(Fe[k]);vals.sort((a,b)=>a-b);
   const cov=clamp(ms/nl*1.5*fo,.02,.8),t=vals.length?vals[Math.floor(vals.length*(1-cov))]:1;for(let k=0;k<n;k++)Fe[k]=h[k]<sea+.3?0:smooth(t*.8-.01,t*1.2+.02,Fe[k])*Math.min(1,.55+.6*fo)*smooth(.03,.22,Math.max(Sc[k],Sb[k]))}/* seeds can spread only where trees can live */
  const edge=new Float32Array(n);for(let j=1;j<E-1;j++)for(let i=1;i<E-1;i++){const k=j*E+i;edge[k]=clamp(Math.hypot(Fe[k+1]-Fe[k-1],Fe[k+E]-Fe[k-E])*2.2,0,1)}
  const DFe=resample(DF,N,E),O={E,tl,hn,F:Fe,edge,conifer:new Float32Array(n),broadleaf:new Float32Array(n),bush:new Float32Array(n),grass:new Float32Array(n),flowers:new Float32Array(n),fern:new Float32Array(n),snag:new Float32Array(n),deadfall:new Float32Array(n),branches:new Float32Array(n),boulder:new Float32Array(n)};
  for(let j=0;j<E;j++)for(let i=0;i<E;i++){const k=j*E+i,a=hn[k],s=sl[k],mm=m[k],f=Fe[k],e=edge[k],u=i/(E-1),v=j/(E-1),clear=Math.min(1,sm[k]);if(h[k]<sea+.3){O.boulder[k]=flow[k]>.6?.15:0;continue}
    const cf=Sc[k]/(Sc[k]+Sb[k]+1e-4);O.conifer[k]=f*cf;O.broadleaf[k]=f*(1-cf);
    const open=1-f*.85,meadow=(1-smooth(12,22,s))*(1-smooth(tl,tl+.12,a));
    O.bush[k]=clear*(1-smooth(36,48,s))*(1-smooth(tl+.02,tl+.12,a))*(e*1.3+open*.22*(.4+.6*Math.abs(fbm(nz,u*7,v*7,3,.5))*2)+(1-smooth(0,2,dW[k]*cell/30))*.5*mm)*(pal.r>1.3?.7:1);
    O.grass[k]=clear*pal.g*(1-smooth(28,40,s))*(1-smooth(tl+.04,tl+.18,a))*(.3+.7*mm)*open;
    O.flowers[k]=clear*pal.f*O.grass[k]*meadow*smooth(.3,.75,mm)*smooth(.05,.35,fbm(nz,u*9+4,v*9,3,.5)+.15);
    O.fern[k]=f*smooth(.38,.8,mm)*(1-smooth(28,40,s))*(P==='arid'?.1:1);
    O.snag[k]=(smooth(tl-.13,tl-.04,a)*(1-smooth(tl,tl+.07,a))*.5*(1-smooth(30,45,s))+f*.06+DFe[k]*.6)*clear;
    O.deadfall[k]=(Math.pow(f,1.4)*.55+e*f*.4+DFe[k]*.8)*(1-smooth(25,38,s));
    O.branches[k]=f*.85+e*.25;
    O.boulder[k]=pal.r*(talus[k]*1.4*(1-smooth(45,60,s))+smooth(tl-.02,tl+.15,a)*.45*(1-smooth(40,55,s))+flow[k]*.25*(1-smooth(8,20,s))+.035*open)}
  O.Sc=Sc;O.Sb=Sb;ECO=O;ecoKey=key;return O}
function ecoAt(map,u,v){return sampleField(map,ECO.E,u*(ECO.E-1),v*(ECO.E-1))}
