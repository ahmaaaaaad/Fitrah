// Anonymous usage events, only when the host turns them on (<meta name="fitrah-analytics">).
// What is sent: an event name, the level, a short value (a chapter id, a stall kind, an fps
// bucket), the interface language and the kind of device. Never anything the player typed,
// never an address or an identifier. Without the meta tag, nothing leaves the page.
import { i18n } from './i18n.js';
import { deviceClass } from './device.js';

const URL_ = typeof document !== 'undefined' ? document.querySelector('meta[name="fitrah-analytics"]')?.content : null;
const once = new Set();
export function track(e, { lv = '', v = '' } = {}, { onceKey = null } = {}) {
  if (!URL_) return;
  if (onceKey) { if (once.has(onceKey)) return; once.add(onceKey); }
  try {
    const body = JSON.stringify({ e, lv, v: String(v).slice(0, 32), l: i18n.lang, d: deviceClass() });
    if (navigator.sendBeacon) navigator.sendBeacon(URL_, new Blob([body], { type: 'application/json' }));
    else fetch(URL_, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
  } catch { /* analytics never breaks the experience */ }
}
/** report the frame rate once, in coarse buckets, after the level has settled */
export function trackFps(level, getFps) {
  if (!URL_) return;
  setTimeout(() => { const f = getFps(); track('fps', { lv: level, v: f >= 50 ? '50+' : f >= 30 ? '30-50' : f >= 20 ? '20-30' : '<20' }); }, 20000);
}
