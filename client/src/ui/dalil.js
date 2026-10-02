// Dalil's panel. The live retrieval server is not connected in this build, so
// Dalil answers the suggested questions from the reviewed fallback answers and
// applies its safety rules locally: refer, decline, or point to a person.
import { gsap } from 'gsap';
import { h, root, ICON, D, typeInto, hide } from './dom.js';
import { i18n, t } from '../core/i18n.js';
import { script as S, verseRef } from '../core/content.js';
import { audio } from '../core/audio.js';
import * as store from '../core/store.js';
import { verseCard, referralForm } from './components.js';

const SYS = S.dalil.system;
const ALL_QA = S.world1.stations.flatMap((st) => st.dalil_suggestions);

const norm = (s) => s.toLowerCase()
  .replace(/[ً-ْٰـ]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[؟?!.,،«»"'():]/g, ' ')
  .replace(/\s+/g, ' ').trim();
const STOP = new Set(['هل', 'ما', 'من', 'في', 'على', 'عن', 'ان', 'او', 'و', 'the', 'a', 'an', 'is', 'of', 'in', 'to', 'does', 'do', 'what', 'and', 'it', 'this', 'that']);
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w)));

const RULES = [
  { key: 'distress', words: ['انتحار', 'اقتل نفسي', 'انهي حياتي', 'لا اريد العيش', 'يائس', 'suicide', 'kill myself', 'end my life', 'self harm', 'self-harm', 'hopeless', 'no reason to live'] },
  { key: 'cannot_alter_text', words: ['اكتب ايه', 'ايه جديده', 'غير الايه', 'بدل الايه', 'write a verse', 'new verse', 'change the verse', 'replace', 'rewrite the verse', 'in the style of the quran'] },
  { key: 'fatwa', words: ['يجوز', 'حرام', 'حلال', 'حكم', 'فتوي', 'haram', 'halal', 'allowed', 'permissible', 'ruling', 'fatwa', 'is it a sin', 'valid in islam'] },
  { key: 'respect', words: ['غبي', 'غبيه', 'ارهاب', 'stupid', 'violent', 'terror', 'ridiculous', 'idiots', 'false religion'] },
];

export function matchQuestion(text) {
  const n = norm(text);
  const padded = ` ${n} `;
  const hit = (w) => { const nw = norm(w); return nw.includes(' ') ? n.includes(nw) : padded.includes(` ${nw} `); };
  for (const r of RULES) if (r.words.some(hit)) return { type: 'system', key: r.key };
  const tk = tokens(text);
  let best = null, score = 0;
  for (const qa of ALL_QA) {
    for (const lang of ['ar', 'en']) {
      const qt = tokens(qa.question[lang]);
      const inter = [...tk].filter((w) => qt.has(w)).length;
      const s = inter / Math.max(1, Math.min(tk.size, qt.size) + 0.5 * Math.abs(tk.size - qt.size));
      if (s > score) { score = s; best = qa; }
    }
  }
  if (best && score >= 0.5) return { type: 'qa', qa: best };
  return { type: 'system', key: 'offline' };
}

let panel = null;

