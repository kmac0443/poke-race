// A picture of every venue's first race, at the moment your Pokémon reaches its first barrier or trap (for looking
// at: ground, props, obstacles, smashes and clambers). Also checks no venue throws while drawing.
//   node tools/shot.js tools/playtests/race-look.js shots/race-look
const { walkTo, tap } = require('./_walk.js');
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game;
    const pk = givePokemon(g.save.profiles[0], g.players[0].settings, 'RIOLU');
    pk.stats = { speed: 30, strength: 30, defense: 30 };
    g.store();
  });
  await t.page.reload();
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.wait(500);
  await t.press('KeyQ'); await t.wait(200); await t.press('KeyQ'); await t.wait(500);
  const door = await t.eval(() => window.game.hub.places.find(p => p.key === 'race').back);
  await walkTo(t, 0, door[0], door[1]);
  await tap(t, 0, 'up', 200); await t.wait(500);
  const venues = await t.eval(async () => (await import('/src/data/venues.js')).VENUES.map(v => v.id));
  for (let i = 0; i < venues.length; i++) {
    await t.eval(i => { window.game.players[0].top.index = i; }, i);
    await t.press('KeyQ'); await t.wait(300); await t.press('KeyQ'); await t.wait(3400);
    assert(await t.top(0) === 'RaceScene', `${venues[i]}: racing`);
    await t.eval(() => {
      const s = window.game.players[0].top;
      const seg = s.you.sim.timeline.find(x => x.kind !== 'run');
      s.t = seg ? seg.t0 + Math.min(1.2, (seg.t1 - seg.t0) * 0.5) : 8;
    });
    await t.wait(250);
    await t.shot(`${i + 1}-${venues[i]}`);
    await t.eval(() => { window.game.players[0].top.t = 999; });
    await t.wait(1200);
    await t.press('KeyQ'); await t.wait(500);
    assert(await t.top(0) === 'StadiumScene', `${venues[i]}: back to the map`);
  }
};
