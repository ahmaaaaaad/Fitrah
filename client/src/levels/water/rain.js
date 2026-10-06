// Rain near the camera: streaks that wrap around the viewer, tilt with the
// shared wind and appear only where the rain field says it is raining.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { U } from './look.js';
import { FIELD, WIND } from './glsl.js';
import { sim } from './sim.js';

const vs = /* glsl */`
${FIELD}${WIND}
attribute vec4 aSeed;
uniform float uBox, uHeight;
varying float vA; varying vec2 vQ; varying float vDist; varying float vSun;
void main(){
  vec2 world = aSeed.xy * uBox;
  vec2 xz = cameraPosition.xz + (fract((world - cameraPosition.xz) / uBox) - 0.5) * uBox;
  float speed = 10.0 + aSeed.w * 4.0;
  float fallT = fract(aSeed.z + uTime * speed / uHeight);
  vec2 w = windAt(xz) * 0.7;
  float age = fallT * uHeight / speed;
  vec3 c = vec3(xz.x + w.x * age, cameraPosition.y + uHeight * 0.85 - fallT * uHeight, xz.y + w.y * age);
  float r = fieldA(c.xz).a;
  float vis = step(aSeed.w, r * 1.15) * step(0.02, r);
  vec3 dir = normalize(vec3(w.x, -speed, w.y));
  vec3 toCam = normalize(cameraPosition - c);
  vec3 side = normalize(cross(dir, toCam));
  float dist = length(cameraPosition - c);
  // depth: near drops are long, thin and clear; far ones shorter, softer and taken by the air
  float len = (0.55 + fract(aSeed.w * 37.0 + aSeed.z * 11.0) * 0.6) * mix(1.0, 0.6, smoothstep(6.0, 40.0, dist)); // not tied to position (no seam)
  vec3 p = c + dir * (position.y * 0.85 * len) + side * (position.x * (0.012 + dist * 0.0011));
  vQ = position.xy; vDist = dist; vSun = fieldB(c.xz).b;
  // the rain comes in slow, uneven veils rather than an even screen
  float veil = 0.62 + 0.38 * (0.5 + 0.5 * sin(c.x * 0.045 + uTime * 0.5)) * (0.5 + 0.5 * sin(c.z * 0.038 - uTime * 0.37 + 1.7));
  vA = vis * smoothstep(0.5, 3.0, dist) * (1.0 - smoothstep(28.0, 60.0, dist)) * (0.45 + 0.35 * r) * veil * mix(1.0, 0.5, smoothstep(8.0, 45.0, dist));
  gl_Position = projectionMatrix * viewMatrix * vec4(mix(c, p, vis), 1.0);
}`;
const fs = /* glsl */`
uniform vec3 uSkyCol, uSunCol, uFogCol;
varying float vA; varying vec2 vQ; varying float vDist; varying float vSun;
void main(){
  if (vA < 0.003) discard;
  float a = vA * (1.0 - abs(vQ.x) * 2.0) * smoothstep(-0.5, 0.2, vQ.y);
  vec3 near = mix(uSkyCol * 0.62, vec3(0.8, 0.86, 0.92), 0.3);
  vec3 col = mix(near, uFogCol * 0.95, smoothstep(10.0, 50.0, vDist));   // far drops take the colour of the air
  col += uSunCol * smoothstep(0.55, 0.95, vSun) * 0.18;                  // lit where the sun comes through
  gl_FragColor = vec4(col, a * 0.7);
}`;

export function createRain(scene) {
  const n = CONFIG.rainCount;
  const quad = new THREE.PlaneGeometry(1, 1, 1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index; g.attributes.position = quad.attributes.position;
  const seed = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seed[i] = Math.random();
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uBox: { value: 110 }, uHeight: { value: CONFIG.cloudHeight + 6 } }, vertexShader: vs, fragmentShader: fs,
    transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 6;
  scene.add(mesh);
  return {
    mesh,
    update() { mesh.visible = sim.stats.rainMax > 0.02; },
  };
}
