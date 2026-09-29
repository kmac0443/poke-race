// The math engine, without a browser: simulated children answering problems.
//   node tools/test-math.mjs
import { settingsFor } from '../src/game/settings.js';
import { factsForLevel, currentLevel, masteryLevel, nextProblem, choices, record, levelStatus, upcoming, Ease } from '../src/game/math.js';
import { LEVELS } from '../src/data/defaults.js';

let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };
const child = (overrides = {}) => ({ overrides, math: { problems: {} } });
const levelOf = key => { for (let n = 1; n <= LEVELS.length; n++) if (factsForLevel(n).some(f => f.key === key)) return n; return 0; };

/** Answer `n` problems; `answer(fact)` returns the value picked. Returns the facts asked. */
function play(p, n, answer, opts = {}) {
  const s = settingsFor(p), asked = [];
  let last = null;
  for (let i = 0; i < n; i++) {
    const f = nextProblem(p, s, last, opts);
    asked.push(f);
    record(p, f, answer(f), 1500, s);
    last = f;
  }
  return asked;
}

// a fresh child: level 1, only level-1 facts
{
  const p = child();
  ok(currentLevel(p, settingsFor(p)) === 1, 'a fresh child is on level 1');
  const asked = play(p, 5, f => f.answer + 1);
  ok(asked.every(f => levelOf(f.key) === 1), 'and gets level-1 problems');
  ok(asked.every((f, i) => i === 0 || f.key !== asked[i - 1].key), 'never the same fact twice in a row');
}

// a child who's always right climbs, one level at a time, never skipping
{
  const p = child();
  for (let k = 0; k < 60; k++) play(p, 25, f => f.answer);
  const lv = currentLevel(p, settingsFor(p));
  ok(lv >= 3, `always right → up the levels (now ${lv} after 1500 problems)`);
  ok(levelStatus(p, settingsFor(p), 1).mastered && levelStatus(p, settingsFor(p), 2).mastered, 'levels 1 and 2 mastered');
}

// mastery is accuracy first: one fact always wrong keeps the child on level 1, and it comes straight back
{
  const p = child(), s = settingsFor(p);
  const asked = play(p, 300, f => (f.key === '2+3' ? 4 : f.answer));
  ok(masteryLevel(p, s) === 1, 'one fact always wrong → still level 1');
  const at = asked.map((f, i) => (f.key === '2+3' ? i : -1)).filter(i => i >= 0);
  const gaps = at.slice(1).map((v, i) => v - at[i]);
  ok(gaps[0] <= s.srs.missGap + 1, `after a miss it's back within ${s.srs.missGap + 1} problems (first gap ${gaps[0]})`);
  ok(gaps.length > 10 && gaps.every(g => g <= s.srs.missGap * 4 + 2), `missed again and again: it backs off, but never far (gaps ${[...new Set(gaps)].join(',')})`);
  const met = new Set(asked.map(f => f.key)).size;
  ok(met >= 8, `one stuck fact doesn't stop everything: ${met} facts met in 300 problems`);
  ok(p.math.problems['2+3'].wrongPicks['4'] > 0, 'its wrong pick is tracked');
}

// the admin floor and ceiling
{
  const p = child({ mathFloor: 4 });
  ok(currentLevel(p, settingsFor(p)) === 4, 'floor 4 → level 4');
  const asked = play(p, 200, f => f.answer);
  ok(asked.every(f => levelOf(f.key) >= 4), 'review never goes below the floor');
  const q = child({ mathCeiling: 2 });
  play(q, 1500, f => f.answer);
  ok(currentLevel(q, settingsFor(q)) === 2, 'ceiling 2 → stays on 2 even when mastered');
  ok(play(q, 300, f => f.answer).every(f => levelOf(f.key) <= 2), 'and never sees level 3');
}

// flash cards: new facts a few at a time, each coming back less and less often while it's right
{
  const p = child(), s = settingsFor(p);
  const asked = play(p, 60, f => f.answer);
  const first8 = new Set(asked.slice(0, 8).map(f => f.key));
  ok(first8.size <= s.srs.maxLearning, `the first 8 problems use only ${first8.size} facts (they repeat before new ones come)`);
  const key = asked[0].key, at = asked.map((f, i) => (f.key === key ? i : -1)).filter(i => i >= 0);
  const gaps = at.slice(1).map((v, i) => v - at[i]);
  ok(gaps.length >= 3 && gaps.every((g, i) => i === 0 || g >= gaps[i - 1]), `a fact kept right comes back less often: gaps ${gaps.join(', ')}`);
  ok(p.math.queue.length === s.srs.lookahead, `the next ${s.srs.lookahead} problems are planned and saved: ${p.math.queue.join(' ')}`);
  const before = p.math.queue.join();
  ok(upcoming(p, s).length === s.srs.lookahead && p.math.queue.join() === before, 'upcoming() shows them without changing anything');
}

