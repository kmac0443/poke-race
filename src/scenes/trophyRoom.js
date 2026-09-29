// 🏆 The trophy house (DESIGN.md "Trophy room"): this child's own cases, one per Pokémon, on a shelf. Left/right
// picks a case; up/down (or A) turns between its two sides:
//   the card     front sprite, past forms, stats as bars, races won, friendship, and the evolution goal (the
//                silhouette + a progress bar per criterion)
//   the ribbons  every race of the ladder as a ribbon, bright once won: a row per venue, a group per rank, and a
//                🏆 for each rank of a venue won in full
// B or the menu button leaves. Nothing here changes the save.
import { Scene, text } from '../core/ui.js';
import { img, isReady } from '../core/assets.js';
import { se, cry } from '../core/audio.js';
import { SPECIES, STATS } from '../game/species.js';
import { evolutionGoal } from '../game/evolution.js';
import { VENUES, RANKS, RACES_PER_VENUE } from '../data/venues.js';
import { drawFront, drawHeader, drawStatBars, drawRibbon, drawProgress, icon } from './common.js';

const VW = 512, VH = 384, SHOWN = 5, CASE_W = 96;

function drawIcon(g, speciesId, x, y, size = 64, frame = 0) {
  const i = img(SPECIES.get(speciesId)?.sprites.icon || '');
  if (isReady(i)) g.drawImage(i, (frame % 2) * 64, 0, 64, 64, x, y, size, size);
}

export class TrophyRoomScene extends Scene {
  constructor() {
    super();
    this.opaque = true;
    this.music = 'Trophy House.wav';
    this.t = 0;
    this.index = null;
    this.side = 0;            // 0 the card, 1 the ribbons
  }

  get mons() { return this.seat.profile.pokemon; }

  update(input) {
    this.t++;
    const n = this.mons.length;
    if (this.index === null) {
      this.index = Math.max(0, this.mons.findIndex(p => p.uid === this.seat.profile.active));
      this.hello();
    }
    if (input.pressed('b') || input.pressed('start')) { se('GUI sel cancel', 0.6); this.close(); return; }
    if (!n) return;
    let i = this.index;
    if (input.repeatPressed('left')) i = (i + n - 1) % n;
    if (input.repeatPressed('right')) i = (i + 1) % n;
    if (i !== this.index) { this.index = i; se('GUI sel cursor', 0.4); this.hello(); }
    if (input.pressed('up') || input.pressed('down') || input.pressed('a')) { this.side = 1 - this.side; se('GUI summary change page', 0.5); }
  }

  hello() { const pk = this.mons[this.index]; if (pk) cry(SPECIES.get(pk.species)?.sprites.cry, 0.5); }

  draw(g) {
    // the room: panelled wall, wooden shelf
    g.fillStyle = '#E8D8B8'; g.fillRect(0, 0, VW, VH);
    g.fillStyle = '#D8C498'; for (let x = 0; x < VW; x += 32) g.fillRect(x, 36, 2, 100);
    drawHeader(g, this.seat);
    icon(g, '🏆', VW / 2, 4, 24, 'center');
    const mons = this.mons;
    if (!mons.length || this.index === null) return;
    const first = Math.max(0, Math.min(this.index - 2, mons.length - SHOWN));
    const x0 = (VW - Math.min(SHOWN, mons.length) * CASE_W) / 2;
    g.fillStyle = '#8C5A30'; g.fillRect(0, 118, VW, 12);
    for (let k = first; k < Math.min(mons.length, first + SHOWN); k++) {
      const pk = mons[k], x = x0 + (k - first) * CASE_W, sel = k === this.index;
      g.fillStyle = sel ? 'rgba(255,255,255,0.75)' : 'rgba(200,230,255,0.45)';
      g.fillRect(x + 6, 44, CASE_W - 12, 74);
      g.strokeStyle = sel ? this.seat.color : '#A08868'; g.lineWidth = sel ? 4 : 2;
      g.strokeRect(x + 6, 44, CASE_W - 12, 74);
      const bob = sel ? Math.round(Math.abs(Math.sin(this.t / 7)) * -4) : 0;
      drawIcon(g, pk.species, x + CASE_W / 2 - 32, 50 + bob, 64, sel ? Math.floor(this.t / 14) : 0);
      if (pk.uid === this.seat.profile.active) {       // following you: a ring in your colour
        g.strokeStyle = this.seat.color; g.lineWidth = 2;
        g.beginPath(); g.ellipse(x + CASE_W / 2, 110, 20, 5, 0, 0, Math.PI * 2); g.stroke();
      }
    }
    if (first > 0) icon(g, '◀️', 4, 70, 18);
    if (first + SHOWN < mons.length) icon(g, '▶️', VW - 24, 70, 18);

    // the case: a white panel with two sides
    g.fillStyle = '#F8F8F0'; g.fillRect(8, 136, VW - 16, VH - 144);
    g.strokeStyle = this.seat.color; g.lineWidth = 3; g.strokeRect(9, 137, VW - 18, VH - 146);
    for (let s = 0; s < 2; s++) {           // which side: two dots
      g.fillStyle = s === this.side ? this.seat.color : '#C8C0A8';
      g.beginPath(); g.arc(VW - 40 + s * 16, 150, 5, 0, Math.PI * 2); g.fill();
    }
    const pk = mons[this.index];
    if (this.side === 0) this.drawCard(g, pk); else this.drawRibbons(g, pk);
  }

  drawCard(g, pk) {
    const settings = this.seat.settings;
    drawFront(g, pk.species, 88, 200);
    // what it used to be
    pk.formerSpecies.forEach((id, k) => { drawIcon(g, id, 20 + k * 44, 250, 40); icon(g, '➡️', 58 + k * 44, 262, 12); });
    const top = Math.max(100, Math.ceil(Math.max(...STATS.map(s => pk.stats[s])) / 50) * 50);
    drawStatBars(g, pk, 176, 146, 190, top);
    // races won, friendship
    icon(g, '🏁', 176, 240, 20);
    text(g, String(pk.wins.length), 204, 236, { size: 22 });
    drawProgress(g, '❤️', pk.friendship, settings.friendshipMax, 262, 240, 150, '#E86080');
    // the goal: its silhouette and a bar for each criterion
    const goal = evolutionGoal(pk, settings);
    if (!goal) return;
    g.fillStyle = '#F0E8D0'; g.fillRect(20, 274, VW - 40, 100);
    drawFront(g, goal.into, 76, 324, { scale: 0.85, silhouette: !goal.done });
    if (goal.done && this.t % 30 < 20) icon(g, '✨', 120, 280, 20);
    goal.parts.slice(0, 4).forEach((p, k) => drawProgress(g, p.icon, p.have, p.need, 150, 282 + k * 22, 170));
  }

  drawRibbons(g, pk) {
    const won = new Set(pk.wins);
    VENUES.forEach((v, row) => {
      const y = 162 + row * 27;
      icon(g, v.icon, 20, y + 2, 20);
      for (let rank = 1; rank <= RANKS; rank++) {
        let all = true;
        for (let i = 1; i <= RACES_PER_VENUE; i++) {
          const got = won.has(`${v.id}-${rank}-${i}`);
          all = all && got;
          drawRibbon(g, v, rank, 50 + (rank - 1) * 88 + (i - 1) * 26, y, 26, !got);
        }
        if (all) icon(g, '🏆', 402 + (rank - 1) * 24, y + 3, 18);
      }
    });
  }
}
