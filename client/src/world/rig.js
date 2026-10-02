// Cinematic camera rig: GSAP-driven flights, damped follow, gentle idle drift
// and an optional shake. The camera always eases toward the rig's target.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { REDUCED_MOTION } from '../core/scene.js';

export function createRig(camera) {
  const target = { pos: new THREE.Vector3(0, 2, 10), look: new THREE.Vector3(), fov: camera.fov };
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const state = { drift: 1, shake: 0 };
  let follow = null; // { get: () => Vector3, offset: Vector3, lookOffset: Vector3, lambda }
  let flight = null;

  function snap(pos, lk, fov) {
    follow = null; flight?.kill();
    target.pos.copy(pos); target.look.copy(lk);
    camera.position.copy(pos); look.copy(lk); camera.lookAt(look);
    if (fov) { target.fov = fov; camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  /** Fly to a shot. Resolves when the move finishes. */
  function flyTo({ pos, look: lk, fov = target.fov, duration = 3, ease = 'power2.inOut', delay = 0 }) {
    follow = null;
    flight?.kill();
    return new Promise((res) => {
      flight = gsap.timeline({ delay, onComplete: res });
      const d = REDUCED_MOTION ? 0.01 : duration;
      flight.to(target.pos, { x: pos.x, y: pos.y, z: pos.z, duration: d, ease }, 0)
        .to(target.look, { x: lk.x, y: lk.y, z: lk.z, duration: d, ease }, 0)
        .to(target, { fov, duration: d, ease }, 0);
    });
  }

  /** Move the camera and its target together (used when the world itself shifts). */
  function shift(d) {
    flight?.kill();
    target.pos.add(d); target.look.add(d); camera.position.add(d); look.add(d);
  }

  function followTarget(get, offset, lookOffset = new THREE.Vector3(), lambda = 2.4) {
    flight?.kill();
    follow = { get, offset, lookOffset, lambda }; // kept by reference: tweening the offset moves the shot
  }

  function update(dt, t) {
    if (follow) {
      const p = follow.get();
      tmp.copy(p).add(follow.offset);
      target.pos.x = THREE.MathUtils.damp(target.pos.x, tmp.x, follow.lambda, dt);
      target.pos.y = THREE.MathUtils.damp(target.pos.y, tmp.y, follow.lambda, dt);
      target.pos.z = THREE.MathUtils.damp(target.pos.z, tmp.z, follow.lambda, dt);
      tmp.copy(p).add(follow.lookOffset);
      target.look.x = THREE.MathUtils.damp(target.look.x, tmp.x, follow.lambda * 1.6, dt);
      target.look.y = THREE.MathUtils.damp(target.look.y, tmp.y, follow.lambda * 1.6, dt);
      target.look.z = THREE.MathUtils.damp(target.look.z, tmp.z, follow.lambda * 1.6, dt);
    }
    const drift = REDUCED_MOTION ? 0 : state.drift;
    // narrow (portrait) screens: dolly back along the view line so shots still fit
    const k = camera.aspect < 1.25 ? Math.min(2.3, Math.pow(1.25 / camera.aspect, 0.8)) : 1;
    tmp.copy(target.pos).sub(target.look).multiplyScalar(k).add(target.look);
    camera.position.set(
      tmp.x + Math.sin(t * 0.21) * 0.12 * drift + (Math.random() - 0.5) * state.shake,
      tmp.y + Math.sin(t * 0.17 + 1.3) * 0.08 * drift + (Math.random() - 0.5) * state.shake,
      tmp.z + Math.cos(t * 0.19) * 0.1 * drift,
    );
    look.lerp(target.look, 1 - Math.exp(-12 * dt));
    camera.lookAt(look);
    if (Math.abs(camera.fov - target.fov) > 0.01) { camera.fov = target.fov; camera.updateProjectionMatrix(); }
  }

  return { target, state, snap, flyTo, shift, followTarget, update, get following() { return !!follow; } };
}
