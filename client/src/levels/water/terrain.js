// The valley: an analytic heightfield (shared by the mesh, the camera, Dalil,
// the grass and the rain), the stream channel, and the painterly ground shader.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { U } from './look.js';
import { NOISE, FIELD, LIGHT } from './glsl.js';

// ------------------------------------------------------------------ JS noise (mirrors nothing in GLSL; heights only)
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function fbm(x, z, oct = 5) {
  let s = 0, a = 0.5;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x, z); x = x * 2.03 + 17.1; z = z * 2.03 + 9.7; a *= 0.5; }
  return s;
}
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ layout
export const M = CONFIG.meadow;
/** The stream's authored channel: x of the channel centre at depth z (north is -z, upstream). */
export const channelX = (z) => 9 * Math.sin(z * 0.028) + 4 * Math.sin(z * 0.071 + 1.3);
export const CHANNEL = { zStart: -118, zEnd: 140, halfWidth: 2.6 };

export function heightAt(x, z) {
  let h = -z * 0.035;                                         // the basin falls gently to the south
  h += Math.pow(smooth(46, 128, x), 1.5) * 36;                // east slope: where clouds gather
  h += smooth(-70, -130, x) * 26;                             // west wall
  h += smooth(105, 170, Math.abs(z)) * (z < 0 ? 30 : 18);     // north and south rims
  const r = Math.hypot(x, z);
  h += smooth(150, 700, r) * 55 * (0.6 + 0.8 * fbm(x * 0.004, z * 0.004, 3)); // the hills beyond
  const dm = Math.hypot(x - M.x, z - M.z);
  const plateau = smooth(M.r + 14, M.r - 8, dm);
  h += fbm(x * 0.012, z * 0.012) * 7 * (1 - plateau * 0.65) + (fbm(x * 0.05, z * 0.05, 3) - 0.5) * 1.6 * (1 - plateau * 0.7);
  const dc = Math.abs(x - channelX(z));
  h += plateau * 2.2 * smooth(4, 14, dc);                     // meadow plateau, cut by the stream
  if (z > CHANNEL.zStart - 6) h -= 1.35 * (1 - smooth(1.8, 6.5, dc)) * smooth(CHANNEL.zStart - 6, CHANNEL.zStart + 8, z); // channel
  return h;
}
export function normalAt(x, z, out = new THREE.Vector3()) {
  const e = 0.6;
  return out.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
}
/** Water surface height along the channel. */
export const waterY = (z) => heightAt(channelX(z), z) + 0.42;

// ------------------------------------------------------------------ ray queries (input, Dalil hit tests)
const _p = new THREE.Vector3();
export function raycastTerrain(ray, maxDist = 400) {
  let tPrev = 0, prevAbove = ray.origin.y - heightAt(ray.origin.x, ray.origin.z);
  if (prevAbove < 0) return null;
  for (let t = 1; t < maxDist; t += Math.max(1, t * 0.02)) {
    ray.at(t, _p);
    const above = _p.y - heightAt(_p.x, _p.z);
    if (above < 0) {
      let a = tPrev, b = t;
      for (let i = 0; i < 12; i++) { const m = (a + b) / 2; ray.at(m, _p); if (_p.y - heightAt(_p.x, _p.z) > 0) a = m; else b = m; }
      return ray.at((a + b) / 2, new THREE.Vector3());
    }
    tPrev = t; prevAbove = above;
  }
  return null;
}
export function raycastPlaneY(ray, y) {
  const dy = ray.direction.y;
  if (Math.abs(dy) < 1e-4) return null;
  const t = (y - ray.origin.y) / dy;
  return t > 0 ? ray.at(t, new THREE.Vector3()) : null;
}

