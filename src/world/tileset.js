// RMXP tilesets (passability, priority, terrain) + autotile drawing. From the RPG (reference/world/tileset.js).
import { loadJson, img, isReady } from '../core/assets.js';

export const TILE = 32;
export const TILESETS = {};

export async function loadTilesets() {
  if (Object.keys(TILESETS).length) return;
  for (const t of await loadJson('assets/data/tilesets.json')) TILESETS[t.id] = t;
}

/**
 * Quarter-tile chunks for an autotile cell, from its 8 neighbours.
 * same(dx,dy) → whether the neighbour is the same autotile.
 * Returns 4 chunk numbers (1-based, 6 per row in the 96x128 sheet): TL, TR, BL, BR.
 */
export function autotileQuarters(same) {
  const N = same(0, -1), S = same(0, 1), W = same(-1, 0), E = same(1, 0);
  const q = (v, h, d, center, inner, outer, vEdge, hEdge) => {
    if (v && h) return d ? center : inner;
    if (!v && !h) return outer;
    return v ? hEdge : vEdge;
  };
  return [
    q(N, W, same(-1, -1), 27, 5, 13, 15, 25),
    q(N, E, same(1, -1), 28, 6, 18, 16, 30),
    q(S, W, same(-1, 1), 33, 11, 43, 45, 31),
    q(S, E, same(1, 1), 34, 12, 48, 46, 36),
  ];
}

/** Draw a cell of an autotile. frame advances for animated sheets. */
export function drawAutotile(ctx, path, quarters, dx, dy, frame) {
  const i = img(path);
  if (!isReady(i)) return;
  if (i.height === 32) { // single-tile animation strip, no edge joining
    const frames = i.width / 32;
    ctx.drawImage(i, (frame % frames) * 32, 0, 32, 32, dx, dy, 32, 32);
    return;
  }
  const frames = Math.max(1, Math.floor(i.width / 96));
  const fx = (frame % frames) * 96;
  for (let k = 0; k < 4; k++) {
    const c = quarters[k] - 1;
    const sx = (c % 6) * 16 + fx, sy = Math.floor(c / 6) * 16;
    ctx.drawImage(i, sx, sy, 16, 16, dx + (k % 2) * 16, dy + (k >> 1) * 16, 16, 16);
  }
}
