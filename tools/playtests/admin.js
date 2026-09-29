// admin.html: edit child 1's name, floor, pick list (lookup + add), Eeveelutions; copy to child 2; reset; and check
// that a game open in another tab picks the changes up.
//   node tools/shot.js tools/playtests/admin.js shots/admin
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  const base = new URL(t.page.url()).origin;
  const game = t.page;                       // the game, already loading at /
  await game.waitForFunction(() => window.game && window.game.save, { timeout: 30000 });
  const page = await game.browser().newPage(); // admin in a second tab
  await page.setViewport({ width: 1100, height: 900 });
  const logs = [];
  page.on('pageerror', e => logs.push(e.message));
  await page.goto(base + '/admin.html', { waitUntil: 'networkidle0' });
  // centre an element before clicking it, so the sticky header can't be on top of it
  const click = async sel => { await page.$eval(sel, e => e.scrollIntoView({ block: 'center' })); await page.click(sel); };
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('pokemon-race-save') || 'null'));

  await page.click('#name', { clickCount: 3 }); await page.type('#name', 'Sam'); await page.keyboard.press('Tab');
  await page.select('#floor', '2');
  await page.type('#lookup', 'rapid'); await t.wait(200);
  await click('button[data-add="RAPIDASH"]');
  await click('input[data-eevee="SYLVEON"] + img');
  await page.screenshot({ path: 'shots/admin/01-child1.png', fullPage: true });

  let s = await saved();
  const o = s.profiles[0].overrides;
  assert(s.profiles[0].name === 'Sam', 'name saved');
  assert(o.mathFloor === 2, 'floor saved as an override');
  assert(o.pickList.at(-1) === 'RAPIDASH' && o.pickList.length === 14, 'Rapidash added to the end of the list');
  assert(!o.eeveelutions.includes('SYLVEON') && o.eeveelutions.length === 7, 'Sylveon unticked');
  assert(Object.keys(s.profiles[1].overrides).length === 0, "child 2 untouched");

  // the open game saw it (storage event)
  const seen = await game.waitForFunction(() => { const p = window.game.save.profiles[0]; return p.name === 'Sam' && p.overrides.mathFloor === 2; },
    { timeout: 5000 }).then(() => true, () => false);
  assert(seen, 'the open game picked up the change');

  // child 2: copy the list from Sam
  await click('button[data-child="1"]');
  await click('button[data-copy="pickList"]');
  s = await saved();
  assert(JSON.stringify(s.profiles[1].overrides.pickList) === JSON.stringify(o.pickList), 'list copied to child 2');
  await page.screenshot({ path: 'shots/admin/02-child2.png', fullPage: true });

  // back to child 1: reset the floor; move Rapidash up; remove it → equal to default → override gone
  await click('button[data-child="0"]');
  await click('button[data-reset="mathFloor"]');
  await click('button[data-up="13"]');
  s = await saved();
  assert(!('mathFloor' in s.profiles[0].overrides), 'floor reset to default');
  assert(s.profiles[0].overrides.pickList[12] === 'RAPIDASH', 'moved up');
  await click('button[data-remove="12"]');
  s = await saved();
  assert(!('pickList' in s.profiles[0].overrides), 'list equal to default again → no override');

  // ceiling below the floor can't be chosen
  await page.select('#floor', '3');
  const disabled = await page.$$eval('#ceiling option[disabled]', os => os.map(x => x.value));
  assert(JSON.stringify(disabled) === '["1","2"]', 'ceilings below the floor are disabled');
  console.log(logs.length ? 'admin errors: ' + logs.join('\n') : 'admin: no page errors');
};
