// The narrative director. The world is the primary actor: it has its own wind,
// rain, water and light, on its own time. The player notices, follows and
// understands; Dalil guides, interprets and accompanies. Each beat is
//   the world shows something -> Dalil or the scene draws attention -> a discovery
//   gesture (trace / reveal / connect / align) -> what was there becomes visible
//   -> Dalil explains or keeps silent -> sometimes a verse -> the world moves on.
//
//   arrival -> the current (TRACE) -> rain over the valley (REVEAL) -> the first
//   water (TRACE) -> revelation 1, verse first (56:68-70) -> Dalil leads to the
//   meadow -> a flower opens; the chain (CONNECT) -> the clouds thin (ALIGN) ->
//   the light -> revelation 2, verse first (PROVISIONAL: 57:17, alt. 30:50) -> peace
import * as THREE from 'three';
import { CONFIG, PROVISIONAL, SPEED } from './config.js';
import { U, updateLook } from './look.js';
import { sim, setField, canopyAt, rainNear, exposureNow, worldGather, worldWet, worldWind, worldThin } from './sim.js';
import { heightAt, channelX, waterY, raycastTerrain, M } from './terrain.js';
import { revealVerse } from './verse.js';
import { createTrace, createReveal, createConnect, createAlign, createAttention } from './interact.js';
import { createHeroFlower } from './phenomena.js';
import { bus, EV } from './events.js';
import { LINES, EXPLAIN } from './dalil/lines.js';
import { renderer } from '../../core/scene.js';
import { i18n } from '../../core/i18n.js';
import { interactionRegion } from '../../core/device.js';
import { solveFraming } from '../../core/framing.js';

export const STATES = [
  { ar: 'سكون', en: 'Dormant' }, { ar: 'أولى العلامات', en: 'First signs' }, { ar: 'الإحياء', en: 'Revival' },
  { ar: 'الازدهار', en: 'Flourishing' }, { ar: 'النور', en: 'Light' }, { ar: 'السكينة', en: 'Peace' },
];
const BEATS = ['arrival', 'current', 'rain', 'water', 'stream', 'meadow', 'light', 'final', 'peace'];
const SCENES = {
  arrival: 'The player has just arrived in a dry, cracked valley under a heavy grey sky. Dalil is beside them.',
  current: 'A current of wind is carrying dust and moisture across the valley from the eastern slopes; the player is following it with their attention.',
  rain: 'Clouds have gathered over the player and rain is falling on the cracked soil; the player is looking through the rain at the ground.',
  water: 'Rainwater has gathered in the dry stream bed and is running downhill; the player is following it. Grass is beginning to sprout along its banks.',
  stream: 'The first water has reached the stream. The verse about the water we drink (56:68-70) is being shown here.',
  meadow: 'Rain has moved over the meadow below. Grass and orange wildflowers are opening. The player is following the chain from cloud to flower.',
  light: 'A heavy canopy of cloud covers the meadow and has begun to thin by itself; the player is keeping their eyes on the thinning cloud as sunlight starts to come through.',
  final: 'Sunlight has broken through onto the living meadow. The final verse is being shown.',
  peace: 'The meadow is green, warm and still. The journey is complete; the player may ask about anything they saw.',
};
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const CANCEL = Symbol('cancel');

