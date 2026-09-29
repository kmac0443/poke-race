// Flash cards on admin.html, and goals for species outside the default lines. P1 has played ~60 problems (one
// fact always missed) and owns a Vulpix: the Vulpix's goal is Ninetales (the trophy card has one); the admin page
// shows the problem count, the next 5, a grid per level with the missed fact in box 0; clicking a fact resets it.
//   node tools/shot.js tools/playtests/admin-cards.js shots/admin-cards
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  const goal = await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const { nextProblem, record } = await import('/src/game/math.js');
    const { evolutionGoal } = await import('/src/game/evolution.js');
    const g = window.game, a = g.save.profiles[0], s = g.players[0].settings;
    const pk = givePokemon(a, s, 'VULPIX');
    let last = null;
    for (let i = 0; i < 60; i++) { const f = nextProblem(a, s, last); record(a, f, f.key === '2+1' ? 4 : f.answer, 1500, s); last = f; }
    a.name = 'Sam';
    g.store();
    const goal = evolutionGoal(pk, s);
    return goal && { into: goal.into, parts: goal.parts.map(p => p.icon + p.need) };
  });
  assert(goal && goal.into === 'NINETALES', `Vulpix heads for Ninetales: ${JSON.stringify(goal)}`);

  const page = await t.page.browser().newPage();
  await page.setViewport({ width: 1100, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(new URL(t.page.url()).origin + '/admin.html', { waitUntil: 'networkidle0' });
  await t.wait(300);
  const got = await page.evaluate(() => ({
    summary: document.querySelector('#cards .fc-summary').textContent.replace(/\s+/g, ' '),
    next: [...document.querySelectorAll('#cards .fc-next span')].map(s => s.textContent),
    open: [...document.querySelectorAll('#cards details[open]')].map(d => d.dataset.level),
    missed: document.querySelector('#cards .fc[data-fact="2+1"]')?.className,
    tip: document.querySelector('#cards .fc[data-fact="2+1"]')?.title,
    cells: document.querySelectorAll('#cards details[data-level="1"] .fc').length,
    goal: document.querySelector('#owned')?.textContent.includes('Ninetales'),
  }));
  assert(!errors.length, 'no errors: ' + errors.join(' | '));
  assert(/60\s*problems answered/.test(got.summary), 'the problem count: ' + got.summary.slice(0, 60));
  assert(got.next.length === 5, `the next 5: ${got.next.join(' ')}`);
  assert(got.open.includes('1'), 'the current level is open');
  assert(got.cells === 10, 'level 1 shows its 10 facts');
  assert(/\bb0\b/.test(got.missed || ''), `the always-missed fact is in box 0 (${got.missed})`);
  assert(/wrong answers picked: 4/.test(got.tip || ''), 'its tooltip shows the wrong pick');
  await page.evaluate(() => document.querySelector('#cards').scrollIntoView());
  await page.screenshot({ path: process.argv[3] + '/01-cards.png' });

  await page.click('#cards .fc[data-fact="2+1"]');
  await t.wait(300);
  const after = await page.evaluate(() => ({
    saved: '2+1' in JSON.parse(localStorage.getItem('pokemon-race-save')).profiles[0].math.problems,
    cls: document.querySelector('#cards .fc[title^="2 + 1"]')?.className,
  }));
  assert(!after.saved && after.cls === 'fc' || after.cls === 'fc queued', `clicking resets it (${after.cls})`);
  await page.close();
};
