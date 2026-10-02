// Fitrah – the cosmos of World 1: baked nebula sky, stars, sun, planets,
// orbit rings, the player's light orb, Dalil's star and particle bursts.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { GLSL_NOISE, glowTexture, planetTexture, ringTexture, mulberry32 } from './textures.js';
import { QUALITY } from '../core/scene.js';

// The hub, far from the system. It is placed so that, from the Horizon's wide shot,
// the whole solar system sits exactly inside the open gate: you see where you are going.
// horizon.align() mirrors it for left-to-right layouts.
export const HORIZON = new THREE.Vector3(-75.9, 9.7, 138.3);
export const ORB_HOME = new THREE.Vector3(-12.5, 3.2, 15.5); // where the orb watches the system
/** Gravitational parameter of the sun in game units: the inner orbit (R 6.5) takes about 8 s. */
export const GM = 169;
export const SUN_RADIUS = 2.5;

const GLOW = glowTexture();
const GLOW_AQUA = glowTexture([[0, 'rgba(255,255,255,1)'], [0.1, 'rgba(230,255,252,0.9)'], [0.3, 'rgba(120,240,225,0.3)'], [0.6, 'rgba(95,227,208,0.07)'], [1, 'rgba(0,0,0,0)']]);

// --------------------------------------------------------------------------- nebula (baked once)
const NEBULA_FRAG = /* glsl */`
${GLSL_NOISE}
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  vec3 q = vec3(fbm4(d*1.7), fbm4(d*1.7 + vec3(5.2,1.3,2.8)), fbm4(d*1.7 + vec3(1.7,9.2,3.1)));
  float n = fbm(d*2.3 + 1.7*q);
  vec3 axis = normalize(vec3(0.22, 1.0, 0.38));
  float band = pow(1.0 - abs(dot(d, axis)), 5.0);
  vec3 col = vec3(0.004, 0.005, 0.02);
  col += vec3(0.05, 0.05, 0.19) * smoothstep(-0.3, 0.7, n) * (0.6 + band);
  col += vec3(0.24, 0.08, 0.38) * pow(max(n, 0.0), 1.8) * (0.25 + band * 1.6);
  col += vec3(0.03, 0.26, 0.32) * pow(max(q.y + 0.1, 0.0), 2.6) * (0.2 + band * 1.2);
  float dust = smoothstep(0.05, 0.45, fbm4(d*7.0 + q*2.5));
  col *= mix(1.0, 0.35, dust * band);
  col += vec3(0.95, 0.62, 0.32) * pow(band, 4.0) * pow(max(n + 0.15, 0.0), 2.4) * 0.55;
  float s = pow(max(snoise(d*380.0), 0.0), 16.0) * 2.4 + pow(max(snoise(d*170.0 + 4.0), 0.0), 22.0) * 3.0;
  col += vec3(0.9, 0.93, 1.0) * s;
  gl_FragColor = vec4(col, 1.0);
}`;

function bakeNebula(renderer, size) {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 96, 48);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: NEBULA_FRAG,
  });
  s.add(new THREE.Mesh(geo, mat));
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.CubeCamera(0.1, 200, rt);
  cam.update(renderer, s);
  geo.dispose(); mat.dispose();
  return rt;
}

// --------------------------------------------------------------------------- stars
const STAR_VERT = /* glsl */`
attribute float size; attribute vec3 color; attribute float phase; attribute float spike;
uniform float uTime, uScale, uAtten, uAlpha;
varying vec3 vColor; varying float vA; varying float vSpike;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vA = (0.72 + 0.28 * sin(uTime * (0.6 + phase * 1.4) + phase * 6.2831)) * uAlpha;
  vColor = color; vSpike = spike;
  float s = size * uScale;
  if (uAtten > 0.5) s *= 50.0 / max(1.0, -mv.z);
  gl_PointSize = clamp(s, 1.0, 72.0);
  gl_Position = projectionMatrix * mv;
}`;
const STAR_FRAG = /* glsl */`
varying vec3 vColor; varying float vA; varying float vSpike;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float core = exp(-dot(d, d) * 46.0);
  float spikes = (exp(-abs(d.x) * 90.0) * exp(-abs(d.y) * 5.5) + exp(-abs(d.y) * 90.0) * exp(-abs(d.x) * 5.5)) * vSpike;
  float a = (core + spikes * 0.75) * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}`;

