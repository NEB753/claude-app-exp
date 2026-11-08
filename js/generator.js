/* Procedural image & video generator. Every style is a pure function of (seed, palette, time),
   so the same code makes stills (t = 0) and animated videos (t advancing). 100% offline & free. */
(function () {
  'use strict';
  const BS = window.BS;
  const TAU = BS.TAU;

  const PALETTES = {
    sunset: ['#1a0533', '#5b1a5e', '#c2185b', '#ff6f3c', '#ffd166'],
    ocean: ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8'],
    forest: ['#081c15', '#1b4332', '#2d6a4f', '#52b788', '#d8f3dc'],
    neon: ['#0b0221', '#3a0ca3', '#f72585', '#4cc9f0', '#e0fbff'],
    fire: ['#120000', '#5c0a00', '#c1121f', '#f77f00', '#fcbf49'],
    ice: ['#0d1b2a', '#1b263b', '#415a77', '#a9d6e5', '#f1faee'],
    gold: ['#140d00', '#5a3d00', '#b8860b', '#e6b800', '#fff3b0'],
    pastel: ['#3d3355', '#c5d7ff', '#ffd6e0', '#c1f0dc', '#fff6d6'],
    mono: ['#0a0a0a', '#3a3a3a', '#7a7a7a', '#bdbdbd', '#f5f5f5'],
    candy: ['#2b0f54', '#ab1f65', '#ff4f69', '#ff8142', '#fff2e0'],
    toxic: ['#05100b', '#1a3d2a', '#2bb34b', '#39ff14', '#efffb0'],
    dusk: ['#0f0c29', '#302b63', '#6a3d7a', '#ff7e5f', '#feb47b'],
    earth: ['#2b2118', '#6b4f3a', '#a47148', '#d4a373', '#faedcd'],
    vapor: ['#1b1036', '#b967ff', '#ff71ce', '#01cdfe', '#05ffa1'],
    blood: ['#0a0000', '#3d0000', '#8b0000', '#d00000', '#ff8c8c'],
    royal: ['#0a0a23', '#1f1f6e', '#4b2c9e', '#c9a227', '#f5e6a8'],
  };
  const COLOR_WORDS = {
    red: '#e01e37', crimson: '#b0103a', scarlet: '#ff2400', orange: '#ff7a00', amber: '#ffbf00', yellow: '#ffe14d',
    gold: '#d4a017', golden: '#d4a017', green: '#2ecc71', emerald: '#10b981', lime: '#a3e635', mint: '#98ffcc',
    teal: '#14b8a6', cyan: '#22d3ee', turquoise: '#40e0d0', blue: '#2563eb', azure: '#3b9dff', navy: '#0b1f5c',
    indigo: '#4f46e5', violet: '#8b5cf6', purple: '#9333ea', magenta: '#ff00c8', pink: '#ff6fb5', rose: '#f43f5e',
    white: '#f8fafc', silver: '#c0c7d1', grey: '#7c8592', gray: '#7c8592', black: '#050505', brown: '#7b4a2a',
    peach: '#ffb38a', lavender: '#b9a7ff', coral: '#ff6f61', chrome: '#dfe6ee',
  };
  const PALETTE_RULES = [
    [/sunset|sunrise|dawn|warm|tropical|summer|miami/, 'sunset'], [/ocean|sea|water|beach|underwater|aqua|rain/, 'ocean'],
    [/forest|jungle|nature|leaf|garden|moss/, 'forest'], [/neon|cyber|club|rave|laser|electric/, 'neon'],
    [/fire|lava|flame|volcano|inferno|hell|burn/, 'fire'], [/ice|snow|winter|frozen|arctic|cold|frost/, 'ice'],
    [/gold|luxury|royal|treasure|rich/, 'gold'], [/pastel|soft|cute|kawaii|baby/, 'pastel'],
    [/noir|black and white|monochrome|b&w|grayscale/, 'mono'], [/candy|sweet|bubblegum|pop/, 'candy'],
    [/toxic|acid|radioactive|slime|matrix|hacker/, 'toxic'], [/dusk|twilight|evening|night sky/, 'dusk'],
    [/desert|earth|sand|clay|autumn|fall/, 'earth'], [/vapor|aesthetic|y2k|holo/, 'vapor'],
    [/blood|horror|demon|vampire/, 'blood'], [/king|queen|castle|majestic|regal/, 'royal'],
  ];
  const STYLE_RULES = [
    [/tunnel|portal|vortex|wormhole|warp|hyperspace/, 'tunnel'],
    [/galaxy|space|nebula|cosmic|stars?\b|universe|astral|planet/, 'nebula'],
    [/synth|retro|80s|outrun|vaporwave|arcade/, 'synthwave'],
    [/city|skyline|urban|cyberpunk|street|downtown|night city|tokyo|metropolis/, 'city'],
    [/mountain|landscape|valley|hills|desert|canyon|scenery/, 'landscape'],
    [/glass|mosaic|stained|cells?\b|crystal|shatter/, 'mosaic'],
    [/kaleido|mandala|psychedel|trippy|fractal|lsd/, 'kaleido'],
    [/geometric|bauhaus|shapes?|minimal|grid|pattern/, 'geometric'],
    [/flow|wind|hair|silk|smoke|fluid|swirl|marble/, 'flow'],
    [/waves?|ribbon|ocean|sea|surf|dune/, 'waves'],
    [/aurora|gradient|blur|dream|glow|mist|haze|bokeh/, 'aurora'],
  ];
  const STYLES = ['aurora', 'nebula', 'flow', 'synthwave', 'landscape', 'city', 'geometric', 'mosaic', 'kaleido', 'waves', 'tunnel'];
  const STYLE_NAMES = {
    aurora: 'Aurora glow', nebula: 'Nebula / space', flow: 'Flow field', synthwave: 'Synthwave', landscape: 'Landscape',
    city: 'Night city', geometric: 'Geometric', mosaic: 'Stained glass', kaleido: 'Kaleidoscope', waves: 'Waves', tunnel: 'Tunnel / vortex',
  };

  function analyzePrompt(prompt, seedOverride) {
    const p = (prompt || '').toLowerCase();
    const seed = seedOverride != null && seedOverride !== '' ? Number(seedOverride) >>> 0 : BS.hashStr(p || 'beatforge');
    const r = BS.rng(seed ^ 0x9e3779b9);
    let style = null, paletteName = null;
    for (const [re, s] of STYLE_RULES) if (re.test(p)) { style = s; break; }
    for (const [re, n] of PALETTE_RULES) if (re.test(p)) { paletteName = n; break; }
    if (!style) style = STYLES[seed % STYLES.length];
    let pal = PALETTES[paletteName || Object.keys(PALETTES)[(seed >>> 4) % Object.keys(PALETTES).length]].slice();
    // explicit colour words override the palette
    const found = [];
    p.replace(/[a-z]+/g, (w) => { if (COLOR_WORDS[w] && !found.includes(COLOR_WORDS[w])) found.push(COLOR_WORDS[w]); return w; });
    if (found.length) {
      const cols = found.slice(0, 3).map(BS.hexToRgb);
      const dark = BS.mixRgb(cols[0], [5, 5, 12], 0.85);
      const light = BS.mixRgb(cols[cols.length - 1], [255, 255, 255], 0.7);
      const mid = cols.length === 1 ? [BS.mixRgb(cols[0], [0, 0, 0], 0.45), cols[0], BS.mixRgb(cols[0], [255, 255, 255], 0.35)]
        : cols.length === 2 ? [BS.mixRgb(cols[0], [0, 0, 0], 0.3), cols[0], cols[1]] : cols;
      pal = [dark].concat(mid, [light]).map(BS.rgbToHex);
      paletteName = 'custom';
    }
    return { seed, style, paletteName: paletteName || 'auto', palette: pal, r };
  }

  // offscreen helpers
  const bufs = {};
  function buf(name, w, h) {
    let b = bufs[name];
    if (!b) { b = bufs[name] = BS.makeCanvas(w, h); b.ctx = b.getContext('2d', { willReadFrequently: name.startsWith('px') }); }
    if (b.width !== w || b.height !== h) { b.width = w; b.height = h; }
    return b;
  }
  function vgrad(ctx, w, h, stops) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(([o, c]) => g.addColorStop(o, typeof c === 'string' ? c : BS.rgba(c)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  // per-pixel painter at reduced resolution, upscaled smoothly
  function pixelPaint(ctx, w, h, scale, fn) {
    const lw = Math.max(2, Math.ceil(w / scale)), lh = Math.max(2, Math.ceil(h / scale));
    const b = buf('px' + scale, lw, lh);
    const img = b.ctx.createImageData(lw, lh);
    const d = img.data;
    const out = [0, 0, 0];
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      fn(x / lw, y / lh, out);
      const i = (y * lw + x) * 4;
      d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; d[i + 3] = 255;
    }
    b.ctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b, 0, 0, lw, lh, 0, 0, w, h);
  }
  function stars(ctx, w, h, P, count, maxY) {
    const r = BS.rng(P.seed + 77);
    const u = Math.min(w, h) / 1000;
    for (let i = 0; i < count; i++) {
      const x = r() * w, y = r() * h * (maxY || 1), s = (r() * r() * 2.2 + 0.4) * u * 1.6;
      const tw = 0.55 + 0.45 * Math.sin(P.t * r.range(1, 4) + r() * TAU);
      ctx.fillStyle = `rgba(255,255,255,${(0.4 + 0.6 * r()) * tw})`;
      ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    }
  }

  const S = {};
  function hash01(n) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }

  S.aurora = function (ctx, w, h, P) {
    const r = P.rng, pal = P.pal;
    const lw = Math.ceil(w / 10), lh = Math.ceil(h / 10);
    const b = buf('aur', lw, lh), c = b.ctx;
    c.globalCompositeOperation = 'source-over';
    vgrad(c, lw, lh, [[0, pal[0]], [1, BS.mixRgb(pal[0], pal[1], 0.6)]]);
    c.globalCompositeOperation = 'lighter';
    const n = 7;
    for (let i = 0; i < n; i++) {
      const sp = r.range(0.15, 0.5), ph = r() * TAU;
      const cx = lw * (r.range(0.1, 0.9) + 0.18 * Math.sin(P.t * sp + ph));
      const cy = lh * (r.range(0.1, 0.9) + 0.18 * Math.cos(P.t * sp * 0.8 + ph * 1.3));
      const rad = Math.min(lw, lh) * r.range(0.3, 0.7) * (1 + 0.1 * Math.sin(P.t * 0.7 + i));
      const col = pal[1 + (i % 4)];
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, BS.rgba(col, 0.55)); g.addColorStop(1, BS.rgba(col, 0));
      c.fillStyle = g; c.fillRect(0, 0, lw, lh);
    }
    c.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b, 0, 0, w, h);
    // light ribbons
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      const base = h * r.range(0.25, 0.65), amp = h * r.range(0.05, 0.15), f = r.range(1, 3), ph = r() * TAU;
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base + amp * Math.sin((x / w) * f * TAU + ph + P.t * 0.5));
      ctx.strokeStyle = BS.rgba(pal[4], 0.12); ctx.lineWidth = h * 0.04; ctx.filter = 'blur(' + Math.round(h / 60) + 'px)';
      ctx.stroke();
    }
    ctx.restore();
  };

  S.nebula = function (ctx, w, h, P) {
    const pal = P.pal, nz = P.noise, asp = w / h, t = P.t;
    const r = P.rng; const ox = r() * 100, oy = r() * 100;
    pixelPaint(ctx, w, h, P.still ? 2.5 : 6, (u, v, out) => {
      const x = u * 2.6 * asp + ox, y = v * 2.6 + oy;
      const q = nz.fbm(x + t * 0.03, y, t * 0.04, 4);
      const q2 = nz.fbm(x + 3 * q + 1.7, y + 3 * q + 9.2, t * 0.05, 4);
      let val = BS.clamp(q2 * 1.2 + 0.5, 0, 1);
      const dens = BS.clamp(nz.fbm(x * 0.7 + 5, y * 0.7, 0.3, 3) * 2 + 0.35, 0, 1);
      const c = BS.samplePalette(pal, Math.pow(val, 1.3));
      const k = Math.pow(dens, 1.4) * (0.35 + val);
      out[0] = c[0] * k; out[1] = c[1] * k; out[2] = c[2] * k;
    });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    stars(ctx, w, h, P, Math.round((w * h) / 2500));
    // a few bright stars with glow
    const r2 = BS.rng(P.seed + 5);
    for (let i = 0; i < 6; i++) {
      const x = r2() * w, y = r2() * h, s = Math.min(w, h) * r2.range(0.01, 0.025) * (0.8 + 0.2 * Math.sin(t * 2 + i));
      const g = ctx.createRadialGradient(x, y, 0, x, y, s * 4);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.2, BS.rgba(pal[4], 0.4)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - s * 4, y - s * 4, s * 8, s * 8);
    }
    ctx.restore();
  };

  S.flow = function (ctx, w, h, P) {
    const pal = P.pal, nz = P.noise, r = P.rng;
    vgrad(ctx, w, h, [[0, pal[0]], [1, BS.mixRgb(pal[0], pal[1], 0.4)]]);
    const count = P.still ? 2600 : 1100, steps = P.still ? 60 : 36;
    const sc = r.range(1.2, 2.6) / Math.max(w, h), len = Math.max(w, h) / 260;
    const u = Math.min(w, h) / 1000;
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      let x = r() * w, y = r() * h;
      const col = pal[1 + (i % 4)];
      ctx.strokeStyle = BS.rgba(col, P.still ? 0.16 : 0.22);
      ctx.lineWidth = r.range(0.6, 2.4) * u * 1.4;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < steps; s++) {
        const a = nz.n3(x * sc, y * sc, P.t * 0.06 + 10) * TAU * 2;
        x += Math.cos(a) * len; y += Math.sin(a) * len;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  S.synthwave = function (ctx, w, h, P) {
    const pal = P.pal, r = P.rng, t = P.t;
    const hz = h * 0.58;
    vgrad(ctx, w, hz, [[0, pal[0]], [0.55, pal[1]], [1, pal[2]]]);
    stars(ctx, w, h, P, 220, 0.45);
    // sun
    const R = Math.min(w, h) * 0.24, cx = w / 2, cy = hz - R * 0.35;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    const sg = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    sg.addColorStop(0, BS.rgba(pal[4])); sg.addColorStop(0.5, BS.rgba(pal[3])); sg.addColorStop(1, BS.rgba(pal[2]));
    ctx.fillStyle = sg; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 8; i++) {
      const yy = cy + R * (0.05 + i * 0.13) + ((t * 12) % (R * 0.13));
      ctx.fillRect(cx - R, yy, 2 * R, R * 0.012 * (i + 1.5));
    }
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.8);
    glow.addColorStop(0, BS.rgba(pal[3], 0.25)); glow.addColorStop(1, BS.rgba(pal[3], 0));
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, hz); ctx.restore();
    // mountains
    for (let layer = 0; layer < 2; layer++) {
      ctx.beginPath(); ctx.moveTo(0, hz);
      const amp = h * (layer ? 0.08 : 0.16), f = layer ? 0.009 : 0.005;
      for (let x = 0; x <= w; x += 6) {
        const d = Math.abs(x - cx) / (w / 2);
        const yv = hz - amp * Math.max(0, P.noise.fbm(x * f * (1000 / w) + layer * 20, 1.5, 0, 4) + 0.35) * BS.clamp(d * 1.6, 0, 1);
        ctx.lineTo(x, yv);
      }
      ctx.lineTo(w, hz); ctx.closePath();
      ctx.fillStyle = BS.rgba(BS.mixRgb(pal[0], pal[1], layer ? 0.5 : 0.2));
      ctx.fill();
      ctx.strokeStyle = BS.rgba(pal[3], 0.7); ctx.lineWidth = Math.max(1, h / 500); ctx.stroke();
    }
    // ground & grid
    vgrad2(ctx, 0, hz, w, h - hz, [[0, BS.mixRgb(pal[0], pal[1], 0.3)], [1, pal[0]]]);
    ctx.save();
    ctx.strokeStyle = BS.rgba(pal[3], 0.85); ctx.lineWidth = Math.max(1, h / 450);
    ctx.shadowColor = BS.rgba(pal[3]); ctx.shadowBlur = h / 90;
    const speed = 1.2, fr = (t * speed) % 1;
    for (let k = 1; k < 40; k++) {
      const d = k - fr; if (d <= 0.05) continue;
      const y = hz + (h - hz) * (1 / d) * 0.9; if (y > h) continue;
      ctx.globalAlpha = BS.clamp(1.5 / d, 0.15, 1);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = -24; i <= 24; i++) {
      ctx.beginPath(); ctx.moveTo(cx + i * w * 0.012, hz); ctx.lineTo(cx + i * w * 0.16, h); ctx.stroke();
    }
    ctx.restore();
    void r;
  };
  function vgrad2(ctx, x, y, w, h, stops) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    stops.forEach(([o, c]) => g.addColorStop(o, BS.rgba(c)));
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }

  S.landscape = function (ctx, w, h, P) {
    const pal = P.pal, r = P.rng, nz = P.noise, t = P.t;
    const sky0 = BS.mixRgb(pal[1], pal[0], 0.3), sky1 = BS.mixRgb(pal[4], pal[3], 0.3);
    vgrad(ctx, w, h, [[0, sky0], [0.6, sky1], [1, pal[4]]]);
    // sun / moon
    const sx = w * r.range(0.2, 0.8), sy = h * r.range(0.22, 0.4), sr = Math.min(w, h) * r.range(0.05, 0.09);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 6);
    g.addColorStop(0, 'rgba(255,255,240,0.9)'); g.addColorStop(0.15, BS.rgba(pal[4], 0.5)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
    // clouds
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = BS.rgba(pal[4]);
    for (let i = 0; i < 6; i++) {
      const cy = h * r.range(0.08, 0.35), cw = w * r.range(0.15, 0.35);
      const cx = ((r() * w + t * w * 0.01 * (1 + i * 0.3)) % (w + cw)) - cw / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, cw / 2, cw / 14, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    const L = 6;
    for (let j = 0; j < L; j++) {
      const k = j / (L - 1);
      const base = h * (0.42 + k * 0.42), amp = h * (0.22 - k * 0.12), f = 1.2 + j * 0.9;
      const col = BS.mixRgb(BS.mixRgb(sky1, pal[1], 0.4), BS.mixRgb(pal[0], [0, 0, 0], 0.4), Math.pow(k, 0.8));
      const off = t * 0.02 * (j + 1) + j * 13.7;
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w + 6; x += 6) {
        const n = nz.fbm((x / w) * f + off, j * 3.1, 0, 5);
        ctx.lineTo(x, base - amp * (n + 0.5) - (j === 0 ? amp * 0.3 * Math.abs(nz.n3((x / w) * 6 + off, 9, 0)) : 0));
      }
      ctx.lineTo(w, h); ctx.closePath();
      ctx.fillStyle = BS.rgba(col); ctx.fill();
      // fog between layers
      const fg = ctx.createLinearGradient(0, base - amp, 0, base + h * 0.05);
      fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, BS.rgba(sky1, 0.18));
      ctx.fillStyle = fg; ctx.fillRect(0, base - amp, w, h * 0.3);
    }
  };

  S.city = function (ctx, w, h, P) {
    const pal = P.pal, r = P.rng, t = P.t;
    const ground = h * 0.78;
    vgrad(ctx, w, ground, [[0, pal[0]], [0.7, BS.mixRgb(pal[0], pal[1], 0.7)], [1, pal[2]]]);
    stars(ctx, w, h, P, 160, 0.5);
    const mr = Math.min(w, h) * 0.06, mx = w * r.range(0.6, 0.9), my = h * 0.18;
    ctx.fillStyle = BS.rgba(pal[4], 0.9); ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    const u = Math.min(w, h) / 1000;
    for (let layer = 0; layer < 3; layer++) {
      let x = -r() * 40 * u;
      const hmax = h * (0.32 + layer * 0.12) * (layer === 2 ? 1 : 0.9);
      const dark = BS.mixRgb(pal[0], [0, 0, 0], 0.3 + layer * 0.25);
      const baseCol = BS.mixRgb(BS.mixRgb(pal[1], pal[0], 0.5), dark, layer / 2);
      while (x < w) {
        const bw = r.range(40, 110) * u * (1 + layer * 0.4), bh = r.range(0.35, 1) * hmax;
        const top = ground - bh;
        ctx.fillStyle = BS.rgba(baseCol); ctx.fillRect(x, top, bw, bh);
        if (r.chance(0.3)) ctx.fillRect(x + bw * 0.4, top - bh * 0.12, bw * 0.08, bh * 0.12);
        // windows
        const ww = 6 * u * (1 + layer * 0.3), gap = ww * 0.9;
        const lit = 0.15 + layer * 0.15;
        for (let wy = top + gap; wy < ground - gap; wy += ww + gap) for (let wx = x + gap; wx < x + bw - ww; wx += ww + gap) {
          const seed = (wx * 13.1 + wy * 7.7) | 0;
          const flick = Math.floor(t * 0.7 + (seed % 17));
          const on = hash01(seed + flick * 101) < lit;
          if (on) { ctx.fillStyle = BS.rgba(r.chance(0.85) ? pal[4] : pal[3], 0.85); ctx.fillRect(wx, wy, ww, ww * 1.3); }
        }
        if (layer === 2 && r.chance(0.35)) {
          ctx.save(); ctx.shadowColor = BS.rgba(pal[3]); ctx.shadowBlur = 20 * u;
          ctx.fillStyle = BS.rgba(r.pick([pal[2], pal[3], pal[4]]), 0.75 + 0.25 * Math.sin(t * 6 + x));
          ctx.fillRect(x + bw * 0.15, top + bh * r.range(0.1, 0.4), bw * 0.7, 8 * u);
          ctx.restore();
        }
        x += bw + r.range(0, 10) * u;
      }
    }
    // water reflection
    const rh = Math.ceil(h - ground);
    const snap = buf('cityRefl', Math.ceil(w), rh);
    snap.ctx.globalCompositeOperation = 'copy';
    snap.ctx.drawImage(ctx.canvas, 0, ground - rh, w, rh, 0, 0, w, rh);
    for (let y = 0; y < rh; y += 2) {
      const off = Math.sin(y * 0.25 + t * 3) * (y / rh) * 8 * u;
      ctx.globalAlpha = 0.55 * (1 - y / rh);
      ctx.drawImage(snap, 0, rh - y - 2, w, 2, off, ground + y, w, 2);
    }
    ctx.globalAlpha = 1;
    const wg = ctx.createLinearGradient(0, ground, 0, h);
    wg.addColorStop(0, BS.rgba(pal[0], 0.3)); wg.addColorStop(1, BS.rgba(pal[0], 0.9));
    ctx.fillStyle = wg; ctx.fillRect(0, ground, w, rh);
  };

  S.geometric = function (ctx, w, h, P) {
    const pal = P.pal, r = P.rng, t = P.t;
    const cols = w >= h ? r.int(5, 8) : r.int(3, 5);
    const cs = w / cols, rows = Math.ceil(h / cs);
    ctx.fillStyle = BS.rgba(pal[0]); ctx.fillRect(0, 0, w, h);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = i * cs, y = j * cs;
      const bg = r.int(0, 4); let fg = r.int(0, 4); if (fg === bg) fg = (fg + 2) % 5;
      ctx.fillStyle = BS.rgba(pal[bg]); ctx.fillRect(x, y, cs + 1, cs + 1);
      const kind = r.int(0, 6), ph = r() * 4;
      const tt = t * 0.6 + ph, rot = (Math.floor(tt) + BS.easeInOut(tt % 1)) * (Math.PI / 2) * (r.chance(0.5) ? 1 : -1);
      ctx.save(); ctx.translate(x + cs / 2, y + cs / 2); ctx.rotate(r.int(0, 3) * Math.PI / 2 + (P.still ? 0 : rot));
      ctx.fillStyle = BS.rgba(pal[fg]); ctx.strokeStyle = BS.rgba(pal[fg]);
      const s = cs / 2;
      ctx.beginPath();
      switch (kind) {
        case 0: ctx.arc(0, 0, s * 0.8, 0, TAU); ctx.fill(); break;
        case 1: ctx.arc(-s, -s, s * 2, 0, Math.PI / 2); ctx.lineTo(-s, -s); ctx.fill(); break;
        case 2: ctx.arc(0, s, s, Math.PI, TAU); ctx.fill(); break;
        case 3: ctx.moveTo(-s, s); ctx.lineTo(s, s); ctx.lineTo(-s, -s); ctx.fill(); break;
        case 4: ctx.lineWidth = s * 0.25; ctx.arc(0, 0, s * 0.6, 0, TAU); ctx.stroke(); break;
        case 5: for (let k = 0; k < 4; k++) ctx.fillRect(-s, -s + k * s * 0.5, s * 2, s * 0.25); break;
        default: ctx.arc(0, 0, s * 0.35, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.lineWidth = s * 0.12; ctx.arc(0, 0, s * 0.75, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
  };

  S.mosaic = function (ctx, w, h, P) {
    const pal = P.pal, r = P.rng, t = P.t;
    const N = r.int(45, 90), asp = w / h;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const ph = r() * TAU, sp = r.range(0.2, 0.6);
      pts.push({
        x: (r() + 0.03 * Math.sin(t * sp + ph)) * asp, y: r() + 0.03 * Math.cos(t * sp * 1.3 + ph),
        c: BS.mixRgb(pal[1 + r.int(0, 3)], [255, 255, 255], r() * 0.15),
      });
    }
    const lead = BS.mixRgb(pal[0], [0, 0, 0], 0.6), ew = 0.006;
    pixelPaint(ctx, w, h, P.still ? 1.5 : 4, (u, v, out) => {
      const x = u * asp, y = v;
      let d1 = 1e9, d2 = 1e9, c = null;
      for (let i = 0; i < N; i++) {
        const dx = pts[i].x - x, dy = pts[i].y - y, d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; c = pts[i].c; } else if (d < d2) d2 = d;
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      if (edge < ew) { out[0] = lead[0]; out[1] = lead[1]; out[2] = lead[2]; return; }
      const shade = 1.15 - Math.sqrt(d1) * 4;
      out[0] = c[0] * shade; out[1] = c[1] * shade; out[2] = c[2] * shade;
    });
    // light shafts
    ctx.save(); ctx.globalCompositeOperation = 'overlay';
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5 + 0.2 * Math.sin(t * 0.5), 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
  };

  S.kaleido = function (ctx, w, h, P) {
    const pal = P.pal, nz = P.noise, r = P.rng, t = P.t;
    const k = r.int(5, 12), seg = Math.PI / k, asp = w / h, z = r() * 50;
    pixelPaint(ctx, w, h, P.still ? 2 : 5, (u, v, out) => {
      const x = (u - 0.5) * asp, y = v - 0.5;
      const rad = Math.sqrt(x * x + y * y);
      let a = Math.atan2(y, x) + t * 0.15;
      a = ((a % (2 * seg)) + 2 * seg) % (2 * seg);
      if (a > seg) a = 2 * seg - a;
      const px = rad * Math.cos(a) * 3, py = rad * Math.sin(a) * 3;
      const n = nz.fbm(px + z - t * 0.25, py + z, t * 0.1, 4);
      const ridge = 1 - Math.abs(n * 2);
      const val = (n * 1.8 + rad * 1.2 - t * 0.12) % 1;
      const c = BS.samplePalette(pal, ((val % 1) + 1) % 1);
      const b = 0.35 + 0.9 * Math.pow(BS.clamp(ridge, 0, 1), 2);
      out[0] = c[0] * b; out[1] = c[1] * b; out[2] = c[2] * b;
    });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.3);
    g.addColorStop(0, BS.rgba(pal[4], 0.35)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
  };

  S.waves = function (ctx, w, h, P) {
    const pal = P.pal, r = P.rng, t = P.t, nz = P.noise;
    vgrad(ctx, w, h, [[0, pal[0]], [1, BS.mixRgb(pal[0], pal[1], 0.5)]]);
    const L = 9;
    for (let i = 0; i < L; i++) {
      const k = i / (L - 1);
      const base = h * (0.25 + k * 0.7), amp = h * r.range(0.03, 0.09), f = r.range(1, 3), sp = r.range(0.3, 1), ph = r() * TAU;
      const col = BS.samplePalette(pal, 0.25 + 0.75 * (1 - k) * 0.9 + 0.1 * k);
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w + 8; x += 8) {
        const xx = x / w;
        ctx.lineTo(x, base + amp * Math.sin(xx * f * TAU + ph + t * sp) + amp * 0.8 * nz.n3(xx * 3 + i, t * 0.15, i));
      }
      ctx.lineTo(w, h); ctx.closePath();
      const g = ctx.createLinearGradient(0, base - amp, 0, h);
      g.addColorStop(0, BS.rgba(col, 0.9)); g.addColorStop(1, BS.rgba(BS.mixRgb(col, pal[0], 0.7), 0.95));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = BS.rgba(BS.mixRgb(col, [255, 255, 255], 0.5), 0.5); ctx.lineWidth = Math.max(1, h / 600); ctx.stroke();
    }
  };

  S.tunnel = function (ctx, w, h, P) {
    const pal = P.pal, r = P.rng, t = P.t;
    ctx.fillStyle = BS.rgba(pal[0]); ctx.fillRect(0, 0, w, h);
    const sides = r.pick([0, 3, 4, 5, 6, 8]), twist = r.range(-0.25, 0.25), speed = r.range(0.8, 1.8);
    const cx = w / 2 + Math.sin(t * 0.6) * w * 0.04, cy = h / 2 + Math.cos(t * 0.45) * h * 0.04;
    const R0 = Math.max(w, h) * 0.9, fr = (t * speed) % 1, base = Math.floor(t * speed);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 34; k >= 1; k--) {
      const d = k - fr; if (d < 0.2) continue;
      const rad = R0 / d, col = pal[1 + ((((k + base) % 4) + 4) % 4)];
      ctx.strokeStyle = BS.rgba(col, BS.clamp(1.4 / Math.sqrt(d), 0.1, 1));
      ctx.lineWidth = Math.max(1, (Math.min(w, h) * 0.05) / d);
      ctx.beginPath();
      const rot = d * twist + t * 0.3;
      if (!sides) ctx.arc(cx, cy, rad, 0, TAU);
      else for (let s = 0; s <= sides; s++) {
        const a = rot + (s / sides) * TAU;
        ctx[s ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.25);
    g.addColorStop(0, BS.rgba(pal[4], 0.8)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  /** Render a style into ctx. opts: {style, palette (hex[]), seed, t, still, grain, vignette} */
  function render(ctx, w, h, opts) {
    const pal = opts.palette.map((c) => (typeof c === 'string' ? BS.hexToRgb(c) : c));
    const P = { pal, seed: opts.seed, rng: BS.rng(opts.seed), noise: getNoise(opts.seed), t: opts.t || 0, still: !!opts.still };
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    (S[opts.style] || S.aurora)(ctx, w, h, P);
    ctx.restore();
    if (opts.vignette) BS.FX.vignette(ctx, w, h, opts.vignette);
    if (opts.grain) BS.FX.grain(ctx, w, h, opts.grain, opts.t || 0);
  }
  const noiseCache = {};
  function getNoise(seed) { return noiseCache[seed] || (noiseCache[seed] = BS.makeNoise(seed)); }

  // ------------- free online AI images (Pollinations, no key) -------------
  function pollinationsUrl(prompt, w, h, seed, model) {
    const q = new URLSearchParams({ width: w, height: h, seed: seed, nologo: 'true', model: model || 'flux' });
    return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?' + q.toString();
  }
  function loadRemoteImage(url, timeoutMs) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => { img.src = ''; rej(new Error('Timed out waiting for the online generator')); }, timeoutMs || 90000);
      img.onload = () => { clearTimeout(timer); res(img); };
      img.onerror = () => { clearTimeout(timer); rej(new Error('Online generator failed (offline, rate-limited or blocked)')); };
      img.src = url;
    });
  }

  // ------------- image motion presets for animating stills -------------
  const MOTIONS = {
    zoomin: { name: 'Slow zoom in', f: (u) => ({ s: 1 + 0.25 * u, x: 0, y: 0, r: 0 }) },
    zoomout: { name: 'Slow zoom out', f: (u) => ({ s: 1.25 - 0.25 * u, x: 0, y: 0, r: 0 }) },
    panleft: { name: 'Pan left', f: (u) => ({ s: 1.2, x: 0.08 - 0.16 * u, y: 0, r: 0 }) },
    panright: { name: 'Pan right', f: (u) => ({ s: 1.2, x: -0.08 + 0.16 * u, y: 0, r: 0 }) },
    panup: { name: 'Tilt up', f: (u) => ({ s: 1.2, x: 0, y: 0.08 - 0.16 * u, r: 0 }) },
    kenburns: { name: 'Ken Burns drift', f: (u) => ({ s: 1.08 + 0.18 * BS.easeInOut(u), x: -0.05 + 0.1 * u, y: 0.04 - 0.07 * u, r: 0 }) },
    spin: { name: 'Slow spin', f: (u) => ({ s: 1.5, x: 0, y: 0, r: u * Math.PI * 0.5 }) },
    handheld: { name: 'Handheld shake', f: (u, t) => ({ s: 1.12, x: 0.012 * Math.sin(t * 2.3) + 0.006 * Math.sin(t * 7.1), y: 0.01 * Math.cos(t * 1.7) + 0.005 * Math.sin(t * 6.3), r: 0.01 * Math.sin(t * 1.3) }) },
    pulse: { name: 'Beat pulse (120 BPM)', f: (u, t) => { const b = (t * 2) % 1; return { s: 1.05 + 0.1 * Math.exp(-b * 6), x: 0, y: 0, r: 0 }; } },
    dolly: { name: 'Dolly zoom + rotate', f: (u) => ({ s: 1 + 0.5 * BS.easeInOut(u), x: 0, y: 0, r: 0.15 * BS.easeInOut(u) }) },
  };
  function drawMotion(ctx, w, h, src, sw, sh, m) {
    ctx.save();
    ctx.translate(w / 2 + m.x * w, h / 2 + m.y * h);
    ctx.rotate(m.r);
    ctx.scale(m.s, m.s);
    BS.drawFit(ctx, src, sw, sh, -w / 2, -h / 2, w, h, 'cover');
    ctx.restore();
  }

  /** Record a canvas animation in real time. draw(t) is called every frame. */
  async function recordAnimation(canvas, duration, fps, draw, onProgress, audio) {
    const mime = BS.pickRecorderMime();
    if (mime === null) throw new Error('This browser cannot record video (MediaRecorder missing).');
    const stream = canvas.captureStream(fps);
    if (audio) audio.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 10e6 } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res) => (rec.onstop = res));
    draw(0);
    rec.start(250);
    const t0 = performance.now();
    await new Promise((resolve) => {
      const loop = () => {
        const t = (performance.now() - t0) / 1000;
        if (t >= duration) { draw(duration); resolve(); return; }
        draw(t);
        if (onProgress) onProgress(t / duration);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    await BS.sleep(120);
    rec.stop();
    await stopped;
    stream.getTracks().forEach((tr) => tr.stop());
    return new Blob(chunks, { type: (mime || 'video/webm').split(';')[0] });
  }

  BS.Gen = {
    PALETTES, STYLES, STYLE_NAMES, MOTIONS,
    analyzePrompt, render, pollinationsUrl, loadRemoteImage, drawMotion, recordAnimation,
  };
})();
