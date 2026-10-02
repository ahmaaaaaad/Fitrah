// Tiny DOM helpers and shared icons for the interface layer.
import { gsap } from 'gsap';
import { REDUCED_MOTION } from '../core/scene.js';

export const root = () => document.getElementById('ui');

/** h('div', {class:'x', onClick: fn, 'aria-label': '…'}, child, 'text', …) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstChild;
}

export const D = (s) => (REDUCED_MOTION ? 0.01 : s);

export function show(el, parent = root(), { y = 14, duration = 0.7, delay = 0, scale = 1 } = {}) {
  parent.append(el);
  gsap.fromTo(el, { opacity: 0, y, scale }, { opacity: 1, y: 0, scale: 1, duration: D(duration), delay: D(delay), ease: 'power3.out', clearProps: 'transform' });
  return el;
}

export function hide(el, { duration = 0.45, y = -8 } = {}) {
  return new Promise((res) => {
    if (!el || !el.isConnected) return res();
    gsap.to(el, { opacity: 0, y, duration: D(duration), ease: 'power2.in', onComplete: () => { el.remove(); res(); } });
  });
}

export const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
export const click = (el) => new Promise((r) => el.addEventListener('click', r, { once: true }));

/** Type text into an element character by character. */
export function typeInto(el, text, cps = 55) {
  return new Promise((res) => {
    if (REDUCED_MOTION) { el.textContent = text; return res(); }
    el.textContent = '';
    let i = 0;
    const step = () => {
      i = Math.min(text.length, i + Math.max(1, Math.round(cps / 30)));
      el.textContent = text.slice(0, i);
      if (i < text.length) setTimeout(step, 1000 / 30); else res();
    };
    step();
  });
}

// ------------------------------------------------------------------ icons (stroke, no emoji)
export const ICON = {
  book: (c = 'currentColor', s = 20) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>`),
  star8: (c = '#e8c277', s = 20) => svg(`<svg class="star8" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.4" aria-hidden="true"><rect x="6" y="6" width="12" height="12"/><rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)"/></svg>`),
  spark: (c = '#5fe3d0', s = 20) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>`),
  close: (c = 'currentColor', s = 18) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`),
  bulb: (c = 'currentColor', s = 20) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/></svg>`),
  send: (c = '#04201c', s = 20, rtl = true) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${rtl ? '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>' : '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>'}</svg>`),
  soundOn: (c = 'currentColor', s = 20) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>`),
  soundOff: (c = 'currentColor', s = 20) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>`),
  check: (c = '#5fe3d0', s = 22) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>`),
  info: (c = 'currentColor', s = 13) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>`),
  chat: (c = '#5fe3d0', s = 26) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z"/></svg>`),
  share: (c = 'currentColor', s = 26) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/></svg>`),
  pause: (c = '#e8c277', s = 16) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`),
};
