# Strata Terrain Studio

A phone-first terrain studio (Three.js r128 from cdnjs, no build step). Open `index.html` as a Claude artifact. To host it elsewhere, wrap it in a standard HTML skeleton; the `js/` files load relative to it.

**Creation modes (dock)**
- **Generate**: presets, seed with 4 live variations, a 2-axis *character pad* (gentle↔rugged, young↔ancient) that drives several sliders at once, and accordion sliders. Each slider has a tap-to-type value, a randomize button, and long-press to reset.
- **Nodes**: a heightfield node graph with live thumbnails. Node types: Noise, Ridged, Mountain, Volcano, Dunes, Cells, Gradient, Constant, Warp, Terrace, Levels, Invert, Blur, Scale height, Normalize, Rain erosion, Weathering, Height/Slope masks, Combine (8 blend modes plus a mask input), and Output. Also templates, and live or manual builds.
- **Sculpt**: Raise, Lower, Smooth, Flatten, Roughen, Terrace, Erode (local droplets), Stamp (mountain, volcano, crater, mesa, ridge, dune, lake basin), Paint and Plant (vegetation mask). Mirror mode and Apple Pencil pressure.
- **Fluid Gen**: a shallow-water pipe-model simulation with rain, springs, sea boundary, sediment transport and carving. Pausing bakes rivers and wet soil, and vegetation responds. AI prompt: "describe the water".
- **Photo**: landscape photo (Claude reads a top-down height plan, water, palette, vegetation, rocks and cabins), grayscale heightmap, ridge sketch (distance transform), or contour map.
- **Biome**: palettes and coloring, plus rule-based instanced scatter: conifers, broadleaf trees, bushes, grass, boulders, cabins and watchtowers.
- **Export**: GLB (terrain + base + scatter meshes), watertight OBJ, or 16-bit PNG/RAW heightmap. Each comes with a baked albedo (up to 4096 px) and slope/water/vegetation/snow masks. Terrain UVs are one seamless 0–1 island.

**Performance**: quality tiers run from Battery (129²) to Ultra (1025²). The scene renders only on change, water animation sleeps after 15 s idle, the fluid sim has a 7 ms frame budget on a coarser grid, and undo depth scales to a memory budget. Projects autosave to IndexedDB.
