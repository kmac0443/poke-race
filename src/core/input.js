// Two players on one keyboard (plus optional gamepads 1-2).
// Buttons: up down left right a (yes) b (no) start
export const KEYMAPS = [
  { // Player 1 — WASD, Q = yes, E = no
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    a: ['KeyQ'], b: ['KeyE'], start: ['Tab'],
  },
  { // Player 2 — numeric keypad (mirrors WASD + Q/E): 8456 move, 7 = yes, 9 = no
    up: ['Numpad8'], down: ['Numpad5'], left: ['Numpad4'], right: ['Numpad6'],
    a: ['Numpad7'], b: ['Numpad9'], start: ['NumpadEnter', 'Enter'],
  },
];
export const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'start'];
export const KEY_LABELS = [
  'WASD move · Q = yes · E = no · Tab = Menu',
  'Numpad 8456 move · 7 = yes · 9 = no · Enter = Menu',
];

const down = new Set();
const allKeys = new Set(KEYMAPS.flatMap(m => Object.values(m).flat()));

addEventListener('keydown', e => {
  if (allKeys.has(e.code) || e.code === 'Tab') e.preventDefault();
  down.add(e.code);
});
addEventListener('keyup', e => down.delete(e.code));
addEventListener('blur', () => down.clear());

export class PlayerInput {
  constructor(index) {
    this.index = index;
    this.held = {};
    this.prev = {};
    this.repeat = {};
    for (const b of BUTTONS) { this.held[b] = false; this.prev[b] = false; this.repeat[b] = 0; }
    this.locked = false; // when true, all queries return false (used during cutscenes)
  }

  poll() {
    const map = KEYMAPS[this.index];
    const pad = navigator.getGamepads ? navigator.getGamepads()[this.index] : null;
    for (const b of BUTTONS) {
      this.prev[b] = this.held[b];
      let h = map[b].some(k => down.has(k));
      if (pad) h = h || padButton(pad, b);
      this.held[b] = h;
      this.repeat[b] = h ? this.repeat[b] + 1 : 0;
    }
  }

  /** Just pressed this frame. */
  pressed(b) { return !this.locked && this.held[b] && !this.prev[b]; }
  /** Held down. */
  isDown(b) { return !this.locked && this.held[b]; }
  /** Pressed, with key-repeat for menus. */
  repeatPressed(b) {
    if (this.locked) return false;
    const r = this.repeat[b];
    return r === 1 || (r > 18 && r % 5 === 0);
  }
  /** Direction currently held (last-priority: up, down, left, right). */
  dir() {
    if (this.locked) return null;
    for (const d of ['up', 'down', 'left', 'right']) if (this.held[d]) return d;
    return null;
  }
  anyPressed() { return BUTTONS.some(b => this.pressed(b)); }
}

function padButton(pad, b) {
  const btn = i => pad.buttons[i] && pad.buttons[i].pressed;
  const ax = pad.axes || [];
  switch (b) {
    case 'up': return btn(12) || ax[1] < -0.5;
    case 'down': return btn(13) || ax[1] > 0.5;
    case 'left': return btn(14) || ax[0] < -0.5;
    case 'right': return btn(15) || ax[0] > 0.5;
    case 'a': return btn(0);
    case 'b': return btn(1);
    case 'start': return btn(9) || btn(3);
  }
  return false;
}

export function anyKeyDown() { return down.size > 0; }
