// 🏁 The stadium (DESIGN.md "Races"): the venue map → a preview → the race (watch only) → the results.
// Races are per Pokémon (the follower) and have no randomness: the same stats always give the same race, so only
// training changes the result. Win → the race is done for this Pokémon and it gets that venue's ribbon; lose →
// a hint of what to train, and try again any time. The menu button skips the rest of a race straight to the results
// (it can't turn out differently: there's no randomness), so a struggling child needn't sit and wait.
import { Scene, text } from '../core/ui.js';
import { img, isReady, draw } from '../core/assets.js';
import { se, cry, jingle } from '../core/audio.js';
import { TILESETS, drawAutotile } from '../world/tileset.js';
import { SPECIES } from '../game/species.js';
import { activePokemon, picksWaiting } from '../game/pokemon.js';
import { runRace, positionAt, lossHint, scaledRace, budgetFor } from '../game/race.js';
import { currentRank, nextRace, venueProgress } from '../game/ladder.js';
import { VENUES, RANKS, venueById } from '../data/venues.js';
import { drawFront, drawRun, drawHeader, drawRibbon, icon, shake } from './common.js';
import { MoveFx } from './moveFx.js';
import { movesFor } from '../game/moves.js';

const VW = 512, VH = 384;

function tile(g, id, x, y) {
  const ts = img(TILESETS[1].image);
  if (!isReady(ts) || id < 384) return;
  const i = id - 384;
  g.drawImage(ts, (i % 8) * 32, Math.floor(i / 8) * 32, 32, 32, x, y, 32, 32);
}
const hash = n => ((n * 2654435761) >>> 0) % 97;

/** How a barrier looks: by its hardness against the race's yardstick (a small tree, a rock, a boulder, a dark boulder). */
function barrierLook(hardness, race) {
  const r = hardness / (budgetFor(race.n) / 3);
  if (r < 0.95) return { sheet: 'characters/Object tree 1.png', sound: 'Cut', size: 1 };
  if (r < 1.2) return { sheet: 'characters/Object rock.png', sound: 'Rock Smash', size: 2 };
  if (r < 1.45) return { sheet: 'characters/Object boulder.png', breakSheet: 'characters/Object rock.png', sound: 'Rock Smash', size: 3 };
  return { sheet: 'characters/Object boulder.png', breakSheet: 'characters/Object rock.png', sound: 'Rock Smash', size: 4, dark: true };
}

