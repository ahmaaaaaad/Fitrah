// Diegetic verse revelation (section 15). The verse appears from the place in
// the world it speaks about, as real text in the page (lang="ar", dir="rtl"),
// shaped by the browser and never bent, mirrored or broken by effects.
// Each ayah is re-hashed before display; if a hash fails, nothing is shown.
import verses from '../../../../data/quran/verses.json';
import { i18n, arDigits } from '../../core/i18n.js';
import { PROVISIONAL, SPEED } from './config.js';
import { h } from '../../ui/dom.js';
import { CT, CT_LABEL } from './events.js';

const byKey = Object.fromEntries(verses.verses.map((v) => [v.key, v]));
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const ayahMark = (n) => `۝${arDigits(n)}`;

// ------------------------------------------------------------------ SHA-256 (WebCrypto, with a small fallback for insecure contexts)
function sha256Fallback(bytes) {
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const l = bytes.length, padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  padded.set(bytes); padded[l] = 0x80;
  const dv = new DataView(padded.buffer); dv.setUint32(padded.length - 4, l * 8); dv.setUint32(padded.length - 8, Math.floor(l / 0x20000000));
  const W = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = r(W[i - 15], 7) ^ r(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = r(W[i - 2], 17) ^ r(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += hh;
  }
  return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('');
}
async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(bytes);
}
export async function verifyVerse(key) {
  const v = byKey[key];
  if (!v) return false;
  for (const a of v.ayah_texts) if ((await sha256(a.ar)) !== a.sha256) return false;
  return true;
}
export const verseData = (key) => byKey[key];

function refText(v) {
  const a = v.ayahs, one = a.length === 1;
  return {
    ar: `سورة ${v.surah_name_ar} · ${one ? 'الآية' : 'الآيات'} ${arDigits(a[0])}${one ? '' : `–${arDigits(a[a.length - 1])}`}`,
    en: `Surah ${v.surah_name_en} · ${one ? 'Verse' : 'Verses'} ${a[0]}${one ? '' : `–${a[a.length - 1]}`}`,
  };
}

/**
 * Reveal a passage in three visibly separate layers:
 *   1 QURAN_ARABIC       the verified text, word by word, right to left
 *   2 TRANSLATION        an approved translation, labelled as a translation of the meaning
 *   3 DALIL_EXPLANATION  Dalil's explanation, labelled as not Qur'anic text, only after reading time
 * `anchor()` gives the screen point of the world place the verse rises from.
 * hooks: onWord(i, n), onReadDone() when the minimum reading time has passed (before the explanation).
 * Resolves when the player continues.
 */
