// Evolution on the farm: P1's Charmander has every bar of its goal full (total 90 + 4 races won), so arriving on
// the farm it evolves into Charmeleon: the cutscene, a stat jump, its old form remembered, all saved. Then a Gloom
// follows P1: it has two ways to go, so the choice comes up first; picking Bellossom sets its goal.
//   node tools/shot.js tools/playtests/evolve.js shots/evolve
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game, [a] = g.save.profiles, s = g.players[0].settings;
    const pk = givePokemon(a, s, 'CHARMANDER');
    pk.stats = { speed: 34, strength: 34, defense: 30 };
    pk.wins = ['meadow-1-1', 'forest-1-1', 'beach-1-1', 'mountain-1-1'];
    g.store();
  });
  await t.page.reload();
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.wait(500);
  await t.press('KeyQ'); await t.wait(300); await t.press('KeyQ');
  await t.page.waitForFunction(() => window.game.players[0].top?.constructor.name === 'EvolutionScene', { timeout: 5000 });
  assert(true, 'arriving on the farm, Charmander starts evolving');
  await t.wait(2500); await t.shot('01-morph');
  await t.page.waitForFunction(() => window.game.players[0].top.phase === 'done', { timeout: 12000 });
  await t.wait(1500); await t.shot('02-done');
  const pk = await t.eval(() => JSON.parse(localStorage.getItem('pokemon-race-save')).profiles[0].pokemon[0]);
  assert(pk.species === 'CHARMELEON', `it's a Charmeleon now (${pk.species}), and saved`);
  assert(JSON.stringify(pk.formerSpecies) === '["CHARMANDER"]', 'it remembers it was a Charmander');
  assert(pk.stats.speed > 34 && pk.stats.strength > 34 && pk.stats.defense > 30, `stats jumped: ${JSON.stringify(pk.stats)}`);
  assert(pk.wins.length === 4, 'its wins stay');
  await t.press('KeyQ'); await t.wait(500);
  assert(await t.top(0) === 'FarmScene', 'A: back on the farm');
  await t.wait(800);
  assert(await t.top(0) === 'FarmScene', 'and it does not evolve again (next goal: Charizard, far off)');

  // a Gloom: two ways to go
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game;
    givePokemon(g.save.profiles[0], g.players[0].settings, 'GLOOM');
  });
  await t.page.waitForFunction(() => window.game.players[0].top?.constructor.name === 'BranchScene', { timeout: 5000 });
  assert(true, 'a Gloom following: which way will it go?');
  await t.wait(400);
  const opts = await t.eval(() => window.game.players[0].top.options);
  assert(opts.join() === 'VILEPLUME,BELLOSSOM', `the options: ${opts}`);
  await t.press('KeyD'); await t.wait(200);
  await t.shot('03-branch');
  await t.press('KeyQ'); await t.wait(500);
  const gloom = await t.eval(() => window.game.save.profiles[0].pokemon.find(p => p.species === 'GLOOM'));
  assert(gloom.branch === 'BELLOSSOM', 'picked Bellossom: that is its goal now');
  assert(await t.top(0) === 'FarmScene', 'and back on the farm');
};
