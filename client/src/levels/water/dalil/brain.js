// Dalil as a first-class system: character (body), behaviour (states, following,
// leading, noticing), voice (content-typed lines under a silence budget), and the
// interface to the AI and knowledge (ask). The director drives the narrative; the
// semantic event bus tells Dalil what the player has witnessed.
//   GUIDE        notices first, walks toward it, points, waits
//   INTERPRETER  explains what was witnessed and what a verse says, apart from the verse
//   COMPANION    stays near, stops when the player stops, sits beside them at the end
import * as THREE from 'three';
import { CONFIG, SPEED } from '../config.js';
import { i18n } from '../../../core/i18n.js';
import { heightAt } from '../terrain.js';
import { windAt } from '../sim.js';
import { createDalilBody } from './body.js';
import { askDalil, aiStatus } from './ai.js';
import { SILENCE, SUGGEST, QUESTION_TEXT, wordFor } from './lines.js';
import { inputKind } from '../../../core/device.js';
import { bus, EV, CT } from '../events.js';

const K = CONFIG.dalil;
export const P = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function createDalil({ scene, camera, player, ui, renderer, phenomena }) {
  const body = createDalilBody(scene);
  const pos = new THREE.Vector3(), vel = new THREE.Vector3(), slot = new THREE.Vector3(), tmp = new THREE.Vector3();
  const w = { x: 0, z: 0 };
  const brain = {
    state: 'FOLLOWING', since: 0, heading: 0,
    target: null, look: null, onArrive: null, hold: 0,
    seq: 'arrival', spoken: {}, lastLineT: -1e9, speaking: null, queue: [],
    asking: false, askCtl: null, conversation: [],
    context: null,
  };
  let now = 0;

  function set(state) { if (brain.state !== state) { brain.state = state; brain.since = now; } }
  function placeStart() {
    const p = player.state.position, h = player.state.heading;
    // already here when the player arrives: a few steps ahead, to the side
    pos.set(p.x + h.x * 3.2 - h.z * 1.6, 0, p.z + h.z * 3.2 + h.x * 1.6);
    vel.set(0, 0, 0);
    body.pose.intensity = 0.85; body.pose.hover = K.hover;
  }

  // ---------------------------------------------------------------- voice, under the silence budget
  /**
   * item = {type, en, ar} or, for an instruction about the hands, {type, by: {mouse, touch, pen}}.
   * `gap` overrides the budget's quiet before this line (an instruction right after Dalil points).
   * Returns true when it will be spoken.
   */
  function say(item, { priority = P.P3, cites = [], ttl = 14, source = 'authored', force = false, gap, valid } = {}) {
    if (!item) return false;
    const budget = SILENCE[brain.seq] || { maxLines: 2, gap: 6 };
    const used = brain.spoken[brain.seq] || 0;
    if (!force && used >= budget.maxLines) return false;
    brain.spoken[brain.seq] = used + 1;
    brain.queue.push({ item, priority, cites, born: now, ttl, source, gap: force ? 0 : gap ?? budget.gap, valid });
    brain.queue.sort((a, b) => a.priority - b.priority);
    if (brain.queue.length > 3) brain.queue.length = 3;
    return true;
  }
  function pumpVoice() {
    if (brain.speaking) { if (now > brain.speaking.until) { brain.speaking = null; brain.lastLineT = now; } else return; }
    if (['VERSE_PRESENTATION', 'CINEMATIC_POSITIONING'].includes(brain.state)) return; // silence is enforced during revelation
    // a line still waiting when its moment has passed (a reminder after the gesture is done) is dropped
    brain.queue = brain.queue.filter((q) => now - q.born < q.ttl && (!q.valid || q.valid()));
    const next = brain.queue[0];
    if (!next) return;
    if (now - brain.lastLineT < next.gap / Math.max(1, SPEED)) return;
    brain.queue.shift();
    // instructions are worded for the way the player is touching the world as Dalil speaks
    const item = wordFor(next.item, inputKind());
    const text = i18n.t(item);
    const dur = (2.4 + text.length * 0.055) / Math.max(1, SPEED * 0.5);
    brain.speaking = { ...next, item, until: now + dur };
    ui.caption(item, { anchor, duration: dur, cites: next.cites, source: next.source, type: item.type });
  }
  const speaking = () => !!brain.speaking || brain.queue.length > 0;
  /** Resolves when Dalil has finished everything he is saying. */
  function quiet() { return new Promise((r) => { const tick = () => (speaking() ? setTimeout(tick, 150) : r()); tick(); }); }

  const _s = { x: 0, y: 0, visible: false };
  function anchor() {
    const sz = renderer.getSize(new THREE.Vector2());
    const s = body.screen(camera, sz.x, sz.y);
    _s.x = s.x; _s.y = s.y - Math.max(28, s.r * 0.9); _s.visible = s.visible;
    return _s;
  }

  // ---------------------------------------------------------------- guide: notice, point, lead, wait
  /** Dalil notices something: turns to it, brightens, points with a thin arc of light. */
  function notice(target, { step = 0 } = {}) {
    brain.look = target.clone(); body.pose.pulse = 1;
    phenomena?.gesture(body.group.position.clone(), target.clone());
    if (step > 0) {
      const d = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z); const l = d.length() || 1;
      lead(new THREE.Vector3(pos.x + (d.x / l) * step, 0, pos.z + (d.z / l) * step), target);
    } else set('NOTICING');
  }
  function point(target) { phenomena?.gesture(body.group.position.clone(), target.clone()); body.pose.pulse = 0.7; }
  /** Walk ahead to a place and look at something; resolves on arrival. */
  function lead(to, look) {
    brain.target = to.clone(); brain.look = look ? look.clone() : null; set('LEADING');
    return new Promise((r) => { brain.onArrive = r; });
  }
  function kneel(at, seconds = 3) { brain.target = at.clone(); brain.look = at.clone(); brain.hold = seconds; set('KNEELING'); }
  function follow() { brain.target = null; brain.look = null; set('FOLLOWING'); }
  function toMark(mark, look) { brain.target = mark.clone(); brain.look = look ? look.clone() : null; set('CINEMATIC_POSITIONING'); ui.hideCaption(); brain.speaking = null; brain.queue.length = 0; }
  function presentVerse(look) { brain.look = look ? look.clone() : brain.look; set('VERSE_PRESENTATION'); }
  function explainVerse() { set('EXPLAINING'); }            // turns to the player while the explanation layer shows
  function complete() { set('COMPLETION'); }

  // ---------------------------------------------------------------- asking (player questions; the AI is constrained by context)
  function openAsk() {
    if (brain.asking || brain.state === 'VERSE_PRESENTATION' || brain.state === 'CINEMATIC_POSITIONING') return;
    const ids = SUGGEST[brain.seq] || SUGGEST.arrival;
    ui.openAsk({
      suggestions: ids.map((id) => ({ id, text: QUESTION_TEXT[id] })),
      onSubmit: (text) => ask(text),
      onClose: () => { brain.askCtl?.abort(); brain.asking = false; if (brain.state === 'LISTENING') set('FOLLOWING'); },
    });
    brain.resume = brain.state === 'LISTENING' ? brain.resume : brain.state;
    set('LISTENING'); // turns to listen at once, locally
  }
  async function ask(text) {
    brain.asking = true; brain.askCtl?.abort();
    const ctl = new AbortController(); brain.askCtl = ctl;
    ui.askState('listening'); set('LISTENING');
    bus.emit(EV.PLAYER_ASKED_FOR_EXPLANATION, { question: text.slice(0, 120) });
    try {
      const ctx = { ...(brain.context?.() || {}), conversation: brain.conversation };
      const ans = await askDalil(text, ctx, i18n.lang, { signal: ctl.signal });
      if (ctl.signal.aborted) return;
      ui.askState('idle'); ui.closeAsk();
      brain.conversation.push({ q: text, a: ans.text }); if (brain.conversation.length > 4) brain.conversation.shift();
      const dur = 4 + ans.text.length * 0.06;
      ui.caption({ en: ans.text, ar: ans.text, type: ans.type }, { anchor, duration: dur, cites: ans.cite, source: ans.source, type: ans.type });
      brain.speaking = { priority: P.P2, until: now + dur };
      brain.listenUntil = now + dur;
    } catch { ui.askState('idle'); } finally { brain.asking = false; }
  }

  // ---------------------------------------------------------------- movement
  function steer(target, dt, maxSpeed, omega = K.omega) {
    tmp.subVectors(target, pos); tmp.y = 0;
    vel.x += (omega * omega * tmp.x - 2 * omega * vel.x) * dt;
    vel.z += (omega * omega * tmp.z - 2 * omega * vel.z) * dt;
    const sp = Math.hypot(vel.x, vel.z);
    if (sp > maxSpeed) { vel.x *= maxSpeed / sp; vel.z *= maxSpeed / sp; }
  }
  function faceToward(dx, dz, dt) {
    if (Math.hypot(dx, dz) < 1e-3) return;
    let d = Math.atan2(dz, dx) - brain.heading; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    brain.heading += Math.max(-K.turn * dt, Math.min(K.turn * dt, d));
  }

  function update(dt, t) {
    now = t;
    const ps = player.state, pp = ps.position, ph = ps.heading;
    const distP = Math.hypot(pos.x - pp.x, pos.z - pp.z);
    const pose = body.pose, st = brain.state;
    let target = null, maxSpeed = distP > K.max ? K.run : K.walk, hover = K.hover, intensity = 0.85, kneel = 0, lift = 0, keepDistance = true;
    const halfH = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    const side = Math.min(K.side, halfH * 0.62);
    const ca = Math.cos(side), sa = Math.sin(side);
    const dirx = ph.x * ca - ph.z * sa, dirz = ph.z * ca + ph.x * sa;
    slot.set(pp.x + ph.x * K.lookAhead * 0.4 + dirx * K.desired, 0, pp.z + ph.z * K.lookAhead * 0.4 + dirz * K.desired);

    switch (st) {
      case 'FOLLOWING': target = slot; if (ps.stillTime > 4) set('OBSERVING'); break;
      case 'OBSERVING': target = slot; maxSpeed *= 0.6; intensity = 0.8; if (ps.moving) set('FOLLOWING'); break;
      case 'NOTICING': target = null; intensity = 1.05; lift = 0.15; if (now - brain.since > 2.2) set('FOLLOWING'); break;
      case 'LEADING': {
        target = brain.target; maxSpeed = K.walk * 1.6; keepDistance = false; intensity = 0.95;
        if (brain.target && Math.hypot(pos.x - brain.target.x, pos.z - brain.target.z) < 0.45) {
          set('WAITING_FOR_PLAYER'); const r = brain.onArrive; brain.onArrive = null; r?.();
        }
        break;
      }
      case 'WAITING_FOR_PLAYER': target = brain.target; keepDistance = false; maxSpeed = 0.5; intensity = 0.9; break;
      case 'KNEELING':
        target = brain.target; keepDistance = false;
        if (brain.target && Math.hypot(pos.x - brain.target.x, pos.z - brain.target.z) < 0.8) { kneel = 1; brain.hold -= dt; if (brain.hold <= 0) follow(); }
        break;
      case 'LISTENING':
        target = slot; maxSpeed *= 0.5;
        if (!brain.asking && brain.listenUntil && now > brain.listenUntil && !ui.askOpen()) { brain.listenUntil = 0; set(brain.resume && brain.resume !== 'LISTENING' ? brain.resume : 'FOLLOWING'); }
        break;
      case 'CINEMATIC_POSITIONING':
        target = brain.target; maxSpeed = K.run * 1.4; keepDistance = false;
        if (brain.target && Math.hypot(pos.x - brain.target.x, pos.z - brain.target.z) < 0.35) set('VERSE_PRESENTATION');
        break;
      case 'VERSE_PRESENTATION': target = brain.target; maxSpeed = 0.4; intensity = 0.6; keepDistance = false; break;
      case 'EXPLAINING': target = brain.target || slot; maxSpeed = 0.6; intensity = 1.0; keepDistance = false; break;
      case 'COMPLETION': {
        target = tmp.set(pp.x + ph.x * 1.4 + dirx * 1.3, 0, pp.z + ph.z * 1.4 + dirz * 1.3).clone();
        hover = 0.32; intensity = 1.0; maxSpeed = K.walk;
        break;
      }
      default: target = slot;
    }
    // when the player looks up, Dalil rises a little so he stays at the bottom of the view
    if (['FOLLOWING', 'OBSERVING', 'NOTICING', 'LISTENING', 'WAITING_FOR_PLAYER', 'LEADING'].includes(st)) {
      const halfV = (camera.fov * Math.PI) / 360;
      const want = pp.y + Math.max(distP, 2) * Math.tan(ps.pitch - halfV * 0.7) - heightAt(pos.x, pos.z);
      hover = Math.max(hover, Math.min(1.9, want));
    }
    if (target && keepDistance && distP < K.min) {
      const ax = (pos.x - pp.x) / Math.max(distP, 0.01), az = (pos.z - pp.z) / Math.max(distP, 0.01);
      vel.x += ax * (K.min - distP) * 6 * dt; vel.z += az * (K.min - distP) * 6 * dt;
    }
    const bx = pos.x, bz = pos.z;
    if (target) steer(target, dt, maxSpeed); else vel.multiplyScalar(Math.exp(-dt * 4));
    pos.x += vel.x * dt; pos.z += vel.z * dt;
    if (distP > 22 && st === 'FOLLOWING' && !body.screen(camera, 100, 100).visible) { pos.set(slot.x - ph.x * 2, 0, slot.z - ph.z * 2); vel.set(0, 0, 0); }
    const travelled = Math.hypot(pos.x - bx, pos.z - bz);
    // facing: toward what matters in the state, else along the walk
    if (['NOTICING', 'WAITING_FOR_PLAYER', 'VERSE_PRESENTATION', 'KNEELING'].includes(st) && brain.look) faceToward(brain.look.x - pos.x, brain.look.z - pos.z, dt);
    else if (['LISTENING', 'EXPLAINING', 'COMPLETION'].includes(st)) faceToward(pp.x - pos.x, pp.z - pos.z, dt);
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

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !['VERSE_PRESENTATION'].includes(brain.state)) { brain.resumeHidden = brain.state; set('RESTING'); }
    else if (!document.hidden && brain.state === 'RESTING') set(brain.resumeHidden || 'FOLLOWING');
  });

  return {
    brain, body, pos, P, CT, update, say, quiet, speaking, notice, point, lead, kneel, follow, toMark, presentVerse, explainVerse, complete, placeStart, openAsk,
    get state() { return brain.state; },
    screen: () => { const s = renderer.getSize(new THREE.Vector2()); return body.screen(camera, s.x, s.y); },
    aiStatus, groundPos: () => new THREE.Vector3(pos.x, heightAt(pos.x, pos.z), pos.z),
  };
}
