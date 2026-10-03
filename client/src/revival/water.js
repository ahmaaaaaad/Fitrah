// The stream: an authored channel ribbon that fills from the source downhill as
// the water flow rises (section 20). Rain rings, flow streaks, sky reflection.
import * as THREE from 'three';
import { U } from './look.js';
import { NOISE, FIELD, LIGHT } from './glsl.js';
import { channelX, waterY, CHANNEL } from './terrain.js';

const vs = /* glsl */`
attribute float aAlong; attribute float aAcross;
varying float vAlong; varying float vAcross; varying vec3 vW;
void main(){ vAlong = aAlong; vAcross = aAcross; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const fs = /* glsl */`
${NOISE}${FIELD}${LIGHT}
uniform float uTime, uFrom, uFront, uLength, uStill, uGlow; uniform vec3 uZenith, uHorizon;
varying float vAlong; varying float vAcross; varying vec3 vW;
float ring(vec2 p, float t){
  vec2 i = floor(p), f = fract(p); float s = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); float h = hash12(i + g);
    float ph = fract(t * (0.6 + h * 0.5) + h * 7.0);
    vec2 c = g + vec2(hash12(i + g + 3.1), hash12(i + g + 7.7)) - f;
    float d = length(c); s += (1.0 - smoothstep(0.0, 0.06, abs(d - ph * 0.45))) * (1.0 - ph);
  }
  return s;
}
void main(){
  // water runs from where it gathered (uFrom) down to its front; a trickle at the front, a stream behind
  float filled = smoothstep(uFrom - 6.0, uFrom + 2.0, vAlong) * (1.0 - smoothstep(uFront - 2.0, uFront, vAlong));
  float w = mix(0.32, 1.0, smoothstep(0.0, 30.0, uFront - vAlong));
  float edge = 1.0 - smoothstep(0.55 * w, w, abs(vAcross));
  float a = filled * edge;
  if (a < 0.01) discard;
  float flowT = uTime * (1.0 - uStill * 0.85);
  vec2 q = vec2(vAcross * 2.0, vAlong * 0.35 - flowT * 1.6);
  float n1 = fbm(q * vec2(1.0, 0.6)), n2 = fbm(q * 2.3 + 4.0);
  vec3 N = normalize(vec3((n1 - 0.5) * (0.5 - uStill * 0.42), 1.0, (n2 - 0.5) * (0.5 - uStill * 0.42)));
  float rain = fieldA(vW.xz).a;
  float rr = ring(vW.xz * 1.3, uTime) * rain * (1.0 - uStill);
  N = normalize(N + vec3(rr * 0.35, 0.0, rr * 0.2));
  vec3 V = normalize(cameraPosition - vW);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, R.y));
  vec3 deep = vec3(0.012, 0.04, 0.045) * (0.6 + 0.4 * fieldB(vW.xz).b);
  vec3 col = mix(deep, sky * vec3(0.6, 0.72, 0.76), fres * 0.75);
  col += uSunCol * pow(max(dot(R, uSunDir), 0.0), 220.0) * 1.8 * fieldB(vW.xz).b;
  col += vec3(0.75, 0.8, 0.8) * smoothstep(0.62, 0.8, n2) * 0.08 * (1.0 - uStill); // flow streaks
  col += vec3(0.85, 0.9, 0.95) * rr * 0.25;
  col += vec3(0.8, 0.86, 0.9) * (1.0 - smoothstep(0.0, 6.0, uFront - vAlong)) * 0.25; // the leading edge glints
  // light gathering on the surface during the revelation (never a reflection of the letters)
  col += vec3(1.0, 0.82, 0.5) * uGlow * (0.25 + 0.75 * smoothstep(0.3, 0.9, n1)) * 0.45;
  col = grade(col);
  col = applyFog(col, length(cameraPosition - vW), vW.y);
  gl_FragColor = vec4(col, a * mix(0.8, 0.95, fres));
}`;

export function createWater(scene) {
  const pos = [], along = [], across = [], idx = [], centre = [];
  let L = 0, prev = null, rows = 0;
  for (let z = CHANNEL.zStart; z <= CHANNEL.zEnd; z += 1) {
    const x = channelX(z), y = waterY(z);
    if (prev) L += Math.hypot(x - prev[0], z - prev[1]);
    prev = [x, z];
    const dx = channelX(z + 0.5) - channelX(z - 0.5); // tangent (dx, 1) → normal (1, -dx)
    const nl = Math.hypot(1, dx), nx = 1 / nl, nz = -dx / nl;
    const hw = CHANNEL.halfWidth * (0.85 + 0.25 * Math.sin(z * 0.11)) * Math.min(1, (z - CHANNEL.zStart) / 12 + 0.35);
    centre.push([x, y, z, L]);
    for (const s of [-1, 0, 1]) {
      pos.push(x + nx * hw * s, y, z + nz * hw * s); along.push(L); across.push(s);
    }
    rows++;
  }
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < 2; c++) {
    const a = r * 3 + c, b = a + 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1));
  g.setIndex(idx);
  const uniforms = { ...U, uFrom: { value: 0 }, uFront: { value: 0 }, uLength: { value: L }, uStill: { value: 0 }, uGlow: { value: 0 } };
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  mesh.renderOrder = 2; mesh.frustumCulled = false;
  scene.add(mesh);
  /** Distance along the stream of the point nearest depth z (for the fill front). */
  const alongAt = (z) => along[Math.max(0, Math.min(rows - 1, Math.round(z - CHANNEL.zStart))) * 3];
  /** Point on the water's centre line at a distance along the stream. */
  function pointAt(a, out = new THREE.Vector3()) {
    let i = 0; while (i < centre.length - 2 && centre[i + 1][3] < a) i++;
    const p = centre[i], q = centre[i + 1], t = Math.max(0, Math.min(1, (a - p[3]) / Math.max(1e-3, q[3] - p[3])));
    return out.set(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
  }
  return { mesh, uniforms, length: L, alongAt, pointAt };
}
