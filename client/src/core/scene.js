// Fitrah – core rendering engine
// Renderer, scene, camera, post-processing chain, adaptive resolution and the
// single frame loop every other module hooks into via onUpdate().

import * as THREE from 'three';
import { gsap } from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const params = new URLSearchParams(location.search);
// ---------------------------------------------------------------------------
// Quality profiles. The device decides a starting profile (screen, memory, cores,
// and the GPU once a context exists); the adaptive resolution below then follows
// the real frame times. ?q=cinematic|high|balanced|performance (or ?q=low) forces one.
//   cinematic  everything, full resolution          (fast desktops)
//   high       everything, resolution capped at 2   (desktops, recent laptops)
//   balanced   bloom on, fewer particles, ratio 1.5 (phones and tablets)
//   performance no bloom or MSAA, half the particles (older devices, software GPUs)
// ---------------------------------------------------------------------------
export const PROFILES = {
  cinematic: { particles: 1.0, pixelRatioMax: 2.5, bloom: true, msaa: 4, name: 'cinematic' },
  high: { particles: 1.0, pixelRatioMax: 2, bloom: true, msaa: 4, name: 'high' },
  balanced: { particles: 0.6, pixelRatioMax: 1.5, bloom: true, msaa: 0, name: 'balanced' },
  performance: { particles: 0.35, pixelRatioMax: 1, bloom: false, msaa: 0, name: 'performance' },
};
function guessProfile() {
  const forced = params.get('q');
  if (forced === 'low') return 'performance';
  if (PROFILES[forced]) return forced;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  if (coarse) return mem >= 6 && cores >= 6 ? 'balanced' : (mem <= 2 || cores <= 4 ? 'performance' : 'balanced');
  return cores >= 12 && mem >= 8 ? 'cinematic' : 'high';
}
let profileName = guessProfile();
export let QUALITY = profileName === 'performance' ? 'low' : 'high';
export const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
export const CONFIG = {
  exposure: 1.3,
  bloom: { threshold: 0.72, strength: 0.78, radius: 0.45 }, // only truly bright things glow
  camera: { fov: 48, near: 0.1, far: 4000 },
  msaaSamples: QUALITY === 'low' ? 0 : 4,
  pixelRatio: {
    max: 2, min: 0.75, step: 0.25,
    slowFrameMs: 22, fastFrameMs: 15,
    sampleFrames: 90, cooldownMs: 2000,
  },
};

// ---------------------------------------------------------------------------
// Renderer, scene, camera
// ---------------------------------------------------------------------------
const canvas = document.createElement('canvas');
canvas.id = 'fitrah-canvas';

export const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance', stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.exposure;

// a software renderer (no GPU) gets the lightest profile, whatever the screen says
try {
  const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu) && !PROFILES[params.get('q')]) profileName = 'performance';
  PROFILES.gpu = gpu;
} catch { /* the GPU name is optional */ }
QUALITY = profileName === 'performance' ? 'low' : 'high';
/** The active profile: { particles, pixelRatioMax, bloom, msaa, name } */
export const PROFILE = PROFILES[profileName];

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov, window.innerWidth / window.innerHeight, CONFIG.camera.near, CONFIG.camera.far,
);

