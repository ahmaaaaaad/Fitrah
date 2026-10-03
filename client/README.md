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

## The Revival prototype

A separate entry page for the vertical slice of Fitrah 2.0's first world.

```
npm run dev:revival      # http://localhost:5173/revival.html (POST /api/dalil answers 503 without ANTHROPIC_API_KEY)
npm run build:revival    # static build in dist-revival/
```

URL options: `?q=low` (lighter scene), `?debug` (simulation readout), `?speed=4` (faster simulation for review), `?final=30:50` (show the alternative final verse).
Provisional decisions live in `src/revival/config.js`. The in-game menu lists them and can jump to any beat for review.

The player is a witness: gestures follow what the world is already doing and change only attention (camera, lens, a knot of light), never the weather. Drag along the wind and the first water (trace), drag through the rain to look closer (reveal), drag from the cloud to the flower (connect), keep the ring on the thinning cloud (align). Tap Dalil or press `/` to ask him. Holding Space follows with assistance.
