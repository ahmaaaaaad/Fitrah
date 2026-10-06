// The structure of Fitrah, as the menu shows it.
//
//   Fitrah  ── the four questions (one guided level)
//   Tafakor ── experiential worlds: The Water, The Mountains, The Space, ...
//
// Adding a level means adding one entry here and one folder beside water/ whose
// entry module exports mount(). Nothing else in the application changes: the
// menu renders whatever this list holds, and the shell loads and mounts the
// level the player chooses.
//
//   Level Menu -> Level Definition -> Scene Loader -> Level Runtime -> Level Menu
//      (shell)      (this file)        (load())       (mount(ctx))     (ctx.exit())

/**
 * @typedef {{ ar: string, en: string }} Text
 *
 * @typedef {object} LevelContext   what the shell hands a level when it mounts it
 * @property {'ar'|'en'} lang        language chosen in the menu
 * @property {boolean} fromMenu      true when the player came from the menu (their click is the
 *                                   audio gesture, so the level skips its own start card)
 * @property {AudioContext|null} audioContext  unlocked inside that click, for the level to reuse
 * @property {'mouse'|'touch'|'pen'|null} pointerType  how that click was made
 * @property {(opts?: { to?: 'menu'|'tafakor' }) => void} exit  return to the menu (the shell fades
 *                                   out and reloads cleanly), optionally straight into a section
 *
 * @typedef {object} LevelRuntime   what mount() returns
 * @property {() => void} [begin]    called once the first frames are on screen and the veil
 *                                   has started to lift; the level's story starts here
 *
 * @typedef {object} LevelModule
 * @property {(ctx: LevelContext) => LevelRuntime} mount
 *
 * @typedef {object} LevelDefinition
 * @property {string} id             stable id, also the URL hash (#water)
 * @property {'fitrah'|'tafakor'} category
 * @property {Text} title
 * @property {Text} [subtitle]
 * @property {Text} [description]    one quiet line, shown when the level is chosen
 * @property {'available'|'coming_soon'} status
 * @property {number} order          position within its category
 * @property {string} [scene]        path of the entry module, for documentation and tooling
 * @property {() => Promise<LevelModule>} [load]   the scene loader (a static import() so the
 *                                   bundler can split each level into its own chunk)
 * @property {string} [thumbnail]    still from the level, used as the menu backdrop
 * @property {string} [tone]         colour the veil takes while this level is entered
 * @property {string} [sourceCollection]  id of the level's approved source set
 * @property {string} [narrativeId]  id of its chapter or beat script
 */

import waterStill from './water/still.jpg';
import fitrahStill from './fitrah/fitrah-still.jpg';
import waterStillPortrait from './water/still-portrait.jpg';
import fitrahStillPortrait from './fitrah/fitrah-still-portrait.jpg';

/** A still rendered for an upright phone, for each landscape still: on a tall screen the landscape
 *  image would be cropped to its middle third and enlarged about three times (soft and grainy). */
export const PORTRAIT_STILL = new Map([[waterStill, waterStillPortrait], [fitrahStill, fitrahStillPortrait]]);

/** @type {LevelDefinition[]} */
export const LEVELS = [
  {
    id: 'fitrah',
    category: 'fitrah',
    title: { ar: 'فطرة', en: 'Fitrah' },
    subtitle: { ar: 'الأسئلة الأربعة', en: 'The Four Questions' },
    description: { ar: 'من خلقني؟ لماذا أنا هنا؟ كيف أعيش؟ ماذا بعد الموت؟', en: 'Who created me? Why am I here? How should I live? What comes after death?' },
    status: 'available',
    order: 1,
    scene: 'levels/fitrah/the-four-questions.js',
    load: () => import('./fitrah/the-four-questions.js'),
    thumbnail: fitrahStill,
    tone: '#07080f',
    sourceCollection: 'fitrah',
    narrativeId: 'data/content/fitrah.json',
  },
  {
    id: 'water',
    category: 'tafakor',
    title: { ar: 'الماء', en: 'The Water' },
    description: { ar: 'أرضٌ يابسة، وريحٌ وسحاب… ثم ما يتبع.', en: 'A dry land, wind and cloud — and what follows.' },
    status: 'available',
    order: 1,
    scene: 'levels/water/the-water.js',
    load: () => import('./water/the-water.js'),
    thumbnail: waterStill,
    tone: '#14110e',
    sourceCollection: 'water',
  },
  // placeholders for the worlds to come: titles only, no content yet
  { id: 'mountains', category: 'tafakor', title: { ar: 'الجبال', en: 'The Mountains' }, status: 'coming_soon', order: 2 },
  { id: 'space', category: 'tafakor', title: { ar: 'الفضاء', en: 'The Space' }, status: 'coming_soon', order: 3 },
];

/** The two paths of the main menu. */
export const PATHS = [
  {
    id: 'fitrah',
    title: { ar: 'فطرة', en: 'Fitrah' },
    subtitle: { ar: 'الأسئلة الأربعة', en: 'The Four Questions' },
    description: { ar: 'من خلقني؟ لماذا أنا هنا؟ كيف أعيش؟ ماذا بعد الموت؟', en: 'Who created me? Why am I here? How should I live? What comes after death?' },
    level: 'fitrah',
  },
  {
    id: 'tafakor',
    title: { ar: 'تفكّر', en: 'Tafakor' },
    subtitle: { ar: 'عوالم التأمّل', en: 'The Experiential Worlds' },
    description: { ar: 'تأمّل الآيات في الخلق: الماء أولًا، وعوالم أخرى لاحقًا.', en: 'Contemplate the signs in creation: The Water first, more worlds later.' },
    section: 'tafakor',
  },
];

export const levelById = (id) => LEVELS.find((l) => l.id === id) || null;
export const levelsIn = (category) => LEVELS.filter((l) => l.category === category).sort((a, b) => a.order - b.order);
export const isPlayable = (l) => !!l && l.status === 'available' && typeof l.load === 'function';