// ------------------------------------------------------------------ meshes
function displacedPlane(size, seg) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, n = new THREE.Vector3();
  const nor = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, heightAt(x, z));
    normalAt(x, z, n); nor.setXYZ(i, n.x, n.y, n.z);
  }
  g.computeBoundingSphere();
  return g;
}
function outerRing(r0, r1, rings, segs, innerHalf) {
  const pos = [], nor = [], idx = [], n = new THREE.Vector3();
  for (let k = 0; k <= rings; k++) {
    const r = r0 * Math.pow(r1 / r0, k / rings);
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      let y = heightAt(x, z);
      if (Math.abs(x) < innerHalf && Math.abs(z) < innerHalf) y -= 0.8; // the inner mesh wins where they overlap
      pos.push(x, y, z); normalAt(x, z, n); nor.push(n.x, n.y, n.z);
    }
  }
  for (let k = 0; k < rings; k++) for (let s = 0; s < segs; s++) {
    const a = k * (segs + 1) + s, b = a + segs + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

const terrainVS = /* glsl */`
varying vec3 vW; varying vec3 vN;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }`;

const terrainFS = /* glsl */`
${NOISE}${FIELD}${LIGHT}
uniform float uTime, uFlow; uniform vec2 uMeadow; uniform float uMeadowR; uniform vec4 uDalil;
varying vec3 vW; varying vec3 vN;
vec2 hash22(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
// distance to the nearest crack: F2 - F1 of a jittered grid
float crackDist(vec2 p){
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 o = hash22(i + g); float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}
float channelX(float z){ return 9.0 * sin(z * 0.028) + 4.0 * sin(z * 0.071 + 1.3); }
void main(){
  vec3 N = normalize(vN);
  vec4 A = fieldA(vW.xz); vec4 B = fieldB(vW.xz);
  float inField = step(abs(vW.x), uHalf) * step(abs(vW.z), uHalf);
  float sm = A.r * inField, veg = A.g * inField, rain = A.a * inField, sun = mix(0.75, B.b, inField);
  float slope = 1.0 - N.y;
  float n1 = fbm(vW.xz * 0.07), n2 = fbm(vW.xz * 0.35);
  // dry, cracked soil that closes as it drinks
  float n0 = fbm(vW.xz * 0.018 + 4.0);
  vec3 dry = mix(vec3(0.17, 0.12, 0.08), vec3(0.3, 0.23, 0.15), n1) * (0.8 + 0.4 * n2);
  dry = mix(dry, dry * vec3(1.15, 0.92, 0.78), smoothstep(0.4, 0.7, n0)); // ochre and grey patches
  dry *= 0.75 + 0.5 * smoothstep(0.2, 0.8, n0);
  vec3 wet = mix(vec3(0.07, 0.05, 0.035), vec3(0.1, 0.072, 0.05), n1);
  vec3 col = mix(dry, wet, smoothstep(0.04, 0.55, sm));
  float cw = mix(0.07, 0.0, smoothstep(0.08, 0.42, sm)) * (0.7 + 0.6 * n2);
  float crack = 1.0 - smoothstep(cw * 0.4, cw, crackDist(vW.xz * 0.95));
  crack = max(crack, (1.0 - smoothstep(cw * 0.25, cw * 0.6, crackDist(vW.xz * 2.7 + 7.0))) * 0.55);
  crack *= smoothstep(140.0, 30.0, length(cameraPosition.xz - vW.xz)); // far away the cracks read as texture, not lines
  col = mix(col, col * 0.38, crack * (1.0 - slope * 2.0));
  // living ground
  vec3 green = mix(vec3(0.07, 0.13, 0.035), vec3(0.15, 0.2, 0.05), n1) * (0.85 + 0.3 * n2);
  col = mix(col, green, smoothstep(0.12, 0.75, veg) * (1.0 - smoothstep(0.2, 0.45, slope)));
  // rock on the steep slopes
  vec3 rock = mix(vec3(0.17, 0.15, 0.13), vec3(0.27, 0.24, 0.2), n2) * (0.8 + 0.3 * n1);
  col = mix(col, rock, smoothstep(0.28, 0.5, slope + (n1 - 0.5) * 0.2));
  // stream bed: pebbles and silt, wetter once the water has come
  float dc = abs(vW.x - channelX(vW.z));
  float bed = 1.0 - smoothstep(2.2, 4.6, dc);
  col = mix(col, mix(vec3(0.22, 0.2, 0.17), vec3(0.09, 0.08, 0.065), uFlow) * (0.75 + 0.5 * n2), bed * 0.85);
  // wet sheen while it rains
  vec3 V = normalize(cameraPosition - vW);
  float shade = mix(0.38, 1.0, sun);
  vec3 c = painterly(col, N, V, shade, vW.xz);
  vec3 H = normalize(uSunDir + V);
  c += uSunCol * pow(max(dot(N, H), 0.0), 60.0) * smoothstep(0.2, 0.7, sm) * (0.06 + rain * 0.12) * shade;
  // warm pools of light under the gaps in the clouds
  float pool = smoothstep(0.55, 0.95, sun) * uLightPhase;
  c += col * uSunCol * pool * 0.35;
  c = grade(c);
  // Dalil's own small light on the ground (kept out of grading so it stays warm)
  vec3 dd = vW - uDalil.xyz; float dg = exp(-dot(dd, dd) / 2.2) * uDalil.w;
  c += vec3(1.0, 0.78, 0.5) * dg * (0.18 + col * 1.6);
  c = applyFog(c, length(cameraPosition - vW), vW.y);
  gl_FragColor = vec4(c, 1.0);
}`;

export function createTerrain(scene) {
  const uniforms = { ...U, uFlow: { value: 0 }, uMeadow: { value: new THREE.Vector2(M.x, M.z) }, uMeadowR: { value: M.r } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: terrainVS, fragmentShader: terrainFS });
  const inner = new THREE.Mesh(displacedPlane(300, CONFIG.terrainSegments), mat);
  const outer = new THREE.Mesh(outerRing(140, 380, 20, 160, 150), mat); // beyond this the ridge layers take over
  inner.name = 'terrain'; outer.name = 'terrain-outer';
  scene.add(inner, outer);
  return { inner, outer, uniforms };
}
