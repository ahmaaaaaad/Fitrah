// Discovery gestures (the player interacts with attention, never with divine power):
//   TRACE   follow a phenomenon that is already moving (the current, the first water)
//   REVEAL  a lens of attention through the rain, to see what was beneath it
//   CONNECT follow a relationship between things that are already there
//   ALIGN   keep the observation field on a cloud as it thins by itself
// Each gesture only changes what the player attends to (the camera, the knot of
// light, the lens). The world keeps its own time; it never obeys the gesture.
import * as THREE from 'three';
import { isDirect } from '../../core/device.js';

const _v = new THREE.Vector3();
export function project(camera, world, out = {}) {
  _v.copy(world).project(camera);
  out.x = (_v.x * 0.5 + 0.5) * window.innerWidth;
  out.y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
  out.visible = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
  return out;
}
// how close the pointer must be: a fingertip covers more than a cursor and hides what it touches
const tol = () => (isDirect() ? Math.max(64, Math.min(window.innerWidth, window.innerHeight) * 0.09) : Math.max(56, Math.min(window.innerWidth, window.innerHeight) * 0.075));

// ------------------------------------------------------------------ the instrument: where attention is focused
export function createAttention() {
  const el = document.createElement('div'); el.className = 'attn'; el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  const st = { x: -100, y: -100, tx: -100, ty: -100, mode: 'dot', shown: false, near: false, radius: 0 };
  return {
    el, st,
    moveTo(x, y) { st.tx = x; st.ty = y; if (!st.shown) { st.x = x; st.y = y; } },
    show(on) { st.shown = on; },
    set(mode, near = false, radius = 0) { st.mode = mode; st.near = near; st.radius = radius; },
    update(dt) {
      const k = 1 - Math.exp(-dt * 22);
      st.x += (st.tx - st.x) * k; st.y += (st.ty - st.y) * k;
      el.style.transform = `translate(${st.x.toFixed(1)}px, ${st.y.toFixed(1)}px)`;
      el.className = `attn ${st.mode}${st.shown ? ' on' : ''}${st.near ? ' near' : ''}`;
      if (st.radius) { el.style.width = el.style.height = `${st.radius * 2}px`; el.style.margin = `${-st.radius}px 0 0 ${-st.radius}px`; }
      else { el.style.width = el.style.height = ''; el.style.margin = ''; }
    },
  };
}

// ------------------------------------------------------------------ TRACE
/** Follow a moving point along `curve`. It advances at its own pace only while attention keeps up with it. */
export function createTrace({ camera, curve, speed, attention, onAdvance, limit = () => 1 }) {
  const L = curve.getLength();
  const s = { kind: 'trace', u: 0, pressed: false, x: 0, y: 0, near: false, held: 0, everNear: false, assist: false, done: false };
  const head = new THREE.Vector3(), p = {}, q = new THREE.Vector3();
  let resolveDone; const done = new Promise((r) => { resolveDone = r; });
  function distToCurve(x, y) {
    let best = 1e9;
    for (let i = 0; i <= 24; i++) {
      const u = Math.min(1, Math.max(0, s.u - 0.03 + (i / 24) * 0.2));
      curve.getPointAt(u, q); project(camera, q, p);
      if (!p.visible) continue;
      best = Math.min(best, Math.hypot(p.x - x, p.y - y));
    }
    return best;
  }
  return {
    s, done, head,
    onDown(x, y) { s.pressed = true; s.x = x; s.y = y; },
    onMove(x, y, pressed) { s.x = x; s.y = y; s.pressed = pressed; },
    onUp() { s.pressed = false; },
    update(dt) {
      if (s.done) return;
      curve.getPointAt(s.u, head);
      const hp = project(camera, head, {});
      if (s.assist) { s.x += (hp.x - s.x) * Math.min(1, dt * 6); s.y += (hp.y - s.y) * Math.min(1, dt * 6); }
      s.near = (s.pressed || s.assist) && distToCurve(s.x, s.y) < tol();
      // attention can follow the phenomenon only as far as it has actually gone
      if (s.near) { s.everNear = true; s.held += dt; s.u = Math.min(1, limit(), s.u + (speed * dt) / L); }
      attention.moveTo(s.x, s.y); attention.show(s.pressed || s.assist); attention.set('trace', s.near);
      onAdvance?.(s.u, head, s.near);
      if (s.u >= 1) { s.done = true; attention.show(false); resolveDone(); }
    },
    headScreen: () => project(camera, head, {}),
  };
}

