// The environmental simulation (section 12 and 34 of the design document).
// CPU grids at 96 x 96 over the 256 m valley, stepped at a fixed 30 Hz, packed
// into two RGBA8 textures every frame for the shaders. Logic never waits on the GPU.
import * as THREE from 'three';
import { CONFIG, SPEED } from './config.js';
import { U } from './look.js';
import { channelX, M } from './terrain.js';

const N = CONFIG.grid, HALF = CONFIG.half, CELL = (2 * HALF) / N, NN = N * N;
const STEP = 1 / 30;
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const cx = (i) => -HALF + (i + 0.5) * CELL;

// ------------------------------------------------------------------ grids
const F = () => new Float32Array(NN);
const wx = F(), wz = F();          // the player's air (m/s), decays over 2.5 s
const am = F(), cd = F(), rt = F(); // air moisture, cloud density, ripening time (travels with the cloud)
const sm = F(), veg = F(), rain = F(), sun = F();
const opened = F();                 // seconds since a gap was drawn here (regrowth waits)
const tmpA = F(), tmpB = F(), tmpC = F();
const rtT = F();                    // per-cloud ripening threshold, 8..12 s
const rp = F();                     // ripe area: a ripened core lets its whole cloud rain
const src = F();                    // haze sources (east slope)
const wBasin = F(), wMeadow = F(), canopyT = F();

const sunDir = U.uSunDir.value;
const OFF = { x: (sunDir.x / sunDir.y) * CONFIG.cloudHeight, z: (sunDir.z / sunDir.y) * CONFIG.cloudHeight };

function hash(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const k = j * N + i, x = cx(i), z = cx(j);
  rtT[k] = CONFIG.ripen[0] + (CONFIG.ripen[1] - CONFIG.ripen[0]) * hash(Math.floor(i / 7), Math.floor(j / 7));
  src[k] = smooth(44, 96, x) * (0.6 + 0.4 * Math.sin(z * 0.05) ** 2);
  const B = CONFIG.basin, db = Math.hypot(x - B.x, z - B.z);
  wBasin[k] = db < B.r ? 1 : 0;
  const dm = Math.hypot(x - M.x, z - M.z);
  wMeadow[k] = dm < M.r ? Math.exp(-(dm * dm) / (2 * (M.r * 0.45) ** 2)) : 0;
  // the canopy covers the meadow and the stretch of sky its light comes through
  const ccx = M.x + OFF.x * 0.5, ccz = M.z + OFF.z * 0.5;
  const dcn = Math.hypot((x - ccx) / 1.0, (z - ccz) / 0.9);
  canopyT[k] = 0.8 * (1 - smooth(M.r + 20, M.r + 46, dcn));
  am[k] = 0.17 + 0.12 * src[k];
  // a few thin wisps to start from
  cd[k] = 0.12 * smooth(0.45, 0.8, hash(Math.floor(i / 5) + 3, Math.floor(j / 5) + 9)) * (0.6 + 0.4 * hash(i, j));
}
let sumBasin = 0, sumMeadow = 0;
for (let k = 0; k < NN; k++) { sumBasin += wBasin[k]; sumMeadow += wMeadow[k]; }

// ------------------------------------------------------------------ sampling
function sample(a, x, z) {
  const fx = Math.min(N - 1.001, Math.max(0, (x + HALF) / CELL - 0.5));
  const fz = Math.min(N - 1.001, Math.max(0, (z + HALF) / CELL - 0.5));
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * N + i;
  return (a[k] * (1 - tx) + a[k + 1] * tx) * (1 - tz) + (a[k + N] * (1 - tx) + a[k + N + 1] * tx) * tz;
}
// semi-Lagrangian advection in cell units
function advect(srcA, dst, velScale, dt) {
  const s = (dt * velScale) / CELL, px = U.uPrevailing.value.x, pz = U.uPrevailing.value.y;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    let fx = i - (px + wx[k]) * s, fz = j - (pz + wz[k]) * s;
    fx = Math.min(N - 1.001, Math.max(0, fx)); fz = Math.min(N - 1.001, Math.max(0, fz));
    const ii = Math.floor(fx), jj = Math.floor(fz), tx = fx - ii, tz = fz - jj, q = jj * N + ii;
    dst[k] = (srcA[q] * (1 - tx) + srcA[q + 1] * tx) * (1 - tz) + (srcA[q + N] * (1 - tx) + srcA[q + N + 1] * tx) * tz;
  }
}

