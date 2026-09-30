# فطرة · Fitrah

An interactive 3D web journey through the four questions every person asks (*Who created me? Why am I here? How should I live? What comes after death?*), answered from Islam's sources, in the player's language.

Built for the **AI in the Service of Islamic Content Challenge 2026** (track 3: interactive experiences).

| Folder | Contents |
| --- | --- |
| `client/` | The game: Three.js + GSAP, bundled with Vite |
| `server/` | Dalil, the AI companion (retrieval over approved sources only) |
| `data/quran/` | Verses used in the game, generated from traceable sources, never edited by hand |
| `data/content/` | Quizzes and other game content |
| `eval/` | The 50-question test set for Dalil and its procedure |
| `docs/` | Sources and licenses |

## Run the client
```
cd client
npm install
npm run dev
```

See [`START_VERSION.md`](START_VERSION.md) for what existed before the challenge days (4–6 October 2026).
