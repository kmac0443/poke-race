// The save: one JSON blob in localStorage, shared by the game and admin.html.
//
//   { version, profiles: [profile, profile] }       one profile per child
//   profile = { name, avatar, color, coins, overrides, math: { problems }, pokemon: [pokemon], active, nextUid }
//     color       the child's colour: their half of the screen, the ring under them and under their Pokémon
//     coins       🪙 won in races, spent in the shop on treats for their Pokémon
//     bag         { ITEM: count } bought and not used yet; holding = the one they carry on the farm (game/bag.js)
//     needs       { uid: kind } from training, until cared for on the farm; sessionsSinceNeed (game/needs.js)
//     overrides   settings this child has changed (see game/settings.js); only what differs from defaults.js
//     math        the per-problem table (DESIGN.md "Tracking every problem"), filled in by the math engine
//     pokemon     see game/pokemon.js; `active` is the uid of the one following the child (null = none)
//
// ?dev: the game loads the save but never writes it, so testing can't touch a child's progress.

export const SAVE_KEY = 'pokemon-race-save';
export const VERSION = 1;
export const DEV = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev');

export const CHILD_COLORS = ['#E04838', '#3870E0', '#38A848', '#E8A020', '#9048C8', '#E060A0', '#20A8B8', '#806040'];
const DEFAULT_PROFILES = [{ name: 'Player 1', avatar: 'Red', color: CHILD_COLORS[0] }, { name: 'Player 2', avatar: 'Leaf', color: CHILD_COLORS[1] }];

export function newProfile(i) {
  return { ...DEFAULT_PROFILES[i], coins: 0, bag: {}, holding: null, needs: {}, sessionsSinceNeed: 0, overrides: {}, math: { problems: {} }, pokemon: [], active: null, nextUid: 1 };
}

export function newSave() {
  return { version: VERSION, profiles: [newProfile(0), newProfile(1)] };
}

/** Fill in anything an older save is missing. */
function normalize(save) {
  if (!save || !Array.isArray(save.profiles)) return newSave();
  for (let i = 0; i < 2; i++) save.profiles[i] = { ...newProfile(i), ...save.profiles[i] };
  save.version = VERSION;
  return save;
}

export function loadSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  try {
    return normalize(raw ? JSON.parse(raw) : null);
  } catch (e) {
    const backup = `${SAVE_KEY}-broken-${Date.now()}`;
    if (!DEV) localStorage.setItem(backup, raw);
    console.error(`Could not read the save; starting fresh (the old one is kept as ${backup})`, e);
    return newSave();
  }
}

/** Write the save. Returns false in dev mode (nothing is saved). */
export function writeSave(save) {
  if (DEV) return false;
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  return true;
}
