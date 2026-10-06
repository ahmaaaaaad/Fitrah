# Fitrah – production server

`fitrah-server.mjs` is one small Node process (Node 18 or later, no dependencies once bundled) that:

- serves the static build (`client/dist-fitrah`) with caching and security headers (Content-Security-Policy, `nosniff`, referrer and permissions policies);
- answers `POST /api/dalil` for Dalil's AI, keeping the provider key on the server. It builds the same prompt and runs the same whole-answer validation as the client (`client/src/core/sacred/validate.js`: every citation must be an approved key; no Qur'anic marks, vocalized Arabic or three consecutive words of any stored verse; no wording that gives the player divine agency; a minimum confidence). An answer that fails is withheld, never repaired, and the player gets a reviewed answer instead. Questions about rulings and signs of distress are referred to a person by the client before any model is asked. Rate-limited per client; questions are never logged;
- optionally records anonymous usage events (`POST /api/event`, only with `ANALYTICS=1`): a day, an event name, the level, a short value, the language and the kind of device. No addresses, nothing the player typed;
- reports its state at `GET /healthz`.

It tells the page which services exist by adding `<meta>` tags to the HTML it serves, so the same build runs as a plain static site (Dalil then answers from reviewed content only) or behind this server.

## Build and run

```
cd client
npm install
npm run build:fitrah        # client/dist-fitrah
npm run build:server        # server/dist/fitrah-server.mjs (bundles the prompt and validation it shares with the client)
ANTHROPIC_API_KEY=... PORT=8080 npm run serve:prod
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | Port to listen on |
| `DIST` | `client/dist-fitrah` | The static build to serve |
| `ANTHROPIC_API_KEY` | (none) | Enables model answers for Dalil. Without it, Dalil answers from reviewed content only |
| `DALIL_MODEL` | `claude-haiku-4-5-20251001` | Model for Dalil |
| `ALLOWED_ORIGINS` | (same origin) | Comma-separated origins allowed to call `/api/dalil` |
| `RATE_PER_MIN`, `RATE_PER_DAY` | `10`, `120` | Questions per client |
| `ANALYTICS` | off | `1` records anonymous events |
| `ANALYTICS_FILE` | `fitrah-events.jsonl` | Where events are appended |

## Deploying

Any host that runs a Node process works (a small VM, a container, a platform service). Put it behind HTTPS (the platform's TLS or a reverse proxy such as Caddy or nginx) and set the key as a secret in the host's environment, never in the client build or the repository. Behind a proxy, the first address in `X-Forwarded-For` is used for rate limiting. The rate limiter is in memory, so run one process, or move the limiter to a shared store before scaling out.

Caching: HTML and the manifest are revalidated on every visit; scripts and styles are cached for an hour (they keep their names between releases); fonts and images for a week.

## Not built

The planned retrieval pipeline (classify, retrieve from an approved index, constrained answer, validate) is reduced to: reviewed answers first, then the model with the level's approved source keys in its prompt and whole-answer validation, then abstaining and referring. There is no retrieval index yet.
