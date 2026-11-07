"use strict";
/* Strata UI: components (gesture sliders, dropdown popovers, segmented controls with sliding indicators), the bottom sheet with
   swipe detents, the dock, the brush HUD, and the Create / Sculpt / Simulate / Biome / Export panels. */
const CHEV=svg('<path d="m6 9 6 6 6-6"/>',2.4),CHEVR=svg('<path d="m9 6 6 6-6 6"/>',2.4);
const SPARK='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z"/></svg>';
const IC={play:'<path d="M8 5v14l11-7z" fill="currentColor"/>',pause:'<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
  reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',dice:'<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>',
  type:'<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',spring:'<path d="M12 3c2 2.5 3.5 4.3 3.5 6a3.5 3.5 0 0 1-7 0c0-1.7 1.5-3.5 3.5-6z"/><path d="M5 20c2.5-2 4.5-2 7 0s4.5 2 7 0"/>',vent:'<path d="M4 20l5-9 3 3 2-5 6 11z"/><path d="M12 3v3M9 4l1 2M15 4l-1 2"/>',
  focus:'<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',cabin:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',stamp:'<path d="M3 19 9 8l4 6 3-4 5 9z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'};
function getK(k){if(k==='S.res')return N;let o=S;for(const p of k.split('.')){if(o==null)return undefined;o=o[p]}return o}
function setK(k,v){const ps=k.split('.');let o=S;for(let i=0;i<ps.length-1;i++)o=o[ps[i]];o[ps[ps.length-1]]=v}
function defK(k){const [g,f]=k.split('.');if(g==='shape'&&PRESETS[S.preset]&&PRESETS[S.preset].shape[f]!=null)return PRESETS[S.preset].shape[f];if(g==='biome'&&PRESETS[S.preset]&&PRESETS[S.preset].biome[f]!=null)return PRESETS[S.preset].biome[f];let o=DEF();for(const p of k.split('.')){if(o==null)return undefined;o=o[p]}return o}
const FMT={},autoFmt=step=>step>=1?(v=>fmt(v)):step>=.1?(v=>(+v).toFixed(1)):(v=>(+v).toFixed(2));
const pct=v=>Math.round(v*100)+'%',m=v=>fmtLen(v);

/* ---------- gesture slider: drag anywhere (relative), slide your finger away from the bar for fine control, tap to jump,
   double-tap to reset, long-press for Reset / Randomize / Type ---------- */
function sliderRow(k,label,min,max,step,value,def,f){
  FMT[k]=f||FMT[k]||autoFmt(step);const v=value!=null?value:getK(k),id='s_'+k.replace(/\W/g,'_');
  return `<div class="row" data-k="${k}" data-min="${min}" data-max="${max}" data-step="${step}" data-def="${def!=null?def:''}"><label for="${id}">${label}</label><div class="sl" id="${id}" role="slider" tabindex="0" aria-label="${esc(label)}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${v}"><div class="tr"><div class="fi"></div></div><div class="th"></div><div class="bub goldm"></div></div><button class="val" type="button" aria-label="Type a value for ${esc(label)}">${FMT[k](v)}</button></div>`;
}
function bindSliders(root,onChange,defOf){
  onChange=onChange||((k,v,commit)=>{setK(k,v);onParam(k,v,commit)});
  $$('.row[data-k]',root).forEach(row=>{
    const k=row.dataset.k,sl=row.querySelector('.sl'),val=row.querySelector('.val'),lab=row.querySelector('label');if(!sl)return;
    const min=+row.dataset.min,max=+row.dataset.max,step=+row.dataset.step,fi=sl.querySelector('.fi'),th=sl.querySelector('.th'),bub=sl.querySelector('.bub');
    let v=+(row.dataset.k.startsWith('node.')?(sl.getAttribute('aria-valuenow')):getK(k));if(isNaN(v))v=+sl.getAttribute('aria-valuenow');
    const q=x=>{x=clamp(Math.round(x/step)*step,min,max);return +x.toFixed(5)};
    const draw=()=>{const p=(v-min)/(max-min)*100;fi.style.width=p+'%';th.style.left=p+'%';bub.style.left=p+'%';bub.textContent=FMT[k](v);val.textContent=FMT[k](v);sl.setAttribute('aria-valuenow',v)};draw();
    let raf=0;const emit=commit=>{if(commit){cancelAnimationFrame(raf);raf=0;onChange(k,v,true);return}if(raf)return;raf=requestAnimationFrame(()=>{raf=0;onChange(k,v,false)})};
    const setV=(x,commit,anim)=>{const nv=q(x);if(anim){sl.classList.add('anim');setTimeout(()=>sl.classList.remove('anim'),380)}if(nv!==v){v=nv;draw();haptic(4)}emit(commit)};
    const reset=()=>{const d=defOf?defOf(k):(row.dataset.def!==''?+row.dataset.def:defK(k));if(d!=null&&!isNaN(d)){setV(+d,true,true);toast(lab.textContent+' reset')}};
    let st=null,lastTap=0;
    sl.onpointerdown=e=>{st={x:e.clientX,y:e.clientY,lx:e.clientX,v0:v,t:performance.now(),drag:false,id:e.pointerId,lp:setTimeout(()=>{if(st&&!st.drag){st.long=true;sl.classList.remove('on');openMenu(sl,[{v:'reset',label:'Reset to default',icon:IC.reset},{v:'rand',label:'Randomize',icon:IC.dice},{v:'type',label:'Type a value',icon:IC.type}],a=>{if(a==='reset')reset();else if(a==='rand')setV(min+Math.random()*(max-min),true,true);else val.click()})}},520)}};
    sl.onpointermove=e=>{if(!st||st.long)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;
      if(!st.drag){if(Math.abs(dx)>6&&Math.abs(dx)>Math.abs(dy)){st.drag=true;clearTimeout(st.lp);try{sl.setPointerCapture(st.id)}catch(_){}sl.classList.add('on')}else if(Math.abs(dy)>8){clearTimeout(st.lp);st=null}return}
      const w=sl.getBoundingClientRect().width,away=Math.max(0,Math.abs(dy)-24),fine=1/(1+away/40);sl.classList.toggle('fine',fine<.6);
      if(st.raw==null)st.raw=v;st.raw=clamp(st.raw+(e.clientX-st.lx)/w*(max-min)*fine,min,max);st.lx=e.clientX;
      const p=(st.raw-min)/(max-min)*100;fi.style.width=p+'%';th.style.left=p+'%';bub.style.left=p+'%';const nv=q(st.raw);
      if(nv!==v){v=nv;bub.textContent=FMT[k](v);val.textContent=FMT[k](v);sl.setAttribute('aria-valuenow',v);haptic(3);emit(false)}};
    const up=e=>{if(!st)return;clearTimeout(st.lp);const s=st;st=null;sl.classList.remove('on','fine');if(s.long)return;
      if(s.drag){draw();emit(true);regenArmed=true;return}
      if(e.type==='pointercancel')return;const now=performance.now();
      if(now-lastTap<320){lastTap=0;reset();return}lastTap=now;
      const r=sl.getBoundingClientRect();setTimeout(()=>{if(lastTap===now){setV(min+clamp((s.x-r.left)/r.width,0,1)*(max-min),true,true);regenArmed=true}},300)};
    sl.onpointerup=up;sl.onpointercancel=up;
    sl.onkeydown=e=>{const d={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1}[e.key];if(!d)return;e.preventDefault();setV(v+d*step*(e.shiftKey?10:1),true)};
    val.onclick=()=>{const inp=document.createElement('input');inp.className='num';inp.type='number';inp.inputMode='decimal';inp.step=step;inp.value=v;val.replaceWith(inp);inp.focus();inp.select();
      let done=false;const fin=ok=>{if(done)return;done=true;if(ok&&inp.value!==''&&!isNaN(+inp.value))setV(+inp.value,true,true);inp.replaceWith(val)};inp.onkeydown=e=>{if(e.key==='Enter')fin(true);if(e.key==='Escape')fin(false)};inp.onblur=()=>fin(true)};
  });
}
function tg(k,label,small){const id='t_'+k.replace(/\W/g,'_');return `<label class="toggle" for="${id}"><span>${label}${small?`<small>${small}</small>`:''}</span><span class="switch"><input type="checkbox" id="${id}" data-tk="${k}" ${getK(k)?'checked':''}><span></span></span></label>`}
function bindToggles(root,onChange){$$('input[data-tk]',root).forEach(c=>c.onchange=()=>{const k=c.dataset.tk;setK(k,c.checked);haptic(6);(onChange||onParam)(k,c.checked,true)})}
function seg(k,opts,cls){return `<div class="seg ${cls||''}" role="group"><span class="ind"></span>${opts.map(([v,l])=>`<button type="button" data-seg="${k}" data-v="${v}" aria-pressed="${String(getK(k))===String(v)}">${l}</button>`).join('')}</div>`}
function segIndicator(el){if(!el)return;let ind=el.querySelector(':scope > .ind');if(!ind){ind=document.createElement('span');ind.className='ind';el.prepend(ind)}const b=el.querySelector('button[aria-pressed="true"]');if(!b){ind.style.opacity=0;return}ind.style.opacity=1;ind.style.width=b.offsetWidth+'px';ind.style.transform=`translateX(${b.offsetLeft}px)`}
function bindSegs(root,onChange){
  $$('.seg',root).forEach(s=>requestAnimationFrame(()=>segIndicator(s)));
  $$('[data-seg]',root).forEach(x=>x.onclick=()=>{const k=x.dataset.seg,raw=x.dataset.v,v=isNaN(+raw)?raw:+raw;const s=x.closest('.seg');$$('[data-seg]',s).forEach(y=>y.setAttribute('aria-pressed',y===x));segIndicator(s);haptic(6);(onChange||((k,v)=>{setK(k,v);onParam(k,v,true)}))(k,v)})}
function ddBtn(id,label,cls){return `<button class="dd ${cls||'metal'} press" id="${id}" type="button" aria-haspopup="listbox"><span>${esc(label)}</span>${CHEV}</button>`}
const acc=(title,body,open,sum)=>`<details class="acc"${open?' open':''}><summary>${title}${sum!=null?`<span class="sum">${sum}</span>`:''}<span class="chev" style="${sum!=null?'margin-left:8px':'margin-left:auto'}">${CHEVR}</span></summary><div class="acc-body">${body}</div></details>`;

/* ---------- dial (angles) and time-of-day strip ---------- */
const COMPASS=v=>['E','SE','S','SW','W','NW','N','NE'][Math.round(v/45)%8];
function dialRow(k,label,f){FMT[k]=f||(v=>COMPASS(v)+' '+Math.round(v)+'°');const v=getK(k);return `<div class="row dialrow" data-dk="${k}"><label>${label}</label><div class="dial" role="slider" tabindex="0" aria-label="${esc(label)}" aria-valuenow="${v}"><i style="transform:rotate(${v}deg)"></i><b>${COMPASS(v)}</b></div><span class="val" style="font-family:var(--f-mono);font-size:12px;text-align:right;color:var(--ink-2)">${FMT[k](v)}</span></div>`}
function bindDials(root,onChange){$$('[data-dk]',root).forEach(row=>{const k=row.dataset.dk,d=row.querySelector('.dial'),i=d.querySelector('i'),bb=d.querySelector('b'),val=row.querySelector('.val');let on=false;
  const put=a=>{a=((Math.round(a)%360)+360)%360;i.style.transform=`rotate(${a}deg)`;bb.textContent=COMPASS(a);val.textContent=FMT[k](a);d.setAttribute('aria-valuenow',a);if(getK(k)!==a){setK(k,a);sfx('tick');(onChange||onParam)(k,a,false)}};
  const at=e=>{const r=d.getBoundingClientRect();put(Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))*180/Math.PI)};
  d.onpointerdown=e=>{on=true;try{d.setPointerCapture(e.pointerId)}catch(_){}at(e)};d.onpointermove=e=>{if(on)at(e)};d.onpointerup=d.onpointercancel=()=>{if(on){on=false;(onChange||onParam)(k,getK(k),true)}};
  d.onkeydown=e=>{const s={ArrowLeft:-5,ArrowRight:5,ArrowUp:5,ArrowDown:-5}[e.key];if(s){e.preventDefault();put(getK(k)+s)}}})}
