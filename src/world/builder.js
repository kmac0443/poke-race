// Builds a GameMap from an ASCII layout plus building "stamps" and fenced pens. The outdoor part of the RPG's
// builder (reference/world/builder.js); every tile id here was checked with tools/sheet.py.
//
// Legend (tileset 1 "Outside"):
//   .  grass     T  forest (2×3 units: runs start on an even column, even width, height a multiple of 3)
//   P  lone pine (2×3, anchor = top-left)      =  town path      :  dirt path      ~  water (a pond)
//   f  flowers   r  small rock                 x  invisible wall
//   Anything else becomes grass (use letters as markers).
import { GameMap } from './map.js';

export const STAMPS = {
  house_green: { id: 1720, w: 5, h: 4 },
  house_blue: { id: 1752, w: 5, h: 4 },
  house_orange: { id: 1920, w: 5, h: 5 },
  lab: { id: 2664, w: 6, h: 4 },
  pokecenter: { id: 2992, w: 5, h: 5 },
  gym: { id: 3184, w: 7, h: 5 },
  institute: { id: 3392, w: 7, h: 5 },
  pine: { id: 804, w: 2, h: 3 },
  fountain: { id: 1509, w: 3, h: 3 },
};

// Nine-slice ground patches: a 3x3 block whose rows are 8 tiles apart (see pathTile).
const PATH9 = { '=': 425, ':': 481 };
// The grey picket fence: two posts per tile; the stubs and bars show which neighbours join.
const FENCE = { TL: 1684, T: 1681, TR: 1685, L: 1672, R: 1673, BL: 1667, B: 1681, BR: 1668, endL: 1682, endR: 1680 };

/** Throws unless every forest run is in whole 2×3 units (half-trees otherwise). */
export function checkForestUnits(rows, id = 'map') {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const at = (x, y) => rows[y][x] === 'T';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!at(x, y)) continue;
    if (x === 0 || !at(x - 1, y)) {
      let n = 0; while (x + n < w && at(x + n, y)) n++;
      if (x % 2 || n % 2) throw new Error(`${id}: forest row ${y} at x=${x}, ${n} wide: must start on an even column and be even`);
    }
    if (y === 0 || !at(x, y - 1)) {
      let n = 0; while (y + n < h && at(x, y + n)) n++;
      if (n % 3) throw new Error(`${id}: forest column ${x} at y=${y}, ${n} tall: must be a multiple of 3`);
    }
  }
}

export function buildMap(def) {
  const rows = def.ascii;
  checkForestUnits(rows, def.id);
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const m = new GameMap(def, w, h);
  const ch = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : (rows[y][x] || '.');
  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = ch(x, y);
    const hv = hash(x, y) % 23;
    m.set(0, x, y, hv === 0 ? 386 : hv === 1 ? 387 : 385);
    switch (c) {
      case '~': m.set(0, x, y, 48); m.blocked[m.idx(x, y)] = 1; break;
      case 'f': m.set(1, x, y, 240); break;
      case 'r': m.set(1, x, y, 1328); m.blocked[m.idx(x, y)] = 1; break;
      case 'x': m.blocked[m.idx(x, y)] = 1; break;
      case 'T': m.blocked[m.idx(x, y)] = 1; break;   // drawn in a second pass (drawForest)
      case 'P':
        if (ch(x - 1, y) === 'P' || ch(x, y - 1) === 'P') break; // only the anchor stamps
        stamp(m, STAMPS.pine, x, y);
        for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) m.blocked[m.idx(x + i, y + j)] = 1;
        break;
    }
    if (PATH9[c] !== undefined) pathTile(m, x, y, 0, PATH9[c], (dx, dy) => { const n = ch(x + dx, y + dy); return n === null || n === c; });
  }
  drawForest(m, ch, w, h);

  for (const p of def.fences || []) fence(m, p);
  m.doors = {};
  for (const s of def.stamps || []) {
    const door = stamp(m, STAMPS[s.s], s.x, s.y);
    if (s.key) m.doors[s.key] = door;
  }
  m.finalize();
  return m;
}

