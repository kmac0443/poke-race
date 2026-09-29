// Pick a Pokémon from this child's list: front sprites, a cry as the cursor lands, growth as icons. Species the
// child already has are greyed out; Eevee stays open until every allowed Eeveelution is taken, and picking it means
// also picking which Eeveelution it will become (fixed from then on). Then a yes/no confirm.
// Resolves with { species, branch } or null.
import { Scene, text } from '../core/ui.js';
import { se, cry, jingle } from '../core/audio.js';
import { SPECIES } from '../game/species.js';
import { pickOptions, openEeveelutions } from '../game/pokemon.js';
import { drawFront, drawGrowth, drawHeader, icon, shake } from './common.js';

const COLS = 5, CELL_W = 100, CELL_H = 84, GRID_X = 6, GRID_Y = 40;

function cryOf(id) { const sp = SPECIES.get(id); return sp && sp.sprites.cry; }

/** A cursor over a grid of species; shared by the pick screen and the Eeveelution choice. */
class SpeciesGrid {
  constructor(items, cols = COLS) { this.items = items; this.cols = cols; this.index = Math.max(0, items.findIndex(i => i.open)); this.shakeT = 0; }
  get current() { return this.items[this.index]; }
  move(input) {
    const n = this.items.length, c = this.cols;
    let i = this.index;
    if (input.repeatPressed('left')) i = (i + n - 1) % n;
    if (input.repeatPressed('right')) i = (i + 1) % n;
    if (input.repeatPressed('up') && i - c >= 0) i -= c;
    if (input.repeatPressed('down') && i + c < n) i += c;
    if (i !== this.index) { this.index = i; se('GUI sel cursor', 0.4); cry(cryOf(this.current.id), 0.5); }
    if (this.shakeT > 0) this.shakeT--;
  }
  draw(g, t, x0 = GRID_X, y0 = GRID_Y, cw = CELL_W, ch = CELL_H) {
    this.items.forEach((it, i) => {
      const x = x0 + (i % this.cols) * cw, y = y0 + Math.floor(i / this.cols) * ch;
      const sel = i === this.index;
      const dx = sel ? shake(this.shakeT) : 0;
      if (sel) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 2 + dx, y + 2, cw - 4, ch - 4); }
      const bob = sel && it.open ? Math.round(Math.abs(Math.sin(t / 6)) * -4) : 0;
      drawFront(g, it.id, x + cw / 2 + dx, y + ch / 2 + bob, it.open ? {} : { gray: true, alpha: 0.35 });
    });
  }
}

export class PickPokemonScene extends Scene {
  constructor(opts = {}) {
    super();
    this.opaque = true;
    this.first = !!opts.first;
    this.t = 0;
    this.phase = 'grid';
    this.grid = null;
    this.choice = null; // { species, branch }
  }
  update(input) {
    const seat = this.seat;
    if (!this.grid) {
      this.grid = new SpeciesGrid(pickOptions(seat.profile, seat.settings));
      if (this.grid.current) cry(cryOf(this.grid.current.id), 0.5);
    }
    this.t++;
    if (this.phase === 'grid') {
      this.grid.move(input);
      if (input.pressed('b')) { se('GUI sel cancel', 0.6); this.close(null); return; }
      if (input.pressed('a')) {
        const it = this.grid.current;
        if (!it || !it.open) { se('GUI sel buzzer'); this.grid.shakeT = 16; return; }
        se('GUI sel decision');
        if (it.id === 'EEVEE') {
          this.phase = 'branch';
          seat.push(new EeveelutionScene(openEeveelutions(seat.profile, seat.settings), seat.settings.eeveelutions))
            .then(branch => {
              if (!branch) { this.phase = 'grid'; return; }
              this.choice = { species: 'EEVEE', branch };
              this.phase = 'confirm'; this.t = 0;
            });
        } else {
          this.choice = { species: it.id, branch: null };
          this.phase = 'confirm'; this.t = 0;
          cry(cryOf(it.id));
        }
      }
    } else if (this.phase === 'confirm') {
      if (input.pressed('a')) {
        jingle('Pkmn get');
        cry(cryOf(this.choice.species));
        this.close(this.choice);
      } else if (input.pressed('b')) { se('GUI sel cancel', 0.6); this.phase = 'grid'; }
    }
  }
  draw(g) {
    g.fillStyle = '#88C0E8'; g.fillRect(0, 0, 512, 384);
    drawHeader(g, this.seat);
    icon(g, '❓', 256, 4, 24, 'center');
    if (!this.grid) return;
    if (this.phase === 'confirm') return this.drawConfirm(g);
    this.grid.draw(g, this.t);
    // the one under the cursor: growth icons
    g.fillStyle = '#F8F8F0'; g.fillRect(0, 296, 512, 88);
    g.fillStyle = '#C8C0A8'; g.fillRect(0, 296, 512, 3);
    const it = this.grid.current;
    if (it) {
      const sp = SPECIES.get(it.id);
      drawFront(g, it.id, 56, 340, it.open ? {} : { gray: true, alpha: 0.4 });
      text(g, sp.name, 110, 304, { size: 24 });
      drawGrowth(g, it.id, 300, 302, 18);
    }
  }
  drawConfirm(g) {
    const { species, branch } = this.choice;
    const bob = Math.round(Math.abs(Math.sin(this.t / 8)) * -8);
    if (branch) {
      drawFront(g, species, 150, 170 + bob, { scale: 2 });
      icon(g, '➡️', 256, 150, 32, 'center');
      drawFront(g, branch, 362, 170, { scale: 1, silhouette: true });
    } else {
      drawFront(g, species, 256, 170 + bob, { scale: 2 });
    }
    drawGrowth(g, species, 32, 290, 18);
    // yes / no, as the buttons' pictures
    g.fillStyle = '#48A848'; g.fillRect(300, 300, 88, 60);
    g.fillStyle = '#D84838'; g.fillRect(404, 300, 88, 60);
    icon(g, '✔️', 344, 312, 32, 'center');
    icon(g, '✖️', 448, 312, 32, 'center');
  }
}

/** Which Eeveelution will this Eevee become? Taken (or not allowed) ones are greyed. Resolves with an id or null. */
class EeveelutionScene extends Scene {
  constructor(open, allowed) {
    super();
    this.opaque = true;
    const openSet = new Set(open);
    this.grid = new SpeciesGrid(allowed.map(id => ({ id, open: openSet.has(id) })), 4);
    this.t = 0;
  }
  update(input) {
    if (this.t++ === 0 && this.grid.current) cry(cryOf(this.grid.current.id), 0.5);
    this.grid.move(input);
    if (input.pressed('b')) { se('GUI sel cancel', 0.6); this.close(null); return; }
    if (input.pressed('a')) {
      const it = this.grid.current;
      if (!it.open) { se('GUI sel buzzer'); this.grid.shakeT = 16; return; }
      se('GUI sel decision');
      this.close(it.id);
    }
  }
  draw(g) {
    g.fillStyle = '#E8C8E8'; g.fillRect(0, 0, 512, 384);
    drawHeader(g, this.seat);
    drawFront(g, 'EEVEE', 256, 24, { scale: 0.5 });
    this.grid.draw(g, this.t, 16, 56, 120, 116);
    const it = this.grid.current;
    if (it) text(g, SPECIES.get(it.id).name, 256, 346, { align: 'center' });
  }
}
