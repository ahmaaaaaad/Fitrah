// The sound of the chamber: a low room tone that warms with each answer, a soft
// air, and small sounds of light (a question appearing, a link, an answer).
// No music and no melody; nothing here imitates recitation. Synthesized, no files.
//
//   sources -> bus (room | light | dalil) -> master -> compressor -> out
export function createAudio() {
  let ctx = null, master = null;
  const bus = {}, L = {};
  const state = { enabled: true, started: false, warmth: 0, duck: 0 };

  function noise(seconds = 3) {
    const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    return b;
  }

  /** @param {AudioContext|null} [existing] the context the menu unlocked inside the player's click */
  function start(existing) {
    if (state.started) { ctx?.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC && !existing) return;
    try { ctx = existing || new AC(); } catch { return; }
    ctx.resume?.().catch?.(() => {});
    const wake = () => { if (ctx.state !== 'running') ctx.resume?.().catch?.(() => {}); else window.removeEventListener('pointerdown', wake, true); };
    window.addEventListener('pointerdown', wake, true);
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    for (const n of ['room', 'light', 'dalil']) { const g = ctx.createGain(); g.connect(master); bus[n] = g; }
    // room tone: two low sines a fifth apart, slowly breathing, through a soft lowpass
    L.lp = ctx.createBiquadFilter(); L.lp.type = 'lowpass'; L.lp.frequency.value = 260; L.lp.Q.value = 0.4;
    L.roomGain = ctx.createGain(); L.roomGain.gain.value = 0.0;
    L.lp.connect(L.roomGain).connect(bus.room);
    L.oscs = [55, 82.4, 110.2].map((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = [0.32, 0.18, 0.06][i];
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.023; const lg = ctx.createGain(); lg.gain.value = g.gain.value * 0.35;
      lfo.connect(lg).connect(g.gain); lfo.start();
      o.connect(g).connect(L.lp); o.start();
      return o;
    });
    // air: a band of slow noise
    const src = ctx.createBufferSource(); src.buffer = noise(); src.loop = true;
    L.air = ctx.createBiquadFilter(); L.air.type = 'bandpass'; L.air.frequency.value = 520; L.air.Q.value = 0.5;
    L.airGain = ctx.createGain(); L.airGain.gain.value = 0.0;
    src.connect(L.air).connect(L.airGain).connect(bus.room); src.start();
    L.noise = src.buffer;
    state.started = true;
    master.gain.setTargetAtTime(state.enabled ? 0.85 : 0, ctx.currentTime, 1.5);
  }
  const now = () => ctx.currentTime;
  const set = (p, v, t = 0.6) => p?.setTargetAtTime(v, now(), t);

  /** a soft glint of light (not a note: a short filtered shimmer with a faint sine) */
  function glint({ freq = 1200, gain = 0.05, len = 2.2, pan = 0 } = {}) {
    if (!state.started) return;
    const t = now();
    const s = ctx.createBufferSource(); s.buffer = L.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq * 2.2; f.Q.value = 9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq; o.detune.value = (Math.random() - 0.5) * 30;
    const og = ctx.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(gain * 0.5, t + 0.03); og.gain.exponentialRampToValueAtTime(0.0005, t + len * 0.8);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = p || bus.light; if (p) { p.pan.value = pan; p.connect(bus.light); }
    s.connect(f).connect(g).connect(out); o.connect(og).connect(out);
    s.start(t, Math.random() * 2, len + 0.1); o.start(t); o.stop(t + len);
  }
  /** a slow swell (an answer, a change of the chamber) */
  function swell(gain = 0.08, len = 5) {
    if (!state.started) return;
    const t = now();
    const s = ctx.createBufferSource(); s.buffer = L.noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(200, t); f.frequency.linearRampToValueAtTime(900, t + len * 0.5); f.frequency.linearRampToValueAtTime(240, t + len);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + len * 0.45); g.gain.linearRampToValueAtTime(0, t + len);
    s.connect(f).connect(g).connect(bus.light); s.start(t); s.stop(t + len + 0.1);
  }

  return {
    start, state,
    /** chamber warmth 0 (dark) .. 1 (answered) */
    setWarmth(w) { state.warmth = w; if (!state.started) return; set(L.lp.frequency, 220 + w * 360, 2); set(L.roomGain.gain, 0.18 + w * 0.1, 2); set(L.airGain.gain, 0.02 + w * 0.025, 2); set(L.air.frequency, 420 + w * 380, 2); },
    duck(on) { if (state.started) set(bus.room.gain, on ? 0.35 : 1, 0.8); },
    question(i) { glint({ freq: 880 + i * 60, gain: 0.04, len: 2.6, pan: [-0.6, -0.2, 0.2, 0.6][i] || 0 }); },
    link(i) { glint({ freq: 700 + i * 70, gain: 0.05, len: 1.8, pan: (i % 2 ? 0.25 : -0.25) }); },
    open() { swell(0.05, 4); },
    answer() { swell(0.09, 6); glint({ freq: 990, gain: 0.035, len: 3.5 }); },
    voice() { /* Dalil has no voice yet: lines are read, not spoken (a voice needs its own review) */ },
    setEnabled(on) { state.enabled = on; if (master) set(master.gain, on ? 0.85 : 0, 0.25); },
    buses: () => Object.keys(bus),
  };
}