/** Shared wind, mirrored exactly from glsl.js windAt(). */
export function gustAt(x, z, t, out = { x: 0, z: 0 }) {
  const g = U.uGust.value;
  out.x = g * Math.sin(t * 1.3 + x * 0.07 + Math.sin(z * 0.03));
  out.z = g * Math.cos(t * 1.1 + z * 0.05 + Math.sin(x * 0.04));
  return out;
}
const _g = { x: 0, z: 0 };
export function windAt(x, z, out = { x: 0, z: 0 }) {
  gustAt(x, z, U.uTime.value, _g);
  // the texture stores the local wind quantized to 8 bits; the CPU uses the exact value
  out.x = U.uPrevailing.value.x + sample(wx, x, z) + _g.x;
  out.z = U.uPrevailing.value.y + sample(wz, x, z) + _g.z;
  return out;
}

// ------------------------------------------------------------------ public state
export const sim = {
  time: 0,
  // director switches
  allowRain: true,
  meadowWeather: false,   // after revelation 1: the weather moves over the meadow
  canopy: false,          // mechanic 2: clouds hold over the meadow, rain eases, gaps regrow
  frozen: false,          // harmony: the gaps hold steady
  waterFlow: 0, waterFill: 0,
  stats: {
    amBasin: 0, cdMax: 0, cdBasinHi: 0, rainMax: 0, rainCells: 0, smBasinHi: 0, vegBasinHi: 0,
    vegMeadow: 0, smMeadow: 0, sunMeadow: 0, cdMeadow: 0, windEnergy: 0, ripeness: 0, rainNear: 0,
  },
  arrays: { wx, wz, am, cd, sm, veg, rain, sun },
  sample, N, CELL, HALF, OFF,
};

// ------------------------------------------------------------------ textures
const dataA = new Uint8Array(NN * 4), dataB = new Uint8Array(NN * 4);
function mkTex(data) {
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}
export const texA = mkTex(dataA), texB = mkTex(dataB);
U.uFieldA.value = texA; U.uFieldB.value = texB;
const b8 = (v) => (v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0);
function pack() {
  for (let k = 0, o = 0; k < NN; k++, o += 4) {
    dataA[o] = b8(sm[k]); dataA[o + 1] = b8(veg[k]); dataA[o + 2] = b8(cd[k]); dataA[o + 3] = b8(rain[k]);
    dataB[o] = b8(0.5 + wx[k] / 24); dataB[o + 1] = b8(0.5 + wz[k] / 24); dataB[o + 2] = b8(sun[k]); dataB[o + 3] = b8(am[k]);
  }
  texA.needsUpdate = true; texB.needsUpdate = true;
}

// ------------------------------------------------------------------ input operations (InteractionField)
/** A wind splat: velocity (m/s) at (x, z), Gaussian radius r. energy > 1 tears clouds. */
export function splat(x, z, vx, vz, r, energy = 0, strength = 0.35) {
  const r2 = r * r, reach = Math.ceil((r * 2.2) / CELL);
  const ci = Math.round((x + HALF) / CELL - 0.5), cj = Math.round((z + HALF) / CELL - 0.5);
  for (let j = Math.max(0, cj - reach); j <= Math.min(N - 1, cj + reach); j++)
    for (let i = Math.max(0, ci - reach); i <= Math.min(N - 1, ci + reach); i++) {
      const k = j * N + i, dx = cx(i) - x, dz = cx(j) - z, g = Math.exp(-(dx * dx + dz * dz) / r2);
      if (g < 0.01) continue;
      wx[k] += (vx - wx[k]) * g * strength; wz[k] += (vz - wz[k]) * g * strength;
      const m = Math.hypot(wx[k], wz[k]); if (m > 9) { wx[k] *= 9 / m; wz[k] *= 9 / m; }
      if (energy > 1) { // a frantic gesture tears the clouds instead of gathering them
        const tear = Math.min(1, energy - 1) * g * 0.17 * strength;
        cd[k] = Math.max(0, cd[k] - tear); am[k] = Math.max(0, am[k] - tear * 0.5); rt[k] *= 0.9;
      }
    }
}
/** Mechanic 2: thin the clouds along a stroke. */
export function openClouds(x, z, r, amount) {
  if (sim.frozen) return;
  const r2 = r * r, reach = Math.ceil((r * 2) / CELL);
  const ci = Math.round((x + HALF) / CELL - 0.5), cj = Math.round((z + HALF) / CELL - 0.5);
  for (let j = Math.max(0, cj - reach); j <= Math.min(N - 1, cj + reach); j++)
    for (let i = Math.max(0, ci - reach); i <= Math.min(N - 1, ci + reach); i++) {
      const k = j * N + i, dx = cx(i) - x, dz = cx(j) - z, g = Math.exp(-(dx * dx + dz * dz) / r2);
      if (g < 0.02) continue;
      cd[k] = Math.max(0, cd[k] - amount * g); rt[k] = 0;
      opened[k] = 0;
    }
}
export const cloudAt = (x, z) => sample(cd, x, z);