// ================================================================== the venue map
export class StadiumScene extends Scene {
  constructor() {
    super();
    this.opaque = true;
    this.music = 'Gym.ogg';
    this.index = 0; this.t = 0; this.shakeT = 0;
  }
  get pk() { return activePokemon(this.seat.profile); }
  update(input) {
    this.t++;
    if (this.shakeT > 0) this.shakeT--;
    const pk = this.pk;
    if (!pk) { this.close(); return; }       // the follower was changed away (admin.html): back out
    const n = VENUES.length;
    if (input.repeatPressed('left')) { this.index = (this.index + n - 1) % n; se('GUI sel cursor', 0.5); }
    if (input.repeatPressed('right')) { this.index = (this.index + 1) % n; se('GUI sel cursor', 0.5); }
    if (input.repeatPressed('up') || input.repeatPressed('down')) { this.index = (this.index + 4) % n; se('GUI sel cursor', 0.5); }
    if (input.pressed('b') || input.pressed('start')) { se('GUI sel cancel', 0.6); this.close(); return; }
    if (input.pressed('a')) {
      const race = nextRace(pk, VENUES[this.index].id);
      if (!race) { se('GUI sel buzzer'); this.shakeT = 16; return; }
      se('GUI sel decision');
      this.seat.push(new PreviewScene(race));
    }
  }
  draw(g) {
    const pk = this.pk;
    draw(g, 'backgrounds/pwt_bg.png', 0, 0, VW, VH);
    g.fillStyle = 'rgba(0,0,30,0.45)'; g.fillRect(0, 0, VW, VH);
    drawHeader(g, this.seat);
    if (!pk) return;
    const rank = currentRank(pk);
    // the ranks: a ribbon each, bright once reached
    for (let r = 1; r <= RANKS; r++) drawRibbon(g, VENUES[0], r, 300 + (r - 1) * 40, 0, 36, r > rank);
    drawFront(g, pk.species, 60, 18, { scale: 0.5 });
    VENUES.forEach((v, i) => {
      const x = 12 + (i % 4) * 124, y = 50 + Math.floor(i / 4) * 164;
      const sel = i === this.index, dx = sel ? shake(this.shakeT) : 0;
      g.fillStyle = sel ? '#F8F8F0' : 'rgba(248,248,240,0.75)'; g.fillRect(x + dx, y, 116, 156);
      if (sel) { g.strokeStyle = this.seat.color; g.lineWidth = 4; g.strokeRect(x + 2 + dx, y + 2, 112, 152); }
      const bg = img(v.bg);
      if (isReady(bg)) g.drawImage(bg, 128, 40, 256, 144, x + 6 + dx, y + 6, 104, 58);
      icon(g, v.icon, x + 58 + dx, y + 70, 30, 'center');
      const prog = rank <= RANKS ? venueProgress(pk, v.id, rank) : ['won', 'won', 'won'];
      if (prog.every(p => p === 'won')) drawRibbon(g, v, Math.min(rank, RANKS), x + 34 + dx, y + 102, 48);
      else prog.forEach((p, k) => {
        const cx = x + 30 + k * 28 + dx, cy = y + 126;
        if (p === 'won') drawRibbon(g, v, rank, cx - 14, cy - 14, 28);
        else {
          g.fillStyle = p === 'next' ? this.seat.color : 'rgba(0,0,0,0.2)';
          g.beginPath(); g.arc(cx, cy, p === 'next' ? 9 : 6, 0, Math.PI * 2); g.fill();
        }
      });
    });
    if (rank > RANKS) icon(g, '🏆', VW / 2, 150, 72, 'center');
  }
}

// ================================================================== the preview
class PreviewScene extends Scene {
  constructor(race) {
    super();
    this.opaque = true;
    this.race = race; this.venue = venueById(race.venue);
    this.music = this.venue.music;
    this.t = 0;
  }
  update(input) {
    this.t++;
    if (this.t === 1) for (const o of this.race.opponents) cry(SPECIES.get(o.species)?.sprites.cry, 0.35);
    if (input.pressed('b') || input.pressed('start')) { se('GUI sel cancel', 0.6); this.close(); return; }
    if (input.pressed('a')) {
      se('Vs flash');
      this.seat.push(new RaceScene(this.race)).then(() => this.close());
    }
  }
  draw(g) {
    const v = this.venue, race = this.race, pk = activePokemon(this.seat.profile);
    draw(g, v.bg, 0, 0, VW, 288);
    g.fillStyle = '#F8F8F0'; g.fillRect(0, 196, VW, VH - 196);
    drawHeader(g, this.seat);
    icon(g, v.icon, 256, 2, 28, 'center');
    drawRibbon(g, v, race.rank, 440, 0, 36);
    // the course, in order, as pictures
    const parts = [];
    for (const s of race.course.segments) {
      if (s.kind === 'run') parts.push({ kind: 'run', n: s.len > 80 ? 2 : 1 });
      else if (s.kind === 'barrier') parts.push({ kind: 'barrier', look: barrierLook(s.hardness, race) });
      else parts.push({ kind: 'trap', big: s.power / (budgetFor(race.n) / 3) > 1.4 });
    }
    const w = parts.reduce((a, p) => a + (p.kind === 'run' ? 40 * p.n : 60), 0);
    let x = Math.round(256 - w / 2);
    g.fillStyle = '#F8F8F0'; g.fillRect(x - 12, 46, w + 24, 74);
    g.strokeStyle = '#C8C0A8'; g.lineWidth = 3; g.strokeRect(x - 12, 46, w + 24, 74);
    for (const p of parts) {
      if (p.kind === 'run') { for (let k = 0; k < p.n; k++) { icon(g, '🏃', x + 20, 64, 32, 'center'); x += 40; } continue; }
      if (p.kind === 'barrier') {      // bigger picture = harder to smash
        const i = img(p.look.sheet), s = 28 + p.look.size * 8;
        if (isReady(i)) { g.save(); if (p.look.dark) g.filter = 'brightness(0.72) saturate(0.6)'; g.drawImage(i, 0, 0, 32, 32, x + 30 - s / 2, 112 - s, s, s); g.restore(); }
      } else icon(g, '🛡️', x + 30, p.big ? 56 : 64, p.big ? 44 : 32, 'center');
      x += 60;
    }
    // who's racing
    if (pk) {
      g.strokeStyle = this.seat.color; g.lineWidth = 4;
      g.beginPath(); g.ellipse(80, 306, 40, 11, 0, 0, Math.PI * 2); g.stroke();
      drawFront(g, pk.species, 80, 280 + Math.round(Math.abs(Math.sin(this.t / 8)) * -6));
    }
    icon(g, '⚔️', 160, 262, 30, 'center');
    race.opponents.forEach((o, k) => drawFront(g, o.species, 240 + k * 96, 282));
    g.fillStyle = '#48A848'; g.fillRect(150, 340, 88, 40);
    g.fillStyle = '#D84838'; g.fillRect(274, 340, 88, 40);
    icon(g, '✔️', 194, 346, 26, 'center');
    icon(g, '✖️', 318, 346, 26, 'center');
  }
}

