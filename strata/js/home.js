"use strict";
/* Strata Home: Creations (projects saved in this browser's IndexedDB), Library (presets, node graphs, stamps, looks, palettes),
   Settings (quality, theme, controls, AI provider + API key, storage). */
const DB={p:null,
  open(){if(this.p)return this.p;this.p=new Promise((res,rej)=>{try{const r=indexedDB.open('strata',2);r.onupgradeneeded=()=>{const d=r.result;for(const s of ['kv','proj','meta'])if(!d.objectStoreNames.contains(s))d.createObjectStore(s)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}});return this.p},
  async op(store,mode,fn){const db=await this.open();return new Promise((res,rej)=>{const tx=db.transaction(store,mode),st=tx.objectStore(store),rq=fn(st);tx.oncomplete=()=>res(rq&&rq.result);tx.onerror=()=>rej(tx.error)})},
  get(s,k){return this.op(s,'readonly',st=>st.get(k))},set(s,k,v){return this.op(s,'readwrite',st=>st.put(v,k))},del(s,k){return this.op(s,'readwrite',st=>st.delete(k))},
  all(s){return this.op(s,'readonly',st=>st.getAll())},clear(s){return this.op(s,'readwrite',st=>st.clear())}};
let curId=null,lastThumb=0;
const newId=()=>'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function snapshot(){try{renderer.render(scene,camera);const c=document.createElement('canvas'),w=320,h=240;c.width=w;c.height=h;const x=c.getContext('2d'),src=renderer.domElement,sw=src.width,sh=src.height,s=Math.min(sw/w,sh/h);
  x.fillStyle=getComputedStyle(document.body).getPropertyValue('--sky-b')||'#bcd';x.fillRect(0,0,w,h);x.drawImage(src,(sw-w*s)/2,(sh-h*s)/2-sh*.08,w*s,h*s,0,0,w,h);return c.toDataURL('image/jpeg',.72)}catch(e){return null}}
function packProject(){return{S:JSON.parse(JSON.stringify(S)),N,H,PC:Uint8Array.from(PC),PW:Uint8Array.from(PW,v=>v*255),SM:Uint8Array.from(SM,v=>clamp(v*100,0,255)),WM:Uint8Array.from(WM,v=>v*255),MK:Uint8Array.from(MK,v=>v*255),DF:Uint8Array.from(DF,v=>v*255)}}
function unpackProject(d){const def=DEF(),s=d.S;
  S={...def,...s,shape:{...def.shape,...s.shape},biome:{...def.biome,...s.biome},brush:{...def.brush,...s.brush},ero:{...def.ero,...s.ero},fluid:{...def.fluid,...s.fluid},lava:{...def.lava,...s.lava},snow:{...def.snow,...s.snow},wind:{...def.wind,...s.wind},sim:{...def.sim,...s.sim},weather:{...def.weather,...(s.weather||{})},cam:{...def.cam,...(s.cam||{})},
    view:{...def.view,...s.view},exp:{...def.exp,...s.exp},photo:{...def.photo,...s.photo},sub:{...def.sub,...s.sub},
    scatter:{on:s.scatter?s.scatter.on!==false:true,types:Object.fromEntries(Object.entries(scatterDefaults()).map(([k,v])=>[k,{...v,...(s.scatter&&s.scatter.types&&s.scatter.types[k])}]))}};
  if(!QUALITY[S.quality])S.quality=autoQuality();if(!['create','sculpt','simulate','biome','export'].includes(S.tab))S.tab='create';
  N=d.N;H=d.H instanceof Float32Array?d.H:new Float32Array(d.H);PC=Float32Array.from(d.PC);PW=Float32Array.from(d.PW,v=>v/255);SM=Float32Array.from(d.SM,v=>v/100);WM=Float32Array.from(d.WM,v=>v/255);MK=d.MK?Float32Array.from(d.MK,v=>v/255):new Float32Array(N*N);DF=d.DF?Float32Array.from(d.DF,v=>v/255):new Float32Array(N*N)}
async function saveProject(withThumb){if(!H)return;if(!curId)curId=newId();const now=Date.now(),meta=(await DB.get('meta',curId).catch(()=>null))||{id:curId,created:now};
  meta.name=S.name;meta.updated=now;meta.N=N;meta.preset=S.preset;if(withThumb||!meta.thumb||now-lastThumb>20000){const t=snapshot();if(t){meta.thumb=t;lastThumb=now}}
  await DB.set('proj',curId,packProject());await DB.set('meta',curId,meta);await DB.set('kv','current',curId)}
