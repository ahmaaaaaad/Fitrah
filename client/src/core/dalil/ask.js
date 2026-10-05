// Dalil's AI adapters, shared by every level. Tried in order:
//   server   -> POST ./api/dalil (a server announces it with <meta name="fitrah-dalil-api">)
//   artifact -> the Claude viewer's `sample` capability when the page runs as an artifact
//   reviewed -> the level's authored answers, matched by intent
// Every model answer is validated whole before the player sees a word; an answer that
// fails falls back to reviewed content, never to another model.

const HIDE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'unavailable', 'http_404', 'http_405', 'http_501', 'http_503', 'network']);

/**
 * @param {object} o
 * @param {string} o.level                       level id sent to the server route
 * @param {(q:string, ctx:object, lang:string) => string} o.buildPrompt
 * @param {(obj:object) => string|null} o.validate
 * @param {(q:string, lang:string, ctx:object) => {text:string, cite:string[], type:string, source:string, referHuman?:boolean}} o.reviewed
 */
export function createDalilAI({ level, buildPrompt, validate, reviewed }) {
  const status = { adapter: 'reviewed', last: 'not used yet', artifact: 'checking', server: 'untried' };
  const unavailable = new Set();
  let samplePromise = null;
  const getSample = () => {
    if (!samplePromise) samplePromise = (async () => { try { return window.claude?.use ? await window.claude.use('sample') : null; } catch { return null; } })();
    return samplePromise;
  };
  getSample().then((s) => { status.artifact = s ? 'available (asks for consent on first question)' : 'not available in this view'; if (!s) unavailable.add('artifact'); });
  const API = document.querySelector('meta[name="fitrah-dalil-api"]')?.content || null;
  if (!API) { unavailable.add('server'); status.server = 'not configured on this host'; }

  async function server(question, context, lang, signal) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const relay = () => ctl.abort();
    signal?.addEventListener('abort', relay);
    try {
      let r;
      try {
        r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ level, question, context, lang }), signal: ctl.signal });
      } catch {
        if (signal?.aborted) throw { code: 'cancelled' };
        throw { code: ctl.signal.aborted ? 'timeout' : 'network' };
      }
      if (!r.ok) throw { code: `http_${r.status}` };
      return await r.json();
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', relay); }
  }
  async function artifact(question, context, lang, signal) {
    const sample = await getSample();
    if (!sample) throw { code: 'unavailable' };
    return sample.json(buildPrompt(question, context, lang), { modelTier: 'quick', signal });
  }

  /** Resolves {text, cite, type, source, depth?, referHuman?}; rejects only when cancelled. */
  async function ask(question, context, lang, { signal } = {}) {
    const q = String(question || '').trim().slice(0, 300);
    const pre = reviewed(q, lang, context);
    // questions that need a person never reach the model
    if (pre?.referHuman) { status.adapter = 'reviewed'; status.last = 'referred to a person'; return pre; }
    for (const name of ['server', 'artifact']) {
      if (unavailable.has(name)) continue;
      try {
        const raw = name === 'server' ? await server(q, context, lang, signal) : await artifact(q, context, lang, signal);
        const why = validate(raw);
        if (name === 'server') status.server = 'answering';
        if (!why) {
          status.adapter = name; status.last = `${name}: validated`;
          return { text: raw.answer.trim(), cite: raw.citations || [], type: raw.type || 'NARRATIVE_DIALOGUE', source: name, depth: raw.depth, intent: raw.intent, animation: raw.animation, targetId: raw.targetId };
        }
        status.last = `${name}: answer withheld (${why}); reviewed answer used`;
        break;
      } catch (e) {
        const code = e?.code || 'error';
        if (code === 'cancelled' || signal?.aborted) throw { code: 'cancelled' };
        status.last = `${name}: ${code}`;
        if (name === 'server') status.server = code === 'http_503' ? 'no key configured' : `unavailable (${code})`;
        if (HIDE.has(code)) unavailable.add(name);
      }
    }
    status.adapter = 'reviewed';
    if (!status.last.includes('withheld')) status.last = `reviewed: ${pre.source} answer`;
    return pre;
  }
  return { ask, status };
}
