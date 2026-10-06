// The story of the Fitrah level, beat by beat.
//
//   opening -> depth -> four questions -> ch1 (connect) -> ch1 answer
//           -> ch2 purpose -> ch3 practice -> ch4 return -> ending
//
// Each chapter: the chamber changes, Dalil introduces the question, the player
// meets it (chapter 1 by their own hand; chapters 2-4 by a lighter step for now),
// the source appears, the answer is named, one line to reflect on, and the player
// chooses when to go on. Every beat can be cancelled, so review jumps (ff) are clean.
import * as THREE from 'three';
import { CT } from '../../core/sacred/content-types.js';
import { C, CHAPTERS, answerById } from './content.js';
import { QUESTION_POS, CENTER, PILLAR_POS, THRESHOLD_POS, PLAYER_LIGHT } from './chamber.js';
import { createChain, chainPositions } from './chain.js';
import { createPillars } from './pillars.js';
import { i18n } from '../../core/i18n.js';
import { revealVerse, revealHadith } from './reveal.js';
import { SPEED, START_DEPTH } from './config.js';
import { track } from '../../core/analytics.js';

export const STEPS = ['opening', 'depth', 'four', 'ch1', 'ch1-answer', 'ch2', 'ch3', 'ch4', 'ending'];
const WARMTH = { dark: 0, opening: 0.1, four: 0.15, creation: 0.25, created: 0.7, purpose: 0.6, practice: 0.75, return: 0.35, dawn: 0.7, ending: 0.9 };
const STATE_AT = { opening: 'opening', depth: 'opening', four: 'four', ch1: 'creation', 'ch1-answer': 'creation', ch2: 'purpose', ch3: 'practice', ch4: 'return', ending: 'ending' };
const LIT_AT = { opening: 0, depth: 0, four: 0, ch1: 0, 'ch1-answer': 0, ch2: 1, ch3: 2, ch4: 3, ending: 4 };
const qLabelPos = (i) => QUESTION_POS[i].clone().add(new THREE.Vector3(0, -0.62, 0));
const below = (p, d = 0.34) => p.clone().add(new THREE.Vector3(0, -d, 0));
const cancelled = () => ({ cancelled: true });

