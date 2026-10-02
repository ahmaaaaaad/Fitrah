// Module 2 · Sabab: one descent from the living planet to the machines that turn
// light into food, then back up. Each scale is its own stage; a zoom-blur cut
// joins them, so the camera never stops moving.
//   sky       → Rayleigh scattering turns space into a blue sky (β ∝ 1/λ⁴)
//   leaf      → the player turns a leaf to the sun (flux = cos θ)
//   membrane  → photosystem II splits water (4 photons per O₂), electrons are led
//               along the chain (each run pumps protons), ATP synthase turns
//               (three ATP per turn)
import * as THREE from 'three';
import { gsap } from 'gsap';
import { audio } from '../core/audio.js';
import { scene, cinematic, QUALITY } from '../core/scene.js';
import * as ui from '../ui/components.js';
import { D } from '../ui/dom.js';
import { i18n } from '../core/i18n.js';
import { script as S } from '../core/content.js';
import * as store from '../core/store.js';
import { GLSL_NOISE } from '../world/textures.js';

const st = () => S.world1.stations[1];
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const v3 = new THREE.Vector3();
const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

// --------------------------------------------------------------------------- shared
function projector(camera) {
  return (p) => { v3.copy(p).project(camera); return { x: (v3.x * 0.5 + 0.5) * innerWidth, y: (-v3.y * 0.5 + 0.5) * innerHeight }; };
}

/** A zoom-blur cut: the image rushes inward, the stage swaps under the blur, then settles. */
async function warpCut(swap, { inDur = 1.1, outDur = 1.4 } = {}) {
  const U = cinematic.uniforms;
  audio.warp();
  await new Promise((r) => gsap.to(U.uWarp, { value: 1, duration: D(inDur), ease: 'power2.in', onComplete: r }));
  await new Promise((r) => gsap.to(U.uFade, { value: 1, duration: D(0.25), onComplete: r }));
  await swap();
  gsap.to(U.uFade, { value: 0, duration: D(0.6) });
  await new Promise((r) => gsap.to(U.uWarp, { value: 0, duration: D(outDur), ease: 'power2.out', onComplete: r }));
}

