// Anything that walks on the tile grid: players, NPCs, followers.
import { img, isReady } from '../core/assets.js';
import { TILE } from './tileset.js';
import { DIRS } from './map.js';

export const WALK_FRAMES = 16; // frames per tile (GBA speed)
export const RUN_FRAMES = 8;
export const BIKE_FRAMES = 6;

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
    this.jumping = false;
    this.hidden = false;
    this.bush = false;        // standing in tall grass → hide lower body
    this.solid = true;
  }

  get px() { return (this.fromX + (this.x - this.fromX) * this.t) * TILE; }
  get py() { return (this.fromY + (this.y - this.fromY) * this.t) * TILE; }
  get t() { return this.moving ? this.progress / this.frames : 1; }

  /** Start moving one tile (or two when jumping a ledge). */
  startMove(dir, frames = WALK_FRAMES, jump = false) {
    const d = DIRS[dir];
    this.dir = dir;
    this.fromX = this.x; this.fromY = this.y;
    const n = jump ? 2 : 1;
    this.x += d.dx * n; this.y += d.dy * n;
    this.moving = true;
    this.jumping = jump;
    this.progress = 0;
    this.frames = jump ? 32 : frames;
  }

  /** Returns true on the frame the move completes. */
  updateMove() {
    if (!this.moving) return false;
    const before = this.progress;
    this.progress++;
    const half = this.frames / 2;
    if (Math.floor(before / half) !== Math.floor(this.progress / half)) this.step++;
    if (this.progress >= this.frames) {
      this.moving = false; this.jumping = false;
      this.fromX = this.x; this.fromY = this.y;
      return true;
    }
    return false;
  }

  face(dir) { this.dir = dir; }

  facing() {
    const d = DIRS[this.dir];
    return { x: this.x + d.dx, y: this.y + d.dy };
  }

  /** Draws with the frame's bottom-centre on the tile's bottom-centre. */
  draw(ctx, camX, camY, sheet = this.sprite) {
    if (this.hidden || !sheet) return;
    const i = img(sheet);
    if (!isReady(i)) return;
    const fw = i.width / 4, fh = i.height / 4;
    const col = this.moving && !this.sliding ? (this.step + 1) % 4 : 0;   // sliding on ice: no walk cycle
    const row = DIRS[this.dir].row;
    let dx = Math.round(this.px - camX + TILE / 2 - fw / 2);
    let dy = Math.round(this.py - camY + TILE - fh);
    if (this.jumping) dy -= Math.round(Math.sin(this.t * Math.PI) * 20);
    if (this.jumping || this.shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(this.px - camX + TILE / 2, this.py - camY + TILE - 4, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const cut = this.swim ? 14 : this.bush && !this.moving ? 12 : 0;   // swimmers are waist-deep in the water
    ctx.drawImage(i, col * fw, row * fh, fw, fh - cut, dx, dy, fw, fh - cut);
  }
}
