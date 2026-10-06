// Fitrah · The Revival — prototype configuration.
// Every entry under PROVISIONAL is a decision that is NOT final. Each can be
// changed here without touching the architecture; the review session decides.
import { PROFILE } from '../../core/scene.js';

const params = new URLSearchParams(location.search);

export const PROVISIONAL = {
  // The Revival as Fitrah's first world. Validated through this prototype;
  // the cosmos World 1 build is untouched (index.html).
  revivalAsFirstWorld: { value: true, decidedBy: 'prototype review' },
  // Revelation verses. 57:17 is a provisional candidate, 30:50 the alternative.
  // Neither is canonical until verified and approved in Sharia review.
  verses: {
    revival: '56:68-70',
    // ?final=30:50 shows the alternative so reviewers can compare both in place.
    final: params.get('final') === '30:50' ? '30:50' : '57:17',
    finalAlternative: '30:50',
    finalStatus: 'provisional',
    decidedBy: 'verification and Sharia review',
  },
  // Audio direction: natural environmental sound and Qur'an recitation.
  // The music bus exists and is routed like the others, but is disabled until
  // the creative and Sharia review decides. Recitation plays only when a
  // licensed file is configured.
  audio: {
    music: { enabled: false, decidedBy: 'creative and Sharia review' },
    recitation: { src: null, decidedBy: 'licensing' },
  },
  dalil: { form: 'walking-light', decidedBy: 'project owner and Sharia review' },
  player: { mode: 'first-person, authored shots', decidedBy: 'prototype review' },
};

// the light build when asked for, or when the device's profile is the lightest (core/scene.js);
// phones keep the full build with a little fewer instances
export const QUALITY = params.get('q') === 'low' || PROFILE.name === 'performance' ? 'low' : 'high';
const N = (high, low) => (QUALITY === 'low' ? low : Math.round(high * Math.min(1, Math.max(0.6, PROFILE.particles))));
export const DEBUG = params.has('debug');
/** ?review shows the reviewers' tools: beat jumps, provisional decisions, Dalil's status */
export const REVIEW = params.has('review') || DEBUG;
export const SPEED = Math.max(0.25, Math.min(20, Number(params.get('speed')) || 1));

export const CONFIG = {
  half: 128,                 // simulation covers x,z in [-128, 128] m
  grid: 96,                  // cells per side
  cloudHeight: 36,           // m (stylized: low, heavy clouds over the valley)
  // The route runs downhill (north to south), so following water is physically right.
  meadow: { x: 28, z: 18, r: 34 },      // plateau at the foot of the east slope, downstream
  basin: { x: -4, z: -50, r: 48 },      // where the first rain falls, around the arrival
  // The authored rail (x, z). Eye height is added on top of the terrain.
  rail: [[-2, -68], [-4, -60], [-6, -52], [-6.8, -44], [-6.4, -37], [-3.8, -29], [0, -22], [3, -12], [5, -4], [8, 2]],
  marks: { start: 0, stream: 5, meadow: 9 }, // rail point index of each mark
  // The world's own phenomena (authored paths the player follows; the player never moves them)
  // from the north-east slopes, across in front of the player, then up and ahead (south) into the gathering cloud
  current: [[64, 20, -104], [50, 13, -84], [34, 10, -71], [20, 10, -61], [10, 14, -52], [4, 22, -44], [0, 28, -36]],
  rainCenter: { x: -4, z: -52, r: 28 },
  // the first water gathers in the dry stream bed here and runs downhill to the stream mark
  water: { zFrom: -70, zTo: -27 },
  grassCount: N(70000, 16000),
  flowerCount: N(7000, 2200),
  rainCount: N(16000, 5000),
  moteCount: N(1500, 500),
  terrainSegments: QUALITY === 'low' ? 160 : 300,
  ripen: [8, 12],            // seconds a cloud must hold its density before it rains
  lightTarget: 0.72,         // how much sun reaches the meadow once the clouds have opened
  dalil: {
    desired: 3.0, min: 1.6, max: 6.0, omega: 2.2, turn: 2.1, walk: 1.1, run: 2.6,
    lookAhead: 2.5, side: 0.49, hover: 0.75,
    silenceBetweenLines: 60, // s; provisional for the prototype (the document says 90)
    stallSeconds: 25,
  },
  // Adapters are tried in order. 'server' is the production route (needs a key on
  // the server); 'artifact' is the Claude viewer's runtime when the page is
  // published as an artifact; 'fallback' is deterministic and always available.
  ai: ['server', 'artifact', 'fallback'],
};
