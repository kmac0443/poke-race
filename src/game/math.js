// The math engine (DESIGN.md "Math engine"). Every game gets its problems here, per child; nothing hard-codes a
// problem. Facts per level; mastery (accuracy first) and the level a child is on; choosing the next problem like
// flash cards (spaced repetition, below); plausible wrong answers; and the per-problem table everything else is
// worked out from. Learning depends only on how the child answers, never on their Pokémon's stats.
import { LEVELS } from '../data/defaults.js';

const SYMBOL = { '+': '+', '-': '−', '×': '×', '÷': '÷' };

/** A fact: { key: '2+3', a, b, op, answer }. The key is exactly as shown, so 2+3 and 3+2 are separate. */
function fact(a, op, b) {
  const answer = op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : a / b;
  return { key: `${a}${op}${b}`, a, b, op, answer };
}

const cache = new Map();
/** Every fact in level n (1-based), without facts an earlier level already has. */
export function factsForLevel(n) {
  if (cache.has(n)) return cache.get(n);
  const earlier = new Set();
  for (let k = 1; k < n; k++) for (const f of factsForLevel(k)) earlier.add(f.key);
  const L = LEVELS[n - 1], out = [];
  const add = f => { if (!earlier.has(f.key) && !out.some(o => o.key === f.key)) out.push(f); };
  if (L.op === '+' || L.op === '-') {
    for (let a = 1; a <= 12; a++) for (let b = 1; b <= 12; b++) {
      const s = a + b;
      if (s < L.sumMin || s > L.sumMax) continue;
      add(L.op === '+' ? fact(a, '+', b) : fact(s, '-', b));
    }
  } else {
    for (const t of L.tables) for (let k = 1; k <= 12; k++) {
      if (L.op === '×') { add(fact(t, '×', k)); add(fact(k, '×', t)); }
      else { add(fact(t * k, '÷', t)); add(fact(t * k, '÷', k)); }
    }
  }
  cache.set(n, out);
  return out;
}

let byKey = null;
/** Any fact by its key, with the level it belongs to: { f, level } or null. */
function lookup(key) {
  if (!byKey) {
    byKey = new Map();
    for (let n = 1; n <= LEVELS.length; n++) for (const f of factsForLevel(n)) byKey.set(f.key, { f, level: n });
  }
  return byKey.get(key) || null;
}

// ------------------------------------------------------------------ mastery (accuracy first)
/** A fact is solid when it's been answered minSeen times and its last `lastRight` answers were all right. */
function solid(r, m) {
  if (!r || r.seen < m.minSeen || r.last.slice(0, m.lastRight) !== '✓'.repeat(m.lastRight)) return false;
  return !m.maxMs || (r.avgMs !== null && r.avgMs <= m.maxMs);
}

/**
 * How a child stands on level n: `solid` = share of its facts that are solid; `mastered` = every fact solid and
 * the level ≥ levelAccuracy right over roughly its last levelWindow answers (each fact's last few).
 */
export function levelStatus(profile, settings, n) {
  const m = settings.mastery, facts = factsForLevel(n), table = profile.math.problems;
  const perFact = Math.max(1, Math.min(10, Math.ceil(m.levelWindow / facts.length)));
  let solidN = 0, rightN = 0, totalN = 0;
  for (const f of facts) {
    const r = table[f.key];
    if (solid(r, m)) solidN++;
    if (r) { const recent = r.last.slice(0, perFact); totalN += recent.length; rightN += recent.split('✓').length - 1; }
  }
  const accuracy = totalN ? rightN / totalN : 0;
  return { solid: solidN / facts.length, accuracy, mastered: solidN === facts.length && accuracy >= m.levelAccuracy };
}

/** The first level the child hasn't mastered. */
export function masteryLevel(profile, settings) {
  for (let n = 1; n <= LEVELS.length; n++) if (!levelStatus(profile, settings, n).mastered) return n;
  return LEVELS.length;
}

const floorOf = settings => Math.max(1, settings.mathFloor);
const topOf = settings => Math.max(floorOf(settings), settings.mathCeiling || LEVELS.length);

/** level = clamp(mastery level, admin floor, admin ceiling). Only answers move it, never stats. */
export function currentLevel(profile, settings) {
  return Math.max(floorOf(settings), Math.min(topOf(settings), masteryLevel(profile, settings)));
}

export const problemText = f => `${f.a} ${SYMBOL[f.op]} ${f.b}`;

