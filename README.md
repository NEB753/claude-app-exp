# BeatForge Studio

An all-in-one **photo & video generator** with a **beat-synced PMV / music-video editor**, inspired by beat-sync apps like Beatleap and VidBeat. It's free, needs no installs, API keys or build step, and runs entirely in your browser. Your media is never uploaded anywhere.

## Run it

Open `index.html` in Chrome, Edge or Firefox. You can also serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

It works as a static site, so it also runs on GitHub Pages, Netlify and similar hosts. Chromium-based browsers give the best results, because they can export MP4 directly.

## What's inside

### ✦ Create: image & video generator
- **Procedural art engine**, which is offline and instant. It has 11 styles: aurora, nebula/space, flow field, synthwave, landscape, night city, geometric, stained glass, kaleidoscope, waves and tunnel/vortex.
  - Style and palette are read from your prompt. For example, "neon city at night" gives the night-city style with a neon palette, and colour words like "pink and cyan" become the palette.
  - Seeds are reproducible. You can make 1–8 variations, and every aspect ratio and size up to 2560px is supported.
- **Optional free AI images** come from [Pollinations.ai](https://pollinations.ai) (no key needed). If it can't be reached, the app falls back to procedural art.
- **Video generator** has two modes:
  - Turn a prompt into an *animated* procedural scene. Every style animates.
  - Turn any image into a video with camera motion: zoom, pan, Ken Burns, spin, handheld shake, beat pulse or dolly.
  - You can add a soundtrack from your library. Finished videos go to the library, so you can use them as Beat Sync clips.

### ◐ Photo Lab: edit input images (or frames from videos)
- **Adjust:** brightness, contrast, saturation, hue, temperature, sepia, grayscale, blur and sharpen.
- **Effects:** RGB split, glitch, pixelate, posterize, halftone, duotone, tint, scanlines, VHS, grain, vignette, mirror/kaleido and invert.
- **Extras:** text captions, crop to aspect, rotate/flip, and 12 one-click presets such as Film, Noir, Vaporwave, Cyberpunk, VHS, Pop art and Glitch.
- **Export:** PNG or JPG, or save the result back to the library.

### ♫ Beat Sync / PMV generator
1. **Music:** upload a song, use the audio from any video, or **generate a beat** with the built-in synth. The synth has 10 genres (house, techno, trap, boom bap, DnB, dubstep, reggaeton, phonk, breakbeat and disco) and offers an intro → build-up → drop structure. Generated beats have a sample-exact beat grid.
2. **Beat detection:** tempo comes from autocorrelation, and beats from a dynamic-programming tracker. It also finds downbeats and separate kick, snare and hi-hat hits. You can force a BPM, nudge the sync, shift the grid by half a beat, move the bar start, or change hit sensitivity.
3. **Clips:** pick any videos or images in the library. Clip order can be shuffled, random or sequential. Start points can be random, forward-skipping or continuous. You can also skip clip intros and outros, add stutter/repeat cuts, and add random speed ramps (0.5×–2×). Images get Ken Burns motion.
4. **Cut rhythm:** 17 beat types. You can mix several and switch between them every N bars:
   - every beat, every 2 beats, every bar or every 2 bars
   - 8ths, 16ths, triplets, off-beats or tresillo 3-3-2
   - kick hits, snare hits, hi-hat hits or any hit
   - build-up (accelerating), follow-the-energy, random rhythm, or no cuts (FX only)
5. **Transitions:** 18 types, with frequency and length (in beats) controls:
   - hard cut, white flash, dip to black or crossfade
   - zoom punch, zoom pull, whip pan, whip up or spin
   - glitch, RGB hit, blur, strobe or pixelate
   - diagonal wipe, iris, impact shake or film burn
6. **Beat effects:** 13 effects, each with its own trigger and amount. Triggers are beats, off-beats, bars, kick, snare, hats, any hit, or cuts. The effects are:
   - zoom pulse, shake, tilt, flash, RGB split, glitch
   - invert, strobe, hue jump, blur pulse, vignette pump, mirror and pixel hit
7. **Look:** colour grades, grain, VHS, vignette, letterbox, words that flash on the beat, an intro title, and fades.
8. **Presets:** Classic PMV, Hype edit, Chill montage, Trap/phonk, Glitchcore and Cinematic trailer.
9. **Timeline:** shows a waveform with beat, bar, kick and snare markers and colour-coded cuts. Click to seek, or select a single cut and re-roll it. Use 🎲 to re-roll all cuts, and set a seed to reproduce an edit.
10. **Export:** MP4 (where supported) or WebM in 16:9, 9:16, 1:1, 4:5 or 21:9, at 480p–1080p and 24/30/60 fps. You can export just a time range of the song.

Click **✨ Demo** in the library to generate 8 images and a house beat instantly, then press ▶.

## How it works (all free, no servers)
| Piece | Technique |
|---|---|
| Image generation | Seeded Perlin noise, fBm domain warping, Voronoi and flow fields on Canvas 2D |
| Beat detection | FFT spectral flux (full band, low, mid and high), autocorrelation tempo, Ellis-style DP beat tracking |
| Beat maker | Web Audio `OfflineAudioContext` synthesis (kick, snare, clap, hats, 808, wobble bass, pads, risers) |
| Rendering | Real-time Canvas compositor, with pre-seeked `<video>` pools so cuts land on the beat |
| Effects | GPU-friendly canvas compositing (`lighter`, `multiply`, `difference`, `ctx.filter`) |
| Export | `canvas.captureStream()` with Web Audio → `MediaRecorder` (MP4/H.264 or WebM) |

Export records in real time, so a 3-minute edit takes 3 minutes. Keep the tab visible while it records.

## Files
```
index.html          app shell
css/style.css       styles (responsive down to phone width)
js/util.js          seeded RNG, noise, colour, DOM helpers
js/audio.js         decoding, beat/onset/tempo analysis, beat-maker synth, WAV encoder
js/library.js       shared media library
js/generator.js     procedural styles, AI fallback, motion presets, animation recorder
js/fx.js            real-time + still-image effects
js/beatsync.js      cut planner, transitions, renderer, exporter, timeline
js/app.js           UI wiring
```
