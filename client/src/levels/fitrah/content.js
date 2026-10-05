// The Fitrah level's content, read from reviewed JSON (data/content/fitrah.json),
// plus the start version's reviewed Dalil answers that fit the four questions.
// The engine never holds player-facing text of its own: correcting a line is a
// data change, not a code change.
import content from '../../../../data/content/fitrah.json';
import script from '../../../../data/content/world1_script.json';
import hadithData from '../../../../data/hadith/hadith.json';
import { CT } from '../../core/sacred/content-types.js';

export const C = content;
export const CHAPTERS = content.chapters;
export const chapterById = (id) => CHAPTERS.find((c) => c.id === id) || null;
export const hadithById = (id) => hadithData.hadith.find((x) => x.id === id) || null;
export const SYSTEM_LINES = script.dalil.system;

export const DEPTHS = ['exploring', 'learning', 'reflective'];
/** Pick the text for a depth from {exploring, learning, reflective}; plain {ar, en} pass through. */
export function atDepth(obj, depth = 'exploring') {
  if (!obj) return null;
  if (obj.exploring || obj.learning || obj.reflective) return obj[depth] || obj.learning || obj.exploring;
  return obj;
}
export const shallower = (d) => DEPTHS[Math.max(0, DEPTHS.indexOf(d) - 1)];
export const deeper = (d) => DEPTHS[Math.min(DEPTHS.length - 1, DEPTHS.indexOf(d) + 1)];

// ---------------------------------------------------------------- reviewed answers
// Keys for the start version's answers (their questions come from world1_script.json).
const SCRIPT_KEYS = {
  'causes-1': ['created by nothing', 'created from nothing', 'from nothing', '52:35', 'من غير شيء', 'من لا شيء'],
  'causes-2': ['who created god', 'who created allah', 'created god', 'من خلق الله', 'من خلق الخالق'],
  'causes-3': ['science', 'scientific', 'evolution', 'big bang', 'العلم', 'علمي', 'يتعارض'],
  'fitrah-1': ['fitrah', 'fitra', 'innate', 'فطرة', 'الفطرة'],
  'oneness-3': ['jews', 'christians', 'same god', 'اليهود', 'النصارى', 'المسيحيين', 'نفس الإله'],
  'order-2': ['ayah', 'ayat', 'what is a sign', 'آية', 'آيات'],
};
const scriptQA = [];
(function collect(o) {
  if (Array.isArray(o)) { o.forEach(collect); return; }
  if (o && typeof o === 'object') {
    if (o.id && o.question && o.answer && typeof o.answer === 'object') scriptQA.push(o);
    Object.values(o).forEach(collect);
  }
})(script);

export const ANSWERS = [
  ...content.answers.fitrah.map((a) => ({ ...a, source: 'reviewed' })),
  ...content.answers.from_script.map((id) => scriptQA.find((q) => q.id === id)).filter(Boolean).map((q) => ({
    id: q.id, keys: SCRIPT_KEYS[q.id] || [], question: q.question, answer: q.answer,
    type: (q.sources || []).length ? CT.DALIL_EXPLANATION : CT.EDUCATIONAL_CONTEXT,
    cite: q.sources || [], offerHuman: !!q.offer_human, source: 'reviewed',
  })),
];
export const answerById = (id) => ANSWERS.find((a) => a.id === id) || null;

/** Match a question to a reviewed answer, a referral, or the honest "no source" line. */
export function reviewedAnswer(question, lang) {
  const s = String(question || '').toLowerCase();
  for (const r of content.answers.refer) {
    if (r.keys.some((k) => s.includes(k.toLowerCase()))) {
      const line = SYSTEM_LINES[r.script_line];
      return { text: line[lang] || line.en, cite: [], type: CT.NARRATIVE_DIALOGUE, source: 'reviewed', referHuman: true, distress: !!r.distress };
    }
  }
  let best = null, score = 0;
  for (const a of ANSWERS) {
    let sc = 0;
    for (const k of a.keys) if (s.includes(k.toLowerCase())) sc += k.length;
    const qText = (a.question[lang] || a.question.en || '').toLowerCase();
    if (qText && s.trim() === qText.trim()) sc += 100; // a tapped suggestion
    if (sc > score) { score = sc; best = a; }
  }
  if (best) return { text: best.answer[lang] || best.answer.en, cite: best.cite || [], type: best.type, source: 'reviewed', offerHuman: best.offerHuman };
  const none = SYSTEM_LINES[content.answers.unknown_line];
  return { text: none[lang] || none.en, cite: [], type: CT.NARRATIVE_DIALOGUE, source: 'template', offerHuman: true };
}

/** Every verse key the Fitrah level may show or cite: the only citations Dalil's AI may use. */
export const APPROVED_KEYS = [...new Set([
  ...CHAPTERS.flatMap((c) => [c.source?.key, c.answer_source?.key, ...(c.pillars || []).map((p) => p.key)]),
  content.ending.source,
  ...ANSWERS.flatMap((a) => a.cite || []),
  '23:115', '6:162', '67:3', '98:5', '36:78-79', '99:7-8', '39:53', '57:3',
].filter(Boolean))];
