// Grass and wildflowers. Instances are scattered once; what the player sees is
// decided every frame by the vegetation field, so growth follows the rain exactly.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { U } from './look.js';
import { NOISE, FIELD, WIND, LIGHT } from './glsl.js';
import { heightAt, normalAt, channelX, M, fbm, poolEdge } from './terrain.js';

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// distance from (x, z) to the rail polyline
const RAIL = CONFIG.rail;
function railDist(x, z) {
  let best = 1e9;
  for (let i = 0; i < RAIL.length - 1; i++) {
    const [ax, az] = RAIL[i], [bx, bz] = RAIL[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
function grassDensity(x, z) {
  const dc = Math.abs(x - channelX(z));
  if (dc < 2.9) return 0;
  const pe = poolEdge(x, z);
  if (pe < 0.08) return 0; // nothing grows in the pool
  const n = normalAt(x, z);
  if (n.y < 0.8) return 0;
  const dm = Math.hypot(x - M.x, z - M.z);
  let d = 1.0 * (1 - smooth(M.r - 4, M.r + 10, dm));
  d = Math.max(d, 0.6 * (1 - smooth(5, 28, railDist(x, z))));
  d = Math.max(d, 0.75 * smooth(2.9, 3.6, dc) * (1 - smooth(5, 13, dc)) * (z > -118 ? 1 : 0));
  const B = CONFIG.basin;
  d = Math.max(d, 0.16 * (1 - smooth(B.r, B.r + 30, Math.hypot(x - B.x, z - B.z))));
  d = Math.max(d, 0.05 * (Math.abs(x) < 100 && Math.abs(z) < 115 ? 1 : 0));
  d = Math.max(d, 0.9 * smooth(0.08, 0.3, pe) * (1 - smooth(0.4, 0.9, pe))); // a thicker ring of grass at the shore
  return d * (0.65 + 0.7 * fbm(x * 0.05, z * 0.05, 3)) * smooth(0.8, 0.9, n.y);
}

// ------------------------------------------------------------------ grass
const grassVS = /* glsl */`
${FIELD}${WIND}
attribute vec4 aOff;   // x, z, rotation, random
attribute vec4 aShape; // height, width, growth threshold, ground y
uniform vec4 uDalil;
varying vec3 vW; varying float vT; varying float vRnd; varying float vSun; varying vec3 vN;
void main(){
  vec2 xz = aOff.xy;
  float dCam = distance(cameraPosition.xz, xz);
  vec4 A = fieldA(xz); vec4 B = fieldB(xz);
  float grow = smoothstep(aShape.z, aShape.z + 0.22, A.g);
  if (grow < 0.01 || dCam > 120.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float h = aShape.x * grow * (0.75 + 0.25 * smoothstep(0.4, 1.0, A.g));
  float t = position.y;
  float c = cos(aOff.z), s = sin(aOff.z);
  vec3 side = vec3(c, 0.0, s);
  vec2 wd = windAt(xz);
  float flutter = sin(uTime * 3.1 + aOff.w * 40.0 + xz.x * 0.4 + xz.y * 0.3);
  vec2 bend = wd * (0.06 + 0.025 * flutter) + vec2(-s, c) * 0.18 * (aOff.w - 0.5);
  float bl = length(bend); if (bl > 0.95) bend *= 0.95 / bl;
  float wid = aShape.y * (1.0 - t * 0.9) * mix(0.5, 1.0, grow) * (1.0 + dCam * 0.018);
  vec3 p = vec3(xz.x, aShape.w, xz.y) + side * position.x * wid;
  p.y += t * h * (1.0 - 0.4 * dot(bend, bend));
  p.xz += bend * t * t * h;
  vec2 dd = p.xz - uDalil.xz; float dl = length(dd);
  p.xz += dd / max(dl, 0.001) * t * h * 0.4 * exp(-dl * dl / 0.45) * step(0.01, uDalil.w);
  vW = p; vT = t; vRnd = aOff.w; vSun = B.b;
  vN = normalize(vec3(-s, 1.1, c));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const grassFS = /* glsl */`
${NOISE}${LIGHT}
uniform float uDroop; uniform vec4 uDalil;
varying vec3 vW; varying float vT; varying float vRnd; varying float vSun; varying vec3 vN;
void main(){
  vec3 base = mix(vec3(0.035, 0.07, 0.018), vec3(0.06, 0.1, 0.025), vRnd);
  vec3 tip = mix(vec3(0.16, 0.25, 0.05), vec3(0.28, 0.3, 0.07), vRnd);
  vec3 col = mix(base, tip, smoothstep(0.0, 1.0, vT));
  col = mix(col, vec3(0.32, 0.26, 0.1), uDroop * 0.55 * vT);
  vec3 V = normalize(cameraPosition - vW);
  vec3 N = normalize(vN); N = gl_FrontFacing ? N : vec3(-N.x, N.y, -N.z);
  float shade = mix(0.42, 1.0, vSun);
  vec3 c = painterly(col, N, V, shade * mix(0.5, 1.0, vT), vW.xz);
  float back = pow(max(dot(-V, uSunDir), 0.0), 3.0) * vT;
  c += uSunCol * col * back * 1.4 * shade;
  c += uSunCol * col * smoothstep(0.55, 0.95, vSun) * uLightPhase * 0.45;
  c = grade(c);
  vec3 dd = vW - uDalil.xyz; c += vec3(1.0, 0.78, 0.5) * exp(-dot(dd, dd) / 1.4) * uDalil.w * (0.05 + col * 2.2);
  c = applyFog(c, length(cameraPosition - vW), vW.y);
  gl_FragColor = vec4(c, 1.0);
}`;

// ------------------------------------------------------------------ flowers
const flowerVS = /* glsl */`
${FIELD}${WIND}
attribute vec4 aOff;   // x, z, random, ground y
attribute vec3 aShape; // stem height, head size, colour pick
attribute float aPart; // 0 stem, 1 head
uniform float uFlowers, uDroop;
varying vec2 vUv; varying float vPart; varying float vSel; varying float vSun; varying vec3 vW;
void main(){
  vec2 xz = aOff.xy;
  vec4 A = fieldA(xz); vec4 B = fieldB(xz);
  float bloom = smoothstep(0.55 + aOff.z * 0.18, 0.72 + aOff.z * 0.18, A.g) * uFlowers;
  if (bloom < 0.01 || distance(cameraPosition.xz, xz) > 95.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 wd = windAt(xz);
  float h = aShape.x * (0.55 + 0.45 * bloom);
  vec2 bend = wd * 0.05 * (1.0 + 0.4 * sin(uTime * 2.0 + aOff.z * 30.0));
  vec3 top = vec3(xz.x, aOff.w + h * (1.0 - 0.3 * uDroop), xz.y);
  top.xz += bend * h;
  vec3 p;
  if (aPart < 0.5) {
    vec3 base = vec3(xz.x, aOff.w, xz.y);
    vec3 toCam = normalize(vec3(cameraPosition.x - xz.x, 0.0, cameraPosition.z - xz.y));
    vec3 side = vec3(-toCam.z, 0.0, toCam.x);
    float t = position.y;
    p = mix(base, top, t) + side * position.x * 0.014;
  } else {
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float sz = aShape.y * bloom;
    p = top + (right * position.x + up * (position.y * (1.0 - 0.45 * uDroop) - 0.35 * uDroop * 0.5)) * sz;
  }
  vUv = uv; vPart = aPart; vSel = aShape.z; vSun = B.b; vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const flowerFS = /* glsl */`
${NOISE}${LIGHT}
uniform float uDroop;
varying vec2 vUv; varying float vPart; varying float vSel; varying float vSun; varying vec3 vW;
void main(){
  vec3 col;
  float shade = mix(0.45, 1.0, vSun);
  if (vPart < 0.5) {
    col = vec3(0.05, 0.1, 0.02) * shade;
  } else {
    vec2 q = vUv - 0.5; float r = length(q) * 2.0; float a = atan(q.y, q.x + 1e-5);
    float petal = 0.62 + 0.38 * abs(cos(a * 2.5));
    if (r > petal) discard;
    vec3 orange = mix(vec3(0.86, 0.2, 0.025), vec3(0.95, 0.42, 0.04), vSel);
    vec3 pc = vSel > 0.85 ? vec3(0.9, 0.86, 0.75) : (vSel > 0.7 ? vec3(0.92, 0.62, 0.06) : orange);
    col = mix(pc, pc * 0.6, smoothstep(0.3, 1.0, r) * 0.4);
    col = mix(col, vec3(0.3, 0.16, 0.03), 1.0 - smoothstep(0.18, 0.26, r));
    col = mix(col, col * vec3(0.8, 0.7, 0.6), uDroop * 0.5);
    col *= shade * (0.95 + uSunCol.r * 0.15);
    col += pc * uSunCol * smoothstep(0.55, 0.95, vSun) * uLightPhase * 0.3;
  }
  col = grade(col);
  col = applyFog(col, length(cameraPosition - vW), vW.y);
  gl_FragColor = vec4(col, 1.0);
}`;

function bladeGeometry() {
  const pos = [-0.5, 0, 0, 0.5, 0, 0, -0.5, 0.3, 0, 0.5, 0.3, 0, -0.5, 0.62, 0, 0.5, 0.62, 0, 0, 1, 0];
  const idx = [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
function flowerGeometry() {
  const pos = [-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0, -0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0];
  const uv = [0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1];
  const part = [0, 0, 0, 0, 1, 1, 1, 1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex([0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6]);
  return g;
}
function instanced(base, count, attrs) {
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  for (const [k, v] of Object.entries(base.attributes)) g.setAttribute(k, v);
  for (const [k, [arr, size]] of Object.entries(attrs)) g.setAttribute(k, new THREE.InstancedBufferAttribute(arr, size));
  g.instanceCount = count;
  return g;
}

export function createFlora(scene) {
  // scatter grass by rejection sampling against the density map
  const n = CONFIG.grassCount, off = new Float32Array(n * 4), shape = new Float32Array(n * 4);
  let placed = 0, tries = 0;
  while (placed < n && tries < n * 60) {
    tries++;
    const x = (Math.random() * 2 - 1) * 126, z = (Math.random() * 2 - 1) * 126;
    if (Math.random() > grassDensity(x, z)) continue;
    const inMeadow = Math.hypot(x - M.x, z - M.z) < M.r;
    const k = placed * 4;
    off[k] = x; off[k + 1] = z; off[k + 2] = Math.random() * Math.PI * 2; off[k + 3] = Math.random();
    shape[k] = (inMeadow ? 0.38 : 0.28) + Math.random() * (inMeadow ? 0.42 : 0.3);
    shape[k + 1] = 0.08 + Math.random() * 0.07;
    shape[k + 2] = 0.06 + Math.random() * 0.42;
    shape[k + 3] = heightAt(x, z) - 0.02;
    placed++;
  }
  const grassMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: grassVS, fragmentShader: grassFS, side: THREE.DoubleSide });
  const grass = new THREE.Mesh(instanced(bladeGeometry(), placed, { aOff: [off, 4], aShape: [shape, 4] }), grassMat);
  grass.frustumCulled = false; grass.name = 'grass';
  scene.add(grass);

  // wildflowers: the meadow, inside a noise mask, plus a few along the banks
  const fn = CONFIG.flowerCount, foff = new Float32Array(fn * 4), fshape = new Float32Array(fn * 3);
  let fp = 0; tries = 0;
  while (fp < fn && tries < fn * 200) {
    tries++;
    const x = (Math.random() * 2 - 1) * 126, z = (Math.random() * 2 - 1) * 126;
    const dm = Math.hypot(x - M.x, z - M.z), dc = Math.abs(x - channelX(z));
    const mask = fbm(x * 0.06 + 11, z * 0.06 + 3, 3);
    let p = (1 - smooth(M.r - 6, M.r + 4, dm)) * smooth(0.42, 0.6, mask);
    p = Math.max(p, 0.25 * smooth(3.2, 4, dc) * (1 - smooth(6, 9, dc)) * smooth(0.5, 0.62, mask));
    if (dc < 3.2 || poolEdge(x, z) < 0.25 || Math.random() > p) continue;
    const k = fp * 4, k3 = fp * 3;
    foff[k] = x; foff[k + 1] = z; foff[k + 2] = Math.random(); foff[k + 3] = heightAt(x, z) - 0.02;
    fshape[k3] = 0.28 + Math.random() * 0.4; fshape[k3 + 1] = 0.09 + Math.random() * 0.08; fshape[k3 + 2] = Math.random();
    fp++;
  }
  const flowerU = { ...U, uFlowers: { value: 0 } };
  const flowers = new THREE.Mesh(instanced(flowerGeometry(), fp, { aOff: [foff, 4], aShape: [fshape, 3] }),
    new THREE.ShaderMaterial({ uniforms: flowerU, vertexShader: flowerVS, fragmentShader: flowerFS, side: THREE.DoubleSide }));
  flowers.frustumCulled = false; flowers.name = 'flowers';
  scene.add(flowers);
  return { grass, flowers, uniforms: flowerU, counts: { grass: placed, flowers: fp } };
}
