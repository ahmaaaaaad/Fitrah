# Challenge log (4–6 October 2026)

Work done during the challenge days. Everything that existed before is listed in `START_VERSION.md`.

## 5 October

### Design: Fitrah and Tafakor

A new Game Design & Technical Architecture document, "Fitrah — Game Design & Technical Architecture" (a Claude doc), restructures the product into two paths: **Fitrah**, the guided four-question level (Who created me? Allah. Why am I here? To worship Allah. How should I live? Arkan al-Islam. What comes after death? Al-Akhirah), and **Tafakor** (تفكّر), the contemplation worlds, with The Water as the first and The Mountains and The Space as placeholders. It covers the four chapters beat by beat in one transforming "Chamber of Questions", one interaction per chapter, the sources for each answer (mostly already in `data/quran/verses.json`, plus 39:62, 47:19, 3:97, 98:5 and the hadith of the five pillars to add), Dalil as a visible educator with three knowledge levels, source-first answering and validated structured output, an honest "Talk to someone" path, the level registry and content model, performance tiers, acceptance criteria and the implementation priority order.

## 4 October

### The Water: the first scene of Fitrah, a menu of scenes, clearer instructions, mobile framing

The approved build was kept as the reference before anything changed (branch `reference/the-water`). Then, without redesigning the experience:

- **Renamed and organised into levels.** The Revival is now **The Water** (`client/src/levels/water/`), one level of Fitrah. `client/src/levels/registry.js` defines the levels (`id`, `title`, `description`, `status`, scene loader, still); The Light and The Balance are listed as placeholders with no content. A new entry page (`client/fitrah.html`, `client/src/shell/`) holds the menu: a still from The Water, slow motes of light, the name, and the scenes as a quiet list. Choosing The Water lowers a veil with its title while the scene loads behind it; leaving (from the in-game menu or the end card) returns to the menu. No scores, stars or progression.
- **Dalil says what to do with the hands.** Each gesture's instruction is worded for the way the player is touching the screen: "Click and hold, then follow it." with a mouse, "Touch and hold, then drag along it." on a phone, "Press and hold…" with a pen (`client/src/core/device.js`, `dalil/lines.js`). He says it as he points (wind, rain, water, the chain, the thinning cloud), and one reminder after a stall. Silence budgets were adjusted so the chain's explanation is no longer dropped.
- **The four points always on screen.** The chain's points are kept inside a calculated safe interaction region (viewport, safe-area insets, the corner menu, room for a fingertip) by a framing solver (`client/src/core/framing.js`): the authored frame wherever it already fits (desktop, landscape phone), otherwise the least turn, otherwise centred with a wider lens; recalculated when the screen turns or resizes. The same check keeps the thinning cloud reachable in the light sequence. Touch targets and tolerances are a little larger under a finger.
- **Tests:** full play-throughs from the menu with real gestures on desktop and on emulated phones in portrait and landscape (real touch events), checking all four points are inside the screen, then back to the menu and into The Water again (`client/tests/water_full_playthrough.sh`).

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
