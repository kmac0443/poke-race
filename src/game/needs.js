// Needs come from training (DESIGN.md "The farm"): every needsEverySessions training sessions a child finishes, the
// Pokémon that just trained gets a need, matched to the work: running makes it thirsty, pulling hungry, blocking
// wants a brush or a game. It waits (saved) until someone cares for it on the farm (world/care.js). Nothing comes
// with the clock: a Pokémon never gets needy while the children are away.
//   profile.needs = { [uid]: 'food' | 'drink' | 'play' | 'brush' }   profile.sessionsSinceNeed = sessions counted
export const NEED_FOR_STAT = { speed: ['drink'], strength: ['food'], defense: ['brush', 'play'] };

export const needOf = (profile, uid) => (profile.needs && profile.needs[uid]) || null;

/**
 * A training session finished (with something earned): count it; every needsEverySessions-th gives the Pokémon
 * that trained a need (unless it already has one: then it waits for the next). Returns the need given, or null.
 */
export function noteTraining(profile, pk, stat, settings) {
  const every = settings.needsEverySessions;
  if (!every) return null;
  profile.sessionsSinceNeed = (profile.sessionsSinceNeed || 0) + 1;
  if (profile.sessionsSinceNeed < every || needOf(profile, pk.uid)) return null;
  const kinds = NEED_FOR_STAT[stat] || ['food'];
  const kind = kinds[(pk.trainings[stat] || 0) % kinds.length];
  profile.needs = { ...(profile.needs || {}), [pk.uid]: kind };
  profile.sessionsSinceNeed = 0;
  return kind;
}

/** Cared for: the need is met. */
export function meetNeed(profile, uid) {
  if (profile.needs) delete profile.needs[uid];
}
