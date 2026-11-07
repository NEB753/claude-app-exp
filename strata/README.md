# Terrain Gen Studio V1

A phone-first terrain studio with no build step. It uses Three.js r128 from cdnjs. Open `index.html` as a Claude artifact, or deploy it as a website with the included GitHub Pages workflow (`.github/workflows/strata-pages.yml`).

**Tabs**
- **Create**: Generate (presets, seeds and variations, a 2-axis character pad, sliders), Nodes (heightfield graph with live thumbnails, templates, saved graphs), and Photo (AI reads terrain plus roads, rivers, bridges and buildings; heightmap; ridge sketch; contour map; thin-line filtering).
- **Sculpt**: Raise, Lower, Smooth, Flatten, Roughen, Terrace, Erode, Stamp, Paint and Plant. Evenly spaced dabs, an Airbrush option, mirror mode, pen pressure, and a size/strength HUD.
- **Simulate**: Water (shallow-water pipe model with sediment carving), Lava (vents, viscous flow, cooling into basalt), Snow (snowfall with avalanching), Wind (dune migration with slip faces) and Erosion. Each has quick/medium/long/endless runs with a progress ring and auto-bake.
- **Biome**: palettes and coloring, plus rule-based instanced conifers, broadleaf trees, bushes, grass, boulders, cabins, towers and bridges.
- **Export**: Blender/Godot GLB (albedo, tangent-space normal and ORM maps baked from full-res heights, tiles, node-instanced scatter with a palette atlas), an Unreal Engine 5 kit (UE-sized 16-bit heightmap, layer weightmaps, PBR textures, foliage meshes and an instance CSV), a Unity kit (RAW heightmap, splat layers, tree CSV), a 3D-print watertight OBJ, and a custom mode.

**Home**: Creations (projects with thumbnails saved in IndexedDB), Library, and Settings (quality, theme, units, controls, AI, storage).

**Gestures**: double-tap to focus. Long-press the terrain for quick actions. Swipe the sheet header up/down to resize it, or left/right to switch tabs. Sliders: drag anywhere, move your finger away from the bar for fine control, double-tap to reset, long-press for options. Long-press a dock tab for shortcuts.

**AI**: inside Claude it uses the built-in AI. On the website, add an Anthropic API key in Settings. Calls go through the official `@anthropic-ai/sdk` in the browser with the key stored on the device only.

**Performance**: quality tiers from 129² to 1025². Renders only on change, idle sleep, frame-budgeted simulations on a coarser grid, and a memory-bounded undo stack.

**V1 additions**
- **Mobile flow**: compact panels that slide away while you orbit or sculpt, a clear-view mode, a landscape layout (side panel), a job queue, and an animated progress window.
- **Sculpt**: Shape / Detail / Surface groups; new Pinch, Crease, Smudge and Mask brushes; tip shapes (soft, sharp, plateau, spray); symmetry (mirror, radial 3/4/6); a stroke stabilizer; dust particles, sound and haptics.
- **Photo**: Auto mode (AI classifies sketch, contour, shaded relief, satellite or ground photo), a shape-from-shading solver, and an automatic inversion check against water and the AI plan. Roads are typed by material; buildings by type and material; props too.
- **Simulate**: wind dunes now conserve sand; new events: Hurricane, Tornado (animated funnel), Earthquake (fault scarp + camera shake), Rockslide and Blizzard.
- **Biome**: fir/pine, oak/birch, fallen logs and stumps, storm damage turning forest into deadfall, a forest-density control, houses, fences, wells, lamps, crates and hay bales. Trees check their whole footprint against sea, lakes and riverbeds.
- **Nodes**: 14 more (Billow, Island mask, Crater field, Stratify, Canyons, Rivers, Flow map, Curvature, Clamp, Fold, Twist, Tilt, Sediment fill, Curve with a touch curve editor) and 4 more templates. There's an animated node guide with a live looping preview for every node.
- **Also new**: first-person walk/fly with a joystick; a time-of-day strip and angle dials; drifting cloud shadows; and a synthesized sound engine (clicks, sculpting, rain, lava, wind, quakes).

**V1.1**
- **Compact interface**: smaller controls, tighter spacing and one consistent size scale. Settings → Larger controls brings the big version back.
- **Performance**:
  - Shadows are recomputed only when the land or sun changes.
  - Resolution drops slightly while you drag and snaps back when you stop.
  - Sculpting re-seats trees instead of re-placing them.
  - Lighter glass blur.