function makeStars({ count, rMin, rMax, seed, sizeMin, sizeMax, sizePow, spikeChance, atten, alpha, center = new THREE.Vector3(), tints }) {
  const r = mulberry32(seed);
  const pos = new Float32Array(count * 3), size = new Float32Array(count), col = new Float32Array(count * 3);
  const ph = new Float32Array(count), sp = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, rr = rMin + (rMax - rMin) * Math.pow(r(), 0.7), s = Math.sqrt(1 - u * u);
    pos.set([center.x + rr * s * Math.cos(th), center.y + rr * u * 0.8, center.z + rr * s * Math.sin(th)], i * 3);
    size[i] = sizeMin + (sizeMax - sizeMin) * Math.pow(r(), sizePow);
    const pick = r(); c.set(pick < tints[0][0] ? tints[0][1] : pick < tints[1][0] ? tints[1][1] : tints[2][1]);
    col.set([c.r, c.g, c.b], i * 3);
    ph[i] = r(); sp[i] = r() < spikeChance ? 0.6 + r() * 0.4 : 0;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('spike', new THREE.BufferAttribute(sp, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uAtten: { value: atten ? 1 : 0 }, uAlpha: { value: alpha } },
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false;
  return p;
}

// --------------------------------------------------------------------------- sun
const SUN_VERT = /* glsl */`
varying vec3 vObjN; varying vec3 vViewN; varying vec3 vView;
void main(){
  vObjN = normal;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const SUN_FRAG = /* glsl */`
${GLSL_NOISE}
uniform float uTime, uIntensity;
varying vec3 vObjN; varying vec3 vViewN; varying vec3 vView;
void main(){
  vec3 p = normalize(vObjN);
  float n1 = fbm4(p * 3.2 + vec3(0.0, uTime * 0.05, 0.0));
  float n2 = fbm4(p * 11.0 - vec3(uTime * 0.08));
  float gran = 0.55 + 0.4 * n1 + 0.22 * n2;
  float mu = clamp(dot(vViewN, vView), 0.0, 1.0);
  float limb = pow(mu, 0.5);
  vec3 deep = vec3(0.9, 0.3, 0.06), warm = vec3(1.0, 0.62, 0.22), hot = vec3(1.0, 0.96, 0.85);
  float k = gran * (0.35 + 0.65 * limb);
  vec3 col = mix(deep, warm, smoothstep(0.1, 0.55, k));
  col = mix(col, hot, smoothstep(0.5, 0.95, k));
  gl_FragColor = vec4(col * uIntensity * (0.55 + 0.65 * limb), 1.0);
}`;

// --------------------------------------------------------------------------- planets
export const PLANETS = [
  { R: 6.5, size: 0.62, kind: 'ocean', palette: ['#0a3550', '#16727c', '#62b98d'], atm: '#7fe3ff', ring: '#5ee0d4', ph: 0.4, dir: 1 },
  { R: 9.8, size: 0.86, kind: 'rock', palette: ['#6e2a1f', '#cf6f53', '#f0b392'], atm: '#ffb08a', ring: '#f0a07e', ph: 2.6, dir: -1 },
  { R: 13.4, size: 0.8, kind: 'ice', palette: ['#26429e', '#7fa2f5', '#dfe8ff'], atm: '#a5c0ff', ring: '#8fb2ff', ph: 4.4, dir: 1 },
  { R: 18.0, size: 1.45, kind: 'gas', palette: ['#94703f', '#e3c08a', '#f4e4c2', '#c45a2a'], atm: '#ffd9a0', ring: '#f3d7a6', ph: 1.2, dir: -1, rings: true },
];

const ATM_VERT = /* glsl */`
varying vec3 vN; varying vec3 vV; varying vec3 vWN;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  vWN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * mv;
}`;
const ATM_FRAG = /* glsl */`
uniform vec3 uColor; uniform vec3 uSunDir; uniform float uStrength;
varying vec3 vN; varying vec3 vV; varying vec3 vWN;
void main(){
  float rim = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 2.6);
  float lit = smoothstep(-0.35, 0.7, dot(vWN, uSunDir));
  float a = rim * (0.18 + 0.82 * lit) * uStrength;
  gl_FragColor = vec4(uColor, a);
}`;

const ORBIT_FRAG = /* glsl */`
uniform float uR, uOpacity, uGlow, uDash, uTime, uPulse, uBand, uBandAlpha; uniform vec3 uColor;
varying vec2 vP;
void main(){
  float r = length(vP); float d = abs(r - uR);
  float core = smoothstep(0.07, 0.0, d);
  float glow = exp(-d * d * 7.0) * uGlow;
  float ang = atan(vP.y, vP.x);
  float dash = mix(1.0, step(0.5, fract(ang * 9.549 * 2.0 + uTime * 0.15)), uDash);
  float pulse = 1.0 + uPulse * 0.55 * sin(uTime * 7.0);
  float band = smoothstep(uBand, uBand - 0.35, d) * (0.6 + 0.4 * smoothstep(uBand - 0.5, uBand, d)) * uBandAlpha;
  float a = (core * dash + glow) * uOpacity * pulse + band;
  gl_FragColor = vec4(uColor, a);
}`;

// --------------------------------------------------------------------------- factory
export function createCosmos({ scene, renderer }) {
  const root = new THREE.Group(); scene.add(root);
  const updaters = [];

  // Sky
  const sky = bakeNebula(renderer, QUALITY === 'low' ? 512 : 1024);
  scene.background = sky.texture;
  scene.environment = sky.texture;
  scene.backgroundIntensity = 1;

  // Stars: far field, bright stars with diffraction spikes, near dust for parallax
  const far = makeStars({ count: 6500, rMin: 600, rMax: 1400, seed: 3, sizeMin: 0.9, sizeMax: 3.2, sizePow: 6, spikeChance: 0, atten: false, alpha: 0.85,
    tints: [[0.62, '#cfe0ff'], [0.86, '#ffe2b8'], [1, '#ffffff']] });
  const bright = makeStars({ count: 220, rMin: 500, rMax: 1200, seed: 9, sizeMin: 10, sizeMax: 30, sizePow: 3, spikeChance: 0.85, atten: false, alpha: 0.9,
    tints: [[0.55, '#d9e6ff'], [0.85, '#ffd9a8'], [1, '#bff5ec']] });
  const dust = makeStars({ count: 1400, rMin: 8, rMax: 140, seed: 21, sizeMin: 0.5, sizeMax: 1.8, sizePow: 2, spikeChance: 0, atten: true, alpha: 0.45,
    tints: [[0.5, '#8ea0ff'], [0.85, '#ffd9a0'], [1, '#bff5ec']] });
  const dustHub = makeStars({ count: 700, rMin: 6, rMax: 60, seed: 33, sizeMin: 0.5, sizeMax: 1.6, sizePow: 2, spikeChance: 0, atten: true, alpha: 0.5, center: HORIZON,
    tints: [[0.5, '#ffd9a0'], [0.85, '#bff5ec'], [1, '#ffffff']] });
  const starLayers = [far, bright, dust, dustHub];
  starLayers.forEach((p) => root.add(p));

  // Sun
  const sunGroup = new THREE.Group(); root.add(sunGroup);
  const sunMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uIntensity: { value: 3.2 } }, vertexShader: SUN_VERT, fragmentShader: SUN_FRAG });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(2.5, 96, 64), sunMat); sunGroup.add(sun);
  const coronaIn = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffd08a, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }));
  coronaIn.scale.set(15, 15, 1); sunGroup.add(coronaIn);
  const coronaOut = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff9a48, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false }));
  coronaOut.scale.set(54, 54, 1); sunGroup.add(coronaOut);
  const streak = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffc98a, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
  streak.scale.set(90, 2.2, 1); sunGroup.add(streak);
  const sunLight = new THREE.PointLight(0xffe4c0, 60, 0, 1.15); sunGroup.add(sunLight);
  root.add(new THREE.AmbientLight(0x3a4690, 0.18));

  // Planets
  const ringTex = ringTexture();
  const planets = PLANETS.map((def, i) => {
    const group = new THREE.Group();
    const tex = planetTexture(def.kind, def.palette, 100 + i * 17, def.kind === 'gas' ? 1024 : 512);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0, envMapIntensity: 0.35 });
    // uLife: 0 barren rock .. 1 the living planet; uFreeze: frost when it drifts away
    const lifeU = { uLife: { value: 1 }, uFreeze: { value: 0 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, lifeU);
      sh.fragmentShader = 'uniform float uLife; uniform float uFreeze;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float lumP = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 barren = vec3(0.36, 0.3, 0.27) * (0.5 + 1.1 * lumP);
        diffuseColor.rgb = mix(barren, diffuseColor.rgb, uLife);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.88, 1.0) * (0.55 + 0.7 * lumP), uFreeze);`);
    };
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(def.size, 64, 48), mat);
    mesh.rotation.z = (i % 2 ? 1 : -1) * 0.35;
    group.add(mesh);
    const atmU = { uColor: { value: new THREE.Color(def.atm) }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uStrength: { value: 1.25 } };
    const atm = new THREE.Mesh(new THREE.SphereGeometry(def.size * 1.09, 48, 32), new THREE.ShaderMaterial({
      uniforms: atmU, vertexShader: ATM_VERT, fragmentShader: ATM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    group.add(atm);
    if (def.rings) {
      const rg = new THREE.RingGeometry(def.size * 1.45, def.size * 2.5, 160, 1);
      const pos = rg.attributes.position, uv = rg.attributes.uv, v3 = new THREE.Vector3();
      for (let k = 0; k < pos.count; k++) { v3.fromBufferAttribute(pos, k); uv.setXY(k, (v3.length() - def.size * 1.45) / (def.size * 1.05), 0.5); }
      const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0xc9b89a }));
      ring.rotation.x = Math.PI / 2.35; ring.rotation.y = 0.18;
      group.add(ring); group.userData.ring = ring;
    }
    // generous invisible hit target for touch
    const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(def.size * 2.4, 1.5), 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.planetIndex = i;
    group.add(hit);
    root.add(group);

    // orbit ring
    const ou = {
      uR: { value: def.R }, uOpacity: { value: 0.3 }, uGlow: { value: 0.0 }, uDash: { value: 1 }, uTime: { value: 0 }, uPulse: { value: 0 },
      uBand: { value: def.R * 0.22 }, uBandAlpha: { value: 0 },
      uColor: { value: new THREE.Color(def.ring) },
    };
    const og = new THREE.RingGeometry(def.R * 0.74 - 0.3, def.R * 1.26 + 0.3, 512, 1);
    const orbit = new THREE.Mesh(og, new THREE.ShaderMaterial({
      uniforms: ou, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: ORBIT_FRAG,
    }));
    orbit.rotation.x = -Math.PI / 2;
    root.add(orbit);

    return { ...def, index: i, group, mesh, atm, atmU, hit, orbit, orbitU: ou, lifeU, atmBase: 1.25, mode: 'orbit', w: Math.sqrt(GM / Math.pow(def.R, 3)), phase: def.ph,
      band: [def.R * 0.78, def.R * 1.22], pos: new THREE.Vector3(), vel: new THREE.Vector3() };
  });

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function chaosPos(i, t, out) {
    const p = planets[i];
    const a = p.ph + t * (0.55 + 0.22 * i) * -p.dir + Math.sin(t * 0.7 + i) * 0.6;
    const r = p.R * (1 + 0.3 * Math.sin(t * 0.83 + i * 1.9));
    const pr = t * 0.35 + i * 1.3;
    const x = r * Math.cos(a) * 1.3, z = r * Math.sin(a) * 0.72;
    return out.set(x * Math.cos(pr) - z * Math.sin(pr), 2.4 * Math.sin(t * 1.05 + i * 2.3), x * Math.sin(pr) + z * Math.cos(pr));
  }
  function orderPos(i, t, out) {
    const p = planets[i]; const a = p.phase + t * p.w * p.dir;
    return out.set(p.R * Math.cos(a), 0, p.R * Math.sin(a));
  }
  function setOrbitPhaseFromAngle(i, angle, t) { const p = planets[i]; p.phase = angle - t * p.w * p.dir; }

  // Newtonian gravity of the sun, integrated with velocity Verlet (symplectic: orbits stay closed).
  const acc = (pos, out) => { const r2 = pos.lengthSq(), r = Math.sqrt(r2); return out.copy(pos).multiplyScalar(-GM / (r2 * r)); };
  const a0 = new THREE.Vector3(), a1 = new THREE.Vector3();
  function verlet(pos, vel, h) {
    acc(pos, a0); vel.addScaledVector(a0, h / 2); pos.addScaledVector(vel, h); acc(pos, a1); vel.addScaledVector(a1, h / 2);
  }
  function stepBody(pos, vel, dt, sub = 8) { const h = dt / sub; for (let k = 0; k < sub; k++) verlet(pos, vel, h); }
  /** Orbital elements of a state (planar): energy, eccentricity, periapsis, apoapsis, period. */
  function elements(pos, vel) {
    const r = pos.length(), v2 = vel.lengthSq();
    const eps = v2 / 2 - GM / r;
    const hz = pos.z * vel.x - pos.x * vel.z; // angular momentum about y
    const h2 = hz * hz;
    const e = Math.sqrt(Math.max(0, 1 + (2 * eps * h2) / (GM * GM)));
    const rp = h2 / (GM * (1 + e));
    const ra = e < 1 ? h2 / (GM * (1 - e)) : Infinity;
    const a = eps < 0 ? -GM / (2 * eps) : Infinity;
    const T = eps < 0 ? 2 * Math.PI * Math.sqrt(a * a * a / GM) : Infinity;
    return { eps, e, rp, ra, a, T, hz };
  }
  /** Put a planet on its circular orbit at angle phi, moving in its own direction. */
  function circular(i, phi) {
    const p = planets[i], vc = Math.sqrt(GM / p.R);
    p.pos.set(p.R * Math.cos(phi), 0, p.R * Math.sin(phi));
    p.vel.set(-Math.sin(phi), 0, Math.cos(phi)).multiplyScalar(vc * p.dir);
    p.mode = 'physics';
  }

  // ------------------------------------------------------------------ the orb (player)
  const orb = (() => {
    const anchor = new THREE.Group(); const body = new THREE.Group(); anchor.add(body);
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, emissive: new THREE.Color(0xffd89a), emissiveIntensity: 1.6,
      roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.92,
    });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 64, 64), shellMat);
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(3.5) }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xfff0cc, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(2.6, 2.6, 1);
    const halo2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffd89a, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo2.scale.set(7, 7, 1);
    const light = new THREE.PointLight(0xffdcaa, 22, 26, 1.6);
    body.add(shell, heart, halo, halo2, light);
    root.add(anchor);
    const level = { v: 0 }; // grows with each verse collected
    const breath = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 2.4, ease: 'sine.inOut' } });
    breath.to(shellMat, { emissiveIntensity: 2.2 }, 0).to(light, { intensity: 30 }, 0);
    gsap.fromTo(body.position, { y: -0.22 }, { y: 0.22, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    const world = new THREE.Vector3();
    return {
      anchor, body, light, halo, halo2, level, world,
      grow() {
        gsap.to(level, { v: level.v + 1, duration: 1.4, ease: 'power2.out' });
        gsap.fromTo(halo2.material, { opacity: 0.9 }, { opacity: 0.2 + level.v * 0.03, duration: 1.6, ease: 'power2.out' });
      },
      update(dt, t) {
        const s = 1 + level.v * 0.12;
        halo.scale.setScalar(2.6 * s * (1 + 0.05 * Math.sin(t * 2.4)));
        halo2.scale.setScalar(7 * s);
        anchor.getWorldPosition(world); world.y += body.position.y;
      },
    };
  })();
  orb.anchor.position.copy(HORIZON).add(new THREE.Vector3(0, 0.6, 5));

  // orb light trail
  const TRAIL = 56;
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(TRAIL * 3), trailSize = new Float32Array(TRAIL), trailCol = new Float32Array(TRAIL * 3), trailPh = new Float32Array(TRAIL), trailSp = new Float32Array(TRAIL);
  for (let i = 0; i < TRAIL; i++) { trailSize[i] = 9 * (1 - i / TRAIL); trailCol.set([1, 0.86, 0.6], i * 3); }
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('size', new THREE.BufferAttribute(trailSize, 1));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  trailGeo.setAttribute('phase', new THREE.BufferAttribute(trailPh, 1));
  trailGeo.setAttribute('spike', new THREE.BufferAttribute(trailSp, 1));
  const trailMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uAtten: { value: 1 }, uAlpha: { value: 0.5 } },
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const trail = new THREE.Points(trailGeo, trailMat); trail.frustumCulled = false; root.add(trail);
  let trailInit = false;

  // ------------------------------------------------------------------ Dalil's star
  const dalil = (() => {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1, 0.97).multiplyScalar(3) }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_AQUA, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(1.1, 1.1, 1);
    g.add(core, glow); g.visible = false; root.add(g);
    const state = { on: 0, radius: 1.15, speed: 1.9 };
    const world = new THREE.Vector3();
    return {
      group: g, state, world,
      show() { g.visible = true; gsap.to(state, { on: 1, duration: 1.2, ease: 'power2.out' }); },
      hide() { gsap.to(state, { on: 0, duration: 0.6, onComplete: () => { g.visible = false; } }); },
      update(dt, t) {
        if (!g.visible) return;
        const a = t * state.speed;
        g.position.set(orb.world.x + Math.cos(a) * state.radius, orb.world.y + 0.3 * Math.sin(a * 1.7) + 0.15, orb.world.z + Math.sin(a) * state.radius);
        g.scale.setScalar(Math.max(0.001, state.on));
        g.getWorldPosition(world);
      },
    };
  })();

  // ------------------------------------------------------------------ particle bursts
  function makeBurst(count, color, seed) {
    const r = mulberry32(seed);
    const pos = new Float32Array(count * 3), size = new Float32Array(count), col = new Float32Array(count * 3), ph = new Float32Array(count), sp = new Float32Array(count);
    const ang = new Float32Array(count), spd = new Float32Array(count), yy = new Float32Array(count);
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) { ang[i] = r() * Math.PI * 2; spd[i] = 0.5 + r() * 0.9; yy[i] = (r() - 0.5) * 1.4; size[i] = 1 + r() * 3; ph[i] = r(); col.set([c.r, c.g, c.b], i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('phase', new THREE.BufferAttribute(ph, 1)); g.setAttribute('spike', new THREE.BufferAttribute(sp, 1));
    const m = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uAtten: { value: 1 }, uAlpha: { value: 0 } },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Points(g, m); p.frustumCulled = false; root.add(p);
    const st = { k: 0, center: new THREE.Vector3(), radius: 26, startR: 3 };
    return {
      play(center, radius = 26, startR = 3, duration = 3.2) {
        st.center.copy(center); st.radius = radius; st.startR = startR;
        gsap.fromTo(st, { k: 0 }, { k: 1, duration, ease: 'power2.out' });
        gsap.fromTo(m.uniforms.uAlpha, { value: 1.3 }, { value: 0, duration, ease: 'power1.in' });
      },
      update(t) {
        m.uniforms.uTime.value = t;
        if (m.uniforms.uAlpha.value <= 0.001) return;
        const a = pos;
        for (let i = 0; i < count; i++) {
          const rr = st.startR + st.k * spd[i] * st.radius;
          a[i * 3] = st.center.x + rr * Math.cos(ang[i] + st.k * 0.3);
          a[i * 3 + 1] = st.center.y + yy[i] * (1 + st.k * 2);
          a[i * 3 + 2] = st.center.z + rr * Math.sin(ang[i] + st.k * 0.3);
        }
        g.attributes.position.needsUpdate = true;
      },
      material: m,
    };
  }
  const burstGold = makeBurst(1100, '#ffd28a', 99);
  const burstAqua = makeBurst(300, '#bff5ec', 77);

  // ------------------------------------------------------------------ per-frame
  const sunDir = new THREE.Vector3();
  function update(dt, t) {
    const scale = renderer.getPixelRatio();
    for (const l of starLayers) { l.material.uniforms.uTime.value = t; l.material.uniforms.uScale.value = scale; }
    dust.rotation.y = t * 0.006; dustHub.rotation.y = -t * 0.008;
    trailMat.uniforms.uScale.value = scale; trailMat.uniforms.uTime.value = t;
    for (const b of [burstGold, burstAqua]) b.material.uniforms.uScale.value = scale;
    sunMat.uniforms.uTime.value = t;
    sun.rotation.y = t * 0.03;

    planets.forEach((p, i) => {
      if (p.mode === 'orbit') orderPos(i, t, p.group.position);
      else if (p.mode === 'chaos') chaosPos(i, t, p.group.position);
      else if (p.mode === 'physics') { stepBody(p.pos, p.vel, dt); p.group.position.copy(p.pos); }
      else if (p.mode === 'hold') p.group.position.copy(p.pos);
      p.atmU.uStrength.value = p.atmBase * (0.12 + 0.88 * p.lifeU.uLife.value);
      if (p.group.userData.ring) p.group.userData.ring.material.opacity = 0.15 + 0.85 * p.lifeU.uLife.value;
      p.mesh.rotation.y += dt * (0.25 + i * 0.05);
      sunDir.copy(p.group.position).negate().normalize();
      p.atmU.uSunDir.value.copy(sunDir);
      p.orbitU.uTime.value = t;
    });

    orb.update(dt, t);
    // trail: shift history
    if (!trailInit) { for (let i = 0; i < TRAIL; i++) trailPos.set([orb.world.x, orb.world.y, orb.world.z], i * 3); trailInit = true; }
    for (let i = TRAIL - 1; i > 0; i--) { trailPos[i * 3] = trailPos[(i - 1) * 3]; trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1]; trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2]; }
    trailPos[0] = orb.world.x; trailPos[1] = orb.world.y; trailPos[2] = orb.world.z;
    trailGeo.attributes.position.needsUpdate = true;

    dalil.update(dt, t);
    burstGold.update(t); burstAqua.update(t);
    for (const fn of updaters) fn(dt, t);
  }

  return {
    root, sky, sun, sunGroup, sunMat, sunLight, coronaIn, coronaOut, streak, planets, orb, dalil, dustHub,
    GM, stepBody, elements, circular, acc,
    burstGold, burstAqua, chaosPos, orderPos, setOrbitPhaseFromAngle, update,
    addUpdater(fn) { updaters.push(fn); return () => updaters.splice(updaters.indexOf(fn), 1); },
    GLOW, GLOW_AQUA,
  };
}
