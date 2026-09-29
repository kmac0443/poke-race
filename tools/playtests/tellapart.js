// Telling Pokémon apart on the farm: both children own a Pikachu and P1 has two Eevees heading for different
// Eeveelutions. Every Pokémon's marker has its owner's colour and its goal; a child's colour (admin.html) follows
// them to whichever half they sit in.
//   node tools/shot.js tools/playtests/tellapart.js shots/tellapart
const { walkTo } = require('./_walk.js');
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game, [a, b] = g.save.profiles, s = g.players[0].settings;
    givePokemon(a, s, 'EEVEE', 'JOLTEON'); givePokemon(a, s, 'EEVEE', 'UMBREON'); givePokemon(a, s, 'PIKACHU');
    givePokemon(b, s, 'PIKACHU'); givePokemon(b, s, 'SQUIRTLE');
    g.store();
  });
  await t.page.reload();
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.wait(500);
  // P2's child sits on the LEFT this time: the colour belongs to the child, not the half
  await t.press('KeyQ'); await t.wait(200); await t.press('KeyD'); await t.press('KeyQ'); await t.wait(500);
  assert(await t.top(0) === 'FarmScene', 'child 2 in the left half');
  assert(await t.eval(() => window.game.players[0].color === window.game.save.profiles[1].color), "the left half wears child 2's colour");

  // gather everyone in view: put the exploring Pokémon near the spawn
  await t.eval(() => {
    const hub = window.game.hub; let x = 16;
    for (const m of hub.mons.values()) { m.char.place(x, 16, 'down'); m.wait = 1e9; x += 2; }
  });
  await walkTo(t, 0, 20, 14);
  await t.wait(300);
  const marks = await t.eval(() => window.game.hub.monMarkers().map(m => {
    const hub = window.game.hub;
    const mon = [...hub.mons.values()].find(x => x.char === m.char);
    return { owner: mon ? mon.profileIndex : 'follower', species: mon ? mon.species : null, color: m.color, goal: m.goal };
  }));
  const pr = await t.eval(() => window.game.save.profiles.map(p => p.color));
  const pikas = marks.filter(m => m.species === 'PIKACHU');
  assert(marks.length === 5, `a marker for every Pokémon (${marks.length}; Squirtle follows child 2)`);
  assert(pikas.length === 2 && pikas[0].color !== pikas[1].color, 'the two Pikachu wear different colours');
  assert(marks.filter(m => m.owner === 0).every(m => m.color === pr[0]) && marks.filter(m => m.owner === 1).every(m => m.color === pr[1]),
    "each exploring Pokémon's ring is its owner's colour");
  const goals = marks.filter(m => m.species === 'EEVEE').map(m => m.goal).sort().join();
  assert(goals === 'JOLTEON,UMBREON', 'the two Eevees show different goals: ' + goals);
  assert(pr[0] !== pr[1], 'the children have different colours');
  await t.shot('01-farm');

  // admin changes child 2's colour → the game follows
  await t.eval(() => {
    const s = JSON.parse(localStorage.getItem('pokemon-race-save'));
    s.profiles[1].color = '#38A848';
    localStorage.setItem('pokemon-race-save', JSON.stringify(s));
    window.dispatchEvent(new StorageEvent('storage', { key: 'pokemon-race-save' }));
  });
  await t.wait(200);
  assert(await t.eval(() => window.game.players[0].color) === '#38A848', "a new colour from admin shows straight away");
  await t.shot('02-green');
};
