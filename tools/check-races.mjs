// Checks the race ladder (src/data/races.js) by simulating every race. Fails if:
//   a race has fewer than two winning builds a child could have reached by then (budgetFor(n), src/game/race.js);
//   an opponent isn't a real species with a front sprite and a run sheet, or is one of the children's own lines;
//   a species comes back anywhere on the ladder, or a race doesn't have 3 different opponents; ids repeat.
// Also reports: race lengths (a balanced racer), how much training matters (does balanced win at 80% of the
// budget?), which builds win where, and how the starters do in the first races.
//   node tools/check-races.mjs
import fs from 'fs';
import { RACES } from '../src/data/races.js';
import { VENUES } from '../src/data/venues.js';
import { DEFAULTS } from '../src/data/defaults.js';
import { budgetFor, buildsFor, winningBuilds, simulate, runRace, lossHint, LADDER } from '../src/game/race.js';
import { statGain } from '../src/game/gain.js';
import { roster } from './race-pool.mjs';

const species = new Map(JSON.parse(fs.readFileSync(new URL('../assets/data/species.json', import.meta.url))).map(s => [s.id, s]));
const errors = [], seen = new Map(), ids = new Set();
const mine = roster();
const times = [], easy = [];
const tally = {};
for (const r of RACES) {
  if (ids.has(r.id)) errors.push(`${r.id}: duplicate id`);
  ids.add(r.id);
  if (!VENUES.some(v => v.id === r.venue)) errors.push(`${r.id}: unknown venue ${r.venue}`);
  if (new Set(r.opponents.map(o => o.species)).size !== 3) errors.push(`${r.id}: needs 3 different opponents`);
  for (const o of r.opponents) {
    const sp = species.get(o.species);
    if (!sp || !sp.sprites.front || !sp.sprites.run) errors.push(`${r.id}: ${o.species} isn't raceable`);
    if (mine.has(o.species)) errors.push(`${r.id}: ${o.species} is one of the children's own lines`);
    if (seen.has(o.species)) errors.push(`${r.id}: ${o.species} already raced in ${seen.get(o.species)}`);
    seen.set(o.species, r.id);
  }
  const budget = budgetFor(r.n);
  const wins = winningBuilds(r.course, r.opponents, budget);
  if (wins.length < 2) errors.push(`${r.id}: only ${wins.length} winning build(s) at budget ${budget}: ${wins.join()}`);
  for (const w of wins) tally[w] = (tally[w] || 0) + 1;
  times.push(simulate(r.course, buildsFor(budget).balanced).time);
  if (runRace(r.course, buildsFor(Math.floor(budget * 0.8)).balanced, r.opponents).won) easy.push(r.id);
}

const avg = times.reduce((a, b) => a + b, 0) / times.length;
console.log(`${RACES.length} races, ${seen.size} opponent species, none repeated: ${errors.some(e => e.includes('already raced')) ? 'NO' : 'yes'}`);
console.log(`race length (balanced racer): ${Math.min(...times).toFixed(0)}–${Math.max(...times).toFixed(0)} s, average ${avg.toFixed(0)} s`);
console.log('winning builds:', tally);
console.log(`won by a balanced build at 80% of the budget (training barely mattered): ${easy.length}${easy.length ? ' — ' + easy.slice(0, 8).join(', ') + (easy.length > 8 ? '…' : '') : ''}`);

// Each starter played by a child who follows the hint: race the next race on the ladder; lose → one session of what
// the results screen says to train (🏃 Speed, 🧱 Strength, 🛡️ Defense), then retry. Sessions of rightPerSession right
// answers with the species' own growth. How many sessions to the first win, and on average per race over rank 1?
const bs = sp => ({ speed: sp.baseStats.spe, strength: sp.baseStats.atk, defense: sp.baseStats.def });
const start = (sp, total) => { const b = bs(sp), sum = b.speed + b.strength + b.defense;
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.max(1, Math.round(v / sum * total))])); };
const HINT_STAT = { run: 'speed', barrier: 'strength', trap: 'defense' };
const ladder = [...RACES].sort((a, b) => a.n - b.n);
const rank1 = ladder.filter(r => r.rank === 1);
console.log(`\nfollowing the hint (sessions of ${LADDER.rightPerSession} right; the ladder expects ${LADDER.firstSessions} to the first win, then ${LADDER.sessionsPerRace} a race):`);
const perRace = [];
for (const id of DEFAULTS.pickList) {
  const sp = species.get(id), st = start(sp, DEFAULTS.startStatTotal), growth = bs(sp);
  let sessions = 0, first = null, stuck = false;
  for (const r of rank1) {
    for (let tries = 0; ; tries++) {
      const race = runRace(r.course, st, r.opponents);
      if (race.won) break;
      if (tries > 60) { stuck = true; break; }
      const k = HINT_STAT[lossHint(race)];
      st[k] += statGain(LADDER.rightPerSession, growth[k] / 70, st[k], DEFAULTS);
      sessions++;
    }
    if (stuck) break;
    if (first === null) first = sessions;
  }
  const avg = sessions / rank1.length;
  perRace.push(avg);
  console.log(`  ${sp.name.padEnd(11)} first win after ${String(first).padStart(2)} sessions; rank 1 ${stuck ? 'STUCK (hint leads nowhere)' : `in ${sessions} (${avg.toFixed(1)} a race)`}  ends ${JSON.stringify(st)}`);
  if (stuck) errors.push(`${sp.name}: following the hint never wins rank 1`);
}

// a child who only ever trains one thing: every session the race expects, all in one stat (from an even start)
const oneSided = stat => n => {
  const st = { speed: 12, strength: 12, defense: 12 };
  for (let i = LADDER.firstSessions + LADDER.sessionsPerRace * n; i > 0; i--) st[stat] += statGain(LADDER.rightPerSession, 1, st[stat], DEFAULTS);
  return st;
};
console.log('\nwon by a child who only trains one stat (as many sessions as the race expects):');
for (const stat of ['speed', 'strength', 'defense']) {
  const won = RACES.filter(r => runRace(r.course, oneSided(stat)(r.n), r.opponents).won);
  console.log(`  only ${stat.padEnd(9)} ${String(won.length).padStart(2)}/${RACES.length}${won.length ? '  e.g. ' + won.slice(0, 6).map(r => r.id).join(', ') : ''}`);
}

if (errors.length) { console.log('\n' + errors.join('\n')); console.log(`\n${errors.length} PROBLEM(S)`); process.exit(1); }
console.log('\nall ok');
