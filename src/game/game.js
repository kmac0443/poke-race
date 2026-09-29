// The game: two seats (the two halves of the screen), the save, and the farm both players share (hub).
// A seat is a place at the keyboard; a profile is a child. Each seat picks a profile on its player-select screen,
// and a profile can only be in one seat at a time. window.game.players[i] is seat i (tools/shot.js relies on it).
import { PlayerInput } from '../core/input.js';
import { requestBgm } from '../core/audio.js';
import { loadSave, writeSave, SAVE_KEY } from './save.js';
import { settingsFor } from './settings.js';
import { Hub } from '../world/hub.js';

export const SEAT_COLORS = ['#E04838', '#3870E0'];   // before a child sits down; then it's the child's colour

export class Seat {
  constructor(game, index) {
    this.game = game;
    this.index = index;
    this.input = new PlayerInput(index);
    this.stack = [];
    this.profileIndex = null;
    this.activeAt = undefined; // frame of the last button press (for music)
  }
  get top() { return this.stack[this.stack.length - 1] || null; }
  get color() { return (this.profile && this.profile.color) || SEAT_COLORS[this.index]; }
  get profile() { return this.profileIndex === null ? null : this.game.save.profiles[this.profileIndex]; }
  get settings() { return settingsFor(this.profile); }

  /** Push a scene; resolves with the value it closes with. */
  push(scene) {
    scene.seat = this;
    this.stack.push(scene);
    return new Promise(res => { scene.resolve = res; });
  }

  update() {
    this.input.poll();
    if (this.input.anyPressed()) this.activeAt = this.game.frame;
    const top = this.top;
    if (top) top.update(this.input);
    this.stack = this.stack.filter(s => !s.done);
  }

  draw(g) {
    let from = 0;
    for (let k = this.stack.length - 1; k >= 0; k--) if (this.stack[k].opaque) { from = k; break; }
    for (let k = from; k < this.stack.length; k++) this.stack[k].draw(g);
  }

  /** The song for where this seat is: the topmost scene that names one. */
  get song() {
    for (let k = this.stack.length - 1; k >= 0; k--) if (this.stack[k].music) return this.stack[k].music;
    return null;
  }
}

export class Game {
  constructor() {
    this.frame = 0;
    this.save = loadSave();
    this.players = [new Seat(this, 0), new Seat(this, 1)];
    this.hub = new Hub(this);
    this.music = null;
    this.musicSince = 0;
    // admin.html (another tab) changed the save: take its version
    addEventListener('storage', e => { if (e.key === SAVE_KEY) this.save = loadSave(); });
  }

  store() { writeSave(this.save); }

  /** Which seat (if any) has profile i. */
  seatWith(profileIndex) { return this.players.find(s => s.profileIndex === profileIndex) || null; }

  update() {
    this.frame++;
    for (const s of this.players) s.update();
    this.hub.update();
    this.updateMusic();
  }

  // One speaker, two players: the song goes where most of the recently active players are, a tie keeps the
  // current song, and a new song stays at least 8 s. (From the RPG, where following whoever acted last made the
  // music flip constantly.)
  updateMusic() {
    const now = this.frame;
    const active = this.players.filter(p => p.song && p.activeAt !== undefined && now - p.activeAt < 60 * 30);
    const who = active.length ? active : this.players.filter(p => p.song);
    const counts = new Map();
    for (const p of who) counts.set(p.song, (counts.get(p.song) || 0) + 1);
    if (!counts.size) return;
    const cur = this.music, top = Math.max(...counts.values());
    let song = cur;
    if (!counts.has(cur) || (counts.get(cur) < top && now - this.musicSince > 60 * 8)) {
      song = who.map(p => p.song).find(s => counts.get(s) === top);
    }
    if (song !== cur) { this.music = song; this.musicSince = now; }
    requestBgm('place', this.music, 0);
  }
}
