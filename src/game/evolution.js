// A Pokémon's next evolution as a goal (DESIGN.md "Evolution: a visible goal"): what it becomes, and each
// criterion as an icon with have / need, for progress bars. Evolving itself is build step 6.
import { SPECIES, STAT_ICON, STATS } from './species.js';
import { goalsFor } from './goals.js';
import { winsAtType } from './ladder.js';
import { VENUES } from '../data/venues.js';

/** What this species can evolve into, each with its criteria (game/goals.js). */
export const evolutionOptions = (speciesId, settings) => goalsFor(speciesId, settings, SPECIES);

/**
 * The evolution this Pokémon is heading for: its chosen branch, else the first option (a branch not chosen yet,
 * like Gloom's, shows the first until one is picked). null = it doesn't evolve.
 */
export function goalSpecies(pk, settings) {
  const options = Object.keys(evolutionOptions(pk.species, settings));
  if (pk.branch && options.includes(pk.branch)) return pk.branch;
  return options[0] || null;
}

/** { into, parts: [{ icon, have, need }], done } or null. */
export function evolutionGoal(pk, settings) {
  const into = goalSpecies(pk, settings);
  if (!into) return null;
  const total = STATS.reduce((a, s) => a + pk.stats[s], 0);
  const parts = [];
  for (const c of evolutionOptions(pk.species, settings)[into]) {
    if (c.kind === 'stat') parts.push({ icon: STAT_ICON[c.stat], have: pk.stats[c.stat], need: c.min });
    else if (c.kind === 'allStats') for (const s of STATS) parts.push({ icon: STAT_ICON[s], have: pk.stats[s], need: c.min });
    else if (c.kind === 'total') parts.push({ icon: '⚡💪🛡️', have: total, need: c.min });
    else if (c.kind === 'wins') parts.push({ icon: '🏁', have: pk.wins.length, need: c.min });
    else if (c.kind === 'venueWins') parts.push({ icon: VENUES.find(v => v.type === c.venue)?.icon || '🏁', have: winsAtType(pk, c.venue), need: c.min });
    else if (c.kind === 'friendship') parts.push({ icon: '❤️', have: pk.friendship, need: settings.friendshipMax });
  }
  return { into, parts, done: parts.every(p => p.have >= p.need) };
}

/** It has more than one way to go and hasn't chosen yet (Kirlia, Gloom, Tyrogue…; Eevee's is fixed when picked). */
export function needsBranch(pk, settings) {
  return pk.species !== 'EEVEE' && !pk.branch && Object.keys(evolutionOptions(pk.species, settings)).length > 1;
}

/** Every bar of its goal is full (and any choice has been made). */
export function readyToEvolve(pk, settings) {
  if (needsBranch(pk, settings)) return false;
  const goal = evolutionGoal(pk, settings);
  return !!(goal && goal.done);
}

/**
 * Evolve: the new species (its growth follows from its base stats), a stat jump (evolutionStatBoost of each stat,
 * at least +2), and the old form remembered for its card. Ribbons, wins and the race ladder stay.
 */
export function evolve(pk, settings) {
  const into = goalSpecies(pk, settings);
  if (!into) return null;
  const before = { ...pk.stats };
  pk.formerSpecies = [...(pk.formerSpecies || []), pk.species];
  pk.evolvedAt = [...(pk.evolvedAt || []), { from: pk.species, wins: pk.wins.length, at: Date.now() }];
  pk.species = into;
  pk.branch = null;
  for (const s of STATS) pk.stats[s] += Math.max(2, Math.round(pk.stats[s] * settings.evolutionStatBoost));
  return { from: pk.formerSpecies[pk.formerSpecies.length - 1], into, before };
}