function todHTML(){return `<div class="tod" id="tod" role="slider" aria-label="Time of day" tabindex="0"><svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M2 36 Q50 -26 98 36" fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".8" stroke-dasharray="2 2"/></svg><div class="sun"></div><small style="left:10px">Dawn</small><small style="left:50%;transform:translateX(-50%)">Noon</small><small style="right:10px">Dusk</small></div>`}
function bindTod(root){const el=$('#tod',root);if(!el)return;const sun=el.querySelector('.sun');
  const place=()=>{const t=S.view.tod,x=2+t*96,y=36-62*t*(1-t)*1.0;sun.style.left=x+'%';sun.style.top=(y/40*100)+'%'};place();
  const apply=t=>{S.view.tod=clamp(t,0,1);S.view.sunEl=4+78*Math.sin(Math.PI*S.view.tod);S.view.sunAz=(90+S.view.tod*180)%360;place();fitSun();sfx('tick');saveSoon()};
  let on=false;const at=e=>{const r=el.getBoundingClientRect();apply((e.clientX-r.left)/r.width)};
  el.onpointerdown=e=>{on=true;try{el.setPointerCapture(e.pointerId)}catch(_){}at(e)};el.onpointermove=e=>{if(on)at(e)};el.onpointerup=el.onpointercancel=()=>{on=false};
  el.onkeydown=e=>{const s={ArrowLeft:-.03,ArrowRight:.03}[e.key];if(s){e.preventDefault();apply(S.view.tod+s)}}}

/* ---------- popovers ---------- */
let popEl=null,popClose=null;
function openPanel(anchor,html,onMount,opts){
  closePanel(true);const layer=$('#menuLayer');layer.classList.add('on');
  const p=document.createElement('div');p.className='pop';p.setAttribute('role',opts&&opts.role||'dialog');p.innerHTML=html;layer.appendChild(p);
  if(opts&&opts.width)p.style.width=Math.min(opts.width,innerWidth-24)+'px';
  const r=anchor.getBoundingClientRect(),pw=p.offsetWidth,ph=p.offsetHeight,below=innerHeight-r.bottom,above=r.top;
  p.style.left=clamp(r.left+r.width/2-pw/2,12,innerWidth-pw-12)+'px';
  if(below>=Math.min(ph,340)+16||below>=above){p.style.top=(r.bottom+8)+'px';p.style.maxHeight=(below-24)+'px'}else{p.style.bottom=(innerHeight-r.top+8)+'px';p.style.maxHeight=(above-24)+'px';p.style.transformOrigin='bottom center'}
  popEl=p;popClose=opts&&opts.onClose;layer.onpointerdown=e=>{if(e.target===layer)closePanel()};
  onMount&&onMount(p);
}
function closePanel(instant){if(!popEl)return;const p=popEl;popEl=null;$('#menuLayer').classList.remove('on');if(instant)p.remove();else{p.classList.add('out');setTimeout(()=>p.remove(),180)}const c=popClose;popClose=null;c&&c()}
addEventListener('keydown',e=>{if(e.key==='Escape'){if(popEl)closePanel();else if(!$('#home').hidden)closeHome();else if(!$('#helper').hidden)closeHelper()}});
function openMenu(anchor,items,onPick,current){
  const html=items.map((it,i)=>it.head?`<h4>${esc(it.head)}</h4>`:`<button class="it press" role="option" data-i="${i}">${it.icon?`<span class="ic">${svg(it.icon)}</span>`:''}${it.sw?`<span class="sw" style="background:${it.sw}"></span>`:''}<span>${esc(it.label)}${it.sub?`<small>${esc(it.sub)}</small>`:''}</span>${current!=null&&String(it.v)===String(current)?`<span class="ck">${svg('<path d="m5 12 5 5 9-10"/>',2.6)}</span>`:''}</button>`).join('');
  openPanel(anchor,html,p=>$$('[data-i]',p).forEach(b=>b.onclick=()=>{const it=items[+b.dataset.i];closePanel();haptic(6);onPick(it.v)}),{role:'listbox'});
}

