// Builds GameMaps from compact definitions: an ASCII layout plus building "stamps".
//
// Outdoor legend (tileset 1 "Outside"):
//   .  grass           ,  wild grass (encounters)   ;  tall grass (encounters)
//   T  forest          P  lone pine (2x3, anchor = top-left)   =  dirt path   :  sand path
//   ~  water (surf)    _  ledge (jump down)         f  flowers    #  fence   r  rock
//   B  wooden deck (bridge over water / dock)   x  invisible wall   s  sign post
//   S  sand           G  gravel                 C  grey cliff wall   c  brown cliff wall   R  boulder pile
//   W  snow           y  wild grass in snow     Y  tall grass in snow   (a map with `snow: true` is snow all over)
//   H  stone stairs (runs start on an even column, 2 or 4 wide) — for ramps up a rock face
//   O  rocks in the sea (the Water rock autotile — solid; the visible edge of the world out on the water)
//   Anything else (e.g. letters used as markers) becomes grass; use them for your own notes.
import { GameMap } from './map.js';
import { loadJson } from '../core/assets.js';

// ------------------------------------------------------------------ Essentials example maps
// Map defs with `ess: <id>` take their tiles, doors and edge connections from data/maps/ess_<id>.json.
export const ESS = {};
export const CONNECTIONS = []; // [mapA, edgeA, offA, mapB, edgeB, offB]

export async function loadEssMaps(ids) {
  const txt = await (await fetch('data/maps/connections.txt')).text();
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const f = line.split(',').map(x => x.trim());
    if (f.length === 6) CONNECTIONS.push([+f[0], f[1], +f[2], +f[3], f[4], +f[5]]);
  }
  await Promise.all([...new Set(ids)].map(async id => {
    ESS[id] = await loadJson(`data/maps/ess_${String(id).padStart(3, '0')}.json`);
  }));
}

const EDGE = { N: 'up', S: 'down', W: 'left', E: 'right' };
const RMXP_DIR = { 2: 'down', 4: 'left', 6: 'right', 8: 'up' };

function buildEss(def, essToOurs) {
  const src = ESS[def.ess];
  if (!src) throw new Error('Essentials map not loaded: ' + def.ess);
  const m = new GameMap({ tileset: src.tileset, ...def }, src.w, src.h);
  for (let l = 0; l < 3; l++) m.layers[l].set(src.layers[l]);
  // Doors / exits: every touch-triggered event whose first page transfers the player
  for (const ev of src.events) {
    const pg = ev.pages[0];
    if (!pg || !pg.warp || pg.trigger === 0 && !/door|exit|stairs/i.test(ev.name)) continue;
    // Same-map warps (stairs) stay here; anything leading "outside" returns to the door you came in by.
    const to = (def.warpTo && def.warpTo[ev.id]) || (pg.warp.map === def.ess ? def.id : essToOurs[pg.warp.map] || '@return');
    if (to === '@return') {
      // Only real exits lead back outside; ignore the template's leftover debug warp tiles
      if (!/exit|door/i.test(ev.name)) continue;
      m.warps.push({ x: ev.x, y: ev.y, to, sfx: 'Door exit' });
      continue;
    }
    m.warps.push({ x: ev.x, y: ev.y, to, tx: pg.warp.x, ty: pg.warp.y, dir: RMXP_DIR[pg.warp.dir] || null,
      door: /door/i.test(ev.name) || /^doors/.test(pg.sprite), sfx: /door/i.test(ev.name) ? 'Door enter' : /exit/i.test(ev.name) ? 'Door exit' : null });
  }
  // Edge connections
  const edges = { up: [], down: [], left: [], right: [] };
  for (const [a, ea, oa, b, eb, ob] of CONNECTIONS) {
    if (a === def.ess && essToOurs[b]) edges[EDGE[ea]].push({ to: essToOurs[b], offset: ob - oa, essTo: b });
    if (b === def.ess && essToOurs[a]) edges[EDGE[eb]].push({ to: essToOurs[a], offset: oa - ob, essTo: a });
  }
  m.connections = edges;
  return m;
}

