// A seat's view of the farm (the shared home): a camera on game.hub following this player, and this player's
// input for it. Walking into a place opens it; Tab opens 🎒 the bag (hold a treat, A on a Pokémon gives it) or
// 🚪 leave.
import { Scene, text } from '../core/ui.js';
import { se } from '../core/audio.js';
import { TILE } from '../world/tileset.js';
import { FARM } from '../world/hub.js';
import { icon } from './common.js';
import { img, isReady } from '../core/assets.js';
import { SPECIES } from '../game/species.js';
import { activePokemon, picksWaiting } from '../game/pokemon.js';
import { SpeedTrainingScene } from './speedTraining.js';
import { StrengthTrainingScene } from './strengthTraining.js';
import { DefenseTrainingScene } from './defenseTraining.js';
import { StadiumScene } from './stadium.js';
import { TrophyRoomScene } from './trophyRoom.js';
import { LabScene } from './lab.js';
import { ShopScene } from './shop.js';
import { HouseScene } from './house.js';
import { EvolutionScene, BranchScene } from './evolution.js';
import { BagScene } from './bag.js';
import { NEEDS } from '../world/care.js';
import { problemText } from '../game/math.js';
import { needsBranch, readyToEvolve } from '../game/evolution.js';

// What each place opens: key → (seat) => Scene. null = not built yet (bumping into it shows 🚧).
export const PLACE_SCENES = {
  speed: () => new SpeedTrainingScene(), strength: () => new StrengthTrainingScene(), defense: () => new DefenseTrainingScene(), race: () => new StadiumScene(),
  trophy: () => new TrophyRoomScene(), lab: () => new LabScene(), shop: () => new ShopScene(),
  home0: () => new HouseScene(0), home1: () => new HouseScene(1),
};
// Places that are for your follower: with nobody following you, you get a ❔ instead.
const NEEDS_FOLLOWER = new Set(['speed', 'strength', 'defense', 'race']);

const VW = 512, VH = 384;
const LET_GO_FRAMES = 60;   // hold B standing still this long: your follower goes off exploring

export class FarmScene extends Scene {
  constructor() {
    super();
    this.opaque = true;
    this.music = FARM.music;
    this.away = false;      // inside a place (the hub hides this player meanwhile)
    this.joined = false;
    this.bumpCool = 0;
    this.bHold = 0;         // frames B has been held standing still (-1 = let go already; wait for release)
  }
  get hub() { return this.seat.game.hub; }

  update(input) {
    const hub = this.hub, seat = this.seat;
    if (!this.joined) { hub.join(seat, this); this.joined = true; }
    // Left the farm: the close() comes from a promise, which only runs after this frame's steps, so this can
    // still be called in between. (It crashed here once.)
    const w = hub.walker(seat);
    if (!w) return;
    if (this.bumpCool > 0) this.bumpCool--;
    if (!this.growing && hub.frame % 20 === 0 && this.checkGrowth()) return;
    if (input.pressed('start')) {
      se('GUI menu open', 0.6);
      seat.push(new FarmMenuScene()).then(pick => {
        if (pick === 'leave') { hub.leave(seat); this.close(); }
        else if (pick === 'bag') seat.push(new BagScene()).then(() => { this.heldDir = null; });
      });
      return;
    }
    if (input.pressed('a')) hub.interact(seat);
    const dir = input.dir();
    this.held = dir && dir === this.heldDir ? this.held + 1 : 1;
    this.heldDir = dir;
    w.intent = { dir, held: this.held, run: input.isDown('b') };
    // B held while walking is running; held standing still, it lets your follower go (like A facing it)
    if (!input.isDown('b')) this.bHold = 0;
    else if (this.bHold >= 0) {
      const still = !dir && !w.char.moving && w.follower.sprite && !w.follower.moving;
      this.bHold = still ? this.bHold + 1 : 0;
      if (this.bHold >= LET_GO_FRAMES) { hub.letGo(seat); this.bHold = -1; }
    }
  }

