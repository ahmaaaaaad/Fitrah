// The director: derives the six environmental states from the simulation
// (they only move forward), runs the beats of the slice, places the camera's
// look, choreographs Dalil around the revelations, and offers fast-forward
// hooks for tests and the review jump menu.
//
//   gesture -> wind -> clouds ripen -> rain -> soil -> grass -> stream
//   -> revelation 1 (56:68-70, over the stream) -> meadow rain -> flowers
//   -> parting the clouds (light balance) -> harmony
//   -> revelation 2 (PROVISIONAL: 57:17, alternative 30:50) -> peace
import * as THREE from 'three';
import { CONFIG, PROVISIONAL, SPEED } from './config.js';
import { U, updateLook } from './look.js';
import { sim, setField, canopyAt, rainNear, openClouds, exposureNow } from './sim.js';
import { heightAt, channelX, waterY, M } from './terrain.js';
import { revealVerse } from './verse.js';
import { i18n } from '../core/i18n.js';

export const STATES = [
  { ar: 'سكون', en: 'Dormant' }, { ar: 'أولى العلامات', en: 'First signs' }, { ar: 'الإحياء', en: 'Revival' },
  { ar: 'الازدهار', en: 'Flourishing' }, { ar: 'الانسجام', en: 'Harmony' }, { ar: 'السكينة', en: 'Peace' },
];
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export function createDirector({ player, dalil, input, ui, audio, water, flora, motes, camera }) {
  const D = {
    phase: 'intro', envState: 0, t: 0, phaseT: 0,
    rainSustained: 0, firstRainT: null, grassT: null, inBand: 0, verseActive: false,
    revealed: [], lastProgressT: 0, best: {}, started: false, lightTouched: false,
    look: new THREE.Vector3(), lookBlend: 0, rainCentroid: new THREE.Vector3(10, 0, 40),
  };
  const S = sim.stats;
  const P0 = player.pointAt(0);
  const gatherLook = new THREE.Vector3(8, 22, 22);
  const meadowLook = new THREE.Vector3(M.x + 8, heightAt(M.x + 8, M.z - 8) + 9, M.z - 8); // meadow below, canopy above

  function setPhase(p) { if (D.phase !== p) { D.phase = p; D.phaseT = 0; D.lastProgressT = D.t; } }
  function enter(state) {
    if (state <= D.envState) return;
    D.envState = state;
    ui.live({ ar: `حالة الوادي: ${STATES[state].ar}`, en: `The valley: ${STATES[state].en}` });
  }
  function progress(key, value, margin = 0.04) {
    if (value > (D.best[key] ?? -1) + margin) { D.best[key] = value; D.lastProgressT = D.t; }
  }

  // ---------------------------------------------------------------- begin
  function begin() {
    D.started = true;
    input.G.enabled = true;
    setPhase('gather');
    player.state.look = gatherLook.clone();
  }

  // ---------------------------------------------------------------- the rain's centre (where the eye should go)
  function updateRainCentroid() {
    const { rain, veg } = sim.arrays, N = sim.N, C = sim.CELL, H = sim.HALF;
    let sx = 0, sz = 0, sw = 0;
    const field = D.phase === 'revival' ? veg : rain;
    for (let j = 0; j < N; j += 2) for (let i = 0; i < N; i += 2) {
      const w = field[j * N + i];
      if (w > 0.1) { sx += (-H + (i + 0.5) * C) * w; sz += (-H + (j + 0.5) * C) * w; sw += w; }
    }
    if (sw > 0.5) D.rainCentroid.lerp(new THREE.Vector3(sx / sw, 0, sz / sw), 0.2);
  }

  // ---------------------------------------------------------------- revelation choreography
  async function revelation(key, { anchorWorld, markWorld, eye = 1.6, fov = 38, kind }) {
    D.verseActive = true;
    // Dalil leaves the frame first; the camera locks 4 s before the text
    dalil.toMark(markWorld, anchorWorld);
    player.state.look = anchorWorld.clone();
    player.state.eyeTarget = eye; player.state.fovTarget = fov;
    player.state.lockedUntil = Infinity;
    await wait(4 / SPEED);
    dalil.presentVerse(anchorWorld);
    player.state.fovTarget = fov * 0.98; // a 2% push over the whole reveal
    audio.recite(key);
    const proj = new THREE.Vector3();
    const anchor = () => {
      proj.copy(anchorWorld).project(camera);
      return { x: (proj.x * 0.5 + 0.5) * window.innerWidth, y: (-proj.y * 0.5 + 0.5) * window.innerHeight };
    };
    motes.uniforms.uAnchor.value.copy(anchorWorld).add(new THREE.Vector3(0, kind === 'water' ? -1.4 : -2.5, 0));
    const res = await revealVerse(key, {
      anchor, readable: ui.readable,
      hooks: { onWord: () => { motes.uniforms.uVerse.value = 1; } },
    });
    D.revealed.push(key);
    player.state.lockedUntil = 0; player.state.eyeTarget = 1.6; player.state.fovTarget = 38;
    D.verseActive = false;
    motes.uniforms.uVerse.value = 0;
    if (res.shown) {
      // one authored reflection after the revelation, when the player moves on
      setTimeout(() => dalil.reflect(kind), 1200 / SPEED);
    }
    return res;
  }
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

  // ---------------------------------------------------------------- per frame
  function update(dt, t) {
    D.t = t; D.phaseT += dt;
    const G = input.G;
    updateRainCentroid();

    // wake Dalil on the first gesture, or after 45 s
    if (D.started && dalil.state === 'DORMANT' && (G.firstGestureT !== null || D.phaseT > 45)) dalil.wake();

    // environmental events → Dalil (most stay silent)
    if (S.cdMax > 0.42 && !D.best.cloudSeen) { D.best.cloudSeen = 1; dalil.onEnv('firstCloud'); }
    if (S.ripeness > 0.45 && S.rainMax < 0.05 && D.phase === 'gather') { D.ripeT = (D.ripeT || 0) + dt; if (D.ripeT > 4) dalil.onEnv('ripening'); }
    if (S.rainMax > 0.15 && D.firstRainT === null) { D.firstRainT = t; dalil.onEnv('rainStart'); enter(1); ui.live({ ar: 'بدأ المطر', en: 'Rain begins' }); }
    if (S.rainMax > 0.3) D.rainSustained += dt * SPEED;
    if (S.amBasin >= 0.25 || S.cdMax >= 0.35) enter(1);

    let lookP = 0;
    switch (D.phase) {
      case 'intro':
        player.state.look = gatherLook.clone();
        break;
      case 'gather': {
        progress('cd', S.cdMax); progress('rain', S.rainMax, 0.1); progress('sm', S.smBasinHi, 0.03);
        lookP = Math.min(1, S.rainMax * 2) * 0.8;
        if (D.firstRainT !== null) {
          // eye follows the rain down to the ground
          const c = D.rainCentroid, gy = heightAt(c.x, c.z);
          const k = smooth(0, 6, t - D.firstRainT);
          player.state.look.lerpVectors(gatherLook, new THREE.Vector3(c.x, gy + CONFIG.cloudHeight * 0.38, c.z), k * 0.85);
        }
        // hints for the gesture
        if (G.firstGestureT === null && D.phaseT > 5) ui.hint(G.keyboard ? { ar: 'الأسهم تحرّك البؤرة · اضغط المسافة مطوّلًا لتسوق الهواء', en: 'Arrows move the focus · hold Space to sweep the air' } : matchMedia('(pointer: coarse)').matches ? { ar: 'اسحب بإصبعك عبر السماء', en: 'Drag across the sky with one finger' } : { ar: 'اضغط واسحب عبر السماء', en: 'Press and sweep across the sky' });
        else if (G.strokes > 2 || D.firstRainT !== null) ui.hint(null);
        if (G.scatters > 0.6 && !D.best.scatterHint) { D.best.scatterHint = 1; ui.flash({ ar: 'برفق — الإسراع يمزّق السحاب', en: 'Gently — too fast tears the clouds' }); }
        if (S.smBasinHi >= 0.3 && D.rainSustained >= 20) { enter(2); setPhase('revival'); }
        stall(G.scatters > 0.5 ? 'scatter' : S.ripeness > 0.4 ? 'wait' : 'gather', gatherLook);
        break;
      }
      case 'revival': {
        lookP = 1.4 + 0.6 * Math.min(1, S.vegBasinHi / 0.6);
        progress('veg', S.vegBasinHi); progress('wf', sim.waterFlow, 0.03);
        if (S.vegBasinHi > 0.15 && D.grassT === null) {
          D.grassT = t;
          const c = D.rainCentroid.clone(); c.y = heightAt(c.x, c.z);
          dalil.onEnv('firstGrass', { at: c });
        }
        // look at the new growth, then along the way to the water
        const c = D.rainCentroid;
        if (D.phaseT < 5) player.state.look = new THREE.Vector3(c.x, heightAt(c.x, c.z) + 2.5, c.z);
        if (sim.waterFill > 0.3 && !D.best.streamSeen) { D.best.streamSeen = 1; dalil.onEnv('stream'); }
        // after a moment with the new growth, the rail opens: walk into the revival, down to the water
        if (D.phaseT > 5 && player.state.sTarget < player.marks.stream) {
          player.state.sMax = Math.max(player.state.sMax, player.marks.stream);
          player.state.sTarget = player.marks.stream; player.state.look = null; player.state.lookPitch = -0.08;
        }
        const atStream = Math.abs(player.state.s - player.marks.stream) < 1.2;
        if (atStream && !D.verseActive) {
          const ahead = streamAnchor();
          player.state.look = ahead.clone().add(new THREE.Vector3(0, -1.2, 0));
          if (sim.waterFill >= 0.6) startStreamReveal();
        }
        stall(S.rainMax < 0.05 ? 'gather' : 'wait', D.rainCentroid);
        break;
      }
      case 'streamReveal': lookP = 2; break;
      case 'toMeadow': {
        lookP = 2 + 0.6 * Math.min(1, S.vegMeadow / 0.55);
        progress('vegM', S.vegMeadow, 0.03);
        const atMeadow = Math.abs(player.state.s - player.marks.meadow) < 1.5;
        if (atMeadow) { player.state.look = meadowLook.clone(); player.state.fovTarget = 53; }
        if (S.vegMeadow >= 0.55) {
          enter(3); setPhase('light');
          flora.uniforms.uFlowers.value = 0.001; dalil.onEnv('flowers');
          sim.canopy = true;
        }
        stall('walk', meadowLook);
        break;
      }
      case 'light': {
        const Sx = S.sunMeadow;
        lookP = 3 + 0.8 * smooth(0.1, 0.65, Sx);
        player.state.look = meadowLook.clone(); player.state.fovTarget = 53;
        flora.uniforms.uFlowers.value = Math.min(1, flora.uniforms.uFlowers.value + dt * 0.25 * SPEED);
        motes.uniforms.uPetals.value = Math.min(1, motes.uniforms.uPetals.value + dt * 0.3);
        if (input.G.parts > 0) D.lightTouched = true;
        if (D.phaseT > 4 && !D.lightTouched) ui.hint(G.keyboard ? { ar: 'وجّه البؤرة إلى سحابة واضغط Enter مطوّلًا', en: 'Point the focus at a cloud and hold Enter' } : { ar: 'اضغط داخل سحابة واسحب إلى الخارج', en: 'Press inside a cloud and draw outward' });
        else if (D.lightTouched) ui.hint(null);
        if (Sx > 0.2 && !D.best.shaft) { D.best.shaft = 1; dalil.onEnv('firstShaft', { at: poolNear() }); }
        U.uDroop.value += (smooth(0.75, 0.92, Sx) - U.uDroop.value) * (1 - Math.exp(-dt * 1.5));
        const inBand = Sx >= CONFIG.lightBand[0] && Sx <= CONFIG.lightBand[1];
        D.inBand = inBand ? D.inBand + dt * SPEED : 0;
        progress('sun', Math.min(Sx, 1.5 - Sx), 0.03);
        if (D.inBand >= CONFIG.harmonyHold) { enter(4); setPhase('harmony'); sim.frozen = true; dalil.onEnv('harmony'); ui.hint(null); startFinalReveal(); }
        else if (Sx > 0.78 && D.phaseT > 8) stall('bright', null, 6);
        else stall('dim', meadowLook);
        break;
      }
      case 'harmony': lookP = 4; break;
      case 'peace': lookP = 4; break;
      default: break;
    }
    // light: the colour script, the sun in the gaps, the motes of harmony
    if (D.phase === 'harmony' || D.phase === 'peace') {
      U.uLightPhase.value += (1 - U.uLightPhase.value) * (1 - Math.exp(-dt * 0.8));
      motes.uniforms.uMotes.value = Math.min(1, motes.uniforms.uMotes.value + dt * 0.4);
      U.uDroop.value *= Math.exp(-dt);
    } else if (D.phase === 'light') {
      U.uLightPhase.value += (smooth(0.12, 0.6, S.sunMeadow) * 0.85 - U.uLightPhase.value) * (1 - Math.exp(-dt * 1.2));
      motes.uniforms.uMotes.value += (smooth(0.4, 0.7, S.sunMeadow) * 0.6 - motes.uniforms.uMotes.value) * dt;
    }
    if (D.phase === 'peace') { U.uGust.value += (0.25 - U.uGust.value) * dt * 0.3; }
    updateLook(lookP, dt * Math.max(1, SPEED * 0.5));
    // the stream fills from its source downhill: at waterFlow 0.6 it has reached the stream mark
    const markAlong = water.alongAt(CONFIG.rail[CONFIG.marks.stream][1]) + 18;
    const fillTarget = sim.waterFill < 0.6 ? (sim.waterFill / 0.6) * (markAlong / water.length) : markAlong / water.length + (sim.waterFill - 0.6) / 0.4 * (1 - markAlong / water.length);
    water.uniforms.uFill.value += (Math.min(1, fillTarget) - water.uniforms.uFill.value) * (1 - Math.exp(-dt * 0.8));

    // audio mix
    const cam = player.state.position;
    const nearStream = Math.max(0, 1 - Math.abs(cam.x - channelX(cam.z)) / 30) * water.uniforms.uFill.value;
    audio.update(dt, {
      wind: Math.min(1, 0.2 + S.windEnergy / 3), gust: D.envState < 2 ? 0.8 : 0.3,
      rain: Math.min(1, rainNear(cam.x, cam.z) * 0.8 + S.rainMax * 0.25),
      stream: nearStream, rustle: Math.min(1, S.vegBasinHi + S.vegMeadow) * Math.min(1, 0.3 + S.windEnergy / 3),
      birds: D.envState >= 3 ? 1 : 0, duck: D.verseActive,
    });
  }

  // a stalled phase: one observation, only after 25 s without progress
  function stall(kind, toward, after = CONFIG.dalil.stallSeconds) {
    if (D.t - D.lastProgressT > after / Math.max(1, SPEED) && !D.verseActive) {
      dalil.guide(kind, toward ? toward.clone() : null);
      D.lastProgressT = D.t; // at most one observation per stall
    }
  }
  function markBeside(anchorW, side) {
    const p = player.state.position;
    const dx = anchorW.x - p.x, dz = anchorW.z - p.z, l = Math.hypot(dx, dz) || 1;
    const fx = dx / l, fz = dz / l;
    return new THREE.Vector3(p.x - fx * 1.2 - fz * 2.0 * side, 0, p.z - fz * 1.2 + fx * 2.0 * side);
  }
  function streamAnchor() {
    const z = CONFIG.rail[CONFIG.marks.stream][1] - 6;
    return new THREE.Vector3(channelX(z), waterY(z) + 2.4, z);
  }
  function poolNear() {
    const p = player.state.position, { sun } = sim.arrays, N = sim.N, C = sim.CELL, H = sim.HALF;
    let best = null, bd = 1e9;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (sun[j * N + i] < 0.7) continue;
      const x = -H + (i + 0.5) * C, z = -H + (j + 0.5) * C;
      if (Math.hypot(x - M.x, z - M.z) > M.r) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bd && d > 3) { bd = d; best = new THREE.Vector3(x, heightAt(x, z), z); }
    }
    return best && bd < 22 ? best : null;
  }

  async function startStreamReveal() {
    if (D.phase !== 'revival') return;
    setPhase('streamReveal');
    sim.allowRain = false; // the rain thins to a trickle
    water.uniforms.uStill.value = 0;
    const anchorW = streamAnchor();
    const mark = markBeside(anchorW, 1); // beside and behind the final view: out of the frame
    const still = { v: 0 };
    const stillTick = setInterval(() => { still.v = Math.min(1, still.v + 0.05); water.uniforms.uStill.value = still.v; water.uniforms.uGlow.value = still.v; }, 100);
    await revelation(PROVISIONAL.verses.revival, { anchorWorld: anchorW, markWorld: mark, eye: 1.2, fov: 38, kind: 'water' });
    clearInterval(stillTick);
    const fade = setInterval(() => { water.uniforms.uStill.value *= 0.9; water.uniforms.uGlow.value *= 0.9; if (water.uniforms.uGlow.value < 0.01) { water.uniforms.uStill.value = 0; water.uniforms.uGlow.value = 0; clearInterval(fade); } }, 100);
    sim.allowRain = true;
    // the weather moves over the meadow; the rail opens to it
    sim.meadowWeather = true;
    player.state.sMax = player.length; player.state.sTarget = player.marks.meadow;
    player.state.look = null; player.state.lookPitch = 0.08;
    setPhase('toMeadow');
  }
  async function startFinalReveal() {
    const gy = heightAt(M.x, M.z);
    const anchorW = new THREE.Vector3(M.x - 4, gy + 11, M.z + 6);
    const mark = markBeside(anchorW, -1);
    await wait(2 / SPEED);
    await revelation(PROVISIONAL.verses.final, { anchorWorld: anchorW, markWorld: mark, eye: 1.6, fov: 50, kind: 'final' });
    enter(5); setPhase('peace');
    player.state.look = meadowLook.clone(); player.state.fovTarget = 53;
    setTimeout(() => { dalil.complete(); }, 9000 / SPEED);
    setTimeout(() => ui.endCard({ onReplay: () => location.reload() }), 12000 / SPEED);
  }

  // ---------------------------------------------------------------- fast-forward (tests and the review jump menu)
  const disk = (cx, cz, r) => (x, z) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
  function ff(target) {
    if (D.verseActive) return false;
    dalil.wake();
    input.G.enabled = true; D.started = true;
    const B = { x: 10, z: 40 };
    const g = disk(B.x, B.z, 16);
    if (['rain', 'revival', 'stream', 'meadow', 'light', 'harmony'].includes(target)) {
      setField('am', (x, z, v) => Math.max(v, 0.6 * g(x, z)));
      setField('cd', (x, z, v) => Math.max(v, 0.82 * g(x, z)));
      setField('rt', (x, z, v) => (g(x, z) > 0.3 ? 20 : v));
      if (D.firstRainT === null) D.firstRainT = D.t;
      setPhase('gather');
    }
    if (['revival', 'stream', 'meadow', 'light', 'harmony'].includes(target)) {
      setField('sm', (x, z, v) => Math.max(v, 0.6 * disk(B.x, B.z, 24)(x, z)));
      setField('veg', (x, z, v) => Math.max(v, 0.5 * disk(B.x, B.z, 22)(x, z)));
      D.rainSustained = 25; sim.waterFlow = Math.max(sim.waterFlow, 0.34); sim.waterFill = Math.max(sim.waterFill, 0.34);
      enter(2); setPhase('revival');
    }
    if (['stream', 'meadow', 'light', 'harmony'].includes(target)) {
      sim.waterFlow = sim.waterFill = Math.max(sim.waterFill, 0.62);
      player.snapTo(player.marks.stream - 0.2, streamAnchor());
    }
    if (['meadow', 'light', 'harmony'].includes(target)) {
      if (!D.revealed.includes(PROVISIONAL.verses.revival)) D.revealed.push(PROVISIONAL.verses.revival);
      sim.waterFlow = sim.waterFill = 1; sim.meadowWeather = true;
      setField('sm', (x, z, v) => Math.max(v, 0.45 * disk(M.x, M.z, M.r)(x, z)));
      setField('veg', (x, z, v) => Math.max(v, 0.3 * disk(M.x, M.z, M.r)(x, z)));
      player.state.sMax = player.length;
      player.snapTo(player.marks.meadow, meadowLook);
      setPhase('toMeadow');
    }
    if (['light', 'harmony'].includes(target)) {
      setField('sm', (x, z, v) => Math.max(v, 0.6 * disk(M.x, M.z, M.r * 1.3)(x, z)));
      setField('veg', (x, z, v) => Math.max(v, 0.85 * disk(M.x, M.z, M.r * 1.3)(x, z)));
      setField('cd', (x, z) => canopyAt(x, z));
      sim.canopy = true;
      setField('am', (x, z, v) => Math.max(v, 0.5 * canopyAt(x, z)));
      enter(3);
    }
    if (target === 'harmony') {
      // open the canopy toward the sun so the meadow sits inside the light band
      const ox = M.x + sim.OFF.x, oz = M.z + sim.OFF.z;
      // find the opening that puts the meadow in the middle of the light band
      const base = Float32Array.from(sim.arrays.cd), trial = new Float32Array(base.length);
      const N = sim.N, C = sim.CELL, H = sim.HALF;
      const apply = (k, out) => { for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -H + (i + 0.5) * C, z = -H + (j + 0.5) * C; out[j * N + i] = base[j * N + i] * (1 - k * Math.exp(-((x - ox) ** 2 + (z - oz) ** 2) / (34 * 34))); } };
      let lo = 0, hi = 1;
      for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; apply(m, trial); if (exposureNow(trial) < 0.65) lo = m; else hi = m; }
      apply((lo + hi) / 2, trial);
      setField('cd', (x, z, v) => trial[Math.round((z + H) / C - 0.5) * N + Math.round((x + H) / C - 0.5)] ?? v);
      setField('opened', () => 0);
      input.G.parts++;
    }
    return true;
  }

  function contextText() {
    const parts = [`Environmental state: ${STATES[D.envState].en}.`];
    if (D.phase === 'gather') parts.push(S.rainMax > 0.1 ? 'Rain is falling over the basin.' : S.ripeness > 0.3 ? 'A cloud is gathering and growing heavy; rain has not started.' : 'The air is dry; the player is learning to gather it.');
    if (D.phase === 'revival') parts.push('Grass is emerging; the stream is forming.');
    if (D.phase === 'toMeadow') parts.push('Rain is moving over the meadow.');
    if (D.phase === 'light') parts.push(`The player is parting the clouds; sunlight on the meadow is ${Math.round(S.sunMeadow * 100)}% (balanced between 55% and 75%).`);
    if (D.phase === 'peace' || D.phase === 'harmony') parts.push('The meadow is in balance, warm and alive.');
    if (input.G.type) parts.push(`Player gesture: ${input.G.type} over the ${input.G.region}.`);
    parts.push(`Revelations shown: ${D.revealed.length ? D.revealed.join(', ') : 'none'}.`);
    return parts.join(' ');
  }
  function suggestPhase() {
    if (D.phase === 'peace' || D.phase === 'harmony') return 'peace';
    if (D.phase === 'light') return 'light';
    if (D.revealed.length) return 'afterWater';
    if (D.phase === 'revival') return 'revival';
    if (D.started && input.G.firstGestureT !== null) return 'gather';
    return 'start';
  }

  return { D, begin, update, ff, contextText, suggestPhase, STATES, get stateName() { return i18n.t(STATES[D.envState]); }, P0 };
}
