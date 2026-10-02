// Fitrah – the World 1 journey from the first frame to the ending screen.
// Each step is an async function; ?step=<name> jumps straight to one (tests, demos).
import * as THREE from 'three';
import { gsap } from 'gsap';
import { camera, renderer, cinematic, REDUCED_MOTION } from '../core/scene.js';
import { ORB_HOME } from '../world/cosmos.js';
import { SHOT_SYSTEM, prepareChaos, runOrder } from '../stations/order.js';
import { runCauses } from '../stations/causes.js';
import { runOneness } from '../stations/oneness.js';
import * as ui from '../ui/components.js';
import { hud } from '../ui/components.js';
import { openDalil, closeDalil } from '../ui/dalil.js';
import { h, root, wait, ICON, D } from '../ui/dom.js';
import { i18n, t } from '../core/i18n.js';
import { script as S, quiz as Q, verse, verseRefLong, ayahMark } from '../core/content.js';
import { audio } from '../core/audio.js';
import * as store from '../core/store.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const W = S.world1;
const ST = W.stations;
const STEPS = ['intro', 'horizon', 'arrival', 'station1', 'station2', 'station3', 'closing', 'checkpoint', 'ending'];
const JOURNAL_AT = { // what the journal holds when a step starts (for ?step= jumps)
  arrival: [], station1: ['3:190'], station2: ['3:190', '67:3'], station3: ['3:190', '67:3', '52:35'],
  closing: ['3:190', '67:3', '52:35', '21:22', '112:1-4'],
  checkpoint: ['3:190', '67:3', '52:35', '21:22', '112:1-4', '30:30'],
  ending: ['3:190', '67:3', '52:35', '21:22', '112:1-4', '30:30'],
};

const tween = (target, vars) => new Promise((res) => gsap.to(target, { ...vars, duration: D(vars.duration ?? 1), onComplete: res }));

