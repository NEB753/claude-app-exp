"use strict";
/* Strata AI. Two providers:
   1) Inside Claude: the artifact "sample" capability (no key needed).
   2) Anywhere else (a hosted website): the official Anthropic JS SDK in the browser with the user's own API key from Settings.
   Both share one tool set, so Claude can build terrain, node graphs, water, lava, snow, wind and scatter. */
let _sampleP=null;
function getSample(){if(_sampleP)return _sampleP;_sampleP=(async()=>{try{return window.claude&&claude.use?await claude.use('sample'):null}catch(e){return null}})();return _sampleP}
const SDK_URL='https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.121.0/+esm';
let _sdk=null;
async function anthropicSDK(){if(!_sdk)_sdk=await import(SDK_URL);return _sdk.default||_sdk.Anthropic}
async function aiMode(){if(await getSample())return'claude';if(SET.apiKey)return'key';return null}
const AI_MODELS={'claude-opus-5-5':'Claude Opus 5.5','claude-sonnet-5-5':'Claude Sonnet 5.5','claude-haiku-5-5':'Claude Haiku 5.5'};
const blobB64=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(b)});
async function anthropicRun({prompt,images,tools,onText}){
  const Anthropic=await anthropicSDK(),client=new Anthropic({apiKey:SET.apiKey,dangerouslyAllowBrowser:true});
  const content=[];for(const b of images||[])content.push({type:'image',source:{type:'base64',media_type:b.type||'image/jpeg',data:await blobB64(b)}});content.push({type:'text',text:prompt});
  const messages=[{role:'user',content}],apiTools=tools&&tools.map(t=>({name:t.name,description:t.description,input_schema:t.inputSchema||{type:'object',properties:{}},eager_input_streaming:true}));
  let text='',jsonRetries=0;
  for(let turn=0;turn<14;turn++){
    const stream=client.beta.messages.stream({model:SET.model||'claude-opus-5-5',max_tokens:64000,betas:['server-side-fallback-2026-07-01'],fallbacks:'default',output_config:{effort:'medium'},messages,...(apiTools?{tools:apiTools}:{})});
    stream.on('text',d=>{text+=d;onText&&onText({text})});
    let msg;try{msg=await stream.finalMessage();jsonRetries=0}catch(err){if(err instanceof Anthropic.APIError||jsonRetries++>=2)throw err;continue}
    if(msg.stop_reason==='refusal')throw Object.assign(new Error('Claude declined this request'),{code:'refusal',text});
    if(msg.stop_reason==='pause_turn'){messages.push({role:'assistant',content:msg.content});continue}
    const uses=msg.content.filter(b=>b.type==='tool_use');if(!uses.length)break;
    if(msg.stop_reason==='max_tokens')throw new Error('The answer was cut off');
    messages.push({role:'assistant',content:msg.content});
    const results=[];
    for(const u of uses){const t=tools.find(x=>x.name===u.name);
      if(!t||!u.input||typeof u.input!=='object'){results.push({type:'tool_result',tool_use_id:u.id,is_error:true,content:t?JSON.stringify({INVALID_JSON:JSON.stringify(u.input)}):'Unknown tool'});continue}
      try{const r=await t.execute(u.input);results.push({type:'tool_result',tool_use_id:u.id,content:typeof r==='string'?r:JSON.stringify(r)})}catch(e){results.push({type:'tool_result',tool_use_id:u.id,is_error:true,content:String(e&&e.message||e)})}}
    messages.push({role:'user',content:results});text+='\n';onText&&onText({text:text+'…'});
  }
  return{text:text.trim()};
}
async function aiText(prompt,{tools,onText,images}={}){
  const mode=await aiMode();if(!mode)throw Object.assign(new Error('AI is off'),{code:'unavailable'});
  if(mode==='claude'){const s=await getSample();return s(prompt,{cache:false,tools,onText,...(images?{images}:{})})}
  return anthropicRun({prompt,tools,onText,images});
}
async function aiJSON(prompt,{images}={}){
  const mode=await aiMode();if(!mode)throw Object.assign(new Error('AI is off'),{code:'unavailable'});
  if(mode==='claude'){const s=await getSample();return s.json(prompt,{images,modelTier:'default'})}
  const r=await anthropicRun({prompt:prompt+'\nReply with the JSON object only.',images});const t=r.text,a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<a)throw new Error('No JSON in the reply');return JSON.parse(t.slice(a,b+1));
}
async function testAI(){try{const r=await aiText('Reply with exactly: Strata is connected.');return r.text||'Connected'}catch(e){throw e}}

