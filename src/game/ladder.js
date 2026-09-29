// Where a Pokémon is on the race ladder (per Pokémon: every new one climbs its own). A rank's 8 venues are all open;
// a venue's 3 races go in order; the next rank opens when the whole rank is won. Won races are in pk.wins.
import { RACES } from '../data/races.js';
import { VENUES, RANKS, RACES_PER_VENUE } from '../data/venues.js';

export const raceById = id => RACES.find(r => r.id === id) || null;
const raceAt = (venue, rank, i) => RACES.find(r => r.venue === venue && r.rank === rank && r.race === i) || null;

/** The rank this Pokémon is racing at (RANKS + 1 once it has won everything). */
export function currentRank(pk) {
  const won = new Set(pk.wins);
  for (let rank = 1; rank <= RANKS; rank++) if (RACES.some(r => r.rank === rank && !won.has(r.id))) return rank;
  return RANKS + 1;
}

/** The next race at a venue for this Pokémon, at its current rank (null if it has won them all there). */
export function nextRace(pk, venue) {
  const rank = currentRank(pk), won = new Set(pk.wins);
  for (let i = 1; i <= RACES_PER_VENUE; i++) {
    const r = raceAt(venue, rank, i);
    if (r && !won.has(r.id)) return r;
  }
  return null;
}

/** Each of a venue's races at a rank: 'won', 'next' or 'later'. */
export function venueProgress(pk, venue, rank = currentRank(pk)) {
  const won = new Set(pk.wins), next = nextRace(pk, venue);
  return Array.from({ length: RACES_PER_VENUE }, (_, k) => {
    const r = raceAt(venue, rank, k + 1);
    return !r ? 'later' : won.has(r.id) ? 'won' : next && next.id === r.id ? 'next' : 'later';
  });
}

/** Races this Pokémon has won at venues of a type ('forest', 'snow'…), for evolution goals. */
export const winsAtType = (pk, type) => pk.wins.filter(id => VENUES.find(v => v.id === raceById(id)?.venue)?.type === type).length;
