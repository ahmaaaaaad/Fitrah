// The camera of the Fitrah level: authored shots, eased like a slow dolly, with a
// faint breathing drift. When a shot must hold several things at once (the four
// question lights, the chain of chapter 1), its framing is calculated for the
// screen in hand: the camera turns, steps back inside the hall, and only then
// widens, so every point stays inside the safe region on a phone as on a monitor.
import * as THREE from 'three';
import { solveFraming } from '../../core/framing.js';
import { interactionRegion } from '../../core/device.js';
import { REDUCED_MOTION } from '../../core/scene.js';
import { adaptLens } from '../../core/lens.js';

const V = (a) => new THREE.Vector3(...a);
// Every shot is composed for a 16:9 screen; adaptLens() keeps that composition on any
// other screen (see core/lens.js). `subject` is how far the camera stands from what the
// shot is about (the figures), the distance it scales when it must step back; `reach`
// is how far from the centre of the hall it may stand.
export const SHOTS = {
  // the first frame: high and far behind, the small figure before the vast aperture
  establish: { eye: [0, 6.2, 27], look: [0, 7.5, -20], fov: 52, subject: 9, reach: 31 },
  opening:  { eye: [0, 1.8, 10.3], look: [0, 2.4, 0], fov: 50 },
  four:     { eye: [0, 1.95, 10.4], look: [0, 2.9, -3], fov: 52 },
  chain:    { eye: [0, 2.4, 10.6], look: [0, 2.6, 1.5], fov: 52 },
  centre:   { eye: [0, 1.9, 10.2], look: [0, 3.0, 0], fov: 50 },
  purpose:  { eye: [0, 1.7, 8.8], look: [0, 2.7, -9], fov: 50 },
  practice: { eye: [0, 2.4, 10.0], look: [0, 2.9, -3.0], fov: 52 },
  return:   { eye: [0, 1.6, 8.6], look: [0, 3.5, -10.6], fov: 50 },
  ending:   { eye: [0, 1.8, 10.2], look: [0, 2.8, -2.5], fov: 54 },
};
const HALL = 13.5; // framing never steps the camera further back than this

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
  function fit(eye0, look0, fov0, pts, reach = HALL) {
    // the safe region, with a little more air: points sit comfortably inside, and names fit below them
    const r0 = interactionRegion(), aspect = r0.W / r0.H;
    const region = { ...r0, left: r0.left + r0.W * 0.05, right: r0.right + r0.W * 0.05, top: r0.top + r0.H * 0.03, bottom: r0.bottom + r0.H * 0.07 };
    let eye = eye0.clone(), r = null;
    const dir = eye0.clone().sub(look0).setY(0).normalize();
    for (let k = 0; k < 9; k++) {
      r = solveFraming({ eye, points: pts, look: look0, fov: fov0, aspect, region, maxFov: Math.max(70, fov0 + 2), slack: 1.06 });
      if (r.fits && r.fov <= fov0 * 1.15 + 0.01) return { eye, look: r.look, fov: r.fov, how: r.how };
      const next = eye.clone().addScaledVector(dir, 0.8);
      if (Math.hypot(next.x, next.z) > Math.max(reach, Math.hypot(eye0.x, eye0.z) + 0.01)) break;
      eye = next;
    }
    r = solveFraming({ eye, points: pts, look: look0, fov: fov0, aspect, region, maxFov: Math.max(84, fov0 + 4), slack: 1.06 });
    return { eye, look: r.look, fov: r.fov, how: r.how };
  }

  function aim(seconds) { w = 2.6 / Math.max(0.3, seconds); }
  /** Move to an authored shot; `pts` are world points that must stay on screen. */
  let dolly = 0; // how far the current shot stands behind its 16:9 composition
  /** The authored shot adapted to this screen: the same composition, a wider lens and, past a limit, a step back. */
  function adapted(s) {
    const eye = V(s.eye), look = V(s.look);
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const L = adaptLens(s.fov, aspect);
    const reach = s.reach || HALL;
    let back = (L.back - 1) * (s.subject || 4.6);
    const dir = eye.clone().sub(look).normalize();
    // never through the wall of the hall
    for (let k = 0; k < 20 && back > 0; k++) { const e = eye.clone().addScaledVector(dir, back); if (Math.hypot(e.x, e.z) <= Math.max(reach, Math.hypot(eye.x, eye.z))) break; back *= 0.85; }
    return { eye: eye.addScaledVector(dir, back), look, fov: L.fov, back, reach };
  }
  function shot(n, { pts = null, seconds = 3.5, snap = false } = {}) {
    const s = SHOTS[n] || SHOTS.opening; name = n; points = pts;
    const a = adapted(s);
    const f = pts?.length ? fit(a.eye, a.look, a.fov, pts, a.reach) : { eye: a.eye, look: a.look, fov: a.fov };
    dolly = f.eye.distanceTo(V(s.eye)); // Dalil keeps his place in the world however far the camera stands
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
    // slow frames do not slow the choreography: the spring advances in small steps
    dt = Math.min(dt, 0.25);
    for (let left = dt; left > 1e-5; left -= 0.04) {
      const h = Math.min(0.04, left);
      for (const k of ['x', 'y', 'z']) {
        [cur.eye[k], vel.eye[k]] = spring(cur.eye[k], vel.eye[k], tgt.eye[k], w, h);
        [cur.look[k], vel.look[k]] = spring(cur.look[k], vel.look[k], tgt.look[k], w, h);
      }
      [cur.fov, vel.fov] = spring(cur.fov, vel.fov, tgt.fov, w, h);
    }
    par.x += (par.tx - par.x) * (1 - Math.exp(-dt * 1.5)); par.y += (par.ty - par.y) * (1 - Math.exp(-dt * 1.5));
    fwd.copy(cur.look).sub(cur.eye).normalize(); right.crossVectors(fwd, UP).normalize();
    const d = REDUCED_MOTION ? 0 : sway;
    off.set(Math.sin(t * 0.11) * 0.09, Math.sin(t * 0.153) * 0.045, Math.cos(t * 0.087) * 0.05).multiplyScalar(d)
      .addScaledVector(right, par.x * 0.1 * d).addScaledVector(UP, par.y * 0.05 * d);
    camera.position.copy(cur.eye).add(off);
    camera.lookAt(cur.look);
    if (Math.abs(camera.fov - cur.fov) > 1e-3) { camera.fov = cur.fov; camera.updateProjectionMatrix(); }
  }

  /** Where Dalil stands for the shot being moved to: close, beside the player, inside the frame.
   *  `dist` is meant for the 16:9 composition; when the camera stands further back on a
   *  narrower screen, Dalil keeps his place in the world (and so his size beside the player). */
  function companionSpot(side = -1, dist = 3.3) {
    dist += dolly;
    const f = tgt.look.clone().sub(tgt.eye).setY(0).normalize();
    const r = new THREE.Vector3().crossVectors(f, UP).normalize();
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const halfH = Math.atan(Math.tan((tgt.fov * Math.PI) / 360) * aspect);
    const s = Math.min(1.3, dist * Math.tan(halfH) * 0.55);
    const p = tgt.eye.clone().addScaledVector(f, dist).addScaledVector(r, s * side);
    p.y = 0; // on the floor: he stands, he does not float
    return p;
  }

  return {
    shot, frame, jump, update, companionSpot, cur, tgt,
    get name() { return name; },
    get dolly() { return dolly; },
    setParallax(x, y) { par.tx = x; par.ty = y; },
    setSway(s) { sway = s; },
  };
}
