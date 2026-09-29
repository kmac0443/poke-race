// Plays move animations (game/anims.js recipes) between two points on a 512×384 view, adapted from the RPG's
// battle scene. A game keeps one MoveFx, calls play(move, user, target) and then update() / draw(g) every frame;
// it moves its own sprites by `offset(who)` (a lunge, a judder) and reads `shake` for the screen.
//   user / target: { x, y, scale } (scale 1 = a 192 px cel)
import { img, isReady } from '../core/assets.js';
import { se } from '../core/audio.js';
import { recipeFor, stepDur, celList, sheetPath } from '../game/anims.js';

const VW = 512, VH = 384;

export class MoveFx {
  constructor() { this.fx = []; this.shake = { x: 0, y: 0 }; this.offsets = { user: { x: 0, y: 0 }, target: { x: 0, y: 0 } }; }

  /** Start loading a move's sheets before it's needed (the first play would otherwise skip cels). */
  static preload(moves) { for (const mv of moves) for (const s of recipeFor(mv).steps) if (s.cel) img(sheetPath(s.cel)); }

  /** Play a move. Returns { dur, hit } in frames: how long it lasts and when it lands. `onCry` for a user's cry. */
  play(move, user, target, onCry = null) {
    const r = recipeFor(move);
    this.fx.push({ r, t: -1, U: user, G: target, onCry });
    return { dur: r.dur, hit: r.hit };
  }

  get busy() { return this.fx.length > 0; }

  /** How far to draw 'user' or 'target' from where it stands this frame. */
  offset(who) { return this.offsets[who]; }

  update() {
    this.shake = { x: 0, y: 0 };
    this.offsets = { user: { x: 0, y: 0 }, target: { x: 0, y: 0 } };
    for (const fx of this.fx) {
      fx.t++;
      const dx = fx.G.x - fx.U.x, dy = fx.G.y - fx.U.y, len = Math.hypot(dx, dy) || 1;
      for (const st of fx.r.steps) {
        const t0 = st.t || 0, p = (fx.t - t0) / (st.dur || 1);
        if (st.se && fx.t === t0) se('move-anims/' + st.se, st.vol || 0.8);
        if (st.cry && fx.t === t0 && fx.onCry) fx.onCry();
        if (p < 0 || p > 1) continue;
        if (st.lunge) {                          // throw itself at the target and back
          const o = this.offsets.user;
          if (st.hop) o.y -= Math.abs(Math.sin(p * Math.PI * 2)) * st.hop;
          else { const k = Math.sin(p * Math.PI) * (st.dist || 30); o.x += dx / len * k; o.y += dy / len * k; }
        }
        if (st.shake) {
          const a = (st.amp || 4) * (1 - p), wob = Math.sin(fx.t * 1.9) * a;
          if (st.shake === 'screen') { this.shake.x += wob; this.shake.y += Math.cos(fx.t * 2.3) * a * 0.6; }
          else this.offsets[st.shake].x += wob;
        }
      }
    }
    this.fx = this.fx.filter(fx => fx.t < fx.r.dur);
  }

  draw(g) {
    for (const fx of this.fx) {
      const { U, G } = fx;
      for (const st of fx.r.steps) {
        const local = fx.t - (st.t || 0);
        if (local < 0 || local > stepDur(st)) continue;
        if (st.cel) this.drawCel(g, st, local, U, G);
        else if (st.beam) {
          const p = local / st.dur, reach = Math.min(1, p * 2.2), fade = p > 0.75 ? (1 - p) / 0.25 : 1;
          const x1 = U.x + (G.x - U.x) * reach, y1 = U.y + (G.y - U.y) * reach;
          g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
          for (const [w, a] of [[st.width * 1.8, 0.25], [st.width, 0.6], [st.width * 0.4, 0.95]]) {
            g.globalAlpha = a * fade; g.strokeStyle = w === st.width * 0.4 ? '#FFFFFF' : st.beam; g.lineWidth = w;
            g.beginPath(); g.moveTo(U.x, U.y); g.lineTo(x1, y1); g.stroke();
          }
          g.restore();
        } else if (st.glow) {
          const at = st.at === 'user' ? U : G, p = local / st.dur;
          const grad = g.createRadialGradient(at.x, at.y, 10, at.x, at.y, 110 * at.scale);
          grad.addColorStop(0, st.glow); grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.7 * Math.sin(p * Math.PI);
          g.fillStyle = grad; g.fillRect(at.x - 130, at.y - 130, 260, 260); g.restore();
        } else if (st.flash) {
          const p = local / st.dur;
          g.save(); g.globalAlpha = Math.sin(Math.min(1, p) * Math.PI); g.fillStyle = st.flash; g.fillRect(0, 0, VW, VH); g.restore();
        }
      }
    }
  }

  /** One cel step: which cel, where (flying along the path, falling, rising), and a spray of copies if asked. */
  drawCel(g, st, local, U, G) {
    const sheet = img(sheetPath(st.cel));
    if (!isReady(sheet)) return;
    const cels = celList(st), every = st.every || 3, cols = Math.floor(sheet.width / 192), count = st.count || 1;
    for (let k = 0; k < count; k++) {
      const lt = local - (st.stagger || 0) * k, life = st.dur || cels.length * every;
      if (lt < 0 || lt > life) continue;
      const n = Math.floor(lt / every);
      if (!st.loop && !st.dur && n >= cels.length) continue;
      const ci = st.loop ? cels[n % cels.length] : cels[Math.min(n, cels.length - 1)];
      const p = life ? lt / life : 1;
      let x, y, scale;
      if (st.at === 'path' || st.at === 'back') {
        const [A, B] = st.at === 'path' ? [U, G] : [G, U];
        x = A.x + (B.x - A.x) * p; y = A.y + (B.y - A.y) * p - (st.arc || 0) * Math.sin(p * Math.PI);
        scale = A.scale + (B.scale - A.scale) * p;
      } else if (st.at === 'screen') { x = VW / 2; y = VH / 2 - 40; scale = 1.4; }
      else { const at = st.at === 'user' ? U : G; x = at.x; y = at.y; scale = at.scale; }
      if (st.fall) y -= st.fall * (1 - p);
      if (st.rise) y -= st.rise * p;
      if (count > 1 && st.spread) {
        const a = k * 2.399963, r = st.spread * Math.sqrt((k + 0.5) / count);
        x += Math.cos(a) * r; y += Math.sin(a) * r * 0.7;
      }
      if (st.dx) x += Math.sign(G.x - U.x || 1) * st.dx;
      y += st.dy || 0;
      const sz = 192 * scale * (st.scale || 1);
      g.save();
      if (st.add) g.globalCompositeOperation = 'lighter';
      g.globalAlpha = st.alpha || 1;
      g.drawImage(sheet, (ci % cols) * 192, Math.floor(ci / cols) * 192, 192, 192, x - sz / 2, y - sz / 2, sz, sz);
      g.restore();
    }
  }
}
