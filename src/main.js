// Boot, the fixed 60 Hz loop and the split screen: two 512×384 halves side by side, one per seat.
//   ┌──────────┬──────────┐
//   │ Player 1 │ Player 2 │
//   └──────────┴──────────┘
// Each half has its own scene stack (game/game.js Seat), starting at its own title screen.
import { preload } from './core/assets.js';
import { text } from './core/ui.js';
import { loadSpecies, SPECIES } from './game/species.js';
import { loadTilesets, TILESETS } from './world/tileset.js';
import { Game } from './game/game.js';
import { DEV } from './game/save.js';
import { DEFAULTS, EEVEELUTIONS } from './data/defaults.js';
import { AVATARS } from './data/avatars.js';
import { TitleScene } from './scenes/title.js';

const W = 512, H = 384;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const VIEWS = [0, 1].map(() => {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
});

function fit() {
  const s = Math.min(innerWidth / (W * 2), innerHeight / H);
  canvas.style.width = Math.floor(W * 2 * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
}
addEventListener('resize', fit);
fit();

let game;

async function boot() {
  drawLoading('Loading…');
  await Promise.all([document.fonts.load('26px "Power Clear"'), document.fonts.load('26px "Power Clear Bold"'), loadSpecies(), loadTilesets()]);
  const mons = [...DEFAULTS.pickList, ...EEVEELUTIONS].map(id => SPECIES.get(id)?.sprites).filter(Boolean);
  const outside = TILESETS[1];
  await preload(['ui/windowskins/speech frlg.png', 'ui/windowskins/choice 1.png', 'ui/sel_arrow.png', 'ui/pause_arrow.png',
    'ui/titles/title.png', 'ui/titles/start.png', 'backgrounds/field_bg.png', 'pokemon/shadow/1.png',
    outside.image, ...outside.autotiles.filter(Boolean),
    ...Object.values(AVATARS).flatMap(a => [a.portrait, a.walk]), ...mons.flatMap(s => [s.front, s.run])]);
  game = new Game();
  window.game = game; // for the console and tools/shot.js (players[i].top)
  for (const seat of game.players) seat.push(new TitleScene());
  requestAnimationFrame(loop);
}

function drawLoading(msg) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W * 2, H);
  ctx.fillStyle = '#fff'; ctx.font = '32px sans-serif'; ctx.fillText(msg, 440, 192);
}

// Fixed 60 Hz simulation
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) { game.update(); acc -= 1000 / 60; }
  render();
  requestAnimationFrame(loop);
}

function render() {
  game.players.forEach((seat, i) => {
    const { c, g } = VIEWS[i];
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    seat.draw(g);
    ctx.drawImage(c, i * W, 0);
  });
  ctx.fillStyle = '#101018'; ctx.fillRect(W - 2, 0, 4, H);
  if (DEV) text(ctx, 'DEV · not saving', W, H - 22, { color: '#F8F8F8', shadow: '#C02020', size: 18, align: 'center' });
}

boot().catch(e => { console.error(e); drawLoading('Error: ' + e.message); });
