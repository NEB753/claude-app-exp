"use strict";
/* Strata UI: components (smart sliders, dropdown popovers, toggles), the bottom sheet with detents, dock and every creation panel. */
const CHEV=svg('<path d="m6 9 6 6 6-6"/>',2.4),CHEVR=svg('<path d="m9 6 6 6-6 6"/>',2.4),DICE=svg('<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>');
const SPARK='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z"/></svg>';
function getK(k){if(k==='S.res')return N;let o=S;for(const p of k.split('.')){if(o==null)return undefined;o=o[p]}return o}
function setK(k,v){const ps=k.split('.');let o=S;for(let i=0;i<ps.length-1;i++)o=o[ps[i]];o[ps[ps.length-1]]=v}
function defK(k){const [g,f]=k.split('.');if(g==='shape'&&PRESETS[S.preset]&&PRESETS[S.preset].shape[f]!=null)return PRESETS[S.preset].shape[f];if(g==='biome'&&PRESETS[S.preset]&&PRESETS[S.preset].biome[f]!=null)return PRESETS[S.preset].biome[f];let o=DEF();for(const p of k.split('.')){if(o==null)return undefined;o=o[p]}return o}
const FMT={};
const autoFmt=step=>step>=1?(v=>fmt(v)):step>=.1?(v=>(+v).toFixed(1)):(v=>(+v).toFixed(2));
function sliderRow(k,label,min,max,step,value,def,f){
  FMT[k]=f||FMT[k]||autoFmt(step);const id='r_'+k.replace(/\W/g,'_'),v=value!=null?value:getK(k);
  return `<div class="row" data-k="${k}" data-def="${def!=null?def:''}"><label for="${id}">${label}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><button class="val" type="button" aria-label="Type a value for ${esc(label)}">${FMT[k](v)}</button><button class="dice press" type="button" aria-label="Randomize ${esc(label)}">${DICE}</button></div>`;
}
function bindSliders(root,onChange,defOf){
  onChange=onChange||((k,v)=>{setK(k,v);onParam(k)});
  $$('.row[data-k]',root).forEach(row=>{
    const k=row.dataset.k,r=row.querySelector('input[type=range]'),val=row.querySelector('.val'),dice=row.querySelector('.dice'),lab=row.querySelector('label');if(!r)return;
    const min=+r.min,max=+r.max,step=+r.step,sp=()=>r.style.setProperty('--p',((r.value-min)/(max-min)*100)+'%');sp();
    const apply=(v,commit)=>{v=clamp(Math.round(v/step)*step,min,max);v=+v.toFixed(5);r.value=v;val.textContent=FMT[k](v);sp();onChange(k,v,commit)};
    r.oninput=()=>apply(+r.value,false);r.onchange=()=>{apply(+r.value,true);regenArmed=true};
    dice.onclick=()=>apply(min+Math.random()*(max-min),true);
    val.onclick=()=>{const inp=document.createElement('input');inp.className='num';inp.type='number';inp.inputMode='decimal';inp.step=step;inp.value=r.value;val.replaceWith(inp);inp.focus();inp.select();
      const done=ok=>{if(ok&&inp.value!==''&&!isNaN(+inp.value))apply(+inp.value,true);inp.replaceWith(val)};inp.onkeydown=e=>{if(e.key==='Enter')done(true);if(e.key==='Escape')done(false)};inp.onblur=()=>done(true)};
    let lp=0;lab.onpointerdown=()=>{lp=setTimeout(()=>{const d=defOf?defOf(k):(row.dataset.def!==''?+row.dataset.def:defK(k));if(d!=null&&!isNaN(d)){apply(+d,true);toast(lab.textContent+' reset')}},550)};
    lab.onpointerup=lab.onpointerleave=()=>clearTimeout(lp);
  });
}
function tg(k,label,small){const id='t_'+k.replace(/\W/g,'_');return `<label class="toggle" for="${id}"><span>${label}${small?`<small>${small}</small>`:''}</span><span class="switch"><input type="checkbox" id="${id}" data-tk="${k}" ${getK(k)?'checked':''}><span></span></span></label>`}
function bindToggles(root,onChange){$$('input[data-tk]',root).forEach(c=>c.onchange=()=>{const k=c.dataset.tk;setK(k,c.checked);(onChange||onParam)(k,c.checked)})}
function seg(k,opts){return `<div class="seg" role="group">${opts.map(([v,l])=>`<button type="button" class="press" data-seg="${k}" data-v="${v}" aria-pressed="${String(getK(k))===String(v)}">${l}</button>`).join('')}</div>`}
function bindSegs(root,onChange){$$('[data-seg]',root).forEach(x=>x.onclick=()=>{const k=x.dataset.seg,raw=x.dataset.v,v=isNaN(+raw)?raw:+raw;$$(`[data-seg="${k}"]`,root).forEach(y=>y.setAttribute('aria-pressed',y===x));(onChange||((k,v)=>{setK(k,v);onParam(k)}))(k,v)})}
function ddBtn(id,label,cls){return `<button class="dd ${cls||'metal'} press" id="${id}" type="button" aria-haspopup="listbox"><span>${esc(label)}</span>${CHEV}</button>`}
const acc=(title,body,open,sum)=>`<details class="acc"${open?' open':''}><summary>${title}${sum!=null?`<span class="sum">${sum}</span>`:''}<span class="chev" style="${sum!=null?'margin-left:8px':'margin-left:auto'}">${CHEVR}</span></summary><div class="acc-body">${body}</div></details>`;