// ------------------------------------------------------------------ choosing the next problem: flash cards
// Every fact the child has met sits in a box (0 = just missed … up to the last of settings.srs.steps). A right
// answer moves it up a box, a miss drops it to box 0. A fact is due again once `steps[box]` more problems have been
// answered (or, from the boxes with a `days` entry, that many days have passed), so a fact that's going well comes
// back less and less often but never stops coming back. A miss also puts the fact back in the line-up
// `missGap` problems later.
//
// The line-up: the next `lookahead` problems are worked out ahead and kept in the save (profile.math.queue). After
// each problem one more is added to the end, chosen from how the child is doing right now:
//   1. a fact just missed (box 0) that's due;
//   2. a new fact, if only a few are still being learned (fewer than maxLearning below box `solidBox`), the
//      child's last answers are mostly right (≥ introduceAccuracy), and none came in in the last newEvery problems:
//      the next unseen fact of their level, smallest first; once every fact of the level is out and most are solid (nextLevelWhenSolid), the next level's, which
//      is often a new kind of problem;
//   3. the most overdue of the rest; if nothing is due, the one closest to due (a quick review).
// A struggling child meets no new facts until the ones they're learning settle: new ones already planned are taken
// back out of the line-up (and Ease swaps in known facts).

const size = f => f.a + f.b;            // how big a fact's numbers are: 1+1 is 2, 7×6 is 13, 84÷12 is 96

/** A fact's box: stored, or for a record from before boxes existed, its run of right answers. */
function boxOf(r) {
  if (!r) return -1;
  if (r.box !== undefined) return r.box;
  let n = 0;
  for (const c of r.last) { if (c !== '✓') break; n++; }
  return n;
}

/** Are the child's last answers (up to 10) mostly right? New facts only come in while they are. */
function doingWell(profile, srs) {
  const recent = (profile.math.recent || '').slice(0, 10);
  return recent.length < 4 || (recent.split('✓').length - 1) / recent.length >= srs.introduceAccuracy;
}

/** How due a fact is at problem number `step`: ≥ 1 = due (by problems answered since, or by days). */
/** Misses in a row (the start of `last`): a fact that keeps being missed backs off, up to 4× its gap. */
const missRun = r => { let n = 0; for (const c of r.last || '') { if (c !== '✗') break; n++; } return Math.min(4, Math.max(1, n)); };

function dueness(r, step, srs) {
  const box = Math.min(Math.max(0, r.box), srs.steps.length - 1);
  const byStep = (step - (r.lastStep || 0)) / (srs.steps[box] * (box === 0 ? missRun(r) : 1));
  const days = srs.days[Math.min(box, srs.days.length - 1)] || 0;
  const byDay = days && r.lastSeen ? (Date.now() - r.lastSeen) / (days * 86400000) : 0;
  return Math.max(byStep, byDay);
}

/** The levels a child may be asked now: floor … their level, plus the next once theirs is all out and solid. */
function reach(profile, settings) {
  const lv = currentLevel(profile, settings), table = profile.math.problems;
  let hi = lv;
  const allOut = factsForLevel(lv).every(f => table[f.key]);
  if (lv < topOf(settings) && allOut && levelStatus(profile, settings, lv).solid >= settings.nextLevelWhenSolid) hi = lv + 1;
  return { lo: floorOf(settings), hi };
}

/**
 * The fact to put at the end of the line-up. `plan`: what the line-up already holds, as if each were answered
 * right when its turn comes (key → { box, lastStep }); `step`: the problem number the new one will be; `avoid`: the
 * one just before it (never twice in a row).
 */
function pickNext(profile, settings, plan, step, avoid) {
  const srs = settings.srs, table = profile.math.problems;
  const { lo, hi } = reach(profile, settings);
  const state = k => plan.get(k) || (table[k] && { box: boxOf(table[k]), lastStep: table[k].lastStep || 0, lastSeen: table[k].lastSeen, last: table[k].last });
  const met = [], fresh = [];
  for (let n = lo; n <= hi; n++) {
    const unseen = [];
    for (const f of factsForLevel(n)) {
      if (f.key === avoid) continue;
      if (state(f.key)) met.push(f); else unseen.push(f);
    }
    fresh.push(...unseen.sort((a, b) => size(a) - size(b)));
  }
  let learning = 0;
  for (const k of new Set([...Object.keys(table), ...plan.keys()])) {
    const l = lookup(k);
    if (l && l.level >= lo && state(k).box < srs.solidBox) learning++;
  }
  // the last time a new fact came in (answered, or planned in the line-up): at most one every newEvery problems
  let lastNew = -Infinity;
  for (const r of Object.values(table)) if (r.firstStep !== undefined) lastNew = Math.max(lastNew, r.firstStep);
  for (const [k, pl] of plan) if (!table[k]) lastNew = Math.max(lastNew, pl.firstStep);
  const newOk = learning < srs.maxLearning && doingWell(profile, srs) && step - lastNew >= srs.newEvery;

  const scored = met.map(f => ({ f, st: state(f.key) })).map(x => ({ ...x, d: dueness(x.st, step, srs) }))
    .sort((a, b) => b.d - a.d || a.st.box - b.st.box);
  const missed = scored.find(x => x.st.box === 0 && x.d >= 1);
  if (missed) return missed.f;
  if (fresh.length && (!met.length || newOk)) return fresh[0];
  if (scored.length) return scored[0].f;
  return fresh[0] || null;
}

