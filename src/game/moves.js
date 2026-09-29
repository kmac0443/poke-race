// A Pokémon's three moves (data/moves.js): its line's, or its types'.
import { SPECIES } from './species.js';
import { MOVES, TYPE_MOVES, LINE_MOVES } from '../data/moves.js';

let prevo = null;
/** The first stage of a species' line (Charizard → Charmander). Eeveelutions stop at themselves (their own type). */
function firstStage(id) {
  if (!prevo) {
    prevo = new Map();
    for (const s of SPECIES.values()) for (const e of s.evolutions) if (!prevo.has(e.into)) prevo.set(e.into, s.id);
  }
  let cur = id;
  for (let k = 0; k < 4 && prevo.has(cur) && prevo.get(cur) !== 'EEVEE'; k++) cur = prevo.get(cur);
  return cur;
}

export function movesFor(speciesId) {
  const line = LINE_MOVES[firstStage(speciesId)];
  if (line) return line.map(id => MOVES[id]);
  const [a, b] = SPECIES.get(speciesId)?.types || ['NORMAL'];
  const ids = [...(TYPE_MOVES[a] || TYPE_MOVES.NORMAL)];
  if (b && TYPE_MOVES[b]) ids[1] = TYPE_MOVES[b][0];
  return ids.map(id => MOVES[id]);
}
