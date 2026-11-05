# Strata Terrain Studio

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
