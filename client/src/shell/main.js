// Fitrah · the shell. It owns the menu, the veil between menu and scene, and the
// route; levels own everything else. The shell never touches WebGL: a level's
// module (and the renderer it brings) is only loaded once the player chooses it.
//
//   #menu/ar   the menu (default)          #water/en   The Water, straight away
//
// Entering a level: the click unlocks sound, the veil comes down with the
// level's name on it, the level mounts behind it, and the veil lifts once the
// first frames are drawn. Leaving: the veil comes down and the page reloads into
// the menu, which guarantees every level starts from a clean world.
import '../fonts.css';
import './shell.css';
import { i18n } from '../core/i18n.js';
import { LEVELS, PATHS, levelById, levelsIn, isPlayable, PORTRAIT_STILL } from '../levels/registry.js';
import { track } from '../core/analytics.js';

// WebGL 2 is required by every level; without it the menu explains instead of failing
const webgl2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const NAME_KEY = 'fitrah:';

// ---------------------------------------------------------------- tiny DOM helper (the shell stays free of the engine)
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const tracked = [];
const T = (el, obj) => { el.textContent = i18n.t(obj); tracked.push([el, obj]); return el; };
i18n.onChange(() => { for (const [el, obj] of tracked) if (el.isConnected) el.textContent = i18n.t(obj); });
const other = (l) => (l === 'ar' ? 'en' : 'ar');

// ---------------------------------------------------------------- route and language
function storedLang() { try { return localStorage.getItem('fitrah.lang'); } catch { return null; } }
function storeLang(l) { try { localStorage.setItem('fitrah.lang', l); } catch { /* storage may be unavailable */ } }
function readRoute() {
  const m = /^#?([a-z0-9-]+)(?:\/(ar|en))?$/.exec(location.hash || '');
  let route = m?.[1], lang = m?.[2];
  // some hosts drop the hash on reload; window.name survives it in the same tab
  if (!route && typeof window.name === 'string' && window.name.startsWith(NAME_KEY)) [route, lang] = window.name.slice(NAME_KEY.length).split('/');
  const nav = (navigator.language || '').toLowerCase();
  return { route: route || null, lang: lang || storedLang() || (nav.startsWith('en') ? 'en' : 'ar') };
}
function writeRoute(route, lang) {
  const hash = `#${route}/${lang}`;
  try { history.replaceState(null, '', hash); } catch { try { location.hash = hash; } catch { /* sandboxed */ } }
  try { window.name = NAME_KEY + `${route}/${lang}`; } catch { /* ignore */ }
}

