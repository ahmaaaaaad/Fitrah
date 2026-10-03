// The player: first person on one continuous authored rail (section 24).
// The director unlocks how far the rail goes and suggests where to look; the
// player can walk along the unlocked part (W/S, arrow-free so arrows stay the
// wind focus, or the mouse wheel) and the cursor adds a small look parallax.
// PROVISIONAL (player.mode): first person on a rail with authored shots.
import * as THREE from 'three';
import { CONFIG, SPEED } from './config.js';
import { heightAt } from './terrain.js';

const smoothDamp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function createPlayer(camera) {
  const curve = new THREE.CatmullRomCurve3(CONFIG.rail.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const L = curve.getLength();
  // arc length at each rail point (for marks)
  const lengths = curve.getLengths(400);
  const markS = (i) => {
    const target = new THREE.Vector3(CONFIG.rail[i][0], 0, CONFIG.rail[i][1]);
    let best = 0, bd = 1e9;
    for (let k = 0; k <= 400; k++) { const p = curve.getPointAt(k / 400); const d = p.distanceToSquared(target); if (d < bd) { bd = d; best = k; } }
    return (best / 400) * L;
  };
  const marks = Object.fromEntries(Object.entries(CONFIG.marks).map(([k, i]) => [k, markS(i)]));
  void lengths;

  const state = {
    s: 0, sTarget: 0, sMax: 0, speed: 0,
    eye: 1.6, eyeTarget: 1.6,
    fov: 38, fovTarget: 38,
    yaw: 0, pitch: 0.2,
    look: null,           // THREE.Vector3 the director wants in view, or null (look along the rail)
    lookPitch: 0.22,      // pitch used when no look target is set
    lockedUntil: 0,       // camera locked (revelation): no parallax, no walking
    parallax: new THREE.Vector2(), parallaxTarget: new THREE.Vector2(),
    walkInput: 0,
    position: new THREE.Vector3(), heading: new THREE.Vector3(0, 0, -1), velocity: new THREE.Vector3(),
    moving: false, stillTime: 0,
  };
  const prev = new THREE.Vector3();
  const tmp = new THREE.Vector3(), tan = new THREE.Vector3();
  let groundY = null;

  function pointAt(s, out = new THREE.Vector3()) { return curve.getPointAt(Math.min(1, Math.max(0, s / L)), out); }

  function update(dt, t) {
    const locked = state.lockedUntil > t;
    // walking along the unlocked rail
    if (!locked && state.walkInput !== 0) state.sTarget = Math.min(state.sMax, Math.max(0, state.sTarget + state.walkInput * 1.3 * dt));
    state.sTarget = Math.min(state.sTarget, state.sMax);
    const maxV = 1.4 * Math.max(1, SPEED); // PROVISIONAL: the document's rail walk is 0.8 m/s; faster for review
    const want = Math.max(-maxV, Math.min(maxV, (state.sTarget - state.s) * 0.9));
    state.speed = smoothDamp(state.speed, want, 2.5, dt);
    state.s = Math.min(L, Math.max(0, state.s + state.speed * dt));
    pointAt(state.s, tmp);
    curve.getTangentAt(Math.min(1, Math.max(0, state.s / L)), tan);
    const gy = heightAt(tmp.x, tmp.z);
    groundY = groundY === null ? gy : smoothDamp(groundY, gy, 3, dt);
    state.eye = smoothDamp(state.eye, state.eyeTarget, 1.2, dt);
    // head sway: 0.5 degrees at 0.3 Hz, never roll
    const sway = REDUCED || locked ? 0 : Math.sin(t * Math.PI * 2 * 0.3) * 0.0087;
    const bob = REDUCED ? 0 : Math.abs(Math.sin(state.s * 2.4)) * 0.025 * Math.min(1, Math.abs(state.speed) / 0.6);
    prev.copy(state.position);
    state.position.set(tmp.x, groundY + state.eye + bob, tmp.z);
    camera.position.copy(state.position);
    state.velocity.copy(state.position).sub(prev).divideScalar(Math.max(dt, 1e-4));
    state.moving = Math.abs(state.speed) > 0.08;
    state.stillTime = state.moving ? 0 : state.stillTime + dt;

    // where to look
    let yawT, pitchT;
    if (state.look) {
      tmp.copy(state.look).sub(camera.position);
      yawT = Math.atan2(tmp.x, -tmp.z);
      pitchT = Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z));
    } else {
      yawT = Math.atan2(tan.x, -tan.z);
      pitchT = state.lookPitch;
    }
    if (!locked) {
      state.parallax.x = smoothDamp(state.parallax.x, state.parallaxTarget.x, 1.5, dt);
      state.parallax.y = smoothDamp(state.parallax.y, state.parallaxTarget.y, 1.5, dt);
    } else {
      state.parallax.multiplyScalar(Math.exp(-dt * 3));
    }
    // unwrap yaw toward the target
    let dy = yawT - state.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    state.yaw += dy * (1 - Math.exp(-dt * 1.4));
    state.pitch = smoothDamp(state.pitch, pitchT, 1.4, dt);
    const yaw = state.yaw + state.parallax.x * 0.09 + sway;
    const pitch = Math.max(-0.61, Math.min(0.7, state.pitch + state.parallax.y * 0.06));
    tmp.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(tmp.add(camera.position));
    state.heading.set(Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    // lens: keep at least ~50 degrees of horizontal view on narrow screens
    state.fov = smoothDamp(state.fov, state.fovTarget, 1.2, dt);
    const minH = 50 * Math.PI / 180;
    const vfovForH = 2 * Math.atan(Math.tan(minH / 2) / camera.aspect) * 180 / Math.PI;
    const fov = Math.max(state.fov, Math.min(85, vfovForH));
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  function snapTo(s, look) {
    state.s = state.sTarget = s; state.sMax = Math.max(state.sMax, s); state.speed = 0;
    pointAt(s, tmp); groundY = heightAt(tmp.x, tmp.z);
    if (look) {
      state.look = look.clone();
      const d = look.clone().sub(new THREE.Vector3(tmp.x, groundY + state.eye, tmp.z));
      state.yaw = Math.atan2(d.x, -d.z); state.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    }
  }

  return { state, curve, length: L, marks, update, pointAt, snapTo };
}