// ================================================================== the race
const PX = 24;                         // pixels per metre
const PANEL_H = 56, LANE_Y = 96, LANE_H = 64, LANES = 4;
const YOU_LANE = 1;
const laneMid = i => LANE_Y + i * LANE_H + LANE_H / 2;

class RaceScene extends Scene {
  constructor(race) {
    super();
    this.opaque = true;
    this.base = race;
    this.venue = venueById(race.venue);
    this.music = this.venue.music;
    this.started = false;
  }

  start() {
    const seat = this.seat;
    this.pk = activePokemon(seat.profile);
    this.race = scaledRace(this.base, seat.settings.opponentStrength);
    this.result = runRace(this.race.course, this.pk.stats, this.race.opponents);
    // lanes: an opponent, you, then the other two
    const [you, ...them] = this.result.racers;
    you.species = this.pk.species;
    this.lanes = [them[0], you, them[1], them[2]];
    this.you = you;
    this.barriers = [];
    let x = 0;
    for (const s of this.race.course.segments) {
      if (s.kind === 'barrier') this.barriers.push({ x, look: barrierLook(s.hardness, this.base) });
      if (s.kind === 'run' || s.kind === 'trap') { if (s.kind === 'trap') this.traps = [...(this.traps || []), { x0: x, x1: x + s.len }]; x += s.len; }
    }
    this.traps = this.traps || [];
    this.length = x;
    this.t = 0; this.frame = 0;
    this.phase = 'ready';          // ready (3-2-1) → go → results
    this.heard = new Set();        // barrier sounds already played
    this.flakes = Array.from({ length: 60 }, (_, k) => ({ x: (k * 97) % VW, y: (k * 53) % VH, v: 1 + (k % 3) }));
    // your Pokémon smashes barriers with its own moves
    this.moves = movesFor(this.pk.species); MoveFx.preload(this.moves);
    this.fx = new MoveFx(); this.smashes = 0; this.shakeT = 0;
    this.dust = [];                // { wx (metres), y, t } puffs behind the runners
    this.confetti = [];
    // a photo finish: someone crosses within half a second of you → the last stretch in slow motion, then a flash
    const others = this.result.racers.filter(r => !r.you).map(r => r.sim.time);
    this.photo = Math.min(...others.map(t => Math.abs(t - you.sim.time))) < 0.5;
    this.flash = 0;
    this.started = true;
  }

