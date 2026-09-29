// shared helper: title → setup → names → in game
module.exports = async t => {
  await t.wait(2000);
  await t.press('KeyQ'); await t.wait(300);
  await t.press('KeyQ'); await t.wait(500);
  // pick avatars: P1 Red(A), P2 Leaf(A), P3 move right to May then A
  await t.press('KeyQ'); await t.press('KeyU'); await t.press('Numpad6'); await t.press('Numpad7');
  await t.wait(300);
  // names: press A twice (letters A, A) then start
  for (const [a, st] of [['KeyQ', 'Tab'], ['KeyU', 'Space'], ['Numpad7', 'NumpadEnter']]) { await t.press(a); await t.press(a); await t.press(st); }
  await t.wait(800);
};
