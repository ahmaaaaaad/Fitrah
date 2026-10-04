// Dalil's body. PROVISIONAL form: a small walking light — a warm core, a soft halo
// that leans with the shared wind, and footfalls of light that fade on the ground.
// No face, no figure.
import * as THREE from 'three';
import { U } from '../look.js';
import { heightAt } from '../terrain.js';

const coreVS = /* glsl */`varying vec3 vN; varying vec3 vV;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`;
const coreFS = /* glsl */`uniform float uI; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(1.0 - max(dot(normalize(vN), vV), 0.0), 2.0); vec3 c = mix(vec3(1.7, 1.35, 0.9), vec3(1.25, 0.8, 0.4), f) * uI; gl_FragColor = vec4(c, 1.0); }`;
const haloVS = /* glsl */`uniform float uSize; uniform vec2 uLean; varying vec2 vUv;
void main(){ vUv = uv; vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz + vec3(uLean.x, 0.0, uLean.y) * (position.y + 0.5) * 0.25;
  gl_Position = projectionMatrix * viewMatrix * vec4(c + (right * position.x + up * position.y) * uSize, 1.0); }`;
const haloFS = /* glsl */`uniform float uI, uPulse; varying vec2 vUv;
void main(){ float r = length(vUv - 0.5) * 2.0; float g = exp(-r * r * 7.0) * 0.22 + exp(-r * r * 52.0) * 0.38; g *= 1.0 - smoothstep(0.85, 1.0, r);
  vec3 c = vec3(1.0, 0.78, 0.46) * g * uI * (0.85 + 0.15 * uPulse); gl_FragColor = vec4(c, g * uI); }`;
const footVS = /* glsl */`attribute vec4 aFoot; uniform float uTime; varying vec2 vUv; varying float vA;
void main(){ vUv = uv; float age = uTime - aFoot.w; vA = clamp(1.0 - age / 2.6, 0.0, 1.0) * step(0.0, age);
  vec3 p = aFoot.xyz + vec3(position.x * 0.16, 0.035, position.y * 0.24) * (0.8 + 0.4 * (1.0 - vA));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`;
const footFS = /* glsl */`varying vec2 vUv; varying float vA;
void main(){ float r = length((vUv - 0.5) * 2.0); float g = (1.0 - smoothstep(0.2, 1.0, r)) * vA; if (g < 0.002) discard; gl_FragColor = vec4(vec3(1.2, 0.9, 0.5) * g * 0.6, g); }`;

export function createDalilBody(scene) {
  const group = new THREE.Group(); group.name = 'dalil';
  const coreMat = new THREE.ShaderMaterial({ uniforms: { uI: { value: 1 } }, vertexShader: coreVS, fragmentShader: coreFS });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), coreMat);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 1 }, uPulse: { value: 0 }, uSize: { value: 1.0 }, uLean: { value: new THREE.Vector2() } },
    vertexShader: haloVS, fragmentShader: haloFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMat);
  halo.frustumCulled = false; halo.renderOrder = 12;
  group.add(core, halo);
  scene.add(group);

  // footfalls
  const N = 18, foot = new Float32Array(N * 4).fill(-100);
  const fg = new THREE.InstancedBufferGeometry();
  const plane = new THREE.PlaneGeometry(1, 1);
  fg.index = plane.index; fg.attributes.position = plane.attributes.position; fg.attributes.uv = plane.attributes.uv;
  const fAttr = new THREE.InstancedBufferAttribute(foot, 4); fAttr.setUsage(THREE.DynamicDrawUsage);
  fg.setAttribute('aFoot', fAttr); fg.instanceCount = N;
  const footMat = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime }, vertexShader: footVS, fragmentShader: footFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const feet = new THREE.Mesh(fg, footMat); feet.frustumCulled = false; feet.renderOrder = 3;
  scene.add(feet);
  let footIdx = 0, gait = 0, side = 1;

  const pose = { intensity: 0.2, hover: 0.75, lift: 0, pulse: 0, kneel: 0 };
  const _v = new THREE.Vector3();

  return {
    group, pose,
    /** Place the body: ground position (x, z), heading (radians), travelled distance this frame. */
    update(dt, t, x, z, heading, travelled, wind) {
      const gy = heightAt(x, z);
      gait += travelled;
      const stepLen = 0.42;
      if (gait > stepLen) {
        gait -= stepLen; side = -side;
        const sx = Math.cos(heading) * 0.08 * side, sz = Math.sin(heading) * 0.08 * side;
        const k = footIdx++ % N;
        foot[k * 4] = x + sx; foot[k * 4 + 1] = heightAt(x + sx, z + sz); foot[k * 4 + 2] = z + sz; foot[k * 4 + 3] = U.uTime.value;
        fAttr.needsUpdate = true;
      }
      const bob = Math.abs(Math.sin((gait / stepLen) * Math.PI)) * 0.05 * Math.min(1, travelled / (dt * 0.6 + 1e-5));
      const breathe = Math.sin(t * 1.6) * 0.02;
      const y = gy + pose.hover * (1 - pose.kneel * 0.6) + bob + breathe + pose.lift;
      group.position.set(x, y, z);
      const s = 1 + Math.sin(t * 2.1) * 0.04 + pose.pulse * 0.25;
      core.scale.setScalar(s);
      coreMat.uniforms.uI.value = pose.intensity;
      haloMat.uniforms.uI.value = pose.intensity;
      haloMat.uniforms.uPulse.value = pose.pulse;
      haloMat.uniforms.uSize.value = 0.5 + pose.pulse * 0.35 + pose.intensity * 0.1;
      haloMat.uniforms.uLean.value.set(Math.max(-1.5, Math.min(1.5, wind.x * 0.25)), Math.max(-1.5, Math.min(1.5, wind.z * 0.25)));
      U.uDalil.value.set(x, gy + 0.2, z, pose.intensity);
      pose.pulse *= Math.exp(-dt * 1.5);
    },
    screen(camera, w, h) {
      _v.copy(group.position).project(camera);
      const visible = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05;
      const d = camera.position.distanceTo(group.position);
      const r = (0.45 / Math.max(0.5, d)) * (h / 2) / Math.tan((camera.fov * Math.PI) / 360);
      return { x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h, r, visible, dist: d };
    },
  };
}
