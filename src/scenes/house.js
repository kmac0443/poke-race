// 🏠 A child's house (places `home0` / `home1` on the farm): a big room (game/house.js: COLS × ROWS floor tiles at
// the farm's scale, scrolling) with furniture bought in the shop, and the Pokémon who live here wandering about.
//
// 🚶 Walk mode (how you come in): walk about with the arrows (B runs), your follower behind you. Just like on the
//   farm: A facing one of your Pokémon who lives here → it follows you (your old follower moves in where it stood);
//   A facing your follower, or B held standing still (a ring fills) → it moves in. In a sibling's house A says
//   hello. A facing furniture uses it (settings.furniture `use`): 🛏️ a nap, 🛋️ sit down, 📺 the TV
//   comes on, 🌴 water the plant, 🍰 a snack on the table the Pokémon come running for. Walk out through the door
//   at the bottom to leave. Tab: edit mode (your own house only).
// ✏️ Edit mode: a toolbar, and a cursor on the floor instead of your trainer:
//   🪑 place    pick a piece from the bag, steer it (green = fits), A → a math question → it's placed
//   ✋ move      steer to a piece, A to lift it, steer, A → a math question → it's moved
//   🗑️ put away  steer to a piece, A → a math question → back in the bag
//   🧱 walls     pick a style, a math question, then build (or knock down) up to wallsPerAnswer blocks with A
//   🚶 walk      (B or Tab too) back to walking
// Every furniture change, and every use of a piece, needs a right answer first (scenes/mathAsk.js); following and
// moving in don't (they're the farm's rules). A sibling visiting can walk about, say hello and use things, but not change anything.
import { Scene } from '../core/ui.js';
import { img, isReady } from '../core/assets.js';
import { se, cry, jingle } from '../core/audio.js';
import { SPECIES } from '../game/species.js';
import { activePokemon } from '../game/pokemon.js';
import { bagItems } from '../game/bag.js';
import { COLS, ROWS, DOOR, houseOf, furnitureInfo, pieceAt, canPlace, place, move, putAway, walkable, residents, sendHome, takeAlong, wallAt, toggleWall } from '../game/house.js';
import { Character, WALK_FRAMES, RUN_FRAMES } from '../world/character.js';
import { DIRS } from '../world/map.js';
import { AVATARS } from '../data/avatars.js';
import { MathAskScene } from './mathAsk.js';
import { drawItem } from './shop.js';
import { drawHeader, icon, shake } from './common.js';

const VW = 512, VH = 384, T = 32;
const TOP = 36;                                     // the view starts under the header…
const BAR = 48;                                     // …and in edit mode under the toolbar too
const OX = T, OY = 3 * T;                           // the floor's top-left in the room picture (walls round it)
const ROOM_W = (COLS + 2) * T, ROOM_H = (ROWS + 4) * T;
const TURN_FRAMES = 8;
const TOOLS = [{ key: 'place', icon: '🪑' }, { key: 'move', icon: '✋' }, { key: 'remove', icon: '🗑️' }, { key: 'wall', icon: '🧱' }, { key: 'walk', icon: '🚶' }];
const LET_GO_FRAMES = 60;   // hold B standing still this long: your follower moves in (as on the farm)
const USE_FRAMES = { sleep: 170, sit: 150, watch: 200, water: 100, snack: 160, tidy: 70, spin: 80 };
const USE_ICON = { sleep: '🛏️', sit: '🛋️', watch: '📺', water: '🌴', snack: '🍰', tidy: '✨', spin: '🌀' };
const monSheet = id => SPECIES.get(id)?.sprites.run || null;

export class HouseScene extends Scene {
  constructor(owner) {
    super();
    this.opaque = true;
    this.music = 'Home.wav';
    this.owner = owner;          // whose house (profile index)
    this.t = 0;
    this.mode = 'walk';          // walk | tools | pick | floor | select | carry | wallstyle | build
    this.bHold = 0;              // frames B has been held standing still (-1: done, wait for release)
    this.tool = 0; this.pick = 0; this.cell = [DOOR.x, DOOR.y - 1]; this.item = null; this.piece = null; this.action = null;
    this.shakeT = 0; this.sparkle = null; this.effects = [];
    this.me = null; this.follower = null;
    this.mons = new Map();       // uid → { pk, char, wait, hop } the Pokémon who live here
    this.using = null;           // { use, piece, t, tv } furniture being used
  }

