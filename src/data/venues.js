// The race venues (DESIGN.md "Races"): each with its own character, ground, obstacles, picture and music.
// `type` is what evolution goals count ("3 forest races won"). Course shape (tools/gen-races.mjs):
//   terrain   × on every run (sand and snow are slow for everyone)
//   mix       the share of a race's obstacles that are 🧱 barriers (the rest are 🛡️ trap zones). A race has
//             3 + rank + (its number at the venue − 1) obstacles: 4 in a venue's first race, 9 in rank 4's third
//   hard      barrier hardness ÷ the opponents' middle Strength (1 = about half of them smash it)
//   power     trap power ÷ the opponents' middle Defense (above 1 = they're slowed too)
// Drawing (src/scenes/race.js): lane tiles (a 9-slice ground's top/middle/bottom), the tile beside the track, what's
// dotted along the sides, a tint, the trap zone's tile, and the ribbon colour (ui/Summary/ribbons.png, 0–9).
export const VENUES = [
  { id: 'meadow', name: 'Meadow', icon: '🌼', type: 'meadow', terrain: 1.0, mix: 0.5, hard: 0.8, power: 1.0,
    bg: 'backgrounds/field_bg.png', lane: [482, 490, 498], side: 385, props: 'pines', trapTile: 391, tint: null,
    ribbon: 3, music: 'Route 1.ogg' },
  { id: 'forest', name: 'Forest run', icon: '🌲', type: 'forest', terrain: 1.05, mix: 0.65, hard: 1.0, power: 1.1,
    bg: 'backgrounds/forest_bg.png', lane: [482, 490, 498], side: 385, props: 'forest', trapTile: 391, tint: 'rgba(0,40,0,0.12)',
    ribbon: 8, music: 'Route 3.ogg' },
  { id: 'beach', name: 'Beach', icon: '🏖️', type: 'beach', terrain: 1.2, mix: 0.35, hard: 0.85, power: 1.7,
    bg: 'backgrounds/water_bg.png', lane: [538, 546, 554], side: 546, props: 'sea', trapTile: 'water', tint: null,
    ribbon: 1, music: 'Islands.ogg' },
  { id: 'mountain', name: 'Mountain pass', icon: '⛰️', type: 'mountain', terrain: 1.1, mix: 0.75, hard: 1.15, power: 1.0,
    bg: 'backgrounds/rocky_bg.png', lane: [594, 602, 610], side: 602, props: 'rocks', trapTile: 1512, tint: null,
    ribbon: 4, music: 'Gale Ridge.wav' },
  { id: 'cave', name: 'Cave', icon: '🕳️', type: 'cave', terrain: 1.05, mix: 0.5, hard: 1.0, power: 1.4,
    bg: 'backgrounds/cave1_bg.png', lane: [594, 602, 610], side: 602, props: 'rocks', trapTile: 1512, tint: 'rgba(10,0,30,0.35)',
    ribbon: 6, music: 'Cave.ogg' },
  { id: 'snow', name: 'Snowfield', icon: '❄️', type: 'snow', terrain: 1.25, mix: 0.35, hard: 0.85, power: 1.7,
    bg: 'backgrounds/snow_bg.png', lane: [650, 658, 666], side: 658, props: 'pines', trapTile: 'drift', tint: null, weather: 'blizzard',
    ribbon: 2, music: 'Frostpeak.wav' },
  { id: 'ruins', name: 'Ruins', icon: '🏛️', type: 'ruins', terrain: 1.0, mix: 0.3, hard: 0.9, power: 1.9,
    bg: 'backgrounds/rocky_eve_bg.png', lane: [777, 785, 793], side: 602, props: 'rocks', trapTile: 1512, tint: 'rgba(60,30,0,0.12)',
    ribbon: 9, music: 'Sunken Ruins.wav' },
  { id: 'volcano', name: 'Volcano', icon: '🌋', type: 'volcano', terrain: 1.1, mix: 0.55, hard: 1.05, power: 1.4,
    bg: 'backgrounds/cave3_bg.png', lane: [594, 602, 610], side: 602, props: 'rocks', trapTile: 1512, tint: 'rgba(140,30,0,0.22)',
    ribbon: 0, music: 'Ember Cave.wav' },
];

export const RANKS = 4, RACES_PER_VENUE = 3;
export const venueById = id => VENUES.find(v => v.id === id);

/** The ribbon for a race won: its venue's colour, its rank's style. Returns [sx, sy] in ui/Summary/ribbons.png. */
export function ribbonCell(venue, rank) {
  const c = venue.ribbon;
  return [((c % 2) * 4 + (rank - 1)) * 64, Math.floor(c / 2) * 64];
}
