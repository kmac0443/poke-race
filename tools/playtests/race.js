// 🏁 The stadium: P1 walks in with Pikachu, picks the meadow and races its first race twice. Too weak the first
// time: it loses, nothing is recorded, a "what to train" hint shows, and the same race is still next. Then (as if
// after training) it wins: the win is recorded, the ribbon shows, and the meadow's next race comes up.
// The race clock is fast-forwarded for the test (the race is deterministic, so that changes nothing).
//   node tools/shot.js tools/playtests/race.js shots/race
const { walkTo, tap } = require('./_walk.js');
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

  // pick stats that lose / win the meadow's first race, straight from the simulator
  const plan = await t.eval(async () => {
    const { RACES } = await import('/src/data/races.js');
    const { runRace } = await import('/src/game/race.js');
    const r = RACES.find(x => x.id === 'meadow-1-1');
    // (found from the simulator, so the test survives regenerating the ladder)
    const lose = { speed: 8, strength: 6, defense: 6 };
    let k = 1, win;
    do { win = { speed: Math.round(18 * k), strength: Math.round(11 * k), defense: Math.round(8 * k) }; k += 0.1; } while (!runRace(r.course, win, r.opponents).won && k < 10);
    return { lose, win, lost: !runRace(r.course, lose, r.opponents).won, won: runRace(r.course, win, r.opponents).won, same:
      JSON.stringify(runRace(r.course, win, r.opponents).order.map(o => o.sim.time)) === JSON.stringify(runRace(r.course, win, r.opponents).order.map(o => o.sim.time)) };
  });
  assert(plan.lost && plan.won, `the simulator: weak loses, trained wins (${JSON.stringify(plan.win)})`);
  assert(plan.same, 'the same stats give exactly the same race');
  await t.eval(st => { window.game.save.profiles[0].pokemon[0].stats = st; }, plan.lose);

  const door = await t.eval(() => window.game.hub.places.find(p => p.key === 'race').back);
  assert(await walkTo(t, 0, door[0], door[1]), 'P1 walks to the stadium');
  await tap(t, 0, 'up', 200); await t.wait(500);
  assert(await t.top(0) === 'StadiumScene', 'walking in opens the venue map');
  await t.shot('01-venues');

  const race = async (label) => {
    await t.press('KeyQ'); await t.wait(400);
    assert(await t.top(0) === 'PreviewScene', `${label}: the preview`);
    if (label === 'lose') await t.shot('02-preview');
    await t.press('KeyQ'); await t.wait(300);
    assert(await t.top(0) === 'RaceScene', `${label}: the race`);
    await t.wait(3300);                                   // the countdown
    if (label === 'win') {                                // the menu button skips straight to the results
      await t.wait(800);
      assert(await t.eval(() => window.game.players[0].top.phase) === 'go', 'win: racing');
      await t.press('Tab'); await t.wait(200);
      assert(await t.eval(() => window.game.players[0].top.phase) === 'results', 'Tab mid-race: straight to the results');
    }
    await t.eval(() => { window.game.players[0].top.t += 4; });
    await t.wait(400);
    if (label === 'lose') await t.shot('03-racing');
    for (let k = 0; k < 40; k++) {
      const ph = await t.eval(() => window.game.players[0].top.phase);
      if (ph === 'results') break;
      await t.eval(() => { const s = window.game.players[0].top; if (s.t) s.t += 3; });
      await t.wait(100);
    }
    await t.wait(1500);
    await t.shot(`04-results-${label}`);
    return t.eval(() => { const s = window.game.players[0].top; return { won: s.result.won, place: s.you.place, hint: s.hint }; });
  };

  const r1 = await race('lose');
  assert(!r1.won && r1.place > 1, `too weak: place ${r1.place}`);
  assert(['run', 'barrier', 'trap'].includes(r1.hint), 'a hint of what to train: ' + r1.hint);
  await t.press('KeyQ'); await t.wait(400);
  assert(await t.top(0) === 'StadiumScene', 'back at the venue map');
  let state = await t.eval(async () => {
    const { nextRace } = await import('/src/game/ladder.js');
    const pk = window.game.save.profiles[0].pokemon[0];
    return { wins: pk.wins.length, next: nextRace(pk, 'meadow').id };
  });
  assert(state.wins === 0 && state.next === 'meadow-1-1', 'a loss records nothing; the same race is next');

  await t.eval(st => { window.game.save.profiles[0].pokemon[0].stats = st; }, plan.win);
  const r2 = await race('win');
  assert(r2.won && r2.place === 1, 'after training: 1st');
  assert(await t.eval(() => window.game.players[0].top.gift === true), 'the first win earns a new Pokémon: a 🎁 on the results');
  assert(await t.eval(() => window.game.save.profiles[0].coins) === 10, 'and 10 🪙 (rank 1)');
  await t.shot('04b-won-gift');
  await t.press('KeyQ'); await t.wait(400);
  state = await t.eval(async () => {
    const { nextRace } = await import('/src/game/ladder.js');
    const pk = JSON.parse(localStorage.getItem('pokemon-race-save')).profiles[0].pokemon[0];
    return { wins: pk.wins, next: nextRace(pk, 'meadow').id };
  });
  assert(JSON.stringify(state.wins) === '["meadow-1-1"]', 'the win is saved on the Pokémon');
  assert(state.next === 'meadow-1-2', 'the meadow moves on to its next race');
  await t.shot('05-venues-after');
  await t.press('KeyE'); await t.wait(400);
  assert(await t.top(0) === 'FarmScene', 'B leaves the stadium');
};
