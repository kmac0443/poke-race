// A tile map: 3 tile layers + extra collision. From the RPG (reference/world/map.js), without warps and events.
import { TILESETS, TILE, autotileQuarters, drawAutotile } from './tileset.js';
import { img, isReady } from '../core/assets.js';

export const DIRS = {
  up: { dx: 0, dy: -1, row: 3, opp: 'down', bit: 0x08 },
  down: { dx: 0, dy: 1, row: 0, opp: 'up', bit: 0x01 },
  left: { dx: -1, dy: 0, row: 1, opp: 'right', bit: 0x02 },
  right: { dx: 1, dy: 0, row: 2, opp: 'left', bit: 0x04 },
};

export class GameMap {
  constructor(def, w, h) {
    this.def = def;
    this.w = w; this.h = h;
    this.ts = TILESETS[def.tileset || 1];
    this.layers = [0, 1, 2].map(() => new Int16Array(w * h));
    this.quarters = [new Map(), new Map(), new Map()];
    this.blocked = new Uint8Array(w * h);   // extra collision (invisible walls, forests)
  }

  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  tile(l, x, y) { return this.inside(x, y) ? this.layers[l][this.idx(x, y)] : 0; }
  set(l, x, y, id) { if (this.inside(x, y)) this.layers[l][this.idx(x, y)] = id; }

  /** Call after all tiles are placed: precompute autotile edges. */
  finalize() {
    for (let l = 0; l < 3; l++) {
      const q = this.quarters[l];
      q.clear();
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const id = this.tile(l, x, y);
        if (id < 48 || id >= 384) continue;
        const slot = Math.floor(id / 48);
        const same = (dx, dy) => {
          const nx = x + dx, ny = y + dy;
          if (!this.inside(nx, ny)) return true;
          const n = this.tile(l, nx, ny);
          return n >= 48 && n < 384 && Math.floor(n / 48) === slot;
        };
        q.set(this.idx(x, y), autotileQuarters(same));
      }
    }
  }

  /** RMXP passability for leaving/entering the side `bit` of a cell. */
  tilePassable(x, y, bit) {
    if (!this.inside(x, y)) return false;
    if (this.blocked[this.idx(x, y)]) return false;
    const { passages, priorities } = this.ts;
    for (let l = 2; l >= 0; l--) {
      const t = this.tile(l, x, y);
      if (!t) continue;
      const p = passages[t] || 0;
      if (p & bit) return false;
      if ((p & 0x0F) === 0x0F) return false;
      if ((priorities[t] || 0) === 0) return true;
    }
    return true;
  }

  canMove(x, y, dir) {
    const d = DIRS[dir];
    if (!this.tilePassable(x, y, d.bit)) return false;
    return this.tilePassable(x + d.dx, y + d.dy, DIRS[d.opp].bit);
  }

  /** Draws tiles with priority 0 (below=true) or >0 (below=false) inside the camera rect. */
  drawLayer(ctx, camX, camY, vw, vh, below, frame) {
    const tsImg = img(this.ts.image);
    if (!isReady(tsImg)) return;
    const x0 = Math.max(0, Math.floor(camX / TILE)), y0 = Math.max(0, Math.floor(camY / TILE));
    const x1 = Math.min(this.w - 1, Math.floor((camX + vw) / TILE)), y1 = Math.min(this.h - 1, Math.floor((camY + vh) / TILE));
    const pr = this.ts.priorities;
    for (let l = 0; l < 3; l++) {
      const layer = this.layers[l];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const id = layer[y * this.w + x];
        if (!id) continue;
        const high = (pr[id] || 0) > 0;
        if (high === below) continue;
        const dx = x * TILE - camX, dy = y * TILE - camY;
        if (id >= 384) {
          const i = id - 384;
          ctx.drawImage(tsImg, (i % 8) * TILE, Math.floor(i / 8) * TILE, TILE, TILE, dx, dy, TILE, TILE);
        } else if (id >= 48) {
          const path = this.ts.autotiles[Math.floor(id / 48) - 1];
          const q = this.quarters[l].get(y * this.w + x);
          if (path && q) drawAutotile(ctx, path, q, dx, dy, frame);
        }
      }
    }
  }
}
