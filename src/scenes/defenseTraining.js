// 🛡️ Defense training: guess the attack (DESIGN.md "Training"). The Pokémon stands in an arena with four sides
// (up, left, right, down), each showing an answer. The right answer marks the side a wild Pokémon will attack from.
// Press a direction to turn the shield toward it (change your mind as often as you like), then A to brace: the
// shield locks, and only then does the attacker run in from that side and use one of its moves (game/moves.js).
// There's no timer, and nothing gives the side away beforehand, so the math is required. Blocked → the move bursts
// on the shield; hit → a flinch (nothing is lost) and the right answer. The attackers come from the race opponents
// near the Pokémon's Defense (bigger ones as it grows). Tab ends early, keeping what's earned.
import { Scene, text } from '../core/ui.js';
import { img, isReady } from '../core/assets.js';
import { se, cry } from '../core/audio.js';
import { TILESETS } from '../world/tileset.js';
import { SPECIES } from '../game/species.js';
import { activePokemon } from '../game/pokemon.js';
import { movesFor } from '../game/moves.js';
import { budgetFor } from '../game/race.js';
import { RACES } from '../data/races.js';
import { nextProblem, choices, record, problemText, currentLevel, Ease } from '../game/math.js';
import { drawRun, icon } from './common.js';
import { MoveFx } from './moveFx.js';
import { TrainingResults } from './trainingResults.js';

const VW = 512, VH = 384, PANEL_H = 64;
const PK = { x: 256, y: 250 };                     // the Pokémon's feet
const BODY = { x: 256, y: 214 };                   // where attacks land and the shield circles
const DIRS = ['up', 'left', 'right', 'down'];
const POINTS = { up: { x: 256, y: 74 }, left: { x: 44, y: 150 }, right: { x: 468, y: 150 }, down: { x: 256, y: 336 } };
const ANGLE = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };
const ROW = { down: 0, left: 1, right: 2, up: 3 };
// an attacker comes in from off screen on its side, stops here (feet), attacks, and runs back out
const ENTER = { up: [256, 30], left: [-50, 250], right: [562, 250], down: [256, 450] };
const STAND = { up: [256, 138], left: [112, 250], right: [400, 250], down: [256, 364] };
const FACING = { up: 'down', left: 'right', right: 'left', down: 'up' };      // which way it runs in
const IN_FRAMES = 30, OUT_FRAMES = 24;

function tile(g, id, x, y) {
  const ts = img(TILESETS[1].image);
  if (!isReady(ts) || id < 384) return;
  const i = id - 384;
  g.drawImage(ts, (i % 8) * 32, Math.floor(i / 8) * 32, 32, 32, x, y, 32, 32);
}

/** Wild Pokémon for a Pokémon's Defense: the opponents of the races whose yardstick is nearest it. */
function attackersFor(defense) {
  const near = [...RACES].sort((a, b) => Math.abs(budgetFor(a.n) / 3 - defense) - Math.abs(budgetFor(b.n) / 3 - defense)).slice(0, 5);
  return near.flatMap(r => r.opponents.map(o => o.species)).filter(id => SPECIES.get(id)?.sprites.run);
}

export class DefenseTrainingScene extends Scene {
  constructor() {
    super();
    this.opaque = true;
    this.music = 'Arena.wav';
    this.started = false;
  }

  start() {
    const seat = this.seat;
    this.settings = seat.settings;
    this.pk = activePokemon(seat.profile);
    this.sp = SPECIES.get(this.pk.species);
    this.attackers = attackersFor(this.pk.stats.defense);
    this.fx = new MoveFx();
    this.t = 0;
    this.phase = 'guard';
    this.right = 0; this.wrong = 0;
    this.ease = new Ease(this.settings);   // a run of misses → easier problems
    this.problem = null; this.shield = null;
    this.attack = null;       // { dir, species, move, t, hit, dur }: an attacker coming in, attacking, leaving
    this.answer = null; this.wait = 50;
    this.flinch = 0; this.flash = 0; this.keepShield = 0;
    this.parts = [];
    this.lastFact = null;
    this.startLevel = currentLevel(seat.profile, this.settings);
    this.started = true;
  }

  update(input) {
    if (!this.started) this.start();
    this.t++;
    if (this.phase === 'results') { if (this.results.update(input)) this.close(this.results.gain); return; }
    if (input.pressed('start')) return this.endSession();
    if (this.flinch > 0) this.flinch--;
    if (this.flash > 0) this.flash--;
    if (this.keepShield > 0 && !this.problem && !this.attack) this.keepShield--;
    if (this.answer && --this.answer.t <= 0) this.answer = null;
    for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.t--; }
    this.parts = this.parts.filter(p => p.t > 0);
    this.fx.update();