const num=(v,a,b)=>v==null||v===''||isNaN(+v)?undefined:clamp(+v,a,b);
function stateSummary(){return{preset:S.preset,source:S.source,seed:S.seed,grid:N,shape:S.shape,biome:S.biome,view:{look:S.view.look,vex:S.view.vex},
  water:{rain:S.fluid.rain,flow:S.fluid.flow,carve:S.fluid.carve,springs:S.fluid.springs.length},lava:{rate:S.lava.rate,cool:S.lava.cool,fluid:S.lava.fluid,vents:S.lava.vents.length},snow:S.snow,wind:S.wind,
  scatter:Object.fromEntries(Object.entries(S.scatter.types).map(([k,v])=>[k,v.density??v.count])),structures:S.structs.length,
  stats:{lowest_m:Math.round(stats.lo),highest_m:Math.round(stats.hi),underwater_pct:Math.round(stats.water*100)}}}
async function runSimToEnd(kind,level){
  const d=SIMDEF[kind];const why=d.ready&&d.ready();if(why)throw new Error(why);
  if(SR.running)simStop(true);pushUndo();d.init();const target=SIMDEF[kind].base*(SIM_LEVELS[level]||SIM_LEVELS.medium).k||400;
  busy(true,d.title+' simulation…',0);try{for(let s=0;s<target;s++){d.step();if(s%20===0){prog(`${d.title} simulation… ${Math.round(s/target*100)}%`,s/target);if(d.vis)d.vis();await nextFrame()}}d.bake()}finally{busy(false)}
  return d.title+' simulated and baked'}
