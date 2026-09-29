// admin.html's "Bag and house": + / − change what's in a child's bag, ↩ takes placed furniture back into the bag,
// and the walls can all be knocked down. Every change is saved.
//   node tools/shot.js tools/playtests/admin-house.js shots/admin-house
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.save, { timeout: 30000 });
  await t.eval(() => {
    const g = window.game, a = g.save.profiles[0];
    a.name = 'Sam';
    a.bag = { LAVACOOKIE: 2 };
    a.house = { items: [{ item: 'TABLEROUND', x: 3, y: 3 }, { item: 'TABLEROUND', x: 7, y: 3 }], walls: [{ x: 1, y: 1, style: 'wood' }, { x: 2, y: 1, style: 'brick' }] };
    g.store();
  });
  const page = await t.page.browser().newPage();
  await page.setViewport({ width: 1100, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(new URL(t.page.url()).origin + '/admin.html', { waitUntil: 'networkidle0' });
  await t.wait(300);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('pokemon-race-save')).profiles[0]);
  const click = async sel => {
    await page.evaluate(q => document.querySelector(q).scrollIntoView({ block: 'center' }), sel);
    await page.click(sel); await t.wait(150);
  };
  assert((await page.$$('#house .thing')).length >= 30, 'every treat and piece of furniture is listed');
  await page.evaluate(() => document.querySelector('#house').scrollIntoView());
  await page.screenshot({ path: process.argv[3] + '/01-house.png' });

  await click('#house button[data-bag="BED"][data-n="1"]');
  await click('#house button[data-bag="BED"][data-n="1"]');
  assert((await saved()).bag.BED === 2, '+ + : two beds in the bag');
  await click('#house button[data-bag="LAVACOOKIE"][data-n="-1"]');
  await click('#house button[data-bag="LAVACOOKIE"][data-n="-1"]');
  let s = await saved();
  assert(!('LAVACOOKIE' in s.bag), '− − : the cookies are gone');

  await click('#house button[data-unplace="TABLEROUND"]');
  s = await saved();
  assert(s.house.items.length === 0 && s.bag.TABLEROUND === 2, '↩ : both tables back in the bag');

  await click('#house button[data-clearwalls]');
  s = await saved();
  assert(s.house.walls.length === 0, 'the walls are knocked down');
  assert(!errors.length, 'no errors: ' + errors.join(' | '));
  await page.close();
};