  update(input) {
    if (!this.started) this.start();
    this.frame++;
    if ((this.phase === 'ready' || this.phase === 'go') && input.pressed('start')) return this.skip();
    if (this.phase === 'ready') {
      if (this.frame % 60 === 1) se('GUI sel cursor', 0.8);
      if (this.frame >= 180) { this.phase = 'go'; se('Vs flash'); }
      return;
    }
    this.fx.update();
    if (this.shakeT > 0) this.shakeT--;
    if (this.flash > 0) this.flash--;
    for (const c of this.confetti) { c.x += c.vx; c.y += c.vy; c.vy = Math.min(3, c.vy + 0.05); c.r += c.vr; }
    this.confetti = this.confetti.filter(c => c.y < VH + 10);
    if (this.phase === 'go') {
      const slowMo = this.photo && this.t > this.you.sim.time - 1.2 && this.t < this.you.sim.time + 0.3;
      this.t += (slowMo ? 0.3 : 1) / 60;
      if (this.photo && !this.flashed && this.t >= this.you.sim.time) { this.flashed = true; this.flash = 24; se('move-anims/Flash2', 0.9); }
      this.sounds();
      this.puffs();
      const slowest = Math.max(...this.result.racers.map(r => r.sim.time));
      if (!this.finishSeen && this.t >= this.you.sim.time) { this.finishSeen = true; se('Voltorb Flip level up'); }
      if (this.t >= Math.min(slowest, this.you.sim.time + 3) + 0.8) this.finish();
      return;
    }
    if (this.phase === 'results') {
      this.resT++;
      if (this.resT > 50 && (input.pressed('a') || input.pressed('b') || input.pressed('start'))) { se('GUI sel decision'); this.close(this.result.won); }
    }
  }

  /** The menu button: jump to the end, everyone at the finish, and the results (the same as watching it all). */
  skip() {
    se('GUI menu close', 0.6);
    this.t = Math.max(...this.result.racers.map(r => r.sim.time)) + 0.1;
    this.fx = new MoveFx(); this.dust = []; this.photo = false;
    this.finish();
  }

  /** Your Pokémon's barriers: a smash, or a bonk for each headbutt and the smash on the last. */
  sounds() {
    for (const seg of this.you.sim.timeline) {
      if (seg.kind !== 'smash' && seg.kind !== 'headbutt') continue;
      const b = this.barriers.find(b => Math.abs(b.x - seg.x0) < 0.01), each = (seg.t1 - seg.t0) / seg.hits;
      for (let h = 0; h < seg.hits; h++) {
        const at = seg.t0 + each * (h + 0.5), key = `${seg.t0}:${h}`;
        if (this.t < at || this.heard.has(key)) continue;
        this.heard.add(key);
        if (h === seg.hits - 1) { se(b ? b.look.sound : 'Rock Smash', 0.8); this.smash(seg); }
        else se('move-anims/Blow1', 0.7);
      }
    }
  }

  /** The barrier breaks: your Pokémon's own move bursts on it, and the screen shakes. */
  smash(seg) {
    const camX = this.camX, x = seg.x0 * PX - camX, y = laneMid(1) - 20;
    this.fx.play(this.moves[this.smashes++ % this.moves.length], { x: x - 10, y, scale: 0.6 }, { x: x + 26, y, scale: 0.85 });
    this.shakeT = 14;
  }

  /** Dust behind every runner that's running. */
  puffs() {
    if (this.frame % 5) { this.dust = this.dust.filter(d => --d.t > 0); return; }
    this.lanes.forEach((r, i) => {
      const p = positionAt(r.sim, this.t);
      if (!p.done && p.seg && (p.seg.kind === 'run' || p.seg.kind === 'trap')) this.dust.push({ wx: p.x - 0.8, y: laneMid(i) + 18, t: 24, s: 3 + (i * 7 + this.frame) % 4 });
    });
    this.dust = this.dust.filter(d => (d.t -= 5) > 0);
  }