// ------------------------------------------------------------------ REVEAL
/** A lens of attention through an obscuring layer: the rain veil clears where the player looks through it. */
export function createReveal({ scene, attention, target = 0.32, attendSeconds = 6 }) {
  const W = 192, H = 108;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const mask = new THREE.CanvasTexture(canvas); mask.minFilter = THREE.LinearFilter; mask.magFilter = THREE.LinearFilter;
  const uniforms = { uMask: { value: mask }, uVeil: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 } };
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMask; uniform float uVeil, uTime, uAspect; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float m = texture2D(uMask, vUv).r;
        vec2 p = vec2(vUv.x * uAspect, vUv.y);
        float streaks = n(vec2(p.x * 160.0, p.y * 6.0 + uTime * 9.0)) * n(vec2(p.x * 60.0 + 3.0, p.y * 3.0 + uTime * 6.0));
        float mist = n(p * 3.0 + vec2(uTime * 0.05, 0.0)) * 0.5 + n(p * 9.0 - uTime * 0.08) * 0.25;
        vec3 col = mix(vec3(0.42, 0.45, 0.49), vec3(0.58, 0.61, 0.65), mist) + streaks * 0.2;
        float a = uVeil * (0.58 + 0.22 * mist) * (1.0 - smoothstep(0.1, 0.8, m));
        float rim = smoothstep(0.1, 0.4, m) * (1.0 - smoothstep(0.4, 0.8, m)) * uVeil;  // the edge of the lens
        col += vec3(0.95, 0.85, 0.65) * rim * 0.18;
        gl_FragColor = vec4(col, max(a, rim * 0.1));
      }`,
    transparent: true, depthTest: false, depthWrite: false,
  }));
  veil.frustumCulled = false; veil.renderOrder = 100;
  scene.add(veil);
  // where attention looks through the rain, the scene is a little clearer and warmer (a lens, not a light source)
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`uniform sampler2D uMask; uniform float uVeil; varying vec2 vUv;
      void main(){ float m = smoothstep(0.15, 0.9, texture2D(uMask, vUv).r) * uVeil; gl_FragColor = vec4(vec3(0.09, 0.08, 0.06) * m, 1.0); }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  lens.frustumCulled = false; lens.renderOrder = 101;
  scene.add(lens);
  const s = { kind: 'reveal', active: false, pressed: false, x: 0, y: 0, lx: null, ly: null, coverage: 0, attended: 0, assist: false, done: false, show: 0, t: 0 };
  let resolveDone, done = null;
  let clock = 0;
  function paint(x, y) {
    const mx = (x / window.innerWidth) * W, my = (y / window.innerHeight) * H;
    const r = W * 0.13;
    const steps = s.lx === null ? 1 : Math.max(1, Math.ceil(Math.hypot(mx - s.lx, my - s.ly) / (r * 0.3)));
    for (let i = 1; i <= steps; i++) {
      const px = s.lx === null ? mx : s.lx + (mx - s.lx) * (i / steps), py = s.ly === null ? my : s.ly + (my - s.ly) * (i / steps);
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(0.6, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
    s.lx = mx; s.ly = my;
  }
  return {
    s, uniforms, veil,
    begin() { s.active = true; s.done = false; s.attended = 0; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); mask.needsUpdate = true; done = new Promise((r) => { resolveDone = r; }); return done; },
    end() { s.active = false; },
    onDown(x, y) { s.pressed = true; s.x = x; s.y = y; s.lx = null; s.ly = null; if (s.active) paint(x, y); },
    // paint on every pointer event, so a quick stroke is seen whole even between frames
    onMove(x, y, pressed) { s.x = x; s.y = y; s.pressed = pressed; if (pressed && s.active) { paint(x, y); mask.needsUpdate = true; } },
    onUp() { s.pressed = false; s.lx = null; },
    update(dt) {
      s.t += dt; uniforms.uTime.value = s.t;
      uniforms.uAspect.value = window.innerWidth / window.innerHeight;
      s.show += ((s.active ? 1 : 0) - s.show) * (1 - Math.exp(-dt * (s.active ? 1.2 : 0.6)));
      uniforms.uVeil.value = s.show;
      veil.visible = lens.visible = s.show > 0.003;
      if (!s.active) return;
      if (s.assist) { // keyboard / assist: the lens drifts slowly across the scene
        s.x = window.innerWidth * (0.5 + 0.3 * Math.sin(s.t * 0.9)); s.y = window.innerHeight * (0.6 + 0.15 * Math.sin(s.t * 1.7));
      }
      if (s.pressed || s.assist) paint(s.x, s.y); // holding still keeps the lens open where it rests
      // the mist slowly closes again: attention has to keep looking
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 0.15)})`; ctx.fillRect(0, 0, W, H);
      if (s.pressed || s.assist) s.attended += dt;
      mask.needsUpdate = true;
      clock -= dt;
      if (clock <= 0) {
        clock = 0.2;
        const d = ctx.getImageData(W * 0.1, H * 0.1, W * 0.8, H * 0.8).data;
        let sum = 0; for (let i = 0; i < d.length; i += 16) sum += d[i];
        s.coverage = sum / (d.length / 16) / 255;
        // enough has been seen: a wide look through the rain, or a long enough one
        if (!s.done && (s.coverage >= target || s.attended >= attendSeconds)) { s.done = true; resolveDone?.(); }
      }
      attention.moveTo(s.x, s.y); attention.show(s.pressed || s.assist); attention.set('lens', false, Math.min(window.innerWidth, window.innerHeight) * 0.1);
    },
  };
}

// ------------------------------------------------------------------ CONNECT
/** Follow a relationship from one thing to the next. Nodes are things already in the world. */
export function createConnect({ camera, nodes, attention, onLink }) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'connect'); svg.setAttribute('aria-hidden', 'true');
  document.body.append(svg);
  const lines = nodes.slice(1).map(() => { const l = document.createElementNS(NS, 'line'); l.setAttribute('class', 'thread'); svg.append(l); return l; });
  const live = document.createElementNS(NS, 'line'); live.setAttribute('class', 'thread live'); svg.append(live);
  const dots = nodes.map(() => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('class', 'node'); svg.append(c); return c; });
  const s = { kind: 'connect', linked: 0, pressed: false, x: 0, y: 0, dragging: false, assist: false, assistT: 0, done: false };
  const scr = nodes.map(() => ({}));
  let resolveDone; const done = new Promise((r) => { resolveDone = r; });
  return {
    s, done,
    onDown(x, y) {
      s.pressed = true; s.x = x; s.y = y;
      const from = scr[s.linked];
      s.dragging = from && Math.hypot(from.x - x, from.y - y) < tol() * 1.2;
    },
    onMove(x, y, pressed) { s.x = x; s.y = y; s.pressed = pressed; },
    onUp() { s.pressed = false; s.dragging = false; },
    update(dt) {
      nodes.forEach((n, i) => project(camera, n.world, scr[i]));
      if (s.assist && !s.done) { s.assistT += dt; if (s.assistT > 1.1) { s.assistT = 0; s.linked++; onLink?.(s.linked, nodes[s.linked]); } }
      if (s.dragging && s.linked < nodes.length - 1) {
        const nx = scr[s.linked + 1];
        if (Math.hypot(nx.x - s.x, nx.y - s.y) < tol()) { s.linked++; onLink?.(s.linked, nodes[s.linked]); }
      }
      const r = isDirect() ? 12 : 9; // a little larger under a finger
      dots.forEach((d, i) => {
        d.setAttribute('cx', scr[i].x.toFixed(1)); d.setAttribute('cy', scr[i].y.toFixed(1)); d.setAttribute('r', r);
        d.setAttribute('class', `node${i <= s.linked ? ' lit' : ''}${i === s.linked + 1 ? ' next' : ''}${i === s.linked && !s.done ? ' from' : ''}`);
      });
      lines.forEach((l, i) => {
        const a = scr[i], b = scr[i + 1], on = i < s.linked;
        l.setAttribute('x1', a.x); l.setAttribute('y1', a.y); l.setAttribute('x2', on ? b.x : a.x); l.setAttribute('y2', on ? b.y : a.y);
        l.setAttribute('class', `thread${on ? ' on' : ''}`);
      });
      const from = scr[s.linked];
      if (s.dragging && !s.done) { live.setAttribute('x1', from.x); live.setAttribute('y1', from.y); live.setAttribute('x2', s.x); live.setAttribute('y2', s.y); live.style.opacity = 1; }
      else live.style.opacity = 0;
      attention.moveTo(s.x, s.y); attention.show(s.pressed); attention.set('trace', s.dragging);
      if (!s.done && s.linked >= nodes.length - 1) { s.done = true; s.dragging = false; resolveDone(); }
    },
    remove() { svg.classList.add('out'); setTimeout(() => svg.remove(), 1500); },
    screens: () => scr.map((p) => ({ x: p.x, y: p.y, visible: p.visible })),
  };
}

// ------------------------------------------------------------------ ALIGN
/** Keep the observation field on something that is changing by itself (a cloud thinning as it drifts). */
export function createAlign({ camera, target, attention, need = 5 }) {
  const s = { kind: 'align', pressed: false, x: window.innerWidth / 2, y: window.innerHeight / 3, held: 0, aligned: false, assist: false, done: false };
  let resolveDone; const done = new Promise((r) => { resolveDone = r; });
  const p = {};
  return {
    s, done,
    onDown(x, y) { s.pressed = true; s.x = x; s.y = y; },
    onMove(x, y, pressed) { s.x = x; s.y = y; s.pressed = pressed; },
    onUp() { s.pressed = false; },
    radius: () => Math.min(window.innerWidth, window.innerHeight) * 0.13,
    update(dt) {
      if (s.done) return;
      project(camera, target(), p);
      if (s.assist) { s.x += (p.x - s.x) * Math.min(1, dt * 1.5); s.y += (p.y - s.y) * Math.min(1, dt * 1.5); }
      const R = Math.min(window.innerWidth, window.innerHeight) * 0.13;
      s.aligned = (s.pressed || s.assist) && p.visible && Math.hypot(p.x - s.x, p.y - s.y) < R * 0.85;
      s.held = s.aligned ? s.held + dt : Math.max(0, s.held - dt * 0.35);
      attention.moveTo(s.x, s.y); attention.show(s.pressed || s.assist); attention.set('aperture', s.aligned, R);
      if (s.held >= need) { s.done = true; attention.show(false); resolveDone(); }
    },
    progress: () => Math.min(1, s.held / need),
    targetScreen: () => project(camera, target(), {}),
  };
}
