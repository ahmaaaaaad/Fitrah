// How sources appear in the Fitrah level.
//
//   revealVerse   a passage of the Qur'an in three visibly separate layers: the verified
//                 Arabic (re-hashed before display; nothing is shown if a hash fails),
//                 an attributed translation of the meaning, and Dalil's explanation,
//                 which the player can ask to be simpler or more detailed.
//   revealHadith  a hadith reference card. Until the text has been entered from a named,
//                 verified edition, it shows only the title, Dalil's labelled summary and
//                 the collections with their numbering marked "to be confirmed".
import { i18n, arDigits } from '../../core/i18n.js';
import { h } from '../../ui/dom.js';
import { verifyVerse, verseData, refText } from '../../core/sacred/verses.js';
import { CT, CT_LABEL } from '../../core/sacred/content-types.js';
import { atDepth, hadithById } from './content.js';
import { SPEED } from './config.js';

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const ayahMark = (n) => `۝${arDigits(n)}`;
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject({ cancelled: true }); return; }
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject({ cancelled: true }); }, { once: true });
});
const PENDING = { ar: 'بانتظار المراجعة الشرعية', en: 'Pending Sharia review' };

/** The explanation layer: Dalil's words, labelled, with simpler / more detail. */
function explainLayer(explanation, depth, onDepth) {
  let d = depth;
  const text = h('p', { class: 'explain-text', lang: i18n.lang, dir: i18n.dir });
  const simpler = h('button', { type: 'button', class: 'ex-btn' }, i18n.t({ ar: 'أبسط', en: 'Simpler' }));
  const more = h('button', { type: 'button', class: 'ex-btn' }, i18n.t({ ar: 'تفصيل أكثر', en: 'More detail' }));
  // "simpler" is the plainest wording; "more detail" the one that names and glosses the terms
  const render = () => {
    text.textContent = i18n.t(atDepth(explanation, d));
    const tiered = !!(explanation.exploring || explanation.learning || explanation.reflective);
    simpler.hidden = !tiered || d === 'exploring'; more.hidden = !tiered || d === 'learning';
  };
  simpler.addEventListener('click', () => { d = 'exploring'; render(); onDepth?.(d); });
  more.addEventListener('click', () => { d = 'learning'; render(); onDepth?.(d); });
  render();
  const el = h('div', { class: 'layer explain', 'data-type': CT.DALIL_EXPLANATION },
    h('p', { class: 'layer-label' }, i18n.t(CT_LABEL.DALIL_EXPLANATION)), text, h('div', { class: 'ex-tools' }, simpler, more));
  return { el, text: () => text.textContent };
}

function placeBox(box, cont, anchor) {
  const place = () => {
    if (!box.isConnected) { window.removeEventListener('resize', place); return; }
    const W = window.innerWidth, Hh = window.innerHeight;
    box.classList.remove('compact');
    if (box.getBoundingClientRect().height > Hh * 0.86) box.classList.add('compact');
    const r = box.getBoundingClientRect(), bh = r.height, half = r.width / 2;
    const a = anchor?.() || { x: W / 2, y: Hh * 0.42 };
    const lo = Math.max(W * 0.4, half + 8), hi = Math.min(W * 0.6, W - half - 8);
    box.style.left = `${lo <= hi ? Math.min(hi, Math.max(lo, a.x)) : W / 2}px`;
    box.style.top = `${Math.min(Hh - bh / 2 - 12, Math.max(bh / 2 + 12, a.y))}px`;
    box.classList.toggle('scrolls', overflow() > 2);
  };
  const overflow = () => cont.offsetTop + cont.offsetHeight - box.clientHeight;
  window.addEventListener('resize', place);
  return { place, overflow };
}

async function finish(box, cont, overflow, signal) {
  cont.classList.add('on');
  cont.focus({ preventScroll: true });
  if (overflow() > 2) box.scrollTo({ top: overflow(), behavior: 'smooth' });
  try {
    await new Promise((resolve, reject) => {
      cont.addEventListener('click', resolve, { once: true });
      signal?.addEventListener('abort', () => reject({ cancelled: true }), { once: true });
    });
  } finally {
    box.classList.remove('in'); box.classList.add('out');
    setTimeout(() => box.remove(), 1100);
  }
}

