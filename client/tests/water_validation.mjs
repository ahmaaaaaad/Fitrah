// Unit check for Dalil's answer validation (run from client/: node tests/water_validation.mjs).
// Node needs JSON import attributes, so this copies the two pure modules into a temp folder with them added.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'dalil-'));
const src = resolve('src/levels/water/dalil');
const verses = resolve('../data/quran/verses.json');
writeFileSync(join(dir, 'events.mjs'), readFileSync(resolve('src/levels/water/events.js'), 'utf8'));
writeFileSync(join(dir, 'lines.mjs'), readFileSync(join(src, 'lines.js'), 'utf8').replace("from '../events.js'", "from './events.mjs'"));
writeFileSync(join(dir, 'prompt.mjs'), readFileSync(join(src, 'prompt.js'), 'utf8')
  .replace("import verses from '../../../../../data/quran/verses.json';", `import verses from '${verses}' with { type: 'json' };`)
  .replace("from './lines.js'", "from './lines.mjs'").replace("from '../events.js'", "from './events.mjs'"));
const { validate, quotesVerse } = await import(join(dir, 'prompt.mjs'));
const { ANSWERS, LINES, EXPLAIN } = await import(join(dir, 'lines.mjs'));
const cases = [
  [{ answer: 'أَفَرَأَيْتُمُ الْمَاءَ الَّذِي تَشْرَبُونَ', citations: ['56:68-70'], confidence: 0.9 }, 'vocalized-arabic'],
  [{ answer: 'افرأيتم الماء الذي تشربون', citations: ['56:68-70'], confidence: 0.9 }, 'quotes-verse'],
  [{ answer: 'اعلموا أن الله يحيي الأرض بعد موتها', citations: ['57:17'], confidence: 0.9 }, 'quotes-verse'],
  [{ answer: 'The verse asks us to notice the water we drink.', citations: ['56:68-70'], confidence: 0.86 }, null],
  [{ answer: 'تدعونا الآية إلى التأمل في الماء الذي نشربه وأن نشكر.', citations: ['56:68-70'], confidence: 0.8 }, null],
  [{ answer: 'ok', citations: ['2:255'], confidence: 0.9 }, 'citation'],
  [{ answer: 'ok', citations: [], confidence: 0.3 }, 'low-confidence'],
  [{ answer: 'ok', type: 'QURAN_ARABIC', citations: [], confidence: 0.9 }, 'content-type'],
  [{ answer: 'You brought the rain to this valley.', type: 'NARRATIVE_DIALOGUE', citations: [], confidence: 0.9 }, 'agency'],
  [{ answer: 'You made it rain, and you opened the sky.', type: 'NARRATIVE_DIALOGUE', citations: [], confidence: 0.9 }, 'agency'],
  [{ answer: 'We revived the earth together.', type: 'NARRATIVE_DIALOGUE', citations: [], confidence: 0.9 }, 'agency'],
  [{ answer: 'أنت أحييت هذه الأرض.', type: 'NARRATIVE_DIALOGUE', citations: [], confidence: 0.9 }, 'agency'],
  [{ answer: 'We did not bring the rain; we watched it arrive.', type: 'EDUCATIONAL_CONTEXT', citations: [], confidence: 0.9 }, null],
];
let fail = 0;
for (const [o, want] of cases) { const got = validate(o); if (got !== want) { fail++; console.log('FAIL', o.answer, 'got', got, 'want', want); } }
// every wording of every line: instructions carry one per way of touching (mouse, touch, pen)
const wordings = (a) => [a, ...(a.by ? ['mouse', 'touch', 'pen'].map((k) => a.by[k]) : [])].filter((w) => w && (w.ar || w.en));
let instructions = 0;
for (const [k, a] of Object.entries({ ...LINES, ...ANSWERS })) if (a.by) {
  instructions++;
  for (const kind of ['mouse', 'touch', 'pen']) if (!a.by[kind]?.ar || !a.by[kind]?.en) { fail++; console.log('instruction is missing a wording:', k, kind); }
}
for (const [k, a] of Object.entries(ANSWERS)) for (const w of wordings(a)) for (const l of ['ar', 'en']) if (quotesVerse(w[l])) { fail++; console.log('authored answer looks like a quotation:', k, l); }
for (const g of [LINES, EXPLAIN]) for (const [k, a] of Object.entries(g)) for (const w of wordings(a)) for (const l of ['ar', 'en']) {
  if (quotesVerse(w[l])) { fail++; console.log('authored line looks like a quotation:', k, l); }
  const v = validate({ answer: w[l], type: a.type, citations: [], confidence: 1 });
  if (v === 'agency') { fail++; console.log('authored line gives agency:', k, l); }
}
console.log(fail ? `${fail} failure(s)` : `all ${cases.length} cases and all authored lines pass (${instructions} instructions, each worded for mouse, touch and pen)`);
process.exit(fail ? 1 : 0);