- **Haptics**: Capacitor native haptics in the test app, vibration on Android, and iOS 18+ Safari ticks via the system switch control.
- **Test app**: `native/` is a Capacitor wrapper (see `native/README.md`); `build-web.sh` builds the installable, offline-capable PWA used by GitHub Pages.
- **First person**: a floating thumb joystick, smoothed look, Run, Jump with gravity, head bob, a swoop-in entry and a camera shortcut.
- **Camera & render mode**:
  - Lenses from 0.5× to 5×.
  - Grades: Natural, Golden hour, Cinematic, Moody, Vivid, Arctic and Noir.
  - Tilt-shift depth blur with a draggable focus band, vignette, grain, exposure and a rule-of-thirds grid.
  - HQ photos up to 4096 px.
  - Videos (Turntable, Flyover, Drift) as MP4 or WebM.
  - Render mode applies the same pipeline (with anti-aliasing) to the live view.

**V1.2**
- **Instant sound**: taps and toggles sound on finger-down instead of after release, with a low-latency audio context that's unlocked on the first touch.
- **Appearance** (Settings):
  - Interface size: Compact, Regular or Large.
  - Six color themes: Forest, Ocean, Ember, Violet, Graphite and Sakura. Each has light and dark variants.
  - Style: Liquid glass, Solid (no blur, fastest) or Minimal (flat, no bevels).
- **Minimal create**:
  - The Generate, Nodes and Photo switch now sits in the panel header.
  - Generate opens on **New world** and **Variation** buttons and a row of landscape cards.
  - The pad, seed, variations and sliders are folded under **Fine-tune**.
  - Brush, simulation settings and coloring start collapsed.
  - Tips are hidden unless you turn on Show tips.
- **Fix**: ridged presets no longer generate a single NaN height cell, which caused a stray vertex. Saved creations are repaired when opened.

**V1.3**
- **Natural generation**:
  - Gentler domain warp and rounded ridge crests.
  - New **Weathering** step: slopes settle to the angle of repose and rain droplets carve gullies and fans, so there are no needle peaks or swirly warps. Adjust it under Fine-tune → Landform.
  - Presets retuned.
- **Water**:
  - Seamless wind-wave normals with two scrolling layers at real-world scale that flatten with distance (no spirals or droplet blobs).
  - Correct linear-space colors and depth absorption on the seabed (turquoise shallows, deep teal).
  - Shorelines no longer flare with sun glare.
- **Textures**: procedural tiling grass/soil and rock textures with bump detail. Rock is projected from three directions on cliffs and blended by slope; snow stays clean.
- **Photo to terrain**, rebuilt:
  - A local analyzer classifies every pixel (sky, water, snow, vegetation, rock, dry ground) and detects the image type.
  - **Ground photos**: the skyline sets the far crests, the mountain face is laid out toward you, and lakes become level water at the mountain foot (reflections included). Peak height follows how tall the mountains look. The result opens from the photographer's viewpoint.
  - **Maps and satellite images**: shading is integrated in the light direction that best agrees with land cover; water stays lowest.
  - **Hillshades and heightmaps** are told apart automatically.
  - Every result gets a beauty pass: detail, weathering, water kept level and below the land, and no leftover sea from the previous landscape. Trees grow only where the picture shows vegetation, never on snow.
  - Hazy blue mountains and misty hills stay land: water needs a wide, clearly colored region with a level shoreline.
- **Palette from the photo**: class colors are pulled into believable ranges (e.g. haze-blue rock is neutralized) and saved with the creation as "From photo".

**V1.4**
- **Depth from a single photo**: ground photos are no longer laid out as a wall of mountains.
  - Each pixel gets a distance from three cues: atmospheric haze (dark-channel estimate), the ground plane below the horizon, and height in the frame.
  - Going down each column, nearer ridges hide farther ones and slopes are capped at real rock and forest angles.
  - Every visible point is projected through a ~65° camera to its real place on the map. Far peaks land far away and tall, near hills close and low, valleys open between ridges, and lakes lie flat in front of the mountains. Hidden backsides are filled smoothly.
  - The result opens from the photographer's eye position.
