// Chapter 1's interaction: CONNECT. The player follows "what came before" from
// their own light: their parents, those before them, the earth, the sun, the
// stars — each link lights, each thing is named, and each one "had a beginning".
// The last link reaches into the dark and finds nothing there that explains
// itself. The player discovers the argument with their hand; Dalil names it after.
//
// The player never makes anything here: the things are already in the hall,
// the gesture only follows the relationship between them.
import * as THREE from 'three';
import { isDirect } from '../../core/device.js';
import { glowSprite } from './chamber.js';
import { PLAYER_LIGHT } from './chamber.js';

const BASE = [
  PLAYER_LIGHT.clone(),                 // you
  new THREE.Vector3(-1.25, 1.55, 3.9),  // your parents
  new THREE.Vector3(1.0, 2.1, 1.7),     // those before them
  new THREE.Vector3(-1.5, 2.75, -0.7),  // the earth
  new THREE.Vector3(1.35, 3.45, -3.1),  // the sun
  new THREE.Vector3(-0.7, 4.25, -5.7),  // the stars
  new THREE.Vector3(1.7, 6.1, -9.2),    // ?  (well apart from the stars on screen: it must be reached for)
];
/** The chain's points; flip = -1 mirrors it left to right. */
export const chainPositions = (flip = 1) => BASE.map((p) => new THREE.Vector3(p.x * flip, p.y, p.z));
export const CHAIN_POS = chainPositions(1);

const tol = () => (isDirect() ? Math.max(64, Math.min(window.innerWidth, window.innerHeight) * 0.09) : Math.max(54, Math.min(window.innerWidth, window.innerHeight) * 0.07));
const PER = 40; // points per thread

const threadVS = /* glsl */`attribute float aSeg; attribute float aT; uniform float uProg[6]; uniform float uTime, uI, uScale, uGuide, uGuideI; varying float vA;
void main(){
  int s = int(aSeg + 0.5); float prog = 0.0;
  for (int i = 0; i < 6; i++) if (i == s) prog = uProg[i];
  float shown = step(aT, prog);
  float flow = fract(aT * 2.0 - uTime * 0.5 + aSeg * 0.37);
  // the way to go: the next segment shows faintly ahead of the player, with a pulse running toward the destination
  float guide = (1.0 - shown) * step(abs(aSeg - uGuide), 0.1) * uGuideI;
  float pd = (aT - fract(uTime * 0.42)) * 6.0; float pulse = exp(-pd * pd);
  vA = shown * uI * (0.5 + 0.5 * pow(flow, 4.0)) + guide * (0.16 + 0.55 * pulse);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uScale * (0.7 + 0.6 * pow(flow, 4.0) * shown + 0.4 * guide * pulse) / max(0.6, -mv.z);
  gl_Position = projectionMatrix * mv; }`;
const threadFS = /* glsl */`uniform vec3 uColor; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float g = (1.0 - smoothstep(0.0, 1.0, r)) * vA; if (g < 0.003) discard; gl_FragColor = vec4(uColor * g, g); }`;

/**
 * @param {object} o
 * @param {THREE.Scene} o.scene
 * @param {THREE.Camera} o.camera
 * @param {(i:number) => void} o.onLink   called when node i is linked (1..6)
 * @param {(i:number) => void} o.onShow   called when node i appears
 */