export function createDirector({ scene, camera, chamber, rig, dalil, ui, audio, exit, talk }) {
  const D = { step: null, chapter: null, source: null, depth: START_DEPTH || 'exploring', depthChosen: !!START_DEPTH, events: [], started: false, done: false, interaction: null, focus: -1 };
  let ctl = new AbortController();
  let chain = null, pillars = null, pickResolve = null;

  // ------------------------------------------------------------ helpers (all abort with the run)
  const guard = (p) => {
    const sig = ctl.signal;
    return new Promise((resolve, reject) => {
      if (sig.aborted) { reject(cancelled()); return; }
      sig.addEventListener('abort', () => reject(cancelled()), { once: true });
      p.then(resolve, reject);
    });
  };
  const sleep = (s) => guard(new Promise((r) => setTimeout(r, (s * 1000) / SPEED)));
  const timer = (s) => new Promise((r) => setTimeout(r, (s * 1000) / SPEED));
  const say = (obj, opts = {}) => guard(dalil.say(obj, { depth: D.depth, ...opts }));
  const ev = (e) => { D.events.push(e); if (D.events.length > 8) D.events.shift(); };
  function env(state, layout, { seconds = 6, shot, pts, shotSeconds = 3.5 } = {}) {
    chamber.setState(state, seconds);
    if (layout) chamber.setLayout(layout, seconds * 1.2);
    audio.setWarmth(WARMTH[state] ?? 0.3);
    if (shot) rig.shot(shot, { pts, seconds: shotSeconds });
  }
  function setDepth(d) { if (!d) return; D.depth = d; ui.setDepth(d); }

  async function source(src, ch) {
    D.source = src.key || src.hadith;
    if (src.order === 'dalil-first' && ch?.lead) await say(ch.lead);
    audio.duck(true); ui.hideChapter(); ui.hushLabels(true);
    const opts = { readable: ui.readable, explanation: src.explanation, depth: D.depth, onDepth: setDepth, signal: ctl.signal, anchor: () => ({ x: window.innerWidth / 2, y: window.innerHeight * 0.44 }) };
    try {
      if (src.hadith) await guard(revealHadith(src.hadith, opts));
      else await guard(revealVerse(src.key, opts));
    } finally { audio.duck(false); ui.hushLabels(false); }
    ev(`source:${D.source}`);
  }
  async function answerBeat(ch, i, verse = null) {
    audio.answer();
    chamber.setQuestionLit(i, true);
    ui.answer({ n: ch.n, word: ch.answer, line: ch.answer_line });
    ev(`answer:${ch.id}`);
    await sleep(4.2);
    ui.hideAnswer();
    if (verse) { await sleep(1.0); await source(verse, ch); }
  }
  async function chapterEnd(ch, nextIndex) {
    await say(ch.summary);
    if (nextIndex > 3) return;
    D.focus = nextIndex;
    chamber.setQuestionFocus(nextIndex);
    try { await guard(ui.next({ ar: 'السؤال التالي', en: 'Next question' }, { signal: ctl.signal })); }
    finally { D.focus = -1; chamber.setQuestionFocus(-1); }
  }

  // ------------------------------------------------------------ the beats
  async function opening() {
    D.chapter = null; D.source = null;
    // the camera descends from the establishing view to stand behind the player, as the hall wakes
    env('opening', 'drift', { seconds: 8, shot: 'opening', shotSeconds: 6.5 });
    await sleep(1.2);
    // Dalil walks from the light at the centre of the hall to the player's side
    dalil.appear(true);
    await sleep(0.6);
    dalil.goTo(null);
    await sleep(4.2);
    ui.showAskButton(true);
    await say(C.opening.welcome);
  }

  async function depth() {
    if (D.depthChosen) return;
    const choice = ui.chooseDepth({ signal: ctl.signal });
    const line = dalil.say(C.depth.question, { until: choice });
    const d = await guard(choice);
    setDepth(d || 'exploring'); D.depthChosen = true; ev(`depth:${D.depth}${d ? '' : ' (skipped)'}`);
    await guard(line);
  }

  async function four() {
    D.chapter = null; D.source = null;
    chamber.resetQuestions(0, 0);
    env('four', 'drift', { seconds: 5, shot: 'four', pts: QUESTION_POS, shotSeconds: 4.5 });
    await sleep(1.6);
    for (let i = 0; i < 4; i++) {
      chamber.setQuestionShown(i, true); audio.question(i);
      ui.label(`q${i}`, CHAPTERS[i].question, qLabelPos(i), { cls: 'qlabel' });
      await sleep(1.25);
    }
    await say(C.opening.four);
    chamber.setQuestionFocus(0); ui.labelClass('q0', 'focus');
    dalil.point(QUESTION_POS[0]);
    await say(C.opening.begin);
    D.focus = 0;
    try { await guard(ui.next({ ar: 'ابدأ', en: 'Begin' }, { signal: ctl.signal })); }
    finally { D.focus = -1; dalil.point(null); }
  }

  async function ch1() {
    const ch = CHAPTERS[0], I = ch.interaction;
    D.chapter = ch; D.source = null;
    ui.clearLabels(); chamber.setQuestionFocus(-1);
    ui.chapterCard(1, ch.question);
    const flip = i18n.dir === 'rtl' ? 1 : -1; // Dalil stands left in English, right in Arabic: the chain bends the other way
    const CHAIN_POS = chainPositions(flip);
    env('creation', 'drift', { seconds: 6, shot: 'chain', pts: CHAIN_POS.slice(0, 2), shotSeconds: 4 });
    await sleep(1.4);
    await say(ch.intro);

    // CONNECT: from your light to what came before you
    let firstLink; const linked = new Promise((r) => { firstLink = r; });
    chain = createChain({
      scene, camera, mirror: flip,
      onShow: (i) => {
        ui.label(`n${i}`, I.nodes[i].label, below(CHAIN_POS[i], i === 6 ? 0.55 : 0.34), { cls: i === 6 ? 'node mystery' : 'node' });
        rig.frame(chain ? chain.framePoints() : CHAIN_POS.slice(0, i + 1), { seconds: 2.6 });
        dalil.look(CHAIN_POS[i]);
      },
      onLink: (i) => {
        audio.link(i); ev(`link:${I.nodes[i].id}`); dalil.pulse(); firstLink();
        if (i === 1) { ui.unlabel('start'); say(I.ack).catch(() => {}); }
        if (i === 1) ui.label('n0', I.nodes[0].label, below(CHAIN_POS[0], 0.3), { cls: 'node lit', sub: I.node_note });
        if (i < 6) ui.label(`n${i}`, I.nodes[i].label, below(CHAIN_POS[i]), { cls: 'node lit', sub: I.node_note });
      },
    });
    D.interaction = 'connect';
    ui.label('n0', I.nodes[0].label, below(CHAIN_POS[0], 0.3), { cls: 'node' });
    ui.label('start', I.start_here, CHAIN_POS[0].clone().add(new THREE.Vector3(0, 0.32, 0)), { cls: 'start-here', dy: -18 });
    rig.frame(chain.framePoints(), { seconds: 2 });
    // the instruction stays until the first link; if nothing happens, Dalil says it another way
    for (let k = 0; chain.s.linked === 0; k++) {
      await say(k % 2 ? I.stall : I.instruction, { until: Promise.race([linked, timer(k === 0 ? 18 : 14)]) });
    }
    // later links: a reminder only if the player stops for a long while
    let lastNudge = performance.now();
    while (!chain.s.done) {
      await Promise.race([guard(chain.done), sleep(1)]);
      const idle = (performance.now() - Math.max(chain.s.lastLinkAt, lastNudge)) / 1000 * SPEED;
      if (!chain.s.done && idle > 20) { lastNudge = performance.now(); say(I.stall).catch(() => {}); track('stall', { lv: 'fitrah', v: `chain-${chain.s.linked}` }); }
    }
    chain.stop(); D.interaction = null; ui.unlabel('start');
    // the last link reaches into the dark: nothing there explains itself
    audio.open(); ui.labelClass('n6', 'open');
    rig.frame(chain.framePoints(true), { seconds: 3.2 });
    await sleep(2.2);
    await say(I.end, { type: CT.EDUCATIONAL_CONTEXT });
    await sleep(0.5);
    chain.dim(0.3); ui.clearLabels();
    await source(ch.source, ch);
  }

  async function ch1Answer() {
    const ch = CHAPTERS[0];
    D.chapter = ch;
    chain?.remove(); chain = null; ui.clearLabels();
    env('created', 'rings', { seconds: 7, shot: 'centre', shotSeconds: 5 });
    dalil.look(CENTER);
    await sleep(2.6);
    await answerBeat(ch, 0, ch.answer_source);
    await say(ch.reflection);
    await chapterEnd(ch, 1);
  }

  async function ch2() {
    const ch = CHAPTERS[1];
    D.chapter = ch; D.source = null;
    ui.clearLabels();
    ui.chapterCard(2, ch.question, { draft: true });
    env('purpose', 'corridor', { seconds: 7, shot: 'purpose', shotSeconds: 5 });
    await sleep(1.6);
    await say(ch.intro);
    const far = new THREE.Vector3(0, 2.6, -9.5);
    dalil.point(far); dalil.look(far);
    await sleep(2.2);
    dalil.point(null);
    await source(ch.source, ch);
    await answerBeat(ch, 1);
    await say(ch.reflection);
    await chapterEnd(ch, 2);
  }

  async function ch3() {
    const ch = CHAPTERS[2], I = ch.interaction;
    D.chapter = ch; D.source = null;
    ui.clearLabels();
    ui.chapterCard(3, ch.question);
    if (!pillars) pillars = createPillars(scene);
    const pts = [0, 1, 2, 3, 4].flatMap((i) => [pillars.positions[i].clone(), pillars.top(i)]);
    env('practice', 'low', { seconds: 7, shot: 'practice', pts, shotSeconds: 5 });
    pillars.show(true);
    await sleep(1.6);
    await say(ch.intro);
    ch.pillars.forEach((pl, i) => ui.label(`p${i}`, pl.label, pillars.top(i).add(new THREE.Vector3(0, 0.6, 0)), { cls: 'pillar', sub: pl.sub }));
    // INSPECT: the player meets the five one by one, in any order; the next in reading order is suggested
    D.interaction = 'inspect';
    say(I.instruction).catch(() => {});
    let queued = null;
    while (pillars.litCount() < 5) {
      let picked;
      if (queued != null && !pillars.isLit(queued)) { picked = queued; queued = null; }
      else {
        const next = [0, 1, 2, 3, 4].find((k) => !pillars.isLit(k));
        pillars.focus(next); ui.labelClass(`p${next}`, 'focus');
        picked = await guard(new Promise((resolve) => {
          pickResolve = resolve;
          ui.next(I.next, { signal: ctl.signal }).then((ok) => { if (ok) resolve(next); });
        }));
        pickResolve = null; ui.goOn(); // closes the button when a pillar was tapped instead
        ui.labelClass(`p${next}`, 'focus', false);
        if (pillars.isLit(picked)) continue;
      }
      const pl = ch.pillars[picked];
      pillars.light(picked); pillars.focus(-1); audio.link(picked + 1); ev(`pillar:${pl.id}`);
      ui.labelClass(`p${picked}`, 'lit');
      dalil.point(pillars.middle(picked)); dalil.look(pillars.middle(picked));
      dalil.interrupt();
      say(pl.explain, { type: CT.EDUCATIONAL_CONTEXT, cites: [pl.key] }).catch(() => {});
      // the source is one tap away: read the verse, or go on (tapping another pillar goes on to it)
      const last = pillars.litCount() >= 5;
      const choice = await guard(ui.choice(
        [{ id: 'read', label: I.read, quiet: true }, { id: 'go', label: last ? { ar: 'متابعة', en: 'Continue' } : I.next }],
        { signal: ctl.signal, onTap: (resolve) => { pickResolve = (i) => resolve(`pick:${i}`); } },
      ));
      pickResolve = null;
      dalil.point(null);
      if (choice === 'read') { dalil.interrupt(); await source({ key: pl.key, order: 'verse-first' }, null); }
      else if (String(choice).startsWith('pick:')) queued = +String(choice).slice(5);
    }
    D.interaction = null; pillars.focus(-1);
    // five pillars, one building
    pillars.join(); audio.answer();
    await sleep(1.2);
    await say(I.complete);
    await source(ch.source, ch);
    await answerBeat(ch, 2);
    await say(ch.reflection);
    await chapterEnd(ch, 3);
    ui.clearLabels(); pillars.show(false);
  }

  async function ch4() {
    const ch = CHAPTERS[3];
    D.chapter = ch; D.source = null;
    ui.clearLabels();
    ui.chapterCard(4, ch.question, { draft: true });
    env('return', 'low', { seconds: 7, shot: 'return', shotSeconds: 5 });
    await sleep(1.6);
    await say(ch.intro);
    dalil.point(THRESHOLD_POS); dalil.look(THRESHOLD_POS);
    await sleep(2.0);
    dalil.point(null);
    await source(ch.source, ch);
    await say(ch.mercy, { type: CT.DALIL_EXPLANATION });
    chamber.setState('dawn', 8); audio.setWarmth(WARMTH.dawn);
    await answerBeat(ch, 3);
    await say(ch.reflection);
    await chapterEnd(ch, 4);
  }

  function answeredLabels() {
    CHAPTERS.forEach((c, i) => ui.label(`q${i}`, c.question, qLabelPos(i), { cls: 'qlabel answered', sub: c.answer }));
  }
  async function ending() {
    D.chapter = null; D.source = null;
    ui.clearLabels();
    chamber.resetQuestions(4, 1);
    env('ending', 'ordered', { seconds: 8, shot: 'ending', pts: [...QUESTION_POS], shotSeconds: 6 });
    answeredLabels();
    await sleep(2.6);
    await say(C.ending.recap);
    ui.clearLabels();
    await source({ key: C.ending.source, explanation: C.ending.explanation, order: 'verse-first' }, null);
    answeredLabels();
    await say(C.ending.final);
    D.done = true; ev('complete'); track('level_complete', { lv: 'fitrah', v: D.depth });
    ui.endCard({
      onTafakor: exit ? () => exit({ to: 'tafakor' }) : null,
      onAsk: () => dalil.openAsk(),
      onTalk: () => talk({}),
      onMenu: exit ? () => exit({ to: 'menu' }) : null,
    });
  }

  const FN = { opening, depth, four, ch1, 'ch1-answer': ch1Answer, ch2, ch3, ch4, ending };

  async function run(from = 'opening') {
    ctl.abort();
    ctl = new AbortController();
    const mine = ctl;
    D.started = true;
    let i = Math.max(0, STEPS.indexOf(from));
    try {
      for (; i < STEPS.length; i++) {
        if (mine.signal.aborted) return;
        D.step = STEPS[i];
        track('chapter', { lv: 'fitrah', v: STEPS[i] });
        await FN[STEPS[i]]();
      }
    } catch (e) {
      if (!e?.cancelled) console.error('[fitrah] director:', e);
    }
  }

  /** Jump to a beat (review). Cleans up whatever the current beat left on screen. */
  function ff(k) {
    if (!FN[k]) return;
    ctl.abort();
    dalil.interrupt(); dalil.point(null);
    ui.closeAsk(); ui.hideAnswer(); ui.clearLabels(true);
    document.getElementById('verse-layer')?.replaceChildren();
    document.querySelector('#ui .end')?.remove();
    chain?.remove(); chain = null; D.interaction = null; D.done = false;
    pillars?.show(false); pickResolve = null;
    chamber.resetQuestions(LIT_AT[k], k === 'opening' || k === 'depth' ? 0 : 1);
    chamber.setState(STATE_AT[k], 1.5);
    audio.setWarmth(WARMTH[STATE_AT[k]] ?? 0.3);
    dalil.appear(true); dalil.goTo(null); ui.showAskButton(true);
    if (k !== 'opening' && k !== 'depth') D.depthChosen = true;
    run(k);
  }

  /** A tap on the scene: the light the player is invited toward goes on. */
  function tap(x, y) {
    if (D.interaction === 'inspect' && pillars && pickResolve) {
      const i = pillars.pick(x, y, camera);
      if (i >= 0) { const r = pickResolve; pickResolve = null; r(i); return true; }
    }
    if (D.focus < 0) return false;
    const v = QUESTION_POS[D.focus].clone().project(camera);
    const sx = (v.x * 0.5 + 0.5) * window.innerWidth, sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
    if (v.z < 1 && Math.hypot(sx - x, sy - y) < Math.max(56, window.innerHeight * 0.08)) return ui.goOn();
    return false;
  }

  return {
    D, run, ff, tap,
    begin: () => run('opening'),
    get chain() { return chain; },
    get pillars() { return pillars; },
    setDepth,
    /** what Dalil knows when he is asked something */
    context: () => ({
      chapter: D.chapter ? `${D.chapter.n}` : 'opening',
      question: D.chapter?.question.en || '', answer: D.chapter?.answer_line.en || '',
      source: D.source || 'none', depth: D.depth, events: D.events.slice(-5),
    }),
    /** the questions Dalil offers to answer here */
    suggestions: () => (D.chapter?.suggest || (D.done ? ['fitrah-1', 'worship-meaning', 'hereafter-meaning'] : ['allah-name', 'fitrah-1', 'causes-2']))
      .map(answerById).filter(Boolean).map((a) => a.question).slice(0, 4),
  };
}
