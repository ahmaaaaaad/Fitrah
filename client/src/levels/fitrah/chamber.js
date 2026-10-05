// The Chamber of Questions: one abstract, monumental space that transforms with
// each chapter (creation, purpose, practice, return). A circular hall of matte
// stone planes and slits of light, a dark reflective floor, suspended fragments
// of light. Geometry is procedural; states blend smoothly, so the whole level is
// one load and one continuous journey. Nothing here depicts the unseen: light,
// order, direction, structure and a threshold are symbols, shown as symbols.
import * as THREE from 'three';
import { QUALITY } from '../../core/scene.js';

const R = 12.5;            // wall radius
const N_WALL = 28;
const LOW = QUALITY === 'low';
const N_FRAG = LOW ? 320 : 640;

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
export function glowSprite(color = '#fff2d8', size = 1, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const s = new THREE.Sprite(m); s.scale.setScalar(size);
  return s;
}

// ---------------------------------------------------------------- the states of the chamber
// Each chapter is a state; the chamber blends toward it. Colours are linear-ish display colours.
export const STATES = {
  dark:     { fog: '#04050a', fogD: 0.09,  amb: 0.04, hemi: 0.05, key: '#9aa6ff', keyI: 0.0, slit: '#2c3358', slitI: 0.12, floor: '#05060b', ring: 0.0,  fragI: 0.0,  shaftI: 0.0,  shaftAt: [0, 0], center: 0.0, player: 0.0, qlights: 0.0, threshold: 0.0, exposure: 0.85 },
  opening:  { fog: '#070915', fogD: 0.062, amb: 0.10, hemi: 0.12, key: '#aab4ff', keyI: 0.45, slit: '#5966a8', slitI: 0.55, floor: '#070912', ring: 0.08, fragI: 0.45, shaftI: 0.18, shaftAt: [0, 0], center: 0.15, player: 1.0, qlights: 0.0, threshold: 0.0, exposure: 0.92 },
  four:     { fog: '#080b18', fogD: 0.055, amb: 0.12, hemi: 0.14, key: '#b6bfff', keyI: 0.55, slit: '#6c79bd', slitI: 0.7, floor: '#080a14', ring: 0.12, fragI: 0.5,  shaftI: 0.22, shaftAt: [0, 0], center: 0.2,  player: 1.0, qlights: 1.0, threshold: 0.0, exposure: 0.95 },
  creation: { fog: '#0a0c1b', fogD: 0.05,  amb: 0.14, hemi: 0.16, key: '#dfe3ff', keyI: 0.8, slit: '#8f9be0', slitI: 0.85, floor: '#090b16', ring: 0.14, fragI: 0.65, shaftI: 0.28, shaftAt: [0, 0], center: 0.3,  player: 1.0, qlights: 0.3, threshold: 0.0, exposure: 0.98 },
  created:  { fog: '#121222', fogD: 0.042, amb: 0.2,  hemi: 0.22, key: '#fff0d4', keyI: 1.2, slit: '#e6c891', slitI: 1.1, floor: '#0d0d18', ring: 0.45, fragI: 0.95, shaftI: 0.55, shaftAt: [0, 0], center: 0.9,  player: 0.9, qlights: 0.35, threshold: 0.0, exposure: 1.02 },
  purpose:  { fog: '#17140f', fogD: 0.04,  amb: 0.2,  hemi: 0.2,  key: '#ffe7c2', keyI: 1.0, slit: '#d8c7a6', slitI: 0.95, floor: '#0f0d0b', ring: 0.1,  fragI: 0.8,  shaftI: 0.75, shaftAt: [0, -9], center: 0.2, player: 0.9, qlights: 0.35, threshold: 0.0, exposure: 1.0 },
  practice: { fog: '#1b120a', fogD: 0.04,  amb: 0.24, hemi: 0.22, key: '#ffd08a', keyI: 1.15, slit: '#f0bf72', slitI: 1.05, floor: '#120c08', ring: 0.3,  fragI: 0.95, shaftI: 0.45, shaftAt: [0, 0], center: 0.55, player: 0.9, qlights: 0.35, threshold: 0.0, exposure: 1.02 },
  return:   { fog: '#061419', fogD: 0.05,  amb: 0.12, hemi: 0.14, key: '#bfe6ee', keyI: 0.7, slit: '#4f8e9a', slitI: 0.6, floor: '#04161b', ring: 0.18, fragI: 0.55, shaftI: 0.15, shaftAt: [0, -9], center: 0.15, player: 1.0, qlights: 0.35, threshold: 1.0, exposure: 0.96 },
  dawn:     { fog: '#1a1418', fogD: 0.04,  amb: 0.24, hemi: 0.26, key: '#ffe2bd', keyI: 1.1, slit: '#f4d3a2', slitI: 1.05, floor: '#0f1416', ring: 0.3,  fragI: 0.85, shaftI: 0.5,  shaftAt: [0, -9], center: 0.4, player: 1.0, qlights: 0.35, threshold: 0.7, exposure: 1.02 },
  ending:   { fog: '#16121a', fogD: 0.038, amb: 0.26, hemi: 0.26, key: '#ffe9c8', keyI: 1.2, slit: '#f2d6a8', slitI: 1.15, floor: '#100e14', ring: 0.5,  fragI: 1.0,  shaftI: 0.55, shaftAt: [0, 0], center: 0.8,  player: 1.0, qlights: 1.0, threshold: 0.0, exposure: 1.04 },
};

