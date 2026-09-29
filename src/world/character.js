// Anything that walks on the tile grid: players, followers, Pokémon in the pen. From the RPG
// (reference/world/character.js). Sheets are 4×4: rows down, left, right, up; 4 walk frames each.
import { img, isReady } from '../core/assets.js';
import { TILE } from './tileset.js';
import { DIRS } from './map.js';

export const WALK_FRAMES = 14; // frames per tile
export const RUN_FRAMES = 8;

export class Character {
  constructor(x, y, sprite, dir = 'down') {
    this.x = x; this.y = y;
    this.fromX = x; this.fromY = y;
    this.dir = dir;
    this.sprite = sprite;     // path to a 4x4 sheet
    this.moving = false;
    this.progress = 0;
    this.frames = WALK_FRAMES;
    this.step = 0;            // walk-cycle counter
    this.hidden = false;
  }

  get px() { return (this.fromX + (this.x - this.fromX) * this.t) * TILE; }
  get py() { return (this.fromY + (this.y - this.fromY) * this.t) * TILE; }
  get t() { return this.moving ? this.progress / this.frames : 1; }

  startMove(dir, frames = WALK_FRAMES) {
    const d = DIRS[dir];
    this.dir = dir;
    this.fromX = this.x; this.fromY = this.y;
    this.x += d.dx; this.y += d.dy;
    this.moving = true;
    this.progress = 0;
    this.frames = frames;
  }

  /** Jump straight to a tile (no animation). */
  place(x, y, dir = this.dir) {
    this.x = this.fromX = x; this.y = this.fromY = y; this.dir = dir; this.moving = false;
  }

  /** Returns true on the frame the move completes. */
  updateMove() {
    if (!this.moving) return false;
    const before = this.progress;
    this.progress++;
    const half = this.frames / 2;
    if (Math.floor(before / half) !== Math.floor(this.progress / half)) this.step++;
    if (this.progress >= this.frames) {
      this.moving = false;
      this.fromX = this.x; this.fromY = this.y;
      return true;
    }
    return false;
  }

  facing() {
    const d = DIRS[this.dir];
    return { x: this.x + d.dx, y: this.y + d.dy };
  }

  /** Draws with the frame's bottom-centre on the tile's bottom-centre. */
  draw(ctx, camX, camY) {
    if (this.hidden || !this.sprite) return;
    const i = img(this.sprite);
    if (!isReady(i)) return;
    const fw = i.width / 4, fh = i.height / 4;
    const col = this.moving ? (this.step + 1) % 4 : 0;
    const row = DIRS[this.dir].row;
    ctx.drawImage(i, col * fw, row * fh, fw, fh,
      Math.round(this.px - camX + TILE / 2 - fw / 2), Math.round(this.py - camY + TILE - fh), fw, fh);
  }
}