export function openDalil(context = {}) {
  if (panel) { panel.focusInput(); return panel; }
  const suggestions = context.suggestions ?? [];
  const body = h('div', { class: 'dp-body', 'aria-live': 'polite' });
  const input = h('input', { id: 'dalil-q', type: 'text', placeholder: t(S.dalil.input_placeholder), autocomplete: 'off' });
  const send = h('button', { class: 'send', type: 'submit', 'aria-label': t(S.ui.dalil_panel.send) }, ICON.send('#04201c', 20, i18n.dir === 'rtl'));
  const form = h('form', { class: 'dp-input' }, h('label', { for: 'dalil-q', class: 'sr-only' }, t(S.dalil.input_placeholder)), input, send);
  const closeBtn = h('button', { class: 'close-x', style: { position: 'static' }, 'aria-label': t(S.ui.dalil_panel.close) }, ICON.close());
  const el = h('aside', { class: 'glass dalil-panel', role: 'dialog', 'aria-label': t(S.dalil.name) },
    h('div', { class: 'dp-head' },
      h('span', { class: 'avatar', style: { width: '38px', height: '38px' } }, ICON.spark('#5fe3d0', 20)),
      h('div', { class: 'name' }, h('b', {}, t(S.dalil.name)), h('small', {}, t(S.ui.dalil_panel.tagline))),
      closeBtn),
    body, form);
  root().append(el);
  gsap.fromTo(el, { opacity: 0, x: i18n.dir === 'rtl' ? 40 : -40 }, { opacity: 1, x: 0, duration: D(0.6), ease: 'power3.out' });

  const scroll = () => { body.scrollTop = body.scrollHeight; };
  let suggBox = null;
  const renderSuggestions = (list) => {
    suggBox?.remove();
    const remaining = list.filter((q) => !q._asked);
    if (!remaining.length) return;
    suggBox = h('div', { class: 'dp-sugg' }, h('small', {}, t(S.ui.dalil_panel.other_questions)),
      h('div', { class: 'list' }, ...remaining.map((q) => h('button', { class: 'sugg', onClick: () => { q._asked = true; ask(t(q.question), { type: 'qa', qa: q }); } }, t(q.question)))));
    body.append(suggBox); scroll();
  };

  async function reply(result) {
    const typing = h('div', { class: 'bubble dl' }, h('span', { class: 'typing' }, h('i'), h('i'), h('i')));
    body.append(typing); scroll();
    await new Promise((r) => setTimeout(r, 700));
    const txt = h('span');
    const bubble = h('div', { class: 'bubble dl' });
    typing.replaceWith(bubble);
    if (result.type === 'qa') {
      bubble.append(txt);
      await typeInto(txt, t(result.qa.answer), 70);
      const srcs = h('div', { class: 'srcs' }, h('small', {}, t(S.dalil.source_label)),
        ...result.qa.sources.map((k) => h('button', { class: 'chip-src', onClick: () => verseCard(k, { mode: 'view' }) }, ICON.book('#e8c277', 15), `${verseRef(k)} · ${t(S.ui.dalil_panel.read_verse)}`)));
      bubble.append(srcs);
      if (result.qa.offer_human) bubble.append(h('div', { class: 'row-end' }, h('button', { class: 'btn btn-aqua-ghost btn-sm', onClick: referralForm }, t(S.dalil.talk_to_human))));
      store.log('dalil_answer', { id: result.qa.id });
    } else {
      const abstain = result.key !== 'offline';
      if (abstain) bubble.append(h('span', { class: 'abstain-badge' }, ICON.info(), t(S.ui.dalil_panel.abstained_badge)));
      bubble.append(txt);
      await typeInto(txt, t(SYS[result.key]), 70);
      const acts = h('div', { class: 'row-end' });
      if (result.key !== 'offline') acts.append(h('button', { class: 'btn btn-aqua btn-sm', onClick: referralForm }, t(S.dalil.talk_to_human)));
      acts.append(h('button', { class: 'btn btn-ghost btn-sm', onClick: () => input.focus() }, t(S.ui.dalil_panel.ask_another)));
      bubble.append(acts);
      store.log('dalil_abstain', { reason: result.key });
    }
    scroll();
    renderSuggestions(suggestions);
  }

  async function ask(text, preset) {
    suggBox?.remove();
    body.append(h('div', { class: 'bubble me' }, text)); scroll();
    audio.soft();
    await reply(preset ?? matchQuestion(text));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim(); if (!q) return;
    input.value = '';
    const m = matchQuestion(q);
    if (m.type === 'qa') m.qa._asked = true;
    ask(q, m);
  });

  const close = () => { hide(el); panel = null; context.onClose?.(); };
  closeBtn.addEventListener('click', close);
  renderSuggestions(suggestions);
  panel = { el, close, focusInput: () => input.focus() };
  setTimeout(() => input.focus({ preventScroll: true }), 400);
  return panel;
}

export function closeDalil() { panel?.close(); }
