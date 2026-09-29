// The farm: the shared home both players walk around (DESIGN.md "The farm: the shared home").
// One Hub lives on the game; each seat's FarmScene is a camera on it and feeds it that player's input.
//
// Who's here: every seat with a child in it has a walker (the trainer) and, unless they let it go exploring, a
// follower (the child's active Pokémon). Every other Pokémon of both children, playing or not, explores the farm.
import { buildMap } from './builder.js';
import { Character, WALK_FRAMES, RUN_FRAMES } from './character.js';
import { DIRS } from './map.js';
import { AVATARS } from '../data/avatars.js';
import { SPECIES } from '../game/species.js';
import { activePokemon } from '../game/pokemon.js';
import { giveTreat } from '../game/bag.js';
import { FarmCare } from './care.js';
import { se, cry } from '../core/audio.js';

// ------------------------------------------------------------------ the map
const W = 40, H = 30;

function layout() {
  const g = [...Array(H)].map(() => Array(W).fill('.'));
  const fill = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = c; };
  fill(0, 0, W, 3, 'T'); fill(0, H - 3, W, 3, 'T');     // forest all round, in 2×3 units
  fill(0, 3, 2, H - 6, 'T'); fill(W - 2, 3, 2, H - 6, 'T');
  fill(0, 12, W, 3, '=');                               // the road: quarry (west) ↔ track (east)
  fill(6, 9, 3, 3, '=');                                // up to the trophy house
  fill(18, 8, 3, 4, '=');                               // up to the stadium
  fill(30, 9, 3, 3, '=');                               // up to the arena
  fill(20, 15, 4, 2, '=');                              // down to the pond meadow
  fill(2, 15, 2, 9, '='); fill(2, 22, 7, 2, '=');       // down to the lab
  fill(27, 15, 2, 7, '='); fill(27, 21, 6, 2, '=');     // down and round to the shop's door
  fill(14, 22, 8, 2, '=');                              // in front of the children's houses
  fill(23, 21, 3, 3, '~');                              // the pond
  for (const [x, y] of [[11, 17], [11, 18], [14, 5], [15, 5], [25, 5], [26, 6],
    [10, 9], [11, 9], [35, 16], [36, 16]]) g[y][x] = 'f';
  for (const [x, y] of [[4, 10], [5, 16], [6, 16], [36, 10]]) g[y][x] = 'r';  // the quarry's first stones
  fill(35, 19, 2, 3, 'P'); fill(34, 23, 2, 3, 'P'); fill(12, 22, 2, 3, 'P');
  return g.map(r => r.join(''));
}

export const FARM = {
  id: 'farm',
  ascii: layout(),
  stamps: [
    { s: 'house_orange', x: 5, y: 4, key: 'trophy' },
    { s: 'institute', x: 16, y: 3, key: 'race' },
    { s: 'gym', x: 28, y: 4, key: 'defense' },
    { s: 'lab', x: 4, y: 18, key: 'lab' },
    { s: 'house_blue', x: 29, y: 17, key: 'shop' },
    { s: 'house_green', x: 12, y: 18, key: 'home0' },   // each child's own house
    { s: 'house_green', x: 17, y: 18, key: 'home1' },
  ],
  music: 'Home Farm.wav',
  spawn: [{ x: 19, y: 13, dir: 'down' }, { x: 22, y: 13, dir: 'down' }],
};

// Places you walk into. `cells`: the tiles that enter it (a door, or the end of a road). `icon` floats over
// `iconAt` (tile coordinates). `back`: where you come out, facing `backDir`.
export function placesFor(map) {
  const door = (key, icon) => {
    const d = map.doors[key];
    return { key, icon, cells: [[d.x, d.y]], iconAt: [d.x, d.y - 4.2], back: [d.x, d.y + 1], backDir: 'down' };
  };
  return [
    { key: 'speed', icon: '⚡', cells: [[W - 1, 12], [W - 1, 13], [W - 1, 14]], iconAt: [W - 2, 10.6], back: [W - 3, 13], backDir: 'left' },
    { key: 'strength', icon: '💪', cells: [[0, 12], [0, 13], [0, 14]], iconAt: [1, 10.6], back: [2, 13], backDir: 'right' },
    door('defense', '🛡️'),
    door('race', '🏁'),
    door('trophy', '🏆'),
    door('lab', '🧪'),          // 🎁 instead while a new Pokémon is waiting (scenes/farm.js)
    door('shop', '🛒'),
    { ...door('home0', '🏠'), owner: 0 },           // the bubble is in its child's colour (scenes/farm.js)
    { ...door('home1', '🏠'), owner: 1 },
  ];
}

