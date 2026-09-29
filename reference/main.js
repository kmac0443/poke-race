// Boot, main loop and the 2x2 split-screen layout:
//   ┌──────────┬──────────┐
//   │ Player 1 │ Player 2 │
//   ├──────────┼──────────┤
//   │ Player 3 │ Team     │
//   └──────────┴──────────┘
import { loadData, SPECIES } from './game/data.js';
import { loadTilesets } from './world/tileset.js';
import { loadEssMaps } from './world/builder.js';
import { Game } from './game/game.js';
import { OverworldScene } from './scenes/overworld.js';
import { Scene, text, drawWindow, drawArrow } from './core/ui.js';
import { img, isReady, draw, preload } from './core/assets.js';
import { unlock, se, requestBgm, cry } from './core/audio.js';
import { KEY_LABELS, anyKeyDown } from './core/input.js';
import { AVATARS } from './game/player.js';
import { NamingScene } from './scenes/naming.js';
import { MAPS, START } from './maps/index.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const VIEWS = [0, 1, 2, 3].map(() => {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 384;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
});
const VIEW_POS = [[0, 0], [512, 0], [0, 384], [512, 384]];

function fit() {
  const s = Math.min(innerWidth / 1024, innerHeight / 768);
  canvas.style.width = Math.floor(1024 * s) + 'px';
  canvas.style.height = Math.floor(768 * s) + 'px';
}
addEventListener('resize', fit);
fit();

let game;
let mode = 'loading';
let title = null;

async function boot() {
  drawLoading('Loading…');
  await Promise.all([document.fonts.load('26px "Power Clear"'), loadData(), loadTilesets(),
    loadEssMaps(Object.values(MAPS).filter(d => d.ess).map(d => d.ess))]);
  await preload(['ui/windowskins/speech frlg.png', 'ui/windowskins/choice 1.png', 'ui/windowskins/signskin.png', 'ui/titles/title.png', 'ui/titles/start.png',
    'ui/sel_arrow.png', 'ui/pause_arrow.png', 'ui/types.png', 'ui/Party/bg.png', 'ui/Party/panel_round.png', 'ui/Party/panel_rect.png',
    'ui/Party/panel_round_sel.png', 'ui/Party/panel_rect_sel.png', 'ui/Party/panel_blank.png', 'ui/Party/overlay_hp.png', 'ui/Party/overlay_hp_back.png',
    'ui/Party/icon_ball.png', 'ui/Party/icon_ball_sel.png', 'ui/Party/icon_cancel.png', 'ui/Party/icon_cancel_sel.png',
    ...[1, 2, 3, 4, 5, 7, 8].flatMap(n => [`ui/Bag/bg_${n}.png`, `ui/Bag/bag_${n}.png`, `ui/Bag/bag_${n}_f.png`]),
    'ui/Battle/databox_normal.png', 'ui/Battle/databox_normal_foe.png', 'ui/Battle/overlay_hp.png', 'ui/Battle/overlay_exp.png',
    'ui/Battle/overlay_command.png', 'ui/Battle/overlay_fight.png', 'ui/Battle/cursor_command.png', 'ui/Battle/cursor_fight.png',
    'ui/Battle/overlay_lv.png', 'ui/Battle/icon_statuses.png', 'battle/backgrounds/field_bg.png', 'battle/backgrounds/field_message.png',
    'battle/backgrounds/grass_base0.png', 'battle/backgrounds/grass_base1.png', 'ui/Summary/bg_1.png', 'ui/Summary/bg_3.png', 'ui/Summary/bg_4.png',
    'ui/Naming/bg.png', 'overworld/characters/Object ball.png']);
  game = new Game();
  window.game = game; // handy for debugging from the console
  mode = 'title';
  title = new TitleScreen();
  requestAnimationFrame(loop);
}

function drawLoading(msg) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1024, 768);
  ctx.fillStyle = '#fff'; ctx.font = '32px sans-serif'; ctx.fillText(msg, 420, 384);
}

// Fixed 60 Hz simulation
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; }
  render();
  requestAnimationFrame(loop);
}

function step() {
  if (mode === 'title') title.update();
  else if (mode === 'setup' || mode === 'play') {
    game.update();
    if (mode === 'setup' && game.players.every(p => p.ready)) startAdventure();
  }
}

