// The race simulator (DESIGN.md "Simulation"). Pure and deterministic, with no randomness anywhere: the same
// stats always give the same race. Used by the stadium, tools/gen-races.mjs and tools/check-races.mjs, so
// changing a number here means regenerating the ladder (node tools/gen-races.mjs && node tools/check-races.mjs).
//
// A course: { terrain, segments: [ { kind: 'run', len } | { kind: 'barrier', hardness } | { kind: 'trap', len, power } ] }
// Lengths are metres; times are seconds; stats are { speed, strength, defense }.
import { DEFAULTS } from '../data/defaults.js';
import { statGain } from './gain.js';

export const RACE = {
  base: 2,          // running speed (m/s) = base × Speed ^ speedExp: doubling Speed is always the same edge
  speedExp: 0.3,    // (+ k × Speed let Speed swamp everything once the numbers got big)
  smashS: 0.5,      // a barrier you're strong enough for: one quick smash
  headbuttS: 1.3,   // one you aren't: headbutt it until it breaks, this long a headbutt…
  maxHeadbutts: 6,   // …as many as hardness ÷ Strength (at least 2, at most this); you can count them
  trapS: 2.0,       // a trap zone slows you by up to this much more: × (1 + trapS × max(0, 1 − Defense / power))
};

export const speedOf = st => RACE.base * Math.pow(Math.max(1, st.speed), RACE.speedExp);

/** How many hits a barrier takes: 1 (a smash) if you're strong enough, else a headbutt per `strength` of hardness. */
export const headbutts = (hardness, strength) =>
  strength >= hardness ? 1 : Math.min(RACE.maxHeadbutts, Math.max(2, Math.ceil(hardness / Math.max(1, strength))));

/**
 * One racer's race: the total time, a timeline for playback, and where the time went (for the "what to train"
 * hint): run = plain running, barrier = time at barriers, trap = the extra time traps cost.
 */
export function simulate(course, st) {
  const v = speedOf(st), m = course.terrain || 1;
  let t = 0, x = 0;
  const timeline = [], lost = { run: 0, barrier: 0, trap: 0 };
  for (const s of course.segments) {
    if (s.kind === 'run') {
      const dt = s.len * m / v;
      timeline.push({ kind: 'run', t0: t, t1: t + dt, x0: x, x1: x + s.len });
      lost.run += dt; t += dt; x += s.len;
    } else if (s.kind === 'barrier') {
      const hits = headbutts(s.hardness, st.strength), dt = hits === 1 ? RACE.smashS : hits * RACE.headbuttS;
      timeline.push({ kind: hits === 1 ? 'smash' : 'headbutt', hits, t0: t, t1: t + dt, x0: x, x1: x });
      lost.barrier += dt; t += dt;
    } else if (s.kind === 'trap') {
      const plain = s.len * m / v, slow = RACE.trapS * Math.max(0, 1 - st.defense / s.power);
      const dt = plain * (1 + slow);
      timeline.push({ kind: 'trap', t0: t, t1: t + dt, x0: x, x1: x + s.len, slow });
      lost.run += plain; lost.trap += dt - plain; t += dt; x += s.len;
    }
  }
  return { time: t, length: x, timeline, lost };
}

/** Where a racer is at time t (metres), and what it's doing. */
export function positionAt(sim, t) {
  for (const seg of sim.timeline) {
    if (t < seg.t1) {
      const f = Math.max(0, (t - seg.t0) / (seg.t1 - seg.t0));
      return { x: seg.x0 + (seg.x1 - seg.x0) * f, seg, f };
    }
  }
  return { x: sim.length, seg: null, f: 1, done: true };
}

/** The whole race: you and the opponents; places by time (a dead heat goes to you). */
export function runRace(course, you, opponents) {
  const racers = [{ you: true, stats: you }, ...opponents.map(o => ({ you: false, species: o.species, stats: o.stats }))]
    .map(r => ({ ...r, sim: simulate(course, r.stats) }));
  const order = [...racers].sort((a, b) => a.sim.time - b.sim.time || (b.you ? 1 : 0) - (a.you ? 1 : 0));
  order.forEach((r, i) => { r.place = i + 1; });
  return { racers, order, won: order[0].you };
}

/**
 * Why you lost, as one of 'run' (🏃, Speed), 'barrier' (🧱, Strength), 'trap' (🛡️, Defense): where you lost the
 * most time against the winner.
 */
export function lossHint(race) {
  const you = race.racers.find(r => r.you), win = race.order[0];
  if (win === you) return null;
  const d = k => you.sim.lost[k] - win.sim.lost[k];
  return ['run', 'barrier', 'trap'].sort((a, b) => d(b) - d(a))[0];
}

// ------------------------------------------------------------------ the ladder's yardstick (generator + checker)
/**
 * The yardstick is training *sessions*, not races: a race at place `n` on the ladder (the races a child usually
 * has won before it; see tools/gen-races.mjs) expects firstSessions + sessionsPerRace × n sessions, each with
 * rightPerSession right answers, spread evenly over the three stats and earned exactly as the game earns them
 * (game/gain.js, with the default settings). Winning is meant to take practice: about one session of each kind
 * per race.
 */
export const LADDER = { firstSessions: 2, sessionsPerRace: 3, rightPerSession: 16 };

const STAT_KEYS = ['speed', 'strength', 'defense'];
const budgets = [];
/** The total stats a child could have reached by the race at place `n` on the ladder. */
export function budgetFor(n) {
  if (budgets[n] !== undefined) return budgets[n];
  const s = { speed: 0, strength: 0, defense: 0 }, third = DEFAULTS.startStatTotal / 3;
  for (const k of STAT_KEYS) s[k] = third;
  const sessions = LADDER.firstSessions + LADDER.sessionsPerRace * n;
  for (let i = 0; i < sessions; i++) {
    const k = STAT_KEYS.reduce((a, b) => (s[b] < s[a] ? b : a));          // the lowest stat gets the next session
    s[k] += statGain(LADDER.rightPerSession, 1, s[k], DEFAULTS);
  }
  return (budgets[n] = Math.round(s.speed + s.strength + s.defense));
}

/** The builds a child might have at a budget: balanced, fast, strong, tough. */
export function buildsFor(budget) {
  const b = (s, st, d) => ({ speed: Math.round(budget * s), strength: Math.round(budget * st), defense: Math.round(budget * d) });
  return { balanced: b(1 / 3, 1 / 3, 1 / 3), fast: b(0.5, 0.25, 0.25), strong: b(0.25, 0.5, 0.25), tough: b(0.25, 0.25, 0.5) };
}

/** Which of those builds win this race at this budget. */
export function winningBuilds(course, opponents, budget) {
  return Object.entries(buildsFor(budget)).filter(([, st]) => runRace(course, st, opponents).won).map(([k]) => k);
}

/** A child's opponent-strength setting scales the opponents and the course (barriers, traps) together. */
export function scaledRace(race, strength = 1) {
  if (strength === 1) return race;
  const st = s => ({ speed: s.speed * strength, strength: s.strength * strength, defense: s.defense * strength });
  return {
    ...race,
    opponents: race.opponents.map(o => ({ ...o, stats: st(o.stats) })),
    course: { ...race.course, segments: race.course.segments.map(s =>
      s.kind === 'barrier' ? { ...s, hardness: s.hardness * strength } : s.kind === 'trap' ? { ...s, power: s.power * strength } : s) },
  };
}
