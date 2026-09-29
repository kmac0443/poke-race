// Checks src/data/defaults.js against assets/data/species.json: every species it names exists and has a front
// sprite and a run sheet, and every evolution goal is a real evolution of that species. Also every move's animation
// sheets and sounds (src/data/moves.js).
//   node tools/check-data.mjs
import fs from 'fs';
import { DEFAULTS, EEVEELUTIONS, LEVELS } from '../src/data/defaults.js';
import { MOVES, TYPE_MOVES, LINE_MOVES } from '../src/data/moves.js';
import { assetsFor } from '../src/game/anims.js';
import { goalsFor } from '../src/game/goals.js';

const species = new Map(JSON.parse(fs.readFileSync(new URL('../assets/data/species.json', import.meta.url))).map(s => [s.id, s]));
const errors = [];
const assetOk = rel => fs.existsSync(new URL('../assets/' + rel, import.meta.url));
const usable = (id, where) => {
  const sp = species.get(id);
  if (!sp) errors.push(`${where}: unknown species ${id}`);
  else if (!sp.sprites.front || !sp.sprites.run) errors.push(`${where}: ${id} has no front sprite or run sheet`);
};

DEFAULTS.pickList.forEach(id => usable(id, 'pickList'));
EEVEELUTIONS.forEach(id => usable(id, 'EEVEELUTIONS'));
DEFAULTS.eeveelutions.forEach(id => { if (!EEVEELUTIONS.includes(id)) errors.push(`eeveelutions: ${id} isn't an Eeveelution`); });

for (const [from, branches] of Object.entries(DEFAULTS.evolutionGoals)) {
  usable(from, 'evolutionGoals');
  const real = new Set((species.get(from)?.evolutions || []).map(e => e.into));
  for (const [into, criteria] of Object.entries(branches)) {
    usable(into, `evolutionGoals.${from}`);
    if (!real.has(into)) errors.push(`evolutionGoals: ${from} doesn't evolve into ${into}`);
    if (!criteria.length) errors.push(`evolutionGoals: ${from} → ${into} has no criteria`);
  }
}
// every species on the pick list has a goal for each next stage
for (const id of DEFAULTS.pickList) {
  const walk = cur => {
    const next = [...new Set((species.get(cur)?.evolutions || []).map(e => e.into))];
    for (const n of next) {
      if (!DEFAULTS.evolutionGoals[cur]?.[n]) errors.push(`evolutionGoals: no goal for ${cur} → ${n}`);
      else walk(n);
    }
  };
  walk(id);
}

// any species a parent could add (front + run) that evolves into something drawable gets a goal (game/goals.js)
let derived = 0;
for (const sp of species.values()) {
  if (!sp.sprites.front || !sp.sprites.run) continue;
  const drawableNext = sp.evolutions.some(e => { const n = species.get(e.into); return n && n.sprites.front && n.sprites.run; });
  const goals = goalsFor(sp.id, DEFAULTS, species);
  if (drawableNext && !Object.keys(goals).length) errors.push(`goals: ${sp.id} evolves but has no goal`);
  for (const [into, crit] of Object.entries(goals)) if (!crit || !crit.length) errors.push(`goals: ${sp.id} → ${into} has no criteria`);
  if (!DEFAULTS.evolutionGoals[sp.id] && Object.keys(goals).length) derived++;
}
const vulpix = goalsFor('VULPIX', DEFAULTS, species);
if (JSON.stringify(Object.keys(vulpix)) !== '["NINETALES"]') errors.push('goals: Vulpix should head for Ninetales');

// shop items and furniture: names, prices, sprites inside their sheets, known uses; wall styles
const USES = new Set(['sleep', 'sit', 'watch', 'water', 'snack', 'tidy', 'spin']);
const pngSize = rel => { const b = fs.readFileSync(new URL('../assets/' + rel, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
for (const it of DEFAULTS.shopItems) {
  if (!it.name || !(it.price > 0) || !(it.friendship > 0)) errors.push(`shopItems: ${it.item} needs a name, price and friendship`);
  if (!assetOk(`items/${it.item}.png`)) errors.push(`shopItems: no icon items/${it.item}.png`);
}
const seenItems = new Set();
for (const f of DEFAULTS.furniture) {
  if (seenItems.has(f.item)) errors.push(`furniture: ${f.item} twice`);
  seenItems.add(f.item);
  if (!f.name || !(f.price > 0) || !(f.fw >= 1) || !(f.fh >= 1)) errors.push(`furniture: ${f.item} needs a name, price and footprint`);
  if (!assetOk(f.sheet)) { errors.push(`furniture: ${f.item}: no sheet ${f.sheet}`); continue; }
  const [w, h] = pngSize(f.sheet), [sx, sy, sw, sh] = f.src;
  if (sx < 0 || sy < 0 || sx + sw > w || sy + sh > h) errors.push(`furniture: ${f.item}: src outside ${f.sheet}`);
  if (f.use && !USES.has(f.use)) errors.push(`furniture: ${f.item}: unknown use ${f.use}`);
}
if (!DEFAULTS.wallStyles.length || DEFAULTS.wallStyles.some(w => !w.key || !w.top || !w.face)) errors.push('wallStyles: each needs a key, top and face');

if (DEFAULTS.mathFloor < 1 || DEFAULTS.mathFloor > LEVELS.length) errors.push('mathFloor out of range');
if (new Set(LEVELS.map(l => l.key)).size !== LEVELS.length) errors.push('LEVELS: duplicate keys');

// moves: every animation sheet and sound exists; every type and line names three real moves
for (const mv of Object.values(MOVES)) {
  const { sheets, sounds } = assetsFor(mv);
  for (const sh of sheets) if (!assetOk(sh)) errors.push(`move ${mv.id}: no sheet ${sh}`);
  for (const so of sounds) if (!['.ogg', '.wav'].some(e => assetOk(so + e))) errors.push(`move ${mv.id}: no sound ${so}`);
}
for (const [k, ids] of [...Object.entries(TYPE_MOVES), ...Object.entries(LINE_MOVES)]) {
  if (ids.length !== 3) errors.push(`moves for ${k}: need 3`);
  for (const id of ids) if (!MOVES[id]) errors.push(`moves for ${k}: unknown move ${id}`);
}
for (const k of Object.keys(LINE_MOVES)) if (!species.has(k)) errors.push(`LINE_MOVES: unknown species ${k}`);

if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log(`ok: ${Object.keys(MOVES).length} moves, ${DEFAULTS.pickList.length} pickable species, ${Object.keys(DEFAULTS.evolutionGoals).length} evolution lines (+ ${derived} species with default goals), ${LEVELS.length} levels`);
