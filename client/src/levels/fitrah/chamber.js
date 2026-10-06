// The Chamber of Questions: an abstract, monumental place between thought,
// existence and discovery. A vast dark hall whose far wall opens in one immense
// circular aperture; beyond it turns a golden spiral of thousands of lights.
// Rings of light hang in the air, the dark floor reflects everything, dust drifts
// in the warm light, and a small human figure stands at its centre with a guide.
// The hall changes with each chapter (creation, purpose, practice, return); the
// states blend, so the level is one load and one continuous journey. Nothing
// here depicts the unseen: light, order, direction and a threshold are symbols.
import * as THREE from 'three';
import { PROFILE } from '../../core/scene.js';
import { createFigure } from '../../core/figures.js';

const P_SCALE = PROFILE.particles;
const N_FRAG = Math.round(720 * P_SCALE);
const N_SPIRAL = Math.round(34000 * P_SCALE);
const HALL = 34;                       // radius of the hall's wall
const AP = { y: 24, r: 21 };           // the aperture in the far wall (centre height, radius)
const SPIRAL = { at: new THREE.Vector3(0, 78, -215), R: 62 };

// ---------------------------------------------------------------- shared helpers
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.18, 'rgba(255,255,255,0.65)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.16)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
export function glowSprite(color = '#fff2d8', size = 1, opacity = 1, fog = true) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog });
  const s = new THREE.Sprite(m); s.scale.setScalar(size);
  return s;
}

// ---------------------------------------------------------------- the states of the chamber
// Each chapter is a state; the chamber blends toward it.
//   spiral    brightness of the golden spiral beyond the aperture
//   aperture  the light on the aperture's rim and the warm bounce on the wall around it
//   rings     the rings of light in the air
//   beam      the broad light falling from the aperture to the floor
export const STATES = {
  arrive:   { fog: '#07060a', fogD: 0.03,  sky: '#020204', skyHi: '#0b0710', glow: '#ff9a3c', amb: 0.06, hemi: 0.06, key: '#ffcf8c', keyI: 0.25, floor: '#050407', ring: 0.08, fragI: 0.25, shaftI: 0.0,  shaftAt: [0, 0], center: 0.0, player: 0.6, qlights: 0.0, threshold: 0.0, spiral: 0.45, aperture: 0.35, rings: 0.25, beam: 0.15, exposure: 0.95 },
  opening:  { fog: '#0a0709', fogD: 0.026, sky: '#030305', skyHi: '#120a10', glow: '#ffa448', amb: 0.1,  hemi: 0.1,  key: '#ffd49a', keyI: 0.5,  floor: '#07060a', ring: 0.22, fragI: 0.5,  shaftI: 0.15, shaftAt: [0, 0], center: 0.15, player: 1.0, qlights: 0.0, threshold: 0.0, spiral: 0.9,  aperture: 0.75, rings: 0.6,  beam: 0.35, exposure: 1.0 },
  four:     { fog: '#0b080b', fogD: 0.026, sky: '#030305', skyHi: '#130b10', glow: '#ffa64c', amb: 0.12, hemi: 0.12, key: '#ffd8a2', keyI: 0.55, floor: '#08070a', ring: 0.25, fragI: 0.5,  shaftI: 0.18, shaftAt: [0, 0], center: 0.2,  player: 1.0, qlights: 1.0, threshold: 0.0, spiral: 0.95, aperture: 0.8,  rings: 0.65, beam: 0.35, exposure: 1.0 },
  creation: { fog: '#0c090c', fogD: 0.025, sky: '#030305', skyHi: '#140c12', glow: '#ffb259', amb: 0.13, hemi: 0.14, key: '#ffe2b8', keyI: 0.7,  floor: '#08070a', ring: 0.25, fragI: 0.65, shaftI: 0.22, shaftAt: [0, 0], center: 0.25, player: 1.0, qlights: 0.3,  threshold: 0.0, spiral: 1.0,  aperture: 0.85, rings: 0.7,  beam: 0.4,  exposure: 1.0 },
  created:  { fog: '#140f0d', fogD: 0.022, sky: '#050404', skyHi: '#1c120c', glow: '#ffc06a', amb: 0.2,  hemi: 0.22, key: '#fff0d4', keyI: 1.1,  floor: '#0c0a0b', ring: 0.55, fragI: 0.9,  shaftI: 0.5,  shaftAt: [0, 0], center: 0.85, player: 0.9, qlights: 0.35, threshold: 0.0, spiral: 1.25, aperture: 1.1,  rings: 1.0,  beam: 0.7,  exposure: 1.03 },
  purpose:  { fog: '#16100b', fogD: 0.024, sky: '#050403', skyHi: '#1d130b', glow: '#ffb050', amb: 0.18, hemi: 0.2,  key: '#ffe2b4', keyI: 0.95, floor: '#0d0a08', ring: 0.3,  fragI: 0.8,  shaftI: 0.7,  shaftAt: [0, -9], center: 0.2, player: 0.9, qlights: 0.35, threshold: 0.0, spiral: 1.15, aperture: 1.0,  rings: 0.75, beam: 0.95, exposure: 1.01 },
  practice: { fog: '#1a110a', fogD: 0.024, sky: '#060403', skyHi: '#20140a', glow: '#ffa640', amb: 0.22, hemi: 0.22, key: '#ffd08a', keyI: 1.1,  floor: '#110c08', ring: 0.4,  fragI: 0.85, shaftI: 0.35, shaftAt: [0, 0], center: 0.3,  player: 0.9, qlights: 0.35, threshold: 0.0, spiral: 1.1,  aperture: 1.0,  rings: 0.85, beam: 0.6,  exposure: 1.02 },
  return:   { fog: '#07100f', fogD: 0.028, sky: '#020404', skyHi: '#071413', glow: '#9fd6d0', amb: 0.12, hemi: 0.14, key: '#c8eaee', keyI: 0.65, floor: '#040c0d', ring: 0.25, fragI: 0.55, shaftI: 0.12, shaftAt: [0, -9], center: 0.12, player: 1.0, qlights: 0.35, threshold: 1.0, spiral: 0.7,  aperture: 0.6,  rings: 0.5,  beam: 0.25, exposure: 0.98 },
  dawn:     { fog: '#16110f', fogD: 0.024, sky: '#050404', skyHi: '#1d1410', glow: '#ffcf8a', amb: 0.22, hemi: 0.24, key: '#ffe6c4', keyI: 1.05, floor: '#0d0d0e', ring: 0.4,  fragI: 0.8,  shaftI: 0.45, shaftAt: [0, -9], center: 0.35, player: 1.0, qlights: 0.35, threshold: 0.7, spiral: 1.15, aperture: 1.0,  rings: 0.85, beam: 0.7,  exposure: 1.02 },
  ending:   { fog: '#15100e', fogD: 0.022, sky: '#050404', skyHi: '#1e140e', glow: '#ffc472', amb: 0.24, hemi: 0.24, key: '#ffead0', keyI: 1.15, floor: '#0e0b0b', ring: 0.6,  fragI: 0.95, shaftI: 0.5,  shaftAt: [0, 0], center: 0.6,  player: 1.0, qlights: 1.0, threshold: 0.0, spiral: 1.3,  aperture: 1.15, rings: 1.0,  beam: 0.8,  exposure: 1.03 },
};
STATES.dark = STATES.arrive; // older name, kept for review jumps