/* ---------- sheet + dock ---------- */
const TABS=[
  ['create','Create','<path d="M2 19 9 7l4 6 3-4 6 10z"/><path d="M18 3v4M16 5h4"/>'],
  ['sculpt','Sculpt','<path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/>'],
  ['simulate','Simulate','<path d="M3 15c2 0 2-1.5 4.5-1.5S10 15 12 15s2.5-1.5 4.5-1.5S19 15 21 15"/><path d="M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19"/><path d="M12 3c2 2.5 3.5 4.3 3.5 6a3.5 3.5 0 0 1-7 0c0-1.7 1.5-3.5 3.5-6z"/>'],
  ['biome','Biome','<path d="M12 21v-6"/><path d="M12 3l5 7h-3l4 5H6l4-5H7z"/>'],
  ['export','Export','<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 18v2h16v-2"/>']
];
const DETENT_DEFAULT={create:'peek',sculpt:'peek',simulate:'peek',biome:'peek',export:'half'};
const landscape=()=>innerWidth>innerHeight&&innerHeight<=560;
let sheetState='half',insets={t:0,b:0};
function measureInsets(){const p=document.createElement('div');p.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden';document.body.appendChild(p);const cs=getComputedStyle(p);insets={t:parseFloat(cs.paddingTop)||0,b:parseFloat(cs.paddingBottom)||0};p.remove()}
const wide=()=>matchMedia('(min-width:900px)').matches;
const compact=()=>!document.body.classList.contains('ui-large');
function detentH(s){const dockH=compact()?60:72,top=insets.t+(compact()?60:70),avail=innerHeight-top-dockH-insets.b-22;return s==='peek'?Math.min(compact()?156:190,avail):s==='full'?avail:Math.min(Math.max(innerHeight*.45,300),avail)}
function layoutSheet(h){
  if(landscape()){setViewShift(0,178);return}
  if(wide()){setViewShift(0);return}
  const H_=h!=null?h:detentH(sheetState);$('#sheet').style.setProperty('--sheet-h',H_+'px');$('#bottom').style.setProperty('--sheet-h',H_+'px');
  const topY=insets.t+66,botY=innerHeight-H_-(compact()?60:72)-insets.b-20,c=(topY+botY)/2;setViewShift(Math.max(0,innerHeight/2-c));
}
function setDetent(s){sheetState=s;document.body.classList.toggle('sheet-full',s==='full');layoutSheet();haptic(5)}
function sheetGesture(el,allowSwipe){const sh=$('#sheet');let st=null;
  el.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,textarea,.dd'))return;st={x:e.clientX,y:e.clientY,h:sh.getBoundingClientRect().height,mode:null,id:e.pointerId}});
  el.addEventListener('pointermove',e=>{if(!st)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;
    if(!st.mode){if(Math.abs(dy)>6&&Math.abs(dy)>=Math.abs(dx)){st.mode='v';sh.classList.add('dragging');try{el.setPointerCapture(st.id)}catch(_){}}else if(allowSwipe&&Math.abs(dx)>10){st.mode='h';try{el.setPointerCapture(st.id)}catch(_){}}else return}
    if(st.mode==='v')layoutSheet(clamp(st.h-dy,110,detentH('full')))});
  const up=e=>{if(!st)return;const s=st;st=null;sh.classList.remove('dragging');
    if(s.mode==='v'){const h=sh.getBoundingClientRect().height,vy=e.clientY-s.y;let best='half',bd=1e9;for(const d of ['peek','half','full']){const dd=Math.abs(detentH(d)-h);if(dd<bd){bd=dd;best=d}}if(Math.abs(vy)>70)best=vy<0?(sheetState==='peek'?'half':'full'):(sheetState==='full'?'half':'peek');setDetent(best);return}
    if(s.mode==='h'){const dx=e.clientX-s.x;if(Math.abs(dx)>50){const i=TABS.findIndex(t=>t[0]===S.tab),n=clamp(i+(dx<0?1:-1),0,TABS.length-1);if(n!==i)switchTab(TABS[n][0],null,dx<0?'enter-r':'enter-l')}return}
    if(el.id==='grab')setDetent(sheetState==='peek'?'half':sheetState==='half'?'full':'peek')};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)}
sheetGesture($('#grab'),false);sheetGesture($('#sheetHead'),true);
$('#grab').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDetent(sheetState==='full'?'half':'full')}};
$('#dock').insertAdjacentHTML('beforeend',TABS.map(([k,l,p])=>`<button role="tab" class="press" id="tab_${k}" data-tab="${k}" aria-selected="false">${svg(p)}${l}</button>`).join(''));
function dockIndicator(){const b=$(`#tab_${S.tab}`),ind=$('#dockInd');if(!b)return;ind.style.width=b.offsetWidth+'px';ind.style.transform=`translateX(${b.offsetLeft}px)`}
let dockPress=0;
$('#dock').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-tab]');if(!b)return;dockPress=setTimeout(()=>{dockPress=-1;dockQuick(b)},520)});
$('#dock').addEventListener('pointerup',()=>{if(dockPress>0)clearTimeout(dockPress)});
$('#dock').onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;if(dockPress===-1){dockPress=0;return}const t=b.dataset.tab;if(t===S.tab){setDetent(sheetState==='peek'?(DETENT_DEFAULT[t]==='peek'?'half':DETENT_DEFAULT[t]):'peek');return}
  const i=TABS.findIndex(x=>x[0]===S.tab),j=TABS.findIndex(x=>x[0]===t);switchTab(t,null,j>i?'enter-r':'enter-l')};
function dockQuick(b){const t=b.dataset.tab;haptic(14);const items={
  create:[{v:()=>{S.seed=(Math.random()*1e6)|0;regenerate();toast('Seed '+S.seed)},label:'New random seed',icon:IC.dice},{v:()=>switchTab('create','nodes'),label:'Open nodes',icon:IC.stamp},{v:()=>{switchTab('create','photo');pickPhoto()},label:'Build from a photo',icon:IC.cabin}],
  sculpt:TOOLS.slice(0,6).map(([k,l,p])=>({v:()=>{switchTab('sculpt');setTool(k)},label:l,icon:p})),
  simulate:Object.keys(SIMDEF).map(k=>({v:()=>{switchTab('simulate',k);simStart(k)},label:'Run '+SIMDEF[k].title.toLowerCase(),icon:IC.play})),
  biome:Object.entries(PALETTES).map(([k,p])=>({v:()=>{S.biome.palette=k;recolorSoon();scatterSoon()},label:p.name,sw:`linear-gradient(135deg,rgb(${p.lush}),rgb(${p.rock}) 60%,rgb(${p.snow}))`})),
  export:Object.entries(EXPORT_TARGETS).filter(([k])=>k!=='custom').map(([k,x])=>({v:()=>{S.exp.target=k;exportNow()},label:'Export for '+x.n,icon:IC.play}))}[t];
  openMenu(b,items,f=>f())}
function switchTab(t,sub,anim){S.tab=t;if(sub){if(t==='create')S.sub.create=sub;if(t==='simulate')S.sub.sim=sub}
  if(t==='sculpt'&&S.mode!=='sculpt')setMode('sculpt');if(t!=='sculpt'&&t!=='simulate'&&['spring','channel','vent'].includes(S.tool))S.tool='raise';if(t!=='sculpt'&&S.mode==='sculpt'&&!(t==='simulate'&&['spring','channel','vent'].includes(S.tool)))setMode('orbit');
  setDetent(t==='create'&&S.sub.create==='nodes'?'full':DETENT_DEFAULT[t]||'half');renderSheet(anim||'enter');saveSoon()}
function setMode(m){S.mode=m;const o=$('#modeOrbit'),s=$('#modeSculpt');o.setAttribute('aria-pressed',m==='orbit');s.setAttribute('aria-pressed',m==='sculpt');o.className='press'+(m==='orbit'?' anodized':'');s.className='press'+(m==='sculpt'?' anodized':'');
  $('#hud').hidden=m!=='sculpt'||!['raise','lower','smooth','flatten','roughen','terrace','erode','stamp','paint','plant','channel'].includes(S.tool);drawHud();
  if(m==='orbit'){placeRing(null);$('#readout').hidden=true}else if(SET.hints)toast(matchMedia('(pointer:coarse)').matches?'One finger uses the tool · two fingers move the camera':'Drag uses the tool · right-drag orbits · [ ] resize');
  if(S.tab==='sculpt')renderHead()}
$('#modeOrbit').onclick=()=>setMode('orbit');$('#modeSculpt').onclick=()=>setMode('sculpt');$('#frameBtn').onclick=()=>frame(true);
function setTool(t){S.tool=t;if(S.mode!=='sculpt')setMode('sculpt');else setMode('sculpt');if(S.tab==='sculpt'||S.tab==='simulate')renderSheet()}
function crumb(){$('#crumb').textContent=`${S.name} · ${N}²`}

