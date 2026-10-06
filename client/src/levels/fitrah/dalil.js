// Dalil in the Fitrah level: the guide and educator, present from the first frame.
//
//   body   the same small walking light as in The Water (a warm core, a soft halo,
//          footfalls of light), so the player recognises him; here he also lights
//          the floor around him, glances where he means, and can draw an arc of
//          light to what he is pointing at.
//   voice  one line at a time, beside him, each labelled with what kind of text it is;
//          worded for the player's depth and for the device in their hand.
//   ask    the player may ask him anything at any time (tap him, or the Ask button);
//          answers come from reviewed content first, a validated model second.
import * as THREE from 'three';
import { i18n } from '../../core/i18n.js';
import { inputKind } from '../../core/device.js';
import { createDalilAI } from '../../core/dalil/ask.js';
import { CT } from '../../core/sacred/content-types.js';
import { glowSprite, glowTexture } from './chamber.js';
import { createFigure } from '../../core/figures.js';
import { reviewedAnswer, atDepth } from './content.js';
import { buildPrompt, validate } from './dalil-prompt.js';
import { SPEED } from './config.js';

// ---------------------------------------------------------------- shaders (the body's language is The Water's)
const coreVS = /* glsl */`varying vec3 vN; varying vec3 vV;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`;
const coreFS = /* glsl */`uniform float uI; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(1.0 - max(dot(normalize(vN), vV), 0.0), 2.0); vec3 c = mix(vec3(1.25, 0.92, 0.55), vec3(1.0, 0.58, 0.26), f) * uI; gl_FragColor = vec4(c, 1.0); }`;
const haloVS = /* glsl */`uniform float uSize; varying vec2 vUv;
void main(){ vUv = uv; vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(c + (right * position.x + up * position.y) * uSize, 1.0); }`;
const haloFS = /* glsl */`uniform float uI, uPulse; varying vec2 vUv;
void main(){ float r = length(vUv - 0.5) * 2.0; float g = exp(-r * r * 7.0) * 0.22 + exp(-r * r * 52.0) * 0.38; g *= 1.0 - smoothstep(0.85, 1.0, r);
  vec3 c = vec3(1.0, 0.78, 0.46) * g * uI * (0.85 + 0.15 * uPulse); gl_FragColor = vec4(c, g * uI); }`;
const footVS = /* glsl */`attribute vec4 aFoot; uniform float uTime; varying vec2 vUv; varying float vA;
void main(){ vUv = uv; float age = uTime - aFoot.w; vA = clamp(1.0 - age / 2.8, 0.0, 1.0) * step(0.0, age);
  vec3 p = aFoot.xyz + vec3(position.x * 0.16, 0.0, position.y * 0.24) * (0.8 + 0.4 * (1.0 - vA));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`;
const footFS = /* glsl */`varying vec2 vUv; varying float vA;
void main(){ float r = length((vUv - 0.5) * 2.0); float g = (1.0 - smoothstep(0.2, 1.0, r)) * vA; if (g < 0.002) discard; gl_FragColor = vec4(vec3(1.2, 0.9, 0.5) * g * 0.6, g); }`;
const poolFS = /* glsl */`uniform float uI; varying vec2 vUv;
void main(){ float r = length(vUv - 0.5) * 2.0; float g = exp(-r * r * 4.0) * (1.0 - smoothstep(0.7, 1.0, r)) * uI; gl_FragColor = vec4(vec3(1.0, 0.76, 0.45) * g * 0.5, g); }`;
const arcVS = /* glsl */`attribute float aT; uniform float uTime, uI, uScale; varying float vA;
void main(){ float flow = fract(aT - uTime * 0.35); vA = uI * smoothstep(0.0, 0.12, aT) * (0.35 + 0.65 * pow(flow, 6.0));
  vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uScale * (0.6 + 0.8 * pow(flow, 6.0)) / max(0.6, -mv.z); gl_Position = projectionMatrix * mv; }`;
const arcFS = /* glsl */`varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float g = (1.0 - smoothstep(0.0, 1.0, r)) * vA; gl_FragColor = vec4(vec3(1.0, 0.82, 0.55) * g, g); }`;

