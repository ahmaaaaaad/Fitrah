# Fitrah — presentation notes

Everything in this folder was made for the competition presentation. The game was not changed to make it: every image here was captured from the existing release-candidate build (commit `24122ad`), served as it is, with the game running in a headless browser.

| File | What it is |
| --- | --- |
| `PRESENTATION_NOTES.md` | This file: the deck's outline, a live-demo path, likely questions with honest answers, and what to say about limits |
| `POST_SUBMISSION_NOTES.md` | Things noticed while preparing the deck that were deliberately **not** changed in the game |
| `assets/` | The screenshots used in the deck, as captured from the build (desktop 1600×900, hero frames 1920×1080, phone frames 780×1688; The Water's gesture thumbnails are crops of 960×540 captures) |
| `deck-source/` | A copy of the deck's slide files (HTML, with the speaker notes in each `<aside>`) and its index; images are referenced by the deck's asset ids |

The deck itself is a Slides artifact ("Fitrah — Competition Presentation"). It can be presented from its page and downloaded as PowerPoint or PDF. It is private until it is shared from the page's Share menu. Every slide has speaker notes with the full script.

## Outline (17 slides, about 8 minutes)

| # | Slide | Point to land |
| --- | --- | --- |
| 1 | Fitrah · فطرة | The product in one line, on its own first frame |
| 2 | The four questions | Everyone asks them; Fitrah lets the player discover the answers |
| 3 | Two paths | Fitrah (the four questions) and Tafakor (experiential worlds) |
| 4 | Four chapters | Question → what the player meets → answer → sources |
| 5 | Discovery before the answer | Chapter 1's chain: each link "has a Creator", then 52:35 |
| 6 | Five pillars, one building | Meet each pillar, then they join |
| 7 | The verse, given its place | Arabic from verified records, translation of the meaning, Dalil's explanation labelled as his |
| 8 | Tafakor: The Water | The hero moment: the cloud opens over the meadow |
| 9 | Witness gestures | The player moves attention, never the weather |
| 10 | Dalil, the guide | Visible, beside the player, explains at three depths |
| 11 | How Dalil answers | Person first for rulings and distress; server-side model; whole-answer validation |
| 12 | Safeguards | Verified records, labelled content, no generated scripture, honest help |
| 13 | Every screen | Same composition on phone and desktop; Arabic and English |
| 14 | Built to publish | Static web app + one small server; works without a key |
| 15 | How it is tested | 698 content checks, 13 answer-validation cases, played end to end on desktop and emulated phones |
| 16 | What comes next | Chapters 2 and 4, more worlds, recitation, a real partner, published scores |
| 17 | Thank you | Demo link |

## Live demo path (about 3 minutes)

Open the build on a laptop with sound on (and, if possible, the same link on a phone to hand to the judges).

1. **Menu.** Point out the two paths. Choose **Fitrah**.
2. **Depth question.** Choose "I know the basics" (say: it only changes how Dalil explains, and it is not stored).
3. **The four questions.** Let the lights rise; press **Begin**.
4. **Chapter 1.** Press and hold your light, drag along the path to "Your parents", then on to the stars. Let the last link reach into the dark. Read 52:35 as it appears word by word; show "Simpler / More detail" on Dalil's explanation.
5. **Ask Dalil.** Press **Ask Dalil**, tap a suggested question. Then type "Is it haram to …" to show the referral and the honest **Talk to someone** panel. (Dalil's referral line ends "Shall I connect you with a specialist?"; the panel then says plainly that no person is connected yet. Say so if asked.)
6. **Chapter 3** (menu › Chapters needs `?review`; otherwise continue): tap two pillars, read one verse, show the joined building.
7. **Tafakor › The Water.** If time allows, open it from the menu and show the drought and the first gesture. For the climax, use the prepared screenshot (slide 8) rather than playing to the end live.

Fallbacks: if the venue network is slow, the game still runs from a static host; Dalil answers from reviewed content when no model is reachable. Keep the deck open in another tab.

## Likely questions, honest answers

- **How do you stop the AI from inventing verses or hadith?** Dalil may only produce his own explanation types. Qur'anic text and translations come only from the integrity-checked records. Every model answer is validated as a whole before it is shown: it must cite only approved sources, carry no Qur'anic marks or vocalised Arabic, repeat no three consecutive Arabic words of any stored verse, never credit the player with creating, and be confident enough. If any check fails, the answer is withheld and the closest reviewed answer (or an honest "no reliable source") is shown instead.
- **What happens with a fatwa question or someone in distress?** In Fitrah, questions with ruling or distress wording are caught before any model is asked: Dalil refers the player to a person, and distress opens emergency guidance first. The model is also instructed never to give rulings. (This pre-check uses word lists, so it is a first line, not a guarantee; The Water does not have it yet.)
- **Who reviewed the content?** The verse selection is confirmed by the project. The verse texts are generated from QuranEnc (Uthmani) and Saheeh International via pinned packages and fingerprinted; the formal review status in the data file is still marked pending. The hadith reference shows no text yet and its numbering is marked to be confirmed. A draft 50-question test set for Dalil exists from the start version (written for an earlier guide); it will be adapted to Fitrah and reviewed by a specialist before any scores are published.
- **Is "Talk to someone" connected to scholars?** Not yet, and the game says so. It offers general pathways (a local mosque, an Islamic information centre) and is built to add a verified partner, with consent before anything is shared.
- **Are all four chapters interactive?** Chapters 1 and 3 have their full interactions. Chapters 2 and 4 have their story, sources and answers with a guided step. Their interactions are designed and are the next milestone.
- **Does it work on phones?** Yes: same composition, touch gestures, Arabic and English. It was tested in emulated phones (upright and sideways) with real touch events; physical-device testing is the next check.
- **What do you collect?** Nothing the player types. Optional anonymous events (a level started, a chapter reached, how a question was answered) only when the host enables them.
- **Where is the API key?** On the server only. The static build never contains it.

## Say plainly, if asked

- The game was tested in headless browsers with emulated phones, not yet on physical iPhones or Android phones.
- Recitation audio is not in yet (licence first).
- The Water's final verse and the Fitrah verses are confirmed by the project; the hadith numbering is not final.