/* ---------- brush HUD (vertical size/strength sliders while sculpting) ---------- */
function drawHud(){const W=S.shape.world,sz=$('#hudSize'),st=$('#hudStr');if(!sz)return;const ps=Math.log(S.brush.size/5)/Math.log(W*.3/5);sz.querySelector('i').style.height=clamp(ps,0,1)*100+'%';sz.querySelector('b').textContent=fmt(S.brush.size*2);st.querySelector('i').style.height=S.brush.strength*100+'%';st.querySelector('b').textContent=Math.round(S.brush.strength*100)}
for(const [id,apply] of [['hudSize',p=>{const W=S.shape.world;S.brush.size=5*Math.pow(W*.3/5,p)}],['hudStr',p=>{S.brush.strength=clamp(p,.05,1)}]]){const el=$('#'+id);let on=false;
  const at=e=>{const r=el.getBoundingClientRect();return clamp(1-(e.clientY-r.top)/r.height,0,1)};
  el.onpointerdown=e=>{on=true;try{el.setPointerCapture(e.pointerId)}catch(_){}apply(at(e));drawHud();placeRing(hoverP)};el.onpointermove=e=>{if(!on)return;apply(at(e));drawHud();placeRing(hoverP)};el.onpointerup=el.onpointercancel=()=>{on=false;if(S.tab==='sculpt')renderSheet();saveSoon()};
  el.onkeydown=e=>{const d={ArrowUp:.05,ArrowDown:-.05}[e.key];if(!d)return;e.preventDefault();const cur=id==='hudSize'?Math.log(S.brush.size/5)/Math.log(S.shape.world*.3/5):S.brush.strength;apply(clamp(cur+d,0,1));drawHud()}}

/* ---------- view menu (rail) ---------- */
$('#viewBtn').onclick=e=>{
  const html=`<h4>Look</h4><div style="padding:0 6px 6px">${ddBtn('lookDD',LOOKS[S.view.look].n,'metal wide')}</div>
  <h4>Show</h4><div style="padding:0 8px">${tg('view.water','Water')}${tg('view.base','Diorama base')}${tg('view.shadows','Shadows')}${tg('view.contours','Contour lines','Every '+CU.uInterval.value+' m, bold every 5th')}${tg('view.anim','Moving water','Sleeps when you stop touching')}${tg('view.clouds','Drifting cloud shadows','Cheap, and pauses when idle')}${tg('view.mask','Show sculpt mask')}${tg('view.wire','Wireframe')}</div>
  <h4>Render</h4><div style="padding:0 8px">${tg('view.post','Render mode','Anti-aliasing, color grade, depth blur on screen')}</div><div class="btns" style="padding:0 8px 8px;margin-top:2px"><button class="btn anodized press" id="vmCam">Open camera</button></div>
  <h4>Time of day</h4>${todHTML()}<div style="padding:0 8px">${dialRow('view.sunAz','Sun from')}${sliderRow('view.vex','Exaggerate',.5,3,.05,null,1,v=>(+v).toFixed(2)+'×')}</div>`;
  openPanel(e.currentTarget,html,p=>{
    $('#lookDD',p).onclick=ev=>openMenu(ev.currentTarget,Object.entries(LOOKS).map(([k,l])=>({v:k,label:l.n,sub:l.d})),v=>{setLook(v);saveSoon()},S.view.look);
    bindToggles(p);bindSliders(p);bindDials(p);bindTod(p);$('#vmCam',p).onclick=()=>{closePanel(true);camEnter()};
  },{width:330});
};