function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 5; g.shadowColor = 'rgba(255,220,170,1)'; g.shadowBlur = 10;
  g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function createBody(scene) {
  const group = new THREE.Group(); group.name = 'dalil';
  const coreMat = new THREE.ShaderMaterial({ uniforms: { uI: { value: 0 } }, vertexShader: coreVS, fragmentShader: coreFS });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), coreMat);
  const haloMat = new THREE.ShaderMaterial({ uniforms: { uI: { value: 0 }, uPulse: { value: 0 }, uSize: { value: 1 } }, vertexShader: haloVS, fragmentShader: haloFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMat); halo.frustumCulled = false; halo.renderOrder = 12;
  const gaze = glowSprite('#fff1d8', 0.09, 0); // a small glint that settles on the side he is looking toward
  // his own warm light: soft, golden, larger than the player's small white one (works without bloom too)
  const aura = glowSprite('#ffc778', 0.6, 0), inner = glowSprite('#ffe6bf', 0.2, 0);
  aura.renderOrder = 11; inner.renderOrder = 12;
  const light = new THREE.PointLight('#ffcf8f', 0, 5.5, 1.7);
  group.add(aura, inner, core, halo, gaze, light);
  scene.add(group);
  const mirror = glowSprite('#ffd9a0', 0.55, 0); scene.add(mirror);
  const poolMat = new THREE.ShaderMaterial({ uniforms: { uI: { value: 0 } }, vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: poolFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), poolMat); pool.rotation.x = -Math.PI / 2; pool.renderOrder = 2; scene.add(pool);

  // footfalls of light on the floor
  const N = 16, foot = new Float32Array(N * 4).fill(-100);
  const fg = new THREE.InstancedBufferGeometry(), plane = new THREE.PlaneGeometry(1, 1);
  plane.rotateX(-Math.PI / 2);
  fg.index = plane.index; fg.attributes.position = plane.attributes.position; fg.attributes.uv = plane.attributes.uv;
  const fAttr = new THREE.InstancedBufferAttribute(foot, 4); fAttr.setUsage(THREE.DynamicDrawUsage);
  fg.setAttribute('aFoot', fAttr); fg.instanceCount = N;
  const uTime = { value: 0 };
  // the instanced plane lies flat already, so the shader offsets in x/z
  const footMat = new THREE.ShaderMaterial({ uniforms: { uTime }, vertexShader: footVS.replace('position.y * 0.24', 'position.z * 0.24'), fragmentShader: footFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const feet = new THREE.Mesh(fg, footMat); feet.frustumCulled = false; feet.renderOrder = 3; scene.add(feet);
  let footIdx = 0, gait = 0, side = 1;

  // the arc he draws toward what he points at
  const NA = 56, arcPos = new Float32Array(NA * 3), arcT = new Float32Array(NA);
  for (let i = 0; i < NA; i++) arcT[i] = i / (NA - 1);
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3).setUsage(THREE.DynamicDrawUsage));
  arcGeo.setAttribute('aT', new THREE.BufferAttribute(arcT, 1));
  const arcMat = new THREE.ShaderMaterial({ uniforms: { uTime, uI: { value: 0 }, uScale: { value: 60 } }, vertexShader: arcVS, fragmentShader: arcFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const arc = new THREE.Points(arcGeo, arcMat); arc.frustumCulled = false; arc.renderOrder = 13; scene.add(arc);
  const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(), color: '#ffd9a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  ring.renderOrder = 14; scene.add(ring);

  // the guide himself: a cloaked figure who carries this light
  const figure = createFigure('guide');
  scene.add(figure.group);
  return { group, figure, core, coreMat, haloMat, gaze, aura, inner, light, mirror, poolMat, pool, foot, fAttr, uTime, arcPos, arcGeo, arcMat, arc, ring,
    step(x, z, heading) {
      side = -side;
      const k = footIdx++ % N, sx = Math.cos(heading + Math.PI / 2) * 0.07 * side, sz = Math.sin(heading + Math.PI / 2) * 0.07 * side;
      foot[k * 4] = x + sx; foot[k * 4 + 1] = 0.02; foot[k * 4 + 2] = z + sz; foot[k * 4 + 3] = uTime.value; fAttr.needsUpdate = true;
    },
    get gait() { return gait; }, set gait(v) { gait = v; },
  };
}

// ---------------------------------------------------------------- Dalil
export function createDalil({ scene, camera, ui, audio, rig }) {
  const B = createBody(scene);
  const pos = new THREE.Vector3(-0.9, 0, 6.3), vel = new THREE.Vector3(), goal = pos.clone();
  const lookAt = new THREE.Vector3(0, 2, 0);
  const pointAt = { on: false, target: new THREE.Vector3(), t: 0 };
  const pose = { intensity: 0, target: 0, pulse: 0, speaking: 0, listening: 0 };
  let state = 'hidden', homeLocked = true;
  const side = () => (i18n.dir === 'rtl' ? 1 : -1);

  // ------------------------------------------------------------ voice
  const queue = [];
  let speaking = null, lineId = 0;
  const lineSeconds = (text) => Math.min(12, Math.max(3.2, 2.2 + text.length * 0.058)) / SPEED;
  /** where his head is on screen (and whether he is in view) */
  function screen() {
    const v = B.figure.headWorld().project(camera);
    const W = window.innerWidth, H = window.innerHeight;
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  }
  /** his whole figure on screen, as a box (head to feet) */
  function bounds() {
    const W = window.innerWidth, H = window.innerHeight;
    const h = B.figure.headWorld().project(camera), f = B.figure.group.position.clone().project(camera);
    const x = (h.x * 0.5 + 0.5) * W, y0 = (-h.y * 0.5 + 0.5) * H, y1 = (-f.y * 0.5 + 0.5) * H;
    return { x, y0, y1, w: Math.max(40, (y1 - y0) * 0.36), visible: h.z < 1 && Math.abs(h.x) < 1.1 };
  }
  /**
   * Speak one line. obj may be {ar,en}, a depth object, or a device object ({mouse,touch,pen}).
   * opts: type (content type), cites, depth, until (a promise that ends the line instead of the timer), extra (seconds)
   * Resolves when the line has been read (or was cut by interrupt()).
   */
  function say(obj, opts = {}) {
    return new Promise((resolve) => { queue.push({ obj, opts, resolve }); pump(); });
  }
  function resolveText(obj, depth) {
    let o = atDepth(obj, depth);
    if (o && (o.mouse || o.touch || o.pen)) o = o[inputKind()] || o.mouse || o.touch;
    return o;
  }
  async function pump() {
    if (speaking || !queue.length) return;
    const item = queue.shift();
    const id = ++lineId;
    speaking = item;
    // a question to Dalil comes first: the story waits while the ribbon is open
    while (ui.askOpen() && id === lineId) await new Promise((r) => setTimeout(r, 200));
    if (id !== lineId) return;
    const { obj, opts } = item;
    const text = resolveText(obj, opts.depth);
    const secs = lineSeconds(i18n.t(text)) + (opts.extra || 0) / SPEED;
    ui.caption(text, { anchor: screen, duration: opts.until ? 600 : secs + 0.4, type: opts.type || CT.NARRATIVE_DIALOGUE, cites: opts.cites || [], source: opts.source || 'authored' });
    audio?.voice?.();
    pose.speaking = 1;
    if (opts.until) await Promise.race([opts.until, new Promise((r) => setTimeout(r, 120000))]);
    else await new Promise((r) => setTimeout(r, secs * 1000));
    if (id !== lineId) return;
    pose.speaking = 0;
    if (opts.until) ui.hideCaption();
    await new Promise((r) => setTimeout(r, 450 / SPEED));
    if (id !== lineId) return;
    speaking = null;
    item.resolve(true);
    pump();
  }
  function interrupt() {
    lineId++;
    const pending = [speaking, ...queue].filter(Boolean);
    speaking = null; queue.length = 0; pose.speaking = 0;
    ui.hideCaption();
    pending.forEach((p) => p.resolve(false));
  }

  // ------------------------------------------------------------ ask
  let getContext = () => ({});
  let getSuggestions = () => [];
  let onTalk = () => {};
  const conversation = [];
  const ai = createDalilAI({ level: 'fitrah', buildPrompt, validate, reviewed: (q, lang) => reviewedAnswer(q, lang) });
  let askCtl = null, lastQuestion = '';
  function openAsk() {
    if (ui.askOpen()) return;
    state = 'attending';
    ui.openAsk({
      suggestions: getSuggestions(),
      onSubmit: (q) => answer(q),
      onClose: () => { askCtl?.abort(); state = 'present'; pose.listening = 0; ui.hideCaption(); },
      onTalk: () => onTalk({ question: lastQuestion }),
    });
  }
  async function answer(q) {
    askCtl?.abort();
    askCtl = new AbortController();
    lastQuestion = q;
    ui.askState('listening'); pose.listening = 1; state = 'listening';
    ui.offerTalk(false);
    let r;
    try { r = await ai.ask(q, { ...getContext(), conversation }, i18n.lang, { signal: askCtl.signal }); }
    catch { return; } // cancelled
    ui.askState(''); pose.listening = 0; state = 'attending';
    conversation.push({ q, a: r.text }); if (conversation.length > 6) conversation.shift();
    ui.caption({ ar: r.text, en: r.text }, { anchor: screen, duration: lineSeconds(r.text) + 4, type: r.type || CT.NARRATIVE_DIALOGUE, cites: r.cite || [], source: r.source });
    pose.speaking = 1; setTimeout(() => { pose.speaking = 0; }, lineSeconds(r.text) * 1000);
    if (r.animation === 'point' || r.intent === 'guide') pose.pulse = 1;
    if (r.distress) { onTalk({ question: q, distress: true }); return; }
    if (r.referHuman || r.offerHuman) ui.offerTalk(true);
  }

  // ------------------------------------------------------------ motion
  const tmp = new THREE.Vector3(), prev = new THREE.Vector3(), lamp = new THREE.Vector3(), toCam = new THREE.Vector3();
  const BACK = new THREE.Vector3(0, 0.58, -0.82);
  let yaw = 0;
  function update(dt, t) {
    dt = Math.min(dt, 0.25);
    B.uTime.value = t;
    if (homeLocked) goal.copy(rig.companionSpot(side(), 3.9));
    goal.y = 0;
    // a calm, critically damped walk (in small steps, so slow frames keep the pace)
    const wv = 1.5;
    prev.copy(pos);
    for (let left = dt; left > 1e-5; left -= 0.04) {
      const h = Math.min(0.04, left);
      vel.addScaledVector(tmp.copy(goal).sub(pos), wv * wv * h).addScaledVector(vel, -2 * wv * h);
      pos.addScaledVector(vel, h);
    }
    pos.y = 0;
    const moved = Math.hypot(pos.x - prev.x, pos.z - prev.z), speed = moved / Math.max(dt, 1e-4);
    B.gait += moved;
    if (B.gait > 0.55 && moved > 0.0005) { B.gait = 0; B.step(pos.x, pos.z, Math.atan2(pos.z - prev.z, pos.x - prev.x)); }

    pose.intensity += (pose.target - pose.intensity) * (1 - Math.exp(-dt * 1.2));
    const speak = pose.speaking ? 0.5 + 0.5 * Math.sin(t * 7.3) * Math.sin(t * 2.9) : 0;
    // he faces where he walks; when he speaks or listens he turns to the player; otherwise toward what matters
    const facePlayer = pose.speaking || state === 'attending' || state === 'listening';
    if (speed > 0.25) yaw = Math.atan2(-(pos.x - prev.x), -(pos.z - prev.z));
    else {
      const f = facePlayer ? toCam.copy(camera.position) : (pointAt.on ? pointAt.target : lookAt);
      yaw = Math.atan2(-(f.x - pos.x), -(f.z - pos.z));
      if (facePlayer) yaw += side() * -0.35; // three-quarters, not square on
    }
    B.figure.group.position.copy(pos);
    B.figure.group.visible = pose.intensity > 0.01;
    B.figure.update(dt, t, { yaw, walking: Math.min(1, speed / 0.9), speaking: pose.speaking, point: pointAt.on ? pointAt.target : null, lampPos: lamp, backDir: BACK });
    B.figure.setFade(1 - Math.min(1, pose.intensity * 1.2));
    B.figure.lanternWorld(lamp);
    const I = pose.intensity * (1 - pose.listening * 0.25);
    B.group.position.copy(lamp);
    B.core.scale.setScalar(1 + Math.sin(t * 2.1) * 0.04 + pose.pulse * 0.25 + speak * 0.08);
    B.coreMat.uniforms.uI.value = I;
    B.haloMat.uniforms.uI.value = I;
    B.haloMat.uniforms.uPulse.value = Math.max(pose.pulse, speak * 0.6);
    B.haloMat.uniforms.uSize.value = 0.62 + pose.pulse * 0.35 + speak * 0.08 + (pose.listening ? 0.08 * Math.sin(t * 2) : 0);
    B.light.intensity = I * (2.4 + speak * 0.6);
    B.aura.material.opacity = I * (0.42 + speak * 0.12 + pose.pulse * 0.2); B.aura.scale.setScalar(0.6 + pose.pulse * 0.2 + speak * 0.05 + Math.sin(t * 1.3) * 0.02);
    B.inner.material.opacity = I * 0.85;
    B.mirror.position.set(lamp.x, -lamp.y, lamp.z); B.mirror.material.opacity = I * 0.28;
    B.pool.position.set(pos.x, 0.012, pos.z); B.poolMat.uniforms.uI.value = I * 0.9;
    const look = pointAt.on ? pointAt.target : lookAt;
    tmp.copy(look).sub(lamp).normalize().multiplyScalar(0.11);
    B.gaze.position.lerp(tmp, 1 - Math.exp(-dt * 4)); B.gaze.material.opacity = I * 0.7;
    // the arc of light from his lantern toward what he points at
    pointAt.t += ((pointAt.on ? 1 : 0) - pointAt.t) * (1 - Math.exp(-dt * (pointAt.on ? 2.2 : 3.0)));
    if (!pointAt.on && pointAt.t < 0.01) pointAt.t = 0;
    B.ring.visible = pointAt.t > 0; B.arc.visible = pointAt.t > 0;
    if (pointAt.t > 0.01) {
      const a = lamp, b = pointAt.target;
      const mid = tmp.copy(a).add(b).multiplyScalar(0.5); mid.y += a.distanceTo(b) * 0.18;
      for (let i = 0; i < 56; i++) {
        const u = (i / 55) * Math.min(1, pointAt.t * 1.4), iu = 1 - u;
        B.arcPos[i * 3] = iu * iu * a.x + 2 * iu * u * mid.x + u * u * b.x;
        B.arcPos[i * 3 + 1] = iu * iu * a.y + 2 * iu * u * mid.y + u * u * b.y;
        B.arcPos[i * 3 + 2] = iu * iu * a.z + 2 * iu * u * mid.z + u * u * b.z;
      }
      B.arcGeo.attributes.position.needsUpdate = true;
      B.ring.position.copy(b); B.ring.scale.setScalar(0.9 + 0.12 * Math.sin(t * 2.4));
    }
    B.arcMat.uniforms.uI.value = pointAt.t * pose.intensity * 0.9;
    B.arcMat.uniforms.uScale.value = window.innerHeight * 0.05;
    B.ring.material.opacity = pointAt.t * 0.55 * pose.intensity;
    pose.pulse *= Math.exp(-dt * 1.4);
  }

  return {
    say, interrupt, update, screen, openAsk, answer, ai, conversation,
    get state() { return state; },
    get aiStatus() { return ai.status; },
    get speaking() { return !!speaking; },
    /** fade in beside the player (or out) */
    appear(on = true) { pose.target = on ? 1 : 0; state = on ? 'present' : 'hidden'; },
    /** put him somewhere at once (default: the player's side) */
    place(v = null) { homeLocked = !v; goal.copy(v || rig.companionSpot(side(), 3.9)); goal.y = 0; pos.copy(goal); vel.set(0, 0, 0); },
    /** walk to a place (null: back to the player's side) */
    goTo(v) { if (!v) { homeLocked = true; return; } homeLocked = false; goal.copy(v); },
    look(v) { lookAt.copy(v); },
    /** draw an arc of light to a world point (null: stop pointing) */
    point(v) { if (!v) { pointAt.on = false; if (state === 'pointing') state = 'present'; return; } pointAt.target.copy(v); pointAt.on = true; pose.pulse = 1; state = 'pointing'; },
    pulse() { pose.pulse = 1; },
    /** is a screen point on (or very near) Dalil? */
    hit(x, y) { const b = bounds(); return b.visible && Math.abs(x - b.x) < Math.max(36, b.w * 0.7) && y > b.y0 - 30 && y < b.y1 + 10; },
    bounds,
    bind({ context, suggestions, talk }) { if (context) getContext = context; if (suggestions) getSuggestions = suggestions; if (talk) onTalk = talk; },
    get position() { return B.group.position; },
    get figure() { return B.figure; },
    // for the review panel
    glow: B,
  };
}
export { glowTexture };
