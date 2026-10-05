// "Talk to someone": the honest way from Dalil to a person. Shared by every level.
//
// Where it can send a player is data (data/config/human-help.json). Until a
// destination is verified and switched on, the panel says plainly that no live
// person is connected yet, and offers only general pathways (a local mosque, an
// information centre) without naming or implying any partner. When a verified
// destination is added, the same panel lists it and asks for the player's
// consent before anything they wrote is shared.
import './talk.css';
import config from '../../../../data/config/human-help.json';
import { i18n } from '../i18n.js';
import { h } from '../../ui/dom.js';

const TXT = {
  title: { ar: 'تحدّث مع إنسان', en: 'Talk to someone' },
  close: { ar: 'إغلاق', en: 'Close' },
  distress: {
    ar: 'إن كنت في خطر، أو تفكّر في إيذاء نفسك، فتواصل الآن مع رقم الطوارئ في بلدك أو مع شخص تثق به قريب منك. لستَ وحدك.',
    en: 'If you are in danger, or thinking about harming yourself, please contact your local emergency number now, or someone you trust who is near you. You are not alone.',
  },
  none: {
    ar: 'لا يرتبط «فطرة» بأي شخص أو جهة للتواصل المباشر حتى الآن، ولن نوهمك بغير ذلك.',
    en: 'Fitrah is not connected to any person or organisation you can reach directly yet, and we will not pretend otherwise.',
  },
  pathways: { ar: 'إلى ذلك الحين، هذه أماكن يُرحَّب فيها عادةً بالأسئلة:', en: 'Until then, these are places where questions are usually welcome:' },
  general: { ar: 'اقتراح عام — لا جهة بعينها', en: 'General suggestion — not a specific organisation' },
  yourQ: { ar: 'سؤالك', en: 'Your question' },
  copy: { ar: 'انسخ سؤالك لتأخذه معك', en: 'Copy your question to take with you' },
  copied: { ar: 'نُسخ', en: 'Copied' },
  partners: { ar: 'جهات موثّقة يمكنها الإجابة:', en: 'Verified people who can answer:' },
  verified: { ar: 'تحقّق منها', en: 'Verified by' },
  consent: { ar: 'أوافق على مشاركة سؤالي معهم فقط', en: 'I agree to share my question with them only' },
  contact: { ar: 'تواصل', en: 'Contact' },
};

let open = null;

/**
 * @param {{ question?: string, distress?: boolean, onClose?: () => void }} opts
 * @returns {{ close: () => void }}
 */
export function openTalk({ question = '', distress = false, onClose } = {}) {
  open?.close();
  const t = (o) => i18n.t(o);
  const partners = config.enabled ? (config.partners || []).filter((p) => p.verified_by && p.url) : [];
  const closeBtn = h('button', { type: 'button', class: 'talk-close', 'aria-label': t(TXT.close) }, '×');
  const body = [];
  if (distress) body.push(h('p', { class: 'talk-urgent', role: 'alert' }, t(TXT.distress)));
  if (partners.length) {
    // a verified destination exists: list it, and share nothing without consent
    body.push(h('p', { class: 'talk-lead' }, t(TXT.partners)));
    for (const p of partners) {
      const agree = h('input', { type: 'checkbox' });
      const go = h('a', { class: 'pill', href: p.url, target: '_blank', rel: 'noopener', 'aria-disabled': 'true' }, t(TXT.contact));
      agree.addEventListener('change', () => go.setAttribute('aria-disabled', String(!agree.checked)));
      go.addEventListener('click', (e) => { if (!agree.checked && question) e.preventDefault(); });
      body.push(h('div', { class: 'talk-partner' },
        h('strong', {}, t(p.name)), p.detail ? h('span', {}, t(p.detail)) : null,
        h('small', {}, `${t(TXT.verified)}: ${p.verified_by}${p.verified_on ? ` · ${p.verified_on}` : ''}`),
        question ? h('label', { class: 'talk-consent' }, agree, t(TXT.consent)) : null, go));
    }
  } else {
    body.push(h('p', { class: 'talk-lead' }, t(TXT.none)), h('p', { class: 'talk-sub' }, t(TXT.pathways)));
    body.push(h('ul', { class: 'talk-paths' }, ...(config.pathways || []).map((p) => h('li', {},
      h('strong', {}, t(p.label)), h('span', {}, t(p.detail)), h('small', {}, t(TXT.general))))));
  }
  if (question) {
    const copy = h('button', { type: 'button', class: 'pill small' }, t(TXT.copy));
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(question); copy.textContent = t(TXT.copied); } catch { /* clipboard may be unavailable */ }
    });
    body.push(h('div', { class: 'talk-q' }, h('small', {}, t(TXT.yourQ)), h('p', { dir: 'auto' }, question), copy));
  }
  const panel = h('div', { class: 'talk', role: 'dialog', 'aria-modal': 'true', 'aria-label': t(TXT.title), lang: i18n.lang, dir: i18n.dir },
    closeBtn, h('h2', {}, t(TXT.title)), ...body);
  const scrim = h('div', { class: 'talk-scrim' }, panel);
  (document.getElementById('ui') || document.body).append(scrim);
  requestAnimationFrame(() => scrim.classList.add('on'));
  const close = () => {
    if (!scrim.isConnected) return;
    scrim.classList.remove('on'); setTimeout(() => scrim.remove(), 400);
    window.removeEventListener('keydown', key, true);
    open = null; onClose?.();
  };
  const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  window.addEventListener('keydown', key, true);
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  setTimeout(() => closeBtn.focus({ preventScroll: true }), 60);
  open = { close };
  return open;
}

/** What the panel will do, for review tooling. */
export const talkStatus = () => (config.enabled && (config.partners || []).some((p) => p.verified_by && p.url) ? 'verified destination connected' : 'no verified destination yet (honest fallback)');
