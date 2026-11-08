/* Media library shared by every tool: uploads + everything you generate lands here. */
(function () {
  'use strict';
  const BS = window.BS;
  let nextId = 1;
  const listeners = [];

  const Library = (BS.Library = {
    items: [],
    onChange(fn) { listeners.push(fn); },
    emit() { listeners.forEach((fn) => fn(Library.items)); },
    get(id) { return Library.items.find((i) => i.id === id); },
    byKind(kind) { return Library.items.filter((i) => i.kind === kind); },
    visuals() { return Library.items.filter((i) => i.kind === 'image' || i.kind === 'video'); },
    remove(id) {
      const it = Library.get(id);
      if (!it) return;
      Library.items = Library.items.filter((i) => i.id !== id);
      try { URL.revokeObjectURL(it.url); } catch (e) { /* ignore */ }
      Library.emit();
    },

    kindOf(file) {
      const t = file.type || '';
      if (t.startsWith('image/')) return 'image';
      if (t.startsWith('video/')) return 'video';
      if (t.startsWith('audio/')) return 'audio';
      const n = (file.name || '').toLowerCase();
      if (/\.(png|jpe?g|gif|webp|bmp|avif)$/.test(n)) return 'image';
      if (/\.(mp4|webm|mov|m4v|mkv|ogv)$/.test(n)) return 'video';
      if (/\.(mp3|wav|ogg|m4a|aac|flac|opus)$/.test(n)) return 'audio';
      return null;
    },

    async addFile(file) {
      const kind = Library.kindOf(file);
      if (!kind) { BS.toast('Unsupported file: ' + file.name, 'error'); return null; }
      return Library.addBlob(file, file.name, kind);
    },

    async addBlob(blob, name, kind, extra) {
      kind = kind || Library.kindOf(blob);
      const item = Object.assign({
        id: 'm' + nextId++, kind, name: name || kind, blob, url: URL.createObjectURL(blob),
        selected: kind !== 'audio', width: 0, height: 0, duration: 0, thumb: null, el: null,
      }, extra || {});
      try {
        if (kind === 'image') await loadImage(item);
        else if (kind === 'video') await loadVideo(item);
        else if (kind === 'audio') await loadAudio(item);
      } catch (e) {
        console.warn(e);
        BS.toast('Could not read ' + item.name + ' (format not supported by this browser?)', 'error');
        URL.revokeObjectURL(item.url);
        return null;
      }
      Library.items.push(item);
      Library.emit();
      return item;
    },

    async addCanvas(canvas, name, extra) {
      const blob = await BS.canvasToBlob(canvas, 'image/png');
      return Library.addBlob(blob, name, 'image', extra);
    },
  });

  function loadImage(item) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        item.el = img;
        item.width = img.naturalWidth;
        item.height = img.naturalHeight;
        item.thumb = thumbFrom(img, item.width, item.height);
        res();
      };
      img.onerror = rej;
      img.src = item.url;
    });
  }

  function loadVideo(item) {
    return new Promise((res, rej) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      let settled = false;
      const fail = (e) => { if (!settled) { settled = true; rej(e || new Error('video load failed')); } };
      v.onerror = () => fail(v.error);
      v.onloadedmetadata = () => {
        item.width = v.videoWidth; item.height = v.videoHeight;
        item.duration = isFinite(v.duration) ? v.duration : (item.duration || 0);
        if (!item.duration) {
          // Some recorded webm files report Infinity until the end is probed.
          v.currentTime = 1e9;
          v.ontimeupdate = () => { v.ontimeupdate = null; item.duration = v.duration || 1; v.currentTime = 0.01; };
        } else v.currentTime = Math.min(item.duration * 0.15, 2);
      };
      v.onseeked = () => {
        if (settled || !item.duration || !isFinite(item.duration)) return;
        if (v.currentTime > item.duration - 0.01 && item.duration > 0.1) { v.currentTime = Math.min(item.duration * 0.15, 2); return; }
        settled = true;
        item.el = v;
        item.thumb = thumbFrom(v, item.width, item.height);
        res();
      };
      setTimeout(() => fail(new Error('timeout')), 20000);
      v.src = item.url;
    });
  }

  async function loadAudio(item) {
    const buf = await BS.AudioKit.decode(item.blob);
    item.audioBuffer = buf;
    item.duration = buf.duration;
    item.thumb = waveThumb(buf);
  }

  function thumbFrom(src, w, h) {
    const c = BS.makeCanvas(160, 100);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 160, 100);
    try { BS.drawFit(ctx, src, w, h, 0, 0, 160, 100, 'cover'); } catch (e) { /* tainted */ }
    return c.toDataURL('image/jpeg', 0.7);
  }

  function waveThumb(buf) {
    const c = BS.makeCanvas(160, 100);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 160, 100);
    g.addColorStop(0, '#2a1250'); g.addColorStop(1, '#0d2a4a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 160, 100);
    const peaks = BS.AudioKit.peaks(buf, 160);
    ctx.fillStyle = '#ff4f9a';
    for (let i = 0; i < 160; i++) {
      const a = peaks[i * 2], b = peaks[i * 2 + 1];
      ctx.fillRect(i, 50 + a * 44, 1, Math.max(1, (b - a) * 44));
    }
    return c.toDataURL('image/jpeg', 0.7);
  }
})();