  get profile() { return this.seat.game.save.profiles[this.owner]; }
  get mine() { return this.seat.profileIndex === this.owner; }
  get editing() { return this.mode !== 'walk'; }

  start() {
    const av = AVATARS[this.seat.profile.avatar] || AVATARS.Red;
    this.me = new Character(DOOR.x, DOOR.y, av.walk, 'up');
    this.follower = new Character(DOOR.x, DOOR.y, null, 'up');
    this.needRelease = true;     // the arrow that walked in through the door doesn't keep walking in here
    this.started = true;
  }

  update(input) {
    if (!this.started) this.start();
    this.t++;
    if (this.shakeT > 0) this.shakeT--;
    if (this.sparkle && --this.sparkle.t <= 0) this.sparkle = null;
    this.effects = this.effects.filter(e => --e.t > 0);
    this.updateResidents();
    const pk = activePokemon(this.seat.profile);
    this.follower.sprite = pk && !pk.home ? monSheet(pk.species) : null;
    this.me.updateMove(); this.follower.updateMove();
    if (this.asking) return;
    if (this.using) return this.updateUse(input);
    if (this.mode === 'walk') return this.updateWalk(input);
    if (this.mode === 'tools') return this.updateTools(input);
    return this.updateEdit(input);
  }

  // ------------------------------------------------------------------ 🚶 walking about
  updateWalk(input) {
    const me = this.me;
    if (input.pressed('start') && this.mine) { se('GUI menu open', 0.6); this.mode = 'tools'; this.tool = 0; this.cell = [me.x, Math.min(ROWS - 1, me.y)]; return; }
    if (input.pressed('a') && !me.moving) { this.interact(); return; }
    const dir = input.dir();
    if (this.needRelease) { if (dir) return; this.needRelease = false; }
    // B held while walking is running; held standing still, your follower moves in (as on the farm)
    if (!input.isDown('b')) this.bHold = 0;
    else if (this.bHold >= 0) {
      const still = !dir && !me.moving && this.follower.sprite && !this.follower.moving && this.mine;
      this.bHold = still ? this.bHold + 1 : 0;
      if (this.bHold >= LET_GO_FRAMES) { this.moveIn(); this.bHold = -1; }
    }
    this.held = dir && dir === this.heldDir ? this.held + 1 : 1;
    this.heldDir = dir;
    if (!dir || me.moving) { if (!dir) this.walking = false; return; }
    if (!this.walking && dir !== me.dir && this.held < TURN_FRAMES) { me.dir = dir; return; }   // a tap turns
    me.dir = dir;
    const d = DIRS[dir], nx = me.x + d.dx, ny = me.y + d.dy;
    if (me.x === DOOR.x && me.y === DOOR.y && dir === 'down') { se('Door exit'); this.close(); return; }   // out the door
    if (!walkable(this.profile, this.seat.settings, nx, ny) || this.monAt(nx, ny)) return;
    const fromX = me.x, fromY = me.y, frames = input.isDown('b') ? RUN_FRAMES : WALK_FRAMES;
    me.startMove(dir, frames);
    this.walking = true;
    const f = this.follower, fdx = fromX - f.x, fdy = fromY - f.y;
    if (Math.abs(fdx) + Math.abs(fdy) === 1) f.startMove(fdx ? (fdx > 0 ? 'right' : 'left') : (fdy > 0 ? 'down' : 'up'), frames);
    else if (fdx || fdy) f.place(fromX, fromY, me.dir);
  }

  /**
   * A in walk mode, as on the farm: your follower → it moves in; one of yours who lives here → it follows you (in a
   * sibling's house: hello); furniture → it gets used (after a question).
   */
  interact() {
    const { x, y } = this.me.facing(), m = this.monAt(x, y), fl = this.follower;
    if (fl.sprite && fl.x === x && fl.y === y && !fl.moving) { if (this.mine) this.moveIn(); else this.hello(x, y, activePokemon(this.seat.profile)); return; }
    if (m) {
      m.char.dir = DIRS[this.me.dir].opp;
      if (this.mine) this.follow(m); else { m.wait = 90; m.hop = 30; this.hello(x, y, m.pk); }
      return;
    }
    const piece = pieceAt(this.profile, this.seat.settings, x, y), f = piece && furnitureInfo(this.seat.settings, piece.item);
    if (!f || !f.use) return;
    this.ask(USE_ICON[f.use], () => this.use(f, piece));    // a right answer first, like every furniture change
  }

