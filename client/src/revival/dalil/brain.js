// Dalil's behaviour (section 7) and voice (section 10).
// Following: a critically damped spring toward a slot beside the player.
// States pre-empt by priority; silence is a state, not a gap.
import * as THREE from 'three';
import { CONFIG, SPEED } from '../config.js';
import { i18n } from '../../core/i18n.js';
import { heightAt } from '../terrain.js';
import { windAt, sim } from '../sim.js';
import { createDalilBody } from './body.js';
import { askDalil, aiStatus } from './ai.js';
import { COMMENT, GUIDE, REFLECT, SUGGEST, QUESTION_TEXT } from './lines.js';

const K = CONFIG.dalil;
export const P = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

export function createDalil({ scene, camera, player, ui, renderer }) {
  const body = createDalilBody(scene);
  const pos = new THREE.Vector3(), vel = new THREE.Vector3(), slot = new THREE.Vector3(), tmp = new THREE.Vector3();
  const w = { x: 0, z: 0 };
  const brain = {
    state: 'DORMANT', since: 0, heading: 0,
    mark: null, markLook: null, focus: null, // CINEMATIC / CURIOUS targets
    queue: [], speaking: null, lastLineT: -1e9, commentCount: 0, said: new Set(),
    asking: false, askCtl: null,
    phase: 'start',
  };
  let now = 0;

  // start as a dim ember in the soil, a few metres ahead of the player
  function placeStart() {
    const p = player.state.position, h = player.state.heading;
    pos.set(p.x + h.x * 4 + h.z * 1.2, 0, p.z + h.z * 4 - h.x * 1.2);
    vel.set(0, 0, 0);
    body.pose.intensity = 0.22; body.pose.hover = 0.12;
  }

  function set(state) { if (brain.state !== state) { brain.state = state; brain.since = now; } }

  // ---------------------------------------------------------------- voice
  function say(line, priority = P.P3, { ttl = 12, cites = [], force = false } = {}) {
    const item = { line, p: priority, born: now, ttl, cites };
    if (priority === P.P3 && !force) {
      if (brain.commentCount >= 4 && !line.guide) return false;
    }
    if (brain.speaking && brain.speaking.p > priority) { ui.hideCaption(); brain.speaking = null; } // interrupted lines are dropped
    brain.queue.push(item);
    brain.queue.sort((a, b) => a.p - b.p);
    if (brain.queue.length > 3) brain.queue.length = 3;
    return true;
  }
  function pumpVoice() {
    if (brain.speaking) { if (now > brain.speaking.until) { brain.speaking = null; brain.lastLineT = now; } else return; }
    if (brain.state === 'VERSE_PRESENTATION' || brain.state === 'CINEMATIC_POSITIONING') return; // P0: silence enforced
    brain.queue = brain.queue.filter((q) => now - q.born < q.ttl);
    const next = brain.queue[0];
    if (!next) return;
    if (next.p >= P.P3 && now - brain.lastLineT < K.silenceBetweenLines / Math.max(1, SPEED)) return;
    brain.queue.shift();
    const text = i18n.t(next.line);
    const dur = (2.6 + text.length * 0.06) / Math.max(1, SPEED * 0.5);
    brain.speaking = { ...next, until: now + dur };
    if (next.p === P.P3 && !next.line.guide) brain.commentCount++;
    ui.caption(next.line, { anchor: () => anchor(), duration: dur, cites: next.cites, source: next.source });
  }
  const _s = { x: 0, y: 0, visible: false };
  function anchor() {
    const sz = renderer.getSize(new THREE.Vector2());
    const s = body.screen(camera, sz.x, sz.y);
    _s.x = s.x; _s.y = s.y - Math.max(28, s.r * 0.9); _s.visible = s.visible;
    return _s;
  }

  // ---------------------------------------------------------------- environment events
  function onEnv(type, data = {}) {
    if (brain.state === 'DORMANT' && type !== 'wake') return;
    switch (type) {
      case 'firstCloud': if (!brain.said.has(type)) { brain.said.add(type); say(COMMENT.firstCloud, P.P3); } break;
      case 'ripening': if (!brain.said.has(type)) { brain.said.add(type); say(COMMENT.ripening, P.P3, { ttl: 20 }); } break;
      case 'rainStart': react(2.5); break;
      case 'firstGrass':
        if (!brain.said.has(type)) {
          brain.said.add(type);
          if (data.at && data.at.distanceTo(player.state.position) < 14) curious(data.at);
          say(COMMENT.firstGrass, P.P3, { ttl: 15 });
        }
        break;
      case 'stream': if (!brain.said.has(type)) { brain.said.add(type); say(COMMENT.stream, P.P3, { ttl: 15 }); } break;
      case 'flowers': if (!brain.said.has(type)) { brain.said.add(type); say(COMMENT.flowers, P.P3, { ttl: 15 }); } break;
      case 'firstShaft': react(2); if (data.at) curious(data.at, 4); break;
      case 'harmony': react(1.5); break;
      default: break;
    }
  }
  function react(seconds) {
    if (['VERSE_PRESENTATION', 'CINEMATIC_POSITIONING', 'EXPLAINING'].includes(brain.state)) return;
    set('REACTING_TO_ENVIRONMENT'); brain.reactUntil = now + seconds; body.pose.pulse = 1;
  }
  function curious(at, hold = 3) {
    if (['VERSE_PRESENTATION', 'CINEMATIC_POSITIONING', 'EXPLAINING'].includes(brain.state)) return;
    brain.focus = at.clone(); brain.focusHold = hold; set('CURIOUS');
  }
  function guide(kind, toward) {
    if (['VERSE_PRESENTATION', 'CINEMATIC_POSITIONING', 'EXPLAINING', 'DORMANT'].includes(brain.state)) return;
    const line = { ...GUIDE[kind], guide: true };
    if (say(line, P.P3, { ttl: 10 })) { set('GUIDING'); brain.focus = toward ? toward.clone() : null; brain.guideUntil = now + 6; }
  }

  // ---------------------------------------------------------------- asking
  function openAsk() {
    if (brain.asking || brain.state === 'VERSE_PRESENTATION' || brain.state === 'CINEMATIC_POSITIONING') return;
    if (brain.state === 'DORMANT') wake();
    const ids = SUGGEST[brain.phase] || SUGGEST.start;
    ui.openAsk({
      suggestions: ids.map((id) => ({ id, text: QUESTION_TEXT[id] })),
      onSubmit: (text) => ask(text),
      onClose: () => { brain.askCtl?.abort(); brain.asking = false; if (brain.state === 'EXPLAINING') set('FOLLOWING'); },
    });
    set('EXPLAINING'); // turn to listen at once, locally (≤ 150 ms)
  }
  async function ask(text) {
    brain.asking = true; brain.askCtl?.abort();
    const ctl = new AbortController(); brain.askCtl = ctl;
    ui.askState('listening');
    set('EXPLAINING');
    try {
      const ans = await askDalil(text, brain.contextText?.() || '', i18n.lang, { signal: ctl.signal });
      if (ctl.signal.aborted) return;
      ui.askState('idle');
      ui.closeAsk();
      const dur = 4 + ans.text.length * 0.06;
      ui.caption({ en: ans.text, ar: ans.text }, { anchor: () => anchor(), duration: dur, cites: ans.cite, source: ans.source });
      brain.speaking = { p: P.P2, until: now + dur };
      brain.explainUntil = now + dur;
    } catch {
      ui.askState('idle');
    } finally { brain.asking = false; }
  }

  // ---------------------------------------------------------------- choreography hooks for the director
  function toMark(mark, look) { brain.mark = mark.clone(); brain.markLook = look ? look.clone() : null; set('CINEMATIC_POSITIONING'); ui.hideCaption(); brain.speaking = null; }
  function presentVerse(look) { brain.markLook = look ? look.clone() : brain.markLook; set('VERSE_PRESENTATION'); }
  function reflect(kind) { set('REFLECTING'); brain.reflectUntil = now + 8; say(REFLECT[kind], P.P1, { ttl: 20 }); }
  function complete() { set('COMPLETION'); }
  function wake() { if (brain.state === 'DORMANT') { set('FOLLOWING'); body.pose.pulse = 1; } }

  // ---------------------------------------------------------------- movement
  function steer(target, dt, maxSpeed, omega = K.omega) {
    tmp.subVectors(target, pos); tmp.y = 0;
    const ax = omega * omega * tmp.x - 2 * omega * vel.x, az = omega * omega * tmp.z - 2 * omega * vel.z;
    vel.x += ax * dt; vel.z += az * dt;
    const sp = Math.hypot(vel.x, vel.z);
    if (sp > maxSpeed) { vel.x *= maxSpeed / sp; vel.z *= maxSpeed / sp; }
  }
  function faceToward(dx, dz, dt) {
    if (Math.hypot(dx, dz) < 1e-3) return;
    const want = Math.atan2(dz, dx);
    let d = want - brain.heading; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    const lim = K.turn * dt;
    brain.heading += Math.max(-lim, Math.min(lim, d));
  }

  function update(dt, t) {
    now = t;
    const ps = player.state, pp = ps.position, ph = ps.heading;
    const distP = Math.hypot(pos.x - pp.x, pos.z - pp.z);
    const pose = body.pose;
    let target = null, maxSpeed = distP > K.max ? K.run : K.walk, hover = K.hover, intensity = 1, kneel = 0, lift = 0;
    const st = brain.state;
    // slot beside the player: ahead along the heading, off to the side; narrower on narrow screens
    const halfH = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    const side = Math.min(K.side, halfH * 0.62);
    const ca = Math.cos(side), sa = Math.sin(side);
    const dirx = ph.x * ca - ph.z * sa, dirz = ph.z * ca + ph.x * sa; // rotate heading toward the right
    slot.set(pp.x + ph.x * K.lookAhead * 0.4 + dirx * K.desired, 0, pp.z + ph.z * K.lookAhead * 0.4 + dirz * K.desired);

    switch (st) {
      case 'DORMANT': target = null; hover = 0.12; intensity = 0.25 + 0.08 * Math.sin(t * 1.3); break;
      case 'FOLLOWING':
        target = slot; intensity = 0.85;
        if (ps.stillTime > 4) set('OBSERVING');
        break;
      case 'OBSERVING':
        target = slot; maxSpeed *= 0.6; intensity = 0.8;
        if (ps.moving) set('FOLLOWING');
        break;
      case 'CURIOUS':
        if (brain.focus) {
          target = brain.focus;
          if (Math.hypot(pos.x - brain.focus.x, pos.z - brain.focus.z) < 0.9) { kneel = 1; brain.focusHold -= dt; if (brain.focusHold <= 0) { brain.focus = null; set('FOLLOWING'); } }
          if (distP > 16) { brain.focus = null; set('FOLLOWING'); }
        } else set('FOLLOWING');
        break;
      case 'REACTING_TO_ENVIRONMENT':
        target = slot; lift = 0.25; intensity = 1.15;
        if (now > brain.reactUntil) set('FOLLOWING');
        break;
      case 'GUIDING':
        target = brain.focus ? tmp.set(pp.x + (brain.focus.x - pp.x) * 0.25, 0, pp.z + (brain.focus.z - pp.z) * 0.25).clone() : slot;
        if (now > brain.guideUntil) set('FOLLOWING');
        break;
      case 'EXPLAINING':
        target = slot; maxSpeed *= 0.5;
        if (!brain.asking && brain.explainUntil && now > brain.explainUntil && !ui.askOpen()) { brain.explainUntil = 0; set('FOLLOWING'); }
        break;
      case 'CINEMATIC_POSITIONING':
        target = brain.mark; maxSpeed = K.run * 1.4;
        if (brain.mark && Math.hypot(pos.x - brain.mark.x, pos.z - brain.mark.z) < 0.35) set('VERSE_PRESENTATION');
        break;
      case 'VERSE_PRESENTATION': target = brain.mark; maxSpeed = 0.4; intensity = 0.65; break;
      case 'REFLECTING':
        target = brain.mark || slot; intensity = 0.9;
        if (now > brain.reflectUntil) { brain.mark = null; set('FOLLOWING'); }
        break;
      case 'WAITING': target = null; hover = 0.2; intensity = 0.45; break;
      case 'COMPLETION': {
        const sx = pp.x + ph.x * 1.4 + dirx * 1.3, sz = pp.z + ph.z * 1.4 + dirz * 1.3;
        target = tmp.set(sx, 0, sz).clone(); hover = 0.32; intensity = 1.05; maxSpeed = K.walk;
        break;
      }
      default: target = slot;
    }
    // when the player looks up at the sky, Dalil rises a little so it stays at the bottom of the view
    if (['FOLLOWING', 'OBSERVING', 'REACTING_TO_ENVIRONMENT', 'GUIDING', 'EXPLAINING', 'REFLECTING'].includes(st)) {
      const halfV = (camera.fov * Math.PI) / 360;
      const want = pp.y + Math.max(distP, 2) * Math.tan(ps.pitch - halfV * 0.7) - heightAt(pos.x, pos.z);
      hover = Math.max(hover, Math.min(1.9, want));
    }
    // keep a comfortable distance from the player
    if (target && st !== 'CINEMATIC_POSITIONING' && st !== 'VERSE_PRESENTATION' && distP < K.min) {
      const ax = (pos.x - pp.x) / Math.max(distP, 0.01), az = (pos.z - pp.z) / Math.max(distP, 0.01);
      vel.x += ax * (K.min - distP) * 6 * dt; vel.z += az * (K.min - distP) * 6 * dt;
    }
    const before = pos.clone();
    if (target) steer(target, dt, maxSpeed); else { vel.multiplyScalar(Math.exp(-dt * 4)); }
    pos.x += vel.x * dt; pos.z += vel.z * dt;
    // reposition only when far and off screen
    if (distP > 18 && !body.screen(camera, 100, 100).visible) { pos.set(slot.x - ph.x * 2, 0, slot.z - ph.z * 2); vel.set(0, 0, 0); }
    const travelled = Math.hypot(pos.x - before.x, pos.z - before.z);
    // facing: along the walk, or toward what matters in the state
    if (st === 'VERSE_PRESENTATION' || st === 'REFLECTING') { if (brain.markLook) faceToward(brain.markLook.x - pos.x, brain.markLook.z - pos.z, dt); }
    else if (st === 'EXPLAINING' || st === 'COMPLETION') faceToward(pp.x - pos.x, pp.z - pos.z, dt);
    else if (st === 'OBSERVING') faceToward(ph.x, ph.z, dt);
    else if (travelled > 0.002) faceToward(vel.x, vel.z, dt);

    pose.hover += (hover - pose.hover) * (1 - Math.exp(-dt * 2));
    pose.intensity += (intensity - pose.intensity) * (1 - Math.exp(-dt * 2.5));
    pose.kneel += (kneel - pose.kneel) * (1 - Math.exp(-dt * 3));
    pose.lift += (lift - pose.lift) * (1 - Math.exp(-dt * 3));
    windAt(pos.x, pos.z, w);
    body.update(dt, t, pos.x, pos.z, brain.heading, travelled, w);
    pumpVoice();
  }

  // pause / hidden tab: rest on the ground
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !['DORMANT', 'VERSE_PRESENTATION'].includes(brain.state)) { brain.resume = brain.state; set('WAITING'); }
    else if (!document.hidden && brain.state === 'WAITING') set(brain.resume || 'FOLLOWING');
  });

  return {
    brain, body, pos, P, update, say, onEnv, guide, openAsk, toMark, presentVerse, reflect, complete, wake, placeStart,
    get state() { return brain.state; },
    screen: () => { const s = renderer.getSize(new THREE.Vector2()); return body.screen(camera, s.x, s.y); },
    aiStatus, groundY: () => heightAt(pos.x, pos.z), sim,
  };
}
