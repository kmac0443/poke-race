// 🎒 The bag (Tab on the farm → 🎒): everything bought and not used yet, with how many. A on a treat: you hold it
// (it shows over your head on the farm; A on any Pokémon gives it). A on ✋ puts away what you're holding.
// Furniture waits for the house (it can't be held on the farm: a buzz). B closes.
import { Scene, text } from '../core/ui.js';
import { img, isReady } from '../core/assets.js';
import { se } from '../core/audio.js';
import { bagItems, treatInfo } from '../game/bag.js';
import { drawHeader, icon, shake } from './common.js';

const VW = 512, VH = 384, COLS = 5, CELL = 92;

export class BagScene extends Scene {
  constructor() { super(); this.opaque = true; this.t = 0; this.index = 0; this.shakeT = 0; }

  /** The slots: ✋ (put away) first while holding something, then the bag's contents. */
  slots() {
    const { profile, settings } = this.seat;
    return [...(profile.holding ? [['HAND', 0]] : []), ...bagItems(profile, settings)];
  }

  update(input) {
    this.t++;
    if (this.shakeT > 0) this.shakeT--;
    const slots = this.slots(), n = slots.length, profile = this.seat.profile;
    if (input.pressed('b') || input.pressed('start')) { se('GUI menu close', 0.6); this.close(); return; }
    if (!n) return;
    let i = Math.min(this.index, n - 1);
    if (input.repeatPressed('left')) i = (i + n - 1) % n;
    if (input.repeatPressed('right')) i = (i + 1) % n;
    if (input.repeatPressed('up') && i - COLS >= 0) i -= COLS;
    if (input.repeatPressed('down') && i + COLS < n) i += COLS;
    if (i !== this.index) { this.index = i; se('GUI sel cursor', 0.4); }
    if (!input.pressed('a')) return;
    const [item] = slots[this.index];
    if (item === 'HAND') { profile.holding = null; se('GUI menu close'); }
    else if (!treatInfo(this.seat.settings, item)) { se('GUI sel buzzer'); this.shakeT = 16; return; }
    else { profile.holding = item; se('GUI sel decision'); }
    this.seat.game.store();
    this.close(profile.holding);
  }

  draw(g) {
    g.fillStyle = '#E8DCC0'; g.fillRect(0, 0, VW, VH);
    drawHeader(g, this.seat);
    icon(g, '🎒', VW / 2, 4, 24, 'center');
    const slots = this.slots();
    if (!slots.length) {             // empty: go shopping
      icon(g, '🎒', VW / 2, 130, 72, 'center');
      icon(g, '➡️', VW / 2 - 10, 230, 30, 'center'); icon(g, '🛒', VW / 2 + 40, 226, 36, 'center');
      return;
    }
    slots.forEach(([item, n], k) => {
      const x = 26 + (k % COLS) * CELL, y = 56 + Math.floor(k / COLS) * (CELL + 8), sel = k === this.index;
      const dx = sel ? shake(this.shakeT) : 0, holding = item === this.seat.profile.holding;
      g.fillStyle = sel ? '#FFFFFF' : '#F8F4E8'; g.fillRect(x + dx, y, CELL - 8, CELL);
      g.strokeStyle = sel ? this.seat.color : holding ? '#48A848' : '#B8A888'; g.lineWidth = sel || holding ? 4 : 2;
      g.strokeRect(x + dx, y, CELL - 8, CELL);
      if (item === 'HAND') { icon(g, '✋', x + dx + (CELL - 8) / 2, y + 18, 40, 'center'); return; }
      const ic = img(`items/${item}.png`);
      if (isReady(ic)) g.drawImage(ic, x + dx + (CELL - 8) / 2 - 26, y + 6, 52, 52);
      text(g, `×${n}`, x + dx + (CELL - 8) / 2, y + 60, { size: 22, align: 'center' });
      if (holding) icon(g, '✋', x + dx + CELL - 30, y + 2, 18);
    });
  }
}
