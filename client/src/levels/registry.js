// The levels of Fitrah, in the order the menu shows them.
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
 * @property {() => void} exit       return to the menu (the shell fades out and reloads cleanly)
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
 * @property {Text} title
 * @property {Text} [description]    one quiet line, shown when the level is chosen
 * @property {'available'|'locked'} status
 * @property {string} [scene]        path of the entry module, for documentation and tooling
 * @property {() => Promise<LevelModule>} [load]   the scene loader (a static import() so the
 *                                   bundler can split each level into its own chunk)
 * @property {string} [thumbnail]    still from the level, used as the menu backdrop
 * @property {string} [tone]         colour the veil takes while this level is entered
 */

import waterStill from './water/still.jpg';

/** @type {LevelDefinition[]} */
export const LEVELS = [
  {
    id: 'water',
    title: { ar: 'الماء', en: 'The Water' },
    description: { ar: 'أرضٌ يابسة، وريحٌ وسحاب… ثم ما يتبع.', en: 'A dry land, wind and cloud — and what follows.' },
    status: 'available',
    scene: 'levels/water/the-water.js',
    load: () => import('./water/the-water.js'),
    thumbnail: waterStill,
    tone: '#14110e',
  },
  // placeholders for the structure to come: titles only, no content yet
  { id: 'light', title: { ar: 'النور', en: 'The Light' }, status: 'locked' },
  { id: 'balance', title: { ar: 'الميزان', en: 'The Balance' }, status: 'locked' },
];

export const levelById = (id) => LEVELS.find((l) => l.id === id) || null;
export const isPlayable = (l) => !!l && l.status === 'available' && typeof l.load === 'function';
