# Challenge log (4–6 October 2026)

Work done during the challenge days. Everything that existed before is listed in `START_VERSION.md`.

## 4 October

### The Revival: the player as witness

A creative correction made the player a witness, never a creator: the player does not make rain, move clouds, bring light, revive the earth or control balance. The prototype (`client/revival.html`, `client/src/revival/`) was rebuilt around it.

- **The world acts on its own time.** The director drives the weather (`sim.js`: `worldGather`, `worldWind`, `worldWet`, `worldThin`). No player input writes into the simulation.
- **Discovery gestures** (`interact.js`): Trace (follow the wind current; follow the first water down the dry stream bed, which is also how the player walks), Reveal (a lens through the rain onto the cracked soil, closing again when attention moves), Connect (cloud, rain, soil, water, flower) and Align (keep the observation field on a cloud as it thins by itself). Gestures change only attention: the camera, the lens, a knot of light. No failure; one gentle observation after a stall; holding Space follows with assistance.
- **Phenomena** (`phenomena.js`): wind filaments and chaff along the current, raindrops striking the soil near the player, Dalil's pointing arc, the glow behind a thinning cloud, the first flower in the meadow.
- **Route:** the valley is now walked downhill (north to south), so following water is physically right.
- **Dalil as a first-class system** (`dalil/brain.js`): guide (notices, points, leads, waits), interpreter (explains what was witnessed and, after reading time, what a verse says) and companion (near, steps aside for revelations, sits beside the player at the end). Lines carry content types and run under a per-sequence silence budget (`dalil/lines.js`).
- **Semantic events and content types** (`events.js`): Dalil, the director, audio and the AI context engine share events such as PLAYER_TRACED_WIND and PLAYER_FINISHED_READING_VERSE. Every text is QURAN_ARABIC, TRANSLATION, DALIL_EXPLANATION, NARRATIVE_DIALOGUE or EDUCATIONAL_CONTEXT, and the interface labels it.
- **Three-layer revelation** (`verse.js`): Arabic, then translation, then Dalil's explanation in a separate labelled card after the reader's time. Verse-first at the stream; Dalil-first-then-verse at the light.
- **AI context engine** (`dalil/prompt.js`): the model receives scene, environmental state, current interaction, current verse, recent events, the last exchanges, approved knowledge and language, and must answer with one of Dalil's content types. Validation now also rejects answers that give the player or Dalil divine agency.
- **Light climax:** the break glows at its rim while the player keeps it in view, then the canopy separates by itself; shafts pour through the whole opening, colours warm, motes light up, exposure breathes and settles.
- **Design document:** section 0 "Creative correction: the player is a witness (binding)" added to the Fitrah 2.0 — The Revival design document; sections 4 and 13 marked as superseded.
- **Tests:** full play-through with real pointer gestures (trace, reveal, connect, align) from arrival to the end card; validation unit check extended (`client/tests/revival_validation.mjs`).
