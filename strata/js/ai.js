"use strict";
/* Strata AI: Claude-backed helper chat + "describe it" prompt bars. Tools let Claude change the terrain, node graph, water and scatter. */
let _sample,_sampleP=null;
function getSample(){if(_sampleP)return _sampleP;_sampleP=(async()=>{try{_sample=window.claude&&claude.use?await claude.use('sample'):null}catch(e){_sample=null}return _sample})();return _sampleP}
const num=(v,a,b)=>v==null||v===''||isNaN(+v)?undefined:clamp(+v,a,b);
function stateSummary(){return{preset:S.preset,source:S.source,seed:S.seed,grid:N,shape:S.shape,biome:S.biome,view:{look:S.view.look,vex:S.view.vex},
  fluid:{rain:S.fluid.rain,flow:S.fluid.flow,carve:S.fluid.carve,springs:S.fluid.springs.length,running:FL.running},
  scatter:Object.fromEntries(Object.entries(S.scatter.types).map(([k,v])=>[k,v.density??v.count])),
  stats:{lowest_m:Math.round(stats.lo),highest_m:Math.round(stats.hi),underwater_pct:Math.round(stats.water*100)}}}
const AI_TOOLS=[
  {name:'get_terrain',description:'Current settings and stats (heights in meters).',execute:()=>stateSummary()},
  {name:'get_height_grid',description:'A 16x16 top-down height map of the current terrain, rows from north (v=0) to south (v=1), digits 0 (lowest) to 9 (highest). Use it to find valleys, peaks and where water would flow.',execute:()=>heightGrid(16)},
  {name:'apply_preset',description:'Loads a preset landscape, replacing the current one. Names: '+Object.keys(PRESETS).join(', ')+'.',inputSchema:{type:'object',properties:{name:{type:'string',enum:Object.keys(PRESETS)}},required:['name']},execute:i=>{if(!applyPreset(String(i.name)))throw new Error('Unknown preset');return'Loaded '+i.name}},
  {name:'set_shape',description:'Changes generator settings and regenerates (replaces sculpting). freq 0.8-6 feature scale, oct 3-8, gain 0.3-0.65 roughness, ridges 0-1, warp 0-1, peaks 0.6-3, cone 0-1 central mountain, crater 0-1, island 0-1, terrace 0-1, tsteps 3-14, maxH 20-1200 m, world 400-8000 m, seed integer.',
    inputSchema:{type:'object',properties:Object.fromEntries([...Object.keys(SHAPE_RANGES),'seed'].map(k=>[k,{type:'number'}]))},
    execute:i=>{pushUndo();for(const k in SHAPE_RANGES){const r=SHAPE_RANGES[k],v=num(i[k],r[0],r[1]);if(v!==undefined)S.shape[k]=k==='oct'||k==='tsteps'?Math.round(v):v}if(i.seed!=null&&!isNaN(+i.seed))S.seed=Math.abs(+i.seed|0);S.preset='Custom';regenerate(false);frame();renderSheet();return stateSummary()}},
  {name:'set_biome',description:'Recolors without changing heights. palette '+Object.keys(PALETTES).join('|')+'; sea 0-0.6 and snow 0.2-1 are fractions of max height (snow 1 = none); beach 0-0.05; rock 0.2-1.4 (lower = rock on gentler slopes); lush 0-1 vegetation color.',
    inputSchema:{type:'object',properties:{palette:{type:'string',enum:Object.keys(PALETTES)},sea:{type:'number'},snow:{type:'number'},beach:{type:'number'},rock:{type:'number'},lush:{type:'number'}}},
    execute:i=>{if(PALETTES[i.palette])S.biome.palette=i.palette;const R={sea:[0,.6],snow:[.2,1],beach:[0,.05],rock:[.2,1.4],lush:[0,1]};for(const k in R){const v=num(i[k],...R[k]);if(v!==undefined)S.biome[k]=v}updateAll();renderSheet();saveSoon();return S.biome}},
  {name:'erode',description:'Runs erosion over the whole map. kind hydraulic (rain carves gullies), thermal (slopes slump), smooth, sharpen; amount light|medium|heavy.',
    inputSchema:{type:'object',properties:{kind:{type:'string',enum:['hydraulic','thermal','smooth','sharpen']},amount:{type:'string',enum:['light','medium','heavy']}},required:['kind']},
    execute:async i=>{const a={light:0,medium:1,heavy:2}[i.amount]??1;await runErosion(String(i.kind),i.kind==='hydraulic'?[25000,60000,140000][a]:i.kind==='thermal'?[15,35,70][a]:0);return'Done'}},
  {name:'build_node_graph',description:'Replaces the node graph and builds the terrain from it. Either pass template ('+Object.keys(GRAPH_TEMPLATES).join(', ')+') or nodes+links. Node types: '+Object.entries(NODE_TYPES).map(([k,T])=>`${k}(${Object.keys(T.params).join(',')}${T.ins.length?'; inputs '+T.ins.join(','):''})`).join('; ')+'. Exactly one output node. links: {from,to,port} using your node ids; port is the input index.',
    inputSchema:{type:'object',properties:{template:{type:'string'},nodes:{type:'array',items:{type:'object',properties:{id:{type:'string'},type:{type:'string'},params:{type:'object'}}}},links:{type:'array',items:{type:'object',properties:{from:{type:'string'},to:{type:'string'},port:{type:'number'}}}}}},
    execute:async i=>{
      if(i.template&&GRAPH_TEMPLATES[i.template]){S.graph=GRAPH_TEMPLATES[i.template]()}
      else{if(!Array.isArray(i.nodes)||!i.nodes.length)throw new Error('Give a template or nodes');const ids={},g={nodes:[],links:[],sel:null,view:{x:20,y:20,z:.82}};
        i.nodes.forEach((n,q)=>{if(!NODE_TYPES[n.type])throw new Error('Unknown node type '+n.type);const id='a'+q;ids[n.id]=id;const p=defParams(n.type),T=NODE_TYPES[n.type];
          for(const k in (n.params||{}))if(T.params[k]){const d=T.params[k];p[k]=d.options?(d.options.includes(n.params[k])?n.params[k]:d.def):clamp(+n.params[k],d.min,d.max)}
          g.nodes.push({id,type:n.type,x:40+(q%5)*180,y:30+Math.floor(q/5)*170,p})});
        for(const l of (i.links||[]))if(ids[l.from]&&ids[l.to])g.links.push({from:ids[l.from],to:ids[l.to],port:+l.port||0});
        if(!g.nodes.some(n=>n.type==='output'))throw new Error('Add an output node');S.graph=g}
      nodeCache.clear();await buildFromGraph();if(S.tab==='nodes')renderSheet();return stateSummary()}},
  {name:'set_scatter',description:'Vegetation, rocks and buildings. For conifer, broadleaf, bush, grass, boulder: density 0-1, lo/hi altitude band 0-1 above sea, slope max degrees, size 0.5-4. structure: count 0-30. Also on (master switch).',
    inputSchema:{type:'object',properties:{on:{type:'boolean'},conifer:{type:'object'},broadleaf:{type:'object'},bush:{type:'object'},grass:{type:'object'},boulder:{type:'object'},structure:{type:'object'}}},
    execute:i=>{if(typeof i.on==='boolean')S.scatter.on=i.on;for(const t in SCATTER_TYPES){const c=i[t];if(!c||typeof c!=='object')continue;const d=S.scatter.types[t];
      for(const [k,r] of Object.entries({density:[0,1],lo:[0,1],hi:[0,1],slope:[0,90],size:[.5,4],count:[0,30]})){const v=num(c[k],...r);if(v!==undefined&&k in d)d[k]=k==='count'?Math.round(v):v}if(c.on!=null)d.on=!!c.on}
      S.structs=[];buildScatter();renderSheet();saveSoon();return scatterCounts}},
  {name:'place_structure',description:'Places a wooden cabin or watchtower at u,v (0-1 top-down, v=0 north). Up to 30.',inputSchema:{type:'object',properties:{u:{type:'number'},v:{type:'number'},type:{type:'string',enum:['cabin','tower']}},required:['u','v']},
    execute:i=>{if(!S.structs.length)S.structs=structList.slice();S.structs.push({u:clamp(+i.u,.03,.97),v:clamp(+i.v,.03,.97),type:i.type==='tower'?'tower':'cabin',rot:Math.random()*6.28});buildScatter();saveSoon();return S.structs.length+' structures'}},
  {name:'fluid_setup',description:'Configures the water simulation: rain 0-1, flow 0-1 spring strength, carve 0-1 erosion by flowing water, evap 0-1, sea 0-0.6 sea level (fraction of max height), clear_springs boolean.',
    inputSchema:{type:'object',properties:{rain:{type:'number'},flow:{type:'number'},carve:{type:'number'},evap:{type:'number'},sea:{type:'number'},clear_springs:{type:'boolean'}}},
    execute:i=>{for(const k of ['rain','flow','carve','evap']){const v=num(i[k],0,1);if(v!==undefined)S.fluid[k]=v}const sv=num(i.sea,0,.6);if(sv!==undefined){S.biome.sea=sv;updateAll()}if(i.clear_springs){S.fluid.springs=[];updateSpringMarkers()}renderSheet();saveSoon();return S.fluid}},
  {name:'add_spring',description:'Adds a water spring at u,v (0-1 top-down). Put springs on high ground so water runs downhill. rate 0.2-3.',inputSchema:{type:'object',properties:{u:{type:'number'},v:{type:'number'},rate:{type:'number'}},required:['u','v']},
    execute:i=>{if(S.fluid.springs.length>=16)throw new Error('16 springs max');S.fluid.springs.push({u:clamp(+i.u,0,1),v:clamp(+i.v,0,1),rate:num(i.rate,.2,3)??1});updateSpringMarkers();saveSoon();return S.fluid.springs.length+' springs'}},
  {name:'carve_channel',description:'Carves a river channel along a path of points [{u,v}] (0-1 top-down) from source to mouth. depth meters 1-80, width meters 5-300.',inputSchema:{type:'object',properties:{points:{type:'array',items:{type:'object',properties:{u:{type:'number'},v:{type:'number'}}}},depth:{type:'number'},width:{type:'number'}},required:['points']},
    execute:i=>{const pts=(i.points||[]).map(p=>({u:clamp(+p.u,0,1),v:clamp(+p.v,0,1)})).filter(p=>!isNaN(p.u+p.v));if(pts.length<2)throw new Error('Need 2+ points');carvePath(pts,num(i.depth,1,80)??12,num(i.width,5,300)??60);return'Carved '+pts.length+' points'}},
  {name:'run_fluid',description:'Runs the water simulation for a number of steps (50-1500) then bakes rivers, lakes and wet soil into the terrain.',inputSchema:{type:'object',properties:{steps:{type:'number'}}},
    execute:async i=>{const n=num(i.steps,50,1500)??400;if(!FL.R)fluidInit();else fluidSync();busy(true,'Water is flowing…',0);try{for(let s=0;s<n;s++){fluidStep();if(s%25===0){prog('Water is flowing… '+Math.round(s/n*100)+'%',s/n);updateWater();await nextFrame()}}}finally{busy(false)}fluidBake();return'Simulated '+fmtTime(FL.time)}},
  {name:'set_view',description:'View: look natural|clay|titanium|copper|heat, sunEl 4-85, sunAz 0-360, vex 0.5-3, contours boolean, water boolean.',inputSchema:{type:'object',properties:{look:{type:'string'},sunEl:{type:'number'},sunAz:{type:'number'},vex:{type:'number'},contours:{type:'boolean'},water:{type:'boolean'}}},
    execute:i=>{const R={sunEl:[4,85],sunAz:[0,360],vex:[.5,3]};for(const k in R){const v=num(i[k],...R[k]);if(v!==undefined)S.view[k]=v}if(typeof i.contours==='boolean')S.view.contours=i.contours;if(typeof i.water==='boolean')S.view.water=i.water;if(LOOKS[i.look])setLook(i.look);else updateAll();renderSheet();return S.view}}
];
const MANUAL=`You are the built-in assistant of Strata, a mobile terrain studio. Creation modes: Generate (presets ${Object.keys(PRESETS).join(', ')}; seed; character pad; landform sliders), Nodes (graph of generators, modifiers, erosion, masks, combine → output), Sculpt (Raise, Lower, Smooth, Flatten, Roughen, Terrace, Erode, Stamp [${Object.values(STAMPS).join(', ')}], Paint, Plant), Fluid (shallow-water simulation: rain, springs, carving, sea level; Carve channel and Place spring tools), Photo (reference image → terrain, AI can read photos and contour maps), Biome (palette, coloring, vegetation/rocks/cabins scatter), Export (GLB, OBJ, 16-bit heightmap, masks; terrain UVs are one seamless square).
Coordinates u,v are 0-1 top-down with v=0 north. Answer in plain text, at most about 110 words, short numbered steps for how-tos. When asked to make or change something, use tools, then say in one or two sentences what you did and one thing to try by hand. Never invent controls.`;
async function runPrompt(text,context,onText){
  const sample=await getSample();if(!sample)throw Object.assign(new Error('The AI works when this app is opened in Claude.'),{code:'unavailable'});
  const input=`${MANUAL}\n\n${context||''}\nCurrent terrain: ${JSON.stringify(stateSummary())}\n\nUser: ${text}`;
  return sample(input,{cache:false,tools:AI_TOOLS,onText});
}
async function promptBar(kind,text,noteEl,btn){
  text=(text||'').trim();if(!text)return;btn&&(btn.disabled=true);noteEl.textContent='Thinking…';
  const ctx=kind==='fluid'?'This request came from Fluid Gen. Plan the water: read get_height_grid, place springs on high ground, optionally carve_channel along valleys to the sea or a basin, set fluid_setup, then run_fluid.':
    kind==='nodes'?'This request came from the node editor. Prefer build_node_graph with a custom graph.':'This request came from Generate. Prefer presets/set_shape/set_biome/erode/set_scatter, or build_node_graph for complex forms.';
  try{const r=await runPrompt(text,ctx,({text:t})=>{noteEl.textContent=t});noteEl.textContent=r.text||noteEl.textContent}
  catch(e){noteEl.textContent=e.code==='unavailable'?'The AI works when this app is opened in Claude. Try a preset, the pad, or Guides in the meantime.':e.code==='not_granted'?'Allow Claude access for this page to use the AI.':e.code==='rate_limited'?'The AI is busy. Try again in a minute.':(e.text?e.text+'\n':'')+'Could not finish: '+(e.message||'error')}
  finally{btn&&(btn.disabled=false)}
}
/* ---------------- helper panel ---------------- */
const GUIDES=[
  {t:'Volcano with lava gullies',p:'A cone island with a summit crater and dark flows.',s:['Load Volcano isle in Generate.','Raise Crater for a wider bowl.','In Sculpt pick Stamp → Crater and tap the flank for a side vent.','Paint Basalt streaks downhill, then run Rain erosion lightly in Fluid.'],go:()=>{applyPreset('Volcano isle');switchTab('generate')}},
  {t:'River from springs',p:'Real flowing water that carves its own valley.',s:['Open Fluid. Turn Rain down to 0.1.','Choose Place spring and tap two high points.','Set Carve to 60% and tap Run.','After a minute, Pause. Rivers and wet soil are baked in, and bushes grow along the banks.'],go:()=>{S.fluid.rain=.1;S.fluid.carve=.6;switchTab('fluid')}},
  {t:'Node-built canyonlands',p:'Stepped mesas cut by cracks.',s:['Open Nodes, choose Templates → Canyonlands.','Tap Terrace and drag Steps.','Tap Cells and switch Shape to Plates for blocky buttes.','Build, then add cabins in Biome.'],go:()=>{S.graph=GRAPH_TEMPLATES['Canyonlands']();nodeCache.clear();switchTab('nodes');buildFromGraph()}},
  {t:'Terrain from a photo',p:'Use any landscape photo, sketch or contour map.',s:['Open Photo and pick an image.','Landscape photo uses AI to read layout, trees, rocks, water and cabins.','Ridge sketch: draw dark lines on paper for ridgelines.','Tap Build terrain, then refine with Sculpt.'],go:()=>switchTab('photo')},
  {t:'Game-ready forest scene',p:'A light GLB with trees, rocks and cabins.',s:['In Biome set Conifers and Boulders, keep Grass low.','In Export pick GLB, Half detail, 2048 texture, Include scatter on.','Import into Blender, Unity, Godot or Unreal. Units are meters.'],go:()=>{S.exp.fmt='glb';S.exp.detail=2;S.exp.scatter=true;switchTab('export')}},
  {t:'3D-printable diorama',p:'A closed, watertight block.',s:['Menu → set Exaggerate to 1.5×.','Export OBJ, Full detail, Solid base on.','Scale it down in your slicer.'],go:()=>{S.view.vex=1.5;S.exp.fmt='obj';S.exp.base=true;updateAll();switchTab('export')}}
];
const chat=[];
const SUGGEST=['Make a misty fjord with pine forests','Add a river from the peaks to the sea','Build a node graph for eroded mesas','How do I export for Blender?'];
function addMsg(cls,text){const d=document.createElement('div');d.className='msg '+cls;d.textContent=text;$('#hAsk').appendChild(d);$('#hAsk').scrollTop=1e9;return d}
async function askIntro(){const a=$('#hAsk');a.innerHTML='';const s=await getSample();
  addMsg('bot',s?'Hi. I can explain any tool, or build things for you: landscapes, node graphs, rivers, forests and cabins. Just describe it.':'Hi. Ask how to make something and I will point you to the steps. The full assistant, which can also build terrain for you, works when this app is opened in Claude.');
  const sg=document.createElement('div');sg.className='suggest';sg.innerHTML=SUGGEST.map(q=>`<button type="button" class="press">${esc(q)}</button>`).join('');sg.onclick=e=>{const b=e.target.closest('button');if(b)ask(b.textContent)};a.appendChild(sg)}
