// Fitrah – entry point: engine, cosmos, Horizon, camera rig, interface, journey.
import './fonts.css';
import './styles.css';
import { start, onUpdate, scene, camera, renderer, composer, renderNow } from './core/scene.js';
import { createCosmos } from './world/cosmos.js';
import { createHorizon } from './world/horizon.js';
import { createRig } from './world/rig.js';
import { createGame } from './flow/game.js';
import { hud } from './ui/components.js';
import { h, root, hide } from './ui/dom.js';
import { script as S } from './core/content.js';
import { i18n } from './core/i18n.js';

i18n.set('ar'); // the page opens right-to-left; the player picks a language on the first screen

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

async function boot() {
  const loading = h('div', { class: 'loading', role: 'status' }, h('div', {}, h('div', { class: 'dot' }), h('div', { class: 'msg' }, S.ui.loading.ar)));
  root().append(loading);
  await frame(); // let the loading screen paint before the heavy bake

  start(document.getElementById('app'));
  const cosmos = createCosmos({ scene, renderer });
  const horizon = createHorizon({ root: cosmos.root, glowTex: cosmos.GLOW });
  const rig = createRig(camera);
  onUpdate((dt, t) => { cosmos.update(dt, t); horizon.update(dt, t); rig.update(dt, t); });
  renderer.compile(scene, camera);
  renderNow();

  hud.build();
  const game = createGame({ cosmos, horizon, rig });
  window.fitrah = { scene, camera, renderer, composer, cosmos, horizon, rig, game };

  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 2500))]);
  await frame();
  hide(loading, { duration: 1.2, y: 0 });

  const step = new URLSearchParams(location.search).get('step');
  game.run(step).catch((err) => { console.error('[fitrah]', err); });
}

// In the Claude artifact viewer, boot through its update hook; elsewhere boot directly.
if (window.claude?.hot?.ready) window.claude.hot.ready(boot); else boot();
