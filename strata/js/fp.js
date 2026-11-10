"use strict";
/* Terrain Gen first person. Left half of the screen: a floating joystick appears where your thumb lands.
   Right half: drag to look (smoothed). Walk has gravity, jump, sprint and head bob; Fly has banking and climb/dive.
   Entering swoops the camera down from orbit. Renders only while something moves. */
const FP={on:false,fly:false,x:0,z:0,y:0,vy:0,yaw:0,pitch:-.05,tyaw:0,tpitch:-.05,vx:0,vz:0,bob:0,roll:0,joy:{x:0,y:0,id:null,ox:0,oy:0},look:null,lookId:null,speed:1,up:0,sprint:false,keys:{},enter:null,grounded:true};
const EYE=1.7;
function fpGround(x,z){const W=S.shape.world,gx=(x/W+.5)*(N-1),gy=(z/W+.5)*(N-1);return Math.max(hAt(gx,gy),seaLevel()+.4)*S.view.vex}
function fpEnter(p){
  if(FP.on)return;closeQuick();closePanel(true);if(typeof camExit==='function')camExit();const W=S.shape.world;
  FP.on=true;FP.fly=false;FP.x=p?p.x:cam.target.x;FP.z=p?p.z:cam.target.z;FP.yaw=FP.tyaw=cam.theta+Math.PI;FP.pitch=FP.tpitch=-.05;
  FP.y=fpGround(FP.x,FP.z)+EYE;FP.vy=0;FP.vx=FP.vz=0;FP.bob=0;FP.roll=0;
  FP.enter={t0:performance.now(),from:camera.position.clone(),q:camera.quaternion.clone()};
  document.body.classList.add('fp');$('#fpUI').hidden=false;setFpMode(false);camera.clearViewOffset();
  scene.fog.near=W*.02;scene.fog.far=W*.75;camera.near=.5;camera.far=W*1.4;camera.fov=62;camera.updateProjectionMatrix();
  sfx('pop');haptic(14);if(SET.hints)toast('Left thumb moves · right side looks · double-tap right side to jump');touch();
}
function fpExit(){if(!FP.on)return;FP.on=false;document.body.classList.remove('fp');$('#fpUI').hidden=true;camera.fov=40;
  cam.target.set(FP.x,FP.y-EYE,FP.z);cam.theta=FP.yaw-Math.PI;cam.r=Math.max(S.shape.world*.12,cam.r*.5);layoutSheet();placeCamera();haptic(8);touch()}
