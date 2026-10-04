# Fitrah – client

Three.js + GSAP, bundled with Vite.

```
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173). Tap or click anywhere to glide the orb.

- `src/core/scene.js` – renderer, camera, bloom post-processing, adaptive pixel ratio, frame loop (`onUpdate`)
- `src/scenes/world1.js` – World 1 (the cosmos): fog, stars, drifting shards, the light orb, camera follow
- `src/main.js` – entry point

## Fitrah: the scenes (The Water first)

The menu of scenes and its levels, a separate entry page. The Water (formerly "The Revival") is the first scene;
The Light and The Balance are listed as placeholders for later.

```
npm run dev:fitrah      # http://localhost:5173/fitrah.html (POST /api/dalil answers 503 without ANTHROPIC_API_KEY)
npm run build:fitrah    # static build in dist-fitrah/ (flat files; each level is its own chunk)
```

Routes: `fitrah.html` (the menu), `#water/en` or `#water/ar` (The Water directly), `#menu/ar`.
URL options: `?q=low` (lighter scene), `?debug` (simulation readout), `?speed=4` (faster simulation for review), `?final=30:50` (show the alternative final verse).

- `src/shell/` – the menu, the veil between menu and scene, routing. No WebGL: a level's code loads only when it is chosen.
- `src/levels/registry.js` – the level definitions (id, title, description, status, scene loader, still). Adding a level is one entry here plus one folder whose entry module exports `mount(ctx)`; leaving a level reloads the page into the menu, so every scene starts from a clean world.
- `src/levels/water/` – The Water. Provisional decisions live in `config.js`; the in-game menu lists them, can jump to any beat for review, and leads back to the scenes.
- `src/core/device.js` – how the player touches the screen (mouse, touch, pen) and the safe interaction region (safe-area insets, the corner menu, room for a fingertip).
- `src/core/framing.js` – calculated camera framing that keeps a set of world points inside that region.

The player is a witness: gestures follow what the world is already doing and change only attention (camera, lens, a knot of light), never the weather. Drag along the wind and the first water (trace), drag through the rain to look closer (reveal), drag from the cloud to the flower (connect), keep the ring on the thinning cloud (align). Dalil words each instruction for the way the player is touching the screen ("Click and hold, then follow it." / "Touch and hold, then drag along it."). Tap Dalil or press `/` to ask him. Holding Space follows with assistance.

Tests (see `tests/`): `node tests/water_validation.mjs`; with `dist-fitrah` served on :8771, `tests/water_full_playthrough.sh` plays The Water from the menu with real gestures on desktop or an emulated phone (portrait and landscape) and returns to the menu.
