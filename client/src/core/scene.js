// Fitrah – core rendering engine
// Owns the renderer, scene, camera and post-processing chain, plus the
// single frame loop every other module hooks into via onUpdate().

import * as THREE from 'three';
import { gsap } from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------------------
// Tunables — change the look here, not inside the code below.
// ---------------------------------------------------------------------------
export const CONFIG = {
  exposure: 1.3,          // ACES exposure (keep within 1.2–1.5)
  bloom: {
    threshold: 0.1,       // low threshold = soft halation around anything bright
    strength: 1.2,
    radius: 0.5,
  },
  camera: { fov: 50, near: 0.1, far: 2000 },
  msaaSamples: 4,         // MSAA inside the composer (the canvas' own AA is bypassed by post-processing)
  pixelRatio: {
    max: 2,               // never render above 2× — beyond that the cost outweighs the gain
    min: 1,               // never drop below 1× — keeps text-sized detail sharp
    step: 0.25,
    slowFrameMs: 22,      // average above this → step quality down (~45 fps)
    fastFrameMs: 15,      // average below this for a while → step quality back up (~66 fps)
    sampleFrames: 90,     // rolling window used for the average
    cooldownMs: 2000,     // wait between changes so it never oscillates
  },
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
const canvas = document.createElement('canvas');
canvas.id = 'fitrah-canvas';

export const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.exposure;

// ---------------------------------------------------------------------------
// Scene & camera
// ---------------------------------------------------------------------------
export const scene = new THREE.Scene();

export const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  window.innerWidth / window.innerHeight,
  CONFIG.camera.near,
  CONFIG.camera.far,
);
camera.position.set(0, 2, 8);

// ---------------------------------------------------------------------------
// Post-processing: Render → Bloom → Output (tone mapping + sRGB)
// ---------------------------------------------------------------------------
// HalfFloat keeps HDR values above 1.0 alive until tone mapping, which is what
// lets emissive surfaces bloom with real intensity instead of clipping.
const composerTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType,
  samples: CONFIG.msaaSamples,
});

export const composer = new EffectComposer(renderer, composerTarget);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

export const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  CONFIG.bloom.strength,
  CONFIG.bloom.radius,
  CONFIG.bloom.threshold,
);
composer.addPass(bloomPass);

// Applies renderer.toneMapping + outputColorSpace to the composed image.
// Without it the composer output would be linear and un-tone-mapped.
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// ResizeHandler — keeps the canvas matched to its container and adapts the
// pixel ratio to the device's real performance.
// ---------------------------------------------------------------------------
export class ResizeHandler {
  constructor({ renderer, composer, camera, container, config = CONFIG.pixelRatio }) {
    this.renderer = renderer;
    this.composer = composer;
    this.camera = camera;
    this.container = container;
    this.cfg = config;

    this.deviceRatio = window.devicePixelRatio || 1;
    this.ceiling = Math.min(this.deviceRatio, config.max);
    this.floor = Math.min(config.min, this.ceiling);
    // Phones start one step below the ceiling and earn their way up;
    // desktops start at the ceiling.
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.pixelRatio = coarse ? Math.max(this.floor, this.ceiling - config.step) : this.ceiling;

    this.samples = [];
    this.lastChange = performance.now();
    this.width = 0;
    this.height = 0;

    this._observer = new ResizeObserver(() => this.resize());
    this._observer.observe(container);
    // devicePixelRatio changes when a window moves between monitors or the user zooms
    this._watchDeviceRatio();
    this.resize();
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._apply();
  }

  // Called once per frame with the frame duration in milliseconds.
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
      this.pixelRatio = next;
      this.lastChange = now;
      this.samples.length = 0;
      this._apply();
    }
  }

  _apply() {
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(this.width, this.height);
  }

  _watchDeviceRatio() {
    const mq = window.matchMedia(`(resolution: ${this.deviceRatio}dppx)`);
    const onChange = () => {
      this.deviceRatio = window.devicePixelRatio || 1;
      this.ceiling = Math.min(this.deviceRatio, this.cfg.max);
      this.floor = Math.min(this.cfg.min, this.ceiling);
      this.pixelRatio = Math.min(this.pixelRatio, this.ceiling);
      this.resize();
      this._watchDeviceRatio();
    };
    mq.addEventListener('change', onChange, { once: true });
  }

  dispose() {
    this._observer.disconnect();
  }
}

// ---------------------------------------------------------------------------
// Frame loop — driven by GSAP's ticker so tweens and rendering land on the
// exact same frame (no one-frame lag between a tween and what's drawn).
// ---------------------------------------------------------------------------
const updaters = new Set();

/** Register fn(dt, elapsed) to run every frame. Returns an unsubscribe function. */
export function onUpdate(fn) {
  updaters.add(fn);
  return () => updaters.delete(fn);
}

export let resizeHandler = null;
let elapsed = 0;
let running = false;

function tick(_time, deltaMs) {
  // Clamp so a background tab or a hitch never makes the world jump.
  const dt = Math.min(deltaMs / 1000, 1 / 20);
  elapsed += dt;
  for (const fn of updaters) fn(dt, elapsed);
  composer.render(dt);
  resizeHandler?.sample(deltaMs);
}

/** Mount the canvas into a container and start rendering. */
export function start(container = document.body) {
  if (running) return;
  container.appendChild(canvas);
  resizeHandler = new ResizeHandler({ renderer, composer, camera, container });
  gsap.ticker.lagSmoothing(500, 33);
  gsap.ticker.add(tick);
  running = true;
}

export function stop() {
  if (!running) return;
  gsap.ticker.remove(tick);
  running = false;
}
