// Particles: wind streaks that make the player's air visible (CPU-advected by the
// shared wind), light motes in the sun, drifting petals, and the motes that rise
// during a revelation (they rise and dissolve; they never form letters).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { U } from './look.js';
import { NOISE, FIELD, WIND } from './glsl.js';
import { windAt, sim } from './sim.js';
import { heightAt, M } from './terrain.js';

// ------------------------------------------------------------------ wind streaks
const streakVS = /* glsl */`attribute float aAlpha; varying float vA; varying vec3 vW;
void main(){ vA = aAlpha; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const streakFS = /* glsl */`uniform vec3 uFogCol, uSunCol; uniform float uMoist; varying float vA; varying vec3 vW;
void main(){ vec3 c = mix(vec3(0.62, 0.56, 0.48), vec3(0.9, 0.92, 0.95), uMoist); gl_FragColor = vec4(c * (0.7 + 0.3 * uSunCol.r), vA); }`;

function createStreaks(scene) {
  const n = CONFIG.moteCount;
  const P = new Float32Array(n * 3), life = new Float32Array(n), maxLife = new Float32Array(n);
  const pos = new Float32Array(n * 6), alpha = new Float32Array(n * 2);
  const g = new THREE.BufferGeometry();
  const pAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const aAttr = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', pAttr); g.setAttribute('aAlpha', aAttr);
  const uniforms = { ...U, uMoist: { value: 0 } };
  const lines = new THREE.LineSegments(g, new THREE.ShaderMaterial({ uniforms, vertexShader: streakVS, fragmentShader: streakFS, transparent: true, depthWrite: false }));
  lines.frustumCulled = false; lines.renderOrder = 7;
  scene.add(lines);
  const focus = new THREE.Vector3(0, 30, 40);
  const fwd = new THREE.Vector3(), w = { x: 0, z: 0 };
  function spawn(i, camera) {
    let x, y, z;
    if (Math.random() < 0.55) { // around where the player last moved the air
      x = focus.x + (Math.random() - 0.5) * 40; z = focus.z + (Math.random() - 0.5) * 40; y = focus.y + (Math.random() - 0.5) * 22;
    } else {
      camera.getWorldDirection(fwd);
      const d = 12 + Math.random() * 70;
      x = camera.position.x + fwd.x * d + (Math.random() - 0.5) * d * 1.2;
      z = camera.position.z + fwd.z * d + (Math.random() - 0.5) * d * 1.2;
      y = heightAt(x, z) + 1 + Math.random() * 58;
    }
    P[i * 3] = x; P[i * 3 + 1] = Math.max(heightAt(x, z) + 0.5, y); P[i * 3 + 2] = z;
    maxLife[i] = 2 + Math.random() * 3; life[i] = 0;
  }
  let inited = false;
  return {
    focus,
    update(dt, camera) {
      if (!inited) { for (let i = 0; i < n; i++) { spawn(i, camera); life[i] = Math.random() * maxLife[i]; } inited = true; }
      const lw = sim.arrays.wx, lz = sim.arrays.wz;
      for (let i = 0; i < n; i++) {
        life[i] += dt;
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        if (life[i] > maxLife[i] || Math.abs(x - camera.position.x) > 120 || Math.abs(z - camera.position.z) > 120) { spawn(i, camera); continue; }
        windAt(x, z, w);
        const nx = x + w.x * dt * 1.4, nz = z + w.z * dt * 1.4;
        P[i * 3] = nx; P[i * 3 + 2] = nz; P[i * 3 + 1] = y + Math.sin(life[i] * 1.7 + i) * dt * 0.3;
        const local = Math.hypot(sim.sample(lw, x, z), sim.sample(lz, x, z));
        const lf = Math.min(1, life[i] / 0.6) * Math.min(1, (maxLife[i] - life[i]) / 0.8);
        const a = (0.05 + 0.5 * Math.min(1, local / 5)) * lf;
        const k = i * 6, tl = 0.18 + Math.min(0.5, local * 0.05);
        pos[k] = nx; pos[k + 1] = P[i * 3 + 1]; pos[k + 2] = nz;
        pos[k + 3] = nx - w.x * tl; pos[k + 4] = P[i * 3 + 1]; pos[k + 5] = nz - w.z * tl;
        alpha[i * 2] = a; alpha[i * 2 + 1] = 0;
      }
      pAttr.needsUpdate = true; aAttr.needsUpdate = true;
      uniforms.uMoist.value += (Math.min(1, sim.stats.amBasin * 2.2) - uniforms.uMoist.value) * dt * 0.5;
    },
  };
}

// ------------------------------------------------------------------ points: light motes, petals, revelation motes
const pointsVS = /* glsl */`
${FIELD}${WIND}
attribute vec4 aSeed; attribute float aType;
uniform float uMotes, uPetals, uVerse, uPx; uniform vec3 uAnchor, uMeadowC;
varying float vA; varying float vType;
void main(){
  vType = aType;
  vec3 p; float a = 0.0; float size = 0.0;
  if (aType < 0.5) {            // light motes hanging in the sun
    vec2 base = uMeadowC.xz + (aSeed.xy - 0.5) * 110.0;
    p = vec3(base.x + sin(uTime * 0.2 + aSeed.z * 30.0) * 2.0, uMeadowC.y + 0.5 + aSeed.z * 12.0 + sin(uTime * 0.3 + aSeed.w * 20.0) * 0.8, base.y + cos(uTime * 0.17 + aSeed.w * 30.0) * 2.0);
    float sun = fieldB(p.xz).b;
    a = uMotes * smoothstep(0.55, 0.9, sun) * (0.5 + 0.5 * sin(uTime * 1.3 + aSeed.w * 40.0));
    size = 0.06;
  } else if (aType < 1.5) {     // petals carried by the wind
    float t = fract(uTime * (0.03 + aSeed.w * 0.03) + aSeed.z);
    vec2 base = uMeadowC.xz + (aSeed.xy - 0.5) * 90.0;
    vec2 w = windAt(base);
    p = vec3(base.x + w.x * t * 22.0, uMeadowC.y + 4.5 - t * 4.2 + sin(t * 30.0 + aSeed.w * 9.0) * 0.3, base.y + w.y * t * 22.0);
    a = uPetals * smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.85, t);
    size = 0.07;
  } else {                      // revelation motes rise and dissolve
    float t = fract(uTime * (0.08 + aSeed.w * 0.06) + aSeed.z);
    float ang = aSeed.x * 6.2832, rad = 0.4 + aSeed.y * 3.2;
    p = uAnchor + vec3(cos(ang) * rad, t * 5.5 - 2.4, sin(ang) * rad * 0.6);
    a = uVerse * smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.55, t);
    size = 0.05;
  }
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = a < 0.003 ? 0.0 : clamp(size * uPx / -mv.z, 1.0, 28.0);
  vA = a;
}`;
const pointsFS = /* glsl */`
varying float vA; varying float vType;
void main(){
  vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0;
  if (r > 1.0) discard;
  if (vType > 0.5 && vType < 1.5) {
    float pet = smoothstep(1.0, 0.55, r);
    gl_FragColor = vec4(vec3(0.9, 0.38, 0.05) * pet, pet * vA);
  } else {
    float g = pow(1.0 - r, 2.2);
    vec3 c = vType < 0.5 ? vec3(1.6, 1.35, 0.95) : vec3(1.9, 1.5, 0.9);
    gl_FragColor = vec4(c * g * vA, g * vA);
  }
}`;

export function createMotes(scene) {
  const counts = [CONFIG.moteCount === 500 ? 260 : 700, CONFIG.moteCount === 500 ? 160 : 420, 260];
  const total = counts[0] + counts[1] + counts[2];
  const seed = new Float32Array(total * 4), type = new Float32Array(total), pos = new Float32Array(total * 3);
  let k = 0;
  counts.forEach((c, t) => { for (let i = 0; i < c; i++, k++) { for (let j = 0; j < 4; j++) seed[k * 4 + j] = Math.random(); type[k] = t; } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('aType', new THREE.BufferAttribute(type, 1));
  const uniforms = {
    ...U, uMotes: { value: 0 }, uPetals: { value: 0 }, uVerse: { value: 0 }, uPx: { value: 800 },
    uAnchor: { value: new THREE.Vector3() }, uMeadowC: { value: new THREE.Vector3(M.x, heightAt(M.x, M.z), M.z) },
  };
  // additive glow for light, normal blending would darken petals: two draws of the same buffer
  const glow = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms, vertexShader: pointsVS, fragmentShader: pointsFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.frustumCulled = false; glow.renderOrder = 9;
  scene.add(glow);
  const streaks = createStreaks(scene);
  return {
    uniforms, streaks,
    update(dt, camera, renderer) {
      uniforms.uPx.value = renderer.getDrawingBufferSize(_v).y / (2 * Math.tan((camera.fov * Math.PI) / 360));
      streaks.update(dt, camera);
    },
  };
}
const _v = new THREE.Vector2();