// --------------------------------------------------------------------------- sky
const SKY_FRAG = /* glsl */`
${GLSL_NOISE}
uniform vec3 uSun; uniform float uDensity, uTime;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float mu = dot(d, uSun);
  // Rayleigh scattering coefficients at sea level for 680, 550, 440 nm (×10⁻⁶ m⁻¹): they grow as 1/λ⁴
  vec3 beta = vec3(5.8, 13.5, 33.1);
  float up = max(d.y, 0.0);
  float depth = uDensity / (up + 0.1);
  vec3 ext = exp(-beta * 0.03 * depth);
  float phase = 0.75 * (1.0 + mu * mu);
  vec3 sky = (1.0 - exp(-beta * 0.03 * depth * 0.5)) * phase * 1.25 * (0.4 + 0.6 * max(uSun.y, 0.0) + 0.3);
  vec3 sunDisk = vec3(1.0, 0.96, 0.88) * smoothstep(0.9993, 0.9998, mu) * 40.0 * ext;
  vec3 glow = vec3(1.0, 0.85, 0.6) * pow(max(mu, 0.0), 64.0) * 1.2 * ext;
  vec3 space = vec3(0.004, 0.005, 0.016);
  vec3 col = mix(space, sky, clamp(uDensity * 1.4, 0.0, 1.0)) + sunDisk + glow;
  // the ground below the horizon: land and sea under a haze
  if (d.y < 0.0) {
    float n = fbm(vec3(d.xz / max(-d.y, 0.02) * 0.6, 1.0));
    vec3 land = mix(vec3(0.05, 0.16, 0.08), vec3(0.18, 0.3, 0.12), smoothstep(-0.2, 0.5, n));
    land = mix(vec3(0.02, 0.08, 0.16), land, smoothstep(-0.05, 0.08, n));
    float haze = exp(-(-d.y) * 6.0);
    col = mix(land * (0.25 + 0.75 * max(uSun.y, 0.0)) * uDensity + space * (1.0 - uDensity), sky * 0.9, haze * uDensity);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// light leaving the sun: blue scatters out of the beam far more often than red
const BEAM_VERT = /* glsl */`
attribute vec4 seed; uniform float uTime, uScale, uOn; uniform vec3 uSun;
varying vec3 vCol; varying float vA;
void main(){
  float band = floor(seed.x * 3.0);                 // 0 red, 1 green, 2 blue
  float beta = band < 0.5 ? 5.8 : (band < 1.5 ? 13.5 : 33.1);
  float k = fract(uTime * 0.09 + seed.y);           // travel along the beam
  float sTime = -log(max(seed.z, 1e-4)) / (beta * 0.045);   // where this photon scatters
  vec3 axis = normalize(uSun);
  vec3 side = normalize(cross(axis, vec3(0.0, 1.0, 0.0)));
  vec3 up2 = cross(side, axis);
  float ang = seed.w * 6.2831;
  vec3 off = (side * cos(ang) + up2 * sin(ang)) * 6.0 * sqrt(fract(seed.w * 13.1));
  float dist = (1.0 - k) * 220.0;
  vec3 p = axis * dist + off;
  float travelled = k * 6.0;
  if (travelled > sTime) {                           // scattered: leaves the beam in a random direction
    vec3 rnd = normalize(vec3(fract(seed.z * 91.7) - 0.5, fract(seed.w * 37.3) - 0.5, fract(seed.y * 53.9) - 0.5));
    p += rnd * (travelled - sTime) * 26.0;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vCol = band < 0.5 ? vec3(1.0, 0.35, 0.25) : (band < 1.5 ? vec3(0.45, 1.0, 0.5) : vec3(0.35, 0.55, 1.0));
  vA = uOn * smoothstep(0.0, 0.08, k) * smoothstep(1.0, 0.85, k);
  gl_PointSize = clamp(uScale * 90.0 / max(1.0, -mv.z), 1.0, 7.0);
  gl_Position = projectionMatrix * mv;
}`;
const DOT_FRAG = /* glsl */`varying vec3 vCol; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 18.0) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vCol, a); }`;

function buildSky(cosmos) {
  const group = new THREE.Group(); group.visible = false;
  const sun = V(0.55, 0.32, -0.77).normalize();
  const u = { uSun: { value: sun }, uDensity: { value: 0 }, uTime: { value: 0 } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 64, 32), new THREE.ShaderMaterial({ uniforms: u, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: SKY_FRAG }));
  group.add(dome);
  const N = QUALITY === 'low' ? 900 : 2400;
  const seeds = new Float32Array(N * 4); for (let i = 0; i < N * 4; i++) seeds[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
  const bu = { uTime: { value: 0 }, uScale: { value: 1 }, uOn: { value: 0 }, uSun: { value: sun } };
  const beam = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: bu, vertexShader: BEAM_VERT, fragmentShader: DOT_FRAG, ...additive }));
  beam.frustumCulled = false; group.add(beam);
  // a few soft clouds far below
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cosmos.GLOW, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 160;
    c.position.set(Math.cos(a) * r, -18 - Math.random() * 14, Math.sin(a) * r);
    c.scale.set(60 + Math.random() * 60, 18 + Math.random() * 10, 1);
    c.userData.cloud = true; group.add(c);
  }
  scene.add(group);
  return { group, u, bu, sun, clouds: group.children.filter((c) => c.userData.cloud) };
}

// --------------------------------------------------------------------------- leaf
function leafTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 1024;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 512, 1024); grd.addColorStop(0, '#2f8a3c'); grd.addColorStop(1, '#1d6a2d');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${120 + Math.random() * 60},${200 + Math.random() * 55},${90 + Math.random() * 40},${0.04 + Math.random() * 0.06})`; g.beginPath(); g.arc(Math.random() * 512, Math.random() * 1024, 2 + Math.random() * 5, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(214,240,170,0.75)'; g.lineWidth = 9; g.beginPath(); g.moveTo(256, 1024); g.lineTo(256, 20); g.stroke();
  g.lineWidth = 3.5; g.strokeStyle = 'rgba(200,236,160,0.5)';
  for (let k = 0; k < 13; k++) {
    const y = 960 - k * 70;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(256, y); g.quadraticCurveTo(256 + s * 120, y - 40, 256 + s * 250, y - 130); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const LEAF_FRAG = /* glsl */`
uniform sampler2D uMap; uniform vec3 uSun; uniform float uGlow;
varying vec2 vUv; varying vec3 vN;
void main(){
  vec3 base = texture2D(uMap, vUv).rgb;
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  float front = max(dot(n, uSun), 0.0);
  float back = max(dot(-n, uSun), 0.0);
  vec3 col = base * (0.16 + 1.0 * front) + base * vec3(0.95, 1.35, 0.5) * back * 1.25;
  col += vec3(0.55, 1.0, 0.45) * uGlow * 0.28;
  gl_FragColor = vec4(col, 1.0);
}`;
const PHOTON_VERT = /* glsl */`
attribute vec4 seed; uniform float uTime, uScale, uFlux; uniform vec3 uSun;
varying vec3 vCol; varying float vA;
void main(){
  float k = fract(uTime * (0.35 + 0.25 * seed.z) + seed.y);
  vec3 axis = normalize(uSun);
  vec3 side = normalize(cross(axis, vec3(0.0, 1.0, 0.0))); vec3 up2 = cross(side, axis);
  float ang = seed.w * 6.2831, rr = sqrt(seed.x) * 3.2;
  vec3 target = (side * cos(ang) * rr * 0.7 + up2 * sin(ang) * rr);
  vec3 p = target + axis * (1.0 - k) * 30.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vCol = vec3(1.0, 0.86, 0.5) * 1.6;
  vA = step(seed.z, uFlux) * smoothstep(0.0, 0.15, k) * smoothstep(1.0, 0.9, k);
  gl_PointSize = clamp(uScale * 70.0 / max(1.0, -mv.z), 1.0, 9.0);
  gl_Position = projectionMatrix * mv;
}`;

function buildLeaf() {
  const group = new THREE.Group(); group.visible = false;
  const shape = new THREE.Shape();
  shape.moveTo(0, -4.6);
  shape.bezierCurveTo(2.6, -3.2, 2.9, 1.6, 0, 4.6);
  shape.bezierCurveTo(-2.9, 1.6, -2.6, -3.2, 0, -4.6);
  const geo = new THREE.ShapeGeometry(shape, 48);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    uv.setXY(i, x / 6 + 0.5, y / 9.2 + 0.5);
    pos.setZ(i, -0.08 * x * x + 0.05 * Math.sin(y * 1.4)); // a gentle curl
  }
  geo.computeVertexNormals();
  const sun = V(-0.5, 0.42, -0.76).normalize();
  const skyU = { uSun: { value: sun }, uDensity: { value: 1 }, uTime: { value: 0 } };
  group.add(new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: SKY_FRAG })));
  const lu = { uMap: { value: leafTexture() }, uSun: { value: sun }, uGlow: { value: 0 } };
  const leaf = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: lu, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: LEAF_FRAG }));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 3, 10), new THREE.MeshBasicMaterial({ color: '#4e8a3a' }));
  stem.position.y = -5.9; leaf.add(stem);
  const pivot = new THREE.Group(); pivot.add(leaf); group.add(pivot);
  const N = QUALITY === 'low' ? 600 : 1600;
  const seeds = new Float32Array(N * 4); for (let i = 0; i < N * 4; i++) seeds[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
  const pu = { uTime: { value: 0 }, uScale: { value: 1 }, uFlux: { value: 0 }, uSun: { value: sun } };
  const photons = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: pu, vertexShader: PHOTON_VERT, fragmentShader: DOT_FRAG, ...additive }));
  photons.frustumCulled = false; group.add(photons);
  scene.add(group);
  return { group, pivot, leaf, lu, pu, sun };
}

