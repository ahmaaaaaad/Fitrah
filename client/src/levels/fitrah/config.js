// Fitrah · The Four Questions — level configuration and review switches.
// Everything a reviewer may want to change without touching the engine.
import { QUALITY } from '../../core/scene.js';

const params = new URLSearchParams(location.search);

export { QUALITY };
export const DEBUG = params.has('debug');
/** ?review shows the reviewers' tools: chapter jumps, the list of additions, Dalil's status, first-version notes */
export const REVIEW = params.has('review') || DEBUG;
/** ?speed=4 hurries every pause and reading time (review and headless tests only) */
export const SPEED = Math.max(0.25, Math.min(20, Number(params.get('speed')) || 1));
/** ?depth=learning starts at a depth without asking (tests, demos) */
export const START_DEPTH = ['exploring', 'learning', 'reflective'].includes(params.get('depth')) ? params.get('depth') : null;

export const PROVISIONAL = {
  // the structure: four questions, one chamber that changes with each answer
  structure: { value: 'four questions in one chamber', decidedBy: 'project owner' },
  // chapters 2 to 4 have their story, sources and answers; their interactions are designed, not built
  interactions: { ch1: 'connect (built)', ch2: 'rotate (designed)', ch3: 'inspect (designed)', ch4: 'notice (designed)' },
  // Dalil keeps the form he has in The Water: a small light that walks beside the player
  dalil: { form: 'walking light, shared with The Water', decidedBy: 'project owner and review' },
  // no music; a quiet synthesized room tone and soft light sounds only
  audio: { music: false, recitation: null },
};