/* ---------- panels ---------- */
const TIPS={
  generate:'Drag the <b>character pad</b> to reshape the whole range: right is more rugged, down is older and more eroded. Long-press any slider for Reset or Randomize; slide your finger away from a slider for fine control.',
  nodes:'Tap an output dot, then an input dot to wire nodes. Drag the background to pan, pinch to zoom. Changes rebuild the land live.',
  photo:'Pick any picture. The AI separates <b>terrain</b> from <b>roads, rivers, bridges and buildings</b>, so a road stays a road. Without AI, thin lines are filtered out before heights are made.',
  sculpt:'Pick a group (Shape, Detail, Surface), then a tool. <b>Pinch</b> sharpens ridges, <b>Crease</b> cuts fine valleys, <b>Smudge</b> drags land along your stroke, and <b>Mask</b> protects areas. Use the <b>size</b> and <b>strength</b> bars on the left edge while sculpting. Dabs follow your finger evenly; turn on <b>Airbrush</b> to keep building while you hold still. Long-press the map in camera mode for quick actions.',
  simulate:'Pick a simulation, choose how long, and tap play. The ring fills as it runs and turns gold when the result is <b>baked into the land</b>. Every run can be undone.',
  biome:'Colors follow height, slope, moisture and wetness. Trees and rocks follow per-type rules and stay off roads, sand, rock and riverbeds. Paint with <b>Plant</b> in Sculpt to grow or clear areas.',
  export:'Pick where it is going. Every package uses <b>one seamless 0–1 UV square</b> with baked albedo, normal and AO maps, so lower mesh detail keeps its look.'
};
function renderHead(){
  const t=S.tab,hd=$('#sheetHead');let h='';
  if(t==='create')h=`<h2>Create</h2><span class="grow"></span>${S.sub.create==='generate'?ddBtn('presetDD',S.preset):S.sub.create==='nodes'?`<button class="dd anodized press" id="gBuild"><span>Build</span></button>`:`<button class="dd metal press" id="pickTop">${svg('<path d="M12 5v14M5 12h14"/>',2.4)}<span>${REF.img?'Change':'Pick image'}</span></button>`}`;
  if(t==='sculpt')h=`<h2>Sculpt</h2><span class="grow"></span><span class="tag ${S.mode==='sculpt'?'on':''}">${S.mode==='sculpt'?'Brush on':'Camera'}</span>`;
  if(t==='simulate')h=`<h2>Simulate</h2><span class="grow"></span>${SR.running?`<span class="tag on">${SIMDEF[SR.kind].title} running</span>`:''}`;
  if(t==='biome')h=`<h2>Biome</h2><span class="grow"></span>${ddBtn('palDD',PALETTES[S.biome.palette].name)}`;
  if(t==='export')h=`<h2>Export</h2><span class="grow"></span><button class="dd anodized press" id="expTop">${svg('<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 18v2h16v-2"/>')}<span>Export</span></button>`;
  hd.innerHTML=h;const on=(id,f)=>{const el=$('#'+id,hd);if(el)el.onclick=f};
  on('presetDD',e=>openMenu(e.currentTarget,Object.keys(PRESETS).map(k=>({v:k,label:k,sub:PALETTES[PRESETS[k].biome.palette].name+' · '+fmtLen(PRESETS[k].shape.maxH)+' relief'})),v=>{applyPreset(v);toast(v+' loaded','ok')},S.preset));
  on('gBuild',()=>buildFromGraph());on('pickTop',pickPhoto);on('expTop',exportNow);
  on('palDD',e=>openMenu(e.currentTarget,Object.entries(PALETTES).map(([k,p])=>({v:k,label:p.name,sw:`linear-gradient(135deg,rgb(${p.lush}),rgb(${p.rock}) 60%,rgb(${p.snow}))`})),v=>{S.biome.palette=v;recolorSoon();scatterSoon();renderHead()},S.biome.palette));
}
const prompt_=(id,ph)=>`<div class="prompt"><textarea id="${id}" rows="1" placeholder="${ph}" aria-label="${ph}"></textarea><button class="goldm press" id="${id}Go" aria-label="Ask AI">${SPARK}</button></div><div class="ai-note" id="${id}Note"></div>`;
function renderSheet(anim){
  const t=S.tab,b=$('#sheetBody');crumb();renderHead();
  $$('#dock [data-tab]').forEach(x=>x.setAttribute('aria-selected',x.dataset.tab===t));requestAnimationFrame(dockIndicator);
  let h='';
  if(t==='create'){
    const sub=S.sub.create;h=seg('sub.create',[['generate','Generate'],['nodes','Nodes'],['photo','Photo']],'big')+'<div style="height:10px"></div>';
    if(sub==='generate'){
      h+=`${prompt_('genPrompt','Describe a landscape…')}
      <div class="padwrap"><div class="pad" id="pad" role="slider" aria-label="Character pad: ruggedness and age" tabindex="0"><span class="ax" style="left:50%;top:8px;transform:translateX(-50%)">Young</span><span class="ax" style="left:50%;bottom:8px;transform:translateX(-50%)">Ancient</span><span class="ax" style="left:9px;top:50%;transform:translateY(-50%)">Gentle</span><span class="ax" style="right:9px;top:50%;transform:translateY(-50%)">Rugged</span><div class="knob" id="knob"></div></div><div class="preview"><canvas id="genPrev"></canvas></div></div>
      <div class="label">Seed & variations</div><div class="seedrow"><label class="seed" for="seedIn"><span>Seed</span><input id="seedIn" inputmode="numeric" value="${S.seed}"></label><button class="btn metal press" id="dice" style="flex:none;min-width:0;width:44px;padding:0" aria-label="Random seed">${svg(IC.dice)}</button><button class="btn plain press" id="reroll" style="flex:none;min-width:0;padding:0 14px">More</button></div>
      <div class="vars" id="vars">${[0,1,2,3].map(i=>`<button class="press" data-var="${i}"><canvas></canvas><small></small></button>`).join('')}</div><div style="height:8px"></div>
      ${acc('Landform',sliderRow('shape.freq','Scale',.8,6,.05)+sliderRow('shape.oct','Detail',3,8,1,null,null,v=>v+' oct')+sliderRow('shape.gain','Roughness',.3,.65,.01)+sliderRow('shape.ridges','Ridges',0,1,.01,null,null,pct)+sliderRow('shape.warp','Warp',0,1,.01,null,null,pct)+sliderRow('shape.peaks','Peaks',.6,3,.05),true)}
      ${acc('Features',sliderRow('shape.cone','Central peak',0,1,.01,null,null,pct)+sliderRow('shape.crater','Crater',0,1,.01,null,null,pct)+sliderRow('shape.island','Island',0,1,.01,null,null,pct)+sliderRow('shape.terrace','Terraces',0,1,.01,null,null,pct)+sliderRow('shape.tsteps','Steps',3,14,1))}
      ${acc('Size',sliderRow('shape.maxH','Max height',20,1200,5,null,null,m)+sliderRow('shape.world','World size',400,8000,50,null,null,m),false,fmtLen(S.shape.world))}
      <div class="facts" id="facts"></div><p class="tip" style="margin-top:12px">${TIPS.generate}</p>`;
    }else if(sub==='nodes'){h+=`${prompt_('nodePrompt','Describe a node graph…')}<div id="gHost"></div><p class="tip" style="margin-top:10px">${TIPS.nodes}</p>`}
    else{const P=S.photo;
      h+=`<div class="photo-drop"><button class="thumb press" id="pickThumb" aria-label="Pick image" style="${REF.url?`background-image:url(${REF.url})`:''}">${REF.url?'':svg('<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/>')}</button>
        <div style="flex:1;min-width:0"><div class="label" style="margin-top:0">Interpret as</div>${ddBtn('modeDD',PHOTO_MODES[P.mode].n,'metal wide')}<p class="hint">${PHOTO_MODES[P.mode].d}</p></div></div>
      ${REF.status?`<p class="ai-note" style="margin-top:10px">${esc(REF.status)}</p>`:''}<div style="height:6px"></div>
      ${sliderRow('photo.height','Height',0,1,.01,null,.6,pct)+sliderRow('photo.detail','Roughness',0,1,.01,null,.2,pct)+sliderRow('photo.blur','Smoothing',0,8,1,null,2)}
      ${tg('photo.quick','Build as soon as I pick an image','One tap: pick, watch the analysis, done')}${tg('photo.ai','AI reading','Claude studies style, light, water, roads, bridges, buildings and props')}${tg('photo.thin','Ignore thin lines','Keeps roads, fences and wires from becoming ridges')}${tg('photo.scatter','Grow what the AI sees','Sets forest, bush, grass and rock density')}${tg('photo.colors','Colors from image','For top-down maps and aerial photos')}${tg('photo.invert','Invert brightness')}${tg('photo.pin','Pin reference on screen','Sculpt by eye against the picture')}
      <div class="btns"><button class="btn anodized press" id="photoBuild" ${REF.img?'':'disabled'}>Build terrain</button></div>${REF.ai?`<div class="btns"><button class="btn plain press" id="photoReread">Read again with AI</button></div>`:''}
      <p class="tip" style="margin-top:12px">${TIPS.photo}</p>`}
  }else if(t==='sculpt'){
    const cat=S.brush.cat||'shape',tl=TOOL_CATS[cat].t;
    const ctxh=S.tool==='stamp'?`<div class="label">Landform stamp · tap the map to place</div><div class="chips">${Object.entries(STAMPS).map(([k,l])=>`<button class="chipb press" data-stamp="${k}" aria-pressed="${S.stamp===k}">${l}</button>`).join('')}</div>`:
      S.tool==='paint'?`<div class="label">Paint material</div><div class="chips">${Object.entries(PAINTS).map(([k,p])=>`<button class="chipb press" data-paint="${k}" aria-pressed="${S.paint===k}">${p.c?`<span class="swatch" style="background:rgb(${p.c})"></span>`:''}${p.n}</button>`).join('')}</div>`:
      S.tool==='plant'?`<div class="label">Vegetation</div>${seg('plant',[['add','Grow more'],['remove','Clear area']])}`:
      S.tool==='mask'?`<div class="label">Mask protects land from every height tool</div>${seg('maskMode',[['add','Protect'],['remove','Unprotect']])}<div class="btns"><button class="btn plain press" id="mkSlope">Protect cliffs</button><button class="btn plain press" id="mkInv">Invert</button><button class="btn plain press" id="mkClr">Clear</button></div>`:'';
    h=`<div class="chips">${Object.entries(TOOL_CATS).map(([k,c])=>`<button class="chipb press" data-tcat="${k}" aria-pressed="${cat===k}">${c.n}</button>`).join('')}</div>
    <div class="tools">${TOOLS.filter(t=>tl.includes(t[0])).map(([k,l,p])=>`<button class="tool press${S.tool===k?' anodized':''}" data-tool="${k}" aria-pressed="${S.tool===k}">${svg(p)}${l}</button>`).join('')}</div>${ctxh}
    ${acc('Brush',sliderRow('brush.size','Size',5,Math.round(S.shape.world*.3),1,null,240,v=>fmtLen(v*2))+sliderRow('brush.strength','Strength',.05,1,.01,null,.5,pct)+sliderRow('brush.falloff','Softness',0,1,.01,null,.7,pct)
      +`<div class="row" style="grid-template-columns:96px 1fr"><label>Tip</label>${ddBtn('shapeDD',BRUSH_SHAPES[S.brush.shape]||'Soft','metal wide')}</div><div class="row" style="grid-template-columns:96px 1fr"><label>Symmetry</label>${ddBtn('symDD',SYMS[S.brush.sym]||'Off','metal wide')}</div>`
      +sliderRow('brush.lazy','Stabilizer',0,.9,.01,null,.25,pct)+tg('brush.hold','Airbrush','Keep building while you hold still'),true)}
    <p class="tip" style="margin-top:10px">${TIPS.sculpt}</p>`;
  }else if(t==='simulate'){
    const k=S.sub.sim,d=SIMDEF[k],run=SR.running&&SR.kind===k,lv=S.sim.level;
    const KINDS=[['water','Water'],['lava','Lava'],['snow','Snow'],['wind','Wind'],['erode','Erode']],EVENTS=[['storm','Hurricane'],['tornado','Tornado'],['quake','Earthquake'],['slide','Rockslide'],['blizzard','Blizzard']];
    h=`<div class="label" style="margin-top:0">Nature</div><div class="chips">${KINDS.map(([v,l])=>`<button class="chipb press" data-simk="${v}" aria-pressed="${k===v}">${l}</button>`).join('')}</div><div class="label" style="margin-top:4px">Weather & events</div><div class="chips">${EVENTS.map(([v,l])=>`<button class="chipb press" data-simk="${v}" aria-pressed="${k===v}">${l}</button>`).join('')}</div>`+`
    <div class="simcard"><button class="play ${run?'metal':'anodized'} press" id="simPlay" aria-label="${run?'Pause':'Run'} ${d.title}">
      <svg class="ring" viewBox="0 0 72 72"><circle class="bg" cx="36" cy="36" r="33"/><circle class="fg" id="simProg" cx="36" cy="36" r="33" stroke-dasharray="207.3" stroke-dashoffset="${run?207.3*(1-(SR.target===Infinity?.25:SR.steps/SR.target)):207.3}"/></svg>${svg(run?IC.pause:IC.play).replace('<svg','<svg class="ic"')}</button>
      <div><h3>${d.title}${run?' · running':''}</h3><p id="simInfo">${(k==='water'&&!FL.R)||(k==='lava'&&!LV.R)||(k==='snow'&&!SN.R)?'Ready':d.info()}</p></div></div>
    <div class="chips">${Object.entries(SIM_LEVELS).map(([v,l])=>`<button class="chipb press" data-level="${v}" aria-pressed="${lv===v}">${l.n}</button>`).join('')}</div>
    ${tg('sim.autoBake','Bake automatically when done','The finished result becomes part of the land')}
    <div class="btns" style="margin-top:4px"><button class="btn metal press" id="simBake">Bake now</button>${d.clear?'<button class="btn plain press" id="simClear">Clear</button>':''}</div>
    <div style="height:10px"></div>${prompt_('simPrompt',k==='water'?'Describe the water…':k==='lava'?'Describe the eruption…':k==='snow'?'Describe the snow…':k==='wind'?'Describe the wind…':'Describe the weathering…')}`;
    if(k==='water')h+=`<div class="seg" role="group"><button class="press" data-ftool="spring" aria-pressed="${S.tool==='spring'}">Place spring</button><button class="press" data-ftool="channel" aria-pressed="${S.tool==='channel'}">Carve channel</button></div><div class="stat"><span class="tag">${S.fluid.springs.length} spring${S.fluid.springs.length===1?'':'s'}</span><span class="tag">${QUALITY[S.quality].sim}² grid</span></div><div style="height:6px"></div>
      ${sliderRow('fluid.rain','Rain',0,1,.01,null,.35,pct)+sliderRow('fluid.flow','Spring flow',0,1,.01,null,.7,pct)+sliderRow('fluid.carve','Carve',0,1,.01,null,.5,pct)+sliderRow('fluid.evap','Evaporation',0,1,.01,null,.25,pct)+sliderRow('biome.sea','Sea level',0,.6,.005,null,null,v=>fmtLen(v*S.shape.maxH))}
      <div class="btns"><button class="btn plain press" id="fSprings">Remove springs</button><button class="btn plain press" id="fDry">Dry riverbeds</button></div>`;
    if(k==='lava')h+=`<div class="seg" role="group"><button class="press" data-ftool="vent" aria-pressed="${S.tool==='vent'}">Place vent</button></div><div class="stat"><span class="tag">${S.lava.vents.length?S.lava.vents.length+' vents':'Erupts from the highest point'}</span></div><div style="height:6px"></div>
      ${sliderRow('lava.rate','Eruption',0,1,.01,null,.6,pct)+sliderRow('lava.fluid','Runniness',0,1,.01,null,.6,pct)+sliderRow('lava.cool','Cooling',0,1,.01,null,.45,pct)}<div class="btns"><button class="btn plain press" id="lVents">Remove vents</button></div>`;
    if(k==='snow')h+=sliderRow('snow.fall','Snowfall',0,1,.01,null,.5,pct)+sliderRow('snow.line','Snow line',0,1,.01,null,.45,v=>fmtLen(v*S.shape.maxH))+sliderRow('snow.repose','Avalanche',25,50,1,null,36,v=>Math.round(v)+'°')+sliderRow('snow.melt','Melt',0,1,.01,null,.35,pct)+tg('snow.addHeight','Pack snow into the land','Adds snow depth to the mesh when baked');
    if(k==='wind')h+=dialRow('wind.dir','Blows toward')+sliderRow('wind.power','Strength',0,1,.01,null,.6,pct)+sliderRow('wind.supply','Sand supply',0,1,.01,null,.5,pct);
    if(k==='erode')h+=sliderRow('ero.drops','Raindrops',10000,200000,5000,null,60000,v=>Math.round(v/1000)+'k')+sliderRow('ero.power','Carving',.2,2,.05,null,1)+`<div class="label">Instant</div><div class="btns"><button class="btn plain press" id="runTh">Weather slopes</button><button class="btn plain press" id="runSm">Smooth all</button><button class="btn plain press" id="runSh">Sharpen all</button></div>`+sliderRow('ero.talus','Talus angle',15,60,1,null,34,v=>Math.round(v)+'°');
    if(['storm','tornado','quake','slide','blizzard'].includes(k))h+=sliderRow('weather.power','Intensity',0,1,.01,null,.6,pct)+(k==='tornado'||k==='blizzard'?dialRow('weather.dir','Moves toward'):'')+`<p class="hint">${{storm:'Torrential rain floods valleys and storm winds fell trees on coasts and open ground (they become fallen logs).',tornado:'A funnel crosses the map, scouring soil and flattening forest along its track.',quake:'A fault rips across the land, lifting one side; steep slopes collapse. Mask areas to protect them.',slide:'The steepest cliff collapses into a scree fan. Long-press the map → Rockslide to choose the spot.',blizzard:'Heavy snow piles on the downwind side of ridges.'}[k]}</p>`;
    h+=`<p class="tip" style="margin-top:12px">${TIPS.simulate}</p>`;
  }else if(t==='biome'){
    const T=S.scatter.types,typeAcc=k=>{const L=SCATTER_TYPES[k];return acc(L.label,tg(`scatter.types.${k}.on`,'Show')+sliderRow(`scatter.types.${k}.density`,'Density',0,1,.01,null,L.def.density,pct)+sliderRow(`scatter.types.${k}.lo`,'Lowest',0,1,.01,null,L.def.lo,pct)+sliderRow(`scatter.types.${k}.hi`,'Highest',0,1,.01,null,L.def.hi,pct)+sliderRow(`scatter.types.${k}.slope`,'Max slope',5,90,1,null,L.def.slope,v=>Math.round(v)+'°')+sliderRow(`scatter.types.${k}.size`,'Size',.5,4,.05,null,L.def.size,v=>(+v).toFixed(2)+'×')+sliderRow(`scatter.types.${k}.cluster`,'Clustering',0,1,.01,null,L.def.cluster,pct),false,`<span data-count="${k}">${fmt(scatterCounts[k]||0)}</span>`)};
    h=`${acc('Coloring',sliderRow('biome.sea','Sea level',0,.6,.005,null,null,v=>fmtLen(v*S.shape.maxH))+sliderRow('biome.beach','Beach',0,.05,.001,null,null,v=>fmtLen(v*S.shape.maxH))+sliderRow('biome.snow','Snow line',.2,1,.01,null,null,v=>v>=1?'none':fmtLen(v*S.shape.maxH))+sliderRow('biome.rock','Rock slope',.2,1.4,.01,null,null,v=>Math.round(Math.acos(1-clamp(v*.42,0,1))*180/Math.PI)+'°')+sliderRow('biome.lush','Greenery',0,1,.01,null,null,pct),true)}
    <div style="height:4px"></div>${tg('scatter.on','Trees, rocks & buildings','Instanced 3D assets placed by rules')}
    ${sliderRow('scatter.forest','Forest density',0,2,.01,null,1,v=>Math.round(v*100)+'%')}
    ${['conifer','broadleaf','bush','grass','boulder','deadfall'].map(typeAcc).join('')}
    ${acc('Buildings & props',tg('scatter.types.structure.on','Show')+sliderRow('scatter.types.structure.count','Count',0,30,1,null,6)+sliderRow('scatter.types.structure.size','Size',.5,4,.05,null,1.6,v=>(+v).toFixed(2)+'×')+`<div class="btns"><button class="btn plain press" id="stReset">Auto-place again</button></div><p class="hint">${S.structs.length?S.structs.length+' placed by AI, a photo, or you. Auto-place again replaces them.':'Cabins, houses and towers settle on flat, dry ground. Long-press the map to place one yourself.'}</p>`,false,`<span data-count="structure">${scatterCounts.structure||0}</span>`)}
    <p class="tip" style="margin-top:10px">${TIPS.biome}</p>`;
  }else if(t==='export'){
    const e=S.exp,T=EXPORT_TARGETS[e.target]||EXPORT_TARGETS.blender,eff={...e,...T.o},det=[[1,'Full'],[2,'Half'],[4,'Quarter'],[8,'Eighth']].filter(([s])=>(N-1)/s>=64),custom=e.target==='custom';
    h=`<div class="label" style="margin-top:0">Made for</div>${ddBtn('tgtDD',T.n,'metal wide')}<p class="hint">${T.d}</p><div style="height:6px"></div>
    ${custom?seg('exp.fmt',[['glb','GLB'],['obj','OBJ'],['height','Heightmap']]):''}
    ${(eff.fmt==='glb'||eff.fmt==='obj')?`<div class="row" style="grid-template-columns:96px 1fr"><label>Mesh detail</label>${ddBtn('detDD',(det.find(d=>d[0]===e.detail)||det[0])[1],'metal wide')}</div>`:''}
    <div class="row" style="grid-template-columns:96px 1fr"><label>Textures</label>${ddBtn('texDD',Math.min(e.tex,QUALITY[S.quality].tex)+' px','metal wide')}</div>
    ${eff.fmt==='glb'?`<div class="row" style="grid-template-columns:96px 1fr"><label>Tiles</label>${seg('exp.tiles',[[1,'1'],[2,'2×2'],[4,'4×4']])}</div>`:''}
    ${(eff.fmt==='glb'||eff.fmt==='obj')?tg('exp.base','Solid base',eff.fmt==='obj'?'Watertight shell for printing':'Closes the sides and bottom')+(e.base||eff.base?sliderRow('exp.depth','Base depth',5,300,5,null,40,m):''):''}
    ${custom||eff.fmt==='glb'?tg('exp.pbr','Detail maps','Normal + AO/roughness baked from full-res heights'):''}
    ${eff.fmt==='glb'?tg('exp.scatter','Include trees, rocks & buildings','One mesh per asset, placed by instances')+tg('exp.atlas','Palette texture atlas','One tiny texture instead of vertex colors'):''}
    ${tg('exp.masks','Extra masks','Slope, water, vegetation and snow PNGs')}
    <div class="facts" id="expFacts"></div><p class="tip" style="margin-top:12px">${TIPS.export}</p>`;
  }
  b.innerHTML=h;b.classList.remove('enter','enter-l','enter-r');if(anim&&!SET.reduceMotion){void b.offsetWidth;b.classList.add(anim)}b.scrollTop=anim?0:b.scrollTop;bindPanel(t);
}
function bindPanel(t){
  const b=$('#sheetBody'),on=(id,f)=>{const el=$('#'+id,b);if(el)el.onclick=f};
  bindSliders(b);bindToggles(b);
  bindSegs(b,(k,v)=>{if(k==='sub.create'){S.sub.create=v;setDetent(v==='nodes'?'full':'half');renderSheet('enter');return}if(k==='sub.sim'){S.sub.sim=v;renderSheet('enter');return}setK(k,v);onParam(k,v,true)});
  $$('textarea',b).forEach(ta=>ta.oninput=()=>{ta.style.height='38px';ta.style.height=Math.min(ta.scrollHeight,110)+'px'});
  const pb=(id,kind)=>{const ta=$('#'+id,b);if(!ta)return;const go=()=>promptBar(kind,ta.value,$('#'+id+'Note'),$('#'+id+'Go'));on(id+'Go',go);ta.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();go()}}};
  pb('genPrompt','generate');pb('nodePrompt','nodes');pb('simPrompt','simulate');
  if(t==='create'&&S.sub.create==='generate'){
    bindPad();drawPreview();drawVariations();renderFacts();
    const si=$('#seedIn');si.onchange=()=>{const v=parseInt(si.value,10);if(!isNaN(v)){S.seed=Math.abs(v)%1e9;regenerate();drawVariations();drawPreview()}};
    on('dice',()=>{S.seed=(Math.random()*1e6)|0;si.value=S.seed;regenerate();drawVariations();drawPreview()});
    on('reroll',()=>{varBase=(Math.random()*1e6)|0;drawVariations()});
    $$('[data-var]',b).forEach(x=>x.onclick=()=>{S.seed=varSeeds[+x.dataset.var];si.value=S.seed;regenerate();drawPreview();toast('Seed '+S.seed)});
  }
  if(t==='create'&&S.sub.create==='nodes')renderGraphEditor($('#gHost'));
  if(t==='create'&&S.sub.create==='photo'){
    on('pickThumb',pickPhoto);on('photoBuild',buildFromPhoto);on('photoReread',async()=>{REF.ai=null;busy(true,'Reading the image…',.3);try{await aiReadRef()}finally{busy(false)}renderSheet()});
    on('modeDD',e=>openMenu(e.currentTarget,Object.entries(PHOTO_MODES).map(([k,v])=>({v:k,label:v.n,sub:v.d})),v=>{S.photo.mode=v;if(v==='height'){S.photo.colors=false;S.photo.thin=false}else S.photo.thin=true;REF.ai=null;renderSheet();saveSoon()},S.photo.mode));
  }
  bindDials(b);
  if(t==='sculpt'){
    $$('[data-tcat]',b).forEach(x=>x.onclick=()=>{S.brush.cat=x.dataset.tcat;const first=TOOL_CATS[S.brush.cat].t[0];if(!TOOL_CATS[S.brush.cat].t.includes(S.tool))S.tool=first;renderSheet()});
    on('shapeDD',e=>openMenu(e.currentTarget,Object.entries(BRUSH_SHAPES).map(([k,l])=>({v:k,label:l,sub:{soft:'Smooth falloff',sharp:'Pointed center',plateau:'Flat top, crisp edge',spray:'Speckled, natural'}[k]})),v=>{S.brush.shape=v;renderSheet();saveSoon()},S.brush.shape));
    on('symDD',e=>openMenu(e.currentTarget,Object.entries(SYMS).map(([k,l])=>({v:k,label:l})),v=>{S.brush.sym=v;S.brush.mirror=false;renderSheet();saveSoon()},S.brush.sym));
    on('mkClr',()=>{pushUndo();MK.fill(0);updateAll();toast('Mask cleared')});on('mkInv',()=>{pushUndo();for(let k=0;k<MK.length;k++)MK[k]=1-MK[k];updateAll();toast('Mask inverted')});
    on('mkSlope',()=>{pushUndo();for(let j=0;j<N;j++)for(let i=0;i<N;i++)MK[j*N+i]=Math.max(MK[j*N+i],smooth(28,40,slopeDeg(i,j)));updateAll();toast('Cliffs protected','ok')});
    $$('[data-tool]',b).forEach(x=>x.onclick=()=>setTool(x.dataset.tool));
    $$('[data-stamp]',b).forEach(x=>x.onclick=()=>{S.stamp=x.dataset.stamp;$$('[data-stamp]',b).forEach(y=>y.setAttribute('aria-pressed',y===x));haptic(6)});
    $$('[data-paint]',b).forEach(x=>x.onclick=()=>{S.paint=x.dataset.paint;$$('[data-paint]',b).forEach(y=>y.setAttribute('aria-pressed',y===x));haptic(6)});
  }
  if(t==='simulate'){const k=S.sub.sim;
    $$('[data-simk]',b).forEach(x=>x.onclick=()=>{S.sub.sim=x.dataset.simk;renderSheet('enter')});
    on('simPlay',()=>{if(SR.running&&SR.kind===k)simStop(false);else simStart(k)});
    on('simBake',()=>{if(SR.running&&SR.kind===k){simStop(true);return}const d=SIMDEF[k];if((k==='water'&&!FL.R)||(k==='lava'&&!LV.R)||(k==='snow'&&!SN.R)||(k==='wind'&&!WD.R)){toast('Run it first, then bake','warn');return}d.bake();simDoneFx(d.title+' baked into the terrain');renderSheet()});
    on('simClear',()=>{const d=SIMDEF[k];if(SR.running&&SR.kind===k)simStop(false);d.clear&&d.clear();toast(d.title+' cleared')});
    $$('[data-level]',b).forEach(x=>x.onclick=()=>{S.sim.level=x.dataset.level;$$('[data-level]',b).forEach(y=>y.setAttribute('aria-pressed',y===x));if(SR.running)SR.target=simTarget(SR.kind);haptic(6);saveSoon()});
    $$('[data-ftool]',b).forEach(x=>x.onclick=()=>{const tl=x.dataset.ftool;if(S.tool===tl){S.tool='raise';setMode('orbit')}else{S.tool=tl;setMode('sculpt');toast(tl==='spring'?'Tap high ground to place a spring; tap it again to remove':tl==='vent'?'Tap a peak to place a vent; tap again to remove':'Drag along a valley to carve a channel')}renderSheet()});
    on('fSprings',()=>{S.fluid.springs=[];updateSpringMarkers();renderSheet();saveSoon()});on('lVents',()=>{S.lava.vents=[];updateSpringMarkers();renderSheet();saveSoon()});
    on('fDry',()=>{pushUndo();WM.fill(0);updateAll();saveSoon();toast('Riverbeds dried','ok')});
    on('runTh',()=>runErosion('thermal'));on('runSm',()=>runErosion('smooth'));on('runSh',()=>runErosion('sharpen'));
  }
  if(t==='biome')on('stReset',()=>{S.structs=[];S.seed2=(S.seed2||0)+1;buildScatter();renderSheet();saveSoon()});
  if(t==='export'){const e=S.exp;
    on('tgtDD',ev=>openMenu(ev.currentTarget,Object.entries(EXPORT_TARGETS).map(([k,x])=>({v:k,label:x.n,sub:x.d})),v=>{e.target=v;renderSheet();saveSoon()},e.target));
    on('detDD',ev=>openMenu(ev.currentTarget,[[1,'Full'],[2,'Half'],[4,'Quarter'],[8,'Eighth']].filter(([s])=>(N-1)/s>=64).map(([s,l])=>{const Mm=(N-1)/s+1;return{v:s,label:l,sub:`${Mm}² vertices · ${fmt((Mm-1)**2*2)} triangles`}}),v=>{e.detail=v;renderSheet();saveSoon()},e.detail));
    on('texDD',ev=>openMenu(ev.currentTarget,[1024,2048,4096].filter(v=>v<=QUALITY[S.quality].tex).map(v=>({v,label:v+' px',sub:v===4096?'Sharpest; slower to bake':v===2048?'Recommended':'Fast, light'})),v=>{e.tex=v;renderSheet();saveSoon()},e.tex));
    renderExportFacts();}
}
/* ---------- generate helpers ---------- */
let varBase=0,varSeeds=[];
function drawVariations(){const box=$('#vars');if(!box)return;varSeeds=[0,1,2,3].map(i=>((S.seed*7+varBase+i*7919+1)%999983));
  $$('[data-var]',box).forEach((x,i)=>{const f=genField(64,S.shape,varSeeds[i]);drawRelief(x.querySelector('canvas'),f,64);x.querySelector('small').textContent=varSeeds[i]})}
