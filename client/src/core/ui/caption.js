// Dalil's words on screen, the same in every level: one steady panel at the bottom
// edge, like a film's subtitles. It never follows him around the screen, never
// covers the middle of the picture, and lifts itself above whatever else sits at
// the bottom (a button, a card, the ask ribbon). Each line says who speaks and,
// when it is not plain dialogue, what kind of text it is. Arabic lines run right
// to left, English left to right, whatever the interface language.
import './caption.css';
import { i18n } from '../i18n.js';

const TYPE_LABEL = {
  DALIL_EXPLANATION: { ar: 'شرح — ليس من نص القرآن', en: 'Explanation — not Qur’anic text' },
  EDUCATIONAL_CONTEXT: { ar: 'سياق تعليمي', en: 'Context' },
};
const NAME = { ar: 'دليل', en: 'Dalil' };

/**
 * @param {object} o
 * @param {HTMLElement} o.root        the interface layer (#ui)
 * @param {HTMLElement} [o.live]      a polite live region for screen readers
 * @param {string[]} [o.avoid]        selectors of things at the bottom the panel must stay above
 * @param {number} [o.base]           lowest distance from the bottom edge (px, plus the safe area)
 * @param {(cite:string) => string} [o.citeLabel]
 */
export function createCaption({ root, live = null, avoid = [], base = 18, citeLabel = (c) => c }) {
  const name = document.createElement('span'); name.className = 'cap-name';
  const typeEl = document.createElement('span'); typeEl.className = 'cap-label';
  const head = document.createElement('div'); head.className = 'cap-head';
  const dot = document.createElement('span'); dot.className = 'cap-dot'; dot.setAttribute('aria-hidden', 'true');
  head.append(dot, name, typeEl);
  const text = document.createElement('p'); text.className = 'cap-text';
  const cites = document.createElement('div'); cites.className = 'cap-cites';
  const el = document.createElement('div'); el.className = 'caption'; el.setAttribute('role', 'note');
  el.append(head, text, cites);
  root.append(el);
  let obj = null, type = 'NARRATIVE_DIALOGUE', citeList = [], until = 0, raise = 0;

  function fill() {
    name.textContent = i18n.t(NAME);
    typeEl.textContent = TYPE_LABEL[type] ? i18n.t(TYPE_LABEL[type]) : '';
    text.textContent = i18n.t(obj);
    const ar = /[؀-ۿ]/.test(text.textContent);
    text.lang = ar ? 'ar' : 'en'; text.dir = ar ? 'rtl' : 'ltr';
    el.dir = i18n.dir;
    cites.replaceChildren(...citeList.map((c) => { const s = document.createElement('span'); s.className = 'cite'; s.textContent = citeLabel(c); return s; }));
  }
  i18n.onChange(() => { if (obj && el.classList.contains('on')) fill(); });

  return {
    el,
    /** show a line; duration in seconds (0 = until hidden) */
    show(o, { duration = 5, cites: c = [], source = 'authored', type: ty = 'NARRATIVE_DIALOGUE' } = {}) {
      obj = o; type = ty; citeList = c || [];
      el.dataset.type = ty; el.dataset.source = source || 'authored';
      fill();
      el.classList.add('on');
      until = duration ? performance.now() + duration * 1000 : 0;
      if (live) live.textContent = text.textContent;
    },
    hide() { el.classList.remove('on'); until = 0; obj = null; },
    get visible() { return el.classList.contains('on'); },
    /** keep it above the other things at the bottom of the screen; call once a frame */
    update() {
      if (until && performance.now() > until) this.hide();
      let lift = base;
      const H = window.innerHeight;
      for (const sel of avoid) {
        const e = root.querySelector(sel);
        if (!e) continue;
        const r = e.getBoundingClientRect();
        if (r.width && r.height && r.bottom > H * 0.45) lift = Math.max(lift, H - r.top + 10);
      }
      if (lift !== raise) { raise = lift; el.style.setProperty('--cap-lift', `${Math.round(lift)}px`); }
    },
  };
}
