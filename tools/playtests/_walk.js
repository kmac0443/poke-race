// Walking helpers for farm playtests (not a playtest itself): pathfind with the farm's own rules, then drive a
// player along the path with real key presses, holding each straight run until its last cell is reached.
// Adapted from reference/playtests/walk.js.
const KEYS = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'KeyQ', b: 'KeyE', start: 'Tab' },
  { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', a: 'Numpad7', b: 'Numpad9', start: 'NumpadEnter' },
];

/** Shortest walk on the farm from `from` to `to`. Returns [[dir, x, y], …] or null. */
function path(t, from, to) {
  return t.eval((from, to) => {
    const hub = window.game.hub, map = hub.map;
    const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const key = (x, y) => y * map.w + x;
    const prev = new Map([[key(...from), null]]);
    let q = [from];
    while (q.length) {
      const next = [];
      for (const [x, y] of q) for (const [dir, [dx, dy]] of Object.entries(D)) {
        const nx = x + dx, ny = y + dy;
        if (!map.inside(nx, ny) || hub.placeAt(nx, ny) || !map.canMove(x, y, dir) || hub.monAt(nx, ny) || prev.has(key(nx, ny))) continue;
        prev.set(key(nx, ny), [x, y, dir]);
        next.push([nx, ny]);
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
  }, from, to);
}

const at = (t, i = 0) => t.eval(i => { const w = window.game.hub.walkers[i]; return w ? [w.char.x, w.char.y] : null; }, i);

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
      await t.wait(20);
    }
    await t.page.keyboard.up(KEY[dir]);
    await t.wait(250);
    s += n;
    if (!ok) { console.log(`  P${i + 1} stuck going ${dir} at ${await at(t, i)}, wanted ${ex},${ey}`); return false; }
  }
  return true;
}

/** Walk player i to (x, y), re-planning if a wandering Pokémon gets in the way. */
async function walkTo(t, i, x, y) {
  for (let tries = 0; tries < 4; tries++) {
    const steps = await path(t, await at(t, i), [x, y]);
    if (!steps) { console.log(`  no path for P${i + 1} to ${x},${y}`); await t.wait(500); continue; }
    if (await follow(t, steps, i)) return true;
  }
  return false;
}

/** Press a direction briefly (turn / bump into something). */
async function tap(t, i, dir, ms = 120) { await t.hold(KEYS[i][dir], ms); }

module.exports = { KEYS, path, follow, at, walkTo, tap };
