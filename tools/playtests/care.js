// Farm care: needs come from training: two sessions and the Pokémon that trained needs something (Charmander's
// Strength → 🍎; after two more, Pikachu's Speed → 💧), saved. P1 arrives with Pikachu (following) and Charmander
// (exploring), both in need. P1 walks up to
// Charmander, A: a problem and three numbered spots. P1 fetches a wrong one first (a head shake, the answer shown,
// recorded as wrong), then the right one: hearts, +careFriendship for Charmander, its need gone, the table has one
// answer for that fact (the retry isn't recorded).
//   node tools/shot.js tools/playtests/care.js shots/care
const { walkTo, tap } = require('./_walk.js');
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game, [a] = g.save.profiles;
    const { noteTraining } = await import('/src/game/needs.js');
    const s = g.players[0].settings;
    const ch = givePokemon(a, s, 'CHARMANDER'), pi = givePokemon(a, s, 'PIKACHU');
    window.first = noteTraining(a, ch, 'strength', s);          // one session: nothing yet
    window.second = noteTraining(a, ch, 'strength', s);         // two: hungry
    noteTraining(a, pi, 'speed', s); noteTraining(a, pi, 'speed', s);
    g.store();
  });
  assert(await t.eval(() => window.first === null && window.second === 'food'), 'two Strength sessions: Charmander is hungry (not after one)');
  await t.page.reload();
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.wait(500);
  await t.press('KeyQ'); await t.wait(300); await t.press('KeyQ'); await t.wait(600);
  assert(await t.top(0) === 'FarmScene', 'P1 is on the farm');
  const needs = await t.eval(() => [...window.game.hub.care.needs.entries()]);
  assert(needs.length === 2 && needs.some(n => n[1] === 'drink'), `both Pokémon need something, saved through a reload: ${JSON.stringify(needs)}`);

  // Charmander: put it in the open meadow and keep it there
  const ch = await t.eval(() => {
    const hub = window.game.hub, m = [...hub.mons.values()].find(m => m.species === 'CHARMANDER');
    m.char.place(24, 17, 'down'); m.wait = 1e9;
    return [m.char.x, m.char.y];
  });
  await t.wait(200);
  const face = async () => {        // stand next to Charmander, facing it
    for (const [dir, sx, sy] of [['up', ch[0], ch[1] + 1], ['down', ch[0], ch[1] - 1], ['left', ch[0] + 1, ch[1]], ['right', ch[0] - 1, ch[1]]]) {
      if (!(await walkTo(t, 0, sx, sy))) continue;
      await t.eval(d => { const hub = window.game.hub, w = hub.walkers[0]; w.intent = { dir: d, held: 1, run: false }; hub.updateWalker(w); }, dir);
      await t.wait(150);
      return true;
    }
    return false;
  };
  assert(await face(), 'P1 walks up to Charmander');
  await t.press('KeyQ'); await t.wait(300);
  const task = () => t.eval(() => { const k = window.game.hub.care.tasks[0]; return k && { key: k.fact.key, answer: k.fact.answer, spots: k.spots.map(s => [s.x, s.y, s.value]), carrying: k.carrying && k.carrying.value }; });
  let k = await task();
  assert(k && k.spots.length === 3, `A: a problem (${k && k.key}) and three spots: ${JSON.stringify(k && k.spots)}`);
  await t.shot('01-problem');

  const fetch = async value => {
    const [sx, sy] = k.spots.find(s => s[2] === value);
    assert(await walkTo(t, 0, sx, sy), `P1 walks to the ${value}`);
    await t.press('KeyQ'); await t.wait(200);
    return (await task()).carrying;
  };
  const wrong = k.spots.find(s => s[2] !== k.answer)[2];
  assert(await fetch(wrong) === wrong, `picked up the ${wrong} (wrong)`);
  await t.shot('02-carrying');
  assert(await face(), 'back to Charmander');
  await t.press('KeyQ'); await t.wait(250);
  await t.shot('03-wrong');
  k = await task();
  assert(k && k.carrying === null, 'wrong: it shakes its head, the task goes on');
  const rec = await t.eval(key => window.game.save.profiles[0].math.problems[key], k.key);
  assert(rec && rec.wrong === 1 && rec.seen === 1, 'recorded once, as wrong');

  assert(await fetch(k.answer) === k.answer, `picked up the ${k.answer} (right)`);
  assert(await face(), 'back to Charmander again');
  const before = await t.eval(() => window.game.save.profiles[0].pokemon.find(p => p.species === 'CHARMANDER').friendship);
  await t.press('KeyQ'); await t.wait(400);
  await t.shot('04-right');
  const after = await t.eval(() => ({
    f: window.game.save.profiles[0].pokemon.find(p => p.species === 'CHARMANDER').friendship,
    task: window.game.hub.care.tasks[0], needs: window.game.hub.care.needs.size,
  }));
  const gain = await t.eval(() => window.game.players[0].settings.careFriendship);
  assert(after.f === before + gain, `right: friendship ${before} → ${after.f}`);
  assert(!after.task && after.needs === 1, 'the need is met (Pikachu still needs something)');
  assert(await t.eval(() => Object.keys(JSON.parse(localStorage.getItem('pokemon-race-save')).profiles[0].needs).length) === 1, 'and that is saved');
  const rec2 = await t.eval(key => window.game.save.profiles[0].math.problems[key], k.key);
  assert(rec2.seen === 1, 'the retry was not recorded');
};
