// A child's house (DESIGN.md "Houses"): a room with a floor grid where furniture bought in the shop stands, and
// where Pokémon sent home live instead of exploring the farm.
//   profile.house = { items: [{ item, x, y }], walls: [{ x, y, style }] }   x, y: top-left floor cell / the wall's cell
//   pk.home = true                                  it lives in the house (not on the farm, not following)
// Placing, moving and putting away furniture each need a right answer first (scenes/house.js); that's the
// scene's job; these functions only change the save.
import { takeFromBag, addToBag } from './bag.js';

export const COLS = 18, ROWS = 11;                 // the floor, in 32 px tiles (the farm's scale)
export const DOOR = { x: 9, y: ROWS - 1 };          // the way in and out: nothing may stand here or just inside
const blocked = (x, y) => x === DOOR.x && y >= DOOR.y - 1;

export const furnitureInfo = (settings, item) => (settings.furniture || []).find(f => f.item === item) || null;
export const houseOf = profile => {
  const h = (profile.house = profile.house || { items: [] });
  h.walls = h.walls || [];
  return h;
};

// ------------------------------------------------------------------ walls (built in edit mode, a block a tile)
export const wallAt = (profile, x, y) => houseOf(profile).walls.find(w => w.x === x && w.y === y) || null;

/** Can a wall go on (x, y)? On the floor, not in the doorway, nothing standing there (rugs included). */
export function canWall(profile, settings, x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS || blocked(x, y) || wallAt(profile, x, y)) return false;
  return !pieceAt(profile, settings, x, y);
}

/** Build a wall block, or knock one down. Returns 'built', 'removed' or null (not allowed there). */
export function toggleWall(profile, settings, x, y, style) {
  const h = houseOf(profile), w = wallAt(profile, x, y);
  if (w) { h.walls = h.walls.filter(o => o !== w); return 'removed'; }
  if (!canWall(profile, settings, x, y)) return null;
  h.walls.push({ x, y, style });
  return 'built';
}

/** The piece whose footprint covers cell (x, y): on top (not a rug) first. */
export function pieceAt(profile, settings, x, y) {
  const covering = houseOf(profile).items.filter(p => {
    const f = furnitureInfo(settings, p.item);
    return f && x >= p.x && x < p.x + f.fw && y >= p.y && y < p.y + f.fh;
  });
  return covering.find(p => !furnitureInfo(settings, p.item).floor) || covering[0] || null;
}

/** Can `item` stand with its top-left at (x, y)? Inside the room, and not on another piece of its layer. */
export function canPlace(profile, settings, item, x, y, ignore = null) {
  const f = furnitureInfo(settings, item);
  if (!f || x < 0 || y < 0 || x + f.fw > COLS || y + f.fh > ROWS) return false;
  for (let j = y; j < y + f.fh; j++) for (let i = x; i < x + f.fw; i++) if (blocked(i, j) || wallAt(profile, i, j)) return false;
  return !houseOf(profile).items.some(p => {
    if (p === ignore) return false;
    const g = furnitureInfo(settings, p.item);
    if (!g || !!g.floor !== !!f.floor) return false;          // a rug and a chair can share a cell
    return x < p.x + g.fw && p.x < x + f.fw && y < p.y + g.fh && p.y < y + f.fh;
  });
}

/** Take it out of the bag and stand it there. */
export function place(profile, settings, item, x, y) {
  if (!canPlace(profile, settings, item, x, y) || !takeFromBag(profile, item)) return null;
  const piece = { item, x, y };
  houseOf(profile).items.push(piece);
  return piece;
}

export function move(profile, settings, piece, x, y) {
  if (!canPlace(profile, settings, piece.item, x, y, piece)) return false;
  piece.x = x; piece.y = y;
  return true;
}

/** Back into the bag. */
export function putAway(profile, piece) {
  const h = houseOf(profile);
  h.items = h.items.filter(p => p !== piece);
  addToBag(profile, piece.item);
}

/** Can someone stand on (x, y)? On the floor, not under furniture (rugs are fine). */
export function walkable(profile, settings, x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS || wallAt(profile, x, y)) return false;
  const p = pieceAt(profile, settings, x, y);
  return !p || !!furnitureInfo(settings, p.item)?.floor;
}

/** Cells a Pokémon at home can stand on: not under furniture (rugs are fine). */
export function freeCells(profile, settings) {
  const out = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const p = pieceAt(profile, settings, x, y);
    if ((!p || furnitureInfo(settings, p.item)?.floor) && !wallAt(profile, x, y)) out.push([x, y]);
  }
  return out;
}

export const residents = profile => profile.pokemon.filter(pk => pk.home);

/** The follower moves in (you walk alone). */
export function sendHome(profile, pk) {
  pk.home = true;
  if (profile.active === pk.uid) profile.active = null;
}

/** A Pokémon from home follows you; whoever was following moves in in its place. */
export function takeAlong(profile, pk) {
  const old = profile.pokemon.find(p => p.uid === profile.active);
  if (old) old.home = true;
  pk.home = false;
  profile.active = pk.uid;
}
