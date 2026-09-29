// The farm: both children walk in; everyone's other Pokémon explore the farm; the trophy house opens and closes;
// P1 picks an exploring Pokémon to follow; a place opens and returns you to its entrance; P1 lets the follower go
// exploring and then can't enter the track (❔) until picking one again; P2 holds B to let theirs go; leaving sends
// the follower exploring.
// Also saves a picture of the whole farm (farm-map.png).
//   node tools/shot.js tools/playtests/farm.js shots/farm
const fs = require('fs');
const path = require('path');
const { walkTo, tap, at } = require('./_walk.js');
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };

module.exports = async t => {
  const out = process.argv[3];
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  // a save: P1 has Pikachu (following) and Charmander; P2 has an Eevee heading for Flareon
  await t.eval(async () => {
    const { givePokemon } = await import('/src/game/pokemon.js');
    const g = window.game, [a, b] = g.save.profiles;
    givePokemon(a, g.players[0].settings, 'CHARMANDER');
    givePokemon(a, g.players[0].settings, 'PIKACHU');
    givePokemon(b, g.players[1].settings, 'EEVEE', 'FLAREON');
    g.store();
  });
  await t.page.reload();
  await t.page.waitForFunction(() => window.game && window.game.hub, { timeout: 30000 });
  await t.wait(500);
  await t.press('KeyQ'); await t.press('Numpad7'); await t.wait(300);
  await t.press('KeyQ'); await t.press('Numpad7'); await t.wait(600);
  assert(await t.top(0) === 'FarmScene' && await t.top(1) === 'FarmScene', 'both children are on the farm');

  const pen = () => t.eval(() => [...window.game.hub.mons.values()].map(m => m.species).sort().join(','));
  assert(await pen() === 'CHARMANDER', 'the Pokémon nobody is walking with is exploring');
  await t.shot('01-arrive');

  // every place is built: nothing shows 🚧 any more (PLACE_SCENES has no nulls)
  assert(await t.eval(async () => { const { PLACE_SCENES } = await import('/src/scenes/farm.js'); return Object.values(PLACE_SCENES).every(f => f); }), 'every place opens something');
  // the trophy house: in through the door, B back out
  const trophy = await t.eval(() => window.game.hub.places.find(p => p.key === 'trophy').back);
  assert(await walkTo(t, 0, trophy[0], trophy[1]), 'P1 walks to the trophy house door');
  await tap(t, 0, 'up'); await t.wait(400);
  assert(await t.top(0) === 'TrophyRoomScene', 'the trophy house opens');
  await t.shot('02-trophy-house');
  await t.press('KeyE'); await t.wait(300);
  assert(await t.top(0) === 'FarmScene', 'and B comes back out');

  // P2 goes for a walk down the road meanwhile
  assert(await walkTo(t, 1, 30, 13), 'P2 walks along the road');

  // swap: freeze Charmander, walk up to it, press A
  const ch = await t.eval(() => { const m = [...window.game.hub.mons.values()].find(m => m.species === 'CHARMANDER'); m.wait = 1e9; return [m.char.x, m.char.y]; });
  const spots = await t.eval(([x, y]) => {
    const hub = window.game.hub;
    return [['up', x, y + 1], ['down', x, y - 1], ['left', x + 1, y], ['right', x - 1, y]].filter(([, sx, sy]) => hub.canRoam(sx, sy) && !hub.monAt(sx, sy));
  }, ch);
  let swapped = false;
  for (const [dir, sx, sy] of spots) {
    if (!(await walkTo(t, 0, sx, sy))) continue;
    await tap(t, 0, dir); await t.wait(100);
    await t.press('KeyQ'); await t.wait(300);
    swapped = true; break;
  }
  assert(swapped, 'P1 reaches Charmander');
  const active = await t.eval(() => { const p = window.game.save.profiles[0]; return p.pokemon.find(k => k.uid === p.active).species; });
  assert(active === 'CHARMANDER', 'Charmander now follows P1');
  assert(await pen() === 'PIKACHU', 'Pikachu went exploring in its place');
  await t.shot('03-swapped');

  // a place that exists: register a stand-in scene for the track, walk out east, come back
  await t.eval(async () => {
    const { PLACE_SCENES } = await import('/src/scenes/farm.js');
    const { Scene } = await import('/src/core/ui.js');
    window.realSpeed = PLACE_SCENES.speed;
    window.StandIn = class StandIn extends Scene {
      constructor() { super(); this.opaque = true; }
      update(input) { if (input.pressed('b')) this.close(); }
      draw(g) { g.fillStyle = '#F8C820'; g.fillRect(0, 0, 512, 384); }
    };
    PLACE_SCENES.speed = () => new window.StandIn();
  });
  assert(await walkTo(t, 0, 38, 13), 'P1 walks to the end of the road');
  await tap(t, 0, 'right'); await t.wait(300);
  assert(await t.top(0) === 'StandIn', 'walking out east opens the track');
  assert(await t.eval(() => window.game.hub.walkers[0].char.hidden), 'P1 is gone from the farm while inside');
  await t.shot('04-inside');
  await t.press('KeyE'); await t.wait(300);
  assert(await t.top(0) === 'FarmScene', 'back on the farm');
  assert(JSON.stringify(await at(t, 0)) === '[37,13]', 'at the track entrance');
  await t.eval(async () => { const { PLACE_SCENES } = await import('/src/scenes/farm.js'); PLACE_SCENES.speed = window.realSpeed; });

  // let the follower go: back out of the track P1 faces left with the follower behind (right); a quick tap on
  // right only turns P1 round to face it; then A
  // (headless Chrome runs frames in bursts, so a key tap's length can't be controlled: drive the rule directly)
  const turned = await t.eval(() => {
    const hub = window.game.hub, w = hub.walkers[0];
    w.intent = { dir: 'right', held: 1, run: false }; hub.updateWalker(w);
    return [w.char.dir, w.char.x, w.char.moving];
  });
  assert(JSON.stringify(turned) === '["right",37,false]', 'a quick tap turns a standing player without a step: ' + turned);
  await t.wait(100);
  const face = await t.eval(() => { const w = window.game.hub.walkers[0]; return [w.char.dir, w.char.x, w.char.y, w.follower.x, w.follower.y]; });
  assert(JSON.stringify(face) === '["right",37,13,38,13]', 'a quick tap turned P1 to face the follower without stepping: ' + face);
  await t.press('KeyQ'); await t.wait(300);
  assert(await t.eval(() => window.game.save.profiles[0].active === null), 'the follower went exploring');
  assert(await pen() === 'CHARMANDER,PIKACHU', "both of P1's Pokémon are exploring");
  await t.shot('05-alone');
  // nobody following: the track won't open
  // (the one just let go stands in the way until it wanders off: wait for the road's end to be free, then bump)
  await t.page.waitForFunction(() => !window.game.hub.monAt(38, 13), { timeout: 10000 });
  assert(await walkTo(t, 0, 38, 13), 'P1 back to the end of the road');
  const saw = t.page.waitForFunction(() => window.game.hub.effects.some(e => e.icon === '❔'), { timeout: 4000, polling: 'raf' }).then(() => true, () => false);
  await tap(t, 0, 'right', 200); await t.wait(200);
  assert(await t.top(0) === 'FarmScene', 'no follower: the track stays shut');
  assert(await saw, 'a ❔ says why');

  // P2 holds B standing still: the follower goes exploring (a ring fills over it first)
  assert(await t.eval(() => window.game.save.profiles[1].active !== null), 'P2 has a follower');
  await t.hold('Numpad9', 300);
  assert(await t.eval(() => window.game.save.profiles[1].active !== null), 'a short B does nothing');
  await t.page.keyboard.down('Numpad9'); await t.wait(700);
  const filling = await t.eval(() => window.game.players[1].stack.find(s => s.constructor.name === 'FarmScene').bHold);
  await t.shot('06a-letting-go');
  await t.wait(1200); await t.page.keyboard.up('Numpad9'); await t.wait(100);
  assert(filling > 10, `the ring was filling (${filling})`);
  assert(await t.eval(() => window.game.save.profiles[1].active === null), "holding B let P2's follower go");

  // P1 leaves: P1's Pokémon explore
  await t.press('Tab'); await t.wait(200); await t.press('KeyQ'); await t.wait(300);
  assert(await t.top(0) === 'PlayerSelectScene', 'P1 left');
  assert(await pen() === 'CHARMANDER,EEVEE,PIKACHU', "P1's Pokémon stay exploring (with P2's Eevee)");
  await t.shot('06-left');

  // the whole farm, for looking at
  const png = await t.eval(() => {
    const hub = window.game.hub, map = hub.map;
    const c = document.createElement('canvas'); c.width = map.w * 32; c.height = map.h * 32;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    map.drawLayer(g, 0, 0, c.width, c.height, true, 0);
    for (const s of hub.sprites()) s.draw(g, 0, 0);
    map.drawLayer(g, 0, 0, c.width, c.height, false, 0);
    return c.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync(path.join(out, 'farm-map.png'), Buffer.from(png, 'base64'));
  console.log('saved farm-map.png');
};
