// The camera of the Fitrah level: authored shots, eased like a slow dolly, with a
// faint breathing drift. When a shot must hold several things at once (the four
// question lights, the chain of chapter 1), its framing is calculated for the
// screen in hand: the camera turns, steps back inside the hall, and only then
// widens, so every point stays inside the safe region on a phone as on a monitor.
import * as THREE from 'three';
import { solveFraming } from '../../core/framing.js';
import { interactionRegion } from '../../core/device.js';
import { REDUCED_MOTION } from '../../core/scene.js';

const V = (a) => new THREE.Vector3(...a);
export const SHOTS = {
  opening:  { eye: [0, 1.55, 9.4], look: [0, 1.75, 0], fov: 50 },
  four:     { eye: [0, 1.75, 9.8], look: [0, 2.8, -3], fov: 52 },
  chain:    { eye: [0, 1.85, 9.9], look: [0, 2.3, 2], fov: 52 },
  centre:   { eye: [0, 1.75, 9.3], look: [0, 2.9, 0], fov: 50 },
  purpose:  { eye: [0, 1.7, 8.8], look: [0, 2.7, -9], fov: 50 },
  practice: { eye: [0, 2.0, 9.4], look: [0, 2.7, -1.2], fov: 54 },
  return:   { eye: [0, 1.6, 8.6], look: [0, 3.5, -10.6], fov: 50 },
  ending:   { eye: [0, 1.8, 10.2], look: [0, 2.8, -2.5], fov: 54 },
};
const HALL = 11.3; // the camera never steps past this radius (the walls stand at 12.5)

function spring(x, v, target, w, dt) {
  // critically damped: arrives without overshoot, starts and ends softly
  const a = (target - x) * w * w - 2 * w * v;
  v += a * dt; x += v * dt;
  return [x, v];
}

export function createCameraRig(camera) {
  const cur = { eye: V(SHOTS.opening.eye), look: V(SHOTS.opening.look), fov: SHOTS.opening.fov };
  const vel = { eye: new THREE.Vector3(), look: new THREE.Vector3(), fov: 0 };
  const tgt = { eye: cur.eye.clone(), look: cur.look.clone(), fov: cur.fov };
  let w = 1.2, name = 'opening', points = null, sway = 1;
  const par = { x: 0, y: 0, tx: 0, ty: 0 };

  /** Fit `pts` into the safe region from an authored eye/look/fov. */
  function fit(eye0, look0, fov0, pts) {
    // the safe region, with a little more air: points sit comfortably inside, and names fit below them
    const r0 = interactionRegion(), aspect = r0.W / r0.H;
    const region = { ...r0, left: r0.left + r0.W * 0.05, right: r0.right + r0.W * 0.05, top: r0.top + r0.H * 0.03, bottom: r0.bottom + r0.H * 0.07 };
    let eye = eye0.clone(), r = null;
    const dir = eye0.clone().sub(look0).setY(0).normalize();
    for (let k = 0; k < 9; k++) {
      r = solveFraming({ eye, points: pts, look: look0, fov: fov0, aspect, region, maxFov: 70, slack: 1.06 });
      if (r.fits && r.fov <= fov0 * 1.15 + 0.01) return { eye, look: r.look, fov: r.fov, how: r.how };
      const next = eye.clone().addScaledVector(dir, 0.8);
      if (Math.hypot(next.x, next.z) > HALL) break;
      eye = next;
    }
    r = solveFraming({ eye, points: pts, look: look0, fov: fov0, aspect, region, maxFov: 84, slack: 1.06 });
    return { eye, look: r.look, fov: r.fov, how: r.how };
  }

  function aim(seconds) { w = 2.6 / Math.max(0.3, seconds); }
  /** Move to an authored shot; `pts` are world points that must stay on screen. */
  function shot(n, { pts = null, seconds = 3.5, snap = false } = {}) {
    const s = SHOTS[n] || SHOTS.opening; name = n; points = pts;
    const f = pts?.length ? fit(V(s.eye), V(s.look), s.fov, pts) : { eye: V(s.eye), look: V(s.look), fov: s.fov };
    tgt.eye.copy(f.eye); tgt.look.copy(f.look); tgt.fov = f.fov;
    aim(seconds);
    if (snap) jump();
    return f;
  }
  /** Keep the current shot, but frame a new set of points. */
  function frame(pts, { seconds = 2.4 } = {}) { return shot(name, { pts, seconds }); }
  function jump() { cur.eye.copy(tgt.eye); cur.look.copy(tgt.look); cur.fov = tgt.fov; vel.eye.set(0, 0, 0); vel.look.set(0, 0, 0); vel.fov = 0; }

  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => shot(name, { pts: points, seconds: 0.8 }), 120); });

  const off = new THREE.Vector3(), right = new THREE.Vector3(), fwd = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function update(dt, t) {
    dt = Math.min(dt, 0.1);
    for (const k of ['x', 'y', 'z']) {
      [cur.eye[k], vel.eye[k]] = spring(cur.eye[k], vel.eye[k], tgt.eye[k], w, dt);
      [cur.look[k], vel.look[k]] = spring(cur.look[k], vel.look[k], tgt.look[k], w, dt);
    }
    [cur.fov, vel.fov] = spring(cur.fov, vel.fov, tgt.fov, w, dt);
    par.x += (par.tx - par.x) * (1 - Math.exp(-dt * 1.5)); par.y += (par.ty - par.y) * (1 - Math.exp(-dt * 1.5));
    fwd.copy(cur.look).sub(cur.eye).normalize(); right.crossVectors(fwd, UP).normalize();
    const d = REDUCED_MOTION ? 0 : sway;
    off.set(Math.sin(t * 0.11) * 0.09, Math.sin(t * 0.153) * 0.045, Math.cos(t * 0.087) * 0.05).multiplyScalar(d)
      .addScaledVector(right, par.x * 0.1 * d).addScaledVector(UP, par.y * 0.05 * d);
    camera.position.copy(cur.eye).add(off);
    camera.lookAt(cur.look);
    if (Math.abs(camera.fov - cur.fov) > 1e-3) { camera.fov = cur.fov; camera.updateProjectionMatrix(); }
  }

  /** Where Dalil stands for the shot being moved to: close, beside the player, inside the frame. */
  function companionSpot(side = -1, dist = 3.3) {
    const f = tgt.look.clone().sub(tgt.eye).setY(0).normalize();
    const r = new THREE.Vector3().crossVectors(f, UP).normalize();
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const halfH = Math.atan(Math.tan((tgt.fov * Math.PI) / 360) * aspect);
    const s = Math.min(1.05, dist * Math.tan(halfH) * 0.6);
    const p = tgt.eye.clone().addScaledVector(f, dist).addScaledVector(r, s * side);
    p.y = Math.max(1.0, tgt.eye.y - 0.3);
    return p;
  }

  return {
    shot, frame, jump, update, companionSpot, cur, tgt,
    get name() { return name; },
    setParallax(x, y) { par.tx = x; par.ty = y; },
    setSway(s) { sway = s; },
  };
}
