// One input pipeline for mouse, trackpad, touch, pen and keyboard (section 35):
// PointerInput -> NormalizedGesture -> InteractionField (wind splats, cloud gaps).
// Hit priority: Dalil first, then clouds (when parting is enabled), then wind.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { raycastTerrain, raycastPlaneY, channelX, M } from './terrain.js';
import { splat, openClouds, cloudAt } from './sim.js';

export function regionOf(x, z) {
  if (Math.hypot(x - M.x, z - M.z) < M.r + 6) return 'meadow';
  if (x > 50) return 'east-slope';
  if (Math.abs(x - channelX(z)) < 10) return 'stream';
  return 'basin';
}

export function createInput({ canvas, camera, getDalilScreen, partEnabled, onAsk, onMenu, onWalk, onFirstGesture }) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const listeners = new Set();
  const emit = (e) => listeners.forEach((fn) => fn(e));
  const G = {
    lastGestureT: -1e9, firstGestureT: null, strokes: 0, scatters: 0, parts: 0,
    type: 'idle', region: 'basin', energy: 0, hoverEnergy: 0,
    lastHit: null, keyboard: false, enabled: false,
  };
  const ptr = { down: false, id: null, mode: null, nx: 0, ny: 0, t: 0, hit: null, speed: 0 };
  let now = 0;

  function hitAt(nx, ny) {
    ndc.set(nx, ny); ray.setFromCamera(ndc, camera);
    const c = raycastPlaneY(ray.ray, CONFIG.cloudHeight);
    if (c) {
      // far sky is folded back to the basin's far side so the air the player moves stays within sight
      const dx = c.x - camera.position.x, dz = c.z - camera.position.z, d = Math.hypot(dx, dz);
      if (d > 150) { c.x = camera.position.x + (dx / d) * 150; c.z = camera.position.z + (dz / d) * 150; }
      const lim = CONFIG.half - 6;
      c.x = Math.max(-lim, Math.min(lim, c.x)); c.z = Math.max(-lim, Math.min(lim, c.z));
      return { p: c, kind: 'cloud' };
    }
    const g = raycastTerrain(ray.ray, 320);
    return g ? { p: g, kind: 'ground' } : null;
  }

  function move(nx, ny, t, pressed) {
    const dt = Math.max(1 / 240, Math.min(0.1, t - ptr.t));
    const sp = Math.hypot(nx - ptr.nx, ny - ptr.ny) / dt; // NDC units per second
    // one-euro-style smoothing: responsive when fast, steady when slow
    const alpha = Math.min(1, 0.25 + sp * 0.12);
    ptr.speed += (sp - ptr.speed) * alpha;
    const hit = hitAt(nx, ny);
    const prevHit = ptr.hit;
    ptr.nx = nx; ptr.ny = ny; ptr.t = t; ptr.hit = hit;
    if (!G.enabled || !hit || !prevHit || prevHit.kind !== hit.kind) return;
    const dx = hit.p.x - prevHit.p.x, dz = hit.p.z - prevHit.p.z, dl = Math.hypot(dx, dz);
    if (dl < 1e-4) return;
    G.region = regionOf(hit.p.x, hit.p.z);
    if (pressed && ptr.mode === 'part') {
      const steps = Math.max(1, Math.ceil(dl / 2));
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        openClouds(prevHit.p.x + dx * k, prevHit.p.z + dz * k, 14 + Math.min(4, ptr.speed * 1.5), 0.15 * Math.min(1, dl / steps / 2 + 0.3));
      }
      G.type = 'part'; G.lastGestureT = now;
      emit({ type: 'part', x: hit.p.x, z: hit.p.z });
      return;
    }
    const gain = pressed ? 1 : 0.22;
    const mag = Math.min(9, ptr.speed * 6 * gain);
    const vx = (dx / dl) * mag, vz = (dz / dl) * mag;
    const r = Math.min(18, 6 + 0.8 * mag);
    const energy = pressed ? ptr.speed / 4.5 : 0;
    splat(hit.p.x, hit.p.z, vx, vz, r, energy, Math.min(0.6, dt * 10));
    G.lastHit = hit.p;
    if (pressed) {
      G.energy += (energy - G.energy) * 0.2;
      G.type = energy > 1 ? 'scatter' : 'gather';
      if (energy > 1) G.scatters += dt;
      G.lastGestureT = now;
      if (G.firstGestureT === null) { G.firstGestureT = now; onFirstGesture?.(); }
      emit({ type: G.type, x: hit.p.x, z: hit.p.z, energy });
    } else {
      G.hoverEnergy += (ptr.speed - G.hoverEnergy) * 0.1;
      if (now - G.lastGestureT > 1.5) G.type = 'explore';
    }
  }

  function toNdc(e) {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, e.clientX - r.left, e.clientY - r.top];
  }

  function down(nx, ny, px, py, t) {
    ptr.down = true; ptr.t = t; ptr.nx = nx; ptr.ny = ny; ptr.hit = hitAt(nx, ny);
    const d = getDalilScreen?.();
    if (d && d.visible && Math.hypot(px - d.x, py - d.y) < Math.max(38, d.r * 1.4)) { ptr.mode = 'ask'; onAsk?.('tap'); return; }
    if (!G.enabled) { ptr.mode = null; return; }
    if (partEnabled() && ptr.hit && ptr.hit.kind === 'cloud' && cloudAt(ptr.hit.p.x, ptr.hit.p.z) > 0.28) { ptr.mode = 'part'; G.parts++; }
    else { ptr.mode = 'gather'; G.strokes++; }
    emit({ type: 'down', mode: ptr.mode });
  }
  function up() { if (ptr.down) emit({ type: 'up', mode: ptr.mode }); ptr.down = false; ptr.mode = null; }

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    G.keyboard = false;
    canvas.setPointerCapture?.(e.pointerId); ptr.id = e.pointerId;
    const [nx, ny, px, py] = toNdc(e); down(nx, ny, px, py, e.timeStamp / 1000);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (ptr.down && e.pointerId !== ptr.id) return;
    G.keyboard = false;
    const [nx, ny] = toNdc(e);
    move(nx, ny, e.timeStamp / 1000, ptr.down && ptr.mode !== 'ask' && ptr.mode !== null);
    parallax.set(nx, ny);
  });
  const end = (e) => { if (e.pointerId === ptr.id) up(); };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', (e) => { if (!ptr.down) parallax.set(0, 0); void e; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); onWalk?.(-e.deltaY * 0.012); }, { passive: false });

  // keyboard: a virtual pointer (the wind focus) driven by the arrow keys
  const keys = new Set();
  const focus = { nx: 0, ny: 0.35 };
  const ring = document.createElement('div'); ring.className = 'kfocus'; ring.setAttribute('aria-hidden', 'true');
  document.body.append(ring);
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'Escape') { onMenu?.(); return; }
    if (e.key === '/') { e.preventDefault(); onAsk?.('key'); return; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'w', 'W', 's', 'S'].includes(e.key)) {
      if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
      e.preventDefault();
      if (!keys.has(e.key) && e.key.startsWith('Arrow')) { G.keyboard = true; ptr.nx = focus.nx; ptr.ny = focus.ny; ptr.hit = hitAt(focus.nx, focus.ny); ptr.t = now; }
      if (!keys.has(' ') && e.key === ' ') { G.keyboard = true; ptr.mode = 'gather'; G.strokes++; ptr.hit = hitAt(focus.nx, focus.ny); }
      if (!keys.has('Enter') && e.key === 'Enter') {
        G.keyboard = true; ptr.hit = hitAt(focus.nx, focus.ny);
        ptr.mode = partEnabled() ? 'part' : 'gather';
      }
      keys.add(e.key);
    }
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.key); if (e.key === ' ' || e.key === 'Enter') ptr.mode = null; });

  const parallax = new THREE.Vector2();
  function update(dt, t) {
    now = t;
    // the keyboard focus moves and acts like a pointer
    let kx = 0, ky = 0;
    if (keys.has('ArrowLeft')) kx -= 1; if (keys.has('ArrowRight')) kx += 1;
    if (keys.has('ArrowUp')) ky += 1; if (keys.has('ArrowDown')) ky -= 1;
    const pressing = keys.has(' ') || keys.has('Enter');
    if (G.keyboard && (kx || ky || pressing)) {
      focus.nx = Math.max(-0.95, Math.min(0.95, focus.nx + kx * dt * 0.9));
      focus.ny = Math.max(-0.9, Math.min(0.95, focus.ny + ky * dt * 0.9));
      if (pressing && !ptr.mode) ptr.mode = keys.has('Enter') && partEnabled() ? 'part' : 'gather';
      // without arrow motion, Enter still parts slowly at the focus
      if (keys.has('Enter') && partEnabled() && !kx && !ky) {
        const h = hitAt(focus.nx, focus.ny);
        if (h && h.kind === 'cloud') openClouds(h.p.x, h.p.z, 9, 0.6 * dt);
        G.lastGestureT = t;
      }
      ptr.down = pressing;
      move(focus.nx, focus.ny, t, pressing);
      ptr.down = false;
    }
    ring.style.display = G.keyboard ? 'block' : 'none';
    if (G.keyboard) {
      ring.style.left = `${(focus.nx * 0.5 + 0.5) * 100}%`; ring.style.top = `${(-focus.ny * 0.5 + 0.5) * 100}%`;
      ring.classList.toggle('on', pressing);
    }
    const w = (keys.has('w') || keys.has('W') ? 1 : 0) - (keys.has('s') || keys.has('S') ? 1 : 0);
    if (w) onWalk?.(w * dt * 1.3);
    if (now - G.lastGestureT > 3 && !ptr.down) G.type = G.hoverEnergy > 0.3 ? 'explore' : 'idle';
    G.hoverEnergy *= Math.exp(-dt * 0.8);
    G.energy *= Math.exp(-dt * 1.5);
  }

  return { G, update, on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, parallax, ptr };
}
