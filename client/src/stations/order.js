// Station 1 · Order: the planets are lost; drag each one onto its orbit.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { audio } from '../core/audio.js';
import { cinematic } from '../core/scene.js';
import * as ui from '../ui/components.js';
import { t } from '../core/i18n.js';
import { script as S } from '../core/content.js';
import * as store from '../core/store.js';

export const SHOT_SYSTEM = { pos: new THREE.Vector3(2, 15, 36), look: new THREE.Vector3(-1.5, -1, 0), fov: 48 };
const GOLD = new THREE.Color('#ffcf73');
const TOL = 1.5;

export function prepareChaos(cosmos) {
  cosmos.planets.forEach((p) => {
    p.mode = 'chaos';
    p.orbitU.uColor.value.set(p.ring);
    p.orbitU.uDash.value = 1; p.orbitU.uOpacity.value = 0.28; p.orbitU.uGlow.value = 0; p.orbitU.uPulse.value = 0;
  });
}

export function runOrder({ cosmos, camera, canvas, rig }) {
  const st = S.world1.stations[0];
  const planets = cosmos.planets;
  const solved = new Set();
  let wrong = 0, hintIdx = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const stability = { v: 0 };
  let dragging = -1, highlighted = -1;
  const dragTarget = new THREE.Vector3();
  const returning = new Map(); // index -> {from, k}

  return new Promise((resolve) => {
    prepareChaos(cosmos);
    const intro = ui.caption(st.intro);
    const instr = ui.instruction(st.instruction);
    const hintBtn = ui.hintButton(() => { showHint(); });
    let hintCaption = null;

    function showHint() {
      const text = st.hints[Math.min(hintIdx, st.hints.length - 1)];
      hintIdx++;
      hintCaption?.done?.();
      intro.done();
      hintCaption = ui.caption(text);
      setTimeout(() => hintCaption?.done?.(), 6000);
    }

    function setNdc(e) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    }
    function pickPlanet() {
      const hits = ray.intersectObjects(planets.filter((p) => !solved.has(p.index)).map((p) => p.hit), false);
      return hits.length ? hits[0].object.userData.planetIndex : -1;
    }
    function highlight(j) {
      if (j === highlighted) return;
      if (highlighted >= 0 && !solved.has(highlighted)) { const u = planets[highlighted].orbitU; gsap.to(u.uGlow, { value: 0, duration: 0.3 }); u.uPulse.value = 0; u.uDash.value = 1; gsap.to(u.uOpacity, { value: 0.28, duration: 0.3 }); }
      highlighted = j;
      if (j >= 0) { const u = planets[j].orbitU; gsap.to(u.uGlow, { value: 0.55, duration: 0.25 }); u.uPulse.value = 1; u.uDash.value = 0; gsap.to(u.uOpacity, { value: 0.8, duration: 0.25 }); audio.soft(); }
    }
    function nearestRing(r) {
      let best = -1, d = Infinity;
      planets.forEach((p, j) => { if (solved.has(j)) return; const dd = Math.abs(r - p.R); if (dd < d) { d = dd; best = j; } });
      return d < TOL ? best : -1;
    }

    const onDown = (e) => {
      setNdc(e);
      const i = pickPlanet();
      if (i < 0) return;
      dragging = i; planets[i].mode = 'manual'; returning.delete(i);
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      dragTarget.copy(planets[i].group.position);
      gsap.to(planets[i].atmU.uStrength, { value: 2.6, duration: 0.3 });
      audio.soft();
      intro.done();
    };
    const onMove = (e) => {
      setNdc(e);
      if (dragging < 0) { canvas.style.cursor = pickPlanet() >= 0 ? 'grab' : 'default'; return; }
      if (ray.ray.intersectPlane(plane, hit)) {
        hit.clampLength(0, 24);
        dragTarget.copy(hit);
        highlight(nearestRing(Math.hypot(hit.x, hit.z)));
      }
    };
    const onUp = () => {
      if (dragging < 0) return;
      const i = dragging; dragging = -1; canvas.style.cursor = 'default';
      gsap.to(planets[i].atmU.uStrength, { value: 1.25, duration: 0.5 });
      const p = planets[i].group.position;
      const j = nearestRing(Math.hypot(p.x, p.z));
      highlight(-1);
      if (j === i) snap(i); else sendBack(i);
    };

    function snap(i) {
      const p = planets[i];
      solved.add(i);
      const ang = Math.atan2(p.group.position.z, p.group.position.x);
      const to = new THREE.Vector3(p.R * Math.cos(ang), 0, p.R * Math.sin(ang));
      audio.snap();
      store.log('order_snap', { planet: i, wrong });
      gsap.to(p.group.position, { x: to.x, y: 0, z: to.z, duration: 0.45, ease: 'back.out(1.6)', onComplete: () => {
        cosmos.setOrbitPhaseFromAngle(i, ang, performance.now() / 1000 - clock0 + t0);
        p.mode = 'orbit';
      } });
      const u = p.orbitU;
      u.uDash.value = 0; u.uPulse.value = 0;
      gsap.to(u.uColor.value, { r: GOLD.r, g: GOLD.g, b: GOLD.b, duration: 0.8 });
      gsap.fromTo(u.uGlow, { value: 1.0 }, { value: 0.12, duration: 1.6, ease: 'power2.out' });
      gsap.to(u.uOpacity, { value: 0.6, duration: 0.6 });
      cosmos.burstAqua.play(to, 3.5, 0.4, 1.4);
      gsap.to(stability, { v: solved.size / planets.length, duration: 1.2 });
      if (solved.size === planets.length) harmony();
    }

    function sendBack(i) {
      wrong++;
      audio.wrong();
      store.log('order_wrong', { planet: i });
      returning.set(i, { from: planets[i].group.position.clone(), k: { v: 0 } });
      const r = returning.get(i);
      gsap.to(r.k, { v: 1, duration: 0.9, ease: 'power2.inOut', onComplete: () => { returning.delete(i); planets[i].mode = 'chaos'; } });
      if (wrong === 1 || wrong === 3) showHint();
    }

    // time base so a snapped planet continues smoothly in orbit mode
    let clock0 = performance.now() / 1000, t0 = 0;
    const tmp = new THREE.Vector3();
    const stopUpdate = cosmos.addUpdater((dt, t) => {
      clock0 = performance.now() / 1000; t0 = t;
      if (dragging >= 0) {
        const g = planets[dragging].group.position;
        g.x = THREE.MathUtils.damp(g.x, dragTarget.x, 14, dt);
        g.y = THREE.MathUtils.damp(g.y, 0, 10, dt);
        g.z = THREE.MathUtils.damp(g.z, dragTarget.z, 14, dt);
      }
      for (const [i, r] of returning) {
        cosmos.chaosPos(i, t, tmp);
        planets[i].group.position.copy(r.from).lerp(tmp, r.k.v);
      }
      // the sun is unsettled until order returns
      const s = stability.v;
      cosmos.sunMat.uniforms.uIntensity.value = THREE.MathUtils.lerp(2.4 + 0.5 * Math.sin(t * 9.1) * Math.sin(t * 3.7), 3.2, s);
      cosmos.coronaOut.material.opacity = THREE.MathUtils.lerp(0.22 + 0.08 * Math.sin(t * 5.3), 0.38, s);
    });

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    async function harmony() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.style.cursor = 'default';
      intro.done(); instr.done(); hintBtn.done(); hintCaption?.done?.();
      store.log('order_done', { wrong });
      await new Promise((r) => setTimeout(r, 500));
      audio.swell();
      cosmos.burstGold.play(new THREE.Vector3(0, 0, 0), 26, 3, 3.4);
      planets.forEach((p) => gsap.fromTo(p.orbitU.uGlow, { value: 0.8 }, { value: 0.12, duration: 3, ease: 'power2.out' }));
      gsap.fromTo(cosmos.coronaOut.scale, { x: 54, y: 54 }, { x: 70, y: 70, duration: 1.6, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      gsap.fromTo(cinematic.uniforms.uCA, { value: 0.006 }, { value: 0.0022, duration: 2 });
      rig.flyTo({ pos: SHOT_SYSTEM.pos.clone().multiplyScalar(0.86).add(new THREE.Vector3(0, -1.5, 0)), look: new THREE.Vector3(-1, 0, 0), duration: 4, ease: 'power2.out' });
      await new Promise((r) => setTimeout(r, 1400));
      stopUpdate();
      resolve();
    }

    // debug hook: solve everything (tests and demos)
    window.__fitrahSolve = () => { planets.forEach((p) => { if (!solved.has(p.index)) { cosmos.orderPos(p.index, t0, p.group.position); p.group.position.multiplyScalar(1.02); snap(p.index); } }); };
  });
}
