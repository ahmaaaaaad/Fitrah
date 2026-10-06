// Fitrah · The Four Questions — the guided level. Loaded by the scene loader
// (src/shell) when the player chooses "Fitrah" in the menu; leaving reloads the
// page into the menu, so nothing here needs tearing down.
// It reuses the engine core (renderer, post chain, adaptive resolution, frame
// loop), the device and framing helpers, the sacred-content modules, Dalil's AI
// adapters and the "Talk to someone" panel shared with every level.
import '../../fonts.css';
import './the-four-questions.css';
import * as THREE from 'three';
import { scene, camera, renderer, start, onUpdate, cinematic, bloomPass, renderNow } from '../../core/scene.js';
import { i18n } from '../../core/i18n.js';
import { hintPointer } from '../../core/device.js';
import { openTalk, talkStatus } from '../../core/help/talk.js';
import { trackFps } from '../../core/analytics.js';
import { createChamber } from './chamber.js';
import { createCameraRig } from './camera.js';
import { createDalil } from './dalil.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { createDirector, STEPS } from './director.js';
import { C } from './content.js';
import { DEBUG, SPEED, QUALITY, PROVISIONAL } from './config.js';

/**
 * Mount the Fitrah level (see LevelContext / LevelRuntime in ../registry.js).
 * @param {{ lang?: 'ar'|'en', fromMenu?: boolean, audioContext?: AudioContext|null, pointerType?: string|null, exit?: (o?: {to?: string}) => void }} ctx
 */
