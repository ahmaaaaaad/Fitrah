// Fitrah – World 1: «من خلقني؟» (The Cosmos)
// Environment (fog + stars + drifting dust), the player's light orb,
// its floating motion, and the camera that follows it.

import * as THREE from 'three';
import { gsap } from 'gsap';
import { scene, camera, onUpdate } from '../core/scene.js';

// ---------------------------------------------------------------------------
// Look & feel
// ---------------------------------------------------------------------------
const PALETTE = {
  void: 0x05061c,       // deep indigo-black: fog + background
  starCool: new THREE.Color(0.78, 0.86, 1.0),
  starGold: new THREE.Color(1.0, 0.84, 0.58),
  starWhite: new THREE.Color(1.0, 1.0, 1.0),
  orbGlow: 0xffd89a,    // warm gold
  orbLight: 0xffdcaa,
};

const SETTINGS = {
  fogDensity: 0.0042,
  starCount: 2000,
  starInner: 25,        // stars live in a shell between these radii
  starOuter: 340,
  dustCount: 48,
  float: { height: 0.45, duration: 2.8 },
  camera: {
    offset: new THREE.Vector3(0, 1.8, 7.5),  // where the camera sits relative to the orb
    followDamping: 2.6,   // higher = tighter follow
    lookDamping: 4.5,
    floatInfluence: 0.3,  // how much of the orb's bob the camera copies (1 = none visible)
  },
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function makeSoftDotTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Seeded random so the sky is identical on every load.
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 1. The cosmos environment
// ---------------------------------------------------------------------------
function createStars(rand) {
  const { starCount, starInner, starOuter } = SETTINGS;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 4); // RGBA → per-star opacity
  const tmp = new THREE.Color();

  for (let i = 0; i < starCount; i++) {
    // Uniform direction, radius biased outward so the deep field is dense.
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const r = starInner + (starOuter - starInner) * Math.pow(rand(), 0.6);
    const s = Math.sqrt(1 - u * u);
    positions[i * 3 + 0] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u * 0.7;            // slightly flattened sky
    positions[i * 3 + 2] = r * s * Math.sin(theta);

    const pick = rand();
    if (pick < 0.62) tmp.copy(PALETTE.starCool);
    else if (pick < 0.86) tmp.copy(PALETTE.starGold);
    else tmp.copy(PALETTE.starWhite);
    tmp.lerp(PALETTE.starWhite, rand() * 0.35);

    colors[i * 4 + 0] = tmp.r;
    colors[i * 4 + 1] = tmp.g;
    colors[i * 4 + 2] = tmp.b;
    colors[i * 4 + 3] = 0.25 + Math.pow(rand(), 2.2) * 0.75; // most stars faint, a few bright
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

  const material = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: true,
    map: makeSoftDotTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true, // distant stars sink into the indigo fog → depth
  });

  // Gentle twinkle: modulate each star's alpha in the shader.
  const uniforms = { uTime: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        float tw = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        vColor.a *= 0.7 + 0.3 * sin(uTime * (0.6 + tw * 1.8) + tw * 6.2831);`,
      );
  };

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, uniforms };
}

// A few dark crystalline shards drifting near the orb's path.
// They exist to catch the orb's real-time light so its glow reads in 3D space.
function createDust(rand) {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a5288,
    roughness: 0.45,
    metalness: 0.15,
    flatShading: true,
  });
  const drift = [];
  for (let i = 0; i < SETTINGS.dustCount; i++) {
    const m = new THREE.Mesh(geo, mat);
    const a = rand() * Math.PI * 2;
    const r = 3 + rand() * 16;
    m.position.set(Math.cos(a) * r, (rand() - 0.5) * 7, Math.sin(a) * r - 4);
    // keep the space between the camera and the orb clear
    if (m.position.distanceTo(SETTINGS.camera.offset) < 4) m.position.z -= 9;
    m.scale.setScalar(0.04 + Math.pow(rand(), 3) * 0.2);
    m.rotation.set(rand() * 6, rand() * 6, rand() * 6);
    drift.push({ m, spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.4), bob: rand() * 6 });
    group.add(m);
  }
  const update = (dt, t) => {
    for (const d of drift) {
      d.m.rotation.x += d.spin.x * dt;
      d.m.rotation.y += d.spin.y * dt;
      d.m.position.y += Math.sin(t * 0.35 + d.bob) * 0.0015;
    }
  };
  return { group, update, dispose: () => { geo.dispose(); mat.dispose(); } };
}

// ---------------------------------------------------------------------------
// 2. The player: a layered light orb
// ---------------------------------------------------------------------------
function createOrb() {
  // anchor = where gameplay places the orb; body = local float motion on top of it
  const anchor = new THREE.Group();
  const body = new THREE.Group();
  anchor.add(body);

  // Layer 1 — the shell: physical material, white surface, strong golden emission.
  // Emission above 1.0 is HDR; the bloom pass turns it into a warm halo.
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(PALETTE.orbGlow),
    emissiveIntensity: 1.5,
    roughness: 0.15,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.92,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.34, 64, 64), shellMat);
  body.add(shell);

  // Layer 2 — the white-hot heart, far brighter than the shell so the center
  // reads pure white while the edges stay gold after tone mapping.
  const heartMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(3.5) });
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 32), heartMat);
  body.add(heart);

  // Layer 3 — the aura: a fresnel rim that brightens toward the silhouette,
  // giving the orb a soft atmospheric edge instead of a hard sphere outline.
  const auraUniforms = {
    uColor: { value: new THREE.Color(PALETTE.orbGlow) },
    uIntensity: { value: 0.55 },
  };
  const auraMat = new THREE.ShaderMaterial({
    uniforms: auraUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    vertexShader: /* glsl */`
      varying vec3 vNormal; varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uIntensity;
      varying vec3 vNormal; varying vec3 vView;
      void main() {
        float rim = 1.0 - abs(dot(vNormal, vView));
        float glow = pow(1.0 - rim, 3.0);           // BackSide: brightest near the orb, fading outward
        gl_FragColor = vec4(uColor * glow * uIntensity, glow);
      }`,
  });
  const aura = new THREE.Mesh(new THREE.SphereGeometry(0.95, 48, 48), auraMat);
  body.add(aura);

  // Layer 4 — a real point light: lights nearby geometry in real time.
  const light = new THREE.PointLight(PALETTE.orbLight, 28, 22, 1.6);
  body.add(light);

  // Breathing: the orb gently pulses in brightness.
  const breath = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 2.4, ease: 'sine.inOut' } });
  breath
    .to(shellMat, { emissiveIntensity: 2.0 }, 0)
    .to(auraUniforms.uIntensity, { value: 0.8 }, 0)
    .to(light, { intensity: 36 }, 0)
    .to(aura.scale, { x: 1.08, y: 1.08, z: 1.08 }, 0);

  const dispose = () => {
    breath.kill();
    [shell, heart, aura].forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
  };

  return { anchor, body, light, shell, aura, breath, dispose };
}

// ---------------------------------------------------------------------------
// World factory
// ---------------------------------------------------------------------------
export function createWorld1() {
  const rand = mulberry32(1441);
  const disposers = [];

  // Environment
  scene.background = new THREE.Color(PALETTE.void);
  scene.fog = new THREE.FogExp2(PALETTE.void, SETTINGS.fogDensity);
  const ambient = new THREE.AmbientLight(0x2a3170, 0.25);
  scene.add(ambient);

  const stars = createStars(rand);
  scene.add(stars.points);

  const dust = createDust(rand);
  scene.add(dust.group);
  disposers.push(dust.dispose);

  // Player
  const orb = createOrb();
  orb.anchor.position.set(0, 0, 0);
  scene.add(orb.anchor);
  disposers.push(orb.dispose);

  // 3. Motion: a continuous sine-shaped float on Y (sine.inOut + yoyo = a sine wave)
  const floatTween = gsap.fromTo(
    orb.body.position,
    { y: -SETTINGS.float.height / 2 },
    { y: SETTINGS.float.height / 2, duration: SETTINGS.float.duration, ease: 'sine.inOut', yoyo: true, repeat: -1 },
  );

  // 4. Camera follow with frame-rate-independent damping.
  const cam = SETTINGS.camera;
  const orbWorld = new THREE.Vector3();
  const followTarget = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const lookCurrent = new THREE.Vector3();
  const damp = THREE.MathUtils.damp;

  // Start the camera already in place (no swoop on load).
  followTarget.copy(orb.anchor.position).add(cam.offset);
  camera.position.copy(followTarget);
  lookCurrent.copy(orb.anchor.position);

  const stopUpdate = onUpdate((dt, t) => {
    stars.uniforms.uTime.value = t;
    stars.points.rotation.y = t * 0.004;
    dust.update(dt, t);

    // The camera follows the anchor fully, but only part of the float,
    // so the bob stays visible on screen instead of being cancelled out.
    orbWorld.copy(orb.anchor.position);
    orbWorld.y += orb.body.position.y * cam.floatInfluence;

    followTarget.copy(orbWorld).add(cam.offset);
    camera.position.x = damp(camera.position.x, followTarget.x, cam.followDamping, dt);
    camera.position.y = damp(camera.position.y, followTarget.y, cam.followDamping, dt);
    camera.position.z = damp(camera.position.z, followTarget.z, cam.followDamping, dt);

    lookTarget.copy(orbWorld);
    lookCurrent.x = damp(lookCurrent.x, lookTarget.x, cam.lookDamping, dt);
    lookCurrent.y = damp(lookCurrent.y, lookTarget.y, cam.lookDamping, dt);
    lookCurrent.z = damp(lookCurrent.z, lookTarget.z, cam.lookDamping, dt);
    camera.lookAt(lookCurrent);
  });

  // Gameplay hook: glide the orb to a point (used by tap-to-move).
  let moveTween = null;
  function moveOrbTo(target, { duration } = {}) {
    const dist = orb.anchor.position.distanceTo(target);
    moveTween?.kill();
    moveTween = gsap.to(orb.anchor.position, {
      x: target.x, y: target.y, z: target.z,
      duration: duration ?? THREE.MathUtils.clamp(dist * 0.35, 0.8, 3.5),
      ease: 'power2.inOut',
    });
    return moveTween;
  }

  function dispose() {
    stopUpdate();
    floatTween.kill();
    moveTween?.kill();
    disposers.forEach((d) => d());
    scene.remove(stars.points, dust.group, orb.anchor, ambient);
    stars.points.geometry.dispose();
    stars.points.material.map.dispose();
    stars.points.material.dispose();
    scene.fog = null;
  }

  return { orb, stars, moveOrbTo, dispose };
}
