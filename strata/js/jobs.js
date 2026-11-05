"use strict";
/* Terrain Gen jobs: a queue of long tasks (photo analysis, AI, simulations, exports) with an animated progress window. */
const JOBS=[];let jobSeq=0,pwJob=null;
function job(name,steps,opts){
  const j={id:++jobSeq,name,steps:(steps||[]).slice(),step:0,p:0,status:'running',t0:Date.now(),img:opts&&opts.img||null,msg:''};JOBS.unshift(j);if(JOBS.length>24)JOBS.pop();
  if(opts&&opts.window)openProgress(j);updJobs();
  return{j,step(i,label){j.step=i;if(label)j.steps[i]=label;j.p=Math.max(j.p,i/Math.max(1,j.steps.length));updJobs()},prog(p){j.p=clamp(p,0,1);updJobs()},
    done(msg){j.status='done';j.p=1;j.step=j.steps.length;j.msg=msg||'';updJobs();sfx('chime')},fail(msg){j.status='failed';j.msg=msg||'';updJobs();sfx('error')}};
}
function updJobs(){
  const run=JOBS.filter(j=>j.status==='running').length,b=$('#queueBtn');if(b){b.querySelector('b').textContent=run||'';b.classList.toggle('busy',run>0)}
  if(popEl&&popEl.dataset.queue)renderQueue(popEl);if(pwJob)renderProgress();
}
function jobRow(j){const ic=j.status==='done'?'<span class="qok">'+svg('<path d="m5 12 5 5 9-10"/>',2.6)+'</span>':j.status==='failed'?'<span class="qbad">!</span>':'<span class="qspin"></span>';
  return `<div class="qrow">${ic}<div class="qtx"><b>${esc(j.name)}</b><small>${esc(j.status==='running'?(j.steps[Math.min(j.step,j.steps.length-1)]||'Working…'):j.msg||(j.status==='done'?'Done':'Failed'))}</small><div class="qbar"><i style="width:${Math.round(j.p*100)}%"></i></div></div><small class="qt">${Math.max(1,Math.round((Date.now()-j.t0)/1000))}s</small></div>`}
function renderQueue(p){p.innerHTML=`<h4>Queue</h4>${JOBS.length?JOBS.map(jobRow).join(''):'<p class="hint" style="padding:0 10px 8px">Nothing has run yet. Photo builds, AI requests, simulations and exports appear here.</p>'}`}
function openQueue(anchor){openPanel(anchor,'',p=>{p.dataset.queue=1;renderQueue(p)},{width:330})}
/* progress window: image with a scanning beam, step checklist, bar */
function openProgress(j){pwJob=j;const w=$('#pw');w.hidden=false;renderProgress()}
function renderProgress(){
  const j=pwJob,w=$('#pw');if(!j||!w)return;
  w.innerHTML=`<div class="pwc glass"><div class="pwimg${j.status==='running'?' scan':''}" style="${j.img?`background-image:url(${j.img})`:''}">${j.img?'':svg('<path d="M2 19 9 7l4 6 3-4 6 10z"/>')}</div>
  <h3>${esc(j.name)}</h3><ol class="pwsteps">${j.steps.map((s,i)=>`<li class="${i<j.step||j.status==='done'?'ok':i===j.step&&j.status==='running'?'now':''}"><i></i>${esc(s)}</li>`).join('')}</ol>
  <div class="qbar big"><i style="width:${Math.round(j.p*100)}%"></i></div>${j.msg?`<p class="hint">${esc(j.msg)}</p>`:''}
  ${j.status!=='running'?'<div class="btns"><button class="btn anodized press" id="pwOk">Done</button></div>':'<p class="hint">You can keep working · it continues in the queue</p><div class="btns"><button class="btn plain press" id="pwHide">Hide</button></div>'}</div>`;
  const ok=$('#pwOk');if(ok)ok.onclick=closeProgress;const hd=$('#pwHide');if(hd)hd.onclick=closeProgress;
  if(j.status==='done'){clearTimeout(w._t);w._t=setTimeout(()=>{if(pwJob===j)closeProgress()},1800)}
}
function closeProgress(){pwJob=null;const w=$('#pw');w.hidden=true}