async function ask(q){
  q=q.trim();if(!q)return;$('#hAsk .suggest')?.remove();const me=addMsg('me anodized',q);const bub=addMsg('bot thinking','Thinking…');
  const s=await getSample();if(!s){bub.classList.remove('thinking');bub.textContent=offline(q);return}
  const convo=chat.slice(-8).map(m=>(m.role==='user'?'User: ':'Assistant: ')+m.content).join('\n');
  try{const r=await runPrompt(q,convo?'Conversation so far:\n'+convo:'',({text})=>{bub.classList.remove('thinking');bub.textContent=text;$('#hAsk').scrollTop=1e9});
    bub.classList.remove('thinking');bub.textContent=r.text||bub.textContent;chat.push({role:'user',content:q},{role:'assistant',content:bub.textContent})}
  catch(e){bub.classList.remove('thinking');bub.textContent=e.code==='not_granted'?'The assistant needs permission to ask Claude.\n\n'+offline(q):e.code==='rate_limited'?'The assistant is busy. Wait a minute and ask again.':(e.text?e.text+'\n\n':'')+'Could not answer ('+(e.message||'error')+').'}
}
function offline(q){const s=q.toLowerCase(),score=g=>(g.t+' '+g.p+' '+g.s.join(' ')).toLowerCase().split(/\W+/).filter(w=>w.length>3&&s.includes(w)).length;
  const best=GUIDES.map(g=>[score(g),g]).sort((a,b)=>b[0]-a[0])[0];
  return best[0]>0?`${best[1].t}:\n`+best[1].s.map((x,i)=>`${i+1}. ${x}`).join('\n')+'\n\nOpen Guides and tap "Set it up" to jump there.':'Try Guides for step-by-step recipes: volcano, river, node canyons, photo to terrain, game export and 3D printing.'}