// old facts keep coming back: a child on level 3+ still meets level-1 facts now and then
{
  const p = child();
  for (let k = 0; k < 60; k++) play(p, 25, f => f.answer);
  const later = play(p, 400, f => f.answer);
  const old = later.filter(f => levelOf(f.key) === 1).length;
  ok(old > 0 && old < later.length * 0.3, `level-1 facts still come back sometimes (${old} of ${later.length})`);
}

// struggling: no new facts while most answers are wrong
{
  const p = child(), s = settingsFor(p);
  play(p, 12, f => f.answer);
  const known = new Set(Object.keys(p.math.problems));
  let k = 0;
  const asked = play(p, 40, f => (k++ % 2 ? f.answer : f.answer + 1));
  const brandNew = new Set(asked.filter(f => !known.has(f.key)).map(f => f.key));
  ok(brandNew.size <= 2, `half wrong → no new facts for 40 problems, beyond ones already in the line-up (${[...brandNew].join(', ') || 'none'})`);
}

// a save from before the boxes: a run of ✓ counts as its box
{
  const p = child(), s = settingsFor(p);
  p.math.problems['1+1'] = { seen: 3, right: 3, wrong: 0, last: '✓✓✓', avgMs: 1500, bestMs: 1400, wrongPicks: {}, lastSeen: Date.now() - 5 * 86400000 };
  const f = nextProblem(p, s, null);
  ok(f && f.key, 'an old save still gets problems');
}

// choices: the right answer plus plausible distinct ones, in no learnable position
{
  let good = true;
  const pos = [0, 0, 0];
  for (let n = 1; n <= LEVELS.length; n++) for (const f of factsForLevel(n)) {
    const c = choices(f, 3);
    if (c.length !== 3 || new Set(c).size !== 3 || !c.includes(f.answer) || c.some(v => v < 0)) good = false;
    if (c.some(v => Math.abs(v - f.answer) > Math.max(3, f.op === '×' ? Math.max(f.a, f.b) + 1 : 3))) good = false;
    pos[c.indexOf(f.answer)]++;
  }
  ok(good, 'every fact gets 3 distinct, non-negative, nearby answers');
  const tot = pos.reduce((a, b) => a + b, 0);
  ok(pos.every(n => Math.abs(n / tot - 1 / 3) < 0.05), `the right answer's position is even: ${pos}`);
  const f = factsForLevel(8).find(x => x.key === '7×6');
  const c4 = choices(f, 4);
  ok(c4.length === 4 && c4.includes(42) && c4.filter(v => [48, 36, 49, 35].includes(v)).length === 3, '7×6 offers neighbouring facts: ' + c4);
}

// easing off: a run of misses → easier problems and more time, until a few right in a row
{
  const p = child(), s = settingsFor(p), e = new Ease(s);
  e.record(true); e.record(false); e.record(false);
  ok(!e.on && e.slower === 1, 'two misses: not yet');
  e.record(false);
  ok(e.on && e.slower === s.ease.moreTime, `three misses in five: easing off (× ${e.slower} time)`);
  e.record(true); e.record(false); e.record(true); e.record(true);
  ok(e.on, 'still easy until three right in a row');
  e.record(true);
  ok(!e.on, 'three right in a row: back to normal');
  const off = new Ease(settingsFor(child({ ease: { ...s.ease, misses: 0 } })));
  for (let i = 0; i < 10; i++) off.record(false);
  ok(!off.on, 'misses 0 turns it off');

  // what "easy" asks: facts they got right last time, earlier levels first; with none, the smallest of the level
  const q = child();
  play(q, 300, f => f.answer);                                   // master a few levels
  const lv = currentLevel(q, settingsFor(q));
  for (const f of factsForLevel(lv)) record(q, f, f.answer + 1, 1500);   // then miss everything on this level
  const easy = play(q, 40, f => f.answer, { easy: true });
  ok(lv > 1 && easy.every(f => levelOf(f.key) < lv || q.math.problems[f.key].last[1] === '✓'), `easy problems on level ${lv} come from what they know`);
  const fresh = child(), small = play(fresh, 30, f => f.answer + 1, { easy: true });
  const sizes = factsForLevel(1).map(f => f.a + f.b).sort((a, b) => a - b), cut = sizes[Math.ceil(sizes.length / 3) - 1];
  ok(small.every(f => f.a + f.b <= cut), 'nothing known yet: the smallest facts of the level');
}

console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
