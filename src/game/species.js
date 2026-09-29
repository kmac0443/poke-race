// assets/data/species.json, loaded once. Never build a sprite path by hand: use sp.sprites (null = missing).
import { loadJson } from '../core/assets.js';

export const SPECIES = new Map(); // id → species

export async function loadSpecies() {
  if (SPECIES.size) return;
  for (const s of await loadJson('assets/data/species.json')) SPECIES.set(s.id, s);
}

/** Only species with a front sprite and a run sheet can be a player's Pokémon or an opponent. */
export const canRace = sp => !!(sp && sp.sprites.front && sp.sprites.run);

// Our stats come from base stats: Speed ← spe, Strength ← atk, Defense ← def.
export const STATS = ['speed', 'strength', 'defense'];
export const STAT_BASE = { speed: 'spe', strength: 'atk', defense: 'def' };
export const STAT_ICON = { speed: '⚡', strength: '💪', defense: '🛡️' };

/** Growth shown as 1–5 icons, from a base stat. */
export function growthPips(base) {
  return base < 40 ? 1 : base < 60 ? 2 : base < 80 ? 3 : base < 100 ? 4 : 5;
}