  hello(x, y, pk) {
    if (!pk) return;
    cry(SPECIES.get(pk.species)?.sprites.cry, 0.8);
    this.effects.push({ x, y, icon: '❤️', t: 60 });
  }

  /** Your follower moves in here: it stays where it stands and wanders the room; you walk alone. */
  moveIn() {
    const p = this.profile, pk = activePokemon(p), f = this.follower;
    if (!pk || pk.home) return;
    sendHome(p, pk);
    this.mons.set(pk.uid, this.newMon(pk, f.x, f.y));
    f.sprite = null;
    this.seat.game.store();
    cry(SPECIES.get(pk.species)?.sprites.cry, 0.8);
    this.effects.push({ x: f.x, y: f.y, icon: '🏠', t: 60 });
  }

  /** One who lives here follows you; whoever was following moves in where it stood. */
  follow(m) {
    const p = this.profile, old = activePokemon(p);
    takeAlong(p, m.pk);
    this.mons.delete(m.pk.uid);
    if (old && old !== m.pk) this.mons.set(old.uid, this.newMon(old, m.char.x, m.char.y));
    if (!old) this.follower.place(this.me.x, this.me.y, this.me.dir);   // nobody was following: it falls in behind you
    this.seat.game.store();
    se('GUI party switch', 0.7);
    cry(SPECIES.get(m.pk.species)?.sprites.cry, 0.9);
    this.effects.push({ x: this.follower.x, y: this.follower.y, icon: '❤️', t: 60 });
  }

  /** Using a piece: a nap, a sit, the TV, watering, a snack. */
  use(f, piece) {
    this.using = { use: f.use, piece, t: 0 };
    const all = [...this.mons.values()];
    if (f.use === 'sleep') { jingle('Pkmn healing'); }
    else if (f.use === 'sit') { se('GUI sel decision'); }
    else if (f.use === 'watch') {                  // someone on TV: one who lives here, or any Pokémon
      const pool = all.length ? all.map(m => m.pk.species) : [...SPECIES.values()].filter(s => s.sprites.icon).map(s => s.id);
      this.using.tv = pool[Math.floor(Math.random() * pool.length)];
      se('move-anims/Flash2', 0.6);
    } else if (f.use === 'water') { se('move-anims/Water1', 0.8); }
    else if (f.use === 'snack') { jingle('Berry get'); }
    else if (f.use === 'tidy') { se('move-anims/Saint6', 0.7); this.sparkle = { x: piece.x, y: piece.y, t: 60 }; }
    else if (f.use === 'spin') { se('move-anims/Wind1', 0.6); }
    if (f.use !== 'water') for (const r of all) r.hop = f.use === 'sleep' ? 0 : 40;
  }

  updateUse(input) {
    const u = this.using;
    u.t++;
    if (u.use === 'watch' && u.t === 30) cry(SPECIES.get(u.tv)?.sprites.cry, 0.7);
    if (u.use === 'spin') {                         // a twirl at the dresser, then a sparkle
      this.me.dir = ['down', 'left', 'up', 'right'][Math.floor(u.t / 6) % 4];
      if (u.t === USE_FRAMES.spin - 1) { this.me.dir = 'down'; this.effects.push({ x: this.me.x, y: this.me.y, icon: '✨', t: 50 }); }
    }
    if (u.use === 'water' && u.t === 50) { se('move-anims/Saint6', 0.6); this.sparkle = { x: u.piece.x, y: u.piece.y - 1, t: 40 }; }
    if (u.use === 'snack' && u.t % 40 === 20) for (const m of this.mons.values()) { m.hop = 30; this.effects.push({ x: m.char.x, y: m.char.y, icon: '❤️', t: 50 }); }
    const early = u.use === 'sit' && u.t > 20 && (input.dir() || input.pressed('a') || input.pressed('b'));   // stand up
    if (u.t >= USE_FRAMES[u.use] || early) this.using = null;
  }

  monAt(x, y) { for (const m of this.mons.values()) if (m.char.x === x && m.char.y === y) return m; return null; }