  finish() {
    this.phase = 'results'; this.resT = 0;
    if (this.result.won) this.confetti = Array.from({ length: 80 }, (_, k) => ({ x: Math.random() * VW, y: -Math.random() * 200, vx: (Math.random() - 0.5) * 1.5,
      vy: 1 + Math.random() * 2, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: ['#F84848', '#F8C820', '#48B8F8', '#58D058', '#F870C8'][k % 5] }));
    const won = this.result.won, place = this.you.place;
    if (won) {
      const before = picksWaiting(this.seat.profile, this.seat.settings);
      if (!this.pk.wins.includes(this.base.id)) this.pk.wins.push(this.base.id);
      this.gift = picksWaiting(this.seat.profile, this.seat.settings) > before;   // earned a new Pokémon: 🎁 (the lab)
      this.coins = this.seat.settings.coinsPerWin * this.base.rank;                 // prize money for the shop
      this.seat.profile.coins = (this.seat.profile.coins || 0) + this.coins;
      this.seat.game.store();
      jingle('Bug catching 1st');
      cry(SPECIES.get(this.pk.species)?.sprites.cry, 0.9);
    } else jingle(place === 2 ? 'Bug catching 2nd' : 'Bug catching 3rd');
    this.hint = lossHint(this.result);
  }

  // ------------------------------------------------------------------ drawing
  get camX() {
    const x = positionAt(this.you.sim, this.t).x * PX;
    return Math.max(0, Math.round(x - 170));
  }

  draw(g) {
    if (!this.started) return;
    const camX = this.camX, v = this.venue;
    const sx = Math.round((this.shakeT ? Math.sin(this.shakeT * 1.7) * 4 : 0) + this.fx.shake.x);
    g.save(); g.translate(sx, Math.round(this.fx.shake.y));
    this.drawGround(g, camX);
    for (const tz of this.traps) this.drawTrap(g, tz, camX);
    this.drawFinish(g, camX);
    for (const d of this.dust) {
      g.fillStyle = `rgba(230,210,170,${d.t / 30})`;
      const r = d.s + (24 - d.t) / 5;
      g.beginPath(); g.arc(d.wx * PX - camX, d.y - (24 - d.t) / 3, r, 0, Math.PI * 2); g.fill();
    }
    this.lanes.forEach((r, i) => this.drawLane(g, r, i, camX));
    this.fx.draw(g);
    g.restore();
    if (v.tint) { g.fillStyle = v.tint; g.fillRect(0, PANEL_H, VW, VH - PANEL_H); }
    if (this.flash) { g.fillStyle = `rgba(255,255,255,${this.flash / 24})`; g.fillRect(0, PANEL_H, VW, VH - PANEL_H); icon(g, '📸', VW - 60, PANEL_H + 16, 32, 'center'); }
    if (this.photo && this.phase === 'go' && this.t > this.you.sim.time - 1.2 && this.t < this.you.sim.time) {
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 6; g.strokeRect(6, PANEL_H + 6, VW - 12, VH - PANEL_H - 12);   // slow motion
    }
    if (v.weather === 'blizzard') {
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (const f of this.flakes) {
        const x = ((f.x - this.frame * f.v * 1.5 - camX * 0.3) % VW + VW) % VW, y = (f.y + this.frame * f.v * 0.7) % VH;
        g.fillRect(Math.round(x), Math.round(y), 3, 3);
      }
    }
    this.drawPanel(g);
    if (this.phase === 'ready') {
      const n = 3 - Math.floor(this.frame / 60);
      text(g, String(Math.max(1, n)), VW / 2, 150, { size: 96, align: 'center', family: '"Power Clear Bold"', color: '#F8F8F8', shadow: '#303030' });
    } else if (this.phase === 'go' && this.t < 1) icon(g, '🏁', VW / 2, 150, 80, 'center');
    if (this.phase === 'results') {
      this.drawResults(g);
      for (const c of this.confetti) { g.save(); g.translate(c.x, c.y); g.rotate(c.r); g.fillStyle = c.c; g.fillRect(-4, -2, 8, 4); g.restore(); }
    }
  }