/* ---------------- popovers ---------------- */
let popEl=null,popClose=null;
function openPanel(anchor,html,onMount,opts){
  closePanel();const layer=$('#menuLayer');layer.classList.add('on');
  const p=document.createElement('div');p.className='pop';p.setAttribute('role',opts&&opts.role||'dialog');p.innerHTML=html;layer.appendChild(p);
  const r=anchor.getBoundingClientRect(),pw=Math.max(opts&&opts.width||0,p.offsetWidth),ph=p.offsetHeight,below=innerHeight-r.bottom,above=r.top;
  let left=clamp(r.left+(opts&&opts.alignRight?r.width-pw:0),12,innerWidth-pw-12);p.style.left=left+'px';if(opts&&opts.width)p.style.width=opts.width+'px';
  if(below>=Math.min(ph,320)+16||below>=above){p.style.top=(r.bottom+8)+'px';p.style.maxHeight=(below-24)+'px'}else{p.style.bottom=(innerHeight-r.top+8)+'px';p.style.maxHeight=(above-24)+'px';p.style.transformOrigin='bottom center'}
  popEl=p;popClose=opts&&opts.onClose;layer.onpointerdown=e=>{if(e.target===layer)closePanel()};
  onMount&&onMount(p);const f=p.querySelector('button,input');f&&f.focus({preventScroll:true});
}
function closePanel(){if(!popEl)return;popEl.remove();popEl=null;$('#menuLayer').classList.remove('on');const c=popClose;popClose=null;c&&c()}
addEventListener('keydown',e=>{if(e.key==='Escape'&&popEl)closePanel()});
function openMenu(anchor,items,onPick,current){
  const html=items.map((it,i)=>it.head?`<h4>${esc(it.head)}</h4>`:`<button class="it press" role="option" data-i="${i}">${it.sw?`<span class="sw" style="background:${it.sw}"></span>`:''}<span>${esc(it.label)}${it.sub?`<small>${esc(it.sub)}</small>`:''}</span>${String(it.v)===String(current)?`<span class="ck">${svg('<path d="m5 12 5 5 9-10"/>',2.6)}</span>`:''}</button>`).join('');
  openPanel(anchor,html,p=>$$('[data-i]',p).forEach(b=>b.onclick=()=>{const it=items[+b.dataset.i];closePanel();onPick(it.v)}),{role:'listbox'});
}

/* ---------------- sheet + dock ---------------- */
const TABS=[
  ['generate','Generate','<path d="M2 19 9 7l4 6 3-4 6 10z"/>'],
  ['nodes','Nodes','<rect x="3" y="4" width="6" height="5" rx="1.5"/><rect x="15" y="10" width="6" height="5" rx="1.5"/><rect x="3" y="15" width="6" height="5" rx="1.5"/><path d="M9 6.5c3 0 3 6 6 6M9 17.5c3 0 3-5 6-5"/>'],
  ['sculpt','Sculpt','<path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/>'],
  ['fluid','Fluid','<path d="M3 15c2 0 2-1.5 4.5-1.5S10 15 12 15s2.5-1.5 4.5-1.5S19 15 21 15"/><path d="M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19"/><path d="M12 3c2 2.5 3.5 4.3 3.5 6a3.5 3.5 0 0 1-7 0c0-1.7 1.5-3.5 3.5-6z"/>'],
  ['photo','Photo','<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>'],
  ['biome','Biome','<path d="M12 21v-6"/><path d="M12 3l5 7h-3l4 5H6l4-5H7z"/>'],
  ['export','Export','<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 18v2h16v-2"/>']
];
const DETENT_DEFAULT={nodes:'full',photo:'half',generate:'half',sculpt:'half',fluid:'half',biome:'half',export:'half'};
let sheetState='half',insets={t:0,b:0};
function measureInsets(){const p=document.createElement('div');p.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden';document.body.appendChild(p);const cs=getComputedStyle(p);insets={t:parseFloat(cs.paddingTop)||0,b:parseFloat(cs.paddingBottom)||0};p.remove()}
const wide=()=>matchMedia('(min-width:900px)').matches;
function detentH(s){const dockH=72,top=insets.t+70,avail=innerHeight-top-dockH-insets.b-26;return s==='peek'?Math.min(176,avail):s==='full'?avail:Math.min(Math.max(innerHeight*.44,300),avail)}
function layoutSheet(h){
  if(wide()){setViewShift(0);return}
  const H_=h!=null?h:detentH(sheetState);$('#sheet').style.setProperty('--sheet-h',H_+'px');
  const topY=insets.t+66,botY=innerHeight-H_-72-insets.b-24,c=(topY+botY)/2;setViewShift(Math.max(0,innerHeight/2-c));
}
function setDetent(s){sheetState=s;layoutSheet()}
(function grabber(){const g=$('#grab'),sh=$('#sheet');let st=null;
  g.onpointerdown=e=>{g.setPointerCapture(e.pointerId);st={y:e.clientY,h:sh.getBoundingClientRect().height,moved:false};sh.classList.add('dragging')};
  g.onpointermove=e=>{if(!st)return;const dy=e.clientY-st.y;if(Math.abs(dy)>4)st.moved=true;const h=clamp(st.h-dy,120,detentH('full'));layoutSheet(h)};
  const up=e=>{if(!st)return;sh.classList.remove('dragging');const h=sh.getBoundingClientRect().height;
    if(!st.moved){setDetent(sheetState==='peek'?'half':sheetState==='half'?'full':'peek')}
    else{let best='half',bd=1e9;for(const s of ['peek','half','full']){const d=Math.abs(detentH(s)-h);if(d<bd){bd=d;best=s}}setDetent(best)}st=null};
  g.onpointerup=up;g.onpointercancel=up;g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDetent(sheetState==='full'?'half':'full')}};
})();
$('#dock').innerHTML=TABS.map(([k,l,p])=>`<button role="tab" class="press" id="tab_${k}" data-tab="${k}" aria-selected="false">${svg(p)}${l}</button>`).join('');
$('#dock').onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;const t=b.dataset.tab;if(t===S.tab){setDetent(sheetState==='peek'?(DETENT_DEFAULT[t]==='peek'?'half':DETENT_DEFAULT[t]):'peek');return}switchTab(t)};
function switchTab(t){S.tab=t;if(t==='sculpt'&&S.mode!=='sculpt')setMode('sculpt');if(t!=='sculpt'&&t!=='fluid'&&(S.tool==='spring'||S.tool==='channel'))S.tool='raise';setDetent(DETENT_DEFAULT[t]||'half');renderSheet();saveSoon()}
function setMode(m){S.mode=m;$('#modeOrbit').setAttribute('aria-pressed',m==='orbit');$('#modeSculpt').setAttribute('aria-pressed',m==='sculpt');
  $('#modeOrbit').className='press'+(m==='orbit'?' anodized':'');$('#modeSculpt').className='press'+(m==='sculpt'?' anodized':'');
  if(m==='orbit'){placeRing(null);$('#readout').hidden=true}else toast(matchMedia('(pointer:coarse)').matches?'One finger uses the tool · two fingers move the camera':'Drag uses the tool · right-drag orbits · [ ] resize');
  if(S.tab==='sculpt')renderHead()}
