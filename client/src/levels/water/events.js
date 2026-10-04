// Semantic events and content types.
//
// Events say what the player has witnessed, never where the pointer was. Dalil,
// the director, the audio and the AI context engine all listen to the same bus.
// Content types keep scripture, translation and Dalil's words apart everywhere
// they are shown or generated.

export const EV = Object.freeze({
  ARRIVED: 'ARRIVED',
  CURRENT_APPEARED: 'CURRENT_APPEARED',
  PLAYER_NOTICED_CURRENT: 'PLAYER_NOTICED_CURRENT',
  PLAYER_TRACED_WIND: 'PLAYER_TRACED_WIND',
  RAIN_BEGAN: 'RAIN_BEGAN',
  PLAYER_DISCOVERED_RAIN: 'PLAYER_DISCOVERED_RAIN',
  PLAYER_REVEALED_SOIL: 'PLAYER_REVEALED_SOIL',
  WATER_MOVING: 'WATER_MOVING',
  PLAYER_TRACED_WATER: 'PLAYER_TRACED_WATER',
  PLAYER_REVEALED_STREAM: 'PLAYER_REVEALED_STREAM',
  PLAYER_REVEALED_VERSE: 'PLAYER_REVEALED_VERSE',
  PLAYER_FINISHED_READING_VERSE: 'PLAYER_FINISHED_READING_VERSE',
  PLAYER_DISCOVERED_FLOWER: 'PLAYER_DISCOVERED_FLOWER',
  PLAYER_CONNECTED_CHAIN: 'PLAYER_CONNECTED_CHAIN',
  CLOUDS_THINNING: 'CLOUDS_THINNING',
  PLAYER_ALIGNED_LIGHT: 'PLAYER_ALIGNED_LIGHT',
  PLAYER_OBSERVED_LIGHT: 'PLAYER_OBSERVED_LIGHT',
  PLAYER_ASKED_FOR_EXPLANATION: 'PLAYER_ASKED_FOR_EXPLANATION',
  JOURNEY_COMPLETE: 'JOURNEY_COMPLETE',
});

/** Every text the player sees carries one of these, and the interface shows which. */
export const CT = Object.freeze({
  QURAN_ARABIC: 'QURAN_ARABIC',
  TRANSLATION: 'TRANSLATION',
  DALIL_EXPLANATION: 'DALIL_EXPLANATION',
  NARRATIVE_DIALOGUE: 'NARRATIVE_DIALOGUE',
  EDUCATIONAL_CONTEXT: 'EDUCATIONAL_CONTEXT',
});
/** The types Dalil (authored or AI) may ever produce. Scripture and translation come only from verses.json. */
export const DALIL_TYPES = [CT.DALIL_EXPLANATION, CT.NARRATIVE_DIALOGUE, CT.EDUCATIONAL_CONTEXT];

export const CT_LABEL = {
  QURAN_ARABIC: { ar: 'القرآن الكريم', en: 'The Qur’an' },
  TRANSLATION: { ar: 'ترجمة المعاني (الإنجليزية)', en: 'Translation of the meaning' },
  DALIL_EXPLANATION: { ar: 'شرح دليل — ليس من نص القرآن', en: 'Dalil’s explanation — not Qur’anic text' },
  EDUCATIONAL_CONTEXT: { ar: 'ملاحظة من الطبيعة', en: 'What we are seeing' },
  NARRATIVE_DIALOGUE: { ar: 'دليل', en: 'Dalil' },
};

const listeners = new Map();
const log = [];
let clock = () => performance.now() / 1000;

export const bus = {
  emit(type, data = {}) {
    const e = { type, t: clock(), ...data };
    log.push(e); if (log.length > 60) log.shift();
    for (const fn of listeners.get(type) || []) fn(e);
    for (const fn of listeners.get('*') || []) fn(e);
    return e;
  },
  on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type).delete(fn);
  },
  once(type) { return new Promise((r) => { const off = bus.on(type, (e) => { off(); r(e); }); }); },
  has(type) { return log.some((e) => e.type === type); },
  recent(n = 8) { return log.slice(-n); },
  setClock(fn) { clock = fn; },
};