/** The saved line-up, without anything the floor / ceiling now rule out, topped up to `n` facts. */
function lineUp(profile, settings, n, last) {
  const math = profile.math, table = math.problems, lo = floorOf(settings), hi = topOf(settings);
  math.queue = (math.queue || []).filter(k => { const l = lookup(k); return l && l.level >= lo && l.level <= hi; });
  const step0 = math.step || 0, plan = new Map();
  const assume = (k, i) => {
    const cur = plan.get(k) || (table[k] ? { box: boxOf(table[k]) } : { box: -1, firstStep: step0 + i + 1 });
    plan.set(k, { box: cur.box + 1, lastStep: step0 + i + 1, firstStep: cur.firstStep });
  };
  math.queue.forEach(assume);
  while (math.queue.length < n) {
    const avoid = math.queue.length ? math.queue[math.queue.length - 1] : last && last.key;
    const f = pickNext(profile, settings, plan, step0 + math.queue.length + 1, avoid);
    if (!f) break;
    math.queue.push(f.key);
    assume(f.key, math.queue.length - 1);
  }
  return math.queue;
}

/**
 * The next problem for a child: the front of their line-up (see above). Never the same fact twice in a row.
 * `opts.easy`: the child is struggling right now (Ease), so a fact they know instead; the line-up waits.
 */
export function nextProblem(profile, settings, last = null, opts = {}) {
  if (opts.easy) return easyProblem(profile, settings, last);
  const q = lineUp(profile, settings, settings.srs.lookahead, last);
  let i = q.findIndex(k => !last || k !== last.key);
  if (i < 0) i = 0;
  const key = q.splice(i, 1)[0];
  lineUp(profile, settings, settings.srs.lookahead, { key });
  return key ? lookup(key).f : factsForLevel(currentLevel(profile, settings))[0];
}

/** The next few problems in a child's line-up (for the admin page and the tests). Doesn't change anything. */
export function upcoming(profile, settings) {
  const copy = { ...profile, math: { ...profile.math, queue: [...(profile.math.queue || [])] } };
  return lineUp(copy, settings, settings.srs.lookahead, null).map(k => lookup(k).f);
}

/**
 * A fact's flash card, for the admin page: its record plus `box`, `dueIn` (problems until it's due; ≤ 0 = due
 * now) and `dueDate` (ms, when a days rule applies). null = not met yet.
 */
export function cardFor(profile, settings, key) {
  const r = profile.math.problems[key];
  if (!r) return null;
  const srs = settings.srs, box = boxOf(r);
  const dueIn = (r.lastStep || 0) + srs.steps[Math.min(box, srs.steps.length - 1)] - (profile.math.step || 0);
  const days = srs.days[Math.min(box, srs.days.length - 1)] || 0;
  return { ...r, box, dueIn, dueDate: days && r.lastSeen ? r.lastSeen + days * 86400000 : null };
}

/** Forget a fact (admin): it's met again from scratch, and leaves the line-up. */
export function resetFact(profile, key) {
  delete profile.math.problems[key];
  profile.math.queue = (profile.math.queue || []).filter(k => k !== key);
}

// ------------------------------------------------------------------ easing off after a run of misses
/**
 * A problem the child is likely to get right, while they're struggling: one they got right last time (earlier
 * levels first), or failing that one of the smallest facts of their level.
 */
function easyProblem(profile, settings, last) {
  const table = profile.math.problems, lv = currentLevel(profile, settings), floor = floorOf(settings);
  const notLast = f => !last || f.key !== last.key;
  const known = [];
  for (let n = floor; n <= lv; n++) for (const f of factsForLevel(n)) if (notLast(f) && table[f.key]?.last[0] === '✓') known.push({ f, n });
  if (known.length >= 3) return weightedPick(known, k => (k.n < lv ? 2 : 1) * (1 + table[k.f.key].last.split('✓').length - 1)).f;
  const cur = factsForLevel(lv).filter(notLast).sort((a, b) => size(a) - size(b));
  return cur[Math.floor(Math.random() * Math.max(1, Math.ceil(cur.length / 3)))] || factsForLevel(lv)[0];
}

