// What a training session earns. Stats only go up: a bad session earns less, never nothing (if anything was
// right) and never a loss. The gain grows with the species' base stat (its growth icons) and shrinks as the stat
// gets high, so all three stats get trained.
import { SPECIES, STAT_BASE } from './species.js';
import { statGain } from './gain.js';

export function trainingGain(pk, stat, right, settings) {
  const base = SPECIES.get(pk.species)?.baseStats[STAT_BASE[stat]] || 70;
  return statGain(right, base / 70, pk.stats[stat], settings);
}

/** Apply a session to a Pokémon. Returns the gain. */
export function finishTraining(pk, stat, right, settings) {
  const gain = trainingGain(pk, stat, right, settings);
  pk.stats[stat] += gain;
  pk.trainings[stat] = (pk.trainings[stat] || 0) + 1;
  return gain;
}