$('#modeOrbit').onclick=()=>setMode('orbit');$('#modeSculpt').onclick=()=>setMode('sculpt');$('#frameBtn').onclick=frame;
function setTool(t){S.tool=t;if(S.mode!=='sculpt')setMode('sculpt');if(S.tab==='sculpt'||S.tab==='fluid')renderSheet()}
function crumb(){$('#crumb').textContent=`${S.preset} · ${N}² · ${QUALITY[S.quality].label}`}

/* ---------------- brand menu ---------------- */
$('#menuBtn').onclick=e=>{
  const html=`<h4>Quality</h4>${Object.entries(QUALITY).map(([k,q])=>`<button class="it press" data-q="${k}"><span>${q.label}<small>${q.sub}</small></span>${S.quality===k?`<span class="ck">${svg('<path d="m5 12 5 5 9-10"/>',2.6)}</span>`:''}</button>`).join('')}
  <h4>Look</h4><div style="padding:0 6px 6px">${ddBtn('lookDD',LOOKS[S.view.look].n,'metal wide')}</div>
  <h4>View</h4><div style="padding:0 8px">${tg('view.water','Water')}${tg('view.base','Diorama base')}${tg('view.shadows','Shadows')}${tg('view.contours','Contour lines','Every '+CU.uInterval.value+' m, bold every 5th')}${tg('view.anim','Moving water','Gently animates waves; sleeps when idle')}${tg('view.wire','Wireframe')}</div>
  ${sliderRow('view.sunEl','Sun height',4,85,1,null,34,v=>Math.round(v)+'°')}${sliderRow('view.sunAz','Sun dir.',0,360,1,null,135,v=>Math.round(v)+'°')}${sliderRow('view.vex','Exaggerate',.5,3,.05,null,1,v=>(+v).toFixed(2)+'×')}
  <div class="btns" style="padding:0 6px 6px"><button class="btn plain press" id="mTheme">Theme: ${document.documentElement.dataset.theme||'System'}</button><button class="btn plain press" id="mReset" style="color:var(--bad)">Start over</button></div>`;
  openPanel(e.currentTarget,html,p=>{
    $$('[data-q]',p).forEach(b=>b.onclick=()=>{closePanel();setQuality(b.dataset.q)});
    $('#lookDD',p).onclick=ev=>{const a=ev.currentTarget;openMenu(a,Object.entries(LOOKS).map(([k,l])=>({v:k,label:l.n,sub:l.d})),v=>{setLook(v);saveSoon()},S.view.look)};
    bindToggles(p);bindSliders(p);
    $('#mTheme',p).onclick=ev=>{const r=document.documentElement,cur=r.dataset.theme,next=!cur?'dark':cur==='dark'?'light':'';if(next)r.dataset.theme=next;else delete r.dataset.theme;ev.currentTarget.textContent='Theme: '+(next||'System');applyTheme()};
    $('#mReset',p).onclick=ev=>{const b=ev.currentTarget;if(b.dataset.armed){closePanel();startOver()}else{b.dataset.armed=1;b.textContent='Tap again to clear'}};
  },{width:320});
};