// ------------------------------------------------------------------ the world
const monSheet = id => SPECIES.get(id)?.sprites.run || null;
const TURN_FRAMES = 8;   // held less than this (standing still) = turn only

export class Hub {
  constructor(game) {
    this.game = game;
    this.def = FARM;
    this.map = buildMap(FARM);
    this.places = placesFor(this.map);
    this.frame = 0;
    this.walkers = [null, null];   // per seat: { char, follower, intent, scene, seat }; scene.away = inside a place
    this.mons = new Map();         // `${profileIndex}:${uid}` → { char, profileIndex, uid, species, wait }
    this.effects = [];             // { x, y, icon, t } floating icons (hearts, 🚧)
    this.meters = [];              // { x, y, from, to, max, t } a ❤️ bar over a Pokémon that was just given a treat
    this.care = new FarmCare(this); // needs and care tasks (world/care.js)
  }

  placeAt(x, y) { return this.places.find(p => p.cells.some(([cx, cy]) => cx === x && cy === y)) || null; }

  /** A seat's child arrives on the farm (at the spawn, or outside the place they just left). */
  join(seat, scene, at = null) {
    const s = at || FARM.spawn[seat.index];
    const av = AVATARS[seat.profile.avatar] || AVATARS.Red;
    const char = new Character(s.x, s.y, av.walk, s.dir);
    const follower = new Character(s.x, s.y, null, s.dir);
    this.walkers[seat.index] = { char, follower, intent: null, scene, seat };
    this.putWalker(seat.index, s.x, s.y, s.dir);
    this.syncMons();
  }

  /** Put seat i's trainer on a tile, with the follower on the tile behind them (if there's room). */
  putWalker(i, x, y, dir) {
    const w = this.walkers[i];
    w.char.place(x, y, dir);
    const back = DIRS[DIRS[dir].opp];
    const bx = x + back.dx, by = y + back.dy;
    const room = this.map.canMove(x, y, DIRS[dir].opp) && !this.monAt(bx, by) && !this.placeAt(bx, by);
    w.follower.place(room ? bx : x, room ? by : y, dir);
  }

  leave(seat) { this.care.leave(seat); this.walkers[seat.index] = null; this.syncMons(); }

  walker(seat) { return this.walkers[seat.index]; }

  /** Every Pokémon that isn't following someone explores the farm. */
  syncMons() {
    const want = new Map();
    this.game.save.profiles.forEach((pr, pi) => {
      const seat = this.game.seatWith(pi);
      const following = seat && this.walkers[seat.index] ? activePokemon(pr) : null;
      for (const pk of pr.pokemon) if (pk !== following && !pk.home) want.set(`${pi}:${pk.uid}`, { pi, pk });   // home: in their house
    });
    for (const k of [...this.mons.keys()]) if (!want.has(k)) this.mons.delete(k);
    for (const [k, { pi, pk }] of want) {
      const m = this.mons.get(k);
      if (m) { m.species = pk.species; m.char.sprite = monSheet(pk.species); continue; }
      const spot = this.freeSpot();
      this.mons.set(k, { char: new Character(spot.x, spot.y, monSheet(pk.species), 'down'), profileIndex: pi, uid: pk.uid, species: pk.species, wait: 30 });
    }
  }

  /** Where exploring Pokémon may stand: walkable, and never in a doorway, on a doorstep or on a spawn point. */
  canRoam(x, y) {
    if (!this.map.inside(x, y) || !this.map.tilePassable(x, y, 0) || this.placeAt(x, y)) return false;
    if (this.places.some(p => p.back[0] === x && p.back[1] === y)) return false;
    return !FARM.spawn.some(s => s.x === x && s.y === y);
  }

  monAt(x, y) {
    for (const m of this.mons.values()) if ((m.char.x === x && m.char.y === y)) return m;
    return null;
  }

  /** A trainer or follower on (or stepping onto) this tile. */
  walkerAt(x, y) {
    return this.walkers.some(w => w && !w.char.hidden && [w.char, w.follower].some(c => c.sprite && c.x === x && c.y === y));
  }

  freeSpot() {
    for (let n = 0; n < 500; n++) {
      const x = Math.floor(Math.random() * this.map.w), y = Math.floor(Math.random() * this.map.h);
      if (this.canRoam(x, y) && !this.monAt(x, y) && !this.walkerAt(x, y)) return { x, y };
    }
    return { x: 24, y: 19 };
  }

