// Fitrah · The Revival — prototype configuration.
// Every entry under PROVISIONAL is a decision that is NOT final. Each can be
// changed here without touching the architecture; the review session decides.
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

export const QUALITY = params.get('q') === 'low' ? 'low' : 'high';
export const DEBUG = params.has('debug');
export const SPEED = Math.max(0.25, Math.min(20, Number(params.get('speed')) || 1));

export const CONFIG = {
  half: 128,                 // simulation covers x,z in [-128, 128] m
  grid: 96,                  // cells per side
  cloudHeight: 36,           // m (stylized: low, heavy clouds over the valley)
  meadow: { x: 38, z: -30, r: 40 },     // plateau at the foot of the east slope
  basin: { x: 10, z: 30, r: 75 },       // the basin floor the player looks over from the first mark
  // The authored rail (x, z). Eye height is added on top of the terrain.
  rail: [[6, 94], [7, 80], [9, 62], [12, 46], [12.5, 36], [14, 24], [15.5, 12], [17, 2], [18, -6]],
  marks: { start: 0, stream: 4, meadow: 8 }, // rail point index of each mark
  grassCount: QUALITY === 'low' ? 16000 : 70000,
  flowerCount: QUALITY === 'low' ? 2200 : 7000,
  rainCount: QUALITY === 'low' ? 5000 : 16000,
  moteCount: QUALITY === 'low' ? 500 : 1500,
  terrainSegments: QUALITY === 'low' ? 160 : 300,
  ripen: [8, 12],            // seconds a cloud must hold its density before it rains
  lightBand: [0.55, 0.75],   // sun exposure over the meadow that counts as balance
  harmonyHold: 3,            // seconds inside the band
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
