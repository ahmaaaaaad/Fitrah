// Module 3 · Fitrah: inside the player's own light. Three layers of the self
// (hearing, sight, heart) each oscillate at their own frequency against an inner
// tone that was there from the start. Tuning a layer slows its beating
// (|f₁ − f₂|); close enough, it phase-locks (Kuramoto coupling). With all three
// in tune, a second, competing source appears: against two different sources
// nothing can settle. When the player lets it go, the light is clear again.
// The inner tone stands for the player's own nature, never for God.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { audio } from '../core/audio.js';
import { scene, cinematic } from '../core/scene.js';
import * as ui from '../ui/components.js';
import { h, root, hide, D } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { script as S } from '../core/content.js';
import * as store from '../core/store.js';
import { GLSL_NOISE } from '../world/textures.js';

const st = () => S.world1.stations[2];
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const F_REF = 220;                     // the inner tone, Hz
const F_FALSE = 233;                   // the competing source, Hz
const RADII = [3.0, 4.5, 6.0];
const START_DETUNE = [14, -11, 18];    // Hz away from the inner tone at the start
const LOCK_HZ = 0.5;                   // capture range
const COUPLING = 6;                    // Kuramoto coupling strength (rad/s)

const FIELD_FRAG = /* glsl */`
uniform float uTime, uClarity, uFalse, uGold;
uniform vec3 uAmp, uEnv, uPsi, uLock;
uniform vec2 uFalsePos;
varying vec2 vP;
float ringLine(vec2 p, float R, float A, float k, float t){
  float th = atan(p.y, p.x), r = length(p);
  float rr = R + A * sin(k * th + t * 3.0) + A * 0.6 * sin((k + 3.0) * th - t * 2.1);
  float d = abs(r - rr);
  return 0.8 * exp(-d * d * 90.0) + 0.18 * exp(-d * d * 8.0);
}
vec3 marker(vec2 p, float R, float psi, vec3 c){ vec2 m = vec2(sin(psi), cos(psi)) * R; vec2 q = p - m; return c * (exp(-dot(q, q) * 26.0) * 1.6 + exp(-dot(q, q) * 3.0) * 0.25); }
void main(){
  vec2 p = vP; float r = length(p);
  // interference noise from what is out of tune
  float moire = sin(r * 17.0 - uTime * 3.0) * sin(length(p - vec2(0.9, 0.4)) * 17.9 - uTime * 3.4);
  vec3 col = vec3(0.32, 0.36, 0.85) * (0.5 + 0.5 * moire) * (1.0 - uClarity) * 0.24 * smoothstep(8.5, 1.5, r);
  vec3 c1 = mix(vec3(0.6, 0.85, 1.0), vec3(1.0, 0.83, 0.5), uLock.x);
  vec3 c2 = mix(vec3(0.75, 1.0, 0.8), vec3(1.0, 0.83, 0.5), uLock.y);
  vec3 c3 = mix(vec3(1.0, 0.6, 0.55), vec3(1.0, 0.83, 0.5), uLock.z);
  col += c1 * ringLine(p, ${RADII[0].toFixed(1)}, uAmp.x, 5.0, uTime) * (0.35 + 0.65 * uEnv.x);
  col += c2 * ringLine(p, ${RADII[1].toFixed(1)}, uAmp.y, 7.0, uTime * 0.9) * (0.35 + 0.65 * uEnv.y);
  col += c3 * ringLine(p, ${RADII[2].toFixed(1)}, uAmp.z, 9.0, uTime * 1.1) * (0.35 + 0.65 * uEnv.z);
  col += marker(p, ${RADII[0].toFixed(1)}, uPsi.x, c1) + marker(p, ${RADII[1].toFixed(1)}, uPsi.y, c2) + marker(p, ${RADII[2].toFixed(1)}, uPsi.z, c3);
  // the player's own light at the centre: steadier and brighter as the layers agree
  col += vec3(1.0, 0.9, 0.72) * exp(-r * r * 1.3) * (0.3 + 0.9 * uClarity) * (1.0 + 0.15 * (1.0 - uClarity) * sin(uTime * 9.0));
  // the competing source: a restless point
  vec2 fq = p - uFalsePos; float fd = dot(fq, fq);
  col += vec3(0.72, 0.78, 1.0) * (exp(-fd * 5.0) * 2.2 + exp(-fd * 0.5) * 0.22) * uFalse * (0.65 + 0.35 * sin(uTime * 13.0));
  // its own waves cross the rings: two sources, two patterns that never agree
  float fw = sin(sqrt(fd) * 7.5 - uTime * 4.2) * sin(r * 7.5 - uTime * 3.7);
  col += vec3(0.5, 0.55, 1.0) * max(fw, 0.0) * uFalse * 0.16 * smoothstep(9.0, 2.0, r);
  // coherence: clean concentric gold
  col += vec3(1.0, 0.8, 0.42) * uGold * 0.3 * pow(0.5 + 0.5 * cos(r * 4.4 - uTime * 1.2), 10.0) * smoothstep(8.5, 0.5, r);
  float a = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}`;
