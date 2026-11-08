/* Visual effects. Real-time friendly (canvas compositing, GPU accelerated) + a few per-pixel
   effects for still photos. All functions operate on a 2D context at identity transform. */
(function () {
  'use strict';
  const BS = window.BS;
  const bufs = {};
  function buf(name, w, h) {
    let b = bufs[name];
    if (!b) { b = bufs[name] = BS.makeCanvas(w, h); b.ctx = b.getContext('2d'); }
    if (b.width !== w || b.height !== h) { b.width = w; b.height = h; }
    return b;
  }
  function snapshot(ctx, w, h, name) {
    const b = buf(name || 'snap', w, h);
    b.ctx.globalCompositeOperation = 'copy';
    b.ctx.globalAlpha = 1; b.ctx.filter = 'none';
    b.ctx.drawImage(ctx.canvas, 0, 0, w, h);
    b.ctx.globalCompositeOperation = 'source-over';
    return b;
  }
  let grainTiles = null;
  function getGrain() {
    if (grainTiles) return grainTiles;
    grainTiles = [];
    for (let k = 0; k < 4; k++) {
      const c = BS.makeCanvas(256, 256), x = c.getContext('2d');
      const img = x.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (Math.random() - 0.5) * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      grainTiles.push(c);
    }
    return grainTiles;
  }
  let scanTile = null;

  const FX = (BS.FX = {
    snapshot,
    rgbSplit(ctx, w, h, amt, angle) {
      if (Math.abs(amt) < 0.5) return;
      angle = angle || 0;
      const dx = Math.cos(angle) * amt, dy = Math.sin(angle) * amt;
      const src = snapshot(ctx, w, h, 'rgb_src');
      const ch = buf('rgb_ch', w, h), c = ch.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      [['#f00', -dx, -dy], ['#0f0', 0, 0], ['#00f', dx, dy]].forEach(([col, ox, oy]) => {
        c.globalCompositeOperation = 'copy'; c.drawImage(src, 0, 0);
        c.globalCompositeOperation = 'multiply'; c.fillStyle = col; c.fillRect(0, 0, w, h);
        ctx.drawImage(ch, ox, oy);
      });
      ctx.restore();
      c.globalCompositeOperation = 'source-over';
    },
    glitch(ctx, w, h, amt, rng) {
      if (amt <= 0.02) return;
      rng = rng || Math.random;
      const src = snapshot(ctx, w, h, 'gl_src');
      const n = Math.round(3 + amt * 14);
      ctx.save();
      for (let i = 0; i < n; i++) {
        const y = rng() * h, hh = Math.max(2, rng() * h * 0.08 * (0.3 + amt));
        const dx = (rng() - 0.5) * w * 0.15 * amt;
        ctx.drawImage(src, 0, y, w, hh, dx, y, w, hh);
        if (rng() < 0.25 * amt) {
          ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = `hsla(${rng() * 360},100%,50%,0.6)`;
          ctx.fillRect(0, y, w, hh); ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.restore();
    },
    invert(ctx, w, h, alpha) {
      if (alpha <= 0) return;
      ctx.save(); ctx.globalCompositeOperation = 'difference'; ctx.globalAlpha = BS.clamp(alpha, 0, 1);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.restore();
    },
    flash(ctx, w, h, alpha, color) {
      if (alpha <= 0.005) return;
      ctx.save(); ctx.globalAlpha = BS.clamp(alpha, 0, 1); ctx.fillStyle = color || '#fff'; ctx.fillRect(0, 0, w, h); ctx.restore();
    },
    tint(ctx, w, h, color, alpha, mode) {
      if (alpha <= 0) return;
      ctx.save(); ctx.globalCompositeOperation = mode || 'color'; ctx.globalAlpha = BS.clamp(alpha, 0, 1);
      ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.restore();
    },
    vignette(ctx, w, h, amt) {
      if (amt <= 0) return;
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) / 2);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${BS.clamp(amt, 0, 1)})`);
      ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
    },
    grain(ctx, w, h, amt, t) {
      if (amt <= 0) return;
      const tiles = getGrain(), tile = tiles[Math.floor((t || 0) * 24) % tiles.length];
      ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = BS.clamp(amt, 0, 1) * 0.6;
      const pat = ctx.createPattern(tile, 'repeat');
      const ox = Math.floor(Math.random() * 256), oy = Math.floor(Math.random() * 256);
      ctx.translate(-ox, -oy); ctx.fillStyle = pat; ctx.fillRect(0, 0, w + ox, h + oy); ctx.restore();
    },
    scanlines(ctx, w, h, amt) {
      if (amt <= 0) return;
      if (!scanTile) { scanTile = BS.makeCanvas(1, 4); const x = scanTile.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0.9)'; x.fillRect(0, 2, 1, 2); }
      ctx.save(); ctx.globalAlpha = BS.clamp(amt, 0, 1) * 0.5;
      const scale = Math.max(1, Math.round(h / 540));
      ctx.scale(scale, scale);
      ctx.fillStyle = ctx.createPattern(scanTile, 'repeat'); ctx.fillRect(0, 0, w / scale, h / scale); ctx.restore();
    },
    pixelate(ctx, w, h, size) {
      size = Math.round(size);
      if (size < 2) return;
      const sw = Math.max(1, Math.ceil(w / size)), sh = Math.max(1, Math.ceil(h / size));
      const b = buf('pix', sw, sh);
      b.ctx.imageSmoothingEnabled = true; b.ctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, sw, sh);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(b, 0, 0, sw, sh, 0, 0, w, h); ctx.restore();
    },
    filter(ctx, w, h, filterStr) {
      if (!filterStr || filterStr === 'none') return;
      const src = snapshot(ctx, w, h, 'flt_src');
      ctx.save(); ctx.globalCompositeOperation = 'copy'; ctx.filter = filterStr; ctx.drawImage(src, 0, 0); ctx.restore();
    },
    blur(ctx, w, h, px) { if (px >= 0.5) FX.filter(ctx, w, h, `blur(${px.toFixed(1)}px)`); },
    hue(ctx, w, h, deg) { if (Math.abs(deg) >= 1) FX.filter(ctx, w, h, `hue-rotate(${Math.round(deg)}deg)`); },
    mirror(ctx, w, h, mode) {
      if (!mode || mode === 'none') return;
      const src = snapshot(ctx, w, h, 'mir_src');
      ctx.save();
      if (mode === 'h' || mode === 'quad') { ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(src, 0, 0, w / 2, h, 0, 0, w / 2, h); ctx.setTransform(1, 0, 0, 1, 0, 0); }
      if (mode === 'v' || mode === 'quad') {
        const s2 = mode === 'quad' ? snapshot(ctx, w, h, 'mir_src2') : src;
        ctx.translate(0, h); ctx.scale(1, -1); ctx.drawImage(s2, 0, 0, w, h / 2, 0, 0, w, h / 2);
      }
      ctx.restore();
    },
    letterbox(ctx, w, h, frac) {
      if (frac <= 0) return;
      const bh = h * frac;
      ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh, w, bh); ctx.restore();
    },
    vhs(ctx, w, h, amt, t) {
      if (amt <= 0) return;
      FX.rgbSplit(ctx, w, h, w * 0.003 * amt);
      FX.scanlines(ctx, w, h, amt * 0.8);
      const r = BS.rng(Math.floor(t * 30) + 1);
      ctx.save();
      // tracking band
      const by = ((t * 0.15) % 1.2) * h - h * 0.1;
      const src = snapshot(ctx, w, h, 'vhs_src');
      ctx.drawImage(src, 0, by, w, h * 0.04, (r() - 0.5) * w * 0.02 * amt, by, w, h * 0.04);
      ctx.globalAlpha = 0.08 * amt; ctx.fillStyle = '#fff'; ctx.fillRect(0, by, w, h * 0.01);
      ctx.restore();
      FX.grain(ctx, w, h, amt * 0.5, t);
    },
    caption(ctx, w, h, text, opts) {
      if (!text) return;
      opts = opts || {};
      const size = (opts.size || 0.12) * Math.min(w, h) * (opts.scale || 1);
      ctx.save();
      ctx.font = `${opts.weight || 900} ${size}px ${opts.font || 'Impact, "Arial Black", system-ui, sans-serif'}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const x = w / 2, y = h * (opts.y == null ? 0.5 : opts.y);
      ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
      if (opts.outline !== false) { ctx.lineWidth = size * 0.08; ctx.strokeStyle = opts.stroke || '#000'; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y); }
      if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = size * 0.4; }
      ctx.fillStyle = opts.color || '#fff'; ctx.fillText(text, x, y);
      ctx.restore();
    },

    // ---------- per-pixel (stills) ----------
    pixelOp(ctx, w, h, fn) {
      const img = ctx.getImageData(0, 0, w, h), d = img.data;
      fn(d, w, h);
      ctx.putImageData(img, 0, 0);
    },
    posterize(ctx, w, h, levels) {
      if (!levels || levels >= 32) return;
      const step = 255 / (levels - 1);
      FX.pixelOp(ctx, w, h, (d) => { for (let i = 0; i < d.length; i += 4) { d[i] = Math.round(d[i] / step) * step; d[i + 1] = Math.round(d[i + 1] / step) * step; d[i + 2] = Math.round(d[i + 2] / step) * step; } });
    },
    duotone(ctx, w, h, c1, c2, amt) {
      if (!amt) return;
      const a = BS.hexToRgb(c1), b = BS.hexToRgb(c2);
      FX.pixelOp(ctx, w, h, (d) => {
        for (let i = 0; i < d.length; i += 4) {
          const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
          for (let k = 0; k < 3; k++) d[i + k] = d[i + k] * (1 - amt) + (a[k] + (b[k] - a[k]) * l) * amt;
        }
      });
    },
    halftone(ctx, w, h, cell) {
      if (!cell || cell < 3) return;
      const img = ctx.getImageData(0, 0, w, h), d = img.data;
      ctx.save(); ctx.fillStyle = '#f4efe6'; ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
        const i = ((Math.min(h - 1, y + (cell >> 1))) * w + Math.min(w - 1, x + (cell >> 1))) * 4;
        const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        const r = (cell / 2) * Math.sqrt(1 - l) * 1.25;
        if (r < 0.3) continue;
        ctx.fillStyle = `rgb(${d[i] * 0.6},${d[i + 1] * 0.6},${d[i + 2] * 0.6})`;
        ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, r, 0, BS.TAU); ctx.fill();
      }
      ctx.restore();
    },
    sharpen(ctx, w, h, amt) {
      if (!amt) return;
      const src = ctx.getImageData(0, 0, w, h), s = src.data, out = ctx.createImageData(w, h), o = out.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        for (let k = 0; k < 3; k++) {
          if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { o[i + k] = s[i + k]; continue; }
          const lap = 4 * s[i + k] - s[i - 4 + k] - s[i + 4 + k] - s[i - w * 4 + k] - s[i + w * 4 + k];
          o[i + k] = s[i + k] + lap * amt;
        }
        o[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
    },
  });
})();
