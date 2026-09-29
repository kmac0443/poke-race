// admin.html with a save that's been played: several Pokémon (an Eevee with its branch, one off exploring so
// nobody's active), a math history, trainings. The page must render every section without errors; then the
// parent manages what the child has: give (one of each; a second Eevee), follower, a stat, a goal, remove.
//   node tools/shot.js tools/playtests/admin-played.js shots/admin-played
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const { record, factsForLevel } = await import('/src/game/math.js');
    const g = window.game, [a, b] = g.save.profiles;
    givePokemon(a, g.players[0].settings, 'PIKACHU');
    givePokemon(a, g.players[0].settings, 'EEVEE', 'JOLTEON');
    a.active = null;
    givePokemon(b, g.players[1].settings, 'RIOLU');
    a.pokemon[0].stats.speed = 30; a.pokemon[0].trainings.speed = 3;
    for (const f of factsForLevel(1)) { record(a, f, f.answer, 1200); record(a, f, f.answer + 1, null); }
    a.name = 'Sam'; b.name = 'Alex';
    g.store();
  });
  const page = await t.page.browser().newPage();
  await page.setViewport({ width: 1100, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(new URL(t.page.url()).origin + '/admin.html', { waitUntil: 'networkidle0' });
  await t.wait(300);
  const got = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('#tabs button')].map(b => b.textContent),
    player: document.querySelector('#player').textContent,
    list: document.querySelectorAll('#pokemon .mon').length,
  }));
  await page.screenshot({ path: 'shots/admin-played/01.png', fullPage: true });
  assert(!errors.length, 'no errors: ' + errors.join(' | '));
  assert(got.tabs.join() === 'Sam,Alex', 'tabs show the names');
  assert(/2 Pokémon so far/.test(got.player) && /Jolteon/.test(got.player), 'the player section lists their Pokémon: ' + got.player.trim().slice(-80));
  assert(got.list === 13, 'the pick list renders');

  // ---- managing what they have
  page.on('dialog', d => d.accept());
  const click = async sel => { await page.$eval(sel, e => e.scrollIntoView({ block: 'center' })); await page.click(sel); };
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('pokemon-race-save')).profiles[0]);
  await page.type('#give', 'pika'); await t.wait(150);
  assert(await page.$eval('button[data-give="PIKACHU"]', b => b.disabled), "can't give a second Pikachu");
  await page.click('#give', { clickCount: 3 }); await page.type('#give', 'charm'); await t.wait(150);
  await click('button[data-give="CHARMANDER"]');
  let a = await saved();
  const ch = a.pokemon.find(p => p.species === 'CHARMANDER');
  assert(ch && a.active === ch.uid, 'gave Charmander; nobody was following, so it follows');
  await page.click('#give', { clickCount: 3 }); await page.type('#give', 'eevee'); await t.wait(150);
  await click('button[data-give="EEVEE"]');
  a = await saved();
  const eevees = a.pokemon.filter(p => p.species === 'EEVEE');
  assert(eevees.length === 2 && eevees[1].branch && eevees[1].branch !== 'JOLTEON', 'a second Eevee gets an open branch: ' + eevees[1].branch);
  await click(`button[data-unfollow="${ch.uid}"]`);
  assert((await saved()).active === null, 'Charmander sent exploring');
  await click(`button[data-follow="${ch.uid}"]`);
  assert((await saved()).active === ch.uid, 'Charmander made the follower again');
  await page.$eval(`input[data-uid="${ch.uid}"][data-field="strength"]`, e => e.scrollIntoView({ block: 'center' }));
  await page.click(`input[data-uid="${ch.uid}"][data-field="strength"]`, { clickCount: 3 });
  await page.type(`input[data-uid="${ch.uid}"][data-field="strength"]`, '42'); await page.keyboard.press('Tab');
  assert((await saved()).pokemon.find(p => p.uid === ch.uid).stats.strength === 42, 'Strength edited to 42');
  const ev = eevees[0];
  await page.$eval(`select[data-uid="${ev.uid}"]`, e => e.scrollIntoView({ block: 'center' }));
  await page.select(`select[data-uid="${ev.uid}"]`, 'VAPOREON');
  assert((await saved()).pokemon.find(p => p.uid === ev.uid).branch === 'VAPOREON', "the first Eevee's goal changed to Vaporeon");
  const pika = a.pokemon.find(p => p.species === 'PIKACHU');
  await click(`button[data-drop="${pika.uid}"]`);
  a = await saved();
  assert(!a.pokemon.some(p => p.species === 'PIKACHU'), 'Pikachu removed (after the confirm)');
  const inGame = await t.page.waitForFunction(() => {
    const p = window.game.save.profiles[0];
    return !p.pokemon.some(k => k.species === 'PIKACHU') && p.pokemon.find(k => k.uid === p.active)?.species === 'CHARMANDER';
  }, { timeout: 5000 }).then(() => true, () => false);
  assert(inGame, 'the open game sees it');
  const opts = await t.eval(async () => {
    const { pickOptions } = await import('/src/game/pokemon.js');
    const p = window.game.save.profiles[0];
    return pickOptions(p, window.game.players[0].settings).find(o => o.id === 'PIKACHU').open;
  });
  assert(opts, 'Pikachu can be picked again in the game');
  await page.screenshot({ path: 'shots/admin-played/02-managed.png', fullPage: true });
  assert(!errors.length, 'still no errors: ' + errors.join(' | '));
};
