"use strict";
/* Terrain Gen first person: walk on the ground or fly. Left thumb = joystick, drag anywhere else = look. Renders only while moving. */
const FP={on:false,fly:false,x:0,z:0,y:0,yaw:0,pitch:-.08,joy:{x:0,y:0,id:null},look:null,speed:1,up:0,keys:{}};
function fpGround(x,z){const W=S.shape.world,gx=(x/W+.5)*(N-1),gy=(z/W+.5)*(N-1);return Math.max(hAt(gx,gy),seaLevel())*S.view.vex}
function fpEnter(p){
  if(FP.on)return;closeQuick();closePanel(true);const W=S.shape.world;FP.on=true;FP.fly=false;
  FP.x=p?p.x:cam.target.x;FP.z=p?p.z:cam.target.z;FP.yaw=cam.theta+Math.PI;FP.pitch=-.05;FP.y=fpGround(FP.x,FP.z)+1.7;
  document.body.classList.add('fp');$('#fpUI').hidden=false;$('#fpMode').textContent='Walk';camera.clearViewOffset();
  scene.fog.near=60;scene.fog.far=W*.9;camera.near=.25;camera.far=W*3;camera.updateProjectionMatrix();sfx('pop');
  toast('Left thumb moves · drag to look · tap Fly to take off');touch();
}
function fpExit(){if(!FP.on)return;FP.on=false;document.body.classList.remove('fp');$('#fpUI').hidden=true;cam.target.set(FP.x,FP.y,FP.z);cam.theta=FP.yaw-Math.PI;layoutSheet();placeCamera();touch()}
function fpTick(dt){
  if(!FP.on)return;const W=S.shape.world,k=FP.keys,jx=FP.joy.x+(k.d?1:0)-(k.a?1:0),jy=FP.joy.y+(k.s?1:0)-(k.w?1:0),up=FP.up+(k[' ']?1:0)-(k.shift?1:0);
  const moving=Math.abs(jx)+Math.abs(jy)+Math.abs(up)>.02;
  if(moving){const sp=(FP.fly?60:9)*FP.speed*Math.max(.4,W/3000),s=Math.sin(FP.yaw),c=Math.cos(FP.yaw);
    FP.x=clamp(FP.x+(s*-jy-c*jx)*sp*dt,-W/2,W/2);FP.z=clamp(FP.z+(c*-jy+s*jx)*sp*dt,-W/2,W/2);if(FP.fly)FP.y+=up*sp*dt}
  const g=fpGround(FP.x,FP.z)+1.7;if(FP.fly)FP.y=Math.max(FP.y,g+.5);else FP.y=lerp(FP.y,g,Math.min(1,dt*10));
  const cp=Math.cos(FP.pitch);camera.position.set(FP.x,FP.y,FP.z);camera.lookAt(FP.x+Math.sin(FP.yaw)*cp,FP.y+Math.sin(FP.pitch),FP.z+Math.cos(FP.yaw)*cp);
  if(moving||FP.look||Math.abs(FP.y-g)>.05)touch();
}
(function fpUI(){
  const joy=$('#fpJoy'),knob=joy.querySelector('i');
  joy.onpointerdown=e=>{e.stopPropagation();try{joy.setPointerCapture(e.pointerId)}catch(_){}FP.joy.id=e.pointerId;move(e)};
  const move=e=>{if(FP.joy.id!==e.pointerId)return;const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,R=r.width/2;let dx=(e.clientX-cx)/R,dy=(e.clientY-cy)/R;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l}FP.joy.x=dx;FP.joy.y=dy;knob.style.transform=`translate(${dx*R*.6}px,${dy*R*.6}px)`;touch()};
  joy.onpointermove=move;joy.onpointerup=joy.onpointercancel=()=>{FP.joy={x:0,y:0,id:null};knob.style.transform='';};
  $('#fpExit').onclick=fpExit;
  $('#fpMode').onclick=()=>{FP.fly=!FP.fly;$('#fpMode').textContent=FP.fly?'Fly':'Walk';$('#fpUp').hidden=$('#fpDown').hidden=!FP.fly;if(FP.fly)FP.y+=20;sfx('pop');touch()};
  for(const [id,v] of [['fpUp',1],['fpDown',-1]]){const b=$('#'+id);b.onpointerdown=e=>{e.stopPropagation();FP.up=v;touch()};b.onpointerup=b.onpointercancel=b.onpointerleave=()=>{FP.up=0}}
  $('#fpSpeed').oninput=e=>{FP.speed=+e.target.value};
  addEventListener('keydown',e=>{if(!FP.on||e.target.closest&&e.target.closest('input,textarea'))return;const k=e.key.toLowerCase();if('wasd '.includes(k)||k==='shift'){FP.keys[k]=true;e.preventDefault();touch()}if(k==='escape')fpExit()});
  addEventListener('keyup',e=>{FP.keys[e.key.toLowerCase()]=false});
})();
function fpLookStart(e){FP.look={x:e.clientX,y:e.clientY}}
function fpLookMove(e){if(!FP.look)return;const k=.005*(SET.sens||1);FP.yaw-=(e.clientX-FP.look.x)*k;FP.pitch=clamp(FP.pitch-(e.clientY-FP.look.y)*k*(SET.invertY?-1:1),-1.4,1.4);FP.look={x:e.clientX,y:e.clientY};touch()}
function fpLookEnd(){FP.look=null}
