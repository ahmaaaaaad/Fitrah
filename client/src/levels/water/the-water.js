// Fitrah · The Water — the first level. Loaded by the scene loader (src/shell),
// mounted once per page; leaving the level reloads the page into the menu, so the
// level's module state never needs tearing down.
// Reuses the engine core (renderer, post chain, adaptive resolution, frame loop),
// the DOM helpers, i18n and the bundled fonts.
import '../../fonts.css';
import './the-water.css';
import * as THREE from 'three';
import { scene, camera, renderer, start, onUpdate, cinematic, bloomPass, renderNow } from '../../core/scene.js';
import { i18n } from '../../core/i18n.js';
import { hintPointer } from '../../core/device.js';
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
import { createPhenomena } from './phenomena.js';
import { bus } from './events.js';

/**
 * Mount The Water (see LevelContext / LevelRuntime in ../registry.js).
 * @param {{ lang?: 'ar'|'en', fromMenu?: boolean, audioContext?: AudioContext|null, exit?: () => void }} ctx
 * @returns {{ begin: () => void, director: object, dalil: object }}
 */
export function mount({ lang, fromMenu = false, audioContext = null, pointerType = null, exit } = {}) {
  if (lang) i18n.set(lang);
  hintPointer(pointerType);
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
  const phenomena = createPhenomena(scene, camera, renderer);
  const player = createPlayer(camera);
  const ui = createUI();
  const audio = createAudio();
  const dalil = createDalil({ scene, camera, player, ui, renderer, phenomena });
  const input = createInput({
    canvas: renderer.domElement,
    getDalilScreen: () => dalil.screen(),
    onAsk: () => { if (director.D.started) dalil.openAsk(); },
    onMenu: () => ui.toggleMenu(),
    onWalk: (d) => { const s = player.state; if (s.lockedUntil > 0) return; s.sTarget = Math.min(s.sMax, Math.max(0, s.sTarget + d)); },
  });
  const director = createDirector({ player, dalil, input, ui, audio, water, flora, motes, camera, phenomena, scene });
  dalil.brain.context = director.context;

  // first frame: the player at the first mark; Dalil is already beside them
  player.snapTo(0, new THREE.Vector3(40, 10, -80));
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
      state: director.stateName, beat: director.D.beat,
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
      beat: director.D.beat, interaction: director.D.interaction, events: bus.recent(4).map((e) => e.type).join(' '),
    };
  };
  if (exit) ui.cb.onExit = () => { ui.toggleMenu(false); exit(); };
  document.documentElement.lang = i18n.lang; document.documentElement.dir = i18n.dir;
  // From the menu, the player's click already unlocked sound and the shell calls
  // begin() as its veil lifts. Opened directly, the level asks for that gesture itself.
  let begun = false;
  const begin = () => { if (begun) return; begun = true; audio.start(audioContext); director.begin(); };
  if (!fromMenu) ui.mountStart(begin);

  let fps = 60;
  start(document.getElementById('stage'));
  onUpdate((dt, t) => {
    fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
    U.uTime.value = t;
    input.update(dt, t);
    if (!paused) { updateSim(dt); director.update(dt, t); }
    player.state.parallaxTarget.copy(input.G.active ? { x: 0, y: 0 } : input.parallax);
    player.update(dt, t);
    dalil.update(dt * Math.max(1, SPEED * 0.75), t); // ?speed hurries Dalil too, for review
    sky.update(dt, camera);
    rain.update();
    motes.update(dt, camera, renderer);
    phenomena.update(dt);
    terrain.uniforms.uFlow.value += ((water.uniforms.uFront.value > 1 ? 1 : 0) - terrain.uniforms.uFlow.value) * dt * 0.3;
    ui.update();
  });

  // hooks for headless tests and review tooling
  window.revival = window.fitrahLevel = {
    director, sim, player, dalil, input, ui, flora, water, sky, phenomena, bus, PROVISIONAL, CONFIG, DEBUG, heightAt, camera,
    ff: (k) => director.ff(k),
    // a clean frame of the world (no interface), e.g. for the menu's still
    capture: (type = 'image/jpeg', q = 0.9) => { renderNow(); return renderer.domElement.toDataURL(type, q); },
    begin: () => { if (document.querySelector('.start button')) document.querySelector('.start button').click(); else begin(); },
    stats: () => ({ beat: director.D.beat, env: director.D.envState, dalil: dalil.state, interaction: director.D.interaction, rainMax: sim.stats.rainMax, vegBasinHi: sim.stats.vegBasinHi, vegMeadow: sim.stats.vegMeadow, sunMeadow: sim.stats.sunMeadow, cdMeadow: sim.stats.cdMeadow, front: director.D.waterFront, events: bus.recent(3).map((e) => e.type), ai: dalil.aiStatus.last }),
  };
  return { begin, director, dalil };
}
