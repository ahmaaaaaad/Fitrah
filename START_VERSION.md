# Start version (before 4 October 2026)

The challenge rules allow entering with prior work if its state is documented; only work done during the challenge days (4–6 October 2026) is evaluated. This file records exactly what existed before 4 October. The git tag `start-version` marks this commit.

## Existed before the challenge days
- **Rendering engine** (`client/src/core/scene.js`): renderer, camera, bloom post-processing, adaptive pixel ratio, frame loop.
- **World 1 environment prototype** (`client/src/scenes/world1.js`): fog, star field, drifting shards, the light orb with float motion, camera follow, tap-to-move.
- **Verse data** (`data/quran/verses.json`): the 27 passages named in the design document, generated from their sources (see `docs/SOURCES.md`).
- **World 1 quiz draft** (`data/content/world1_quiz.json`).
- **Dalil test set draft** (`eval/questions.json`, 50 questions) and scoring procedure.
- Design document, idea deck, and a pre-rendered concept video (not part of the product).

## Not built yet (planned for 4–6 October)
- Onboarding and the Horizon hub.
- World 1 stations (order, causes, oneness), the closing, and the understanding checkpoint.
- Verse card, recitation playback, the verse journal, and the short ending.
- Dalil: classification, retrieval, constrained answering, validation, fallback answers.
- Test-set runner and reliability report; user testing with 5–10 people.
- Deployment, video, final presentation.