export const STAMPS = {
  house_green: { id: 1720, w: 5, h: 4 },
  house_blue: { id: 1752, w: 5, h: 4 },
  house_gray: { id: 1816, w: 5, h: 4 },
  house_purple: { id: 1851, w: 5, h: 4 },
  house_orange: { id: 1920, w: 5, h: 5 },
  house_teal: { id: 1880, w: 6, h: 4 },
  lab: { id: 2664, w: 6, h: 4 },
  pokecenter: { id: 2992, w: 5, h: 5 },
  mart: { id: 3032, w: 4, h: 4 },
  gym: { id: 3184, w: 7, h: 5 },
  pine: { id: 804, w: 2, h: 3 },
  fountain: { id: 1509, w: 3, h: 3 },
  rocket_hq: { id: 3288, w: 6, h: 5 },
  institute: { id: 3392, w: 7, h: 5 },
  cliff_cave: { id: 1168, w: 3, h: 2, door: [1, 1] },        // brown rock face with a cave mouth
  // A cave mouth cut straight into a cliff wall: the dark arch, with the doorway below it.
  // A cave mouth is one tile set into the bottom edge of a rock face, exactly as the Essentials maps do it.
  cave_mouth: { id: 1182, w: 1, h: 1, door: [0, 0] },
  cave_mouth_grey: { id: 1262, w: 1, h: 1, door: [0, 0] },
  // A tall domed tower (Frostpeak's Bell Tower): 7 wide, 13 tall, the door in the middle of the bottom row.
  dome_tower: { id: 3832, w: 7, h: 13, door: [3, 12] },
};

// Nine-slice ground patches: each set is a 3x3 block whose rows are 8 tiles apart (see pathTile).
const PATH9 = { '=': 425, ':': 481, 'S': 537, 'G': 593, 'W': 649 }; // town path, dirt path, sand, gravel, snow
const SNOW = 658;                  // plain snow (the middle of the snow patch)
// Characters a patch treats as more of itself, so snow runs on under the grass that pokes through it
const PATCH_SAME = { W: 'WyY' };
// Rock masses: like trees, a wall is tiled in whole 2x3 units from the bottom up (grey / brown).
const CLIFFS = { 'C': 1248, 'c': 1168 };

