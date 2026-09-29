// ⚡ Speed training, played by a bot: P1 walks out east with Pikachu, steers into the right lane for most gates
// and deliberately misses every 4th, until the finish and the results. Checks the per-problem table, the stat gain
// (never down), trainings count, and coming back out on the farm.
//   node tools/shot.js tools/playtests/speed.js shots/speed
const { walkTo, tap, at } = require('./_walk.js');
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game;
    givePokemon(g.save.profiles[0], g.players[0].settings, 'PIKACHU');
    g.store();
  });
  await t.page.reload();
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.wait(500);
  await t.press('KeyQ'); await t.wait(200); await t.press('KeyQ'); await t.wait(500);
  assert(await t.top(0) === 'FarmScene', 'P1 on the farm');
  const before = await t.eval(() => ({ ...window.game.save.profiles[0].pokemon[0].stats }));

  assert(await walkTo(t, 0, 38, 13), 'P1 walks to the track');
  await tap(t, 0, 'right', 200); await t.wait(400);
  assert(await t.top(0) === 'SpeedTrainingScene', 'walking out east starts Speed training');
  // a short session for the test
  await t.eval(() => { const s = window.game.players[0].top; s.settings = { ...s.settings, sessionSeconds: 25 }; });

  const state = () => t.eval(() => {
    const s = window.game.players[0].top;
    if (!s || s.constructor.name !== 'SpeedTrainingScene') return null;
    const g = s.gate;
    return { phase: s.phase, lane: s.lane, mult: s.mult, right: s.right, wrong: s.wrong, answer: !!s.answer, boost: s.boost, streak: s.streak, fx: s.fx.busy,
      gate: g && { key: g.fact.key, values: g.values, answer: g.fact.answer, dist: g.x - s.runnerX, shownAt: g.shownAt } };
  });
  let sawBoost = false, gates = 0, planned = { right: 0, wrong: 0 }, lastKey = null, shots = new Set();
  for (let n = 0; n < 4000; n++) {
    const s = await state();
    if (!s || s.phase !== 'run') break;
    if (s.gate) {
      if (s.gate.shownAt !== lastKey) { gates++; lastKey = s.gate.shownAt; }    // a new gate (count each once)
      const miss = gates % 4 === 0;
      const good = s.gate.values.indexOf(s.gate.answer);
      const target = miss ? (good + 1) % 3 : good;
      if (s.lane !== target) { await t.press(s.lane < target ? 'KeyS' : 'KeyW', 3); await t.wait(60); continue; }
      if (!shots.has('preview') && s.gate.dist > 600) { shots.add('preview'); await t.shot('01-preview'); }
      if (!shots.has('gate') && s.gate.dist < 250) { shots.add('gate'); await t.shot('02-gate'); }
    } else if (s.answer && !shots.has('answer') && s.wrong > 0) { shots.add('answer'); await t.shot('03-missed'); }
    if (s.mult > 1.25 && !shots.has('fast')) { shots.add('fast'); await t.shot('04-fast'); }
    if (s.fx && !shots.has('move')) { shots.add('move'); await t.shot('04b-move'); }
    if (s.boost > 40 && !shots.has('boost')) { shots.add('boost'); sawBoost = true; await t.shot('04c-boost'); }
    await t.wait(40);
  }
  await t.wait(1600);
  const end = await state();
  assert(end && end.phase === 'results', 'the session ends in the results');
  await t.wait(1600);
  await t.shot('05-results');
  assert(end.right > 0 && end.wrong > 0, `answered gates: ${end.right} right, ${end.wrong} wrong`);
  assert(sawBoost, '3 right in a row: a boost');

  const p = await t.eval(() => { const pr = window.game.save.profiles[0]; return { pk: pr.pokemon[0], problems: pr.math.problems }; });
  const seen = Object.values(p.problems).reduce((a, r) => a + r.seen, 0);
  const right = Object.values(p.problems).reduce((a, r) => a + r.right, 0);
  assert(seen === end.right + end.wrong && right === end.right, `every gate recorded once (${seen} seen, ${right} right)`);
  const keys = Object.keys(p.problems);
  assert(keys.every(k => /^\d\+\d$/.test(k) && eval(k) <= 5), 'all level-1 facts (add within 5): ' + keys.join(' '));
  const wrongs = Object.values(p.problems).filter(r => r.wrong).map(r => Object.keys(r.wrongPicks)).flat();
  assert(wrongs.length > 0, 'wrong picks are tracked');
  assert(p.pk.stats.speed > before.speed, `Speed went up: ${before.speed} → ${p.pk.stats.speed}`);
  assert(p.pk.stats.strength === before.strength && p.pk.stats.defense === before.defense, 'the other stats are untouched');
  assert(p.pk.trainings.speed === 1, 'one Speed training counted');

  await t.press('KeyQ'); await t.wait(500);
  assert(await t.top(0) === 'FarmScene', 'back on the farm');
  assert(JSON.stringify(await at(t, 0)) === '[37,13]', 'at the track entrance');
  const saved = await t.eval(() => JSON.parse(localStorage.getItem('pokemon-race-save')).profiles[0].pokemon[0].stats.speed);
  assert(saved === p.pk.stats.speed, 'the new Speed is saved');
};
