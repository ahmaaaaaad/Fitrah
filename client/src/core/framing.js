// Calculated framing: where a first-person camera should look, and how wide, so a
// set of world points sits inside a screen region (see interactionRegion() in
// device.js). Used when an interaction needs several things in one frame.
//
// The authored framing is kept whenever it already fits. Otherwise the view
// turns by the least amount that brings every point inside; only if the points
// cannot fit at the current lens does it centre on them and widen the lens.
// Callers that need a looser composition (fewer degrees between points) can ask
// again with different points; `fits` says whether this lens limit was enough.
import * as THREE from 'three';

const DEG = Math.PI / 180;
const f = new THREE.Vector3(), r = new THREE.Vector3(), u = new THREE.Vector3(), d = new THREE.Vector3();
const PITCH_MIN = -0.6, PITCH_MAX = 0.69; // the player's own pitch limits, a little inside

function basis(yaw, pitch) {
  f.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  r.set(Math.cos(yaw), 0, Math.sin(yaw));
  u.crossVectors(r, f);
}
/** Tangent-plane coordinates of each point for a view direction (x right, y up, z depth). */
function tangents(eye, points, yaw, pitch) {
  basis(yaw, pitch);
  return points.map((p) => {
    d.copy(p).sub(eye);
    const z = d.dot(f);
    return { x: d.dot(r) / Math.max(z, 1e-3), y: d.dot(u) / Math.max(z, 1e-3), z };
  });
}
/** Region margins (px) -> NDC bounds. */
function ndcBounds(region) {
  const { W, H } = region;
  return { xl: -1 + (2 * region.left) / W, xr: 1 - (2 * region.right) / W, yb: -1 + (2 * region.bottom) / H, yt: 1 - (2 * region.top) / H };
}
/** Smallest tan(vfov/2) that keeps every point inside the bounds (Infinity when one is behind). */
function fitTan(tans, B, aspect) {
  let t = 0;
  for (const p of tans) {
    if (p.z < 0.2) return Infinity;
    t = Math.max(t, p.x > 0 ? p.x / (aspect * B.xr) : p.x / (aspect * B.xl), p.y > 0 ? p.y / B.yt : p.y / B.yb);
  }
  return t;
}
const bbox = (tans) => tans.reduce((b, p) => ({ x0: Math.min(b.x0, p.x), x1: Math.max(b.x1, p.x), y0: Math.min(b.y0, p.y), y1: Math.max(b.y1, p.y) }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
const clampPitch = (p) => Math.max(PITCH_MIN, Math.min(PITCH_MAX, p));

/**
 * @param {object} o
 * @param {THREE.Vector3} o.eye           camera position
 * @param {THREE.Vector3[]} o.points      what must be on screen
 * @param {THREE.Vector3} o.look          authored look target
 * @param {number} o.fov                  authored vertical fov (degrees)
 * @param {number} o.aspect               viewport aspect
 * @param {object} o.region               interactionRegion()
 * @param {(fov:number)=>number} [o.lens] the fov the camera will really use for a requested fov
 * @param {number} [o.maxFov=85]          widest lens this composition may use
 * @param {number} [o.slack=1.03]         room for head sway and smoothing
 */
export function solveFraming({ eye, points, look, fov, aspect, region, lens = (x) => x, maxFov = 85, slack = 1.03 }) {
  const B = ndcBounds(region);
  d.copy(look).sub(eye);
  const yaw0 = Math.atan2(d.x, -d.z), pitch0 = clampPitch(Math.atan2(d.y, Math.hypot(d.x, d.z)));
  const out = (yaw, pitch, fovOut, how, need) => {
    basis(yaw, pitch);
    return { look: eye.clone().addScaledVector(f, 30), fov: fovOut, yaw, pitch, how, need, fits: how !== 'too-wide' };
  };

  // 1. the authored frame, if every point is already inside
  const tLens = Math.tan((lens(fov) * DEG) / 2);
  let tans = tangents(eye, points, yaw0, pitch0);
  if (fitTan(tans, B, aspect) * slack <= tLens) return out(yaw0, pitch0, fov, 'authored', fov);

  // the least turn from (yaw, pitch) that brings the points inside the bounds at a lens
  const fitsAt = (y, p, tL) => fitTan(tangents(eye, points, y, p), B, aspect) * slack <= tL * 1.0005;
  function shiftInto(yaw, pitch, tL) {
    for (let k = 0; k < 10; k++) {
      const tn = tangents(eye, points, yaw, pitch);
      if (tn.some((p) => p.z < 0.2)) break;
      const b = bbox(tn), sx = tL * aspect / slack, sy = tL / slack;
      // the box in NDC at this lens, and the shift that puts it inside the bounds
      const nx0 = b.x0 / sx, nx1 = b.x1 / sx, ny0 = b.y0 / sy, ny1 = b.y1 / sy;
      if (nx1 - nx0 > B.xr - B.xl + 1e-6 || ny1 - ny0 > B.yt - B.yb + 1e-6) break;
      const dx = nx1 > B.xr ? nx1 - B.xr : nx0 < B.xl ? nx0 - B.xl : 0;
      const dy = ny1 > B.yt ? ny1 - B.yt : ny0 < B.yb ? ny0 - B.yb : 0;
      if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) break;
      yaw += Math.atan(dx * sx * 1.02); pitch = clampPitch(pitch + Math.atan(dy * sy * 1.02));
    }
    return [yaw, pitch];
  }

  // 2. turn by the least amount that brings the points inside, at the same lens
  let [yaw, pitch] = shiftInto(yaw0, pitch0, tLens);
  if (fitsAt(yaw, pitch, tLens)) return out(yaw, pitch, fov, 'turned', fov);

  // 3. centre on the points and widen the lens just enough
  yaw = yaw0; pitch = pitch0;
  let t = Infinity;
  for (let k = 0; k < 10; k++) {
    tans = tangents(eye, points, yaw, pitch);
    if (tans.some((p) => p.z < 0.2)) {
      // something is behind: face the mean direction first
      const m = points.reduce((a, p) => a.add(d.copy(p).sub(eye).normalize()), new THREE.Vector3());
      yaw = Math.atan2(m.x, -m.z); pitch = clampPitch(Math.atan2(m.y, Math.hypot(m.x, m.z)));
      continue;
    }
    t = fitTan(tans, B, aspect);
    const b = bbox(tans);
    const xc = ((B.xr + B.xl) / 2) * t * aspect, yc = ((B.yt + B.yb) / 2) * t;
    const ex = (b.x0 + b.x1) / 2 - xc, ey = (b.y0 + b.y1) / 2 - yc;
    if (Math.abs(ex) < 1e-4 && Math.abs(ey) < 1e-4) break;
    yaw += Math.atan(ex) * 0.9; pitch = clampPitch(pitch + Math.atan(ey) * 0.9);
  }
  t = fitTan(tangents(eye, points, yaw, pitch), B, aspect) * slack;
  const need = (2 * Math.atan(t)) / DEG;
  if (need > maxFov) return out(yaw, pitch, maxFov, 'too-wide', need);
  // with the wider lens there is usually room to spare in one direction: stay as close to the
  // authored view as that room allows (e.g. keep its pitch when only the width was the problem)
  const fovOut = Math.max(fov, need), tOut = Math.tan((lens(fovOut) * DEG) / 2);
  const [y2, p2] = shiftInto(yaw, pitch0, tOut);
  if (fitsAt(y2, p2, tOut)) return out(y2, p2, fovOut, 'widened', need);
  return out(yaw, pitch, fovOut, 'widened', need);
}

/** Screen positions (CSS px) of points for a camera, and whether all are inside a region. */
export function pointsInside(camera, points, region) {
  const v = new THREE.Vector3();
  return points.every((p) => {
    v.copy(p).project(camera);
    if (v.z > 1) return false;
    const x = (v.x * 0.5 + 0.5) * region.W, y = (-v.y * 0.5 + 0.5) * region.H;
    return x >= region.left - 1 && x <= region.W - region.right + 1 && y >= region.top - 1 && y <= region.H - region.bottom + 1;
  });
}

/**
 * Screen-space check of interaction targets as the player will actually see them: a target
 * can exist in the world and still be practically unusable. For each point: on screen and in
 * front of the camera, inside the safe interaction region, not under visible interface
 * (`avoid` selectors, plus any `rects`, e.g. a character's screen bounds), and far enough from
 * its neighbours to be told apart under a fingertip (`minSep`, CSS px).
 * @returns {{ ok: boolean, issues: string[], screens: {x:number,y:number}[], minSep: number }}
 */
export function validateTargets(camera, points, { region, minSep = 0, avoid = [], rects = [] } = {}) {
  const v = new THREE.Vector3(), issues = [], screens = [];
  const ui = [...rects];
  for (const sel of avoid) for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.width && r.height && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05) ui.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, name: sel });
  }
  points.forEach((p, i) => {
    v.copy(p).project(camera);
    const x = (v.x * 0.5 + 0.5) * region.W, y = (-v.y * 0.5 + 0.5) * region.H;
    screens.push({ x, y });
    if (v.z > 1) { issues.push(`${i}:behind`); return; }
    if (x < region.left || x > region.W - region.right || y < region.top || y > region.H - region.bottom) issues.push(`${i}:outside`);
    for (const r of ui) if (x > r.left - 8 && x < r.right + 8 && y > r.top - 8 && y < r.bottom + 8) issues.push(`${i}:under ${r.name || 'ui'}`);
  });
  let sep = Infinity;
  for (let i = 1; i < screens.length; i++) sep = Math.min(sep, Math.hypot(screens[i].x - screens[i - 1].x, screens[i].y - screens[i - 1].y));
  if (minSep && sep < minSep) issues.push(`too-close:${Math.round(sep)}`);
  return { ok: issues.length === 0, issues, screens, minSep: Math.round(sep) };
}