function render() {
  if (mode === 'title') { title.draw(ctx); return; }
  for (let i = 0; i < 3; i++) {
    const { g } = VIEWS[i];
    const p = game.players[i];
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 384);
    // draw from the last opaque scene upwards
    let from = 0;
    for (let k = p.stack.length - 1; k >= 0; k--) if (p.stack[k].opaque) { from = k; break; }
    for (let k = from; k < p.stack.length; k++) p.stack[k].draw(g);
  }
  drawTeamPanel(VIEWS[3].g);
  for (let i = 0; i < 4; i++) {
    ctx.drawImage(VIEWS[i].c, VIEW_POS[i][0], VIEW_POS[i][1]);
  }
  // player colour frames
  ctx.lineWidth = 4;
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = game.players[i].color;
    ctx.strokeRect(VIEW_POS[i][0] + 2, VIEW_POS[i][1] + 2, 508, 380);
  }
}

// ------------------------------------------------------------------ team panel
function drawTeamPanel(g) {
  g.fillStyle = '#F8F0D8'; g.fillRect(0, 0, 512, 384);
  g.fillStyle = '#E8D8A8'; g.fillRect(0, 0, 512, 44);
  text(g, 'TEAM', 16, 8, { color: '#604820', shadow: '#F8E8B8' });
  const obj = game.objective || (mode === 'setup' ? 'Everyone: pick your trainer!' : '');
  if (obj) text(g, obj, 100, 10, { color: '#484848', shadow: '#F8E8B8', size: 22 });
  game.players.forEach((p, i) => {
    const y = 52 + i * 104;
    g.fillStyle = p.color; g.fillRect(8, y, 6, 96);
    text(g, `P${i + 1} ${p.name}`, 24, y, { color: '#303030', shadow: '#D8C8A0' });
    const mapName = p.mapId && MAPS[p.mapId] ? MAPS[p.mapId].name : '';
    text(g, mapName, 500, y + 2, { color: '#686868', shadow: '#E8E0C8', size: 20, align: 'right' });
    p.party.forEach((pk, k) => {
      const ic = img(pk.sp.sprites.icon);
      if (isReady(ic)) g.drawImage(ic, (Math.floor(game.frame / 20) % 2) * 64, 0, 64, 64, 20 + k * 66, y + 26, 64, 64);
      const f = pk.hp / pk.maxHp;
      g.fillStyle = '#404040'; g.fillRect(28 + k * 66, y + 88, 48, 5);
      g.fillStyle = f > 0.5 ? '#40C840' : f > 0.2 ? '#F8C020' : '#F83820'; g.fillRect(28 + k * 66, y + 88, 48 * f, 5);
    });
    if (p.badges.length) text(g, `★${p.badges.length}`, 470, y + 30, { color: '#C89020', shadow: '#F8E8B8', size: 22 });
    if (p.top && p.top.constructor.name === 'BattleScene') text(g, 'BATTLING!', 440, y + 60, { color: '#E83030', shadow: '#F8C8B8', size: 20, align: 'center' });
  });
  g.fillStyle = '#E8D8A8'; g.fillRect(0, 364, 512, 20);
}

// ------------------------------------------------------------------ title
class TitleScreen {
  constructor() {
    this.t = 0;
    this.choice = 0;
    this.hasSave = Game.hasSave();
    this.phase = 'press';
    this.prevDown = true;
  }
  update() {
    this.t++;
    for (const p of game.players) p.input.poll();
    const inputs = game.players.map(p => p.input);
    const pressed = b => inputs.some(i => i.pressed(b));
    if (this.phase === 'press') {
      if (inputs.some(i => i.anyPressed())) {
        unlock();
        requestBgm('title', 'Title.ogg', 0);
        se('GUI sel decision');
        this.phase = 'menu';
      }
      return;
    }
    const n = this.hasSave ? 2 : 1;
    if (pressed('up') || pressed('down')) { this.choice = (this.choice + 1) % n; se('GUI sel cursor', 0.5); }
    if (pressed('a') || pressed('start')) {
      se('GUI sel decision');
      requestBgm('title', null);
      if (this.hasSave && this.choice === 0) {
        game.load();
        mode = 'play';
      } else startSetup();
    }
  }
  draw(g) {
    g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 768);
    const t = img('ui/titles/title.png');
    if (isReady(t)) {
      g.drawImage(t, 0, 0, 1024, 768);
      // Cover the Essentials wordmark and version with our own subtitle
      const band = g.createLinearGradient(0, 236, 0, 330);
      band.addColorStop(0, '#1E60C8'); band.addColorStop(1, '#58B0F0');
      g.fillStyle = band; g.fillRect(250, 240, 524, 84);
      g.fillStyle = '#000'; g.fillRect(0, 724, 1024, 44);
      text(g, 'SOLARA ADVENTURE', 512, 252, { color: '#F8E050', shadow: '#704010', size: 56, align: 'center', family: '"Power Clear Bold"' });
      text(g, 'A 3-Player Journey', 512, 740, { color: '#F8F8F8', shadow: '#404040', size: 24, align: 'center' });
    }
    if (this.phase === 'press') {
      if (Math.floor(this.t / 30) % 2 === 0) {
        const s = img('ui/titles/start.png');
        if (isReady(s)) g.drawImage(s, 512 - s.width, 600, s.width * 2, s.height * 2);
      }
      return;
    }
    const items = this.hasSave ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME'];
    g.save(); g.scale(2, 2);
    drawWindow(g, 156, 230, 200, 32 + items.length * 32);
    items.forEach((it, i) => {
      text(g, it, 196, 246 + i * 32);
      if (i === this.choice) drawArrow(g, 172, 248 + i * 32);
    });
    g.restore();
  }
}

