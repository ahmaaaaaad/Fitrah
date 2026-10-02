// Module 1 · Mizan.
// Beat 1, Qadar: inside an old star, carbon forms only while the Hoyle resonance
// sits in a narrow window. The player pushes it out of the window on both sides
// and brings it back; the star then breathes its carbon out as the planets' dust.
// Beat 2, orbits: each protoplanet is launched like an arrow. Newtonian gravity
// (velocity Verlet) decides whether it falls in, escapes, or settles into balance.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { audio } from '../core/audio.js';
import { cinematic, QUALITY } from '../core/scene.js';
import * as ui from '../ui/components.js';
import { h, root, hide, D } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { script as S } from '../core/content.js';
import * as store from '../core/store.js';
import { GLSL_NOISE } from '../world/textures.js';
import { SUN_RADIUS } from '../world/cosmos.js';

const st = () => S.world1.stations[0];
export const SHOT_QADAR = { pos: new THREE.Vector3(0, 2.2, 21), look: new THREE.Vector3(0, 0.4, 0), fov: 46 };
export const SHOT_ORBITS = { pos: new THREE.Vector3(0, 31, 27), look: new THREE.Vector3(0, -2, 1.5), fov: 48 };
export const ORB_PARK = new THREE.Vector3(-17, 7, 19);

// The Hoyle state: measured at about 7.65 MeV; enough carbon for life needs about 7.3–7.9 MeV.
const E0 = 7.65, LOW = 7.3, HIGH = 7.9, SIGMA = 0.25;
const DIAL_SPAN = 2.356;              // ±135° of dial
const MEV_PER_RAD = 0.573;            // dial angle → energy
const yieldOf = (E) => Math.exp(-((E - E0) ** 2) / (2 * SIGMA * SIGMA)); // stylized model

const v3 = new THREE.Vector3();
function projector(camera) {
  return (p) => { v3.copy(p).project(camera); return { x: (v3.x * 0.5 + 0.5) * innerWidth, y: (-v3.y * 0.5 + 0.5) * innerHeight, behind: v3.z > 1 }; };
}

/** A DOM label pinned to a point in the world (always readable browser text). */
function worldLabel(main, sub, getPoint, project) {
  const el = h('div', { class: 'world-label' }, h('b', {}, main), sub ? h('small', {}, sub) : null);
  root().append(el);
  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: D(0.8) });
  let alive = true;
  const place = () => {
    if (!alive) return;
    const s = project(getPoint());
    el.style.left = `${Math.round(s.x)}px`; el.style.top = `${Math.round(s.y)}px`;
    requestAnimationFrame(place);
  };
  place();
  return { done: () => { alive = false; return hide(el, { y: 0 }); } };
}

