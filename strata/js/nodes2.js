"use strict";
/* Terrain Gen extra nodes (flow, strata, canyons, craters…), templates, and the touch curve editor. */
function flowAccum(a,R){const n=R*R,idx=new Uint32Array(n);for(let i=0;i<n;i++)idx[i]=i;idx.sort((p,q)=>a[q]-a[p]);const acc=new Float32Array(n).fill(1);
  for(let q=0;q<n;q++){const k=idx[q],i=k%R,j=(k/R)|0;let lo=a[k],t=-1;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){if(!di&&!dj)continue;const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=R||jj>=R)continue;const h=a[jj*R+ii];if(h<lo){lo=h;t=jj*R+ii}}if(t>=0)acc[t]+=acc[k]}return acc}
function curveLUT(pts){const p=pts.slice().sort((a,b)=>a[0]-b[0]),L=new Float32Array(256);for(let i=0;i<256;i++){const x=i/255;let k=0;while(k<p.length-2&&x>p[k+1][0])k++;const a=p[k],b=p[k+1]||a,t=b[0]>a[0]?clamp((x-a[0])/(b[0]-a[0]),0,1):0;L[i]=lerp(a[1],b[1],t*t*(3-2*t))}return L}
Object.assign(NODE_TYPES,{
  billow:{cat:'Generate',label:'Billow',color:'#5b8def',ins:[],params:{scale:P_('Scale',.5,10,.1,3),oct:P_('Detail',1,8,1,5),rough:P_('Roughness',.3,.7,.01,.5),seed:P_('Seed',0,999,1,9)},
    fn(c,_,p){const n=makeNoise(c.seed+p.seed*131),o=octCap(p.oct,c.R,p.scale);return grid(c.R,(u,v)=>{let s=0,a=1,f=1,nm=0;for(let i=0;i<o;i++){s+=a*Math.abs(n(u*p.scale*f+i*7,v*p.scale*f-i*3));nm+=a;a*=p.rough;f*=2.02}return s/nm})}},
  islandmask:{cat:'Generate',label:'Island mask',color:'#5b8def',ins:[],params:{size:P_('Size',.2,1,.01,.7),edge:P_('Edge noise',0,1,.01,.4),soft:P_('Softness',.05,.6,.01,.25),seed:P_('Seed',0,999,1,10)},
    fn(c,_,p){const n=makeNoise(c.seed+p.seed*131);return grid(c.R,(u,v)=>{const dx=u-.5,dy=v-.5,a=Math.atan2(dy,dx),d=Math.hypot(dx,dy)*2/p.size+fbm(n,Math.cos(a)*2+u*3,Math.sin(a)*2+v*3,4,.5)*p.edge*.5;return 1-smooth(1-p.soft,1,d)})}},
  craters:{cat:'Generate',label:'Crater field',color:'#5b8def',ins:['Base'],params:{scale:P_('Count',2,24,.5,7),depth:P_('Depth',0,.6,.01,.25),rim:P_('Rim',0,.4,.01,.12),seed:P_('Seed',0,999,1,11)},
    fn(c,[a],p){const sd=c.seed+p.seed*131,R=c.R;return grid(R,(u,v)=>{worley(u*p.scale,v*p.scale,sd,.9);const sz=.25+.25*WID,d=WF1/sz,b=a?sampleField(a,R,u*(R-1),v*(R-1)):.5;return d>1.3?b:b-p.depth*(1-smooth(0,.8,d))*(.5+WID)+p.rim*Math.exp(-Math.pow((d-.85)/.14,2))})}},
  stratify:{cat:'Modify',label:'Stratify',color:'#a46be8',ins:['In'],params:{layers:P_('Layers',3,30,1,12),tilt:P_('Tilt',0,1,.01,.25),hard:P_('Hardness',0,1,.01,.6),mix:P_('Mix',0,1,.01,.8),seed:P_('Seed',0,999,1,12)},
    fn(c,[a],p){const n=makeNoise(c.seed+p.seed*131),R=c.R;return grid(R,(u,v)=>{const h=sampleField(a,R,u*(R-1),v*(R-1)),t=h*p.layers+(u-.5)*p.tilt*4+fbm(n,u*2,v*2,3,.5)*p.tilt,k=Math.floor(t),f=t-k,e=smooth(.5-p.hard*.45,.5+p.hard*.45,f);return lerp(h,h+(e-f)/p.layers,p.mix)})}},
  canyon:{cat:'Modify',label:'Canyons',color:'#a46be8',ins:['In'],params:{scale:P_('Scale',.5,8,.1,2.5),width:P_('Width',.02,.4,.01,.12),depth:P_('Depth',0,1,.01,.4),seed:P_('Seed',0,999,1,13)},
    fn(c,[a],p){const n=makeNoise(c.seed+p.seed*131),R=c.R;return grid(R,(u,v)=>{const h=sampleField(a,R,u*(R-1),v*(R-1)),w=Math.abs(fbm(n,u*p.scale,v*p.scale,5,.5)),ch=1-smooth(0,p.width,w);return h-p.depth*ch*ch*(.4+.6*h)})}},
  rivers:{cat:'Erosion',label:'Rivers',color:'#2fa38a',ins:['In'],params:{threshold:P_('Threshold',.002,.1,.001,.015),depth:P_('Depth',0,.3,.005,.06),width:P_('Width',0,6,1,2)},
    fn(c,[a],p){const R=c.R,acc=flowAccum(a,R),m=new Float32Array(R*R),thr=p.threshold*R*R;for(let k=0;k<m.length;k++)m[k]=smooth(thr,thr*6,acc[k]);blurField(m,R,Math.round(p.width*R/257)+1);return map(a,0,(h,k)=>h-p.depth*Math.min(1,m[k]*2))},heavy:true},
  flowmask:{cat:'Mask',label:'Flow map',color:'#d9902f',ins:['In'],params:{gain:P_('Contrast',.5,4,.05,1.6)},
    fn(c,[a],p){const R=c.R,acc=flowAccum(a,R),o=new Float32Array(R*R),mx=Math.log(R*R);for(let k=0;k<o.length;k++)o[k]=clamp(Math.pow(Math.log(acc[k])/mx,1/p.gain),0,1);return o},heavy:true},
  curvature:{cat:'Mask',label:'Curvature',color:'#d9902f',ins:['In'],params:{mode:{label:'Select',options:['Ridges','Valleys'],def:'Ridges'},radius:P_('Radius',1,8,1,2),gain:P_('Contrast',1,40,1,12)},
    fn(c,[a],p){const R=c.R,b=blurField(a.slice(),R,p.radius),o=new Float32Array(R*R),s=p.mode==='Ridges'?1:-1;for(let k=0;k<o.length;k++)o[k]=clamp(.5+s*(a[k]-b[k])*p.gain*R/64,0,1);return o}},
  clamp:{cat:'Modify',label:'Clamp',color:'#a46be8',ins:['In'],params:{lo:P_('Floor',0,1,.01,.1),hi:P_('Ceiling',0,1,.01,.9)},fn(c,[a],p){return map(a,0,h=>clamp(h,p.lo,Math.max(p.lo,p.hi)))}},
  fold:{cat:'Modify',label:'Fold',color:'#a46be8',ins:['In'],params:{at:P_('Fold at',.1,.9,.01,.5),mix:P_('Mix',0,1,.01,1)},fn(c,[a],p){return map(a,0,h=>lerp(h,1-Math.abs(h-p.at)/Math.max(p.at,1-p.at),p.mix))}},
  twist:{cat:'Modify',label:'Twist',color:'#a46be8',ins:['In'],params:{angle:P_('Angle',-360,360,1,120),radius:P_('Radius',.1,1,.01,.6),x:P_('Center X',0,1,.01,.5),y:P_('Center Y',0,1,.01,.5)},
    fn(c,[a],p){const R=c.R,A=p.angle*Math.PI/180;return grid(R,(u,v)=>{const dx=u-p.x,dy=v-p.y,d=Math.hypot(dx,dy),t=A*Math.pow(clamp(1-d/p.radius,0,1),2),cs=Math.cos(t),sn=Math.sin(t);return sampleField(a,R,(p.x+dx*cs-dy*sn)*(R-1),(p.y+dx*sn+dy*cs)*(R-1))})}},
  tilt:{cat:'Modify',label:'Tilt',color:'#a46be8',ins:['In'],params:{angle:P_('Direction',0,360,1,90),amount:P_('Amount',-1,1,.01,.3)},
    fn(c,[a],p){const A=p.angle*Math.PI/180,ca=Math.cos(A),sa=Math.sin(A),R=c.R;return map(a,0,(h,k)=>h+((k%R)/(R-1)-.5)*ca*p.amount+(Math.floor(k/R)/(R-1)-.5)*sa*p.amount)}},
  sediment:{cat:'Erosion',label:'Sediment fill',color:'#2fa38a',ins:['In'],params:{amount:P_('Amount',0,1,.01,.5),reach:P_('Reach',1,12,1,5)},
    fn(c,[a],p){const R=c.R,b=blurField(a.slice(),R,Math.round(p.reach*R/128)+1);return map(a,0,(h,k)=>lerp(h,Math.max(h,b[k]),p.amount))}},
  curve:{cat:'Modify',label:'Curve',color:'#a46be8',ins:['In'],params:{pts:{label:'Curve',curve:true,def:[[0,0],[.35,.2],[.7,.75],[1,1]]}},
    fn(c,[a],p){const L=curveLUT(p.pts||[[0,0],[1,1]]);return map(a,0,h=>{const x=clamp(h,0,1)*255,i=Math.min(254,x|0);return lerp(L[i],L[i+1],x-i)})}}
});
// map() in nodes.js takes (a,f); allow (a,0,f) with index
const _map0=map;map=function(a,x,f){if(typeof x==='function')return _map0(a,x);const o=new Float32Array(a.length);for(let k=0;k<a.length;k++)o[k]=f(a[k],k);return o};
Object.assign(GRAPH_TEMPLATES,{
  'River valleys':()=>mkGraph([['m','mountain',40,30,{radius:.7,sharp:1.2,ridges:.7}],['n','noise',40,200,{scale:3}],['c','combine',220,110,{mode:'Add',amount:.3}],['r','rivers',400,110,{threshold:.012,depth:.08}],['e','hydraulic',580,110,{drops:40}],['o','output',760,110,{}]],[['m','c',0],['n','c',1],['c','r',0],['r','e',0],['e','o',0]]),
  'Strata badlands':()=>mkGraph([['n','noise',40,30,{scale:2,oct:6}],['k','canyon',220,30,{width:.1,depth:.45}],['s','stratify',400,30,{layers:14,hard:.7}],['t','thermal',580,30,{talus:38,passes:10}],['o','output',760,30,{}]],[['n','k',0],['k','s',0],['s','t',0],['t','o',0]]),
  'Crater moon':()=>mkGraph([['b','billow',40,30,{scale:2,oct:5}],['c','craters',220,30,{scale:9,depth:.3,rim:.15}],['d','craters',400,30,{scale:22,depth:.12,rim:.06,seed:40}],['o','output',580,30,{}]],[['b','c',0],['c','d',0],['d','o',0]]),
  'Twisted spires':()=>mkGraph([['r','ridged',40,30,{scale:3.4}],['w','twist',220,30,{angle:200,radius:.7}],['f','fold',400,30,{at:.6}],['l','curve',580,30,{pts:[[0,0],[.5,.15],[.8,.6],[1,1]]}],['o','output',760,30,{}]],[['r','w',0],['w','f',0],['f','l',0],['l','o',0]])
});
/* ---------- curve editor (touch): drag points, tap empty space to add, double-tap a middle point to remove ---------- */
function curveEditor(host,pts,onChange){
  const W=260,H=150,pad=10;host.innerHTML=`<svg class="curve" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;touch-action:none;display:block"></svg>`;const sv=host.firstChild;
  const X=x=>pad+x*(W-2*pad),Y=y=>H-pad-y*(H-2*pad),ix=px=>clamp((px-pad)/(W-2*pad),0,1),iy=py=>clamp((H-pad-py)/(H-2*pad),0,1);
  const draw=()=>{const L=curveLUT(pts);let d='';for(let i=0;i<=64;i++){const x=i/64;d+=(i?'L':'M')+X(x).toFixed(1)+' '+Y(L[Math.round(x*255)]).toFixed(1)}
    sv.innerHTML=`<rect x="${pad}" y="${pad}" width="${W-2*pad}" height="${H-2*pad}" rx="8" fill="var(--track)"/>${[.25,.5,.75].map(g=>`<line x1="${X(g)}" x2="${X(g)}" y1="${pad}" y2="${H-pad}" stroke="var(--hair)"/><line y1="${Y(g)}" y2="${Y(g)}" x1="${pad}" x2="${W-pad}" stroke="var(--hair)"/>`).join('')}
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>${pts.map((p,i)=>`<circle data-i="${i}" cx="${X(p[0])}" cy="${Y(p[1])}" r="9" fill="var(--node-head)" stroke="var(--gold)" stroke-width="3"/>`).join('')}`};draw();
  let drag=-1,last=0;const pos=e=>{const r=sv.getBoundingClientRect(),s=W/r.width;return[(e.clientX-r.left)*s,(e.clientY-r.top)*s]};
  sv.onpointerdown=e=>{const [px,py]=pos(e),c=e.target.closest('circle');try{sv.setPointerCapture(e.pointerId)}catch(_){}
    if(c){const i=+c.dataset.i,now=performance.now();if(now-last<320&&i>0&&i<pts.length-1){pts.splice(i,1);draw();onChange(pts);last=0;return}last=now;drag=i}
    else{pts.push([ix(px),iy(py)]);pts.sort((a,b)=>a[0]-b[0]);drag=pts.findIndex(p=>p[0]===ix(px));draw();onChange(pts);haptic(6)}};
  sv.onpointermove=e=>{if(drag<0)return;const [px,py]=pos(e),p=pts[drag];if(drag===0)p[0]=0;else if(drag===pts.length-1)p[0]=1;else p[0]=clamp(ix(px),pts[drag-1][0]+.01,pts[drag+1][0]-.01);p[1]=iy(py);draw();onChange(pts)};
  sv.onpointerup=sv.onpointercancel=()=>{drag=-1};
}