function drawPreview(){const cv=$('#genPrev');if(!cv)return;const R=96,f=genField(R,S.shape,S.seed);if(S.macro.y>.3)erodeDroplets(f,R,Math.round(S.macro.y*900),1,mulberry32(3),null,1);drawRelief(cv,f,R)}
function applyMacro(x,y){S.macro={x,y};const s=S.shape;s.ridges=+(.9*x).toFixed(2);s.gain=+(.38+.24*x).toFixed(2);s.oct=Math.round(4+4*x);s.peaks=+((.95+1.25*x)*(1-.35*y)).toFixed(2);s.warp=+(.12+.55*y).toFixed(2);S.preset='Custom'}
function bindPad(){
  const pad=$('#pad'),knob=$('#knob');const place=()=>{knob.style.left=(S.macro.x*100)+'%';knob.style.top=(S.macro.y*100)+'%'};place();
  let on=false,last=0;const at=e=>{const r=pad.getBoundingClientRect();return[clamp((e.clientX-r.left)/r.width,0,1),clamp((e.clientY-r.top)/r.height,0,1)]};
  pad.onpointerdown=e=>{try{pad.setPointerCapture(e.pointerId)}catch(_){}on=true;pad.classList.add('on');const [x,y]=at(e);applyMacro(x,y);place();drawPreview();haptic(6)};
  pad.onpointermove=e=>{if(!on)return;const [x,y]=at(e);applyMacro(x,y);place();const now=performance.now();if(now-last>40){last=now;drawPreview()}};
  const up=async()=>{if(!on)return;on=false;pad.classList.remove('on');pushUndo();regenerate(false);renderSheet();if(S.macro.y>.3)await runErosion('hydraulic',Math.round((S.macro.y-.3)*90000))};
  pad.onpointerup=up;pad.onpointercancel=up;
  pad.onkeydown=e=>{const d={ArrowLeft:[-.05,0],ArrowRight:[.05,0],ArrowUp:[0,-.05],ArrowDown:[0,.05]}[e.key];if(!d)return;e.preventDefault();applyMacro(clamp(S.macro.x+d[0],0,1),clamp(S.macro.y+d[1],0,1));place();drawPreview();clearTimeout(pad._t);pad._t=setTimeout(()=>{pushUndo();regenerate(false)},400)};
}
function renderFacts(){const f=$('#facts');if(!f)return;const W=S.shape.world;f.innerHTML=`<span>Area</span><span>${(W*W/1e6).toFixed(2)} km²</span><span>Lowest · highest</span><span>${fmtLen(stats.lo)} · ${fmtLen(stats.hi)}</span><span>Under water</span><span>${Math.round(stats.water*100)}%</span><span>Grid</span><span>${N}² · ${(W/(N-1)).toFixed(1)} m/cell</span>`}
function renderExportFacts(){
  const f=$('#expFacts');if(!f)return;const e={...S.exp,...(EXPORT_TARGETS[S.exp.target]||{}).o};if(S.exp.target==='custom')Object.assign(e,S.exp);const tex=Math.min(S.exp.tex,QUALITY[S.quality].tex);
  if(e.fmt==='unreal'){const U=[127,253,505,1009,2017,4033].reduce((a,b)=>Math.abs(b-N)<Math.abs(a-N)?b:a);f.innerHTML=`<span>Heightmap</span><span>${U}² 16-bit PNG</span><span>Layers</span><span>grass · rock · sand · snow · wet</span><span>Textures</span><span>${tex}² color, normal, ORM</span><span>Foliage</span><span>${fmt(Object.values(scatterCounts).reduce((a,b)=>a+(b||0),0))} instances</span>`;return}
  if(e.fmt==='unity'){f.innerHTML=`<span>Heightmap</span><span>${N}² RAW 16-bit</span><span>Splat</span><span>5 layer PNGs</span><span>Trees</span><span>${fmt(Object.values(scatterCounts).reduce((a,b)=>a+(b||0),0))} instances</span>`;return}
  if(e.fmt==='height'){f.innerHTML=`<span>Heightmap</span><span>${N}², 16-bit PNG + RAW</span><span>Range</span><span>${fmtLen(stats.lo)}–${fmtLen(stats.hi)}</span><span>Color map</span><span>${tex} px</span>`;return}
  const Mm=(N-1)/(e.detail||1)+1,v=Mm*Mm,tr=(Mm-1)*(Mm-1)*2,sc=e.fmt==='glb'&&e.scatter&&S.scatter.on?['conifer','broadleaf','bush','boulder'].reduce((a,k)=>a+(scatterCounts[k]||0),0)+(scatterCounts.structure||0):0;
  f.innerHTML=`<span>Terrain</span><span>${fmt(v)} verts · ${fmt(tr)} tris</span><span>UV layout</span><span>1 island · 0 seams${e.fmt==='glb'&&e.tiles>1?` · ${e.tiles}×${e.tiles} tiles`:''}</span><span>Textures</span><span>${tex}² ${e.pbr&&e.fmt==='glb'?'color · normal · ORM':'albedo'}</span>${sc?`<span>Scatter</span><span>${fmt(Math.min(sc,QUALITY[S.quality].scatter>1?30000:16000))} objects${e.atlas?' · atlas':''}</span>`:''}<span>Units</span><span>meters · Y up</span>`;
}
function onScatterBuilt(){$$('[data-count]').forEach(el=>{el.textContent=fmt(scatterCounts[el.dataset.count]||0)});if(S.tab==='export')renderExportFacts()}

/* ---------- rail extras: walk, clear view, queue ---------- */
$('#walkBtn').onclick=()=>fpEnter();
$('#camBtn').onclick=()=>camEnter();
$('#clearBtn').onclick=()=>{document.body.classList.add('clear');$('#clearExit').hidden=false;placeRing(null);setViewShift(0,0);toast('Clear view · tap Show tools to bring them back')};
$('#clearExit').onclick=()=>{document.body.classList.remove('clear');$('#clearExit').hidden=true;layoutSheet()};
$('#queueBtn').onclick=e=>openQueue(e.currentTarget);