const VOID_FRAG = /* glsl */`
${GLSL_NOISE}
varying vec3 vDir; uniform float uTime, uClarity;
void main(){
  vec3 d = normalize(vDir);
  float n = fbm(d * 2.2 + vec3(uTime * 0.03, 0.0, 0.0));
  vec3 col = mix(vec3(0.03, 0.025, 0.06), vec3(0.09, 0.06, 0.04), uClarity) * (0.7 + 0.6 * n);
  gl_FragColor = vec4(col, 1.0);
}`;

export function runFitrah({ cosmos, camera, canvas, rig }) {
  const S3 = st();
  const v3 = new THREE.Vector3();
  const project = (p) => { v3.copy(p).project(camera); return { x: (v3.x * 0.5 + 0.5) * innerWidth, y: (-v3.y * 0.5 + 0.5) * innerHeight }; };
  const savedBg = scene.background, savedEnv = scene.environment;

  // the inner stage
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const voidU = { uTime: { value: 0 }, uClarity: { value: 0 } };
  group.add(new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), new THREE.ShaderMaterial({ uniforms: voidU, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: VOID_FRAG })));
  const fu = {
    uTime: { value: 0 }, uClarity: { value: 0 }, uFalse: { value: 0 }, uGold: { value: 0 },
    uAmp: { value: V(0.4, 0.4, 0.4) }, uEnv: { value: V(1, 1, 1) }, uPsi: { value: V(0, 2, 4) }, uLock: { value: V(0, 0, 0) },
    uFalsePos: { value: new THREE.Vector2(4.6, 3.2) },
  };
  const field = new THREE.Mesh(new THREE.PlaneGeometry(19, 19), new THREE.ShaderMaterial({ uniforms: fu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: FIELD_FRAG }));
  group.add(field);

  const rings = RADII.map((R, k) => ({ R, f: F_REF + START_DETUNE[k], psi: k * 2.1, locked: false, hold: 0, tone: null }));
  let ref = null, falseTone = null, phase = 'tune', clarity = 0;

  return new Promise(async (resolve) => {
    // into the light
    const orbPos = cosmos.orb.anchor.getWorldPosition(new THREE.Vector3());
    await rig.flyTo({ pos: orbPos.clone().add(V(0.4, 0.3, 2.2)), look: orbPos, duration: 2.6, fov: 40 });
    await warpIn(() => {
      group.visible = true; cosmos.root.visible = false; scene.background = null; scene.environment = null;
      rig.snap(V(0, 0, 21), V(0, 0, 0), 46);
    });
    rig.flyTo({ pos: V(0, 0, 18), look: V(0, 0, 0), duration: 5, fov: 46 });
    ref = audio.tone(F_REF, { gain: 0.03, attack: 3 });
    rings.forEach((r, k) => { r.tone = audio.tone(r.f, { gain: 0.016, attack: 3, pan: (k - 1) * 0.5 }); });
    await ui.caption(S3.intro, 3);
    const toneCap = ui.caption(S3.inner_tone);
    setTimeout(() => toneCap.done(), 4500);
    const labels = S3.layers.map((name, k) => label(t(name), () => V(-RADII[k] * 0.72, -RADII[k] * 0.72 - 0.35, 0)));
    const coach = ui.coach({ glyph: ['tune', () => project(V(0, RADII[1], 0))], text: S3.instruction, hints: S3.hints, stall: 13 });

    // ---- input: grab the nearest ring, drag up or down to tune it
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(V(0, 0, 1), 0), hit = new THREE.Vector3();
    let grabbed = -1, ly = 0, holdFalse = 0, pressingFalse = false, attempts = 0;
    const toPlane = (e) => { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? hit : null; };
    const down = (e) => {
      const p = toPlane(e); if (!p) return;
      if (phase === 'release' && Math.hypot(p.x - fu.uFalsePos.value.x, p.y - fu.uFalsePos.value.y) < 1.4) { pressingFalse = true; canvas.setPointerCapture(e.pointerId); coach2?.progress(); return; }
      const r = Math.hypot(p.x, p.y);
      let best = -1, bd = 0.9;
      rings.forEach((ring, k) => { const d = Math.abs(r - ring.R); if (d < bd && (!ring.locked || phase !== 'tune')) { bd = d; best = k; } });
      if (best < 0) return;
      grabbed = best; ly = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'ns-resize';
      coach.progress(); audio.soft();
      if (phase === 'two') attempts++;
    };
    const move = (e) => {
      if (grabbed < 0) { const p = toPlane(e); canvas.style.cursor = p && rings.some((ring) => Math.abs(Math.hypot(p.x, p.y) - ring.R) < 0.9) ? 'ns-resize' : 'default'; return; }
      const dy = e.clientY - ly; ly = e.clientY;
      const ring = rings[grabbed];
      ring.f = THREE.MathUtils.clamp(ring.f - dy * 0.06, F_REF - 40, F_REF + 40);
      if (phase === 'tune') coach.progress();
    };
    const up = () => { grabbed = -1; pressingFalse = false; canvas.style.cursor = 'default'; };
    let sel = 0;
    const key = (e) => {
      if (e.key === 'Tab') { sel = (sel + 1) % 3; e.preventDefault(); return; }
      if (e.key === 'ArrowUp') { rings[sel].f += 0.4; coach.progress(); }
      if (e.key === 'ArrowDown') { rings[sel].f -= 0.4; coach.progress(); }
      if (phase === 'release' && (e.key === 'Enter' || e.code === 'Space')) { holdFalse = 1; }
    };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    addEventListener('keydown', key);

    let twoT = 0, coach2 = null;
    const stop = cosmos.addUpdater((dt, tt) => {
      voidU.uTime.value = tt; fu.uTime.value = tt;
      const tFalse = phase === 'two' || phase === 'release' ? 1 : 0;
      let cx = 1, cy = 0;
      rings.forEach((ring, k) => {
        const df = ring.f - F_REF;
        ring.tone?.setFreq(ring.f);
        if (phase === 'tune' || phase === 'clear') {
          if (Math.abs(df) < LOCK_HZ) ring.psi += (2 * Math.PI * df - COUPLING * Math.sin(ring.psi)) * dt;   // Kuramoto pull
          else ring.psi += 2 * Math.PI * df * 0.08 * dt;                                                   // shown slowed down
        } else {
          // two sources: pulled toward both, the layer cannot rest
          const thF = 2 * Math.PI * (F_FALSE - F_REF) * 0.08 * tt + k;
          ring.psi += (-COUPLING * 0.6 * Math.sin(ring.psi) - COUPLING * 0.6 * Math.sin(ring.psi - thF) + 2 * Math.PI * df * 0.08) * dt;
        }
        ring.psi = Math.atan2(Math.sin(ring.psi), Math.cos(ring.psi));
        const env = Math.abs(Math.cos(Math.PI * df * 0.25 * tt));
        const amp = phase === 'two' || phase === 'release' ? 0.45 + 0.15 * Math.sin(tt * 3 + k) : Math.min(0.6, Math.abs(df) * 0.035);
        fu.uAmp.value.setComponent(k, THREE.MathUtils.damp(fu.uAmp.value.getComponent(k), amp, 4, dt));
        fu.uEnv.value.setComponent(k, Math.abs(df) < LOCK_HZ && tFalse === 0 ? 1 : env);
        fu.uPsi.value.setComponent(k, ring.psi);
        if (phase === 'tune' && !ring.locked) {
          if (Math.abs(df) < LOCK_HZ && Math.abs(ring.psi) < 0.3) { ring.hold += dt; if (ring.hold > 2) lockRing(k); } else ring.hold = 0;
        }
        cx += Math.cos(ring.psi); cy += Math.sin(ring.psi);
      });
      const r = Math.hypot(cx, cy) / 4;                                        // Kuramoto order parameter
      clarity = THREE.MathUtils.damp(clarity, phase === 'two' || phase === 'release' ? Math.min(r, 0.35) : r, 3, dt);
      fu.uClarity.value = clarity; voidU.uClarity.value = clarity;
      fu.uFalse.value = THREE.MathUtils.damp(fu.uFalse.value, tFalse, 2, dt);
      if (phase === 'two') { twoT += dt; if (twoT > 7 || attempts >= 3) toRelease(); }
      if (phase === 'release') {
        if (pressingFalse) holdFalse += dt;
        if (holdFalse > 0.7) clear();
      }
    });

    function lockRing(k) {
      const ring = rings[k];
      ring.locked = true; ring.f = F_REF; ring.psi = 0;
      store.log('fitrah_lock', { layer: k });
      audio.snap();
      gsap.to(fu.uLock.value, { [['x', 'y', 'z'][k]]: 1, duration: D(1) });
      labels[k].glow();
      if (rings.every((x) => x.locked)) setTimeout(twoSources, 1800);
    }
    let failCap = null;
    function twoSources() {
      phase = 'two'; coach.done();
      store.log('fitrah_two_sources');
      audio.wrong();
      falseTone = audio.tone(F_FALSE, { gain: 0.026, attack: 1.5, pan: 0.6 });
      window.__fitrahSolve = solveHook;
      ui.caption(S3.second.appear, 3.4).then(() => { if (phase === 'two') failCap = ui.caption(S3.second.try); });
      gsap.to(fu.uLock.value, { x: 0.4, y: 0.4, z: 0.4, duration: D(1.5) });
    }
    function toRelease() {
      phase = 'release';
      window.__fitrahSolve = solveHook;
      failCap?.done?.();
      ui.caption(S3.second.fail, 4);
      setTimeout(() => {
        if (phase !== 'release') return;
        coach2 = ui.coach({ glyph: ['hold', () => project(V(fu.uFalsePos.value.x, fu.uFalsePos.value.y, 0))], text: S3.second.release, hints: [S3.second.release], stall: 8 });
      }, 1500);
    }
    async function clear() {
      if (phase === 'clear') return;
      phase = 'clear'; coach2?.done();
      store.log('fitrah_clear');
      falseTone?.stop(2);
      rings.forEach((ring) => { ring.f = F_REF; });
      gsap.to(fu.uLock.value, { x: 1, y: 1, z: 1, duration: D(1.5) });
      gsap.to(fu.uGold, { value: 1, duration: D(3) });
      audio.swell();
      ref?.setGain(0.045, 1.5);
      cinematic.uniforms.uCA.value = 0.006; gsap.to(cinematic.uniforms.uCA, { value: 0.0022, duration: D(2) });
      await wait(1.5);
      await ui.caption(S3.success, 3.6);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
      removeEventListener('keydown', key);
      labels.forEach((l) => l.done());
      rings.forEach((ring) => ring.tone?.stop(4)); ref?.stop(5);
      await warpIn(() => {
        stop(); group.visible = false; scene.remove(group);
        group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
        cosmos.root.visible = true; scene.background = savedBg; scene.environment = savedEnv;
        rig.snap(orbPos.clone().add(V(3, 1.6, 9)), orbPos.clone().lerp(new THREE.Vector3(0, 0, 0), 0.3), 44);
      });
      cosmos.orb.grow();
      resolve({ anchor: () => project(cosmos.orb.world) });
    }
    // debug hook (tests): advances whichever phase is active; re-armed at each phase
    function solveHook() {
      if (phase === 'tune') { rings.forEach((ring, k) => { if (!ring.locked) { ring.f = F_REF; ring.psi = 0; lockRing(k); } }); }
      else if (phase === 'two') toRelease();
      else if (phase === 'release') holdFalse = 1;
    }
    window.__fitrahSolve = solveHook;
    window.__fitrahDebug = { ring: (k) => project(V(0, RADII[k], 0)), falseSrc: () => project(V(fu.uFalsePos.value.x, fu.uFalsePos.value.y, 0)), phase: () => phase, df: () => rings.map((r) => +(r.f - F_REF).toFixed(2)) };
  });

  function label(text, pointFn) {
    const el = h('div', { class: 'world-label layer-label' }, h('b', {}, text));
    root().append(el);
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: D(1), delay: D(1) });
    let alive = true;
    const place = () => { if (!alive) return; const s = project(pointFn()); el.style.left = `${Math.round(s.x)}px`; el.style.top = `${Math.round(s.y)}px`; requestAnimationFrame(place); };
    place();
    return { glow: () => el.classList.add('on'), done: () => { alive = false; return hide(el, { y: 0 }); } };
  }
}

async function warpIn(swap) {
  const U = cinematic.uniforms;
  audio.warp();
  await new Promise((r) => gsap.to(U.uWarp, { value: 1, duration: D(1.1), ease: 'power2.in', onComplete: r }));
  await new Promise((r) => gsap.to(U.uFade, { value: 1, duration: D(0.25), onComplete: r }));
  swap();
  gsap.to(U.uFade, { value: 0, duration: D(0.6) });
  await new Promise((r) => gsap.to(U.uWarp, { value: 0, duration: D(1.4), ease: 'power2.out', onComplete: r }));
}
