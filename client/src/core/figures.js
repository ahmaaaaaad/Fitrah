// Human-scale figures, built procedurally (no external assets): the player, seen
// from behind, and Dalil, a cloaked guide who carries his light. Both are drawn
// as silhouettes with a warm rim of light, never with a face: they read as people
// against the light of the place without becoming characters to stare at.
//
//   createFigure('player') -> a standing person, quiet, slightly luminous at the edges
//   createFigure('guide')  -> a hooded, cloaked figure; one arm holds the lantern and can point
//
// Each returns { group, update(dt, t, pose), lanternWorld(out), headWorld(out), setRim(color, i) }.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const VS = /* glsl */`
  varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vY;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vY = position.y;
    vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = /* glsl */`
  uniform vec3 uBase, uRim, uBack, uLamp, uLampPos; uniform float uRimI, uBackI, uLampI, uHem, uHemY, uAlpha, uFade;
  uniform vec3 uBackDir;
  varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vY;
  void main(){
    vec3 n = normalize(vN); vec3 v = normalize(vV);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.6);
    // light from behind the figure (the light of the place): a thin warm edge where the surface turns away
    float back = (pow(max(dot(n, -uBackDir), 0.0), 1.2) * 1.6 + 0.25) * fres;
    // the lantern's warm light on the cloth
    vec3 L = uLampPos - vW; float dl = length(L);
    float lamp = max(dot(n, L / dl), 0.0) / (1.0 + dl * dl * 2.5);
    vec3 c = uBase + uRim * back * uRimI + uBack * fres * uBackI + uLamp * lamp * uLampI;
    // a thin band of light at the hem (Dalil's trim)
    c += uRim * smoothstep(0.035, 0.0, abs(vY - uHemY)) * uHem;
    gl_FragColor = vec4(mix(c, vec3(0.0), uFade), uAlpha);
  }`;

function capsule(r, len, x, y, z, rx = 0, rz = 0) {
  const g = new THREE.CapsuleGeometry(r, len, 6, 14);
  g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z);
  return g;
}
function sphere(r, x, y, z, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.SphereGeometry(r, 20, 14); g.scale(sx, sy, sz); g.translate(x, y, z);
  return g;
}
function clean(g) { // mergeGeometries needs identical attribute sets
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal'].includes(k)) out.deleteAttribute(k);
  return out;
}

function makeMaterial(o) {
  return new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS,
    uniforms: {
      uBase: { value: new THREE.Color(o.base) }, uRim: { value: new THREE.Color(o.rim) }, uBack: { value: new THREE.Color(o.back || o.rim) },
      uLamp: { value: new THREE.Color('#ffb866') }, uLampPos: { value: new THREE.Vector3(0, -50, 0) },
      uRimI: { value: o.rimI ?? 1 }, uBackI: { value: o.backI ?? 0.25 }, uLampI: { value: o.lampI ?? 0 },
      uHem: { value: o.hem ?? 0 }, uHemY: { value: o.hemY ?? 0.06 }, uAlpha: { value: 1 }, uFade: { value: 0 },
      uBackDir: { value: new THREE.Vector3(0, 0.25, -1).normalize() },
    },
  });
}

