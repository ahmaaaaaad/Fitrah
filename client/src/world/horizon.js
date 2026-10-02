// The Horizon: the hub with four gates, one per question. Gate 1 is open.
import * as THREE from 'three';
import { GLSL_NOISE } from './textures.js';
import { gsap } from 'gsap';
import { HORIZON } from './cosmos.js';

const WORLD_COLORS = ['#e8c277', '#4fb58a', '#e0a458', '#dde6f5'];

const PORTAL_FRAG = /* glsl */`
${GLSL_NOISE}
uniform float uTime, uIntensity, uOpen; uniform vec3 uColA, uColB;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float n = snoise(vec3(p * 3.4, uTime * 0.22)) * 0.5 + 0.5;
  // a slow vortex: logarithmic spiral arms drawn inward
  float sp = sin(a * 3.0 + log(r + 0.04) * 6.5 - uTime * 1.1 + n * 1.4);
  float arms = smoothstep(0.55, 1.0, sp) * smoothstep(0.25, 0.7, r) * smoothstep(1.0, 0.8, r);
  float rim = smoothstep(0.72, 0.985, r) * smoothstep(1.0, 0.975, r);
  float core = exp(-r * r * 34.0);
  float haze = (0.05 + 0.06 * n) * smoothstep(1.0, 0.6, r);
  float open = (arms * (0.3 + 0.7 * n) * 0.26 + rim * 0.5 + haze * 0.2) * uIntensity; // the centre stays clear: the destination shows through
  float closed = (haze * 0.7 + rim * 0.18) * uIntensity;
  float alpha = mix(closed, open, uOpen);
  vec3 col = mix(uColA, uColB, clamp(core * 1.4 + n * 0.25 + arms * 0.2, 0.0, 1.0));
  gl_FragColor = vec4(col, alpha);
}`;

// motes of light spiralling into the open gate
const MOTE_VERT = /* glsl */`
attribute float seed;
uniform float uTime, uScale;
varying float vA;
void main(){
  float k = fract(uTime * (0.07 + 0.05 * fract(seed * 7.3)) + seed);
  float r = 1.25 * (1.0 - k) + 0.05;
  float ang = seed * 6.2831 * 3.0 + k * 5.5;
  vec3 pos = vec3(cos(ang) * r, sin(ang) * r, 0.9 * (1.0 - k) - 0.25 * k);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vA = smoothstep(0.0, 0.15, k) * smoothstep(1.0, 0.75, k);
  gl_PointSize = uScale * (2.0 + 3.0 * fract(seed * 13.7)) * 20.0 / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const MOTE_FRAG = /* glsl */`
uniform vec3 uColor; varying float vA;
void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 30.0) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uColor, a); }`;

export function createHorizon({ root, glowTex }) {
  const group = new THREE.Group(); group.position.copy(HORIZON); root.add(group);
  const portals = [];
  let moteU = null;
  const gates = WORLD_COLORS.map((hex, i) => {
    const open = i === 0;
    const g = new THREE.Group();
    const col = new THREE.Color(hex);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, open ? 0.05 : 0.035, 16, 200),
      new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(open ? 2.0 : 0.75) }));
    const outer = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.012, 8, 200),
      new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(open ? 1.6 : 0.5), transparent: true, opacity: 0.6 }));
    const pu = { uTime: { value: 0 }, uOpen: { value: open ? 1 : 0 }, uIntensity: { value: open ? 1 : 0.8 }, uColA: { value: col.clone().multiplyScalar(open ? 1.4 : 0.8) }, uColB: { value: new THREE.Color(open ? '#fff1d0' : '#8fa0d8') } };
    const portal = new THREE.Mesh(new THREE.CircleGeometry(1.32, 96), new THREE.ShaderMaterial({
      uniforms: pu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: PORTAL_FRAG,
    }));
    portals.push(pu);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: open ? 0.24 : 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(7, 7, 1); glow.position.z = -0.2;
    g.add(glow, portal, ring, outer);
    if (open) {
      const N = 140, seeds = new Float32Array(N), pos = new Float32Array(N * 3);
      for (let k = 0; k < N; k++) seeds[k] = Math.random();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
      const mu = { uTime: { value: 0 }, uScale: { value: 1 }, uColor: { value: new THREE.Color('#ffe3a8').multiplyScalar(1.6) } };
      const motes = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: mu, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      motes.frustumCulled = false; g.add(motes); moteU = mu;
    }
    group.add(g);
    return { g, open, ring, portal, glow, phase: i * 1.3 };
  });

  // a pool of light under the gates
  const pool = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x6f7fd8, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = -1.4; group.add(pool);

  // gates can be hidden and unfolded (the intro reveals them)
  const rv = { v: 1 };
  const applyReveal = () => {
    gates.forEach((gt, i) => {
      const k = THREE.MathUtils.clamp(rv.v * 1.6 - i * 0.2, 0, 1);
      const e = k * k * (3 - 2 * k);
      gt.g.scale.setScalar(Math.max(0.001, e));
      gt.g.visible = e > 0.002;
    });
    pool.material.opacity = 0.35 * rv.v;
  };

  const layout = (dir) => {
    const xs = [6.9, 2.3, -2.3, -6.9];
    gates.forEach((gt, i) => {
      const x = dir === 'rtl' ? xs[i] : -xs[i];
      gt.g.position.set(x, 1.3, Math.abs(x) * 0.22);
      gt.g.rotation.y = -x * 0.05;
    });
  };
  layout('rtl');

  const v = new THREE.Vector3();
  /** Mirror the hub for the reading direction; returns how far it moved. */
  const align = (dir) => {
    const x = dir === 'rtl' ? -75.9 : 75.9;
    const delta = new THREE.Vector3(x - HORIZON.x, 0, 0);
    HORIZON.x = x; group.position.copy(HORIZON);
    return delta;
  };
  return {
    group, gates, layout, align,
    hideGates() { rv.v = 0; applyReveal(); },
    reveal(duration = 3) { return new Promise((res) => gsap.to(rv, { v: 1, duration, ease: 'power2.out', onUpdate: applyReveal, onComplete: res })); },
    shotWide: () => ({ pos: HORIZON.clone().add(new THREE.Vector3(0, 2.4, 15.5)), look: HORIZON.clone().add(new THREE.Vector3(0, 1.0, 0)), fov: 48 }),
    shotClose: (orbPos) => ({ pos: orbPos.clone().add(new THREE.Vector3(0.9, 0.35, 3.2)), look: orbPos.clone(), fov: 42 }),
    gateWorld: (i) => gates[i].g.getWorldPosition(new THREE.Vector3()),
    screenPositions(camera) {
      return gates.map((gt) => {
        v.set(gt.g.position.x, 1.3 - 2.15, gt.g.position.z); group.localToWorld(v); v.project(camera); // base height: labels ignore the bob
        if (v.z > 1) return null;
        return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
      });
    },
    update(dt, t) {
      portals.forEach((pu) => { pu.uTime.value = t; });
      if (moteU) { moteU.uTime.value = t; moteU.uScale.value = Math.min(2, window.devicePixelRatio || 1) * (innerHeight / 800); }
      gates.forEach((gt) => { gt.g.position.y = 1.3 + Math.sin(t * 0.8 + gt.phase) * 0.12; gt.ring.rotation.z = t * (gt.open ? 0.25 : 0.06); });
    },
  };
}