// =========================================================================== Qadar
const ENVELOPE_VERT = /* glsl */`
varying vec3 vN; varying vec3 vV; varying vec3 vObj;
void main(){ vObj = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const ENVELOPE_FRAG = /* glsl */`
${GLSL_NOISE}
uniform float uTime, uAlpha, uHeat; uniform vec3 uA, uB;
varying vec3 vN; varying vec3 vV; varying vec3 vObj;
void main(){
  float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float rim = pow(1.0 - mu, 2.4);
  float n = fbm4(normalize(vObj) * 2.6 + vec3(0.0, uTime * 0.05, uTime * 0.02));
  vec3 col = mix(uA, uB, clamp(n * 1.3 + uHeat * 0.3, 0.0, 1.0));
  float a = (rim * (0.75 + 0.6 * n) + 0.02 + 0.05 * max(n, 0.0)) * uAlpha;
  gl_FragColor = vec4(col * 1.5, a);
}`;

// Helium and carbon nuclei, animated entirely on the GPU from per-particle seeds.
const NUCLEI_VERT = /* glsl */`
attribute vec4 seed;
uniform float uTime, uCarbon, uAsh, uShed, uScale, uFade;
varying vec3 vCol; varying float vA;
void main(){
  float isC = step(seed.w, uCarbon);
  float r0 = mix(1.15, 4.6, seed.x * seed.x);
  float th = seed.z * 6.2831 + uTime * (1.4 / sqrt(r0)) * (seed.y > 0.5 ? 1.0 : -1.0);
  float inc = (seed.y - 0.5) * 3.0;
  vec3 p = vec3(cos(th), sin(th) * cos(inc), sin(th) * sin(inc)) * r0;
  p += 0.1 * vec3(sin(uTime * 3.1 + seed.w * 41.0), cos(uTime * 2.3 + seed.x * 31.0), sin(uTime * 2.7 + seed.y * 23.0));
  // shedding: the carbon drifts out and settles into the dust disk the planets form from
  float rD = mix(5.6, 22.0, fract(seed.w * 7.31 + seed.x * 3.7));
  float thD = seed.z * 6.2831 + uTime * sqrt(169.0 / (rD * rD * rD));
  vec3 pd = vec3(cos(thD) * rD, (seed.y - 0.5) * 0.45, sin(thD) * rD);
  float k = smoothstep(0.0, 1.0, clamp(uShed * 1.25 - seed.x * 0.25, 0.0, 1.0));
  p = mix(p, pd, k);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 he = vec3(0.72, 0.93, 1.0), gold = vec3(1.0, 0.76, 0.36), ash = vec3(0.42, 0.42, 0.46);
  vCol = mix(mix(he, ash, uAsh), gold * 1.25, isC);
  vA = uFade * mix(0.32, 0.8, isC) * mix(1.0, isC, smoothstep(0.2, 0.7, uShed));
  gl_PointSize = clamp((mix(1.4, 2.6, isC) + seed.w) * (1.0 + 2.2 * k) * uScale * 28.0 / max(1.0, -mv.z), 1.0, 24.0);
  gl_Position = projectionMatrix * mv;
}`;
const NUCLEI_FRAG = /* glsl */`
varying vec3 vCol; varying float vA;
void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 22.0) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vCol, a); }`;

function buildStar(cosmos) {
  const group = new THREE.Group();
  const mkShell = (r, a, b, alpha) => {
    const u = { uTime: { value: 0 }, uAlpha: { value: alpha }, uHeat: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) } };
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 96, 64), new THREE.ShaderMaterial({ uniforms: u, vertexShader: ENVELOPE_VERT, fragmentShader: ENVELOPE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    group.add(m); return { m, u };
  };
  const outer = mkShell(8, '#c2280c', '#ff7a2c', 1);
  const inner = mkShell(4.9, '#ff7a24', '#ffd27a', 0.45);
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.93, 0.78).multiplyScalar(3) });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.85, 48, 32), coreMat); group.add(core);
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: cosmos.GLOW, color: 0xffd9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  coreGlow.scale.set(7, 7, 1); group.add(coreGlow);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: cosmos.GLOW, color: 0xff5a24, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(34, 34, 1); group.add(halo);

  const N = QUALITY === 'low' ? 9000 : 32000;
  const seeds = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) seeds[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
  const nu = { uTime: { value: 0 }, uCarbon: { value: 0.42 }, uAsh: { value: 0 }, uShed: { value: 0 }, uScale: { value: 1 }, uFade: { value: 1 } };
  const nuclei = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: nu, vertexShader: NUCLEI_VERT, fragmentShader: NUCLEI_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  nuclei.frustumCulled = false;
  cosmos.root.add(group, nuclei);
  return { group, outer, inner, core, coreMat, coreGlow, halo, nuclei, nu };
}

function buildDial() {
  const R = 5.6;
  const dial = new THREE.Group();
  const arc = (r0, r1, a0, a1, color, opacity) => {
    // dial angles: 0 at the top, positive to the right; RingGeometry measures from +x, counter-clockwise
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 160, 1, Math.PI / 2 - a1, a1 - a0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    dial.add(m); return m;
  };
  const track = arc(R - 0.04, R + 0.04, -DIAL_SPAN, DIAL_SPAN, new THREE.Color('#cfd8ff'), 0.4);
  const phi = (E) => (E - E0) / MEV_PER_RAD;
  const windowArc = arc(R - 0.2, R + 0.2, phi(LOW), phi(HIGH), new THREE.Color('#ffcf73').multiplyScalar(1.6), 0);
  // ticks every 0.1 MeV, longer every 0.5
  const pts = [];
  for (let k = 63; k <= 90; k++) {
    const a = phi(k / 10), long = k % 5 === 0;
    const r0 = R + 0.16, r1 = R + (long ? 0.62 : 0.34);
    pts.push(Math.sin(a) * r0, Math.cos(a) * r0, 0, Math.sin(a) * r1, Math.cos(a) * r1, 0);
  }
  const ticks = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)),
    new THREE.LineBasicMaterial({ color: new THREE.Color('#cfd8ff'), transparent: true, opacity: 0.45 }));
  dial.add(ticks);
  const handle = new THREE.Group();
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.86, 0.55).multiplyScalar(3) }));
  handle.add(knob);
  dial.add(handle);
  return { dial, R, track, windowArc, ticks, handle, knob, phi };
}

/** Before Mizan the familiar system does not exist yet: no sun, no planets. */
export function prepareMizan(cosmos) {
  cosmos.sunGroup.visible = false;
  cosmos.planets.forEach((p) => { p.group.visible = false; p.orbit.visible = false; p.mode = 'hold'; });
}

export function runQadar({ cosmos, camera, canvas, rig }) {
  const S1 = st(), Q = S1.qadar;
  const project = projector(camera);
  const star = buildStar(cosmos);
  const D_ = buildDial();
  star.group.add(D_.dial);
  const handleGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: cosmos.GLOW, color: 0xffcf73, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  handleGlow.scale.set(2.2, 2.2, 1); D_.handle.add(handleGlow);

  prepareMizan(cosmos);
  // the old star swells into view
  star.outer.u.uAlpha.value = 0; star.inner.u.uAlpha.value = 0; star.nu.uFade.value = 0; star.halo.material.opacity = 0; star.core.scale.setScalar(0.001);
  gsap.to(star.outer.u.uAlpha, { value: 1, duration: D(3) });
  gsap.to(star.inner.u.uAlpha, { value: 0.45, duration: D(3), delay: D(0.5) });
  gsap.to(star.nu.uFade, { value: 1, duration: D(3), delay: D(1) });
  gsap.to(star.halo.material, { opacity: 0.2, duration: D(3) });
  gsap.to(star.core.scale, { x: 1, y: 1, z: 1, duration: D(2.5), ease: 'power2.out' });
  gsap.to(cosmos.orb.anchor.position, { x: ORB_PARK.x, y: ORB_PARK.y, z: ORB_PARK.z, duration: D(2.5), ease: 'power2.inOut' });

  return new Promise((resolve) => {
    rig.flyTo({ ...SHOT_QADAR, duration: 3.4 });
    let phiNow = 0, Ys = 1, seenLow = false, seenHigh = false, holdT = 0, done = false, dragging = false, a0 = 0;
    const hum = audio.tone(110, { gain: 0.045, type: 'triangle', attack: 2.5 });
    const ref = audio.tone(110, { gain: 0.03, attack: 2.5 });
    const hand = new THREE.Vector3();
    const intro = ui.caption(S1.intro);
    setTimeout(() => intro.done(), 6000);
    const coach = ui.coach({ glyph: ['rotate', () => project(D_.handle.getWorldPosition(hand))], text: S1.instruction, hints: S1.hints, stall: 12 });

    const center = new THREE.Vector3();
    const screenAngle = (e) => { const c = project(star.group.getWorldPosition(center)); return Math.atan2(e.clientX - c.x, c.y - e.clientY); };
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const setPhi = (p) => { phiNow = THREE.MathUtils.clamp(p, -DIAL_SPAN, DIAL_SPAN); coach.progress(); };
    // incremental: the ring follows the pointer around the core, however far it travels
    const onDown = (e) => { if (done) return; dragging = true; a0 = screenAngle(e); canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; audio.soft(); };
    const onMove = (e) => {
      if (!dragging) { canvas.style.cursor = done ? 'default' : 'grab'; return; }
      const a = screenAngle(e); setPhi(phiNow + wrap(a - a0)); a0 = a;
    };
    const onUp = () => { dragging = false; canvas.style.cursor = 'default'; };
    const onWheel = (e) => { if (!done) { setPhi(phiNow + e.deltaY * 0.0012); e.preventDefault(); } };
    const onKey = (e) => {
      if (done) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setPhi(phiNow + 0.035);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setPhi(phiNow - 0.035);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    addEventListener('keydown', onKey);
    const cleanupInput = () => {
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel); removeEventListener('keydown', onKey);
      canvas.style.cursor = 'default';
    };

    const stop = cosmos.addUpdater((dt, tt) => {
      [star.outer.u, star.inner.u].forEach((u) => { u.uTime.value = tt; });
      star.nu.uTime.value = tt;
      star.nu.uScale.value = Math.min(2, devicePixelRatio || 1) * (innerHeight / 800);
      D_.dial.quaternion.copy(camera.quaternion);
      D_.handle.position.set(Math.sin(phiNow) * D_.R, Math.cos(phiNow) * D_.R, 0.02);
      if (done) return;
      const E = E0 + phiNow * MEV_PER_RAD, Y = yieldOf(E);
      Ys = THREE.MathUtils.damp(Ys, Y, 2.6, dt);
      star.nu.uCarbon.value = 0.42 * Ys;
      star.nu.uAsh.value = 0.85 * (1 - Ys);
      star.outer.u.uHeat.value = Ys;
      star.coreMat.color.setRGB(1, 0.93 * (0.75 + 0.25 * Ys), 0.78 * (0.6 + 0.4 * Ys)).multiplyScalar(1.6 + 1.6 * Ys);
      star.coreGlow.material.opacity = 0.45 + 0.5 * Ys;
      handleGlow.material.color.setRGB(1, 0.55 + 0.3 * Ys, 0.35 + 0.1 * Ys);
      // the core hums against a steady reference: off the measure, you hear it beat
      hum.setFreq(110 * (1 + 0.5 * (E - E0)));
      if (Y < 0.1 && E < E0 && !seenLow) { seenLow = true; edge(); }
      if (Y < 0.1 && E > E0 && !seenHigh) { seenHigh = true; edge(); }
      if (seenLow && seenHigh && Y > 0.85) { holdT += dt; if (holdT > 2) finish(); } else holdT = 0;
    });

    let edgeCap = null;
    function edge() {
      audio.wrong();
      store.log('qadar_edge', { low: seenLow, high: seenHigh });
      edgeCap?.done?.();
      if (seenLow && seenHigh) {
        edgeCap = ui.caption(Q.return_line);
        gsap.to(D_.windowArc.material, { opacity: 0.55, duration: D(1.2) });
      } else {
        edgeCap = ui.caption(Q.edge_line);
      }
      setTimeout(() => edgeCap?.done?.(), 5000);
    }

    async function finish() {
      if (done) return; done = true;
      cleanupInput(); coach.done(); edgeCap?.done?.();
      store.log('qadar_done');
      phiNow = 0;
      audio.swell(); audio.shimmer();
      hum.setFreq(110); setTimeout(() => { hum.stop(3); ref.stop(3); }, 1500);
      gsap.fromTo(D_.windowArc.material, { opacity: 1 }, { opacity: 0.6, duration: D(1.5) });
      const label = worldLabel(t(Q.measured), t(Q.model_note), () => D_.dial.localToWorld(new THREE.Vector3(0, D_.R + 1.9, 0)), project);
      await wait(3.2);
      label.done();
      await ui.caption(Q.success, 3.4);
      // the star breathes its carbon out; a new sun lights at the centre of the dust
      gsap.to([D_.track.material, D_.ticks.material, D_.windowArc.material, D_.knob.material, handleGlow.material], { opacity: 0, duration: D(1.2) });
      gsap.to(star.nu.uShed, { value: 1, duration: D(6), ease: 'power2.inOut' });
      gsap.to(star.outer.m.scale, { x: 3, y: 3, z: 3, duration: D(5), ease: 'power2.out' });
      gsap.to(star.inner.m.scale, { x: 2.2, y: 2.2, z: 2.2, duration: D(5), ease: 'power2.out' });
      gsap.to([star.outer.u.uAlpha, star.inner.u.uAlpha], { value: 0, duration: D(4.5) });
      gsap.to(star.halo.material, { opacity: 0, duration: D(4) });
      gsap.to(star.core.scale, { x: 0.3, y: 0.3, z: 0.3, duration: D(3) });
      gsap.to([star.coreGlow.material], { opacity: 0, duration: D(3), delay: D(2.5) });
      gsap.to(star.core.scale, { x: 0.001, y: 0.001, z: 0.001, duration: D(1.5), delay: D(3.5) });
      cosmos.burstGold.play(new THREE.Vector3(), 18, 2, 4);
      rig.flyTo({ pos: new THREE.Vector3(0, 22, 40), look: new THREE.Vector3(0, -1, 0), fov: 50, duration: 6, ease: 'power2.inOut' });
      await wait(3.6);
      cosmos.sunGroup.visible = true;
      cosmos.sunGroup.scale.setScalar(0.001);
      gsap.to(cosmos.sunGroup.scale, { x: 1, y: 1, z: 1, duration: D(3), ease: 'power3.out' });
      gsap.fromTo(cosmos.sunMat.uniforms.uIntensity, { value: 0.2 }, { value: 3.2, duration: D(3.5) });
      gsap.fromTo(cinematic.uniforms.uCA, { value: 0.008 }, { value: 0.0022, duration: D(2.5) });
      audio.whoosh();
      await wait(3);
      stop();
      star.group.visible = false;
      resolve({
        verse: Q.verse, sign: Q.sign,
        anchor: () => project(new THREE.Vector3()),
        /** the dust disk lingers until the planets have condensed */
        fadeDust(seconds = 6) { gsap.to(star.nu.uFade, { value: 0, duration: D(seconds), onComplete: () => { cosmos.root.remove(star.group, star.nuclei); star.nuclei.geometry.dispose(); } }); },
        tickDust: cosmos.addUpdater((dt, tt) => { star.nu.uTime.value = tt; }),
      });
    }
    window.__fitrahSolve = () => { seenLow = seenHigh = true; phiNow = 0; Ys = 1; finish(); };
  });
}

// =========================================================================== orbits
const TRAIL_VERT = /* glsl */`attribute float k; varying float vK; void main(){ vK = k; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TRAIL_FRAG = /* glsl */`uniform vec3 uColor; uniform float uOpacity; varying float vK; void main(){ float a = (1.0 - vK) * (0.35 + 0.65 * step(0.5, fract(vK * 60.0))) * uOpacity; gl_FragColor = vec4(uColor, a); }`;
const GRID_VERT = /* glsl */`
varying vec2 vXZ; varying float vR;
void main(){ vec3 p = position; vXZ = p.xy; float r = length(p.xy); vR = r; p.z = -16.0 / sqrt(r * r + 9.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const GRID_FRAG = /* glsl */`
uniform vec3 uColor; uniform float uOpacity; varying vec2 vXZ; varying float vR;
void main(){
  vec2 c = vXZ / 2.0; vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  float fade = smoothstep(46.0, 16.0, vR) * smoothstep(1.0, 4.5, vR);
  gl_FragColor = vec4(uColor, line * fade * uOpacity);
}`;

const SPAWN_ANGLES = [-2.2, 0.75, 2.75, -0.7];
const PENTATONIC = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
const nearestNote = (f) => PENTATONIC.reduce((a, b) => (Math.abs(b - f) < Math.abs(a - f) ? b : a));

export function runOrbits({ cosmos, camera, canvas, rig, dust }) {
  const S1 = st(), O = S1.orbits;
  const project = projector(camera);
  const planets = cosmos.planets;
  const GOLD = new THREE.Color('#ffcf73');
  const K = 0.8;                       // launch speed per unit of pull
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();

  // gravity well grid: its depth follows the potential Φ = −GM/r (softened)
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(96, 96, QUALITY === 'low' ? 96 : 220, QUALITY === 'low' ? 96 : 220),
    new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color('#7d8fff') }, uOpacity: { value: 0 } }, vertexShader: GRID_VERT, fragmentShader: GRID_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  grid.rotation.x = -Math.PI / 2; grid.position.y = -0.9; cosmos.root.add(grid);
  gsap.to(grid.material.uniforms.uOpacity, { value: 0.32, duration: D(3) });

  // predicted path while aiming
  const TN = 420;
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TN * 3), 3));
  tg.setAttribute('k', new THREE.BufferAttribute(new Float32Array(TN).map((_, i) => i / (TN - 1)), 1));
  const tu = { uColor: { value: new THREE.Color('#ffcf73') }, uOpacity: { value: 0 } };
  const trail = new THREE.Line(tg, new THREE.ShaderMaterial({ uniforms: tu, vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  trail.frustumCulled = false; cosmos.root.add(trail);
  // the pull itself: a short line from the planet to the pointer
  const pullG = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const pull = new THREE.Line(pullG, new THREE.LineBasicMaterial({ color: new THREE.Color('#ffe3a8').multiplyScalar(1.5), transparent: true, opacity: 0 }));
  pull.frustumCulled = false; cosmos.root.add(pull);

  const COLORS = { good: new THREE.Color('#ffcf73').multiplyScalar(1.4), wide: new THREE.Color('#ff9a52'), fall: new THREE.Color('#ff4a3a'), escape: new THREE.Color('#bfe3ff') };
  const spawn = (p) => { const a = SPAWN_ANGLES[p.index]; return new THREE.Vector3(Math.cos(a) * p.R, 0, Math.sin(a) * p.R); };

  return new Promise((resolve) => {
    // condense the protoplanets out of the dust
    planets.forEach((p, i) => {
      p.locked = false; p.state = 'hold'; p.flight = null;
      p.pos.copy(spawn(p)); p.vel.set(0, 0, 0); p.mode = 'hold';
      p.lifeU.uLife.value = 0; p.lifeU.uFreeze.value = 0;
      p.group.visible = true; p.group.scale.setScalar(0.001);
      gsap.to(p.group.scale, { x: 1, y: 1, z: 1, duration: D(1.6), delay: D(0.5 + i * 0.4), ease: 'back.out(1.6)' });
      setTimeout(() => cosmos.burstAqua.play(p.pos.clone(), 2.5, 0.3, 1.2), (0.5 + i * 0.4) * 1000);
      const u = p.orbitU; p.orbit.visible = true;
      u.uColor.value.set(p.ring); u.uDash.value = 1; u.uOpacity.value = 0; u.uGlow.value = 0; u.uPulse.value = 0;
      u.uBand.value = p.R * 0.22; u.uBandAlpha.value = 0;
      gsap.to(u.uOpacity, { value: 0.28, duration: D(2), delay: D(1 + i * 0.3) });
      gsap.to(u.uBandAlpha, { value: 0.035, duration: D(2), delay: D(1 + i * 0.3) });
    });
    rig.flyTo({ ...SHOT_ORBITS, duration: 3.6 });
    dust?.fadeDust(9);

    let intro = null, coach = null;
    setTimeout(() => {
      intro = ui.caption(O.intro); setTimeout(() => intro?.done(), 6000);
      coach = ui.coach({ glyph: ['pull', () => { const p = planets.find((q) => !q.locked && q.state === 'hold'); return p ? project(p.group.position) : null; }], text: O.instruction, hints: O.hints, stall: 14 });
    }, 2600);

    let grabbed = -1; const anchor = new THREE.Vector3(), launch = new THREE.Vector3(); let pred = null;
    const said = {};
    const sayOnce = (key, text) => { if (said[key]) return; said[key] = true; ui.caption(text, 3.6); };
    const setNdc = (e) => { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
    const pick = () => {
      const cands = planets.filter((p) => !p.locked && (p.state === 'hold' || p.state === 'flying'));
      const hits = ray.intersectObjects(cands.map((p) => p.hit), false);
      return hits.length ? hits[0].object.userData.planetIndex : -1;
    };

    function classify(p, pos, vel) {
      const el = cosmos.elements(pos, vel);
      let cls = 'wide';
      if (el.eps >= 0) cls = 'escape';
      else if (el.rp < SUN_RADIUS + 0.4) cls = 'fall';
      else if (el.e < 0.2 && el.rp >= p.band[0] && el.ra <= p.band[1]) cls = 'good';
      return { cls, el };
    }
    // gentle aim assist: a near miss is drawn toward the circular orbit in the chosen direction
    function assisted(pos, vel) {
      const r = pos.length(), vc = Math.sqrt(cosmos.GM / r);
      const hz = pos.z * vel.x - pos.x * vel.z;
      const tang = new THREE.Vector3(-pos.z, 0, pos.x).normalize().multiplyScalar(hz > 0 ? -vc : vc);
      const err = vel.clone().sub(tang).length() / vc;
      return err < 0.16 ? vel.clone().lerp(tang, 0.45) : vel.clone();
    }
    const ppos = new THREE.Vector3(), pvel = new THREE.Vector3();
    function predict(p) {
      const v = assisted(anchor, launch);
      const c = classify(p, anchor, v);
      const arr = tg.attributes.position.array;
      ppos.copy(anchor); pvel.copy(v);
      const span = c.el.T < Infinity ? Math.min(c.el.T * 1.04, 80) : 22;
      const dt = span / (TN - 1);
      let n = 0;
      for (; n < TN; n++) {
        arr[n * 3] = ppos.x; arr[n * 3 + 1] = 0.02; arr[n * 3 + 2] = ppos.z;
        cosmos.stepBody(ppos, pvel, dt, 6);
        const r = ppos.length();
        if (r < SUN_RADIUS || r > 52) { n++; break; }
      }
      tg.setDrawRange(0, n); tg.attributes.position.needsUpdate = true;
      tu.uColor.value.copy(COLORS[c.cls]);
      return { ...c, v };
    }

    const onDown = (e) => {
      setNdc(e);
      const i = pick(); if (i < 0) return;
      const p = planets[i];
      grabbed = i; p.state = 'hold'; p.mode = 'hold'; p.flight = null;
      p.lifeU.uFreeze.value = 0;
      anchor.copy(p.pos); launch.set(0, 0, 0);
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
      gsap.to(p.orbitU.uBandAlpha, { value: 0.2, duration: D(0.3) });
      gsap.to(p.orbitU.uOpacity, { value: 0.55, duration: D(0.3) });
      p.atmBase = 2.4;
      audio.soft(); intro?.done(); coach?.progress();
    };
    const onMove = (e) => {
      setNdc(e);
      if (grabbed < 0) { canvas.style.cursor = pick() >= 0 ? 'grab' : 'default'; return; }
      if (!ray.ray.intersectPlane(plane, hit)) return;
      const d = anchor.clone().sub(hit); d.y = 0;
      if (d.length() > 14) d.setLength(14);
      launch.copy(d).multiplyScalar(K);
      const pa = pullG.attributes.position.array;
      pa.set([anchor.x, 0.03, anchor.z, anchor.x - d.x, 0.03, anchor.z - d.z]); pullG.attributes.position.needsUpdate = true;
      pull.material.opacity = 0.8;
      if (d.length() > 0.25) { pred = predict(planets[grabbed]); tu.uOpacity.value = 1; } else { pred = null; tu.uOpacity.value = 0; }
      coach?.progress();
    };
    const onUp = () => {
      if (grabbed < 0) return;
      const p = planets[grabbed]; grabbed = -1; canvas.style.cursor = 'default';
      tu.uOpacity.value = 0; pull.material.opacity = 0;
      gsap.to(p.orbitU.uBandAlpha, { value: 0.035, duration: D(0.5) });
      gsap.to(p.orbitU.uOpacity, { value: 0.28, duration: D(0.5) });
      p.atmBase = 1.25;
      if (!pred) return;
      p.vel.copy(pred.v); p.mode = 'physics'; p.state = 'flying';
      p.flight = { t0: performance.now() / 1000, cls: pred.cls, el: pred.el, rmin: Infinity, rmax: 0 };
      store.log('orbit_launch', { planet: p.index, cls: pred.cls, e: +pred.el.e.toFixed(3) });
      audio.whoosh();
      pred = null;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    const voices = [];
    function lock(p) {
      p.locked = true; p.state = 'locked'; p.flight = null;
      store.log('orbit_locked', { planet: p.index });
      audio.snap();
      const u = p.orbitU;
      u.uDash.value = 0;
      gsap.to(u.uColor.value, { r: GOLD.r, g: GOLD.g, b: GOLD.b, duration: D(1) });
      gsap.fromTo(u.uGlow, { value: 1 }, { value: 0.12, duration: D(2) });
      gsap.to(u.uOpacity, { value: 0.6, duration: D(0.8) });
      gsap.to(u.uBandAlpha, { value: 0, duration: D(1) });
      gsap.to(p.lifeU.uLife, { value: 1, duration: D(3.2), ease: 'power2.inOut' });
      cosmos.burstAqua.play(p.pos.clone(), 4, 0.5, 1.6);
      // each balanced planet adds its note: Kepler's period ratio, folded into one octave
      const T = 2 * Math.PI * Math.sqrt(p.R ** 3 / cosmos.GM), T0 = 2 * Math.PI * Math.sqrt(planets[0].R ** 3 / cosmos.GM);
      let f = 523.25 * (T0 / T); while (f < 220) f *= 2;
      voices.push(audio.tone(nearestNote(f), { gain: 0.022, attack: 2, pan: (p.index - 1.5) / 2 }));
      sayOnce('locked', O.locked);
      if (planets.every((q) => q.locked)) harmony();
    }
    function fail(p, kind) {
      p.state = 'dying'; p.flight = null;
      store.log('orbit_fail', { planet: p.index, kind });
      if (kind === 'fall') {
        audio.wrong();
        cosmos.burstGold.play(p.pos.clone().setLength(SUN_RADIUS + 0.3), 3, 0.2, 1.2);
        gsap.to(p.group.scale, { x: 0.001, y: 0.001, z: 0.001, duration: D(0.35) });
        sayOnce('fall', O.fall);
      } else {
        sayOnce('escape', O.escape);
        gsap.to(p.group.scale, { x: 0.001, y: 0.001, z: 0.001, duration: D(1.2) });
      }
      setTimeout(() => respawn(p), 1600);
    }
    function respawn(p) {
      p.mode = 'hold'; p.state = 'hold'; p.vel.set(0, 0, 0); p.pos.copy(spawn(p));
      p.lifeU.uFreeze.value = 0;
      gsap.to(p.group.scale, { x: 1, y: 1, z: 1, duration: D(0.9), ease: 'back.out(1.6)' });
      cosmos.burstAqua.play(p.pos.clone(), 2, 0.3, 1);
    }

    const stop = cosmos.addUpdater(() => {
      const now = performance.now() / 1000;
      for (const p of planets) {
        if (p.state !== 'flying' || !p.flight) continue;
        const f = p.flight, r = p.pos.length();
        f.rmin = Math.min(f.rmin, r); f.rmax = Math.max(f.rmax, r);
        if (r < SUN_RADIUS + p.size * 0.5) { fail(p, 'fall'); continue; }
        p.lifeU.uFreeze.value = THREE.MathUtils.clamp((r - 24) / 12, 0, 1);
        if (r > 46) { fail(p, 'escape'); continue; }
        const age = now - f.t0;
        if (f.cls === 'good' && age > Math.min(f.el.T * 0.5, 5)) lock(p);
        else if (f.cls === 'wide' && age > Math.min(f.el.T, 8) && !f.warned) { f.warned = true; sayOnce('wide', O.wide); }
      }
    });

    async function harmony() {
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      coach?.done(); intro?.done();
      store.log('orbits_done');
      await wait(1.2);
      audio.swell();
      cosmos.burstGold.play(new THREE.Vector3(), 26, 3, 3.6);
      voices.forEach((v) => v.setGain(0.04, 1));
      planets.forEach((p) => gsap.fromTo(p.orbitU.uGlow, { value: 0.8 }, { value: 0.12, duration: D(3) }));
      gsap.fromTo(cosmos.coronaOut.scale, { x: 54, y: 54 }, { x: 68, y: 68, duration: D(1.6), yoyo: true, repeat: 1, ease: 'sine.inOut' });
      gsap.to(grid.material.uniforms.uOpacity, { value: 0.12, duration: D(4) });
      rig.flyTo({ pos: new THREE.Vector3(4, 19, 33), look: new THREE.Vector3(-1, -1, 0), duration: 5, ease: 'power2.inOut' });
      await ui.caption(S1.success, 3.8);
      voices.forEach((v) => v.setGain(0.012, 3));
      stop();
      dust?.tickDust?.();
      resolve({
        anchor: () => project(new THREE.Vector3()),
        release() { voices.forEach((v) => v.stop(3)); gsap.to(grid.material.uniforms.uOpacity, { value: 0, duration: D(3), onComplete: () => { cosmos.root.remove(grid, trail, pull); grid.geometry.dispose(); } }); },
      });
    }

    // debug hook: launch every remaining planet onto its circular orbit
    window.__fitrahSolve = () => {
      planets.forEach((p) => { if (p.locked) return; cosmos.circular(p.index, Math.atan2(p.pos.z, p.pos.x)); p.state = 'flying'; p.flight = { t0: -99, cls: 'good', el: cosmos.elements(p.pos, p.vel), rmin: p.R, rmax: p.R }; });
    };
  });
}

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
