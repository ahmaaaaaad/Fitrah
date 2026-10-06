// The interface layer: one quiet corner menu, Dalil's caption and ask ribbon,
// a live region for screen readers, the start and end cards, and the review
// panel that lists every provisional decision.
import { i18n, arDigits } from '../../core/i18n.js';
import { h } from '../../ui/dom.js';
import { PROVISIONAL, DEBUG, CONFIG, REVIEW } from './config.js';
import { CT } from './events.js';
import { createCaption } from '../../core/ui/caption.js';

const tracked = [];
function T(el, obj) { el.textContent = i18n.t(obj); tracked.push([el, obj]); return el; }
i18n.onChange(() => { for (const [el, obj] of tracked) if (el.isConnected) el.textContent = i18n.t(obj); });
const tx = (obj, tag = 'span', attrs = {}) => T(h(tag, attrs), obj);

export function createUI() {
  const root = document.getElementById('ui');
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite', role: 'status' });
  root.append(live);
  const state = { askOpen: false, readable: false, sound: true, menuOpen: false };
  const cb = {};

  // ------------------------------------------------------------------ hint
  const hintEl = h('div', { class: 'hint', 'aria-hidden': 'true' });
  root.append(hintEl);
  let hintObj = null;
  function hint(obj) {
    if (obj === hintObj) return;
    hintObj = obj;
    if (!obj) { hintEl.classList.remove('on'); return; }
    hintEl.textContent = i18n.t(obj); hintEl.classList.add('on');
  }
  i18n.onChange(() => { if (hintObj) hintEl.textContent = i18n.t(hintObj); });

  // ------------------------------------------------------------------ caption: one steady panel at the bottom edge (shared with Fitrah)
  const capPanel = createCaption({ root, live, base: 18, avoid: ['.end.on', '.ask.on'], citeLabel: (c) => (i18n.lang === 'ar' ? arDigits(c) : c) });
  function caption(obj, { duration = 5, cites = [], source, type = CT.NARRATIVE_DIALOGUE } = {}) {
    capPanel.show(obj, { duration, cites, source, type });
  }
  const hideCaption = () => capPanel.hide();

  // ------------------------------------------------------------------ ask ribbon
  const askInput = h('input', { class: 'ask-input', type: 'text', maxlength: '300', autocomplete: 'off' });
  const askSend = h('button', { class: 'ask-send', type: 'button' });
  const askClose = h('button', { class: 'ask-close', type: 'button', 'aria-label': 'Close' }, '×');
  const askChips = h('div', { class: 'ask-chips' });
  const askStatus = h('div', { class: 'ask-status', 'aria-live': 'polite' });
  const askForm = h('form', { class: 'ask-row' }, askInput, askSend);
  const ask = h('div', { class: 'ask', role: 'dialog' }, askClose, askChips, askForm, askStatus);
  root.append(ask);
  T(askSend, { ar: 'اسأل', en: 'Ask' });
  let askHandlers = null;
  function openAsk({ suggestions, onSubmit, onClose }) {
    askHandlers = { onSubmit, onClose };
    askInput.placeholder = i18n.t({ ar: 'اسأل دليل…', en: 'Ask Dalil…' });
    askInput.dir = i18n.dir; askInput.lang = i18n.lang;
    askChips.replaceChildren(...suggestions.map((s) => h('button', { class: 'chip', type: 'button', onClick: () => submit(i18n.t(s.text)) }, i18n.t(s.text))));
    askStatus.textContent = '';
    ask.classList.add('on'); state.askOpen = true;
    setTimeout(() => askInput.focus({ preventScroll: true }), 50);
  }
  function submit(text) {
    if (!text.trim() || !askHandlers) return;
    askInput.value = text;
    askHandlers.onSubmit(text);
  }
  askForm.addEventListener('submit', (e) => { e.preventDefault(); submit(askInput.value); });
  askSend.addEventListener('click', () => submit(askInput.value));
  function closeAsk(user = false) {
    ask.classList.remove('on'); state.askOpen = false; askInput.value = '';
    if (user) askHandlers?.onClose?.();
    askHandlers = null;
  }
  askClose.addEventListener('click', () => closeAsk(true));
  ask.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeAsk(true); } });
  function askState(s) {
    ask.classList.toggle('listening', s === 'listening');
    askStatus.textContent = s === 'listening' ? i18n.t({ ar: 'دليل يُصغي…', en: 'Dalil is listening…' }) : '';
  }

  // ------------------------------------------------------------------ corner menu
  const menuBtn = h('button', { class: 'menu-btn', type: 'button', 'aria-haspopup': 'dialog', 'aria-label': 'Menu' }, h('span'), h('span'), h('span'));
  const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'false' });
  root.append(menuBtn, panel);
  const statusBox = h('div', { class: 'status' });
  function row(label, ...controls) { return h('div', { class: 'row' }, tx(label, 'span', { class: 'label' }), h('div', { class: 'ctrls' }, ...controls)); }
  const btn = (label, fn, cls = '') => { const b = h('button', { type: 'button', class: `pill ${cls}`, onClick: fn }); T(b, label); return b; };
  const langAr = btn({ ar: 'العربية', en: 'العربية' }, () => cb.onLang?.('ar'));
  const langEn = btn({ ar: 'English', en: 'English' }, () => cb.onLang?.('en'));
  const soundBtn = btn({ ar: 'الصوت: يعمل', en: 'Sound: on' }, () => { state.sound = !state.sound; cb.onSound?.(state.sound); T(soundBtn, state.sound ? { ar: 'الصوت: يعمل', en: 'Sound: on' } : { ar: 'الصوت: متوقف', en: 'Sound: off' }); });
  const readBtn = btn({ ar: 'وضع القراءة: لا', en: 'Readable verse: off' }, () => { state.readable = !state.readable; T(readBtn, state.readable ? { ar: 'وضع القراءة: نعم', en: 'Readable verse: on' } : { ar: 'وضع القراءة: لا', en: 'Readable verse: off' }); });
  const jumps = [
    ['current', { ar: 'الريح', en: 'Wind' }], ['rain', { ar: 'المطر', en: 'Rain' }], ['water', { ar: 'الماء', en: 'Water' }],
    ['stream', { ar: 'الجدول', en: 'Stream' }], ['meadow', { ar: 'المرج', en: 'Meadow' }], ['light', { ar: 'النور', en: 'Light' }],
  ].map(([k, l]) => btn(l, () => { cb.onJump?.(k); toggleMenu(false); }, 'small'));
  const provList = h('ul', { class: 'prov' });
  const P = PROVISIONAL;
  const altOf = (k) => (k === '57:17' ? '30:50' : '57:17');
  const provItems = () => [
    [{ ar: 'الماء كأول مشاهد فطرة', en: 'The Water as Fitrah’s first scene' }, { ar: 'يُختبر عبر هذا النموذج', en: 'validated through this prototype' }],
    [{ ar: `آية الماء: ${arDigits(P.verses.revival)}`, en: `Water verse: ${P.verses.revival}` }, { ar: 'معتمدة', en: 'confirmed' }],
    [{ ar: `الآية الأخيرة: ${arDigits(P.verses.final)} (البديل ${arDigits(altOf(P.verses.final))})`, en: `Final verse: ${P.verses.final} (alternative ${altOf(P.verses.final)})` }, { ar: 'معتمدة', en: 'confirmed' }],
    [{ ar: 'الموسيقى', en: 'Music' }, { ar: 'القناة موجودة ومعطّلة حتى المراجعة الإبداعية والشرعية', en: 'bus exists, disabled until the creative and Sharia review' }],
    [{ ar: 'التلاوة', en: 'Recitation' }, { ar: P.audio.recitation.src ? 'ملف مرخّص مُعدّ' : 'لا يوجد ملف مرخّص بعد', en: P.audio.recitation.src ? 'licensed file configured' : 'no licensed file configured yet' }],
    [{ ar: 'هيئة دليل: نورٌ يمشي', en: 'Dalil’s form: a walking light' }, { ar: 'بانتظار صاحب المشروع والمراجعة', en: 'pending project owner and review' }],
    [{ ar: 'اللاعب شاهد: يتتبّع ويكشف ويصل ويُبصر', en: 'The player as witness: trace, reveal, connect, align' }, { ar: 'نموذج التفاعل يُختبر عبر هذا النموذج', en: 'interaction model validated through this prototype' }],
    [{ ar: 'شروح دليل وسطوره', en: 'Dalil’s explanations and lines' }, { ar: 'مكتوبة للنموذج، بانتظار المراجعة', en: 'authored for the prototype, pending review' }],
  ];
  function renderProv() { provList.replaceChildren(...provItems().map(([a, b]) => h('li', {}, tx(a, 'strong'), ' — ', tx(b, 'span')))); }
  renderProv();
  // reviewers can compare the two candidates in place (until the page reloads)
  const altBtn = h('button', { type: 'button', class: 'pill small' });
  const altLabel = () => ({ ar: `اعرض الآية البديلة (${arDigits(altOf(P.verses.final))}) عند النهاية`, en: `Show the alternative (${altOf(P.verses.final)}) at the end` });
  T(altBtn, altLabel());
  altBtn.addEventListener('click', () => { P.verses.final = altOf(P.verses.final); renderProv(); T(altBtn, altLabel()); refreshStatus(); });
  // the player's menu: language, sound, reading. The reviewers' tools (beat jumps, provisional
  // decisions, Dalil's status) appear with ?review.
  panel.append(...[
    tx({ ar: 'تفكّر · الماء', en: 'Tafakor · The Water' }, 'h2'),
    row({ ar: 'اللغة', en: 'Language' }, langAr, langEn),
    row({ ar: 'الصوت', en: 'Sound' }, soundBtn),
    row({ ar: 'الآية', en: 'Verse' }, readBtn),
    REVIEW ? row({ ar: 'انتقال للمراجعة', en: 'Jump (review)' }, ...jumps) : null,
    REVIEW ? tx({ ar: 'قرارات للمراجعة', en: 'Decisions for review' }, 'h3') : null, REVIEW ? provList : null, REVIEW ? altBtn : null,
    REVIEW ? tx({ ar: 'حالة دليل', en: 'Dalil status' }, 'h3') : null, REVIEW ? statusBox : null,
    h('div', { class: 'panel-end' },
      btn({ ar: 'متابعة', en: 'Continue' }, () => toggleMenu(false)),
      exitBtn()),
  ].filter(Boolean));
  // back to the menu of scenes (only when the level was opened by the shell)
  function exitBtn(cls = '') {
    const b = btn({ ar: 'العودة إلى المشاهد', en: 'Back to the scenes' }, () => cb.onExit?.(), `quiet ${cls}`);
    b.dataset.exit = '';
    b.hidden = !cb.onExit;
    return b;
  }
  // without a shell to return to, the exit buttons stay hidden
  const syncExit = () => { for (const b of root.querySelectorAll('[data-exit]')) b.hidden = !cb.onExit; };
  function toggleMenu(force) {
    state.menuOpen = force ?? !state.menuOpen;
    panel.classList.toggle('on', state.menuOpen);
    menuBtn.setAttribute('aria-expanded', String(state.menuOpen));
    cb.onPause?.(state.menuOpen);
    if (state.menuOpen) { refreshStatus(); syncExit(); }
  }
  menuBtn.addEventListener('click', () => toggleMenu());
  function refreshStatus() {
    const s = cb.getStatus?.() || {};
    statusBox.replaceChildren(...Object.entries(s).map(([k, v]) => h('div', { class: 'kv' }, h('span', {}, k), h('code', {}, String(v)))));
  }

  // ------------------------------------------------------------------ start card
  function mountStart(onBegin) {
    const begin = (lang) => { i18n.set(lang); card.classList.add('out'); setTimeout(() => card.remove(), 900); onBegin(lang); };
    const card = h('div', { class: 'start' },
      h('div', { class: 'start-inner' },
        h('p', { class: 'kicker' }, 'FITRAH · فطرة'),
        h('h1', { lang: 'ar' }, 'الماء'),
        h('p', { class: 'sub' }, 'The Water'),
        h('div', { class: 'langs' },
          h('button', { type: 'button', class: 'pill big', lang: 'ar', onClick: () => begin('ar') }, 'ابدأ بالعربية'),
          h('button', { type: 'button', class: 'pill big', onClick: () => begin('en') }, 'Begin in English')),
        h('p', { class: 'how', lang: 'ar', dir: 'rtl' }, 'يُفضَّل الاستماع بسمّاعات'),
        h('p', { class: 'how' }, 'Best with sound on'),
      ));
    root.append(card);
    return card;
  }

  // ------------------------------------------------------------------ end card
  function endCard({ onReplay }) {
    const card = h('div', { class: 'end' },
      tx({ ar: 'الماء · اكتمل المشهد', en: 'The Water · the scene is complete' }, 'p', { class: 'kicker' }),
      tx({ ar: 'يمكنك البقاء في المرج، أو سؤال دليل عمّا رأيت، أو العودة إلى المشاهد.', en: 'Stay in the meadow, ask Dalil about what you saw, or return to the scenes.' }, 'p'),
      h('div', { class: 'langs' }, ...[btn({ ar: 'إعادة', en: 'Play again' }, onReplay), REVIEW ? btn({ ar: 'قرارات للمراجعة', en: 'Decisions for review' }, () => toggleMenu(true)) : null].filter(Boolean)),
      exitBtn('end-exit'));
    root.append(card);
    requestAnimationFrame(() => card.classList.add('on'));
  }

  // ------------------------------------------------------------------ debug HUD (?debug)
  const hud = DEBUG ? h('pre', { class: 'hud' }) : null;
  if (hud) root.append(hud);

  function update() {
    capPanel.update();
    if (hud && cb.getStatus) hud.textContent = Object.entries(cb.getStatus(true)).map(([k, v]) => `${k}: ${v}`).join('\n');
  }

  return {
    hint, caption, hideCaption, openAsk, closeAsk, askState, askOpen: () => state.askOpen,
    live: (obj) => { live.textContent = i18n.t(obj); }, toggleMenu, mountStart, endCard, update, state, cb, refreshStatus,
    get readable() { return state.readable; },
    flash(obj) { hint(obj); setTimeout(() => { if (hintObj === obj) hint(null); }, 4000); },
    CONFIG,
  };
}
