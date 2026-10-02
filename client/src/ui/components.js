// Fitrah – interface components. Every function returns a promise that
// resolves when the player is done with that piece of UI.
import { gsap } from 'gsap';
import { h, show, hide, wait, root, ICON, D, typeInto } from './dom.js';
import { i18n, t } from '../core/i18n.js';
import { script as S, quiz as Q, verse, verseRef, verseRefLong, ayahMark } from '../core/content.js';
import { audio } from '../core/audio.js';
import * as store from '../core/store.js';

const U = () => S.ui;

// ================================================================== HUD
export const hud = (() => {
  let top, pill, pillText, dots, journalBtn, badge, soundBtn, fab, onJournal = () => {}, onDalil = () => {};
  function build() {
    pillText = h('span');
    dots = h('span', { class: 'dots' }, h('i'), h('i'), h('i'));
    pill = h('div', { class: 'station-pill', hidden: true }, pillText, dots);
    badge = h('span', { class: 'badge' }, i18n.num(0));
    journalBtn = h('button', { class: 'journal-btn', onClick: () => onJournal(), hidden: true },
      ICON.book('#e8c277'), h('span', { class: 'lbl' }, t(U().journal_button)), badge);
    soundBtn = h('button', { class: 'icon-btn', onClick: () => { audio.setMuted(!audio.muted); refreshSound(); }, hidden: true });
    top = h('div', { class: 'hud-top' }, pill, h('div', { class: 'hud-actions' }, soundBtn, journalBtn));
    fab = h('button', { class: 'dalil-fab', hidden: true, onClick: () => onDalil() }, ICON.spark(), h('span', {}, t(S.dalil.ask_button)));
    root().append(top, fab);
    refreshSound();
  }
  function refreshSound() {
    soundBtn.replaceChildren(audio.muted ? ICON.soundOff() : ICON.soundOn());
    soundBtn.setAttribute('aria-label', t(audio.muted ? U().sound_on : U().sound_off));
  }
  return {
    build,
    relabel() {
      journalBtn.querySelector('.lbl').textContent = t(U().journal_button);
      fab.querySelector('span').textContent = t(S.dalil.ask_button);
      badge.textContent = i18n.num(store.state.journal.length);
      refreshSound();
    },
    setHandlers({ journal, dalil }) { onJournal = journal; onDalil = dalil; },
    showTop(on = true) { journalBtn.hidden = !on; soundBtn.hidden = !on; if (on) gsap.fromTo([journalBtn, soundBtn], { opacity: 0 }, { opacity: 1, duration: D(0.8) }); },
    setStation(n, title) {
      if (!n) { pill.hidden = true; return; }
      pill.hidden = false;
      pillText.textContent = i18n.fmt(U().station_label, { n, title: t(title) });
      [...dots.children].forEach((d, i) => { d.className = i + 1 === n ? 'on' : i + 1 < n ? 'done' : ''; });
      gsap.fromTo(pill, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: D(0.6) });
    },
    setCount(n) {
      badge.textContent = i18n.num(n);
      badge.classList.toggle('has', n > 0);
      gsap.fromTo(badge, { scale: 1.6 }, { scale: 1, duration: D(0.6), ease: 'back.out(3)' });
      gsap.fromTo(journalBtn, { boxShadow: '0 0 38px rgba(232,194,119,0.9)' }, { boxShadow: '0 0 0px rgba(232,194,119,0)', duration: D(1.4) });
    },
    showDalil(on) { fab.hidden = !on; if (on) gsap.fromTo(fab, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: D(0.6) }); },
    journalRect() { return journalBtn.getBoundingClientRect(); },
  };
})();

// ================================================================== simple pieces
export function caption(text, holdSeconds = 0) {
  const el = h('div', { class: 'caption', role: 'status' }, t(text));
  show(el, root(), { y: 8, duration: 0.9 });
  const api = { el, done: () => hide(el) };
  if (holdSeconds) return wait(holdSeconds).then(() => hide(el));
  return api;
}

export function instruction(text) {
  const el = h('div', { class: 'instruction', role: 'status' }, t(text));
  show(el, root(), { y: 10 });
  return { el, set: (tx) => { el.textContent = t(tx); gsap.fromTo(el, { opacity: 0.4 }, { opacity: 1, duration: D(0.4) }); }, done: () => hide(el) };
}

