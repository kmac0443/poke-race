// Builds the race ladder into src/data/races.js (DESIGN.md "Lots of opponents, always changing").
//   node tools/gen-races.mjs && node tools/check-races.mjs
// 8 venues × 4 ranks × 3 races. Deterministic (a fixed seed), so rerunning gives the same ladder.
//
// Each race needs `n` races won before it: all of the ranks below, plus the earlier races at its venue. The stat
// budget a child could have by then is budgetFor(n) (src/game/race.js). Opponents come from every species with a
// front sprite and a run sheet outside the children's own lines, tiered along the ladder (little first stages
// early, middle stages, then fully evolved, and legendaries at the very end), never the same species twice. Their
// stats are their real base stats (Speed ← spe, Strength ← atk, Defense ← def) scaled to the hardest level at which
// at least two of the four builds (balanced, fast, strong, tough) still win at that budget: so training decides it.
import fs from 'fs';
import { VENUES, RANKS, RACES_PER_VENUE } from '../src/data/venues.js';
import { species, roster } from './race-pool.mjs';
import { budgetFor, speedOf, winningBuilds } from '../src/game/race.js';

const mine = roster();

const pre = new Map();
for (const s of species) for (const e of s.evolutions) if (!pre.has(e.into)) pre.set(e.into, s.id);
const stage = id => (pre.has(id) ? (pre.has(pre.get(id)) ? 2 : 1) : 0);
const bst = s => Object.values(s.baseStats).reduce((a, b) => a + b, 0);
const isFinal = s => !s.evolutions.length;
const legendary = s => stage(s.id) === 0 && isFinal(s) && bst(s) >= 570;

const pool = species.filter(s => s.sprites.front && s.sprites.run && !mine.has(s.id));

/** Species that suit a point on the ladder (f from 0 to 1). */
function tier(f) {
  if (f < 0.2) return pool.filter(s => stage(s.id) === 0 && !isFinal(s) && bst(s) < 330);
  if (f < 0.45) return pool.filter(s => (stage(s.id) === 0 && !legendary(s) && bst(s) < 420) || (stage(s.id) === 1 && bst(s) < 400));
  if (f < 0.7) return pool.filter(s => !legendary(s) && ((stage(s.id) === 1 && !isFinal(s)) || (isFinal(s) && bst(s) >= 400 && bst(s) < 500)));
  if (f < 0.92) return pool.filter(s => !legendary(s) && isFinal(s) && stage(s.id) >= 1 && bst(s) >= 450);
  return pool.filter(s => legendary(s) || bst(s) >= 580);
}

// ------------------------------------------------------------------ a seeded random, so the ladder is stable
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rand = mulberry32(20260925);
const between = (a, b) => a + (b - a) * rand();
const round1 = v => Math.round(v * 10) / 10;

// ------------------------------------------------------------------ one race
/**
 * A course's shape, drawn once per race: the order of runs, barriers and trap zones, how long the runs are, and how
 * hard / strong each obstacle is *relative to the opponents* (so about half of them smash a barrier at a normal
 * venue; the mountain's stop most, the meadow's few). Sizes come later, in materialize().
 */
function shape(venue, rank, race) {
  const n = 4 + rank + (race - 1);                    // 5 obstacles in a venue's first race … 10 in rank 4's third
  const nb = Math.round(n * venue.mix), nt = n - nb;
  const obstacles = [
    ...Array.from({ length: nb }, () => ({ kind: 'barrier', f: venue.hard * between(0.9, 1.1) })),
    ...Array.from({ length: nt }, () => ({ kind: 'trap', f: venue.power * between(0.9, 1.1) })),
  ];
  for (let i = obstacles.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [obstacles[i], obstacles[j]] = [obstacles[j], obstacles[i]]; }
  return { venue, obstacles, weights: Array.from({ length: obstacles.length + 1 }, () => between(0.7, 1.3)) };
}

const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

/** The course itself, for these opponents: about 26 s of plain running for a balanced racer; obstacles add the rest.
 *  `tough` makes every barrier harder and every trap stronger. */
function materialize(sh, budget, opponents, tough = 1) {
  const v = sh.venue, third = budget / 3;
  const total = 26 * speedOf({ speed: third }) / v.terrain;
  const nt = sh.obstacles.filter(o => o.kind === 'trap').length;
  const trapLen = total * Math.min(0.12, 0.5 / Math.max(1, nt)), runTotal = total - trapLen * nt;
  const str = median(opponents.map(o => o.stats.strength)), def = median(opponents.map(o => o.stats.defense));
  const wsum = sh.weights.reduce((a, b) => a + b, 0);
  const segments = [];
  sh.weights.forEach((w, i) => {
    segments.push({ kind: 'run', len: round1(runTotal * w / wsum) });
    const o = sh.obstacles[i];
    if (o && o.kind === 'barrier') segments.push({ kind: 'barrier', hardness: round1(str * o.f * tough) });
    if (o && o.kind === 'trap') segments.push({ kind: 'trap', len: round1(trapLen), power: round1(def * o.f * tough) });
  });
  return { terrain: v.terrain, segments };
}

