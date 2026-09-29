// A child's Pokémon. Everything is per Pokémon: stats, races won, trainings, friendship, evolution progress.
//
//   { uid, species, picked, branch, stats: { speed, strength, defense }, friendship, wins: [raceId],
//     trainings: { speed, strength, defense }, formerSpecies: [], born }
//   picked   the species chosen on the pick screen (its line never comes back on that child's list)
//   branch   the evolution it's heading for when there's a choice (Eevee's is fixed when it's picked)
import { SPECIES, STATS, STAT_BASE } from './species.js';

export function newPokemon(profile, settings, speciesId, branch = null) {
  const sp = SPECIES.get(speciesId);
  // every species starts with the same total, split like its base stats, so no pick is a bad start; growth
  // (how fast training raises each stat) still follows the species
  const sum = STATS.reduce((a, s) => a + sp.baseStats[STAT_BASE[s]], 0);
  const stats = {};
  for (const s of STATS) stats[s] = Math.max(1, Math.round(sp.baseStats[STAT_BASE[s]] / sum * settings.startStatTotal));
  return {
    uid: profile.nextUid++, species: speciesId, picked: speciesId, branch, stats, friendship: 0, wins: [],
    trainings: { speed: 0, strength: 0, defense: 0 }, formerSpecies: [], born: Date.now(),
  };
}

/** Add a new Pokémon to a child and make it the active one. */
export function givePokemon(profile, settings, speciesId, branch = null) {
  const pk = newPokemon(profile, settings, speciesId, branch);
  profile.pokemon.push(pk);
  profile.active = pk.uid;
  return pk;
}

/** The Pokémon following this child (the one they train and race), or null if they let it go exploring. */
export const activePokemon = profile => profile.pokemon.find(p => p.uid === profile.active) || null;

/** Eeveelutions this child may still pick (allowed by their settings and not already taken). */
export function openEeveelutions(profile, settings) {
  const taken = new Set(profile.pokemon.filter(p => p.picked === 'EEVEE').map(p => p.branch));
  return settings.eeveelutions.filter(b => !taken.has(b));
}

/** The pick list with what's still available: one of each species, except Eevee (one per Eeveelution). */
export function pickOptions(profile, settings) {
  const owned = new Set(profile.pokemon.map(p => p.picked));
  return settings.pickList.filter(id => SPECIES.has(id)).map(id => ({
    id,
    open: id === 'EEVEE' ? openEeveelutions(profile, settings).length > 0 : !owned.has(id),
  }));
}

// ------------------------------------------------------------------ earning new Pokémon (DESIGN.md "Earning")
/** Races won by all of this child's Pokémon together. */
export const totalWins = profile => profile.pokemon.reduce((a, p) => a + p.wins.length, 0);

/**
 * New Pokémon this child has earned and not picked yet: the first after firstNewPokemonAfter wins, then one every
 * racesPerNewPokemon more. Worked out from the wins and the Pokémon they have (a Pokémon given on admin.html uses
 * one up), so nothing extra is saved. 0 once the pick list has nothing left.
 */
export function picksWaiting(profile, settings) {
  const wins = totalWins(profile), first = settings.firstNewPokemonAfter, every = Math.max(1, settings.racesPerNewPokemon);
  const earned = wins < first ? 0 : 1 + Math.floor((wins - first) / every);
  if (!pickOptions(profile, settings).some(o => o.open)) return 0;
  return Math.max(0, earned - Math.max(0, profile.pokemon.length - 1));
}

/** Toward the next new Pokémon: { have, need } races won. */
export function nextPickProgress(profile, settings) {
  const wins = totalWins(profile), first = settings.firstNewPokemonAfter, every = Math.max(1, settings.racesPerNewPokemon);
  return wins < first ? { have: wins, need: first } : { have: (wins - first) % every, need: every };
}
