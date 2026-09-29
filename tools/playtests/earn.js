// Earning Pokémon (DESIGN.md "Earning a new Pokémon"): P1's Pikachu has won its first race, so the lab's bubble is
// a 🎁; inside, A opens the pick screen, the pick comes out and follows P1 (Pikachu goes exploring), and the lab
// then shows flags toward the next one. The trophy house shows both cases: the card, then the ribbons side.
//   node tools/shot.js tools/playtests/earn.js shots/earn
const { walkTo, tap } = require('./_walk.js');
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game, [a] = g.save.profiles;
    const pk = givePokemon(a, g.players[0].settings, 'PIKACHU');
    pk.wins = ['meadow-1-1']; pk.stats = { speed: 30, strength: 20, defense: 16 };
    g.store();
  });
  await t.page.reload();
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.wait(500);
  await t.press('KeyQ'); await t.wait(300); await t.press('KeyQ'); await t.wait(600);
  assert(await t.top(0) === 'FarmScene', 'P1 is on the farm');
  const waiting = () => t.eval(async () => {
    const { picksWaiting } = await import('/src/game/pokemon.js');
    const s = window.game.players[0]; return picksWaiting(s.profile, s.settings);
  });
  assert(await waiting() === 1, 'one win: a new Pokémon is waiting');

  const lab = await t.eval(() => window.game.hub.places.find(p => p.key === 'lab').back);
  assert(await walkTo(t, 0, lab[0], lab[1] + 1), 'P1 walks to the lab');
  await t.shot('01-lab-gift');
  await tap(t, 0, 'up', 300); await t.wait(400);
  assert(await t.top(0) === 'LabScene', 'into the lab');
  await t.shot('02-lab-table');
  await t.press('KeyQ'); await t.wait(400);
  assert(await t.top(0) === 'PickPokemonScene', 'A opens the pick screen');
  const grid = await t.eval(() => window.game.players[0].top.grid.items.map(i => `${i.id}:${i.open}`).join(' '));
  assert(grid.includes('PIKACHU:false'), 'Pikachu is greyed out (already theirs)');
  await t.shot('03-pick');
  // the cursor starts on the first open one (Eevee → an Eeveelution choice): step right to Pikachu (taken), then
  // Charmander
  await t.press('KeyD'); await t.wait(150); await t.press('KeyD'); await t.wait(150);
  assert(await t.eval(() => window.game.players[0].top.grid.current.id) === 'CHARMANDER', 'cursor on Charmander');
  await t.press('KeyQ'); await t.wait(300); await t.press('KeyQ'); await t.wait(500);
  assert(await t.top(0) === 'LabScene', 'back in the lab');
  await t.shot('04-hello');
  const after = await t.eval(() => { const p = window.game.save.profiles[0]; return { n: p.pokemon.length, active: p.pokemon.find(k => k.uid === p.active).species }; });
  assert(after.n === 2 && after.active === 'CHARMANDER', 'Charmander is theirs and follows them');
  assert(await t.eval(() => JSON.parse(localStorage.getItem('pokemon-race-save')).profiles[0].pokemon.length) === 2, 'and it is saved');
  assert(await waiting() === 0, 'nothing waiting now');
  await t.press('KeyQ'); await t.wait(300);
  await t.shot('05-lab-flags');
  await t.press('KeyE'); await t.wait(500);
  assert(await t.top(0) === 'FarmScene', 'B leaves the lab');
  assert(await t.eval(() => [...window.game.hub.mons.values()].some(m => m.species === 'PIKACHU')), 'Pikachu went exploring');

  // the trophy house: two cases
  const th = await t.eval(() => window.game.hub.places.find(p => p.key === 'trophy').back);
  assert(await walkTo(t, 0, th[0], th[1]), 'P1 walks to the trophy house');
  await tap(t, 0, 'up', 300); await t.wait(400);
  assert(await t.top(0) === 'TrophyRoomScene', 'into the trophy house');
  await t.press('KeyA'); await t.wait(300);
  assert(await t.eval(() => window.game.players[0].top.mons[window.game.players[0].top.index].species) === 'PIKACHU', 'left: Pikachu\'s case');
  await t.shot('06-card');
  await t.press('KeyS'); await t.wait(300);
  assert(await t.eval(() => window.game.players[0].top.side) === 1, 'down: the ribbons side');
  await t.shot('07-ribbons');
  await t.press('KeyE'); await t.wait(400);
  assert(await t.top(0) === 'FarmScene', 'B leaves');
};
