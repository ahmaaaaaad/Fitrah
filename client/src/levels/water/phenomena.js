// The world's own phenomena, drawn so the player can notice and follow them:
// the atmospheric current (with dust and chaff carried on it), the knot of
// light that marks where attention is, raindrops striking the soil near the
// player, Dalil's pointing gesture, and the glow behind a thinning cloud.
// Nothing here responds to the player as a cause; it only shows what is there.
import * as THREE from 'three';
import { CONFIG, QUALITY } from './config.js';
import { U } from './look.js';
import { NOISE } from './glsl.js';
import { heightAt } from './terrain.js';
import { rainNear } from './sim.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ------------------------------------------------------------------ the current
const ribbonVS = /* glsl */`varying vec2 vUv; varying vec3 vW; varying vec3 vN;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const ribbonFS = /* glsl */`
${NOISE}
uniform float uTime, uShow, uTraced, uHead, uFlow; uniform vec3 uSunCol, uFogCol;
varying vec2 vUv; varying vec3 vW; varying vec3 vN;
void main(){
  vec3 V = normalize(cameraPosition - vW);
  float soft = pow(abs(dot(normalize(vN), V)), 1.4);
  float u = vUv.x;
  // long thin wisps of dust running along the current
  float across = vUv.y * 6.2832;
  float streak = fbm(vec2(u * 14.0 - uTime * uFlow, sin(across) * 2.2 + cos(across) * 1.1 + u * 3.0));
  float streak2 = vnoise(vec2(u * 50.0 - uTime * uFlow * 2.4, sin(across + 1.3) * 5.0));
  float body = smoothstep(0.55, 0.72, streak) * 0.85 + smoothstep(0.66, 0.82, streak2) * 0.45;
  float ends = smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.9, u);
  float traced = smoothstep(uTraced + 0.01, uTraced - 0.04, u);          // the part already followed
  float hd = (u - uHead) * 38.0; float head = exp(-hd * hd);                        // where attention is now
  float a = uShow * ends * (0.25 + 0.75 * soft) * (0.015 + body * 0.36 + traced * body * 0.25 + head * 0.5);
  vec3 dust = vec3(0.86, 0.8, 0.7);
  vec3 col = mix(dust, vec3(1.0, 0.9, 0.72), traced * 0.6 + head) * (0.55 + 0.45 * uSunCol.r);
  gl_FragColor = vec4(col, a);
}`;

// soft points (chaff, the knot of attention, the cloud-break glow)
const ptsVS = /* glsl */`attribute float aSize; attribute float aAlpha; attribute vec3 aCol; uniform float uPx;
varying float vA; varying vec3 vC;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aAlpha < 0.003 ? 0.0 : clamp(aSize * uPx / -mv.z, 1.5, 160.0); vA = aAlpha; vC = aCol; }`;
const ptsFS = /* glsl */`varying float vA; varying vec3 vC;
void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; if (r > 1.0) discard; float g = pow(1.0 - r, 2.0); gl_FragColor = vec4(vC * g * vA, g * vA); }`;

export function createPhenomena(scene, camera, renderer) {
  // ---------------------------------------------------------------- the current: fine filaments of moving dust
  const curve = new THREE.CatmullRomCurve3(CONFIG.current.map(v3), false, 'centripetal');
  const SEG = 180, FIL = QUALITY === 'low' ? 26 : 44;
  const frames = curve.computeFrenetFrames(SEG, false);
  const fPos = [], fU = [], fSeed = [];
  const P = new THREE.Vector3(), off = new THREE.Vector3();
  for (let f = 0; f < FIL; f++) {
    const r = 0.25 + Math.pow(Math.random(), 0.7) * 2.4, th = Math.random() * Math.PI * 2, twist = (Math.random() - 0.5) * 6, seed = Math.random();
    let prev = null;
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      curve.getPointAt(u, P);
      const a = th + twist * u, n = frames.normals[i], bn = frames.binormals[i];
      off.copy(n).multiplyScalar(Math.cos(a) * r).addScaledVector(bn, Math.sin(a) * r * 0.55);
      const q = P.clone().add(off);
      if (prev) { fPos.push(prev.x, prev.y, prev.z, q.x, q.y, q.z); fU.push((i - 1) / SEG, u); fSeed.push(seed, seed); }
      prev = q;
    }
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  fg.setAttribute('aU', new THREE.Float32BufferAttribute(fU, 1));
  fg.setAttribute('aSeed', new THREE.Float32BufferAttribute(fSeed, 1));
  const ribbonU = { ...U, uShow: { value: 0 }, uTraced: { value: 0 }, uHead: { value: -1 }, uFlow: { value: 0.32 } };
  const ribbon = new THREE.LineSegments(fg, new THREE.ShaderMaterial({
    uniforms: ribbonU,
    vertexShader: /* glsl */`attribute float aU; attribute float aSeed; varying float vU; varying float vSeed; varying float vD;
      void main(){ vU = aU; vSeed = aSeed; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`uniform float uTime, uShow, uTraced, uHead, uFlow; uniform vec3 uSunCol;
      varying float vU; varying float vSeed; varying float vD;
      void main(){
        // dashes of dust travelling along the current, each filament at its own pace
        float ph = fract(vU * (5.0 + vSeed * 4.0) - uTime * uFlow * (0.7 + vSeed * 0.6) + vSeed * 7.0);
        float dash = smoothstep(0.0, 0.25, ph) * smoothstep(0.75, 0.45, ph);
        float ends = smoothstep(0.0, 0.08, vU) * smoothstep(1.0, 0.9, vU);
        float traced = smoothstep(uTraced + 0.01, uTraced - 0.05, vU);
        float hd = (vU - uHead) * 30.0; float head = exp(-hd * hd);
        float a = uShow * ends * dash * (0.32 + traced * 0.22 + head * 0.5) * smoothstep(2.0, 6.0, vD);
        if (a < 0.004) discard;
        vec3 col = mix(vec3(0.88, 0.82, 0.72), vec3(1.0, 0.9, 0.7), traced * 0.5 + head) * (0.7 + 0.3 * uSunCol.r);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: false,
  }));
  ribbon.renderOrder = 10; ribbon.frustumCulled = false; ribbon.visible = false;
  scene.add(ribbon);

  // ---------------------------------------------------------------- soft points: chaff on the current, the attention knot, the break glow
  const NCH = QUALITY === 'low' ? 70 : 160;
  const N = NCH + 2;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), col = new Float32Array(N * 3);
  const seeds = Array.from({ length: NCH }, () => [Math.random(), Math.random() * 6.28, 0.6 + Math.random() * 1.6, Math.random()]);
  for (let i = 0; i < NCH; i++) { size[i] = 0.12 + Math.random() * 0.14; col.set([0.62, 0.52, 0.38], i * 3); }
  const KNOT = NCH, BREAK = NCH + 1;
  size[KNOT] = 2.2; col.set([1.6, 1.3, 0.85], KNOT * 3);
  size[BREAK] = 26; col.set([1.4, 1.15, 0.8], BREAK * 3);
  const pg = new THREE.BufferGeometry();
  const pAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const aAttr = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
  pg.setAttribute('position', pAttr); pg.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); pg.setAttribute('aAlpha', aAttr); pg.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  const ptsU = { uPx: { value: 800 } };
  const points = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: ptsU, vertexShader: ptsVS, fragmentShader: ptsFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false; points.renderOrder = 11;
  scene.add(points);

  // ---------------------------------------------------------------- raindrops striking the soil near the player
  const NS = QUALITY === 'low' ? 140 : 320;
  const splashG = new THREE.InstancedBufferGeometry();
  const ring = new THREE.RingGeometry(0.6, 1, 20); ring.rotateX(-Math.PI / 2);
  splashG.index = ring.index; splashG.attributes.position = ring.attributes.position;
  const sp = new Float32Array(NS * 4);  // x, y, z, birth
  const spAttr = new THREE.InstancedBufferAttribute(sp, 4); spAttr.setUsage(THREE.DynamicDrawUsage);
  splashG.setAttribute('aS', spAttr); splashG.instanceCount = NS;
  const splash = new THREE.Mesh(splashG, new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    vertexShader: /* glsl */`attribute vec4 aS; uniform float uTime; varying float vA;
      void main(){ float age = uTime - aS.w; float t = clamp(age / 0.45, 0.0, 1.0); vA = (1.0 - t) * step(0.0, age) * step(age, 0.45);
        vec3 p = aS.xyz + position * (0.03 + t * 0.16) + vec3(0.0, 0.02, 0.0); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */`varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(vec3(0.75, 0.8, 0.85), vA * 0.55); }`,
    transparent: true, depthWrite: false,
  }));
  splash.frustumCulled = false; splash.renderOrder = 7; splash.visible = false;
  scene.add(splash);
  let splashIdx = 0, splashAcc = 0;
  const splashFocus = new THREE.Vector3();

  // ---------------------------------------------------------------- Dalil's gesture: a thin arc of light toward what he has noticed
  const ARC = 48;
  const arcPos = new Float32Array(ARC * 3), arcT = new Float32Array(ARC);
  for (let i = 0; i < ARC; i++) arcT[i] = i / (ARC - 1);
  const arcG = new THREE.BufferGeometry();
  const arcAttr = new THREE.BufferAttribute(arcPos, 3).setUsage(THREE.DynamicDrawUsage);
  arcG.setAttribute('position', arcAttr); arcG.setAttribute('aT', new THREE.BufferAttribute(arcT, 1));
  const arcU = { uTime: U.uTime, uBirth: { value: -100 } };
  const arc = new THREE.Line(arcG, new THREE.ShaderMaterial({
    uniforms: arcU,
    vertexShader: /* glsl */`attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`uniform float uTime, uBirth; varying float vT;
      void main(){ float age = uTime - uBirth; float reach = clamp(age / 0.9, 0.0, 1.0); float fade = 1.0 - smoothstep(1.6, 2.6, age);
        float a = step(vT, reach) * fade * (0.08 + 0.6 * smoothstep(reach - 0.2, reach, vT)) * (1.0 - vT * 0.5);
        if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.2, 0.95, 0.6) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  arc.frustumCulled = false; arc.renderOrder = 13;
  scene.add(arc);

  const state = { current: 0, traced: 0, head: -1, knot: null, knotAlpha: 0, breakAt: null, breakAlpha: 0, splashOn: 0 };
  const _v = new THREE.Vector2(), tmp = new THREE.Vector3();

  return {
    curve, state, ribbon, ribbonU,
    /** Dalil points: an arc from `from` to `to`. */
    gesture(from, to) {
      const mid = from.clone().lerp(to, 0.5); mid.y += from.distanceTo(to) * 0.18 + 0.5;
      const q = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
      for (let i = 0; i < ARC; i++) { q.getPoint(i / (ARC - 1), tmp); arcPos.set([tmp.x, tmp.y, tmp.z], i * 3); }
      arcAttr.needsUpdate = true; arcU.uBirth.value = U.uTime.value;
    },
    update(dt) {
      ptsU.uPx.value = renderer.getDrawingBufferSize(_v).y / (2 * Math.tan((camera.fov * Math.PI) / 360));
      // the current fades in and out; its dust always flows, whether or not anyone follows it
      ribbonU.uShow.value += (state.current - ribbonU.uShow.value) * (1 - Math.exp(-dt * 1.2));
      ribbon.visible = ribbonU.uShow.value > 0.005;
      ribbonU.uTraced.value = state.traced; ribbonU.uHead.value = state.head;
      const t = U.uTime.value;
      for (let i = 0; i < NCH; i++) {
        const s = seeds[i];
        const u = (s[0] + t * 0.035 * s[2]) % 1;
        curve.getPointAt(u, tmp);
        const r = 1.2 + s[3] * 2.4;
        pos[i * 3] = tmp.x + Math.cos(s[1] + t * 2.3 * s[2]) * r;
        pos[i * 3 + 1] = tmp.y + Math.sin(s[1] * 1.7 + t * 3.1) * r * 0.6;
        pos[i * 3 + 2] = tmp.z + Math.sin(s[1] + t * 1.9 * s[2]) * r;
        alpha[i] = ribbonU.uShow.value * Math.min(1, u * 12) * Math.min(1, (1 - u) * 8) * (0.55 + 0.45 * Math.sin(t * 9 * s[2] + s[1]));
      }
      // the knot of attention
      state.knotAlpha += ((state.knot ? 1 : 0) - state.knotAlpha) * (1 - Math.exp(-dt * 4));
      if (state.knot) pos.set([state.knot.x, state.knot.y, state.knot.z], KNOT * 3);
      alpha[KNOT] = state.knotAlpha * (0.75 + 0.25 * Math.sin(t * 3.2));
      // a cloud thinning: light gathers behind it
      state.breakAlpha += ((state.breakAt ? 1 : 0) - state.breakAlpha) * (1 - Math.exp(-dt * 0.8));
      if (state.breakAt) pos.set([state.breakAt.x, state.breakAt.y - 1.5, state.breakAt.z], BREAK * 3);
      alpha[BREAK] = state.breakAlpha * (0.32 + 0.1 * Math.sin(t * 0.9)) * (state.breakBoost ?? 1);
      pAttr.needsUpdate = true; aAttr.needsUpdate = true;
      // raindrops on the soil within a few metres of where the player looks
      splash.visible = state.splashOn > 0;
      if (state.splashOn > 0 && state.splashFocus) {
        splashFocus.copy(state.splashFocus);
        const rate = 260 * Math.min(1, rainNear(splashFocus.x, splashFocus.z) * 1.4) * state.splashOn;
        splashAcc += rate * dt;
        while (splashAcc > 1) {
          splashAcc -= 1;
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 9;
          const x = splashFocus.x + Math.cos(a) * d, z = splashFocus.z + Math.sin(a) * d;
          sp.set([x, heightAt(x, z), z, t + Math.random() * 0.05], (splashIdx++ % NS) * 4);
        }
        spAttr.needsUpdate = true;
      }
    },
  };
}

// ------------------------------------------------------------------ the first flower the player notices in the meadow
export function createHeroFlower(scene, camera) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  for (let i = 0; i < 6; i++) {
    g.save(); g.rotate((i / 6) * Math.PI * 2);
    const grd = g.createLinearGradient(0, 0, 0, -58); grd.addColorStop(0, '#c84a10'); grd.addColorStop(1, '#f39a2c');
    g.fillStyle = grd; g.beginPath(); g.ellipse(0, -30, 15, 30, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  g.fillStyle = '#5a3208'; g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8b33a'; for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 3 + (i % 4) * 2.4; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 1.6, 0, Math.PI * 2); g.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group(); group.visible = false;
  const stemH = 0.46;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.011, stemH, 6), new THREE.MeshBasicMaterial({ color: 0x24401a }));
  stem.position.y = stemH / 2;
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.14), new THREE.MeshBasicMaterial({ color: 0x2f5220, side: THREE.DoubleSide }));
  leaf.position.set(0.025, 0.14, 0); leaf.rotation.z = -0.7;
  const head = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide }));
  head.position.y = stemH;
  group.add(stem, leaf, head);
  scene.add(group);
  const st = { open: 0, target: 0 };
  return {
    group,
    place(at) { group.position.copy(at); group.position.y = heightAt(at.x, at.z) - 0.02; group.visible = true; st.open = 0; st.target = 0; },
    bloom(instant = false) { st.target = 1; if (instant) st.open = 1; },
    headPos() { return group.position.clone().add(new THREE.Vector3(0, stemH, 0)); },
    update(dt) {
      if (!group.visible) return;
      st.open += (st.target - st.open) * (1 - Math.exp(-dt * 1.1));
      const k = st.open;
      stem.scale.y = 0.35 + 0.65 * Math.min(1, k * 1.6); stem.position.y = (stemH * stem.scale.y) / 2;
      head.position.y = stemH * stem.scale.y;
      head.scale.setScalar(Math.max(0.001, k));
      head.quaternion.copy(camera.quaternion);
      head.rotateZ((1 - k) * 1.2 + Math.sin(U.uTime.value * 1.3) * 0.04);
      leaf.scale.setScalar(Math.max(0.001, Math.min(1, k * 2)));
    },
  };
}