  drawGround(g, camX) {
    const v = this.venue, off = camX % 32, col0 = Math.floor(camX / 32);
    for (let c = 0; c <= VW / 32 + 1; c++) {
      const x = c * 32 - off, col = col0 + c;
      for (let y = 32; y < LANE_Y; y += 32) tile(g, v.side, x, y);
      tile(g, v.lane[0], x, LANE_Y);
      for (let r = 1; r < LANES * 2 - 1; r++) tile(g, v.lane[1], x, LANE_Y + r * 32);
      tile(g, v.lane[2], x, LANE_Y + (LANES * 2 - 1) * 32);
      tile(g, v.side, x, LANE_Y + LANES * LANE_H);
      if (v.props === 'sea') drawAutotile(g, 'autotiles/Sea.png', [27, 28, 33, 34], x, 64, Math.floor(this.frame / 15));
      else if (v.props === 'rocks' && hash(col) % 5 === 0) tile(g, hash(col) % 2 ? 1512 : 1328, x, 64);
      if (v.props === 'rocks' && hash(col + 7) % 6 === 0) tile(g, 1328, x, LANE_Y + LANES * LANE_H);
      if (v.props !== 'rocks' && v.props !== 'sea') tile(g, 1681, x, LANE_Y + LANES * LANE_H);
    }
    if (v.props === 'pines' || v.props === 'forest') {
      const every = v.props === 'forest' ? 2 : 5;
      for (let c = -2; c <= VW / 32 + 1; c++) {
        const col = col0 + c;
        if (col % 2 || hash(col * 3 + 1) % every) continue;
        for (let r = 0; r < 3; r++) for (let i = 0; i < 2; i++) tile(g, 804 + r * 8 + i, c * 32 - off + i * 32, r * 32);
      }
    }
    // lane lines
    g.fillStyle = 'rgba(255,255,255,0.4)';
    for (let l = 1; l < LANES; l++) for (let x = -(camX % 48); x < VW; x += 48) g.fillRect(Math.round(x), LANE_Y + l * LANE_H - 1, 24, 3);
  }

