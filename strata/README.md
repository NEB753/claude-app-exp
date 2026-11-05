# Strata Terrain Sculptor

A single-file, phone-first terrain generator and sculptor (Three.js r128 from cdnjs).

- **Shape**: 7 presets, seed, fBm + ridged noise with domain warp, central peak, crater, island falloff, terraces.
- **Sculpt**: raise, lower, smooth, flatten, roughen, paint, with mirror symmetry. One finger sculpts and two fingers move the camera. Undo and redo.
- **Erode**: droplet hydraulic erosion, thermal weathering, smooth and sharpen.
- **Paint & biome**: four palettes; sea, beach, snow line, rock slope and vegetation; hand-painted materials.
- **Export** (.zip): GLB or OBJ+MTL with a baked albedo, terrain UVs as one seamless 0–1 island, and an optional watertight base for 3D printing. Also a 16-bit PNG + RAW heightmap.
- **Helper**: Guides with one-tap setups, plus an Ask chat that can change the terrain when opened as a Claude artifact.

`index.html` is written in the Claude artifact body format (no `<html>`/`<head>`). To host it elsewhere, wrap it in a standard HTML skeleton. Downloads fall back to normal browser downloads outside Claude.
