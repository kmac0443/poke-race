// 🛒 The shop (place `shop`): spend the 🪙 won in races. Treats and toys (settings.shopItems) raise a Pokémon's
// friendship when given on the farm; furniture (settings.furniture) goes in your house. Whatever you buy goes in
// your 🎒 bag (game/bag.js), shown on the left with how many of each. Arrows pick (up/down past the top row
// switches shelf), A buys: it flies into the bag. Too dear: a buzz. B leaves.
import { Scene, text } from '../core/ui.js';
import { img, isReady } from '../core/assets.js';
import { se, jingle } from '../core/audio.js';
import { addToBag, bagCount, bagItems } from '../game/bag.js';
import { drawHeader, icon, shake } from './common.js';

const VW = 512, VH = 384, COLS = 3;
const BAG = { x: 96, y: 96 };
const ROWS_SHOWN = 2;
const card = (i, top = 0) => ({ x: 214 + (i % COLS) * 96, y: 92 + (Math.floor(i / COLS) - top) * 124, w: 86, h: 112 });

/** An item's picture: an item icon, or a furniture sprite (its own art, drawn to fit). */
export function drawItem(g, it, x, y, size, opts = {}) {
  const src = it.sheet ? img(it.sheet) : img(`items/${it.item}.png`);
  if (!isReady(src)) return;
  g.save();
  if (opts.gray) { g.filter = 'grayscale(1)'; g.globalAlpha = 0.45; }
  if (it.sheet) {
    const [sx, sy, sw, sh] = it.src || [0, 0, src.width, src.height], k = size / Math.max(sw, sh);
    g.drawImage(src, sx, sy, sw, sh, x + (size - sw * k) / 2, y + (size - sh * k) / 2, sw * k, sh * k);
  } else g.drawImage(src, x, y, size, size);
  g.restore();
}

export class ShopScene extends Scene {
  constructor() {
    super();
    this.opaque = true;
    this.music = 'Poke Mart.ogg';
    this.t = 0;
    this.shelf = 0;          // 0 treats, 1 furniture
    this.cursor = 0;
    this.flying = null;      // { it, i, t } something bought, on its way into the bag
    this.shakeT = 0; this.bagHop = 0;
  }

  /** The first shelf row shown (two rows fit; the cursor's row stays in view). */
  topRow() { return Math.max(0, Math.floor(this.cursor / COLS) - (ROWS_SHOWN - 1)); }

  shelves() {
    const s = this.seat.settings;
    return [{ icon: '🍓', items: s.shopItems }, { icon: '🛋️', items: s.furniture || [] }].filter(sh => sh.items.length);
  }

  update(input) {
    this.t++;
    const { profile } = this.seat, shelves = this.shelves();
    if (this.shakeT > 0) this.shakeT--;
    if (this.bagHop > 0) this.bagHop--;
    if (this.flying && ++this.flying.t >= 26) {
      addToBag(profile, this.flying.it.item);
      this.seat.game.store();
      this.flying = null; this.bagHop = 16;
      jingle('Item get');
    }
    if (input.pressed('b') || input.pressed('start')) { se('GUI sel cancel', 0.6); this.close(); return; }
    const items = shelves[this.shelf].items, n = items.length;
    let c = this.cursor, sh = this.shelf;
    if (input.repeatPressed('left')) c = (c + n - 1) % n;
    if (input.repeatPressed('right')) c = (c + 1) % n;
    if (input.repeatPressed('up')) { if (c - COLS >= 0) c -= COLS; else if (sh > 0) { sh--; c = 0; } }
    if (input.repeatPressed('down')) {
      if (c + COLS < n) c += COLS;
      else if (Math.floor(c / COLS) < Math.floor((n - 1) / COLS)) c = n - 1;   // a short last row: its last item
      else if (sh < shelves.length - 1) { sh++; c = 0; }
    }
    if (c !== this.cursor || sh !== this.shelf) { this.cursor = c; this.shelf = sh; se('GUI sel cursor', 0.4); }
    if (input.pressed('a') && !this.flying) {
      const it = shelves[this.shelf].items[this.cursor];
      if ((profile.coins || 0) < it.price) { se('GUI sel buzzer'); this.shakeT = 16; return; }
      profile.coins -= it.price;
      this.flying = { it, i: this.cursor, t: 0 };
      se('GUI sel decision');
    }
  }