  /** Called once per frame by the game, after the seats' scenes have set their walkers' intents. */
  update() {
    this.frame++;
    if (this.frame % 30 === 0) this.syncMons();   // the save may have changed (a new Pokémon, admin.html)
    for (const w of this.walkers) if (w) this.updateWalker(w);
    for (const m of this.mons.values()) this.updateMon(m);
    this.effects = this.effects.filter(e => --e.t > 0);
    this.meters = this.meters.filter(m => --m.t > 0);
  }

  updateWalker(w) {
    const { char, follower, seat } = w;
    const here = !w.scene.away;
    char.hidden = follower.hidden = !here;                     // inside a place: gone from the farm
    const pk = seat.profile && activePokemon(seat.profile);
    follower.sprite = pk ? monSheet(pk.species) : null;
    const intent = here ? w.intent : null;
    w.intent = null;
    char.updateMove();
    follower.updateMove();
    if (!intent || !intent.dir) w.walking = false;
    if (char.moving || !intent || !intent.dir) return;
    // standing still, a quick tap on a new direction only turns you (so you can face your own follower)
    if (!w.walking && intent.dir !== char.dir && intent.held < TURN_FRAMES) { char.dir = intent.dir; return; }
    const d = DIRS[intent.dir];
    const nx = char.x + d.dx, ny = char.y + d.dy;
    char.dir = intent.dir;
    const place = this.placeAt(nx, ny);
    if (place) { w.scene.bumpPlace(place); return; }
    if (!this.map.canMove(char.x, char.y, intent.dir) || this.monAt(nx, ny)) return;   // Pokémon are solid: you face them
    const fromX = char.x, fromY = char.y;
    const frames = intent.run ? RUN_FRAMES : WALK_FRAMES;
    char.startMove(intent.dir, frames);
    w.walking = true;
    // the follower steps into the tile the trainer just left
    const fdx = fromX - follower.x, fdy = fromY - follower.y;
    if (Math.abs(fdx) + Math.abs(fdy) === 1) follower.startMove(fdx ? (fdx > 0 ? 'right' : 'left') : (fdy > 0 ? 'down' : 'up'), frames);
    else if (fdx || fdy) follower.place(fromX, fromY, char.dir);
  }

  updateMon(m) {
    const c = m.char;
    c.updateMove();
    if (c.moving || --m.wait > 0) return;
    m.wait = 40 + Math.floor(Math.random() * 140);
    const dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
    const d = DIRS[dir];
    c.dir = dir;
    const nx = c.x + d.dx, ny = c.y + d.dy;
    if (this.map.canMove(c.x, c.y, dir) && this.canRoam(nx, ny) && !this.monAt(nx, ny) && !this.walkerAt(nx, ny)) c.startMove(dir, 24);
  }

  /**
   * A in front of a Pokémon: one of yours that's exploring comes to follow you (and whoever was following goes
   * exploring in its place); your own follower goes off exploring; anyone else's says hello.
   */
  interact(seat) {
    const w = this.walker(seat);
    if (!w || w.char.moving) return false;
    const { x, y } = w.char.facing();
    const target = this.pokemonAt(x, y);
    if (this.care.tasks[seat.index]) { if (this.care.interact(seat, target)) return true; }   // fetching for a need
    else if (seat.profile.holding) { if (target) return this.give(seat, target); }         // a treat in hand
    else if (this.care.interact(seat, target)) return true;                                // a need: start caring
    if (w.follower.sprite && w.follower.x === x && w.follower.y === y && !w.follower.moving) return this.letGo(seat);
    const m = this.monAt(x, y);
    if (m) {
      m.char.dir = DIRS[w.char.dir].opp;
      m.wait = 90;
      if (m.profileIndex === seat.profileIndex) return this.swap(seat, m);
      this.hello(m.species, x, y);
      return true;
    }
    // someone else's follower
    for (const o of this.walkers) {
      if (!o || o === w || o.follower.hidden || o.follower.x !== x || o.follower.y !== y) continue;
      const pk = activePokemon(o.seat.profile);
      if (pk) { this.hello(pk.species, x, y); return true; }
    }
    return false;
  }

  /** Whoever is on this tile: a follower (anyone's) or an exploring Pokémon. { pk, pi, x, y, mon } or null. */
  pokemonAt(x, y) {
    const profiles = this.game.save.profiles;
    for (const o of this.walkers) {
      if (!o || o.follower.hidden || !o.follower.sprite || o.follower.x !== x || o.follower.y !== y) continue;
      const pk = activePokemon(o.seat.profile);
      if (pk) return { pk, pi: o.seat.profileIndex, x, y, mon: null };
    }
    const m = this.monAt(x, y);
    if (!m) return null;
    const pk = profiles[m.profileIndex]?.pokemon.find(p => p.uid === m.uid);
    return pk ? { pk, pi: m.profileIndex, x, y, mon: m } : null;
  }