export function buildMap(def, essToOurs = {}) {
  if (def.ess) {
    const m = buildEss(def, essToOurs);
    for (const s of def.stamps || []) stamp(m, STAMPS[s.s] || s.def, s.x, s.y);
    for (const wp of def.warps || []) m.warps.push({ ...wp });
    for (const [x, y] of def.walls || []) m.blocked[m.idx(x, y)] = 1;
    for (const g of def.gates || []) for (const [x, y] of g.cells) m.blocked[m.idx(x, y)] = 1;
    for (const hg of def.holdGates || []) { hg._open = false; for (const [x, y] of hg.cells) m.blocked[m.idx(x, y)] = 1; }
    if (def.patch) def.patch(m);
    m.finalize();
    return m;
  }
  const rows = def.ascii;
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const m = new GameMap(def, w, h);
  const ch = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : (rows[y][x] || '.');
  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

  if (def.gym) {
    buildGym(m, def, ch, w, h);
  } else if (def.interior) {
    buildInterior(m, def, ch, w, h);
  } else if (def.caveAscii) {
    buildCave(m, def, ch, w, h, hash);
  } else {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = ch(x, y);
      const hv = hash(x, y) % 23;
      m.set(0, x, y, def.snow ? SNOW : hv === 0 ? 386 : hv === 1 ? 387 : 385);
      switch (c) {
        case ',': m.set(1, x, y, 390); break;
        case 'y': m.set(0, x, y, SNOW); m.set(1, x, y, 390); break;     // grass poking through the snow
        case 'Y': m.set(0, x, y, SNOW); m.set(1, x, y, 391); break;
        case ';': m.set(1, x, y, 391); break;
        case '~': m.set(0, x, y, 48); break;
        case 'O': m.set(0, x, y, 48); m.set(1, x, y, 288); m.blocked[m.idx(x, y)] = 1; break;   // rocks in the sea (over water)
        // wooden deck: a bridge over water, or a dock out from the shore
        case 'B': m.set(0, x, y, 48); m.set(1, x, y, 1637); break;   // ground-level planks over water
        case '_': m.set(1, x, y, 1212); m.ledges[m.idx(x, y)] = 1; break;
        case 'f': m.set(1, x, y, 240); break;
        case '#': m.set(1, x, y, 1682); break;
        case 'r': m.set(1, x, y, 1328); break;
        case 'R': m.set(1, x, y, 1512 + (x % 2)); m.blocked[m.idx(x, y)] = 1; break;   // rubble you can't climb
        case 's': m.set(1, x, y, 1337); break;
        // stone stairs up a rock face: 2 wide, the top row is the lip (1153/1154), every row below a step (1161/1162)
        case 'H': m.set(1, x, y, (ch(x, y - 1) === 'H' ? 1161 : 1153) + (x % 2)); break;
        case 'x': m.blocked[m.idx(x, y)] = 1; break;
        case 'C': case 'c':
          // Rock is drawn as one smooth mass in a second pass (drawRock); it's a wall, full stop — some of the
          // rock tiles are walkable in the tileset data (they're meant as plateau tops).
          m.blocked[m.idx(x, y)] = 1;
          break;
        case 'T':
          m.blocked[m.idx(x, y)] = 1;   // drawn in a second pass (drawForest)
          break;
        case 'P': {
          if (ch(x - 1, y) === 'P' || ch(x, y - 1) === 'P') break; // only the anchor stamps
          stamp(m, STAMPS.pine, x, y);
          break;
        }
      }
      if (PATH9[c] !== undefined) pathTile(m, x, y, 0, PATH9[c], (dx, dy) => { const n = ch(x + dx, y + dy); return n === null || n === c || n === 'D' || (PATCH_SAME[c] || '').includes(n); });
    }
    drawForest(m, def, ch, w, h);
    drawRock(m, def, ch, w, h, 'C'); drawRock(m, def, ch, w, h, 'c');
  }

  // Buildings & objects
  for (const s of def.stamps || []) {
    const st = STAMPS[s.s] || s.def;
    const door = stamp(m, st, s.x, s.y);
    if (door && s.to) {
      // `dir` is which way you face on arrival — 'up' walking into a building, 'down' out of a tunnel mouth
      m.warps.push({ x: door.x, y: door.y, to: s.to, tx: s.tx, ty: s.ty, dir: s.dir || 'up', door: true, sfx: s.sfx || 'Door enter' });
    }
  }
  for (const wp of def.warps || []) m.warps.push({ ...wp });
  for (const [x, y] of def.walls || []) m.blocked[m.idx(x, y)] = 1;
  for (const g of def.gates || []) for (const [x, y] of g.cells) m.blocked[m.idx(x, y)] = 1;
  for (const hg of def.holdGates || []) { hg._open = false; for (const [x, y] of hg.cells) m.blocked[m.idx(x, y)] = 1; }
  m.finalize();
  return m;
}

// ------------------------------------------------------------------ walls, the way the Essentials maps draw them
// (worked out from how the example maps use these tiles — see tools/learn-walls.py)