/** A fenced pen: the rectangle's edge is fence; `gap: [x0, x1]` leaves an opening in the top row. */
function fence(m, { x, y, w, h, gap }) {
  const inGap = cx => gap && cx >= gap[0] && cx <= gap[1];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const cx = x + i, cy = y + j;
    const top = j === 0, bottom = j === h - 1, left = i === 0, right = i === w - 1;
    if (!top && !bottom && !left && !right) continue;
    if (top && inGap(cx)) continue;
    let id;
    if (top) id = left ? FENCE.TL : right ? FENCE.TR : inGap(cx + 1) ? FENCE.endL : inGap(cx - 1) ? FENCE.endR : FENCE.T;
    else if (bottom) id = left ? FENCE.BL : right ? FENCE.BR : FENCE.B;
    else id = left ? FENCE.L : FENCE.R;
    m.set(1, cx, cy, id);
    m.blocked[m.idx(cx, cy)] = 1;
  }
}

// Trees: pairs of columns (left 800/808, right 801/809), alternating crown and body rows, a trunk row along the
// bottom (818/819), edge variants where the forest stops (802/810 left, 803/811 right), and the tree tops of the
// front row (804/805) drawn over the row above, so a forest's edge never shows half of a tree that isn't there.
function drawForest(m, ch, w, h) {
  const T = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? true : ch(x, y) === 'T';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (ch(x, y) !== 'T') continue;
    const right = x % 2;
    let below = 0;
    while (T(x, y + below + 1) && below < h) below++;
    const edgeL = !right && !T(x - 1, y), edgeR = right && !T(x + 1, y);
    const top = !T(x, y - 1);
    let id;
    if (below === 0 && y + 1 < h) id = 818 + right;                              // trunks and the ground in front
    else if (below % 2 === 1) id = (edgeL ? 810 : edgeR ? 811 : 808 + right);   // body
    else if (top) {                                                               // a crown row with no tree above:
      m.set(2, x, y, 804 + right);                                                // just the tree top, over the ground
      continue;
    } else id = (edgeL ? 802 : edgeR ? 803 : 800 + right);                        // crown (with the trunk above it)
    m.set(1, x, y, id);
    if (top && below % 2 === 1 && y > 0 && ch(x, y - 1) !== 'T') m.set(2, x, y - 1, 804 + right);
  }
}

/**
 * Copy a rectangular tileset region onto the map; returns the door cell: the walkable tile in the bottom row
 * nearest the middle.
 */
export function stamp(m, st, x, y) {
  let door = null;
  for (let r = 0; r < st.h; r++) for (let c = 0; c < st.w; c++) {
    const id = st.id + r * 8 + c;
    const layer = m.tile(1, x + c, y + r) ? 2 : 1;
    m.set(layer, x + c, y + r, id);
    const mid = (st.w - 1) / 2;
    if (r === st.h - 1 && (m.ts.passages[id] & 0x0F) === 0 && (!door || Math.abs(c - mid) < Math.abs(door.x - x - mid))) door = { x: x + c, y: y + r };
  }
  if (st.door) door = { x: x + st.door[0], y: y + st.door[1] };
  return door;
}

// Path sets in Outside.png: a 3x3 block at `base` (TL..BR, rows 8 tiles apart), a 1-wide vertical strip
// at base-1, a 1-wide horizontal strip at base+24..26, a single dot at base+23, and inner corners at base+3/4/11/12.
function pathTile(m, x, y, layer, base, same) {
  const N = same(0, -1), S = same(0, 1), W = same(-1, 0), E = same(1, 0);
  let id;
  if (!W && !E && !N && !S) id = base + 23;
  else if (!W && !E) id = !N ? base - 1 : !S ? base + 15 : base + 7;
  else if (!N && !S) id = !W ? base + 24 : !E ? base + 26 : base + 25;
  else if (!N && !W) id = base;
  else if (!N && !E) id = base + 2;
  else if (!N) id = base + 1;
  else if (!S && !W) id = base + 16;
  else if (!S && !E) id = base + 18;
  else if (!S) id = base + 17;
  else if (!W) id = base + 8;
  else if (!E) id = base + 10;
  else if (!same(-1, -1)) id = base + 12;
  else if (!same(1, -1)) id = base + 11;
  else if (!same(-1, 1)) id = base + 4;
  else if (!same(1, 1)) id = base + 3;
  else id = base + 9;
  m.set(layer, x, y, id);
}
