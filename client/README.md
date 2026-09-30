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
