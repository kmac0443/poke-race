// "Answer to do it": a problem from the child's math engine with three answers side by side, over whatever asked
// (the house uses it to place, move and put away furniture). Left/right moves the arrow, A answers. Right → a
// sparkle and it resolves true. Wrong → the right answer shows, then the same problem again, answers reshuffled
// (only the first answer is recorded). B gives up: resolves false. `icon`: what the answer is for (🪑, ✋, 🗑️).
import { Scene, text } from '../core/ui.js';
import { se } from '../core/audio.js';
import { nextProblem, choices, record, problemText } from '../game/math.js';
import { icon, shake } from './common.js';

const VW = 512, VH = 384, BOX = { w: 110, h: 76, y: 196 };
const boxX = i => VW / 2 + (i - 1) * 130;

export class MathAskScene extends Scene {
  constructor(opts = {}) { super(); this.icon = opts.icon || '❔'; this.t = 0; this.cursor = 1; this.fact = null; }

  update(input) {
    this.t++;
    const seat = this.seat;
    if (!this.fact) {
      this.fact = nextProblem(seat.profile, seat.settings, seat.lastAsked || null);
      seat.lastAsked = this.fact;
      this.values = choices(this.fact, 3);
      this.shownAt = this.t; this.first = true; this.wrongT = 0; this.rightT = 0;
    }
    if (this.rightT) { if (++this.rightT > 40) this.close(true); return; }
    if (this.wrongT) { if (--this.wrongT === 0) this.values = choices(this.fact, 3); return; }
    if (input.pressed('b') || input.pressed('start')) { se('GUI sel cancel', 0.6); this.close(false); return; }
    if (input.repeatPressed('left')) { this.cursor = (this.cursor + 2) % 3; se('GUI sel cursor', 0.4); }
    if (input.repeatPressed('right')) { this.cursor = (this.cursor + 1) % 3; se('GUI sel cursor', 0.4); }
    if (!input.pressed('a')) return;
    const picked = this.values[this.cursor], ok = picked === this.fact.answer;
    if (this.first) record(seat.profile, this.fact, picked, (this.t - this.shownAt) * 1000 / 60, seat.settings);
    this.first = false;
    if (ok) { this.rightT = 1; se('Voltorb Flip point'); }
    else { this.wrongT = 80; se('Player bump'); }
  }

  draw(g) {
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 0, VW, VH);
    g.fillStyle = '#F8F8F0'; g.fillRect(40, 96, VW - 80, 200);
    g.strokeStyle = this.seat.color; g.lineWidth = 4; g.strokeRect(42, 98, VW - 84, 196);
    if (!this.fact) return;
    icon(g, this.icon, 76, 110, 34, 'center');
    const said = this.wrongT || this.rightT ? `${problemText(this.fact)} = ${this.fact.answer}` : problemText(this.fact);
    const color = this.wrongT ? '#D03828' : this.rightT ? '#30A040' : '#303030';
    text(g, said, VW / 2, 112, { size: 44, align: 'center', family: '"Power Clear Bold"', color });
    this.values.forEach((v, i) => {
      const x = boxX(i) - BOX.w / 2, sel = i === this.cursor, dx = sel && this.wrongT ? shake(this.wrongT % 16) : 0;
      g.fillStyle = sel ? '#FFFFFF' : '#ECE8DC'; g.fillRect(x + dx, BOX.y, BOX.w, BOX.h);
      g.strokeStyle = sel ? this.seat.color : '#A09880'; g.lineWidth = sel ? 5 : 2; g.strokeRect(x + dx, BOX.y, BOX.w, BOX.h);
      text(g, String(v), boxX(i) + dx, BOX.y + 16, { size: 40, align: 'center', family: '"Power Clear Bold"' });
      if (sel) {
        const ax = boxX(i), ay = BOX.y + BOX.h + 6 + Math.round(Math.sin(this.t / 6) * 2);
        g.fillStyle = this.seat.color; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax - 10, ay + 12); g.lineTo(ax + 10, ay + 12); g.closePath(); g.fill();
      }
    });
    if (this.rightT) for (let k = 0; k < 6; k++) icon(g, '✨', VW / 2 + Math.cos(k + this.rightT / 8) * 150, 200 + Math.sin(k * 2 + this.rightT / 8) * 70, 20, 'center');
  }
}
