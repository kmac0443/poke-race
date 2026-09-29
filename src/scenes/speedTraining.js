// ⚡ Speed training: the lane run (DESIGN.md "Training"). The Pokémon runs right by itself along a three-lane
// track seen from above; up/down is the only control. A problem shows at the top and each lane's next gate holds
// an answer: be in the right lane when it arrives. Right → faster (up to a top speed set by the Speed stat),
// sparkles, a cry. Wrong → a stumble, it eases back, and the right answer shows. After sessionSeconds (never
// mid-problem) a finish line, then the results: the Speed the session earned. Tab ends early (keeps what's earned).
import { Scene, text } from '../core/ui.js';
import { img, isReady, draw } from '../core/assets.js';
import { se, cry } from '../core/audio.js';
import { TILESETS } from '../world/tileset.js';
import { SPECIES } from '../game/species.js';
import { activePokemon } from '../game/pokemon.js';
import { nextProblem, choices, record, problemText, currentLevel, Ease } from '../game/math.js';
import { drawRun, icon } from './common.js';
import { MoveFx } from './moveFx.js';
import { movesFor } from '../game/moves.js';
import { TrainingResults } from './trainingResults.js';

const VW = 512, VH = 384;
const PANEL_H = 64, TRACK_Y = 128, LANE_H = 64, LANES = 3;
const RUN_X = 120;           // where the Pokémon runs on screen
const BASE_SPEED = 4;        // px per frame at 1.0×
const laneMid = i => TRACK_Y + i * LANE_H + LANE_H / 2;

function tile(g, id, x, y) {
  const ts = img(TILESETS[1].image);
  if (!isReady(ts) || id < 384) return;
  const i = id - 384;
  g.drawImage(ts, (i % 8) * 32, Math.floor(i / 8) * 32, 32, 32, x, y, 32, 32);
}
const hash = n => ((n * 2654435761) >>> 0) % 97;

export class SpeedTrainingScene extends Scene {
  constructor() {
    super();
    this.opaque = true;
    this.music = 'Speed Track.wav';
    this.started = false;
  }

  start() {
    const seat = this.seat;
    this.settings = seat.settings;
    this.pk = activePokemon(seat.profile);
    this.sp = SPECIES.get(this.pk.species);
    this.top = this.settings.speedTopBase + this.settings.speedTopPerStat * this.pk.stats.speed;
    this.gap = this.settings.speedGateSeconds * 60 * BASE_SPEED;   // px between gates
    this.worldX = 0;
    this.mult = 1;
    this.stumble = 0;
    this.lane = 1; this.laneY = laneMid(1);
    this.t = 0;
    this.phase = 'run';       // run → finish → results
    this.gate = null;         // { x, fact, values, shownAt, lastMove }
    this.answer = null;       // { text, ok, t } shown in the panel after a gate
    this.wait = 60;           // frames until the next gate appears
    this.right = 0; this.wrong = 0;
    this.lastFact = null;
    this.ease = new Ease(this.settings);   // a run of misses → easier problems, gates further apart
    this.parts = [];          // sparkles, dust
    this.boards = [];         // a passed gate's answer boards, flying apart (right) or toppling (wrong)
    this.moves = movesFor(this.pk.species); MoveFx.preload(this.moves);
    this.fx = new MoveFx();   // its own moves, bursting through the right gate
    this.streak = 0; this.boost = 0;   // 3 right in a row → a boost: a dash, a flash, afterimages
    this.finishX = null;
    this.startLevel = currentLevel(seat.profile, this.settings);
    this.started = true;
  }

  get speed() { return BASE_SPEED * this.mult * (this.stumble > 0 ? 0.4 : 1) * (this.boost > 0 ? 1.35 : 1); }
  get runnerX() { return this.worldX + RUN_X; }

