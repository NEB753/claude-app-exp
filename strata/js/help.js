"use strict";
/* Terrain Gen help layer: a short first-run tour with a spotlight, a "?" in every panel header that explains that panel
   in plain words, labels for the icon-only controls (hover on desktop, long-press on touch), and Simple mode, which
   hides advanced options so the app reads as: make a world, shape it, build a town, export. */
const PANEL_HELP={
  create:['Make a world','Tap <b>New world</b> for a fresh landscape, or tap one of the landscape cards. <b>Variation</b> keeps the type and reshuffles it. Open <b>Fine-tune</b> only if you want to adjust the shape by hand. The <b>Photo</b> tab turns a picture into land.'],
  sculpt:['Shape the land','Pick a tool, then drag on the land with one finger. Two fingers always move the camera. <b>Raise</b> and <b>Lower</b> build real ridges and valleys; the <b>Realism</b> slider decides how geological the result is. Undo is at the top.'],
  simulate:['Let nature work','Choose water, lava, snow, wind or erosion and press play. The ring fills as it runs; when it turns gold the result is part of the land. Everything can be undone.'],
  biome:['Colours and plants','Pick a palette at the top, then switch trees, bushes, grass and rocks on or off. Each group has its own density and where-it-grows sliders.'],
  town:['Build towns','<b>Generate</b> makes a whole village, town or city on good ground. Or build by hand: <b>Place</b> a building (tap, then drag to turn it), draw <b>Roads</b> and <b>Walls</b> with your finger, <b>Select</b> to move, restyle or upgrade, <b>Erase</b> to remove.'],
  export:['Use it elsewhere','Pick where it is going (Blender, Unreal, Unity, Godot or 3D printing) and tap <b>Export</b>. Everything is packed for that program.']};
const TOUR=[
  {sel:'#view',t:'This is your land',d:'Drag to look around, pinch to zoom, double-tap to fly closer.',pos:'center'},
  {sel:'#newWorld',t:'Make a new world',d:'One tap creates a fresh landscape. The cards below are ready-made types.',tab:'create'},
  {sel:'#tab_sculpt',t:'Shape it',d:'Sculpt raises mountains and carves valleys that look like real terrain.'},
  {sel:'#tab_town',t:'Build towns',d:'Place buildings, draw roads and walls, or generate a whole village.'},
  {sel:'#setBtn',t:'Make it yours',d:'Interface size, colours, layout, and battery or performance modes.'},
  {sel:'#openHelper',t:'Ask for anything',d:'Describe what you want and the assistant builds it.',last:true}];
document.body.insertAdjacentHTML('beforeend','<div id="tour" hidden><div class="tspot"></div><div class="tcard glass"><b class="tt"></b><p class="td"></p><div class="tbtns"><button class="btn plain press" id="tSkip">Skip</button><span class="tdots"></span><button class="btn anodized press" id="tNext">Next</button></div></div></div><div id="tipLabel" hidden></div>');
let tourI=0;
function startTour(){tourI=0;$('#tour').hidden=false;showTourStep()}
function endTour(){$('#tour').hidden=true;SET.tourDone=true;saveSettings()}
function showTourStep(){const st=TOUR[tourI];if(!st){endTour();return}if(st.tab&&S.tab!==st.tab)switchTab(st.tab);
  setTimeout(()=>{const el=$(st.sel),sp=$('#tour .tspot'),card=$('#tour .tcard');let r=el&&el.getBoundingClientRect();if(!r||!r.width||st.pos==='center')r={left:innerWidth/2-90,top:innerHeight*.38-90,width:180,height:180};
    const pad=8;sp.style.cssText=`left:${r.left-pad}px;top:${r.top-pad}px;width:${r.width+pad*2}px;height:${r.height+pad*2}px;border-radius:${st.pos==='center'?'50%':'18px'}`;
    $('#tour .tt').textContent=st.t;$('#tour .td').textContent=st.d;$('#tour .tdots').innerHTML=TOUR.map((_,i)=>`<i class="${i===tourI?'on':''}"></i>`).join('');$('#tNext').textContent=st.last?'Start creating':'Next';
    const below=r.top+r.height+170<innerHeight;card.style.left=clamp(r.left+r.width/2-150,12,innerWidth-Math.min(300,innerWidth-24)-12)+'px';card.style.top=(below?r.top+r.height+16:Math.max(12,r.top-176))+'px';card.classList.remove('enter');void card.offsetWidth;card.classList.add('enter');sfx('pop')},st.tab?350:30)}
$('#tNext').onclick=()=>{tourI++;if(tourI>=TOUR.length){endTour();sfx('chime');return}showTourStep()};$('#tSkip').onclick=endTour;
/* "?" in the panel header */
function panelHelpBtn(){return`<button class="ibtn qhelp press" id="qHelp" aria-label="What is this panel?"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2.2-2.5 3.6"/><path d="M12 17.2v.1"/></svg></button>`}
function bindPanelHelp(hd){const b=$('#qHelp',hd);if(!b)return;b.onclick=e=>{const h=PANEL_HELP[S.tab];if(!h)return;openPanel(e.currentTarget,`<h4>${h[0]}</h4><p class="helpp">${h[1]}</p><div class="btns" style="padding:0 10px 10px"><button class="btn plain press" id="hpTour">Show the tour again</button></div>`,p=>{$('#hpTour',p).onclick=()=>{closePanel(true);startTour()}},{width:300})}}
/* labels for icon buttons: hover (desktop) or long-press (touch) */
const RAIL_LABELS={modeOrbit:'Move the camera',modeSculpt:'Use the tool on the land',frameBtn:'Frame the whole terrain',camBtn:'Camera & render',walkBtn:'Walk or fly through it',clearBtn:'Hide all panels',viewBtn:'View options',setBtn:'Settings',queueBtn:'Running tasks',undo:'Undo',redo:'Redo',homeBtn:'Creations & library',openHelper:'Ask the assistant'};
let tipT=0;
function showTip(el,txt){const t=$('#tipLabel'),r=el.getBoundingClientRect();t.textContent=txt;t.hidden=false;const w=t.offsetWidth;let x=r.left-w-10,y=r.top+r.height/2-14;if(x<8){x=clamp(r.left+r.width/2-w/2,8,innerWidth-w-8);y=r.bottom+8}t.style.left=x+'px';t.style.top=y+'px';clearTimeout(tipT);tipT=setTimeout(()=>{t.hidden=true},1600)}
for(const [id,txt] of Object.entries(RAIL_LABELS)){const el=$('#'+id);if(!el)continue;el.title=txt;let lp=0;
  el.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')showTip(el,txt)});el.addEventListener('pointerleave',()=>{$('#tipLabel').hidden=true});
  el.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'){lp=setTimeout(()=>{showTip(el,txt);haptic(8)},420)}},{passive:true});el.addEventListener('pointerup',()=>clearTimeout(lp));el.addEventListener('pointercancel',()=>clearTimeout(lp))}
