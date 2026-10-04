// Audio architecture (section 23). PROVISIONAL: the creative and Sharia review
// decides the final direction. The intended direction — natural environmental
// sound and Qur'an recitation — is fully supported; a music bus exists and is
// routed like every other bus, but stays disabled until that review.
//
//   sources -> bus (environment | dalil | recitation | music | ui) -> ducker -> master -> out
//
// Environmental layers are synthesized here (no files): wind, rain, the stream,
// grass rustle and birds. Recitation plays only from a configured, licensed file.
import { PROVISIONAL } from './config.js';

export function createAudio() {
  let ctx = null, master = null;
  const bus = {}, layers = {};
  const state = { enabled: true, started: false, duck: 0, musicEnabled: PROVISIONAL.audio.music.enabled };

  function noiseBuffer(seconds = 3) {
    const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3.0; }
    return b;
  }
  function noiseLayer(dest, { type = 'bandpass', freq = 800, q = 0.7, gain = 0 } = {}) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(dest); src.start();
    return { src, f, g };
  }

  /** @param {AudioContext|null} [existing] a context the menu already unlocked inside the player's click */
  function start(existing) {
    if (state.started) { ctx?.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC && !existing) return;
    ctx = existing || new AC();
    ctx.resume?.().catch?.(() => {});
    // some mobile browsers keep a context suspended until a touch inside the page; the first one wakes it
    const wake = () => { if (ctx.state !== 'running') ctx.resume?.().catch?.(() => {}); else window.removeEventListener('pointerdown', wake, true); };
    window.addEventListener('pointerdown', wake, true);
    master = ctx.createGain(); master.gain.value = state.enabled ? 0.9 : 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    for (const name of ['environment', 'dalil', 'recitation', 'music', 'ui']) {
      const g = ctx.createGain(); g.connect(master); bus[name] = g;
    }
    bus.music.gain.value = state.musicEnabled ? 0.6 : 0; // disabled pending review; nothing is routed to it in this build
    // environmental layers
    layers.wind = noiseLayer(bus.environment, { freq: 420, q: 0.6 });
    layers.gust = noiseLayer(bus.environment, { freq: 1300, q: 1.6 });
    layers.rain = noiseLayer(bus.environment, { type: 'highpass', freq: 1400, q: 0.3 });
    layers.rainLow = noiseLayer(bus.environment, { freq: 380, q: 0.5 });
    layers.stream = noiseLayer(bus.environment, { freq: 700, q: 0.9 });
    layers.rustle = noiseLayer(bus.environment, { type: 'highpass', freq: 3600, q: 0.4 });
    state.started = true;
    if (PROVISIONAL.audio.recitation.src) {
      const el = new Audio(PROVISIONAL.audio.recitation.src); el.crossOrigin = 'anonymous';
      ctx.createMediaElementSource(el).connect(bus.recitation);
      layers.recitation = el;
    }
  }

  function setLevel(g, v, t = 0.4) { if (g) g.gain.setTargetAtTime(v, ctx.currentTime, t); }
  let birdClock = 3, dropClock = 0;
  function chirp(pan = 0, base = 2600) {
    const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const t = ctx.currentTime, n = 2 + Math.floor(Math.random() * 3);
    o.type = 'sine';
    for (let i = 0; i < n; i++) {
      const t0 = t + i * 0.13;
      o.frequency.setValueAtTime(base * (1 + Math.random() * 0.3), t0);
      o.frequency.exponentialRampToValueAtTime(base * (1.5 + Math.random() * 0.4), t0 + 0.08);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 0.02); g.gain.linearRampToValueAtTime(0, t0 + 0.1);
    }
    if (p) { p.pan.value = pan; o.connect(g).connect(p).connect(bus.environment); } else o.connect(g).connect(bus.environment);
    o.start(t); o.stop(t + n * 0.13 + 0.2);
  }
  function drop() {
    const s = ctx.createBufferSource(); s.buffer = layers.rain.src.buffer;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2000 + Math.random() * 3000; f.Q.value = 6;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f).connect(g).connect(bus.environment); s.start(t, Math.random() * 2, 0.06);
  }

  /** mix: {wind 0..1, gust, rain, stream, rustle, birds, duck 0..1} */
  function update(dt, mix) {
    if (!state.started || !ctx) return;
    // revelation: the environment ducks 12 dB; rain thins to a trickle; birds pause
    state.duck += ((mix.duck ? 1 : 0) - state.duck) * (1 - Math.exp(-dt * 2));
    setLevel(bus.environment, 1 - state.duck * 0.75, 0.3);
    setLevel(layers.wind.g, 0.05 + mix.wind * 0.22);
    layers.wind.f.frequency.setTargetAtTime(320 + mix.wind * 500, ctx.currentTime, 0.5);
    setLevel(layers.gust.g, mix.gust * 0.05);
    setLevel(layers.rain.g, mix.rain * 0.16);
    setLevel(layers.rainLow.g, mix.rain * 0.12);
    setLevel(layers.stream.g, mix.stream * 0.12);
    setLevel(layers.rustle.g, mix.rustle * 0.035);
    if (mix.rain > 0.05) { dropClock -= dt * (4 + mix.rain * 30); if (dropClock < 0) { dropClock = Math.random(); drop(); } }
    if (mix.birds > 0.05 && state.duck < 0.2) { birdClock -= dt; if (birdClock < 0) { birdClock = 2 + Math.random() * 6 / mix.birds; chirp(Math.random() * 1.6 - 0.8, 2200 + Math.random() * 1600); } }
  }

  /** Play the configured recitation for a passage, if any (licensed files only). */
  function recite() { if (layers.recitation) { layers.recitation.currentTime = 0; layers.recitation.play().catch(() => {}); } }
  function setEnabled(on) { state.enabled = on; if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.2); }
  return { start, update, recite, setEnabled, state, buses: () => Object.keys(bus) };
}
