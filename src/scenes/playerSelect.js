// Who's playing in this half? Two cards (portrait + name + their Pokémon). A child already playing in the other
// half is greyed out. A child with no Pokémon yet picks their first one; then it's out onto the farm.
import { Scene, text } from '../core/ui.js';
import { img, isReady } from '../core/assets.js';
import { se } from '../core/audio.js';
import { AVATARS } from '../data/avatars.js';
import { SPECIES } from '../game/species.js';
import { givePokemon } from '../game/pokemon.js';
import { drawHeader, shake } from './common.js';
import { PickPokemonScene } from './pickPokemon.js';
import { FarmScene } from './farm.js';

export class PlayerSelectScene extends Scene {
  constructor() {
    super();
    this.opaque = true;
    this.music = 'Title.ogg';
    this.index = null;
    this.t = 0;
    this.shakeT = 0;
  }
  update(input) {
    const seat = this.seat, game = seat.game;
    if (this.index === null) this.index = seat.index;
    this.t++;
    if (this.shakeT > 0) this.shakeT--;
    if (input.pressed('left') || input.pressed('right')) { this.index = 1 - this.index; se('GUI sel cursor', 0.5); }
    if (input.pressed('b')) { se('GUI sel cancel', 0.6); this.close(); return; }
    if (input.pressed('a')) {
      if (game.seatWith(this.index)) { se('GUI sel buzzer'); this.shakeT = 16; return; }
      se('GUI sel decision');
      seat.profileIndex = this.index;
      this.enter();
    }
  }
  async enter() {
    const seat = this.seat;
    if (!seat.profile.pokemon.length) {
      const pick = await seat.push(new PickPokemonScene({ first: true }));
      if (!pick) { seat.profileIndex = null; return; }
      givePokemon(seat.profile, seat.settings, pick.species, pick.branch);
      seat.game.store();
    }
    await seat.push(new FarmScene());
    seat.profileIndex = null;
  }
  draw(g) {
    const seat = this.seat, game = seat.game;
    g.fillStyle = '#284878'; g.fillRect(0, 0, 512, 384);
    drawHeader(g, seat);
    game.save.profiles.forEach((pr, i) => {
      const cx = 128 + i * 256;
      const other = game.seatWith(i);
      const takenByOther = other && other !== seat;
      const sel = i === this.index;
      const dx = sel ? shake(this.shakeT) : 0;
      g.fillStyle = sel ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)';
      g.fillRect(cx - 112 + dx, 52, 224, 280);
      if (takenByOther) { g.strokeStyle = other.color; g.lineWidth = 4; g.strokeRect(cx - 110 + dx, 54, 220, 276); }
      const av = AVATARS[pr.avatar] || AVATARS.Red;
      const p = img(av.portrait);
      g.save();
      if (takenByOther) { g.filter = 'grayscale(1)'; g.globalAlpha = 0.5; }
      if (isReady(p)) g.drawImage(p, cx - 64 + dx, 64 + (sel ? Math.round(Math.sin(this.t / 8) * 3) : 0));
      g.restore();
      text(g, pr.name, cx + dx, 200, { color: '#F8F8F8', shadow: '#202020', align: 'center' });
      // their Pokémon, as bouncing icons
      const shown = pr.pokemon.slice(0, 3);
      shown.forEach((pk, k) => {
        const sp = SPECIES.get(pk.species);
        const ic = sp && sp.sprites.icon && img(sp.sprites.icon);
        const x = cx - shown.length * 32 + k * 64 + dx;
        if (isReady(ic)) g.drawImage(ic, (Math.floor(this.t / 16) % 2) * 64, 0, 64, 64, x, 240, 64, 64);
      });
      if (pr.pokemon.length > 3) text(g, `+${pr.pokemon.length - 3}`, cx + 96 + dx, 300, { color: '#F8F8F8', shadow: '#202020', size: 20, align: 'right' });
      if (takenByOther) text(g, `P${other.index + 1}`, cx + 100 + dx, 60, { color: other.color, shadow: '#F8F8F8', align: 'right' });
    });
    if (Math.floor(this.t / 20) % 2 === 0) {
      g.fillStyle = '#F8F8F8';
      const cx = 128 + this.index * 256;
      g.beginPath(); g.moveTo(cx, 338); g.lineTo(cx + 12, 352); g.lineTo(cx - 12, 352); g.fill();
    }
  }
}
