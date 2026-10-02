# Start version (before 4 October 2026)

The challenge rules allow entering with prior work if its state is documented; only work done during the challenge days (4–6 October 2026) is evaluated. This file records exactly what existed before 4 October. The git tag `start-version` marks the first commit; every commit dated before 4 October 2026 is part of the start version.

## Existed before the challenge days
- **Rendering engine** (`client/src/core/scene.js`): renderer, camera, bloom post-processing, adaptive pixel ratio, frame loop.
- **World 1 environment prototype** (`client/src/scenes/world1.js`): fog, star field, drifting shards, the light orb with float motion, camera follow, tap-to-move.
- **Verse data** (`data/quran/verses.json`): the 27 passages named in the design document, generated from their sources (see `docs/SOURCES.md`).
- **World 1 quiz draft** (`data/content/world1_quiz.json`).
- **World 1 content script draft** (`data/content/world1_script.json`, built by `tools/build_world1_script.py`): all player-facing text in Arabic and English for onboarding, Dalil's fixed lines, the Horizon, World 1 and the short ending, plus 9 pre-written Dalil answers. Added 2 October.
- **Sharia review file** (`docs/review/world1-content-review.pdf`, built by `tools/review_pdf.py`). Added 2 October.
- Verses 57:3 and 29:46 added to `data/quran/verses.json` for two Dalil answers, and every verse stored ayah by ayah (`ayah_texts`). The generator is `tools/extract_verses.py`. Added 2 October.
- **Visual design** for World 1 (a design canvas, not code): visual language (colours, type, components, rules) and 13 screen designs: onboarding, intent, Horizon, station 1, sign, verse card, Dalil answering with a source, Dalil declining and referring, checkpoint, closing, ending, plus two mobile screens in English. Interface labels added to the script under `ui`. Added 2 October.
- **Playable World 1 build** (`client/`), built 2 October:
  - Cinematic engine pass: post-processing chain with chromatic aberration, warp, vignette, grain and fades; adaptive resolution that drops bloom on slow devices; a camera rig with flights, drift and shake that also adapts shots to portrait screens.
  - The cosmos (`client/src/world/`): a baked nebula sky, star layers, a plasma sun, four procedural planets with atmospheres, orbit rings, the light orb with its trail, Dalil's star and particle bursts.
  - The Horizon hub with four gates. The open gate frames the solar system you travel to.
  - Onboarding: language choice, intent question and a pre-journey understanding check.
  - The three stations (`client/src/stations/`): order (drag planets onto their orbits), causes (follow the chain back from a flower), the One (bring two conflicting laws into one). Each ends with a sign, a verse card and a reflection.
  - The closing with its answer card, the post-journey checkpoint, and the ending screen. The ending has the journal, three choices (talk to a person, keep learning, share a verse), 2:256 and the before/after score.
  - The interface (`client/src/ui/`): HUD, verse cards in Amiri Quran with ayah marks, the verse journal, Dalil's panel and the share-card image. Dalil answers only the reviewed fallback answers, always cites its source, and declines and refers for rulings, distress, requests to alter the text, and disrespect.
  - Arabic and English with full right-to-left/left-to-right layout. Fonts are bundled, so nothing loads from a font CDN. Ambient sound is generated with Web Audio. Progress stays on the device.
  - Headless play-through tests: the full journey from the first screen to the ending, real pointer drags for stations 1 and 3, and a phone-size layout check.
- **Fitrah 2.0 modules** (`client/src/modules/`), rebuilt 2–3 October from the design document "Fitrah 2.0 Design Document" (a Claude doc):
  - **Mizan** (`mizan.js`): inside an old star, the player turns the Hoyle-resonance ring out of the carbon window (7.3–7.9 MeV) on both sides and back; the star sheds its carbon as dust. Then each protoplanet is launched like an arrow under Newtonian gravity (velocity Verlet), with a predicted path, a gravity-well grid, fall/escape/lock states, barren-to-living planets and a Kepler-derived chord.
  - **Sabab** (`sabab.js`): one descent from the living planet through a Rayleigh-scattering sky to a backlit leaf the player turns to the sun, into the thylakoid membrane: photosystem II splits water (four photons per O₂), the player leads electrons along the chain (each run pumps protons), and turns ATP synthase (three ATP per turn); then back up the same chain.
  - **Fitrah** (`fitrah.js`): inside the player's light, three layers (hearing, sight, heart) are tuned to the inner tone with audible beats and Kuramoto phase-locking; a second, competing source makes settling impossible until the player lets it go.
  - These replace the three 1.0 stations (`client/src/stations/`, removed). Guidance is now gesture glyphs, with text in assist mode or after a stall; Dalil shows science sources beside verse sources.
  - Five verse passages added to `data/quran/verses.json` by the generator: 41:53, 54:49, 55:7–9, 80:24–32 (plus the existing ones). All new pairings are pending sharia and science review.
- **Dalil test set draft** (`eval/questions.json`, 50 questions) and scoring procedure.
- Design document, idea deck, and a pre-rendered concept video (not part of the product).

## Not built yet (planned for 4–6 October)
- Recitation playback on the verse card (the player is hidden until licensed audio is added).
- Live Dalil: classification, retrieval over the approved sources, constrained answering and validation. The current build uses only the fallback answers.
- Test-set runner and reliability report; user testing with 5–10 people.
- Sharia review sign-off of all text, then deployment, the video and the final presentation.