  drawTrap(g, tz, camX) {
    const v = this.venue, x0 = Math.round(tz.x0 * PX - camX), x1 = Math.round(tz.x1 * PX - camX);
    if (x1 < 0 || x0 > VW) return;
    for (let x = x0; x < x1; x += 32) for (let r = 0; r < LANES * 2; r++) {
      const y = LANE_Y + r * 32;
      const k = r + Math.round((x + camX) / 32);
      if (v.trapTile === 'water') drawAutotile(g, 'autotiles/Sea.png', [27, 28, 33, 34], x, y, Math.floor(this.frame / 15));
      else if (v.trapTile === 'drift') {          // deep snow drifts
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.beginPath(); g.ellipse(x + 16 + (k % 2) * 8, y + 20, 18, 9, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(200,220,240,0.8)';
        g.beginPath(); g.ellipse(x + 18 + (k % 2) * 8, y + 25, 14, 4, 0, 0, Math.PI * 2); g.fill();
      } else if (v.trapTile === 391 || k % 3 === 0) tile(g, v.trapTile, x, y);     // grass all over; rubble here and there
    }
    g.fillStyle = 'rgba(160,40,200,0.10)'; g.fillRect(x0, LANE_Y, x1 - x0, LANES * LANE_H);
  }

  drawFinish(g, camX) {
    const x = Math.round(this.length * PX - camX);
    if (x < -16 || x > VW) return;
    for (let y = LANE_Y; y < LANE_Y + LANES * LANE_H; y += 8) {
      const k = ((y - LANE_Y) / 8) % 2;
      g.fillStyle = k ? '#202020' : '#F8F8F8'; g.fillRect(x, y, 8, 8);
      g.fillStyle = k ? '#F8F8F8' : '#202020'; g.fillRect(x + 8, y, 8, 8);
    }
  }

  drawLane(g, r, lane, camX) {
    const y = laneMid(lane);
    // this lane's barriers: whole until its racer smashes it
    for (const b of this.barriers) {
      const bx = Math.round(b.x * PX - camX) + 20;
      if (bx < -80 || bx > VW + 80) continue;
      const seg = r.sim.timeline.find(s => (s.kind === 'smash' || s.kind === 'headbutt') && Math.abs(s.x0 - b.x) < 0.01);
      let sheet = b.look.sheet, row = 0, col = 0, gone = false, wob = 0;
      if (seg && this.t >= seg.t0) {
        // each headbutt lands halfway through its share: the barrier judders, and the last one breaks it
        const each = (seg.t1 - seg.t0) / seg.hits, n = Math.floor((this.t - seg.t0) / each), part = ((this.t - seg.t0) / each) % 1;
        const breaking = (n >= seg.hits - 1 && part >= 0.5) || this.t >= seg.t1;
        if (breaking) {
          const f = Math.min(1, (this.t - (seg.t1 - each / 2)) / (each / 2 + 0.3));
          sheet = b.look.breakSheet || b.look.sheet;
          const k = Math.floor(f * 11);
          row = 1 + Math.min(2, Math.floor(k / 4)); col = k % 4;
          gone = this.t > seg.t1 + 0.4;
        } else if (part >= 0.5 && part < 0.8) wob = Math.round(Math.sin(this.frame * 2.1) * 3);
      }
      if (gone) continue;
      const i = img(sheet);
      if (!isReady(i)) continue;
      const size = 32 + b.look.size * 8;
      g.save();
      if (b.look.dark && row === 0) g.filter = 'brightness(0.72) saturate(0.6)';
      g.drawImage(i, col * 32, row * 32, 32, 32, bx - size / 2 + wob, y + 26 - size, size, size);
      g.restore();
    }
    // the racer
    const p = positionAt(r.sim, this.phase === 'ready' ? 0 : this.t);
    let x = p.x * PX - camX, yy = y;
    const kind = p.seg && p.seg.kind;
    let bumped = false;
    if (kind === 'headbutt') {           // not strong enough: back up, charge, BONK, again until it breaks
      const part = (p.f * p.seg.hits) % 1;
      x += part < 0.5 ? -part * 2 * 22 : -22 + (part - 0.5) * 2 * 22;
      bumped = part >= 0.5 && part < 0.7;
    }
    const moving = this.phase === 'go' && !p.done && kind !== 'smash';
    const frame = moving ? Math.floor(p.x * PX / 18) : 0;
    const shakeX = kind === 'smash' ? Math.round(Math.sin(this.frame * 1.7) * 3) : 0;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y + 22, 22, 7, 0, 0, Math.PI * 2); g.fill();
    if (r.you) {
      g.strokeStyle = this.seat.color; g.lineWidth = 3;
      g.beginPath(); g.ellipse(x, y + 22, 26, 9, 0, 0, Math.PI * 2); g.stroke();
    }
    drawRun(g, r.species, 2, frame, Math.round(x) + shakeX, Math.round(yy) + 36, 2);
    if (bumped && this.phase === 'go') icon(g, '💥', x + 28, yy - 48, 20, 'center');
    if (kind === 'headbutt' && this.phase === 'go') {    // how many to go, as dots
      const done = Math.floor(p.f * p.seg.hits);
      for (let k = 0; k < p.seg.hits; k++) {
        g.fillStyle = k < done ? '#F8C820' : 'rgba(255,255,255,0.7)';
        g.beginPath(); g.arc(x - (p.seg.hits - 1) * 5 + k * 10, yy - 70, 4, 0, Math.PI * 2); g.fill();
      }
    }
    if (kind === 'trap' && this.phase === 'go') {
      if (p.seg.slow > 0.6) icon(g, '💫', x, yy - 64, 20, 'center');
      else if (p.seg.slow === 0) icon(g, r.you ? '🛡️' : '✨', x + 14, yy - 60 + (this.frame % 30 < 15 ? 0 : -2), 18, 'center');
    }
  }