  // ------------------------------------------------------------------ ✏️ editing
  updateTools(input) {
    const n = TOOLS.length;
    if (input.repeatPressed('left')) { this.tool = (this.tool + n - 1) % n; se('GUI sel cursor', 0.4); }
    if (input.repeatPressed('right')) { this.tool = (this.tool + 1) % n; se('GUI sel cursor', 0.4); }
    if (input.pressed('b') || input.pressed('start')) { se('GUI menu close', 0.6); this.mode = 'walk'; return; }
    if (!input.pressed('a')) return;
    const key = TOOLS[this.tool].key;
    if (key === 'walk') { se('GUI menu close', 0.6); this.mode = 'walk'; return; }
    if (key === 'place') {
      if (!this.bagFurniture().length) return this.buzz();
      this.mode = 'pick'; this.pick = 0;
    } else if (key === 'move' || key === 'remove') {
      if (!houseOf(this.profile).items.length) return this.buzz();
      this.mode = 'select'; this.action = key;
    } else if (key === 'wall') {
      this.mode = 'wallstyle'; this.pick = 0;
    }
    se('GUI sel decision');
  }

  updateEdit(input) {
    const m = this.mode;
    if (input.pressed('b') || input.pressed('start')) {
      se('GUI sel cancel', 0.6);
      if (m === 'carry') { this.mode = 'select'; this.piece = null; } else this.mode = 'tools';
      return;
    }
    if (m === 'pick' || m === 'wallstyle') return this.updateStrip(input);
    // on the floor: the arrows steer the cursor
    let [x, y] = this.cell;
    if (input.repeatPressed('left')) x--;
    if (input.repeatPressed('right')) x++;
    if (input.repeatPressed('up')) y--;
    if (input.repeatPressed('down')) y++;
    const s = this.seat.settings, p = this.profile;
    const f = m === 'floor' ? furnitureInfo(s, this.item) : m === 'carry' ? furnitureInfo(s, this.piece.item) : { fw: 1, fh: 1 };
    x = Math.max(0, Math.min(COLS - f.fw, x)); y = Math.max(0, Math.min(ROWS - f.fh, y));
    if (x !== this.cell[0] || y !== this.cell[1]) { this.cell = [x, y]; se('GUI sel cursor', 0.3); }
    if (!input.pressed('a')) return;
    if (m === 'build') {                            // a wall block here, or knock one down
      const person = [this.me, ...[...this.mons.values()].map(o => o.char)].some(c => c.x === x && c.y === y) ||
        (!!this.follower.sprite && this.follower.x === x && this.follower.y === y);
      const done = person ? null : toggleWall(p, s, x, y, this.wallStyle);
      if (!done) return this.buzz();
      se(done === 'built' ? 'move-anims/rock1' : 'Rock Smash', 0.6);
      this.seat.game.store();
      if (--this.wallsLeft <= 0) { this.celebrate(x, y); this.mode = 'tools'; }
      return;
    }
    if (m === 'floor') {
      if (!canPlace(p, s, this.item, x, y) || this.someoneOn(this.item, x, y)) return this.buzz();
      this.ask('🪑', () => { place(p, s, this.item, x, y); this.celebrate(x, y); this.mode = 'tools'; });
    } else if (m === 'select') {
      const piece = pieceAt(p, s, x, y);
      if (!piece) return this.buzz();
      if (this.action === 'remove') this.ask('🗑️', () => { putAway(p, piece); this.celebrate(x, y); this.mode = 'tools'; });
      else { this.piece = piece; this.cell = [piece.x, piece.y]; this.mode = 'carry'; se('GUI sel decision'); }
    } else if (m === 'carry') {
      if (!canPlace(p, s, this.piece.item, x, y, this.piece) || this.someoneOn(this.piece.item, x, y)) return this.buzz();
      const piece = this.piece;
      this.ask('✋', () => { move(p, s, piece, x, y); this.celebrate(x, y); this.piece = null; this.mode = 'tools'; });
    }
  }

  /** Would a (non-rug) piece at (x, y) land on someone standing there? */
  someoneOn(item, x, y) {
    const f = furnitureInfo(this.seat.settings, item);
    if (f.floor) return false;
    const inside = c => c.x >= x && c.x < x + f.fw && c.y >= y && c.y < y + f.fh;
    return inside(this.me) || [...this.mons.values()].some(m => inside(m.char)) || (!!this.follower.sprite && inside(this.follower));
  }

