// The interface of the Fitrah level. It stays quiet: Dalil's words in one steady panel at the bottom,
// the names of things beside the things, one heading when a question is answered,
// one button when the player decides to go on. A corner menu holds language,
// depth, sound, the review jumps and the list of everything still provisional.
import * as THREE from 'three';
import { i18n, arDigits } from '../../core/i18n.js';
import { h } from '../../ui/dom.js';
import { CT } from '../../core/sacred/content-types.js';
import { createCaption } from '../../core/ui/caption.js';
import { C } from './content.js';
import { DEBUG } from './config.js';

const tracked = [];
function T(el, obj) { el.textContent = i18n.t(obj); tracked.push([el, obj]); return el; }
i18n.onChange(() => { for (const [el, obj] of tracked) if (el.isConnected) el.textContent = i18n.t(obj); });
const tx = (obj, tag = 'span', attrs = {}) => T(h(tag, attrs), obj);
const num = (n) => (i18n.lang === 'ar' ? arDigits(n) : String(n));
const refLabel = (r) => (r.startsWith('hadith:') ? { ar: 'حديث «بُني الإسلام على خمس»', en: 'Hadith "built on five"' } : { ar: arDigits(r), en: r });

export function createUI({ camera }) {
  const root = document.getElementById('ui');
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite', role: 'status' });
  root.append(live);
  const state = { askOpen: false, readable: false, sound: true, menuOpen: false, depth: 'exploring' };
  const cb = {};

  // ------------------------------------------------------------------ hint
  const hintEl = h('div', { class: 'hint', 'aria-hidden': 'true' });
  root.append(hintEl);
  let hintObj = null;
  function hint(obj) {
    hintObj = obj;
    if (!obj) { hintEl.classList.remove('on'); return; }
    hintEl.textContent = i18n.t(obj); hintEl.classList.add('on');
  }
  i18n.onChange(() => { if (hintObj) hintEl.textContent = i18n.t(hintObj); });

  // ------------------------------------------------------------------ caption: one steady panel at the bottom edge (shared with The Water)
  const capPanel = createCaption({
    root, live, base: 66,
    avoid: ['.next.on', '.choices.on', '.depth.on', '.end.on', '.ask.on'],
    citeLabel: (c) => i18n.t(refLabel(c)),
  });
  function caption(obj, { duration = 5, cites = [], source, type = CT.NARRATIVE_DIALOGUE } = {}) {
    capPanel.show(obj, { duration, cites, source, type });
  }
  const hideCaption = () => capPanel.hide();

  // ------------------------------------------------------------------ ask: a ribbon at the bottom, and a way to a person
  const askInput = h('input', { class: 'ask-input', type: 'text', maxlength: '300', autocomplete: 'off', enterkeyhint: 'send' });
  const askSend = h('button', { class: 'ask-send', type: 'button' });
  const askClose = h('button', { class: 'ask-close', type: 'button', 'aria-label': 'Close' }, '×');
  const askChips = h('div', { class: 'ask-chips' });
  const askStatus = h('div', { class: 'ask-status', 'aria-live': 'polite' });
  const askTalk = h('button', { class: 'pill small talk-offer', type: 'button', hidden: true });
  T(askTalk, { ar: 'تحدّث مع إنسان', en: 'Talk to someone' });
  const askForm = h('form', { class: 'ask-row' }, askInput, askSend);
  const askNote = tx({ ar: 'دليل مرشدٌ يشرح بمصادر معتمدة، وليس عالمًا ولا مفتيًا.', en: 'Dalil is a guide who explains from approved sources, not a scholar or mufti.' }, 'p', { class: 'ask-note' });
  const ask = h('div', { class: 'ask', role: 'dialog', 'aria-label': 'Ask Dalil' }, askClose, askChips, askForm, h('div', { class: 'ask-foot' }, askStatus, askTalk), askNote);
  root.append(ask);
  T(askSend, { ar: 'اسأل', en: 'Ask' });
  let askHandlers = null, askSuggest = [];
  function renderChips() { askChips.replaceChildren(...askSuggest.map((s) => h('button', { class: 'chip', type: 'button', onClick: () => submit(i18n.t(s)) }, i18n.t(s)))); }
  function openAsk({ suggestions = [], onSubmit, onClose, onTalk }) {
    askHandlers = { onSubmit, onClose, onTalk };
    askSuggest = suggestions; renderChips();
    askInput.placeholder = i18n.t({ ar: 'اسأل دليل…', en: 'Ask Dalil…' });
    askInput.dir = i18n.dir; askInput.lang = i18n.lang;
    askStatus.textContent = ''; askTalk.hidden = true;
    ask.classList.add('on'); state.askOpen = true; askBtn.classList.add('hide');
    if (!window.matchMedia?.('(pointer: coarse)').matches) setTimeout(() => askInput.focus({ preventScroll: true }), 50);
  }
  i18n.onChange(() => { if (state.askOpen) { renderChips(); askInput.placeholder = i18n.t({ ar: 'اسأل دليل…', en: 'Ask Dalil…' }); askInput.dir = i18n.dir; } });
  function submit(text) {
    if (!text.trim() || !askHandlers) return;
    askInput.value = text; askInput.blur();
    askHandlers.onSubmit(text);
  }
  askForm.addEventListener('submit', (e) => { e.preventDefault(); submit(askInput.value); });
  askSend.addEventListener('click', () => submit(askInput.value));
  askTalk.addEventListener('click', () => askHandlers?.onTalk?.());
  function closeAsk(user = false) {
    ask.classList.remove('on'); state.askOpen = false; askInput.value = '';
    askBtn.classList.toggle('hide', !askBtn.dataset.on);
    const hnd = askHandlers; askHandlers = null;
    if (user) hnd?.onClose?.();
  }
  askClose.addEventListener('click', () => closeAsk(true));
  ask.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeAsk(true); } });
  function askState(s) {
    ask.classList.toggle('listening', s === 'listening');
    askStatus.textContent = s === 'listening' ? i18n.t({ ar: 'دليل يُصغي…', en: 'Dalil is listening…' }) : '';
  }
  // the Ask button: Dalil can always be asked (tapping him does the same)
  const askBtn = h('button', { class: 'ask-btn hide', type: 'button' }, h('span', { class: 'dot', 'aria-hidden': 'true' }));
  askBtn.append(tx({ ar: 'اسأل دليل', en: 'Ask Dalil' }));
  askBtn.addEventListener('click', () => cb.onAsk?.());
  root.append(askBtn);

  // ------------------------------------------------------------------ names beside things (projected each frame)
  const labels = new Map();
  const _v = new THREE.Vector3();
  /** A label anchored to a world point. obj and sub are {ar,en}; cls styles it. */
  function label(id, obj, world, { cls = '', sub = null, dy = 0 } = {}) {
    unlabel(id, true);
    const el = h('div', { class: `wlabel ${cls}`, 'aria-hidden': 'true' }, tx(obj, 'span', { class: 'wl-main' }), sub ? tx(sub, 'span', { class: 'wl-sub' }) : null);
    root.append(el);
    const L = { el, world: world.clone(), dy };
    labels.set(id, L);
    requestAnimationFrame(() => el.classList.add('on'));
    return L;
  }
  function unlabel(id, now = false) {
    const L = labels.get(id); if (!L) return;
    labels.delete(id);
    if (now) { L.el.remove(); return; }
    L.el.classList.remove('on'); setTimeout(() => L.el.remove(), 900);
  }
  function clearLabels(now = false) { for (const id of [...labels.keys()]) unlabel(id, now); }
  const labelClass = (id, cls, on = true) => labels.get(id)?.el.classList.toggle(cls, on);

  // ------------------------------------------------------------------ the depth choice (asked once, never stored)
  function chooseDepth({ signal, timeout = 45 } = {}) {
    return new Promise((resolve) => {
      const done = (v) => { card.classList.remove('on'); setTimeout(() => card.remove(), 700); clearTimeout(timer); resolve(v); };
      const card = h('div', { class: 'depth', role: 'group' },
        tx(C.depth.question, 'p', { class: 'depth-q' }),
        h('div', { class: 'depth-opts' }, ...C.depth.options.map((o) => { const b = h('button', { type: 'button', class: 'pill', 'data-depth': o.id, onClick: () => done(o.id) }); T(b, o.label); return b; })),
        h('button', { type: 'button', class: 'depth-skip', onClick: () => done(null) }, tx(C.depth.skip)),
        tx(C.depth.note, 'p', { class: 'depth-note' }));
      root.append(card);
      requestAnimationFrame(() => card.classList.add('on'));
      const timer = setTimeout(() => done(null), timeout * 1000);
      signal?.addEventListener('abort', () => { card.remove(); clearTimeout(timer); resolve(null); }, { once: true });
    });
  }

  // ------------------------------------------------------------------ chapter card, answer heading
  const chap = h('div', { class: 'chapter', 'aria-live': 'polite' });
  root.append(chap);
  let chapT = 0;
  function chapterCard(n, question, { draft = false, hold = 5 } = {}) {
    clearTimeout(chapT);
    chap.replaceChildren(...[
      h('p', { class: 'ch-n' }, `${num(n)} / ${num(4)}`),
      tx(question, 'h2', { class: 'ch-q' }),
      draft ? tx({ ar: 'نسخة أولى — تفاعل هذا الفصل قيد البناء', en: 'First version — this chapter’s interaction is still being built' }, 'p', { class: 'ch-draft' }) : null].filter(Boolean));
    chap.classList.add('on');
    chapT = setTimeout(() => chap.classList.remove('on'), hold * 1000);
  }
  const hideChapter = () => { clearTimeout(chapT); chap.classList.remove('on'); };
  const ans = h('div', { class: 'answer', 'aria-live': 'polite' });
  root.append(ans);
  function answer({ n, word, line }) {
    ans.replaceChildren(h('p', { class: 'an-n' }, `${num(n)}`), tx(word, 'h1', { class: 'an-word' }), tx(line, 'p', { class: 'an-line' }));
    ans.classList.remove('dock'); ans.classList.add('on');
    live.textContent = `${i18n.t(word)} — ${i18n.t(line)}`;
  }
  const dockAnswer = () => ans.classList.add('dock');
  const hideAnswer = () => ans.classList.remove('on', 'dock');

  // ------------------------------------------------------------------ going on: the player decides when
  let nextResolve = null;
  const nextBtn = h('button', { class: 'next pill', type: 'button' });
  root.append(nextBtn);
  function next(labelObj = { ar: 'متابعة', en: 'Continue' }, { signal } = {}) {
    T(nextBtn, labelObj);
    nextBtn.classList.add('on');
    return new Promise((resolve) => {
      nextResolve = () => { nextBtn.classList.remove('on'); nextResolve = null; resolve(true); };
      signal?.addEventListener('abort', () => { nextBtn.classList.remove('on'); nextResolve = null; resolve(false); }, { once: true });
    });
  }
  nextBtn.addEventListener('click', () => nextResolve?.());
  // a row of choices (the primary is last); Enter takes the primary
  const choices = h('div', { class: 'choices' });
  root.append(choices);
  let choiceResolve = null;
  function choice(items, { signal, onTap } = {}) {
    return new Promise((resolve) => {
      const done = (id) => { if (!choiceResolve) return; choiceResolve = null; choices.classList.remove('on'); resolve(id); };
      choices.replaceChildren(...items.map((it, k) => { const b = h('button', { type: 'button', class: `pill${it.quiet ? ' quiet' : ''}${k === items.length - 1 ? ' primary' : ''}`, onClick: () => done(it.id) }); T(b, it.label); return b; }));
      choiceResolve = () => done(items[items.length - 1].id);
      choices.classList.add('on');
      onTap?.(done);
      signal?.addEventListener('abort', () => { choiceResolve = null; choices.classList.remove('on'); resolve(null); }, { once: true });
    });
  }
  const goOn = () => { if (nextResolve) { nextResolve(); return true; } if (choiceResolve) { choiceResolve(); return true; } return false; };

  // ------------------------------------------------------------------ corner menu
  const menuBtn = h('button', { class: 'menu-btn', type: 'button', 'aria-haspopup': 'dialog', 'aria-label': 'Menu' }, h('span'), h('span'), h('span'));
  const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'false' });
  root.append(menuBtn, panel);
  const statusBox = h('div', { class: 'status' });
  function row(lab, ...controls) { return h('div', { class: 'row' }, tx(lab, 'span', { class: 'label' }), h('div', { class: 'ctrls' }, ...controls)); }
  const btn = (lab, fn, cls = '') => { const b = h('button', { type: 'button', class: `pill ${cls}`, onClick: fn }); T(b, lab); return b; };
  const langAr = btn({ ar: 'العربية', en: 'العربية' }, () => cb.onLang?.('ar'));
  const langEn = btn({ ar: 'English', en: 'English' }, () => cb.onLang?.('en'));
  const depthBtns = C.depth.options.map((o) => { const b = btn(o.label, () => cb.onDepth?.(o.id), 'small'); b.dataset.depth = o.id; return b; });
  const syncDepth = () => depthBtns.forEach((b) => b.classList.toggle('sel', b.dataset.depth === state.depth));
  const soundLabel = () => (state.sound ? { ar: 'الصوت: يعمل', en: 'Sound: on' } : { ar: 'الصوت: متوقف', en: 'Sound: off' });
  const soundBtn = btn(soundLabel(), () => { state.sound = !state.sound; cb.onSound?.(state.sound); T(soundBtn, soundLabel()); });
  const readLabel = () => (state.readable ? { ar: 'وضع القراءة: نعم', en: 'Readable verse: on' } : { ar: 'وضع القراءة: لا', en: 'Readable verse: off' });
  const readBtn = btn(readLabel(), () => { state.readable = !state.readable; T(readBtn, readLabel()); });
  const jumps = [
    ['four', { ar: 'الأسئلة', en: 'Questions' }], ['ch1', { ar: '١ من خلقني؟', en: '1 Who created me?' }], ['ch2', { ar: '٢ لماذا أنا هنا؟', en: '2 Why am I here?' }],
    ['ch3', { ar: '٣ كيف أعيش؟', en: '3 How should I live?' }], ['ch4', { ar: '٤ ماذا بعد الموت؟', en: '4 What comes after death?' }], ['ending', { ar: 'الختام', en: 'Ending' }],
  ].map(([k, l]) => btn(l, () => { toggleMenu(false); cb.onJump?.(k); }, 'small'));
  const R = C.review;
  const provList = h('ul', { class: 'prov' },
    ...R.additions.map((a) => h('li', {}, h('strong', {}, i18n.t(refLabel(a.ref))), ' — ', tx(a.role), ' ', tx({ ar: '(أُضيف، بانتظار المراجعة)', en: '(added, pending review)' }, 'em'))),
    ...R.pairings.map((p) => h('li', {}, tx(p.chapter === 'ending' ? { ar: 'الختام', en: 'Ending' } : { ar: `الفصل ${arDigits(p.chapter.slice(2))}`, en: `Chapter ${p.chapter.slice(2)}` }, 'strong'), ': ',
      h('span', {}, p.refs.map((r) => i18n.t(refLabel(r))).join(' · ')))),
    ...R.notes.map((n) => h('li', {}, tx(n))));
  panel.append(
    tx({ ar: 'فطرة · الأسئلة الأربعة — نموذج تجريبي', en: 'Fitrah · The Four Questions — prototype' }, 'h2'),
    row({ ar: 'اللغة', en: 'Language' }, langAr, langEn),
    row({ ar: 'أسلوب الشرح', en: 'Explanations' }, ...depthBtns),
    row({ ar: 'الصوت', en: 'Sound' }, soundBtn),
    row({ ar: 'الآية', en: 'Verse' }, readBtn),
    row({ ar: 'الفصول (للمراجعة)', en: 'Chapters (review)' }, ...jumps),
    h('div', { class: 'row' }, btn({ ar: 'تحدّث مع إنسان', en: 'Talk to someone' }, () => { toggleMenu(false); cb.onTalk?.(); }, 'small')),
    tx({ ar: 'بانتظار المراجعة الشرعية', en: 'Pending Sharia review' }, 'h3'), tx(R.status, 'p', { class: 'prov-status' }), provList,
    tx({ ar: 'حالة دليل', en: 'Dalil status' }, 'h3'), statusBox,
    h('div', { class: 'panel-end' }, btn({ ar: 'متابعة', en: 'Continue' }, () => toggleMenu(false)), exitBtn()),
  );
  function exitBtn(cls = '') {
    const b = btn({ ar: 'العودة إلى البداية', en: 'Back to the beginning' }, () => cb.onExit?.(), `quiet ${cls}`);
    b.dataset.exit = ''; b.hidden = !cb.onExit;
    return b;
  }
  const syncExit = () => { for (const b of root.querySelectorAll('[data-exit]')) b.hidden = !cb.onExit; };
  function toggleMenu(force) {
    state.menuOpen = force ?? !state.menuOpen;
    panel.classList.toggle('on', state.menuOpen);
    menuBtn.setAttribute('aria-expanded', String(state.menuOpen));
    if (state.menuOpen) { refreshStatus(); syncExit(); syncDepth(); }
  }
  menuBtn.addEventListener('click', () => toggleMenu());
  function refreshStatus() {
    const s = cb.getStatus?.() || {};
    statusBox.replaceChildren(...Object.entries(s).map(([k, v]) => h('div', { class: 'kv' }, h('span', {}, k), h('code', {}, String(v)))));
  }

  // ------------------------------------------------------------------ start card (opened directly, without the menu)
  function mountStart(onBegin) {
    const begin = (lang) => { i18n.set(lang); card.classList.add('out'); setTimeout(() => card.remove(), 900); onBegin(lang); };
    const card = h('div', { class: 'start' },
      h('div', { class: 'start-inner' },
        h('p', { class: 'kicker' }, 'FITRAH · فطرة'),
        h('h1', { lang: 'ar' }, 'فطرة'),
        h('p', { class: 'sub' }, 'The Four Questions · الأسئلة الأربعة'),
        h('p', { class: 'note', lang: 'ar', dir: 'rtl' }, 'نموذج تجريبي قابل للعب — للمراجعة'),
        h('p', { class: 'note' }, 'Playable prototype — for review'),
        h('div', { class: 'langs' },
          h('button', { type: 'button', class: 'pill big', lang: 'ar', onClick: () => begin('ar') }, 'ابدأ بالعربية'),
          h('button', { type: 'button', class: 'pill big', onClick: () => begin('en') }, 'Begin in English'))));
    root.append(card);
    return card;
  }

  // ------------------------------------------------------------------ end card: where to go from here
  function endCard({ onTafakor, onAsk, onTalk, onMenu }) {
    const I = C.ending.invite;
    const card = h('div', { class: 'end' },
      tx({ ar: 'فطرة · اكتملت الأسئلة الأربعة', en: 'Fitrah · the four questions' }, 'p', { class: 'kicker' }),
      h('div', { class: 'langs' },
        onTafakor ? btn(I.tafakor, onTafakor, 'gold') : null, btn(I.ask, onAsk), btn(I.talk, onTalk)),
      onMenu ? btn(I.menu, onMenu, 'quiet end-exit') : null);
    root.append(card);
    requestAnimationFrame(() => card.classList.add('on'));
    return card;
  }

  // ------------------------------------------------------------------ debug HUD (?debug)
  const hud = DEBUG ? h('pre', { class: 'hud' }) : null;
  if (hud) root.append(hud);

  function update() {
    capPanel.update();
    const W = window.innerWidth, H = window.innerHeight;
    for (const L of labels.values()) {
      _v.copy(L.world).project(camera);
      const vis = _v.z < 1 && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2;
      L.el.style.visibility = vis ? '' : 'hidden';
      if (vis) L.el.style.transform = `translate(${Math.round((_v.x * 0.5 + 0.5) * W)}px, ${Math.round((-_v.y * 0.5 + 0.5) * H + L.dy)}px) translate(-50%, 0)`;
    }
    if (hud && cb.getStatus) hud.textContent = Object.entries(cb.getStatus(true)).map(([k, v]) => `${k}: ${v}`).join('\n');
  }

  return {
    hint, caption, hideCaption, openAsk, closeAsk, askState, askOpen: () => state.askOpen,
    offerTalk(on) { askTalk.hidden = !on; },
    showAskButton(on) { askBtn.dataset.on = on ? '1' : ''; askBtn.classList.toggle('hide', !on || state.askOpen); },
    label, unlabel, clearLabels, labelClass, labels,
    chooseDepth, chapterCard, hideChapter, answer, choice,
    /** names in the hall step back while a source is on screen */
    hushLabels(on) { root.classList.toggle('hush', on); }, dockAnswer, hideAnswer, next, goOn,
    live: (obj) => { live.textContent = i18n.t(obj); }, toggleMenu, mountStart, endCard, update, state, cb, refreshStatus,
    setDepth(d) { state.depth = d; syncDepth(); },
    get readable() { return state.readable; },
    flash(obj, s = 4) { hint(obj); setTimeout(() => { if (hintObj === obj) hint(null); }, s * 1000); },
  };
}
