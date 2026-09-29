// The lab: where a new Pokémon is picked once it's earned (DESIGN.md "Earning a new Pokémon": the first race won,
// then every racesPerNewPokemon more). A Poké Ball waits on the table while one is earned: A opens the pick screen,
// and the new Pokémon comes out to follow you (whoever was following goes exploring). With nothing earned yet, the
// table shows how many more races to win, as flags filling up. Any other button leaves.
import { Scene } from '../core/ui.js';
import { img, isReady } from '../core/assets.js';
import { se, cry } from '../core/audio.js';
import { SPECIES } from '../game/species.js';
import { givePokemon, picksWaiting, nextPickProgress } from '../game/pokemon.js';
import { PickPokemonScene } from './pickPokemon.js';
import { drawFront, drawHeader, icon, shake } from './common.js';

const VW = 512, VH = 384;

export class LabScene extends Scene {
  constructor() {
    super();
    this.opaque = true;
    this.music = 'Lab.ogg';
    this.t = 0;
    this.phase = 'table';     // table → (pick) → hello (the new one) → table
    this.fresh = null;        // the Pokémon just picked
    this.shakeT = 0;
  }

  update(input) {
    this.t++;
    if (this.shakeT > 0) this.shakeT--;
    const seat = this.seat;
    if (this.phase === 'pick') return;
    if (this.phase === 'hello') {
      if (this.t > 40 && (input.pressed('a') || input.pressed('b') || input.pressed('start'))) { se('GUI sel decision'); this.phase = 'table'; this.t = 0; }
      return;
    }
    if (input.pressed('b') || input.pressed('start')) { se('GUI sel cancel', 0.6); this.close(); return; }
    if (!input.pressed('a')) return;
    if (!picksWaiting(seat.profile, seat.settings)) { se('GUI sel buzzer'); this.shakeT = 16; return; }
    se('GUI sel decision');
    this.phase = 'pick';
    seat.push(new PickPokemonScene()).then(pick => {
      if (!pick) { this.phase = 'table'; return; }
      this.fresh = givePokemon(seat.profile, seat.settings, pick.species, pick.branch);
      seat.game.store();
      this.phase = 'hello'; this.t = 0;
      se('Pkmn move learnt');
      cry(SPECIES.get(pick.species)?.sprites.cry, 1);
    });
  }

  draw(g) {
    const bg = img('ui/hatch_bg.png');
    if (isReady(bg)) g.drawImage(bg, 0, 0, VW, VH); else { g.fillStyle = '#48B8A0'; g.fillRect(0, 0, VW, VH); }
    drawHeader(g, this.seat);
    icon(g, '🧪', VW / 2, 4, 24, 'center');
    if (this.phase === 'hello' && this.fresh) return this.drawHello(g);
    const { profile, settings } = this.seat;
    // the table
    g.fillStyle = '#A07048'; g.fillRect(96, 250, 320, 24);
    g.fillStyle = '#704828'; g.fillRect(96, 274, 320, 10); g.fillRect(116, 284, 16, 60); g.fillRect(380, 284, 16, 60);
    const waiting = picksWaiting(profile, settings);
    const ball = img('ui/Summary/icon_ball_POKEBALL.png');
    if (waiting) {
      // a Poké Ball for each one waiting, wobbling; ✔ pulses: press A
      for (let k = 0; k < Math.min(waiting, 3); k++) {
        const x = VW / 2 + (k - (Math.min(waiting, 3) - 1) / 2) * 90, wob = Math.sin(this.t / 5 + k) * (Math.floor(this.t / 60) % 2 ? 0.25 : 0);
        if (!isReady(ball)) continue;
        g.save(); g.translate(x, 226); g.rotate(wob);
        g.drawImage(ball, 0, 0, 32, 32, -32, -32, 64, 64);
        g.restore();
      }
      if (this.t % 40 < 26) icon(g, '✨', VW / 2 + 60, 150 + Math.sin(this.t / 9) * 6, 28, 'center');
      if (Math.floor(this.t / 20) % 2 === 0) icon(g, '✔️', VW / 2, 300, 30, 'center');
      return;
    }
    // nothing earned yet: a greyed ball, and a flag per race still to win
    if (isReady(ball)) {
      g.save(); g.filter = 'grayscale(1)'; g.globalAlpha = 0.5;
      g.drawImage(ball, 0, 0, 32, 32, VW / 2 - 32 + shake(this.shakeT), 186, 64, 64);
      g.restore();
    }
    const { have, need } = nextPickProgress(profile, settings);
    const per = Math.min(need, 10), size = 30, x0 = VW / 2 - (per * (size + 6)) / 2;
    for (let k = 0; k < need; k++) {
      const x = x0 + (k % per) * (size + 6), y = 80 + Math.floor(k / per) * (size + 8);
      if (k < have) icon(g, '🏁', x, y, size);
      else { g.save(); g.globalAlpha = 0.25; icon(g, '🏁', x, y, size); g.restore(); }
    }
  }

  drawHello(g) {
    const pop = Math.min(1, this.t / 24), bob = Math.round(Math.abs(Math.sin(this.t / 7)) * -10);
    g.fillStyle = `rgba(255,255,255,${0.6 * (1 - pop)})`; g.fillRect(0, 36, VW, VH - 36);
    drawFront(g, this.fresh.species, VW / 2, 190 + bob, { scale: 2 * pop || 0.01 });
    for (let k = 0; k < 6; k++) {
      const a = this.t / 20 + k * Math.PI / 3;
      icon(g, '✨', VW / 2 + Math.cos(a) * 130, 176 + Math.sin(a) * 90, 22, 'center');
    }
    if (this.t > 40 && Math.floor(this.t / 20) % 2 === 0) icon(g, '✔️', VW / 2, 330, 26, 'center');
  }
}