// ---------------------------------------------------------------------------
// Post-processing: Render → Bloom → Output (ACES + sRGB) → Cinematic
// ---------------------------------------------------------------------------
CONFIG.msaaSamples = PROFILE.msaa;
CONFIG.pixelRatio.max = PROFILE.pixelRatioMax;
const composerTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType, samples: CONFIG.msaaSamples,
});
export const composer = new EffectComposer(renderer, composerTarget);
composer.addPass(new RenderPass(scene, camera));
// A guard before the bloom: one invalid pixel (NaN or infinity, which some mobile GPUs
// produce where desktop drivers quietly do not) would otherwise be spread by the bloom
// into a large black block across the middle of the picture. Such pixels become black,
// and very bright ones are capped, so the bloom stays a glow.
export const sanitize = new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      bool bad = any(isnan(c)) || any(isinf(c)) || !(c.r >= 0.0 && c.r < 1e5) || !(c.g >= 0.0 && c.g < 1e5) || !(c.b >= 0.0 && c.b < 1e5);
      gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(min(c.rgb, vec3(48.0)), c.a);
    }`,
});
composer.addPass(sanitize);

export const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  CONFIG.bloom.strength, CONFIG.bloom.radius, CONFIG.bloom.threshold,
);
bloomPass.enabled = PROFILE.bloom;
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// Display-space finishing: chromatic aberration, zoom-blur warp, vignette,
// film grain and a tint used for the "conflict" flicker in station 3.
export const cinematic = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.85 },
    uGrain: { value: 0.035 },
    uCA: { value: 0.0022 },
    uWarp: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uTintAmt: { value: 0 },
    uFade: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes;
    uniform float uVignette, uGrain, uCA, uWarp, uTintAmt, uFade; uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 sampleCA(vec2 uv){
      vec2 c = uv - 0.5; float d = length(c);
      float k = uCA * (0.4 + d * 2.0);
      return vec3(texture2D(tDiffuse, uv + c * k).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c * k).b);
    }
    void main(){
      vec2 c = vUv - 0.5; float d = length(c);
      vec3 col;
      if (uWarp > 0.001) {
        col = vec3(0.0);
        for (int i = 0; i < 10; i++) { float s = 1.0 - uWarp * 0.045 * float(i); col += sampleCA(c * s + 0.5); }
        col /= 10.0;
        col += vec3(0.55, 0.62, 1.0) * uWarp * 0.12 * smoothstep(0.0, 0.7, d);
      } else {
        col = sampleCA(vUv);
      }
      col *= mix(1.0, smoothstep(0.95, 0.18, d), uVignette);
      col = mix(col, col * uTint, uTintAmt);
      col += (hash(vUv * uRes + fract(uTime * 7.13)) - 0.5) * uGrain;
      col = mix(col, vec3(0.0), uFade);
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(cinematic);

// ---------------------------------------------------------------------------
// ResizeHandler — matches the canvas to its container and adapts the pixel
// ratio to the device's real frame times.
// ---------------------------------------------------------------------------
export class ResizeHandler {
  constructor({ renderer, composer, camera, container, config = CONFIG.pixelRatio }) {
    Object.assign(this, { renderer, composer, camera, container, cfg: config });
    this.deviceRatio = window.devicePixelRatio || 1;
    this.ceiling = Math.min(this.deviceRatio, config.max);
    this.floor = Math.min(config.min, this.ceiling);
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.pixelRatio = QUALITY === 'low' ? this.floor
      : coarse ? Math.max(this.floor, this.ceiling - config.step) : this.ceiling;
    this.samples = [];
    this.lastChange = performance.now();
    this._observer = new ResizeObserver(() => this.resize());
    this._observer.observe(container);
    this._watchDeviceRatio();
    this.resize();
  }
  resize() {
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this._apply();
  }
  sample(frameMs) {
    const s = this.samples;
    s.push(frameMs);
    if (s.length > this.cfg.sampleFrames) s.shift();
    if (s.length < this.cfg.sampleFrames) return;
    const now = performance.now();
    if (now - this.lastChange < this.cfg.cooldownMs) return;
    const avg = s.reduce((a, b) => a + b, 0) / s.length;
    let next = this.pixelRatio;
    if (avg > this.cfg.slowFrameMs) next = Math.max(this.floor, this.pixelRatio - this.cfg.step);
    else if (avg < this.cfg.fastFrameMs) next = Math.min(this.ceiling, this.pixelRatio + this.cfg.step);
    if (next !== this.pixelRatio) {
      this.pixelRatio = next; this.lastChange = now; s.length = 0; this._apply();
    } else if (this.pixelRatio === this.floor && avg > this.cfg.slowFrameMs * 1.4 && bloomPass.enabled) {
      // still slow at the lowest resolution: drop bloom (the sprite glows remain)
      bloomPass.enabled = false; this.lastChange = now; s.length = 0;
    }
  }
  _apply() {
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(this.width, this.height);
    cinematic.uniforms.uRes.value.set(this.width * this.pixelRatio, this.height * this.pixelRatio);
  }
  _watchDeviceRatio() {
    const mq = window.matchMedia(`(resolution: ${this.deviceRatio}dppx)`);
    mq.addEventListener('change', () => {
      this.deviceRatio = window.devicePixelRatio || 1;
      this.ceiling = Math.min(this.deviceRatio, this.cfg.max);
      this.floor = Math.min(this.cfg.min, this.ceiling);
      this.pixelRatio = Math.min(this.pixelRatio, this.ceiling);
      this.resize();
      this._watchDeviceRatio();
    }, { once: true });
  }
}

// ---------------------------------------------------------------------------
// Frame loop on GSAP's ticker: tweens and rendering land on the same frame.
// ---------------------------------------------------------------------------
const updaters = new Set();
export function onUpdate(fn) { updaters.add(fn); return () => updaters.delete(fn); }

export let resizeHandler = null;
export const clock = { elapsed: 0 };
let running = false;

function tick(_time, deltaMs) {
  // ?nolag (headless tests): let slow software-rendered frames advance real time
  const dt = Math.min(deltaMs / 1000, params.has('nolag') ? 0.25 : 1 / 20);
  clock.elapsed += dt;
  cinematic.uniforms.uTime.value = clock.elapsed;
  for (const fn of updaters) fn(dt, clock.elapsed);
  composer.render(dt);
  resizeHandler?.sample(deltaMs);
}

export function start(container = document.body) {
  if (running) return;
  container.appendChild(canvas);
  resizeHandler = new ResizeHandler({ renderer, composer, camera, container });
  // ?nolag: let animation time run in real time even when frames are slow (headless tests)
  gsap.ticker.lagSmoothing(params.has('nolag') ? 0 : 500, 33);
  gsap.ticker.add(tick);
  running = true;
}

export function stop() {
  if (!running) return;
  gsap.ticker.remove(tick);
  running = false;
}

/** Render one frame immediately (used by tests and screenshots). */
export function renderNow() { composer.render(0); }
