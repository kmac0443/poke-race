// Farm care (DESIGN.md "Caring is math with your feet"). Pokémon get needs from training (game/needs.js: every
// needsEverySessions sessions, the one that trained: 🍎 hungry, 💧 thirsty, ⚽ wants to play, ✨ wants brushing),
// saved on the child's profile. Never with the clock: nothing gets hungry while the children are away.
//
// Walk up to one (anyone's: looking after your sibling's is how the farm is co-op) and press A: a problem from
// *your* math engine appears over it, and three bowls / baskets / toy boxes / brushes appear a few steps away,
// each with an answer. Walk to the right one and press A (standing on it or facing it) to pick it up; walk back
// and press A facing the Pokémon to give it. Right → hearts and friendship (careFriendship) for that Pokémon.
// Wrong → it shakes its head, the right answer shows, and you try again (only the first answer is recorded).
import { nextProblem, choices, record, problemText } from '../game/math.js';
import { se, cry } from '../core/audio.js';
import { SPECIES } from '../game/species.js';
import { DIRS } from './map.js';
import { needOf, meetNeed } from '../game/needs.js';

// icon: the need's bubble; item: what the spots hold (assets/items/<item>.png)
export const NEEDS = {
  food: { icon: '🍎', item: 'ORANBERRY' },
  drink: { icon: '💧', item: 'FRESHWATER' },
  play: { icon: '⚽', item: 'POKETOY' },
  brush: { icon: '✨', item: 'SILKSCARF' },
};

export class FarmCare {
  constructor(hub) {
    this.hub = hub;
    this.tasks = [null, null];   // per seat: { key, kind, fact, spots: [{ x, y, value }], carrying, first, shownAt, lastFact }
    this.lastFact = [null, null];
  }

  leave(seat) { this.drop(seat.index); }

  needOf(pi, uid) { const pr = this.hub.game.save.profiles[pi]; return pr ? needOf(pr, uid) : null; }

  /** Every need on the farm right now: `${profileIndex}:${uid}` → kind (for drawing). */
  get needs() {
    const out = new Map();
    this.hub.game.save.profiles.forEach((pr, pi) => { for (const [uid, kind] of Object.entries(pr.needs || {})) out.set(`${pi}:${uid}`, kind); });
    return out;
  }

  /** A pressed on the farm. Returns true if care used it. `target`: the Pokémon faced (hub.pokemonAt), or null. */
  interact(seat, target) {
    const w = this.hub.walker(seat), task = this.tasks[seat.index];
    if (task) {
      if (!task.carrying) {                                   // pick up the one you're on or facing
        const f = w.char.facing();
        const spot = task.spots.find(s => (s.x === w.char.x && s.y === w.char.y) || (s.x === f.x && s.y === f.y));
        if (spot) { task.carrying = spot; se('GUI sel decision', 0.6); return true; }
      } else if (target && `${target.pi}:${target.pk.uid}` === task.key) return this.deliver(seat, task, target);
      if (target && `${target.pi}:${target.pk.uid}` === task.key) { se('GUI sel cursor', 0.4); return true; }   // go and fetch it
      return false;
    }
    if (!target) return false;
    const kind = this.needOf(target.pi, target.pk.uid);
    if (!kind || this.tasks.some(t => t && t.key === `${target.pi}:${target.pk.uid}`)) return false;
    return this.start(seat, target, kind);
  }

  start(seat, target, kind) {
    const fact = nextProblem(seat.profile, seat.settings, this.lastFact[seat.index]);
    this.lastFact[seat.index] = fact;
    const spots = this.spotsAround(target.x, target.y, 3);
    if (spots.length < 3) return false;
    const values = choices(fact, 3);
    spots.forEach((s, i) => { s.value = values[i]; });
    if (target.mon) { target.mon.wait = 1e9; target.mon.char.dir = 'down'; }
    this.tasks[seat.index] = { key: `${target.pi}:${target.pk.uid}`, kind, fact, spots, carrying: null, first: true, shownAt: this.hub.frame, mon: target.mon };
    se('GUI sel decision');
    cry(SPECIES.get(target.pk.species)?.sprites.cry, 0.6);
    return true;
  }

  deliver(seat, task, target) {
    const ok = task.carrying.value === task.fact.answer;
    if (task.first) record(seat.profile, task.fact, task.carrying.value, (this.hub.frame - task.shownAt) * 1000 / 60, seat.settings);
    task.first = false;
    const { x, y } = target, hub = this.hub;
    if (!ok) {                                               // a shake of the head; the answer; try again
      task.carrying = null;
      se('Player bump');
      hub.effects.push({ x, y, icon: '❌', t: 50 });
      hub.effects.push({ x, y: y - 1.6, text: `${problemText(task.fact)} = ${task.fact.answer}`, t: 90 });
      return true;
    }
    const pk = target.pk, max = seat.settings.friendshipMax, from = pk.friendship;
    pk.friendship = Math.min(max, from + seat.settings.careFriendship);
    meetNeed(hub.game.save.profiles[target.pi], pk.uid);
    hub.game.store();
    cry(SPECIES.get(pk.species)?.sprites.cry, 0.9);
    se('Pkmn exp full', 0.5);
    for (let k = 0; k < 4; k++) hub.effects.push({ x: x + (k - 1.5) * 0.4, y: y - k * 0.15, icon: '❤️', t: 60 + k * 8 });
    hub.meters.push({ x, y, from, to: pk.friendship, max, t: 150 });
    this.drop(seat.index);
    return true;
  }

  /** Stop a task (done, or the child left): the spots go and the Pokémon wanders again. */
  drop(i) {
    const t = this.tasks[i];
    if (t && t.mon) t.mon.wait = 40;
    this.tasks[i] = null;
  }

  /** Three free tiles 3–6 steps' walk from (x, y), spread apart. */
  spotsAround(x, y, n) {
    const hub = this.hub, map = hub.map, dist = new Map([[`${x},${y}`, 0]]);
    let q = [[x, y]], found = [];
    for (let d = 1; d <= 6 && q.length; d++) {
      const next = [];
      for (const [cx, cy] of q) for (const dir of Object.keys(DIRS)) {
        const nx = cx + DIRS[dir].dx, ny = cy + DIRS[dir].dy, k = `${nx},${ny}`;
        if (dist.has(k) || !map.canMove(cx, cy, dir) || !hub.canRoam(nx, ny)) continue;
        dist.set(k, d); next.push([nx, ny]);
        if (d >= 3 && !hub.monAt(nx, ny) && !hub.walkerAt(nx, ny) && !this.spotAt(nx, ny)) found.push({ x: nx, y: ny });
      }
      q = next;
    }
    for (let i = found.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [found[i], found[j]] = [found[j], found[i]]; }
    const out = [];
    for (const s of found) if (out.every(o => Math.abs(o.x - s.x) + Math.abs(o.y - s.y) >= 3)) { out.push(s); if (out.length === n) break; }
    return out;
  }

  spotAt(x, y) { return this.tasks.some(t => t && t.spots.some(s => s.x === x && s.y === y)); }
}