// ------------------------------------------------------------------ the step
let acc = 0;
function step(dt) {
  sim.time += dt;
  const t = sim.time, decay = Math.exp(-dt / 2.5);
  // 1. the player's air settles, with a little diffusion (borders just decay)
  for (let k = 0; k < NN; k++) { tmpA[k] = wx[k] * decay; tmpB[k] = wz[k] * decay; }
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const k = j * N + i;
    tmpA[k] = (wx[k] * 0.8 + (wx[k - 1] + wx[k + 1] + wx[k - N] + wx[k + N]) * 0.05) * decay;
    tmpB[k] = (wz[k] * 0.8 + (wz[k - 1] + wz[k + 1] + wz[k - N] + wz[k + N]) * 0.05) * decay;
  }
  wx.set(tmpA); wz.set(tmpB);
  // 2. convergence of the player's air (negative divergence), in 1/s
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const k = j * N + i;
    const div = (wx[k + 1] - wx[k - 1] + wz[k + N] - wz[k - N]) / (2 * CELL);
    tmpC[k] = Math.max(0, -div);
  }
  // 3. air moisture: haze rises from the slope (and the stream, once it runs), drifts and gathers
  const wf = sim.waterFill;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    let a = am[k];
    a += dt * 0.022 * src[k] * (1 - a);
    if (wf > 0.1 && Math.abs(cx(i) - channelX(cx(j))) < 6) a += dt * 0.02 * wf * (1 - a);
    if (sim.meadowWeather && canopyT[k] > 0.05) a += dt * 0.05 * canopyT[k] * (1 - a);
    a += dt * tmpC[k] * a * 1.6;                      // convergence concentrates it
    a += (0.16 - a) * dt / 60;                         // slow return to the dry ambient
    am[k] = clamp01(a);
  }
  advect(am, tmpA, 1.0, dt); am.set(tmpA);
  // 4. clouds condense where moist air gathers; they drift with the air
  for (let k = 0; k < NN; k++) {
    let c = cd[k];
    const cv = Math.min(1, tmpC[k]);
    // under the canopy (mechanic 2) the clouds change only by the player's gaps and their slow regrowth
    // the player's converging air gathers clouds; only very moist air condenses on its own
    const cond = sim.canopy ? 0 : dt * (0.75 * cv * smooth(0.12, 0.4, am[k]) + 0.04 * smooth(0.42, 0.7, am[k])) * (1 - c);
    c += cond; am[k] = clamp01(am[k] - cond * 0.35);
    if (!sim.canopy) c -= dt * 0.012 * (1 - smooth(0.14, 0.36, am[k])) * c; // dry air thins them
    if (sim.meadowWeather && !sim.canopy) c += dt * 0.07 * canopyT[k] * Math.max(0, canopyT[k] - c);
    if (sim.canopy && !sim.frozen) {
      opened[k] += dt;
      // gaps slowly close: faster when the meadow has too much sun, so an overshoot corrects itself
      if (opened[k] > 8) c += dt * (sim.stats.sunMeadow > 0.75 ? 0.02 : 0.005) * Math.max(0, canopyT[k] - c);
      else c = Math.min(c, canopyT[k] + 0.05);
    }
    cd[k] = clamp01(c);
  }
  // clouds spread a little, so a gathered cloud is broad and soft rather than a point
  if (!sim.frozen) {
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const k = j * N + i;
      tmpA[k] = cd[k] + dt * 0.35 * (cd[k - 1] + cd[k + 1] + cd[k - N] + cd[k + N] - 4 * cd[k]);
    }
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; cd[k] = tmpA[k]; }
    advect(cd, tmpA, sim.canopy ? 0.15 : 0.35, dt); cd.set(tmpA);
    advect(rt, tmpB, sim.canopy ? 0.15 : 0.35, dt); rt.set(tmpB);
  }
  // 5. ripening: rain begins only after a cloud has held its density for T_ripen
  let ripeMax = 0;
  for (let k = 0; k < NN; k++) {
    if (cd[k] >= 0.55) rt[k] += dt; else rt[k] = Math.max(0, rt[k] - dt * 2);
    rp[k] = rt[k] >= rtT[k] ? 1 : 0;
    ripeMax = Math.max(ripeMax, Math.min(1, rt[k] / rtT[k]) * (cd[k] >= 0.5 ? 1 : 0));
  }
  for (let pass = 0; pass < 4; pass++) for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const k = j * N + i;
    if (cd[k] > 0.4) rp[k] = Math.max(rp[k], 0.94 * Math.max(rp[k - 1], rp[k + 1], rp[k - N], rp[k + N]));
  }
  for (let k = 0; k < NN; k++) {
    const target = sim.allowRain && !sim.canopy ? rp[k] * smooth(0.38, 0.75, cd[k]) : 0;
    rain[k] += (target - rain[k]) * (1 - Math.exp(-dt / 1.2));
    // a cloud rains itself out over about forty seconds (the meadow canopy is fed by the weather)
    if (rain[k] > 0.01) { cd[k] = Math.max(0, cd[k] - dt * (sim.meadowWeather && canopyT[k] > 0.2 ? 0.003 : 0.011) * rain[k]); am[k] = Math.max(0, am[k] - dt * 0.01 * rain[k]); }
  }
  sim.stats.ripeness = ripeMax;
  // 6. soil drinks, spreads, dries; vegetation answers
  tmpA.set(sm);
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const k = j * N + i;
    const lap = sm[k - 1] + sm[k + 1] + sm[k - N] + sm[k + N] - 4 * sm[k];
    tmpA[k] = sm[k] + dt * (0.14 * rain[k] * (1 - sm[k]) + 0.08 * lap - 0.0025 * sm[k] * (0.4 + sun[k]));
  }
  for (let k = 0; k < NN; k++) {
    const m = clamp01(tmpA[k]); sm[k] = m;
    let v = veg[k];
    v += dt * 0.06 * smooth(0.26, 0.45, m) * (1 - v);
    if (m < 0.12) v -= dt * 0.004 * v;
    veg[k] = clamp01(v);
  }
  // 7. sunlight at the ground passes the clouds toward the sun
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = sample(cd, cx(i) + OFF.x, cx(j) + OFF.z);
    sun[j * N + i] = 1 - smooth(0.1, 0.68, c) * 0.93;
  }
  // 8. the stream fills from the rain in its catchment
  let rc = 0; for (let k = 0; k < NN; k++) rc += rain[k];
  sim.stats.rainCells = rc;
  sim.waterFlow = clamp01(sim.waterFlow + dt * (0.0007 * Math.min(rc, 140) - 0.0015 * sim.waterFlow * (rc < 2 ? 1 : 0)));
  sim.waterFill = Math.max(sim.waterFill, sim.waterFlow); // forward only: a stream once formed stays
  void t;
}