const scaled = (s, sc) => ({
  speed: Math.max(1, Math.round(s.baseStats.spe * sc)),
  strength: Math.max(1, Math.round(s.baseStats.atk * sc)),
  defense: Math.max(1, Math.round(s.baseStats.def * sc)),
});

const used = new Set();
const maxN = RANKS * VENUES.length * RACES_PER_VENUE - 1;
const races = [];
let k = 0;
for (let rank = 1; rank <= RANKS; rank++) {
  for (const venue of VENUES) {
    for (let i = 1; i <= RACES_PER_VENUE; i++, k++) {
      // its place on the ladder: the ranks below, then a rank's first races venue by venue (meadow easiest,
      // volcano hardest), then its second races, and so on. All 8 are open at once, so a child can try them in any
      // order; a later one just needs more training first.
      const vi = VENUES.indexOf(venue);
      const n = (rank - 1) * VENUES.length * RACES_PER_VENUE + (i - 1) * VENUES.length + vi;
      const budget = budgetFor(n);
      const f = (n + 0.5) / (maxN + 1);
      // three opponents nobody has raced yet, from this point's tier (widening if it runs dry)
      const picks = [];
      for (let widen = 0; picks.length < 3 && widen < 5; widen++) {
        const cand = tier(Math.min(0.999, Math.max(0, f + (widen % 2 ? 1 : -1) * Math.ceil(widen / 2) * 0.1))).filter(s => !used.has(s.id) && !picks.includes(s));
        while (picks.length < 3 && cand.length) picks.push(cand.splice(Math.floor(rand() * cand.length), 1)[0]);
      }
      if (picks.length < 3) throw new Error(`ran out of opponents at race ${k}`);
      picks.forEach(s => used.add(s.id));
      const sh = shape(venue, rank, i);
      // The hardest opponents (and their course) at which at least two builds still win at this budget. Then, so
      // that training always matters, tougher obstacles until no build wins with 15% less (if that's possible).
      const meanBase = picks.reduce((a, s) => a + s.baseStats.spe + s.baseStats.atk + s.baseStats.def, 0) / 3;
      const hardest = tough => {
        let sc = 1.6 * budget / meanBase;
        for (let tries = 0; tries < 300; tries++, sc *= 0.98) {
          const opponents = picks.map(s => ({ species: s.id, stats: scaled(s, sc) }));
          const c = materialize(sh, budget, opponents, tough);
          const wins = winningBuilds(c, opponents, budget);
          if (wins.length >= 2) return { opponents, c, wins, easy: winningBuilds(c, opponents, Math.floor(budget * 0.85)).length > 0 };
        }
        return null;
      };
      let best = hardest(1);
      for (let tough = 1.1; best.easy && tough <= 1.81; tough += 0.1) {
        const t = hardest(tough);
        if (t && !t.easy) { best = t; break; }
      }
      const { opponents, c, wins } = best;
      races.push({ id: `${venue.id}-${rank}-${i}`, venue: venue.id, rank, race: i, n, course: c, opponents, _wins: wins });
    }
  }
}

const lines = races.map(({ _wins, ...r }) => '  ' + JSON.stringify(r) + ',');
fs.writeFileSync(new URL('../src/data/races.js', import.meta.url),
  `// GENERATED by tools/gen-races.mjs: don't edit by hand; change the generator and rerun it (then tools/check-races.mjs).
// ${races.length} races: ${VENUES.length} venues × ${RANKS} ranks × ${RACES_PER_VENUE}. n = races that must be won before this one.
export const RACES = [
${lines.join('\n')}
];
`);
const tally = {}, byVenue = {};
for (const r of races) for (const w of r._wins) {
  tally[w] = (tally[w] || 0) + 1;
  (byVenue[r.venue] = byVenue[r.venue] || {})[w] = (byVenue[r.venue][w] || 0) + 1;
}
console.log(`wrote src/data/races.js: ${races.length} races, ${used.size} opponent species (pool ${pool.length}); max n ${maxN}`);
console.log('winning builds across the ladder:', tally);
for (const [v, t] of Object.entries(byVenue)) console.log('  ' + v.padEnd(9), JSON.stringify(t));
