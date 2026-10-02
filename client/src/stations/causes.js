// Station 2 · From nothing?: follow a flower back through its chain of causes.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { audio } from '../core/audio.js';
import * as ui from '../ui/components.js';
import { h, root, hide } from '../ui/dom.js';
import { i18n, t } from '../core/i18n.js';
import { script as S } from '../core/content.js';
import * as store from '../core/store.js';

export const CHAIN_ORIGIN = new THREE.Vector3(-34, 5, 30);
const STEP = 4.4;

const emissive = (color, intensity = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.6, metalness: 0, ...extra });

function buildNode(kind, glowTex) {
  const g = new THREE.Group();
  if (kind === 0) { // flower
    const petalGeo = new THREE.SphereGeometry(0.24, 24, 16);
    for (let i = 0; i < 9; i++) {
      const p = new THREE.Mesh(petalGeo, emissive(new THREE.Color('#ffd9ea'), 0.55));
      const a = (i / 9) * Math.PI * 2;
      p.scale.set(1, 0.32, 0.55); p.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3); p.rotation.y = -a; p.rotation.z = 0.35;
      g.add(p);
    }
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), emissive(new THREE.Color('#ffc861'), 1.4)));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.2, 8), emissive(new THREE.Color('#4fb58a'), 0.35));
    stem.position.y = -0.62; g.add(stem);
    g.rotation.x = 0.5;
  } else if (kind === 1) { // seed
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 20), emissive(new THREE.Color('#c79a5a'), 0.6));
    s.scale.set(1, 1.45, 1); g.add(s);
    const sprout = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 24, Math.PI * 0.9), emissive(new THREE.Color('#7fe0a0'), 0.9));
    sprout.position.set(0.1, 0.32, 0); sprout.rotation.z = 0.6; g.add(sprout);
  } else if (kind === 2) { // tree
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 1.0, 10), emissive(new THREE.Color('#8a5a36'), 0.3));
    trunk.position.y = -0.4; g.add(trunk);
    [[0.62, 0.15], [0.5, 0.6], [0.36, 1.0]].forEach(([r, y]) => {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), emissive(new THREE.Color('#3fae7a'), 0.55, { flatShading: true }));
      f.position.y = y; g.add(f);
    });
  } else if (kind === 3) { // rain and soil
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.7, 0.18, 32), emissive(new THREE.Color('#6b4a32'), 0.25));
    soil.position.y = -0.7; g.add(soil);
    [[-0.35, 0.9, 0.36], [0.05, 1.05, 0.46], [0.45, 0.9, 0.34], [0.15, 0.82, 0.3]].forEach(([x, y, r]) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), emissive(new THREE.Color('#dfe8ff'), 0.5)); c.position.set(x, y, 0); g.add(c);
    });
    const N = 46, pos = new Float32Array(N * 6);
    const rain = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.LineBasicMaterial({ color: new THREE.Color('#9fd4ff').multiplyScalar(1.6), transparent: true, opacity: 0.8 }));
    rain.userData.drops = Array.from({ length: N }, (_, i) => ({ x: (Math.random() - 0.5) * 1.3, z: (Math.random() - 0.5) * 0.6, y: Math.random(), s: 0.7 + Math.random() * 0.6 }));
    rain.userData.update = (dt) => {
      rain.userData.drops.forEach((d, i) => {
        d.y -= dt * d.s; if (d.y < 0) d.y += 1;
        const yy = -0.6 + d.y * 1.35;
        pos.set([d.x, yy, d.z, d.x, yy + 0.14, d.z], i * 6);
      });
      rain.geometry.attributes.position.needsUpdate = true;
    };
    g.add(rain); g.userData.anim = rain.userData.update;
  } else if (kind === 4) { // sun
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.72, 0.35).multiplyScalar(2.6) })));
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb35a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    gl.scale.set(4, 4, 1); g.add(gl);
  } else { // stars
    const N = 90, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, r = Math.pow(Math.random(), 0.5) * 1.0, s = Math.sqrt(1 - u * u); pos.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3); }
    const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ map: glowTex, size: 0.32, color: new THREE.Color('#e6ecff').multiplyScalar(1.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.add(pts);
  }
  // soft halo behind every node
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x9fb2ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(3.4, 3.4, 1); halo.position.z = -0.3; g.add(halo);
  return g;
}

function threadBetween(a, b, color) {
  const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.7, 0));
  const curve = new THREE.CatmullRomCurve3([a, mid, b]);
  const geo = new THREE.TubeGeometry(curve, 48, 0.022, 6, false);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  geo.setDrawRange(0, 0);
  const total = geo.index.count;
  const k = { v: 0 };
  gsap.to(k, { v: 1, duration: 0.9, ease: 'power2.inOut', onUpdate: () => geo.setDrawRange(0, Math.floor(total * k.v / 3) * 3) });
  return mesh;
}

