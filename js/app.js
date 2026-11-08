/* BeatForge Studio — UI wiring */
(function () {
  'use strict';
  const BS = window.BS, $ = BS.$, $$ = BS.$$, h = BS.h;
  const Lib = BS.Library, Gen = BS.Gen, Beat = BS.Beat, AK = BS.AudioKit;

  // =====================================================================
  // control builders (bind a control to obj[key])
  // =====================================================================
  function slider(parent, obj, key, label, min, max, step, onChange, fmt) {
    fmt = fmt || ((v) => (step < 1 ? (+v).toFixed(step < 0.1 ? 2 : 1) : v));
    const val = h('b', { text: fmt(obj[key]) });
    const inp = h('input', { type: 'range', min, max, step, value: obj[key] });
    inp.addEventListener('input', () => { obj[key] = +inp.value; val.textContent = fmt(obj[key]); onChange && onChange(key); });
    const wrap = h('div', { class: 'ctl' }, [h('label', { class: 'lbl' }, [label, val]), inp]);
    wrap.sync = () => { inp.value = obj[key]; val.textContent = fmt(obj[key]); };
    parent.appendChild(wrap);
    return wrap;
  }
  function select(parent, obj, key, label, options, onChange) {
    const sel = h('select');
    const fill = (opts) => {
      sel.innerHTML = '';
      (Array.isArray(opts) ? opts : Object.entries(opts)).forEach(([v, l]) => sel.appendChild(h('option', { value: v, text: l })));
      sel.value = obj[key];
    };
    fill(options);
    sel.addEventListener('change', () => { obj[key] = isNaN(+sel.value) || sel.value === '' ? sel.value : (typeof obj[key] === 'number' ? +sel.value : sel.value); onChange && onChange(key); });
    const wrap = h('div', { class: 'ctl' }, [label ? h('label', { class: 'lbl', text: label }) : null, sel]);
    wrap.sync = () => (sel.value = obj[key]);
    wrap.fill = fill;
    parent.appendChild(wrap);
    return wrap;
  }
  function check(parent, obj, key, label, onChange) {
    const inp = h('input', { type: 'checkbox' }); inp.checked = !!obj[key];
    inp.addEventListener('change', () => { obj[key] = inp.checked; onChange && onChange(key); });
    const wrap = h('label', { class: 'check-row' }, [inp, label]);
    wrap.sync = () => (inp.checked = !!obj[key]);
    parent.appendChild(wrap);
    return wrap;
  }
  function text(parent, obj, key, label, placeholder, onChange, type) {
    const inp = h('input', { type: type || 'text', value: obj[key], placeholder: placeholder || '' });
    inp.addEventListener('input', () => { obj[key] = type === 'number' ? +inp.value : inp.value; onChange && onChange(key); });
    const wrap = h('div', { class: 'ctl' }, [label ? h('label', { class: 'lbl', text: label }) : null, inp]);
    wrap.sync = () => (inp.value = obj[key]);
    parent.appendChild(wrap);
    return wrap;
  }
  function color(parent, obj, key, label, onChange) {
    const inp = h('input', { type: 'color', value: obj[key] });
    inp.addEventListener('input', () => { obj[key] = inp.value; onChange && onChange(key); });
    const wrap = h('label', { class: 'check-row' }, [inp, label]);
    wrap.sync = () => (inp.value = obj[key]);
    parent.appendChild(wrap);
    return wrap;
  }
  function chips(container, options, arr, onChange) {
    container.innerHTML = '';
    const els = {};
    Object.entries(options).forEach(([k, label]) => {
      const c = h('button', { class: 'chip' + (arr.includes(k) ? ' on' : ''), text: typeof label === 'string' ? label : label.name });
      c.addEventListener('click', () => {
        const i = arr.indexOf(k);
        if (i >= 0) arr.splice(i, 1); else arr.push(k);
        c.classList.toggle('on', arr.includes(k));
        onChange && onChange(k);
      });
      els[k] = c;
      container.appendChild(c);
    });
    return { sync() { Object.entries(els).forEach(([k, c]) => c.classList.toggle('on', arr.includes(k))); } };
  }
  const two = (parent) => { const d = h('div', { class: 'two' }); parent.appendChild(d); return d; };
  function progress(el, v) {
    if (v == null) { el.classList.remove('show'); return; }
    el.classList.add('show'); el.firstElementChild.style.width = Math.round(BS.clamp(v, 0, 1) * 100) + '%';
  }

  // =====================================================================
  // tabs, drag & drop, library panel
  // =====================================================================
  let activeTab = 'create';
  $$('.tab').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  function switchTab(name) {
    activeTab = name;
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    if (name !== 'beat' && renderer.playing) renderer.stop(), updatePlayBtn();
    if (name === 'photo') Lab.refreshSources();
    if (name === 'beat') { BeatUI.refreshAudioList(); BeatUI.rebuild(); }
    document.body.classList.remove('lib-open');
  }
  $('#libToggle').addEventListener('click', () => document.body.classList.toggle('lib-open'));

  async function addFiles(files) {
    const added = [];
    for (const f of files) { const it = await Lib.addFile(f); if (it) added.push(it); }
    if (added.length) BS.toast(`Added ${added.length} file${added.length > 1 ? 's' : ''} to the library`);
    return added;
  }
  $('#fileInput').addEventListener('change', async (e) => { await addFiles(Array.from(e.target.files)); e.target.value = ''; });
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) { dragDepth++; document.body.classList.add('dragging'); } });
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove('dragging'); });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
    const files = Array.from(e.dataTransfer.files || []);
    const added = await addFiles(files);
    const audio = added.find((a) => a.kind === 'audio');
    if (audio && activeTab === 'beat') BeatUI.useAudio(audio.id);
    const img = added.find((a) => a.kind === 'image' || a.kind === 'video');
    if (img && activeTab === 'photo') { Lab.state.src = img.id; Lab.refreshSources(); Lab.load(); }
  });

  let libFilter = 'all';
  $$('#libFilter .chip').forEach((c) => c.addEventListener('click', () => {
    libFilter = c.dataset.k;
    $$('#libFilter .chip').forEach((x) => x.classList.toggle('on', x === c));
    renderLibrary();
  }));
  function renderLibrary() {
    const grid = $('#libGrid');
    grid.innerHTML = '';
    const items = Lib.items.filter((i) => libFilter === 'all' || i.kind === libFilter);
    $('#libEmpty').style.display = Lib.items.length ? 'none' : 'block';
    items.slice().reverse().forEach((it) => {
      const isVis = it.kind !== 'audio';
      const el = h('div', { class: 'lib-item' + (isVis && it.selected ? ' sel' : ''), title: it.name + (isVis ? ' — click to toggle use in Beat Sync' : '') }, [
        h('img', { src: it.thumb || '', alt: '' }),
        h('span', { class: 'badge', text: (it.kind === 'image' ? '🖼' : it.kind === 'video' ? '🎬 ' + BS.fmtTime(it.duration) : '♫ ' + BS.fmtTime(it.duration)) }),
        h('span', { class: 'name', text: it.name }),
        isVis ? h('span', { class: 'check', text: it.selected ? '✓' : '' }) : null,
        h('div', { class: 'acts' }, [
          isVis ? h('button', { title: 'Open in Photo Lab', text: '◐', onclick: (e) => { e.stopPropagation(); Lab.state.src = it.id; switchTab('photo'); Lab.load(); } }) : null,
          it.kind === 'audio' ? h('button', { title: 'Use as Beat Sync music', text: '♫', onclick: (e) => { e.stopPropagation(); switchTab('beat'); BeatUI.useAudio(it.id); } }) : null,
          h('button', { title: 'Download', text: '⬇', onclick: (e) => { e.stopPropagation(); BS.download(it.blob, it.name); } }),
          h('button', { title: 'Remove', text: '✕', onclick: (e) => { e.stopPropagation(); Lib.remove(it.id); } }),
        ]),
      ]);
      el.addEventListener('click', () => {
        if (it.kind === 'audio') { switchTab('beat'); BeatUI.useAudio(it.id); return; }
        it.selected = !it.selected; Lib.emit();
      });
      grid.appendChild(el);
    });
  }
  Lib.onChange(() => { renderLibrary(); BeatUI.onLibraryChange(); Lab.onLibraryChange(); Create.onLibraryChange(); });
  $('#libSelAll').addEventListener('click', () => { Lib.visuals().forEach((i) => (i.selected = true)); Lib.emit(); });
  $('#libSelNone').addEventListener('click', () => { Lib.visuals().forEach((i) => (i.selected = false)); Lib.emit(); });

  // =====================================================================
  // CREATE: image + video generator
  // =====================================================================
  const Create = (function () {
    const G = { style: 'auto', palette: 'auto', aspect: '16:9', size: 1280, seed: '', count: 4, grain: 0.12, vignette: 0.35, engine: 'procedural' };
    const V = { mode: 'style', motion: 'kenburns', image: 'current', duration: 8, fps: 30, size: 1280, audio: '' };
    const results = [];
    let current = -1;
    const cv = $('#createCanvas'), ctx = cv.getContext('2d'), vid = $('#createVideo');
    const promptEl = $('#genPrompt');

    const o = $('#genOpts');
    select(o, G, 'engine', 'Engine', [['procedural', 'Procedural art (offline, instant)'], ['online', 'AI images — Pollinations (free, online)']], updateHint);
    const t1 = two(o);
    select(t1, G, 'style', 'Style', [['auto', 'Auto (from prompt)']].concat(Gen.STYLES.map((s) => [s, Gen.STYLE_NAMES[s]])), updateHint);
    select(t1, G, 'palette', 'Palette', [['auto', 'Auto (from prompt)']].concat(Object.keys(Gen.PALETTES).map((p) => [p, p[0].toUpperCase() + p.slice(1)])), updateHint);
    const t2 = two(o);
    select(t2, G, 'aspect', 'Aspect', Object.keys(BS.ASPECTS).map((a) => [a, a]));
    select(t2, G, 'size', 'Size (long side)', [[720, '720'], [1080, '1080'], [1280, '1280'], [1920, '1920'], [2560, '2560']]);
    const t3 = two(o);
    select(t3, G, 'count', 'Variations', [[1, '1'], [2, '2'], [4, '4'], [6, '6'], [8, '8']]);
    text(t3, G, 'seed', 'Seed (blank = from prompt)', 'auto', null, 'text');
    slider(o, G, 'grain', 'Film grain', 0, 1, 0.01);
    slider(o, G, 'vignette', 'Vignette', 0, 1, 0.01);
    promptEl.addEventListener('input', updateHint);

    function updateHint() {
      if (G.engine === 'online') { $('#genHint').textContent = 'Uses the free Pollinations.ai image API (no key). Falls back to procedural art if it is unreachable.'; return; }
      const a = Gen.analyzePrompt(promptEl.value, G.seed === '' ? null : G.seed);
      $('#genHint').textContent = `Style: ${Gen.STYLE_NAMES[G.style === 'auto' ? a.style : G.style]} · palette: ${G.palette === 'auto' ? a.paletteName : G.palette}`;
    }
    updateHint();

    const RANDOM_PROMPTS = ['cosmic nebula in purple and gold', 'neon cyberpunk city at night', 'misty mountain landscape at dawn', 'psychedelic kaleidoscope mandala',
      'stained glass in emerald and sapphire blue', 'retro synthwave sunset', 'aurora over frozen ice', 'flowing silk in red and black', 'geometric bauhaus poster',
      'ocean waves at sunset', 'hyperspace tunnel vortex', 'toxic acid green swirl', 'pastel dream gradient', 'lava fire flow field'];
    $('#genRandom').addEventListener('click', () => { promptEl.value = RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)]; G.seed = String(BS.randomSeed()); $$('#genOpts input[type=text]')[0].value = G.seed; updateHint(); generate(); });
    $('#genBtn').addEventListener('click', generate);
    promptEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate(); });

    async function fetchOnline(prompt, w, hh, seed) {
      const url = Gen.pollinationsUrl(prompt, w, hh, seed);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 120000);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        const c = BS.makeCanvas(w, hh);
        BS.drawFit(c.getContext('2d'), bmp, bmp.width, bmp.height, 0, 0, w, hh, 'cover');
        return c;
      } finally { clearTimeout(timer); }
    }

    async function generate() {
      const btn = $('#genBtn'); btn.disabled = true; const label = btn.textContent; btn.textContent = 'Generating…';
      try {
        const prompt = promptEl.value.trim() || 'abstract';
        const a = Gen.analyzePrompt(prompt, G.seed === '' ? null : G.seed);
        const style = G.style === 'auto' ? a.style : G.style;
        const palette = G.palette === 'auto' ? a.palette : Gen.PALETTES[G.palette];
        const [w, hh] = BS.sizeFor(G.aspect, G.size);
        results.length = 0; $('#genResults').innerHTML = '';
        for (let k = 0; k < G.count; k++) {
          const seed = (a.seed + k * 1013) >>> 0;
          let c = null, engine = 'procedural';
          if (G.engine === 'online') {
            btn.textContent = `AI image ${k + 1}/${G.count}…`;
            try { c = await fetchOnline(prompt, w, hh, seed); engine = 'ai'; }
            catch (e) { BS.toast('Online AI unavailable (' + e.message + ') — using procedural art instead.', 'error'); G.engine = 'procedural'; }
          }
          if (!c) {
            c = BS.makeCanvas(w, hh);
            Gen.render(c.getContext('2d'), w, hh, { style, palette, seed, t: 0, still: true, grain: G.grain, vignette: G.vignette });
          } else if (G.grain || G.vignette) {
            const cx = c.getContext('2d'); BS.FX.vignette(cx, w, hh, G.vignette); BS.FX.grain(cx, w, hh, G.grain, 0);
          }
          results.push({ canvas: c, seed, style, palette, engine, name: (engine === 'ai' ? 'ai-' : style + '-') + seed + '.png' });
          addResultThumb(results.length - 1);
          if (k === 0) show(0);
          await BS.nextFrame();
        }
      } finally { btn.disabled = false; btn.textContent = label; }
    }
    function addResultThumb(i) {
      const r = results[i];
      const t = BS.makeCanvas(300, 300 * r.canvas.height / r.canvas.width);
      t.getContext('2d').drawImage(r.canvas, 0, 0, t.width, t.height);
      const el = h('div', { class: 'res', onclick: () => show(i) }, [h('img', { src: t.toDataURL('image/jpeg', 0.8) }), h('span', { text: r.engine === 'ai' ? 'AI · ' + r.seed : Gen.STYLE_NAMES[r.style] })]);
      $('#genResults').appendChild(el);
    }
    function show(i) {
      current = i;
      const r = results[i];
      vid.hidden = true; vid.pause(); cv.hidden = false;
      cv.width = r.canvas.width; cv.height = r.canvas.height;
      ctx.drawImage(r.canvas, 0, 0);
      $$('#genResults .res').forEach((e, k) => e.classList.toggle('on', k === i));
    }
    const cur = () => results[current];
    $('#saveImgBtn').addEventListener('click', async () => { if (!cur()) return BS.toast('Generate something first'); await Lib.addCanvas(cur().canvas, cur().name); BS.toast('Saved to library'); });
    $('#dlImgBtn').addEventListener('click', async () => { if (!cur()) return BS.toast('Generate something first'); BS.download(await BS.canvasToBlob(cur().canvas), cur().name); });
    $('#saveAllBtn').addEventListener('click', async () => { if (!results.length) return BS.toast('Generate something first'); for (const r of results) await Lib.addCanvas(r.canvas, r.name); BS.toast(`Saved ${results.length} images`); });
    $('#toLabBtn').addEventListener('click', async () => {
      if (!cur()) return BS.toast('Generate something first');
      const it = await Lib.addCanvas(cur().canvas, cur().name);
      Lab.state.src = it.id; switchTab('photo'); Lab.load();
    });

    // ---- video generator ----
    const vo = $('#vidOpts');
    select(vo, V, 'mode', 'What to animate', [['style', 'Prompt → animated procedural scene'], ['image', 'Image → camera motion video']], syncVidUI);
    const imgSel = select(vo, V, 'image', 'Image', [['current', 'Current generated image']]);
    const motSel = select(vo, V, 'motion', 'Camera motion', Object.entries(Gen.MOTIONS).map(([k, m]) => [k, m.name]));
    const vt = two(vo);
    select(vt, V, 'duration', 'Length', [[4, '4 s'], [6, '6 s'], [8, '8 s'], [12, '12 s'], [20, '20 s'], [30, '30 s']]);
    select(vt, V, 'fps', 'FPS', [[24, '24'], [30, '30'], [60, '60']]);
    const vt2 = two(vo);
    select(vt2, V, 'size', 'Resolution', [[640, '640p (fast)'], [1280, '720p'], [1920, '1080p']]);
    const audSel = select(vt2, V, 'audio', 'Soundtrack', [['', 'None']]);
    vo.appendChild(h('div', { class: 'hint', text: 'Videos render in real time in your browser and are added to the library (great as Beat Sync clips).' }));
    function syncVidUI() { imgSel.style.display = motSel.style.display = V.mode === 'image' ? '' : 'none'; }
    syncVidUI();
    function onLibraryChange() {
      imgSel.fill([['current', 'Current generated image']].concat(Lib.byKind('image').map((i) => [i.id, i.name])));
      if (!imgSel.querySelector(`option[value="${V.image}"]`)) V.image = 'current';
      imgSel.sync();
      audSel.fill([['', 'None']].concat(Lib.byKind('audio').map((i) => [i.id, i.name])));
      if (!audSel.querySelector(`option[value="${V.audio}"]`)) V.audio = '';
      audSel.sync();
    }

    $('#vidBtn').addEventListener('click', async () => {
      const btn = $('#vidBtn'), prog = $('#vidProg');
      const [w, hh] = BS.sizeFor(G.aspect, V.size);
      let draw, name;
      if (V.mode === 'style') {
        const prompt = promptEl.value.trim() || 'abstract';
        const a = Gen.analyzePrompt(prompt, G.seed === '' ? null : G.seed);
        const r = cur();
        const style = r && r.engine !== 'ai' ? r.style : G.style === 'auto' ? a.style : G.style;
        const palette = r && r.engine !== 'ai' ? r.palette : G.palette === 'auto' ? a.palette : Gen.PALETTES[G.palette];
        const seed = r ? r.seed : a.seed;
        draw = (t) => Gen.render(ctx, w, hh, { style, palette, seed, t, still: false, grain: G.grain * 0.7, vignette: G.vignette });
        name = `${style}-${seed}`;
      } else {
        let src, sw, sh;
        if (V.image === 'current') { const r = cur(); if (!r) return BS.toast('Generate an image first or choose one from the library', 'error'); src = r.canvas; sw = src.width; sh = src.height; }
        else { const it = Lib.get(V.image); if (!it) return; src = it.el; sw = it.width; sh = it.height; }
        const mot = Gen.MOTIONS[V.motion];
        draw = (t) => {
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, hh);
          Gen.drawMotion(ctx, w, hh, src, sw, sh, mot.f(t / V.duration, t));
          BS.FX.grain(ctx, w, hh, G.grain * 0.6, t);
        };
        name = `motion-${V.motion}`;
      }
      cv.width = w; cv.height = hh; vid.hidden = true; cv.hidden = false;
      btn.disabled = true; progress(prog, 0);
      let audioStream = null, srcNode = null;
      try {
        if (V.audio) {
          const it = Lib.get(V.audio);
          const actx = AK.ctx(); await actx.resume();
          const dest = actx.createMediaStreamDestination();
          srcNode = actx.createBufferSource(); srcNode.buffer = it.audioBuffer;
          const g = actx.createGain();
          g.gain.setValueAtTime(1, actx.currentTime + V.duration - 0.6); g.gain.linearRampToValueAtTime(0.0001, actx.currentTime + V.duration);
          srcNode.connect(g); g.connect(dest); g.connect(actx.destination);
          srcNode.start(); audioStream = dest.stream;
        }
        const blob = await Gen.recordAnimation(cv, V.duration, V.fps, draw, (p) => progress(prog, p), audioStream);
        const ext = blob.type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
        const it = await Lib.addBlob(blob, `${name}.${ext}`, 'video', { duration: V.duration });
        vid.src = URL.createObjectURL(blob); vid.hidden = false; cv.hidden = true; vid.play().catch(() => {});
        BS.toast(it ? 'Video added to library ✓' : 'Video rendered (download from the player)');
      } catch (e) {
        console.error(e); BS.toast('Video render failed: ' + e.message, 'error');
      } finally {
        if (srcNode) try { srcNode.stop(); } catch (e) { /* ignore */ }
        btn.disabled = false; progress(prog, null);
      }
    });

    // initial preview
    setTimeout(generate, 50);
    return { onLibraryChange, generate, results };
  })();

  // =====================================================================
  // PHOTO LAB
  // =====================================================================
  const Lab = (function () {
    const DEF = {
      src: '', frame: 0.15, brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0, sepia: 0, grayscale: 0, temp: 0, sharpen: 0,
      posterize: 32, duotone: 0, duoA: '#1a0533', duoB: '#ffd166', halftone: 0, rgb: 0, glitch: 0, pixel: 0, scan: 0, vhs: 0, grain: 0, vignette: 0,
      invert: false, mirror: 'none', tintColor: '#ff3d7f', tint: 0, text: '', textSize: 0.12, textColor: '#ffffff', textY: 0.85, textFont: 'impact', glow: false,
      aspect: 'original', rotate: 0, flipH: false, maxSize: 2048, seed: 7,
    };
    const L = Object.assign({}, DEF);
    const PRESETS = {
      Film: { contrast: 108, saturate: 92, sepia: 12, grain: 0.35, vignette: 0.4, temp: 0.15 },
      Noir: { grayscale: 100, contrast: 145, brightness: 92, grain: 0.4, vignette: 0.6 },
      Vaporwave: { saturate: 140, hue: -25, duotone: 0.55, duoA: '#2b0a5c', duoB: '#ff71ce', rgb: 4, scan: 0.4, grain: 0.15 },
      Cyberpunk: { contrast: 125, saturate: 150, tint: 0.25, tintColor: '#00e5ff', rgb: 6, vignette: 0.45, glitch: 0.2 },
      Vintage: { sepia: 45, contrast: 92, brightness: 106, saturate: 80, grain: 0.45, vignette: 0.5, temp: 0.2 },
      VHS: { vhs: 0.8, saturate: 120, contrast: 110, blur: 0.6, grain: 0.3 },
      'Pop art': { halftone: 9, saturate: 170, contrast: 130 },
      Dream: { brightness: 110, saturate: 125, blur: 1.2, tint: 0.2, tintColor: '#ff9ed8', vignette: 0.25 },
      Glitch: { glitch: 0.8, rgb: 10, pixel: 0, scan: 0.3, contrast: 115 },
      Poster: { posterize: 5, saturate: 140, contrast: 120 },
      Mirror: { mirror: 'h', saturate: 120 },
      Moody: { brightness: 88, contrast: 120, saturate: 75, temp: -0.25, vignette: 0.55 },
    };
    const ctls = [];
    const cv = $('#labCanvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
    const srcSel = $('#labSource');
    let compare = false, pending = false;
    const ch = () => schedule();

    const pp = $('#labPresets');
    Object.keys(PRESETS).forEach((k) => pp.appendChild(h('button', { class: 'chip', text: k, onclick: () => { const keep = { src: L.src, frame: L.frame, text: L.text }; Object.assign(L, DEF, PRESETS[k], keep); ctls.forEach((c) => c.sync && c.sync()); schedule(); } })));

    const a = $('#labAdjust');
    ctls.push(slider(a, L, 'brightness', 'Brightness', 0, 200, 1, ch));
    ctls.push(slider(a, L, 'contrast', 'Contrast', 0, 200, 1, ch));
    ctls.push(slider(a, L, 'saturate', 'Saturation', 0, 250, 1, ch));
    ctls.push(slider(a, L, 'hue', 'Hue shift', -180, 180, 1, ch));
    ctls.push(slider(a, L, 'temp', 'Temperature (cool ↔ warm)', -1, 1, 0.01, ch));
    ctls.push(slider(a, L, 'sepia', 'Sepia', 0, 100, 1, ch));
    ctls.push(slider(a, L, 'grayscale', 'Grayscale', 0, 100, 1, ch));
    ctls.push(slider(a, L, 'blur', 'Blur', 0, 20, 0.1, ch));
    ctls.push(slider(a, L, 'sharpen', 'Sharpen', 0, 1.5, 0.05, ch));

    const f = $('#labFx');
    ctls.push(slider(f, L, 'rgb', 'RGB split', 0, 30, 0.5, ch));
    ctls.push(slider(f, L, 'glitch', 'Glitch', 0, 1, 0.01, ch));
    ctls.push(slider(f, L, 'pixel', 'Pixelate', 0, 40, 1, ch));
    ctls.push(slider(f, L, 'posterize', 'Posterize levels (32 = off)', 2, 32, 1, ch));
    ctls.push(slider(f, L, 'halftone', 'Halftone dots', 0, 24, 1, ch));
    ctls.push(slider(f, L, 'duotone', 'Duotone', 0, 1, 0.01, ch));
    const dd = h('div', { class: 'row' }); f.appendChild(dd);
    ctls.push(color(dd, L, 'duoA', 'shadows', ch)); ctls.push(color(dd, L, 'duoB', 'highlights', ch));
    ctls.push(slider(f, L, 'tint', 'Color tint', 0, 1, 0.01, ch));
    ctls.push(color(f, L, 'tintColor', 'tint color', ch));
    ctls.push(slider(f, L, 'scan', 'Scanlines', 0, 1, 0.01, ch));
    ctls.push(slider(f, L, 'vhs', 'VHS', 0, 1, 0.01, ch));
    ctls.push(slider(f, L, 'grain', 'Film grain', 0, 1, 0.01, ch));
    ctls.push(slider(f, L, 'vignette', 'Vignette', 0, 1, 0.01, ch));
    ctls.push(select(f, L, 'mirror', 'Mirror', [['none', 'None'], ['h', 'Left → right'], ['v', 'Top → bottom'], ['quad', 'Kaleido (4-way)']], ch));
    ctls.push(check(f, L, 'invert', 'Invert colors', ch));
    const gl = h('div', { class: 'row' }); f.appendChild(gl);
    gl.appendChild(h('button', { class: 'btn small', text: '🎲 New glitch seed', onclick: () => { L.seed = BS.randomSeed(); schedule(); } }));

    const tx = $('#labText');
    ctls.push(text(tx, L, 'text', null, 'Caption text…', ch));
    ctls.push(select(tx, L, 'textFont', 'Font', [['impact', 'Impact / meme'], ['sans', 'Clean sans'], ['serif', 'Elegant serif'], ['mono', 'Mono']], ch));
    ctls.push(slider(tx, L, 'textSize', 'Size', 0.03, 0.3, 0.005, ch));
    ctls.push(slider(tx, L, 'textY', 'Vertical position', 0.05, 0.95, 0.01, ch));
    const tr = h('div', { class: 'row' }); tx.appendChild(tr);
    ctls.push(color(tr, L, 'textColor', 'color', ch)); ctls.push(check(tr, L, 'glow', 'glow', ch));

    const fo = $('#labFrameOpts');
    ctls.push(select(fo, L, 'aspect', 'Crop', [['original', 'Original']].concat(Object.keys(BS.ASPECTS).map((k) => [k, k])), ch));
    ctls.push(select(fo, L, 'rotate', 'Rotate', [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']], ch));
    ctls.push(check(fo, L, 'flipH', 'Flip horizontally', ch));
    ctls.push(select(fo, L, 'maxSize', 'Max size', [[1024, '1024 px'], [2048, '2048 px'], [4096, '4096 px']], ch));

    function refreshSources() {
      const vis = Lib.visuals();
      srcSel.innerHTML = '';
      if (!vis.length) srcSel.appendChild(h('option', { value: '', text: '— add or generate an image —' }));
      vis.forEach((i) => srcSel.appendChild(h('option', { value: i.id, text: (i.kind === 'video' ? '🎬 ' : '🖼 ') + i.name })));
      if (!Lib.get(L.src) && vis.length) L.src = vis[vis.length - 1].id;
      srcSel.value = L.src;
      const it = Lib.get(L.src);
      $('#labFrameWrap').hidden = !(it && it.kind === 'video');
    }
    srcSel.addEventListener('change', () => { L.src = srcSel.value; refreshSources(); load(); });
    const frameInp = $('#labFrame');
    frameInp.addEventListener('input', () => { L.frame = frameInp.value / 1000; load(); });

    let base = null; // canvas holding the untouched source frame
    let loadTok = 0;
    async function load() {
      const it = Lib.get(L.src);
      if (!it) { base = null; schedule(); return; }
      const tok = ++loadTok;
      let src = it.el, sw = it.width, sh = it.height;
      if (it.kind === 'video') {
        const v = it.el;
        const t = BS.clamp(L.frame * it.duration, 0, Math.max(0, it.duration - 0.05));
        $('#labFrameVal').textContent = BS.fmtTime(t);
        if (Math.abs(v.currentTime - t) > 0.01) { v.currentTime = t; await BS.waitEvent(v, 'seeked', 3000); }
        if (tok !== loadTok) return;
        src = v; sw = v.videoWidth; sh = v.videoHeight;
      }
      base = BS.makeCanvas(sw, sh);
      base.getContext('2d').drawImage(src, 0, 0, sw, sh);
      schedule();
    }
    function schedule() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; render(); }); }

    function render() {
      if (!base) { cv.width = 1280; cv.height = 720; ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 1280, 720); ctx.fillStyle = '#888'; ctx.font = '28px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Add or generate an image to start editing', 640, 360); return; }
      const rot = L.rotate % 180 !== 0;
      let sw = rot ? base.height : base.width, sh = rot ? base.width : base.height;
      // crop to aspect (cover)
      let cw = sw, chh = sh;
      if (L.aspect !== 'original') { const ar = BS.ASPECTS[L.aspect]; const t = ar[0] / ar[1]; if (sw / sh > t) cw = sh * t; else chh = sw / t; }
      const scale = Math.min(1, L.maxSize / Math.max(cw, chh));
      const W = Math.round(cw * scale), H = Math.round(chh * scale);
      cv.width = W; cv.height = H;
      ctx.save();
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (!compare) ctx.filter = `brightness(${L.brightness}%) contrast(${L.contrast}%) saturate(${L.saturate}%) hue-rotate(${L.hue}deg) sepia(${L.sepia}%) grayscale(${L.grayscale}%)` + (L.blur ? ` blur(${L.blur * scale}px)` : '');
      ctx.translate(W / 2, H / 2);
      ctx.rotate((L.rotate * Math.PI) / 180);
      if (L.flipH) ctx.scale(-1, 1);
      const s = rot ? Math.max(H / base.width, W / base.height) : Math.max(W / base.width, H / base.height);
      ctx.drawImage(base, (-base.width * s) / 2, (-base.height * s) / 2, base.width * s, base.height * s);
      ctx.restore();
      if (compare) return;
      const F = BS.FX, r = BS.rng(L.seed);
      if (L.temp) F.tint(ctx, W, H, L.temp > 0 ? '#ff8a3d' : '#3d8bff', Math.abs(L.temp) * 0.35, 'soft-light');
      if (L.tint) F.tint(ctx, W, H, L.tintColor, L.tint * 0.6, 'color');
      if (L.sharpen) F.sharpen(ctx, W, H, L.sharpen);
      if (L.posterize < 32) F.posterize(ctx, W, H, L.posterize);
      if (L.duotone) F.duotone(ctx, W, H, L.duoA, L.duoB, L.duotone);
      if (L.halftone >= 3) F.halftone(ctx, W, H, Math.round(L.halftone * Math.max(1, W / 1200)));
      if (L.mirror !== 'none') F.mirror(ctx, W, H, L.mirror);
      if (L.pixel >= 2) F.pixelate(ctx, W, H, L.pixel * Math.max(1, W / 1200));
      if (L.glitch) F.glitch(ctx, W, H, L.glitch, r);
      if (L.rgb) F.rgbSplit(ctx, W, H, L.rgb * (W / 1200));
      if (L.invert) F.invert(ctx, W, H, 1);
      if (L.vhs) F.vhs(ctx, W, H, L.vhs, L.seed % 100);
      if (L.scan) F.scanlines(ctx, W, H, L.scan);
      if (L.grain) F.grain(ctx, W, H, L.grain, 0);
      if (L.vignette) F.vignette(ctx, W, H, L.vignette);
      if (L.text) {
        const fonts = { impact: 'Impact, "Arial Black", sans-serif', sans: 'system-ui, "Helvetica Neue", sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, Menlo, monospace' };
        F.caption(ctx, W, H, L.textFont === 'impact' ? L.text.toUpperCase() : L.text, { font: fonts[L.textFont], weight: L.textFont === 'serif' ? 600 : 900, size: L.textSize, y: L.textY, color: L.textColor, glow: L.glow ? L.textColor : null, outline: L.textFont === 'impact' });
      }
    }
    $('#labSave').addEventListener('click', async () => { if (!base) return; const it = Lib.get(L.src); await Lib.addCanvas(cv, 'edit-' + ((it && it.name.replace(/\.\w+$/, '')) || 'image') + '.png'); BS.toast('Saved to library'); });
    $('#labPng').addEventListener('click', async () => { if (base) BS.download(await BS.canvasToBlob(cv, 'image/png'), 'beatforge-edit.png'); });
    $('#labJpg').addEventListener('click', async () => { if (base) BS.download(await BS.canvasToBlob(cv, 'image/jpeg', 0.92), 'beatforge-edit.jpg'); });
    $('#labReset').addEventListener('click', () => { const keep = { src: L.src, frame: L.frame }; Object.assign(L, DEF, keep); ctls.forEach((c) => c.sync && c.sync()); schedule(); });
    const cmp = $('#labCompare');
    const setCmp = (v) => { compare = v; schedule(); };
    cmp.addEventListener('pointerdown', () => setCmp(true));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => cmp.addEventListener(e, () => compare && setCmp(false)));

    function onLibraryChange() { if (activeTab === 'photo') { const had = L.src; refreshSources(); if (had !== L.src || !base) load(); } }
    render();
    return { state: L, refreshSources, load, onLibraryChange };
  })();

  // =====================================================================
  // BEAT SYNC / PMV
  // =====================================================================
  const renderer = new Beat.Renderer($('#bsCanvas'));
  const BeatUI = (function () {
    const S = {
      seed: BS.randomSeed() % 100000, patterns: ['beat', 'eighth'], switchBars: 4, patternOrder: 'random', minSeg: 0.12, maxSeg: 4,
      transitions: ['flash', 'zoomin', 'rgb', 'cut'], transChance: 0.55, transLen: 0.35,
      order: 'shuffle', startMode: 'random', trim: 0.05, stutter: 0.12, speedVariety: false, fit: 'cover',
      grade: 'punchy', grain: 0.15, vhs: 0, vignette: 0.3, letterbox: 0,
      captionText: '', captionTrig: 'beat', captionColor: '#ffffff', title: '', fade: true,
      aspect: '16:9', res: 720, fps: 30, format: 'mp4', rangeStart: 0, rangeEnd: 0, syncMs: 0, bpmOverride: 0, sensitivity: 0.5,
      audioId: '', silentLen: 30,
    };
    const FXS = {};
    Object.entries(Beat.EFFECTS).forEach(([k, d]) => (FXS[k] = { on: false, trig: d.trig, amt: d.amt }));
    FXS.zoom.on = true; FXS.flash.on = true; FXS.flash.amt = 0.3; FXS.rgb.on = true; FXS.rgb.trig = 'kick'; FXS.rgb.amt = 0.4;

    let audio = null; // { item, buffer, an, peaks }
    let plan = null, selSeg = -1;
    const ui = {};
    const rebuildSoon = (() => { let t = null; return () => { clearTimeout(t); t = setTimeout(rebuild, 120); }; })();
    const reanalyzeSoon = (() => { let t = null; return () => { clearTimeout(t); t = setTimeout(() => { analyze(); rebuild(); }, 200); }; })();

    // ---- music ----
    const audioSel = $('#bsAudio');
    function refreshAudioList() {
      audioSel.innerHTML = '';
      audioSel.appendChild(h('option', { value: '', text: '— No music (silent 120 BPM grid) —' }));
      Lib.items.filter((i) => i.kind === 'audio' || i.kind === 'video').forEach((i) => audioSel.appendChild(h('option', { value: i.id, text: (i.kind === 'video' ? '🎬 audio of ' : '♫ ') + i.name })));
      audioSel.value = S.audioId;
    }
    audioSel.addEventListener('change', () => useAudio(audioSel.value));
    $('#bsAudioFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      const it = await Lib.addFile(f);
      if (it) useAudio(it.id);
    });
    async function useAudio(id) {
      S.audioId = id || '';
      refreshAudioList();
      audio = null;
      if (id) {
        const it = Lib.get(id);
        if (!it) return;
        let buf = it.audioBuffer;
        if (!buf) {
          $('#bsAnalysis').textContent = 'Decoding audio…';
          try { buf = it.audioBuffer = await AK.decode(it.blob); } catch (e) { BS.toast('This video has no decodable audio track', 'error'); S.audioId = ''; refreshAudioList(); }
        }
        if (buf) audio = { item: it, buffer: buf, peaks: AK.peaks(buf, 4000) };
      }
      S.rangeStart = 0; S.rangeEnd = 0;
      analyze();
      rebuild();
    }
    function analyze() {
      const box = $('#bsAnalysis');
      let an;
      if (audio) {
        const t0 = performance.now();
        an = AK.analyze(audio.buffer, { sensitivity: S.sensitivity });
        const meta = audio.item.beatMeta;
        if (meta) Object.assign(an, { bpm: meta.bpm, period: meta.period, beats: meta.beats, downbeats: meta.downbeats, onsets: meta.onsets });
        audio.detected = an.bpm;
        console.log('analysis ms', Math.round(performance.now() - t0));
      } else {
        const dur = S.silentLen;
        an = { bpm: 120, period: 0.5, duration: dur, onsets: { all: [], low: [], mid: [], high: [] }, energy: null };
      }
      if (S.bpmOverride > 0 || !audio) {
        const bpm = S.bpmOverride > 0 ? S.bpmOverride : 120;
        const anchor = audio && an.downbeats && an.downbeats.length ? an.downbeats[0] : 0;
        const g = AK.gridFromBpm(bpm, anchor, an.duration);
        an.beats = g.beats; an.downbeats = g.downbeats; an.bpm = bpm; an.period = 60 / bpm;
        if (!audio) { an.onsets = { all: g.beats, low: g.downbeats.concat(g.beats.filter((_, i) => i % 4 === 2)).sort((a, b) => a - b), mid: g.beats.filter((_, i) => i % 2 === 1), high: g.beats.map((t) => t + an.period / 2) }; }
      }
      if (audio) audio.an = an; else audio = null;
      state.an = an;
      box.innerHTML = audio
        ? `<b>${an.bpm.toFixed(1)} BPM</b> · ${an.beats.length} beats · ${an.onsets.low.length} kicks · ${an.onsets.mid.length} snares · ${BS.fmtTime(an.duration)}${audio.item.beatMeta ? ' · <b>exact grid</b>' : ''}`
        : `Silent mode: <b>${an.bpm} BPM</b> grid, ${S.silentLen}s. Upload a song or generate a beat for real sync.`;
      ui.rangeEnd && (ui.rangeEnd.querySelector('input').max = Math.ceil(an.duration));
    }
    const state = { an: null };

    // beat maker
    const BM = { genre: 'house', bpm: 0, bars: 16, structure: 'drop', seed: 1 };
    const bmo = $('#bmOpts');
    select(bmo, BM, 'genre', 'Genre', Object.entries(AK.GENRES).map(([k, g]) => [k, `${g.name} (${g.bpm})`]));
    const bt = two(bmo);
    text(bt, BM, 'bpm', 'BPM (0 = genre default)', '0', null, 'number');
    select(bt, BM, 'bars', 'Length', [[8, '8 bars'], [16, '16 bars'], [32, '32 bars'], [64, '64 bars']]);
    select(bmo, BM, 'structure', 'Structure', [['drop', 'Intro → build-up → drop'], ['loop', 'Straight loop with fills']]);
    $('#bmBtn').addEventListener('click', async () => {
      const btn = $('#bmBtn'); btn.disabled = true; btn.textContent = 'Synthesising…';
      try {
        const res = await AK.renderBeat({ genre: BM.genre, bpm: BM.bpm || 0, bars: BM.bars, structure: BM.structure, seed: BS.randomSeed() });
        const blob = AK.encodeWav(res.buffer);
        const it = await Lib.addBlob(blob, `${res.genre.toLowerCase().replace(/\W+/g, '-')}-${Math.round(res.bpm)}bpm.wav`, 'audio', { beatMeta: res });
        if (it) await useAudio(it.id);
        BS.toast(`Generated a ${res.genre} beat at ${Math.round(res.bpm)} BPM`);
      } catch (e) { console.error(e); BS.toast('Beat generation failed: ' + e.message, 'error'); }
      finally { btn.disabled = false; btn.textContent = 'Generate beat'; }
    });

    const so = $('#bsSyncOpts');
    const st2 = two(so);
    ui.bpm = text(st2, S, 'bpmOverride', 'Force BPM (0 = auto)', '0', reanalyzeSoon, 'number');
    ui.sync = slider(st2, S, 'syncMs', 'Sync nudge', -200, 200, 5, () => { renderer.syncOffset = S.syncMs / 1000; }, (v) => v + 'ms');
    ui.sens = slider(so, S, 'sensitivity', 'Hit detection sensitivity', 0, 1, 0.05, reanalyzeSoon);

    // ---- presets ----
    const pr = $('#bsPresets');
    Object.entries(Beat.PRESETS).forEach(([k, p]) => pr.appendChild(h('button', { class: 'chip', text: p.name, onclick: () => applyPreset(k) })));
    function applyPreset(k) {
      const p = Beat.PRESETS[k];
      S.patterns.splice(0, S.patterns.length, ...p.patterns);
      S.transitions.splice(0, S.transitions.length, ...p.transitions);
      ['switchBars', 'transChance', 'transLen', 'grade', 'stutter', 'speedVariety', 'grain', 'vhs', 'letterbox', 'vignette'].forEach((key) => (S[key] = p[key]));
      Object.keys(FXS).forEach((e) => (FXS[e].on = false));
      Object.entries(p.effects).forEach(([e, [trig, amt]]) => Object.assign(FXS[e], { on: true, trig, amt }));
      syncAll();
      rebuild();
      BS.toast('Preset: ' + p.name);
    }

    // ---- clips ----
    const co = $('#bsClipOpts');
    const ct = two(co);
    ui.order = select(ct, S, 'order', 'Clip order', [['shuffle', 'Shuffle (no repeats)'], ['random', 'Random'], ['sequential', 'In library order']], rebuildSoon);
    ui.startMode = select(ct, S, 'startMode', 'Clip start points', [['random', 'Random moments'], ['forward', 'Forward, skipping'], ['continuous', 'Continuous']], rebuildSoon);
    ui.fit = select(co, S, 'fit', 'Fit', [['cover', 'Fill frame (crop)'], ['contain', 'Fit whole clip (blurred bg)']], rebuildSoon);
    ui.trim = slider(co, S, 'trim', 'Skip clip intros/outros', 0, 0.3, 0.01, rebuildSoon, (v) => Math.round(v * 100) + '%');
    ui.stutter = slider(co, S, 'stutter', 'Stutter / repeat-cut chance', 0, 0.8, 0.01, rebuildSoon, (v) => Math.round(v * 100) + '%');
    ui.speed = check(co, S, 'speedVariety', 'Random speed ramps (slow-mo / 2×)', rebuildSoon);

    // ---- rhythm ----
    ui.patterns = chips($('#bsPatterns'), Beat.PATTERNS, S.patterns, rebuildSoon);
    const ro = $('#bsRhythmOpts');
    const rt = two(ro);
    ui.switchBars = select(rt, S, 'switchBars', 'Mix patterns every', [[1, '1 bar'], [2, '2 bars'], [4, '4 bars'], [8, '8 bars'], [16, '16 bars']], rebuildSoon);
    ui.patternOrder = select(rt, S, 'patternOrder', 'Mix order', [['random', 'Random'], ['cycle', 'Cycle in order']], rebuildSoon);
    ui.minSeg = slider(ro, S, 'minSeg', 'Shortest cut', 0.05, 1, 0.01, rebuildSoon, (v) => Math.round(v * 1000) + 'ms');
    ui.maxSeg = slider(ro, S, 'maxSeg', 'Longest cut (0 = no limit)', 0, 12, 0.5, rebuildSoon, (v) => (v ? v + 's' : 'off'));

    // ---- transitions ----
    const trOpts = {}; Object.entries(Beat.TRANSITIONS).forEach(([k, d]) => (trOpts[k] = d.name));
    ui.trans = chips($('#bsTrans'), trOpts, S.transitions, rebuildSoon);
    const to = $('#bsTransOpts');
    ui.transChance = slider(to, S, 'transChance', 'Transition frequency', 0, 1, 0.01, rebuildSoon, (v) => Math.round(v * 100) + '%');
    ui.transLen = slider(to, S, 'transLen', 'Transition length', 0.1, 2, 0.05, rebuildSoon, (v) => (+v).toFixed(2) + ' beats');

    // ---- effects ----
    const fxBox = $('#bsFx');
    const fxRows = [];
    Object.entries(Beat.EFFECTS).forEach(([k, d]) => {
      const st = FXS[k];
      const cb = h('input', { type: 'checkbox' });
      const trig = h('select');
      Object.entries(Beat.TRIGGERS).forEach(([tk, tl]) => trig.appendChild(h('option', { value: tk, text: tl })));
      const amt = h('input', { type: 'range', min: 0, max: 1, step: 0.01 });
      const row = h('div', { class: 'fx-row' }, [cb, h('span', { text: d.name }), trig, amt]);
      const sync = () => { cb.checked = st.on; trig.value = st.trig; amt.value = st.amt; row.classList.toggle('off', !st.on); };
      cb.addEventListener('change', () => { st.on = cb.checked; sync(); applyLive(); });
      trig.addEventListener('change', () => { st.trig = trig.value; applyLive(); });
      amt.addEventListener('input', () => { st.amt = +amt.value; applyLive(); });
      sync(); fxRows.push(sync);
      fxBox.appendChild(row);
    });

    // ---- look ----
    const lo = $('#bsLook');
    ui.grade = select(lo, S, 'grade', 'Color grade', Object.entries(Beat.GRADES).map(([k, g]) => [k, g.name]), applyLive);
    const lt = two(lo);
    ui.grain = slider(lt, S, 'grain', 'Grain', 0, 1, 0.01, applyLive);
    ui.vhs = slider(lt, S, 'vhs', 'VHS', 0, 1, 0.01, applyLive);
    ui.vignette = slider(lt, S, 'vignette', 'Vignette', 0, 1, 0.01, applyLive);
    ui.letterbox = slider(lt, S, 'letterbox', 'Letterbox', 0, 0.2, 0.005, applyLive);
    ui.caption = text(lo, S, 'captionText', 'Beat words (comma separated, flash on each hit)', 'e.g. ONE, TWO, DROP, IT', applyLive);
    const lc = h('div', { class: 'row' }); lo.appendChild(lc);
    ui.capTrig = select(lc, S, 'captionTrig', null, Object.entries(Beat.TRIGGERS), applyLive);
    ui.capColor = color(lc, S, 'captionColor', 'color', applyLive);
    ui.title = text(lo, S, 'title', 'Intro title', 'optional', applyLive);
    ui.fade = check(lo, S, 'fade', 'Fade in / out', applyLive);

    // ---- output ----
    const oo = $('#bsOut');
    const ot = two(oo);
    ui.aspect = select(ot, S, 'aspect', 'Aspect', [['16:9', '16:9 YouTube'], ['9:16', '9:16 TikTok/Reels'], ['1:1', '1:1 Square'], ['4:5', '4:5 Feed'], ['21:9', '21:9 Cinema']], rebuildSoon);
    ui.res = select(ot, S, 'res', 'Resolution', [[480, '480p'], [720, '720p'], [1080, '1080p']], rebuildSoon);
    const ot2 = two(oo);
    ui.fps = select(ot2, S, 'fps', 'FPS', [[24, '24'], [30, '30'], [60, '60']]);
    ui.format = select(ot2, S, 'format', 'Format', [['mp4', 'MP4 (if supported)'], ['webm', 'WebM']]);
    const ot3 = two(oo);
    ui.rangeStart = text(ot3, S, 'rangeStart', 'Start at (s)', '0', rebuildSoon, 'number');
    ui.rangeEnd = text(ot3, S, 'rangeEnd', 'End at (s, 0 = end)', '0', rebuildSoon, 'number');
    ui.silentLen = slider(oo, S, 'silentLen', 'Length when no music', 5, 120, 1, () => { if (!audio) { analyze(); rebuildSoon(); } }, (v) => v + 's');

    function syncAll() {
      Object.values(ui).forEach((c) => c && c.sync && c.sync());
      fxRows.forEach((f) => f());
    }

    function settings() {
      const effects = {};
      Object.entries(FXS).forEach(([k, v]) => { if (v.on && v.amt > 0) effects[k] = { trig: v.trig, amt: v.amt }; });
      return Object.assign({}, S, {
        effects, start: +S.rangeStart || 0, end: +S.rangeEnd || 0,
        captionWords: S.captionText.split(',').map((w) => w.trim()).filter(Boolean),
      });
    }
    function applyLive() {
      // look/effect changes don't need a new cut plan — just update the renderer
      if (!plan) return;
      renderer.S = settings();
      if (!renderer.playing) renderer.drawFrame(renderer.t);
    }

    function visuals() { return Lib.visuals().filter((i) => i.selected); }
    function rebuild() {
      if (activeTab !== 'beat' || renderer.exporting) return;
      const vis = visuals();
      $('#bsClipInfo').textContent = vis.length
        ? `${vis.length} clip${vis.length > 1 ? 's' : ''} selected (${vis.filter((v) => v.kind === 'video').length} videos, ${vis.filter((v) => v.kind === 'image').length} images). Click items in the library to toggle.`
        : 'No clips selected — add videos/images to the library (or generate some in Create) and click them to select.';
      if (!state.an) analyze();
      const ov = $('#bsOverlay');
      $('#bsSeed').value = S.seed;
      if (!vis.length) { ov.style.display = ''; ov.textContent = 'Select some clips in the library to build your edit'; plan = null; renderer.stop(); updatePlayBtn(); drawTl(); return; }
      ov.style.display = 'none';
      const set = settings();
      const wasPlaying = renderer.playing, t = renderer.t;
      plan = Beat.buildPlan(state.an, vis, set);
      const [w, hh] = BS.sizeFor(S.aspect, S.res === 1080 ? 1920 : S.res === 480 ? 854 : 1280);
      renderer.setSize(w, hh);
      renderer.syncOffset = S.syncMs / 1000;
      renderer.load(plan, set, audio ? audio.buffer : null);
      renderer.releaseUnused();
      if (selSeg >= plan.segments.length) selSeg = -1;
      const tt = BS.clamp(t, plan.start, plan.end);
      if (wasPlaying) renderer.play(tt); else renderer.seek(tt);
      updatePlayBtn();
      $('#bsSegInfo').textContent = `${plan.segments.length} cuts · avg ${(((plan.end - plan.start) / Math.max(1, plan.segments.length)) * 1000).toFixed(0)} ms · ${plan.segments.filter((s) => s.trans.type !== 'cut').length} transitions`;
      drawTl();
    }

    // ---- transport & timeline ----
    const tl = $('#bsTimeline');
    function view() {
      const dur = state.an ? state.an.duration : 1;
      if (!$('#bsZoomTl').checked) return [0, dur];
      const win = Math.min(dur, 16), c = renderer.t;
      const v0 = BS.clamp(c - win * 0.3, 0, Math.max(0, dur - win));
      return [v0, v0 + win];
    }
    function drawTl() {
      const [v0, v1] = view();
      Beat.drawTimeline(tl, { peaks: audio && audio.peaks, duration: state.an ? state.an.duration : 0, an: state.an, plan, t: renderer.t, sel: selSeg, v0, v1, showOnsets: true });
    }
    $('#bsZoomTl').addEventListener('change', drawTl);
    window.addEventListener('resize', () => activeTab === 'beat' && drawTl());
    renderer.onTime = (t) => {
      $('#bsTime').textContent = `${BS.fmtTime(t)} / ${BS.fmtTime(plan ? plan.end : 0)}`;
      drawTl();
    };
    renderer.onEnd = () => updatePlayBtn();
    tl.addEventListener('click', (e) => {
      if (!plan) return;
      const rect = tl.getBoundingClientRect();
      const [v0, v1] = view();
      const t = v0 + ((e.clientX - rect.left) / rect.width) * (v1 - v0);
      if (e.clientY - rect.top < rect.height * 0.32) {
        selSeg = renderer.segIndexAt(t);
        const s = plan.segments[selSeg];
        const it = Lib.get(s.src);
        $('#bsSegInfo').textContent = `Cut #${selSeg + 1}: ${it ? it.name : '?'} · ${((s.end - s.start) * 1000).toFixed(0)} ms · in: ${Beat.TRANSITIONS[s.trans.type].name}${s.speed !== 1 ? ' · ' + s.speed + '×' : ''}${s.stutter ? ' · stutter' : ''}`;
        $('#bsSegReroll').disabled = false;
        renderer.seek(s.start + 0.001);
      } else renderer.seek(t);
      drawTl();
    });
    $('#bsSegReroll').addEventListener('click', () => {
      if (!plan || selSeg < 0) return;
      Beat.rerollSegment(plan, selSeg, visuals(), BS.randomSeed());
      renderer.load(plan, settings(), audio ? audio.buffer : null);
      renderer.seek(plan.segments[selSeg].start + 0.001);
      drawTl();
    });
    $('#bsPlay').addEventListener('click', () => {
      if (!plan) { BS.toast('Select some clips in the library first'); return; }
      if (renderer.playing) renderer.stop(); else renderer.play(renderer.t);
      setTimeout(updatePlayBtn, 0);
    });
    document.addEventListener('keydown', (e) => {
      if (activeTab !== 'beat' || e.target.matches('input, textarea, select')) return;
      if (e.code === 'Space') { e.preventDefault(); $('#bsPlay').click(); }
      if (e.key === 'r') $('#bsReroll').click();
    });
    $('#bsReroll').addEventListener('click', () => { S.seed = BS.randomSeed() % 100000; rebuild(); });
    $('#bsSeed').addEventListener('change', (e) => { S.seed = +e.target.value || 0; rebuild(); });

    $('#bsExport').addEventListener('click', async () => {
      if (!plan) { BS.toast('Nothing to export yet', 'error'); return; }
      if (renderer.exporting) { if (renderer.cancelExport) renderer.cancelExport(); return; }
      const btn = $('#bsExport'), prog = $('#bsProg');
      btn.textContent = '■ Cancel export';
      progress(prog, 0);
      BS.toast('Recording in real time — keep this tab visible until it finishes.');
      try {
        const { blob, ext } = await renderer.exportVideo({ fps: S.fps, format: S.format, bitrate: S.res >= 1080 ? 16e6 : 10e6, onProgress: (p) => progress(prog, p) });
        if (!blob.size) throw new Error('recording produced no data');
        const name = `beatforge-${S.seed}.${ext}`;
        const url = URL.createObjectURL(blob);
        const box = $('#bsResult'); box.innerHTML = '';
        box.appendChild(h('video', { src: url, controls: true, playsinline: true }));
        box.appendChild(h('div', { class: 'row' }, [
          h('button', { class: 'btn primary', text: `⬇ Download ${ext.toUpperCase()} (${(blob.size / 1048576).toFixed(1)} MB)`, onclick: () => BS.download(blob, name) }),
          h('button', { class: 'btn', text: '⤓ Add to library', onclick: async () => { await Lib.addBlob(blob, name, 'video', { duration: plan.end - plan.start }); BS.toast('Added to library'); } }),
        ]));
        BS.toast('Export finished ✓');
      } catch (e) { console.error(e); BS.toast('Export failed: ' + e.message, 'error'); }
      finally { btn.textContent = '⬇ Export video'; progress(prog, null); updatePlayBtn(); }
    });

    function onLibraryChange() {
      refreshAudioList();
      if (S.audioId && !Lib.get(S.audioId)) useAudio('');
      else if (activeTab === 'beat') rebuildSoon();
    }
    refreshAudioList();
    return { refreshAudioList, useAudio, rebuild, onLibraryChange, settings, get plan() { return plan; }, S, FXS };
  })();
  function updatePlayBtn() { $('#bsPlay').textContent = renderer.playing ? '❚❚ Pause' : '▶ Play'; }

  // =====================================================================
  // demo content: procedural stills + a generated beat, instantly
  // =====================================================================
  $('#demoBtn').addEventListener('click', async () => {
    const btn = $('#demoBtn'); btn.disabled = true; btn.textContent = 'Creating demo…';
    try {
      const prompts = ['neon synthwave sunset', 'cosmic nebula purple gold', 'night city cyberpunk', 'psychedelic kaleidoscope', 'hyperspace tunnel vortex', 'stained glass crystal', 'aurora glow pastel', 'fire flow field'];
      for (const p of prompts) {
        const a = Gen.analyzePrompt(p);
        const c = BS.makeCanvas(1280, 720);
        Gen.render(c.getContext('2d'), 1280, 720, { style: a.style, palette: a.palette, seed: a.seed, still: true, grain: 0.1, vignette: 0.3 });
        await Lib.addCanvas(c, a.style + '.png');
        await BS.nextFrame();
      }
      const res = await AK.renderBeat({ genre: 'house', bars: 16, structure: 'drop', seed: 42 });
      const it = await Lib.addBlob(AK.encodeWav(res.buffer), 'demo-house-124bpm.wav', 'audio', { beatMeta: res });
      switchTab('beat');
      await BeatUI.useAudio(it.id);
      BS.toast('Demo ready — press ▶ Play');
    } finally { btn.disabled = false; btn.textContent = '✨ Demo'; }
  });

  renderLibrary();
  Create.onLibraryChange();
  // expose for debugging / tests
  BS.App = { Create, Lab, BeatUI, renderer, switchTab };
})();
