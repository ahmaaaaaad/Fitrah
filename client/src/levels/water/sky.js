// Sky dome, the three ridge layers, the cloud canopy (driven by the cloud field),
// light shafts through the gaps and rain curtains under ripe clouds.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { U } from './look.js';
import { NOISE, FIELD, LIGHT } from './glsl.js';
import { sim } from './sim.js';
import { heightAt } from './terrain.js';

// ------------------------------------------------------------------ dome
const domeVS = /* glsl */`varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const domeFS = /* glsl */`
${NOISE}
uniform vec3 uZenith, uHorizon, uSunDir, uSunCol, uFogCol; uniform float uHaze, uTime, uLightPhase;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(mix(uFogCol, uHorizon, smoothstep(0.0, 0.08, h)), uZenith, pow(smoothstep(0.0, 1.0, h), 0.6));
  col = mix(col, uFogCol * 0.85, smoothstep(0.0, -0.15, d.y));
  float sd = max(dot(d, uSunDir), 0.0);
  float clear = 1.0 - uHaze * 0.8;
  col += uSunCol * (pow(sd, 6.0) * 0.18 + pow(sd, 48.0) * 0.45) * clear;
  col += uSunCol * smoothstep(0.99935, 0.9997, sd) * 7.0 * (1.0 - uHaze * 0.9);
  // the drought's still overcast: a slow grey sheet that lifts as the valley revives
  vec2 p = d.xz / max(d.y + 0.08, 0.06) * 0.7 + vec2(uTime * 0.002, uTime * 0.0012);
  vec2 q = vec2(fbm(p * 0.8 + 3.1), fbm(p * 0.8 + 7.7));
  float o = fbm(p * vec2(1.0, 2.2) + q * 1.4);
  float lum = dot(uHorizon, vec3(0.299, 0.587, 0.114));
  vec3 over = mix(vec3(lum * 1.02), vec3(lum * 0.55), smoothstep(0.3, 0.75, o)) * mix(1.0, 0.7, smoothstep(0.05, 0.8, h));
  over *= vec3(1.0, 0.98, 0.95);
  col = mix(col, over, uHaze * smoothstep(-0.02, 0.2, d.y) * (0.7 + 0.3 * o));
  gl_FragColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ ridges at 300, 900 and 1800 m
