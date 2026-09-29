// Everything a parent might want to change, with its default. Each child's save holds only its overrides, one per
// top-level key, so a new default still reaches an old save. Never read this directly from game code: use
// settingsFor(profile) in game/settings.js. admin.html edits these per child.
//
// Species are referred to by their species.json `id` (e.g. 'PIKACHU'). tools/check-data.mjs verifies every one.

// ------------------------------------------------------------------ math levels (DESIGN.md "Levels")
// Each level is a set of facts. The math engine (build step 3) turns these specs into facts:
//   '+'  a + b with a, b in 1..12 and sumMin ≤ a + b ≤ sumMax
//   '-'  the inverses of those sums: (a + b) − b
//   '×'  t × k and k × t for each table t, k in 1..12, minus facts an earlier level already has
//   '÷'  the inverses of the '×' facts of the given tables
export const LEVELS = [
  { key: 'add5', label: 'Add within 5', op: '+', sumMin: 2, sumMax: 5 },
  { key: 'add10', label: 'Add within 10', op: '+', sumMin: 6, sumMax: 10 },
  { key: 'add24', label: 'Add to 12 + 12', op: '+', sumMin: 11, sumMax: 24 },
  { key: 'sub10', label: 'Subtract within 10', op: '-', sumMin: 2, sumMax: 10 },
  { key: 'sub24', label: 'Subtract within 24', op: '-', sumMin: 11, sumMax: 24 },
  { key: 'mul1', label: '× 1, 2, 5, 10', op: '×', tables: [1, 2, 5, 10] },
  { key: 'mul2', label: '× 3, 4', op: '×', tables: [3, 4] },
  { key: 'mul3', label: '× 6, 7, 8, 9', op: '×', tables: [6, 7, 8, 9] },
  { key: 'mul4', label: '× 11, 12', op: '×', tables: [11, 12] },
  { key: 'div', label: '÷ all tables', op: '÷', tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
];

// ------------------------------------------------------------------ Pokémon
export const EEVEELUTIONS = ['JOLTEON', 'FLAREON', 'VAPOREON', 'LEAFEON', 'GLACEON', 'ESPEON', 'UMBREON', 'SYLVEON'];

// Evolution criteria (DESIGN.md "Evolution: a visible goal"). from → { into: [criteria] }; every criterion must hold.
//   { kind: 'stat', stat: 'speed' | 'strength' | 'defense', min }   { kind: 'allStats', min }   { kind: 'total', min }
//   { kind: 'wins', min }   { kind: 'venueWins', venue, min }   { kind: 'friendship' } (= friendship full)
const stage1 = [{ kind: 'total', min: 90 }, { kind: 'wins', min: 4 }];
const stage2 = [{ kind: 'total', min: 180 }, { kind: 'wins', min: 12 }];
const oneStage = [{ kind: 'total', min: 120 }, { kind: 'wins', min: 6 }];
const EVOLUTION_GOALS = {
  EEVEE: {
    JOLTEON: [{ kind: 'stat', stat: 'speed', min: 60 }],
    FLAREON: [{ kind: 'stat', stat: 'strength', min: 60 }],
    VAPOREON: [{ kind: 'allStats', min: 40 }],
    LEAFEON: [{ kind: 'stat', stat: 'defense', min: 50 }, { kind: 'venueWins', venue: 'forest', min: 3 }],
    GLACEON: [{ kind: 'stat', stat: 'defense', min: 50 }, { kind: 'venueWins', venue: 'snow', min: 3 }],
    ESPEON: [{ kind: 'stat', stat: 'speed', min: 45 }, { kind: 'friendship' }],
    UMBREON: [{ kind: 'stat', stat: 'defense', min: 45 }, { kind: 'friendship' }],
    SYLVEON: [{ kind: 'friendship' }, { kind: 'wins', min: 8 }],
  },
  CHARMANDER: { CHARMELEON: stage1 }, CHARMELEON: { CHARIZARD: stage2 },
  SQUIRTLE: { WARTORTLE: stage1 }, WARTORTLE: { BLASTOISE: stage2 },
  ABRA: { KADABRA: stage1 }, KADABRA: { ALAKAZAM: stage2 },
  SNIVY: { SERVINE: stage1 }, SERVINE: { SERPERIOR: stage2 },
  SHINX: { LUXIO: stage1 }, LUXIO: { LUXRAY: stage2 },
  FLETCHLING: { FLETCHINDER: stage1 }, FLETCHINDER: { TALONFLAME: stage2 },
  RALTS: { KIRLIA: stage1 },
  KIRLIA: {
    GARDEVOIR: [...stage2, { kind: 'stat', stat: 'speed', min: 70 }],
    GALLADE: [...stage2, { kind: 'stat', stat: 'strength', min: 70 }],
  },
  POLIWAG: { POLIWHIRL: stage1 },
  POLIWHIRL: {
    POLIWRATH: [...stage2, { kind: 'stat', stat: 'strength', min: 70 }],
    POLITOED: [...stage2, { kind: 'friendship' }],
  },
  PIKACHU: { RAICHU: oneStage },
  ZORUA: { ZOROARK: oneStage },
  PURRLOIN: { LIEPARD: oneStage },
  RIOLU: { LUCARIO: [{ kind: 'total', min: 120 }, { kind: 'friendship' }] },
};

const INTERIOR = 'tilesets/Interior general.png';

// ------------------------------------------------------------------ the settings (one override per key)
export const DEFAULTS = {
  // Math: levels are 1-based indexes into LEVELS. mathCeiling null = no ceiling.
  mathFloor: 1,
  mathCeiling: null,
  mastery: { minSeen: 3, lastRight: 3, levelAccuracy: 0.9, levelWindow: 30, maxMs: null },
  // The next level's facts start once every fact of this one has been met and this share of them is solid.
  nextLevelWhenSolid: 0.7,
  // Flash cards (game/math.js): a fact in box b comes back after steps[b] more problems (or days[b] days, where
  // that's more than 0). Right → up a box, wrong → box 0 and back in the line-up missGap problems later. New facts
  // come in while fewer than maxLearning are below solidBox and the last answers are ≥ introduceAccuracy right,
  // at most one every newEvery problems.
  // The next `lookahead` problems are planned ahead.
  srs: { steps: [2, 3, 6, 12, 25, 50, 100, 200], days: [0, 0, 0, 1, 2, 4, 7, 14], solidBox: 3, maxLearning: 4,
    introduceAccuracy: 0.8, newEvery: 3, missGap: 2, lookahead: 5 },
  // A run of misses in a session eases off: after `misses` wrong among the last `window` answers, problems come from
  // what the child already knows and the games give `moreTime` × the time, until `recover` right in a row.
  // misses 0 = never.
  ease: { misses: 3, window: 5, recover: 3, moreTime: 1.5 },

  // Pokémon
  pickList: ['EEVEE', 'PIKACHU', 'CHARMANDER', 'SQUIRTLE', 'ABRA', 'ZORUA', 'FLETCHLING', 'SNIVY', 'RALTS', 'PURRLOIN',
    'SHINX', 'RIOLU', 'POLIWAG'],
  eeveelutions: EEVEELUTIONS,
  firstNewPokemonAfter: 1, // races won before the second Pokémon…
  racesPerNewPokemon: 8,    // …then one more every this many races won
  evolutionGoals: EVOLUTION_GOALS,
  // Goals for any species not in evolutionGoals (e.g. Vulpix, added to a pick list), by its place in its line
  evolutionDefaults: { firstOfTwo: stage1, secondOfTwo: stage2, only: oneStage },
  evolutionStatBoost: 0.15, // evolving adds this share to every stat (at least +2 each)

  // Pacing (tune)
  startStatTotal: 36,       // a new Pokémon's stats add up to this, split like its base stats (Pikachu 18/11/8)
  friendshipMax: 100,
  sessionSeconds: 75,       // training session soft cap
  showAnswerMs: 1200,       // after a miss, how long the right answer stays up
  trainingGainPerRight: 0.5, // stat points per right answer (× growth from base stats; see game/training.js)…
  statSoftCap: 60,          // …shrinking as the stat grows: × 1 / (1 + stat / this)
  minGrowth: 0.6,           // a species' growth (base stat ÷ 70) never counts as less than this
  speedupPerCorrect: 0.1,   // Speed training: 1.0× → 1.1× → …
  speedTopBase: 1.4,        // Speed training's top speed: this + speedTopPerStat × Speed
  speedTopPerStat: 0.01,
  speedGateSeconds: 5,      // Speed training: seconds between answer gates at 1.0×
  strengthPerTier: 25,      // Strength training: every this much Strength starts you on a heavier object
  needsEverySessions: 2,    // farm care: every this many training sessions, the Pokémon that trained needs something…
  careFriendship: 5,        // …and looking after one adds this much friendship

  // Races
  opponentStrength: 1,      // scales the shared ladder's opponents for this child
  coinsPerWin: 10,          // 🪙 for a race won, × its rank (rank 3 → 30)

  // The shop (on the farm): treats and toys for the Pokémon following you. Each costs `price` 🪙 and adds
  // `friendship` (up to friendshipMax). `item`: its icon, assets/items/<item>.png.
  shopItems: [
    { item: 'ORANBERRY', name: 'Oran Berry', price: 3, friendship: 3 },
    { item: 'MOOMOOMILK', name: 'Moomoo Milk', price: 6, friendship: 5 },
    { item: 'LAVACOOKIE', name: 'Lava Cookie', price: 10, friendship: 9 },
    { item: 'STRAWBERRYSWEET', name: 'Strawberry Sweet', price: 15, friendship: 14 },
    { item: 'POKETOY', name: 'Poké Toy', price: 25, friendship: 24 },
    { item: 'POKEDOLL', name: 'Poké Doll', price: 40, friendship: 40 },
  ],

  // Walls a child can build inside their house (edit mode → 🧱): one right answer builds (or knocks down) this many
  // blocks. Styles: a top and a front colour, and a pattern.
  wallsPerAnswer: 6,
  wallStyles: [
    { key: 'wood', top: '#D8A868', face: '#9C6A3C', pattern: 'planks' },
    { key: 'brick', top: '#D88870', face: '#A84C38', pattern: 'bricks' },
    { key: 'white', top: '#F8F8F0', face: '#C8C8C0', pattern: 'plain' },
    { key: 'blue', top: '#A8C8F8', face: '#5878C0', pattern: 'plain' },
    { key: 'hedge', top: '#78C860', face: '#488838', pattern: 'leaves' },
  ],

  // Furniture for the house (the shop's 🛋️ shelf). src: [x, y, w, h] in the sheet (found with a render of the
  // tileset, never guessed); fw × fh: the floor tiles (32 px) it takes; floor: a rug, drawn under everything else;
  // use: what A facing it does in the house (sleep, sit, watch, water, snack (icon), tidy, spin: scenes/house.js).
  furniture: [
    { item: 'CUSHION', name: 'Cushion', price: 8, sheet: INTERIOR, src: [226, 5184, 30, 32], fw: 1, fh: 1, use: 'sit' },
    { item: 'STOOL', name: 'Stool', price: 8, sheet: INTERIOR, src: [160, 5120, 32, 32], fw: 1, fh: 1, use: 'sit' },
    { item: 'PALM', name: 'Palm', price: 12, sheet: INTERIOR, src: [64, 5544, 32, 56], fw: 1, fh: 1, use: 'water' },
    { item: 'TREE', name: 'Round tree', price: 18, sheet: INTERIOR, src: [128, 5538, 32, 62], fw: 1, fh: 1, use: 'water' },
    { item: 'ARMCHAIR', name: 'Armchair', price: 20, sheet: INTERIOR, src: [64, 5100, 32, 52], fw: 1, fh: 1, use: 'sit' },
    { item: 'RUGGREEN', name: 'Green rug', price: 20, sheet: INTERIOR, src: [6, 3142, 84, 80], fw: 3, fh: 3, floor: true },
    { item: 'RUGPINK', name: 'Pink rug', price: 25, sheet: INTERIOR, src: [0, 3232, 96, 96], fw: 3, fh: 3, floor: true },
    { item: 'TABLEROUND', name: 'Round table', price: 25, sheet: INTERIOR, src: [194, 6776, 62, 62], fw: 2, fh: 2, use: 'snack' },
    { item: 'TABLECHECK', name: 'Picnic table', price: 30, sheet: INTERIOR, src: [96, 6786, 94, 60], fw: 3, fh: 2, use: 'snack' },
    { item: 'COUCH', name: 'Couch', price: 35, sheet: INTERIOR, src: [128, 5104, 64, 48], fw: 2, fh: 1, use: 'sit' },
    { item: 'SOFABLUE', name: 'Blue sofa', price: 40, sheet: INTERIOR, src: [64, 5042, 96, 46], fw: 3, fh: 1, use: 'sit' },
    { item: 'TV', name: 'TV', price: 50, sheet: INTERIOR, src: [224, 5312, 32, 64], fw: 1, fh: 1, use: 'watch' },
    { item: 'BED', name: 'Bed', price: 45, sheet: INTERIOR, src: [24, 4828, 50, 68], fw: 2, fh: 2, use: 'sleep' },
    { item: 'BIGBED', name: 'Big bed', price: 70, sheet: INTERIOR, src: [120, 4828, 82, 68], fw: 3, fh: 2, use: 'sleep' },
    { item: 'ARMCHAIRORANGE', name: 'Orange chair', price: 20, sheet: INTERIOR, src: [68, 5184, 24, 32], fw: 1, fh: 1, use: 'sit' },
    { item: 'SOFAORANGE', name: 'Orange sofa', price: 40, sheet: INTERIOR, src: [160, 5042, 96, 46], fw: 3, fh: 1, use: 'sit' },
    { item: 'FERN', name: 'Fern', price: 12, sheet: INTERIOR, src: [96, 5544, 32, 56], fw: 1, fh: 1, use: 'water' },
    { item: 'BUSH', name: 'Bush', price: 12, sheet: INTERIOR, src: [224, 5530, 32, 54], fw: 1, fh: 1, use: 'water' },
    { item: 'PALMTALL', name: 'Tall palm', price: 15, sheet: INTERIOR, src: [160, 5536, 32, 48], fw: 1, fh: 1, use: 'water' },
    { item: 'FICUS', name: 'Ficus', price: 15, sheet: INTERIOR, src: [192, 5536, 32, 48], fw: 1, fh: 1, use: 'water' },
    { item: 'RUGBLUE', name: 'Blue rug', price: 20, sheet: INTERIOR, src: [100, 3140, 88, 82], fw: 3, fh: 3, floor: true },
    { item: 'RUGSKY', name: 'Sky rug', price: 25, sheet: INTERIOR, src: [96, 3232, 96, 96], fw: 3, fh: 3, floor: true },
    { item: 'MEAL', name: 'Lunch plate', price: 6, sheet: INTERIOR, src: [224, 5894, 28, 22], fw: 1, fh: 1, use: 'snack' },
    { item: 'TABLEBLUE', name: 'Blue table', price: 30, sheet: INTERIOR, src: [2, 6786, 92, 62], fw: 3, fh: 2, use: 'snack' },
    { item: 'TABLEGREEN', name: 'Green table', price: 30, sheet: INTERIOR, src: [0, 6708, 96, 62], fw: 3, fh: 2, use: 'snack' },
    { item: 'CABINET', name: 'Cabinet', price: 35, sheet: INTERIOR, src: [64, 5472, 64, 64], fw: 2, fh: 1, use: 'tidy' },
    { item: 'DRESSER', name: 'Dresser', price: 35, sheet: INTERIOR, src: [66, 4680, 46, 56], fw: 2, fh: 1, use: 'spin' },
    { item: 'VENDING', name: 'Drinks machine', price: 55, sheet: INTERIOR, src: [128, 5472, 32, 64], fw: 1, fh: 1, use: 'snack', icon: '🥤' },
    { item: 'PC', name: 'PC', price: 45, sheet: INTERIOR, src: [192, 5232, 32, 48], fw: 1, fh: 1, use: 'watch' },
    { item: 'COMPUTER', name: 'Computer desk', price: 60, sheet: INTERIOR, src: [16, 5856, 80, 32], fw: 3, fh: 1, use: 'watch' },
  ],
};