export async function revealVerse(key, { anchor, readable = false, explanation = null, hooks = {} } = {}) {
  const v = byKey[key];
  const ok = await verifyVerse(key);
  if (!ok) { console.error(`[fitrah] verse ${key} failed its integrity check; nothing is shown.`); return { shown: false }; }
  const revealStart = performance.now();
  const words = v.ayah_texts.map((a) => a.ar.split(' '));
  const totalWords = words.reduce((s, w) => s + w.length, 0);
  // each ayah fades in over 2.5 s; then 2.5 s + 0.35 s per word to read; never under 12 s on screen
  const minRead = Math.max(12, 2.5 * v.ayah_texts.length + 2.5 + 0.35 * totalWords) / SPEED;
  const label = (type, extra = '') => h('p', { class: 'layer-label', 'data-type': type }, i18n.t(CT_LABEL[type]) + extra);

  const ayahEls = v.ayah_texts.map((a, ai) => h('p', { class: 'ayah', lang: 'ar', dir: 'rtl' },
    ...words[ai].flatMap((w, wi) => [h('span', { class: 'w' }, w), wi < words[ai].length - 1 ? ' ' : '']),
    ' ', h('span', { class: 'w mark' }, ayahMark(a.n))));
  const ref = h('p', { class: 'ref' }, i18n.t(refText(v)));
  const quran = h('div', { class: 'layer quran', 'data-type': CT.QURAN_ARABIC }, label(CT.QURAN_ARABIC), h('div', { class: 'ayat' }, ...ayahEls), ref);

  const trText = h('p', { class: 'translation', lang: 'en', dir: 'ltr' }, ...v.ayah_texts.flatMap((a) => [a.en, h('span', { class: 'num' }, ` (${a.n}) `)]));
  const trLayer = h('div', { class: 'layer translation-layer', 'data-type': CT.TRANSLATION }, label(CT.TRANSLATION, ` · ${v.translation_en_author}`), trText);
  // Arabic readers see the translation only on request; English readers always
  const trToggle = i18n.lang === 'ar' ? h('button', { class: 'tr-toggle', type: 'button' }, 'عرض ترجمة المعاني بالإنجليزية') : null;
  if (trToggle) { trLayer.classList.add('collapsed'); trToggle.addEventListener('click', () => { trLayer.classList.toggle('collapsed'); }); }

  // the verses of this scene are confirmed by the project: no review badge on the card
  const tags = h('div', { class: 'tags' });
  const exLayer = explanation ? h('div', { class: 'layer explain', 'data-type': CT.DALIL_EXPLANATION },
    label(CT.DALIL_EXPLANATION), h('p', { class: 'explain-text', lang: i18n.lang, dir: i18n.dir }, i18n.t(explanation))) : null;
  const cont = h('button', { class: 'continue', type: 'button' }, i18n.t({ ar: 'متابعة', en: 'Continue' }));
  const box = h('section', { class: `verse${readable ? ' readable' : ''}`, role: 'dialog', 'aria-label': i18n.t(refText(v)) },
    quran, trToggle, trLayer, tags, exLayer, cont);
  document.getElementById('verse-layer').append(box);

  // place it at the world anchor (computed once: the camera is locked for the reveal)
  const a = anchor?.();
  const place = () => {
    if (!a) return;
    if (!box.isConnected) { window.removeEventListener('resize', place); return; }
    const W = window.innerWidth, Hh = window.innerHeight;
    if (box.getBoundingClientRect().height > Hh * 0.88) box.classList.add('compact');
    const r = box.getBoundingClientRect(), bh = r.height, half = r.width / 2;
    // near the anchor, but never past the screen's edges (on a phone the box is nearly full width)
    const lo = Math.max(W * 0.38, half + 8), hi = Math.min(W * 0.62, W - half - 8);
    box.style.left = `${lo <= hi ? Math.min(hi, Math.max(lo, a.x)) : W / 2}px`;
    box.style.top = `${Math.min(Hh - bh / 2 - 12, Math.max(bh / 2 + 12, a.y))}px`;
    // a short screen (a phone on its side) may still not hold every layer: then the box scrolls
    box.classList.toggle('scrolls', overflow() > 2);
  };
  // how far the layers run past the box (measured to the last layer: the soft backdrop drawn
  // around the text must not count as content)
  function overflow() { return cont.offsetTop + cont.offsetHeight - box.clientHeight; }
  place();
  window.addEventListener('resize', place);
  requestAnimationFrame(() => box.classList.add('in'));

  // layer 1: words fade in one by one, in reading order (right to left); each ayah over 2.5 s
  const spans = [...box.querySelectorAll('.ayah .w')];
  let wi = 0;
  for (let ai = 0; ai < ayahEls.length; ai++) {
    const ws = [...ayahEls[ai].querySelectorAll('.w')];
    const per = REDUCED ? 0 : (2.5 / ws.length) / SPEED;
    for (const s of ws) {
      s.classList.add('on'); hooks.onWord?.(wi++, spans.length);
      if (per) await new Promise((r) => setTimeout(r, per * 1000));
    }
    if (!REDUCED) await new Promise((r) => setTimeout(r, 400 / SPEED));
  }
  ref.classList.add('on'); quran.classList.add('done');
  // layer 2: the translation follows the Arabic, never replaces it
  await new Promise((r) => setTimeout(r, 900 / SPEED));
  trLayer.classList.add('on'); trText.classList.add('on'); tags.classList.add('on'); trToggle?.classList.add('on');
  // the reader's time: nothing else appears until it has passed
  await new Promise((r) => setTimeout(r, Math.max(0, minRead * 1000 - (performance.now() - revealStart))));
  hooks.onReadDone?.();
  // layer 3: Dalil's explanation, set apart and labelled
  if (exLayer) {
    exLayer.classList.add('on'); place();
    const t = (3.5 + i18n.t(explanation).length * 0.045) / SPEED;
    await new Promise((r) => setTimeout(r, t * 1000));
  }
  cont.classList.add('on');
  cont.focus({ preventScroll: true });
  // Continue must be on screen and reachable, however short the screen
  if (overflow() > 2) box.scrollTo({ top: overflow(), behavior: 'smooth' });
  await new Promise((r) => cont.addEventListener('click', r, { once: true }));
  box.classList.remove('in'); box.classList.add('out');
  setTimeout(() => box.remove(), 1200);
  return { shown: true };
}