// ------------------------------------------------------------------ character setup
function startSetup() {
  mode = 'setup';
  game.players.forEach(p => { p.ready = false; p.stack = [new SetupScene(p)]; });
}

class SetupScene extends Scene {
  constructor(p) {
    super();
    this.opaque = true;
    this.p = p;
    this.choices = Object.keys(AVATARS);
    this.index = p.index % this.choices.length;
    this.phase = 'avatar';
  }
  update(input) {
    if (this.phase === 'avatar') {
      if (input.repeatPressed('left')) { this.index = (this.index + this.choices.length - 1) % this.choices.length; se('GUI sel cursor', 0.5); }
      if (input.repeatPressed('right')) { this.index = (this.index + 1) % this.choices.length; se('GUI sel cursor', 0.5); }
      if (input.pressed('a')) {
        se('GUI sel decision');
        this.p.avatar = this.choices[this.index];
        this.phase = 'name';
        this.p.push(new NamingScene('Your name?', 8, null, '')).then(name => {
          if (!name) { this.phase = 'avatar'; return; }
          this.p.name = name;
          this.phase = 'ready';
          this.p.ready = true;
        });
      }
    } else if (this.phase === 'ready' && input.pressed('b')) {
      this.phase = 'avatar'; this.p.ready = false;
    }
  }
  draw(g) {
    g.fillStyle = '#284878'; g.fillRect(0, 0, 512, 384);
    g.fillStyle = this.p.color; g.fillRect(0, 0, 512, 48);
    text(g, `PLAYER ${this.p.index + 1}`, 256, 10, { color: '#fff', shadow: '#303030', align: 'center' });
    text(g, KEY_LABELS[this.p.index], 256, 350, { color: '#F8F8F8', shadow: '#202020', size: 20, align: 'center' });
    if (this.phase === 'ready') {
      const av = AVATARS[this.p.avatar];
      const i = img(av.front);
      if (isReady(i)) g.drawImage(i, 256 - i.width, 250 - i.height * 2, i.width * 2, i.height * 2);
      text(g, `${this.p.name} is ready!`, 256, 270, { color: '#F8F8F8', shadow: '#202020', align: 'center' });
      text(g, 'Waiting for the others… (B = change)', 256, 306, { color: '#C8D8F8', shadow: '#202020', size: 20, align: 'center' });
      return;
    }
    text(g, 'Choose your trainer', 256, 60, { color: '#F8F8F8', shadow: '#202020', align: 'center' });
    this.choices.forEach((k, n) => {
      const av = AVATARS[k];
      const x = 64 + n * 128;
      const i = img(av.front);
      if (n === this.index) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - 60, 100, 120, 200); }
      if (isReady(i)) g.drawImage(i, x - i.width, 270 - i.height * 2, i.width * 2, i.height * 2);
      text(g, av.name, x, 290, { color: '#F8F8F8', shadow: '#202020', size: 22, align: 'center' });
    });
    text(g, '◀ ▶ choose · A = select', 256, 318, { color: '#C8D8F8', shadow: '#202020', size: 20, align: 'center' });
  }
}

function startAdventure() {
  mode = 'play';
  game.players.forEach((p, i) => {
    p.ready = false;
    p.stack = [new OverworldScene(game, p)];
    const s = START[i];
    p.returnTo = s.door;
    game.placePlayer(p, s.map, s.x, s.y, s.dir);
  });
  game.objective = 'Meet Professor Aspen in her lab!';
}

boot().catch(e => { console.error(e); drawLoading('Error: ' + e.message); });
export { SPECIES, cry, draw, anyKeyDown };