/**
 * @param {string} key   verse key in data/quran/verses.json
 * @param {object} o     { anchor, readable, explanation, depth, onDepth, signal, hooks: { onShown, onReadDone } }
 */
export async function revealVerse(key, { anchor, readable = false, explanation = null, depth = 'exploring', onDepth, signal, hooks = {} } = {}) {
  const v = verseData(key);
  if (!v || !(await verifyVerse(key))) { console.error(`[fitrah] verse ${key} is missing or failed its integrity check; nothing is shown.`); return { shown: false }; }
  if (signal?.aborted) throw { cancelled: true };
  const start = performance.now();
  const words = v.ayah_texts.map((a) => a.ar.split(' '));
  const total = words.reduce((s, w) => s + w.length, 0);
  const minRead = Math.max(10, 2.2 * v.ayah_texts.length + 2.5 + 0.33 * total) / SPEED;
  const label = (type, extra = '') => h('p', { class: 'layer-label', 'data-type': type }, i18n.t(CT_LABEL[type]) + extra);

  const ayahEls = v.ayah_texts.map((a, ai) => h('p', { class: 'ayah', lang: 'ar', dir: 'rtl' },
    ...words[ai].flatMap((w, wi) => [h('span', { class: 'w' }, w), wi < words[ai].length - 1 ? ' ' : '']),
    ' ', h('span', { class: 'w mark' }, ayahMark(a.n))));
  const ref = h('p', { class: 'ref' }, i18n.t(refText(v)));
  const quran = h('div', { class: 'layer quran', 'data-type': CT.QURAN_ARABIC }, label(CT.QURAN_ARABIC), h('div', { class: 'ayat' }, ...ayahEls), ref);
  const trText = h('p', { class: 'translation', lang: 'en', dir: 'ltr' }, ...v.ayah_texts.flatMap((a) => [a.en, h('span', { class: 'num' }, ` (${a.n}) `)]));
  const trLayer = h('div', { class: 'layer translation-layer', 'data-type': CT.TRANSLATION }, label(CT.TRANSLATION, ` · ${v.translation_en_author}`), trText);
  const trToggle = i18n.lang === 'ar' ? h('button', { class: 'tr-toggle', type: 'button' }, 'عرض ترجمة المعاني بالإنجليزية') : null;
  if (trToggle) { trLayer.classList.add('collapsed'); trToggle.addEventListener('click', () => { trLayer.classList.toggle('collapsed'); place(); }); }
  const tags = h('div', { class: 'tags' }, h('span', { class: 'tag' }, i18n.t(PENDING)));
  const ex = explanation ? explainLayer(explanation, depth, onDepth) : null;
  const cont = h('button', { class: 'continue', type: 'button' }, i18n.t({ ar: 'متابعة', en: 'Continue' }));
  const box = h('section', { class: `verse${readable ? ' readable' : ''}`, role: 'dialog', 'aria-label': i18n.t(refText(v)) }, quran, trToggle, trLayer, tags, ex?.el, cont);
  document.getElementById('verse-layer').append(box);
  const { place, overflow } = placeBox(box, cont, anchor);
  place();
  requestAnimationFrame(() => box.classList.add('in'));
  hooks.onShown?.(v);
  try {
    // the Arabic first, word by word in reading order; each ayah over about 2.5 s
    for (let ai = 0; ai < ayahEls.length; ai++) {
      const ws = [...ayahEls[ai].querySelectorAll('.w')];
      const per = REDUCED ? 0 : (2.5 / ws.length) / SPEED;
      for (const s of ws) { s.classList.add('on'); if (per) await sleep(per * 1000, signal); }
      if (!REDUCED) await sleep(380 / SPEED, signal);
    }
    ref.classList.add('on'); quran.classList.add('done');
    // the translation follows the Arabic, never replaces it
    await sleep(800 / SPEED, signal);
    trLayer.classList.add('on'); trText.classList.add('on'); tags.classList.add('on'); trToggle?.classList.add('on');
    await sleep(Math.max(0, minRead * 1000 - (performance.now() - start)), signal);
    hooks.onReadDone?.();
    // then Dalil's explanation, set apart and labelled
    if (ex) {
      ex.el.classList.add('on'); place();
      await sleep(((3 + ex.text().length * 0.04) / SPEED) * 1000, signal);
    }
    await finish(box, cont, overflow, signal);
  } catch (e) {
    box.remove();
    throw e;
  }
  return { shown: true };
}

