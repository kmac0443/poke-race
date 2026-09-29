// Moves for Strength training (and the attackers in Defense): three real moves per Pokémon, each with its own
// animation (game/anims.js). A line in LINE_MOVES keeps its moves as it evolves (keyed by the first stage); any
// other species gets its type's three (its first type, then the second type's first move in the middle).
// A move: { id, name, type, contact } — `contact` = it runs in and hits (else something flies across).
// tools/check-data.mjs checks every move's animation sheets and sounds exist.

const m = (id, name, type, contact = false) => ({ id, name, type, contact });

export const MOVES = Object.fromEntries([
  m('TACKLE', 'Tackle', 'NORMAL', true), m('QUICKATTACK', 'Quick Attack', 'NORMAL', true), m('BODYSLAM', 'Body Slam', 'NORMAL', true),
  m('SCRATCH', 'Scratch', 'NORMAL', true), m('FURYSWIPES', 'Fury Swipes', 'NORMAL', true), m('SWIFT', 'Swift', 'NORMAL'),
  m('EMBER', 'Ember', 'FIRE'), m('FIREFANG', 'Fire Fang', 'FIRE', true), m('FLAMETHROWER', 'Flamethrower', 'FIRE'),
  m('WATERGUN', 'Water Gun', 'WATER'), m('BUBBLE', 'Bubble', 'WATER'), m('BUBBLEBEAM', 'Bubble Beam', 'WATER'), m('WATERPULSE', 'Water Pulse', 'WATER'),
  m('THUNDERSHOCK', 'Thunder Shock', 'ELECTRIC'), m('THUNDERFANG', 'Thunder Fang', 'ELECTRIC', true), m('THUNDERBOLT', 'Thunderbolt', 'ELECTRIC'),
  m('SPARK', 'Spark', 'ELECTRIC', true),
  m('VINEWHIP', 'Vine Whip', 'GRASS', true), m('RAZORLEAF', 'Razor Leaf', 'GRASS'), m('LEAFBLADE', 'Leaf Blade', 'GRASS', true),
  m('POWDERSNOW', 'Powder Snow', 'ICE'), m('ICEFANG', 'Ice Fang', 'ICE', true), m('ICEBEAM', 'Ice Beam', 'ICE'),
  m('MACHPUNCH', 'Mach Punch', 'FIGHTING', true), m('KARATECHOP', 'Karate Chop', 'FIGHTING', true), m('AURASPHERE', 'Aura Sphere', 'FIGHTING'),
  m('POISONSTING', 'Poison Sting', 'POISON'), m('POISONJAB', 'Poison Jab', 'POISON', true), m('SLUDGEBOMB', 'Sludge Bomb', 'POISON'),
  m('MUDSLAP', 'Mud-Slap', 'GROUND'), m('DIG', 'Dig', 'GROUND', true), m('EARTHQUAKE', 'Earthquake', 'GROUND'),
  m('GUST', 'Gust', 'FLYING'), m('WINGATTACK', 'Wing Attack', 'FLYING', true), m('AERIALACE', 'Aerial Ace', 'FLYING', true),
  m('CONFUSION', 'Confusion', 'PSYCHIC'), m('PSYBEAM', 'Psybeam', 'PSYCHIC'), m('PSYCHOCUT', 'Psycho Cut', 'PSYCHIC', true),
  m('BUGBITE', 'Bug Bite', 'BUG', true), m('XSCISSOR', 'X-Scissor', 'BUG', true), m('SILVERWIND', 'Silver Wind', 'BUG'),
  m('ROCKTHROW', 'Rock Throw', 'ROCK'), m('ANCIENTPOWER', 'Ancient Power', 'ROCK'), m('ROCKSLIDE', 'Rock Slide', 'ROCK'),
  m('LICK', 'Lick', 'GHOST', true), m('SHADOWCLAW', 'Shadow Claw', 'GHOST', true), m('SHADOWBALL', 'Shadow Ball', 'GHOST'),
  m('DRAGONBREATH', 'Dragon Breath', 'DRAGON'), m('DRAGONCLAW', 'Dragon Claw', 'DRAGON', true), m('DRAGONPULSE', 'Dragon Pulse', 'DRAGON'),
  m('BITE', 'Bite', 'DARK', true), m('CRUNCH', 'Crunch', 'DARK', true), m('DARKPULSE', 'Dark Pulse', 'DARK'),
  m('METALCLAW', 'Metal Claw', 'STEEL', true), m('IRONHEAD', 'Iron Head', 'STEEL', true), m('IRONTAIL', 'Iron Tail', 'STEEL', true),
  m('FAIRYWIND', 'Fairy Wind', 'FAIRY'), m('DAZZLINGGLEAM', 'Dazzling Gleam', 'FAIRY'), m('MOONBLAST', 'Moonblast', 'FAIRY'),
].map(x => [x.id, x]));

