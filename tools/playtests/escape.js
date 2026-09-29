// The menu button leaves a training game early and keeps what was earned: P1 (Tab) in Speed, P2 (numpad Enter)
// in Strength, each after a couple of right answers.
//   node tools/shot.js tools/playtests/escape.js shots/escape
const { walkTo, tap, KEYS } = require('./_walk.js');
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game;
    givePokemon(g.save.profiles[0], g.players[0].settings, 'PIKACHU');
    givePokemon(g.save.profiles[1], g.players[1].settings, 'RIOLU');
    g.store();
  });
  await t.page.reload();
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.wait(500);
  await t.press('KeyQ'); await t.press('Numpad7'); await t.wait(200);
  await t.press('KeyQ'); await t.press('Numpad7'); await t.wait(500);

  assert(await walkTo(t, 0, 38, 13), 'P1 to the track');
  await tap(t, 0, 'right', 200); await t.wait(300);
  assert(await walkTo(t, 1, 1, 13), 'P2 to the quarry');
  await tap(t, 1, 'left', 200); await t.wait(300);
  assert(await t.top(0) === 'SpeedTrainingScene' && await t.top(1) === 'StrengthTrainingScene', 'both training');

  // answer a couple right: steer P1 into the right lane; move P2's arrow to the move with the answer, then A
  for (let n = 0; n < 400; n++) {
    const s = await t.eval(() => {
      const [a, b] = window.game.players.map(p => p.top);
      return { a: { right: a.right, lane: a.lane, g: a.gate && { v: a.gate.values, ans: a.gate.fact.answer } },
        b: { right: b.right, cursor: b.cursor, p: b.problem && { v: b.problem.values, ans: b.problem.fact.answer } } };
    });
    if (s.a.right >= 2 && s.b.right >= 2) break;
    if (s.a.g && s.a.right < 2) {
      const target = s.a.g.v.indexOf(s.a.g.ans);
      if (s.a.lane !== target) await t.press(s.a.lane < target ? 'KeyS' : 'KeyW', 3);
    }
    if (s.b.p && s.b.right < 2) {
      const want = s.b.p.v.indexOf(s.b.p.ans);
      if (s.b.cursor !== want) await t.press(KEYS[1].down);
      else { await t.press(KEYS[1].a); await t.wait(300); }
    }
    await t.wait(40);
  }
  const mid = await t.eval(() => window.game.players.map(p => p.top.right));
  assert(mid[0] >= 2 && mid[1] >= 2, `two right each so far: ${mid}`);

  await t.press('Tab'); await t.press('NumpadEnter'); await t.wait(300);
  const ph = await t.eval(() => window.game.players.map(p => p.top.phase));
  assert(ph[0] === 'results' && ph[1] === 'results', 'the menu button ends both early, into the results: ' + ph);
  await t.wait(1500);
  await t.shot('01-results');
  const st = await t.eval(() => window.game.save.profiles.map(p => p.pokemon[0].stats));
  assert(st[0].speed > 18, 'P1 kept the Speed earned: ' + st[0].speed);
  assert(st[1].strength > 14, 'P2 kept the Strength earned: ' + st[1].strength);
  await t.press('Tab'); await t.press('NumpadEnter'); await t.wait(400);
  assert(await t.top(0) === 'FarmScene' && await t.top(1) === 'FarmScene', 'and back to the farm');
};