// --------------------------------------------------------------------------- membrane
const BG_FRAG = /* glsl */`
${GLSL_NOISE}
varying vec3 vDir; uniform float uTime;
void main(){
  vec3 d = normalize(vDir);
  float n = fbm(d * 3.0 + vec3(0.0, uTime * 0.02, 0.0));
  vec3 stroma = vec3(0.02, 0.09, 0.07), lumen = vec3(0.03, 0.05, 0.1);
  vec3 col = mix(lumen, stroma, smoothstep(-0.25, 0.25, d.y)) * (0.75 + 0.5 * n);
  gl_FragColor = vec4(col, 1.0);
}`;
const MEMBRANE_FRAG = /* glsl */`
varying vec3 vW; varying vec3 vN; uniform float uTime;
void main(){
  vec3 n = normalize(vN);
  vec3 col; float a;
  if (abs(n.z) > 0.5) {
    // the cut face: two rows of lipid heads with their tails between them
    float x = vW.x * 2.8 + sin(vW.y * 3.0 + uTime * 0.6) * 0.05;
    float cx = fract(x) - 0.5;
    float yTop = 0.66, yBot = -0.66;
    float headT = smoothstep(0.2, 0.1, length(vec2(cx, (vW.y - yTop) * 2.6)));
    float headB = smoothstep(0.2, 0.1, length(vec2(cx, (vW.y - yBot) * 2.6)));
    float tails = smoothstep(0.07, 0.0, abs(abs(cx) - 0.11)) * step(abs(vW.y), 0.52);
    col = vec3(0.16, 0.24, 0.12) + vec3(0.98, 0.86, 0.52) * (headT + headB) * 1.1 + vec3(0.62, 0.7, 0.32) * tails * 0.55;
    a = 0.82;
  } else {
    vec2 q = vW.xz * 2.4;
    vec2 cell = fract(q + vec2(0.5 * floor(q.y), 0.0)) - 0.5;
    float head = smoothstep(0.36, 0.2, length(cell));
    col = mix(vec3(0.22, 0.3, 0.14), vec3(0.92, 0.82, 0.5), head);
    a = 0.6;
  }
  gl_FragColor = vec4(col, a);
}`;
const PROTON_VERT = /* glsl */`
attribute vec4 seed; uniform float uTime, uScale, uLevel;
varying vec3 vCol; varying float vA;
void main(){
  vec3 p = vec3(mix(-24.0, 24.0, seed.x), mix(-6.5, -1.4, seed.y), mix(0.3, 7.0, seed.z));
  p += 0.35 * vec3(sin(uTime * 1.3 + seed.w * 30.0), cos(uTime * 1.7 + seed.x * 20.0), sin(uTime * 1.1 + seed.y * 25.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vCol = vec3(0.45, 1.0, 0.92);
  vA = step(seed.w, uLevel) * 0.9;
  gl_PointSize = clamp(uScale * 70.0 / max(1.0, -mv.z), 1.5, 8.0);
  gl_Position = projectionMatrix * mv;
}`;

function blobCluster(color, emissive, parts, scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.55, roughness: 0.55, metalness: 0.05 });
  parts.forEach(([x, y, z, r]) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r * scale, 3), mat); m.position.set(x * scale, y * scale, z * scale); g.add(m); });
  g.userData.mat = mat;
  return g;
}

