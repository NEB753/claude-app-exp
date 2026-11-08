/* Beat Sync / PMV engine: turns music + clips into a beat-cut edit, then renders it live
   (preview) or records it (export) with transitions and on-beat effects. */
(function () {
  'use strict';
  const BS = window.BS;
  const FX = () => BS.FX;

  // ---------------------------------------------------------------- catalogs
  const PATTERNS = {
    beat: 'Every beat', half: 'Every 2 beats', bar: 'Every bar', bar2: 'Every 2 bars',
    eighth: '8th notes', sixteenth: '16th notes (frenzy)', triplet: 'Triplets', offbeat: 'Off-beats',
    tresillo: 'Tresillo 3-3-2', kick: 'Kick drum hits', snare: 'Snare / clap hits', hats: 'Hi-hat hits',
    onsets: 'Every detected hit', buildup: 'Build-up (accelerate)', energy: 'Follow the energy',
    random: 'Random rhythm', none: 'No cuts (FX only)',
  };

  const TRANSITIONS = {
    cut: { name: 'Hard cut', pre: 0 },
    flash: { name: 'White flash', pre: 0 },
    dip: { name: 'Dip to black', pre: 0.5 },
    crossfade: { name: 'Crossfade', pre: 0.5 },
    zoomin: { name: 'Zoom punch in', pre: 0.5 },
    zoomout: { name: 'Zoom pull out', pre: 0.3 },
    whip: { name: 'Whip pan', pre: 0.5 },
    whipup: { name: 'Whip up', pre: 0.5 },
    spin: { name: 'Spin', pre: 0.5 },
    glitch: { name: 'Glitch', pre: 0.4 },
    rgb: { name: 'RGB split hit', pre: 0 },
    blur: { name: 'Blur through', pre: 0.5 },
    strobe: { name: 'Strobe swap', pre: 0.5 },
    pixel: { name: 'Pixelate', pre: 0.5 },
    wipe: { name: 'Diagonal wipe', pre: 0.5 },
    iris: { name: 'Iris reveal', pre: 0.2 },
    shake: { name: 'Impact shake', pre: 0 },
    burn: { name: 'Film burn', pre: 0.5 },
  };

  const EFFECTS = {
    zoom: { name: 'Zoom pulse', trig: 'beat', amt: 0.5 },
    shake: { name: 'Camera shake', trig: 'kick', amt: 0.4 },
    flash: { name: 'Flash', trig: 'snare', amt: 0.35 },
    rgb: { name: 'RGB split', trig: 'beat', amt: 0.5 },
    glitch: { name: 'Glitch slices', trig: 'snare', amt: 0.5 },
    invert: { name: 'Invert blink', trig: 'bar', amt: 0.6 },
    strobe: { name: 'Strobe', trig: 'bar', amt: 0.5 },
    hue: { name: 'Hue jump', trig: 'beat', amt: 0.4 },
    blur: { name: 'Blur pulse', trig: 'kick', amt: 0.4 },
    vignette: { name: 'Vignette pump', trig: 'kick', amt: 0.5 },
    mirror: { name: 'Mirror flip', trig: 'bar', amt: 1 },
    pixel: { name: 'Pixel hit', trig: 'snare', amt: 0.4 },
    tilt: { name: 'Tilt kick', trig: 'beat', amt: 0.4 },
  };
  const TRIGGERS = { beat: 'Beats', offbeat: 'Off-beats', bar: 'Bars', kick: 'Kick', snare: 'Snare', hats: 'Hi-hats', onset: 'Any hit', cut: 'On cuts' };

  const GRADES = {
    none: { name: 'None', f: '' },
    punchy: { name: 'Punchy', f: 'contrast(1.25) saturate(1.3)' },
    warm: { name: 'Warm', f: 'sepia(0.25) saturate(1.3) contrast(1.05)' },
    cool: { name: 'Cool', f: 'hue-rotate(-12deg) saturate(1.1) brightness(1.03)' },
    neon: { name: 'Neon', f: 'saturate(1.9) contrast(1.15)' },
    vintage: { name: 'Vintage', f: 'sepia(0.45) contrast(0.95) brightness(1.05) saturate(0.85)' },
    bw: { name: 'B&W', f: 'grayscale(1) contrast(1.2)' },
    noir: { name: 'Noir', f: 'grayscale(1) contrast(1.6) brightness(0.9)' },
    dream: { name: 'Dreamy', f: 'brightness(1.08) saturate(1.25) contrast(0.92)' },
  };

  const PRESETS = {
    classic: { name: 'Classic PMV', patterns: ['beat', 'eighth'], switchBars: 4, transitions: ['flash', 'zoomin', 'rgb', 'cut'], transChance: 0.55, transLen: 0.35,
      effects: { zoom: ['beat', 0.5], flash: ['snare', 0.3], rgb: ['kick', 0.4] }, grade: 'punchy', stutter: 0.12, speedVariety: false, grain: 0.15, vhs: 0, letterbox: 0, vignette: 0.3 },
    hype: { name: 'Hype edit', patterns: ['buildup', 'energy', 'sixteenth'], switchBars: 8, transitions: ['zoomin', 'whip', 'glitch', 'spin', 'flash', 'shake'], transChance: 0.7, transLen: 0.5,
      effects: { zoom: ['beat', 0.6], shake: ['kick', 0.6], glitch: ['snare', 0.5], strobe: ['bar', 0.4], rgb: ['onset', 0.5] }, grade: 'neon', stutter: 0.2, speedVariety: true, grain: 0.1, vhs: 0, letterbox: 0, vignette: 0.35 },
    chill: { name: 'Chill montage', patterns: ['bar', 'half'], switchBars: 8, transitions: ['crossfade', 'burn', 'blur', 'dip'], transChance: 0.9, transLen: 1.2,
      effects: { vignette: ['kick', 0.3] }, grade: 'warm', stutter: 0, speedVariety: false, grain: 0.3, vhs: 0, letterbox: 0.1, vignette: 0.4 },
    trap: { name: 'Trap / phonk', patterns: ['kick', 'snare', 'beat'], switchBars: 4, transitions: ['shake', 'rgb', 'flash', 'zoomin', 'cut'], transChance: 0.6, transLen: 0.3,
      effects: { shake: ['kick', 0.7], invert: ['snare', 0.5], rgb: ['beat', 0.6], tilt: ['snare', 0.5] }, grade: 'noir', stutter: 0.25, speedVariety: true, grain: 0.25, vhs: 0.3, letterbox: 0, vignette: 0.5 },
    glitch: { name: 'Glitchcore', patterns: ['onsets', 'sixteenth', 'random'], switchBars: 2, transitions: ['glitch', 'pixel', 'strobe', 'rgb'], transChance: 0.8, transLen: 0.4,
      effects: { glitch: ['onset', 0.6], rgb: ['beat', 0.8], pixel: ['snare', 0.5], hue: ['bar', 0.6], mirror: ['bar', 1] }, grade: 'neon', stutter: 0.3, speedVariety: true, grain: 0.2, vhs: 0.6, letterbox: 0, vignette: 0.2 },
    cinematic: { name: 'Cinematic trailer', patterns: ['bar', 'beat', 'buildup'], switchBars: 8, transitions: ['dip', 'flash', 'zoomin', 'crossfade'], transChance: 0.7, transLen: 0.6,
      effects: { zoom: ['kick', 0.35], flash: ['bar', 0.4] }, grade: 'cool', stutter: 0.05, speedVariety: false, grain: 0.2, vhs: 0, letterbox: 0.12, vignette: 0.45 },
  };

  // ---------------------------------------------------------------- planning
  function metricGrid(an, period) {
    // 16th-note grid with metric levels: 0 bar, 1 half-bar, 2 beat, 3 eighth, 4 sixteenth
    const beats = an.beats, downs = an.downbeats || [];
    const isDown = new Set(downs.map((d) => Math.round(d * 1000)));
    const grid = [];
    let pos = 0, bar = -1;
    for (let i = 0; i < beats.length; i++) {
      if (isDown.has(Math.round(beats[i] * 1000))) { pos = 0; bar++; } else pos++;
      if (bar < 0) bar = 0;
      const nb = i + 1 < beats.length ? beats[i + 1] : beats[i] + period;
      for (let k = 0; k < 4; k++) {
        const lvl = k === 0 ? (pos % 4 === 0 ? 0 : pos % 2 === 0 ? 1 : 2) : k === 2 ? 3 : 4;
        grid.push({ t: beats[i] + (k * (nb - beats[i])) / 4, lvl, bar, pos });
      }
    }
    return grid;
  }

  function buildPlan(an, sources, S) {
    const r = BS.rng(S.seed >>> 0);
    const start = BS.clamp(S.start || 0, 0, an.duration - 0.5);
    const end = BS.clamp(S.end > 0 ? S.end : an.duration, start + 0.5, an.duration);
    const period = an.period || 60 / an.bpm;
    const grid = metricGrid(an, period);
    let downs = an.downbeats && an.downbeats.length ? an.downbeats : an.beats.filter((_, i) => i % 4 === 0);
    const pats = S.patterns && S.patterns.length ? S.patterns : ['beat'];
    const switchBars = Math.max(1, S.switchBars || 4);

    // phrases
    const bounds = [start];
    for (let i = 0; i < downs.length; i += switchBars) if (downs[i] > start + 0.05 && downs[i] < end - 0.05) bounds.push(downs[i]);
    bounds.push(end);
    const phrases = [];
    let cuts = [start];
    const inR = (arr, a, b) => arr.filter((t) => t >= a - 1e-3 && t < b - 1e-3);
    const levelCut = (a, b, maxLvl, extra) => grid.filter((g) => g.t >= a - 1e-3 && g.t < b - 1e-3 && g.lvl <= maxLvl && (!extra || extra(g))).map((g) => g.t);
    for (let k = 0; k < bounds.length - 1; k++) {
      const a = bounds[k], b = bounds[k + 1];
      const pat = S.patternOrder === 'cycle' ? pats[k % pats.length] : r.pick(pats);
      phrases.push({ a, b, pat });
      let c = [];
      switch (pat) {
        case 'beat': c = levelCut(a, b, 2); break;
        case 'half': c = levelCut(a, b, 1); break;
        case 'bar': c = levelCut(a, b, 0); break;
        case 'bar2': c = levelCut(a, b, 0, (g) => g.bar % 2 === 0); break;
        case 'eighth': c = levelCut(a, b, 3); break;
        case 'sixteenth': c = levelCut(a, b, 4); break;
        case 'offbeat': c = [a].concat(grid.filter((g) => g.t >= a && g.t < b && g.lvl === 3).map((g) => g.t)); break;
        case 'triplet': {
          for (let i = 0; i < an.beats.length; i++) {
            const t0 = an.beats[i], nb = an.beats[i + 1] || t0 + period;
            for (let q = 0; q < 3; q++) { const t = t0 + (q * (nb - t0)) / 3; if (t >= a && t < b) c.push(t); }
          }
          break;
        }
        case 'tresillo': {
          const ds = inR(downs, a, b);
          ds.forEach((d, i) => {
            const nd = downs[downs.indexOf(d) + 1] || d + 4 * period;
            [0, 3 / 8, 6 / 8].forEach((f) => { const t = d + f * (nd - d); if (t < b) c.push(t); });
            void i;
          });
          c.unshift(a);
          break;
        }
        case 'kick': c = [a].concat(inR(an.onsets.low, a, b)); break;
        case 'snare': c = [a].concat(inR(an.onsets.mid, a, b)); break;
        case 'hats': c = [a].concat(inR(an.onsets.high, a, b)); break;
        case 'onsets': c = [a].concat(inR(an.onsets.all, a, b)); break;
        case 'buildup': {
          c = grid.filter((g) => g.t >= a - 1e-3 && g.t < b - 1e-3).filter((g) => {
            const f = (g.t - a) / (b - a);
            const allow = f < 0.25 ? 0 : f < 0.5 ? 1 : f < 0.75 ? 2 : f < 0.9 ? 3 : 4;
            return g.lvl <= allow;
          }).map((g) => g.t);
          break;
        }
        case 'energy': {
          c = grid.filter((g) => g.t >= a - 1e-3 && g.t < b - 1e-3).filter((g) => {
            const e = BS.AudioKit.energyAt(an, g.t);
            const allow = e > 0.85 ? 3 : e > 0.55 ? 2 : e > 0.3 ? 1 : 0;
            return g.lvl <= allow;
          }).map((g) => g.t);
          break;
        }
        case 'random': {
          const eighths = grid.filter((g) => g.t >= a - 1e-3 && g.t < b - 1e-3 && g.lvl <= 3);
          for (let i = 0; i < eighths.length;) { c.push(eighths[i].t); i += r.pick([1, 2, 2, 4, 4, 8]); }
          break;
        }
        case 'none': default: c = []; break;
      }
      cuts = cuts.concat(c);
    }
    cuts = cuts.filter((t) => t >= start && t < end).sort((x, y) => x - y);
    // spacing rules
    const minSeg = Math.max(0.05, S.minSeg || 0.12);
    const kept = [];
    for (const t of cuts) if (!kept.length || t - kept[kept.length - 1] >= minSeg) kept.push(t);
    while (kept.length > 1 && end - kept[kept.length - 1] < minSeg) kept.pop();
    if (S.maxSeg > 0 && !pats.every((p) => p === 'none')) {
      for (let i = 0; i < kept.length; i++) {
        const a = kept[i], b = i + 1 < kept.length ? kept[i + 1] : end;
        if (b - a > S.maxSeg) {
          const fill = an.beats.find((t) => t > a + S.maxSeg * 0.5 && t < b - minSeg);
          kept.splice(i + 1, 0, fill != null ? fill : a + S.maxSeg);
        }
      }
    }

    // assign sources
    const vis = sources.filter((s) => s && (s.kind === 'image' || s.kind === 'video'));
    const segs = [];
    let bag = [], seqI = 0;
    const cursors = {};
    const pickSource = (prev) => {
      if (!vis.length) return null;
      if (vis.length === 1) return vis[0];
      if (S.order === 'sequential') return vis[seqI++ % vis.length];
      if (S.order === 'shuffle') {
        if (!bag.length) {
          bag = vis.slice();
          for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp; }
          if (prev && bag[bag.length - 1] === prev) bag.unshift(bag.pop());
        }
        return bag.pop();
      }
      let s; let guard = 0;
      do { s = r.pick(vis); } while (prev && s === prev && guard++ < 10);
      return s;
    };
    for (let i = 0; i < kept.length; i++) {
      const a = kept[i], b = i + 1 < kept.length ? kept[i + 1] : end, len = b - a;
      const prev = segs[segs.length - 1];
      let seg;
      if (prev && prev.kind === 'video' && S.stutter > 0 && len <= period * 1.05 && r.chance(S.stutter)) {
        seg = { start: a, end: b, src: prev.src, kind: prev.kind, srcStart: prev.srcStart, speed: prev.speed, stutter: true, kb: prev.kb };
      } else {
        const item = pickSource(prev ? BS.Library.get(prev.src) || vis.find((v) => v.id === prev.src) : null);
        if (!item) break;
        seg = { start: a, end: b, src: item.id, kind: item.kind, speed: 1, srcStart: 0 };
        if (item.kind === 'video') {
          const dur = Math.max(0.1, item.duration || 1);
          seg.speed = S.speedVariety ? r.pick([0.5, 0.75, 1, 1, 1, 1.25, 1.5, 2]) : 1;
          const need = len * seg.speed;
          let lo = dur * (S.trim || 0), hi = dur * (1 - (S.trim || 0)) - need;
          if (hi < lo) { lo = 0; hi = Math.max(0, dur - need); }
          if (S.startMode === 'continuous' || S.startMode === 'forward') {
            let cur = cursors[item.id];
            if (cur == null) cur = S.startMode === 'continuous' ? lo : lo + r() * (hi - lo) * 0.25;
            if (cur > hi) cur = lo;
            seg.srcStart = cur;
            cursors[item.id] = cur + need * (S.startMode === 'continuous' ? 1 : 1 + r.range(0.2, 2));
          } else seg.srcStart = r.range(lo, Math.max(lo, hi));
        } else {
          const s0 = r.range(1.02, 1.12), s1 = BS.clamp(s0 + r.sign() * r.range(0.06, 0.18), 1.0, 1.35);
          seg.kb = { s0, s1, x0: r.range(-0.04, 0.04), y0: r.range(-0.04, 0.04), x1: r.range(-0.04, 0.04), y1: r.range(-0.04, 0.04) };
        }
      }
      // transition into this segment
      let type = 'cut';
      if (i > 0 && S.transitions && S.transitions.length && r.chance(S.transChance == null ? 0.5 : S.transChance)) type = r.pick(S.transitions);
      if (seg.stutter && type !== 'cut') type = r.chance(0.5) ? 'flash' : 'cut';
      let dur = type === 'cut' ? 0 : (S.transLen || 0.3) * period;
      const def = TRANSITIONS[type] || TRANSITIONS.cut;
      if (dur > 0 && prev) {
        const prevLen = prev.end - prev.start;
        let pre = dur * def.pre, post = dur - pre;
        const k = Math.min(1, pre > 0 ? (prevLen * 0.45) / pre : 1, post > 0 ? (len * 0.45) / post : 1);
        pre *= k; post *= k; dur = pre + post;
        seg.trans = { type, dur, pre, post };
        if (dur < 0.02) seg.trans = { type: 'cut', dur: 0, pre: 0, post: 0 };
      } else seg.trans = { type: 'cut', dur: 0, pre: 0, post: 0 };
      segs.push(seg);
    }

    const span = (arr) => arr.filter((t) => t >= start - 0.01 && t <= end);
    const triggers = {
      beat: span(an.beats), bar: span(downs), offbeat: span(an.beats.map((t, i) => t + ((an.beats[i + 1] || t + period) - t) / 2)),
      kick: span(an.onsets.low), snare: span(an.onsets.mid), hats: span(an.onsets.high), onset: span(an.onsets.all),
      cut: segs.map((s) => s.start),
    };
    return { start, end, period, bpm: an.bpm, segments: segs, triggers, phrases };
  }

  /** Re-roll one segment's source / start point in place. */
  function rerollSegment(plan, idx, sources, seed) {
    const r = BS.rng(seed >>> 0);
    const seg = plan.segments[idx];
    const vis = sources.filter((s) => s.kind === 'image' || s.kind === 'video');
    if (!seg || !vis.length) return;
    let item = r.pick(vis), guard = 0;
    while (vis.length > 1 && item.id === seg.src && guard++ < 10) item = r.pick(vis);
    seg.src = item.id; seg.kind = item.kind; seg.stutter = false;
    const len = seg.end - seg.start;
    if (item.kind === 'video') {
      seg.speed = seg.speed || 1;
      seg.srcStart = r.range(0, Math.max(0, item.duration - len * seg.speed));
    } else {
      const s0 = r.range(1.02, 1.12);
      seg.kb = { s0, s1: BS.clamp(s0 + r.sign() * r.range(0.06, 0.18), 1, 1.35), x0: r.range(-0.04, 0.04), y0: r.range(-0.04, 0.04), x1: r.range(-0.04, 0.04), y1: r.range(-0.04, 0.04) };
    }
  }

  // ---------------------------------------------------------------- transitions
  const TR = {
    flash(c, w, h, p, A, B) { B({}); FX().flash(c, w, h, Math.pow(1 - p, 1.6)); },
    dip(c, w, h, p, A, B) {
      if (p < 0.5) { A({}); FX().flash(c, w, h, p * 2, '#000'); } else { B({}); FX().flash(c, w, h, (1 - p) * 2, '#000'); }
    },
    crossfade(c, w, h, p, A, B) { A({}); B({ alpha: BS.smooth(p) }); },
    zoomin(c, w, h, p, A, B) {
      if (p < 0.5) { const u = BS.easeIn(p * 2); A({ s: 1 + 0.9 * u, blur: 10 * u }); }
      else { const u = BS.easeOut((p - 0.5) * 2); B({ s: 1.9 - 0.9 * u, blur: 10 * (1 - u) }); }
    },
    zoomout(c, w, h, p, A, B) {
      A({}); const u = BS.easeOut(p);
      FX().flash(c, w, h, 0.5 * (1 - u), '#000');
      B({ s: 0.4 + 0.6 * u, alpha: BS.clamp(p * 3, 0, 1) });
    },
    whip(c, w, h, p, A, B) {
      const u = BS.easeInOut(p), blur = Math.sin(p * Math.PI) * 18;
      A({ x: -u, blur }); B({ x: 1 - u, blur });
    },
    whipup(c, w, h, p, A, B) {
      const u = BS.easeInOut(p), blur = Math.sin(p * Math.PI) * 18;
      A({ y: -u, blur }); B({ y: 1 - u, blur });
    },
    spin(c, w, h, p, A, B) {
      if (p < 0.5) { const u = BS.easeIn(p * 2); A({ r: u * Math.PI * 0.5, s: 1 + u * 0.8, blur: 8 * u }); }
      else { const u = BS.easeOut((p - 0.5) * 2); B({ r: -(1 - u) * Math.PI * 0.5, s: 1.8 - 0.8 * u, blur: 8 * (1 - u) }); }
    },
    glitch(c, w, h, p, A, B, rng) {
      (rng() < p ? B : A)({});
      const k = Math.sin(p * Math.PI);
      FX().glitch(c, w, h, k, rng); FX().rgbSplit(c, w, h, k * w * 0.02, rng() * 6);
    },
    rgb(c, w, h, p, A, B) { B({ s: 1 + 0.08 * (1 - p) }); FX().rgbSplit(c, w, h, (1 - p) * w * 0.035); },
    blur(c, w, h, p, A, B) { if (p < 0.5) A({ blur: 30 * p * 2 }); else B({ blur: 30 * (1 - p) * 2 }); },
    strobe(c, w, h, p, A, B) { (Math.floor(p * 8) % 2 ? B : A)({}); if (Math.floor(p * 16) % 3 === 0) FX().flash(c, w, h, 0.25); },
    pixel(c, w, h, p, A, B) {
      if (p < 0.5) A({}); else B({});
      FX().pixelate(c, w, h, 2 + Math.sin(p * Math.PI) * Math.min(w, h) / 18);
    },
    wipe(c, w, h, p, A, B) {
      A({});
      const u = BS.easeInOut(p) * 2.2 - 0.6;
      c.save(); c.beginPath();
      c.moveTo(0, 0); c.lineTo(w * (u + 0.6), 0); c.lineTo(w * u, h); c.lineTo(0, h); c.closePath(); c.clip();
      B({}); c.restore();
    },
    iris(c, w, h, p, A, B) {
      A({});
      c.save(); c.beginPath(); c.arc(w / 2, h / 2, Math.hypot(w, h) * 0.5 * BS.easeInOut(p), 0, BS.TAU); c.clip();
      B({}); c.restore();
    },
    shake(c, w, h, p, A, B, rng) { const k = (1 - p) * (1 - p); B({ x: (rng() - 0.5) * 0.08 * k, y: (rng() - 0.5) * 0.08 * k, r: (rng() - 0.5) * 0.06 * k, s: 1.08 }); },
    burn(c, w, h, p, A, B) {
      A({}); B({ alpha: BS.smooth(p) });
      const k = Math.sin(p * Math.PI);
      c.save(); c.globalCompositeOperation = 'screen';
      const g = c.createRadialGradient(w * (0.2 + 0.6 * p), h * 0.4, 0, w * (0.2 + 0.6 * p), h * 0.4, Math.max(w, h) * 0.8);
      g.addColorStop(0, `rgba(255,190,90,${0.95 * k})`); g.addColorStop(0.4, `rgba(255,80,20,${0.6 * k})`); g.addColorStop(1, 'rgba(120,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
    },
  };

  // ---------------------------------------------------------------- renderer
  function setTime(el, t) {
    // assigning the same time can leave the element 'seeking' without a 'seeked' event
    if (Math.abs(el.currentTime - t) > 0.008) el.currentTime = t;
  }
  async function waitReady(els, timeout) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      if (els.every((el) => !el.seeking && el.readyState >= 2)) return true;
      await BS.sleep(25);
    }
    return false;
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.pools = new Map();
      this.playing = false;
      this.t = 0;
      this.onTime = null;
      this.onEnd = null;
      this.syncOffset = 0;
      this.lastFrame = null;
    }
    setSize(w, h) {
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      this.lastFrame = BS.makeCanvas(w, h);
      this.lastFrame.ctx = this.lastFrame.getContext('2d');
    }
    load(plan, settings, audioBuffer) {
      this.stop();
      this.plan = plan; this.S = settings; this.audio = audioBuffer;
      this.items = {};
      plan.segments.forEach((s) => (this.items[s.src] = BS.Library.get(s.src)));
      this.allocate();
      this.t = plan.start;
    }
    allocate() {
      // Each segment gets a <video> element; segments within 3 of each other never share one,
      // so the next cut can be pre-seeked while the current one is still playing.
      for (const pool of this.pools.values()) pool.forEach((p) => { p.lastIdx = -1e9; p.el.pause(); });
      this.plan.segments.forEach((seg, i) => {
        seg.state = 'idle';
        if (seg.kind !== 'video') { seg.el = null; return; }
        const item = this.items[seg.src];
        if (!item) return;
        let pool = this.pools.get(seg.src);
        if (!pool) { pool = []; this.pools.set(seg.src, pool); }
        let slot = pool.find((p) => p.lastIdx <= i - 3);
        if (!slot) {
          const el = document.createElement('video');
          el.muted = true; el.playsInline = true; el.preload = 'auto'; el.loop = true; el.src = item.url;
          slot = { el, lastIdx: -1e9 };
          pool.push(slot);
        }
        slot.lastIdx = i;
        seg.el = slot.el;
      });
    }
    releaseUnused() {
      const used = new Set(this.plan ? this.plan.segments.map((s) => s.src) : []);
      for (const [id, pool] of this.pools) if (!used.has(id)) { pool.forEach((p) => { p.el.pause(); p.el.removeAttribute('src'); p.el.load(); }); this.pools.delete(id); }
    }
    winStart(i) { const s = this.plan.segments[i]; return s.start - (s.trans ? s.trans.pre : 0); }
    winEnd(i) { const n = this.plan.segments[i + 1]; return this.plan.segments[i].end + (n && n.trans ? n.trans.post : 0); }
    localTime(seg, t) {
      const item = this.items[seg.src];
      const dur = (item && item.duration) || 1;
      let lt = seg.srcStart + (t - seg.start) * seg.speed;
      if (lt < 0) lt = 0;
      if (lt > dur - 0.04) lt = lt % Math.max(0.05, dur - 0.04);
      return lt;
    }
    segIndexAt(t) {
      const segs = this.plan.segments;
      let lo = 0, hi = segs.length - 1, ans = 0;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (segs[m].start <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
      return ans;
    }
    resetStates() {
      this.plan.segments.forEach((s) => { s.state = 'idle'; if (s.el) { s.el.pause(); s.el._owner = undefined; } });
    }
    manage(t, playing) {
      const segs = this.plan.segments;
      const c = this.segIndexAt(t);
      for (let i = Math.max(0, c - 2); i <= Math.min(segs.length - 1, c + 3); i++) {
        const seg = segs[i];
        if (!seg.el) continue;
        const el = seg.el, ws = this.winStart(i), we = this.winEnd(i);
        if (t >= we) {
          if (seg.state === 'playing') { el.pause(); }
          seg.state = 'done';
          continue;
        }
        const owner = el._owner;
        const free = owner === undefined || owner === i || t >= this.winEnd(owner) || owner < c - 2;
        if (t >= ws) {
          if (seg.state !== 'playing') {
            if (owner !== i) { el._owner = i; setTime(el, this.localTime(seg, t)); }
            el.playbackRate = seg.speed;
            seg.state = 'playing';
          }
          if (playing && el.paused) { const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); }
          // keep long segments locked to the music clock
          if (playing && !el.seeking && el.readyState >= 2) {
            const exp = this.localTime(seg, t), dur = el.duration || 0;
            let d = Math.abs(el.currentTime - exp);
            if (dur > 0.5 && isFinite(dur)) d = Math.min(d, Math.abs(dur - d));
            if (d > 0.3) setTime(el, exp);
          }
          if (!playing && !el.paused) el.pause();
        } else if (seg.state === 'idle' && free) {
          el._owner = i; el.pause(); el.playbackRate = seg.speed;
          setTime(el, this.localTime(seg, ws));
          seg.state = 'prepared';
        }
      }
    }
    drawSource(i, t, m, cam) {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const seg = this.plan.segments[i];
      if (!seg) return;
      const item = this.items[seg.src];
      let src = null, sw = 0, sh = 0;
      let k = { s: 1, x: 0, y: 0, r: 0 };
      if (seg.kind === 'image' && item && item.el) {
        src = item.el; sw = item.width; sh = item.height;
        const kb = seg.kb;
        const u = BS.clamp((t - this.winStart(i)) / Math.max(0.01, this.winEnd(i) - this.winStart(i)), 0, 1);
        if (kb) k = { s: BS.lerp(kb.s0, kb.s1, u), x: BS.lerp(kb.x0, kb.x1, u), y: BS.lerp(kb.y0, kb.y1, u), r: 0 };
      } else if (seg.el && seg.el.readyState >= 2) {
        src = seg.el; sw = seg.el.videoWidth; sh = seg.el.videoHeight;
      } else {
        src = this.lastFrame; sw = w; sh = h; k = { s: 1, x: 0, y: 0, r: 0 }; cam = null;
      }
      if (!src || !sw) return;
      const S = this.S;
      const s = (m.s || 1) * k.s * (cam ? cam.s : 1);
      const x = ((m.x || 0) + k.x + (cam ? cam.x : 0)) * w;
      const y = ((m.y || 0) + k.y + (cam ? cam.y : 0)) * h;
      const rot = (m.r || 0) + (cam ? cam.r : 0);
      let filter = src === this.lastFrame ? '' : (GRADES[S.grade] || GRADES.none).f;
      const blur = (m.blur || 0) + (cam ? cam.blur : 0);
      if (blur > 0.5) filter += ` blur(${(blur * w / 1280).toFixed(1)}px)`;
      ctx.save();
      ctx.globalAlpha = m.alpha == null ? 1 : m.alpha;
      ctx.filter = filter.trim() || 'none';
      ctx.translate(w / 2 + x, h / 2 + y);
      if (rot) ctx.rotate(rot);
      ctx.scale(s, s);
      if (S.fit === 'contain' && src !== this.lastFrame) {
        ctx.save(); ctx.filter = 'blur(' + Math.round(w / 40) + 'px) brightness(0.5)';
        BS.drawFit(ctx, src, sw, sh, -w / 2, -h / 2, w, h, 'cover'); ctx.restore();
        BS.drawFit(ctx, src, sw, sh, -w / 2, -h / 2, w, h, 'contain');
      } else BS.drawFit(ctx, src, sw, sh, -w / 2, -h / 2, w, h, 'cover');
      ctx.restore();
    }
    pulse(name, t) {
      // envelope 0..1 of the most recent trigger for an effect
      const e = this.S.effects[name];
      const arr = this.plan.triggers[e.trig] || [];
      const i = BS.lastIndexLE(arr, t);
      if (i < 0) return { e: 0, dt: 1e9, i: -1 };
      const dt = t - arr[i];
      const decay = this.plan.period * 0.35;
      return { e: Math.exp(-dt / decay), dt, i };
    }
    drawFrame(t) {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, S = this.S, plan = this.plan;
      if (!plan || !plan.segments.length) return;
      const segs = plan.segments;
      const rng = BS.rng(Math.floor(t * 60) * 7919 + 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      const fx = S.effects || {};
      // camera from pulse effects
      const cam = { s: 1, x: 0, y: 0, r: 0, blur: 0 };
      if (fx.zoom) { const p = this.pulse('zoom', t); cam.s *= 1 + 0.16 * fx.zoom.amt * p.e; }
      if (fx.shake) { const p = this.pulse('shake', t); const k = 0.035 * fx.shake.amt * p.e; cam.x += (rng() - 0.5) * k; cam.y += (rng() - 0.5) * k; cam.s *= 1 + k; }
      if (fx.tilt) { const p = this.pulse('tilt', t); cam.r += (p.i % 2 ? 1 : -1) * 0.06 * fx.tilt.amt * p.e; cam.s *= 1 + 0.08 * fx.tilt.amt * p.e; }
      if (fx.blur) { const p = this.pulse('blur', t); cam.blur += 14 * fx.blur.amt * p.e; }
      if (Math.abs(cam.r) > 0.001) cam.s *= 1 + Math.abs(Math.sin(cam.r)) * (w / h + h / w) * 0.5;

      const c = this.segIndexAt(t);
      const cur = segs[c];
      let b = -1;
      if (c > 0 && cur.trans && cur.trans.dur > 0 && t < cur.start + cur.trans.post) b = c;
      else if (c + 1 < segs.length) { const n = segs[c + 1]; if (n.trans && n.trans.dur > 0 && t >= n.start - n.trans.pre) b = c + 1; }
      if (b > 0) {
        const tr = segs[b].trans;
        const p = BS.clamp((t - (segs[b].start - tr.pre)) / tr.dur, 0, 1);
        const A = (m) => this.drawSource(b - 1, t, m, cam), B = (m) => this.drawSource(b, t, m, cam);
        (TR[tr.type] || ((cc, ww, hh, pp, AA, BB) => BB({})))(ctx, w, h, p, A, B, rng);
      } else this.drawSource(c, t, {}, cam);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
      // remember the composite (before effects) to cover not-yet-decoded frames
      if (this.lastFrame) { const lc = this.lastFrame.ctx; lc.globalCompositeOperation = 'copy'; lc.drawImage(this.canvas, 0, 0); }

      const F = FX();
      if (fx.mirror) { const p = this.pulse('mirror', t); if (p.i >= 0) { const m = ['none', 'h', 'none', 'quad'][p.i % 4]; F.mirror(ctx, w, h, m); } }
      if (fx.hue) { const p = this.pulse('hue', t); if (p.i > 0) F.hue(ctx, w, h, (p.i * 67 * fx.hue.amt) % 360); }
      if (fx.rgb) { const p = this.pulse('rgb', t); F.rgbSplit(ctx, w, h, w * 0.025 * fx.rgb.amt * p.e, (p.i % 4) * 0.8); }
      if (fx.glitch) { const p = this.pulse('glitch', t); if (p.e > 0.25) F.glitch(ctx, w, h, fx.glitch.amt * p.e, rng); }
      if (fx.pixel) { const p = this.pulse('pixel', t); if (p.e > 0.3) F.pixelate(ctx, w, h, 2 + Math.min(w, h) / 25 * fx.pixel.amt * p.e); }
      if (fx.invert) { const p = this.pulse('invert', t); if (p.dt < 0.07 + 0.08 * fx.invert.amt) F.invert(ctx, w, h, 1); }
      if (fx.strobe) { const p = this.pulse('strobe', t); if (p.dt < plan.period * 0.5 && Math.floor(p.dt / 0.045) % 2 === 1) F.flash(ctx, w, h, fx.strobe.amt, '#000'); }
      if (fx.flash) { const p = this.pulse('flash', t); F.flash(ctx, w, h, 0.85 * fx.flash.amt * p.e); }
      if (S.vhs) F.vhs(ctx, w, h, S.vhs, t);
      if (S.grain) F.grain(ctx, w, h, S.grain, t);
      let vig = S.vignette || 0;
      if (fx.vignette) { const p = this.pulse('vignette', t); vig += 0.6 * fx.vignette.amt * p.e; }
      F.vignette(ctx, w, h, Math.min(1, vig));
      if (S.letterbox) F.letterbox(ctx, w, h, S.letterbox);
      // captions
      const words = S.captionWords;
      if (words && words.length) {
        const arr = plan.triggers[S.captionTrig || 'beat'] || [];
        const i = BS.lastIndexLE(arr, t);
        if (i >= 0) {
          const dt = t - arr[i];
          const pop = 1 + 0.35 * Math.exp(-dt / (plan.period * 0.15));
          F.caption(ctx, w, h, words[i % words.length], { scale: pop, color: S.captionColor || '#fff', glow: S.captionColor || '#fff', size: 0.13, y: 0.5 });
        }
      }
      if (S.title && t - plan.start < 3) {
        const a = BS.clamp(1 - (t - plan.start - 2) / 1, 0, 1);
        F.caption(ctx, w, h, S.title, { alpha: a, size: 0.09, y: 0.82, weight: 800, font: 'system-ui, sans-serif', glow: '#ff3d7f' });
      }
      // fades
      if (S.fade) {
        const fi = BS.clamp(1 - (t - plan.start) / 0.6, 0, 1), fo = BS.clamp(1 - (plan.end - t) / 1.0, 0, 1);
        F.flash(ctx, w, h, Math.max(fi, fo), '#000');
      }
    }

    async primeAt(t) {
      this.resetStates();
      this.manage(t, false);
      const segs = this.plan.segments, c = this.segIndexAt(t);
      const els = [];
      for (let i = Math.max(0, c - 1); i <= Math.min(segs.length - 1, c + 2); i++) if (segs[i].el) els.push(segs[i].el);
      await waitReady(els, 3000);
    }
    async seek(t) {
      if (!this.plan) return;
      const was = this.playing;
      if (was) this.stop();
      this.t = BS.clamp(t, this.plan.start, this.plan.end);
      await this.primeAt(this.t);
      this.drawFrame(this.t);
      if (this.onTime) this.onTime(this.t);
      if (was) this.play(this.t);
    }
    async play(from, opts) {
      opts = opts || {};
      if (!this.plan || !this.plan.segments.length) return;
      this.stop();
      const plan = this.plan;
      from = from == null ? this.t : from;
      if (from >= plan.end - 0.05) from = plan.start;
      await this.primeAt(from);
      const actx = BS.AudioKit.ctx();
      try { await actx.resume(); } catch (e) { /* ignore */ }
      const token = (this.token = {});
      let clock;
      if (this.audio) {
        const src = actx.createBufferSource(); src.buffer = this.audio;
        const gain = actx.createGain();
        src.connect(gain);
        if (!opts.silent) gain.connect(actx.destination);
        if (opts.dest) gain.connect(opts.dest);
        const t0 = actx.currentTime + 0.06;
        if (this.S.fade) { gain.gain.setValueAtTime(1, t0 + Math.max(0, plan.end - from - 1)); gain.gain.linearRampToValueAtTime(0.0001, t0 + plan.end - from); }
        src.start(t0, from, plan.end - from);
        this.src = src;
        const lat = opts.dest ? 0 : (actx.outputLatency || 0) + (actx.baseLatency || 0);
        clock = () => from + (actx.currentTime - t0) - lat - this.syncOffset;
      } else {
        const p0 = performance.now() + 60;
        clock = () => from + (performance.now() - p0) / 1000 - this.syncOffset;
      }
      this.playing = true;
      const loop = () => {
        if (this.token !== token) return;
        let t = clock();
        if (t < from) t = from;
        if (t >= plan.end) {
          this.t = plan.end; this.drawFrame(plan.end - 0.001);
          this.stop(); if (this.onTime) this.onTime(plan.end);
          if (this.onEnd) this.onEnd();
          if (opts.onDone) opts.onDone();
          return;
        }
        this.t = t;
        this.manage(t, true);
        this.drawFrame(t);
        if (this.onTime) this.onTime(t);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    stop() {
      this.token = null;
      this.playing = false;
      cancelAnimationFrame(this.raf);
      if (this.src) { try { this.src.stop(); } catch (e) { /* ignore */ } this.src = null; }
      if (this.plan) this.plan.segments.forEach((s) => { if (s.el && !s.el.paused) s.el.pause(); });
    }
    async exportVideo(opts) {
      opts = opts || {};
      const mime = BS.pickRecorderMime(opts.format !== 'webm');
      if (mime === null) throw new Error('This browser cannot record video (no MediaRecorder).');
      const fps = opts.fps || 30;
      const stream = this.canvas.captureStream(fps);
      const actx = BS.AudioKit.ctx();
      let dest = null;
      if (this.audio) { dest = actx.createMediaStreamDestination(); dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr)); }
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: opts.bitrate || 12e6, audioBitsPerSecond: 256000 } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((res) => (rec.onstop = res));
      this.exporting = true;
      await this.primeAt(this.plan.start);
      this.drawFrame(this.plan.start);
      rec.start(500);
      const prevOnTime = this.onTime;
      this.onTime = (t) => { if (prevOnTime) prevOnTime(t); if (opts.onProgress) opts.onProgress((t - this.plan.start) / (this.plan.end - this.plan.start)); };
      await new Promise((resolve) => {
        this.cancelExport = () => { this.stop(); resolve(); };
        this.play(this.plan.start, { dest, silent: !!opts.silent, onDone: resolve });
      });
      this.onTime = prevOnTime;
      this.cancelExport = null;
      await BS.sleep(250);
      rec.stop();
      await stopped;
      stream.getTracks().forEach((tr) => tr.stop());
      this.exporting = false;
      return { blob: new Blob(chunks, { type: (mime || 'video/webm').split(';')[0] }), ext: BS.extForMime(mime) };
    }
  }

  // ---------------------------------------------------------------- timeline
  const SEG_COLORS = ['#ff3d7f', '#7c4dff', '#00d4ff', '#ffb300', '#2ee59d', '#ff6d3a', '#c86bff', '#4dd0e1', '#f06292', '#aed581'];
  function drawTimeline(cv, o) {
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(cv.clientWidth * dpr)), H = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0d16'; ctx.fillRect(0, 0, W, H);
    const v0 = o.v0 || 0, v1 = o.v1 || 1;
    const X = (t) => ((t - v0) / (v1 - v0)) * W;
    const segH = H * 0.32, waveTop = segH + 4 * dpr, waveH = H - waveTop;
    if (o.plan) {
      const colorOf = {}; let ci = 0;
      o.plan.segments.forEach((s, i) => {
        if (colorOf[s.src] == null) colorOf[s.src] = SEG_COLORS[ci++ % SEG_COLORS.length];
        const x0 = X(s.start), x1 = X(s.end);
        if (x1 < 0 || x0 > W) return;
        ctx.fillStyle = colorOf[s.src];
        ctx.globalAlpha = i === o.sel ? 1 : 0.65;
        ctx.fillRect(x0, 0, Math.max(1, x1 - x0 - 1 * dpr), segH);
        if (s.trans && s.trans.type !== 'cut') {
          ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
          ctx.fillRect(X(s.start - s.trans.pre), segH - 4 * dpr, Math.max(2, X(s.start + s.trans.post) - X(s.start - s.trans.pre)), 4 * dpr);
        }
        if (s.stutter) { ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(x0, 0, 3 * dpr, segH); }
        if (i === o.sel) { ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dpr; ctx.strokeRect(x0 + 1, 1, Math.max(2, x1 - x0 - 2), segH - 2); }
      });
      ctx.globalAlpha = 1;
      // shade outside of export range
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, X(o.plan.start), H);
      ctx.fillRect(X(o.plan.end), 0, W - X(o.plan.end), H);
    }
    if (o.peaks && o.duration) {
      const n = o.peaks.length / 2;
      ctx.fillStyle = '#3d3d63';
      for (let x = 0; x < W; x++) {
        const t = v0 + (x / W) * (v1 - v0);
        const i = Math.floor((t / o.duration) * n);
        if (i < 0 || i >= n) continue;
        const mn = o.peaks[i * 2], mx = o.peaks[i * 2 + 1];
        ctx.fillRect(x, waveTop + waveH / 2 + mn * waveH * 0.48, 1, Math.max(1, (mx - mn) * waveH * 0.48));
      }
    }
    if (o.an) {
      const pxPerBeat = (o.an.period / (v1 - v0)) * W;
      if (pxPerBeat > 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        o.an.beats.forEach((t) => { const x = X(t); if (x >= 0 && x <= W) ctx.fillRect(x, waveTop, 1, waveH); });
      }
      ctx.fillStyle = 'rgba(255,61,127,0.7)';
      (o.an.downbeats || []).forEach((t) => { const x = X(t); if (x >= 0 && x <= W) ctx.fillRect(x, waveTop, Math.max(1, dpr), waveH); });
      if (o.showOnsets) {
        ctx.fillStyle = '#ffb300';
        (o.an.onsets.low || []).forEach((t) => { const x = X(t); if (x >= 0 && x <= W) ctx.fillRect(x - dpr, waveTop, 2 * dpr, 4 * dpr); });
        ctx.fillStyle = '#00d4ff';
        (o.an.onsets.mid || []).forEach((t) => { const x = X(t); if (x >= 0 && x <= W) ctx.fillRect(x - dpr, H - 4 * dpr, 2 * dpr, 4 * dpr); });
      }
    }
    if (o.t != null) {
      const x = X(o.t);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - dpr, 0, 2 * dpr, H);
    }
  }

  BS.Beat = { PATTERNS, TRANSITIONS, EFFECTS, TRIGGERS, GRADES, PRESETS, buildPlan, rerollSegment, Renderer, drawTimeline };
})();