let statClock = 0;
function computeStats() {
  const S = sim.stats;
  let amB = 0, cdMax = 0, rainMax = 0, vegM = 0, smM = 0, sunM = 0, cdM = 0, we = 0;
  const smB = [], vegB = [], cdB = [];
  for (let k = 0; k < NN; k++) {
    if (wBasin[k]) { amB += am[k]; smB.push(sm[k]); vegB.push(veg[k]); cdB.push(cd[k]); }
    if (wMeadow[k]) { const w = wMeadow[k]; vegM += veg[k] * w; smM += sm[k] * w; sunM += sun[k] * w; cdM += cd[k] * w; }
    if (cd[k] > cdMax) cdMax = cd[k];
    if (rain[k] > rainMax) rainMax = rain[k];
    we += wx[k] * wx[k] + wz[k] * wz[k];
  }
  const hi = (arr, q) => { arr.sort((a, b) => b - a); const n = Math.max(1, Math.floor(arr.length * q)); let s = 0; for (let i = 0; i < n; i++) s += arr[i]; return s / n; };
  S.amBasin = amB / sumBasin; S.cdMax = cdMax; S.rainMax = rainMax;
  S.smBasinHi = hi(smB, 0.12); S.vegBasinHi = hi(vegB, 0.12); S.cdBasinHi = hi(cdB, 0.05);
  S.vegMeadow = vegM / sumMeadow; S.smMeadow = smM / sumMeadow; S.sunMeadow = sunM / sumMeadow; S.cdMeadow = cdM / sumMeadow;
  S.windEnergy = Math.sqrt(we / NN);
}

/** Advance the simulation by real time dt; fixed steps, at most 8 per frame. */
export function updateSim(dt) {
  acc += dt * SPEED;
  let n = 0;
  while (acc >= STEP && n < 8) { step(STEP); acc -= STEP; n++; }
  if (n === 8) acc = 0;
  statClock -= dt;
  if (statClock <= 0) { computeStats(); statClock = 0.2; }
  pack();
}
export function rainNear(x, z) { return sample(rain, x, z); }
/** Sun exposure of the meadow for the current clouds (same rule as the step), without stepping. */
export function exposureNow(cdArr = cd) {
  let s = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i; if (!wMeadow[k]) continue;
    s += wMeadow[k] * (1 - smooth(0.1, 0.68, sample(cdArr, cx(i) + OFF.x, cx(j) + OFF.z)) * 0.93);
  }
  return s / sumMeadow;
}

// ------------------------------------------------------------------ fast-forward (tests and the review jump menu)
export function setField(name, fn) {
  const a = sim.arrays[name] || { rt, opened }[name];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) a[j * N + i] = fn(cx(i), cx(j), a[j * N + i]);
  computeStats();
}
export { canopyT };
export function canopyAt(x, z) { return sample(canopyT, x, z); }