// ---------------------------------------------------------------- the veil
const veil = document.getElementById('veil');
const veilTitle = veil.querySelector('.veil-title') || veil.appendChild(h('p', { class: 'veil-title' }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = (n) => new Promise((r) => { const step = () => (--n <= 0 ? r() : requestAnimationFrame(step)); requestAnimationFrame(step); });
function veilTo(on, ms = 1000, tone) {
  if (tone) veil.style.background = tone;
  veil.style.setProperty('--veil-ms', `${REDUCED ? 10 : ms}ms`);
  veil.classList.toggle('on', on);
  return wait(REDUCED ? 20 : ms);
}
function titleCard(level) {
  if (!level) { veilTitle.classList.remove('on'); veilTitle.replaceChildren(); return; }
  veilTitle.replaceChildren(h('b', { lang: i18n.lang }, i18n.t(level.title)), h('i', { lang: other(i18n.lang) }, level.title[other(i18n.lang)]));
  requestAnimationFrame(() => veilTitle.classList.add('on'));
}

// ---------------------------------------------------------------- motes: slow warm light drifting over the still
function createMotes(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, running = false, last = 0;
  const motes = [];
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const n = Math.round(Math.min(70, Math.max(26, (W * H) / 26000)));
    motes.length = 0;
    for (let i = 0; i < n; i++) motes.push({ x: Math.random() * W, y: Math.random() * H, r: 0.6 + Math.random() * 1.8, v: 4 + Math.random() * 10, ph: Math.random() * 6.28, sw: 6 + Math.random() * 18, a: 0.25 + Math.random() * 0.55 });
    if (!running) draw(0);
  }
  function draw(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const t = performance.now() / 1000;
    for (const m of motes) {
      m.y -= m.v * dt; m.ph += dt * 0.6;
      if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
      const x = m.x + Math.sin(m.ph) * m.sw, tw = 0.65 + 0.35 * Math.sin(t * 1.3 + m.ph * 3);
      const g = ctx.createRadialGradient(x, m.y, 0, x, m.y, m.r * 4);
      g.addColorStop(0, `rgba(255, 238, 205, ${m.a * tw})`); g.addColorStop(1, 'rgba(255, 238, 205, 0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, m.y, m.r * 4, 0, 6.283); ctx.fill();
    }
  }
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    draw(dt); raf = requestAnimationFrame(loop);
  }
  const onVis = () => { if (document.hidden) stop(); else play(); };
  function play() { if (running || REDUCED) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  window.addEventListener('resize', size);
  document.addEventListener('visibilitychange', onVis);
  size(); play();
  return { dispose() { stop(); window.removeEventListener('resize', size); document.removeEventListener('visibilitychange', onVis); } };
}

// ---------------------------------------------------------------- the menu
// Two views over one backdrop: the main view holds the two paths (Fitrah, Tafakor);
// the Tafakor view lists its worlds. Same still, motes, type and motion as before.
const shell = document.getElementById('shell');
const state = { busy: false, menu: null, motes: null, current: null, view: 'main', still: null };

function itemButton({ id, num, title, subtitle, description, playable, later, onActivate, still }) {
  const numEl = h('span', { class: 'fm-num', 'aria-hidden': 'true' });
  const setNum = () => { numEl.textContent = i18n.num(num); };
  setNum(); i18n.onChange(setNum);
  const alt = h('span', { class: 'fm-alt' });
  const setAlt = () => { const l = other(i18n.lang); alt.lang = l; alt.textContent = title[l]; };
  setAlt(); i18n.onChange(setAlt);
  const name = h('span', { class: 'fm-name' }, T(h('span'), title));
  const sub = subtitle ? T(h('span', { class: 'fm-sub' }), subtitle) : null;
  let extra = null;
  if (playable) {
    extra = h('span', { class: 'fm-desc' }, h('span', {},
      description ? T(h('em'), description) : null,
      T(h('span', { class: 'fm-go' }), { ar: 'ادخل', en: 'Enter' })));
  } else if (later) {
    const tag = T(h('span', { class: 'fm-later' }), { ar: 'لاحقاً', en: 'LATER' });
    const setLang = () => { tag.lang = i18n.lang; }; setLang(); i18n.onChange(setLang);
    name.append(tag);
  }
  const btn = h('button', {
    type: 'button', class: `fm-ch ${playable ? 'available' : 'locked'}`, 'data-id': id,
    'aria-disabled': playable ? null : 'true',
  }, numEl, h('span', {}, name, alt, sub), extra);
  if (!playable) {
    const label = () => btn.setAttribute('aria-label', `${i18n.t(title)} — ${i18n.t({ ar: 'لاحقاً', en: 'later' })}`);
    label(); i18n.onChange(label);
  }
  const item = { id, playable, still, activate: onActivate };
  btn.addEventListener('pointerenter', () => setCurrent(item));
  btn.addEventListener('focus', () => setCurrent(item));
  btn.addEventListener('click', () => { if (playable) onActivate(); else setCurrent(item); });
  btn._item = item;
  return h('li', {}, btn);
}

function mainItems() {
  return PATHS.map((p, i) => {
    const level = p.level ? levelById(p.level) : null;
    const still = level?.thumbnail || levelsIn(p.section || '').find(isPlayable)?.thumbnail;
    return itemButton({
      id: p.id, num: i + 1, title: p.title, subtitle: p.subtitle, description: p.description,
      playable: p.level ? isPlayable(level) : true, still,
      onActivate: () => (level ? enter(level) : showView(p.section)),
    });
  });
}
function tafakorItems() {
  return levelsIn('tafakor').map((l, i) => itemButton({
    id: l.id, num: i + 1, title: l.title, description: l.description,
    playable: isPlayable(l), later: l.status === 'coming_soon',
    still: l.thumbnail || levelsIn('tafakor').find(isPlayable)?.thumbnail,
    onActivate: () => enter(l),
  }));
}

// on a tall screen the backdrop is the still rendered for it (sharp, composed upright)
const tall = () => window.innerHeight > window.innerWidth * 1.1;
const stillFor = (url) => (tall() && PORTRAIT_STILL.get(url)) || url;
let stillShown = null;
function showStill(url, force = false) {
  if (!state.menu || !url || (url === state.still && !force)) return;
  state.still = url;
  const src = stillFor(url);
  if (src === stillShown) return;
  stillShown = src;
  const [a, b] = state.menu.querySelectorAll('.fm-img');
  const next = a.classList.contains('on') ? b : a, prev = next === a ? b : a;
  next.style.backgroundImage = `url("${src}")`;
  next.classList.add('on'); prev.classList.remove('on');
}
window.addEventListener('resize', () => { if (state.still) showStill(state.still, true); });

function showView(view, { instant = false } = {}) {
  if (!state.menu || state.busy) return;
  state.view = view;
  writeRoute(view === 'tafakor' ? 'tafakor' : 'menu', i18n.lang);
  const nav = state.menu.querySelector('.fm-chapters');
  const fill = () => {
    const list = h('ol', {}, view === 'tafakor' ? tafakorItems() : mainItems());
    const crumb = view === 'tafakor' ? h('div', { class: 'fm-crumb' },
      T(h('button', { type: 'button', class: 'fm-back', onClick: () => showView('main') }), { ar: 'رجوع', en: 'Back' }),
      T(h('span', { class: 'fm-section' }), { ar: 'تفكّر · عوالم التأمّل', en: 'Tafakor · The Experiential Worlds' })) : null;
    nav.replaceChildren(...[crumb, list].filter(Boolean));
    nav.dataset.view = view;
    const first = nav.querySelector('.fm-ch.available') || nav.querySelector('.fm-ch');
    if (first?._item) setCurrent(first._item);
    nav.classList.remove('switching');
  };
  if (instant || REDUCED) fill();
  else { nav.classList.add('switching'); setTimeout(fill, 420); }
}

function renderMenu({ intro, view = 'main' }) {
  const langBtn = h('button', { type: 'button', class: 'fm-lang' });
  const setLangBtn = () => { const l = other(i18n.lang); langBtn.textContent = l === 'ar' ? 'العربية' : 'English'; langBtn.lang = l; };
  setLangBtn(); i18n.onChange(setLangBtn);
  langBtn.addEventListener('click', () => { const l = other(i18n.lang); i18n.set(l); storeLang(l); writeRoute(state.view === 'tafakor' ? 'tafakor' : 'menu', l); document.title = i18n.t({ ar: 'فطرة', en: 'Fitrah' }); });

  const nav = h('nav', { class: 'fm-chapters' });
  nav.setAttribute('aria-label', i18n.t({ ar: 'أقسام فطرة', en: 'Parts of Fitrah' }));
  i18n.onChange(() => nav.setAttribute('aria-label', i18n.t({ ar: 'أقسام فطرة', en: 'Parts of Fitrah' })));

  const motesCanvas = h('canvas', { class: 'fm-motes', 'aria-hidden': 'true' });
  const menu = h('main', { class: 'fm' },
    h('div', { class: 'fm-bg', 'aria-hidden': 'true' }, h('div', { class: 'fm-img on' }), h('div', { class: 'fm-img' })),
    h('div', { class: 'fm-shade', 'aria-hidden': 'true' }),
    motesCanvas,
    h('div', { class: 'fm-grain', 'aria-hidden': 'true' }),
    langBtn,
    h('div', { class: 'fm-frame' },
      h('header', { class: 'fm-head' }, h('p', { class: 'fm-kicker' }, 'FITRAH'), h('h1', { class: 'fm-title', lang: 'ar' }, 'فطرة')),
      nav,
      h('footer', { class: 'fm-foot' },
        T(h('p'), { ar: 'رحلة تفاعلية في الأسئلة الأربعة', en: 'An interactive journey through the four questions' }),
        T(h('p'), { ar: 'يُفضَّل الاستماع بسمّاعات', en: 'Best with headphones' }))),
  );
  shell.replaceChildren(menu);
  state.menu = menu; state.still = null; stillShown = null; // a new menu: its backdrop is set afresh
  state.motes = createMotes(motesCanvas);
  showView(view, { instant: true });

  // keyboard: arrows move through the items, Enter opens one, Esc goes back
  menu.addEventListener('keydown', (e) => {
    const list = [...menu.querySelectorAll('.fm-ch')];
    const i = list.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      const j = i < 0 ? 0 : (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
      list[j].focus();
    }
  });
  window.addEventListener('keydown', (e) => {
    if (state.busy || !state.menu) return;
    if ((e.key === 'Escape' || e.key === 'Backspace') && state.view === 'tafakor' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); showView('main'); return; }
    if (document.activeElement?.closest?.('.fm')) return;
    if (['ArrowDown', 'ArrowUp', 'Tab'].includes(e.key)) { const b = menu.querySelector('.fm-ch.current') || menu.querySelector('.fm-ch'); if (e.key !== 'Tab') e.preventDefault(); b?.focus(); }
    else if (e.key === 'Enter' && state.current?.playable) state.current.activate();
  });

  // the first moment of a fresh visit shows the name alone; returning from a scene goes straight to the list
  const settle = () => { menu.classList.add('ready'); };
  if (intro && !REDUCED) {
    const introEl = h('div', { class: 'fm-intro', 'aria-hidden': 'true' }, h('div', {}, h('p', { class: 'fm-kicker' }, 'FITRAH'), h('p', { class: 'fm-title', lang: 'ar' }, 'فطرة')));
    menu.append(introEl);
    let done = false;
    const go = () => { if (done) return; done = true; introEl.classList.add('gone'); setTimeout(settle, 350); setTimeout(() => introEl.remove(), 2200); };
    setTimeout(go, 2600);
    menu.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', go, { once: true });
  } else {
    requestAnimationFrame(settle);
  }
  return menu;
}

function setCurrent(item) {
  if (!state.menu || state.busy) return;
  state.current = item;
  state.menu.dataset.focus = item.playable ? 'available' : 'locked';
  showStill(item.still);
  for (const b of state.menu.querySelectorAll('.fm-ch')) b.classList.toggle('current', b.dataset.id === item.id);
}

// ---------------------------------------------------------------- entering and leaving a level
// how the player chose the scene (mouse, touch, pen): the level words its first instructions for it
let lastPointer = null;
window.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || lastPointer; }, { capture: true, passive: true });

