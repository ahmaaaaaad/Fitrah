// Ambient sound design with the Web Audio API: wind and air, soft whooshes, no music.
// Starts only after the first user gesture.
let ctx = null, master = null, amb = null, air = null;
let muted = false;

function noiseBuffer(type = 'pink', seconds = 4) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else if (type === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.5; }
    else d[i] = w;
  }
  return buf;
}

function loop(buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s; }

export const audio = {
  get started() { return !!ctx; },
  get muted() { return muted; },
  start() {
    if (ctx) { ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);

    // deep wind bed: brown noise through a slowly breathing low-pass
    const src = loop(noiseBuffer('brown', 6));
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 170;
    lfo.connect(lfoGain).connect(lp.frequency);
    amb = ctx.createGain(); amb.gain.value = 0;
    src.connect(lp).connect(amb).connect(master);
    src.start(); lfo.start();
    amb.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 4);

    // thin high air
    const src2 = loop(noiseBuffer('pink', 5));
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4200;
    air = ctx.createGain(); air.gain.value = 0;
    src2.connect(hp).connect(air).connect(master); src2.start();
    air.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 5);
  },
  setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.2);
  },
  /** Lower the ambience (e.g. while a recitation plays). */
  duck(on) {
    if (!ctx) return;
    amb.gain.setTargetAtTime(on ? 0.1 : 0.32, ctx.currentTime, 0.4);
    air.gain.setTargetAtTime(on ? 0.008 : 0.025, ctx.currentTime, 0.4);
  },
  _burst({ dur = 0.8, from = 400, to = 1600, q = 1.2, gain = 0.35, type = 'pink', attack = 0.25 } = {}) {
    if (!ctx || muted) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(type, dur + 0.1);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(from, ctx.currentTime); bp.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + dur * attack);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    s.connect(bp).connect(g).connect(master); s.start(); s.stop(ctx.currentTime + dur + 0.1);
  },
  whoosh() { this._burst({ dur: 0.9, from: 300, to: 1800, gain: 0.32 }); },
  snap() { this._burst({ dur: 0.45, from: 900, to: 300, q: 2, gain: 0.4, attack: 0.08 }); },
  soft() { this._burst({ dur: 0.35, from: 2200, to: 1200, q: 3, gain: 0.12, attack: 0.1 }); },
  swell() { this._burst({ dur: 3.2, from: 1200, to: 5200, q: 0.8, gain: 0.28, attack: 0.4 }); },
  shimmer() { this._burst({ dur: 1.3, from: 5000, to: 9000, q: 1.5, gain: 0.16, type: 'white', attack: 0.15 }); },
  warp() { this._burst({ dur: 2.4, from: 150, to: 3000, q: 0.9, gain: 0.45, attack: 0.6 }); },
  wrong() { this._burst({ dur: 0.5, from: 500, to: 220, q: 4, gain: 0.25, attack: 0.1 }); },
  /** Recitation files are not bundled yet; the verse card hides its player until they are. */
  hasRecitation() { return false; },
};