  /**
   * The follower's goal: a choice to make first (Kirlia, Gloom…) → the choice; every bar full → it evolves, right
   * here on the farm. Returns true if a scene was pushed.
   */
  checkGrowth() {
    const seat = this.seat, pk = activePokemon(seat.profile);
    if (!pk) return false;
    const scene = needsBranch(pk, seat.settings) ? new BranchScene(pk) : readyToEvolve(pk, seat.settings) ? new EvolutionScene(pk) : null;
    if (!scene) return false;
    this.growing = true;
    seat.push(scene).then(() => { this.growing = false; this.heldDir = null; this.bHold = -1; });
    return true;
  }

  /** The hub calls this when this player walks into a place's entrance. */
  bumpPlace(place) {
    const open = PLACE_SCENES[place.key];
    if (open && NEEDS_FOLLOWER.has(place.key) && !activePokemon(this.seat.profile)) {
      if (this.bumpCool) return;
      this.bumpCool = 40;
      se('GUI sel buzzer');
      const w = this.hub.walker(this.seat);
      this.hub.effects.push({ x: w.char.x, y: w.char.y - 1, icon: '❔', t: 90 });
      return;
    }
    if (!open) {
      if (this.bumpCool) return;
      this.bumpCool = 40;
      se('Player bump');
      const [x, y] = place.cells[Math.floor(place.cells.length / 2)];
      this.hub.effects.push({ x, y, icon: '🚧', t: 50 });
      return;
    }
    this.enter(place, open);
  }

  async enter(place, open) {
    const hub = this.hub, seat = this.seat;
    se('Door enter');
    this.away = true;
    await seat.push(open(seat));
    this.away = false;
    this.heldDir = null;    // the press that walked in doesn't count as still held
    this.bHold = -1;        // nor does a B still held from inside
    if (!hub.walker(seat)) return;
    hub.putWalker(seat.index, ...place.back, place.backDir);
    se('Door exit');
  }

