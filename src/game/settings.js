// The one way to read settings: defaults + that child's overrides (shallow, one override per top-level key).
import { DEFAULTS } from '../data/defaults.js';

export function settingsFor(profile) {
  return { ...DEFAULTS, ...(profile && profile.overrides) };
}

export const isCustom = (profile, key) => !!profile.overrides && Object.hasOwn(profile.overrides, key);

/** Set one setting for a child. A value equal to the default removes the override. */
export function setSetting(profile, key, value) {
  profile.overrides = profile.overrides || {};
  if (JSON.stringify(value) === JSON.stringify(DEFAULTS[key])) delete profile.overrides[key];
  else profile.overrides[key] = structuredClone(value);
}

export function resetSetting(profile, key) {
  if (profile.overrides) delete profile.overrides[key];
}