export function mount({ lang, fromMenu = false, audioContext = null, pointerType = null, exit } = {}) {
  if (lang) i18n.set(lang);
  hintPointer(pointerType);
  // the look of the chamber
  renderer.toneMappingExposure = 0.85;
  cinematic.uniforms.uVignette.value = 0.72;
  cinematic.uniforms.uGrain.value = 0.03;
  cinematic.uniforms.uCA.value = 0.0012;
  bloomPass.threshold = 0.72; bloomPass.strength = 0.6; bloomPass.radius = 0.5;
  camera.near = 0.08; camera.far = 600; camera.updateProjectionMatrix();

  const chamber = createChamber(scene);
  const rig = createCameraRig(camera);
  const ui = createUI({ camera });
  const audio = createAudio();
  const dalil = createDalil({ scene, camera, ui, audio, rig });
  const talk = (o = {}) => openTalk(o);
  const director = createDirector({ scene, camera, chamber, rig, dalil, ui, audio, exit, talk });
  dalil.bind({ context: director.context, suggestions: director.suggestions, talk });

  // first frame: the dark hall, the camera at the player's place, Dalil already beside them (unlit)
  // first frame: the vast hall from high and far behind, the small figure before the aperture
  chamber.snap('arrive');
  chamber.setPlayerSide(i18n.dir === 'rtl' ? -1 : 1);
  i18n.onChange(() => chamber.setPlayerSide(i18n.dir === 'rtl' ? -1 : 1));
  rig.shot('establish', { snap: true });
  const fitQ = () => chamber.fitQuestions(window.innerWidth / Math.max(1, window.innerHeight));
  fitQ(); window.addEventListener('resize', fitQ);
  rig.update(1 / 60, 0);
  dalil.place(new THREE.Vector3(0.6, 1.3, 1.2)); // far ahead, by the centre: he walks to the player once the story begins

  ui.cb.onLang = (l) => i18n.set(l);
  ui.cb.onDepth = (d) => director.setDepth(d);
  ui.cb.onSound = (on) => audio.setEnabled(on);
  ui.cb.onJump = (k) => director.ff(k);
  ui.cb.onAsk = () => dalil.openAsk();
  ui.cb.onTalk = () => talk({});
  if (exit) ui.cb.onExit = () => { ui.toggleMenu(false); exit({ to: 'menu' }); };
  ui.cb.getStatus = (full) => {
    const s = {
      beat: director.D.step || 'not started', depth: director.D.depth,
      'dalil state': dalil.state, 'ai adapter': dalil.aiStatus.adapter, 'ai last': dalil.aiStatus.last,
      'artifact runtime': dalil.aiStatus.artifact, 'server route': dalil.aiStatus.server,
      'talk to someone': talkStatus(), sources: 'pending Sharia review', music: PROVISIONAL.audio.music ? 'on' : 'none', quality: QUALITY,
    };
    if (!full) return s;
    return { ...s, fps: fps.toFixed(0), speed: SPEED, state: chamber.P.name, layout: chamber.layout, shot: rig.name, linked: director.chain?.s.linked ?? '-', events: director.D.events.join(' ') };
  };
  ui.setDepth(director.D.depth);
  document.documentElement.lang = i18n.lang; document.documentElement.dir = i18n.dir;

  // ------------------------------------------------------------ input: the chain first, then the invited light, then Dalil
  const canvas = renderer.domElement;
  let down = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (!director.D.started) return;
    down = true;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not all pointers can be captured */ }
    const x = e.clientX, y = e.clientY, ch = director.chain;
    if (ch && ch.onDown(x, y)) return;
    if (director.tap(x, y)) return;
    if (dalil.hit(x, y)) dalil.openAsk();
  });
  canvas.addEventListener('pointermove', (e) => {
    director.chain?.onMove(e.clientX, e.clientY, down);
    if (e.pointerType === 'mouse') rig.setParallax((e.clientX / window.innerWidth - 0.5) * 2, -(e.clientY / window.innerHeight - 0.5) * 2);
  });
  const up = () => { down = false; director.chain?.onUp(); };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target.closest?.('button, a')) return;
      const ch = director.chain;
      if (ch && ch.s.active && !ch.s.done) { ch.link(); e.preventDefault(); return; }
      if (ui.goOn()) e.preventDefault();
    } else if (e.key === '?') { if (director.D.started) dalil.openAsk(); }
    else if (e.key === 'Escape' && ui.state.menuOpen) ui.toggleMenu(false);
  });

  // From the menu, the player's click already unlocked sound and the shell calls
  // begin() as its veil lifts. Opened directly, the level asks for that gesture itself.
  let begun = false;
  const begin = () => { if (begun) return; begun = true; audio.start(audioContext); director.begin(); };
  if (!fromMenu) ui.mountStart(begin);

  let fps = 60;
  start(document.getElementById('stage'));
  trackFps('fitrah', () => fps);
  onUpdate((dt, t) => {
    fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
    rig.update(dt, t);
    chamber.update(dt, t, renderer, camera);
    director.chain?.update(dt, t);
    director.pillars?.update(dt, t);
    dalil.update(dt * Math.max(1, SPEED * 0.75), t);
    ui.update();
  });

  // hooks for headless tests and review tooling
  window.fitrahLevel = {
    director, chamber, rig, dalil, ui, audio, camera, C, STEPS, DEBUG,
    ff: (k) => director.ff(k),
    // a clean frame of the chamber (no interface), e.g. for the menu's still
    capture: (type = 'image/jpeg', q = 0.9) => { renderNow(); return renderer.domElement.toDataURL(type, q); },
    begin: () => { const b = document.querySelector('.start button'); if (b) b.click(); else begin(); },
    stats: () => ({
      step: director.D.step, depth: director.D.depth, chapter: director.D.chapter?.id || null, source: director.D.source,
      dalil: dalil.state, speaking: dalil.speaking, linked: director.chain?.s.linked ?? null, focus: director.D.focus,
      done: director.D.done, events: director.D.events.slice(-4), ai: dalil.aiStatus.last, state: chamber.P.name, shot: rig.name,
    }),
    chainScreens: () => director.chain?.screens() || null,
    dalilScreen: () => dalil.screen(),
  };
  return { begin, director, dalil };
}