function setFpMode(fly){FP.fly=fly;$('#fpMode').textContent=fly?'Fly':'Walk';$('#fpMode').setAttribute('aria-pressed',fly);$('#fpUp').hidden=$('#fpDown').hidden=!fly;$('#fpJump').hidden=fly;if(fly){FP.vy=0;FP.y+=8}sfx('pop');touch()}
function fpTick(dt){
  if(!FP.on||dt<=0)return;const W=S.shape.world,k=FP.keys;
  const jx=clamp(FP.joy.x+(k.d?1:0)-(k.a?1:0),-1,1),jy=clamp(FP.joy.y+(k.s?1:0)-(k.w?1:0),-1,1),up=FP.up+(k.e?1:0)-(k.q?1:0);
  const scale=Math.max(.5,W/2500),run=FP.sprint||k.shift?2.4:1,max=(FP.fly?55:7)*FP.speed*scale*run;
  const s=Math.sin(FP.yaw),c=Math.cos(FP.yaw),tx=(s*-jy-c*jx)*max,tz=(c*-jy+s*jx)*max,acc=1-Math.exp(-dt*(FP.fly?3:9));
  FP.vx+=(tx-FP.vx)*acc;FP.vz+=(tz-FP.vz)*acc;
  FP.x=clamp(FP.x+FP.vx*dt,-W/2,W/2);FP.z=clamp(FP.z+FP.vz*dt,-W/2,W/2);
  const g=fpGround(FP.x,FP.z),sp=Math.hypot(FP.vx,FP.vz);
  if(FP.fly){FP.y+=up*max*.6*dt;FP.y=Math.max(FP.y,g+1.2);FP.roll+=((-jx*.25)-FP.roll)*acc}
  else{FP.vy-=9.8*Math.max(1,scale*.6)*dt;FP.y+=FP.vy*dt;const floor=g+EYE;
    if(FP.y<=floor){if(!FP.grounded&&FP.vy<-6)haptic(10);FP.y=lerp(FP.y,floor,Math.min(1,dt*18));if(FP.y<floor-.05)FP.y=floor-.05;FP.vy=Math.max(0,FP.vy);FP.grounded=true}else FP.grounded=FP.y-floor<.15;
    FP.bob+=sp*dt*1.6/scale;FP.roll*=1-acc}
  // smoothed look
  const la=1-Math.exp(-dt*18);FP.yaw+=(FP.tyaw-FP.yaw)*la;FP.pitch+=(FP.tpitch-FP.pitch)*la;
  const bob=FP.fly?0:Math.sin(FP.bob*2)*.05*Math.min(1,sp/(4*scale)),cp=Math.cos(FP.pitch);
  const eye=new THREE.Vector3(FP.x,FP.y+bob,FP.z),look=new THREE.Vector3(FP.x+Math.sin(FP.yaw)*cp,FP.y+bob+Math.sin(FP.pitch),FP.z+Math.cos(FP.yaw)*cp);
  if(FP.enter){const t=clamp((performance.now()-FP.enter.t0)/650,0,1),e=easeIO(t);camera.position.copy(FP.enter.from).lerp(eye,e);camera.lookAt(look);if(t>=1)FP.enter=null}
  else{camera.position.copy(eye);camera.up.set(Math.sin(FP.roll)*.4,1,0).normalize();camera.lookAt(look);camera.up.set(0,1,0)}
  const moving=sp>.05||Math.abs(FP.vy)>.05||Math.abs(FP.tyaw-FP.yaw)>1e-4||Math.abs(FP.tpitch-FP.pitch)>1e-4||FP.enter||Math.abs(up)>0;
  if(moving)touch();$('#fpAlt').textContent=fmtLen(Math.max(0,FP.y/S.view.vex))+(FP.fly?' · flying':'');
}
function fpJump(){if(FP.fly||!FP.grounded)return;FP.vy=6.5*Math.max(1,Math.sqrt(S.shape.world/2500));FP.grounded=false;sfx('pop');haptic(8);touch()}
(function fpUI(){
  const ui=$('#fpUI'),joy=$('#fpJoy'),knob=joy.querySelector('i');let lastLookTap=0;
  ui.addEventListener('pointerdown',e=>{if(e.target.closest('button,input'))return;const left=e.clientX<innerWidth*.45;
    if(left&&FP.joy.id==null){FP.joy.id=e.pointerId;FP.joy.ox=e.clientX;FP.joy.oy=e.clientY;joy.style.left=e.clientX+'px';joy.style.top=e.clientY+'px';joy.classList.add('on');knob.style.transform='';try{ui.setPointerCapture(e.pointerId)}catch(_){}haptic(5)}
    else if(!left&&FP.lookId==null){FP.lookId=e.pointerId;FP.look={x:e.clientX,y:e.clientY};const now=performance.now();if(now-lastLookTap<280)fpJump();lastLookTap=now;try{ui.setPointerCapture(e.pointerId)}catch(_){}}touch()});
  ui.addEventListener('pointermove',e=>{
    if(e.pointerId===FP.joy.id){const R=56;let dx=(e.clientX-FP.joy.ox)/R,dy=(e.clientY-FP.joy.oy)/R;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l}FP.joy.x=dx;FP.joy.y=dy;knob.style.transform=`translate(${dx*R*.7}px,${dy*R*.7}px)`;FP.sprint=l>1.6;touch()}
    else if(e.pointerId===FP.lookId&&FP.look){const k=.0042*(SET.sens||1);FP.tyaw-=(e.clientX-FP.look.x)*k;FP.tpitch=clamp(FP.tpitch-(e.clientY-FP.look.y)*k*(SET.invertY?-1:1),-1.45,1.45);FP.look={x:e.clientX,y:e.clientY};touch()}});
  const end=e=>{if(e.pointerId===FP.joy.id){FP.joy={x:0,y:0,id:null,ox:0,oy:0};FP.sprint=false;joy.classList.remove('on')}if(e.pointerId===FP.lookId){FP.lookId=null;FP.look=null}};
  ui.addEventListener('pointerup',end);ui.addEventListener('pointercancel',end);
  $('#fpExit').onclick=fpExit;$('#fpMode').onclick=()=>setFpMode(!FP.fly);$('#fpJump').onclick=fpJump;
  $('#fpRun').onclick=()=>{FP.sprintLock=!FP.sprintLock;FP.sprint=FP.sprintLock;$('#fpRun').setAttribute('aria-pressed',FP.sprintLock);haptic(6)};
  $('#fpCam').onclick=()=>{const p={x:FP.x,z:FP.z};fpExit();camEnter(true)};
  for(const [id,v] of [['fpUp',1],['fpDown',-1]]){const b=$('#'+id);b.onpointerdown=e=>{e.stopPropagation();FP.up=v;touch()};b.onpointerup=b.onpointercancel=b.onpointerleave=()=>{FP.up=0}}
  $('#fpSpeed').oninput=e=>{FP.speed=+e.target.value};
  addEventListener('keydown',e=>{if(!FP.on||e.target.closest&&e.target.closest('input,textarea'))return;const k=e.key.toLowerCase();if('wasdqe'.includes(k)||k==='shift'){FP.keys[k]=true;e.preventDefault();touch()}if(k===' '){e.preventDefault();FP.fly?FP.keys.e=true:fpJump()}if(k==='f')setFpMode(!FP.fly);if(k==='escape')fpExit()});
  addEventListener('keyup',e=>{const k=e.key.toLowerCase();FP.keys[k]=false;if(k===' ')FP.keys.e=false});
})();
/* legacy hooks used by the canvas handlers (desktop mouse look) */
function fpLookStart(e){FP.look={x:e.clientX,y:e.clientY}}
function fpLookMove(e){if(!FP.look)return;const k=.0042*(SET.sens||1);FP.tyaw-=(e.clientX-FP.look.x)*k;FP.tpitch=clamp(FP.tpitch-(e.clientY-FP.look.y)*k*(SET.invertY?-1:1),-1.45,1.45);FP.look={x:e.clientX,y:e.clientY};touch()}
function fpLookEnd(){FP.look=null}
