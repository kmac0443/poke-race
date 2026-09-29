// Who can be a race opponent: shared by tools/gen-races.mjs and tools/check-races.mjs (importing has no side effects).
import fs from 'fs';
import { DEFAULTS, EEVEELUTIONS } from '../src/data/defaults.js';

export const species = JSON.parse(fs.readFileSync(new URL('../assets/data/species.json', import.meta.url)));
export const byId = new Map(species.map(s => [s.id, s]));

/** The children's own lines: the pick list, every evolution along them, the Eeveelutions, the evolution goals. */
export function roster() {
  const out = new Set([...DEFAULTS.pickList, ...EEVEELUTIONS]);
  for (const [from, to] of Object.entries(DEFAULTS.evolutionGoals)) { out.add(from); for (const k of Object.keys(to)) out.add(k); }
  const walk = id => { for (const e of byId.get(id)?.evolutions || []) if (!out.has(e.into)) { out.add(e.into); walk(e.into); } };
  for (const id of [...out]) walk(id);
  return out;
}
