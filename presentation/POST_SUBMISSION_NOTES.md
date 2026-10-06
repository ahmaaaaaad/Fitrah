# Post-submission notes

Observed while preparing the presentation. **None of this was changed in the game**, which stays frozen at the release candidate (commit `24122ad`). These are candidates for after the competition.

- **Physical devices.** All phone testing so far is emulation (headless Chromium, real touch events). Check an iPhone (Safari) and an Android phone (Chrome): framing, resolution, frame rate, the selection behaviour during drags.
- **Upright phones, the four questions.** To keep all four question lights and their names on an upright phone, the camera opens to a wide lens (about 84° vertical) for that shot. A slightly tighter spread of the outer lights would allow a narrower lens.
- **The Water's rain veil.** The layer the player wipes away to look through the rain is still a flat screen overlay; a version with real depth would match the rest of the rain.
- **The pool in the rain.** At the cloud-to-flower moment the pool sits at the right edge in heavy rain and haze, and reads as water more than as a pool. A clearer view of it, or a later moment that shows it, would help.
- **The Water's lens on upright phones.** It keeps at least 50° of horizontal view by widening the vertical lens (up to 85°), rather than the step-back used in Fitrah.
- **Review tools.** Chapter jumps for demos need `?review`; a presenter-friendly way to jump to a chapter without the review panel might help live demos.
- **Chapters 2 and 4** keep their guided step; their interactions are designed (rotate, notice) and not built.
- **Hadith of the five pillars.** Enter its text from a verified edition and confirm the numbering.
- **Dalil test set.** Specialist review of the expected behaviours, then run and publish the scores.
- **Referral wording.** When a question is referred (e.g. a ruling), Dalil's reviewed line ends "Shall I connect you with a specialist?" while the Talk to someone panel (correctly) says no person is connected yet. The line could say "Shall I show you where to ask?" until a partner exists.
- **Specks near the pillars.** In some chapter 3 frames a few small square specks show near the columns (likely the dust or a motif sprite at a small size).
- **Referral before the model is word-list based.** In Fitrah, ruling and distress questions are caught by keyword lists; a ruling question phrased without those words reaches the model (which is instructed not to give rulings, and whose answer is still validated). The Water has no pre-model referral and no Talk to someone yet.
- **Validation scope.** The "three consecutive words of a stored verse" check runs on Arabic letters only; an English answer that quotes the translation would pass it.
- **Reviewed fallback.** When a model answer is withheld, the reviewed answer is the closest keyword match across the level, not one written for the current chapter.
- **Review status in the data.** The project has confirmed the verse selection, but `data/quran/verses.json` still records `review_status: pending_sharia_review` for each verse, and The Water's config comments still call 57:17 provisional. Update the records when the review is formalised.
- **Dalil test set.** `eval/questions.json` was written for the earlier World 1 guide (start version); adapt it to Fitrah and The Water before running it.
