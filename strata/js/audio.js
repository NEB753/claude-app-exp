"use strict";
/* Terrain Gen sound: tiny Web Audio synth, no audio files. Soft UI clicks, slider ticks, a completion chime, and
   noise beds for sculpting, rain, lava, wind and quakes. Starts on the first touch; silent when Sound is off. */
const AU={ctx:null,master:null,noise:null,loops:{},lastTick:0};
function auInit(){
  if(AU.ctx||!SET.sound)return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;AU.ctx=new C();AU.master=AU.ctx.createGain();AU.master.gain.value=(SET.volume??.6)*.5;AU.master.connect(AU.ctx.destination);
    const len=AU.ctx.sampleRate*2,b=AU.ctx.createBuffer(1,len,AU.ctx.sampleRate),d=b.getChannelData(0);let last=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;last=last*.6+w*.4;d[i]=last}AU.noise=b}catch(e){AU.ctx=null}}
document.addEventListener('pointerdown',()=>{if(!SET.sound)return;auInit();if(AU.ctx&&AU.ctx.state==='suspended')AU.ctx.resume()},{capture:true,passive:true});
function auVol(){if(AU.master)AU.master.gain.value=SET.sound?(SET.volume??.6)*.5:0}
function blip(f0,f1,dur,vol,type){if(!SET.sound||!AU.ctx)return;const t=AU.ctx.currentTime,o=AU.ctx.createOscillator(),g=AU.ctx.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(AU.master);o.start(t);o.stop(t+dur+.02)}
function sfx(kind){
  if(!SET.sound||!AU.ctx)return;const now=performance.now();
  if(kind==='tick'){if(now-AU.lastTick<35)return;AU.lastTick=now;blip(2400,1800,.018,.05,'triangle');return}
  if(kind==='tap')return blip(1100,700,.045,.07);
  if(kind==='toggle')return blip(660,990,.06,.07);
  if(kind==='pop')return blip(420,880,.09,.08);
  if(kind==='thud')return blip(140,55,.18,.18,'sine');
  if(kind==='chime'){blip(784,784,.35,.06);setTimeout(()=>blip(1175,1175,.45,.05),90);setTimeout(()=>blip(1568,1568,.5,.035),180);return}
  if(kind==='error')return blip(300,180,.18,.08,'triangle');
  if(kind==='shutter'){const t=AU.ctx.currentTime,s=AU.ctx.createBufferSource(),f=AU.ctx.createBiquadFilter(),g=AU.ctx.createGain();s.buffer=AU.noise;f.type='highpass';f.frequency.value=1800;g.gain.setValueAtTime(.35,t);g.gain.exponentialRampToValueAtTime(.001,t+.07);s.connect(f);f.connect(g);g.connect(AU.master);s.start(t);s.stop(t+.08);setTimeout(()=>blip(900,400,.05,.06),70);return}
}
const LOOPS={sculpt:{f:'lowpass',hz:420,q:.8,g:.22},rain:{f:'bandpass',hz:2600,q:.6,g:.16},lava:{f:'lowpass',hz:140,q:1.2,g:.35},wind:{f:'bandpass',hz:520,q:1.4,g:.22},quake:{f:'lowpass',hz:70,q:2,g:.6},erode:{f:'bandpass',hz:1500,q:.9,g:.1}};
function loopOn(name,level){
  if(!SET.sound||!AU.ctx||!LOOPS[name])return;let L=AU.loops[name];const c=LOOPS[name];
  if(!L){const s=AU.ctx.createBufferSource();s.buffer=AU.noise;s.loop=true;const f=AU.ctx.createBiquadFilter();f.type=c.f;f.frequency.value=c.hz;f.Q.value=c.q;const g=AU.ctx.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(AU.master);s.start();
    let lfo=null;if(name==='wind'||name==='rain'){lfo=AU.ctx.createOscillator();const lg=AU.ctx.createGain();lfo.frequency.value=name==='wind'?.15:.4;lg.gain.value=c.hz*.35;lfo.connect(lg);lg.connect(f.frequency);lfo.start()}
    L=AU.loops[name]={s,f,g,lfo}}
  L.g.gain.setTargetAtTime(c.g*clamp(level??1,0,1.5),AU.ctx.currentTime,.08);
}
function loopOff(name){const L=AU.loops[name];if(!L||!AU.ctx)return;L.g.gain.setTargetAtTime(0,AU.ctx.currentTime,.15);setTimeout(()=>{if(AU.loops[name]!==L)return;try{L.s.stop();L.lfo&&L.lfo.stop()}catch(e){}delete AU.loops[name]},700)}
function loopsOff(){for(const k in AU.loops)loopOff(k)}
// UI taps: any .press control
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.press,.seg button,#dock button'))sfx('tap')},true);
document.addEventListener('change',e=>{if(e.target.matches&&e.target.matches('input[type=checkbox]'))sfx('toggle')},true);
