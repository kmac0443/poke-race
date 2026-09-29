// Shared walking helpers for playtests: pathfind with the overworld's own rules, then drive a player along
// the path with real key presses (holding each straight run until the run's last cell is reached — holding
// "until the player stops moving" overshoots corners).
const KEYS = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
  { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL' },
  { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6' },
];

/**
 * Shortest walk from `from` to `to` on a map: ledges only hop downward, NPCs are solid.
 * `safeIce: true` also refuses thin-ice tiles that would give way (the `k` tiles of a thinIce field).
 * Returns [[dir, x, y], …] (step direction and the cell you land on) or null.
 */
function path(t, mapId, from, to, opts = {}) {
  return t.eval((mapId, from, to, opts) => {
    const g = window.game, map = g.world.getMap(mapId);
    const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const key = (x, y) => y * map.w + x;
    // unclaimed item balls block you in the game, so they block the path too
    const p0 = g.players[0];
    const items = new Set(map.signs.filter(e => e.type === 'item' && !p0.flags[`item:${map.id}:${e.x},${e.y}`]).map(e => key(e.x, e.y)));
    const prev = new Map([[key(...from), null]]);
    let q = [from];
    while (q.length) {
      const next = [];
      for (const [x, y] of q) {
        for (const [dir, [dx, dy]] of Object.entries(D)) {
          let nx = x + dx, ny = y + dy;
          if (!map.inside(nx, ny)) continue;
          if (map.ledges[map.idx(nx, ny)]) {           // ledges: only hopped downward, landing two tiles on
            if (dir !== 'down' || !map.inside(nx, ny + 1)) continue;
            ny += 1;
          } else if (!map.canMove(x, y, dir) || g.world.npcAt(map, nx, ny) || items.has(key(nx, ny))) continue;
          if (opts.safeIce && map.fieldIce && map.fieldIce[map.idx(nx, ny)] === 1) continue;
          // flame jets: cross a jet row straight over, never walk along one
          if (opts.crossJets && map.jets && map.jets[map.idx(x, y)] && map.jets[map.idx(nx, ny)]) continue;
          if (prev.has(key(nx, ny))) continue;
          prev.set(key(nx, ny), [x, y, dir]);
          next.push([nx, ny]);
        }
      }
      q = next;
    }
    if (!prev.has(key(...to))) return null;
    const out = [];
    for (let c = to; ;) {
      const p = prev.get(key(...c));
      if (!p) break;
      out.unshift([p[2], c[0], c[1]]);
      c = [p[0], p[1]];
    }
    return out;
  }, mapId, from, to, opts);
}

const at = (t, i = 0) => t.eval(i => { const p = window.game.players[i], c = p.char; return [c.x, c.y, p.mapId]; }, i);

/** Walks player `i` along `steps`. Returns true if every run ended where it should. */
async function follow(t, steps, i = 0) {
  const KEY = KEYS[i];
  for (let s = 0; s < steps.length;) {
    let n = 1;
    while (s + n < steps.length && steps[s + n][0] === steps[s][0]) n++;
    const dir = steps[s][0], [, ex, ey] = steps[s + n - 1];
    await t.page.keyboard.down(KEY[dir]);
    let ok = false, still = 0, last = await at(t, i);
    for (let f = 0; f < n * 10 + 40; f++) {
      const now = await at(t, i);
      if (now[0] === ex && now[1] === ey) { ok = true; break; }
      if (now[0] === last[0] && now[1] === last[1]) { if (++still > 20) break; } else { still = 0; last = now; }
      await t.wait(30);
    }
    await t.page.keyboard.up(KEY[dir]);
    await t.wait(320);
    s += n;
    if (!ok) { console.log(`  P${i + 1} stuck going ${dir} at ${await at(t, i)}, wanted ${ex},${ey}`); return false; }
  }
  return true;
}

/** Walkable cells along one edge of a map (where the gates are). */
function gates(t, mapId, edge) {
  return t.eval((mapId, edge) => {
    const map = window.game.world.getMap(mapId);
    const out = [];
    if (edge === 'up' || edge === 'down') {
      const y = edge === 'up' ? 0 : map.h - 1;
      for (let x = 0; x < map.w; x++) if (map.tilePassable(x, y, 0) && !map.blocked[map.idx(x, y)]) out.push([x, y]);
    } else {
      const x = edge === 'left' ? 0 : map.w - 1;
      for (let y = 0; y < map.h; y++) if (map.tilePassable(x, y, 0) && !map.blocked[map.idx(x, y)]) out.push([x, y]);
    }
    return out;
  }, mapId, edge);
}

/** Put player `i` somewhere without walking there. */
const place = (t, i, mapId, x, y, dir = 'down') =>
  t.eval((i, id, x, y, d) => window.game.placePlayer(window.game.players[i], id, x, y, d), i, mapId, x, y, dir);

/** Silence the world for a walk: no wild Pokémon, no trainers (dev mode), no HM obstacles or wandering critters in the way. */
async function quiet(t) {
  await t.eval(async () => {
    const { MAPS } = await import('/src/maps/index.js');
    window.game.dev = true;
    for (const def of Object.values(MAPS)) for (const ev of def.events || []) if (ev.obstacle) ev.showIf = () => false;
    // Pokémon out and about wander into a path worked out in advance; they're scenery, so they go too
    for (const def of Object.values(MAPS)) for (const ev of def.events || []) if (ev.critter && ev.move === 'wander') ev.showIf = () => false;
  });
}

module.exports = { KEYS, path, follow, at, gates, place, quiet };