async function loadCurrent(){try{
  let id=await DB.get('kv','current'),d=id&&await DB.get('proj',id);
  if(!d){const old=await DB.get('kv','project');if(old&&old.S&&old.H){id=newId();await DB.set('proj',id,old);await DB.set('meta',id,{id,name:old.S.name||'Restored terrain',created:Date.now(),updated:Date.now(),N:old.N});await DB.set('kv','current',id);d=old}}
  if(!d||!d.H||d.H.length!==d.N*d.N)return false;unpackProject(d);curId=id;return true}catch(e){return false}}
async function openProject(id){const d=await DB.get('proj',id);if(!d){toast('That creation could not be opened','warn');return}
  if(SR.running)simStop(false);await saveProject(true).catch(()=>{});
  const old=H&&d.N===N?H.slice():null;unpackProject(d);curId=id;await DB.set('kv','current',id);undoS.length=0;redoS.length=0;syncUndo();
  FL.R=0;LV.R=0;SN.R=0;WD.R=0;for(const k in OV)hideOverlay(k);
  genMoist();buildGeometry();terrain.material=MATS[S.view.look]||MATS.natural;applyQuality();updateAll();if(old)morphFrom(old);frame(true);ensureScatterMeshes();buildScatter();updateSpringMarkers();
  if(!S.graph)S.graph=GRAPH_TEMPLATES['Alpine range']();nodeCache.clear();closeHome();setMode('orbit');renderSheet('enter');toast('Opened '+S.name,'ok')}
async function newProject(){await saveProject(true).catch(()=>{});const q=S.quality,old=H.slice();S=DEF();S.quality=q;S.seed=(Math.random()*1e6)|0;S.name='Terrain '+new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'})+' '+new Date().toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  S.graph=GRAPH_TEMPLATES['Alpine range']();curId=newId();undoS.length=0;redoS.length=0;syncUndo();FL.R=0;LV.R=0;SN.R=0;WD.R=0;for(const k in OV)hideOverlay(k);
  if(N!==QUALITY[q].res){N=QUALITY[q].res;buildGeometry()}regenerate(false);if(old.length===H.length)morphFrom(old);setLook('natural');frame(true);updateSpringMarkers();await saveProject(true);closeHome();renderSheet('enter');toast('New terrain ready','ok')}

