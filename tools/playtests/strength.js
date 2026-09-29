// 💪 Strength training, played by a bot: P1 walks out west with Charmander, moves the arrow to the move with the
// right answer and presses A (a wrong one every 4th problem), until the results. Checks the moves, that the arrow
// isn't an answer, that objects crack, the per-problem table, the stat gain, and coming back out at the quarry.
//   node tools/shot.js tools/playtests/strength.js shots/strength
const { walkTo, tap, at, KEYS } = require('./_walk.js');
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game;
    givePokemon(g.save.profiles[0], g.players[0].settings, 'CHARMANDER');
    g.store();
  });
  await t.page.reload();
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.wait(500);
  await t.press('KeyQ'); await t.wait(200); await t.press('KeyQ'); await t.wait(500);
  const before = await t.eval(() => ({ ...window.game.save.profiles[0].pokemon[0].stats }));

  assert(await walkTo(t, 0, 1, 13), 'P1 walks to the quarry road');
  await tap(t, 0, 'left', 200); await t.wait(400);
  assert(await t.top(0) === 'StrengthTrainingScene', 'walking out west starts Strength training');
  await t.eval(() => { const s = window.game.players[0].top; s.settings = { ...s.settings, sessionSeconds: 30 }; });

  const state = () => t.eval(() => {
    const s = window.game.players[0].top;
    if (!s || s.constructor.name !== 'StrengthTrainingScene') return null;
    const p = s.problem;
    return { phase: s.phase, right: s.right, wrong: s.wrong, cracked: s.cracked, hits: s.obj.hits, hp: s.obj.hp, cursor: s.cursor,
      using: !!s.using, moves: s.moves.map(m => m.id),
      problem: p && { key: p.fact.key, values: p.values, answer: p.fact.answer, shownAt: p.shownAt } };
  });
  let s;
  for (let n = 0; n < 200 && !(s = await state()).problem; n++) await t.wait(50);
  assert(s.moves.length === 3 && s.moves.includes('EMBER'), `Charmander knows three moves: ${s.moves}`);
  await t.shot('01-problem');

  // the arrow: down moves it, and it wraps
  const c0 = s.cursor;
  await t.press(KEYS[0].down); await t.wait(100);
  assert((await state()).cursor === (c0 + 1) % 3, 'down moves the arrow');
  assert((await state()).problem.shownAt === s.problem.shownAt, 'moving the arrow is not an answer');

  let problems = 0, shots = new Set();
  for (let n = 0; n < 600; n++) {
    s = await state();
    if (!s || s.phase !== 'play') break;
    if (!s.problem) { await t.wait(40); continue; }
    problems++;
    const good = s.problem.values.indexOf(s.problem.answer);
    const want = problems % 4 === 0 ? (good + 1) % 3 : good;
    for (let k = 0; k < 3 && (await state()).cursor !== want; k++) { await t.press(KEYS[0].down); await t.wait(60); }
    await t.press(KEYS[0].a);
    if (!shots.has('move')) { await t.wait(250); shots.add('move'); await t.shot('02-move'); }
    for (let k = 0; k < 100; k++) { const now = await state(); if (!now || !now.using) break; await t.wait(30); }
    const now = await state();
    if (now && now.wrong && !shots.has('miss')) { shots.add('miss'); await t.shot('03-miss'); }
    if (now && now.cracked && !shots.has('crack')) { await t.wait(150); shots.add('crack'); await t.shot('04-crack'); }
  }
  await t.wait(1600);
  const end = await state();
  assert(end && end.phase === 'results', 'the session ends in the results');
  await t.wait(1500);
  await t.shot('05-results');
  assert(end.right > 0 && end.wrong > 0, `moves: ${end.right} right, ${end.wrong} wrong`);
  assert(end.cracked >= 1, `objects cracked: ${end.cracked}`);

  const p = await t.eval(() => { const pr = window.game.save.profiles[0]; return { pk: pr.pokemon[0], problems: pr.math.problems }; });
  const seen = Object.values(p.problems).reduce((a, r) => a + r.seen, 0);
  assert(seen === end.right + end.wrong, `every move recorded once (${seen})`);
  assert(p.pk.stats.strength > before.strength, `Strength went up: ${before.strength} → ${p.pk.stats.strength}`);
  assert(p.pk.stats.speed === before.speed && p.pk.stats.defense === before.defense, 'the other stats are untouched');
  assert(p.pk.trainings.strength === 1, 'one Strength training counted');

  await t.press('KeyQ'); await t.wait(500);
  assert(await t.top(0) === 'FarmScene', 'back on the farm');
  assert(JSON.stringify(await at(t, 0)) === '[2,13]', 'at the quarry entrance');
};