/** Which of a cell's neighbours are wall: returns a function (dx, dy) → bool. Off the map counts as wall. */
const wallAt = (ch, w, h, isWall) => (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? true : isWall(ch(x, y));

/** The nine-slice piece for a wall cell, by which neighbours are open ground. */
function slice(W, x, y) {
  const N = W(x, y - 1), S = W(x, y + 1), E = W(x + 1, y), Wt = W(x - 1, y);
  if (!N && !Wt) return 'TL'; if (!N && !E) return 'TR';
  if (!S && !Wt) return 'BL'; if (!S && !E) return 'BR';
  if (!S) return 'B'; if (!N) return 'T'; if (!Wt) return 'L'; if (!E) return 'R';
  if (!W(x + 1, y - 1)) return 'iNE'; if (!W(x - 1, y - 1)) return 'iNW';
  if (!W(x + 1, y + 1)) return 'iSE'; if (!W(x - 1, y + 1)) return 'iSW';
  return 'C';
}

/** What to put under a wall's edge tiles so it matches the ground beside it. */
function groundBeside(def, ch, x, y) {
  const n = [ch(x, y - 1), ch(x, y + 1), ch(x - 1, y), ch(x + 1, y)];
  if (n.includes('~') || n.includes('B')) return 48;
  if (n.includes('S')) return 546;
  if (n.includes('G')) return 602;
  if (n.includes(':')) return 490;
  if (n.includes('=')) return 434;
  if (def.snow || n.includes('W') || n.includes('y') || n.includes('Y')) return 658;
  return 385;
}

// Rock: the rounded mass (brown 1168…, grey 1248…). [tile, layer] — layer-1 pieces sit over the ground beside them.
const rockPieces = b => ({
  TL: [b, 1], T: [b + 20, 0], TR: [b + 2, 1], L: [b + 8, 1], C: [b + 9, 0], R: [b + 10, 1],
  BL: [b + 16, 1], B: [b + 17, 1], BR: [b + 18, 1], iNE: [b + 19, 0], iNW: [b + 21, 0], iSE: [b + 24, 0], iSW: [b + 25, 0],
});
// Deep inside a rock mass: a forest of rock spires and boulders, so nobody mistakes it for somewhere to walk.
const SPIRE = { c: 1220, C: 1300 }, BOULDERS = { c: [1199, 1207, 1215], C: [1279, 1287, 1295] };

function drawRock(m, def, ch, w, h, k) {
  const W = wallAt(ch, w, h, c => c === k);
  const P = rockPieces(CLIFFS[k]);
  const deep = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (ch(x, y) !== k) continue;
    let d = true;
    for (let j = -2; j <= 2 && d; j++) for (let i = -2; i <= 2; i++) if (!W(x + i, y + j)) { d = false; break; }
    deep[m.idx(x, y)] = d ? 1 : 0;
  }
  const used = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (ch(x, y) !== k) continue;
    const [id, layer] = P[slice(W, x, y)];
    if (layer === 1) { m.set(0, x, y, groundBeside(def, ch, x, y)); m.set(1, x, y, id); } else m.set(0, x, y, id);
    if (!deep[m.idx(x, y)] || used[m.idx(x, y)]) continue;
    // a 2x4 spire where there's room, otherwise the odd boulder
    const fits = x % 2 === 0 && y % 4 === 0 && [0, 1].every(i => [0, 1, 2, 3].every(j => x + i < w && y + j < h && deep[m.idx(x + i, y + j)] && !used[m.idx(x + i, y + j)]));
    if (fits) {
      for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) { m.set(1, x + i, y + j, SPIRE[k] + j * 8 + i); used[m.idx(x + i, y + j)] = 1; }
    } else if ((x * 7 + y * 3) % 5 === 0) m.set(1, x, y, BOULDERS[k][(x + y) % 3]);
  }
}

// Trees: pairs of columns (left 800/808, right 801/809), alternating crown and body rows, a trunk row along the
// bottom (818/819), edge variants where the forest stops (802/810 left, 803/811 right), and the tree tops of the
// front row (804/805) drawn over the row above — so a forest's edge never shows half of a tree that isn't there.
function drawForest(m, def, ch, w, h) {
  const T = wallAt(ch, w, h, c => c === 'T');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (ch(x, y) !== 'T') continue;
    const right = x % 2;                       // forests start on even columns, so this is the tree's right half
    let below = 0;
    while (T(x, y + below + 1) && below < h) below++;
    const edgeL = !right && !T(x - 1, y), edgeR = right && !T(x + 1, y);
    const top = !T(x, y - 1);
    let id;
    if (below === 0 && y + 1 < h) id = 818 + right;                              // trunks and the ground in front
    else if (below % 2 === 1) id = (edgeL ? 810 : edgeR ? 811 : 808 + right);   // body
    else if (top) {                                                               // a crown row with no tree above:
      m.set(0, x, y, groundBeside(def, ch, x, y - 1) === 48 ? 385 : groundBeside(def, ch, x, y));
      m.set(2, x, y, 804 + right);                                                // just the tree top, over the ground
      continue;
    } else id = (edgeL ? 802 : edgeR ? 803 : 800 + right);                        // crown (with the trunk above it)
    m.set(1, x, y, id);
    // a body row at the very top: its tree top pokes into the row above
    if (top && below % 2 === 1 && y > 0 && ch(x, y - 1) !== 'T') m.set(2, x, y - 1, 804 + right);
  }
}