const ridgeVS = /* glsl */`
attribute float aTop; varying float vTop; varying vec3 vW;
void main(){ vTop = aTop; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const ridgeFS = /* glsl */`
${NOISE}
uniform vec3 uFogCol, uHorizon, uSunCol, uSunDir, uGroundCol; uniform float uDepth, uSaturation;
varying float vTop; varying vec3 vW;
void main(){
  vec3 base = mix(uGroundCol * 0.55, uGroundCol * 0.9, fbm(vW.xz * 0.004));
  vec3 n = normalize(vec3(vW.x, 0.0, vW.z));
  base *= 0.8 + 0.4 * max(dot(-n, uSunDir), 0.0); // faces toward the sun read a touch lighter
  vec3 haze = mix(uFogCol, uHorizon, 0.4);
  float a = mix(0.42, 0.9, uDepth);
  vec3 col = mix(base, haze, a + (1.0 - vTop) * 0.12 * (1.0 - a));
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(mix(vec3(l), col, uSaturation), 1.0);
}`;
function ridgeGeometry(R, h0, h1, seed) {
  const segs = 220, pos = [], top = [], idx = [];
  for (let s = 0; s <= segs; s++) {
    const a = (s / segs) * Math.PI * 2 + seed;
    const n = 0.5 + 0.5 * Math.sin(a * 3.0 + seed) * 0.4 + 0.35 * Math.sin(a * 7.3 + seed * 2.1) + 0.18 * Math.sin(a * 17.1 + seed * 0.7) + 0.08 * Math.sin(a * 41.0);
    const hh = h0 + (h1 - h0) * Math.min(1, Math.max(0, n));
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    pos.push(x, -60, z, x, hh, z); top.push(0, 1);
  }
  for (let s = 0; s < segs; s++) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
  g.setIndex(idx);
  return g;
}

// ------------------------------------------------------------------ cloud canopy
const cloudVS = /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const cloudFS = /* glsl */`
${NOISE}${FIELD}${LIGHT}
uniform vec2 uPrevailing; uniform float uTime, uLayer, uHaze; uniform vec4 uBreak;
varying vec3 vW;
void main(){
  vec2 xz = vW.xz + vec2(uLayer * 1.5, -uLayer * 1.0);
  vec2 drift = uPrevailing * uTime * 0.6;
  float inside = 1.0 - smoothstep(uHalf - 40.0, uHalf - 4.0, max(abs(xz.x), abs(xz.y)));
  vec4 A = fieldA(xz);
  float c = A.b * inside;
  float far = (fbm((xz - drift) * 0.006 + 3.0) - 0.25) * (0.35 + uHaze * 0.4);
  c = max(c, far * (1.0 - inside * 0.7));
  vec2 p = (xz - drift) * 0.026;
  vec2 warp = vec2(fbm(p + 1.7), fbm(p + 9.2)) - 0.5;
  float n = fbm(p * 1.9 + warp * 1.7 + uLayer * 3.0);          // billows
  float n2 = vnoise((xz - drift * 1.3) * 0.15 + warp * 3.0);
  float d = c * (0.5 + 0.95 * n) + (n - 0.5) * 0.22 + (n2 - 0.5) * 0.09 - uLayer * 0.05;
  float a = smoothstep(0.16, 0.52, d);
  if (a < 0.003) discard;
  float rain = A.a * inside;
  float thick = smoothstep(0.15, 0.95, c) * (0.55 + 0.45 * n);
  vec3 V = normalize(vW - cameraPosition);
  float toward = pow(max(dot(V, uSunDir), 0.0), 5.0);
  vec3 under = mix(uSkyCol * 1.02, mix(uSkyCol, uGroundCol, 0.5) * 0.5, thick);
  under = mix(under, under * 0.78, rain);
  under *= 0.9 + 0.2 * n2;                                     // painterly mottling
  float edge = 1.0 - smoothstep(0.16, 0.42, d);
  vec3 col = under + uSunCol * edge * (0.12 + 0.55 * toward) * (1.0 - uHaze * 0.6);
  col += vec3(1.0, 0.82, 0.55) * uLightPhase * (1.0 - thick) * (0.18 + 0.4 * toward); // light leaking through thin cloud
  // the rim of a forming break glows with the sun behind it
  float db = distance(vW.xz, uBreak.xy) + (fbm(vW.xz * 0.06 + 2.0) - 0.5) * (4.0 + uBreak.z * 0.7); // an irregular edge, never a ring
  col += vec3(1.0, 0.86, 0.62) * uBreak.w * exp(-pow((db - uBreak.z) / (5.0 + uBreak.z * 0.3), 2.0)) * 0.45 * (1.0 - thick * 0.5);
  col = grade(col);
  float dist = length(vW.xz - cameraPosition.xz);
  col = mix(col, uFogCol, smoothstep(120.0, 420.0, dist) * 0.7);
  a *= 1.0 - smoothstep(260.0, 440.0, dist);
  gl_FragColor = vec4(col, a * mix(0.95, 0.45, uLayer));
}`;

// ------------------------------------------------------------------ columns: light shafts and rain curtains share one slot grid
const SLOT = 9, SN = Math.floor((2 * CONFIG.half) / SLOT);
const colVS = /* glsl */`
attribute vec4 aSlot;      // x, z, intensity, radius
uniform float uKind;       // 0 light shaft, 1 rain curtain
uniform vec3 uSunDir; uniform float uTop;
varying vec2 vUv; varying float vI; varying vec3 vW; varying vec3 vN;
void main(){
  vUv = uv; vI = aSlot.z;
  vec3 axis = uKind < 0.5 ? -uSunDir : vec3(0.0, -1.0, 0.0);
  vec3 side = normalize(cross(axis, vec3(0.0, 0.0, 1.0)));
  vec3 fwd = normalize(cross(side, axis));
  float len = uKind < 0.5 ? (uTop + 10.0) / max(uSunDir.y, 0.2) : uTop + 22.0;
  vec3 top = vec3(aSlot.x, uTop, aSlot.y);
  float r = aSlot.w * (uKind < 0.5 ? mix(1.0, 1.35, uv.y) : 1.0) * step(0.004, aSlot.z);
  vec3 local = side * position.x * r + fwd * position.z * r + axis * (1.0 - uv.y) * len;
  vec3 w = top + local;
  vN = normalize(side * position.x + fwd * position.z);
  vW = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const colFS = /* glsl */`
${NOISE}
uniform float uKind, uTime; uniform vec3 uSunCol, uSkyCol, uFogCol, uGroundCol;
varying vec2 vUv; varying float vI; varying vec3 vW; varying vec3 vN;
void main(){
  vec3 V = normalize(cameraPosition - vW);
  float edge = abs(dot(normalize(vN), V));
  float soft = pow(edge, 1.6);
  float ends = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
  if (uKind < 0.5) {
    float streak = 0.65 + 0.35 * fbm(vec2(vUv.x * 10.0 + uTime * 0.05, vUv.y * 2.0));
    float a = vI * soft * ends * streak * 0.85;
    gl_FragColor = vec4(uSunCol * vec3(1.05, 0.9, 0.68) * a, a);
  } else {
    float fall = fbm(vec2(vUv.x * 26.0, vUv.y * 5.0 + uTime * 2.6));
    float a = vI * soft * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.85, vUv.y) * (0.4 + 0.6 * fall) * 0.42;
    gl_FragColor = vec4(mix(uSkyCol, uGroundCol, 0.35) * 0.62, a);
  }
}`;

export function createSky(scene) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24),
    new THREE.ShaderMaterial({ uniforms: U, vertexShader: domeVS, fragmentShader: domeFS, side: THREE.BackSide, depthWrite: false }));
  dome.renderOrder = -10; dome.frustumCulled = false;
  scene.add(dome);

  const ridges = [[320, 30, 80, 0.4, 0], [900, 70, 170, 1.7, 0.5], [1800, 140, 330, 3.1, 1]].map(([R, a, b, seed, depth]) => {
    const m = new THREE.Mesh(ridgeGeometry(R, a, b, seed), new THREE.ShaderMaterial({
      uniforms: { ...U, uDepth: { value: depth } }, vertexShader: ridgeVS, fragmentShader: ridgeFS,
    }));
    m.frustumCulled = false; m.renderOrder = -5 - depth;
    scene.add(m); return m;
  });

  const cloudGeo = new THREE.PlaneGeometry(900, 900, 1, 1); cloudGeo.rotateX(Math.PI / 2); // faces down
  const clouds = [0, 1].map((layer) => {
    const m = new THREE.Mesh(cloudGeo, new THREE.ShaderMaterial({
      uniforms: { ...U, uLayer: { value: layer } }, vertexShader: cloudVS, fragmentShader: cloudFS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    m.position.y = CONFIG.cloudHeight + layer * 5; m.renderOrder = 5 - layer; m.frustumCulled = false;
    scene.add(m); return m;
  });

  // columns
  function makeColumns(kind) {
    const base = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true);
    base.translate(0, 0.5, 0); // uv.y 0 at bottom, 1 at top
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv; g.attributes.normal = base.attributes.normal;
    const slots = new Float32Array(SN * SN * 4);
    for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) {
      const k = (j * SN + i) * 4;
      slots[k] = -CONFIG.half + (i + 0.5) * SLOT + (Math.sin(i * 12.9 + j * 4.1) * 2.5);
      slots[k + 1] = -CONFIG.half + (j + 0.5) * SLOT + (Math.cos(i * 7.7 + j * 9.3) * 2.5);
    }
    const attr = new THREE.InstancedBufferAttribute(slots, 4); attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aSlot', attr); g.instanceCount = SN * SN;
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U, uKind: { value: kind }, uTop: { value: CONFIG.cloudHeight - 2 } }, vertexShader: colVS, fragmentShader: colFS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: kind === 0 ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = kind === 0 ? 8 : 4;
    scene.add(m);
    return { mesh: m, attr, slots, cur: new Float32Array(SN * SN) };
  }
  const shafts = makeColumns(0), curtains = makeColumns(1);
  const { cd, rain } = sim.arrays;
  let clock = 0;
  const targetsS = new Float32Array(SN * SN), targetsR = new Float32Array(SN * SN);
  const cloudSample = (x, z) => sim.sample(cd, x, z);

  function updateColumns(dt) {
    clock -= dt;
    if (clock <= 0) {
      clock = 0.25;
      const clear = Math.max(0, 1 - U.uHaze.value * 0.8);
      for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) {
        const s = j * SN + i, x = shafts.slots[s * 4], z = shafts.slots[s * 4 + 1];
        const c0 = cloudSample(x, z);
        let ring = 0;
        for (const rr of [12, 24, 40]) {
          let r = 0;
          for (let a = 0; a < 6; a++) r += cloudSample(x + Math.cos(a * 1.047 + rr) * rr, z + Math.sin(a * 1.047 + rr) * rr);
          ring = Math.max(ring, r / 6);
        }
        // a gap: clear here, cloud around it (shafts are what a gap in a canopy looks like)
        const through = 1 - smoothstepJS(0.1, 0.68, c0) * 0.93; // the same rule as the sunlight in the simulation
        targetsS[s] = smoothstepJS(0.3, 0.75, through) * smoothstepJS(0.2, 0.5, ring) * clear * (0.55 + 0.45 * U.uLightPhase.value);
        let rr = 0; for (let a = 0; a < 5; a++) rr = Math.max(rr, sim.sample(rain, x + (a === 1 ? 4 : a === 2 ? -4 : 0), z + (a === 3 ? 4 : a === 4 ? -4 : 0)));
        targetsR[s] = rr > 0.05 ? Math.min(1, rr * 1.4) : 0;
      }
    }
    const kS = 1 - Math.exp(-dt / 0.8), kR = 1 - Math.exp(-dt / 0.6);
    for (let s = 0; s < SN * SN; s++) {
      shafts.cur[s] += (targetsS[s] - shafts.cur[s]) * kS;
      curtains.cur[s] += (targetsR[s] - curtains.cur[s]) * kR;
      shafts.slots[s * 4 + 2] = shafts.cur[s]; shafts.slots[s * 4 + 3] = 4.5 + shafts.cur[s] * 5.0;
      curtains.slots[s * 4 + 2] = curtains.cur[s]; curtains.slots[s * 4 + 3] = 7.5;
    }
    shafts.attr.needsUpdate = true; curtains.attr.needsUpdate = true;
  }

  return {
    dome, ridges, clouds, shafts, curtains,
    update(dt, camera) {
      dome.position.copy(camera.position);
      updateColumns(dt);
    },
    groundAt: heightAt,
  };
}
function smoothstepJS(e0, e1, x) { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
