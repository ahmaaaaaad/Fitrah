// Fitrah – entry point
import * as THREE from 'three';
import { start, scene, camera, renderer, composer } from './core/scene.js';
import { createWorld1 } from './scenes/world1.js';

const container = document.getElementById('app');
start(container);

const world = createWorld1();

// Tap / click to move: project the pointer onto the orb's horizontal plane
// and glide the orb there. This is the seed of the point-and-click navigation.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

container.addEventListener('pointerup', (e) => {
  const rect = container.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  plane.constant = -world.orb.anchor.position.y;
  if (raycaster.ray.intersectPlane(plane, hit)) {
    hit.clampLength(0, 30); // keep the orb inside the playable area
    world.moveOrbTo(hit);
  }
});

// Handy handles for tweaking from the browser console during development.
if (import.meta.env.DEV) {
  window.fitrah = { scene, camera, renderer, composer, world };
}