export function createDirector({ player, dalil, input, ui, audio, water, flora, motes, camera, phenomena, scene }) {
  const S = sim.stats;
  const attention = createAttention();
  const reveal = createReveal({ scene, attention });
  const hero = createHeroFlower(scene, camera);
  const D = {
    beat: 'intro', envState: 0, t: 0, beatT: 0, started: false, verseActive: false, revealed: [],
    interaction: 'none', look: null, rail: null, fov: 38, lookP: 0, lightOpen: 0, exposureKick: 0,
    waterFront: 0, waterFrom: 0, waterFull: false, gather: null, currentWind: false, breakAt: null,
  };
  let gen = 0, connect = null;

  // ---------------------------------------------------------------- helpers
  const sleep = (s, g) => new Promise((res, rej) => setTimeout(() => (g !== gen ? rej(CANCEL) : res()), (s * 1000) / SPEED));
  const until = (fn, g, timeout = 1e9) => new Promise((res, rej) => {
    const t0 = performance.now();
    const tick = () => { if (g !== gen) return rej(CANCEL); if (fn() || (performance.now() - t0) / 1000 > timeout / SPEED) return res(); setTimeout(tick, 100); };
    tick();
  });
  const alive = (g) => { if (g !== gen) throw CANCEL; };
  /** Await a gesture, but give up if the sequence was replaced (a review jump). */
  const race = (p, g) => Promise.race([p, until(() => false, g)]);
  function setBeat(b) { D.beat = b; D.beatT = 0; dalil.brain.seq = b === 'stream' ? 'verse1' : b; }
  function enter(state) {
    if (state <= D.envState) return;
    D.envState = state;
    ui.live({ ar: `حالة الوادي: ${STATES[state].ar}`, en: `The valley: ${STATES[state].en}` });
  }
  const railPoint = (i) => player.marks[i] ?? 0;
  /** Arc length on the rail closest to a world point. */
  function railS(p) {
    let best = 0, bd = 1e9; const q = new THREE.Vector3();
    for (let k = 0; k <= 200; k++) { player.pointAt((k / 200) * player.length, q); const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < bd) { bd = d; best = k; } }
    return (best / 200) * player.length;
  }
  const ground = (x, z, up = 0) => new THREE.Vector3(x, heightAt(x, z) + up, z);
  const ahead = (d, up = 0) => { const p = player.state.position, h = player.state.heading; return ground(p.x + h.x * d, p.z + h.z * d, up); };
  /** Stall watcher: one gentle observation if the player has not engaged for a while. */
  function watchStall(line, g, test, after = 12) {
    let said = false;
    const t0 = D.t; // the frame clock, the same clock the input stamps gestures with
    const beat = D.beat;
    const still = () => g === gen && D.beat === beat && test(); // the moment it is meant for
    const tick = () => {
      if (g !== gen || said || D.beat !== beat) return;
      if (test() && D.t - t0 > after / SPEED && D.t - Math.max(input.G.lastGestureT, t0) > after / SPEED) { said = true; dalil.say(line, { valid: still }); return; }
      setTimeout(tick, 400);
    };
    setTimeout(tick, 400);
  }

  // ---------------------------------------------------------------- the beats
  const arrivalLook = new THREE.Vector3(40, 10, -80); // toward the north-east slopes, where the current comes from
  const rc = CONFIG.rainCenter;
  const aFrom = () => water.alongAt(CONFIG.water.zFrom);
  const aTo = () => water.alongAt(CONFIG.water.zTo);

  async function arrival(g) {
    setBeat('arrival'); D.interaction = 'none';
    D.look = () => arrivalLook; D.fov = 40;
    bus.emit(EV.ARRIVED);
    await sleep(3.5, g);
  }

  async function current(g) {
    setBeat('current');
    // the world: a current of wind crossing the valley, clouds slowly gathering where it goes
    phenomena.state.current = 1; D.currentWind = true; D.gather = { x: rc.x, z: rc.z, r: rc.r, rate: 0.035 };
    bus.emit(EV.CURRENT_APPEARED);
    await sleep(1.6, g);
    const c = phenomena.curve;
    dalil.notice(c.getPointAt(0.2), { step: 1.5 });
    dalil.say(LINES.current_notice);
    let explained = false;
    const trace = createTrace({
      camera, curve: c, speed: 10 * SPEED, attention,
      onAdvance: (u, head) => {
        phenomena.state.head = u; phenomena.state.traced = u; phenomena.state.knot = head.clone();
        if (u > 0.55 && !explained) { explained = true; dalil.say(LINES.current_where, { priority: 1 }); }
        if (u > 0.02 && !bus.has(EV.PLAYER_NOTICED_CURRENT)) bus.emit(EV.PLAYER_NOTICED_CURRENT);
      },
    });
    trace.s.u = 0.1; // attention meets the current where it first comes into view
    phenomena.state.knot = c.getPointAt(0.1); phenomena.state.head = 0.1;
    D.interaction = 'tracing the current of wind';
    // the observation field follows where attention is on the current
    const lookAt = new THREE.Vector3();
    D.look = () => lookAt.copy(arrivalLook).lerp(trace.head, smooth(0, 0.06, trace.s.u));
    input.setActive(trace);
    // as he points: what to do with the hands (worded for mouse, touch or pen)
    dalil.say(LINES.current_follow, { gap: 1.2 });
    watchStall(LINES.stall_hold, g, () => !trace.s.everNear, 12);
    watchStall(LINES.stall_trace, g, () => trace.s.u < 0.9, 26);
    D.activeTrace = trace;
    await race(trace.done, g);
    D.activeTrace = null; input.setActive(null);
    bus.emit(EV.PLAYER_TRACED_WIND);
    phenomena.state.current = 0; phenomena.state.knot = null; D.currentWind = false;
    // where the wind was going: the clouds over the valley, already heavy
    D.look = () => ground(rc.x + 2, rc.z + 16, CONFIG.cloudHeight * 0.75);
  }

  async function rain(g) {
    setBeat('rain');
    D.gather = { x: rc.x, z: rc.z, r: rc.r, rate: 0.16 };
    setField('rt', (x, z, v) => (Math.hypot(x - rc.x, z - rc.z) < rc.r ? Math.max(v, 7.5) : v)); // the cloud has been ripening while it gathered
    const p = player.state.position;
    await until(() => rainNear(p.x, p.z) > 0.2, g, 30);
    bus.emit(EV.RAIN_BEGAN); bus.emit(EV.PLAYER_DISCOVERED_RAIN);
    enter(1);
    dalil.notice(ground(p.x, p.z, CONFIG.cloudHeight)); dalil.say(LINES.rain_listen);
    await sleep(2.5, g);
    // the gaze lowers to the ground in front; the rain veils it
    const focus = ahead(6);
    D.look = () => focus; D.fov = 34;
    await sleep(1.2, g);
    const done = reveal.begin();
    input.setActive(reveal);
    D.interaction = 'looking through the rain at the cracked soil';
    dalil.say(LINES.rain_closer, { gap: 0.8 });
    watchStall(LINES.stall_reveal, g, () => reveal.s.coverage < 0.12, 12);
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const lensFocus = focus.clone();
    D.look = () => {
      // the observation field leans toward where the player is looking through the rain
      if (reveal.s.pressed || reveal.s.assist) {
        ndc.set((reveal.s.x / window.innerWidth) * 2 - 1, -(reveal.s.y / window.innerHeight) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hit = raycastTerrain(ray.ray, 40);
        if (hit && hit.distanceTo(player.state.position) < 25) lensFocus.lerp(hit, 0.08);
        D.fov = 24;
      } else D.fov = 32;
      phenomena.state.splashFocus = lensFocus;
      return lensFocus;
    };
    phenomena.state.splashOn = 1;
    D.wetFocus = lensFocus;
    await race(done, g);
    D.wetFocus = null;
    input.setActive(null); reveal.end();
    bus.emit(EV.PLAYER_REVEALED_SOIL);
    enter(2);
    D.fov = 38;
    // the weather moves on south over the valley, on its own
    sim.meadowWeather = true;
    dalil.say(LINES.soil_explain, { priority: 1 });
    await dalil.quiet(); alive(g);
    D.gather = null;
  }

  async function waterBeat(g) {
    setBeat('water');
    phenomena.state.splashOn = 0;
    // the first water gathers in the dry stream bed and runs downhill by itself
    D.waterFrom = aFrom(); D.waterFront = aFrom() + 4; D.waterRun = 2.4;
    const pts = []; const q = new THREE.Vector3();
    for (let a = aFrom() + 4; a <= aTo(); a += 2) { water.pointAt(a, q); pts.push(q.clone().add(new THREE.Vector3(0, 0.2, 0))); }
    const curve = new THREE.CatmullRomCurve3(pts);
    bus.emit(EV.WATER_MOVING);
    await sleep(1.2, g);
    dalil.notice(curve.getPointAt(0.05), { step: 2 });
    dalil.say(LINES.water_moving, { gap: 1 });
    let explained = false;
    const span = aTo() - aFrom() - 4;
    const trace = createTrace({
      camera, curve, speed: 3.2 * SPEED, attention,
      limit: () => Math.min(1, (D.waterFront - aFrom() - 4) / span),
      onAdvance: (u, head) => {
        phenomena.state.knot = head.clone();
        if (u > 0.5 && !explained) { explained = true; dalil.say(LINES.water_explain, { priority: 1 }); }
      },
    });
    input.setActive(trace); D.activeTrace = trace;
    D.interaction = 'following the first water down the dry stream bed';
    watchStall(LINES.stall_hold, g, () => trace.s.u < 0.2 && !trace.s.everNear, 12);
    watchStall(LINES.stall_water, g, () => trace.s.u < 0.2 && trace.s.everNear, 14);
    // walking is following: the player keeps a few metres behind where attention is
    D.rail = () => Math.max(0, railS(trace.head) - 3);
    const lk = new THREE.Vector3();
    D.look = () => lk.copy(trace.head).lerp(ahead(10, 0.5), 0.12);
    // Dalil walks along the water, a little ahead
    let lastLead = 0;
    D.onFrame = () => {
      if (D.t - lastLead > 2.5 / SPEED) { lastLead = D.t; const tgt = curve.getPointAt(Math.min(1, trace.s.u + 0.12)); dalil.lead(new THREE.Vector3(tgt.x + 3.5, 0, tgt.z), tgt); }
    };
    await race(trace.done, g);
    D.onFrame = null; input.setActive(null); phenomena.state.knot = null; D.activeTrace = null;
    bus.emit(EV.PLAYER_TRACED_WATER); bus.emit(EV.PLAYER_REVEALED_STREAM);
    dalil.follow();
  }

  async function stream(g) {
    setBeat('stream');
    D.rail = () => railPoint('stream');
    await until(() => Math.abs(player.state.s - railPoint('stream')) < 1.5, g, 20);
    // the environment goes quiet: rain thins to a trickle, the water stills, light gathers on it
    sim.allowRain = false;
    const z = CONFIG.rail[CONFIG.marks.stream][1] + 3;
    const anchorW = new THREE.Vector3(channelX(z), waterY(z) + 2.4, z);
    D.waterStill = 1;
    await revelation(PROVISIONAL.verses.revival, anchorW, { eye: 1.2, fov: 38, motesDrop: -1.4, g, side: 1 });
    D.waterStill = 0; sim.allowRain = true;
    D.waterFull = true; // the rest of the stream fills from upstream as the rain keeps feeding it
  }

  async function meadow(g) {
    setBeat('meadow');
    // Dalil notices something below and leads; the player follows him
    const edge = ground(CONFIG.rail[CONFIG.marks.meadow][0] + 3, CONFIG.rail[CONFIG.marks.meadow][1] + 2.5);
    const meadowC = ground(M.x, M.z, 2);
    dalil.notice(meadowC);
    dalil.say(LINES.meadow_come);
    await sleep(1.5, g);
    D.interaction = 'following Dalil down to the meadow';
    player.state.sMax = player.length;
    const arrived = dalil.lead(edge, meadowC);
    D.rail = () => Math.min(railPoint('meadow'), Math.max(0, railS(dalil.pos) - 4));
    D.look = () => dalil.groundPos().add(new THREE.Vector3(0, 1.2, 0)).lerp(meadowC, 0.5);
    await race(arrived, g);
    D.rail = () => railPoint('meadow');
    await until(() => Math.abs(player.state.s - railPoint('meadow')) < 1.5, g, 25);
    // the meadow has been receiving rain; wait (with Dalil) for it to answer
    const comp = meadowComposition();
    const flowerAt = comp.flower;
    hero.place(flowerAt);
    D.look = () => flowerAt.clone().add(new THREE.Vector3(0, 0.6, 0)); D.fov = 34;
    await until(() => S.vegMeadow > 0.5, g, 40);
    enter(3); flora.uniforms.uFlowers.value = Math.max(flora.uniforms.uFlowers.value, 0.001);
    D.flowersOn = true;
    hero.bloom();
    await sleep(2.2, g);
    bus.emit(EV.PLAYER_DISCOVERED_FLOWER);
    dalil.kneel(new THREE.Vector3(flowerAt.x + 0.6, 0, flowerAt.z - 0.4), 6);
    dalil.say(LINES.flower_look);
    await dalil.quiet(); alive(g);
    // follow the relationship: cloud -> (rain) -> soil -> water -> flower, all in one frame.
    // The frame is calculated for this screen: all four points inside the safe region
    // (see frameChain), recalculated if the screen turns or resizes.
    const nodes = [{ id: 'cloud', world: comp.cloud.clone() }, { id: 'soil', world: comp.soil.clone() }, { id: 'water', world: comp.water.clone() }, { id: 'flower', world: hero.headPos() }];
    let framing = frameChain(nodes, comp, true);
    await sleep(1.0, g);
    const settleFrom = D.t; // the frame clock: the camera has had time to arrive, however slow the device
    await until(() => cameraSettled(framing) || D.t - settleFrom > 4, g);
    connect = createConnect({ camera, nodes, attention, onLink: (i) => { bus.emit('LINK', { to: nodes[i].id }); dalil.point(nodes[i].world); } });
    input.setActive(connect);
    D.interaction = 'following the chain from the cloud to the flower';
    dalil.say(LINES.chain_prompt, { gap: 0.8 });
    watchStall(LINES.stall_connect, g, () => connect && connect.s.linked === 0, 12);
    // a turned phone or a resized window: frame again (the points may move only before the first link)
    let resizeT = 0;
    const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (g === gen && connect && !connect.s.done) framing = frameChain(nodes, comp, connect.s.linked === 0); }, 120); };
    window.addEventListener('resize', onResize);
    try { await race(connect.done, g); } finally { window.removeEventListener('resize', onResize); clearTimeout(resizeT); }
    input.setActive(null);
    bus.emit(EV.PLAYER_CONNECTED_CHAIN);
    dalil.say(LINES.chain_explain, { priority: 1 });
    await dalil.quiet(); alive(g);
    connect.remove(); connect = null;
    dalil.follow();
  }

  async function light(g) {
    setBeat('light');
    sim.canopy = true; // the rain eases; the canopy holds
    if (S.cdMeadow < 0.6) { D.gather = { x: M.x + sim.OFF.x * 0.5, z: M.z + sim.OFF.z * 0.5, r: M.r + 24, rate: 0.5, target: 0.8 }; await until(() => S.cdMeadow > 0.65, g, 8); D.gather = null; }
    D.look = () => meadowLook; D.fov = 53;
    await sleep(2.5, g);
    // the cloud begins to thin by itself, drifting with the wind
    const B1 = new THREE.Vector3(M.x + sim.OFF.x, CONFIG.cloudHeight, M.z + sim.OFF.z);
    const B = B1.clone().add(new THREE.Vector3(10, 0, 8)); // farther first, so it starts low in the view
    D.breakAt = B; phenomena.state.breakAt = B;
    bus.emit(EV.CLOUDS_THINNING);
    dalil.notice(B.clone());
    await sleep(0.8, g);
    dalil.lead(ahead(3.5).add(new THREE.Vector3(1.5, 0, 0)), B);
    dalil.say(LINES.light_notice, { gap: 1 });
    // the thinning cloud and the way it will drift must both be reachable on this screen
    // (the authored frame stays wherever it already holds them)
    const frameLight = () => {
      const f = solveFraming({ eye: camera.position.clone(), points: [B.clone(), B1], look: meadowLook, fov: 53, aspect: window.innerWidth / window.innerHeight, region: interactionRegion(), lens: player.lensFor, maxFov: 85 });
      if (f.how !== 'authored') { D.look = () => f.look; D.fov = f.fov; } else { D.look = () => meadowLook; D.fov = 53; }
      D.lightFrame = { how: f.how, fov: Math.round(f.fov * 10) / 10 };
    };
    frameLight();
    const onResizeLight = () => frameLight();
    window.addEventListener('resize', onResizeLight);
    const align = createAlign({ camera, target: () => B, attention, need: 5 / SPEED });
    input.setActive(align);
    D.interaction = 'keeping their eyes on the thinning cloud';
    watchStall(LINES.stall_align, g, () => align.progress() < 0.2, 12);
    D.onFrame = (dt) => {
      B.lerp(B1, 1 - Math.exp(-dt * 0.06)); // the break drifts with the wind
      phenomena.state.breakBoost = 1 + align.progress() * 1.4;  // attention lets the player see the light gathering
      U.uBreak.value.set(B.x, B.z, 3 + align.progress() * 3, 0.35 + align.progress() * 0.6);
      if (!D.lightOpen) worldThin(B.x, B.z, 7, dt * 0.05);
    };
    try { await race(align.done, g); } finally { window.removeEventListener('resize', onResizeLight); }
    input.setActive(null);
    bus.emit(EV.PLAYER_ALIGNED_LIGHT);
    // the clouds separate by themselves: the light sequence
    D.lightOpen = 1; D.exposureKick = 1;
    const dir = new THREE.Vector3(U.uPrevailing.value.x, 0, U.uPrevailing.value.y).normalize();
    const t0 = D.t;
    await new Promise((res, rej) => {
      D.onFrame = (dt) => {
        if (g !== gen) { D.onFrame = null; return rej(CANCEL); }
        const k = Math.min(1, (D.t - t0) / (9 / SPEED));
        const r = 8 + k * 12;
        U.uBreak.value.set(B.x, B.z, r * 0.9, 1.0 - k * 0.6);
        for (let i = -2; i <= 2; i++) worldThin(B.x + dir.x * i * r * 0.6, B.z + dir.z * i * r * 0.6, r, dt * 0.35 * SPEED);
        if (exposureNow() >= CONFIG.lightTarget || k >= 1) { D.onFrame = null; res(); }
      };
    });
    sim.frozen = true;
    phenomena.state.breakAt = null; U.uBreak.value.w = 0;
    enter(4);
    bus.emit(EV.PLAYER_OBSERVED_LIGHT);
    await sleep(4, g); // silence: the light needs no words
  }

  async function final(g) {
    setBeat('final');
    const anchorW = ground(M.x - 4, M.z - 4, 11);
    await revelation(PROVISIONAL.verses.final, anchorW, { eye: 1.6, fov: 50, motesDrop: -2.5, g, side: -1 });
    enter(5);
    dalil.say(LINES.closing, { priority: 1, force: true });
  }

  async function peace(g) {
    setBeat('peace');
    D.look = () => meadowLook; D.fov = 53; D.interaction = 'resting in the meadow';
    await sleep(6, g);
    dalil.complete();
    bus.emit(EV.JOURNEY_COMPLETE);
    await sleep(4, g);
    ui.endCard({ onReplay: () => location.reload() });
  }
  const meadowLook = ground(M.x + 6, M.z + 6, 9);
  /**
   * The meadow frame for the chain: cloud far above, soil and flower near, the stream to the right.
   * `spread` < 1 draws the soil and water points in toward the flower (the cloud is already
   * beside it), for screens too narrow to hold the full composition. The flower never moves.
   */
  function meadowComposition(spread = 1) {
    const pm = player.pointAt(railPoint('meadow'));
    const at = (deg, d, up) => { const a = (deg * Math.PI) / 180; return ground(pm.x + Math.cos(a) * d, pm.z + Math.sin(a) * d, up); };
    const FLOWER = 52, toward = (deg) => FLOWER + (deg - FLOWER) * spread;
    let water = null, best = 1e9;
    for (let z = pm.z + 8; z < pm.z + 34; z += 1) {
      const x = channelX(z), ang = Math.atan2(z - pm.z, x - pm.x) * 180 / Math.PI;
      if (Math.abs(ang - toward(90)) < best) { best = Math.abs(ang - toward(90)); water = new THREE.Vector3(x, waterY(z) + 0.1, z); }
    }
    const cloud = at(56, 88, 0); cloud.y = CONFIG.cloudHeight - 2;
    const eye = heightAt(pm.x, pm.z) + 1.6;
    const view = at(66, 30, 0); view.y = eye + 1.5;
    return { view, flower: at(FLOWER, 5.4, 0), soil: at(toward(72), 6.5, 0.05), water, cloud };
  }

  /**
   * Frame the chain for this screen (core/framing.js): the authored view when every point is
   * already inside the safe interaction region; otherwise the least turn; otherwise centred with
   * a wider lens; and only if that is not enough, the points drawn closer together (repick).
   */
  function frameChain(nodes, comp, repick) {
    const region = interactionRegion();
    const pm = player.pointAt(railPoint('meadow'));
    const eye = new THREE.Vector3(pm.x, heightAt(pm.x, pm.z) + player.state.eye, pm.z);
    const aspect = window.innerWidth / window.innerHeight;
    const solve = (maxFov) => solveFraming({ eye, points: nodes.map((n) => n.world), look: comp.view, fov: 58, aspect, region, lens: player.lensFor, maxFov });
    let f = null, spread = null;
    const tries = [];
    const angles = () => nodes.map((n) => Math.round(Math.atan2(n.world.z - eye.z, n.world.x - eye.x) * 180 / Math.PI));
    const place = (s) => {
      const c = s === 1 ? comp : meadowComposition(s);
      nodes[0].world.copy(c.cloud); nodes[1].world.copy(c.soil); nodes[2].world.copy(c.water);
      spread = s;
    };
    for (const s of repick ? [1, 0.84, 0.7, 0.56] : [null]) {
      if (s !== null) place(s);
      f = solve(85);
      tries.push({ s, how: f.how, need: Math.round(f.need * 10) / 10, deg: angles() });
      if (f.fits) break;
    }
    if (!f.fits) {
      // no composition fits the usual lens: keep the most faithful one that needs the least
      // (drawing points closer only counts when it really narrows the view), and widen to it
      if (repick) {
        const least = Math.min(...tries.map((t) => t.need));
        place(tries.find((t) => t.need <= least + 1).s);
      }
      f = solve(100); // a very small screen: a wider lens rather than a point out of reach
    }
    D.look = () => f.look; D.fov = f.fov;
    D.chainFrame = { how: f.how, fov: Math.round(f.fov * 10) / 10, need: Math.round(f.need * 10) / 10, spread, cls: region.cls, W: region.W, H: region.H, eye: eye.toArray().map((v) => +v.toFixed(2)), yaw: +f.yaw.toFixed(3), pitch: +f.pitch.toFixed(3), region: [region.left, region.right, region.top, region.bottom], tries };
    return f;
  }
  const _dir = new THREE.Vector3(), _want = new THREE.Vector3();
  /** The camera has arrived at a framing (direction and lens), so the points are where they will stay. */
  function cameraSettled(f) {
    camera.getWorldDirection(_dir);
    _want.copy(f.look).sub(camera.position).normalize();
    return _dir.angleTo(_want) < 0.025 && Math.abs(camera.fov - player.lensFor(f.fov)) < 1;
  }

  // ---------------------------------------------------------------- revelation (verse first; Dalil explains after reading)
  async function revelation(key, anchorW, { eye, fov, motesDrop, g, side }) {
    D.verseActive = true;
    const p = player.state.position;
    const dx = anchorW.x - p.x, dz = anchorW.z - p.z, l = Math.hypot(dx, dz) || 1;
    const mark = new THREE.Vector3(p.x - (dx / l) * 1.2 - (dz / l) * 2 * side, 0, p.z - (dz / l) * 1.2 + (dx / l) * 2 * side);
    dalil.toMark(mark, anchorW);                // Dalil steps out of the frame first
    D.look = () => anchorW; D.fov = fov;
    player.state.eyeTarget = eye; player.state.lockedUntil = Infinity;
    await sleep(4, g);                          // environmental silence before the text
    dalil.presentVerse(anchorW);
    D.fov = fov * 0.98;                         // a 2% push over the whole reveal
    audio.recite(key);
    const proj = new THREE.Vector3();
    const anchor = () => { proj.copy(anchorW).project(camera); return { x: (proj.x * 0.5 + 0.5) * window.innerWidth, y: (-proj.y * 0.5 + 0.5) * window.innerHeight }; };
    motes.uniforms.uAnchor.value.copy(anchorW).add(new THREE.Vector3(0, motesDrop, 0));
    bus.emit(EV.PLAYER_REVEALED_VERSE, { key });
    const res = await revealVerse(key, {
      anchor, readable: ui.readable, explanation: EXPLAIN[key],
      hooks: {
        onWord: () => { motes.uniforms.uVerse.value = 1; },
        onReadDone: () => { bus.emit(EV.PLAYER_FINISHED_READING_VERSE, { key }); dalil.explainVerse(); },
      },
    });
    D.revealed.push(key);
    player.state.lockedUntil = 0; player.state.eyeTarget = 1.6;
    D.verseActive = false; motes.uniforms.uVerse.value = 0;
    dalil.follow();
    return res;
  }

  // ---------------------------------------------------------------- run
  const RUN = { arrival, current, rain, water: waterBeat, stream, meadow, light, final, peace };
  async function run(from = 'arrival') {
    const g = ++gen;
    try {
      for (const b of BEATS.slice(BEATS.indexOf(from))) { alive(g); await RUN[b](g); }
    } catch (e) { if (e !== CANCEL) console.error(e); }
  }
  function begin() { D.started = true; input.G.enabled = true; run('arrival'); }

  // ---------------------------------------------------------------- per frame: the world's continuous processes, the camera, audio
  function update(dt, t) {
    D.t = t; D.beatT += dt;
    D.onFrame?.(dt);
    // world weather
    if (D.gather) worldGather(D.gather.x, D.gather.z, D.gather.r, dt * SPEED, D.gather.rate, D.gather.target ?? 0.86);
    if (D.currentWind) {
      const c = phenomena.curve, q = new THREE.Vector3(), tg = new THREE.Vector3();
      for (let i = 0; i < 6; i++) { const u = ((t * 0.08 + i / 6) % 1); c.getPointAt(u, q); c.getTangentAt(u, tg); worldWind(q.x, q.z, tg.x * 5, tg.z * 5, 10, dt); }
    }
    if (D.wetFocus) worldWet(D.wetFocus.x, D.wetFocus.z, 7, dt * SPEED, reveal.s.pressed || reveal.s.assist ? 0.22 : 0.06);
    // the first water runs on by itself; its banks drink
    if (D.waterRun) {
      D.waterFront = Math.min(aTo() + 2, D.waterFront + D.waterRun * dt * SPEED);
      const q = water.pointAt(Math.max(D.waterFrom, D.waterFront - 3));
      worldWet(q.x, q.z, 4, dt * SPEED, 0.5);
    }
    if (D.waterFull) { D.waterFrom = Math.max(0, D.waterFrom - 6 * dt * SPEED); D.waterFront = Math.min(water.length, D.waterFront + 4 * dt * SPEED); }
    water.uniforms.uFrom.value = D.waterFrom; water.uniforms.uFront.value = D.waterFront;
    const still = D.waterStill ? 1 : 0;
    water.uniforms.uStill.value += (still - water.uniforms.uStill.value) * (1 - Math.exp(-dt * 1.2));
    water.uniforms.uGlow.value = water.uniforms.uStill.value;
    if (D.flowersOn) {
      flora.uniforms.uFlowers.value = Math.min(1, flora.uniforms.uFlowers.value + dt * 0.3 * SPEED);
      motes.uniforms.uPetals.value = Math.min(1, motes.uniforms.uPetals.value + dt * 0.25);
    }
    if (D.beat === 'meadow' && S.vegMeadow < 0.5 && D.beatT > 6) worldWet(M.x, M.z, M.r, dt * SPEED, 0.05); // the meadow is drinking the rain that reached it

    // camera: where attention is, and how far along the path
    if (D.look) { const l = D.look(); if (l) player.state.look = l.clone ? l.clone() : l; }
    if (D.rail) { const s = D.rail(); player.state.sMax = Math.max(player.state.sMax, s); player.state.sTarget = s; }
    player.state.fovTarget = D.fov;
    attention.update(dt);
    reveal.update(dt);
    if (input.G.active && input.G.active !== reveal) input.G.active.update?.(dt);

    // light and colour script
    const lookP = { intro: 0, arrival: 0, current: 0.35, rain: 1, water: 1.5 + 0.5 * smooth(0, 0.6, S.vegBasinHi), stream: 2, meadow: 2 + 0.9 * smooth(0.2, 0.6, S.vegMeadow), light: 3 + (D.lightOpen ? 1 : 0), final: 4, peace: 4 }[D.beat] ?? 0;
    updateLook(lookP, dt * Math.max(1, SPEED * 0.5) * (D.lightOpen ? 1.6 : 1));
    const lightTarget = D.lightOpen ? 1 : D.beat === 'light' ? 0.25 : 0;
    U.uLightPhase.value += (lightTarget - U.uLightPhase.value) * (1 - Math.exp(-dt * 0.9));
    motes.uniforms.uMotes.value += ((D.lightOpen ? 1 : 0) - motes.uniforms.uMotes.value) * (1 - Math.exp(-dt * 0.5));
    // exposure: a breath of brightness as the light breaks through, then it settles
    D.exposureKick *= Math.exp(-dt * 0.35);
    renderer.toneMappingExposure = 0.95 + 0.16 * D.exposureKick * smooth(0, 0.3, D.exposureKick) + (D.lightOpen ? 0.05 : 0);
    if (D.beat === 'peace') U.uGust.value += (0.25 - U.uGust.value) * dt * 0.3;

    // audio: the environment, attended to
    const cam = player.state.position;
    const tr = D.activeTrace?.s;
    const nearStream = Math.max(0, 1 - Math.abs(cam.x - channelX(cam.z)) / 25) * (D.waterFront > 0 ? 1 : 0);
    audio.update(dt, {
      wind: Math.min(1, 0.2 + S.windEnergy / 3 + (tr?.near ? 0.35 : 0) + (D.currentWind ? 0.15 : 0)), gust: D.envState < 2 ? 0.8 : 0.3,
      rain: Math.min(1, rainNear(cam.x, cam.z) * 0.8 + S.rainMax * 0.25),
      stream: nearStream, rustle: Math.min(1, S.vegBasinHi + S.vegMeadow) * Math.min(1, 0.3 + S.windEnergy / 3),
      birds: D.envState >= 3 ? 1 : 0, duck: D.verseActive,
    });
    hero.update(dt);
  }

  // ---------------------------------------------------------------- context engine (what Dalil's AI receives)
  function context() {
    const S2 = sim.stats;
    const state = [`${STATES[D.envState].en}.`, S2.rainMax > 0.1 ? 'Rain is falling.' : 'No rain now.', `Vegetation near the meadow ${Math.round(S2.vegMeadow * 100)}%.`, `Sunlight on the meadow ${Math.round(S2.sunMeadow * 100)}%.`].join(' ');
    const lastVerse = D.verseActive ? { key: D.beat === 'final' ? PROVISIONAL.verses.final : PROVISIONAL.verses.revival, shown: true } : D.revealed.length ? { key: D.revealed[D.revealed.length - 1], shown: true } : null;
    return { scene: SCENES[D.beat] || SCENES.arrival, state, interaction: D.interaction, verse: lastVerse, events: bus.recent(6).map((e) => e.type) };
  }

  // ---------------------------------------------------------------- jump to a beat (tests and the review menu); forward only
  const disk = (cx, cz, r) => (x, z) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
  function ff(beat) {
    if (D.verseActive || !BEATS.includes(beat)) return false;
    const target = BEATS.indexOf(beat);
    gen++; // cancel whatever is running
    input.setActive(null); reveal.end(); connect?.remove(); connect = null; D.onFrame = null; D.activeTrace = null;
    phenomena.state.current = 0; phenomena.state.knot = null; phenomena.state.splashOn = 0; phenomena.state.breakAt = null;
    D.started = true; input.G.enabled = true; D.currentWind = false; D.gather = null; D.wetFocus = null;
    const atLeast = (b) => target >= BEATS.indexOf(b);
    if (atLeast('rain')) {
      setField('am', (x, z, v) => Math.max(v, 0.55 * disk(rc.x, rc.z, rc.r)(x, z)));
      setField('cd', (x, z, v) => Math.max(v, 0.84 * disk(rc.x, rc.z, rc.r)(x, z)));
      ['ARRIVED', 'CURRENT_APPEARED', 'PLAYER_TRACED_WIND'].forEach((e) => bus.has(e) || bus.emit(e, { skipped: true }));
    }
    if (atLeast('water')) {
      setField('sm', (x, z, v) => Math.max(v, 0.55 * disk(rc.x, rc.z, rc.r * 0.9)(x, z)));
      setField('veg', (x, z, v) => Math.max(v, 0.35 * disk(rc.x, rc.z, rc.r * 0.8)(x, z)));
      sim.meadowWeather = true; enter(2);
      ['RAIN_BEGAN', 'PLAYER_REVEALED_SOIL'].forEach((e) => bus.has(e) || bus.emit(e, { skipped: true }));
    }
    if (atLeast('stream')) {
      D.waterFrom = aFrom(); D.waterFront = aTo() + 2; D.waterRun = 0;
      player.snapTo(railPoint('stream') - 2, null); player.state.look = null; player.update(1 / 60, D.t);
    }
    if (atLeast('meadow')) {
      if (!D.revealed.includes(PROVISIONAL.verses.revival)) D.revealed.push(PROVISIONAL.verses.revival);
      D.waterFull = true; sim.allowRain = true;
      setField('sm', (x, z, v) => Math.max(v, 0.45 * disk(M.x, M.z, M.r)(x, z)));
      setField('veg', (x, z, v) => Math.max(v, 0.42 * disk(M.x, M.z, M.r)(x, z)));
      setField('cd', (x, z, v) => Math.max(v, canopyAt(x, z) * 0.95));
    }
    if (atLeast('light')) {
      setField('veg', (x, z, v) => Math.max(v, 0.85 * disk(M.x, M.z, M.r * 1.3)(x, z)));
      setField('cd', (x, z) => canopyAt(x, z));
      enter(3); D.flowersOn = true;
      player.state.sMax = player.length; player.snapTo(railPoint('meadow'), meadowLook); player.update(1 / 60, D.t);
      hero.place(meadowComposition().flower); hero.bloom(true);
    }
    dalil.placeStart(); dalil.follow();
    run(beat);
    return true;
  }

  return { D, begin, update, ff, context, STATES, BEATS, get stateName() { return i18n.t(STATES[D.envState]); }, reveal, attention };
}
