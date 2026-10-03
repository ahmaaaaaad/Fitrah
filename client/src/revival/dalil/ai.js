// Dalil's answers. Adapters are tried in the configured order:
//   server   -> POST ./api/dalil (production route; needs a key on the server; 6 s timeout)
//   artifact -> the Claude viewer's `sample` capability when the page runs as an artifact
//   fallback -> reviewed answers matched by intent, then a plain template
// Inference is asynchronous and never blocks rendering; answers are validated whole
// before the player sees a word.
import { CONFIG } from '../config.js';
import { ANSWERS, UNKNOWN } from './lines.js';
import { buildPrompt, validate } from './prompt.js';
import { CT } from '../events.js';

export const aiStatus = { adapter: 'fallback', last: 'not used yet', artifact: 'checking', server: 'untried' };
const unavailable = new Set();
const HIDE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'unavailable', 'http_404', 'http_405', 'http_501', 'http_503', 'network']);

let samplePromise = null;
function getSample() {
  if (!samplePromise) {
    samplePromise = (async () => {
      try { return window.claude?.use ? await window.claude.use('sample') : null; } catch { return null; }
    })();
  }
  return samplePromise;
}
getSample().then((s) => { aiStatus.artifact = s ? 'available (asks for consent on first question)' : 'not available in this view'; if (!s) unavailable.add('artifact'); });
// the server route exists only where a server announces it (the dev server, a production server)
const API = document.querySelector('meta[name="fitrah-dalil-api"]')?.content || null;
if (!API) { unavailable.add('server'); aiStatus.server = 'not configured on this host'; }

export function matchIntent(q) {
  const s = q.toLowerCase();
  let best = null, score = 0;
  for (const [id, a] of Object.entries(ANSWERS)) {
    let sc = 0;
    for (const k of a.keys) if (s.includes(k.toLowerCase())) sc += k.length;
    if (sc > score) { score = sc; best = id; }
  }
  return best;
}
export function reviewedAnswer(intent, lang) {
  const a = intent && ANSWERS[intent];
  if (a) return { text: a[lang] || a.en, cite: a.cite, type: a.type, source: 'reviewed' };
  return { text: UNKNOWN[lang] || UNKNOWN.en, cite: [], type: UNKNOWN.type, source: 'template' };
}

async function serverAdapter(question, context, lang, signal) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  const relay = () => ctl.abort();
  signal?.addEventListener('abort', relay);
  try {
    let r;
    try {
      r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, context, lang }), signal: ctl.signal });
    } catch (e) {
      if (signal?.aborted) throw { code: 'cancelled' };
      throw { code: ctl.signal.aborted ? 'timeout' : 'network' };
    }
    if (!r.ok) throw { code: `http_${r.status}` };
    return await r.json();
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', relay); }
}
async function artifactAdapter(question, context, lang, signal) {
  const sample = await getSample();
  if (!sample) throw { code: 'unavailable' };
  // no page-side timeout: the platform ends over-long calls, and the first call shows a consent dialog
  return sample.json(buildPrompt(question, context, lang), { modelTier: 'quick', signal });
}

/** Ask Dalil. ctx is the context engine's snapshot. Resolves {text, cite, type, source}; rejects only when cancelled. */
export async function askDalil(question, context, lang, { signal } = {}) {
  const q = String(question || '').trim().slice(0, 300);
  const intent = matchIntent(q);
  for (const name of CONFIG.ai) {
    if (name === 'fallback') break;
    if (unavailable.has(name)) continue;
    try {
      const raw = name === 'server' ? await serverAdapter(q, context, lang, signal) : await artifactAdapter(q, context, lang, signal);
      const why = validate(raw);
      if (name === 'server') aiStatus.server = 'answering';
      if (!why) { aiStatus.adapter = name; aiStatus.last = `${name}: validated`; return { text: raw.answer.trim(), cite: raw.citations || [], type: raw.type || CT.NARRATIVE_DIALOGUE, source: name }; }
      aiStatus.last = `${name}: answer withheld (${why}); reviewed answer used`;
      break; // an answer that fails validation falls back to reviewed content, never to another model
    } catch (e) {
      const code = e?.code || 'error';
      if (code === 'cancelled' || signal?.aborted) throw { code: 'cancelled' };
      aiStatus.last = `${name}: ${code}`;
      if (name === 'server') aiStatus.server = code === 'http_503' ? 'no key configured' : `unavailable (${code})`;
      if (HIDE.has(code)) unavailable.add(name);
    }
  }
  aiStatus.adapter = 'fallback';
  const ans = reviewedAnswer(intent, lang);
  if (!aiStatus.last.includes('withheld')) aiStatus.last = `fallback: ${ans.source} answer`;
  return ans;
}