  update(input) {
    if (!this.started) this.start();
    this.t++;
    if (this.phase === 'results') return this.updateResults(input);
    if (input.pressed('start')) { this.endSession(); return; }

    // steering
    const want = this.lane + (input.repeatPressed('up') ? -1 : 0) + (input.repeatPressed('down') ? 1 : 0);
    if (want !== this.lane && want >= 0 && want < LANES) {
      this.lane = want;
      se('GUI sel cursor', 0.35);
      if (this.gate) this.gate.lastMove = this.t;
    }
    this.laneY += (laneMid(this.lane) - this.laneY) * 0.3;

    // running
    this.worldX += this.speed;
    if (this.stumble > 0) this.stumble--;
    if (this.boost > 0) this.boost--;
    this.fx.update();
    for (const b of this.boards) { b.x += b.vx - this.speed; b.y += b.vy; b.vy += 0.35; b.rot += b.vr; b.t--; }
    this.boards = this.boards.filter(b => b.t > 0);
    if (this.t % Math.max(2, Math.round(8 / this.mult)) === 0) {
      this.parts.push({ x: RUN_X - 18, y: this.laneY + 22, vx: -1 - Math.random(), vy: -0.3 - Math.random() * 0.4, t: 22, kind: 'dust' });
    }

    // gates
    const sessionOver = this.t >= this.settings.sessionSeconds * 60;
    if (!this.gate && this.phase === 'run') {
      if (sessionOver && !this.answer) {
        if (this.finishX === null) this.finishX = this.runnerX + 420;
      } else if (--this.wait <= 0 && !this.answer) this.newGate();
    }
    if (this.gate && this.gate.x <= this.runnerX) this.passGate();
    if (this.answer && --this.answer.t <= 0) this.answer = null;
    if (this.finishX !== null && this.runnerX >= this.finishX && this.phase === 'run') {
      this.phase = 'finish'; this.finishT = 0;
      se('Voltorb Flip level up');
    }
    if (this.phase === 'finish' && ++this.finishT > 70) this.endSession();

    for (const p of this.parts) { p.x += p.vx - (p.kind === 'dust' ? 0 : this.speed * 0.2); p.y += p.vy; p.t--; }
    this.parts = this.parts.filter(p => p.t > 0);
  }

  newGate() {
    const profile = this.seat.profile;
    const fact = nextProblem(profile, this.settings, this.lastFact, { easy: this.ease.on });
    this.lastFact = fact;
    this.gate = { x: this.runnerX + this.gap * this.ease.slower, fact, values: choices(fact, LANES), shownAt: this.t, lastMove: null };
  }

