// Whole-answer validation for Dalil's AI answers. Pure module: runs in the
// browser and in the server route alike. An answer is shown only when every
// check passes; otherwise a reviewed answer is used instead (never a repair).
import verses from '../../../../data/quran/verses.json';
import { DALIL_TYPES } from './content-types.js';

const QURANIC_MARKS = /[\u0610-\u061a\u06d6-\u06ed\u0670\u08d3-\u08ff\ufd3e\ufd3f]/;
const HARAKAT = /[\u064b-\u0652]/g;
// A consonantal skeleton: no diacritics, no alef or hamza forms (Uthmani and standard
// spelling differ exactly there), unified ya and ta marbuta.
const skeleton = (s) => s.replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, '').replace(/[\u0627\u0623\u0625\u0622\u0671\u0621]/g, '')
  .replace(/ؤ/g, 'و').replace(/[ئى]/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^ء-ي\s]/g, ' ').replace(/\s+/g, ' ').trim();
const GRAMS = new Set();
for (const v of verses.verses) {
  const w = skeleton(v.text_uthmani).split(' ').filter(Boolean);
  for (let i = 0; i + 2 < w.length; i++) GRAMS.add(w.slice(i, i + 3).join(' '));
}
/** True when the text reproduces three consecutive words of any verse in the data. */
export function quotesVerse(text) {
  const w = skeleton(String(text || '')).split(' ').filter(Boolean);
  for (let i = 0; i + 2 < w.length; i++) if (GRAMS.has(w.slice(i, i + 3).join(' '))) return true;
  return false;
}

// Wording that would give the player (or Dalil) divine agency.
export const AGENCY = /\b(you|we)\s+(made|make|created|create|brought|bring|caused|cause|revived|revive|commanded|command|moved|move|opened|open)\s+(the\s+|it\s+)?(rain|clouds?|light|sun|earth|life|water|plants?|sky|heavens|universe|world)\b|(أنت|نحن)\s+(صنعت|صنعنا|خلقت|خلقنا|أنزلت|أنزلنا|أحييت|أحيينا|حرّكت|حركت|حرّكنا|حركنا)/i;

export const INTENTS = ['guide', 'explain', 'interpret', 'ask', 'reflect', 'observe', 'refer', 'silent'];
export const ANIMATIONS = ['idle', 'point', 'look', 'walk', 'observe', 'wait', 'reflect', 'kneel', 'beckon'];
export const DEPTHS = ['simple', 'standard', 'detailed'];

/**
 * Returns null when the answer may be shown, or the reason it may not.
 * @param {object} obj   the model's JSON answer
 * @param {{ approvedKeys: string[], targets?: string[] }} rules
 */
export function validate(obj, { approvedKeys = [], targets = null } = {}) {
  if (!obj || typeof obj !== 'object' || typeof obj.answer !== 'string') return 'shape';
  const a = obj.answer.trim();
  if (!a || a.length > 280) return 'length';
  if (QURANIC_MARKS.test(a)) return 'quranic-marks';
  if ((a.match(HARAKAT) || []).length >= 4) return 'vocalized-arabic'; // plain answers are not vocalized; quotations are
  if (quotesVerse(a)) return 'quotes-verse';
  if (AGENCY.test(a)) return 'agency';
  const cites = Array.isArray(obj.citations) ? obj.citations : [];
  if (cites.some((c) => !approvedKeys.includes(c))) return 'citation';
  if (obj.type !== undefined && !DALIL_TYPES.includes(obj.type)) return 'content-type';
  if (obj.intent !== undefined && !INTENTS.includes(obj.intent)) return 'intent';
  if (obj.animation !== undefined && !ANIMATIONS.includes(obj.animation)) return 'animation';
  if (obj.depth !== undefined && !DEPTHS.includes(obj.depth)) return 'depth';
  if (obj.targetId !== undefined && targets && !targets.includes(obj.targetId)) return 'target';
  if (typeof obj.confidence !== 'number' || !(obj.confidence >= 0.6)) return 'low-confidence';
  return null;
}
