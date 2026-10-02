// Station 3 · The One: two conflicting laws pull the same system apart.
// The player drags the tilted plane until it lies on the other; the conflict
// dissolves into one harmony. Nothing here represents God: only the effects.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { audio } from '../core/audio.js';
import { cinematic } from '../core/scene.js';
import * as ui from '../ui/components.js';
import { script as S } from '../core/content.js';
import * as store from '../core/store.js';

const PLANE_FRAG = /* glsl */`
uniform vec3 uColor; uniform float uOpacity, uTime;
varying vec2 vP;
void main(){
  float r = length(vP) / 21.0;
  if (r > 1.0) discard;
  float rings = 0.5 + 0.5 * cos(r * 90.0 - uTime * 1.5);
  rings = pow(rings, 12.0) * 0.5;
  float edge = smoothstep(0.9, 1.0, r) * (1.0 - smoothstep(0.995, 1.0, r)) * 2.0;
  float fill = 0.08 * (1.0 - r);
  float a = (rings * (1.0 - r) + edge + fill) * uOpacity;
  gl_FragColor = vec4(uColor, a);
}`;

function makePlane(color) {
  const u = { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uTime: { value: 0 } };
  const m = new THREE.Mesh(new THREE.CircleGeometry(21, 160), new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: PLANE_FRAG,
  }));
  return { mesh: m, u };
}

export function runOneness({ cosmos, canvas, rig }) {
  const st = S.world1.stations[2];
  const TILT0 = THREE.MathUtils.degToRad(34);
  const tilt = { v: TILT0 };
  const conflict = { v: 0 };
  const A = makePlane('#ffb36b'); A.mesh.rotation.x = -Math.PI / 2;
  const B = makePlane('#7fa8ff');
  const pivot = new THREE.Group(); pivot.add(B.mesh); B.mesh.rotation.x = -Math.PI / 2;
  cosmos.root.add(A.mesh, pivot);

  // a glowing handle on the high rim of the tilted plane
  const handle = new THREE.Sprite(new THREE.SpriteMaterial({ map: cosmos.GLOW_AQUA, color: 0xbfe0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  handle.scale.set(3, 3, 1); cosmos.root.add(handle);

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), axisX = new THREE.Vector3(1, 0, 0);

  return new Promise((resolve) => {
    cosmos.planets.forEach((p) => { p.mode = 'manual'; });
    rig.flyTo({ pos: new THREE.Vector3(-6, 13, 40), look: new THREE.Vector3(0, 1, 0), duration: 3.6, fov: 48 });
    gsap.to(conflict, { v: 1, duration: 2.5, delay: 1 });
    gsap.to([A.u.uOpacity, B.u.uOpacity], { value: 0.9, duration: 2, delay: 1 });
    gsap.to(handle.material, { opacity: 0.9, duration: 1.5, delay: 2.5 });

    let intro, instr, hintCap;
    setTimeout(() => {
      intro = ui.caption(st.intro);
      instr = ui.instruction(S.ui.oneness_drag);
    }, 1800);

    let dragging = false, lastY = 0, merged = false;
    const onDown = (e) => { if (merged) return; dragging = true; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; intro?.done(); };
    const onMove = (e) => {
      if (!dragging) { canvas.style.cursor = merged ? 'default' : 'ns-resize'; return; }
      const dy = e.clientY - lastY; lastY = e.clientY;
      tilt.v = THREE.MathUtils.clamp(tilt.v - dy * 0.0042 * (window.innerHeight < 600 ? 1.6 : 1), 0, TILT0 * 1.15);
      if (tilt.v < THREE.MathUtils.degToRad(4)) merge();
    };
    const onUp = () => {
      if (!dragging) return; dragging = false; canvas.style.cursor = 'default';
      if (!merged && tilt.v > TILT0 * 0.6 && !hintCap) { hintCap = ui.caption(st.hints[0]); setTimeout(() => hintCap?.done(), 6000); }
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    const stopUpdate = cosmos.addUpdater((dt, t) => {
      pivot.rotation.x = tilt.v;
      A.u.uTime.value = t; B.u.uTime.value = -t;
      const c = conflict.v * (tilt.v / TILT0);
      cosmos.planets.forEach((p, i) => {
        cosmos.orderPos(i, t, tmpA);
        tmpB.copy(tmpA).applyAxisAngle(axisX, tilt.v);
        const w = 0.5 + 0.5 * Math.sin(t * (5 + i * 1.7) + i * 2.1) * Math.sin(t * 2.3 + i);
        p.group.position.copy(tmpA).lerp(tmpB, w * conflict.v);
      });
      cosmos.sun.position.set((Math.random() - 0.5) * 0.25 * c, (Math.random() - 0.5) * 0.25 * c, 0);
      cosmos.coronaIn.position.copy(cosmos.sun.position);
      rig.state.shake = 0.07 * c;
      const flick = Math.sin(t * 3.1) * Math.sin(t * 7.7);
      cinematic.uniforms.uTint.value.setRGB(flick > 0 ? 1.05 : 0.78, flick > 0 ? 0.86 : 0.88, flick > 0 ? 0.7 : 1.12);
      cinematic.uniforms.uTintAmt.value = 0.45 * c * Math.abs(flick);
      handle.position.set(0, 21 * Math.sin(tilt.v), -21 * Math.cos(tilt.v)).applyAxisAngle(axisX, 0);
      handle.position.set(0, Math.sin(tilt.v) * 21, -Math.cos(tilt.v) * 21);
    });

    async function merge() {
      if (merged) return; merged = true; dragging = false;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.style.cursor = 'default';
      intro?.done(); instr?.done(); hintCap?.done();
      store.log('oneness_done');
      gsap.to(tilt, { v: 0, duration: 0.6, ease: 'power2.out' });
      gsap.to(conflict, { v: 0, duration: 1.4, ease: 'power2.out' });
      gsap.to(handle.material, { opacity: 0, duration: 0.5 });
      gsap.to([A.u.uColor.value, B.u.uColor.value], { r: 1, g: 0.81, b: 0.45, duration: 0.8 });
      gsap.to([A.u.uOpacity, B.u.uOpacity], { value: 0, duration: 2.6, delay: 0.8 });
      audio.swell();
      cosmos.burstGold.play(new THREE.Vector3(0, 0, 0), 24, 2, 3.2);
      cosmos.planets.forEach((p) => gsap.fromTo(p.orbitU.uGlow, { value: 0.8 }, { value: 0.12, duration: 3 }));
      await new Promise((r) => setTimeout(r, 1500));
      rig.state.shake = 0; cinematic.uniforms.uTintAmt.value = 0; cosmos.sun.position.set(0, 0, 0); cosmos.coronaIn.position.set(0, 0, 0);
      stopUpdate();
      cosmos.planets.forEach((p) => { p.mode = 'orbit'; });
      setTimeout(() => cosmos.root.remove(A.mesh, pivot, handle), 3000);
      resolve();
    }
    window.__fitrahSolve = () => merge();
  });
}