  /**
   * Farm care: a need bubble over every Pokémon that needs something; for each child caring right now, the problem
   * over that Pokémon, the three numbered spots (in the child's colour), and what they're carrying.
   */
  drawCare(g, camX, camY) {
    const hub = this.hub, care = hub.care, at = c => [Math.round(c.px - camX + TILE / 2), Math.round(c.py - camY)];
    const busy = new Set(care.tasks.filter(Boolean).map(t => t.key));
    for (const [key, kind] of care.needs) {
      if (busy.has(key)) continue;
      const c = hub.charFor(key);
      if (!c || c.hidden) continue;
      const [x, y] = at(c), bob = Math.round(Math.sin(hub.frame / 14 + c.x) * 2);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x + 14, y - 14 + bob, 14, 0, Math.PI * 2); g.fill();
      icon(g, NEEDS[kind].icon, x + 14, y - 26 + bob, 18, 'center');
    }
    care.tasks.forEach((t, i) => {
      if (!t) return;
      const color = this.seat.game.players[i].color, c = hub.charFor(t.key);
      for (const sp of t.spots) {
        if (t.carrying === sp) continue;
        const x = sp.x * TILE + TILE / 2 - camX, y = sp.y * TILE - camY;
        g.strokeStyle = color; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y + 26, 15, 6, 0, 0, Math.PI * 2); g.stroke();
        const ic = img(`items/${NEEDS[t.kind].item}.png`);
        if (isReady(ic)) g.drawImage(ic, x - 18, y - 2, 36, 36);
        bubble(g, x, y - 12, String(sp.value), '#303030', 20);
      }
      if (c && !c.hidden) { const [x, y] = at(c); bubble(g, x, y - 26, problemText(t.fact), '#303030', 22); }
      const w = hub.walkers[i];
      if (t.carrying && w && !w.char.hidden) {
        const x = w.char.px - camX + TILE / 2, y = w.char.py - camY - 24;
        const ic = img(`items/${NEEDS[t.kind].item}.png`);
        if (isReady(ic)) g.drawImage(ic, x - 14, y - 22, 28, 28);
        bubble(g, x, y - 30, String(t.carrying.value), color, 18);
      }
    });
  }

  draw(g) {
    const hub = this.hub, map = hub.map, w = hub.walker(this.seat);
    if (!w) { g.fillStyle = '#000'; g.fillRect(0, 0, VW, VH); return; }
    const camX = Math.round(Math.max(0, Math.min(map.w * TILE - VW, w.char.px + TILE / 2 - VW / 2)));
    const camY = Math.round(Math.max(0, Math.min(map.h * TILE - VH, w.char.py + TILE / 2 - VH / 2)));
    const frame = Math.floor(hub.frame / 15);
    g.fillStyle = '#000'; g.fillRect(0, 0, VW, VH);
    map.drawLayer(g, camX, camY, VW, VH, true, frame);
    // who's who: a ring in each player's colour under their feet
    for (const o of hub.walkers) {
      if (!o || o.char.hidden) continue;
      const x = o.char.px - camX + TILE / 2, y = o.char.py - camY + TILE - 5;
      g.strokeStyle = o.seat.color; g.lineWidth = 3;
      g.beginPath(); g.ellipse(x, y, 13, 6, 0, 0, Math.PI * 2); g.stroke();
    }
    const marks = hub.monMarkers();
    for (const { char: c, color } of marks) {      // whose Pokémon: a smaller ring in the owner's colour
      if (c.hidden) continue;
      g.strokeStyle = color; g.lineWidth = 2;
      g.beginPath(); g.ellipse(c.px - camX + TILE / 2, c.py - camY + TILE - 5, 11, 5, 0, 0, Math.PI * 2); g.stroke();
    }
    for (const c of hub.sprites()) c.draw(g, camX, camY);
    map.drawLayer(g, camX, camY, VW, VH, false, frame);
    for (const { char: c, goal } of marks) {       // what it's heading for: a little icon of the evolution
      if (c.hidden || !goal) continue;
      const ic = img(SPECIES.get(goal)?.sprites.icon || '');
      if (!isReady(ic)) continue;
      const x = Math.round(c.px - camX + TILE / 2 - 16), y = Math.round(c.py - camY - 34 + Math.sin(hub.frame / 18 + c.x) * 2);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath(); g.arc(x + 16, y + 16, 15, 0, Math.PI * 2); g.fill();
      g.drawImage(ic, 0, 0, 64, 64, x, y, 32, 32);
    }
    // what each place is: a floating icon in a bubble
    const gift = picksWaiting(this.seat.profile, this.seat.settings) > 0;   // a new Pokémon waits in the lab
    for (const p of hub.places) {
      if (!p.icon || !p.iconAt) continue;
      const waiting = gift && p.key === 'lab';
      const x = Math.round(p.iconAt[0] * TILE + TILE / 2 - camX);
      const y = Math.round(p.iconAt[1] * TILE - camY + (waiting ? -Math.abs(Math.sin(hub.frame / 8)) * 10 : Math.sin(hub.frame / 20) * 3));
      if (x < -40 || y < -40 || x > VW + 40 || y > VH + 40) continue;
      g.fillStyle = waiting ? 'rgba(255,240,120,0.95)' : p.owner !== undefined ? this.seat.game.save.profiles[p.owner].color : 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(x, y + 16, 20, 0, Math.PI * 2); g.fill();
      icon(g, waiting ? '🎁' : p.icon, x, y + 2, 26, 'center');
    }
    if (this.bHold > 10 && w.follower.sprite) {     // letting go: a ring fills over the follower
      const x = w.follower.px - camX + TILE / 2, y = w.follower.py - camY - 20;
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6;
      g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#F8F8F8'; g.lineWidth = 4;
      g.beginPath(); g.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.bHold / LET_GO_FRAMES); g.stroke();
    }
    this.drawCare(g, camX, camY);
    for (const e of hub.effects) {
      const x = Math.round(e.x * TILE + TILE / 2 - camX), y = Math.round(e.y * TILE - camY - 28 - (60 - Math.min(60, e.t)) * 0.4);
      if (e.text) { bubble(g, x, y - 6, e.text, '#D03828'); continue; }
      icon(g, e.icon, x, y, 22, 'center');
    }
    // what each child is holding, over their head
    for (const o of hub.walkers) {
      const item = o && !o.char.hidden && o.seat.profile && o.seat.profile.holding;
      if (!item) continue;
      const ic = img(`items/${item}.png`), x = o.char.px - camX + TILE / 2, y = o.char.py - camY - 30 + Math.sin(hub.frame / 12) * 2;
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.fill();
      if (isReady(ic)) g.drawImage(ic, x - 16, y - 16, 32, 32);
    }
    // a treat just given: that Pokémon's ❤️ friendship bar, filling from before to after
    for (const m of hub.meters) {
      const p = Math.min(1, (150 - m.t) / 50), f = (m.from + (m.to - m.from) * p) / m.max;
      const x = Math.round(m.x * TILE + TILE / 2 - camX), y = Math.round(m.y * TILE - camY - 70);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 34, y - 2, 68, 14);
      g.fillStyle = f >= 1 ? '#F8C820' : '#E86080'; g.fillRect(x - 32, y, Math.round(64 * Math.min(1, f)), 10);
      icon(g, '❤️', x - 48, y - 4, 16);
    }
    g.fillStyle = this.seat.color; g.fillRect(0, 0, VW, 4);
    // this child's coins, for the shop
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(VW - 92, 8, 84, 30);
    icon(g, '🪙', VW - 86, 12, 20);
    text(g, String(this.seat.profile.coins || 0), VW - 58, 10, { size: 24 });
  }
}