export function createGame({ cosmos, horizon, rig }) {
  const canvas = renderer.domElement;
  const orb = cosmos.orb;
  const U = cinematic.uniforms;
  let dalilContext = ST[0].dalil_suggestions;
  const v = new THREE.Vector3();

  const project = (p) => { v.copy(p).project(camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; };

  hud.setHandlers({
    journal: () => ui.journalPanel(),
    dalil: () => openDalil({ suggestions: dalilContext }),
  });

  function setLang(lang) {
    i18n.set(lang);
    store.state.lang = lang; store.save();
    hud.relabel();
    const d = horizon.align(i18n.dir);
    if (d.lengthSq() > 0) {
      if (orb.anchor.position.distanceTo(ORB_HOME) > 30) orb.anchor.position.add(d);
      cosmos.dustHub.position.add(d);
      rig.shift(d);
    }
    horizon.layout(i18n.dir);
  }

  async function collect(key, opts) {
    await ui.verseCard(key, opts);
    const n = store.collect(key);
    hud.setCount(n);
    orb.grow();
    store.log('verse_collected', { key });
  }

  async function reflect(st) {
    await ui.reflection(st.reflection, { onAsk: () => openDalil({ suggestions: st.dalil_suggestions }) });
    closeDalil();
  }

  function solvedSystem() {
    const gold = new THREE.Color('#ffcf73');
    cosmos.planets.forEach((p) => {
      p.mode = 'orbit';
      p.orbitU.uColor.value.copy(gold); p.orbitU.uDash.value = 0; p.orbitU.uPulse.value = 0;
      p.orbitU.uOpacity.value = 0.6; p.orbitU.uGlow.value = 0.12;
    });
  }

  // ------------------------------------------------------------------ steps
  const steps = {
    async intro() {
      const op = orb.anchor.position;
      horizon.hideGates();
      rig.snap(op.clone().add(V(1.6, 0.2, 7.5)), op.clone().add(V(0, -1.4, 0)), 50);
      U.uFade.value = 1;
      tween(U.uFade, { value: 0, duration: 2.4, ease: 'power2.out' });
      rig.flyTo({ pos: op.clone().add(V(0.7, 0.05, 3.9)), look: op.clone().add(V(0, -0.75, 0)), fov: 44, duration: 20, ease: 'sine.inOut' });
      const lang = await ui.intro();
      store.resetProgress();
      setLang(lang);
      hud.setCount(0);
      horizon.reveal(4.2);
      audio.swell();
      await rig.flyTo({ ...horizon.shotWide(), duration: 4.2 });

      store.state.intent = await ui.askIntent(); store.save();
      store.log('intent', { intent: store.state.intent });
      store.state.pre = await ui.runQuiz('pre'); store.save();
      store.log('pretest', { answers: store.state.pre });

      // Dalil arrives beside the light
      const close = horizon.shotClose(orb.world);
      rig.flyTo({ ...close, pos: close.pos.add(V(0.6, 0.2, 1.4)), duration: 2.6 });
      await wait(0.9);
      cosmos.dalil.show(); audio.shimmer();
      await wait(1.2);
      await ui.speech(S.dalil.intro_lines, () => project(orb.anchor.position)); // the anchor ignores the bob
      hud.showTop(true); hud.showDalil(true);
    },

    async horizon() {
      await rig.flyTo({ ...horizon.shotWide(), duration: 2.6 });
      await ui.horizonScreen(() => horizon.screenPositions(camera));
      store.log('gate_enter', { world: 1 });

      // into the gate
      const gp = horizon.gateWorld(0);
      gsap.to(orb.anchor.position, { x: gp.x, y: gp.y - 0.2, z: gp.z + 0.4, duration: D(2.6), ease: 'power2.inOut' });
      await rig.flyTo({ pos: gp.clone().add(V(0, 0.5, 5.5)), look: gp, fov: 50, duration: 2.4 });
      audio.warp();
      gsap.to(U.uWarp, { value: 1, duration: D(1.8), ease: 'power2.in' });
      gsap.fromTo(U.uCA, { value: 0.0022 }, { value: 0.012, duration: D(1.8), ease: 'power2.in' });
      await rig.flyTo({ pos: gp.clone().add(V(0, 0, -1.2)), look: gp.clone().add(V(0, 0, -12)), fov: 92, duration: 2.0, ease: 'power3.in' });
      await tween(U.uFade, { value: 1, duration: 0.45 });

      // teleport into World 1
      orb.anchor.position.copy(ORB_HOME);
      prepareChaos(cosmos);
      cosmos.dalil.state.radius = 1.3;
    },

    async arrival() {
      rig.snap(V(34, 34, 92), V(-3, 0, 0), 62);
      gsap.to(U.uWarp, { value: 0, duration: D(2.6), ease: 'power2.out' });
      gsap.to(U.uCA, { value: 0.0022, duration: D(2.6) });
      tween(U.uFade, { value: 0, duration: 1.8 });
      rig.flyTo({ pos: V(-1, 11, 40), look: V(-3, 0.5, 0), fov: 48, duration: 10, ease: 'power2.out' });
      await wait(1.2);
      await ui.titleCard(W.title, W.subtitle, 2.8);
      await collect(W.arrival.verse);
      for (const line of W.arrival.after_lines) await ui.caption(line, 4.4);
    },

    async station1() {
      const st = ST[0];
      dalilContext = st.dalil_suggestions;
      hud.setStation(1, st.title);
      await rig.flyTo({ ...SHOT_SYSTEM, duration: 3.2 });
      await runOrder({ cosmos, camera, canvas, rig });
      await wait(1.6);
      await ui.sign(st.sign, st.success);
      await collect(st.verse);
      await reflect(st);
    },

    async station2() {
      const st = ST[1];
      dalilContext = st.dalil_suggestions;
      hud.setStation(2, st.title);
      const cleanup = await runCauses({ cosmos, camera, rig });
      await ui.sign(st.sign);
      await collect(st.verse);
      await reflect(st);
      cleanup();
    },

    async station3() {
      const st = ST[2];
      dalilContext = st.dalil_suggestions;
      hud.setStation(3, st.title);
      gsap.to(orb.anchor.position, { x: ORB_HOME.x, y: ORB_HOME.y, z: ORB_HOME.z, duration: D(3.6), ease: 'power2.inOut' });
      await runOneness({ cosmos, canvas, rig });
      await ui.caption(st.success, 3.2);
      await ui.sign(st.sign);
      await collect(st.verse);
      await collect(st.answer_verse.verse, { heading: st.answer_verse.heading });
      await reflect(st);
    },

    async closing() {
      hud.setStation(0);
      dalilContext = ST.map((s) => s.dalil_suggestions[0]);
      await rig.flyTo({ pos: ORB_HOME.clone().add(V(2.6, 0.9, 5.2)), look: V(-4, 1, 0), fov: 44, duration: 4.2 });
      for (const line of W.closing.lines) await ui.caption(line, 4.6);
      await collect(W.closing.verse);
      rig.flyTo({ pos: ORB_HOME.clone().add(V(4.5, 3.2, 10)), look: V(-3, 0.5, 0), fov: 46, duration: 9, ease: 'sine.inOut' });
      await ui.answerCard(S.ui.closing_label, W.closing.answer_card);
    },

    async checkpoint() {
      store.state.post = await ui.runQuiz('post'); store.save();
      store.log('posttest', { answers: store.state.post });
      await ui.toast(W.checkpoint.result, 3.4);
    },

    async ending() {
      hud.setStation(0);
      hud.showDalil(false);
      closeDalil();
      cosmos.burstGold.play(V(0, 0, 0), 30, 4, 4.5);
      audio.swell();
      await rig.flyTo({ pos: V(0, 30, 44), look: V(0, -3, 0), fov: 50, duration: 6, ease: 'power2.inOut' });
      // a slow orbit while the player reads
      const orbit = { a: Math.atan2(0, 44) };
      cosmos.addUpdater((dt) => {
        if (REDUCED_MOTION) return;
        orbit.a += dt * 0.025;
        rig.target.pos.set(Math.sin(orbit.a) * 44, 30, Math.cos(orbit.a) * 44);
      });
      endingScreen();
      await new Promise(() => {}); // the journey rests here
    },
  };

  // ------------------------------------------------------------------ ending screen
  function endingScreen() {
    const E = S.ending;
    const keys = store.state.journal;
    const hero = h('div', { class: 'hero' }, ICON.star8('#e8c277', 34), h('h1', {}, t(E.lines[0])));

    const grid = h('div', { class: 'j-grid' }, ...keys.map((k) => {
      const vv = verse(k);
      return h('button', { class: 'j-card', onClick: () => ui.verseCard(k, { mode: 'view' }) },
        h('b', {}, verseRefLong(k)),
        h('span', { class: 'ayat-mini', lang: 'ar' }, `${vv.ayah_texts[0].ar} ${ayahMark(vv.ayah_texts[0].n)}`));
    }));
    const journal = h('section', {},
      h('div', { class: 'sec-head' }, h('b', {}, t(E.journal.title)), h('span', {}, t(E.journal.intro))),
      keys.length ? grid : h('div', { class: 'empty' }, t(E.journal.empty)));

    const actions = {
      human: () => ui.referralForm(),
      learn: () => ui.learnModal(),
      share: () => {
        if (keys.length === 1) return ui.shareCard(keys[0]);
        const m = ui.modal(t(S.ui.pick_verse), h('div', { class: 'share-pick' }, ...keys.map((k) =>
          h('button', { class: 'j-card', onClick: () => { m.close(); ui.shareCard(k); } }, h('b', {}, verseRefLong(k))))));
      },
    };
    const choices = h('div', { class: 'choice-grid' }, ...E.options.map((o, i) =>
      h('button', { class: `choice${i === 0 ? ' primary' : ''}`, onClick: () => { audio.soft(); store.log('ending_choice', { id: o.id }); actions[o.id](); } },
        o.id === 'human' ? ICON.chat() : o.id === 'share' ? ICON.share('#e8c277') : ICON.book('#bff5ec', 26),
        h('b', {}, t(o.label)), h('span', {}, t(o.description)))));
    const more = h('section', {}, h('div', { class: 'sec-head' }, h('b', {}, t(E.question))), choices);

    const pv = verse(E.verse_principle);
    const principle = h('div', { class: 'principle' },
      h('div', { class: 'ayat', lang: 'ar', dir: 'rtl' }, ...pv.ayah_texts.map((a) => [a.ar, ' ', h('span', { class: 'mark' }, ayahMark(a.n))])),
      h('div', { class: 'ref' }, verseRefLong(E.verse_principle)),
      i18n.lang === 'en' ? h('div', { class: 'translation', lang: 'en' }, pv.ayah_texts.map((a) => a.en).join(' '), ` (${pv.translation_en_author})`) : null);

    const total = Q.questions.length;
    const count = (o) => Object.values(o || {}).filter(Boolean).length;
    const pre = store.state.pre, post = store.state.post;
    const score = pre && post && Object.keys(pre).length === total
      ? h('div', { class: 'score' }, i18n.fmt(S.ui.score_line, { pre: count(pre), post: count(post), total }))
      : null;
    const restart = h('button', { class: 'btn btn-ghost', onClick: () => { store.resetProgress(); location.reload(); } }, t(S.ui.restart));

    const el = h('div', { class: 'ending', role: 'main' }, hero, journal, more, principle,
      h('div', { class: 'tagline' }, t(E.tagline)), score, restart);
    root().append(el);
    const kids = [...el.children];
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: D(1.6) });
    gsap.fromTo(kids, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: D(1), stagger: D(0.18), delay: D(0.4), ease: 'power3.out' });
  }

  // ------------------------------------------------------------------ jumps (?step=)
  function setupJump(step) {
    const params = new URLSearchParams(location.search);
    setLang(params.get('lang') === 'en' ? 'en' : 'ar');
    hud.showTop(true); hud.showDalil(true);
    cosmos.dalil.show();
    if (step === 'horizon') return;
    orb.anchor.position.copy(ORB_HOME);
    if (step === 'arrival' || step === 'station1') prepareChaos(cosmos); else solvedSystem();
    store.state.journal = [...(JOURNAL_AT[step] || [])]; store.save();
    hud.setCount(store.state.journal.length);
    if (step === 'checkpoint' || step === 'ending') {
      store.state.pre = store.state.pre || { 'w1-q1': true, 'w1-q2': false, 'w1-q3': false };
      store.state.post = store.state.post || { 'w1-q1': true, 'w1-q2': true, 'w1-q3': true };
    }
    rig.snap(SHOT_SYSTEM.pos, SHOT_SYSTEM.look, SHOT_SYSTEM.fov);
  }

  async function run(from) {
    const i0 = Math.max(0, STEPS.indexOf(from));
    if (i0 > 0) setupJump(STEPS[i0]);
    for (let i = i0; i < STEPS.length; i++) {
      store.log('step', { step: STEPS[i] });
      document.body.dataset.step = STEPS[i];
      await steps[STEPS[i]]();
    }
  }

  return { run, steps, STEPS };
}
