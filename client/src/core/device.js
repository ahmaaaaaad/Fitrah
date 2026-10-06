// How the player touches the world, and how much of the screen it is safe to ask
// them to touch. Shared by every level: Dalil words his instructions from
// inputKind(), and interactions keep their points inside interactionRegion().

let last = null;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { if (e.pointerType) last = e.pointerType; }, { capture: true, passive: true });
}
/** The shell passes the pointer type of the click that opened the level. */
export function hintPointer(type) { if (type && !last) last = type; }

const mq = (q) => { try { return window.matchMedia(q).matches; } catch { return false; } };

/** 'mouse' | 'touch' | 'pen' — the last pointer the player used, else what the device suggests. */
export function inputKind() {
  if (last === 'touch' || last === 'pen' || last === 'mouse') return last;
  if (mq('(pointer: coarse)')) return 'touch';
  if (!mq('(pointer: fine)') && (navigator.maxTouchPoints || 0) > 0) return 'touch';
  return 'mouse';
}
/** Direct contact with the screen (a finger or a pen). */
export const isDirect = () => inputKind() !== 'mouse';

/** phone-portrait | phone-landscape | tablet-portrait | tablet-landscape | desktop */
export function deviceClass() {
  const W = window.innerWidth, H = window.innerHeight, s = Math.min(W, H);
  const coarse = mq('(pointer: coarse)') || isDirect();
  const o = W < H ? 'portrait' : 'landscape';
  if (s < 520) return `phone-${o}`;
  if (s < 1000 && coarse) return `tablet-${o}`;
  return 'desktop';
}

// env(safe-area-inset-*) is only readable through layout, so a hidden probe carries it
let probe = null;
export function safeInsets() {
  if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
      + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
    document.body.append(probe);
  }
  const cs = getComputedStyle(probe), px = (v) => parseFloat(v) || 0;
  return { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
}

/**
 * The part of the screen where interaction points may sit: inside the safe areas,
 * clear of the corner menu, with room around each point for a fingertip (or a cursor).
 * Margins are in CSS pixels from each edge.
 */
export function interactionRegion() {
  const W = window.innerWidth, H = window.innerHeight, ins = safeInsets();
  const direct = isDirect(), cls = deviceClass();
  const edge = direct ? 34 : 26;                       // half a fingertip plus the point itself
  const menu = 14 + 42 + 10;                           // the corner menu button and a little air
  return {
    W, H, cls, direct,
    left: ins.left + edge,
    right: ins.right + edge,
    top: Math.max(ins.top + edge, ins.top + menu),
    bottom: ins.bottom + edge + captionReserve(cls, H),
  };
}

/** The band at the bottom kept for Dalil's caption panel: interaction points never sit under it. */
export function captionReserve(cls = deviceClass(), H = window.innerHeight) {
  if (cls === 'phone-portrait') return 128;
  if (H < 500) return 64;
  return Math.min(124, Math.round(H * 0.15));
}