export function hintButton(onClick) {
  const el = h('button', { class: 'btn btn-ghost hint-btn', style: { background: 'var(--glass)' }, onClick }, ICON.bulb(), t(U().hint));
  show(el, root(), { y: 10, delay: 0.4 });
  return { el, done: () => hide(el) };
}

export function toast(text, seconds = 3.2) {
  const el = h('div', { class: 'toast', role: 'status' }, t(text));
  show(el, root(), { y: 10, duration: 0.5 });
  return wait(seconds).then(() => hide(el));
}

export async function titleCard(title, subtitle, hold = 2.6) {
  const tEl = h('div', { class: 't' }, t(title));
  const sEl = h('div', { class: 's' }, t(subtitle));
  const el = h('div', { class: 'title-card' }, tEl, sEl);
  root().append(el);
  gsap.fromTo(tEl, { opacity: 0, letterSpacing: '0.3em', filter: 'blur(14px)' }, { opacity: 1, letterSpacing: '0em', filter: 'blur(0px)', duration: D(2.2), ease: 'power3.out' });
  gsap.fromTo(sEl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: D(1.2), delay: D(0.9) });
  await wait(hold + 1.6);
  await hide(el, { duration: 1 });
}

function goldBtn(label, onClick) { return h('button', { class: 'btn btn-gold', onClick }, t(label)); }

/** A centered call-to-action button at the bottom; resolves on click. */
export function cta(label, { ghost } = {}) {
  return new Promise((res) => {
    const b = h('button', { class: ghost ? 'btn btn-ghost' : 'btn btn-gold' }, t(label));
    const wrap = h('div', { class: 'bottom-cta' }, b);
    show(wrap, root(), { y: 12 });
    b.addEventListener('click', () => { audio.soft(); hide(wrap).then(res); }, { once: true });
    b.focus({ preventScroll: true });
  });
}

