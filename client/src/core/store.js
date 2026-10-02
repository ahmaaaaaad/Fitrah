// Per-device progress and anonymous measurement events. Storage may be unavailable;
// everything works without it.
const KEY = 'fitrah.v1';

function load() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

const fresh = () => ({ session: Math.random().toString(36).slice(2, 10), lang: null, intent: null, pre: null, post: null, journal: [], events: [] });
export const state = Object.assign(fresh(), load() || {});

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked: keep going */ }
}

export function log(type, data = {}) {
  state.events.push({ t: Date.now(), type, ...data });
  if (state.events.length > 400) state.events.splice(0, state.events.length - 400);
  save();
}

export function collect(key) {
  if (!state.journal.includes(key)) state.journal.push(key);
  save();
  return state.journal.length;
}

export function resetProgress() {
  const keep = { session: state.session, events: state.events };
  Object.assign(state, fresh(), keep);
  save();
}
