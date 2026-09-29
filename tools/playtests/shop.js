// 🛒 The shop and the 🎒 bag: P1 has 30 🪙. Buy a Lava Cookie (10): coins go down, it's in the bag (saved). The
// Poké Doll (40) is too dear. Out on the farm: Tab → 🎒 → the cookie → P1 holds it; A facing Pikachu gives it:
// friendship +9, the bag is empty, P1's hands too.
//   node tools/shot.js tools/playtests/shop.js shots/shop
const { walkTo, tap } = require('./_walk.js');
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game, [a] = g.save.profiles;
    givePokemon(a, g.players[0].settings, 'PIKACHU');
    a.coins = 30;
    g.store();
  });
  await t.page.reload();
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.wait(500);
  await t.press('KeyQ'); await t.wait(300); await t.press('KeyQ'); await t.wait(600);
  assert(await t.top(0) === 'FarmScene', 'P1 is on the farm');

  const door = await t.eval(() => window.game.hub.places.find(p => p.key === 'shop').back);
  assert(await walkTo(t, 0, door[0], door[1]), 'P1 walks to the shop door');
  await tap(t, 0, 'up', 300); await t.wait(400);
  assert(await t.top(0) === 'ShopScene', 'into the shop');

  const state = () => t.eval(() => {
    const p = window.game.save.profiles[0], s = window.game.players[0].top;
    return { coins: p.coins, bag: p.bag, holding: p.holding, friendship: p.pokemon[0].friendship,
      item: s.shelves ? s.shelves()[s.shelf].items[s.cursor].item : null, saved: JSON.parse(localStorage.getItem('pokemon-race-save')).profiles[0] };
  });
  await t.press('KeyD'); await t.wait(100); await t.press('KeyD'); await t.wait(100);
  let s = await state();
  assert(s.item === 'LAVACOOKIE', 'the cursor is on the Lava Cookie');
  await t.press('KeyQ'); await t.wait(200);
  await t.shot('01-buying');
  await t.wait(800);
  s = await state();
  assert(s.coins === 20 && s.bag.LAVACOOKIE === 1, `bought: ${s.coins} coins left, bag ${JSON.stringify(s.bag)}`);
  assert(s.saved.bag.LAVACOOKIE === 1, 'and saved');
  assert(s.friendship === 0, 'buying gives nothing yet (it waits in the bag)');
  await t.press('KeyS'); await t.wait(100);
  s = await state();
  assert(s.item === 'POKEDOLL', 'the cursor is on the Poké Doll');
  await t.press('KeyQ'); await t.wait(600);
  s = await state();
  assert(s.coins === 20 && !s.bag.POKEDOLL, 'too dear: nothing changes');
  await t.shot('02-shop');
  // down through the shelves to the last piece of furniture: the shelf scrolls so the one picked is always in view
  const view = () => t.eval(() => {
    const s = window.game.players[0].top, top = s.topRow(), row = Math.floor(s.cursor / 3) - top;
    return { shelf: s.shelf, cursor: s.cursor, n: s.shelves()[s.shelf].items.length, top, visible: row >= 0 && row < 2 };
  });
  let v, allVisible = true, scrolled = false;
  for (let k = 0; k < 10; k++) {
    await t.press('KeyS'); await t.wait(80);
    v = await view();
    allVisible = allVisible && v.visible; scrolled = scrolled || v.top > 0;
  }
  assert(v.shelf === 1 && Math.floor(v.cursor / 3) === Math.floor((v.n - 1) / 3), `down and down: the furniture shelf's last row (piece ${v.cursor + 1} of ${v.n})`);
  assert(allVisible && scrolled, 'the shelf scrolled, and the one picked was always in view');
  await t.shot('02b-shop-scrolled');
  for (let k = 0; k < 10; k++) { await t.press('KeyW'); await t.wait(80); v = await view(); allVisible = allVisible && v.visible; }
  assert(v.shelf === 0 && v.top === 0 && allVisible, 'and back up to the top, in view all the way');
  await t.press('KeyE'); await t.wait(400);
  assert(await t.top(0) === 'FarmScene', 'B leaves the shop');

  // hold it: Tab → ← 🎒 → A → A
  await t.press('Tab'); await t.wait(200);
  assert(await t.top(0) === 'FarmMenuScene', 'Tab opens the farm menu');
  await t.press('KeyA'); await t.wait(100); await t.press('KeyQ'); await t.wait(300);
  assert(await t.top(0) === 'BagScene', '🎒 opens the bag');
  await t.shot('03-bag');
  await t.press('KeyQ'); await t.wait(300);
  s = await state();
  assert(s.holding === 'LAVACOOKIE' && await t.top(0) === 'FarmScene', 'P1 holds the cookie, back on the farm');

  // give it: step away from the door so Pikachu falls in behind, turn to face it, press A
  await tap(t, 0, 'down', 300); await t.wait(500);
  await tap(t, 0, 'down', 300); await t.wait(500);
  const turned = await t.eval(() => {
    const hub = window.game.hub, w = hub.walkers[0];
    const dx = w.follower.x - w.char.x, dy = w.follower.y - w.char.y;
    const dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
    w.intent = { dir, held: 1, run: false }; hub.updateWalker(w);
    return dir;
  });
  await t.wait(200);
  await t.shot('04-holding');
  await t.press('KeyQ'); await t.wait(500);
  await t.shot('05-given');
  s = await state();
  assert(s.friendship === 9, `given (facing ${turned}): friendship +9 → ${s.friendship}`);
  assert(!s.bag.LAVACOOKIE && s.holding === null, 'the bag and P1\'s hands are empty');
  assert(s.saved.pokemon[0].friendship === 9, 'saved');
  assert(await t.eval(() => window.game.save.profiles[0].active !== null), 'giving did not send Pikachu off exploring');
};