function unlockAudio() {
  // created inside the click so every browser lets the level's sound start
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    ac.resume?.();
    const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0);
    return ac;
  } catch { return null; }
}

function exitToMenu({ to } = {}) {
  if (state.leaving) return;
  // by default a world goes back to where it was chosen: a Tafakor world to the Tafakor list
  if (!to) to = levelById(document.body.dataset.level)?.category === 'tafakor' ? 'tafakor' : 'menu';
  state.leaving = true;
  const lang = i18n.lang;
  titleCard(null);
  veilTo(true, 1100, '#14110e').then(() => {
    writeRoute(to === 'tafakor' ? 'tafakor' : 'menu', lang);
    location.reload();
  });
}

function notice(msg) {
  const el = h('div', { class: 'fm-notice', role: 'alert' }, i18n.t(msg));
  document.body.append(el);
  setTimeout(() => el.classList.add('on'), 20);
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 800); }, 6000);
}
async function enter(level, { fromMenu = true } = {}) {
  if (state.busy || !isPlayable(level)) return;
  if (!webgl2) {
    notice({ ar: 'تحتاج هذه الرحلة إلى متصفح حديث يدعم WebGL 2 (Chrome أو Safari أو Edge أو Firefox بإصدار حديث).', en: 'This journey needs a recent browser with WebGL 2 (a current Chrome, Safari, Edge or Firefox).' });
    return;
  }
  state.busy = true;
  track('level_start', { lv: level.id });
  const audioContext = fromMenu ? unlockAudio() : null;
  const lang = i18n.lang;
  writeRoute(level.id, lang);
  const loading = level.load();
  if (state.menu) {
    state.menu.querySelector(`.fm-ch[data-id="${level.id}"]`)?.classList.add('chosen');
    state.menu.classList.add('leaving');
  }
  const t0 = performance.now();
  await veilTo(true, state.menu ? 1300 : 10, level.tone);
  titleCard(level);
  let mod;
  try { mod = await loading; } catch (err) {
    console.error('[fitrah] could not load', level.id, err);
    veilTitle.replaceChildren(h('i', {}, i18n.t({ ar: 'تعذّر تحميل المشهد. أعد المحاولة.', en: 'The scene could not be loaded. Please try again.' })));
    await wait(2400); writeRoute('menu', lang); location.reload(); return;
  }
  state.motes?.dispose(); state.motes = null; state.menu = null;
  shell.replaceChildren();
  document.body.classList.add('in-level');
  document.body.dataset.level = level.id;
  let runtime;
  try { runtime = mod.mount({ lang, fromMenu, audioContext, pointerType: lastPointer, exit: exitToMenu }) || {}; } catch (err) {
    // the player never sees a developer error: a quiet message, then back to the menu
    console.error('[fitrah] could not start', level.id, err);
    track('error', { lv: level.id, v: 'mount' });
    veilTitle.replaceChildren(h('i', {}, i18n.t({ ar: 'تعذّر بدء المشهد على هذا الجهاز. نعود إلى القائمة.', en: 'The scene could not start on this device. Returning to the menu.' })));
    await wait(2600); writeRoute('menu', lang); location.reload(); return;
  }
  // the level's first frames compile its shaders behind the veil; hold the title a moment, then open
  await frames(3);
  const held = performance.now() - t0;
  await wait(Math.max(0, (fromMenu ? 2600 : 600) - held));
  titleCard(null);
  await wait(fromMenu ? 500 : 0);
  veilTo(false, fromMenu ? 1900 : 900);
  if (fromMenu) setTimeout(() => runtime.begin?.(), 450);
  state.busy = false;
}

