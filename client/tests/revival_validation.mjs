// Unit check for Dalil's answer validation (run from client/: node tests/revival_validation.mjs).
// Node needs JSON import attributes, so this copies the two pure modules into a temp folder with them added.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'dalil-'));
const src = resolve('src/revival/dalil');
const verses = resolve('../data/quran/verses.json');
writeFileSync(join(dir, 'lines.mjs'), readFileSync(join(src, 'lines.js'), 'utf8'));
writeFileSync(join(dir, 'prompt.mjs'), readFileSync(join(src, 'prompt.js'), 'utf8')
  .replace("import verses from '../../../../data/quran/verses.json';", `import verses from '${verses}' with { type: 'json' };`)
  .replace("from './lines.js'", "from './lines.mjs'"));
const { validate, quotesVerse } = await import(join(dir, 'prompt.mjs'));
const { ANSWERS, COMMENT, GUIDE, REFLECT } = await import(join(dir, 'lines.mjs'));
const cases = [
  [{ answer: 'أَفَرَأَيْتُمُ الْمَاءَ الَّذِي تَشْرَبُونَ', citations: ['56:68-70'], confidence: 0.9 }, 'vocalized-arabic'],
  [{ answer: 'افرأيتم الماء الذي تشربون', citations: ['56:68-70'], confidence: 0.9 }, 'quotes-verse'],
  [{ answer: 'اعلموا أن الله يحيي الأرض بعد موتها', citations: ['57:17'], confidence: 0.9 }, 'quotes-verse'],
  [{ answer: 'The verse asks us to notice the water we drink.', citations: ['56:68-70'], confidence: 0.86 }, null],
  [{ answer: 'تدعونا الآية إلى التأمل في الماء الذي نشربه وأن نشكر.', citations: ['56:68-70'], confidence: 0.8 }, null],
  [{ answer: 'ok', citations: ['2:255'], confidence: 0.9 }, 'citation'],
  [{ answer: 'ok', citations: [], confidence: 0.3 }, 'low-confidence'],
];
let fail = 0;
for (const [o, want] of cases) { const got = validate(o); if (got !== want) { fail++; console.log('FAIL', o.answer, 'got', got, 'want', want); } }
for (const [k, a] of Object.entries(ANSWERS)) for (const l of ['ar', 'en']) if (quotesVerse(a[l])) { fail++; console.log('authored answer looks like a quotation:', k, l); }
for (const g of [COMMENT, GUIDE, REFLECT]) for (const [k, a] of Object.entries(g)) if (quotesVerse(a.ar)) { fail++; console.log('authored line looks like a quotation:', k); }
console.log(fail ? `${fail} failure(s)` : `all ${cases.length} cases and all authored lines pass`);
process.exit(fail ? 1 : 0);
