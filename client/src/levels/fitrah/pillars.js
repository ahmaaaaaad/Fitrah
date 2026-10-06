// Chapter 3's interaction: INSPECT. Five columns of light stand in a shallow arc
// facing the player, in reading order. Each one waits, dim, until the player
// chooses it; then it lights, and a small motif of its own appears around it:
//   Shahadah  one light above the column (oneness)
//   Salah     five rings along the column (five prayers)
//   Zakah     motes drifting outward from it (giving)
//   Sawm      a thin crescent above it (the month of Ramadan)
//   Hajj      motes circling its base (the pilgrims around the House)
// When all five have been met, an arc of light joins their tops and a band joins
// their bases: five pillars, one building. Motifs are symbols, never depictions.
import * as THREE from 'three';
import { glowSprite, PILLAR_POS } from './chamber.js';

const H = 5.6;
const COL_VS = /* glsl */`varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const COL_FS = /* glsl */`uniform vec3 uColor; uniform float uI, uTime, uSeed, uRise; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){
    if (vUv.y > uRise) discard;
    float core = pow(abs(dot(vN, vV)), 2.0);
    float flow = 0.75 + 0.25 * sin(vUv.y * 22.0 - uTime * 1.4 + uSeed * 6.0);
    float ends = smoothstep(0.0, 0.05, vUv.y) * (0.55 + 0.45 * smoothstep(1.0, 0.85, vUv.y));
    float a = (0.25 + core * 0.9) * flow * ends * uI;
    gl_FragColor = vec4(uColor * a, a); }`;

export function createPillars(scene) {
  const group = new THREE.Group(); group.name = 'pillars'; scene.add(group);
  const pillars = PILLAR_POS.map((p, i) => {
    const g = new THREE.Group(); g.position.copy(p); group.add(g);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#ffd79a') }, uI: { value: 0 }, uTime: { value: 0 }, uSeed: { value: i * 0.37 }, uRise: { value: 0 } },
      vertexShader: COL_VS, fragmentShader: COL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, H, 24, 1, true), mat); col.position.y = H / 2; g.add(col);
    const mirror = new THREE.Mesh(col.geometry, mat); mirror.position.y = -H / 2; mirror.scale.y = -1; g.add(mirror);
    const base = glowSprite('#ffcf86', 1.6, 0); base.position.y = 0.05; base.scale.set(1.6, 0.5, 1); g.add(base);
    const cap = glowSprite('#fff0d2', 0.9, 0); cap.position.y = H; g.add(cap);
    // the motif
    const motif = new THREE.Group(); g.add(motif);
    const sprites = [];
    if (i === 0) { const s = glowSprite('#ffffff', 0.55, 0); s.position.y = H + 0.6; motif.add(s); sprites.push(s); }
    if (i === 1) for (let k = 0; k < 5; k++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.37, 48), new THREE.MeshBasicMaterial({ color: '#ffe0a8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 1.0 + k * 0.95; motif.add(ring); sprites.push(ring);
    }
    if (i === 2 || i === 4) for (let k = 0; k < (i === 2 ? 22 : 16); k++) { const s = glowSprite('#ffe7b8', 0.12, 0); s.userData.k = k; motif.add(s); sprites.push(s); }
    if (i === 3) {
      const cres = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.42, 48, 1, Math.PI * 0.18, Math.PI * 1.1), new THREE.MeshBasicMaterial({ color: '#fff0d2', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cres.position.y = H + 0.65; cres.rotation.z = -0.5; motif.add(cres); sprites.push(cres);
    }
    return { g, mat, col, base, cap, motif, sprites, state: 0, lit: 0, rise: 0, focus: 0, focusT: 0, shown: 0 };
  });
  // the joining: an arc over the tops and a band along the bases
  const tops = new THREE.CatmullRomCurve3(PILLAR_POS.map((p) => p.clone().setY(H + 0.05)));
  const arcMat = new THREE.MeshBasicMaterial({ color: '#ffd28a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const roof = new THREE.Mesh(new THREE.TubeGeometry(tops, 80, 0.045, 8), arcMat); group.add(roof);
  const bases = new THREE.CatmullRomCurve3(PILLAR_POS.map((p) => p.clone().setY(0.03)));
  const band = new THREE.Mesh(new THREE.TubeGeometry(bases, 80, 0.06, 8), arcMat.clone()); group.add(band);
  let joined = 0, joinedT = 0, visible = 0, visibleT = 0;
  const tmp = new THREE.Vector3();

  return {
    group, positions: PILLAR_POS, height: H,
    /** rise from the floor (staggered), or sink away */
    show(on = true) { visible = on ? 1 : 0; pillars.forEach((p, i) => { p.shown = on ? 1 : 0; p.delay = i * 0.35; }); },
    /** the pillar the player is invited to choose next */
    focus(i) { pillars.forEach((p, k) => { p.focus = k === i ? 1 : 0; }); },
    light(i) { if (pillars[i]) pillars[i].lit = 1; },
    isLit: (i) => !!pillars[i]?.lit,
    litCount: () => pillars.filter((p) => p.lit).length,
    join() { joined = 1; },
    /** world point of a pillar's middle, for picking and labels */
    middle(i, out = new THREE.Vector3()) { return out.copy(PILLAR_POS[i]).setY(H * 0.45); },
    top(i, out = new THREE.Vector3()) { return out.copy(PILLAR_POS[i]).setY(H + 0.2); },
    /** which pillar (if any) is under a screen point */
    pick(x, y, camera) {
      let best = -1, bd = 1e9;
      for (let i = 0; i < pillars.length; i++) {
        tmp.copy(PILLAR_POS[i]).setY(0).project(camera); const bx = (tmp.x * 0.5 + 0.5) * innerWidth, by = (-tmp.y * 0.5 + 0.5) * innerHeight;
        tmp.copy(PILLAR_POS[i]).setY(H).project(camera); const tx = (tmp.x * 0.5 + 0.5) * innerWidth, ty = (-tmp.y * 0.5 + 0.5) * innerHeight;
        if (y < Math.min(ty, by) - 30 || y > Math.max(ty, by) + 30) continue;
        const cx = bx + (tx - bx) * Math.max(0, Math.min(1, (y - by) / (ty - by || 1)));
        const d = Math.abs(x - cx);
        if (d < bd) { bd = d; best = i; }
      }
      return bd < Math.max(44, innerWidth * 0.045) ? best : -1;
    },
    update(dt, t) {
      visibleT += (visible - visibleT) * (1 - Math.exp(-dt * 1.2));
      joinedT += (joined - joinedT) * (1 - Math.exp(-dt * 0.8));
      group.visible = visibleT > 0.01;
      pillars.forEach((p, i) => {
        p.delay = Math.max(0, (p.delay || 0) - dt);
        if (!p.delay) p.rise += (p.shown - p.rise) * (1 - Math.exp(-dt * 1.1));
        p.focusT += (p.focus - p.focusT) * (1 - Math.exp(-dt * 2));
        p.state += (p.lit - p.state) * (1 - Math.exp(-dt * 1.6));
        const pulse = p.focusT * (0.5 + 0.5 * Math.sin(t * 2.4));
        p.mat.uniforms.uRise.value = p.rise; p.mat.uniforms.uTime.value = t;
        p.mat.uniforms.uI.value = (0.22 + p.state * 0.85 + pulse * 0.25 + joinedT * 0.2) * visibleT;
        p.mat.uniforms.uColor.value.set('#c9cff2').lerp(_c.set('#ffd28a'), Math.max(p.state, p.focusT * 0.4));
        p.base.material.opacity = (0.15 + p.state * 0.55 + pulse * 0.2) * p.rise;
        p.cap.material.opacity = (0.1 + p.state * 0.8) * (p.rise > 0.95 ? 1 : 0);
        // the motif comes with the light
        const m = p.state * visibleT;
        p.sprites.forEach((s, k) => {
          if (s.isSprite) {
            if (i === 2) { const u = ((t * 0.12 + k / p.sprites.length) % 1); const a = k * 2.4 + t * 0.2; s.position.set(Math.cos(a) * (0.3 + u * 1.3), H * (0.85 - u * 0.6), Math.sin(a) * (0.3 + u * 1.3)); s.material.opacity = m * (1 - u) * 0.9; }
            else if (i === 4) { const a = -t * 0.6 + (k / p.sprites.length) * Math.PI * 2; s.position.set(Math.cos(a) * 0.75, 0.25 + Math.sin(a * 3 + t) * 0.03, Math.sin(a) * 0.75); s.material.opacity = m * 0.8; }
            else s.material.opacity = m * (0.85 + 0.15 * Math.sin(t * 1.7));
          } else s.material.opacity = m * 0.7 * (i === 1 ? (0.75 + 0.25 * Math.sin(t * 1.2 + k)) : 1);
        });
      });
      roof.material.opacity = joinedT * 0.85 * visibleT; band.material.opacity = joinedT * 0.6 * visibleT;
    },
    remove() { scene.remove(group); },
  };
}
const _c = new THREE.Color();