  drawPanel(g) {
    g.fillStyle = '#F8F8F0'; g.fillRect(0, 0, VW, PANEL_H);
    g.fillStyle = this.seat.color; g.fillRect(0, PANEL_H - 4, VW, 4);
    icon(g, this.venue.icon, 22, 12, 24, 'center');
    if (this.phase !== 'results') icon(g, '⏭️', 22, 40, 14, 'center');     // the menu button skips to the end
    // who's ahead: everyone's icon along the course
    const x0 = 56, x1 = 470;
    g.fillStyle = '#C8C0A8'; g.fillRect(x0, 30, x1 - x0, 4);
    icon(g, '🏁', x1 + 20, 14, 22, 'center');
    const t = this.phase === 'ready' ? 0 : this.t;
    const order = [...this.lanes].sort((a, b) => (a.you ? 1 : 0) - (b.you ? 1 : 0));   // you on top
    for (const r of order) {
      const f = positionAt(r.sim, t).x / this.length;
      const x = x0 + f * (x1 - x0);
      const ic = img(SPECIES.get(r.species)?.sprites.icon || '');
      if (r.you) { g.fillStyle = this.seat.color; g.beginPath(); g.arc(x, 30, 17, 0, Math.PI * 2); g.fill(); }
      if (isReady(ic)) g.drawImage(ic, (Math.floor(this.frame / 12) % 2) * 64, 0, 64, 64, Math.round(x - 16), 14, 32, 32);
    }
  }

  drawResults(g) {
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, VW, VH);
    g.fillStyle = '#F8F8F0'; g.fillRect(28, 24, VW - 56, VH - 48);
    g.strokeStyle = this.seat.color; g.lineWidth = 4; g.strokeRect(30, 26, VW - 60, VH - 52);
    const medals = ['🥇', '🥈', '🥉', ''];
    this.result.order.forEach((r, i) => {
      const y = 40 + i * 62;
      if (r.you) { g.fillStyle = '#F8E8A0'; g.fillRect(40, y, 250, 58); }
      if (medals[i]) icon(g, medals[i], 66, y + 12, 30, 'center');
      else text(g, '4', 66, y + 14, { size: 28, align: 'center' });
      const hop = r.you && this.result.won ? Math.round(Math.abs(Math.sin(this.resT / 6)) * -6) : 0;
      const ic = img(SPECIES.get(r.species)?.sprites.icon || '');
      if (r.you) { g.strokeStyle = this.seat.color; g.lineWidth = 3; g.beginPath(); g.ellipse(160, y + 50, 26, 7, 0, 0, Math.PI * 2); g.stroke(); }
      if (isReady(ic)) g.drawImage(ic, (Math.floor(this.resT / 14) % 2) * 64, 0, 64, 64, 128, y - 6 + hop, 64, 64);
    });
    const cx = 390;
    if (this.result.won) {
      const pop = Math.min(1, this.resT / 30);
      drawRibbon(g, this.venue, this.base.rank, Math.round(cx - 64 * pop), Math.round(150 - 64 * pop), Math.round(128 * pop));
      if (this.resT > 30) icon(g, '✨', cx + 50, 90 + Math.round(Math.sin(this.resT / 8) * 4), 24, 'center');
      if (this.coins && this.resT > 30) {       // the prize: 🪙 +N
        icon(g, '🪙', cx - 34, 238, 30, 'center');
        text(g, `+${this.coins}`, cx - 10, 238, { size: 28, color: '#C89018', shadow: '#F8E8A0' });
      }
      if (this.gift && this.resT > 40) icon(g, '🎁', cx + 66, 236 - Math.round(Math.abs(Math.sin(this.resT / 8)) * 10), 32, 'center');
    } else if (this.hint) {
      // what to train: where the time went → the training for it
      const what = { run: ['🏃', '⚡'], barrier: ['🧱', '💪'], trap: ['🛡️', '🛡️'] }[this.hint];
      icon(g, what[0], cx - 44, 120, 44, 'center');
      icon(g, '➡️', cx, 128, 28, 'center');
      icon(g, what[1], cx + 48, 116, 48, 'center');
      icon(g, '🔁', cx, 210, 30, 'center');
    }
    if (this.resT > 50 && Math.floor(this.resT / 20) % 2 === 0) icon(g, '✔️', cx, 300, 24, 'center');
  }
}