  /** A strip in the toolbar: furniture from the bag, or wall styles. */
  updateStrip(input) {
    const list = this.mode === 'pick' ? this.bagFurniture() : this.seat.settings.wallStyles, n = list.length;
    if (!n) { this.mode = 'tools'; return; }
    if (input.repeatPressed('left')) { this.pick = (this.pick + n - 1) % n; se('GUI sel cursor', 0.4); }
    if (input.repeatPressed('right')) { this.pick = (this.pick + 1) % n; se('GUI sel cursor', 0.4); }
    this.pick = Math.min(this.pick, n - 1);
    if (!input.pressed('a')) return;
    se('GUI sel decision');
    if (this.mode === 'pick') { this.item = list[this.pick][0]; this.mode = 'floor'; return; }
    if (this.mode === 'wallstyle') {                // one right answer: a run of wall
      const style = list[this.pick].key;
      this.ask('🧱', () => { this.mode = 'build'; this.wallStyle = style; this.wallsLeft = this.seat.settings.wallsPerAnswer; });
      return;
    }
  }

  bagFurniture() { return bagItems(this.profile, this.seat.settings).filter(([it]) => furnitureInfo(this.seat.settings, it)); }

  /** A math question first; `then` only on a right answer. */
  ask(what, then) {
    this.asking = true;
    this.seat.push(new MathAskScene({ icon: what })).then(ok => {
      this.asking = false;
      if (!ok) return;
      then();
      this.seat.game.store();
    });
  }

  celebrate(x, y) {
    se('Pkmn move learnt', 0.6);
    this.sparkle = { x, y, t: 50 };
    for (const m of this.mons.values()) m.hop = 30;          // everyone at home likes it
  }

  buzz() { se('GUI sel buzzer'); this.shakeT = 14; }

  // ------------------------------------------------------------------ the Pokémon who live here
  newMon(pk, x, y) { return { pk, char: new Character(x, y, monSheet(pk.species), 'down'), wait: 30 + (pk.uid * 13) % 60, hop: 0 }; }