// the four question lights stand at the far side of the hall
export const QUESTION_POS = [new THREE.Vector3(-6.4, 2.7, -2.4), new THREE.Vector3(-2.4, 3.5, -6.0), new THREE.Vector3(2.4, 3.5, -6.0), new THREE.Vector3(6.4, 2.7, -2.4)];
export const PLAYER_LIGHT = new THREE.Vector3(0, 1.05, 6.1);
export const CENTER = new THREE.Vector3(0, 3.0, 0);
// where the five columns of light stand in chapter 3 (the 'pillars' layout); the first at the back
export const PILLAR_POS = [0, 1, 2, 3, 4].map((k) => {
  const a = Math.PI / 2 + k * (2 * Math.PI / 5) + Math.PI;
  return new THREE.Vector3(Math.cos(a) * 4.2, 0, Math.sin(a) * 4.2 - 1.0);
});
export const THRESHOLD_POS = new THREE.Vector3(0, 4.0, -10.6);

// ---------------------------------------------------------------- fragment layouts
const LAYOUTS = {
  void: (r, i) => { const a = r() * 6.283, d = 2 + r() * 6; return [Math.cos(a) * d, -2 - r() * 2, Math.sin(a) * d]; },
  drift: (r) => { const a = r() * 6.283, d = 1.6 + Math.sqrt(r()) * 9; return [Math.cos(a) * d, 0.4 + r() * 6.8, Math.sin(a) * d]; },
  rings: (r, i, n) => {
    const radii = [2.0, 3.2, 4.4, 5.6, 6.8], ys = [4.0, 3.6, 3.2, 2.8, 2.4];
    const k = i % radii.length, a = (i / n) * 6.283 * 7.0 + k * 0.4 + r() * 0.02;
    return [Math.cos(a) * radii[k], ys[k] + (r() - 0.5) * 0.04, Math.sin(a) * radii[k]];
  },
  corridor: (r, i) => {
    const rails = [-3.6, -2.4, -1.2, 1.2, 2.4, 3.6], k = i % rails.length, t = r();
    const z = 6 - t * 18, f = (z + 12) / 18; // 1 near, 0 at the vanishing point
    return [rails[k] * (0.12 + 0.88 * f), 0.35 + (Math.floor(i / rails.length) % 4) * 0.9 * (0.3 + 0.7 * f) + 1.6 * (1 - f), z];
  },
  pillars: (r, i, n) => {
    const k = i % 6;
    if (k === 5) { const a = r() * 6.283; return [Math.cos(a) * 4.2, 5.7 + (r() - 0.5) * 0.08, Math.sin(a) * 4.2 - 1.0]; } // the roof ring
    const a = Math.PI / 2 + k * (2 * Math.PI / 5) + Math.PI; // first pillar at the back
    return [Math.cos(a) * 4.2 + (r() - 0.5) * 0.25, 0.15 + r() * 5.4, Math.sin(a) * 4.2 - 1.0 + (r() - 0.5) * 0.25];
  },
  low: (r) => { const a = r() * 6.283, d = 1.5 + Math.sqrt(r()) * 9; return [Math.cos(a) * d, 0.08 + r() * 1.3, Math.sin(a) * d]; },
  ordered: (r, i, n) => {
    const k = i % 3;
    if (k < 2) { const rad = k ? 7.4 : 5.2, a = (i / n) * 6.283 * 3 + k; return [Math.cos(a) * rad, 3.0 + k * 0.8, Math.sin(a) * rad]; }
    const a = (i / n) * 6.283 * 9; return [Math.cos(a) * 2.2, 4.4 + Math.sin(i) * 0.05, Math.sin(a) * 2.2];
  },
};
function layoutArray(name) {
  const r = rng(7 + name.length * 131), out = new Float32Array(N_FRAG * 3), f = LAYOUTS[name];
  for (let i = 0; i < N_FRAG; i++) { const p = f(r, i, N_FRAG); out.set(p, i * 3); }
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
    vFade = clamp(1.0 - (-mv.z - 4.0) / 26.0, 0.15, 1.0);
    mv.xy += position.xy * aSize * uScale;
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG_FS = /* glsl */`
  uniform vec3 uColor; uniform float uIntensity, uTime;
  varying vec2 vUv; varying float vSeed; varying float vFade;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
    float tw = 0.7 + 0.3 * sin(uTime * (0.8 + vSeed * 1.6) + vSeed * 40.0);
    gl_FragColor = vec4(uColor * a * uIntensity * tw * vFade * 1.6, a);
  }`;

// ---------------------------------------------------------------- build
export function createChamber(scene) {
  const root = new THREE.Group(); root.name = 'chamber';
  scene.add(root);
  const P = {}; // the current (blended) parameters
  const toColor = (v) => new THREE.Color(v);
  for (const [k, v] of Object.entries(STATES.dark)) P[k] = typeof v === 'string' ? toColor(v) : Array.isArray(v) ? v.slice() : v;
  let target = STATES.dark, tau = 1;

  scene.fog = new THREE.FogExp2(P.fog.clone(), P.fogD);
  scene.background = P.fog.clone();

  // lights
  const amb = new THREE.AmbientLight('#8890b0', 0.1);
  const hemi = new THREE.HemisphereLight('#c8ccff', '#120f0c', 0.1);
  const key = new THREE.SpotLight('#ffffff', 0, 60, 0.75, 0.6, 1.2);
  key.position.set(0, 18, 4); key.target.position.set(0, 0, -1);
  const centerLight = new THREE.PointLight('#fff2d8', 0, 16, 1.6); centerLight.position.copy(CENTER);
  root.add(amb, hemi, key, key.target, centerLight);

  // floor: dark, polished; faint concentric inlay; transparent enough to show the mirrored light below it
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
        float spokes = smoothstep(0.02, 0.0, abs(sin(atan(vW.z, vW.x) * 2.5))) * smoothstep(10.5, 2.0, r) * step(1.9, r) * 0.35;
        vec3 c = uColor * (1.0 + 0.06 * h(floor(vW.xz * 18.0)));
        c += uRingColor * (rings + spokes) * uRing * (0.6 + 0.4 * sin(uTime * 0.4 + r));
        float edge = smoothstep(13.0, 6.0, r);
        c = mix(uFog, c, edge);
        gl_FragColor = vec4(c, 0.86);
      }`,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 120), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = 1;
  root.add(floor);

  // walls: tall matte planes on a circle; slits of light between them
  const slabGeo = new THREE.BoxGeometry(2.25, 22, 0.8);
  const slabMat = new THREE.MeshLambertMaterial({ color: '#17181f' }); // matte: no specular glint (a glint on a flat slab reads as a glowing square)
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, N_WALL);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < N_WALL; i++) {
    const a = (i / N_WALL) * Math.PI * 2;
    e.set(0, -a + Math.PI / 2, 0); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.cos(a) * R, 10.8, Math.sin(a) * R), q, sc); slabs.setMatrixAt(i, m4);
  }
  root.add(slabs);
  const slitMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color('#5966a8') }, uI: { value: 0 }, uMirror: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`uniform vec3 uColor; uniform float uI, uMirror; varying vec2 vUv;
      void main(){ float x = 1.0 - abs(vUv.x - 0.5) * 2.0; float y = mix(1.0, 0.0, pow(vUv.y, 0.7));
        float a = (pow(x, 14.0) + pow(x, 3.0) * 0.18) * (0.25 + 0.75 * y) * uI * mix(1.0, 0.28, uMirror);
        gl_FragColor = vec4(uColor * a * 1.4, a); }`,
  });
  const slitGeo = new THREE.PlaneGeometry(0.55, 20); // a thin core of light with a soft spill either side slitGeo.translate(0, 10, 0);
  const slits = new THREE.InstancedMesh(slitGeo, slitMat, N_WALL);
  const slitsMirror = new THREE.InstancedMesh(slitGeo, slitMat.clone(), N_WALL);
  slitsMirror.material.uniforms = { uColor: slitMat.uniforms.uColor, uI: slitMat.uniforms.uI, uMirror: { value: 1 } };
  for (let i = 0; i < N_WALL; i++) {
    const a = ((i + 0.5) / N_WALL) * Math.PI * 2;
    e.set(0, -a - Math.PI / 2, 0); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.cos(a) * (R + 0.1), -0.02, Math.sin(a) * (R + 0.1)), q, sc); slits.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(Math.cos(a) * (R + 0.1), 0.02, Math.sin(a) * (R + 0.1)), q, new THREE.Vector3(1, -1, 1)); slitsMirror.setMatrixAt(i, m4);
  }
  root.add(slits, slitsMirror);

  // fragments of light (and their reflection)
  const fragGeo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  fragGeo.index = base.index; fragGeo.attributes.position = base.attributes.position; fragGeo.attributes.uv = base.attributes.uv;
  const seeds = new Float32Array(N_FRAG), sizes = new Float32Array(N_FRAG); const r0 = rng(99);
  for (let i = 0; i < N_FRAG; i++) { seeds[i] = r0(); sizes[i] = 0.05 + Math.pow(r0(), 3) * 0.16; }
  let layoutName = 'void';
  const fromAttr = new THREE.InstancedBufferAttribute(layoutArray('void'), 3);
  const toAttr = new THREE.InstancedBufferAttribute(layoutArray('void'), 3);
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
    if (name === layoutName) return;
    // start from where the fragments are now (approximately: the end of the last move)
    fromAttr.array.set(mixT >= 1 ? toAttr.array : fromAttr.array);
    toAttr.array.set(layoutArray(name));
    fromAttr.needsUpdate = true; toAttr.needsUpdate = true;
    layoutName = name; mixT = 0; mixDur = Math.max(0.01, seconds);
  }

  // a soft shaft of light from above: brightest at its edges-on-axis, never a hard block (front faces only)
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color('#fff1d6') }, uI: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`uniform vec3 uColor; uniform float uI, uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float n(float x){ return sin(x) * 0.5 + 0.5; }
      void main(){ float facing = abs(dot(vN, vV)); float body = pow(facing, 2.5);
        float streak = 0.7 + 0.3 * n(vUv.x * 40.0 + uTime * 0.3) * n(vUv.x * 13.0 - uTime * 0.2);
        float a = body * smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.6, vUv.y) * streak * uI * 0.13;
        gl_FragColor = vec4(uColor * a, a); }`,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 3.4, 16, 48, 1, true), shaftMat);
  shaft.position.set(0, 8, 0); root.add(shaft);

  // the light of the place: a soft glow at the centre
  const centerGlow = glowSprite('#fff0d0', 3.2, 0); centerGlow.position.copy(CENTER); root.add(centerGlow);
  // the player's own light, small, in front of them
  const playerGlow = glowSprite('#fff4e0', 0.55, 0); playerGlow.position.copy(PLAYER_LIGHT); root.add(playerGlow);
  const playerCore = glowSprite('#ffffff', 0.16, 0); playerCore.position.copy(PLAYER_LIGHT); root.add(playerCore);
  const playerMirror = glowSprite('#fff4e0', 0.5, 0); playerMirror.position.set(PLAYER_LIGHT.x, -PLAYER_LIGHT.y, PLAYER_LIGHT.z); root.add(playerMirror);

  // the four question lights
  const qlights = QUESTION_POS.map((p) => {
    const g = new THREE.Group(); g.position.copy(p);
    const halo = glowSprite('#dfe4ff', 1.6, 0), core = glowSprite('#ffffff', 0.32, 0);
    const mirror = glowSprite('#dfe4ff', 1.2, 0); mirror.position.y = -p.y * 2;
    g.add(halo, core, mirror); root.add(g);
    return { group: g, halo, core, mirror, mode: 'idle', lit: 0, litT: 0, shown: 1, shownT: 1, focus: 0, focusT: 0 };
  });

  // the threshold of chapter 4: a tall opening of soft light at the far side (a symbol of the return, not a door to anywhere shown)
  const thrMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uI: { value: 0 }, uColor: { value: new THREE.Color('#e9f6ff') }, uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`uniform float uI, uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){ vec2 p = vUv - 0.5;
        float hy = smoothstep(-0.5, -0.38, p.y) * (1.0 - smoothstep(0.18, 0.5, p.y));
        float wide = 1.0 - smoothstep(0.1, 0.5, abs(p.x));
        float core = exp(-pow(p.x * 7.0, 2.0)) * (0.85 + 0.15 * sin(uTime * 0.6 + p.y * 3.0));
        float a = (wide * 0.22 + core * 0.7) * hy * uI;
        gl_FragColor = vec4(uColor * a, a); }`,
  });
  const threshold = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 9.0), thrMat);
  threshold.position.set(0, 4.3, -10.6); root.add(threshold);
  const thrMirror = new THREE.Mesh(threshold.geometry, thrMat); thrMirror.position.set(0, -4.3, -10.6); thrMirror.scale.y = -1; root.add(thrMirror);

  // ---------------------------------------------------------------- update
  const tmpC = new THREE.Color();
  function setState(name, seconds = 6) { target = STATES[name] || STATES.dark; tau = Math.max(0.05, seconds / 3); P.name = name; }
  function lerpTo(dt) {
    const k = 1 - Math.exp(-dt / tau);
    for (const [kname, v] of Object.entries(target)) {
      if (typeof v === 'string') P[kname].lerp(tmpC.set(v), k);
      else if (Array.isArray(v)) { P[kname][0] += (v[0] - P[kname][0]) * k; P[kname][1] += (v[1] - P[kname][1]) * k; }
      else P[kname] += (v - P[kname]) * k;
    }
  }
  function update(dt, t, renderer) {
    lerpTo(dt);
    scene.fog.color.copy(P.fog); scene.fog.density = P.fogD; scene.background.copy(P.fog);
    amb.intensity = P.amb; hemi.intensity = P.hemi;
    key.color.copy(P.key); key.intensity = P.keyI * 60;
    centerLight.intensity = P.center * 14; centerLight.color.copy(P.key);
    floorMat.uniforms.uColor.value.copy(P.floor); floorMat.uniforms.uRing.value = P.ring; floorMat.uniforms.uTime.value = t; floorMat.uniforms.uFog.value.copy(P.fog);
    slitMat.uniforms.uColor.value.copy(P.slit); slitMat.uniforms.uI.value = P.slitI;
    mixT = Math.min(1, mixT + dt / mixDur);
    fragUniforms.uMix.value = mixT; fragUniforms.uTime.value = t; fragUniforms.uIntensity.value = P.fragI;
    fragUniforms.uScale.value = 1; mirrorUniforms.uIntensity.value = P.fragI * 0.32;
    fragUniforms.uColor.value.copy(P.key).lerp(tmpC.set('#ffffff'), 0.55);
    shaftMat.uniforms.uI.value = P.shaftI; shaftMat.uniforms.uTime.value = t; shaftMat.uniforms.uColor.value.copy(P.key);
    shaft.position.x = P.shaftAt[0]; shaft.position.z = P.shaftAt[1];
    centerGlow.material.opacity = P.center * 0.7; centerGlow.scale.setScalar(2.2 + P.center * 1.4 + Math.sin(t * 0.6) * 0.08);
    const pl = P.player * (0.85 + 0.15 * Math.sin(t * 1.3));
    playerGlow.material.opacity = pl; playerCore.material.opacity = pl; playerMirror.material.opacity = pl * 0.3;
    thrMat.uniforms.uI.value = P.threshold; thrMat.uniforms.uTime.value = t;
    for (const ql of qlights) {
      const kk = 1 - Math.exp(-dt * 1.5);
      ql.litT += (ql.lit - ql.litT) * kk; ql.shownT += (ql.shown - ql.shownT) * kk; ql.focusT += (ql.focus - ql.focusT) * kk;
      const base = P.qlights * ql.shownT * (0.75 + 0.25 * Math.sin(t * 0.9 + ql.group.position.x)) * (1 + ql.focusT * 0.35 * (0.6 + 0.4 * Math.sin(t * 2.2)));
      const warm = ql.litT * ql.shownT;
      ql.halo.material.color.set('#dfe4ff').lerp(tmpC.set('#f6c77d'), ql.litT);
      ql.halo.material.opacity = Math.max(base, warm * 0.9) * 0.85; ql.core.material.opacity = Math.min(1, Math.max(base, warm));
      ql.halo.scale.setScalar(1.6 * (1 + ql.focusT * 0.25));
      ql.mirror.material.opacity = Math.max(base, warm) * 0.25;
      ql.mirror.material.color.copy(ql.halo.material.color);
    }
    if (renderer) renderer.toneMappingExposure = P.exposure;
  }

  return {
    root, P, setState, setLayout, update, qlights, floor,
    get layout() { return layoutName; },
    setQuestionLit(i, on) { if (qlights[i]) qlights[i].lit = on ? 1 : 0; },
    /** show or hide one question light (instant = no fade) */
    setQuestionShown(i, on, instant = false) { const q = qlights[i]; if (!q) return; q.shown = on ? 1 : 0; if (instant) q.shownT = q.shown; },
    /** the light the player is invited toward pulses a little */
    setQuestionFocus(i) { qlights.forEach((q, k) => { q.focus = k === i ? 1 : 0; }); },
    resetQuestions(lit = 0, shown = 1) { qlights.forEach((q, k) => { q.lit = q.litT = k < lit ? 1 : 0; q.shown = q.shownT = shown; q.focus = q.focusT = 0; }); },
    /** jump straight to a state (review jumps) */
    snap(name) { setState(name, 0.2); for (let i = 0; i < 40; i++) lerpTo(0.05); },
  };
}
