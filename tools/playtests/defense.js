// 🛡️ Defense training, played by a bot as P2 (numpad): walk into the arena with Riolu; for each attack turn the
// shield (once changing its mind first) and lock with A; now and then turn the wrong way, or press A with no shield
// (it doesn't lock: there's no timer). Checks nothing comes before the lock, a real Pokémon attacks, the table, the
// stat gain, and coming back out.
//   node tools/shot.js tools/playtests/defense.js shots/defense
const { walkTo, tap, at, KEYS } = require('./_walk.js');
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game;
    givePokemon(g.save.profiles[1], g.players[1].settings, 'RIOLU');
    g.store();
  });
  await t.page.reload();
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.wait(500);
  await t.press('Numpad7'); await t.wait(200); await t.press('Numpad7'); await t.wait(500);
  const before = await t.eval(() => ({ ...window.game.save.profiles[1].pokemon[0].stats }));

  const door = await t.eval(() => window.game.hub.places.find(p => p.key === 'defense').back);
  assert(await walkTo(t, 1, door[0], door[1]), 'P2 walks to the arena door');
  await tap(t, 1, 'up', 200); await t.wait(400);
  assert(await t.top(1) === 'DefenseTrainingScene', 'walking in starts Defense training');
  await t.eval(() => { const s = window.game.players[1].top; s.settings = { ...s.settings, sessionSeconds: 35 }; });

  const state = () => t.eval(() => {
    const s = window.game.players[1].top;
    if (!s || s.constructor.name !== 'DefenseTrainingScene') return null;
    const p = s.problem;
    return { phase: s.phase, right: s.right, wrong: s.wrong, shield: s.shield, attack: !!s.attack, attacker: s.attack && s.attack.species,
      problem: p && { key: p.fact.key, values: p.values, answer: p.fact.answer, shownAt: p.shownAt, locked: p.locked } };
  });
  const DIRS = ['up', 'left', 'right', 'down'];
  let n = 0, shots = new Set(), attackBeforeLock = false, noShieldLocked = false, plan = { right: 0, wrong: 0 };
  const attackers = new Set();
  for (let loop = 0; loop < 800; loop++) {
    const s = await state();
    if (!s || s.phase !== 'guard') break;
    if (!s.problem || s.problem.locked) { await t.wait(40); continue; }
    if (s.attack) attackBeforeLock = true;
    n++;
    const good = DIRS[s.problem.values.indexOf(s.problem.answer)];
    const bad = DIRS[(DIRS.indexOf(good) + 1) % 4];
    const mode = n % 5 === 4 ? 'wrong' : n % 5 === 0 ? 'nothing' : n === 2 ? 'change' : 'right';
    if (mode === 'right') { await t.press(KEYS[1][good]); plan.right++; }
    if (mode === 'change') { await t.press(KEYS[1][bad]); await t.wait(200); await t.press(KEYS[1][good]); plan.right++; }
    if (mode === 'wrong') { await t.press(KEYS[1][bad]); plan.wrong++; }
    if (mode === 'nothing') {           // A with no shield: nothing happens; then a wrong side
      await t.press(KEYS[1].a); await t.wait(300);
      const still = await state();
      if (still.problem.locked || still.attack) noShieldLocked = true;
      await t.press(KEYS[1][bad]); plan.wrong++;
    }
    if (!shots.has('guard') && mode === 'right') { await t.wait(150); shots.add('guard'); await t.shot('01-guard'); }
    await t.press(KEYS[1].a);
    // wait for this problem to finish (attack lands)
    for (let k = 0; k < 400; k++) {
      const now = await state();
      if (!now || !now.problem || now.problem.shownAt !== s.problem.shownAt) break;
      if (now.attacker) attackers.add(now.attacker);
      if (now.problem.locked && now.attack && !shots.has(mode)) { await t.wait(120); shots.add(mode); await t.shot(`02-attack-${mode}`); }
      await t.wait(40);
    }
  }
  await t.wait(1600);
  const end = await state();
  assert(end && end.phase === 'results', 'the session ends in the results');
  await t.wait(1500);
  await t.shot('03-results');
  assert(!attackBeforeLock, 'no attack ever showed before the lock');
  assert(!noShieldLocked, 'A with no shield turned does nothing');
  assert(attackers.size >= 1 && [...attackers].every(Boolean), `wild Pokémon attacked: ${[...attackers].join(', ')}`);
  assert(end.right === plan.right && end.wrong === plan.wrong, `blocked ${end.right}, hit ${end.wrong} (as played: ${plan.right}/${plan.wrong})`);

  const p = await t.eval(() => { const pr = window.game.save.profiles[1]; return { pk: pr.pokemon[0], problems: pr.math.problems }; });
  const seen = Object.values(p.problems).reduce((a, r) => a + r.seen, 0);
  assert(seen === end.right + end.wrong, `every attack recorded once (${seen})`);
  assert(p.pk.stats.defense > before.defense, `Defense went up: ${before.defense} → ${p.pk.stats.defense}`);
  assert(p.pk.stats.speed === before.speed && p.pk.stats.strength === before.strength, 'the other stats are untouched');

  await t.press('Numpad7'); await t.wait(500);
  assert(await t.top(1) === 'FarmScene', 'back on the farm');
  assert(JSON.stringify(await at(t, 1)) === JSON.stringify(door), 'at the arena door');
};