  /** Where a Pokémon stands on the farm (its Character), by `${profileIndex}:${uid}`; null if it isn't out. */
  charFor(key) {
    const m = this.mons.get(key);
    if (m) return m.char;
    for (const o of this.walkers) {
      const pk = o && !o.follower.hidden && o.follower.sprite && activePokemon(o.seat.profile);
      if (pk && `${o.seat.profileIndex}:${pk.uid}` === key) return o.follower;
    }
    return null;
  }

  /** Give the treat you're holding: its ❤️ bar pops up and fills; full already → a shake of the head. */
  give(seat, { pk, x, y, mon }) {
    if (mon) { mon.wait = 90; }
    const got = giveTreat(seat.profile, pk, seat.profile.holding, seat.settings);
    if (!got) { se('GUI sel buzzer', 0.6); this.effects.push({ x, y, icon: '💤', t: 50 }); return true; }
    this.game.store();
    cry(SPECIES.get(pk.species)?.sprites.cry, 0.9);
    se('move-anims/Saint6', 0.5);
    for (let k = 0; k < 3; k++) this.effects.push({ x: x + (k - 1) * 0.4, y: y - k * 0.2, icon: '❤️', t: 60 + k * 10 });
    this.meters.push({ x, y, from: got.from, to: got.to, max: seat.settings.friendshipMax, t: 150 });
    return true;
  }

  hello(species, x, y) {
    cry(SPECIES.get(species)?.sprites.cry, 0.8);
    this.effects.push({ x, y, icon: '❤️', t: 60 });
  }

  /** Your follower goes off exploring; you walk alone. */
  letGo(seat) {
    const w = this.walker(seat), profile = seat.profile, pk = activePokemon(profile);
    if (!pk) return false;
    profile.active = null;
    this.game.store();
    const f = w.follower;
    this.mons.set(`${seat.profileIndex}:${pk.uid}`, { char: new Character(f.x, f.y, monSheet(pk.species), f.dir), profileIndex: seat.profileIndex, uid: pk.uid, species: pk.species, wait: 20 });
    f.sprite = null;
    cry(SPECIES.get(pk.species)?.sprites.cry, 0.8);
    this.effects.push({ x: f.x, y: f.y, icon: '🍃', t: 50 });
    return true;
  }

  /** One of yours that's exploring comes to follow you; whoever was following takes its place exploring. */
  swap(seat, m) {
    const w = this.walker(seat), profile = seat.profile;
    const old = activePokemon(profile);
    profile.active = m.uid;
    this.game.store();
    this.mons.delete(`${m.profileIndex}:${m.uid}`);
    if (old) this.mons.set(`${m.profileIndex}:${old.uid}`, { char: new Character(m.char.x, m.char.y, monSheet(old.species), m.char.dir), profileIndex: m.profileIndex, uid: old.uid, species: old.species, wait: 60 });
    w.follower.sprite = monSheet(m.species);
    se('GUI party switch', 0.7);
    cry(SPECIES.get(m.species)?.sprites.cry, 0.9);
    this.effects.push({ x: w.follower.x, y: w.follower.y, icon: '❤️', t: 60 });
    return true;
  }

  /**
   * Who each Pokémon belongs to (its ring colour) and the evolution it's heading for (an icon over its head), so
   * two Pikachu, or one child's two Eevees, can be told apart.
   */
  monMarkers() {
    const out = [], profiles = this.game.save.profiles;
    for (const m of this.mons.values()) {
      const pr = profiles[m.profileIndex], pk = pr && pr.pokemon.find(p => p.uid === m.uid);
      if (pk) out.push({ char: m.char, color: pr.color, goal: pk.branch });
    }
    for (const w of this.walkers) {
      if (!w || w.follower.hidden || !w.follower.sprite) continue;
      const pk = activePokemon(w.seat.profile);
      if (pk) out.push({ char: w.follower, color: w.seat.color, goal: pk.branch });
    }
    return out;
  }

  /** Everything that stands on the map, back to front. */
  sprites() {
    const out = [];
    for (const w of this.walkers) if (w) out.push(w.follower, w.char);
    for (const m of this.mons.values()) out.push(m.char);
    return out.filter(c => !c.hidden && c.sprite).sort((a, b) => a.py - b.py);
  }
}
