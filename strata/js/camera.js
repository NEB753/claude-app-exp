"use strict";
/* Terrain Gen camera + render mode.
   Render mode: scene → multisampled render target → one post pass (color grade, tilt-shift depth blur, vignette, grain).
   Camera mode: an iPhone-style overlay with lenses, grades, grid, photo capture at high resolution and video capture
   (turntable / flyover / drift) via MediaRecorder. Only costs anything while it is open or Render mode is on. */
const GRADES={natural:{n:'Natural',sat:1,con:1,warm:0,split:0,bw:0},golden:{n:'Golden hour',sat:1.08,con:1.04,warm:.55,split:.15,bw:0},cine:{n:'Cinematic',sat:1.02,con:1.12,warm:.05,split:.65,bw:0},
  moody:{n:'Moody',sat:.78,con:1.16,warm:-.2,split:.2,bw:0},vivid:{n:'Vivid',sat:1.35,con:1.08,warm:.05,split:0,bw:0},arctic:{n:'Arctic',sat:.85,con:1.05,warm:-.55,split:.1,bw:0},noir:{n:'Noir',sat:1,con:1.32,warm:0,split:0,bw:1}};
const LENSES=[[.5,'.5×'],[1,'1×'],[2,'2×'],[3,'3×'],[5,'5×']];
const POST={rt:null,w:0,h:0,on:false};
(function(){
  const mat=new THREE.ShaderMaterial({uniforms:{t:{value:null},px:{value:new THREE.Vector2()},tilt:{value:0},focus:{value:.5},vig:{value:.3},grain:{value:.03},time:{value:0},sat:{value:1},con:{value:1},warm:{value:0},split:{value:0},bw:{value:0},expo:{value:1}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 vUv;uniform sampler2D t;uniform vec2 px;uniform float tilt,focus,vig,grain,time,sat,con,warm,split,bw,expo;
void main(){vec3 c=texture2D(t,vUv).rgb;
 if(tilt>0.){float r=tilt*smoothstep(.04,.42,abs(vUv.y-focus));if(r>.3){vec3 a=c;for(int i=0;i<14;i++){float an=float(i)*2.39996;float rr=sqrt(float(i)+.5)/3.8;a+=texture2D(t,vUv+vec2(cos(an),sin(an))*rr*r*px).rgb;}c=a/15.;}}
 c*=expo;float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,sat);c=(c-.5)*con+.5;
 c+=vec3(warm*.07,warm*.025,-warm*.07);
 c+=split*(1.-smoothstep(0.,.55,l))*vec3(-.035,.012,.045)+split*smoothstep(.45,1.,l)*vec3(.05,.018,-.035);
 c=mix(c,vec3(dot(c,vec3(.3,.59,.11))),bw);
 c*=1.-vig*smoothstep(.32,.86,distance(vUv,vec2(.5)));
 c+=(fract(sin(dot(vUv*vec2(12.9898,78.233)+time,vec2(1.)))*43758.5453)-.5)*grain;
 gl_FragColor=vec4(clamp(c,0.,1.),1.);}`,depthTest:false,depthWrite:false});
  POST.mat=mat;POST.scene=new THREE.Scene();POST.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);POST.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat));
})();
function skyTexture(){const c=document.createElement('canvas');c.width=4;c.height=256;const g=c.getContext('2d'),cs=getComputedStyle(document.documentElement),gr=g.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,cs.getPropertyValue('--sky-a').trim()||'#e6eef2');gr.addColorStop(1,cs.getPropertyValue('--sky-b').trim()||'#bcd');g.fillStyle=gr;g.fillRect(0,0,4,256);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
function postActive(){return CAM.on||S.view.post}
function postSync(){const on=postActive();if(on&&!scene.background){scene.background=skyTexture()}else if(!on&&scene.background){scene.background.dispose();scene.background=null}POST.on=on;
  const C=S.cam,G=GRADES[C.grade]||GRADES.natural,u=POST.mat.uniforms;u.sat.value=G.sat;u.con.value=G.con;u.warm.value=G.warm;u.split.value=G.split;u.bw.value=G.bw;u.vig.value=C.vig;u.grain.value=C.grain;u.tilt.value=C.tilt*14;u.focus.value=C.focus;u.expo.value=C.expo;dirty=true}
function renderFrame(){
  if(!POST.on){renderer.render(scene,camera);return}
  const s=renderer.getDrawingBufferSize(new THREE.Vector2()),w=s.x,h=s.y;
  if(!POST.rt||POST.w!==w||POST.h!==h){if(POST.rt)POST.rt.dispose();const opts={encoding:THREE.sRGBEncoding};POST.rt=renderer.capabilities.isWebGL2&&THREE.WebGLMultisampleRenderTarget?new THREE.WebGLMultisampleRenderTarget(w,h,opts):new THREE.WebGLRenderTarget(w,h,opts);if(POST.rt.samples!==undefined)POST.rt.samples=4;POST.rt.texture.encoding=THREE.sRGBEncoding;POST.w=w;POST.h=h}
  const u=POST.mat.uniforms;u.t.value=POST.rt.texture;u.px.value.set(1/w,1/h);u.time.value=(performance.now()%10000)/1000;
  renderer.setRenderTarget(POST.rt);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(POST.scene,POST.cam);
}
/* ---------------- camera mode ---------------- */
const CAM={on:false,rec:null,anim:null,last:null};
function camEnter(fromFp){
  if(CAM.on)return;if(FP.on)fpExit();closePanel(true);closeQuick();CAM.on=true;document.body.classList.add('cammode');$('#camUI').hidden=false;
  setLens(S.cam.lens,true);renderCamUI();postSync();applyQuality();sfx('pop');haptic(10);touch();
}
function camExit(){if(!CAM.on)return;if(CAM.rec)stopRecording(true);CAM.on=false;CAM.anim=null;document.body.classList.remove('cammode');$('#camUI').hidden=true;camera.fov=40;camera.updateProjectionMatrix();postSync();applyQuality();layoutSheet();touch()}
function setLens(z,silent){S.cam.lens=z;const f=2*Math.atan(Math.tan(20*Math.PI/180)/z)*180/Math.PI;camera.fov=f;camera.updateProjectionMatrix();$$('#camLens button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.z===z));if(!silent){sfx('tick');haptic(6)}touch()}
function renderCamUI(){
  const C=S.cam;$('#camLens').innerHTML=LENSES.map(([z,l])=>`<button class="press" data-z="${z}" aria-pressed="${C.lens===z}">${l}</button>`).join('');
  $$('#camLens button').forEach(b=>b.onclick=()=>setLens(+b.dataset.z));
  $('#camGrade span').textContent=GRADES[C.grade].n;$('#camGrid').setAttribute('aria-pressed',C.grid);$('#camGridLines').hidden=!C.grid;$('#camHQ').setAttribute('aria-pressed',C.hq);
  $$('#camModes button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===C.mode));$('#camShutter').classList.toggle('video',C.mode==='video');
  $('#camMove').hidden=C.mode!=='video';$('#camMove span').textContent={turntable:'Turntable',flyover:'Flyover',drift:'Drift'}[C.move];
  $('#camFocus').hidden=!(C.tilt>0);$('#camFocus').style.top=(100-C.focus*100)+'%';
}
(function camUI(){
  $('#camExit').onclick=camExit;
  $('#camGrade').onclick=e=>openMenu(e.currentTarget,Object.entries(GRADES).map(([k,g])=>({v:k,label:g.n})),v=>{S.cam.grade=v;postSync();renderCamUI();saveSoon()},S.cam.grade);
  $('#camGrid').onclick=()=>{S.cam.grid=!S.cam.grid;renderCamUI();haptic(5)};
  $('#camHQ').onclick=()=>{S.cam.hq=!S.cam.hq;renderCamUI();applyQuality();toast(S.cam.hq?'HQ render: sharper shadows and full resolution':'Fast preview');haptic(6)};
  $$('#camModes button').forEach(b=>b.onclick=()=>{S.cam.mode=b.dataset.m;renderCamUI();haptic(6)});
  $('#camMove').onclick=e=>openMenu(e.currentTarget,[{v:'turntable',label:'Turntable',sub:'Circles the whole terrain'},{v:'flyover',label:'Flyover',sub:'Low pass across the land'},{v:'drift',label:'Drift',sub:'Slow push-in from this view'}],v=>{S.cam.move=v;renderCamUI()},S.cam.move);
  $('#camAdjust').onclick=e=>openPanel(e.currentTarget,`<h4>Adjust</h4><div style="padding:0 8px 6px">${sliderRow('cam.expo','Exposure',.6,1.6,.01,null,1,v=>(+v).toFixed(2)+'×')}${sliderRow('cam.tilt','Depth blur',0,1,.01,null,0,v=>Math.round(v*100)+'%')}${sliderRow('cam.vig','Vignette',0,1,.01,null,.3,v=>Math.round(v*100)+'%')}${sliderRow('cam.grain','Grain',0,.12,.005,null,.03,v=>Math.round(v/.12*100)+'%')}${sliderRow('cam.dur','Video length',3,20,1,null,8,v=>v+' s')}</div>`,p=>bindSliders(p,(k,v)=>{setK(k,v);postSync();renderCamUI();saveSoon()}),{width:320});
  $('#camShutter').onclick=()=>{if(S.cam.mode==='photo')takePhoto();else if(CAM.rec)stopRecording();else startRecording()};
  $('#camThumb').onclick=()=>{if(CAM.last)saveFile(CAM.last.name,CAM.last.blob)};
  const f=$('#camFocus');let on=false;f.onpointerdown=e=>{on=true;try{f.setPointerCapture(e.pointerId)}catch(_){}};f.onpointermove=e=>{if(!on)return;S.cam.focus=clamp(1-e.clientY/innerHeight,.05,.95);renderCamUI();postSync()};f.onpointerup=f.onpointercancel=()=>{on=false;saveSoon()};
})();
function flash(){const el=$('#camFlash');el.classList.remove('go');void el.offsetWidth;el.classList.add('go')}
async function takePhoto(){
  flash();sfx('shutter');haptic(18);const long=Math.min(S.cam.hq?4096:2048,renderer.capabilities.maxTextureSize||4096),pr=Math.max(1,long/Math.max(innerWidth,innerHeight)),old=renderer.getPixelRatio();
  const oldShadow=sun.shadow.mapSize.x;if(S.cam.hq&&S.view.shadows){sun.shadow.mapSize.set(4096,4096);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
  renderer.shadowMap.needsUpdate=true;renderer.setPixelRatio(pr);renderer.setSize(innerWidth,innerHeight,false);renderFrame();
  const blob=await new Promise(r=>renderer.domElement.toBlob(r,'image/png'));
  renderer.setPixelRatio(old);renderer.setSize(innerWidth,innerHeight,false);if(sun.shadow.mapSize.x!==oldShadow){sun.shadow.mapSize.set(oldShadow,oldShadow);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}renderer.shadowMap.needsUpdate=true;dirty=true;
  if(!blob){toast('Could not capture the image','warn');return}
  const name=`terraingen-${(S.name||'terrain').toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${Date.now().toString(36)}.png`;CAM.last={name,blob};setThumb(blob);
  const J=job('Photo',['Saved']);J.done(Math.round(blob.size/1024)+' KB');saveFile(name,blob);
}
function setThumb(blob){const u=URL.createObjectURL(blob),t=$('#camThumb');if(t._u)URL.revokeObjectURL(t._u);t._u=u;t.style.backgroundImage=`url(${u})`;t.classList.remove('pop');void t.offsetWidth;t.classList.add('pop')}
function startRecording(){
  const cv=renderer.domElement;if(!cv.captureStream||!window.MediaRecorder){toast('Video capture is not supported in this browser','warn');return}
  const types=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'],type=types.find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t));if(!type){toast('No supported video format','warn');return}
  const stream=cv.captureStream(30),rec=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:8e6}),chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  rec.onstop=()=>{const blob=new Blob(chunks,{type:type.split(';')[0]}),ext=type.includes('mp4')?'mp4':'webm',name=`terraingen-${S.cam.move}-${Date.now().toString(36)}.${ext}`;CAM.last={name,blob};setThumb(blob);job('Video · '+S.cam.move,['Saved']).done(Math.round(blob.size/1048576*10)/10+' MB');sfx('chime');saveFile(name,blob)};
  const W=S.shape.world,d=S.cam.dur*1000,from={r:cam.r,phi:cam.phi,theta:cam.theta,tx:cam.target.x,ty:cam.target.y,tz:cam.target.z};
  CAM.anim={t0:performance.now(),d,from,move:S.cam.move};CAM.rec=rec;rec.start(250);$('#camShutter').classList.add('rec');$('#camTime').hidden=false;sfx('pop');haptic(14);
  if(S.cam.move==='flyover'){const a=cam.theta;CAM.anim.path={x0:-Math.sin(a)*W*.55,z0:-Math.cos(a)*W*.55,x1:Math.sin(a)*W*.55,z1:Math.cos(a)*W*.55}}
}
function stopRecording(silent){if(!CAM.rec)return;const r=CAM.rec;CAM.rec=null;try{r.stop()}catch(e){}CAM.anim=null;$('#camShutter').classList.remove('rec');$('#camTime').hidden=true;if(!silent)haptic(10);placeCamera()}
function camTickMode(now){
  if(!CAM.on)return;
  if(CAM.anim){const a=CAM.anim,t=clamp((now-a.t0)/a.d,0,1),f=a.from,W=S.shape.world;$('#camTime').textContent=((now-a.t0)/1000).toFixed(1)+' s';
    if(a.move==='turntable'){cam.theta=f.theta+t*Math.PI*2;placeCamera()}
    else if(a.move==='drift'){cam.r=f.r*(1-.35*easeIO(t));cam.theta=f.theta+.25*t;placeCamera()}
    else{const p=a.path,x=lerp(p.x0,p.x1,t),z=lerp(p.z0,p.z1,t),gx=(x/W+.5)*(N-1),gy=(z/W+.5)*(N-1),h=Math.max(hAt(gx,gy),seaLevel())*S.view.vex,alt=h+Math.max(S.shape.maxH*.35,W*.04);
      const ahead=clamp(t+.05,0,1),ax=lerp(p.x0,p.x1,ahead),az=lerp(p.z0,p.z1,ahead),ah=Math.max(hAt((ax/W+.5)*(N-1),(az/W+.5)*(N-1)),seaLevel())*S.view.vex;
      camera.position.set(x,lerp(camera.position.y||alt,alt,.08),z);camera.lookAt(ax,ah+S.shape.maxH*.05,az)}
    dirty=true;if(t>=1)stopRecording()}
}
