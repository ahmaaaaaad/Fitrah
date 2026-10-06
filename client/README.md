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

## Fitrah · Tafakor

A separate entry page (`fitrah.html`) holds the cinematic menu and its two paths:

- **Fitrah — The Four Questions**: one guided level, the Chamber of Questions (`src/levels/fitrah/`). Who created me? Why am I here? How should I live? What comes after death?
- **Tafakor — Explore the Signs**: The Water first (`src/levels/water/`); The Mountains and The Space are listed as coming later, with no content yet.

```
npm run dev:fitrah      # http://localhost:5173/fitrah.html (POST /api/dalil answers 503 without ANTHROPIC_API_KEY)
npm run build:fitrah    # static build in dist-fitrah/ (flat files; each level is its own chunk, the engine and verses are shared chunks)
npm run build:server    # ../server/dist/fitrah-server.mjs, then `npm run serve:prod` (see ../server/README.md)
```

Routes: `fitrah.html` (the menu), `#tafakor/en` (the Tafakor list), `#fitrah/en`, `#water/ar` (a level directly), `#menu/ar`.
URL options: `?q=cinematic|high|mobile|balanced|performance` (force a quality profile; `?q=low` is the lightest), `?review` (reviewers' tools: jumps, decisions for review, Dalil's status, first-version notes), `?debug` (readout), `?speed=4` (hurry pauses and reading times, for review), `?depth=learning` (Fitrah: skip the depth question), `?final=30:50` (The Water: the alternative final verse).

- `src/shell/` – the menu (main list and the Tafakor list, the same atmosphere, type and motion), the veil between menu and scene, routing. No WebGL: a level's code loads only when it is chosen. A Tafakor world returns to the Tafakor list.
- `src/levels/registry.js` – the paths and the level definitions (id, category, title, status, scene loader, still). Adding a world is one entry here plus one folder whose entry module exports `mount(ctx)`.
- `src/levels/fitrah/` – the Fitrah level: `chamber.js` (the hall, the circular aperture onto the golden spiral, rings, floor and haze, blended per chapter state), `director.js` (the beats), `chain.js` (chapter 1: trace the path), `pillars.js` (chapter 3: the five pillars, met one by one, then joined), `dalil.js` (his figure, walk, light, voice and questions), `reveal.js` (verses and the hadith reference), `camera.js` (named shots and fitting to the safe region), `ui.js`, `audio.js`. All player-facing text is in `data/content/fitrah.json`.
- `src/levels/water/` – The Water. Provisional decisions live in `config.js`; the in-game menu lists them, can jump to any beat for review, and leads back to the scenes.
- `src/core/sacred/` – verified verse records (re-hashed before display), content types, whole-answer validation. Shared by every level.
- `src/core/dalil/ask.js` – Dalil's AI adapters (server route, artifact `sample`, reviewed answers), shared by every level.
- `src/core/help/talk.js` – "Talk to someone", read from `data/config/human-help.json`: honest while no destination is verified, with consent before anything is shared once one is.
- `src/core/device.js`, `src/core/framing.js` – how the player touches the screen, the safe interaction region (minus the dialogue panel's band), and camera framing that keeps a set of world points inside it.
- `src/core/scene.js` – renderer, quality profiles (cinematic / high / balanced / performance, chosen from screen, memory and GPU), dynamic resolution, and the post chain: render → guard pass (replaces NaN/infinite pixels, the cause of the mobile black screen) → bloom → output.
- `src/core/lens.js` – one composition for every screen: shots are composed for 16:9 and adapted to the screen in hand (a wider lens up to a natural limit, then a step back), so a phone held upright sees the same scene, not a crop of its middle.
- `src/core/gesture-surface.js` – the canvas owns its touches: touch + hold + drag never starts a text selection or the iOS "Copy / Translate" bar; selection elsewhere (verses, explanations) is untouched.
- `validateTargets()` in `src/core/framing.js` – checks interaction targets as the player sees them (on screen, inside the safe region, clear of the interface, far enough apart).
- `src/core/figures.js` – the player and Dalil as rim-lit silhouettes (no faces), with arm, lantern, walking and speaking poses and a floor reflection.
- `src/core/ui/caption.js` – the one dialogue panel used by every level: bottom edge, RTL/LTR per line, safe areas, lifts above buttons and cards.
- `src/core/analytics.js` – anonymous events, sent only when the host page declares an endpoint (the production server does with `ANALYTICS=1`).

**Fitrah.** The level opens on a wide view of a small figure before an immense aperture of golden light. Dalil walks to the player's side and stays there. He asks once how familiar Islam is (new to me / I know the basics / I'm Muslim, remind me; nothing is stored) and words every explanation for that depth. Four lights rise, one per question. In chapter 1 the player traces a visible path from their own light ("Start here") to what came before them (parents, those before them, the earth, the sun, the stars), each named "has a Creator", and finds that the last link reaches into nothing that explains itself; then 52:35, then the answer and 39:62. In chapter 3 five columns of light are met one by one (tap one, or "Next pillar"), each with its symbol, Dalil's explanation and its verse a tap away, then joined into one building. Chapters 2 and 4 have their story, sources and answers, with a lighter step in place of the interactions still being built. The ending gathers the four answers with 30:30 and offers Tafakor, Ask Dalil, Talk to someone, or the beginning. Tap Dalil, use the Ask button, or press `?` to ask him; Enter links the next point of the chain without a pointer.

**The Water.** The player is a witness: gestures follow what the world is already doing and change only attention (camera, lens, a knot of light), never the weather. Drag along the wind and the first water (trace), drag through the rain to look closer (reveal), drag from the cloud to the flower (connect), keep the ring on the thinning cloud (align). Dalil words each instruction for the way the player is touching the screen ("Click and hold, then follow it." / "Touch and hold, then drag along it."). Tap Dalil or press `/` to ask him. Holding Space follows with assistance.

Tests (see `tests/`): `node tests/fitrah_validation.mjs`, `node tests/water_validation.mjs`; with `dist-fitrah` served on :8771 (or `PORT=…`), `tests/fitrah_playthrough.py` plays the four questions from the menu to the end card and `tests/water_full_playthrough.sh` plays The Water through Tafakor, both with real gestures on desktop or an emulated phone.
