// A child's 🎒 bag: what they bought in the shop, kept until they use it (profile.bag = { ITEM: count }).
// On the farm they can hold one thing (profile.holding) and give it to any Pokémon, theirs or their sibling's.
// Treats raise that Pokémon's friendship (settings.shopItems); furniture goes in their house (game/house.js).

export const bagCount = (profile, item) => (profile.bag && profile.bag[item]) || 0;

/** What's in the bag, as [item, count] in the shop's order (anything unknown last). */
export function bagItems(profile, settings) {
  const order = [...settings.shopItems.map(i => i.item), ...(settings.furniture || []).map(f => f.item)];
  return Object.entries(profile.bag || {}).filter(([, n]) => n > 0)
    .sort((a, b) => (order.indexOf(a[0]) + 1 || 999) - (order.indexOf(b[0]) + 1 || 999));
}

export function addToBag(profile, item, n = 1) {
  profile.bag = profile.bag || {};
  profile.bag[item] = (profile.bag[item] || 0) + n;
}

/** Take one out; false if there isn't one. Holding it stops when the last one is used. */
export function takeFromBag(profile, item) {
  if (!bagCount(profile, item)) return false;
  profile.bag[item]--;
  if (!profile.bag[item]) { delete profile.bag[item]; if (profile.holding === item) profile.holding = null; }
  return true;
}

export const treatInfo = (settings, item) => settings.shopItems.find(i => i.item === item) || null;

/**
 * Give a held treat to a Pokémon: its friendship goes up (to friendshipMax). Returns { from, to } or null (not a
 * treat, none left, or its friendship is already full: then nothing is used up).
 */
export function giveTreat(giver, pk, item, settings) {
  const info = treatInfo(settings, item);
  if (!info || !bagCount(giver, item) || pk.friendship >= settings.friendshipMax) return null;
  takeFromBag(giver, item);
  const from = pk.friendship;
  pk.friendship = Math.min(settings.friendshipMax, from + info.friendship);
  return { from, to: pk.friendship };
}
