// Shared uniforms and the colour script. Every material references the same
// uniform objects, so one update per frame re-lights the whole valley.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = (hex) => new THREE.Color(hex);
export const U = {
  uFieldA: { value: null }, uFieldB: { value: null }, uHalf: { value: CONFIG.half },
  uPrevailing: { value: new THREE.Vector2(-0.55, -0.15) }, uGust: { value: 0.6 }, uTime: { value: 0 },
  // The sun stands beyond the meadow, so shafts through gaps fall toward the player.
  uSunDir: { value: new THREE.Vector3(0.32, 0.84, 0.42).normalize() }, // south-east: ahead of the player, beyond the meadow
  uSunCol: { value: C('#bdb6ab') }, uSkyCol: { value: C('#7d848c') }, uGroundCol: { value: C('#5b544b') },
  uFogCol: { value: C('#9c958a') }, uFogDensity: { value: 0.006 },
  uBands: { value: 3 }, uBandMix: { value: 0.45 }, uAmbient: { value: 0.3 }, uSaturation: { value: 0.35 }, uLightPhase: { value: 0 },
  uZenith: { value: C('#5f6670') }, uHorizon: { value: C('#a39c90') }, uHaze: { value: 0.85 },
  // Dalil's light on the ground and grass: xyz position, w intensity
  uDalil: { value: new THREE.Vector4(0, -100, 0, 0) },
  uDroop: { value: 0 },      // unused in the witness model (kept for the shaders that read it)
  uBreak: { value: new THREE.Vector4(0, 0, 0, 0) }, // canopy break: x, z, radius, rim glow
};

// Keyframes of the colour script (section 16): drought, first rain, revival, flourishing, harmony.
const KEYS = [
  // drought: a low, warm, dusty light over the dry valley (the world waiting), more contrast than haze
  { zen: '#3b4450', hor: '#a88f6c', sun: [0.94, 0.77, 0.56], sky: '#6c6762', gnd: '#3a3129', fog: '#927f66', fogD: 0.0024, sat: 0.66, haze: 0.7, band: 0.45, amb: 0.3 },
  { zen: '#3c4653', hor: '#7f878b', sun: [0.6, 0.63, 0.68], sky: '#5d6873', gnd: '#39352f', fog: '#707a80', fogD: 0.0041, sat: 0.58, haze: 0.9, band: 0.5, amb: 0.38 },
  { zen: '#557797', hor: '#aebcbf', sun: [0.9, 0.9, 0.86], sky: '#8399a9', gnd: '#46513a', fog: '#98a7ab', fogD: 0.0028, sat: 0.8, haze: 0.6, band: 0.75, amb: 0.42 },
  { zen: '#5486bb', hor: '#ccd3c4', sun: [1.1, 1.03, 0.9], sky: '#92acc4', gnd: '#4f5f3b', fog: '#b0bab1', fogD: 0.0022, sat: 0.95, haze: 0.4, band: 0.75, amb: 0.42 },
  { zen: '#4f88c9', hor: '#ecd3a4', sun: [1.32, 1.1, 0.78], sky: '#9fb9d4', gnd: '#62683c', fog: '#dcc9a3', fogD: 0.0018, sat: 1.0, haze: 0.15, band: 0.75, amb: 0.42 },
];
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function mixKey(a, b, t) {
  const lerpC = (x, y) => tmpA.set(x).clone().lerp(tmpB.set(y), t);
  return {
    zen: lerpC(a.zen, b.zen), hor: lerpC(a.hor, b.hor), sky: lerpC(a.sky, b.sky), gnd: lerpC(a.gnd, b.gnd), fog: lerpC(a.fog, b.fog),
    sun: a.sun.map((v, i) => v + (b.sun[i] - v) * t), fogD: a.fogD + (b.fogD - a.fogD) * t, sat: a.sat + (b.sat - a.sat) * t, haze: a.haze + (b.haze - a.haze) * t,
    band: a.band + (b.band - a.band) * t, amb: a.amb + (b.amb - a.amb) * t,
  };
}

/** p: 0 drought .. 4 harmony (continuous). Eased toward, never jumps. */
const current = { p: 0 };
export function updateLook(target, dt) {
  current.p += (target - current.p) * (1 - Math.exp(-dt / 2.5));
  const p = Math.max(0, Math.min(4, current.p));
  const i = Math.min(3, Math.floor(p)), k = mixKey(KEYS[i], KEYS[i + 1], p - i);
  U.uZenith.value.copy(k.zen); U.uHorizon.value.copy(k.hor); U.uSkyCol.value.copy(k.sky);
  U.uGroundCol.value.copy(k.gnd); U.uFogCol.value.copy(k.fog);
  U.uSunCol.value.setRGB(k.sun[0], k.sun[1], k.sun[2]);
  U.uFogDensity.value = k.fogD; U.uSaturation.value = k.sat; U.uHaze.value = k.haze; U.uBandMix.value = k.band; U.uAmbient.value = k.amb;
  return p;
}
export const lookProgress = () => current.p;