/** A white rounded bubble with text in it, centred on (x, y). */
function bubble(g, x, y, str, color = '#303030', size = 22) {
  g.font = `${size}px "Power Clear Bold", sans-serif`;
  const w = Math.max(40, g.measureText(str).width + 18), h = size + 12;
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.strokeStyle = '#484848'; g.lineWidth = 2;
  g.beginPath(); g.roundRect(Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), h, 8); g.fill(); g.stroke();
  text(g, str, x, y - h / 2 + 4, { size, align: 'center', color, family: '"Power Clear Bold"', shadow: null });
}

/** Tab on the farm: 🎒 your bag, or 🚪 leave (the arrow starts on 🚪, so Tab then A still leaves). B closes. */
class FarmMenuScene extends Scene {
  constructor() { super(); this.t = 0; this.index = 1; }
  update(input) {
    this.t++;
    if (input.repeatPressed('left') || input.repeatPressed('right')) { this.index = 1 - this.index; se('GUI sel cursor', 0.4); }
    if (input.pressed('a')) { se('GUI sel decision'); this.close(['bag', 'leave'][this.index]); }
    else if (input.pressed('b') || input.pressed('start')) { se('GUI menu close', 0.6); this.close(null); }
  }
  draw(g) {
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, VW, VH);
    g.fillStyle = '#F8F8F0'; g.fillRect(136, 132, 240, 120);
    g.strokeStyle = this.seat.color; g.lineWidth = 4; g.strokeRect(138, 134, 236, 116);
    ['🎒', '🚪'].forEach((ic, k) => {
      const x = 196 + k * 120, sel = k === this.index;
      if (sel) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x - 46, 148, 92, 88); g.strokeStyle = this.seat.color; g.lineWidth = 4; g.strokeRect(x - 46, 148, 92, 88); }
      icon(g, ic, x, 164 + (sel ? Math.round(Math.sin(this.t / 6) * 2) : 0), 48, 'center');
    });
  }
}
