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
varying float vA; varying vec2 vQ;
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
  vec3 p = c + dir * (position.y * 0.85) + side * (position.x * (0.014 + dist * 0.0012));
  vQ = position.xy;
  vA = vis * smoothstep(0.5, 3.0, dist) * (1.0 - smoothstep(30.0, 60.0, dist)) * (0.45 + 0.35 * r);
  gl_Position = projectionMatrix * viewMatrix * vec4(mix(c, p, vis), 1.0);
}`;
const fs = /* glsl */`
uniform vec3 uSkyCol, uSunCol;
varying float vA; varying vec2 vQ;
void main(){
  if (vA < 0.003) discard;
  float a = vA * (1.0 - abs(vQ.x) * 2.0) * smoothstep(-0.5, 0.2, vQ.y);
  gl_FragColor = vec4(mix(uSkyCol * 0.62, vec3(0.8, 0.86, 0.92), 0.3), a * 0.7);
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