const AI_TOOLS=[
  {name:'get_terrain',description:'Current settings and stats (heights in meters).',execute:()=>stateSummary()},
  {name:'get_height_grid',description:'A 16x16 top-down height map of the current terrain, rows from north (v=0) to south (v=1), digits 0 (lowest) to 9 (highest). Use it to find valleys, peaks and where water or lava would flow.',execute:()=>heightGrid(16)},
  {name:'apply_preset',description:'Loads a preset landscape, replacing the current one. Names: '+Object.keys(PRESETS).join(', ')+'.',inputSchema:{type:'object',properties:{name:{type:'string',enum:Object.keys(PRESETS)}},required:['name']},execute:i=>{if(!applyPreset(String(i.name)))throw new Error('Unknown preset');return'Loaded '+i.name}},
  {name:'set_shape',description:'Changes generator settings and regenerates (replaces sculpting). freq 0.8-6 feature scale, oct 3-8, gain 0.3-0.65 roughness, ridges 0-1, warp 0-1, peaks 0.6-3, cone 0-1 central mountain, crater 0-1, island 0-1, terrace 0-1, tsteps 3-14, maxH 20-1200 m, world 400-8000 m, seed integer.',
    inputSchema:{type:'object',properties:Object.fromEntries([...Object.keys(SHAPE_RANGES),'seed'].map(k=>[k,{type:'number'}]))},
    execute:i=>{pushUndo();for(const k in SHAPE_RANGES){const r=SHAPE_RANGES[k],v=num(i[k],r[0],r[1]);if(v!==undefined)S.shape[k]=k==='oct'||k==='tsteps'?Math.round(v):v}if(i.seed!=null&&!isNaN(+i.seed))S.seed=Math.abs(+i.seed|0);S.preset='Custom';regenerate(false);frame(true);renderSheet();return stateSummary()}},
  {name:'set_biome',description:'Recolors without changing heights. palette '+Object.keys(PALETTES).join('|')+'; sea 0-0.6 and snow 0.2-1 are fractions of max height (snow 1 = none); beach 0-0.05; rock 0.2-1.4 (lower = rock on gentler slopes); lush 0-1.',
    inputSchema:{type:'object',properties:{palette:{type:'string',enum:Object.keys(PALETTES)},sea:{type:'number'},snow:{type:'number'},beach:{type:'number'},rock:{type:'number'},lush:{type:'number'}}},
    execute:i=>{if(PALETTES[i.palette])S.biome.palette=i.palette;const R={sea:[0,.6],snow:[.2,1],beach:[0,.05],rock:[.2,1.4],lush:[0,1]};for(const k in R){const v=num(i[k],...R[k]);if(v!==undefined)S.biome[k]=v}updateAll();renderSheet();saveSoon();return S.biome}},
  {name:'build_node_graph',description:'Replaces the node graph and builds the terrain from it. Either template ('+Object.keys(GRAPH_TEMPLATES).join(', ')+') or nodes+links. Node types: '+Object.entries(NODE_TYPES).map(([k,T])=>`${k}(${Object.keys(T.params).join(',')}${T.ins.length?'; inputs '+T.ins.join(','):''})`).join('; ')+'. Exactly one output node. links: {from,to,port} using your node ids; port is the input index.',
    inputSchema:{type:'object',properties:{template:{type:'string'},nodes:{type:'array',items:{type:'object',properties:{id:{type:'string'},type:{type:'string'},params:{type:'object'}}}},links:{type:'array',items:{type:'object',properties:{from:{type:'string'},to:{type:'string'},port:{type:'number'}}}}}},
    execute:async i=>{
      if(i.template&&GRAPH_TEMPLATES[i.template])S.graph=GRAPH_TEMPLATES[i.template]();
      else{if(!Array.isArray(i.nodes)||!i.nodes.length)throw new Error('Give a template or nodes');const ids={},g={nodes:[],links:[],sel:null,view:{x:20,y:20,z:.82}};
        i.nodes.forEach((n,q)=>{if(!NODE_TYPES[n.type])throw new Error('Unknown node type '+n.type);const id='a'+q;ids[n.id]=id;const p=defParams(n.type),T=NODE_TYPES[n.type];
          for(const k in (n.params||{}))if(T.params[k]){const d=T.params[k];p[k]=d.options?(d.options.includes(n.params[k])?n.params[k]:d.def):clamp(+n.params[k],d.min,d.max)}
          g.nodes.push({id,type:n.type,x:40+(q%5)*180,y:30+Math.floor(q/5)*170,p})});
        for(const l of (i.links||[]))if(ids[l.from]&&ids[l.to])g.links.push({from:ids[l.from],to:ids[l.to],port:+l.port||0});
        if(!g.nodes.some(n=>n.type==='output'))throw new Error('Add an output node');S.graph=g}
      nodeCache.clear();await buildFromGraph();if(S.tab==='create')renderSheet();return stateSummary()}},
  {name:'set_scatter',description:'Vegetation, rocks and buildings. For conifer, broadleaf, bush, grass, boulder: density 0-1, lo/hi altitude band 0-1 above sea, slope max degrees, size 0.5-4. structure: count 0-30. on = master switch.',
    inputSchema:{type:'object',properties:{on:{type:'boolean'},conifer:{type:'object'},broadleaf:{type:'object'},bush:{type:'object'},grass:{type:'object'},boulder:{type:'object'},structure:{type:'object'}}},
    execute:i=>{if(typeof i.on==='boolean')S.scatter.on=i.on;for(const t in SCATTER_TYPES){const c=i[t];if(!c||typeof c!=='object')continue;const d=S.scatter.types[t];
      for(const [k,r] of Object.entries({density:[0,1],lo:[0,1],hi:[0,1],slope:[0,90],size:[.5,4],count:[0,30]})){const v=num(c[k],...r);if(v!==undefined&&k in d)d[k]=k==='count'?Math.round(v):v}if(c.on!=null)d.on=!!c.on}
      buildScatter();renderSheet();saveSoon();return scatterCounts}},
  {name:'place_structure',description:'Places a cabin or watchtower at u,v, or a bridge from u1,v1 to u2,v2 (0-1 top-down, v=0 north).',inputSchema:{type:'object',properties:{type:{type:'string',enum:['cabin','tower','bridge']},u:{type:'number'},v:{type:'number'},u1:{type:'number'},v1:{type:'number'},u2:{type:'number'},v2:{type:'number'}}},
    execute:i=>{if(!S.structs.length)S.structs=structList.slice();if(i.type==='bridge')S.structs.push({type:'bridge',u:(+i.u1+ +i.u2)/2,v:(+i.v1+ +i.v2)/2,u1:clamp(+i.u1,0,1),v1:clamp(+i.v1,0,1),u2:clamp(+i.u2,0,1),v2:clamp(+i.v2,0,1)});else S.structs.push({u:clamp(+i.u,.03,.97),v:clamp(+i.v,.03,.97),type:i.type==='tower'?'tower':'cabin',rot:Math.random()*6.28});S.scatter.types.structure.on=true;buildScatter();saveSoon();return S.structs.length+' structures'}},
  {name:'carve_channel',description:'Carves a river channel along points [{u,v}] (0-1 top-down) from source to mouth. depth meters 1-80, width meters 5-300.',inputSchema:{type:'object',properties:{points:{type:'array',items:{type:'object',properties:{u:{type:'number'},v:{type:'number'}}}},depth:{type:'number'},width:{type:'number'}},required:['points']},
    execute:i=>{const pts=(i.points||[]).map(p=>({u:clamp(+p.u,0,1),v:clamp(+p.v,0,1)})).filter(p=>!isNaN(p.u+p.v));if(pts.length<2)throw new Error('Need 2+ points');carvePath(pts,num(i.depth,1,80)??12,num(i.width,5,300)??60);return'Carved'}},
  {name:'build_road',description:'Builds a graded dirt road along points [{u,v}] (0-1 top-down). width meters 4-40.',inputSchema:{type:'object',properties:{points:{type:'array',items:{type:'object',properties:{u:{type:'number'},v:{type:'number'}}}},width:{type:'number'}},required:['points']},
    execute:i=>{const pts=(i.points||[]).map(p=>({u:clamp(+p.u,0,1),v:clamp(+p.v,0,1)}));if(pts.length<2)throw new Error('Need 2+ points');pushUndo();buildRoad(pts,num(i.width,4,40)??10);fluidSync();updateAll();saveSoon();return'Road built'}},
  {name:'setup_water',description:'Water simulation: rain 0-1, flow 0-1 spring strength, carve 0-1 erosion by flowing water, evap 0-1, sea 0-0.6 sea level (fraction of max height), springs [{u,v,rate}] to add (put them on high ground), clear_springs boolean.',
    inputSchema:{type:'object',properties:{rain:{type:'number'},flow:{type:'number'},carve:{type:'number'},evap:{type:'number'},sea:{type:'number'},clear_springs:{type:'boolean'},springs:{type:'array',items:{type:'object',properties:{u:{type:'number'},v:{type:'number'},rate:{type:'number'}}}}}},
    execute:i=>{for(const k of ['rain','flow','carve','evap']){const v=num(i[k],0,1);if(v!==undefined)S.fluid[k]=v}const sv=num(i.sea,0,.6);if(sv!==undefined){S.biome.sea=sv;updateAll()}if(i.clear_springs)S.fluid.springs=[];for(const sp of (i.springs||[]).slice(0,16))if(S.fluid.springs.length<16)S.fluid.springs.push({u:clamp(+sp.u,0,1),v:clamp(+sp.v,0,1),rate:num(sp.rate,.2,3)??1});updateSpringMarkers();renderSheet();saveSoon();return{...S.fluid,springs:S.fluid.springs.length}}},
  {name:'setup_lava',description:'Lava simulation: rate 0-1 eruption strength, cool 0-1 how fast it solidifies into basalt, fluid 0-1 runniness, vents [{u,v}] (on peaks or crater floors; empty = highest point), clear_vents boolean.',
    inputSchema:{type:'object',properties:{rate:{type:'number'},cool:{type:'number'},fluid:{type:'number'},clear_vents:{type:'boolean'},vents:{type:'array',items:{type:'object',properties:{u:{type:'number'},v:{type:'number'}}}}}},
    execute:i=>{for(const k of ['rate','cool','fluid']){const v=num(i[k],0,1);if(v!==undefined)S.lava[k]=v}if(i.clear_vents)S.lava.vents=[];for(const v of (i.vents||[]).slice(0,8))if(S.lava.vents.length<8)S.lava.vents.push({u:clamp(+v.u,0,1),v:clamp(+v.v,0,1)});updateSpringMarkers();renderSheet();saveSoon();return{...S.lava,vents:S.lava.vents.length}}},
  {name:'setup_snow',description:'Snow simulation: fall 0-1 snowfall, line 0-1 snow line as a fraction of max height, repose 25-50 degrees avalanche angle, melt 0-1, addHeight boolean (pack snow into the mesh).',inputSchema:{type:'object',properties:{fall:{type:'number'},line:{type:'number'},repose:{type:'number'},melt:{type:'number'},addHeight:{type:'boolean'}}},
    execute:i=>{for(const [k,r] of Object.entries({fall:[0,1],line:[0,1],repose:[25,50],melt:[0,1]})){const v=num(i[k],...r);if(v!==undefined)S.snow[k]=v}if(typeof i.addHeight==='boolean')S.snow.addHeight=i.addHeight;renderSheet();saveSoon();return S.snow}},
  {name:'setup_wind',description:'Wind (dune migration) simulation: dir 0-360 degrees the wind blows toward (0 = east, 90 = south), power 0-1, supply 0-1 amount of loose sand.',inputSchema:{type:'object',properties:{dir:{type:'number'},power:{type:'number'},supply:{type:'number'}}},
    execute:i=>{const d=num(i.dir,0,360);if(d!==undefined)S.wind.dir=d;for(const k of ['power','supply']){const v=num(i[k],0,1);if(v!==undefined)S.wind[k]=v}renderSheet();saveSoon();return S.wind}},
  {name:'run_simulation',description:'Runs a simulation to completion and bakes it into the terrain. kind water|lava|snow|wind|erode; level quick|medium|long.',inputSchema:{type:'object',properties:{kind:{type:'string',enum:['water','lava','snow','wind','erode']},level:{type:'string',enum:['quick','medium','long']}},required:['kind']},
    execute:async i=>{if(!SIMDEF[i.kind])throw new Error('Unknown simulation');if(i.kind==='erode'){await runErosion('hydraulic',[25000,60000,140000][{quick:0,medium:1,long:2}[i.level]??1]);return'Eroded'}return runSimToEnd(i.kind,i.level||'medium')}},
  {name:'set_view',description:'View: look natural|clay|titanium|copper|heat, sunEl 4-85, sunAz 0-360, vex 0.5-3, contours boolean, water boolean.',inputSchema:{type:'object',properties:{look:{type:'string'},sunEl:{type:'number'},sunAz:{type:'number'},vex:{type:'number'},contours:{type:'boolean'},water:{type:'boolean'}}},
    execute:i=>{const R={sunEl:[4,85],sunAz:[0,360],vex:[.5,3]};for(const k in R){const v=num(i[k],...R[k]);if(v!==undefined)S.view[k]=v}if(typeof i.contours==='boolean')S.view.contours=i.contours;if(typeof i.water==='boolean')S.view.water=i.water;if(LOOKS[i.look])setLook(i.look);else updateAll();renderSheet();return S.view}}
];
const MANUAL=`You are the built-in assistant of Strata, a mobile terrain studio. Tabs: Create (Generate with presets ${Object.keys(PRESETS).join(', ')}, seed, character pad and sliders; Nodes graph; Photo reference to terrain), Sculpt (Raise, Lower, Smooth, Flatten, Roughen, Terrace, Erode, Stamp [${Object.values(STAMPS).join(', ')}], Paint, Plant), Simulate (Water with rain/springs/carving, Lava with vents that cool into basalt, Snow with avalanching, Wind that migrates dunes, Erosion; each runs with a progress ring and bakes in), Biome (palette, coloring, trees/bushes/grass/boulders/cabins/towers/bridges), Export (Blender, Unreal Engine 5, Unity, Godot, 3D print, custom).
Coordinates u,v are 0-1 top-down with v=0 north. Answer in plain text, at most about 110 words, short numbered steps for how-tos. When asked to make or change something, use the tools, then say in one or two sentences what you did and one thing to try by hand. Never invent controls.`;
async function runPrompt(text,context,onText){return aiText(`${MANUAL}\n\n${context||''}\nCurrent terrain: ${JSON.stringify(stateSummary())}\n\nUser: ${text}`,{tools:AI_TOOLS,onText})}
const aiErr=e=>e.code==='unavailable'?'AI is off. Open this app inside Claude, or add your Anthropic API key in Home → Settings to use AI on the website.':e.code==='not_granted'?'Allow AI access for this page to continue.':e.code==='rate_limited'||e.status===429?'The AI is busy. Try again in a minute.':e.status===401?'That API key was rejected. Check it in Settings.':e.code==='refusal'?'Claude declined that request. Try describing it differently.':(e.text?e.text+'\n':'')+'Could not finish: '+(e.message||'error');
async function promptBar(kind,text,noteEl,btn){
  text=(text||'').trim();if(!text)return;btn&&(btn.disabled=true);noteEl.textContent='Thinking…';noteEl.classList.add('enter');
  const ctx=kind==='simulate'?'This request came from Simulate. Read get_height_grid first. Plan the simulation: for water place springs on high ground (optionally carve_channel along valleys), for lava put vents on peaks, for snow set the snow line, for wind set the direction. Configure with the setup_* tool, then run_simulation.':
    kind==='nodes'?'This request came from the node editor. Prefer build_node_graph with a custom graph.':'This request came from Generate. Prefer presets/set_shape/set_biome/set_scatter, or build_node_graph for complex forms; use run_simulation to age or weather the land.';
  try{const r=await runPrompt(text,ctx,({text:t})=>{noteEl.textContent=t});noteEl.textContent=r.text||noteEl.textContent}
  catch(e){noteEl.textContent=aiErr(e)}
  finally{btn&&(btn.disabled=false)}
}
/* ---------------- assistant panel ---------------- */
const GUIDES=[
  {t:'Volcano that erupts',p:'A cone island whose lava cools into black basalt.',s:['Create → Generate → preset Volcano isle.','Simulate → Lava. Leave vents empty to erupt from the summit, or long-press the map → Lava vent.','Run Medium. When the ring turns gold the lava is baked into the land.','Run Water with light rain to add gullies.'],go:()=>{applyPreset('Volcano isle');switchTab('simulate','lava')}},
  {t:'River from springs',p:'Flowing water that carves its own valley.',s:['Simulate → Water. Turn Rain down to 10%.','Long-press high ground → Spring (or tap Place spring).','Set Carve to 60% and tap Run.','When it finishes, rivers and wet soil are baked in and bushes grow along the banks.'],go:()=>{S.fluid.rain=.1;S.fluid.carve=.6;switchTab('simulate','water')}},
  {t:'Snowy peaks with avalanches',p:'Snow that settles on flats and slides off cliffs.',s:['Load Frozen ridge or Alpine.','Simulate → Snow. Lower the snow line, keep repose near 36°.','Run Medium. Snow is painted in; turn on Pack snow to add depth.'],go:()=>{applyPreset('Alpine');switchTab('simulate','snow')}},
  {t:'Wind-shaped dune sea',p:'Dunes that migrate and build slip faces.',s:['Load Dune sea.','Simulate → Wind. Pick a direction, raise Sand supply.','Run Long and watch the dunes march downwind.'],go:()=>{applyPreset('Dune sea');switchTab('simulate','wind')}},
  {t:'Terrain from a photo',p:'Roads, rivers, bridges and cabins are kept as what they are.',s:['Create → Photo, pick an image.','Landscape photo uses AI to read terrain plus features.','Keep "Ignore thin lines" on so roads never become ridges.','Build terrain, then refine with Sculpt.'],go:()=>switchTab('create','photo')},
  {t:'Unreal Engine landscape',p:'A full landscape kit with layers and foliage.',s:['Export → target Unreal Engine 5.','The zip has a UE-sized 16-bit heightmap, weightmaps, PBR textures, foliage meshes and a CSV of every instance.','Follow README.txt for scale values.'],go:()=>{S.exp.target='unreal';switchTab('export')}}
];
const chat=[];
const SUGGEST=['Make a misty fjord with pine forests','Erupt the volcano and let it cool','Add a river from the peaks to the sea','Build a node graph for eroded mesas'];
function addMsg(cls,text){const d=document.createElement('div');d.className='msg '+cls;d.textContent=text;$('#hAsk').appendChild(d);$('#hAsk').scrollTop=1e9;return d}
async function askIntro(){const a=$('#hAsk');a.innerHTML='';const m=await aiMode();
  addMsg('bot',m?`Hi. I can explain any tool or build things for you: landscapes, node graphs, rivers, eruptions, snow, dunes, forests and cabins. ${m==='key'?'(Using your API key.)':''}`:'Hi. The guides below work right away. To let me build terrain for you, open this app inside Claude or add your Anthropic API key in Home → Settings.');
  const sg=document.createElement('div');sg.className='suggest';sg.innerHTML=SUGGEST.map(q=>`<button type="button" class="press">${esc(q)}</button>`).join('');sg.onclick=e=>{const b=e.target.closest('button');if(b)ask(b.textContent)};a.appendChild(sg)}