/* ---------------- home UI ---------------- */
let homeTab='creations';
function openHome(tab){closeHelper();closePanel(true);homeTab=tab||homeTab;$('#home').hidden=false;renderHome('enter');saveProject(true).catch(()=>{})}
function closeHome(){$('#home').hidden=true}
$('#homeBtn').onclick=()=>openHome();$('#closeHome').onclick=closeHome;
$$('#homeSeg [data-home]').forEach(b=>b.onclick=()=>{const i=['creations','library','settings'],dir=i.indexOf(b.dataset.home)>i.indexOf(homeTab)?'enter-r':'enter-l';homeTab=b.dataset.home;renderHome(dir)});
async function renderHome(anim){
  $$('#homeSeg [data-home]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.home===homeTab));requestAnimationFrame(()=>segIndicator($('#homeSeg')));
  $('#homeTitle').textContent={creations:'Creations',library:'Library',settings:'Settings'}[homeTab];
  const body=$('#homeBody');body.classList.remove('enter','enter-l','enter-r');
  if(homeTab==='creations')await renderCreations(body);else if(homeTab==='library')renderLibrary(body);else renderSettings(body);
  if(anim&&!SET.reduceMotion){void body.offsetWidth;body.classList.add(anim)}
}
async function renderCreations(body){
  let list=[];try{list=(await DB.all('meta')).sort((a,b)=>b.updated-a.updated)}catch(e){}
  const when=t=>{const d=(Date.now()-t)/1000;return d<60?'just now':d<3600?Math.round(d/60)+' min ago':d<86400?Math.round(d/3600)+' h ago':new Date(t).toLocaleDateString()};
  body.innerHTML=`<div class="btns" style="margin:0 0 12px"><button class="btn anodized press" id="hNew">${svg('<path d="M12 5v14M5 12h14"/>',2.4)}New terrain</button><button class="btn metal press" id="hDup">Save a copy</button></div>
  <div class="cards" id="hCards">${list.map(p=>`<div class="card${p.id===curId?' cur':''}" data-id="${p.id}"><button class="press" data-open="${p.id}" style="display:block;width:100%;text-align:left" aria-label="Open ${esc(p.name)}">${p.thumb?`<img src="${p.thumb}" alt="">`:`<div class="ph">${svg('<path d="M2 19 9 7l4 6 3-4 6 10z"/>')}</div>`}<div class="meta"><b>${esc(p.name||'Untitled')}</b><small>${p.id===curId?'Open now · ':''}${when(p.updated)} · ${p.N}²</small></div></button><button class="more press" data-more="${p.id}" aria-label="More for ${esc(p.name)}">${svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>')}</button></div>`).join('')}</div>
  ${list.length?'':'<p class="hint">Your creations are saved automatically in this browser.</p>'}<p class="hint">Saved on this device only. Export a creation to keep it elsewhere.</p>`;
  $('#hNew').onclick=newProject;
  $('#hDup').onclick=async()=>{await saveProject(true);const d=await DB.get('proj',curId),m=await DB.get('meta',curId),id=newId();S.name=(m.name||'Terrain')+' copy';d.S.name=S.name;await DB.set('proj',id,d);await DB.set('meta',id,{...m,id,name:S.name,created:Date.now(),updated:Date.now()});curId=id;await DB.set('kv','current',id);crumb();toast('Saved a copy','ok');renderCreations(body).then(()=>{const c=$(`#hCards [data-id="${id}"]`);c&&c.classList.add('new')})};
  $$('[data-open]',body).forEach(b=>b.onclick=()=>{const id=b.dataset.open;if(id===curId){closeHome();return}busy(true,'Opening…',.5);openProject(id).finally(()=>busy(false))});
  $$('[data-more]',body).forEach(b=>b.onclick=()=>{const id=b.dataset.more;openMenu(b,[{v:'open',label:'Open',icon:IC.focus},{v:'rename',label:'Rename',icon:IC.type},{v:'dup',label:'Duplicate',icon:IC.dice},{v:'del',label:'Delete',icon:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'}],async a=>{
    if(a==='open'){if(id!==curId)openProject(id);else closeHome()}
    if(a==='rename'){const m=await DB.get('meta',id);openPanel(b,`<div style="padding:8px"><div class="label" style="margin-top:0">Name</div><input class="field" id="rnIn" value="${esc(m.name||'')}" maxlength="48"><div class="btns"><button class="btn anodized press" id="rnOk">Save</button></div></div>`,p=>{const inp=$('#rnIn',p);inp.focus();inp.select();const ok=async()=>{const n=inp.value.trim()||'Untitled';m.name=n;await DB.set('meta',id,m);const d=await DB.get('proj',id);if(d){d.S.name=n;await DB.set('proj',id,d)}if(id===curId){S.name=n;crumb()}closePanel();renderCreations(body)};$('#rnOk',p).onclick=ok;inp.onkeydown=e=>{if(e.key==='Enter')ok()}},{width:300})}
    if(a==='dup'){const d=await DB.get('proj',id),m=await DB.get('meta',id),nid=newId();d.S.name=(m.name||'Terrain')+' copy';await DB.set('proj',nid,d);await DB.set('meta',nid,{...m,id:nid,name:d.S.name,created:Date.now(),updated:Date.now()});toast('Duplicated','ok');renderCreations(body).then(()=>{const c=$(`#hCards [data-id="${nid}"]`);c&&c.classList.add('new')})}
    if(a==='del'){if(id===curId){toast('Open another creation before deleting this one','warn');return}openMenu(b,[{v:1,label:'Delete forever',sub:'This cannot be undone'},{v:0,label:'Keep it'}],async yes=>{if(!yes)return;const c=$(`#hCards [data-id="${id}"]`);if(c){c.classList.add('bye');await new Promise(r=>setTimeout(r,380))}await DB.del('proj',id);await DB.del('meta',id);toast('Deleted');renderCreations(body)})}
  })});
}
function libCard(label,sub,draw,data){return `<button class="card press" data-lib="${esc(data)}"><canvas data-draw="${esc(draw)}" width="64" height="48"></canvas><div class="meta"><b>${esc(label)}</b>${sub?`<small>${esc(sub)}</small>`:''}</div></button>`}
async function renderLibrary(body){
  let mine=[];try{mine=(await DB.get('kv','graphs'))||[]}catch(e){}
  body.innerHTML=`<div class="lib-sec"><h3>Landscapes</h3><div class="lib-row">${Object.keys(PRESETS).map(k=>libCard(k,PALETTES[PRESETS[k].biome.palette].name,'preset:'+k,'preset:'+k)).join('')}</div></div>
  <div class="lib-sec"><h3>Node graphs</h3><div class="lib-row">${Object.keys(GRAPH_TEMPLATES).map(k=>libCard(k,'Template','graph:'+k,'graph:'+k)).join('')}${mine.map((g,i)=>libCard(g.name,'Saved by you','mine:'+i,'mine:'+i)).join('')}</div>
    <div class="btns"><button class="btn metal press" id="libSaveGraph">Save current graph</button></div></div>
  <div class="lib-sec"><h3>Landform stamps</h3><div class="chips">${Object.entries(STAMPS).map(([k,l])=>`<button class="chipb press" data-stamp="${k}">${l}</button>`).join('')}</div></div>
  <div class="lib-sec"><h3>Looks</h3><div class="chips">${Object.entries(LOOKS).map(([k,l])=>`<button class="chipb press" data-look="${k}" aria-pressed="${S.view.look===k}">${l.n}</button>`).join('')}</div></div>
  <div class="lib-sec"><h3>Palettes</h3><div class="chips">${Object.entries(PALETTES).map(([k,p])=>`<button class="chipb press" data-pal="${k}" aria-pressed="${S.biome.palette===k}"><span class="swatch" style="background:linear-gradient(135deg,rgb(${p.lush}),rgb(${p.rock}))"></span>${p.name}</button>`).join('')}</div></div>
  <div class="lib-sec"><h3>Simulation recipes</h3><div class="chips">${[['Erupting volcano','lava'],['Spring-fed river','water'],['Alpine snowfall','snow'],['Marching dunes','wind'],['Ancient erosion','erode']].map(([n,k])=>`<button class="chipb press" data-recipe="${k}">${n}</button>`).join('')}</div></div>`;
  requestAnimationFrame(()=>$$('canvas[data-draw]',body).forEach(cv=>{const d=cv.dataset.draw,[t,k]=[d.slice(0,d.indexOf(':')),d.slice(d.indexOf(':')+1)];let f=null;
    if(t==='preset'){const p=PRESETS[k];f=genField(64,{cone:0,crater:0,...p.shape},4127);drawRelief(cv,f,64,p.biome.palette)}
    else{const g=t==='graph'?GRAPH_TEMPLATES[k]():mine[+k]&&mine[+k].graph;if(g){f=evalGraph(g,64,true);if(f)drawRelief(cv,normalizeField(f.slice()),64)}}}));
  $$('[data-lib]',body).forEach(b=>b.onclick=async()=>{const d=b.dataset.lib,t=d.slice(0,d.indexOf(':')),k=d.slice(d.indexOf(':')+1);closeHome();
    if(t==='preset'){applyPreset(k);switchTab('create','generate');toast(k+' loaded','ok')}
    else{S.graph=t==='graph'?GRAPH_TEMPLATES[k]():JSON.parse(JSON.stringify(mine[+k].graph));nodeCache.clear();switchTab('create','nodes');await buildFromGraph()}});
  $('#libSaveGraph').onclick=async()=>{const name=(S.name||'My graph')+' graph';mine.push({name,graph:JSON.parse(JSON.stringify(S.graph))});await DB.set('kv','graphs',mine);toast('Graph saved to Library','ok');renderLibrary(body)};
  $$('[data-stamp]',body).forEach(b=>b.onclick=()=>{S.stamp=b.dataset.stamp;closeHome();switchTab('sculpt');setTool('stamp');toast('Tap the map to place a '+STAMPS[S.stamp].toLowerCase())});
  $$('[data-look]',body).forEach(b=>b.onclick=()=>{setLook(b.dataset.look);renderLibrary(body);saveSoon()});
  $$('[data-pal]',body).forEach(b=>b.onclick=()=>{S.biome.palette=b.dataset.pal;recolorSoon();scatterSoon();renderLibrary(body)});
  $$('[data-recipe]',body).forEach(b=>b.onclick=()=>{const k=b.dataset.recipe;closeHome();if(k==='lava'&&S.shape.cone<.3)applyPreset('Volcano isle');if(k==='wind'&&S.preset!=='Dune sea')applyPreset('Dune sea');if(k==='water'&&!S.fluid.springs.length){S.fluid.rain=.25}switchTab('simulate',k);simStart(k)});
}
function setRow(label,sub,ctrl){return `<div class="setrow"><span>${label}${sub?`<small style="display:block;color:var(--ink-3);font-size:12px">${sub}</small>`:''}</span>${ctrl}</div>`}
const stg=(k,label,small)=>`<label class="toggle"><span>${label}${small?`<small>${small}</small>`:''}</span><span class="switch"><input type="checkbox" data-sk="${k}" ${SET[k]?'checked':''}><span></span></span></label>`;
async function renderSettings(body){
  const mode=await aiMode();let est=null;try{est=navigator.storage&&navigator.storage.estimate?await navigator.storage.estimate():null}catch(e){}
  const q=Object.entries(QUALITY);
  body.innerHTML=`<div class="label" style="margin-top:0">Quality</div>${q.map(([k,v])=>`<button class="it press" data-q="${k}" style="display:flex;width:100%;align-items:center;gap:10px;padding:11px 12px;border-radius:14px;text-align:left;${S.quality===k?'background:var(--accent-soft)':''}"><span style="flex:1"><b style="font-weight:650">${v.label}</b><small style="display:block;color:var(--ink-3);font-size:12px">${v.sub}</small></span>${S.quality===k?`<span style="color:var(--gold)">${svg('<path d="m5 12 5 5 9-10"/>',2.6)}</span>`:''}</button>`).join('')}
  <div class="label">Appearance</div>
  <div class="seg" id="setTheme"><span class="ind"></span>${[['','System'],['light','Light'],['dark','Dark']].map(([v,l])=>`<button data-theme="${v}" aria-pressed="${(SET.theme||'')===v}">${l}</button>`).join('')}</div>
  ${stg('reduceMotion','Reduce motion','Turns off animations and the terrain morph')}
  ${setRow('Units','',`<div class="seg" id="setUnits" style="width:150px"><span class="ind"></span><button data-u="m" aria-pressed="${SET.units==='m'}">Meters</button><button data-u="ft" aria-pressed="${SET.units==='ft'}">Feet</button></div>`)}
  <div class="label">Sound</div>${stg('sound','Sounds','Soft clicks, sculpting and nature ambience')}${sliderRow('snd.vol','Volume',0,1,.01,SET.volume??.6,.6,v=>Math.round(v*100)+'%')}
  <div class="label">Controls</div>
  ${sliderRow('cam.sens','Camera speed',.4,2,.05,SET.sens,1,v=>(+v).toFixed(2)+'×')}
  ${stg('invertY','Invert vertical drag')}${stg('leftHand','Left-handed layout','Moves the camera rail to the left')}${stg('haptics','Haptics',IOS?'iPhone taps via iOS 18+ Safari, or full haptics in the test app':'Vibration where the device supports it')}${stg('uiLarge','Larger controls','Bigger buttons and text')}${stg('adaptive','Adaptive resolution','Softer while dragging, sharp when still · saves battery')}${stg('hints','Show tips','Short hints when you switch modes')}
  <div class="label">AI</div>
  <p class="hint" style="margin-top:0">${mode==='claude'?'Using Claude through the app you opened this in. No key needed.':mode==='key'?'Using your Anthropic API key on this device.':'AI is off. Inside the Claude app it works automatically. On the website, add an Anthropic API key below.'}</p>
  <input class="field" id="apiKey" type="password" autocomplete="off" placeholder="sk-ant-… (stored only on this device)" value="${esc(SET.apiKey?'••••••••'+SET.apiKey.slice(-4):'')}">
  <div class="row" style="grid-template-columns:96px 1fr;margin-top:6px"><label>Model</label>${ddBtn('aiModel',AI_MODELS[SET.model]||SET.model,'metal wide')}</div>
  <div class="btns"><button class="btn anodized press" id="keySave">Save key</button><button class="btn plain press" id="keyTest">Test</button>${SET.apiKey?'<button class="btn plain press" id="keyDel">Remove key</button>':''}</div>
  <p class="hint">The key is kept in this browser's storage and sent only to Anthropic. Use a key with a spending limit. Requests run on your Anthropic account.</p>
  <div class="label">Storage</div>
  ${est?`<div class="meter"><i style="width:${Math.min(100,est.usage/est.quota*100).toFixed(1)}%"></i></div><p class="hint" style="margin-top:0">${(est.usage/1048576).toFixed(1)} MB used of ${(est.quota/1048576/1024).toFixed(1)} GB available to this site</p>`:'<p class="hint">Storage size is not reported by this browser.</p>'}
  <div class="btns"><button class="btn plain press" id="clearAll" style="color:var(--bad)">Erase all creations</button></div>
  <div class="label">About</div><p class="hint" style="margin-top:0">Terrain Gen Studio V1 · procedural, sculpted and simulated landscapes. Projects, settings and your key never leave this device unless you export.</p>`;
  bindSliders(body,(k,v)=>{if(k==='snd.vol'){SET.volume=v;auVol()}else SET.sens=v;saveSettings()},k=>k==='snd.vol'?.6:1);
  $$('[data-q]',body).forEach(b=>b.onclick=async()=>{await setQuality(b.dataset.q);renderSettings(body)});
  const th=$('#setTheme',body);requestAnimationFrame(()=>{segIndicator(th);segIndicator($('#setUnits',body))});
  $$('[data-theme]',th).forEach(b=>b.onclick=()=>{SET.theme=b.dataset.theme;saveSettings();applySettings();$$('[data-theme]',th).forEach(x=>x.setAttribute('aria-pressed',x===b));segIndicator(th)});
  $$('[data-u]',body).forEach(b=>b.onclick=()=>{SET.units=b.dataset.u;saveSettings();$$('[data-u]',body).forEach(x=>x.setAttribute('aria-pressed',x===b));segIndicator($('#setUnits',body));renderSheet()});
  $$('input[data-sk]',body).forEach(c=>c.onchange=()=>{SET[c.dataset.sk]=c.checked;saveSettings();applySettings();if(c.dataset.sk==='sound'){if(SET.sound)auInit();else loopsOff();auVol()}});
  $('#aiModel',body).onclick=e=>openMenu(e.currentTarget,Object.entries(AI_MODELS).map(([k,n])=>({v:k,label:n,sub:k==='claude-opus-5-5'?'Most capable (default)':k==='claude-sonnet-5-5'?'Faster, lower cost':'Fastest, lowest cost'})),v=>{SET.model=v;saveSettings();renderSettings(body)},SET.model);
  const ki=$('#apiKey',body);ki.onfocus=()=>{if(ki.value.startsWith('••'))ki.value=''};
  $('#keySave',body).onclick=()=>{const v=ki.value.trim();if(!v||v.startsWith('••')){toast('Paste a key first','warn');return}if(!/^sk-ant-/.test(v)){toast('Anthropic keys start with sk-ant-','warn');return}SET.apiKey=v;saveSettings();_sampleP=null;introDone=false;toast('Key saved on this device','ok');renderSettings(body)};
  const del=$('#keyDel',body);if(del)del.onclick=()=>{SET.apiKey='';saveSettings();introDone=false;toast('Key removed');renderSettings(body)};
  $('#keyTest',body).onclick=async()=>{busy(true,'Contacting Claude…',.4);try{const t=await testAI();toast(t.slice(0,60),'ok')}catch(e){toast(aiErr(e),'warn')}finally{busy(false)}};
  $('#clearAll',body).onclick=e=>openMenu(e.currentTarget,[{v:1,label:'Erase every creation',sub:'Keeps only the terrain open now'},{v:0,label:'Cancel'}],async yes=>{if(!yes)return;await DB.clear('proj');await DB.clear('meta');await saveProject(true);toast('Other creations erased');renderSettings(body)});
}
function applySettings(){
  const r=document.documentElement;if(SET.theme)r.dataset.theme=SET.theme;else delete r.dataset.theme;
  document.body.classList.toggle('reduce-motion',!!SET.reduceMotion);document.body.classList.toggle('left-hand',!!SET.leftHand);document.body.classList.toggle('ui-large',!!SET.uiLarge);
  if(typeof layoutSheet==='function'&&typeof insets!=='undefined')requestAnimationFrame(()=>{layoutSheet();if(typeof dockIndicator==='function')dockIndicator()});if(typeof applyQuality==='function'&&typeof geo!=='undefined'&&geo)applyQuality();
}
