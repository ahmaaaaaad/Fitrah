# فطرة · Fitrah

An interactive 3D web journey through the four questions every person asks (*Who created me? Why am I here? How should I live? What comes after death?*), answered from Islam's sources, in the player's language (Arabic or English), on desktop and phone.

Two paths from one cinematic menu:

- **Fitrah — The Four Questions.** One guided level in a vast chamber of light. Dalil, a hooded guide who carries his own light, walks beside the player, explains every source at the player's depth, and can be asked anything. Who created me? *Allah.* Why am I here? *To worship Allah.* How should I live? *The pillars of Islam.* What comes after death? *The Hereafter.*
- **Tafakor — Explore the Signs.** Experiential worlds. The Water (from drought to rain to a meadow, ending on 57:17) is playable; The Mountains and The Space are listed as coming later.

Built for the **AI in the Service of Islamic Content Challenge 2026** (track 3: interactive experiences).

| Folder | Contents |
| --- | --- |
| `client/` | The game: Three.js + GSAP, bundled with Vite |
| `server/` | The production server: static files, Dalil's AI route with the key kept server-side, anonymous events |
| `data/quran/` | Verses used in the game, generated from traceable sources, never edited by hand |
| `data/content/` | All player-facing text (Arabic and English), quizzes and other game content |
| `data/config/` | "Talk to someone" destinations (none verified yet, and the game says so) |
| `eval/` | The 50-question test set for Dalil and its procedure |
| `docs/` | Sources, licenses and the challenge log |

## Run it

```
cd client
npm install
npm run dev:fitrah          # http://localhost:5173/fitrah.html
```

## Publish it

```
cd client
npm run build:fitrah        # static build in client/dist-fitrah
npm run build:server
ANTHROPIC_API_KEY=... PORT=8080 npm run serve:prod
```

`client/dist-fitrah` also works on any static host; Dalil then answers from reviewed content only. The AI key is never part of the client build. See [`server/README.md`](server/README.md) for the variables, HTTPS and caching.

Every verse, translation and the hadith reference is labelled "Pending Sharia review" until reviewed.

See [`START_VERSION.md`](START_VERSION.md) for what existed before the challenge days (4–6 October 2026) and [`docs/CHALLENGE_LOG.md`](docs/CHALLENGE_LOG.md) for what was done on each day.