async function ask(q){
  q=q.trim();if(!q)return;$('#hAsk .suggest')?.remove();addMsg('me anodized',q);const bub=addMsg('bot thinking','Thinking…');
  if(!(await aiMode())){bub.classList.remove('thinking');bub.textContent=offline(q);return}
  const convo=chat.slice(-8).map(m=>(m.role==='user'?'User: ':'Assistant: ')+m.content).join('\n');
  try{const r=await runPrompt(q,convo?'Conversation so far:\n'+convo:'',({text})=>{bub.classList.remove('thinking');bub.textContent=text;$('#hAsk').scrollTop=1e9});
    bub.classList.remove('thinking');bub.textContent=r.text||bub.textContent;chat.push({role:'user',content:q},{role:'assistant',content:bub.textContent})}
  catch(e){bub.classList.remove('thinking');bub.textContent=aiErr(e)}
}
function offline(q){const s=q.toLowerCase(),score=g=>(g.t+' '+g.p+' '+g.s.join(' ')).toLowerCase().split(/\W+/).filter(w=>w.length>3&&s.includes(w)).length;
  const best=GUIDES.map(g=>[score(g),g]).sort((a,b)=>b[0]-a[0])[0];
  return (best[0]>0?`${best[1].t}:\n`+best[1].s.map((x,i)=>`${i+1}. ${x}`).join('\n')+'\n\n':'')+'AI is off here. Open the app in Claude, or add an API key in Home → Settings. Guides work offline.'}
