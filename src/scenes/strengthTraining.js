// 💪 Strength training: break the rock (DESIGN.md "Training"). The Pokémon stands in a quarry, seen from behind,
// with something heavy in front of it: a small tree → a rock → a boulder → a dark boulder (heavier ones as Strength
// grows, and every two broken during a session). It knows three real moves (game/moves.js), listed on the right,
// each showing an answer. Up/down moves the arrow, A uses the move: the right answer's move plays and hits (a crack
// per hit; enough → CRACK and the next one rolls in); a wrong one flies wide and the right answer shows. Same
// session rules as the other games: a soft cap, never mid-problem, then the results; Tab ends early.
import { Scene, text } from '../core/ui.js';
import { img, isReady } from '../core/assets.js';
import { se, cry } from '../core/audio.js';
import { TILESETS } from '../world/tileset.js';
import { SPECIES } from '../game/species.js';
import { activePokemon } from '../game/pokemon.js';
import { movesFor } from '../game/moves.js';
import { TYPE_GLOW } from '../game/anims.js';
import { nextProblem, choices, record, problemText, currentLevel, Ease } from '../game/math.js';
import { drawRun, icon } from './common.js';
import { MoveFx } from './moveFx.js';
import { TrainingResults } from './trainingResults.js';

const VW = 512, VH = 384, PANEL_H = 64;
const PK = { x: 190, y: 360 };        // the Pokémon's feet (it faces up, towards the rock)
const OBJ = { x: 190, y: 214 };       // the heavy thing's base
const MENU = { x: 356, y: 150, w: 146, h: 64, gap: 12 };   // the three moves, top to bottom

// Heavier and heavier. breakSheet: the sheet whose rows 1–3 play the break (Cut / Rock Smash).
const OBJECTS = [
  { sheet: 'characters/Object tree 1.png', scale: 2, hp: 3, icon: '🪵', sound: 'Cut' },
  { sheet: 'characters/Object rock.png', scale: 2, hp: 4, icon: '🪨', sound: 'Rock Smash' },
  { sheet: 'characters/Object boulder.png', scale: 3, hp: 5, icon: '🪨', sound: 'Rock Smash', breakSheet: 'characters/Object rock.png' },
  { sheet: 'characters/Object boulder.png', scale: 3, hp: 6, icon: '🪨', sound: 'Rock Smash', breakSheet: 'characters/Object rock.png', dark: true },
];

function tile(g, id, x, y) {
  const ts = img(TILESETS[1].image);
  if (!isReady(ts) || id < 384) return;
  const i = id - 384;
  g.drawImage(ts, (i % 8) * 32, Math.floor(i / 8) * 32, 32, 32, x, y, 32, 32);
}

export class StrengthTrainingScene extends Scene {
  constructor() {
    super();
    this.opaque = true;
    this.music = 'Quarry.wav';
    this.started = false;
  }

  start() {
    const seat = this.seat;
    this.settings = seat.settings;
    this.pk = activePokemon(seat.profile);
    this.sp = SPECIES.get(this.pk.species);
    this.moves = movesFor(this.pk.species);
    MoveFx.preload(this.moves);
    this.fx = new MoveFx();
    this.baseTier = Math.min(OBJECTS.length - 1, Math.floor(this.pk.stats.strength / this.settings.strengthPerTier));
    this.t = 0;
    this.phase = 'play';
    this.right = 0; this.wrong = 0; this.cracked = 0;
    this.ease = new Ease(this.settings);   // a run of misses → easier problems
    this.trophies = [];
    this.problem = null;
    this.cursor = 0;                       // which move the arrow is on
    this.using = null;                     // { move, ok, t, hit, dur } a move playing out
    this.answer = null; this.wait = 50;
    this.shakeT = 0; this.miss = 0;
    this.parts = [];
    this.lastFact = null;
    this.startLevel = currentLevel(seat.profile, this.settings);
    this.newObject();
    this.started = true;
  }

  newObject() {
    const tier = Math.min(OBJECTS.length - 1, this.baseTier + Math.floor(this.cracked / 2));
    this.obj = { ...OBJECTS[tier], hits: 0, roll: 50, breaking: 0 };
  }