// the four question lights stand at the far side of the hall, before the aperture
export const QUESTION_POS = [new THREE.Vector3(-7.2, 2.6, -1.8), new THREE.Vector3(-2.8, 3.6, -5.6), new THREE.Vector3(2.8, 3.6, -5.6), new THREE.Vector3(7.2, 2.6, -1.8)];
const QX = QUESTION_POS.map((p) => p.x);
export const PLAYER_LIGHT = new THREE.Vector3(0, 1.05, 6.1);
export const PLAYER_SPOT = new THREE.Vector3(0.95, 0, 6.95); // where the player's figure stands, beside its light (mirrored in Arabic)
export const CENTER = new THREE.Vector3(0, 3.0, 0);
// chapter 3: five columns of light in a shallow arc, facing the player, in reading order
export const PILLAR_POS = [-2, -1, 0, 1, 2].map((k) => {
  const a = k * 0.4, R = 5.2;               // a shallow arc whose centre is nearest the aperture
  return new THREE.Vector3(Math.sin(a) * R, 0, -2.4 - Math.cos(a) * R + R - 1.2);
});
export const THRESHOLD_POS = new THREE.Vector3(0, 4.0, -10.6);
const BACK_DIR = new THREE.Vector3(0, AP.y, -HALL).normalize(); // where the light of the place comes from

// ---------------------------------------------------------------- dust (fragment) layouts, one per chapter
const LAYOUTS = {
  void: (r) => { const a = r() * 6.283, d = 2 + r() * 8; return [Math.cos(a) * d, 0.2 + r() * 1.5, Math.sin(a) * d]; },
  drift: (r) => { const a = r() * 6.283, d = 1.6 + Math.sqrt(r()) * 12; return [Math.cos(a) * d, 0.3 + Math.pow(r(), 1.4) * 9, Math.sin(a) * d - 2]; },
  rings: (r, i, n) => {
    const radii = [2.0, 3.2, 4.4, 5.6, 6.8], ys = [4.0, 3.6, 3.2, 2.8, 2.4];
    const k = i % radii.length, a = (i / n) * 6.283 * 7.0 + k * 0.4 + r() * 0.02;
    return [Math.cos(a) * radii[k], ys[k] + (r() - 0.5) * 0.04, Math.sin(a) * radii[k]];
  },
  corridor: (r, i) => {
    const rails = [-3.6, -2.4, -1.2, 1.2, 2.4, 3.6], k = i % rails.length, t = r();
    const z = 6 - t * 22, f = (z + 16) / 22;
    return [rails[k] * (0.12 + 0.88 * f), 0.35 + (Math.floor(i / rails.length) % 4) * 0.9 * (0.3 + 0.7 * f) + 1.6 * (1 - f), z];
  },
  pillars: (r, i) => {
    const k = i % 6;
    if (k === 5) { const a = -0.8 + r() * 1.6; return [Math.sin(a) * 5.2, 6.1 + (r() - 0.5) * 0.06, -3.6 - Math.cos(a) * 5.2 + 5.2]; } // the roof arc
    const p = PILLAR_POS[k];
    const a = r() * 6.283, d = 0.18 + r() * 0.12;
    return [p.x + Math.cos(a) * d, 0.1 + r() * 5.8, p.z + Math.sin(a) * d];
  },
  low: (r) => { const a = r() * 6.283, d = 1.5 + Math.sqrt(r()) * 12; return [Math.cos(a) * d, 0.06 + r() * 1.2, Math.sin(a) * d]; },
  ordered: (r, i, n) => {
    const k = i % 3;
    if (k < 2) { const rad = k ? 7.4 : 5.2, a = (i / n) * 6.283 * 3 + k; return [Math.cos(a) * rad, 3.0 + k * 0.8, Math.sin(a) * rad]; }
    const a = (i / n) * 6.283 * 9; return [Math.cos(a) * 2.2, 4.4 + Math.sin(i) * 0.05, Math.sin(a) * 2.2];
  },
};
function layoutArray(name) {
  const r = rng(7 + name.length * 131), out = new Float32Array(N_FRAG * 3), f = LAYOUTS[name];
  for (let i = 0; i < N_FRAG; i++) out.set(f(r, i, N_FRAG), i * 3);
  return out;
}

