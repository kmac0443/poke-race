// The shell, from a fresh save: both halves go title → pick child → first Pokémon (P2 picks Eevee → Flareon) →
// the farm; then the save is checked, and P1 leaves (Tab, ✔) and can't take P2's child.
//   node tools/shot.js tools/playtests/shell.js shots/shell
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.wait(2500);
  await t.shot('01-title');
  assert(await t.top(0) === 'TitleScene' && await t.top(1) === 'TitleScene', 'both halves start at the title');

  await t.press('KeyQ'); await t.press('Numpad7'); await t.wait(300);
  assert(await t.top(0) === 'PlayerSelectScene' && await t.top(1) === 'PlayerSelectScene', 'both at player select');
  await t.shot('02-select');

  await t.press('KeyQ'); await t.press('Numpad7'); await t.wait(400);
  assert(await t.top(0) === 'PickPokemonScene' && await t.top(1) === 'PickPokemonScene', 'new children pick a first Pokémon');
  await t.shot('03-pick');

  // P1: one right (Pikachu), pick, confirm
  await t.press('KeyD'); await t.wait(200);
  await t.press('KeyQ'); await t.wait(300);
  await t.shot('04-confirm-p1');
  await t.press('KeyQ'); await t.wait(300);
  // P2: Eevee → the Eeveelution screen → Flareon (2nd) → confirm
  await t.press('Numpad7'); await t.wait(300);
  assert(await t.top(1) === 'EeveelutionScene', 'Eevee asks for an Eeveelution');
  await t.press('Numpad6'); await t.wait(200);
  await t.shot('05-eeveelution');
  await t.press('Numpad7'); await t.wait(300);
  await t.shot('06-confirm-p2');
  await t.press('Numpad7'); await t.wait(600);
  assert(await t.top(0) === 'FarmScene' && await t.top(1) === 'FarmScene', 'both reach the farm');
  await t.shot('07-farm');

  const save = await t.eval(() => JSON.parse(localStorage.getItem('pokemon-race-save')));
  const [a, b] = save.profiles.map(p => p.pokemon[0]);
  assert(a && a.species === 'PIKACHU' && a.branch === null, 'P1 has Pikachu');
  assert(b && b.species === 'EEVEE' && b.branch === 'FLAREON', 'P2 has an Eevee going for Flareon');
  assert(a.stats.speed === 18 && a.stats.strength === 11 && a.stats.defense === 8, 'Pikachu starts at base × 0.2');
  assert(Object.keys(save.profiles[0].overrides).length === 0, 'no overrides saved by default');

  // P1 leaves: Tab opens the menu (🎒 / 🚪, the arrow on 🚪); B stays, A on 🚪 goes; P2's child is taken
  await t.press('Tab'); await t.wait(200);
  assert(await t.top(0) === 'FarmMenuScene', 'Tab opens the farm menu');
  await t.press('KeyE'); await t.wait(200);
  assert(await t.top(0) === 'FarmScene', 'B stays on the farm');
  await t.press('Tab'); await t.wait(200); await t.press('KeyQ'); await t.wait(300);
  assert(await t.top(0) === 'PlayerSelectScene', '🚪 goes back to player select');
  await t.press('KeyD'); await t.press('KeyQ'); await t.wait(300);
  assert(await t.top(0) === 'PlayerSelectScene', "can't take the other half's child");
  await t.shot('08-taken');

  // P1 back in: Pikachu already picked, so straight home
  await t.press('KeyA'); await t.press('KeyQ'); await t.wait(400);
  assert(await t.top(0) === 'FarmScene', 'a child with a Pokémon goes straight to the farm');

  // the Eevee pick list: Pikachu greyed for P1; Eevee still open for P2
  const opts = await t.eval(async () => {
    const { pickOptions } = await import('/src/game/pokemon.js');
    return window.game.players.map(s => pickOptions(s.profile, s.settings).filter(o => !o.open).map(o => o.id));
  });
  assert(JSON.stringify(opts) === '[["PIKACHU"],[]]', 'owned species greyed, Eevee stays open: ' + JSON.stringify(opts));
  console.log('music:', await t.eval(() => window.game.music));

  // ?dev never writes the save
  const before = await t.eval(() => localStorage.getItem('pokemon-race-save'));
  await t.page.goto(new URL(t.page.url()).origin + '/?dev');
  await t.page.waitForFunction(() => window.game && window.game.save, { timeout: 30000 });
  await t.eval(() => { window.game.save.profiles[0].name = 'DEVTEST'; window.game.store(); });
  assert(await t.eval(() => localStorage.getItem('pokemon-race-save')) === before, 'dev mode saves nothing');
  await t.shot('09-dev');
};