/* ---------------- panels ---------------- */
const TIPS={
  generate:'Drag the <b>character pad</b> to shape the whole range at once: right is more rugged, down is older and more eroded. Then fine-tune below. Generating replaces sculpting; Undo brings it back.',
  sculpt:'Tools work in <b>Sculpt</b> mode (right rail). <b>Stamp</b> drops whole landforms with one tap. <b>Erode</b> rains on just the brush area. <b>Plant</b> paints where trees and rocks may grow. Apple Pencil pressure is used when available.',
  fluid:'Water here is simulated, not painted. It flows downhill, fills lakes, drains to the sea and, with <b>Carve</b>, cuts its own riverbeds. Pause bakes rivers and wet soil, and bushes then grow along the banks.',
  photo:'Pick any picture. <b>Landscape photo</b> lets Claude read the layout, water, forests, rocks and cabins, then adds the photo\'s own fine detail. <b>Heightmap</b> uses brightness. <b>Ridge sketch</b> turns dark pen lines into ridges.',
  biome:'Colors follow height, slope, moisture and wetness. Vegetation follows rules for each type: altitude band, maximum slope, clustering, and wherever you painted with <b>Plant</b>.',
  export:'Terrain UVs are <b>one seamless 0–1 square</b> with a baked albedo. GLB can also carry trees, rocks and cabins. Masks are 8-bit PNGs for engine splat maps.'
};
let headHTML='';
function renderHead(){
  const t=S.tab,hd=$('#sheetHead');let h='';
  if(t==='generate')h=`<h2>Generate</h2><span class="grow"></span>${ddBtn('presetDD',S.preset)}`;
  if(t==='nodes')h=`<h2>Nodes</h2><span class="grow"></span><span class="tag ${S.auto?'on':''}">${S.auto?'Live':'Manual'}</span>`;
  if(t==='sculpt')h=`<h2>Sculpt</h2><span class="grow"></span><span class="tag ${S.mode==='sculpt'?'on':''}">${S.mode==='sculpt'?'Brush active':'Orbit mode'}</span>`;
  if(t==='fluid')h=`<h2>Fluid Gen</h2><span class="grow"></span><button class="dd ${FL.running?'metal':'anodized'} press" id="simRun">${FL.running?svg('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'):svg('<path d="M7 5v14l11-7z"/>')}<span>${FL.running?'Pause':'Run'}</span></button>`;
  if(t==='photo')h=`<h2>Photo</h2><span class="grow"></span><button class="dd metal press" id="pickTop">${svg('<path d="M12 5v14M5 12h14"/>',2.4)}<span>${REF.img?'Change':'Pick image'}</span></button>`;
  if(t==='biome')h=`<h2>Biome</h2><span class="grow"></span>${ddBtn('palDD',PALETTES[S.biome.palette].name)}`;
  if(t==='export')h=`<h2>Export</h2><span class="grow"></span><button class="dd anodized press" id="expTop">${svg('<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 18v2h16v-2"/>')}<span>Export .zip</span></button>`;
  hd.innerHTML=h;
  const on=(id,f)=>{const el=$('#'+id,hd);if(el)el.onclick=f};
  on('presetDD',e=>openMenu(e.currentTarget,Object.keys(PRESETS).map(k=>({v:k,label:k,sub:PALETTES[PRESETS[k].biome.palette].name+' · '+fmt(PRESETS[k].shape.maxH)+' m relief'})),v=>{applyPreset(v);toast(v+' loaded')},S.preset));
  on('simRun',()=>fluidSetRunning(!FL.running));on('pickTop',pickPhoto);on('expTop',exportNow);
  on('palDD',e=>openMenu(e.currentTarget,Object.entries(PALETTES).map(([k,p])=>({v:k,label:p.name,sw:`linear-gradient(135deg,rgb(${p.lush}),rgb(${p.rock}) 60%,rgb(${p.snow}))`})),v=>{S.biome.palette=v;recolorSoon();scatterSoon();renderHead()},S.biome.palette));
}
function renderSheet(){
  const t=S.tab,b=$('#sheetBody');crumb();renderHead();
  $$('#dock [data-tab]').forEach(x=>x.setAttribute('aria-selected',x.dataset.tab===t));
  let h='';
  if(t==='generate'){
    h=`<div class="prompt"><textarea id="genPrompt" rows="1" placeholder="Describe a landscape…" aria-label="Describe a landscape"></textarea><button class="anodized press" id="genGo" aria-label="Generate from description">${SPARK}</button></div><div class="ai-note" id="genNote"></div>
    <div class="padwrap"><div class="pad" id="pad" role="slider" aria-label="Character pad: ruggedness and age" tabindex="0"><span class="ax" style="left:50%;top:8px;transform:translateX(-50%)">Young</span><span class="ax" style="left:50%;bottom:8px;transform:translateX(-50%)">Ancient</span><span class="ax" style="left:9px;top:50%;transform:translateY(-50%)">Gentle</span><span class="ax" style="right:9px;top:50%;transform:translateY(-50%)">Rugged</span><div class="knob" id="knob"></div></div><div class="preview"><canvas id="genPrev"></canvas></div></div>
    <div class="label">Seed & variations</div><div class="seedrow"><label class="seed" for="seedIn"><span>Seed</span><input id="seedIn" inputmode="numeric" value="${S.seed}"></label><button class="btn metal press" id="dice" style="flex:none;min-width:0;width:44px;padding:0" aria-label="Random seed">${DICE}</button><button class="btn plain press" id="reroll" style="flex:none;min-width:0;padding:0 14px">More</button></div>
    <div class="vars" id="vars">${[0,1,2,3].map(i=>`<button class="press" data-var="${i}"><canvas></canvas><small></small></button>`).join('')}</div>
    <div style="height:8px"></div>
    ${acc('Landform',sliderRow('shape.freq','Scale',.8,6,.05)+sliderRow('shape.oct','Detail',3,8,1,null,null,v=>v+' oct')+sliderRow('shape.gain','Roughness',.3,.65,.01)+sliderRow('shape.ridges','Ridges',0,1,.01,null,null,pct)+sliderRow('shape.warp','Warp',0,1,.01,null,null,pct)+sliderRow('shape.peaks','Peaks',.6,3,.05),true)}
    ${acc('Features',sliderRow('shape.cone','Central peak',0,1,.01,null,null,pct)+sliderRow('shape.crater','Crater',0,1,.01,null,null,pct)+sliderRow('shape.island','Island',0,1,.01,null,null,pct)+sliderRow('shape.terrace','Terraces',0,1,.01,null,null,pct)+sliderRow('shape.tsteps','Steps',3,14,1))}
    ${acc('Size',sliderRow('shape.maxH','Max height',20,1200,5,null,null,m)+sliderRow('shape.world','World size',400,8000,50,null,null,m),false,fmt(S.shape.world)+' m')}
    <div class="facts" id="facts"></div><p class="tip" style="margin-top:12px">${TIPS.generate}</p>`;
  }else if(t==='nodes'){
    h=`<div class="prompt"><textarea id="nodePrompt" rows="1" placeholder="Describe a node graph…" aria-label="Describe a node graph"></textarea><button class="anodized press" id="nodeGo" aria-label="Build graph from description">${SPARK}</button></div><div class="ai-note" id="nodeNote"></div><div id="gHost"></div>`;
  }else if(t==='sculpt'){
    const ctxh=S.tool==='stamp'?`<div class="label">Landform stamp · tap to place</div><div class="chips">${Object.entries(STAMPS).map(([k,l])=>`<button class="chipb press" data-stamp="${k}" aria-pressed="${S.stamp===k}">${l}</button>`).join('')}</div>`:
      S.tool==='paint'?`<div class="label">Paint material</div><div class="chips">${Object.entries(PAINTS).map(([k,p])=>`<button class="chipb press" data-paint="${k}" aria-pressed="${S.paint===k}">${p.c?`<span class="swatch" style="background:rgb(${p.c})"></span>`:''}${p.n}</button>`).join('')}</div>`:
      S.tool==='plant'?`<div class="label">Vegetation mask</div>${seg('plant',[['add','Grow more'],['remove','Clear area']])}`:'';
    h=`<div class="tools">${TOOLS.map(([k,l,p])=>`<button class="tool press${S.tool===k?' anodized':''}" data-tool="${k}" aria-pressed="${S.tool===k}">${svg(p)}${l}</button>`).join('')}</div>${ctxh}
    ${acc('Brush',sliderRow('brush.size','Size',5,Math.round(S.shape.world*.3),1,null,240,v=>fmt(v*2)+' m')+sliderRow('brush.strength','Strength',.05,1,.01,null,.5,pct)+sliderRow('brush.falloff','Softness',0,1,.01,null,.7,pct)+tg('brush.mirror','Mirror left / right','Sculpt both halves at once'),true)}
    <p class="tip" style="margin-top:10px">${TIPS.sculpt}</p>`;
  }else if(t==='fluid'){
    h=`<div class="prompt"><textarea id="fluidPrompt" rows="1" placeholder="Describe the water…" aria-label="Describe the water"></textarea><button class="anodized press" id="fluidGo" aria-label="Generate water from description">${SPARK}</button></div><div class="ai-note" id="fluidNote"></div>
    <div class="seg" role="group"><button class="press" data-ftool="spring" aria-pressed="${S.tool==='spring'}">Place spring</button><button class="press" data-ftool="channel" aria-pressed="${S.tool==='channel'}">Carve channel</button></div>
    <div class="stat"><span class="tag">${S.fluid.springs.length} spring${S.fluid.springs.length===1?'':'s'}</span><span class="tag ${FL.running?'on':''}">${FL.R?fmtTime(FL.time)+' simulated':'Not started'}</span><span class="tag">${FL.R?FL.R+'² sim grid':QUALITY[S.quality].sim+'² sim grid'}</span></div>
    <div style="height:6px"></div>
    ${sliderRow('fluid.rain','Rain',0,1,.01,null,.35,pct)+sliderRow('fluid.flow','Spring flow',0,1,.01,null,.7,pct)+sliderRow('fluid.carve','Carve',0,1,.01,null,.5,pct)+sliderRow('fluid.evap','Evaporation',0,1,.01,null,.25,pct)+sliderRow('biome.sea','Sea level',0,.6,.005,null,null,v=>fmt(v*S.shape.maxH)+' m')}
    <div class="btns"><button class="btn metal press" id="fBake">Bake now</button><button class="btn plain press" id="fClear">Clear water</button></div>
    <div class="btns" style="margin-top:6px"><button class="btn plain press" id="fSprings">Remove springs</button><button class="btn plain press" id="fDry">Dry riverbeds</button></div>
    <div style="height:10px"></div>
    ${acc('Classic erosion',`<div class="label">Rainfall droplets</div>${sliderRow('ero.drops','Raindrops',10000,200000,5000,null,60000,v=>Math.round(v/1000)+'k')+sliderRow('ero.power','Carving',.2,2,.05,null,1)}<div class="btns"><button class="btn metal press" id="runHyd">Run rainfall</button></div>
      <div class="label">Weathering</div>${sliderRow('ero.talus','Talus angle',15,60,1,null,34,v=>Math.round(v)+'°')+sliderRow('ero.passes','Passes',5,80,1,null,30)}<div class="btns"><button class="btn metal press" id="runTh">Run weathering</button></div>
      <div class="btns"><button class="btn plain press" id="runSm">Smooth all</button><button class="btn plain press" id="runSh">Sharpen all</button></div>`)}
    <p class="tip" style="margin-top:10px">${TIPS.fluid}</p>`;
  }else if(t==='photo'){
    const P=S.photo;
    h=`<div class="photo-drop"><button class="thumb press" id="pickThumb" aria-label="Pick image" style="${REF.url?`background-image:url(${REF.url})`:''}">${REF.url?'':svg('<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/>')}</button>
      <div style="flex:1;min-width:0"><div class="label" style="margin-top:0">Interpret as</div>${ddBtn('modeDD',PHOTO_MODES[P.mode].n,'metal wide')}<p class="hint">${PHOTO_MODES[P.mode].d}</p></div></div>
    ${REF.status?`<p class="ai-note" style="margin-top:10px">${esc(REF.status)}</p>`:''}
    <div style="height:6px"></div>
    ${sliderRow('photo.height','Height',0,1,.01,null,.6,pct)+sliderRow('photo.detail','Photo detail',0,1,.01,null,.35,pct)+sliderRow('photo.blur','Smoothing',0,8,1,null,2)}
    ${tg('photo.ai','AI reading','Claude looks at the image to plan heights, water, trees and cabins')}${tg('photo.scatter','Grow what the AI sees','Sets forest, bush, grass and rock density')}${tg('photo.colors','Colors from image','Drapes the picture over the land (best for top-down maps)')}${tg('photo.invert','Invert')}${tg('photo.pin','Pin reference on screen','Sculpt by eye against the picture')}
    <div class="btns"><button class="btn anodized press" id="photoBuild" ${REF.img?'':'disabled'}>Build terrain</button></div>${REF.ai?`<div class="btns"><button class="btn plain press" id="photoReread">Read again with AI</button></div>`:''}
    <p class="tip" style="margin-top:12px">${TIPS.photo}</p>`;
  }else if(t==='biome'){
    const T=S.scatter.types,typeAcc=k=>{const c=T[k],L=SCATTER_TYPES[k];return acc(L.label,tg(`scatter.types.${k}.on`,'Show')+sliderRow(`scatter.types.${k}.density`,'Density',0,1,.01,null,L.def.density,pct)+sliderRow(`scatter.types.${k}.lo`,'Lowest',0,1,.01,null,L.def.lo,pct)+sliderRow(`scatter.types.${k}.hi`,'Highest',0,1,.01,null,L.def.hi,pct)+sliderRow(`scatter.types.${k}.slope`,'Max slope',5,90,1,null,L.def.slope,v=>Math.round(v)+'°')+sliderRow(`scatter.types.${k}.size`,'Size',.5,4,.05,null,L.def.size,v=>(+v).toFixed(2)+'×')+sliderRow(`scatter.types.${k}.cluster`,'Clustering',0,1,.01,null,L.def.cluster,pct),false,`<span data-count="${k}">${fmt(scatterCounts[k]||0)}</span>`)};
    h=`${acc('Coloring',sliderRow('biome.sea','Sea level',0,.6,.005,null,null,v=>fmt(v*S.shape.maxH)+' m')+sliderRow('biome.beach','Beach',0,.05,.001,null,null,v=>fmt(v*S.shape.maxH)+' m')+sliderRow('biome.snow','Snow line',.2,1,.01,null,null,v=>v>=1?'none':fmt(v*S.shape.maxH)+' m')+sliderRow('biome.rock','Rock slope',.2,1.4,.01,null,null,v=>Math.round(Math.acos(1-clamp(v*.42,0,1))*180/Math.PI)+'°')+sliderRow('biome.lush','Greenery',0,1,.01,null,null,pct),true)}
    <div style="height:4px"></div>${tg('scatter.on','Vegetation, rocks & cabins','Instanced 3D assets, placed by rules')}
    ${['conifer','broadleaf','bush','grass','boulder'].map(typeAcc).join('')}
    ${acc('Wooden structures',tg('scatter.types.structure.on','Show')+sliderRow('scatter.types.structure.count','Count',0,30,1,null,6)+sliderRow('scatter.types.structure.size','Size',.5,4,.05,null,1.6,v=>(+v).toFixed(2)+'×')+`<div class="btns"><button class="btn plain press" id="stReset">Auto-place again</button></div><p class="hint">${S.structs.length?S.structs.length+' placed by AI or by you. Auto-place again replaces them.':'Cabins and watchtowers settle on flat, dry ground.'}</p>`,false,`<span data-count="structure">${scatterCounts.structure||0}</span>`)}
    <p class="tip" style="margin-top:10px">${TIPS.biome}</p>`;
  }else if(t==='export'){
    const e=S.exp,det=[[1,'Full'],[2,'Half'],[4,'Quarter'],[8,'Eighth']].filter(([s])=>(N-1)/s>=64),tex=[1024,2048].concat(S.quality==='pro'||S.quality==='ultra'?[4096]:[]);
    h=`<div class="label" style="margin-top:0">Format</div>${seg('exp.fmt',[['glb','GLB'],['obj','OBJ'],['height','Heightmap']])}
    <div style="height:8px"></div>
    ${e.fmt!=='height'?`<div class="row" style="grid-template-columns:96px 1fr"><label>Mesh detail</label>${ddBtn('detDD',det.find(d=>d[0]===e.detail)?.[1]||'Full','metal wide')}</div>`:''}
    <div class="row" style="grid-template-columns:96px 1fr"><label>Texture</label>${ddBtn('texDD',e.tex+' px','metal wide')}</div>
    ${e.fmt!=='height'?tg('exp.base','Solid base',e.fmt==='obj'?'Watertight shell for 3D printing':'Closes the sides and bottom')+sliderRow('exp.depth','Base depth',5,300,5,null,40,m):''}
    ${e.fmt==='glb'?tg('exp.scatter','Include trees, rocks & cabins','Merged meshes with vertex colors (grass left out)'):''}
    ${tg('exp.masks','Masks','Slope, water, vegetation and snow PNGs')}
    <div class="facts" id="expFacts"></div><p class="tip" style="margin-top:12px">${TIPS.export}</p>`;
  }
  b.innerHTML=h;bindPanel(t);
}
const pct=v=>Math.round(v*100)+'%',m=v=>fmt(v)+' m';
function bindPanel(t){
  const b=$('#sheetBody'),on=(id,f)=>{const el=$('#'+id,b);if(el)el.onclick=f};
  bindSliders(b);bindToggles(b);bindSegs(b);
  $$('textarea',b).forEach(ta=>ta.oninput=()=>{ta.style.height='38px';ta.style.height=Math.min(ta.scrollHeight,110)+'px'});
  if(t==='generate'){
    const go=()=>promptBar('generate',$('#genPrompt').value,$('#genNote'),$('#genGo'));on('genGo',go);$('#genPrompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();go()}};
    bindPad();drawPreview();drawVariations();renderFacts();
    const si=$('#seedIn');si.onchange=()=>{const v=parseInt(si.value,10);if(!isNaN(v)){S.seed=Math.abs(v)%1e9;regenerate();drawVariations();drawPreview()}};
    on('dice',()=>{S.seed=(Math.random()*1e6)|0;si.value=S.seed;regenerate();drawVariations();drawPreview()});
    on('reroll',()=>{varBase=(Math.random()*1e6)|0;drawVariations()});
    $$('[data-var]',b).forEach(x=>x.onclick=()=>{S.seed=varSeeds[+x.dataset.var];si.value=S.seed;regenerate();drawPreview();toast('Seed '+S.seed)});
  }
  if(t==='nodes'){renderGraphEditor($('#gHost'));const go=()=>promptBar('nodes',$('#nodePrompt').value,$('#nodeNote'),$('#nodeGo'));on('nodeGo',go)}
  if(t==='sculpt'){
    $$('[data-tool]',b).forEach(x=>x.onclick=()=>setTool(x.dataset.tool));
    $$('[data-stamp]',b).forEach(x=>x.onclick=()=>{S.stamp=x.dataset.stamp;$$('[data-stamp]',b).forEach(y=>y.setAttribute('aria-pressed',y===x))});
    $$('[data-paint]',b).forEach(x=>x.onclick=()=>{S.paint=x.dataset.paint;$$('[data-paint]',b).forEach(y=>y.setAttribute('aria-pressed',y===x))});
  }
  if(t==='fluid'){
    const go=()=>promptBar('fluid',$('#fluidPrompt').value,$('#fluidNote'),$('#fluidGo'));on('fluidGo',go);
    $$('[data-ftool]',b).forEach(x=>x.onclick=()=>{const tl=x.dataset.ftool;if(S.tool===tl){S.tool='raise';setMode('orbit')}else{S.tool=tl;setMode('sculpt');toast(tl==='spring'?'Tap high ground to place a spring; tap it again to remove':'Drag along a valley to carve a channel')}renderSheet()});
    on('fBake',()=>{if(!FL.R){toast('Run the simulation first');return}fluidBake();toast('Rivers and wet soil baked in')});
    on('fClear',()=>{fluidClear();toast('Water cleared')});
    on('fSprings',()=>{S.fluid.springs=[];updateSpringMarkers();renderSheet();saveSoon()});
    on('fDry',()=>{pushUndo();WM.fill(0);updateAll();saveSoon();toast('Riverbeds dried')});
    on('runHyd',()=>runErosion('hydraulic'));on('runTh',()=>runErosion('thermal'));on('runSm',()=>runErosion('smooth'));on('runSh',()=>runErosion('sharpen'));
  }
  if(t==='photo'){
    on('pickThumb',pickPhoto);on('photoBuild',buildFromPhoto);on('photoReread',async()=>{REF.ai=null;busy(true,'Claude is reading the image…',.3);try{await aiReadRef()}finally{busy(false)}renderSheet()});
    on('modeDD',e=>openMenu(e.currentTarget,Object.entries(PHOTO_MODES).map(([k,v])=>({v:k,label:v.n,sub:v.d})),v=>{S.photo.mode=v;if(v==='height')S.photo.colors=false;REF.ai=null;renderSheet();saveSoon()},S.photo.mode));
  }
  if(t==='biome'){on('stReset',()=>{S.structs=[];S.seed2=(S.seed2||0)+1;buildScatter();renderSheet();saveSoon()})}
  if(t==='export'){
    const e=S.exp;
    on('detDD',ev=>openMenu(ev.currentTarget,[[1,'Full'],[2,'Half'],[4,'Quarter'],[8,'Eighth']].filter(([s])=>(N-1)/s>=64).map(([s,l])=>{const Mm=(N-1)/s+1;return{v:s,label:l,sub:`${Mm}² vertices · ${fmt((Mm-1)**2*2)} triangles`}}),v=>{e.detail=v;renderSheet();saveSoon()},e.detail));
    on('texDD',ev=>openMenu(ev.currentTarget,[1024,2048].concat(S.quality==='pro'||S.quality==='ultra'?[4096]:[]).map(v=>({v,label:v+' px',sub:v===4096?'Sharpest; takes longer to bake':v===2048?'Recommended':'Fast, light'})),v=>{e.tex=v;renderSheet();saveSoon()},e.tex));
    renderExportFacts();
  }
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
  pad.onpointerdown=e=>{pad.setPointerCapture(e.pointerId);on=true;pushUndo();const [x,y]=at(e);applyMacro(x,y);place();drawPreview()};
  pad.onpointermove=e=>{if(!on)return;const [x,y]=at(e);applyMacro(x,y);place();const now=performance.now();if(now-last>40){last=now;drawPreview()}};
  const up=async()=>{if(!on)return;on=false;regenerate(false);renderSheet();if(S.macro.y>.3)await runErosion('hydraulic',Math.round((S.macro.y-.3)*90000))};
  pad.onpointerup=up;pad.onpointercancel=up;
  pad.onkeydown=e=>{const d={ArrowLeft:[-.05,0],ArrowRight:[.05,0],ArrowUp:[0,-.05],ArrowDown:[0,.05]}[e.key];if(!d)return;e.preventDefault();applyMacro(clamp(S.macro.x+d[0],0,1),clamp(S.macro.y+d[1],0,1));place();drawPreview();clearTimeout(pad._t);pad._t=setTimeout(()=>{pushUndo();regenerate(false)},400)};
}
function renderFacts(){const f=$('#facts');if(!f)return;const W=S.shape.world;f.innerHTML=`<span>Area</span><span>${(W*W/1e6).toFixed(2)} km²</span><span>Lowest · highest</span><span>${fmt(stats.lo)} · ${fmt(stats.hi)} m</span><span>Under water</span><span>${Math.round(stats.water*100)}%</span><span>Grid</span><span>${N}² · ${(W/(N-1)).toFixed(1)} m/cell</span>`}
function renderExportFacts(){
  const f=$('#expFacts');if(!f)return;const e=S.exp;
  if(e.fmt==='height'){f.innerHTML=`<span>Heightmap</span><span>${N}², 16-bit PNG + RAW</span><span>Range</span><span>${fmt(stats.lo)}–${fmt(stats.hi)} m</span><span>Color map</span><span>${e.tex} px</span>`;return}
  const Mm=(N-1)/e.detail+1,v=Mm*Mm,tr=(Mm-1)*(Mm-1)*2,sc=e.fmt==='glb'&&e.scatter&&S.scatter.on?['conifer','broadleaf','bush','boulder'].reduce((a,k)=>a+(scatterCounts[k]||0),0)+(scatterCounts.structure||0):0;
  f.innerHTML=`<span>Terrain</span><span>${fmt(v)} verts · ${fmt(tr)} tris</span><span>UV layout</span><span>1 island · 0 seams</span><span>Texture</span><span>${e.tex}² albedo</span>${sc?`<span>Scatter</span><span>${fmt(Math.min(sc,QUALITY[S.quality].scatter>1?30000:16000))} objects</span>`:''}<span>Units</span><span>meters · Y up</span>`;
}
function onScatterBuilt(){$$('[data-count]').forEach(el=>{el.textContent=fmt(scatterCounts[el.dataset.count]||0)});if(S.tab==='export')renderExportFacts()}
