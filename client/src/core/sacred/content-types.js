// Content types: every text the player sees says what it is, so scripture,
// translation and Dalil's own words never blur. Shared by every level.

export const CT = Object.freeze({
  QURAN_ARABIC: 'QURAN_ARABIC',
  TRANSLATION: 'TRANSLATION',
  HADITH: 'HADITH',
  DALIL_EXPLANATION: 'DALIL_EXPLANATION',
  NARRATIVE_DIALOGUE: 'NARRATIVE_DIALOGUE',
  EDUCATIONAL_CONTEXT: 'EDUCATIONAL_CONTEXT',
});

/** The only types Dalil (authored or AI) may produce. Scripture, hadith and translations come only from records. */
export const DALIL_TYPES = [CT.DALIL_EXPLANATION, CT.NARRATIVE_DIALOGUE, CT.EDUCATIONAL_CONTEXT];

export const CT_LABEL = {
  QURAN_ARABIC: { ar: 'القرآن الكريم', en: 'The Qur’an' },
  TRANSLATION: { ar: 'ترجمة المعاني (الإنجليزية)', en: 'Translation of the meaning' },
  HADITH: { ar: 'حديث نبوي', en: 'Hadith' },
  DALIL_EXPLANATION: { ar: 'شرح دليل — ليس من نص القرآن', en: 'Dalil’s explanation — not Qur’anic text' },
  EDUCATIONAL_CONTEXT: { ar: 'سياق تعليمي', en: 'Context' },
  NARRATIVE_DIALOGUE: { ar: 'دليل', en: 'Dalil' },
};