// ================================================================== onboarding
export function intro() {
  return new Promise((res) => {
    const o = S.onboarding;
    const logo = h('div', { class: 'logo' }, 'فطرة');
    const latin = h('div', { class: 'latin' }, 'FITRAH');
    const lines = h('div', { class: 'lines' }, ...o.intro_lines.map((l) => h('span', {}, l.ar)));
    const pick = (lang) => { audio.start(); audio.soft(); hide(el, { duration: 0.8 }).then(() => res(lang)); };
    const lang = h('div', { class: 'lang' },
      h('small', {}, `${o.language_prompt.ar} · ${o.language_prompt.en}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-gold', onClick: () => pick('ar') }, 'العربية'),
        h('button', { class: 'btn btn-ghost en', lang: 'en', onClick: () => pick('en') }, 'English')));
    const el = h('div', { class: 'intro' }, logo, latin, lines, lang);
    root().append(el);
    gsap.fromTo(logo, { opacity: 0, filter: 'blur(18px)', scale: 1.08 }, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: D(2.4), delay: D(0.6), ease: 'power3.out' });
    gsap.fromTo(latin, { opacity: 0, letterSpacing: '22px' }, { opacity: 1, letterSpacing: '12px', duration: D(2), delay: D(1.2) });
    gsap.fromTo([...lines.children], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: D(1.1), stagger: D(0.6), delay: D(2.0) });
    gsap.fromTo(lang, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: D(1), delay: D(3.2) });
  });
}

export function askIntent() {
  return new Promise((res) => {
    const o = S.onboarding.intent;
    let chosen = null;
    const cont = h('button', { class: 'btn btn-gold', disabled: true, style: { opacity: 0.5 } }, t(U().continue));
    const opts = o.options.map((op) => {
      const b = h('button', { class: 'option', role: 'radio', 'aria-checked': 'false' }, h('span', { class: 'mark' }), t(op.label));
      b.addEventListener('click', () => {
        chosen = op.id; audio.soft();
        opts.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        cont.disabled = false; cont.style.opacity = 1;
      });
      return b;
    });
    const el = h('div', { class: 'glass sheet-center', role: 'dialog', 'aria-labelledby': 'intent-h' },
      h('h2', { id: 'intent-h' }, t(o.prompt)),
      h('p', { class: 'note' }, t(o.note)),
      h('div', { class: 'options', role: 'radiogroup' }, ...opts),
      h('div', { class: 'row-end' }, cont));
    cont.addEventListener('click', () => { hide(el).then(() => res(chosen)); });
    show(el, root(), { y: 20 });
  });
}

/** Runs the 3-question understanding check. phase: 'pre' (no feedback) | 'post' (feedback). */
export function runQuiz(phase) {
  return new Promise((res) => {
    const total = Q.questions.length;
    const answers = {};
    const box = h('div', { class: 'glass sheet-center', role: 'dialog', 'aria-live': 'polite' });
    show(box, root(), { y: 20 });
    const finish = () => hide(box).then(() => res(answers));

    const render = (idx) => {
      const q = Q.questions[idx];
      const head = h('div', { class: 'progress-line' },
        h('span', { class: 'k' }, t(phase === 'pre' ? U().quiz_title_pre : U().quiz_title_post)),
        h('span', {}, i18n.fmt(U().checkpoint_progress, { n: idx + 1, total })));
      const intro = idx === 0 ? h('p', { class: 'note', style: { margin: 0 } }, t(phase === 'pre' ? S.onboarding.pretest_intro : S.world1.checkpoint.intro)) : null;
      const prompt = h('h2', { style: { fontSize: 'clamp(22px,2.6vw,28px)' } }, t(q.prompt));
      const area = h('div', { class: 'options' });
      const foot = h('div', { class: 'row-end' });
      const fb = h('div');
      box.replaceChildren(...[head, intro, prompt, area, fb, foot].filter(Boolean));

      const next = () => { if (idx + 1 < total) render(idx + 1); else finish(); };
      const nextBtn = goldBtn(idx + 1 < total ? U().next : U().continue, () => { audio.soft(); next(); });
      const conclude = (correct) => {
        answers[q.id] = correct;
        if (phase === 'post') {
          const ex = S.world1.checkpoint.explanations[q.id];
          const praise = S.world1.checkpoint.correct[idx % S.world1.checkpoint.correct.length];
          fb.replaceWith(h('div', { class: `feedback${correct ? '' : ' neutral'}` },
            h('b', {}, correct ? t(praise) : t(S.world1.checkpoint.retry)), h('span', {}, t(ex)),
            q.sources?.length ? h('div', {}, ...q.sources.map((k) => h('span', { class: 'chip-src' }, ICON.book('#e8c277', 15), verseRef(k)))) : null));
          foot.replaceChildren(nextBtn);
        } else { setTimeout(next, 280); }
      };

      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        const opts = q.type === 'true_false'
          ? [{ id: true, label: U().true_label }, { id: false, label: U().false_label }]
          : q.options.map((o) => ({ id: o.id, label: o }));
        const btns = opts.map((o) => {
          const b = h('button', { class: 'option', 'aria-pressed': 'false' }, t(o.label));
          b.addEventListener('click', () => {
            audio.soft();
            const correct = o.id === q.correct;
            btns.forEach((x) => { x.disabled = true; });
            b.setAttribute('aria-pressed', 'true');
            if (phase === 'post') {
              btns[opts.findIndex((p) => p.id === q.correct)].classList.add('correct');
              if (!correct) b.classList.add('wrong');
              btns[opts.findIndex((p) => p.id === q.correct)].append(ICON.check());
            }
            conclude(correct);
          });
          return b;
        });
        area.append(...btns);
      } else if (q.type === 'match') {
        const keys = q.pairs.map((p) => p.verse);
        const picks = {};
        const rows = q.pairs.map((p, pi) => {
          const choices = (pi % 2 ? [...keys].reverse() : keys).map((k) => {
            const b = h('button', { class: 'option', style: { minHeight: '44px', flex: '1 1 160px' }, 'aria-pressed': 'false' }, verseRef(k));
            b.addEventListener('click', () => {
              audio.soft(); picks[pi] = k;
              b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
              if (Object.keys(picks).length === q.pairs.length && !foot.childElementCount) {
                const ok = goldBtn(U().continue, () => {
                  const correct = q.pairs.every((pp, j) => picks[j] === pp.verse);
                  rows.forEach((r) => r.querySelectorAll('button').forEach((x) => { x.disabled = true; }));
                  foot.replaceChildren();
                  conclude(correct);
                });
                foot.replaceChildren(ok);
              }
            });
            return b;
          });
          return h('div', { class: 'match-row' }, h('span', { class: 'sign' }, t(p.sign)), h('div', { class: 'choices' }, ...choices));
        });
        area.append(...rows);
      }
      if (phase === 'pre' && idx === 0) {
        foot.append(h('button', { class: 'btn btn-ghost btn-sm', onClick: () => { finish(); } }, t(S.onboarding.pretest_skip)));
      }
    };
    render(0);
  });
}

/** Dalil speaks a few lines in a bubble that follows a moving screen point. */
export function speech(lines, anchorFn) {
  return new Promise((res) => {
    const p = h('p');
    const btn = h('button', { class: 'btn btn-aqua-ghost btn-sm' }, t(U().next));
    const el = h('div', { class: 'glass speech', role: 'dialog', 'aria-live': 'polite' },
      h('div', { class: 'who' }, h('span', { class: 'avatar' }, ICON.spark('#5fe3d0', 18)), h('span', {}, t(S.dalil.name)), h('small', {}, t(U().dalil_panel.tagline))),
      p, h('div', { class: 'row-end' }, btn));
    root().append(el);
    let alive = true;
    // The bubble sits beside the anchor without covering it, and only moves when
    // the anchor has moved far: a dialog that swims under the cursor is hard to use.
    let cur = null, tgt = null, lastX = NaN, lastY = NaN;
    const compute = () => {
      const a = anchorFn();
      const w = el.offsetWidth, hh = el.offsetHeight;
      if (innerWidth < 700) return { x: (innerWidth - w) / 2, y: innerHeight - hh - 24 };
      const gap = Math.max(80, innerHeight * 0.12);
      let x = i18n.dir === 'rtl' ? a.x - w - gap : a.x + gap;
      let y = a.y - hh / 2;
      if (x < 16 || x + w > innerWidth - 16) { x = i18n.dir === 'rtl' ? a.x + gap : a.x - w - gap; }
      if (x < 16 || x + w > innerWidth - 16) { x = a.x - w / 2; y = a.y + gap; }
      return { x: Math.min(Math.max(16, x), innerWidth - w - 16), y: Math.min(Math.max(16, y), innerHeight - hh - 16) };
    };
    const place = () => {
      if (!alive) return;
      const p = compute();
      if (!cur) { cur = { ...p }; tgt = { ...p }; }
      if (Math.hypot(p.x - tgt.x, p.y - tgt.y) > 56) tgt = p;
      cur.x += (tgt.x - cur.x) * 0.08; cur.y += (tgt.y - cur.y) * 0.08;
      const rx = Math.round(cur.x), ry = Math.round(cur.y);
      if (rx !== lastX || ry !== lastY) { el.style.transform = `translate(${rx}px, ${ry}px)`; lastX = rx; lastY = ry; }
      requestAnimationFrame(place);
    };
    place();
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: D(0.6) });
    let i = 0;
    const say = async () => {
      btn.disabled = true;
      await typeInto(p, t(lines[i]), 60);
      btn.disabled = false;
      btn.textContent = t(i + 1 < lines.length ? U().next : U().continue);
      btn.focus({ preventScroll: true });
    };
    btn.addEventListener('click', async () => {
      audio.soft();
      i++;
      if (i < lines.length) say();
      else { alive = false; await hide(el); res(); }
    });
    say();
  });
}

// ================================================================== Horizon
export function horizonScreen(getGateScreens) {
  return new Promise((res) => {
    const H = S.horizon;
    const head = h('div', { class: 'horizon-head' }, h('div', { class: 't' }, t(H.title)), h('div', { class: 's' }, H.lines.map((l) => t(l)).join(' ')));
    root().append(head);
    gsap.fromTo(head, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: D(1.2) });
    const labels = H.gates.map((g, i) => {
      const open = g.state === 'open';
      const btn = open ? h('button', { class: 'btn btn-gold' }, t(H.enter)) : h('span', { class: 'soon' }, t(H.coming_soon));
      const el = h('div', { class: `gate-label${open ? '' : ' off'}` }, h('span', { class: 'q' }, t(g.question)), btn);
      root().append(el);
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: D(1), delay: D(0.4 + i * 0.15) });
      if (open) btn.addEventListener('click', () => { alive = false; audio.whoosh(); Promise.all([hide(head), ...labels.map((l) => hide(l))]).then(() => res(i)); }, { once: true });
      return el;
    });
    let alive = true;
    const last = labels.map(() => ({ x: NaN, y: NaN }));
    const place = () => {
      if (!alive) return;
      const pts = getGateScreens();
      labels.forEach((l, i) => {
        if (!pts[i]) return;
        const x = Math.round(pts[i].x), y = Math.round(pts[i].y);
        if (Math.abs(x - last[i].x) + Math.abs(y - last[i].y) < 2) return; // ignore sub-pixel drift
        last[i] = { x, y };
        l.style.transform = `translate(${x}px, ${y}px)`;
      });
      requestAnimationFrame(place);
    };
    place();
  });
}

// ================================================================== sign + verse
export function sign(text, sub) {
  return new Promise((res) => {
    const pill = h('span', { class: 'sign-pill' }, ICON.star8('#e8c277', 26), t(text));
    const el = h('div', { class: 'sign-wrap' }, pill, sub ? h('span', { class: 'sub' }, t(sub)) : null);
    root().append(el);
    gsap.fromTo(pill, { opacity: 0, scale: 0.85, filter: 'blur(8px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: D(1), ease: 'back.out(1.6)' });
    if (sub) gsap.fromTo(el.querySelector('.sub'), { opacity: 0 }, { opacity: 1, duration: D(0.8), delay: D(0.6) });
    audio.shimmer();
    cta(U().reveal_verse).then(() => hide(el).then(res));
  });
}

function ayatBlock(v) {
  const el = h('div', { class: 'ayat', lang: 'ar', dir: 'rtl' });
  v.ayah_texts.forEach((a, i) => {
    el.append(a.ar, ' ', h('span', { class: 'mark' }, ayahMark(a.n)), i + 1 < v.ayah_texts.length ? ' ' : '');
  });
  return el;
}

function translationBlock(v) {
  if (i18n.lang !== 'en') return [];
  return [
    h('div', { class: 'translation', lang: 'en' }, ...v.ayah_texts.map((a) => h('span', {}, h('span', { class: 'n' }, a.n), a.en))),
    h('div', { class: 'translation-label' }, `${t(U().verse_card.translation_label)} · ${v.translation_en_author}`),
  ];
}

/**
 * Shows a verse card. mode 'collect': the primary button adds it to the journal
 * and the card flies into the journal button. mode 'view': a close button.
 */
export function verseCard(key, { heading, mode = 'collect' } = {}) {
  return new Promise((res) => {
    const v = verse(key);
    const scrim = h('div', { class: 'verse-scrim' });
    const bars = h('span', { class: 'bars' }, ...Array.from({ length: 8 }, () => h('i')));
    const recite = audio.hasRecitation(key)
      ? h('div', { class: 'recite' }, h('button', { class: 'icon-btn', style: { width: '40px', height: '40px', borderRadius: '20px' }, 'aria-label': t(U().verse_card.pause) }, ICON.pause()), bars, t(U().verse_card.recitation))
      : null;
    const closeX = mode === 'view' ? h('button', { class: 'close-x', 'aria-label': t(U().dalil_panel.close) }, ICON.close()) : null;
    const primary = mode === 'collect'
      ? h('button', { class: 'btn btn-gold' }, ICON.book('#1a1405', 18), t(U().verse_card.add_to_journal))
      : h('button', { class: 'btn btn-ghost' }, t(U().dalil_panel.close));
    const card = h('div', { class: 'glass verse-card', role: 'dialog', 'aria-label': verseRefLong(key) },
      closeX,
      h('div', { class: 'verse-top' }, h('span', { class: 'verse-label' }, ICON.star8('#e8c277', 18), t(U().verse_card.label)), recite),
      heading ? h('div', { class: 'verse-heading' }, t(heading)) : null,
      ayatBlock(v),
      h('div', { class: 'verse-ref' }, verseRefLong(key)),
      ...translationBlock(v),
      h('div', { class: 'ornament' }, h('span'), ICON.star8('#e8c277', 14), h('span')),
      h('div', { class: 'row-end', style: { justifyContent: 'center' } }, primary));
    root().append(scrim, card);
    gsap.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: D(0.9) });
    gsap.fromTo(card, { opacity: 0, y: 30, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: D(1.1), ease: 'power3.out' });
    gsap.fromTo(card.querySelector('.ayat'), { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: D(1.8), delay: D(0.35) });
    audio.duck(true); setTimeout(() => audio.duck(false), 4000);
    primary.focus({ preventScroll: true });

    const close = () => Promise.all([hide(scrim), hide(card)]).then(res);
    closeX?.addEventListener('click', close, { once: true });
    if (mode === 'view') { primary.addEventListener('click', close, { once: true }); return; }
    primary.addEventListener('click', () => {
      audio.shimmer();
      const r = hud.journalRect(), c = card.getBoundingClientRect();
      const dx = r.left + r.width / 2 - (c.left + c.width / 2), dy = r.top + r.height / 2 - (c.top + c.height / 2);
      gsap.to(scrim, { opacity: 0, duration: D(0.8), onComplete: () => scrim.remove() });
      gsap.to(card, { x: `+=${dx}`, y: `+=${dy}`, scale: 0.05, opacity: 0, duration: D(1.0), ease: 'power3.in', onComplete: () => { card.remove(); res(); } });
    }, { once: true });
  });
}

// ================================================================== reflection
export function reflection(text, { onAsk } = {}) {
  return new Promise((res) => {
    const ask = h('button', { class: 'btn btn-aqua-ghost' }, ICON.spark(), t(S.dalil.ask_button));
    const go = h('button', { class: 'btn btn-gold' }, t(U().go_on));
    const el = h('div', { class: 'glass reflection' },
      h('div', { class: 'txt' }, h('b', {}, t(U().reflect_label)), h('span', {}, t(text))),
      h('div', { class: 'acts' }, ask, go));
    show(el, root(), { y: 16 });
    ask.addEventListener('click', () => onAsk?.());
    go.addEventListener('click', () => { audio.soft(); hide(el).then(res); }, { once: true });
  });
}

// ================================================================== answer card
export function answerCard(label, text) {
  return new Promise((res) => {
    const el = h('div', { class: 'answer-card' }, h('span', { class: 'lbl' }, ICON.star8('#e8c277', 18), t(label)), h('span', { class: 'txt' }, t(text)));
    root().append(el);
    gsap.fromTo(el, { opacity: 0, y: 20, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: D(1.4), ease: 'power3.out' });
    audio.swell();
    cta(U().go_on).then(() => hide(el).then(res));
  });
}

// ================================================================== journal
export function journalPanel() {
  const keys = store.state.journal;
  const list = h('div', { class: 'list' });
  if (!keys.length) list.append(h('div', { class: 'empty' }, t(S.ending.journal.empty)));
  for (const k of keys) {
    const v = verse(k);
    list.append(h('div', { class: 'j-item' },
      h('div', { class: 'ref' }, h('span', {}, verseRefLong(k)), ICON.star8('#e8c277', 16)),
      ayatBlock(v), ...translationBlock(v)));
  }
  const closeBtn = h('button', { class: 'close-x', style: { position: 'static' }, 'aria-label': t(U().dalil_panel.close) }, ICON.close());
  const scrim = h('div', { class: 'modal-scrim', style: { zIndex: 20 } });
  const panel = h('div', { class: 'glass journal-panel', role: 'dialog', 'aria-label': t(S.ending.journal.title) },
    h('div', { class: 'dp-head' }, ICON.book('#e8c277', 22), h('div', { class: 'name' }, h('b', {}, t(S.ending.journal.title)), h('small', {}, t(S.ending.journal.intro))), closeBtn),
    list);
  root().append(scrim, panel);
  gsap.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: D(0.4) });
  gsap.fromTo(panel, { opacity: 0, x: i18n.dir === 'rtl' ? -30 : 30 }, { opacity: 1, x: 0, duration: D(0.6), ease: 'power3.out' });
  const close = () => { hide(scrim); hide(panel); };
  closeBtn.addEventListener('click', close); scrim.addEventListener('click', close);
}

// ================================================================== modal
export function modal(title, ...body) {
  const scrim = h('div', { class: 'modal-scrim' });
  const closeBtn = h('button', { class: 'close-x', 'aria-label': t(U().dalil_panel.close) }, ICON.close());
  const box = h('div', { class: 'glass modal', role: 'dialog', 'aria-label': title }, closeBtn, h('h3', {}, title), ...body);
  root().append(scrim, box);
  gsap.fromTo([scrim, box], { opacity: 0 }, { opacity: 1, duration: D(0.4) });
  const close = () => { hide(scrim); hide(box); };
  closeBtn.addEventListener('click', close); scrim.addEventListener('click', close);
  return { box, close };
}

export function referralForm() {
  const F = U().human_form;
  const status = h('p', { class: 'note', role: 'status' }, t(S.ending.human_form_note));
  const form = h('form', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
    h('label', { for: 'rf-lang' }, t(F.lang_label), h('select', { id: 'rf-lang' }, h('option', { value: 'ar' }, 'العربية'), h('option', { value: 'en' }, 'English'))),
    h('label', { for: 'rf-contact' }, t(F.contact_label), h('input', { id: 'rf-contact', type: 'text', autocomplete: 'off' })),
    h('label', { for: 'rf-msg' }, t(F.message_label), h('textarea', { id: 'rf-msg' })),
    h('div', { class: 'row-end' }, h('button', { class: 'btn btn-aqua', type: 'submit' }, t(F.submit))),
    status);
  form.querySelector('#rf-lang').value = i18n.lang;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    store.log('referral_request', { lang: form.querySelector('#rf-lang').value, hasContact: !!form.querySelector('#rf-contact').value });
    status.textContent = t(F.saved);
    form.querySelector('button[type=submit]').disabled = true;
  });
  modal(t(S.dalil.talk_to_human), form);
}

// ================================================================== share card
export async function shareCard(key) {
  const v = verse(key);
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(540, 520, 40, 540, 600, 900);
  grd.addColorStop(0, '#1b2160'); grd.addColorStop(0.55, '#0a0d2c'); grd.addColorStop(1, '#04051a');
  g.fillStyle = grd; g.fillRect(0, 0, 1080, 1350);
  for (let i = 0; i < 260; i++) { const x = Math.random() * 1080, y = Math.random() * 1350, r = Math.random() * 1.6; g.fillStyle = `rgba(230,236,255,${0.2 + Math.random() * 0.6})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(232,194,119,0.55)'; g.lineWidth = 2; g.strokeRect(60, 60, 960, 1230);
  await document.fonts.load('48px "Amiri Quran"'); await document.fonts.load('700 40px "Reem Kufi"');
  g.direction = 'rtl'; g.textAlign = 'center'; g.fillStyle = '#fff3d6'; g.font = '54px "Amiri Quran", serif';
  const text = v.ayah_texts.map((a) => `${a.ar} ${ayahMark(a.n)}`).join(' ');
  const words = text.split(' '); const lines = []; let line = '';
  for (const w of words) { const test = line ? `${line} ${w}` : w; if (g.measureText(test).width > 860 && line) { lines.push(line); line = w; } else line = test; }
  if (line) lines.push(line);
  const lh = 112; let y = 600 - (lines.length * lh) / 2;
  for (const l of lines) { g.fillText(l, 540, y); y += lh; }
  g.font = '30px "IBM Plex Sans Arabic", sans-serif'; g.fillStyle = '#e8c277'; g.fillText(verseRefLong(key, 'ar'), 540, y + 20);
  if (i18n.lang === 'en') {
    g.direction = 'ltr'; g.font = 'italic 30px "IBM Plex Sans Arabic", sans-serif'; g.fillStyle = '#dde2fa';
    const tw = v.ayah_texts.map((a) => a.en).join(' '); const ws = tw.split(' '); let ln = ''; let yy = y + 90;
    for (const w of ws) { const test = ln ? `${ln} ${w}` : w; if (g.measureText(test).width > 860 && ln) { g.fillText(ln, 540, yy); yy += 44; ln = w; } else ln = test; }
    if (ln) g.fillText(ln, 540, yy);
  }
  g.direction = 'rtl'; g.font = '700 64px "Reem Kufi", sans-serif'; g.fillStyle = '#e8c277'; g.fillText('فطرة', 540, 1200);
  const img = h('img', { src: c.toDataURL('image/png'), alt: verseRefLong(key) });
  modal(t(U().share.title), img, h('p', { class: 'note' }, t(U().share.save_hint)));
}

export function learnModal() {
  const L = U().learn;
  modal(t(L.title),
    h('p', { class: 'note' }, t(L.note)),
    h('a', { href: 'https://quranenc.com', target: '_blank', rel: 'noopener' }, t(L.quranenc_label)));
}