export const TYPE_MOVES = {
  NORMAL: ['TACKLE', 'QUICKATTACK', 'BODYSLAM'], FIRE: ['EMBER', 'FIREFANG', 'FLAMETHROWER'],
  WATER: ['WATERGUN', 'BUBBLEBEAM', 'WATERPULSE'], ELECTRIC: ['THUNDERSHOCK', 'THUNDERFANG', 'THUNDERBOLT'],
  GRASS: ['VINEWHIP', 'RAZORLEAF', 'LEAFBLADE'], ICE: ['POWDERSNOW', 'ICEFANG', 'ICEBEAM'],
  FIGHTING: ['MACHPUNCH', 'KARATECHOP', 'AURASPHERE'], POISON: ['POISONSTING', 'POISONJAB', 'SLUDGEBOMB'],
  GROUND: ['MUDSLAP', 'DIG', 'EARTHQUAKE'], FLYING: ['GUST', 'WINGATTACK', 'AERIALACE'],
  PSYCHIC: ['CONFUSION', 'PSYBEAM', 'PSYCHOCUT'], BUG: ['BUGBITE', 'XSCISSOR', 'SILVERWIND'],
  ROCK: ['ROCKTHROW', 'ANCIENTPOWER', 'ROCKSLIDE'], GHOST: ['LICK', 'SHADOWCLAW', 'SHADOWBALL'],
  DRAGON: ['DRAGONBREATH', 'DRAGONCLAW', 'DRAGONPULSE'], DARK: ['BITE', 'CRUNCH', 'DARKPULSE'],
  STEEL: ['METALCLAW', 'IRONHEAD', 'IRONTAIL'], FAIRY: ['FAIRYWIND', 'DAZZLINGGLEAM', 'MOONBLAST'],
};

// The children's own lines (the default pick list), by first stage. The Eeveelutions use their types.
export const LINE_MOVES = {
  EEVEE: ['TACKLE', 'QUICKATTACK', 'BITE'],
  PIKACHU: ['THUNDERSHOCK', 'QUICKATTACK', 'IRONTAIL'],
  CHARMANDER: ['SCRATCH', 'EMBER', 'FLAMETHROWER'],
  SQUIRTLE: ['TACKLE', 'WATERGUN', 'BUBBLEBEAM'],
  ABRA: ['CONFUSION', 'PSYBEAM', 'PSYCHOCUT'],
  ZORUA: ['SCRATCH', 'BITE', 'DARKPULSE'],
  FLETCHLING: ['QUICKATTACK', 'EMBER', 'AERIALACE'],
  SNIVY: ['TACKLE', 'VINEWHIP', 'LEAFBLADE'],
  RALTS: ['CONFUSION', 'DAZZLINGGLEAM', 'PSYBEAM'],
  PURRLOIN: ['SCRATCH', 'FURYSWIPES', 'BITE'],
  SHINX: ['TACKLE', 'SPARK', 'THUNDERFANG'],
  RIOLU: ['QUICKATTACK', 'MACHPUNCH', 'AURASPHERE'],
  POLIWAG: ['BUBBLE', 'WATERGUN', 'BODYSLAM'],
};