function buildMembrane(cosmos) {
  const group = new THREE.Group(); group.visible = false;
  const bgU = { uTime: { value: 0 } };
  group.add(new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({ uniforms: bgU, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: BG_FRAG })));
  group.add(new THREE.HemisphereLight(0xcfffe0, 0x1a2a40, 0.9));
  const key = new THREE.DirectionalLight(0xfff1d0, 1.6); key.position.set(-6, 12, 10); group.add(key);
  const mem = new THREE.Mesh(new THREE.BoxGeometry(70, 1.8, 10, 1, 1, 1), new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }', fragmentShader: MEMBRANE_FRAG }));
  mem.position.z = -5; // its cut face sits at z = 0, the proteins stand in front of it
  group.add(mem);

  // photosystem II with its light-harvesting antenna
  const psii = blobCluster('#2f7d4a', '#0d3a22', [[0, 0.2, 0, 1.6], [1.3, 0.8, 0.4, 1.1], [-1.2, 0.9, -0.3, 1.0], [0.4, -1.0, 0.6, 1.0], [-0.6, 1.6, 0.5, 0.8]]);
  psii.position.set(-13, 0, 0.7); group.add(psii);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), psii.userData.mat); m.position.set(Math.cos(a) * 2.9, 0.6 + Math.sin(a * 2) * 0.2, Math.sin(a) * 2.2); psii.add(m); }
  // S-state ring: four steps of the water-splitting cycle
  const sRing = new THREE.Group(); sRing.position.set(-13, 0.4, 3.2);
  const sSegs = [0, 1, 2, 3].map((k) => {
    const a0 = Math.PI / 2 - k * (Math.PI / 2) - 0.08, len = Math.PI / 2 - 0.16;
    const m = new THREE.Mesh(new THREE.RingGeometry(2.75, 2.95, 48, 1, a0 - len, len), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf73'), ...additive, opacity: 0.18, side: THREE.DoubleSide }));
    sRing.add(m); return m;
  });
  group.add(sRing);
  const b6f = blobCluster('#7a5bb5', '#2b1950', [[0, 0, 0, 1.3], [0.9, 0.7, 0.3, 0.8], [-0.8, -0.6, -0.2, 0.8]]); b6f.position.set(-4, 0, 0.7); group.add(b6f);
  const psi = blobCluster('#2a6f78', '#0b2f36', [[0, 0, 0, 1.5], [1.1, 0.6, -0.3, 1.0], [-1.0, 0.7, 0.4, 0.9], [0.2, -1.1, 0, 0.9]]); psi.position.set(5, 0, 0.7); group.add(psi);
  const pq = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 2), new THREE.MeshStandardMaterial({ color: '#d9c56a', emissive: '#4a3d10', roughness: 0.5 })); pq.position.set(-8.5, 0, 1.1); group.add(pq);
  const pc = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), new THREE.MeshStandardMaterial({ color: '#4f8fd9', emissive: '#10264a', roughness: 0.5 })); pc.position.set(0.4, -2.6, 1.1); group.add(pc);

  // ATP synthase: the c-ring and central stalk turn; the head stays put
  const atp = new THREE.Group(); atp.position.set(14, 0, 0.9); group.add(atp);
  const rotor = new THREE.Group(); atp.add(rotor);
  const cMat = new THREE.MeshStandardMaterial({ color: '#c99a4a', emissive: '#4a2c08', emissiveIntensity: 0.6, roughness: 0.45, metalness: 0.2 });
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.5, 4, 12), cMat); c.position.set(Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25); rotor.add(c); }
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 3.4, 16), new THREE.MeshStandardMaterial({ color: '#e7d39a', emissive: '#5a4a18', emissiveIntensity: 0.5, roughness: 0.4 }));
  stalk.position.y = 1.9; rotor.add(stalk);
  const cam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.0), stalk.material); cam.position.set(0, 3.4, 0.35); rotor.add(cam);
  const head = new THREE.Group(); head.position.y = 3.9; atp.add(head);
  const betas = [];
  for (let k = 0; k < 6; k++) {
    const isB = k % 2 === 0;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 3), new THREE.MeshStandardMaterial({ color: isB ? '#d8a64e' : '#b8784a', emissive: isB ? '#3a2408' : '#2a1206', emissiveIntensity: 0.6, roughness: 0.5 }));
    const a = (k / 6) * Math.PI * 2; m.position.set(Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05); head.add(m);
    if (isB) betas.push(m);
  }
  const stator = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(2.2, -0.4, 0), V(2.6, 1.8, 0), V(1.7, 4.4, 0), V(0.6, 4.9, 0)]), 32, 0.12, 8), new THREE.MeshStandardMaterial({ color: '#8a6a3a', roughness: 0.6 }));
  atp.add(stator);
  const atpGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: cosmos.GLOW, color: 0xffcf73, ...additive, opacity: 0 })); atpGlow.scale.set(9, 9, 1); atpGlow.position.y = 2; atp.add(atpGlow);
  // ATP molecules leaving into the stroma
  const atpPool = Array.from({ length: 12 }, () => {
    const g = new THREE.Group(); g.visible = false;
    const m = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#a86a10', emissiveIntensity: 1.2, roughness: 0.3 });
    [[0, 0, 0], [0.32, 0.12, 0], [0.62, 0.02, 0.1]].forEach(([x, y, z]) => { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 2), m); s.position.set(x, y, z); g.add(s); });
    group.add(g); return g;
  });

  // electron path: PSII → plastoquinone → cytochrome b6f → plastocyanin → PSI
  const path = new THREE.CatmullRomCurve3([V(-13, 0.3, 2.0), V(-10.5, 0.1, 1.8), V(-8.5, 0, 1.8), V(-6, 0.2, 1.8), V(-4, 0.1, 2.1), V(-2.5, -1.6, 1.9), V(0.4, -2.6, 1.9), V(3, -1.6, 1.9), V(5, -0.3, 2.1)]);
  const pathPts = path.getPoints(160);
  const dashes = new THREE.Points(new THREE.BufferGeometry().setFromPoints(path.getSpacedPoints(70)), new THREE.PointsMaterial({ map: cosmos.GLOW, color: 0xbfe9ff, size: 0.55, ...additive, opacity: 0 }));
  group.add(dashes);
  const electron = new THREE.Sprite(new THREE.SpriteMaterial({ map: cosmos.GLOW, color: 0xffffff, ...additive, opacity: 0 })); electron.scale.set(1.6, 1.6, 1); group.add(electron);
  const leak = new THREE.Sprite(new THREE.SpriteMaterial({ map: cosmos.GLOW, color: 0xff4a3a, ...additive, opacity: 0 })); leak.scale.set(4, 4, 1); group.add(leak);

  // photons from above, oxygen bubbles, lumen protons
  const photonPool = Array.from({ length: 10 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cosmos.GLOW, color: 0xffd27a, ...additive, opacity: 0 })); s.scale.set(1.2, 1.2, 1); group.add(s); return s; });
  const bubblePool = Array.from({ length: 6 }, () => { const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: '#cfe8ff', emissive: '#3a5a8a', transparent: true, opacity: 0.85, roughness: 0.2 }); [[-0.22, 0], [0.22, 0]].forEach(([x]) => { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 2), m); s.position.x = x; g.add(s); }); g.visible = false; group.add(g); return g; });
  const N = QUALITY === 'low' ? 1500 : 4000;
  const seeds = new Float32Array(N * 4); for (let i = 0; i < N * 4; i++) seeds[i] = Math.random();
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  pg.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
  const prU = { uTime: { value: 0 }, uScale: { value: 1 }, uLevel: { value: 0.08 } };
  const protons = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: prU, vertexShader: PROTON_VERT, fragmentShader: DOT_FRAG, ...additive }));
  protons.frustumCulled = false; group.add(protons);
  scene.add(group);
  return { group, bgU, psii, sRing, sSegs, b6f, psi, pq, pc, atp, rotor, head, betas, atpGlow, atpPool, path, pathPts, dashes, electron, leak, photonPool, bubblePool, prU };
}

