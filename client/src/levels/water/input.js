// One input pipeline for mouse, trackpad, touch, pen and keyboard. Pointer
// gestures go to whichever discovery gesture is active (trace, reveal, connect,
// align). Nothing here touches the simulation: the player moves attention only.
// Hit priority: Dalil first (a tap asks him), then the active gesture.
// Keyboard: hold Space to follow with assistance; / asks Dalil; W/S walk; Esc menu.
import * as THREE from 'three';
import { claimGestures } from '../../core/gesture-surface.js';

export function createInput({ canvas, getDalilScreen, onAsk, onMenu, onWalk }) {
  const G = { active: null, enabled: false, lastGestureT: -1e9, firstGestureT: null, keyboard: false, assist: false, pointerType: 'mouse' };
  const parallax = new THREE.Vector2();
  let now = 0, downOnDalil = false;
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, ((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]; };

  claimGestures(canvas); // touch + hold + drag stays a gesture: no iOS selection popup over the game
  let downAt = null; // a press that began on Dalil: a short tap asks him, a drag is a gesture
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    G.pointerType = e.pointerType; G.keyboard = false;
    canvas.setPointerCapture?.(e.pointerId);
    const [x, y] = pos(e);
    const d = getDalilScreen?.();
    downOnDalil = !!(d && d.visible && Math.hypot(x - d.x, y - d.y) < Math.max(40, d.r * 1.5));
    downAt = { x, y, t: performance.now() };
    if (!G.enabled || !G.active) return;
    G.active.onDown(x, y);
    G.lastGestureT = now; if (G.firstGestureT === null) G.firstGestureT = now;
  });
  canvas.addEventListener('pointermove', (e) => {
    const [x, y, nx, ny] = pos(e);
    parallax.set(nx, ny);
    if (downOnDalil && downAt && Math.hypot(x - downAt.x, y - downAt.y) > 12) downOnDalil = false;
    if (!G.enabled || !G.active) return;
    const pressed = (e.buttons & 1) === 1 || e.pointerType === 'touch';
    G.active.onMove(x, y, pressed);
    if (pressed) G.lastGestureT = now;
  });
  const up = () => {
    if (downOnDalil && downAt && performance.now() - downAt.t < 450) onAsk?.('tap');
    downOnDalil = false; downAt = null; G.active?.onUp();
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => parallax.set(0, 0));
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); onWalk?.(-e.deltaY * 0.012); }, { passive: false });

  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'Escape') { onMenu?.(); return; }
    if (e.key === '/') { e.preventDefault(); onAsk?.('key'); return; }
    if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
    if ([' ', 'w', 'W', 's', 'S'].includes(e.key)) { e.preventDefault(); keys.add(e.key); if (e.key === ' ') G.keyboard = true; }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key));

  function setActive(gesture) {
    if (G.active && G.active !== gesture) { G.active.onUp?.(); if (G.active.s) G.active.s.assist = false; }
    G.active = gesture;
  }
  function update(dt, t) {
    now = t;
    // holding Space follows with assistance (keyboard and accessibility)
    G.assist = keys.has(' ');
    if (G.active?.s) {
      G.active.s.assist = G.assist;
      if (G.assist) { G.lastGestureT = t; if (G.firstGestureT === null) G.firstGestureT = t; }
    }
    const w = (keys.has('w') || keys.has('W') ? 1 : 0) - (keys.has('s') || keys.has('S') ? 1 : 0);
    if (w) onWalk?.(w * dt * 1.3);
  }
  return { G, update, setActive, parallax };
}
