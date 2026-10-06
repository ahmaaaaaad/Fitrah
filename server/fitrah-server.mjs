// Fitrah — production server. One small Node process that:
//   - serves the static build (client/dist-fitrah) with sensible caching and security headers
//   - answers POST /api/dalil for Dalil's AI, keeping the provider key on the server
//     (the same prompt and whole-answer validation the client uses; rate-limited; no logging of questions)
//   - optionally records anonymous usage events (POST /api/event) when ANALYTICS=1
// Without ANTHROPIC_API_KEY the site still works: Dalil answers from reviewed content.
//
//   cd client && npm run build:fitrah && npm run build:server
//   ANTHROPIC_API_KEY=... PORT=8080 node ../server/dist/fitrah-server.mjs
//
// Environment: PORT (8080), DIST (path to dist-fitrah), ANTHROPIC_API_KEY, DALIL_MODEL,
// ALLOWED_ORIGINS (comma list; empty = same origin only), RATE_PER_MIN (10), RATE_PER_DAY (120),
// ANALYTICS (1 to record), ANALYTICS_FILE (fitrah-events.jsonl).
import http from 'node:http';
import { readFile, stat, appendFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as waterPrompt from '../client/src/levels/water/dalil/prompt.js';
import * as fitrahPrompt from '../client/src/levels/fitrah/dalil-prompt.js';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(process.env.DIST || join(here, '../../client/dist-fitrah'));
const PORT = Number(process.env.PORT || 8080);
const KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.DALIL_MODEL || 'claude-haiku-4-5-20251001';
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const PER_MIN = Number(process.env.RATE_PER_MIN || 10), PER_DAY = Number(process.env.RATE_PER_DAY || 120);
const ANALYTICS = process.env.ANALYTICS === '1';
const EVENTS = process.env.ANALYTICS_FILE || 'fitrah-events.jsonl';
const PROMPTS = { water: waterPrompt, fitrah: fitrahPrompt };

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.otf': 'font/otf', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};
const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'self'; base-uri 'self'",
};
function cacheFor(ext) {
  if (ext === '.html' || ext === '.webmanifest') return 'no-cache';
  if (ext === '.woff2' || ext === '.otf' || ext === '.png' || ext === '.jpg' || ext === '.svg') return 'public, max-age=604800';
  return 'public, max-age=3600, stale-while-revalidate=86400'; // js and css keep stable names between releases
}
function send(res, code, body, headers = {}) {
  res.writeHead(code, { ...SECURITY, ...headers });
  res.end(body);
}
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), { 'content-type': 'application/json', 'cache-control': 'no-store' });

// ---------------------------------------------------------------- rate limiting (per client, in memory)
const hits = new Map();
function allowed(ip) {
  const now = Date.now(), h = hits.get(ip) || { min: [], day: [] };
  h.min = h.min.filter((t) => now - t < 60e3); h.day = h.day.filter((t) => now - t < 864e5);
  if (h.min.length >= PER_MIN || h.day.length >= PER_DAY) { hits.set(ip, h); return false; }
  h.min.push(now); h.day.push(now); hits.set(ip, h);
  return true;
}
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (!h.day.some((t) => now - t < 864e5)) hits.delete(k); }, 36e5).unref();

function originOk(req) {
  const o = req.headers.origin;
  if (!o) return true; // same-origin navigation and server-to-server
  if (ORIGINS.length) return ORIGINS.includes(o);
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}
async function body(req, limit = 4000) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > limit) throw Object.assign(new Error('too large'), { code: 413 }); }
  return raw;
}

// ---------------------------------------------------------------- Dalil
async function dalil(req, res) {
  if (!KEY) return json(res, 503, { error: 'no key configured' });
  if (!originOk(req)) return json(res, 403, { error: 'origin' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (!allowed(ip)) return json(res, 429, { error: 'rate' });
  let q;
  try { q = JSON.parse(await body(req)); } catch (e) { return json(res, e.code === 413 ? 413 : 400, { error: 'bad request' }); }
  const { buildPrompt, validate } = PROMPTS[q.level] || PROMPTS.water;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: buildPrompt(String(q.question || ''), q.context || {}, q.lang === 'ar' ? 'ar' : 'en') }] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { console.warn('[dalil] upstream', r.status); return json(res, 502, { error: 'upstream' }); }
    const data = await r.json();
    const text = data.content?.map((c) => c.text || '').join('') || '';
    const out = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const why = validate(out);
    if (why) { console.info('[dalil] withheld:', why); return json(res, 422, { error: why }); }
    return json(res, 200, out);
  } catch (e) {
    console.warn('[dalil] failed:', e.name || e.message);
    return json(res, 502, { error: 'failed' });
  }
}

// ---------------------------------------------------------------- anonymous events
const EVENT_NAMES = new Set(['level_start', 'chapter', 'stall', 'level_complete', 'question', 'fps', 'error']);
async function event(req, res) {
  if (!ANALYTICS) return send(res, 204, '');
  try {
    const e = JSON.parse(await body(req, 600));
    if (!EVENT_NAMES.has(e.e)) return send(res, 204, '');
    // nothing that identifies a person: no address, no text the player typed
    const row = { day: new Date().toISOString().slice(0, 10), e: e.e, lv: String(e.lv || '').slice(0, 16), v: String(e.v ?? '').slice(0, 32), l: e.l === 'ar' ? 'ar' : 'en', d: String(e.d || '').slice(0, 20) };
    await appendFile(EVENTS, JSON.stringify(row) + '\n');
  } catch { /* ignore bad events */ }
  send(res, 204, '');
}

// ---------------------------------------------------------------- static files
async function file(req, res) {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/' || path === '') path = '/fitrah.html';
  const full = normalize(join(DIST, path));
  if (!full.startsWith(DIST)) return send(res, 403, 'forbidden');
  try {
    const s = await stat(full);
    if (!s.isFile()) throw new Error('not a file');
    const ext = extname(full).toLowerCase();
    let data = await readFile(full);
    if (ext === '.html') {
      // tell the page which services this host offers
      let html = data.toString('utf8');
      const metas = [KEY ? '<meta name="fitrah-dalil-api" content="./api/dalil" />' : '', ANALYTICS ? '<meta name="fitrah-analytics" content="./api/event" />' : ''].filter(Boolean).join('\n    ');
      if (metas) html = html.replace('</head>', `    ${metas}\n  </head>`);
      data = Buffer.from(html);
    }
    send(res, 200, data, { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': cacheFor(ext) });
  } catch {
    send(res, 404, 'not found', { 'content-type': 'text/plain' });
  }
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/api/dalil')) return dalil(req, res);
  if (req.method === 'POST' && req.url.startsWith('/api/event')) return event(req, res);
  if (req.url === '/healthz') return json(res, 200, { ok: true, dalil: KEY ? 'model + reviewed' : 'reviewed only' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '');
  return file(req, res);
}).listen(PORT, () => console.log(`Fitrah on :${PORT} (static ${DIST}; Dalil ${KEY ? 'model + reviewed' : 'reviewed only'}${ANALYTICS ? '; anonymous events on' : ''})`));
