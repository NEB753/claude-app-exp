/* BeatForge Studio — shared utilities (no dependencies, works from file://) */
(function () {
  'use strict';
  const BS = (window.BS = window.BS || {});

  // ---------- math ----------
  BS.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  BS.lerp = (a, b, t) => a + (b - a) * t;
  BS.smooth = (t) => t * t * (3 - 2 * t);
  BS.easeOut = (t) => 1 - Math.pow(1 - t, 3);
  BS.easeIn = (t) => t * t * t;
  BS.easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  BS.TAU = Math.PI * 2;

  // ---------- seeded randomness ----------
  BS.hashStr = function (str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return h1 >>> 0;
  };
  BS.rng = function (seed) {
    let a = seed >>> 0;
    const r = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + (hi - lo) * r();
    r.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * r());
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    r.sign = () => (r() < 0.5 ? -1 : 1);
    return r;
  };
  BS.randomSeed = () => Math.floor(Math.random() * 1e9);

  // ---------- Perlin noise (seeded) ----------
  BS.makeNoise = function (seed) {
    const r = BS.rng(seed);
    const perm = [];
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
    }
    const p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const L = (t, a, b) => a + t * (b - a);
    const grad = (h, x, y, z) => {
      h &= 15;
      const u = h < 8 ? x : y;
      const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
      return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    };
    function n3(x, y, z) {
      const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
      const X = fx & 255, Y = fy & 255, Z = fz & 255;
      x -= fx; y -= fy; z -= fz;
      const u = fade(x), v = fade(y), w = fade(z);
      const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
      const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
      return L(w,
        L(v, L(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
             L(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
        L(v, L(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
             L(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
    }
    function fbm(x, y, z, oct) {
      oct = oct || 5;
      let s = 0, a = 0.5, f = 1;
      for (let i = 0; i < oct; i++) { s += a * n3(x * f, y * f, z * f); f *= 2; a *= 0.5; }
      return s;
    }
    return { n3, fbm };
  };

  // ---------- color ----------
  BS.hexToRgb = function (hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  BS.rgbToHex = (c) => '#' + c.map((v) => BS.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  BS.rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? 1 : a})`;
  BS.mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  BS.samplePalette = function (pal, t) {
    t = BS.clamp(t, 0, 0.99999) * (pal.length - 1);
    const i = Math.floor(t);
    return BS.mixRgb(pal[i], pal[Math.min(i + 1, pal.length - 1)], t - i);
  };
  BS.hsl = function (h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    return [f(0), f(8), f(4)];
  };

  // ---------- canvas helpers ----------
  BS.makeCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };
  // Draw a source (image / video / canvas) to fill (cover) or fit (contain) a box.
  BS.drawFit = function (ctx, src, sw, sh, x, y, w, h, mode) {
    if (!sw || !sh) return;
    const s = mode === 'contain' ? Math.min(w / sw, h / sh) : Math.max(w / sw, h / sh);
    const dw = sw * s, dh = sh * s;
    ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  };
  BS.mediaSize = function (el) {
    if (!el) return [0, 0];
    if (el.videoWidth) return [el.videoWidth, el.videoHeight];
    if (el.naturalWidth) return [el.naturalWidth, el.naturalHeight];
    return [el.width || 0, el.height || 0];
  };
  BS.canvasToBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type || 'image/png', q));

  BS.ASPECTS = {
    '16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1], '4:5': [4, 5], '4:3': [4, 3], '21:9': [21, 9],
  };
  BS.sizeFor = function (aspect, longSide) {
    const a = BS.ASPECTS[aspect] || [16, 9];
    let w, h;
    if (a[0] >= a[1]) { w = longSide; h = (longSide * a[1]) / a[0]; } else { h = longSide; w = (longSide * a[0]) / a[1]; }
    // even dimensions keep video encoders happy
    return [Math.round(w / 2) * 2, Math.round(h / 2) * 2];
  };

  // ---------- recording ----------
  BS.pickRecorderMime = function (preferMp4) {
    if (typeof MediaRecorder === 'undefined') return null;
    const mp4 = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'];
    const webm = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const list = preferMp4 === false ? webm.concat(mp4) : mp4.concat(webm);
    for (const m of list) if (MediaRecorder.isTypeSupported(m)) return m;
    return '';
  };
  BS.extForMime = (m) => (m && m.indexOf('mp4') >= 0 ? 'mp4' : 'webm');

  // ---------- DOM ----------
  BS.$ = (s, root) => (root || document).querySelector(s);
  BS.$$ = (s, root) => Array.from((root || document).querySelectorAll(s));
  BS.h = function (tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    if (children) (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  };
  BS.fmtTime = function (s) {
    if (!isFinite(s)) s = 0;
    const m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  };
  BS.download = function (blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  };
  let toastTimer = null;
  BS.toast = function (msg, kind) {
    let t = BS.$('#toast');
    if (!t) { t = BS.h('div', { id: 'toast' }); document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = ''), kind === 'error' ? 6000 : 3200);
  };
  BS.nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  BS.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // binary search: index of last element <= t, or -1
  BS.lastIndexLE = function (arr, t) {
    let lo = 0, hi = arr.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  };
  BS.waitEvent = function (el, ev, timeout) {
    return new Promise((res) => {
      let done = false;
      const fin = (ok) => { if (done) return; done = true; el.removeEventListener(ev, h); res(ok); };
      const h = () => fin(true);
      el.addEventListener(ev, h);
      if (timeout) setTimeout(() => fin(false), timeout);
    });
  };
})();