/**
 * Copy a rectangular tileset region onto the map; returns the door cell: the walkable tile in the bottom row
 * nearest the middle (some buildings, like the Rocket base, also have a walkable corner tile).
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

// ------------------------------------------------------------------ caves
// Caves we design ourselves (tileset 6). Same ASCII idea as a route, so puzzles can be laid out by hand:
//   .  cave floor      ,  rubble floor     ~  water (surf)      T  rock wall (2x3 units, like trees)
//   L  ladder/steps    r  small rock       x  invisible wall    anything else is floor.
// With `ice: true` the same layout is drawn from the frozen half of the sheet, which sits exactly 792 tiles
// after the brown one (wall 504 → 1296, rocks 556 → 1348, steps 539 → 1331), plus:
//   i  slippery ice (slide until something stops you — world/solo.js)
//   k / K  a field of thin ice: k gives way, K holds. They look identical; only someone on one of the map's
//          `thinIce.lookouts` sees the K path (OverworldScene.thinField / drawLookouts)
//   I  the Ice Rock (2 tall; an Eevee that levels up on this map becomes Glaceon — give the map locationFlags)
// With `volcano: true` the walls, rocks and steps come from the red rock set (208 tiles on) over a tan floor, plus:
//   l  lava (the Lava autotile we made, in the Caves tileset's spare slot 4 — ids 192+). Solid, but a Strength
//      boulder shoved into it sinks and leaves a rock you can walk on (World.sinkBoulders; resets when the map empties)
//   q / Q  flame jets (per player, on a shared clock — world/solo.js jetActive)
const ICE = 792, VOLCANO = 208, LAVA = 192;
function buildCave(m, def, ch, w, h, hash) {
  const o = def.ice ? ICE : def.volcano ? VOLCANO : 0;
  let force = null, field = null, lava = null, jets = null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = ch(x, y);
    const hv = hash(x, y) % 17;
    m.set(0, x, y, def.ice ? 1386 : def.volcano ? (hv === 0 ? 877 : hv === 1 ? 882 : 874) : hv === 0 ? 613 : hv === 1 ? 620 : 612);
    if (def.volcano) switch (c) {
      case 'l': m.set(0, x, y, LAVA); (lava = lava || new Uint8Array(w * h))[m.idx(x, y)] = 1; m.blocked[m.idx(x, y)] = 1; continue;
      case 'q': case 'Q': (jets = jets || new Uint8Array(w * h))[m.idx(x, y)] = c === 'q' ? 1 : 2; continue;
      case ',': m.set(0, x, y, 872 + (hv % 2) * 8); continue;
    }
    if (def.ice) switch (c) {
      case 'i': m.set(0, x, y, 1328); (force = force || new Uint8Array(w * h))[m.idx(x, y)] = 6; continue;
      case 'k': case 'K': m.set(0, x, y, 1321); (field = field || new Uint8Array(w * h))[m.idx(x, y)] = c === 'K' ? 2 : 1; continue;
      case 'I': m.set(1, x, y, 1358); m.set(2, x, y - 1, 1350); m.blocked[m.idx(x, y)] = 1; continue;   // crystal + its cap (drawn over you)
      case ',': m.set(0, x, y, 1396 + (hv % 2) * 2); continue;         // scuffed snow
    }
    switch (c) {
      case 'T': m.blocked[m.idx(x, y)] = 1; break;               // the rock walls are drawn below, as one mass
      case ',': m.set(0, x, y, 616 + (hv % 3)); break;           // a patch of finer gravel
      case 'r': m.set(1, x, y, def.ice ? (x % 2 ? 1357 : 1367) : 557 + o); break;   // a boulder (see-through, so it sits on the floor)
      case '~': m.set(0, x, y, 48); break;
      case 'L': m.set(1, x, y, 539 + o); break;                  // steps to the next floor
      case 'x': m.blocked[m.idx(x, y)] = 1; break;
    }
    if (c === 'r') m.blocked[m.idx(x, y)] = 1;
  }
  m.force = force; m.fieldIce = field; m.lava = lava; m.jets = jets;
  // Walls as one smooth mass: rock top 513 inside, edge pieces over the floor round the outside — the way the
  // Essentials caves are drawn (a wall made of 2x3 lumps looked like hills you could walk up).
  const Wl = wallAt(ch, w, h, c => c === 'T');
  const P = { TL: 504, T: 505, TR: 506, L: 512, R: 514, BL: 520, B: 521, BR: 522 };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (ch(x, y) !== 'T') continue;
    const piece = slice(Wl, x, y);
    if (P[piece]) m.set(1, x, y, P[piece] + o); else m.set(0, x, y, 513 + o);
  }
}

// ------------------------------------------------------------------ interiors
// Interiors use a per-map legend: { char: tileId | [tileId, layer] | {id, w, h} (stamp) }.
function buildInterior(m, def, ch, w, h) {
  const legend = def.legend || {};
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = ch(x, y);
    if (def.floor) m.set(0, x, y, typeof def.floor === 'function' ? def.floor(x, y) : def.floor);
    const L = legend[c];
    if (L === undefined) continue;
    if (typeof L === 'number') m.set(L >= 0 ? 0 : 0, x, y, L);
    else if (Array.isArray(L)) m.set(L[1], x, y, L[0]);
    else if (L.w) { if (ch(x - 1, y) !== c && ch(x, y - 1) !== c) stamp(m, L, x, y); }
    else if (L.fn) L.fn(m, x, y);
    if (c === 'x') m.blocked[m.idx(x, y)] = 1;
  }
}

// ------------------------------------------------------------------ gyms
// Gyms we lay out ourselves (tileset 14 "Gyms"). The frame is automatic: row 0 is the roof edge, rows 1–2
// the back wall, column 0 / w-1 the side walls and the last row is outside; write them as '#'.
// Inside:
//   .  floor           ,  second floor (planks / lit panels)     o  rock or machine (solid)
//   s  statue (solid, 2 tall — the head is drawn on the row above)  ~  pool (solid)
//   i  ice: slide until something stops you        < > ^ v  conveyor arrows    +  conveyor stop
//   *  floor switch (flips this player's lasers)    A / B  laser: shut in phase A / phase B
//   t  thin ice: cracks once you've stood on it; stand on it again and you fall back to the door
//   g  ice gate: opens (for you) once every thin-ice tile between it and the next gate below is cracked
//   1–9  teleport pads: each digit appears exactly twice, and stepping on one whisks you to the other
//   %  chasm (a lift platform from `def.platforms` can float over it)   &  a lift console (see World.movePlatform)
//   D  (last row) the exit; a mat is laid across the tile above it
// Anything else is floor — use letters as notes for where the leader and trainers stand.
// Puzzle state is per player; see world/solo.js.
const GYM_THEMES = {
  // Cedarwood (Rock): teal stone walls, sand floor, plank walkways
  rock: {
    roof: [400, 401, 402, 405, 406], emblem: 403, wall: [[408, 409, 410, 413, 414], [408, 417, 418, 421, 414]],
    side: [408, 414], floor: 442, alt: 452, block: [389, 390], ice: 506, pool: [577, 585],
  },
  // Harbor (Water): pale blue walls, cream floor, blue tiled "ice" and a pool
  water: {
    roof: [472, 473, 474, 477, 478], emblem: 475, wall: [[480, 481, 482, 485, 486], [480, 489, 490, 493, 486]],
    side: [480, 486], floor: 530, alt: 506, block: [389, 390], ice: [506, 508, 515, 516], pool: [577, 585],
  },
  // Sunspire (Electric): white power-room walls, dark floor, lit yellow panels, laser emitters in the walls
  electric: {
    roof: [608, 609, 609, 609, 613], emblem: 610, wall: [[616, 617, 617, 617, 621], [624, 628, 628, 628, 629]],
    side: [640, 644], sideLaser: [648, 652], floor: 693, alt: 646, block: [623], ice: 506, pool: [577, 585],
  },
  // Frostfall (Ice): pale walls, blue tiled floor, thin ice that cracks under you, ice-block gates
  ice: {
    roof: [472, 473, 474, 477, 478], emblem: 475, wall: [[480, 481, 482, 485, 486], [480, 489, 490, 493, 486]],
    side: [480, 486], floor: 1078, alt: 530, block: [1102], ice: [506, 508, 515, 516], thin: [506, 508, 515, 516], pool: [577, 585],
  },
  // Coral Isle (Psychic): white power-room walls, blue striped floor, purple psychic tubes, teleport pads
  psychic: {
    roof: [608, 609, 609, 609, 613], emblem: 610, wall: [[616, 617, 617, 617, 621], [624, 628, 628, 628, 629]],
    side: [640, 644], floor: 810, alt: 685, block: [794, 786], ice: 506, pool: [577, 585],
  },
  // The Rocket Sea Fort: copper bulkheads, dark hazard-striped decks, black drops into the hold
  fort: {
    roof: [979, 979, 979, 979, 979], emblem: 979, wall: [[1000, 985, 986, 985, 1002], [1000, 993, 994, 993, 1002]],
    side: [1000, 1002], floor: 1097, alt: 965, block: [623, 669], ice: 506, pool: [577, 585],
  },
  // Skyreach (Dragon): power-room walls with laser emitters, the purple-striped floor, belts, switches and pads
  dragon: {
    roof: [608, 609, 609, 609, 613], emblem: 610, wall: [[616, 617, 617, 617, 621], [624, 628, 628, 628, 629]],
    side: [640, 644], sideLaser: [648, 652], floor: 1120, alt: 1030, block: [794, 786], ice: 506, pool: [577, 585],
  },
  // The wreck of the Aurora Star: copper-brown hull, plank decks, sand washed in (the second floor tile)
  wreck: {
    roof: [979, 979, 979, 979, 979], emblem: 979, wall: [[1000, 985, 986, 985, 1002], [1000, 993, 994, 993, 1002]],
    side: [1000, 1002], floor: 452, alt: 442, block: [389, 390], ice: 506, pool: [577, 585], inner: 993,
  },
  // The Verdant Temple: teal stone, sand floor, old statues
  temple: {
    roof: [400, 401, 402, 405, 406], emblem: 403, wall: [[408, 409, 410, 413, 414], [408, 417, 418, 421, 414]],
    side: [408, 414], floor: 442, alt: 1030, block: [389, 390], ice: 506, pool: [577, 585], inner: 417,
  },
  // Stonewatch (Ground): copper walls with lamps, grey machine floor, conveyor belts
  ground: {
    roof: [979, 979, 979, 979, 979], emblem: 979, wall: [[1000, 985, 986, 985, 1002], [1000, 993, 994, 993, 1002]],
    side: [1000, 1002], floor: 1030, alt: 1078, block: [389, 390], ice: [961, 962, 969, 970], pool: [577, 585],
  },
};
const ARROWS = { '^': [935, 1], 'v': [943, 2], '<': [919, 3], '>': [927, 4], '+': [951, 5] };

function buildGym(m, def, ch, w, h) {
  const th = GYM_THEMES[def.gym];
  const pick = (v, x, y) => Array.isArray(v) ? v[(x % 2) + (y % 2) * 2] || v[0] : v;
  const row5 = (r, x) => x === 0 ? r[0] : x === 1 ? r[1] : x === w - 2 ? r[3] : x === w - 1 ? r[4] : r[2];
  let force = null, laser = null, switches = null, thin = null, gateAt = null, chasm = null, hidden = null;
  const gateRows = [], pads = {};
  const block = (x, y) => { m.blocked[m.idx(x, y)] = 1; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = ch(x, y);
    const i = m.idx(x, y);
    // frame
    if (y === h - 1) { m.set(0, x, y, 384); if (c !== 'D') block(x, y); continue; }
    if (y === 0) { m.set(0, x, y, x === (w >> 1) ? th.emblem : row5(th.roof, x)); block(x, y); continue; }
    if (y <= 2) { m.set(0, x, y, row5(th.wall[y - 1], x)); block(x, y); continue; }
    if (x === 0 || x === w - 1) {
      const laserRow = th.sideLaser && /[AB]/.test(def.ascii[y] || '');
      m.set(0, x, y, laserRow ? th.sideLaser[x ? 1 : 0] : th.side[x ? 1 : 0]);
      block(x, y);
      continue;
    }
    // inside
    m.set(0, x, y, c === ',' ? th.alt : th.floor);
    switch (c) {
      case 'o': m.set(1, x, y, pick(th.block, x, y)); block(x, y); break;
      case 's': m.set(1, x, y, 393); m.set(2, x, y - 1, 385); block(x, y); break;
      case '~': m.set(0, x, y, ch(x, y - 1) === '~' ? th.pool[1] : th.pool[0]); block(x, y); break;   // rim, then water
      case 'i': m.set(0, x, y, pick(th.ice, x, y)); (force = force || new Uint8Array(w * h))[i] = 6; break;
      case '*': (switches = switches || new Uint8Array(w * h))[i] = 1; break;
      case 't': m.set(0, x, y, pick(th.thin, x, y)); (thin = thin || new Uint8Array(w * h))[i] = 1; break;
      case 'g': (gateAt = gateAt || new Uint8Array(w * h)); if (!gateRows.includes(y)) gateRows.push(y); break;
      case '%': m.set(0, x, y, 384); (chasm = chasm || new Uint8Array(w * h))[i] = 1; break;   // passage 15: only a lift crosses
      case '&': m.set(0, x, y, th.alt); break;
      case '#': m.set(0, x, y, th.inner || th.side[0]); block(x, y); break;
      case 'h': block(x, y); (hidden = hidden || new Uint8Array(w * h))[i] = 1; break;   // an invisible wall (World.revealWalls)   // an inner wall (bulkheads, temple walls)
      case '=': m.set(1, x, y, ch(x, y - 1) === '=' ? 467 : 459); break;   // grey stairs (a warp sits on them)
      case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
        m.set(1, x, y, 791); (pads[c] = pads[c] || []).push(i); break;
      case 'A': case 'B': (laser = laser || new Uint8Array(w * h))[i] = c === 'A' ? 1 : 2; break;
      default:
        if (ARROWS[c]) { m.set(0, x, y, ARROWS[c][0]); (force = force || new Uint8Array(w * h))[i] = ARROWS[c][1]; }
    }
  }
  // the exit: a mat on the last floor row, the warp on the row below it
  for (let x = 0; x < w; x++) {
    if (ch(x, h - 1) !== 'D') continue;
    for (let d = -1; d <= 1; d++) { m.set(1, x + d, h - 2, 387 + d); m.set(1, x + d, h - 1, 395 + d); }
    m.warps.push({ x, y: h - 1, to: '@return', sfx: 'Door exit' });
  }
  // each ice gate row guards the thin ice between it and the next gate row below (nearer the door)
  const gates = gateRows.sort((a, b) => a - b).map((row, k, rows) => {
    const below = rows[k + 1] ?? h;
    const need = [];
    for (let y = row + 1; y < below; y++) for (let x = 0; x < w; x++) if (thin && thin[m.idx(x, y)]) need.push(m.idx(x, y));
    for (let x = 0; x < w; x++) if (ch(x, row) === 'g') gateAt[m.idx(x, row)] = k + 1;
    return { row, need };
  });
  m.force = force; m.laser = laser; m.switches = switches; m.thin = thin; m.gateAt = gateAt; m.gates = gates;
  m.chasm = chasm;
  m.hidden = hidden;
  if (Object.keys(pads).length) {
    m.pads = new Int32Array(w * h).fill(-1);
    for (const [k, [a, b, ...extra]] of Object.entries(pads)) {
      if (b === undefined || extra.length) throw new Error(`${def.id}: teleport pad ${k} must appear exactly twice`);
      m.pads[a] = b; m.pads[b] = a;
    }
  }
}