// ---------------------------------------------------------------- boot
const { route, lang } = readRoute();
i18n.set(lang);
document.title = i18n.t({ ar: 'فطرة', en: 'Fitrah' });
const target = route && route !== 'menu' && route !== 'tafakor' ? levelById(route) : null;
window.fitrahShell = { LEVELS, enter: (id) => enter(levelById(id)), exit: exitToMenu, view: (v) => showView(v), get state() { return { route: document.body.dataset.level || 'menu', view: state.view, busy: state.busy, current: state.current?.id }; } };

if (isPlayable(target)) {
  // a direct link to a scene: the level shows its own start card (the gesture that starts sound)
  enter(target, { fromMenu: false });
} else {
  const view = route === 'tafakor' ? 'tafakor' : 'main';
  writeRoute(view === 'tafakor' ? 'tafakor' : 'menu', lang);
  const returning = route === 'menu' || route === 'tafakor';
  renderMenu({ intro: !returning, view });
  const show = () => veilTo(false, returning ? 1200 : 1600, '#14110e');
  const still = state.still;
  if (still) {
    const img = new Image();
    let shown = false;
    const once = () => { if (!shown) { shown = true; show(); } };
    img.onload = once; img.onerror = once; img.src = stillFor(still);
    setTimeout(once, 1500);
  } else show();
}