  draw(g) {
    const { profile } = this.seat, shelves = this.shelves(), shelf = shelves[this.shelf];
    g.fillStyle = '#F0E4C8'; g.fillRect(0, 0, VW, VH);
    g.fillStyle = '#E0D0A8'; for (let y = 36; y < VH; y += 32) g.fillRect(0, y, VW, 2);
    drawHeader(g, this.seat);
    icon(g, '🛒', VW / 2, 4, 24, 'center');
    icon(g, '🪙', VW - 104, 6, 22);
    text(g, String(profile.coins || 0), VW - 74, 4, { size: 26, color: '#F8F8F8', shadow: '#303030' });

    // the bag, and what's in it
    const hop = this.bagHop ? -Math.round(Math.abs(Math.sin(this.bagHop / 3)) * 10) : 0;
    icon(g, '🎒', BAG.x, BAG.y - 40 + hop, 64, 'center');
    bagItems(profile, this.seat.settings).slice(0, 12).forEach(([item, n], k) => {
      const x = 16 + (k % 3) * 62, y = 150 + Math.floor(k / 3) * 56;
      const it = [...this.seat.settings.shopItems, ...(this.seat.settings.furniture || [])].find(i => i.item === item) || { item };
      drawItem(g, it, x, y, 36);
      text(g, `×${n}`, x + 36, y + 10, { size: 18 });
    });

    // the shelves: which one, then its items
    shelves.forEach((sh, k) => {
      const x = 214 + k * 60, on = k === this.shelf;
      g.fillStyle = on ? '#FFFFFF' : 'rgba(255,255,255,0.4)'; g.fillRect(x, 44, 52, 40);
      if (on) { g.strokeStyle = this.seat.color; g.lineWidth = 3; g.strokeRect(x, 44, 52, 40); }
      icon(g, sh.icon, x + 26, 50, 26, 'center');
    });
    const top = this.topRow(), rows = Math.ceil(shelf.items.length / COLS);
    shelf.items.forEach((it, i) => {
      const row = Math.floor(i / COLS) - top;
      if (row < 0 || row >= ROWS_SHOWN) return;
      const c = card(i, top), sel = i === this.cursor, afford = (profile.coins || 0) >= it.price;
      const dx = sel ? shake(this.shakeT) : 0;
      g.fillStyle = sel ? '#FFFFFF' : '#F8F4E8'; g.fillRect(c.x + dx, c.y, c.w, c.h);
      g.strokeStyle = sel ? this.seat.color : '#B8A888'; g.lineWidth = sel ? 4 : 2; g.strokeRect(c.x + dx, c.y, c.w, c.h);
      if (!(this.flying && this.flying.it === it)) drawItem(g, it, c.x + dx + c.w / 2 - 28, c.y + 8, 56, { gray: !afford });
      icon(g, '🪙', c.x + dx + 10, c.y + 70, 18);
      text(g, String(it.price), c.x + dx + 34, c.y + 66, { size: 24, color: afford ? '#303030' : '#A09080' });
      if (it.friendship) for (let k = 0; k < Math.min(4, Math.ceil(it.friendship / 10)); k++) icon(g, '❤️', c.x + dx + 8 + k * 18, c.y + 92, 12);
      const have = bagCount(profile, it.item);
      if (have) text(g, `🎒${have}`, c.x + dx + c.w - 4, c.y + 2, { size: 14, align: 'right', shadow: null });
    });

    // more above / below: arrows in the margin, over the cards
    if (top > 0) icon(g, '🔼', 503, 94, 14, 'center');
    if (top + ROWS_SHOWN < rows) icon(g, '🔽', 503, 322, 14, 'center');

    // one on its way into the bag
    if (this.flying) {
      const c = card(this.flying.i, this.topRow()), p = this.flying.t / 26;
      const x = c.x + c.w / 2 + (BAG.x - c.x - c.w / 2) * p, y = c.y + 36 + (BAG.y - 10 - c.y - 36) * p - Math.sin(p * Math.PI) * 60;
      drawItem(g, this.flying.it, x - 24, y - 24, 48);
    }
  }
}