function renderGuides(){$('#hGuides').innerHTML=GUIDES.map((g,i)=>`<div class="guide"><h3>${g.t}</h3><p>${g.p}</p><ol>${g.s.map(x=>`<li>${x}</li>`).join('')}</ol><div class="btns"><button class="btn metal press" data-guide="${i}">Set it up</button></div></div>`).join('');
  $$('#hGuides [data-guide]').forEach(b=>b.onclick=()=>{GUIDES[+b.dataset.guide].go();closeHelper();toast('Ready: '+GUIDES[+b.dataset.guide].t)})}
let introDone=false;
function openHelper(){$('#helper').hidden=false;if(!introDone){introDone=true;askIntro();renderGuides()}setTimeout(()=>$('#askInput').focus({preventScroll:true}),60)}
function closeHelper(){$('#helper').hidden=true}
$('#openHelper').onclick=openHelper;$('#closeHelper').onclick=closeHelper;
$('#hTabAsk').onclick=()=>{$('#hTabAsk').setAttribute('aria-pressed','true');$('#hTabGuides').setAttribute('aria-pressed','false');$('#hAsk').hidden=false;$('#hGuides').hidden=true;$('#askForm').hidden=false};
$('#hTabGuides').onclick=()=>{$('#hTabAsk').setAttribute('aria-pressed','false');$('#hTabGuides').setAttribute('aria-pressed','true');$('#hAsk').hidden=true;$('#hGuides').hidden=false;$('#askForm').hidden=true};
$('#askForm').onsubmit=e=>{e.preventDefault();const v=$('#askInput').value;$('#askInput').value='';ask(v)};
$('#askInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#askForm').requestSubmit()}};
