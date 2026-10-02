// Content: the World 1 script, the quiz and the verse data (generated from source).
import script from '../../../data/content/world1_script.json';
import quiz from '../../../data/content/world1_quiz.json';
import verses from '../../../data/quran/verses.json';
import { i18n, arDigits } from './i18n.js';

export { script, quiz };
const byKey = Object.fromEntries(verses.verses.map((v) => [v.key, v]));

export function verse(key) {
  const v = byKey[key];
  if (!v) throw new Error(`Unknown verse key ${key}`);
  return v;
}

/** "الملك · ٣" / "Al-Mulk · 3" ; ranges use an en dash. */
export function verseRef(key, lang = i18n.lang) {
  const v = verse(key);
  const first = v.ayahs[0], last = v.ayahs[v.ayahs.length - 1];
  const range = first === last ? `${first}` : `${first}–${last}`;
  return lang === 'ar' ? `${v.surah_name_ar} · ${arDigits(range)}` : `${v.surah_name_en} · ${range}`;
}

/** Long form for the verse card: "سورة الملك · الآية ٣" / "Surah Al-Mulk · Verse 3". */
export function verseRefLong(key, lang = i18n.lang) {
  const v = verse(key);
  const first = v.ayahs[0], last = v.ayahs[v.ayahs.length - 1];
  if (lang === 'ar') {
    return first === last ? `سورة ${v.surah_name_ar} · الآية ${arDigits(first)}` : `سورة ${v.surah_name_ar} · الآيات ${arDigits(`${first}–${last}`)}`;
  }
  return first === last ? `Surah ${v.surah_name_en} · Verse ${first}` : `Surah ${v.surah_name_en} · Verses ${first}–${last}`;
}

/** The end-of-ayah sign followed by the ayah number in Arabic-Indic digits. */
export const ayahMark = (n) => `۝${arDigits(n)}`;
