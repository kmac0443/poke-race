// 🏠 A child's house: P1 has a Round Table in the bag, Pikachu following. In through the door (walk mode), Tab →
// edit mode: 🪑 place the table (a wrong answer first: nothing happens, the answer shows; then right: placed), ✋
// move it; back to walking: A on Pikachu → it moves in, A → it follows, B held → it moves in (as on the farm); A on the table (a question) → a snack; 🗑️ put it away; out through
// the door (Pikachu stays off the farm); 🧱 two brick blocks after one answer. P2 visits: can walk about, can't edit.
//   node tools/shot.js tools/playtests/house.js shots/house
const { walkTo, tap } = require('./_walk.js');
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game, [a, b] = g.save.profiles;
    givePokemon(a, g.players[0].settings, 'PIKACHU');
    givePokemon(b, g.players[1].settings, 'RIOLU');
    a.bag = { TABLEROUND: 1 };
    g.store();
  });
  await t.page.reload();
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.wait(500);
  await t.press('KeyQ'); await t.press('Numpad7'); await t.wait(300);
  await t.press('KeyQ'); await t.press('Numpad7'); await t.wait(600);

  const door = await t.eval(() => window.game.hub.places.find(p => p.key === 'home0').back);
  assert(await walkTo(t, 0, door[0], door[1]), 'P1 walks to their house');
  await tap(t, 0, 'up', 300); await t.wait(400);
  assert(await t.top(0) === 'HouseScene', 'into the house');

  const S = () => t.eval(() => {
    const s = window.game.players[0].top, p = window.game.save.profiles[0];
    return { top: s.constructor.name, mode: s.mode, tool: s.tool, cell: s.cell, items: (p.house || { items: [] }).items, bag: p.bag,
      ask: s.fact ? { values: s.values, answer: s.fact.answer, cursor: s.cursor, key: s.fact.key } : null };
  });
  /** Answer the question on screen: `wrongFirst` picks a wrong one first. */
  const answer = async (wrongFirst = false) => {
    await t.wait(100);
    let s = await S();
    assert(s.top === 'MathAskScene', 'a math question comes first');
    const goTo = async i => { for (let k = 0; k < 3 && (await S()).ask.cursor !== i; k++) { await t.press('KeyD'); await t.wait(60); } };
    if (wrongFirst) {
      await goTo(s.ask.values.findIndex(v => v !== s.ask.answer)); await t.press('KeyQ'); await t.wait(200);
      await t.shot('02-wrong');
      await t.wait(1400);
      s = await S();
    }
    await goTo(s.ask.values.indexOf(s.ask.answer)); await t.press('KeyQ'); await t.wait(900);
    return s.ask.key;
  };

  assert((await S()).mode === 'walk', 'in through the door, walking about');
  await t.press('Tab'); await t.wait(150);
  assert((await S()).mode === 'tools', 'Tab: edit mode, the toolbar');

  // 🪑 place the table (the cursor starts where P1 stands: the doormat, which must stay clear)
  await t.press('KeyQ'); await t.wait(150);                    // 🪑
  assert((await S()).mode === 'pick', 'the bag\'s furniture');
  await t.press('KeyQ'); await t.wait(150);                    // the table
  assert((await S()).mode === 'floor', 'steer it about');
  await t.press('KeyD'); await t.wait(80); await t.press('KeyD'); await t.wait(80);
  await t.shot('01-placing');
  await t.press('KeyQ');
  const key = await answer(true);
  let s = await S();
  assert(s.items.length === 1 && s.items[0].item === 'TABLEROUND' && JSON.stringify([s.items[0].x, s.items[0].y]) === '[11,9]', `placed at ${JSON.stringify(s.items)}`);
  assert(!s.bag.TABLEROUND, 'out of the bag');
  const rec = await t.eval(k => window.game.save.profiles[0].math.problems[k], key);
  assert(rec.seen === 1 && rec.wrong === 1, 'the question was recorded once (the first, wrong answer)');
  await t.shot('03-placed');

  // ✋ move it three up
  await t.press('KeyD'); await t.wait(80); await t.press('KeyQ'); await t.wait(150);   // ✋
  assert((await S()).mode === 'select', 'pick a piece');
  await t.press('KeyQ'); await t.wait(150);
  assert((await S()).mode === 'carry', 'lifted');
  for (let k = 0; k < 3; k++) { await t.press('KeyW'); await t.wait(80); }
  await t.press('KeyQ'); await answer();
  s = await S();
  assert(JSON.stringify([s.items[0].x, s.items[0].y]) === '[11,6]', `moved to ${s.items[0].x},${s.items[0].y}`);

  // back to walking; the farm's rules for Pokémon: A facing your follower → it moves in; A facing it → it follows;
  // B held standing still → it moves in again
  await t.press('KeyE'); await t.wait(150);
  assert((await S()).mode === 'walk', 'B: back to walking');
  const pika = () => t.eval(() => { const p = window.game.save.profiles[0]; return { home: !!p.pokemon[0].home, active: p.active }; });
  await t.eval(() => { const s = window.game.players[0].top; s.me.place(9, 8, 'down'); s.follower.place(9, 9, 'down'); });
  await t.wait(100);
  await t.press('KeyQ'); await t.wait(300);
  let pk = await pika();
  assert(pk.home && pk.active === null, 'A facing Pikachu: it moves in, P1 walks alone');
  assert(await t.eval(() => window.game.players[0].top.mons.size) === 1, 'and wanders the room');
  await t.eval(() => { const m = [...window.game.players[0].top.mons.values()][0]; m.wait = 1e9; });
  await t.press('KeyQ'); await t.wait(300);
  pk = await pika();
  assert(!pk.home && pk.active !== null, 'A facing it again: it follows P1');
  await t.page.keyboard.down('KeyE'); await t.wait(500);
  await t.shot('03b-letting-go');
  await t.wait(1200); await t.page.keyboard.up('KeyE'); await t.wait(200);
  pk = await pika();
  assert(pk.home && pk.active === null, 'B held standing still: it moves in (the ring, as on the farm)');

  // use the table: a question, then a snack Pikachu comes running for
  await t.eval(() => { const s = window.game.players[0].top; s.me.place(11, 8, 'up'); });   // just below the table, facing it
  await t.wait(100);
  await t.press('KeyQ'); await answer();
  const used = await t.eval(() => { const s = window.game.players[0].top; return s.using && s.using.use; });
  assert(used === 'snack', `A on the table, after a right answer: a snack (${used})`);
  await t.wait(600);
  await t.shot('04-snack');
  await t.wait(2500);

  // 🧱 walls: a style, a question, then two blocks with A (the cursor starts on P1, so step left first)
  await t.eval(() => { let x = 1; for (const m of window.game.players[0].top.mons.values()) { m.char.place(x++, 1, 'down'); m.wait = 1e9; } });   // the Pokémon who live here, out of the way
  await t.press('Tab'); await t.wait(150);
  for (let k = 0; k < 3; k++) { await t.press('KeyD'); await t.wait(80); }
  await t.press('KeyQ'); await t.wait(150);                    // 🧱
  assert((await S()).mode === 'wallstyle', 'pick a wall style');
  await t.press('KeyD'); await t.wait(80);                     // brick
  await t.press('KeyQ'); await answer();
  assert((await S()).mode === 'build', 'a right answer: building');
  for (let k = 0; k < 3; k++) { await t.press('KeyA'); await t.wait(80); }
  await t.press('KeyQ'); await t.wait(120);
  await t.press('KeyA'); await t.wait(80); await t.press('KeyQ'); await t.wait(120);
  const walls = await t.eval(() => window.game.save.profiles[0].house.walls);
  assert(walls.length === 2 && walls.every(w => w.style === 'brick'), `two brick blocks: ${JSON.stringify(walls)}`);
  await t.shot('04b-walls');
  const wallStops = await t.eval(async () => {
    const { walkable } = await import('/src/game/house.js');
    const g = window.game; return !walkable(g.save.profiles[0], g.players[0].settings, 8, 8);
  });
  assert(wallStops, 'nobody can walk through a wall');
  await t.press('KeyE'); await t.wait(100); await t.press('KeyE'); await t.wait(150);
  assert((await S()).mode === 'walk', 'B, B: back to walking');

  // 🗑️ put the table away (edit mode again)
  await t.press('Tab'); await t.wait(150);
  await t.press('KeyD'); await t.wait(80); await t.press('KeyD'); await t.wait(80);
  await t.press('KeyQ'); await t.wait(150);                    // 🗑️
  for (let k = 0; k < 2; k++) { await t.press('KeyW'); await t.wait(80); }   // the cursor starts on P1 (11,8): up onto the table
  await t.press('KeyQ'); await answer();
  s = await S();
  assert(!s.items.length && s.bag.TABLEROUND === 1, 'put away: back in the bag');

  // out: back to walking, then down through the door
  await t.press('KeyE'); await t.wait(150);
  await t.eval(() => { const s = window.game.players[0].top; s.me.place(9, 10, 'down'); });
  await t.page.keyboard.down('KeyS'); await t.wait(300); await t.page.keyboard.up('KeyS'); await t.wait(500);
  assert(await t.top(0) === 'FarmScene', 'down through the door: out');
  await t.wait(700);
  const onFarm = await t.eval(() => [...window.game.hub.mons.values()].some(m => m.species === 'PIKACHU') || !!window.game.hub.walkers[0].follower.sprite);
  assert(!onFarm, 'Pikachu is not on the farm');

  // P2 visits P1's house: walking about only
  const d0 = await t.eval(() => window.game.hub.places.find(p => p.key === 'home0').back);
  assert(await walkTo(t, 1, d0[0], d0[1]), 'P2 walks to P1\'s house');
  await tap(t, 1, 'up', 300); await t.wait(400);
  assert(await t.top(1) === 'HouseScene', 'P2 visits');
  await t.press('NumpadEnter'); await t.wait(200);
  assert(await t.eval(() => window.game.players[1].top.mode) === 'walk', 'a visitor can\'t edit: Tab does nothing');
  await t.shot('05-visit');
  await t.page.keyboard.down('Numpad5'); await t.wait(300); await t.page.keyboard.up('Numpad5'); await t.wait(500);
  assert(await t.top(1) === 'FarmScene', 'and leaves through the door');
};
