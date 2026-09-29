// Text, windows, dialogue and menus (GBA FireRed look).
import { img, isReady, draw } from './assets.js';
import { se } from './audio.js';

export const FONT = '"Power Clear"';
export const COLORS = {
  text: '#505058', shadow: '#D0D0C8',
  white: '#F8F8F8', whiteShadow: '#707070',
  red: '#E03028', redShadow: '#F0B0A0', blue: '#3060D8', blueShadow: '#A0B8F0',
  gray: '#A0A0A8',
};

// ---------------------------------------------------------------- text
export function setFont(ctx, size = 26, family = FONT) {
  ctx.font = `${size}px ${family}`;
  ctx.textBaseline = 'top';
}

export function text(ctx, str, x, y, opts = {}) {
  const { color = COLORS.text, shadow = COLORS.shadow, size = 26, align = 'left', family = FONT } = opts;
  setFont(ctx, size, family);
  ctx.textAlign = align;
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.fillText(str, x + 2, y);
    ctx.fillText(str, x, y + 2);
    ctx.fillText(str, x + 2, y + 2);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

export function measure(ctx, str, size = 26, family = FONT) {
  setFont(ctx, size, family);
  return ctx.measureText(str).width;
}

/** Word-wrap into lines no wider than maxW. Honors "\n". */
export function wrap(ctx, str, maxW, size = 26) {
  setFont(ctx, size);
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (line && ctx.measureText(test).width > maxW) { out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

// ---------------------------------------------------------------- windows
/** 9-slice windowskin. Border = (w-16)/2. */
export function drawWindow(ctx, x, y, w, h, skin = 'ui/windowskins/choice 1.png') {
  const i = img(skin);
  if (!isReady(i)) { ctx.fillStyle = '#F8F8F8'; ctx.fillRect(x, y, w, h); return; }
  const bw = (i.width - 16) / 2, bh = (i.height - 16) / 2;
  const cw = w - bw * 2, ch = h - bh * 2;
  const sx2 = i.width - bw, sy2 = i.height - bh;
  // centre
  ctx.drawImage(i, bw, bh, 16, 16, x + bw, y + bh, Math.max(0, cw), Math.max(0, ch));
  // edges
  ctx.drawImage(i, bw, 0, 16, bh, x + bw, y, cw, bh);
  ctx.drawImage(i, bw, sy2, 16, bh, x + bw, y + h - bh, cw, bh);
  ctx.drawImage(i, 0, bh, bw, 16, x, y + bh, bw, ch);
  ctx.drawImage(i, sx2, bh, bw, 16, x + w - bw, y + bh, bw, ch);
  // corners
  ctx.drawImage(i, 0, 0, bw, bh, x, y, bw, bh);
  ctx.drawImage(i, sx2, 0, bw, bh, x + w - bw, y, bw, bh);
  ctx.drawImage(i, 0, sy2, bw, bh, x, y + h - bh, bw, bh);
  ctx.drawImage(i, sx2, sy2, bw, bh, x + w - bw, y + h - bh, bw, bh);
}

export function drawArrow(ctx, x, y) {
  draw(ctx, 'ui/sel_arrow.png', x, y);
}

// ---------------------------------------------------------------- scenes
/** Base class for anything pushed onto a player's scene stack. */
export class Scene {
  constructor() { this.done = false; this.opaque = false; }
  update(_input) {}
  draw(_ctx) {}
  close(value) { this.done = true; this.result = value; if (this.resolve) this.resolve(value); }
}

/** Dialogue box with typewriter text. Resolves when the player dismisses the last page. */
export class MessageScene extends Scene {
  constructor(msg, opts = {}) {
    super();
    this.pages = [];
    this.opts = opts;
    this.autoClose = opts.autoClose; // frames to wait then close without input
    this.keepOpen = opts.keepOpen;   // stays drawn while a choice is shown
    this.raw = msg;
    this.page = 0;
    this.chars = 0;
    this.timer = 0;
    this.prepared = false;
  }
  prepare(ctx) {
    const lines = wrap(ctx, this.raw, 440);
    for (let i = 0; i < lines.length; i += 2) this.pages.push(lines.slice(i, i + 2));
    this.prepared = true;
  }
  get full() { return this.pages.length && this.chars >= this.pages[this.page].join('').length; }
  update(input) {
    if (!this.prepared) return;
    const speed = input.isDown('a') || input.isDown('b') ? 4 : 2;
    if (!this.full) { this.chars += speed / 2; return; }
    if (this.autoClose !== undefined) {
      if (++this.timer >= this.autoClose) this.close();
      return;
    }
    if (this.page === this.pages.length - 1 && this.keepOpen) { this.close(); return; }
    if (input.pressed('a') || input.pressed('b')) {
      se('GUI sel decision', 0.6);
      if (this.page < this.pages.length - 1) { this.page++; this.chars = 0; }
      else this.close();
    }
  }
  draw(ctx) {
    if (!this.prepared) this.prepare(ctx);
    drawMessageBox(ctx, this.pages[this.page], this.chars, this.full && !this.keepOpen && this.autoClose === undefined);
  }
}

export function drawMessageBox(ctx, lines, chars = Infinity, arrow = false) {
  drawWindow(ctx, 4, 282, 504, 100, 'ui/windowskins/speech frlg.png');
  let left = chars;
  let y = 302;
  for (const line of lines || []) {
    const s = line.slice(0, Math.max(0, Math.floor(left)));
    left -= line.length;
    text(ctx, s, 32, y);
    y += 32;
  }
  if (arrow && Math.floor(performance.now() / 300) % 2 === 0) {
    draw(ctx, 'ui/pause_arrow.png', 0, 0, 28, 28, 466, 346, 28, 28);
  }
}

/**
 * Vertical choice menu. items: array of strings or {label, value, disabled}.
 * Resolves with the chosen value (or index) or `cancelValue` on B.
 */
export class ChoiceScene extends Scene {
  constructor(items, opts = {}) {
    super();
    this.items = items.map((it, i) => typeof it === 'string' ? { label: it, value: i } : { value: i, ...it });
    this.index = opts.index || 0;
    this.cancelValue = opts.cancelValue !== undefined ? opts.cancelValue : null;
    this.canCancel = opts.canCancel !== false;
    this.x = opts.x; this.y = opts.y;
    this.width = opts.width;
    this.lineH = 32;
    this.under = opts.under; // a scene to draw underneath (e.g. the question MessageScene)
    this.onMove = opts.onMove;
  }
  update(input) {
    const n = this.items.length;
    if (input.repeatPressed('up')) { this.index = (this.index + n - 1) % n; se('GUI sel cursor', 0.5); this.onMove && this.onMove(this.items[this.index]); }
    if (input.repeatPressed('down')) { this.index = (this.index + 1) % n; se('GUI sel cursor', 0.5); this.onMove && this.onMove(this.items[this.index]); }
    if (input.pressed('a')) {
      const it = this.items[this.index];
      if (it.disabled) { se('GUI sel buzzer'); return; }
      se('GUI sel decision', 0.6);
      this.close(it.value);
    } else if (input.pressed('b') && this.canCancel) {
      se('GUI sel cancel', 0.6);
      this.close(this.cancelValue);
    }
  }
  draw(ctx) {
    if (this.under) this.under.draw(ctx);
    const w = this.width || Math.max(...this.items.map(it => measure(ctx, it.label))) + 64;
    const h = this.items.length * this.lineH + 32;
    const x = this.x !== undefined ? this.x : 512 - w - 4;
    const y = this.y !== undefined ? this.y : (this.under ? 282 - h : 384 - h - 4);
    drawWindow(ctx, x, y, w, h);
    this.items.forEach((it, i) => {
      text(ctx, it.label, x + 40, y + 16 + i * this.lineH, { color: it.disabled ? COLORS.gray : COLORS.text });
      if (i === this.index) drawArrow(ctx, x + 18, y + 18 + i * this.lineH);
    });
  }
}

/** Picks a number in [min,max]; used for shop quantities. */
export class NumberScene extends Scene {
  constructor(min, max, format = n => `x${n}`) {
    super();
    this.min = min; this.max = max; this.value = min; this.format = format;
  }
  update(input) {
    if (input.repeatPressed('up')) this.value = this.value >= this.max ? this.min : this.value + 1;
    if (input.repeatPressed('down')) this.value = this.value <= this.min ? this.max : this.value - 1;
    if (input.repeatPressed('right')) this.value = Math.min(this.max, this.value + 10);
    if (input.repeatPressed('left')) this.value = Math.max(this.min, this.value - 10);
    if (input.pressed('a')) { se('GUI sel decision', 0.6); this.close(this.value); }
    if (input.pressed('b')) { se('GUI sel cancel', 0.6); this.close(0); }
  }
  draw(ctx) {
    drawWindow(ctx, 300, 200, 208, 76);
    text(ctx, this.format(this.value), 330, 222);
  }
}