/** A hadith reference: title, collections with provisional numbering, Dalil's labelled summary. */
export async function revealHadith(id, { anchor, explanation = null, depth = 'exploring', onDepth, signal } = {}) {
  const x = hadithById(id);
  if (!x) { console.error(`[fitrah] hadith ${id} is not in data/hadith/hadith.json`); return { shown: false }; }
  const hasText = !!x.arabic && x.review?.status === 'approved';
  const WORK_AR = { 'Sahih al-Bukhari': 'صحيح البخاري', 'Sahih Muslim': 'صحيح مسلم' };
  const cols = x.collections.map((c) => h('li', {}, i18n.lang === 'ar' ? `${WORK_AR[c.work] || c.work} ${arDigits(c.number)}` : `${c.work} ${c.number}`, h('small', {}, ` — ${i18n.t({ ar: 'الترقيم المعتاد، يُؤكَّد من الطبعة المعتمدة', en: c.numbering })}`)));
  const head = h('div', { class: 'layer hadith-ref', 'data-type': CT.HADITH },
    h('p', { class: 'layer-label' }, i18n.t({ ar: 'مرجع حديث', en: 'Hadith reference' })),
    h('h3', { class: 'hd-title', lang: i18n.lang }, i18n.t(x.title)),
    h('ul', { class: 'hd-cols', dir: i18n.dir }, ...cols),
    hasText ? null : h('p', { class: 'hd-note' }, i18n.t({ ar: 'لم يُعرض نص الحديث لأنه لم يُدخل بعد من طبعة موثّقة.', en: 'The hadith’s text is not shown: it has not yet been entered from a verified edition.' })));
  const summary = h('div', { class: 'layer explain on', 'data-type': CT.DALIL_EXPLANATION },
    h('p', { class: 'layer-label' }, i18n.t({ ar: 'ملخّص دليل — ليس نص الحديث', en: 'Dalil’s summary — not the hadith’s text' })),
    h('p', { class: 'explain-text', lang: i18n.lang, dir: i18n.dir }, i18n.t(x.summary)));
  const tags = h('div', { class: 'tags on' }, h('span', { class: 'tag' }, i18n.t(PENDING)), h('span', { class: 'tag prov' }, i18n.t({ ar: 'الترقيم غير نهائي', en: 'Numbering not final' })));
  const ex = explanation ? explainLayer(explanation, depth, onDepth) : null;
  const cont = h('button', { class: 'continue', type: 'button' }, i18n.t({ ar: 'متابعة', en: 'Continue' }));
  const box = h('section', { class: 'verse hadith', role: 'dialog', 'aria-label': i18n.t(x.title) }, head, summary, tags, ex?.el, cont);
  document.getElementById('verse-layer').append(box);
  const { place, overflow } = placeBox(box, cont, anchor);
  place();
  requestAnimationFrame(() => box.classList.add('in'));
  try {
    await sleep(Math.max(6, i18n.t(x.summary).length * 0.06) / SPEED * 1000, signal);
    if (ex) { ex.el.classList.add('on'); place(); await sleep(((3 + ex.text().length * 0.04) / SPEED) * 1000, signal); }
    await finish(box, cont, overflow, signal);
  } catch (e) { box.remove(); throw e; }
  return { shown: true };
}