function renderGuides(){$('#hGuides').innerHTML=GUIDES.map((g,i)=>`<div class="guide"><h3>${g.t}</h3><p>${g.p}</p><ol>${g.s.map(x=>`<li>${x}</li>`).join('')}</ol><div class="btns"><button class="btn metal press" data-guide="${i}">Set it up</button></div></div>`).join('');
  $$('#hGuides [data-guide]').forEach(b=>b.onclick=()=>{GUIDES[+b.dataset.guide].go();closeHelper();toast('Ready: '+GUIDES[+b.dataset.guide].t,'ok')})}
let introDone=false;
function openHelper(){closeHome();$('#helper').hidden=false;if(!introDone){introDone=true;askIntro();renderGuides();segIndicator($('#hSeg'))}}
function closeHelper(){$('#helper').hidden=true}
$('#openHelper').onclick=openHelper;$('#closeHelper').onclick=closeHelper;
$('#hTabAsk').onclick=()=>{$('#hTabAsk').setAttribute('aria-pressed','true');$('#hTabGuides').setAttribute('aria-pressed','false');$('#hAsk').hidden=false;$('#hGuides').hidden=true;$('#askForm').hidden=false;segIndicator($('#hSeg'))};
$('#hTabGuides').onclick=()=>{$('#hTabAsk').setAttribute('aria-pressed','false');$('#hTabGuides').setAttribute('aria-pressed','true');$('#hAsk').hidden=true;$('#hGuides').hidden=false;$('#askForm').hidden=true;segIndicator($('#hSeg'))};
$('#askForm').onsubmit=e=>{e.preventDefault();const v=$('#askInput').value;$('#askInput').value='';ask(v)};
$('#askInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#askForm').requestSubmit()}};