    const p = this.problem;
    if (!p && !this.attack && !this.answer && --this.wait <= 0) {
      if (this.t >= this.settings.sessionSeconds * 60) return this.endSession();
      this.newProblem();
      return;
    }
    if (p && !p.locked) {
      for (const d of DIRS) if (input.pressed(d) && this.shield !== d) {
        this.shield = d; p.lastMove = this.t; se('GUI sel cursor', 0.4);
      }
      if (input.pressed('a')) { if (this.shield) this.lock(); else se('GUI sel buzzer', 0.5); }
    } else if (p && p.locked && --p.fireIn === 0) this.sendAttacker(DIRS[p.values.indexOf(p.fact.answer)]);

    const a = this.attack;
    if (a) {
      a.t++;
      if (a.t === IN_FRAMES) {                    // it's arrived: its move, at the shield or at the Pokémon
        const [sx, sy] = STAND[a.dir], ang = ANGLE[a.dir], blocked = this.problem && this.problem.ok;
        const target = blocked ? { x: BODY.x + Math.cos(ang) * 62, y: BODY.y + Math.sin(ang) * 62, scale: 0.55 } : { x: BODY.x, y: BODY.y, scale: 0.6 };
        const { dur, hit } = this.fx.play(a.move, { x: sx, y: sy - 30, scale: 0.55 }, target, () => cry(SPECIES.get(a.species)?.sprites.cry, 0.6));
        a.hit = IN_FRAMES + Math.max(1, hit); a.dur = IN_FRAMES + dur;
        cry(SPECIES.get(a.species)?.sprites.cry, 0.5);
      }
      if (a.hit && a.t === a.hit) this.land();
      if (a.dur && a.t >= a.dur + OUT_FRAMES) this.attack = null;
    }
  }

  newProblem() {
    const fact = nextProblem(this.seat.profile, this.settings, this.lastFact, { easy: this.ease.on });
    this.lastFact = fact;
    this.problem = { fact, values: choices(fact, 4), shownAt: this.t, locked: false, lastMove: null, fireIn: 0 };
    this.shield = null;
  }

  /** A: the shield locks and the answer is recorded; the attacker comes next. */
  lock() {
    const p = this.problem;
    p.locked = true; p.fireIn = 20;
    se('move-anims/Harden', 0.8);
    const picked = p.values[DIRS.indexOf(this.shield)];
    p.ok = record(this.seat.profile, p.fact, picked, p.lastMove === null ? null : (p.lastMove - p.shownAt) * 1000 / 60, this.settings);
    this.ease.record(p.ok);
  }

  /** The attacker: a wild Pokémon runs in from that side, with one of its moves ready. */
  sendAttacker(dir) {
    const species = this.attackers[Math.floor(Math.random() * this.attackers.length)] || 'RATTATA';
    const moves = movesFor(species);
    this.attack = { dir, species, move: moves[Math.floor(Math.random() * moves.length)], t: 0, hit: 0, dur: 0 };
    MoveFx.preload([this.attack.move]);
    se('Player jump', 0.5);
  }

  land() {
    const p = this.problem, a = this.attack;
    const said = `${problemText(p.fact)} = ${p.fact.answer}`;
    if (p.ok) {
      this.right++;
      se('Battle damage weak');
      cry(this.sp.sprites.cry, 0.4);
      const ang = ANGLE[a.dir];
      const sx = BODY.x + Math.cos(ang) * 60, sy = BODY.y + Math.sin(ang) * 60;
      for (let k = 0; k < 18; k++) {
        const b = ang + (Math.random() - 0.5) * 2.4, v = 2 + Math.random() * 3;
        this.parts.push({ x: sx, y: sy, vx: Math.cos(b) * v, vy: Math.sin(b) * v, t: 26, c: k % 2 ? '#58A0F8' : '#FFFFFF' });
      }
      this.answer = { text: said, ok: true, t: 40 };
      this.wait = 20;
    } else {
      this.wrong++;
      this.flinch = 36; this.flash = 10;
      se('Battle damage normal');
      this.answer = { text: said, ok: false, t: Math.round(this.settings.showAnswerMs * 60 / 1000) + 20 };
      this.wait = 10;
    }
    this.problem = null;
    this.keepShield = 30;
  }

  endSession() {
    this.problem = null; this.attack = null;
    const trophies = currentLevel(this.seat.profile, this.settings) > this.startLevel ? ['⭐'] : [];
    this.results = new TrainingResults(this.seat, this.pk, 'defense', this.right, trophies);
    this.phase = 'results';
  }

  // ------------------------------------------------------------------ drawing
  draw(g) {
    if (!this.started) return;
    g.save(); g.translate(Math.round(this.fx.shake.x), Math.round(this.fx.shake.y));
    this.drawArena(g);
    const behind = this.attack && this.attack.dir === 'up';     // one from the top stands behind the Pokémon
    if (behind) this.drawAttacker(g);
    this.drawPokemon(g);
    if (this.attack && !behind) this.drawAttacker(g);
    this.drawShield(g);
    this.fx.draw(g);
    for (const p of this.parts) { g.fillStyle = p.c; g.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 5, 5); }
    g.restore();
    for (const d of DIRS) this.drawPoint(g, d);
    if (this.flash) { g.fillStyle = `rgba(255,255,255,${this.flash / 14})`; g.fillRect(0, PANEL_H, VW, VH - PANEL_H); }
    this.drawPanel(g);
    if (this.phase === 'results') this.results.draw(g);
  }

  drawArena(g) {
    for (let y = PANEL_H - 32; y < VH; y += 32) for (let x = 0; x < VW; x += 32) tile(g, 546, x, y);   // sand (the middle of the sand patch)
    // the ring the Pokémon stands in
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 4;
    g.beginPath(); g.arc(BODY.x, BODY.y + 20, 96, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(160,120,60,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.arc(BODY.x, BODY.y + 20, 150, 0, Math.PI * 2); g.stroke();
  }

  /** A side's answer, with a little arrow pointing the way the attacker would come. */
  drawPoint(g, d) {
    const p = POINTS[d];
    if (!this.problem) return;
    const w = 64, h = 42;
    g.fillStyle = '#F8F8F0'; g.fillRect(p.x - w / 2, p.y - 2, w, h);
    g.strokeStyle = this.shield === d ? this.seat.color : '#484848'; g.lineWidth = this.shield === d ? 5 : 3;
    g.strokeRect(p.x - w / 2, p.y - 2, w, h);
    text(g, String(this.problem.values[DIRS.indexOf(d)]), p.x, p.y + 4, { size: 30, align: 'center', family: '"Power Clear Bold"' });
  }

  drawPokemon(g) {
    const off = this.fx.offset('target');
    const shake = (this.flinch ? Math.round(Math.sin(this.flinch * 1.4) * 5) : 0) + Math.round(off.x);
    const face = this.shield || 'down';
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(PK.x, PK.y - 4, 26, 8, 0, 0, Math.PI * 2); g.fill();
    g.save();
    if (this.flinch > 24) g.filter = 'brightness(2)';
    drawRun(g, this.pk.species, ROW[face], Math.floor(this.t / 14), PK.x + shake, PK.y + 18, 2);
    g.restore();
    if (this.flinch) icon(g, '💫', PK.x, PK.y - 104, 22, 'center');
  }

  drawShield(g) {
    const d = this.shield;
    if (!d || (!this.problem && !this.attack && !this.keepShield)) return;
    const locked = !this.problem || this.problem.locked;
    const a = ANGLE[d];
    g.strokeStyle = locked ? '#3868D8' : 'rgba(88,160,248,0.75)';
    g.lineWidth = locked ? 10 : 7;
    g.beginPath(); g.arc(BODY.x, BODY.y, 60, a - 0.7, a + 0.7); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2;
    g.beginPath(); g.arc(BODY.x, BODY.y, 55, a - 0.6, a + 0.6); g.stroke();
    icon(g, '🛡️', BODY.x + Math.cos(a) * 78, BODY.y + Math.sin(a) * 78 - 12, 22, 'center');
  }

  /** The wild Pokémon: running in, standing its ground while its move plays, running back out. */
  drawAttacker(g) {
    const a = this.attack, [ex, ey] = ENTER[a.dir], [sx, sy] = STAND[a.dir];
    let f, row = ROW[FACING[a.dir]], moving = true;
    if (a.t < IN_FRAMES) f = a.t / IN_FRAMES;
    else if (!a.dur || a.t < a.dur) { f = 1; moving = false; }
    else { f = 1 - (a.t - a.dur) / OUT_FRAMES; row = ROW[a.dir]; }         // turned round, running off
    const off = moving ? { x: 0, y: 0 } : this.fx.offset('user');
    const x = Math.round(ex + (sx - ex) * f + off.x), y = Math.round(ey + (sy - ey) * f + off.y);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y - 4, 22, 7, 0, 0, Math.PI * 2); g.fill();
    drawRun(g, a.species, row, moving ? Math.floor(this.t / 4) : Math.floor(this.t / 12), x, y + 16, 1.8);
  }

  drawPanel(g) {
    g.fillStyle = '#F8F8F0'; g.fillRect(0, 0, VW, PANEL_H);
    g.fillStyle = this.seat.color; g.fillRect(0, PANEL_H - 4, VW, 4);
    if (this.answer) {
      text(g, this.answer.text, VW / 2, 10, { size: 40, align: 'center', family: '"Power Clear Bold"',
        color: this.answer.ok ? '#30A040' : '#D03828', shadow: this.answer.ok ? '#B8E8B8' : '#F0B8A8' });
    } else if (this.problem) {
      text(g, problemText(this.problem.fact), VW / 2, 10, { size: 40, align: 'center', family: '"Power Clear Bold"' });
    }
    // shield turned but not braced yet: a pulsing ✔ says "press A"
    const p = this.problem;
    if (p && !p.locked && this.shield && Math.floor(this.t / 15) % 2 === 0) icon(g, '✔️', 14, 16, 26);
    const left = Math.max(0, 1 - this.t / (this.settings.sessionSeconds * 60));
    icon(g, '⏱️', VW - 118, 16, 20);
    g.fillStyle = '#404048'; g.fillRect(VW - 90, 22, 80, 14);
    g.fillStyle = '#58A8E8'; g.fillRect(VW - 88, 24, Math.round(76 * left), 10);
  }
}
