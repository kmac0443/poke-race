// The end of a training session, shared by the training games: the stat gain is applied and saved, then a panel
// shows the Pokémon (with a need bubble when training made it hungry / thirsty…: game/needs.js), a ✔ for each right answer, anything else the game earned (`trophies`: icons, e.g. 🪨 for
// every rock cracked), and the stat's bar filling from before to after. Any button (after a moment) closes it.
import { text } from '../core/ui.js';
import { se, cry, jingle } from '../core/audio.js';
import { SPECIES } from '../game/species.js';
import { finishTraining } from '../game/training.js';
import { noteTraining } from '../game/needs.js';
import { NEEDS } from '../world/care.js';
import { drawFront, drawStatBars, icon } from './common.js';

const VW = 512, VH = 384;

export class TrainingResults {
  constructor(seat, pk, stat, right, trophies = []) {
    this.seat = seat; this.pk = pk; this.stat = stat; this.right = right; this.trophies = trophies;
    this.before = pk.stats[stat];
    this.gain = right > 0 ? finishTraining(pk, stat, right, seat.settings) : 0;
    this.need = right > 0 ? noteTraining(seat.profile, pk, stat, seat.settings) : null;   // all that work: it needs something
    seat.game.store();
    this.t = 0;
    if (trophies.includes('⭐')) jingle('Badge get');           // moved up a math level
    else if (this.gain) jingle('Item get');
  }

  /** Returns true when the player dismisses it. */
  update(input) {
    this.t++;
    if (this.t === 50 && this.gain) { se('Pkmn level up'); cry(SPECIES.get(this.pk.species)?.sprites.cry, 0.8); }
    if (this.t > 40 && (input.pressed('a') || input.pressed('b') || input.pressed('start'))) { se('GUI sel decision'); return true; }
    return false;
  }

  draw(g) {
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, VW, VH);
    g.fillStyle = '#F8F8F0'; g.fillRect(40, 40, VW - 80, VH - 80);
    g.strokeStyle = this.seat.color; g.lineWidth = 4; g.strokeRect(42, 42, VW - 84, VH - 84);
    const hop = this.t > 50 && this.gain ? Math.round(Math.abs(Math.sin(this.t / 6)) * -10) : 0;
    drawFront(g, this.pk.species, 128, 132 + hop);
    if (this.need && this.t > 60) {           // it needs something now: go and look after it on the farm
      const bob = Math.round(Math.sin(this.t / 10) * 3);
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.strokeStyle = '#484848'; g.lineWidth = 2;
      g.beginPath(); g.arc(178, 84 + bob, 20, 0, Math.PI * 2); g.fill(); g.stroke();
      icon(g, NEEDS[this.need].icon, 178, 70 + bob, 24, 'center');
    }
    // a ✔ for every right answer, then what else was earned
    const n = Math.min(this.right, 16);
    for (let k = 0; k < n; k++) icon(g, '✔️', 212 + (k % 8) * 30, 62 + Math.floor(k / 8) * 32, 26);
    if (this.right > 16) text(g, `+${this.right - 16}`, 452, 126, { size: 22, align: 'right' });
    this.trophies.slice(0, 8).forEach((t, k) => icon(g, t, 212 + k * 30, 134, 26));
    // the stat's bar filling from before to after
    const row = ['speed', 'strength', 'defense'].indexOf(this.stat);
    g.fillStyle = '#F8E8A0'; g.fillRect(70, 224 + row * 30, 400, 30);          // the stat this trained
    const p = Math.min(1, Math.max(0, (this.t - 50) / 40));
    const shown = { ...this.pk, stats: { ...this.pk.stats, [this.stat]: Math.round(this.before + this.gain * p) } };
    drawStatBars(g, shown, 80, 230, 250);
    if (this.gain && this.t > 50) text(g, `+${this.gain}`, 440, 228 + row * 30, { size: 26, color: '#30A040', shadow: '#B8E8B8' });
    if (this.t > 40 && Math.floor(this.t / 20) % 2 === 0) icon(g, '✔️', VW / 2, 316, 22, 'center');
  }
}
