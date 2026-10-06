// The canvas belongs to the game's gestures.
//
// On iPhone, a touch that is held and then dragged on a canvas starts a text
// selection somewhere nearby (Dalil's line, a label) and Safari shows "Copy /
// Translate / Learn…" over the game. Selection must not be disabled for the whole
// page (the verses and Dalil's words stay readable and selectable where they are
// shown to be read), so the fix is scoped to the gesture itself:
//   - the canvas takes its touches (touch-action none, and touchstart is consumed so
//     Safari never begins a long-press selection, loupe or callout from it);
//   - no context menu or selection can start on the canvas;
//   - while a press that began on the canvas is held, nothing on the page can be
//     selected (html.gesturing), and any selection already made is cleared.
// Pointer events still arrive as before: the levels listen to pointerdown/move/up.
let installed = false;
export function claimGestures(canvas) {
  const st = canvas.style;
  st.touchAction = 'none';
  st.userSelect = 'none'; st.webkitUserSelect = 'none'; st.webkitTouchCallout = 'none';
  st.webkitTapHighlightColor = 'transparent';
  if (canvas.dataset.gestures) return;
  canvas.dataset.gestures = '1';
  canvas.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('selectstart', (e) => e.preventDefault());
  const root = document.documentElement;
  const end = () => root.classList.remove('gesturing');
  canvas.addEventListener('pointerdown', () => {
    root.classList.add('gesturing');
    try { window.getSelection()?.removeAllRanges(); } catch { /* nothing selected */ }
  });
  if (!installed) {
    installed = true;
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
    window.addEventListener('blur', end);
    const css = document.createElement('style');
    css.textContent = 'html.gesturing, html.gesturing * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }';
    document.head.append(css);
  }
}