// --------------------------------------------------------------------------- the module
export function runSabab({ cosmos, camera, canvas, rig }) {
  const S2 = st(), steps = Object.fromEntries(S2.steps.map((x) => [x.id, x]));
  const project = projector(camera);
  const sky = buildSky(cosmos), leaf = buildLeaf(), mem = buildMembrane(cosmos);
  const planet = cosmos.planets[0];
  const savedBg = scene.background, savedEnv = scene.environment;
  const scaleU = () => Math.min(2, devicePixelRatio || 1) * (innerHeight / 800);

  const tick = cosmos.addUpdater((dt, tt) => {
    sky.u.uTime.value = tt; sky.bu.uTime.value = tt; sky.bu.uScale.value = scaleU();
    leaf.pu.uTime.value = tt; leaf.pu.uScale.value = scaleU();
    mem.bgU.uTime.value = tt; mem.prU.uTime.value = tt; mem.prU.uScale.value = scaleU();
  });

  const enterStage = (stage) => {
    [sky.group, leaf.group, mem.group].forEach((g) => { g.visible = g === stage; });
    const micro = !!stage;
    cosmos.root.visible = !micro;
    scene.background = micro ? null : savedBg;
    scene.environment = micro ? null : savedEnv;
  };

  return new Promise(async (resolve) => {
    // ---- 1 · descend to the living planet
    const off = camera.position.clone().sub(planet.group.position);
    rig.followTarget(() => planet.group.position, off, V(0, 0, 0), 2.2);
    gsap.to(off, { x: 0.5, y: 0.45, z: 2.1, duration: D(5), ease: 'power2.inOut' });
    gsap.to(rig.target, { fov: 40, duration: D(5) });
    await ui.caption(S2.intro, 3.4);
    await wait(1.8);

    // ---- 2 · the sky: space turns blue as the light scatters
    await warpCut(async () => {
      enterStage(sky.group);
      sky.u.uDensity.value = 0;
      rig.snap(V(0, 0, 0), sky.sun.clone().multiplyScalar(100).add(V(-40, -8, 0)), 62);
    });
    gsap.to(sky.u.uDensity, { value: 1, duration: D(7), ease: 'power1.inOut' });
    gsap.to(sky.bu.uOn, { value: 1, duration: D(2) });
    sky.clouds.forEach((c, i) => gsap.to(c.material, { opacity: 0.35, duration: D(3), delay: D(3 + i * 0.1) }));
    rig.flyTo({ pos: V(0, -6, 0), look: sky.sun.clone().multiplyScalar(100).add(V(-30, -20, 0)), duration: 7.5, fov: 58, ease: 'sine.inOut' });
    const skyCap = ui.caption(S2.descent.sky);
    await wait(7.5);
    skyCap.done();

    // ---- 3 · the leaf: turn it to the sun
    await warpCut(async () => {
      enterStage(leaf.group);
      leaf.pivot.rotation.set(0.9, -1.0, 0.2);
      rig.snap(V(0, 0.5, 15), V(0, 0, 0), 46);
    });
    await ui.caption(S2.descent.leaf, 3);
    await tiltLeaf();
    await ui.caption(steps.tilt.done, 3);

    // ---- 4 · into the membrane
    await warpCut(async () => {
      enterStage(mem.group);
      rig.snap(V(0, 1.6, 36), V(0, 0.4, 0), 46);
    });
    rig.flyTo({ pos: V(0, 1.3, 31), look: V(0, 0.3, 0), duration: 4 });
    await ui.caption(S2.descent.membrane, 3);
    await splitWater();
    await ui.caption(steps.split.done, 3.4);
    await guideElectrons();
    await ui.caption(steps.guide.done, 3.2);
    await turnRotor();
    await ui.caption(steps.rotor.done, 3.2);
    store.log('sabab_cascade_done');

    // ---- 5 · back up the same chain
    await warpCut(async () => { enterStage(leaf.group); leaf.pu.uFlux.value = 1; rig.snap(V(0, 0.5, 9), V(0, 0, 0), 46); });
    rig.flyTo({ pos: V(0, 0.5, 26), look: V(0, 0, 0), duration: 2.4 });
    await wait(2);
    await warpCut(async () => { enterStage(sky.group); sky.u.uDensity.value = 1; rig.snap(V(0, -6, 0), sky.sun.clone().multiplyScalar(100).add(V(-30, -20, 0)), 58); });
    gsap.to(sky.u.uDensity, { value: 0, duration: D(4.5), ease: 'power1.in' });
    rig.flyTo({ pos: V(0, 30, 0), look: sky.sun.clone().multiplyScalar(100), duration: 4.5 });
    const climbCap = ui.caption(S2.climb);
    await wait(4.6);
    await warpCut(async () => {
      enterStage(null);
      rig.snap(planet.group.position.clone().add(V(0.4, 0.5, 2.2)), planet.group.position.clone(), 40);
    });
    climbCap.done();
    rig.flyTo({ pos: V(6, 26, 40), look: V(0, -2, 0), duration: 5, fov: 50, ease: 'power2.inOut' });
    await wait(1.5);
    await ui.caption(S2.chain_end, 4.2);
    tick();
    [sky.group, leaf.group, mem.group].forEach((g) => { scene.remove(g); g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); });
    window.__fitrahPhase = 'sabab:done';
    resolve({ anchor: () => project(new THREE.Vector3()) });
  });

  // ------------------------------------------------------------------ step 1 · tilt
  function tiltLeaf() {
    return new Promise((res) => {
      window.__fitrahPhase = 'sabab:tilt';
      const coach = ui.coach({ glyph: ['rotate', () => project(leaf.group.position)], text: steps.tilt.instruction, hints: S2.hints, stall: 12 });
      let dragging = false, lx = 0, ly = 0, hold = 0, done = false;
      const n = new THREE.Vector3();
      const hum = audio.tone(196, { gain: 0.0, attack: 0.5 });
      const down = (e) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
      const move = (e) => {
        if (!dragging) return;
        leaf.pivot.rotation.y += (e.clientX - lx) * 0.006 * (i18n.dir === 'rtl' ? 1 : 1);
        leaf.pivot.rotation.x += (e.clientY - ly) * 0.006;
        leaf.pivot.rotation.x = THREE.MathUtils.clamp(leaf.pivot.rotation.x, -1.5, 1.5);
        lx = e.clientX; ly = e.clientY; coach.progress();
      };
      const up = () => { dragging = false; };
      const key = (e) => { const s = 0.06; if (e.key === 'ArrowLeft') leaf.pivot.rotation.y -= s; if (e.key === 'ArrowRight') leaf.pivot.rotation.y += s; if (e.key === 'ArrowUp') leaf.pivot.rotation.x -= s; if (e.key === 'ArrowDown') leaf.pivot.rotation.x += s; coach.progress(); };
      canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); addEventListener('keydown', key);
      const stop = cosmos.addUpdater((dt) => {
        if (done) return;
        leaf.leaf.updateMatrixWorld();
        n.set(0, 0, 1).transformDirection(leaf.leaf.matrixWorld);
        const flux = Math.max(0, n.dot(leaf.sun));                    // Lambert: Φ = Φ₀ cos θ
        leaf.pu.uFlux.value = THREE.MathUtils.damp(leaf.pu.uFlux.value, flux, 6, dt);
        leaf.lu.uGlow.value = flux;
        hum.setGain(0.03 * flux);
        if (flux > 0.94) { hold += dt; if (hold > 1.4) finish(); } else hold = 0;
      });
      function finish() {
        done = true; coach.done(); stop(); hum.stop(1.5);
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); removeEventListener('keydown', key);
        audio.shimmer(); store.log('sabab_tilt');
        res();
      }
      window.__fitrahSolve = () => { leaf.pivot.rotation.set(0, 0, 0); leaf.leaf.lookAt(leaf.sun.clone().multiplyScalar(10)); finish(); };
    });
  }

  // ------------------------------------------------------------------ step 2 · split water
  function splitWater() {
    return new Promise((res) => {
      rig.flyTo({ pos: V(-11, 1.2, 17), look: V(-12.5, 0.4, 0), duration: 2.5 });
      gsap.to(mem.sSegs.map((m) => m.material), { opacity: 0.18, duration: D(1) });
      window.__fitrahPhase = 'sabab:split';
      const coach = ui.coach({ glyph: ['hold', () => project(mem.psii.position)], text: steps.split.instruction, hints: S2.hints, stall: 12 });
      let holding = false, acc = 0, photons = 0, oxygen = 0, done = false;
      const down = (e) => { holding = true; canvas.setPointerCapture(e.pointerId); coach.progress(); };
      const up = () => { holding = false; };
      const key = (e) => { if (e.code === 'Space' || e.key === 'Enter') { holding = e.type === 'keydown'; e.preventDefault(); } };
      canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      addEventListener('keydown', key); addEventListener('keyup', key);
      const stop = cosmos.addUpdater((dt) => {
        if (done) return;
        mem.psii.userData.mat.emissiveIntensity = THREE.MathUtils.damp(mem.psii.userData.mat.emissiveIntensity, holding ? 1.4 : 0.55, 4, dt);
        if (!holding) return;
        coach.progress();
        acc += dt;
        if (acc > 0.42) { acc = 0; photon(); }
      });
      function photon() {
        const s = mem.photonPool.find((p) => p.material.opacity < 0.01); if (!s) return;
        const from = V(-13 + (Math.random() - 0.5) * 6, 12, 3 + (Math.random() - 0.5) * 3);
        s.position.copy(from); s.material.opacity = 1;
        gsap.to(s.position, { x: -13, y: 0.6, z: 1.6, duration: D(0.5), ease: 'power1.in', onComplete: () => {
          s.material.opacity = 0;
          const k = photons % 4; photons++;
          audio.soft();
          gsap.fromTo(mem.sSegs[k].material, { opacity: 1.2 }, { opacity: 0.85, duration: D(0.4) });
          if (k === 3) splitOne();
        } });
      }
      function splitOne() {
        oxygen++;
        store.log('sabab_o2', { n: oxygen });
        audio.shimmer();
        // 2H₂O → O₂ + 4H⁺ + 4e⁻ : the bubble leaves, protons join the lumen
        const b = mem.bubblePool.find((g) => !g.visible);
        if (b) { b.visible = true; b.position.set(-13, -1.6, 2.2); b.scale.setScalar(0.2); gsap.to(b.scale, { x: 1, y: 1, z: 1, duration: D(0.6) }); gsap.to(b.position, { x: -15 - Math.random() * 3, y: -7, z: 4, duration: D(4), ease: 'power1.out', onComplete: () => { b.visible = false; } }); }
        gsap.to(mem.prU.uLevel, { value: Math.min(1, mem.prU.uLevel.value + 0.08), duration: D(1) });
        cosmos.burstAqua.play(V(-13, -1.8, 2), 3, 0.3, 1.2);
        setTimeout(() => mem.sSegs.forEach((m) => gsap.to(m.material, { opacity: 0.18, duration: D(0.6) })), 500);
        if (oxygen >= 2) finish();
      }
      function finish() {
        if (done) return; done = true; coach.done(); stop();
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
        removeEventListener('keydown', key); removeEventListener('keyup', key);
        gsap.to(mem.sSegs.map((m) => m.material), { opacity: 0, duration: D(1.2) });
        setTimeout(res, 900);
      }
      window.__fitrahSolve = () => { oxygen = 1; splitOne(); };
    });
  }

  // ------------------------------------------------------------------ step 3 · guide electrons
  function guideElectrons() {
    return new Promise((res) => {
      rig.flyTo({ pos: V(-4, 0.6, 21), look: V(-4, -0.6, 0), duration: 2.5 });
      gsap.to(mem.dashes.material, { opacity: 0.55, duration: D(1) });
      let prog = 0, runs = 0, dragging = false, done = false, pumped = false;
      const place = () => mem.electron.position.copy(mem.path.getPointAt(prog));
      mem.electron.material.opacity = 1; place();
      window.__fitrahPhase = 'sabab:guide';
      window.__fitrahDebug = { path: () => mem.pathPts.map((p) => project(p)) };
      const coach = ui.coach({ glyph: ['path', () => project(mem.electron.position)], text: steps.guide.instruction, hints: S2.hints, stall: 12 });
      const N = mem.pathPts.length;
      const screenPts = () => mem.pathPts.map((p) => project(p));
      const down = (e) => {
        const ep = project(mem.electron.position);
        if (Math.hypot(e.clientX - ep.x, e.clientY - ep.y) > 90) return;
        dragging = true; canvas.setPointerCapture(e.pointerId); coach.progress();
      };
      const move = (e) => {
        if (!dragging || done) return;
        const pts = screenPts();
        // nearest point on the chain ahead of the electron
        let best = -1, bd = Infinity;
        const i0 = Math.floor(prog * (N - 1));
        for (let i = Math.max(0, i0 - 4); i < Math.min(N, i0 + 22); i++) { const d = Math.hypot(e.clientX - pts[i].x, e.clientY - pts[i].y); if (d < bd) { bd = d; best = i; } }
        const tol = Math.max(42, innerHeight * 0.06);
        if (bd > tol) { leakNow(); return; }
        prog = Math.max(prog, best / (N - 1));
        place(); coach.progress();
        if (!pumped && prog > 0.48) { pumped = true; pump(); }
        if (prog >= 0.995) arrive();
      };
      const up = () => { dragging = false; };
      canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      const key = (e) => { if (done) return; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { prog = Math.min(1, prog + 0.03); place(); coach.progress(); if (!pumped && prog > 0.48) { pumped = true; pump(); } if (prog >= 0.995) arrive(); } };
      addEventListener('keydown', key);
      function leakNow() {
        dragging = false;
        store.log('sabab_leak', { at: +prog.toFixed(2) });
        audio.wrong();
        mem.leak.position.copy(mem.electron.position);
        gsap.fromTo(mem.leak.material, { opacity: 1 }, { opacity: 0, duration: D(0.9) });
        prog = 0; pumped = false; place();
      }
      function pump() {
        audio.snap();
        gsap.to(mem.prU.uLevel, { value: Math.min(1, mem.prU.uLevel.value + 0.22), duration: D(1.2) });
        cosmos.burstAqua.play(V(-4, -1.6, 2), 4, 0.3, 1.4);
        gsap.fromTo(mem.b6f.userData.mat, { emissiveIntensity: 1.6 }, { emissiveIntensity: 0.55, duration: D(1) });
      }
      function arrive() {
        runs++; dragging = false;
        audio.shimmer();
        gsap.fromTo(mem.psi.userData.mat, { emissiveIntensity: 1.8 }, { emissiveIntensity: 0.55, duration: D(1.2) });
        store.log('sabab_electron', { n: runs });
        if (runs >= 2) return finish();
        prog = 0; pumped = false; place();
      }
      function finish() {
        done = true; coach.done();
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
        removeEventListener('keydown', key);
        gsap.to([mem.dashes.material, mem.electron.material], { opacity: 0, duration: D(1) });
        setTimeout(res, 800);
      }
      window.__fitrahSolve = () => { pump(); runs = 1; arrive(); };
    });
  }

  // ------------------------------------------------------------------ step 4 · turn the rotor
  function turnRotor() {
    return new Promise((res) => {
      rig.flyTo({ pos: V(12.4, 2.4, 14), look: V(13.8, 1.7, 0), duration: 2.6 });
      const center = () => project(mem.atp.localToWorld(V(0, 1.8, 0)));
      window.__fitrahPhase = 'sabab:rotor';
      window.__fitrahDebug = { rotor: () => center(), made: () => made };
      const coach = ui.coach({ glyph: ['rotate', () => project(mem.atp.localToWorld(V(0, 3.9, 0)))], text: steps.rotor.instruction, hints: S2.hints, stall: 12 });
      let dragging = false, a0 = 0, angle = 0, made = 0, done = false, speed = 0, lastT = performance.now();
      const MAX = 7.5;                                                    // rad/s the gradient allows
      const ang = (e) => { const c = center(); return Math.atan2(e.clientY - c.y, e.clientX - c.x); };
      const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      const turn = (da, dt) => {
        speed = THREE.MathUtils.lerp(speed, Math.abs(da) / Math.max(dt, 1e-3), 0.3);
        const slip = speed > MAX * 1.5;
        const step = slip ? Math.sign(da) * MAX * dt : da;
        mem.atpGlow.material.color.set(slip ? 0xff5a3a : 0xffcf73);
        mem.atpGlow.material.opacity = THREE.MathUtils.clamp(speed / MAX, 0, 1) * 0.8;
        const before = Math.floor(Math.abs(angle) / (2 * Math.PI / 3));
        angle += Math.abs(step);
        mem.rotor.rotation.y = -angle;
        const after = Math.floor(Math.abs(angle) / (2 * Math.PI / 3));
        for (let k = before; k < after; k++) makeATP(k);
        gsap.to(mem.prU.uLevel, { value: Math.max(0.15, mem.prU.uLevel.value - Math.abs(step) * 0.004), duration: 0.2 });
      };
      const down = (e) => { dragging = true; a0 = ang(e); lastT = performance.now(); canvas.setPointerCapture(e.pointerId); coach.progress(); };
      const move = (e) => { if (!dragging || done) return; const a = ang(e), now = performance.now(); turn(wrap(a - a0), (now - lastT) / 1000); a0 = a; lastT = now; coach.progress(); };
      const up = () => { dragging = false; };
      const key = (e) => { if (done) return; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.code === 'Space') { turn(0.18, 0.05); coach.progress(); e.preventDefault(); } };
      canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      addEventListener('keydown', key);
      const stop = cosmos.addUpdater((dt) => { if (!dragging) { speed *= Math.exp(-4 * dt); mem.atpGlow.material.opacity *= Math.exp(-3 * dt); } });
      function makeATP(k) {
        made++;
        audio.snap();
        const b = mem.betas[k % 3];
        gsap.fromTo(b.material, { emissiveIntensity: 2.4 }, { emissiveIntensity: 0.6, duration: D(0.8) });
        const m = mem.atpPool.find((g) => !g.visible);
        if (m) {
          const wp = b.getWorldPosition(new THREE.Vector3());
          m.visible = true; m.position.copy(wp); m.scale.setScalar(0.4);
          gsap.to(m.scale, { x: 1, y: 1, z: 1, duration: D(0.4) });
          gsap.to(m.position, { x: wp.x + (Math.random() - 0.5) * 6, y: wp.y + 5 + Math.random() * 3, z: wp.z + 2, duration: D(3.2), ease: 'power1.out', onComplete: () => { m.visible = false; } });
        }
        store.log('sabab_atp', { n: made });
        if (made >= 9 && !done) finish();
      }
      function finish() {
        done = true; coach.done(); stop();
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
        removeEventListener('keydown', key);
        audio.swell();
        cosmos.burstGold.play(mem.atp.localToWorld(V(0, 4, 0)), 8, 0.5, 2);
        // keep it turning on its own for a moment: the machine runs as long as the gradient lasts
        gsap.to(mem.rotor.rotation, { y: mem.rotor.rotation.y - Math.PI * 4, duration: D(3), ease: 'power1.out' });
        setTimeout(res, 1500);
      }
      window.__fitrahSolve = () => { for (let i = 0; i < 9; i++) turn(2 * Math.PI / 3 + 0.001, 1); };
    });
  }
}
