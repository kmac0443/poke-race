// "What? X is evolving!" scene.
import { Scene, drawMessageBox, wrap } from '../core/ui.js';
import { img, isReady } from '../core/assets.js';
import { se, jingle, cry, requestBgm } from '../core/audio.js';
import { SPECIES } from '../game/data.js';

export class EvolutionScene extends Scene {
  constructor(p, pk, into, opts = {}) {
    super();
    this.opaque = true;
    this.p = p; this.pk = pk; this.into = into;
    this.canCancel = !opts.item;
    this.t = 0;
    this.phase = 'intro';
    this.lines = [`What? ${pk.name} is evolving!`];
    this.fromSp = pk.sp;
    this.toSp = SPECIES[into];
    this.oldName = pk.name;
  }
  update(input) {
    this.t++;
    if (this.phase === 'intro') {
      if (this.t === 1) cry(this.fromSp.sprites.cry);
      if (this.t > 70) { this.phase = 'morph'; this.t = 0; jingle('Evolution start'); requestBgm('evo:' + this.p.index, 'Evolution.ogg', 60); }
    } else if (this.phase === 'morph') {
      if (this.canCancel && input.pressed('b')) { this.phase = 'cancel'; this.t = 0; this.lines = [`Huh? ${this.oldName} stopped evolving!`]; requestBgm('evo:' + this.p.index, null); return; }
      if (this.t > 360) {
        this.phase = 'done'; this.t = 0;
        this.newMoves = this.pk.evolveInto(this.into);
        this.p.seen.add(this.into); this.p.caught.add(this.into);
        requestBgm('evo:' + this.p.index, null);
        jingle('Evolution success');
        cry(this.toSp.sprites.cry);
        this.lines = [`Congratulations! Your ${this.oldName} evolved into ${this.toSp.name}!`];
      }
    } else if (this.phase === 'done' || this.phase === 'cancel') {
      if (this.t > 60 && (input.pressed('a') || input.pressed('b'))) this.close(this.phase === 'done' ? { evolved: true, newMoves: this.newMoves } : { evolved: false });
    }
  }
  draw(ctx) {
    ctx.fillStyle = '#101820'; ctx.fillRect(0, 0, 512, 384);
    // sparkle background
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + this.t / 60;
      const r = 60 + ((this.t * 2 + i * 13) % 140);
      ctx.fillStyle = `rgba(200,220,255,${this.phase === 'morph' ? 0.7 : 0.2})`;
      ctx.fillRect(256 + Math.cos(a) * r, 140 + Math.sin(a) * r * 0.7, 4, 4);
    }
    let sp = this.fromSp;
    let white = 0;
    if (this.phase === 'morph') {
      // alternate faster and faster between the two silhouettes
      const speed = Math.max(4, 40 - Math.floor(this.t / 10));
      sp = Math.floor(this.t / speed) % 2 ? this.toSp : this.fromSp;
      white = 1;
    } else if (this.phase === 'done') sp = this.toSp;
    const i = img(sp.sprites.front);
    if (isReady(i)) {
      if (white) {
        ctx.save(); ctx.filter = 'brightness(0) invert(1)'; ctx.drawImage(i, 160, 40, 192, 192); ctx.restore();
      } else ctx.drawImage(i, 160, 40, 192, 192);
    }
    const lines = wrap(ctx, this.lines[0], 440);
    drawMessageBox(ctx, lines.slice(0, 2), Infinity, this.phase === 'done' || this.phase === 'cancel');
  }
}