const FRAG_VS = /* glsl */`
  attribute vec3 aFrom; attribute vec3 aTo; attribute float aSeed; attribute float aSize;
  uniform float uMix, uTime, uDrift, uMirror, uScale;
  varying vec2 vUv; varying float vSeed; varying float vFade;
  void main() {
    vUv = uv; vSeed = aSeed;
    float m = smoothstep(aSeed * 0.45, aSeed * 0.45 + 0.55, uMix);
    vec3 p = mix(aFrom, aTo, m);
    float s = aSeed * 6.2831;
    p += vec3(sin(uTime * 0.21 + s), sin(uTime * 0.17 + s * 1.7) * 0.5, cos(uTime * 0.19 + s * 1.3)) * uDrift * (0.25 + aSeed * 0.75);
    p.y *= uMirror;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = clamp(1.0 - (-mv.z - 4.0) / 30.0, 0.12, 1.0);
    mv.xy += position.xy * aSize * uScale;
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG_FS = /* glsl */`
  uniform vec3 uColor; uniform float uIntensity, uTime;
  varying vec2 vUv; varying float vSeed; varying float vFade;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
    float tw = 0.85 + 0.15 * sin(uTime * (0.6 + vSeed * 1.2) + vSeed * 40.0); // a slow shimmer, never a flicker
    gl_FragColor = vec4(uColor * a * uIntensity * tw * vFade * 1.5, a);
  }`;

// ---------------------------------------------------------------- the golden spiral
function spiralGeometry(n, R) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n);
  const r = rng(42), arms = 3, g = () => (r() + r() + r() - 1.5) / 1.5;
  const cCore = new THREE.Color('#fff2d6'), cGold = new THREE.Color('#ffc163'), cAmber = new THREE.Color('#ff8a2e'), cDeep = new THREE.Color('#b0461a'), tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const halo = r() < 0.16;
    const t = halo ? Math.pow(r(), 0.8) : 0.03 + 0.97 * Math.pow(r(), 1.35);
    let ang, rad = t * R;
    if (halo) ang = r() * Math.PI * 2;
    else {
      const arm = Math.floor(r() * arms);
      ang = arm * (Math.PI * 2 / arms) + t * Math.PI * 2.6 + Math.log(1 + t * 9) * 0.6;
      ang += g() * (0.12 + 0.3 * t);
      rad *= 1 + g() * 0.08;
    }
    const thick = (1 - t) * R * 0.035 + R * 0.004;
    pos[i * 3] = Math.cos(ang) * rad; pos[i * 3 + 1] = g() * thick; pos[i * 3 + 2] = Math.sin(ang) * rad;
    if (t < 0.18) tmp.copy(cCore).lerp(cGold, t / 0.18); else if (t < 0.55) tmp.copy(cGold).lerp(cAmber, (t - 0.18) / 0.37); else tmp.copy(cAmber).lerp(cDeep, Math.min(1, (t - 0.55) / 0.45));
    const b = (halo ? 0.3 : 1.0) * (0.55 + 0.45 * Math.sin(Math.min(1, t * 2.2) * 1.57)) * (1.05 - t * 0.55) * (0.55 + r() * 0.55) * 0.42;
    col[i * 3] = tmp.r * b; col[i * 3 + 1] = tmp.g * b; col[i * 3 + 2] = tmp.b * b;
    size[i] = (0.5 + Math.pow(r(), 3) * 2.2) * (1.5 - t * 0.7) * (halo ? 0.8 : 1);
    seed[i] = r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return geo;
}
const SPIRAL_VS = /* glsl */`
  attribute vec3 aColor; attribute float aSize; attribute float aSeed;
  uniform float uTime, uI, uScale, uRot; varying vec3 vColor;
  void main(){
    float c = cos(uRot), s = sin(uRot);
    vec3 p = position; p.xz = mat2(c, -s, s, c) * p.xz;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float tw = 0.88 + 0.12 * sin(uTime * (0.35 + aSeed * 0.5) + aSeed * 60.0);
    vColor = aColor * tw * uI;
    gl_PointSize = max(1.0, aSize * uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const SPIRAL_FS = /* glsl */`
  varying vec3 vColor;
  void main(){ vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d) * 4.0; float g = exp(-r2 * 3.5); if (g < 0.02) discard; gl_FragColor = vec4(vColor * g, 1.0); }`;

// ---------------------------------------------------------------- build
export function createChamber(scene) {
  const root = new THREE.Group(); root.name = 'chamber';
  scene.add(root);
  const P = {};
  for (const [k, v] of Object.entries(STATES.arrive)) P[k] = typeof v === 'string' ? new THREE.Color(v) : Array.isArray(v) ? v.slice() : v;
  let target = STATES.arrive, tau = 1;

  scene.fog = new THREE.FogExp2(P.fog.clone(), P.fogD);
  scene.background = P.sky.clone();

  // ------------------------------------------------ lights
  const amb = new THREE.AmbientLight('#8a7f88', 0.1);
  const hemi = new THREE.HemisphereLight('#ffd9a8', '#0c0a10', 0.1);
  const key = new THREE.SpotLight('#ffffff', 0, 70, 0.8, 0.7, 1.2);  // from the aperture: the rim light of the place
  key.position.set(0, AP.y, -HALL + 2); key.target.position.set(0, 0, 4);
  const centerLight = new THREE.PointLight('#fff2d8', 0, 18, 1.6); centerLight.position.copy(CENTER);
  root.add(amb, hemi, key, key.target, centerLight);

  // ------------------------------------------------ the sky beyond: deep black, a warm haze around the spiral
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSky: { value: P.sky.clone() }, uHi: { value: P.skyHi.clone() }, uGlow: { value: P.glow.clone() }, uGlowI: { value: 0 }, uDir: { value: SPIRAL.at.clone().normalize() }, uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`uniform vec3 uSky, uHi, uGlow, uDir; uniform float uGlowI, uTime; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){ vec3 d = normalize(vD);
        vec3 c = mix(uSky, uHi, smoothstep(-0.05, 0.5, d.y));
        float a = max(dot(d, uDir), 0.0);
        float neb = n3(d * 4.0 + vec3(0.0, uTime * 0.004, 0.0)) * 0.6 + n3(d * 9.0) * 0.4;
        c += uGlow * (pow(a, 10.0) * 0.022 + pow(a, 90.0) * 0.06) * uGlowI * (0.7 + 0.6 * neb);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), skyMat); sky.renderOrder = -20; sky.frustumCulled = false;
  root.add(sky);

  // ------------------------------------------------ the golden spiral, far beyond the aperture (and its reflection)
  const spiralUniforms = { uTime: { value: 0 }, uI: { value: 0 }, uScale: { value: 400 }, uRot: { value: 0 } };
  const spiralMat = new THREE.ShaderMaterial({ uniforms: spiralUniforms, vertexShader: SPIRAL_VS, fragmentShader: SPIRAL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const spiralGeo = spiralGeometry(N_SPIRAL, SPIRAL.R);
  const spiral = new THREE.Points(spiralGeo, spiralMat); spiral.frustumCulled = false; spiral.renderOrder = -10;
  spiral.position.copy(SPIRAL.at); spiral.rotation.set(0.62, 0, 0.16); // seen at an angle: a vast turning disc
  root.add(spiral);
  const spiralMirrorUniforms = { ...spiralUniforms, uI: { value: 0 } };
  const spiralMirror = new THREE.Points(spiralGeo, new THREE.ShaderMaterial({ uniforms: spiralMirrorUniforms, vertexShader: SPIRAL_VS, fragmentShader: SPIRAL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  spiralMirror.frustumCulled = false; spiralMirror.position.set(SPIRAL.at.x, -SPIRAL.at.y, SPIRAL.at.z); spiralMirror.rotation.set(-0.62, 0, -0.16); spiralMirror.renderOrder = -10;
  root.add(spiralMirror);
  const core1 = glowSprite('#ffe2b0', 22, 0, false), core2 = glowSprite('#ff9d45', 40, 0, false);
  core1.position.copy(SPIRAL.at); core2.position.copy(SPIRAL.at); core1.renderOrder = core2.renderOrder = -9;
  root.add(core2, core1);

  // ------------------------------------------------ the hall: a vast curved wall with one circular aperture
  const wallMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: false, fog: false,
    uniforms: { uFog: { value: P.fog.clone() }, uGlow: { value: P.glow.clone() }, uAp: { value: 0 }, uMirror: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`uniform vec3 uFog, uGlow; uniform float uAp, uMirror, uTime; varying vec3 vW;
      void main(){
        float y = vW.y * uMirror;
        float az = atan(vW.x, -vW.z);                  // 0 straight ahead (toward -z)
        vec2 q = vec2(az * ${HALL.toFixed(1)}, y - ${AP.y.toFixed(1)});
        float d = length(q) - ${AP.r.toFixed(1)};
        if (d < 0.0) discard;                          // the aperture: the spiral shows through
        // dark warm stone; broad bands and seams, barely there
        vec3 c = vec3(0.022, 0.018, 0.02);
        float band = smoothstep(0.06, 0.0, abs(fract(y / 7.0) - 0.5) - 0.44) * 0.35;
        float seam = smoothstep(0.08, 0.0, abs(fract(az * ${(HALL / 9).toFixed(3)}) - 0.5) - 0.46) * 0.25;
        c *= 1.0 + band + seam;
        // the warm light of the aperture on the wall around it, and the bright rim itself
        float bounce = exp(-d / 7.0) * 0.4 + exp(-d / 24.0) * 0.12;
        float rim = smoothstep(0.9, 0.0, d) + smoothstep(3.5, 0.0, d) * 0.25;
        c += uGlow * (bounce * 0.16 + rim * 0.9) * uAp;
        // concentric rings carved around the aperture
        float rings = smoothstep(0.12, 0.0, abs(fract(d / 3.2 + 0.1) - 0.5) - 0.45) * exp(-d / 12.0);
        c += uGlow * rings * 0.05 * uAp;
        // haze near the floor
        c = mix(c, uFog, 0.25 + 0.5 * smoothstep(9.0, 0.0, y));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const wallGeo = new THREE.CylinderGeometry(HALL, HALL, 72, 160, 1, true); wallGeo.translate(0, 36, 0);
  const wall = new THREE.Mesh(wallGeo, wallMat); root.add(wall);
  const wallMirrorMat = wallMat.clone(); wallMirrorMat.uniforms = { ...wallMat.uniforms, uMirror: { value: -1 } }; wallMirrorMat.side = THREE.FrontSide;
  const wallMirror = new THREE.Mesh(wallGeo, wallMirrorMat); wallMirror.scale.y = -1; root.add(wallMirror);

  // ------------------------------------------------ the floor: dark and polished, concentric inlays of light
  const floorMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: true,
    uniforms: { uColor: { value: new THREE.Color('#06070c') }, uRing: { value: 0 }, uRingColor: { value: new THREE.Color('#f0c27a') }, uTime: { value: 0 }, uFog: { value: new THREE.Color('#05060b') } },
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uRingColor, uFog; uniform float uRing, uTime; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      void main(){
        float r = length(vW.xz);
        float rings = 0.0;
        for (int i = 1; i <= 5; i++) { float rr = float(i) * 2.0; rings += smoothstep(0.035, 0.0, abs(r - rr)) * (1.0 - float(i) * 0.12); }
        rings += smoothstep(0.06, 0.0, abs(r - 15.0)) * 0.5 + smoothstep(0.08, 0.0, abs(r - 24.0)) * 0.3;
        float spokes = smoothstep(0.02, 0.0, abs(sin(atan(vW.z, vW.x + 1e-4) * 2.5))) * smoothstep(10.5, 2.0, r) * step(1.9, r) * 0.35;
        vec3 c = uColor * (1.0 + 0.05 * h(floor(vW.xz * 18.0)));
        float flow = 0.6 + 0.4 * sin(uTime * 0.4 - r * 0.7);
        c += uRingColor * (rings + spokes) * uRing * flow;
        c = mix(c, uFog, smoothstep(14.0, 33.0, r) * 0.8);
        gl_FragColor = vec4(c, mix(0.8, 0.94, smoothstep(6.0, 30.0, r)));
      }`,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(HALL, 160), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = 1;
  root.add(floor);

  // ------------------------------------------------ rings of light in the air (orbits, slowly turning)
  const ringDefs = [
    { R: 9.5, w: 0.07, y: 8.2, rx: 1.42, ry: 0.0, rz: 0.06, speed: 0.025, beads: 2 },
    { R: 15, w: 0.09, y: 12.5, rx: 1.3, ry: 0.5, rz: -0.08, speed: -0.016, beads: 3 },
    { R: 6.2, w: 0.05, y: 6.0, rx: 1.5, ry: 0.0, rz: -0.1, speed: 0.04, beads: 1 },
    { R: 23, w: 0.12, y: 18, rx: 1.48, ry: 0.0, rz: 0.03, speed: 0.008, beads: 4 },
  ];
  const ringMats = [];
  const rings = ringDefs.map((d) => {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uI: { value: 0 }, uColor: { value: new THREE.Color('#ffcf86') }, uTime: { value: 0 }, uBeads: { value: d.beads }, uSpeed: { value: d.speed * 8.0 } },
      vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`uniform float uI, uTime, uBeads, uSpeed; uniform vec3 uColor; varying vec2 vUv; varying vec3 vP;
        void main(){ float r = length(vP.xy); float a = atan(vP.y, vP.x);
          float edge = fract(vUv.x * 0.0 + 0.0);
          float bead = pow(max(0.5 + 0.5 * cos(a * uBeads - uTime * uSpeed), 0.0), 30.0);
          gl_FragColor = vec4(uColor * (0.55 + bead * 1.6) * uI, 1.0); }`,
    });
    // a soft-edged band: the glow falls off across its width
    const geo = new THREE.RingGeometry(d.R - d.w, d.R + d.w, 320, 1);
    m.fragmentShader = m.fragmentShader.replace('float edge = fract(vUv.x * 0.0 + 0.0);', 'float edge = 1.0 - abs((r - ' + d.R.toFixed(2) + ') / ' + d.w.toFixed(3) + ');')
      .replace('gl_FragColor = vec4(uColor * (0.55 + bead * 1.6) * uI, 1.0);', 'gl_FragColor = vec4(uColor * (0.55 + bead * 1.6) * uI * pow(max(edge, 0.0), 1.5), 1.0);');
    const halo = new THREE.Mesh(new THREE.RingGeometry(d.R - d.w * 9, d.R + d.w * 9, 320, 1), m.clone());
    halo.material.uniforms = { ...m.uniforms, uI: { value: 0 } };
    halo.material.fragmentShader = m.fragmentShader.replace(d.w.toFixed(3) + ');', (d.w * 9).toFixed(3) + ');');
    const mesh = new THREE.Mesh(geo, m);
    const g = new THREE.Group(); g.position.set(0, d.y, -1); g.rotation.set(d.rx, d.ry, d.rz);
    g.add(mesh, halo); root.add(g);
    ringMats.push(m, halo.material);
    return { g, mesh, halo, d };
  });

  // ------------------------------------------------ dust in the light (and its reflection)
  const fragGeo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  fragGeo.index = base.index; fragGeo.attributes.position = base.attributes.position; fragGeo.attributes.uv = base.attributes.uv;
  const seeds = new Float32Array(N_FRAG), sizes = new Float32Array(N_FRAG); const r0 = rng(99);
  for (let i = 0; i < N_FRAG; i++) { seeds[i] = r0(); sizes[i] = 0.035 + Math.pow(r0(), 3) * 0.12; }
  let layoutName = 'drift';
  const fromAttr = new THREE.InstancedBufferAttribute(layoutArray('drift'), 3);
  const toAttr = new THREE.InstancedBufferAttribute(layoutArray('drift'), 3);
  fragGeo.setAttribute('aFrom', fromAttr); fragGeo.setAttribute('aTo', toAttr);
  fragGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  fragGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 1));
  fragGeo.instanceCount = N_FRAG;
  const fragUniforms = { uMix: { value: 1 }, uTime: { value: 0 }, uDrift: { value: 0.6 }, uMirror: { value: 1 }, uScale: { value: 1 }, uColor: { value: new THREE.Color('#ffeccc') }, uIntensity: { value: 0 } };
  const fragMat = new THREE.ShaderMaterial({ uniforms: fragUniforms, vertexShader: FRAG_VS, fragmentShader: FRAG_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const frags = new THREE.Mesh(fragGeo, fragMat); frags.frustumCulled = false; frags.renderOrder = 3;
  const mirrorUniforms = { ...fragUniforms, uMirror: { value: -1 }, uIntensity: { value: 0 } };
  const fragsMirror = new THREE.Mesh(fragGeo, new THREE.ShaderMaterial({ uniforms: mirrorUniforms, vertexShader: FRAG_VS, fragmentShader: FRAG_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  fragsMirror.frustumCulled = false;
  root.add(frags, fragsMirror);
  let mixT = 1, mixDur = 1;
  function setLayout(name, seconds = 6) {
    if (name === layoutName || !LAYOUTS[name]) return;
    fromAttr.array.set(mixT >= 1 ? toAttr.array : fromAttr.array);
    toAttr.array.set(layoutArray(name));
    fromAttr.needsUpdate = true; toAttr.needsUpdate = true;
    layoutName = name; mixT = 0; mixDur = Math.max(0.01, seconds);
  }

  // ------------------------------------------------ light: a shaft from above, and the broad fall of light from the aperture
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: false,
    uniforms: { uColor: { value: new THREE.Color('#fff1d6') }, uI: { value: 0 }, uTime: { value: 0 }, uK: { value: 0.13 } },
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`uniform vec3 uColor; uniform float uI, uTime, uK; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float n(float x){ return sin(x) * 0.5 + 0.5; }
      void main(){ float facing = abs(dot(vN, vV)); float body = pow(facing, 2.5);
        float streak = 0.7 + 0.3 * n(vUv.x * 40.0 + uTime * 0.3) * n(vUv.x * 13.0 - uTime * 0.2);
        float a = body * smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.6, vUv.y) * streak * uI * uK;
        gl_FragColor = vec4(uColor * a, a); }`,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 3.4, 16, 48, 1, true), shaftMat);
  shaft.position.set(0, 8, 0); root.add(shaft);
  // the beam: from the aperture down across the hall toward the player
  const beamMat = shaftMat.clone(); beamMat.uniforms = { uColor: { value: new THREE.Color('#ffc77a') }, uI: { value: 0 }, uTime: shaftMat.uniforms.uTime, uK: { value: 0.012 } };
  const beamGeo = new THREE.CylinderGeometry(AP.r * 0.75, 4.5, 46, 64, 1, true);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  const beamFrom = new THREE.Vector3(0, AP.y, -HALL), beamTo = new THREE.Vector3(0, 0.0, 4);
  beam.position.copy(beamFrom).add(beamTo).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), beamTo.clone().sub(beamFrom).normalize());
  beam.scale.y = beamFrom.distanceTo(beamTo) / 46;
  root.add(beam);

  // ------------------------------------------------ the light of the place: a soft glow at the centre
  const centerGlow = glowSprite('#fff0d0', 3.2, 0); centerGlow.position.copy(CENTER); root.add(centerGlow);

  // ------------------------------------------------ the player: a person standing, and the small light before them
  const player = createFigure('player');
  player.group.position.copy(PLAYER_SPOT);
  root.add(player.group);
  const playerGlow = glowSprite('#fff4e0', 0.55, 0); playerGlow.position.copy(PLAYER_LIGHT); root.add(playerGlow);
  const playerCore = glowSprite('#ffffff', 0.16, 0); playerCore.position.copy(PLAYER_LIGHT); root.add(playerCore);
  const playerMirror = glowSprite('#fff4e0', 0.5, 0); playerMirror.position.set(PLAYER_LIGHT.x, -PLAYER_LIGHT.y, PLAYER_LIGHT.z); root.add(playerMirror);
  let playerSide = 1;

  // ------------------------------------------------ the four question lights
  const qlights = QUESTION_POS.map((p) => {
    const g = new THREE.Group(); g.position.copy(p);
    const halo = glowSprite('#dfe4ff', 2.1, 0), core = glowSprite('#ffffff', 0.42, 0);
    const mirror = glowSprite('#dfe4ff', 1.2, 0); mirror.position.y = -p.y * 2;
    g.add(halo, core, mirror); root.add(g);
    return { group: g, halo, core, mirror, lit: 0, litT: 0, shown: 1, shownT: 1, focus: 0, focusT: 0 };
  });

  // ------------------------------------------------ the threshold of chapter 4: a tall opening of soft light
  const thrMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uI: { value: 0 }, uColor: { value: new THREE.Color('#e9f6ff') }, uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`uniform float uI, uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){ vec2 p = vUv - 0.5;
        float hy = smoothstep(-0.5, -0.38, p.y) * (1.0 - smoothstep(0.18, 0.5, p.y));
        float wide = 1.0 - smoothstep(0.1, 0.5, abs(p.x));
        float px = p.x * 7.0; float core = exp(-px * px) * (0.85 + 0.15 * sin(uTime * 0.6 + p.y * 3.0));
        float a = (wide * 0.22 + core * 0.7) * hy * uI;
        gl_FragColor = vec4(uColor * a, a); }`,
  });
  const threshold = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 9.0), thrMat);
  threshold.position.set(0, 4.3, -10.6); root.add(threshold);
  const thrMirror = new THREE.Mesh(threshold.geometry, thrMat); thrMirror.position.set(0, -4.3, -10.6); thrMirror.scale.y = -1; root.add(thrMirror);

  // ---------------------------------------------------------------- update
  const tmpC = new THREE.Color(), rimC = new THREE.Color();
  function setState(name, seconds = 6) { target = STATES[name] || STATES.arrive; tau = Math.max(0.05, seconds / 3); P.name = name; }
  function lerpTo(dt) {
    const k = 1 - Math.exp(-dt / tau);
    for (const [kname, v] of Object.entries(target)) {
      if (typeof v === 'string') P[kname].lerp(tmpC.set(v), k);
      else if (Array.isArray(v)) { P[kname][0] += (v[0] - P[kname][0]) * k; P[kname][1] += (v[1] - P[kname][1]) * k; }
      else P[kname] += (v - P[kname]) * k;
    }
  }
  const lampPos = new THREE.Vector3(0, -50, 0);
  function update(dt, t, renderer, camera) {
    lerpTo(dt);
    scene.fog.color.copy(P.fog); scene.fog.density = P.fogD; scene.background.copy(P.sky);
    amb.intensity = P.amb; hemi.intensity = P.hemi;
    key.color.copy(P.key); key.intensity = P.keyI * 90;
    centerLight.intensity = P.center * 14; centerLight.color.copy(P.key);
    skyMat.uniforms.uSky.value.copy(P.sky); skyMat.uniforms.uHi.value.copy(P.skyHi); skyMat.uniforms.uGlow.value.copy(P.glow);
    skyMat.uniforms.uGlowI.value = P.spiral; skyMat.uniforms.uTime.value = t;
    if (camera) sky.position.copy(camera.position);
    // the spiral turns slowly; its points keep a constant apparent size whatever the lens
    const H = renderer ? renderer.domElement.clientHeight || window.innerHeight : window.innerHeight;
    const fov = camera ? camera.fov : 50;
    spiralUniforms.uScale.value = H / (2 * Math.tan((fov * Math.PI) / 360));
    spiralUniforms.uRot.value = t * 0.0045; spiralUniforms.uTime.value = t; spiralUniforms.uI.value = P.spiral;
    spiralMirrorUniforms.uI.value = P.spiral * 0.07;
    core1.material.opacity = P.spiral * 0.16; core2.material.opacity = P.spiral * 0.025;
    core1.material.color.copy(P.glow).lerp(tmpC.set('#ffffff'), 0.55); core2.material.color.copy(P.glow);
    wallMat.uniforms.uFog.value.copy(P.fog); wallMat.uniforms.uGlow.value.copy(P.glow); wallMat.uniforms.uAp.value = P.aperture;
    floorMat.uniforms.uColor.value.copy(P.floor); floorMat.uniforms.uRing.value = P.ring; floorMat.uniforms.uTime.value = t; floorMat.uniforms.uFog.value.copy(P.fog);
    floorMat.uniforms.uRingColor.value.copy(P.glow).lerp(tmpC.set('#ffe0a8'), 0.5);
    for (const rg of rings) {
      rg.mesh.rotation.z = t * rg.d.speed;
      rg.halo.rotation.z = rg.mesh.rotation.z;
      rg.mesh.material.uniforms.uI.value = P.rings * 0.85; rg.halo.material.uniforms.uI.value = P.rings * 0.07;
      rg.mesh.material.uniforms.uTime.value = t;
      rg.mesh.material.uniforms.uColor.value.copy(P.glow).lerp(tmpC.set('#ffe6b8'), 0.45);
    }
    mixT = Math.min(1, mixT + dt / mixDur);
    fragUniforms.uMix.value = mixT; fragUniforms.uTime.value = t; fragUniforms.uIntensity.value = P.fragI;
    mirrorUniforms.uIntensity.value = P.fragI * 0.3;
    fragUniforms.uColor.value.copy(P.key).lerp(tmpC.set('#ffffff'), 0.4);
    shaftMat.uniforms.uI.value = P.shaftI; shaftMat.uniforms.uTime.value = t; shaftMat.uniforms.uColor.value.copy(P.key);
    shaft.position.x = P.shaftAt[0]; shaft.position.z = P.shaftAt[1];
    beamMat.uniforms.uI.value = P.beam; beamMat.uniforms.uColor.value.copy(P.glow);
    centerGlow.material.opacity = P.center * 0.7; centerGlow.scale.setScalar(2.2 + P.center * 1.4 + Math.sin(t * 0.6) * 0.08);
    const pl = P.player * (0.85 + 0.15 * Math.sin(t * 1.3));
    playerGlow.material.opacity = pl; playerCore.material.opacity = pl; playerMirror.material.opacity = pl * 0.3;
    // the player's figure: still, facing the aperture; the light of the place outlines them
    lampPos.copy(PLAYER_LIGHT);
    player.group.position.x = PLAYER_SPOT.x * playerSide;
    player.update(dt, t, { yaw: 0, lampPos, backDir: BACK_DIR });
    player.setRim(rimC.copy(P.glow).lerp(tmpC.set('#fff0d8'), 0.5), 0.85 + P.aperture * 0.35);
    thrMat.uniforms.uI.value = P.threshold; thrMat.uniforms.uTime.value = t;
    for (const ql of qlights) {
      const kk = 1 - Math.exp(-dt * 1.5);
      ql.litT += (ql.lit - ql.litT) * kk; ql.shownT += (ql.shown - ql.shownT) * kk; ql.focusT += (ql.focus - ql.focusT) * kk;
      const b = P.qlights * ql.shownT * (0.8 + 0.2 * Math.sin(t * 0.9 + ql.group.position.x)) * (1 + ql.focusT * 0.35 * (0.6 + 0.4 * Math.sin(t * 2.2)));
      const warm = ql.litT * ql.shownT;
      ql.halo.material.color.set('#dfe4ff').lerp(tmpC.set('#f6c77d'), ql.litT);
      ql.halo.material.opacity = Math.max(b, warm * 0.9) * 0.85; ql.core.material.opacity = Math.min(1, Math.max(b, warm));
      ql.halo.scale.setScalar(2.1 * (1 + ql.focusT * 0.25));
      ql.mirror.material.opacity = Math.max(b, warm) * 0.25;
      ql.mirror.material.color.copy(ql.halo.material.color);
    }
    if (renderer) renderer.toneMappingExposure = P.exposure;
  }

  return {
    root, P, setState, setLayout, update, qlights, floor, player,
    parts: { sky, spiral, wall, beam, shaft, rings, frags },
    get layout() { return layoutName; },
    /** on a narrow screen the four question lights stand closer together, so all four fit */
    fitQuestions(aspect) {
      const k = aspect < 0.8 ? 0.5 : aspect < 1.2 ? 0.75 : 1;
      QUESTION_POS.forEach((p, i) => { p.x = QX[i] * k; qlights[i].group.position.x = p.x; });
    },
    /** the player's figure stands on the side away from Dalil (1 = right, -1 = left) */
    setPlayerSide(s) { playerSide = s; },
    setQuestionLit(i, on) { if (qlights[i]) qlights[i].lit = on ? 1 : 0; },
    setQuestionShown(i, on, instant = false) { const q = qlights[i]; if (!q) return; q.shown = on ? 1 : 0; if (instant) q.shownT = q.shown; },
    setQuestionFocus(i) { qlights.forEach((q, k) => { q.focus = k === i ? 1 : 0; }); },
    resetQuestions(lit = 0, shown = 1) { qlights.forEach((q, k) => { q.lit = q.litT = k < lit ? 1 : 0; q.shown = q.shownT = shown; q.focus = q.focusT = 0; }); },
    snap(name) { setState(name, 0.2); for (let i = 0; i < 40; i++) lerpTo(0.05); },
    backDir: BACK_DIR,
  };
}