  update(input) {
    if (!this.started) this.start();
    this.t++;
    if (this.phase === 'results') { if (this.results.update(input)) this.close(this.results.gain); return; }
    if (input.pressed('start')) return this.endSession();
    const o = this.obj;
    if (o.roll > 0) o.roll--;
    if (o.breaking > 0 && --o.breaking === 0) this.newObject();
    if (this.shakeT > 0) this.shakeT--;
    if (this.miss > 0) this.miss--;
    if (this.answer && --this.answer.t <= 0) this.answer = null;
    for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.t--; }
    this.parts = this.parts.filter(p => p.t > 0);
    this.fx.update();
    if (this.using && ++this.using.t === this.using.hit) this.land();
    if (this.using && this.using.t >= this.using.dur) this.using = null;

    // the arrow moves any time; A uses the move under it
    if (input.repeatPressed('up')) { this.cursor = (this.cursor + 2) % 3; se('GUI sel cursor', 0.35); }
    if (input.repeatPressed('down')) { this.cursor = (this.cursor + 1) % 3; se('GUI sel cursor', 0.35); }

    const busy = o.roll > 0 || o.breaking > 0 || this.answer || this.using;
    if (!this.problem && !busy && --this.wait <= 0) {
      if (this.t >= this.settings.sessionSeconds * 60) return this.endSession();
      this.newProblem();
    }
    if (this.problem && input.pressed('a')) this.use(this.cursor);
  }

  newProblem() {
    const fact = nextProblem(this.seat.profile, this.settings, this.lastFact, { easy: this.ease.on });
    this.lastFact = fact;
    this.problem = { fact, values: choices(fact, 3), shownAt: this.t };   // values[i] sits on move i
  }

  /** A on a move: record the answer, then the move plays: at the rock if right, wide of it if not. */
  use(i) {
    const p = this.problem;
    this.problem = null;
    const picked = p.values[i];
    const ok = record(this.seat.profile, p.fact, picked, (this.t - p.shownAt) * 1000 / 60, this.settings);
    this.ease.record(ok);
    const move = this.moves[i], s = this.obj.scale;
    const user = { x: PK.x, y: PK.y - 50, scale: 0.7 };
    const target = { x: OBJ.x + (ok ? 0 : 150), y: OBJ.y - 16 * s + (ok ? 0 : -30), scale: 0.45 + 0.12 * s };
    const { dur, hit } = this.fx.play(move, user, target, () => cry(this.sp.sprites.cry, 0.7));
    this.using = { move, ok, t: 0, hit, dur, said: `${problemText(p.fact)} = ${p.fact.answer}` };
    this.used = i;
  }

  land() {
    const u = this.using, o = this.obj;
    if (u.ok) {
      this.right++;
      o.hits++;
      this.answer = { text: u.said, ok: true, t: 34 };
      this.wait = 16;
      if (o.hits >= o.hp) this.crack();
    } else {
      this.wrong++;
      this.miss = 40;
      se('Player bump');
      this.answer = { text: u.said, ok: false, t: Math.round(this.settings.showAnswerMs * 60 / 1000) };
      this.wait = 10;
    }
  }

  crack() {
    const o = this.obj;
    o.breaking = 48;
    this.cracked++;
    this.trophies.push(o.icon);
    this.shakeT = 20;
    se(o.sound);
    for (let k = 0; k < 24; k++) {
      const a = -Math.PI * Math.random(), v = 2 + Math.random() * 4;
      this.parts.push({ x: OBJ.x, y: OBJ.y - 16 * o.scale, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 40, c: k % 3 ? '#8C7454' : '#F8E080' });
    }
  }

  endSession() {
    this.problem = null;
    if (currentLevel(this.seat.profile, this.settings) > this.startLevel) this.trophies.push('⭐');
    this.results = new TrainingResults(this.seat, this.pk, 'strength', this.right, this.trophies);
    this.phase = 'results';
  }

  // ------------------------------------------------------------------ drawing
  draw(g) {
    if (!this.started) return;
    const sx = (this.shakeT ? Math.round(Math.sin(this.shakeT * 2) * 4) : 0) + Math.round(this.fx.shake.x);
    g.save(); g.translate(sx, Math.round(this.fx.shake.y));
    this.drawQuarry(g);
    this.drawObject(g);
    this.drawPokemon(g);
    this.fx.draw(g);
    for (const p of this.parts) { g.fillStyle = p.c; g.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 3, 6, 6); }
    g.restore();
    this.drawMoves(g);
    this.drawPanel(g);
    if (this.phase === 'results') this.results.draw(g);
  }

  drawQuarry(g) {
    for (let y = PANEL_H - 32; y < VH; y += 32) for (let x = -32; x < VW + 32; x += 32) tile(g, 602, x, y);
    for (const [x, y] of [[0, 64], [32, 64], [0, 352], [32, 320], [288, 64], [320, 64]]) tile(g, 1328, x, y);
    tile(g, 1512, 0, 96); tile(g, 1513, 32, 96);
  }

  drawObject(g) {
    const o = this.obj, s = o.scale, size = 32 * s, off = this.fx.offset('target');
    let x = OBJ.x + off.x, y = OBJ.y + off.y;
    if (o.roll > 0) x += o.roll * 8;
    let sheet = o.sheet, row = 0, col = o.roll > 0 ? Math.floor(o.roll / 4) % 4 : 0;
    if (o.breaking > 0) {
      sheet = o.breakSheet || o.sheet;
      const k = Math.floor((48 - o.breaking) / 4);        // 12 frames: rows 1–3, 4 columns each
      row = 1 + Math.min(2, Math.floor(k / 4)); col = k % 4;
    }
    const i = img(sheet);
    if (!isReady(i)) return;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y - 4, size * 0.4, size * 0.12, 0, 0, Math.PI * 2); g.fill();
    if (o.dark && !o.breaking) g.filter = 'brightness(0.72) saturate(0.6)';   // the heaviest: a dark granite boulder
    g.drawImage(i, col * 32, row * 32, 32, 32, Math.round(x - size / 2), Math.round(y - size), size, size);
    g.filter = 'none';
    if (!o.breaking && o.hits) {                          // cracks so far
      g.strokeStyle = '#302418'; g.lineWidth = 2;
      for (let k = 0; k < o.hits; k++) {
        const cx = x - size * 0.3 + ((k * 37) % 60) / 100 * size, cy = y - size * 0.75 + ((k * 23) % 50) / 100 * size;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + size * 0.08, cy + size * 0.1); g.lineTo(cx + size * 0.02, cy + size * 0.2);
        g.lineTo(cx + size * 0.12, cy + size * 0.28); g.stroke();
      }
    }
  }

  drawPokemon(g) {
    const off = this.fx.offset('user'), x = Math.round(PK.x + off.x), y = Math.round(PK.y + off.y);
    const frame = this.using ? Math.floor(this.t / 5) : Math.floor(this.t / 16);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y - 4, 30, 9, 0, 0, Math.PI * 2); g.fill();
    drawRun(g, this.pk.species, 3, frame, x, y + 22, 2.5);               // row 3: facing up, away from us
    if (this.miss) icon(g, '💫', x, y - 96, 24, 'center');
  }

  /** The three moves: type colour, name, and the answer on it; the arrow on the chosen one. */
  drawMoves(g) {
    this.moves.forEach((mv, i) => {
      const x = MENU.x, y = MENU.y + i * (MENU.h + MENU.gap), sel = i === this.cursor;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 4, y + 4, MENU.w, MENU.h);
      g.fillStyle = TYPE_GLOW[mv.type] || '#E8E8D0'; g.fillRect(x, y, MENU.w, MENU.h);
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x + 4, y + 4, MENU.w - 8, MENU.h - 8);
      g.strokeStyle = sel ? this.seat.color : '#484848'; g.lineWidth = sel ? 5 : 2; g.strokeRect(x, y, MENU.w, MENU.h);
      text(g, mv.name, x + MENU.w / 2, y + 4, { size: 16, align: 'center', shadow: null });
      if (this.problem) text(g, String(this.problem.values[i]), x + MENU.w / 2, y + 22, { size: 34, align: 'center', family: '"Power Clear Bold"' });
      if (sel) {
        const bx = x - 22 + Math.round(Math.sin(this.t / 6) * 3), by = y + MENU.h / 2;
        g.fillStyle = this.seat.color;
        g.beginPath(); g.moveTo(bx, by - 12); g.lineTo(bx + 16, by); g.lineTo(bx, by + 12); g.closePath(); g.fill();
        g.strokeStyle = '#303030'; g.lineWidth = 2; g.stroke();
      }
    });
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
    // this object: one pip per hit it needs
    const o = this.obj;
    icon(g, '💪', 10, 16, 22);
    for (let k = 0; k < o.hp; k++) {
      g.fillStyle = k < o.hits ? '#E86040' : '#404048';
      g.fillRect(40 + k * 14, 22, 10, 14);
    }
    const left = Math.max(0, 1 - this.t / (this.settings.sessionSeconds * 60));
    icon(g, '⏱️', VW - 118, 16, 20);
    g.fillStyle = '#404048'; g.fillRect(VW - 90, 22, 80, 14);
    g.fillStyle = '#58A8E8'; g.fillRect(VW - 88, 24, Math.round(76 * left), 10);
  }
}
