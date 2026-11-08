/* Audio toolkit: decoding, beat/onset/tempo detection, and a built-in beat maker synth. */
(function () {
  'use strict';
  const BS = window.BS;
  let sharedCtx = null;

  const AK = (BS.AudioKit = {
    ctx() {
      if (!sharedCtx) sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
      return sharedCtx;
    },
    async decode(blob) {
      const ab = await blob.arrayBuffer();
      const ctx = AK.ctx();
      return await new Promise((res, rej) => {
        const p = ctx.decodeAudioData(ab, res, rej);
        if (p && p.then) p.then(res, rej);
      });
    },
    peaks(buf, n) {
      const out = new Float32Array(n * 2);
      const chs = [];
      for (let c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
      const per = buf.length / n;
      const stride = Math.max(1, Math.floor(per / 400));
      for (let i = 0; i < n; i++) {
        let mn = 0, mx = 0;
        const a = Math.floor(i * per), b = Math.min(buf.length, Math.floor((i + 1) * per));
        for (let j = a; j < b; j += stride) {
          let v = 0;
          for (let c = 0; c < chs.length; c++) v += chs[c][j];
          v /= chs.length;
          if (v < mn) mn = v; if (v > mx) mx = v;
        }
        out[i * 2] = mn; out[i * 2 + 1] = mx;
      }
      return out;
    },
    encodeWav(buf) {
      const nch = Math.min(2, buf.numberOfChannels), sr = buf.sampleRate, len = buf.length;
      const bytes = 44 + len * nch * 2;
      const ab = new ArrayBuffer(bytes), dv = new DataView(ab);
      const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
      ws(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); ws(8, 'WAVE'); ws(12, 'fmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nch, true);
      dv.setUint32(24, sr, true); dv.setUint32(28, sr * nch * 2, true); dv.setUint16(32, nch * 2, true);
      dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, len * nch * 2, true);
      const chs = []; for (let c = 0; c < nch; c++) chs.push(buf.getChannelData(c));
      let o = 44;
      for (let i = 0; i < len; i++) for (let c = 0; c < nch; c++) {
        const v = BS.clamp(chs[c][i], -1, 1);
        dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
      }
      return new Blob([ab], { type: 'audio/wav' });
    },
    gridFromBpm(bpm, offset, duration, beatsPerBar) {
      beatsPerBar = beatsPerBar || 4;
      const p = 60 / bpm, beats = [], downbeats = [];
      let k = -Math.floor(offset / p);
      for (let t = offset + k * p; t < duration; k++, t = offset + k * p) {
        if (t < -1e-6) continue;
        beats.push(Math.max(0, t));
        if (((k % beatsPerBar) + beatsPerBar) % beatsPerBar === 0) downbeats.push(Math.max(0, t));
      }
      return { beats, downbeats };
    },
    energyAt(an, t) {
      if (!an || !an.energy) return 0.6;
      const i = BS.clamp(Math.round(t * an.energyFps), 0, an.energy.length - 1);
      return an.energy[i];
    },
  });

  // ---------------- FFT ----------------
  function makeFFT(N) {
    const levels = Math.log2(N) | 0;
    const rev = new Uint32Array(N);
    for (let i = 0; i < N; i++) {
      let r = 0;
      for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b);
      rev[i] = r;
    }
    const cos = new Float32Array(N / 2), sin = new Float32Array(N / 2);
    for (let i = 0; i < N / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / N); sin[i] = Math.sin((2 * Math.PI * i) / N); }
    return function (re, im) {
      for (let i = 0; i < N; i++) {
        const j = rev[i];
        if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
      }
      for (let size = 2; size <= N; size <<= 1) {
        const half = size >> 1, step = N / size;
        for (let i = 0; i < N; i += size) {
          for (let j = i, k = 0; j < i + half; j++, k += step) {
            const l = j + half;
            const tre = re[l] * cos[k] + im[l] * sin[k];
            const tim = -re[l] * sin[k] + im[l] * cos[k];
            re[l] = re[j] - tre; im[l] = im[j] - tim;
            re[j] += tre; im[j] += tim;
          }
        }
      }
    };
  }

  function movingMean(arr, w) {
    const n = arr.length, out = new Float32Array(n), pre = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + arr[i];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - w), b = Math.min(n, i + w + 1);
      out[i] = (pre[b] - pre[a]) / (b - a);
    }
    return out;
  }
  function normalizeStd(arr) {
    let m = 0; for (const v of arr) m += v; m /= arr.length || 1;
    let s = 0; for (const v of arr) s += (v - m) * (v - m); s = Math.sqrt(s / (arr.length || 1)) || 1;
    const out = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) out[i] = arr[i] / s;
    return out;
  }
  function pickPeaks(env, fps, delta, minGapSec, timeOf) {
    const mean = movingMean(env, Math.round(fps * 0.15));
    const out = [];
    let last = -1e9;
    const gap = Math.round(minGapSec * fps);
    for (let i = 3; i < env.length - 3; i++) {
      const v = env[i];
      if (v < mean[i] + delta) continue;
      if (v < env[i - 1] || v < env[i - 2] || v < env[i - 3] || v <= env[i + 1] || v < env[i + 2] || v < env[i + 3]) continue;
      if (i - last < gap) continue;
      out.push(timeOf(i));
      last = i;
    }
    return out;
  }

  /**
   * Analyse a decoded AudioBuffer: tempo, beat grid (dynamic-programming tracker),
   * downbeats, onsets per frequency band (kick / snare / hats) and a loudness curve.
   */
  AK.analyze = function (buffer, opts) {
    opts = opts || {};
    const sens = opts.sensitivity == null ? 0.5 : opts.sensitivity;
    const sr0 = buffer.sampleRate;
    const step = sr0 >= 88200 ? 4 : sr0 >= 44100 ? 2 : 1;
    const sr = sr0 / step;
    const n = Math.floor(buffer.length / step);
    const mono = new Float32Array(n);
    const nch = buffer.numberOfChannels;
    for (let c = 0; c < nch; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += d[i * step] / nch;
    }
    const N = 1024, hop = 256;
    const frames = Math.max(1, Math.floor((n - N) / hop) + 1);
    const fps = sr / hop;
    const fft = makeFFT(N);
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    const binHz = sr / N, H = N / 2;
    const b = (hz) => BS.clamp(Math.round(hz / binHz), 1, H - 1);
    const LOW = [b(30), b(150)], MID = [b(180), b(4000)], HIGH = [b(6000), H - 1];
    const re = new Float32Array(N), im = new Float32Array(N);
    const prev = new Float32Array(H), mag = new Float32Array(H);
    const flux = new Float32Array(frames), fLow = new Float32Array(frames), fMid = new Float32Array(frames), fHigh = new Float32Array(frames);
    const rms = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      const o = f * hop;
      let e = 0;
      for (let i = 0; i < N; i++) { const v = mono[o + i] || 0; re[i] = v * win[i]; im[i] = 0; e += v * v; }
      rms[f] = Math.sqrt(e / N);
      fft(re, im);
      let a = 0, lo = 0, mi = 0, hi = 0;
      for (let k = 1; k < H; k++) {
        const m = Math.log(1 + 100 * Math.sqrt(re[k] * re[k] + im[k] * im[k]));
        mag[k] = m;
        const d = m - prev[k];
        if (d > 0) {
          a += d;
          if (k >= LOW[0] && k <= LOW[1]) lo += d;
          else if (k >= MID[0] && k <= MID[1]) mi += d;
          else if (k >= HIGH[0] && k <= HIGH[1]) hi += d;
        }
      }
      prev.set(mag);
      if (f > 0) { flux[f] = a; fLow[f] = lo; fMid[f] = mi; fHigh[f] = hi; }
    }
    const timeOf = (f) => (f * hop + N * 0.55) / sr;

    // onset strength envelope (high-passed, std-normalised)
    const hp = (arr) => {
      const mm = movingMean(arr, Math.round(fps * 0.4));
      const out = new Float32Array(arr.length);
      for (let i = 0; i < arr.length; i++) out[i] = Math.max(0, arr[i] - mm[i]);
      return normalizeStd(out);
    };
    const env = hp(flux), envLow = hp(fLow), envMid = hp(fMid), envHigh = hp(fHigh);
    const delta = BS.lerp(2.2, 0.5, sens);
    const onsets = {
      all: pickPeaks(env, fps, delta, 0.07, timeOf),
      low: pickPeaks(envLow, fps, delta * 1.1, 0.12, timeOf),
      mid: pickPeaks(envMid, fps, delta * 1.1, 0.1, timeOf),
      high: pickPeaks(envHigh, fps, delta, 0.06, timeOf),
    };

    // drum-weighted envelope for tempo & beat tracking (kicks/snares define the pulse more than hats)
    const envBeat = new Float32Array(frames);
    for (let i = 0; i < frames; i++) envBeat[i] = 0.5 * env[i] + envLow[i] + 0.6 * envMid[i];
    const envB = normalizeStd(envBeat);

    // ---- tempo via weighted autocorrelation ----
    const minBpm = opts.minBpm || 60, maxBpm = opts.maxBpm || 200;
    const minLag = Math.floor((fps * 60) / maxBpm), maxLag = Math.ceil((fps * 60) / minBpm);
    const acMax = maxLag * 4 + 2;
    const ac = new Float32Array(acMax + 1);
    const L = Math.min(frames, Math.round(fps * 90)); // first ~90 s is plenty
    const off = Math.max(0, Math.floor((frames - L) / 3));
    for (let lag = 1; lag <= acMax; lag++) {
      let s = 0;
      for (let i = off; i < off + L - lag; i++) s += envB[i] * envB[i + lag];
      ac[lag] = s / Math.max(1, L - lag);
    }
    const acAt = (x) => { const i = Math.floor(x), f = x - i; return i + 1 > acMax ? 0 : ac[i] * (1 - f) + ac[i + 1] * f; };
    const lag120 = fps * 0.5;
    // a true beat period repeats at 2x/3x/4x (half-bars, bars) and subdivides into strong 8th notes
    const harmScore = (lag) => acAt(lag) + 0.5 * acAt(lag * 2) + 0.33 * acAt(lag * 3) + 0.25 * acAt(lag * 4) + 0.5 * acAt(lag / 2);
    let best = minLag, bestV = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      // a true beat period also repeats at 2x, 3x and 4x (half-bars, bars)
      const v = harmScore(lag) * Math.exp(-0.5 * Math.pow(Math.log2(lag / lag120) / 1.1, 2));
      if (v > bestV) { bestV = v; best = lag; }
    }
    // very fast tempos are usually hi-hats/8ths: prefer half-time when it explains the music as well
    if ((60 * fps) / best > 158 && best * 2 <= maxLag && harmScore(best * 2) >= 0.8 * harmScore(best)) best = best * 2;
    let lagF = best;
    if (best > minLag && best < maxLag) {
      const y0 = ac[best - 1], y1 = ac[best], y2 = ac[best + 1];
      const den = y0 - 2 * y1 + y2;
      if (den) lagF = best + BS.clamp((0.5 * (y0 - y2)) / den, -0.5, 0.5);
    }
    let bpm = (60 * fps) / lagF;
    while (bpm < 72) bpm *= 2;
    while (bpm > 185) bpm /= 2;
    const period = (60 * fps) / bpm;

    // ---- dynamic-programming beat tracking (Ellis 2007) ----
    const tight = 90;
    const score = new Float32Array(frames), back = new Int32Array(frames).fill(-1);
    const lo = Math.round(period / 2), hi = Math.round(period * 2);
    for (let t = 0; t < frames; t++) {
      let bestS = 0, bestJ = -1;
      for (let j = t - hi; j <= t - lo; j++) {
        if (j < 0) continue;
        const pen = Math.log((t - j) / period);
        const s = score[j] - tight * pen * pen;
        if (bestJ < 0 || s > bestS) { bestS = s; bestJ = j; }
      }
      score[t] = envB[t] + (bestJ >= 0 ? bestS : 0);
      back[t] = bestJ;
    }
    let end = frames - 1, endV = -Infinity;
    for (let t = Math.max(0, frames - Math.round(period)); t < frames; t++) if (score[t] > endV) { endV = score[t]; end = t; }
    const bf = [];
    for (let t = end; t >= 0; t = back[t]) bf.push(t);
    bf.reverse();
    let beats = bf.map(timeOf);
    const pSec = 60 / bpm, duration = buffer.duration;
    if (!beats.length) beats = [0];
    while (beats[0] - pSec > -0.02) beats.unshift(Math.max(0, beats[0] - pSec));
    while (beats[beats.length - 1] + pSec < duration) beats.push(beats[beats.length - 1] + pSec);

    // ---- phase check: drums (kick + snare) should sit ON the beat, not between beats ----
    const fr = (t) => Math.round((t * sr - N * 0.55) / hop);
    const bandAt = (arr, t) => { const f = fr(t); let m = 0; for (let k = f - 2; k <= f + 2; k++) if (k >= 0 && k < frames && arr[k] > m) m = arr[k]; return m; };
    // Compare kick-band and snare-band asymmetry separately and trust the more decisive band:
    // syncopated kicks (phonk, breaks) defer to the backbeat; four-on-the-floor kicks win over off-beat snares.
    let onL = 1e-6, offL = 1e-6, onM = 1e-6, offM = 1e-6;
    for (const t of beats) {
      onL += bandAt(envLow, t); offL += bandAt(envLow, t + pSec / 2);
      onM += bandAt(envMid, t) + 0.5 * bandAt(envHigh, t); offM += bandAt(envMid, t + pSec / 2) + 0.5 * bandAt(envHigh, t + pSec / 2);
    }
    const rL = Math.log(onL / offL), rM = Math.log(onM / offM);
    const vote = Math.abs(rL) > Math.abs(rM) ? rL : rM;
    const onB = Math.exp(Math.max(0, vote)), offB = Math.exp(Math.max(0, -vote));
    if (offB > onB * 1.1) {
      beats = beats.map((t) => t + pSec / 2).filter((t) => t < duration);
      if (beats[0] - pSec > -0.02) beats.unshift(Math.max(0, beats[0] - pSec));
    }

    // ---- downbeats: kick on 1 (and 3), snare/clap on 2 and 4 ----
    let phase = 0, phaseV = -Infinity;
    for (let ph = 0; ph < 4; ph++) {
      let s = 0;
      for (let i = ph; i + 3 < beats.length; i += 4) {
        s += 1.0 * bandAt(envLow, beats[i]) + 0.4 * bandAt(envLow, beats[i + 2])
          + 0.6 * (bandAt(envMid, beats[i + 1]) + bandAt(envMid, beats[i + 3]))
          - 0.6 * (bandAt(envMid, beats[i]) + bandAt(envMid, beats[i + 2]))
          + 0.3 * (bandAt(env, beats[i]));
      }
      if (s > phaseV) { phaseV = s; phase = ph; }
    }
    const downbeats = beats.filter((_, i) => i % 4 === phase);

    // ---- loudness curve ----
    const sm = movingMean(rms, Math.round(fps * 0.6));
    const sorted = Array.from(sm).sort((a, c) => a - c);
    const p5 = sorted[Math.floor(sorted.length * 0.05)] || 0, p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
    const energy = new Float32Array(frames);
    for (let i = 0; i < frames; i++) energy[i] = BS.clamp((sm[i] - p5) / (p95 - p5 || 1), 0, 1);

    return { bpm, period: pSec, beats, downbeats, downbeatPhase: phase, onsets, energy, energyFps: sr / hop, energyOffset: (N * 0.55) / sr, duration };
  };

  // ---------------- Beat maker ----------------
  // Patterns: 16 steps per bar. x = accent, o = soft, . = rest.
  const GENRES = (AK.GENRES = {
    house:     { name: 'House', bpm: 124, kick: 'x...x...x...x...', clap: '....x.......x...', hat: 'o.o.o.o.o.o.o.o.', ohat: '..x...x...x...x.', bass: '..x...x...x...x.', bassType: 'saw', major: true },
    techno:    { name: 'Techno', bpm: 132, kick: 'x...x...x...x...', clap: '....x.......x...', hat: 'xoxoxoxoxoxoxoxo', ohat: '..x...x...x...x.', bass: '.xx..xx..xx..xx.', bassType: 'sub', perc: '...x.....x...x..' },
    trap:      { name: 'Trap', bpm: 140, kick: 'x......x..x.....', snare: '........x.......', clap: '........x.......', hat: 'x.x.x.x.x.x.xxxx', bass: 'x......x..x.....', bassType: '808', rolls: true },
    boombap:   { name: 'Boom Bap', bpm: 90, kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x.......x.x.....', bassType: 'sub', swing: 0.18 },
    dnb:       { name: 'Drum & Bass', bpm: 172, kick: 'x.........x.....', snare: '....x.......x...', hat: 'xoxoxoxoxoxoxoxo', bass: 'x.....x...x.....', bassType: 'saw' },
    dubstep:   { name: 'Dubstep', bpm: 140, kick: 'x.........x.....', snare: '........x.......', hat: 'x.o.x.o.x.o.x.o.', bass: 'x...x...x.x.x...', bassType: 'wobble' },
    reggaeton: { name: 'Reggaeton', bpm: 96, kick: 'x...x...x...x...', snare: '...x..x....x..x.', hat: 'x.o.x.o.x.o.x.o.', bass: 'x...x...x...x...', bassType: 'sub', perc: '..x...x...x...x.' },
    phonk:     { name: 'Phonk', bpm: 130, kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', cowbell: 'x..x..x...x..x..', bass: 'x.....x...x.....', bassType: '808' },
    breakbeat: { name: 'Breakbeat', bpm: 132, kick: 'x.x.......xx....', snare: '....x..x.x..x..x', hat: 'xoxoxoxoxoxoxoxo', bass: 'x.x.......x.....', bassType: 'saw' },
    disco:     { name: 'Disco / Nu-disco', bpm: 118, kick: 'x...x...x...x...', clap: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', ohat: '..x...x...x...x.', bass: 'x.x.x.x.x.x.x.x.', bassType: 'octave', major: true },
  });

  const PROGS_MINOR = [[0, 8, 3, 10], [0, 5, 8, 7], [0, 10, 8, 7], [0, 3, 8, 10]];
  const PROGS_MAJOR = [[0, 7, 9, 5], [0, 5, 7, 5], [9, 5, 0, 7], [0, 9, 5, 7]];
  const QUAL_MINOR = { 0: 'min', 3: 'maj', 5: 'min', 7: 'min', 8: 'maj', 10: 'maj' };
  const QUAL_MAJOR = { 0: 'maj', 5: 'maj', 7: 'maj', 9: 'min', 2: 'min', 4: 'min' };

  /** Render a beat. Returns { buffer, bpm, beats, downbeats, onsets, duration } with sample-exact event times. */
  AK.renderBeat = async function (opts) {
    const g = GENRES[opts.genre] || GENRES.house;
    const bpm = opts.bpm || g.bpm;
    const bars = opts.bars || 16;
    const r = BS.rng(opts.seed || 1);
    const structure = opts.structure || 'drop';
    const spb = 60 / bpm, st = spb / 4;
    const loopLen = bars * 4 * spb;
    const dur = loopLen + 1.2;
    const sr = 44100;
    const oc = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
    const master = oc.createGain(); master.gain.value = 0.9;
    const comp = oc.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.15;
    master.connect(comp); comp.connect(oc.destination);
    const drums = oc.createGain(); drums.gain.value = 0.9; drums.connect(master);
    const music = oc.createGain(); music.gain.value = 0.55; music.connect(master);

    const noise = oc.createBuffer(1, sr * 2, sr);
    { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const key = opts.key == null ? r.int(-5, 6) : opts.key;
    const baseHz = 55 * Math.pow(2, key / 12);
    const prog = r.pick(g.major ? PROGS_MAJOR : PROGS_MINOR);
    const qual = g.major ? QUAL_MAJOR : QUAL_MINOR;

    const tone = (t, f, type, v, decay, dest, f2, attack) => {
      const o = oc.createOscillator(), gg = oc.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + 0.06);
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.linearRampToValueAtTime(v, t + (attack || 0.004));
      gg.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(gg); gg.connect(dest || drums);
      o.start(t); o.stop(t + decay + 0.05);
      return o;
    };
    const noiseHit = (t, v, type, freq, q, decay, dest) => {
      const s = oc.createBufferSource(); s.buffer = noise;
      const f = oc.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const gg = oc.createGain();
      gg.gain.setValueAtTime(v, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      s.connect(f); f.connect(gg); gg.connect(dest || drums);
      s.start(t, Math.random() * 1.5); s.stop(t + decay + 0.05);
    };
    const V = {
      kick(t, v) {
        const o = oc.createOscillator(), gg = oc.createGain();
        o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
        gg.gain.setValueAtTime(1.1 * v, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
        o.connect(gg); gg.connect(drums); o.start(t); o.stop(t + 0.45);
        noiseHit(t, 0.25 * v, 'highpass', 3000, 0.7, 0.012);
      },
      snare(t, v) { noiseHit(t, 0.6 * v, 'highpass', 1300, 0.7, 0.2); tone(t, 200, 'triangle', 0.35 * v, 0.11); },
      clap(t, v) { for (let k = 0; k < 3; k++) noiseHit(t + k * 0.011, 0.5 * v, 'bandpass', 1500, 1.4, k < 2 ? 0.02 : 0.2); },
      hat(t, v) { noiseHit(t, 0.22 * v, 'highpass', 8000, 0.7, 0.045); },
      ohat(t, v) { noiseHit(t, 0.18 * v, 'highpass', 7500, 0.7, 0.28); },
      perc(t, v) { tone(t, 900, 'sine', 0.25 * v, 0.08); },
      cowbell(t, v, i) {
        const f = [1, 1.5, 1.335, 1.122][i % 4];
        const bp = oc.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.2; bp.connect(drums);
        tone(t, 560 * f, 'square', 0.12 * v, 0.3, bp); tone(t, 845 * f, 'square', 0.08 * v, 0.3, bp);
      },
      crash(t) { noiseHit(t, 0.28, 'highpass', 5000, 0.5, 1.8); },
    };
    const bassNote = (t, len, semi, type, v) => {
      let s = semi; if (s > 6) s -= 12;
      const f = baseHz * Math.pow(2, s / 12);
      if (type === '808') {
        const ws = oc.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(2.2 * x); }
        ws.curve = curve; ws.connect(music);
        tone(t, f * 2.2, 'sine', 0.95 * v, Math.max(0.35, len * 1.4), ws, f, 0.003);
        return;
      }
      if (type === 'sub') { tone(t, f, 'sine', 0.9 * v, Math.max(0.2, len), music, 0, 0.005); return; }
      const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = type === 'wobble' ? 8 : 4;
      lp.connect(music);
      if (type === 'wobble') {
        const lfo = oc.createOscillator(), lg = oc.createGain();
        lfo.frequency.value = (bpm / 60) * r.pick([2, 3, 4]);
        lg.gain.value = 900; lp.frequency.value = 1000;
        lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t); lfo.stop(t + len + 0.1);
        tone(t, f, 'sawtooth', 0.55 * v, len + 0.05, lp, 0, 0.01);
        tone(t, f * 1.005, 'square', 0.3 * v, len + 0.05, lp, 0, 0.01);
        return;
      }
      lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(250, t + Math.max(0.15, len));
      const ff = type === 'octave' ? f * 2 : f;
      tone(t, ff, 'sawtooth', 0.5 * v, Math.max(0.18, len), lp, 0, 0.005);
    };
    const pad = (t, len, semi) => {
      const q = qual[((semi % 12) + 12) % 12] || 'min';
      const notes = [0, q === 'maj' ? 4 : 3, 7, 12];
      const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(music);
      const gg = oc.createGain(); gg.gain.setValueAtTime(0.0001, t);
      gg.gain.linearRampToValueAtTime(0.05, t + 0.25); gg.gain.setValueAtTime(0.05, t + len - 0.2);
      gg.gain.linearRampToValueAtTime(0.0001, t + len); gg.connect(lp);
      notes.forEach((n) => {
        [-6, 6].forEach((det) => {
          const o = oc.createOscillator(); o.type = 'sawtooth';
          o.frequency.value = baseHz * 4 * Math.pow(2, (semi + n) / 12); o.detune.value = det;
          o.connect(gg); o.start(t); o.stop(t + len + 0.05);
        });
      });
    };
    const riser = (t, len) => {
      const s = oc.createBufferSource(); s.buffer = noise; s.loop = true;
      const f = oc.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(9000, t + len);
      const gg = oc.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.35, t + len);
      gg.gain.linearRampToValueAtTime(0.0001, t + len + 0.02);
      s.connect(f); f.connect(gg); gg.connect(master); s.start(t); s.stop(t + len + 0.05);
    };

    const ev = { kick: [], snare: [], hat: [], all: [] };
    const on = (p, s) => p && p[s] !== '.' && p[s] != null;
    const vel = (p, s) => (p[s] === 'x' ? 1 : 0.6);
    const sectionOf = (bar) => {
      if (structure !== 'drop') return 'full';
      const b = bar % 16;
      return b < 4 ? 'intro' : b < 8 ? 'build' : 'drop';
    };

    for (let bar = 0; bar < bars; bar++) {
      const sec = sectionOf(bar);
      const barT = bar * 4 * spb;
      const chord = prog[bar % 4];
      const fillBar = structure !== 'drop' ? bar % 4 === 3 : false;
      if (bar % 8 === 0 && (sec === 'drop' || sec === 'full') && bar > 0) V.crash(barT);
      if (sec !== 'build' || (bar % 16) < 6) pad(barT, 4 * spb, chord);
      if (sec === 'build' && bar % 16 === 6) riser(barT, 8 * spb);
      for (let s = 0; s < 16; s++) {
        const t = barT + s * st + (s % 2 ? (g.swing || 0) * st : 0);
        const hits = [];
        // kick
        let kickOn = on(g.kick, s);
        if (sec === 'intro') kickOn = s % 4 === 0 && (bar % 16) >= 2;
        if (sec === 'build') kickOn = s % 4 === 0 && (bar % 16) < 7;
        if (kickOn) { V.kick(t, sec === 'drop' || sec === 'full' ? vel(g.kick, s) : 0.8); hits.push('kick'); }
        // snare / clap
        let snareOn = false;
        if (sec === 'build') {
          const b = bar % 16; const div = b === 4 ? 4 : b === 5 ? 2 : 1;
          snareOn = s % div === 0;
          if (snareOn) V.snare(t, 0.4 + 0.6 * ((b - 4) * 16 + s) / 64);
        } else if (sec !== 'intro') {
          if (on(g.snare, s)) { V.snare(t, vel(g.snare, s)); snareOn = true; }
          if (on(g.clap, s)) { V.clap(t, vel(g.clap, s)); snareOn = true; }
          if (fillBar && s >= 12 && r.chance(0.7) && !snareOn) { V.snare(t, 0.55); snareOn = true; }
        }
        if (snareOn) hits.push('snare');
        // hats
        if (sec !== 'build' || (bar % 16) < 7) {
          if (on(g.hat, s)) {
            V.hat(t, vel(g.hat, s)); hits.push('hat');
            if (g.rolls && s % 4 === 2 && r.chance(0.3)) { V.hat(t + st / 3, 0.5); V.hat(t + (2 * st) / 3, 0.5); }
          }
          if (on(g.ohat, s) && sec !== 'intro') { V.ohat(t, 1); hits.push('hat'); }
          if (on(g.perc, s) && sec !== 'intro') V.perc(t, 1);
          if (on(g.cowbell, s) && sec !== 'intro') V.cowbell(t, 1, s);
        }
        // bass
        if (on(g.bass, s) && (sec === 'drop' || sec === 'full')) {
          let nx = s + 1; while (nx < 16 && !on(g.bass, nx)) nx++;
          bassNote(t, (nx - s) * st * 0.95, chord + (g.bassType === 'octave' && s % 4 === 2 ? 12 : 0), g.bassType, 1);
        }
        if (hits.includes('kick')) ev.kick.push(t);
        if (hits.includes('snare')) ev.snare.push(t);
        if (hits.includes('hat')) ev.hat.push(t);
        if (hits.length) ev.all.push(t);
      }
    }
    const buffer = await oc.startRendering();
    const beats = [], downbeats = [];
    for (let k = 0; k < bars * 4; k++) { beats.push(k * spb); if (k % 4 === 0) downbeats.push(k * spb); }
    return {
      buffer, bpm, period: spb, beats, downbeats, duration: buffer.duration, genre: g.name, exact: true,
      onsets: { all: ev.all, low: ev.kick, mid: ev.snare, high: ev.hat },
    };
  };
})();