export function createChain({ scene, camera, onLink, onShow, mirror: flip = 1 }) {
  const group = new THREE.Group(); group.name = 'chain'; scene.add(group);
  const n = CHAIN_POS.length;
  // the chain bends away from the side Dalil stands on, so he never hides it
  const CP = chainPositions(flip);
  // the things, as lights in the hall (node 0 is the player's own light, drawn by the chamber)
  const nodes = CP.map((p, i) => {
    const g = new THREE.Group(); g.position.copy(p);
    const last = i === n - 1;
    const halo = glowSprite(last ? '#aab6ff' : '#e6ebff', last ? 1.3 : 0.95, 0), core = glowSprite('#ffffff', last ? 0.1 : 0.2, 0);
    const mirror = glowSprite('#e6ebff', 0.7, 0); mirror.position.y = -p.y * 2;
    if (i > 0) { g.add(halo, core, mirror); group.add(g); }
    return { g, halo, core, mirror, shown: i === 0 ? 1 : 0, shownT: i === 0 ? 1 : 0, lit: i === 0 ? 1 : 0, litT: i === 0 ? 1 : 0, last };
  });

  // threads of light between them (and their reflection in the floor)
  const pos = new Float32Array((n - 1) * PER * 3), seg = new Float32Array((n - 1) * PER), tt = new Float32Array((n - 1) * PER);
  for (let s = 0; s < n - 1; s++) for (let k = 0; k < PER; k++) {
    const i = s * PER + k, u = k / (PER - 1), a = CP[s], b = CP[s + 1];
    pos[i * 3] = a.x + (b.x - a.x) * u; pos[i * 3 + 1] = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * 0.12; pos[i * 3 + 2] = a.z + (b.z - a.z) * u;
    seg[i] = s; tt[i] = u;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeg', new THREE.BufferAttribute(seg, 1)); geo.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
  const uniforms = { uProg: { value: new Array(6).fill(0) }, uTime: { value: 0 }, uI: { value: 1 }, uScale: { value: 50 }, uColor: { value: new THREE.Color('#ffd79a') }, uGuide: { value: 0 }, uGuideI: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: threadVS, fragmentShader: threadFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const threads = new THREE.Points(geo, mat); threads.frustumCulled = false; threads.renderOrder = 6; group.add(threads);
  const mUniforms = { ...uniforms, uI: { value: 0.3 }, uGuideI: { value: 0 } };
  const mirror = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: mUniforms, vertexShader: threadVS, fragmentShader: threadFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  mirror.scale.y = -1; mirror.frustumCulled = false; group.add(mirror);
  const prog = new Array(6).fill(0), progT = new Array(6).fill(0);

  // the screen layer: where to start, where to go, and the thread under the finger
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'connect'); svg.setAttribute('aria-hidden', 'true');
  const liveLine = document.createElementNS(NS, 'line'); liveLine.setAttribute('class', 'thread live');
  const fromDot = document.createElementNS(NS, 'circle'); fromDot.setAttribute('class', 'node from');
  const nextDot = document.createElementNS(NS, 'circle'); nextDot.setAttribute('class', 'node next');
  svg.append(liveLine, fromDot, nextDot);
  document.body.append(svg);

  const s = { linked: 0, pressed: false, dragging: false, x: 0, y: 0, done: false, open: 0, everDragged: false, lastLinkAt: performance.now(), active: true, travel: 0 };
  const scr = CP.map(() => ({ x: 0, y: 0, visible: false }));
  const _v = new THREE.Vector3();
  let resolveDone; const done = new Promise((r) => { resolveDone = r; });

  function show(i) { if (i < n && !nodes[i].shown) { nodes[i].shown = 1; nodes[i].at = performance.now(); s.travel = 0; onShow?.(i); } }
  show(1);
  function link() {
    if (s.done || s.linked >= n - 1) return;
    s.linked++;
    s.lastLinkAt = performance.now();
    prog[s.linked - 1] = 1;
    const last = s.linked === n - 1;
    nodes[s.linked].bloom = 1;
    if (!last) { nodes[s.linked].lit = 1; show(s.linked + 1); }
    onLink?.(s.linked);
    if (last) { s.done = true; s.dragging = false; resolveDone(); }
  }

  return {
    s, done, nodes, positions: CP,
    link,
    onDown(x, y) {
      if (!s.active) return false;
      s.pressed = true; s.x = x; s.y = y;
      const from = scr[s.linked];
      s.dragging = !s.done && from.visible && Math.hypot(from.x - x, from.y - y) < tol() * 1.2;
      if (s.dragging) s.everDragged = true;
      return s.dragging;
    },
    onMove(x, y, pressed) { if (s.dragging) s.travel += Math.hypot(x - s.x, y - s.y); s.x = x; s.y = y; s.pressed = pressed; if (!pressed) s.dragging = false; },
    onUp() { s.pressed = false; s.dragging = false; },
    /** world points to keep on screen now: the recent links and the next thing */
    framePoints(all = false) {
      // on a small screen fewer things share the frame, so they stand further apart under a finger
      const span = Math.min(window.innerWidth, window.innerHeight) < 500 ? 2 : 4;
      const hi = Math.min(n - 1, s.linked + 1), lo = all ? 0 : Math.max(0, hi - span);
      return CP.slice(lo, hi + 1);
    },
    update(dt, t) {
      uniforms.uTime.value = t; uniforms.uScale.value = window.innerHeight * 0.045;
      const k = 1 - Math.exp(-dt * 2.4);
      for (let i = 0; i < 6; i++) { progT[i] += (prog[i] - progT[i]) * (1 - Math.exp(-dt * 3.0)); uniforms.uProg.value[i] = progT[i]; }
      nodes.forEach((nd, i) => {
        nd.shownT += (nd.shown - nd.shownT) * k; nd.litT += (nd.lit - nd.litT) * k;
        if (i === 0) return;
        const flick = nd.last ? (0.55 + 0.45 * Math.sin(t * 5.3) * Math.sin(t * 1.7)) * (1 - s.open * 0.6) : 1;
        nd.halo.material.color.set(nd.last ? '#aab6ff' : '#e6ebff').lerp(_c.set('#f6c77d'), nd.litT);
        nd.halo.material.opacity = nd.shownT * (nd.last ? 0.45 : 0.55 + nd.litT * 0.35) * flick;
        nd.core.material.opacity = nd.shownT * (nd.last ? 0.35 : 0.6 + nd.litT * 0.4) * flick;
        nd.mirror.material.opacity = nd.shownT * 0.18 * (nd.last ? 0.5 : 1);
        nd.mirror.material.color.copy(nd.halo.material.color);
        nd.bloom = (nd.bloom || 0) * Math.exp(-dt * 1.8);
        nd.g.scale.setScalar(1 + (nd.last ? s.open * 0.25 * Math.sin(t * 2) : 0) + nd.bloom * 0.9);
      });
      if (s.done) s.open = Math.min(1, s.open + dt * 0.6);
      // screen layer
      CP.forEach((p, i) => { _v.copy(p).project(camera); scr[i].x = (_v.x * 0.5 + 0.5) * window.innerWidth; scr[i].y = (-_v.y * 0.5 + 0.5) * window.innerHeight; scr[i].visible = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05; });
      // the guide: the next segment, shown once the thing it leads to is there
      const nxtNode = nodes[s.linked + 1];
      uniforms.uGuide.value = s.linked;
      const wantGuide = s.active && !s.done && nxtNode && nxtNode.shownT > 0.5 ? (s.dragging ? 1.3 : 1) : 0;
      uniforms.uGuideI.value += (wantGuide - uniforms.uGuideI.value) * (1 - Math.exp(-dt * 3));
      if (s.active && s.dragging && !s.done) {
        const nx = scr[s.linked + 1];
        const nn = nodes[s.linked + 1], cur = scr[s.linked];
        // how far along the path the hand has come (projected onto the segment on screen)
        const ex = nx.x - cur.x, ey = nx.y - cur.y, len2 = Math.max(1, ex * ex + ey * ey);
        const u = Math.max(0, Math.min(1, ((s.x - cur.x) * ex + (s.y - cur.y) * ey) / len2));
        const off = Math.abs((s.x - cur.x) * ey - (s.y - cur.y) * ex) / Math.sqrt(len2);
        if (nn.shownT > 0.5 && off < tol() * 1.5) prog[s.linked] = Math.max(prog[s.linked] * 0.98, u * 0.96);
        const dNext = Math.hypot(nx.x - s.x, nx.y - s.y), dCur = Math.hypot(cur.x - s.x, cur.y - s.y);
        // reached for, not stumbled on: the thing is there, the hand has moved since it appeared, and is nearer to it than to where it started
        if (nx.visible && nn.shownT > 0.6 && performance.now() - (nn.at || 0) > 450 && s.travel > 18 && dNext < tol() && dNext < dCur * 0.8) link();
      } else if (!s.done && s.linked < n - 1 && prog[s.linked] < 1) {
        prog[s.linked] *= Math.exp(-dt * 1.5); // let go early: the path waits, the light recedes
      }
      const r = isDirect() ? 14 : 10;
      const f = scr[s.linked], nx = scr[Math.min(n - 1, s.linked + 1)];
      const on = s.active && !s.done;
      fromDot.setAttribute('cx', f.x.toFixed(1)); fromDot.setAttribute('cy', f.y.toFixed(1)); fromDot.setAttribute('r', r + 4); fromDot.style.opacity = on ? 1 : 0;
      nextDot.setAttribute('cx', nx.x.toFixed(1)); nextDot.setAttribute('cy', nx.y.toFixed(1)); nextDot.setAttribute('r', r); nextDot.style.opacity = on && nodes[s.linked + 1]?.shownT > 0.5 ? 1 : 0;
      if (s.dragging && on) { liveLine.setAttribute('x1', f.x); liveLine.setAttribute('y1', f.y); liveLine.setAttribute('x2', s.x); liveLine.setAttribute('y2', s.y); liveLine.style.opacity = 1; }
      else liveLine.style.opacity = 0;
    },
    screens: () => scr.map((p) => ({ ...p })),
    /** fade the threads (the argument has been made; the answer comes next) */
    dim(v = 0.25) { uniforms.uI.value = v; mUniforms.uI.value = v * 0.3; },
    stop() { s.active = false; s.dragging = false; },
    remove() {
      s.active = false;
      svg.classList.add('out'); setTimeout(() => svg.remove(), 1500);
      scene.remove(group);
      geo.dispose(); mat.dispose();
    },
  };
}
const _c = new THREE.Color();
