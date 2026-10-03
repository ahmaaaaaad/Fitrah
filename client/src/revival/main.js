// Fitrah · The Revival — vertical-slice prototype entry.
// Reuses the engine core (renderer, post chain, adaptive resolution, frame loop),
// the DOM helpers, i18n and the bundled fonts from the World 1 build.
import '../fonts.css';
import './revival.css';
import * as THREE from 'three';
import { scene, camera, renderer, start, onUpdate, cinematic, bloomPass } from '../core/scene.js';
import { i18n } from '../core/i18n.js';
import { CONFIG, PROVISIONAL, DEBUG, SPEED, QUALITY } from './config.js';
import { U } from './look.js';
import { sim, updateSim } from './sim.js';
import { createTerrain, heightAt } from './terrain.js';
import { createSky } from './sky.js';
import { createFlora } from './flora.js';
import { createWater } from './water.js';
import { createRain } from './rain.js';
import { createMotes } from './motes.js';
import { createPlayer } from './player.js';
import { createInput } from './input.js';
import { createDalil } from './dalil/brain.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { createDirector } from './director.js';

// look of this world
renderer.toneMappingExposure = 0.95;
cinematic.uniforms.uVignette.value = 0.62;
cinematic.uniforms.uGrain.value = 0.022;
cinematic.uniforms.uCA.value = 0.001;
bloomPass.threshold = 0.85; bloomPass.strength = 0.55; bloomPass.radius = 0.5;
camera.far = 5000; camera.near = 0.08; camera.updateProjectionMatrix();

const terrain = createTerrain(scene);
const sky = createSky(scene);
const flora = createFlora(scene);
const water = createWater(scene);
const rain = createRain(scene);
const motes = createMotes(scene);
const player = createPlayer(camera);
const ui = createUI();
const audio = createAudio();
let director = null;
const dalil = createDalil({ scene, camera, player, ui, renderer });
const input = createInput({
  canvas: renderer.domElement, camera,
  getDalilScreen: () => dalil.screen(),
  partEnabled: () => director?.D.phase === 'light',
  onAsk: () => { if (director?.D.started) dalil.openAsk(); },
  onMenu: () => ui.toggleMenu(),
  onWalk: (d) => { const s = player.state; if (s.lockedUntil > 0) return; s.sTarget = Math.min(s.sMax, Math.max(0, s.sTarget + d)); if (Math.abs(d) > 0) s.look = null; },
});
director = createDirector({ player, dalil, input, ui, audio, water, flora, motes, camera });
dalil.brain.contextText = director.contextText;

// first frame: the player at the first mark, Dalil a dim ember in the soil
player.snapTo(0, new THREE.Vector3(8, 22, 22));
player.update(1 / 60, 0);
dalil.placeStart();

let paused = false;
ui.cb.onLang = (l) => i18n.set(l);
ui.cb.onSound = (on) => audio.setEnabled(on);
ui.cb.onJump = (k) => director.ff(k);
ui.cb.onPause = (p) => { paused = p; };
ui.cb.getStatus = (full) => {
  const S = sim.stats;
  const base = {
    state: director.stateName, phase: director.D.phase,
    'dalil state': dalil.state,
    'ai adapter': dalil.aiStatus.adapter, 'ai last': dalil.aiStatus.last,
    'artifact runtime': dalil.aiStatus.artifact, 'server route': dalil.aiStatus.server,
    'final verse': `${PROVISIONAL.verses.final} (provisional)`,
    'music bus': PROVISIONAL.audio.music.enabled ? 'enabled' : 'disabled (pending review)',
    quality: QUALITY,
  };
  if (!full) return base;
  return {
    ...base, fps: fps.toFixed(0), speed: SPEED,
    amBasin: S.amBasin.toFixed(2), cdMax: S.cdMax.toFixed(2), ripeness: S.ripeness.toFixed(2), rainMax: S.rainMax.toFixed(2),
    smBasinHi: S.smBasinHi.toFixed(2), vegBasinHi: S.vegBasinHi.toFixed(2), waterFlow: sim.waterFlow.toFixed(2),
    vegMeadow: S.vegMeadow.toFixed(2), sunMeadow: S.sunMeadow.toFixed(2), wind: S.windEnergy.toFixed(2),
    gesture: `${input.G.type} / ${input.G.region}`, rainSustained: director.D.rainSustained.toFixed(1),
  };
};
ui.mountStart(() => { audio.start(); director.begin(); });
document.documentElement.lang = i18n.lang; document.documentElement.dir = i18n.dir;

let fps = 60;
start(document.getElementById('stage'));
onUpdate((dt, t) => {
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
  U.uTime.value = t;
  input.update(dt, t);
  if (!paused) { updateSim(dt); director.update(dt, t); }
  dalil.brain.phase = director.suggestPhase();
  player.state.parallaxTarget.copy(input.parallax);
  player.update(dt, t);
  dalil.update(dt, t);
  sky.update(dt, camera);
  rain.update();
  motes.update(dt, camera, renderer);
  terrain.uniforms.uFlow.value = water.uniforms.uFill.value > 0.05 ? Math.min(1, water.uniforms.uFill.value * 1.5) : 0;
  ui.update();
});

// hooks for headless tests and review tooling
window.revival = {
  director, sim, player, dalil, input, ui, flora, water, sky, PROVISIONAL, CONFIG, DEBUG, heightAt, camera,
  ff: (k) => director.ff(k),
  begin: () => { document.querySelector('.start button')?.click(); },
  stats: () => ({ ...sim.stats, waterFlow: sim.waterFlow, waterFill: sim.waterFill, phase: director.D.phase, env: director.D.envState, dalil: dalil.state, ai: { ...dalil.aiStatus } }),
};