  passGate() {
    const g = this.gate, profile = this.seat.profile;
    this.gate = null;
    const picked = g.values[this.lane];
    const ms = g.lastMove === null ? null : (g.lastMove - g.shownAt) * 1000 / 60;
    const ok = record(profile, g.fact, picked, ms, this.settings);
    this.ease.record(ok);
    this.breakGate(g, ok);
    if (ok) {
      this.right++;
      this.streak++;
      const mv = this.moves[(this.streak - 1) % this.moves.length], y = this.laneY - 24;
      this.fx.play(mv, { x: RUN_X, y, scale: 0.45 }, { x: RUN_X + 70, y, scale: 0.55 });
      if (this.streak % 3 === 0) { this.boost = 90; se('move-anims/Ace', 0.8); }
      this.mult = Math.min(this.top, this.mult + this.settings.speedupPerCorrect);
      se('Voltorb Flip point');
      cry(this.sp.sprites.cry, 0.45);
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 2.5;
        this.parts.push({ x: RUN_X, y: this.laneY - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 30, kind: 'star' });
      }
      this.answer = { text: `${problemText(g.fact)} = ${g.fact.answer}`, ok: true, t: 40 };
      this.wait = 20;
    } else {
      this.wrong++;
      this.streak = 0; this.boost = 0;
      this.mult = Math.max(1, this.mult - 0.2);
      this.stumble = 45;
      se('Player bump');
      // the right answer stays up a moment, and the next problem waits for it
      this.answer = { text: `${problemText(g.fact)} = ${g.fact.answer}`, ok: false, t: Math.round(this.settings.showAnswerMs * 60 / 1000) };
      this.wait = 10;
    }
  }

  /** The gate the runner just went through: its boards burst apart (right) or topple over (wrong). */
  breakGate(g, ok) {
    const x = Math.round(g.x - this.worldX);
    g.values.forEach((v, i) => {
      const mine = i === this.lane;
      this.boards.push({ x, y: laneMid(i) - 28, v, t: 60, rot: 0,
        vx: ok ? 3 + Math.random() * 3 + (mine ? 4 : 0) : (mine ? 1.5 : 0.5), vy: ok ? -4 - Math.random() * 3 - (mine ? 2 : 0) : -1,
        vr: ok ? (Math.random() - 0.5) * 0.4 : (mine ? 0.12 : 0.05) });
    });
  }

  endSession() {
    const up = currentLevel(this.seat.profile, this.settings) > this.startLevel;
    this.results = new TrainingResults(this.seat, this.pk, 'speed', this.right, up ? ['⭐'] : []);
    this.phase = 'results';
  }

  updateResults(input) {
    if (this.results.update(input)) this.close(this.results.gain);
  }

  // ------------------------------------------------------------------ drawing
  draw(g) {
    if (!this.started) return;
    this.drawTrack(g);
    this.drawGate(g);
    // the runner: shadow, bob, faster legs as it speeds up
    const bob = Math.round(Math.abs(Math.sin(this.t * 0.25 * this.mult)) * -4);
    const lunge = this.fx.offset('user');
    const shake = (this.stumble > 0 ? Math.round(Math.sin(this.stumble * 1.5) * 4) : 0) + Math.round(lunge.x);
    for (const b of this.boards) this.drawBoard(g, b);
    if (this.boost > 0) {                           // afterimages while boosting
      for (let k = 3; k >= 1; k--) {
        g.save(); g.globalAlpha = 0.18 * (4 - k);
        drawRun(g, this.pk.species, 2, Math.floor(this.worldX / 22) - k, RUN_X - k * 26, Math.round(this.laneY) + 38, 2);
        g.restore();
      }
    }
    draw(g, 'pokemon/shadow/2.png', RUN_X - 36 + shake, Math.round(this.laneY) + 12);
    const frame = Math.floor(this.worldX / 22);
    drawRun(g, this.pk.species, 2, frame, RUN_X + shake, Math.round(this.laneY) + 38 + bob, 2);
    if (this.stumble > 0) icon(g, '💫', RUN_X, Math.round(this.laneY) - 50, 22, 'center');
    // speed lines once it's really going
    if (this.mult > 1.15 && this.stumble === 0) {
      g.fillStyle = 'rgba(255,255,255,0.7)';
      for (let k = 0; k < 5; k++) {
        const y = TRACK_Y + ((k * 53 + Math.floor(this.worldX / 3)) % (LANES * LANE_H));
        const x = (VW - ((this.worldX * 1.7 + k * 131) % (VW + 120)));
        g.fillRect(Math.round(x), y, Math.round(30 + 40 * (this.mult - 1)), 2);
      }
    }
    this.fx.draw(g);
    if (this.boost > 80) { g.fillStyle = `rgba(255,255,220,${(this.boost - 80) / 14})`; g.fillRect(0, PANEL_H, VW, VH - PANEL_H); }
    if (this.boost > 0) icon(g, '💨', RUN_X - 64, Math.round(this.laneY) - 20, 26, 'center');
    for (const p of this.parts) {
      if (p.kind === 'dust') { g.fillStyle = `rgba(200,170,120,${p.t / 30})`; g.fillRect(Math.round(p.x), Math.round(p.y), 4, 4); }
      else { g.fillStyle = `rgba(255,240,120,${p.t / 30})`; g.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 5, 5); }
    }
    this.drawPanel(g);
    if (this.phase === 'finish') icon(g, '🏁', VW / 2, 150, 64, 'center');
    if (this.phase === 'results') this.results.draw(g);
  }

  drawTrack(g) {
    const off = Math.floor(this.worldX) % 32, col0 = Math.floor(this.worldX / 32);
    for (let c = 0; c <= VW / 32 + 1; c++) {
      const x = c * 32 - off, col = col0 + c, h = hash(col);
      for (let r = 0; r < VH / 32; r++) tile(g, h % 11 === 0 && r % 3 === 0 ? 386 : 385, x, r * 32);
      tile(g, 482, x, TRACK_Y);                                              // the dirt track: top edge,
      for (let r = 1; r < LANES * 2 - 1; r++) tile(g, 490, x, TRACK_Y + r * 32);   // middle,
      tile(g, 498, x, TRACK_Y + (LANES * 2 - 1) * 32);                         // bottom edge
      tile(g, 1681, x, TRACK_Y + LANES * LANE_H);                            // a fence along the bottom
      if (h % 7 === 0 && hash(col - 1) % 7 !== 0) tile(g, 1328, x, 96);          // stones
    }
    // pines along the top (2×3 tiles, from the sheet as one piece), at deterministic spots
    for (let c = -2; c <= VW / 32 + 1; c++) {
      const col = col0 + c;
      if (hash(col * 3 + 1) % 6 !== 0 || col % 2) continue;
      const x = c * 32 - off;
      for (let r = 0; r < 3; r++) for (let i = 0; i < 2; i++) tile(g, 804 + r * 8 + i, x + i * 32, 32 + r * 32);
    }
    // lane lines
    g.fillStyle = 'rgba(255,255,255,0.45)';
    for (let l = 1; l < LANES; l++) for (let x = -(this.worldX % 48); x < VW; x += 48) g.fillRect(Math.round(x), TRACK_Y + l * LANE_H - 1, 24, 3);
    // the finish line
    if (this.finishX !== null) {
      const x = Math.round(this.finishX - this.worldX);
      for (let y = TRACK_Y; y < TRACK_Y + LANES * LANE_H; y += 8) {
        g.fillStyle = ((y - TRACK_Y) / 8) % 2 ? '#202020' : '#F8F8F8'; g.fillRect(x, y, 8, 8);
        g.fillStyle = ((y - TRACK_Y) / 8) % 2 ? '#F8F8F8' : '#202020'; g.fillRect(x + 8, y, 8, 8);
      }
    }
  }

  drawGate(g) {
    const gate = this.gate;
    if (!gate) return;
    const sx = Math.round(gate.x - this.worldX);
    const board = (x, i, w, h, size) => {
      const y = laneMid(i);
      g.fillStyle = '#604830'; g.fillRect(x - 3, y, 6, LANE_H / 2 - 6);             // post
      g.fillStyle = '#F8F8F0'; g.fillRect(x - w / 2, y - h / 2 - 6, w, h);
      g.strokeStyle = '#484848'; g.lineWidth = 3; g.strokeRect(x - w / 2, y - h / 2 - 6, w, h);
      text(g, String(gate.values[i]), x, y - h / 2 - 6 + (h - size) / 2 + 2, { size, align: 'center', family: '"Power Clear Bold"' });
    };
    if (sx <= VW + 30) {
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(sx - 2, TRACK_Y, 4, LANES * LANE_H);
      for (let i = 0; i < LANES; i++) board(sx, i, 64, 44, 32);
    } else {
      // not on screen yet: small tags at the right edge, in their lanes, so the answers are always visible
      for (let i = 0; i < LANES; i++) {
        board(VW - 34, i, 50, 34, 24);
        icon(g, '▶', VW - 8, laneMid(i) - 18, 12, 'center');
      }
    }
  }

  drawBoard(g, b) {
    const y = b.y;
    g.save(); g.translate(b.x, y); g.rotate(b.rot); g.globalAlpha = Math.min(1, b.t / 20);
    g.fillStyle = '#F8F8F0'; g.fillRect(-32, -22, 64, 44);
    g.strokeStyle = '#484848'; g.lineWidth = 3; g.strokeRect(-32, -22, 64, 44);
    text(g, String(b.v), 0, -18, { size: 32, align: 'center', family: '"Power Clear Bold"' });
    g.restore();
  }

  drawPanel(g) {
    g.fillStyle = '#F8F8F0'; g.fillRect(0, 0, VW, PANEL_H);
    g.fillStyle = this.seat.color; g.fillRect(0, PANEL_H - 4, VW, 4);
    if (this.answer) {
      text(g, this.answer.text, VW / 2, 10, { size: 40, align: 'center', family: '"Power Clear Bold"',
        color: this.answer.ok ? '#30A040' : '#D03828', shadow: this.answer.ok ? '#B8E8B8' : '#F0B8A8' });
    } else if (this.gate) {
      text(g, problemText(this.gate.fact), VW / 2, 10, { size: 40, align: 'center', family: '"Power Clear Bold"' });
    }
    // how fast: ⚡ and a bar up to this Pokémon's top speed
    icon(g, '⚡', 10, 16, 22);
    g.fillStyle = '#404048'; g.fillRect(38, 22, 80, 14);
    g.fillStyle = this.boost > 0 ? '#F86830' : '#F8C820'; g.fillRect(40, 24, Math.round(76 * Math.min(1, (this.mult - 1) / Math.max(0.01, this.top - 1))), 10);
    if (this.streak >= 2) { icon(g, '🔥', 124, 14, 20); text(g, String(this.streak), 148, 12, { size: 22 }); }
    // time left
    const left = Math.max(0, 1 - this.t / (this.settings.sessionSeconds * 60));
    icon(g, '⏱️', VW - 118, 16, 20);
    g.fillStyle = '#404048'; g.fillRect(VW - 90, 22, 80, 14);
    g.fillStyle = '#58A8E8'; g.fillRect(VW - 88, 24, Math.round(76 * left), 10);
  }
}