  updateResidents() {
    const p = this.profile, s = this.seat.settings, living = residents(p);
    for (const pk of living) {
      if (this.mons.has(pk.uid)) continue;
      for (let k = 0; k < 200; k++) {                      // a free spot, the same one each time for the same Pokémon
        const x = (pk.uid * 7 + k * 5) % COLS, y = (pk.uid * 3 + k * 2) % (ROWS - 2);
        if (walkable(p, s, x, y) && !this.monAt(x, y)) { this.mons.set(pk.uid, this.newMon(pk, x, y)); break; }
      }
    }
    const napping = this.using && this.using.use === 'sleep';
    for (const [uid, m] of this.mons) {
      if (!living.some(pk => pk.uid === uid)) { this.mons.delete(uid); continue; }
      if (m.hop > 0) m.hop--;
      m.char.updateMove();
      if (napping || m.char.moving || --m.wait > 0) continue;
      m.wait = 40 + Math.floor(Math.random() * 140);
      const dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)], d = DIRS[dir];
      const nx = m.char.x + d.dx, ny = m.char.y + d.dy;
      m.char.dir = dir;
      const taken = (this.me.x === nx && this.me.y === ny) || (this.follower.sprite && this.follower.x === nx && this.follower.y === ny) || this.monAt(nx, ny);
      if (walkable(p, s, nx, ny) && !taken && !(nx === DOOR.x && ny === DOOR.y)) m.char.startMove(dir, 24);
    }
  }

  // ------------------------------------------------------------------ drawing
  /** The camera: on your trainer while walking, on the cursor while editing. */
  camera() {
    const top = TOP + (this.editing ? BAR : 0), viewH = VH - top;
    const [fx, fy] = this.editing ? [this.cell[0] * T, this.cell[1] * T] : [this.me.px, this.me.py];
    const cx = Math.max(0, Math.min(ROOM_W - VW, OX + fx + T / 2 - VW / 2));
    const cy = Math.max(0, Math.min(ROOM_H - viewH, OY + fy + T / 2 - viewH / 2));
    return { cx: Math.round(cx), cy: Math.round(cy), top };
  }

  draw(g) {
    if (!this.started) return;
    const p = this.profile, s = this.seat.settings, { cx, cy, top } = this.camera(), u = this.using;
    g.fillStyle = '#403028'; g.fillRect(0, 0, VW, VH);
    g.save(); g.translate(-cx, top - cy);
    this.drawRoom(g, p);
    // rugs, then everything that stands (furniture, Pokémon, you) from the back of the room to the front
    const items = houseOf(p).items.filter(it => it !== this.piece || this.mode !== 'carry');
    for (const it of items) if (furnitureInfo(s, it.item)?.floor) this.drawPiece(g, it);
    const stand = items.filter(it => !furnitureInfo(s, it.item)?.floor).map(it => ({ y: (it.y + furnitureInfo(s, it.item).fh) * T - 1, draw: () => this.drawPiece(g, it) }));
    for (const w of houseOf(p).walls) stand.push({ y: (w.y + 1) * T - 1, draw: () => this.drawWall(g, w) });
    const ch = (c, extra) => stand.push({ y: c.py + T, draw: () => { c.draw(g, -OX, -OY); if (extra) extra(); } });
    for (const m of this.mons.values()) ch(m.char, () => {
      const x = OX + m.char.px + T / 2, y = OY + m.char.py;
      if (u && u.use === 'sleep') icon(g, '💤', x + 10, y - 26 - Math.round(Math.sin(this.t / 15) * 3), 16, 'center');
      else if (m.hop > 10) { const hop = Math.round(Math.abs(Math.sin(m.hop / 5)) * 12); icon(g, '❤️', x, y - 30 - hop, 16, 'center'); }
    });
    if (this.follower.sprite) ch(this.follower);
    const sitting = u && u.use === 'sit';
    if (sitting) {                                  // sitting on it: drawn on the seat, bobbing to the music
      const f = furnitureInfo(s, u.piece.item);
      stand.push({ y: (u.piece.y + f.fh) * T, draw: () => {
        const bob = Math.round(Math.abs(Math.sin(u.t / 8)) * -3);
        const c = { ...this.me, px: (u.piece.x + (f.fw - 1) / 2) * T, py: (u.piece.y + f.fh - 1) * T - 10 + bob, moving: false, dir: 'down', draw: this.me.draw };
        this.me.draw.call(c, g, -OX, -OY);
        if (u.t % 40 < 30) icon(g, '🎵', OX + c.px + T, OY + c.py - 24, 16, 'center');
      } });
    } else ch(this.me, () => { g.strokeStyle = this.seat.color; g.lineWidth = 3; g.beginPath(); g.ellipse(OX + this.me.px + T / 2, OY + this.me.py + T - 5, 13, 6, 0, 0, Math.PI * 2); g.stroke(); });
    stand.sort((a, b) => a.y - b.y).forEach(d => d.draw());
    if (this.bHold > 10 && this.follower.sprite) {  // moving in: a ring fills over the follower (as on the farm)
      const x = OX + this.follower.px + T / 2, y = OY + this.follower.py - 20;
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6; g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#F8F8F8'; g.lineWidth = 4;
      g.beginPath(); g.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.bHold / LET_GO_FRAMES); g.stroke();
    }
    if (u) this.drawUse(g, u);
    for (const e of this.effects) icon(g, e.icon, OX + e.x * T + T / 2, OY + e.y * T - 20 - (60 - e.t) * 0.4, 20, 'center');
    this.drawCursor(g);
    if (this.sparkle) for (let k = 0; k < 6; k++) {
      const a = k + this.t / 8;
      icon(g, '✨', OX + this.sparkle.x * T + T / 2 + Math.cos(a) * 30, OY + this.sparkle.y * T + Math.sin(a) * 20, 18, 'center');
    }
    g.restore();
    if (u && u.use === 'sleep') {                   // a nap: the lights go down and come back up
      g.fillStyle = `rgba(10,10,40,${0.65 * Math.sin(Math.min(1, u.t / USE_FRAMES.sleep) * Math.PI)})`; g.fillRect(0, top, VW, VH - top);
      icon(g, '💤', VW / 2, 150 - Math.round(Math.sin(u.t / 12) * 6), 40, 'center');
    }
    drawHeader(g, this.seat);
    g.fillStyle = p.color; g.beginPath(); g.arc(VW / 2, 18, 16, 0, Math.PI * 2); g.fill();
    icon(g, '🏠', VW / 2, 5, 22, 'center');
    icon(g, this.editing ? '✏️' : '🚶', VW - 30, 6, 22, 'center');
    if (this.editing) this.drawBar(g);
  }

  /** What using a piece looks like on it: the TV's picture, water on a plant, a snack on a table. */
  drawUse(g, u) {
    const f = furnitureInfo(this.seat.settings, u.piece.item), x = OX + u.piece.x * T, y = OY + (u.piece.y + f.fh) * T - f.src[3];
    if (u.use === 'watch') {
      const flick = ['#88D0F8', '#F8E070', '#F898C8', '#98E888'][Math.floor(u.t / 12) % 4];
      g.fillStyle = flick; g.fillRect(x + 6, y + 6, f.src[2] - 12, 22);
      const ic = img(SPECIES.get(u.tv)?.sprites.icon || '');
      if (isReady(ic)) g.drawImage(ic, (Math.floor(u.t / 12) % 2) * 64, 0, 64, 64, x - 8, y - 42, 48, 48);
    } else if (u.use === 'water') {
      if (u.t < 50) for (let k = 0; k < 3; k++) icon(g, '💧', x + 8 + k * 8, y - 16 + ((u.t * 2 + k * 12) % 30), 12, 'center');
    } else if (u.use === 'snack') {
      icon(g, f.icon || '🍰', x + f.fw * T / 2, y + 2 - Math.round(Math.abs(Math.sin(u.t / 10)) * 3), 22, 'center');
    }
  }

  /** Walls in the owner's colour with windows, a wooden floor, a doormat at the way out. */
  drawRoom(g, p) {
    g.fillStyle = '#E8DCC8'; g.fillRect(0, 0, ROOM_W, OY);
    g.fillStyle = p.color; g.globalAlpha = 0.3; g.fillRect(0, 0, ROOM_W, OY); g.globalAlpha = 1;
    for (let x = 0; x < ROOM_W; x += 24) { g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x, 0, 8, OY); }
    for (const wx of [3, 9, 15]) {
      g.fillStyle = '#A8D8F8'; g.fillRect(OX + wx * T - 8, 22, 80, 44);
      g.strokeStyle = '#806040'; g.lineWidth = 4; g.strokeRect(OX + wx * T - 8, 22, 80, 44);
      g.fillStyle = '#806040'; g.fillRect(OX + wx * T + 30, 22, 4, 44);
    }
    g.fillStyle = '#806040'; g.fillRect(0, OY - 6, ROOM_W, 6);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      g.fillStyle = (x + (y % 2 ? 1 : 0)) % 2 ? '#C89868' : '#D0A474'; g.fillRect(OX + x * T, OY + y * T, T, T);
      g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(OX + x * T, OY + y * T + T - 2, T, 2);
    }
    g.fillStyle = '#6C4C30';                         // side walls and the bottom wall, with the door gap
    g.fillRect(0, OY, OX, ROWS * T); g.fillRect(OX + COLS * T, OY, OX, ROWS * T);
    g.fillRect(0, OY + ROWS * T, OX + DOOR.x * T, T); g.fillRect(OX + (DOOR.x + 1) * T, OY + ROWS * T, ROOM_W, T);
    g.fillStyle = '#B04838'; g.fillRect(OX + DOOR.x * T + 2, OY + DOOR.y * T + 6, T - 4, T - 10);   // the doormat
    g.fillStyle = '#E8D8A8'; g.fillRect(OX + DOOR.x * T + 6, OY + DOOR.y * T + 12, T - 12, 3);
  }

  /** A wall block: a top face and a front face in its style's colours, with its pattern. */
  drawWall(g, w, ghost = false) {
    const st = this.seat.settings.wallStyles.find(s => s.key === w.style) || this.seat.settings.wallStyles[0];
    const x = OX + w.x * T, y = OY + w.y * T - 16;
    g.save();
    if (ghost) g.globalAlpha = 0.55;
    g.fillStyle = st.face; g.fillRect(x, y + 16, T, T);
    g.fillStyle = st.top; g.fillRect(x, y, T, 16);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    if (st.pattern === 'bricks') for (let r = 0; r < 4; r++) { g.fillRect(x, y + 16 + r * 8, T, 1); g.fillRect(x + (r % 2 ? 8 : 24), y + 16 + r * 8, 1, 8); }
    else if (st.pattern === 'planks') for (let c = 1; c < 4; c++) g.fillRect(x + c * 8, y + 16, 1, T);
    else if (st.pattern === 'leaves') for (let k = 0; k < 6; k++) g.fillRect(x + (k * 11) % 28 + 2, y + 18 + (k * 7) % 26, 3, 3);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + 16, T, 2);
    g.restore();
  }

  drawPiece(g, it, at = null, ghost = null) {
    const f = furnitureInfo(this.seat.settings, it.item);
    if (!f) return;
    const [x, y] = at || [it.x, it.y], w = f.src[2], h = f.src[3];
    const px = OX + x * T + (f.fw * T - w) / 2, py = f.floor ? OY + y * T + (f.fh * T - h) / 2 : OY + (y + f.fh) * T - h;
    const sheet = img(f.sheet);
    if (!isReady(sheet)) return;
    const u = this.using, sway = u && u.piece === it && u.use === 'water' ? Math.sin(u.t / 5) * 0.06 : 0;
    g.save();
    if (ghost) { g.globalAlpha = 0.75; if (ghost === 'bad') g.filter = 'sepia(1) saturate(4) hue-rotate(-40deg)'; }
    if (sway) { g.translate(px + w / 2, py + h); g.rotate(sway); g.translate(-(px + w / 2), -(py + h)); }
    g.drawImage(sheet, f.src[0], f.src[1], w, h, Math.round(px), Math.round(py), w, h);
    g.restore();
  }

  drawCursor(g) {
    const m = this.mode, s = this.seat.settings, p = this.profile;
    if (m === 'build') {                             // the block to build (or the one to knock down)
      const [x, y] = this.cell, has = wallAt(p, x, y);
      if (!has) this.drawWall(g, { x, y, style: this.wallStyle }, true);
      g.strokeStyle = has ? '#E08020' : this.seat.color; g.lineWidth = 3;
      g.strokeRect(OX + x * T + 1 + shake(this.shakeT), OY + y * T + 1, T - 2, T - 2);
      return;
    }
    if (!['floor', 'select', 'carry'].includes(m)) return;
    const [x, y] = this.cell, item = m === 'floor' ? this.item : m === 'carry' ? this.piece.item : null;
    let fw = 1, fh = 1, ok = true, bx = x, by = y;
    if (item) {
      ({ fw, fh } = furnitureInfo(s, item));
      ok = canPlace(p, s, item, x, y, m === 'carry' ? this.piece : null) && !this.someoneOn(item, x, y);
      this.drawPiece(g, { item }, [x, y], ok ? 'good' : 'bad');
    } else {
      const piece = pieceAt(p, s, x, y);
      if (piece) { ({ fw, fh } = furnitureInfo(s, piece.item)); bx = piece.x; by = piece.y; }
    }
    const dx = shake(this.shakeT);
    g.strokeStyle = item ? (ok ? '#30C040' : '#E03020') : this.seat.color; g.lineWidth = 3;
    g.strokeRect(OX + bx * T + 1 + dx, OY + by * T + 1, fw * T - 2, fh * T - 2);
    if (m === 'select') icon(g, this.action === 'remove' ? '🗑️' : '✋', OX + x * T + T, OY + y * T - 10, 16, 'center');
  }

  /** Edit mode's bar under the header: the tools, or the bag's furniture, or the Pokémon. */
  drawBar(g) {
    g.fillStyle = 'rgba(255,255,255,0.94)'; g.fillRect(0, TOP, VW, BAR);
    const box = (k, n, sel, fn) => {
      const w = 56, x = VW / 2 + (k - (n - 1) / 2) * (w + 8) - w / 2;
      if (sel) { g.fillStyle = '#FFF4C0'; g.fillRect(x + shake(this.shakeT), TOP + 4, w, 40); g.strokeStyle = this.seat.color; g.lineWidth = 3; g.strokeRect(x + shake(this.shakeT), TOP + 4, w, 40); }
      fn(x + w / 2, TOP + 24);
    };
    if (this.mode === 'pick') {
      const list = this.bagFurniture();
      list.forEach(([item, n], k) => box(k, list.length, k === this.pick, (cx, cy) => {
        drawItem(g, furnitureInfo(this.seat.settings, item), cx - 18, cy - 19, 36);
        g.fillStyle = '#303030'; g.font = '12px sans-serif'; g.fillText(`×${n}`, cx + 12, cy + 10);
      }));
      return;
    }
    if (this.mode === 'wallstyle') {
      const list = this.seat.settings.wallStyles;
      list.forEach((st, k) => box(k, list.length, k === this.pick, (cx, cy) => {
        g.fillStyle = st.face; g.fillRect(cx - 14, cy - 8, 28, 20); g.fillStyle = st.top; g.fillRect(cx - 14, cy - 16, 28, 9);
      }));
      return;
    }
    if (this.mode === 'build') {                     // how many blocks this answer has left
      icon(g, '🧱', VW / 2 - 30, TOP + 10, 26, 'center');
      g.fillStyle = '#303030'; g.font = 'bold 24px sans-serif'; g.textBaseline = 'top'; g.fillText(`× ${this.wallsLeft}`, VW / 2 - 8, TOP + 12);
      return;
    }
    TOOLS.forEach((t, k) => box(k, TOOLS.length, this.mode === 'tools' && k === this.tool, (cx, cy) => icon(g, t.icon, cx, cy - 14, 26, 'center')));
  }
}