export function runCauses({ cosmos, camera, rig }) {
  const st = S.world1.stations[1];
  const group = new THREE.Group(); cosmos.root.add(group);
  const nodes = [], labels = [];
  // the chain reads in the player's direction: right-to-left in Arabic, left-to-right in English
  const DIR = new THREE.Vector3(i18n.dir === 'rtl' ? -1 : 1, 0.1, -0.32).normalize();
  const side = -Math.sign(DIR.x);
  // in English the chain runs left-to-right, so it starts further out to stay clear of the sun
  const ORIGIN = i18n.dir === 'rtl' ? CHAIN_ORIGIN.clone() : CHAIN_ORIGIN.clone().add(new THREE.Vector3(-24, 0, 0));
  const nodePos = (k) => ORIGIN.clone().addScaledVector(DIR, STEP * k);
  const v = new THREE.Vector3();

  return new Promise((resolve) => {
    // the orb glides beside the flower; the camera frames it
    gsap.to(cosmos.orb.anchor.position, { x: ORIGIN.x + side * 2.6, y: ORIGIN.y - 0.2, z: ORIGIN.z + 0.4, duration: 3.2, ease: 'power2.inOut' });
    rig.flyTo({ pos: ORIGIN.clone().add(new THREE.Vector3(side * 0.6, 1.1, 8.2)), look: ORIGIN.clone().add(new THREE.Vector3(side * 0.9, 0.1, 0)), duration: 3.4, fov: 46 });

    const addNode = (k) => {
      const n = buildNode(k, cosmos.GLOW);
      n.position.copy(nodePos(k));
      n.scale.setScalar(0.001);
      group.add(n); nodes.push(n);
      gsap.to(n.scale, { x: 1, y: 1, z: 1, duration: 1.1, ease: 'back.out(1.7)' });
      if (k > 0) group.add(threadBetween(nodePos(k - 1), nodePos(k), '#bff5ec'));
      const label = h('div', { class: 'node-label' }, t(st.chain[k]));
      root().append(label); labels.push({ el: label, k });
      gsap.fromTo(label, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.4 });
      audio.soft();
    };

    const stopUpdate = cosmos.addUpdater((dt, tt) => {
      nodes.forEach((n, i) => { n.rotation.y += dt * 0.35; n.position.y = nodePos(i).y + Math.sin(tt * 0.9 + i) * 0.08; n.userData.anim?.(dt); });
      labels.forEach(({ el, k }) => {
        v.copy(nodes[k].position); v.y -= 1.25; v.project(camera);
        if (v.z > 1) { el.style.opacity = 0; return; }
        el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%)`;
      });
    });

    setTimeout(async () => {
      addNode(0);
      const intro = ui.caption(st.intro);
      const instr = ui.instruction(st.instruction);
      const btnWrap = h('div', { class: 'bottom-cta', style: { bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' } });
      const btn = h('button', { class: 'btn btn-aqua-ghost', style: { background: 'var(--glass-strong)' } }, t(st.chain_button));
      btnWrap.append(btn); root().append(btnWrap);
      gsap.fromTo(btnWrap, { opacity: 0 }, { opacity: 1, duration: 0.8 });
      let k = 0;
      btn.addEventListener('click', async function step() {
        intro.done();
        k++;
        if (k < st.chain.length) {
          addNode(k);
          store.log('chain_step', { k });
          // pull back so the whole chain stays in frame
          const mid = ORIGIN.clone().lerp(nodePos(k), 0.5);
          rig.flyTo({ pos: mid.clone().add(new THREE.Vector3(side * 0.6, 1.2 + k * 0.35, 8.2 + k * 2.3)), look: mid, duration: 1.8, ease: 'power2.out' });
          return;
        }
        btn.removeEventListener('click', step);
        await hide(btnWrap); instr.done();
        // the chain reaches into darkness
        const last = nodePos(st.chain.length - 1);
        for (let s = 1; s <= 3; s++) {
          const a = last.clone().addScaledVector(DIR, STEP * (s - 1)), b = last.clone().addScaledVector(DIR, STEP * s);
          const th = threadBetween(a, b, '#bff5ec'); th.material.opacity = 0.7 / s; group.add(th);
          await new Promise((r) => setTimeout(r, 450));
        }
        await ui.caption(st.chain_end, 3.6);
        await ui.caption(st.success, 3.0);
        stopUpdate();
        labels.forEach(({ el }) => hide(el));
        resolve(() => { // cleanup once the camera has left the chain
          setTimeout(() => { cosmos.root.remove(group); group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); }, 4500);
        });
      });
    }, 2600);
  });
}