/** A person standing, seen mostly from behind, in a long plain garment. Height about 1.74 m; origin at the feet. */
function playerGeometry() {
  const prof = [[0.0, 0.0], [0.17, 0.0], [0.19, 0.08], [0.205, 0.45], [0.19, 0.85], [0.175, 1.02], [0.2, 1.22], [0.225, 1.36], [0.17, 1.43], [0.06, 1.47], [0.0, 1.48]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(prof, 36); body.scale(1, 1, 0.62);
  const parts = [
    body,
    capsule(0.05, 0.06, 0, 1.49, 0),                                                    // neck
    sphere(0.105, 0, 1.61, 0.01, 0.92, 1.08, 1.0),                                      // head
    capsule(0.046, 0.52, -0.235, 1.09, 0.0, 0, 0.07), capsule(0.046, 0.52, 0.235, 1.09, 0.0, 0, -0.07), // arms, close to the body
  ];
  return mergeGeometries(parts.map(clean));
}
/** A hooded, cloaked guide. Height about 1.82 m; origin at the feet. The lantern arm is separate. */
function guideGeometry() {
  // the cloak: a long bell from the shoulders to the ground
  const prof = [[0.0, 0.0], [0.34, 0.0], [0.33, 0.12], [0.3, 0.5], [0.26, 0.95], [0.235, 1.25], [0.215, 1.38], [0.16, 1.45], [0.0, 1.47]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const cloak = new THREE.LatheGeometry(prof, 40); cloak.scale(1, 1, 0.78);
  const hood = sphere(0.135, 0, 1.6, 0.0, 1.0, 1.22, 1.08);
  const cowl = new THREE.ConeGeometry(0.2, 0.32, 24, 1, true); cowl.translate(0, 1.48, 0.01);
  const shoulderL = sphere(0.09, -0.2, 1.36, 0, 1.2, 0.9, 1.0);
  const armL = capsule(0.06, 0.48, -0.25, 1.06, 0.02, 0, 0.08); // the arm at rest
  return mergeGeometries([cloak, hood, cowl, shoulderL, armL].map(clean));
}
function guideArm() {
  // pivots at the right shoulder; at rest it hangs forward, holding the lantern at about 1.0 m
  const g = mergeGeometries([clean(sphere(0.09, 0, 0, 0, 1.2, 0.9, 1.0)), clean(capsule(0.058, 0.42, 0, -0.27, 0))]);
  return g;
}

/**
 * @param {'player'|'guide'} kind
 */
export function createFigure(kind) {
  const group = new THREE.Group(); group.name = kind;
  const inner = new THREE.Group(); group.add(inner);
  const isGuide = kind === 'guide';
  const mat = makeMaterial(isGuide
    ? { base: '#0d0907', rim: '#ffbf6a', back: '#ff9e4a', rimI: 1.3, backI: 0.18, lampI: 1.1, hem: 0.6, hemY: 0.05 }
    : { base: '#050507', rim: '#ffe2b4', back: '#9aa4c8', rimI: 0.9, backI: 0.1, lampI: 0.35 });
  const body = new THREE.Mesh(isGuide ? guideGeometry() : playerGeometry(), mat);
  body.renderOrder = 4;
  inner.add(body);
  // the arm that carries the lantern pivots at the right shoulder and points along its local -y
  const REST = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0.05, -0.86, -0.5).normalize());
  let arm = null, lantern = null, armMesh = null;
  if (isGuide) {
    arm = new THREE.Group(); arm.position.set(0.21, 1.36, 0.0); arm.quaternion.copy(REST);
    armMesh = new THREE.Mesh(guideArm(), mat); arm.add(armMesh);
    lantern = new THREE.Object3D(); lantern.position.set(0.0, -0.56, 0.0); arm.add(lantern);
    inner.add(arm);
  }
  // a reflection in the dark floor (the floor is drawn semi-transparent over what lies below it)
  const mirrorMat = mat.clone(); mirrorMat.uniforms = mat.uniforms; mirrorMat.side = THREE.BackSide;
  const mirrorRoot = new THREE.Group(); mirrorRoot.scale.y = -1; group.add(mirrorRoot);
  const mInner = new THREE.Group(); mirrorRoot.add(mInner);
  mInner.add(new THREE.Mesh(body.geometry, mirrorMat));
  let mArm = null;
  if (arm) { mArm = new THREE.Group(); mArm.add(new THREE.Mesh(armMesh.geometry, mirrorMat)); mInner.add(mArm); }

  const st = { yaw: 0, yawV: 0, gait: 0 };
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0);
  return {
    group, material: mat, arm, lantern,
    /**
     * pose: { yaw (heading in radians, 0 = facing -z), walking (0..1), speaking (0..1),
     *         point (Vector3|null), lampPos (Vector3), backDir (Vector3) }
     */
    update(dt, t, pose = {}) {
      dt = Math.min(dt, 0.1);
      let d = (pose.yaw ?? st.yaw) - st.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      st.yawV += (d * 6 - st.yawV * 4.2) * dt; st.yaw += st.yawV * dt;
      inner.rotation.y = st.yaw;
      const w = pose.walking || 0;
      st.gait += dt * (1.6 + w * 6);
      inner.position.y = Math.sin(t * 1.4) * 0.006 + Math.abs(Math.sin(st.gait)) * 0.025 * w;
      inner.rotation.z = Math.sin(t * 0.7) * 0.012 * (1 - w) + Math.sin(st.gait) * 0.02 * w;
      inner.rotation.x = -0.05 * w + (pose.speaking ? Math.sin(t * 3.1) * 0.008 : 0);
      if (arm) {
        if (pose.point) {
          group.updateMatrixWorld(true);
          tmp.copy(pose.point); inner.worldToLocal(tmp); tmp.sub(arm.position).normalize();
          q.setFromUnitVectors(DOWN, tmp);
        } else q.copy(REST);
        arm.quaternion.slerp(q, 1 - Math.exp(-dt * 3));
      }
      mInner.position.copy(inner.position); mInner.rotation.copy(inner.rotation);
      if (mArm) { mArm.position.copy(arm.position); mArm.quaternion.copy(arm.quaternion); }
      if (pose.lampPos) mat.uniforms.uLampPos.value.copy(pose.lampPos);
      if (pose.backDir) mat.uniforms.uBackDir.value.copy(pose.backDir);
    },
    lanternWorld(out = new THREE.Vector3()) { group.updateMatrixWorld(true); return lantern ? lantern.getWorldPosition(out) : group.getWorldPosition(out).setY(1.0); },
    headWorld(out = new THREE.Vector3()) { return group.getWorldPosition(out).add(tmp.set(0, isGuide ? 1.62 : 1.6, 0)); },
    setRim(color, i) { mat.uniforms.uRim.value.set(color); if (i != null) mat.uniforms.uRimI.value = i; },
    setFade(f) { mat.uniforms.uFade.value = f; },
    get yaw() { return st.yaw; },
  };
}