function weightedPick(items, weight) {
  const ws = items.map(weight), total = ws.reduce((a, b) => a + b, 0);
  let x = Math.random() * total;
  for (let i = 0; i < items.length; i++) if ((x -= ws[i]) < 0) return items[i];
  return items[items.length - 1];
}

/**
 * A training session's run of answers. After settings.ease.misses misses among the last ease.window answers it
 * eases off (`on`): easier problems (nextProblem's opts.easy) and more time (the games multiply their timers by
 * `slower`). ease.recover right in a row and it's back to normal. ease.misses 0 = never.
 */
export class Ease {
  constructor(settings) { this.cfg = settings.ease; this.recent = []; this.on = false; }
  record(ok) {
    const c = this.cfg;
    this.recent = [ok, ...this.recent].slice(0, Math.max(c.window, c.recover));
    if (!this.on && c.misses > 0 && this.recent.slice(0, c.window).filter(r => !r).length >= c.misses) this.on = true;
    else if (this.on && this.recent.length >= c.recover && this.recent.slice(0, c.recover).every(r => r)) { this.on = false; this.recent = []; }
  }
  get slower() { return this.on ? this.cfg.moreTime : 1; }
}

// ------------------------------------------------------------------ answers
/**
 * n answers for a fact: the right one plus plausible wrong ones (neighbouring facts), in random order so the
 * right answer never favours a position.
 */
export function choices(f, n = 3) {
  // the likeliest mistakes first: for × the neighbouring facts (7×6 → 48, 36, 49, 35), otherwise one or two off
  const tiers = f.op === '×'
    ? [[f.a * (f.b + 1), f.a * (f.b - 1), (f.a + 1) * f.b, (f.a - 1) * f.b], [f.answer + 1, f.answer - 1]]
    : [[f.answer + 1, f.answer - 1], [f.answer + 2, f.answer - 2], [f.answer + 3]];
  const wrong = [];
  for (const tier of tiers) for (const v of shuffle([...tier])) if (v !== f.answer && v >= 0 && !wrong.includes(v)) wrong.push(v);
  const out = [f.answer, ...wrong.slice(0, n - 1)];
  return shuffle(out);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Record a child's first answer to a problem (DESIGN.md "Tracking every problem"). `ms` is problem shown →
 * answer committed, or null if unknown. Moves the fact between boxes, and after a miss puts it back in the
 * line-up a couple of problems later. Returns whether it was right.
 */
export function record(profile, f, picked, ms, settings = null) {
  const math = profile.math, table = math.problems;
  const r = table[f.key] || (table[f.key] = { seen: 0, right: 0, wrong: 0, last: '', avgMs: null, bestMs: null, wrongPicks: {}, lastSeen: 0 });
  const ok = picked === f.answer;
  const box = boxOf(r);
  r.seen++;
  if (ok) r.right++;
  else { r.wrong++; if (picked !== null) r.wrongPicks[picked] = (r.wrongPicks[picked] || 0) + 1; }   // null = no answer given
  r.last = ((ok ? '✓' : '✗') + r.last).slice(0, 10);
  if (ms !== null && ms !== undefined) {
    const timed = r.timed || 0;
    r.avgMs = Math.round(((r.avgMs || 0) * timed + ms) / (timed + 1));
    r.timed = timed + 1;
    r.bestMs = r.bestMs === null ? Math.round(ms) : Math.min(r.bestMs, Math.round(ms));
  }
  r.lastSeen = Date.now();
  math.step = (math.step || 0) + 1;
  r.lastStep = math.step;
  if (r.seen === 1) r.firstStep = math.step;
  r.box = ok ? Math.min(box + 1, 99) : 0;
  math.recent = ((ok ? '✓' : '✗') + (math.recent || '')).slice(0, 20);
  if (!ok) {                                        // see it again soon: missGap problems from now
    const gap = (settings ? settings.srs.missGap : 2) * missRun(r);   // missed again: a little later each time
    math.queue = (math.queue || []).filter(k => k !== f.key);
    // struggling now: new facts planned while it was going well wait (the line-up refills with reviews)
    if (settings && !doingWell(profile, settings.srs)) math.queue = math.queue.filter(k => table[k]);
    math.queue.splice(Math.min(gap - 1, math.queue.length), 0, f.key);
  }
  return ok;
}
