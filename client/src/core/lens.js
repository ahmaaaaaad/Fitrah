// One composition for every screen.
//
// A PerspectiveCamera's fov is vertical, so a shot composed for a 16:9 monitor and
// played on a phone held upright keeps its height and loses two thirds of its width:
// the phone sees a crop of the middle, three to four times closer. That was the
// "zoomed-in iPhone" camera. Every shot is now composed for 16:9 (DESIGN_ASPECT) and
// adapted to the screen in hand:
//   - wider screens keep the vertical framing and see a little more at the sides;
//   - narrower screens keep most of the designed width (all of it near 16:9, KEEP of
//     it on a phone in portrait), first by widening the lens up to a natural limit
//     (MAX_FOV), and beyond that by stepping the camera back, which keeps the scene
//     undistorted instead of stretching the lens further.
const DEG = Math.PI / 180;
export const DESIGN_ASPECT = 16 / 9;
const PORTRAIT = 0.46;   // a tall phone held upright
const KEEP = 0.7;        // share of the designed width a portrait phone still sees
const MAX_FOV = 74;      // the widest vertical lens before stepping back

/** How much of the designed width this aspect keeps (1 at 16:9 and wider). */
function keepFor(aspect, keep) {
  if (aspect >= DESIGN_ASPECT) return 1;
  const t = Math.min(1, (DESIGN_ASPECT - aspect) / (DESIGN_ASPECT - PORTRAIT));
  return 1 - (1 - keep) * t;
}

/**
 * The lens for a shot composed at `fov` (vertical, degrees) for 16:9, on a screen of `aspect`.
 * @returns {{ fov: number, back: number }} back >= 1: how many times further the camera
 *   should stand from its subject to keep the composition without a wider lens.
 */
export function adaptLens(fov, aspect, { keep = KEEP, maxFov = MAX_FOV } = {}) {
  if (!(aspect > 0) || aspect >= DESIGN_ASPECT) return { fov, back: 1 };
  const tH = Math.tan((fov * DEG) / 2) * DESIGN_ASPECT * keepFor(aspect, keep); // horizontal half-tangent to keep
  const tV = tH / aspect;
  const want = (2 * Math.atan(tV)) / DEG;
  const cap = Math.max(fov, maxFov);
  if (want <= cap) return { fov: Math.max(fov, want), back: 1 };
  return { fov: cap, back: tV / Math.tan((cap * DEG) / 2) };
}
