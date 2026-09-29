// Evolution (DESIGN.md "Evolution: a visible goal"), adapted from the RPG's cutscene without any text: the Pokémon
// glows, flashes faster and faster between its two shapes, and bursts into its new form with sparkles, the
// Evolution jingle and its new cry; then its stat bars jump. The farm pushes this when the follower's goal is full
// (scenes/farm.js). BranchScene: a Pokémon with more than one way to go (Kirlia, Gloom…) picks one first.
import { Scene } from '../core/ui.js';
import { se, cry, jingle } from '../core/audio.js';
import { SPECIES } from '../game/species.js';
import { evolve, evolutionOptions } from '../game/evolution.js';
import { drawFront, drawHeader, drawStatBars, icon, shake } from './common.js';

const VW = 512, VH = 384, CX = 256, CY = 150;

export class EvolutionScene extends Scene {
  constructor(pk) {
    super();
    this.opaque = true;
    this.music = 'Evolution.ogg';
    this.pk = pk;
    this.t = 0;
    this.phase = 'intro';      // intro → morph → done
    this.from = pk.species;
    this.evo = null;
    this.stars = Array.from({ length: 40 }, (_, i) => ({ a: i * 2.4, r: 40 + (i * 37) % 160, s: 1 + (i % 3) }));
  }

  update(input) {
    this.t++;
    if (this.phase === 'intro') {
      if (this.t === 1) cry(SPECIES.get(this.from)?.sprites.cry);
      if (this.t > 80) { this.phase = 'morph'; this.t = 0; jingle('Evolution start'); }
    } else if (this.phase === 'morph') {
      if (this.t % 40 === 0) se('move-anims/Saint6', 0.4);
      if (this.t > 300) {
        this.phase = 'done'; this.t = 0;
        this.evo = evolve(this.pk, this.seat.settings);
        this.seat.game.store();
        jingle('Evolution success');
        cry(SPECIES.get(this.pk.species)?.sprites.cry);
      }
    } else if (this.t > 90 && (input.pressed('a') || input.pressed('b') || input.pressed('start'))) {
      se('GUI sel decision');
      this.close(this.evo);
    }
  }

  draw(g) {
    const bg = g.createRadialGradient(CX, CY, 20, CX, CY, 320);
    bg.addColorStop(0, this.phase === 'morph' ? '#405890' : '#283050'); bg.addColorStop(1, '#0C1020');
    g.fillStyle = bg; g.fillRect(0, 0, VW, VH);
    // swirling sparkles, faster while it changes
    const spin = this.phase === 'morph' ? this.t / 30 : this.t / 90;
    for (const s of this.stars) {
      const a = s.a + spin, r = s.r + Math.sin(this.t / 20 + s.a) * 10;
      g.fillStyle = `rgba(210,230,255,${this.phase === 'morph' ? 0.85 : 0.35})`;
      g.fillRect(CX + Math.cos(a) * r, CY + Math.sin(a) * r * 0.7, s.s * 2, s.s * 2);
    }
    if (this.phase === 'intro') {
      const glow = Math.min(1, this.t / 80);
      drawFront(g, this.from, CX, CY, { scale: 2 });
      g.save(); g.globalAlpha = glow * 0.8; drawFront(g, this.from, CX, CY, { scale: 2, white: true }); g.restore();
    } else if (this.phase === 'morph') {
      const every = Math.max(3, 36 - Math.floor(this.t / 9));   // faster and faster
      const into = this.pk.branch || Object.keys(evolutionOptions(this.from, this.seat.settings))[0];
      const id = Math.floor(this.t / every) % 2 ? into : this.from;
      const pulse = 1.9 + Math.sin(this.t / 6) * 0.1;
      drawFront(g, id, CX + shake(this.t > 240 ? 8 : 0), CY, { scale: pulse, white: true });
      if (this.t > 280) { g.fillStyle = `rgba(255,255,255,${(this.t - 280) / 20})`; g.fillRect(0, 0, VW, VH); }
    } else {
      if (this.t < 20) { g.fillStyle = `rgba(255,255,255,${1 - this.t / 20})`; g.fillRect(0, 0, VW, VH); }
      const hop = this.t > 20 && this.t < 70 ? Math.round(Math.abs(Math.sin(this.t / 6)) * -14) : 0;
      drawFront(g, this.pk.species, CX, CY + hop, { scale: 2 });
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + this.t / 40, r = 120 + Math.sin(this.t / 10 + k) * 10;
        icon(g, '✨', CX + Math.cos(a) * r, CY - 10 + Math.sin(a) * r * 0.6, 20, 'center');
      }
      // the stat jump: bars grow from before to after
      if (this.evo && this.t > 30) {
        const p = Math.min(1, (this.t - 30) / 40), b = this.evo.before;
        const shown = { stats: Object.fromEntries(Object.entries(this.pk.stats).map(([k, v]) => [k, Math.round(b[k] + (v - b[k]) * p)])) };
        g.fillStyle = 'rgba(248,248,240,0.92)'; g.fillRect(60, 268, 392, 102);
        drawStatBars(g, shown, 76, 274, 250, Math.max(100, ...Object.values(this.pk.stats)));
      }
      if (this.t > 90 && Math.floor(this.t / 20) % 2 === 0) icon(g, '✔️', VW - 36, 16, 24, 'center');
    }
  }
}

/** Which way will it go? Its options as sprites (not silhouettes: this is the choice). Resolves with an id. */
export class BranchScene extends Scene {
  constructor(pk) {
    super();
    this.opaque = true;
    this.pk = pk;
    this.t = 0;
    this.index = 0;
    this.options = null;
  }
  update(input) {
    this.t++;
    if (!this.options) {
      this.options = Object.keys(evolutionOptions(this.pk.species, this.seat.settings));
      cry(SPECIES.get(this.options[0])?.sprites.cry, 0.6);
    }
    const n = this.options.length;
    let i = this.index;
    if (input.repeatPressed('left')) i = (i + n - 1) % n;
    if (input.repeatPressed('right')) i = (i + 1) % n;
    if (i !== this.index) { this.index = i; se('GUI sel cursor', 0.4); cry(SPECIES.get(this.options[i])?.sprites.cry, 0.6); }
    if (input.pressed('a') && this.t > 20) {
      se('GUI sel decision');
      this.pk.branch = this.options[this.index];
      this.seat.game.store();
      this.close(this.pk.branch);
    }
  }
  draw(g) {
    g.fillStyle = '#E8D8F0'; g.fillRect(0, 0, VW, VH);
    drawHeader(g, this.seat);
    if (!this.options) return;
    drawFront(g, this.pk.species, VW / 2, 90);
    icon(g, '⬇️', VW / 2, 140, 26, 'center');
    const n = this.options.length, w = Math.min(160, (VW - 20) / n);
    this.options.forEach((id, k) => {
      const x = VW / 2 + (k - (n - 1) / 2) * w, sel = k === this.index;
      if (sel) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x - w / 2 + 6, 184, w - 12, 150); g.strokeStyle = this.seat.color; g.lineWidth = 4; g.strokeRect(x - w / 2 + 6, 184, w - 12, 150); }
      const bob = sel ? Math.round(Math.abs(Math.sin(this.t / 6)) * -6) : 0;
      drawFront(g, id, x, 258 + bob, { scale: sel ? 1.2 : 0.9, alpha: sel ? 1 : 0.6 });
    });
    if (Math.floor(this.t / 20) % 2 === 0) icon(g, '✔️', VW - 36, 350, 24, 'center');
  }
}
