// Move animations, ported from the RPG (reference/battle/anims.js). Every move gets a short recipe of timed steps,
// played by scenes/moveFx.js (MoveFx):
//   { t, cel, f, every, at, ... }  a cel sheet from effects/anims (192x192 cels) — `f: [a, b]` a frame range
//                                  (or a list), `every` game frames per cel (3 ≈ Essentials' 20 fps), `at` where:
//                                  'target' | 'user' | 'path' (flies user → target over `dur`) | 'back' (target → user)
//                                  | 'screen' (the middle of the view). Optional: dur, loop, dx/dy, scale, alpha,
//                                  add (glow blend), count + spread (a spray of copies), arc (a lob along a path), rise.
//   { t, se }                      a sound (audio/se/move-anims/…);  { t, cry: 'user' } the user's own cry
//   { t, lunge, dist, dur }        the user throws itself at the target and back
//   { t, shake, amp, dur }         'target' | 'user' | 'screen' judders
//   { t, flash, dur }              the whole view flashes that colour
//   { t, glow, at, dur }           a coloured glow over a battler
//   { t, beam, width, dur }        a beam of light from the user to the target
//   { t, wave, dur }               a great wave rolls across the field (Surf)
// Recipes: a few favourite moves have their own; everything else is built from its type and whether it's a contact
// move, so every move animates. A move here is { id, name, type, contact } (data/moves.js).

const ANIM = name => `effects/anims/${name}.png`;

// The type's colour (for beams and glows)
export const TYPE_GLOW = {
  NORMAL: '#E8E8D0', FIRE: '#FF8030', WATER: '#50A0FF', ELECTRIC: '#FFE040', GRASS: '#70D850', ICE: '#A0F0FF',
  FIGHTING: '#E05030', POISON: '#C060E0', GROUND: '#E0C070', FLYING: '#B0C8FF', PSYCHIC: '#FF70B0', BUG: '#B0D030',
  ROCK: '#C8A850', GHOST: '#8060C0', DRAGON: '#8070FF', DARK: '#806050', STEEL: '#C8C8E0', FAIRY: '#FFA0D0',
};

// ---------------------------------------------------------------- building blocks
const hitAt = (cel, f, o = {}) => ({ cel, f, at: 'target', every: 3, ...o });
const fly = (cel, f, o = {}) => ({ cel, f, at: 'path', every: 2, loop: true, dur: 16, ...o });
const onUser = (cel, f, o = {}) => ({ cel, f, at: 'user', every: 3, ...o });
const snd = (t, name, vol = 0.8) => ({ t, se: name, vol });

/** A contact hit: lunge, then an impact on the target. */
function contact(impact, sound, extra = []) {
  return [{ t: 0, lunge: 'user', dist: 34, dur: 10 }, snd(6, sound), { ...impact, t: 6 }, { t: 8, shake: 'target', amp: 4, dur: 10 }, ...extra];
}
/** A special attack: something flies across, then bursts on the target. */
function shot(proj, burst, sounds, extra = []) {
  const [s1, s2] = [].concat(sounds);
  return [snd(0, s1), { ...proj, t: 0 }, snd(16, s2 || s1), { ...burst, t: 16 }, { t: 18, shake: 'target', amp: 3, dur: 10 }, ...extra];
}

// Per type: [contact impact, contact sound], [projectile, burst, sounds], [status-on-target cel, sound]
const TYPE = {
  NORMAL: { hit: [hitAt('003-Attack01', [0, 4]), 'Blow1'], shot: [fly('008-Weapon03', [11, 14]), hitAt('003-Attack01', [9, 9], { dur: 8 }), ['Sound2', 'Blow4']], status: [hitAt('normal1', [0, 5], { every: 4 }), 'Sing'] },
  FIGHTING: { hit: [hitAt('008-Weapon03', [16, 17], { every: 4 }), 'Mega Punch'], shot: [fly('punches', [9, 10]), hitAt('008-Weapon03', [16, 17], { every: 4 }), ['Comet Punch', 'Mega Punch']], status: [onUser('punches', [11, 14], { every: 4 }), 'Work Up'] },
  FIRE: { hit: [hitAt('fire5', [0, 7]), 'Fire2'], shot: [fly('Flames', [0, 2], { every: 3 }), hitAt('fire4', [0, 11], { every: 2 }), ['Fire1', 'Fire3']], status: [hitAt('fire5', [0, 7]), 'Fire2'] },
  WATER: { hit: [hitAt('018-Water01', [6, 9]), 'Water1'], shot: [fly('018-Water01', [0, 3]), hitAt('018-Water01', [6, 9]), ['Water2', 'Water1']], status: [hitAt('water3', [1, 9], { every: 2 }), 'Water3'] },
  ELECTRIC: { hit: [hitAt('Thunder2', [0, 5]), 'Thunder1'], shot: [fly('electric2', [0, 7], { every: 2 }), hitAt('017-Thunder01', [0, 5]), ['Paralyze1', 'Thunder3']], status: [hitAt('T. Shock', [0, 5]), 'Paralyze3'] },
  GRASS: { hit: [hitAt('Wind1', [0, 7]), 'Slash2'], shot: [fly('grass', [0, 7], { every: 2 }), hitAt('Wind1', [8, 13]), ['GrassWhistle', 'Slash1']], status: [hitAt('State1', [0, 13], { every: 2 }), 'Pollen'] },
  ICE: { hit: [hitAt('Ice1', [5, 8], { every: 4 }), 'Ice1'], shot: [fly('016-Ice01', [0, 4]), hitAt('016-Ice01', [8, 10], { every: 4 }), ['Ice2', 'Ice5']], status: [hitAt('icewater', [0, 6]), 'Ice8'] },
  POISON: { hit: [hitAt('poison', [9, 12]), 'Poison'], shot: [fly('poison2', [0, 6]), hitAt('poison', [0, 8], { every: 2 }), ['Poison', 'Splat']], status: [hitAt('poison', [0, 8], { every: 2 }), 'Poison'] },
  GROUND: { hit: [hitAt('Earth1', [0, 6]), 'Earth3'], shot: [fly('Sand-Attack', [0, 2], { every: 3 }), hitAt('Earth1', [2, 6]), ['Sand', 'Earth4']], status: [hitAt('Sand-Attack', [0, 2], { every: 4, count: 3, spread: 30 }), 'Sand'] },
  FLYING: { hit: [hitAt('Aerial Ace', [0, 6]), 'Wind5'], shot: [fly('Gust', [0, 0], { every: 4 }), hitAt('Wind1', [0, 13], { every: 2 }), ['gust', 'Wind1']], status: [onUser('Wind1', [0, 13], { every: 2 }), 'Wind7'] },
  PSYCHIC: { hit: [hitAt('Psycho Cut', [0, 12], { every: 2 }), 'Psycho Cut'], shot: [fly('estranho', [1, 3]), hitAt('estranho', [4, 14], { every: 2 }), ['confusion1', 'Psych Up']], status: [hitAt('estranho', [1, 14], { every: 2 }), 'Confuse'] },
  BUG: { hit: [hitAt('Sword6', [0, 15], { every: 2 }), 'Slash6'], shot: [fly('State1', [0, 7]), hitAt('State1', [8, 13]), ['Silverwind', 'Slash3']], status: [hitAt('Special5', [0, 13], { every: 2 }), 'Pollen'] },
  ROCK: { hit: [hitAt('rockice', [0, 4], { every: 4 }), 'rock1'], shot: [fly('Ancient-PowerFilesheet', [0, 8]), hitAt('rockice', [0, 4], { every: 4 }), ['rock2', 'Earth5']], status: [onUser('Ancient-PowerFilesheet', [0, 13], { every: 2 }), 'rock1'] },
  GHOST: { hit: [hitAt('Scratch + Shadow Claw', [5, 9]), 'Nightshade'], shot: [fly('022-Darkness01', [0, 2]), hitAt('022-Darkness01', [3, 5], { every: 4 }), ['Darkness2', 'Darkness6']], status: [hitAt('ghost1', [0, 7]), 'Nightshade'] },
  DRAGON: { hit: [hitAt('dragon claw', [1, 13], { every: 2 }), 'Slash10'], shot: [fly('efftest4', [0, 2]), hitAt('efftest4', [9, 14]), ['Charge_Beam', 'Explosion2']], status: [onUser('efftest4', [3, 8]), 'Charge_Beam'] },
  DARK: { hit: [hitAt('022-Darkness01', [6, 13], { every: 2 }), 'Bite'], shot: [fly('022-Darkness01', [0, 2]), hitAt('022-Darkness01', [3, 5], { every: 4 }), ['Darkness2', 'Darkness6']], status: [hitAt('animsheet', [0, 7], { every: 3 }), 'Scary Face'] },
  STEEL: { hit: [hitAt('Iron Head', [0, 4]), 'metal'], shot: [fly('008-Weapon03', [11, 14]), hitAt('Iron Head', [0, 3], { every: 4 }), ['metal', 'Sword2']], status: [onUser('Iron Head', [0, 3], { every: 4 }), 'Harden'] },
  FAIRY: { hit: [hitAt('Light1', [5, 12], { every: 2 }), 'Saint4'], shot: [fly('electric2', [9, 13], { every: 3 }), hitAt('Light1', [5, 12], { every: 2 }), ['Love', 'Saint6']], status: [hitAt('electric2', [9, 13], { every: 4 }), 'Lovely Kiss'] },
};

// ---------------------------------------------------------------- favourites (their own animations)
const SPECIAL = {
  TACKLE: contact(hitAt('Tackle_B', [0, 0], { dur: 8 }), 'Blow1', [hitAt('003-Attack01', [0, 4], { t: 8 })]),
  BODYSLAM: contact(hitAt('003-Attack01', [0, 4]), 'Slam', [{ t: 8, shake: 'screen', amp: 3, dur: 8 }]),
  QUICKATTACK: [{ t: 0, lunge: 'user', dist: 60, dur: 8 }, snd(0, 'Ace'), hitAt('Aerial Ace', [0, 6], { t: 4 })],
  AERIALACE: [{ t: 0, lunge: 'user', dist: 50, dur: 10 }, snd(2, 'Wind5'), hitAt('Aerial Ace', [0, 6], { t: 4 })],
  SCRATCH: contact(hitAt('scratchbattle', [0, 4]), 'Slash1'),
  SLASH: contact(hitAt('004-Attack02', [0, 8], { every: 2 }), 'Slash8'),
  CUT: contact(hitAt('004-Attack02', [0, 8], { every: 2 }), 'Slash'),
  FURYSWIPES: contact(hitAt('scratchbattle', [0, 4], { every: 2 }), 'Fury Swipes'),
  XSCISSOR: contact(hitAt('X-Scizzor', [0, 1], { every: 5 }), 'Slash9', [hitAt('Sword6', [8, 15], { t: 12, every: 2 })]),
  SHADOWCLAW: contact(hitAt('Scratch + Shadow Claw', [0, 9]), 'Slash11'),
  DRAGONCLAW: contact(hitAt('dragon claw', [1, 13], { every: 2 }), 'Slash10'),
  BITE: contact(hitAt('Crunch', [0, 11], { every: 2 }), 'Bite'),
  CRUNCH: contact(hitAt('Crunch', [0, 11], { every: 2 }), 'Bite', [{ t: 20, shake: 'target', amp: 6, dur: 8 }]),
  THUNDERFANG: contact(hitAt('element fangs', [0, 12], { every: 2 }), 'Bite', [snd(18, 'Thunder1'), hitAt('Thunder2', [0, 5], { t: 18 })]),
  FIREFANG: contact(hitAt('element fangs', [0, 12], { every: 2 }), 'Bite', [snd(18, 'Fire2'), hitAt('fire5', [0, 7], { t: 18 })]),
  ICEFANG: contact(hitAt('element fangs', [0, 12], { every: 2 }), 'Bite', [snd(18, 'Ice1'), hitAt('Ice1', [5, 8], { t: 18, every: 4 })]),
  FIREPUNCH: contact(hitAt('fire5', [0, 7]), 'Mega Punch', [snd(10, 'Fire2')]),
  ICEPUNCH: contact(hitAt('Ice1', [5, 8], { every: 4 }), 'Mega Punch', [snd(10, 'Ice1')]),
  THUNDERPUNCH: contact(hitAt('Thunder2', [0, 5]), 'Mega Punch', [snd(10, 'Thunder1')]),
  MACHPUNCH: [{ t: 0, lunge: 'user', dist: 50, dur: 8 }, snd(4, 'Comet Punch'), hitAt('008-Weapon03', [16, 17], { t: 4, every: 4 })],
  IRONHEAD: contact(hitAt('Iron Head', [0, 4]), 'metal', [{ t: 8, flash: 'rgba(255,255,255,0.4)', dur: 6 }]),
  IRONTAIL: contact(hitAt('Iron Head', [0, 4]), 'metal'),
  EMBER: shot(fly('Flames', [0, 2], { every: 3 }), hitAt('fire5', [0, 7]), ['Fire1', 'Fire2']),
  FLAMETHROWER: [snd(0, 'Fire3'), fly('Flames', [0, 2], { every: 2, dur: 30, count: 3, spread: 8, stagger: 6 }), snd(24, 'Fire6'), hitAt('fire4', [0, 11], { t: 24, every: 2 }), { t: 26, shake: 'target', amp: 4, dur: 12 }],
  FIREBLAST: [snd(0, 'Fire1'), fly('Flames', [0, 2], { dur: 14 }), snd(14, 'Explosion3'), hitAt('fire blast', [0, 10], { t: 14, every: 3 }), { t: 18, flash: 'rgba(255,140,40,0.35)', dur: 10 }, { t: 18, shake: 'screen', amp: 5, dur: 14 }],
  FLAREBLITZ: contact(hitAt('Fire3', [10, 23], { every: 2 }), 'Fire5', [{ t: 6, glow: TYPE_GLOW.FIRE, at: 'user', dur: 20 }]),
  WATERGUN: [snd(0, 'Water2'), fly('018-Water01', [0, 3], { dur: 18, count: 3, spread: 6, stagger: 5 }), snd(18, 'Water1'), hitAt('018-Water01', [6, 9], { t: 18 })],
  BUBBLE: [snd(0, 'Bubble1'), fly('018-Water01', [6, 9], { dur: 22, count: 4, spread: 24, stagger: 4, scale: 0.5 }), snd(22, 'Bubble2')],
  BUBBLEBEAM: [snd(0, 'Bubble1'), fly('018-Water01', [6, 9], { dur: 22, count: 6, spread: 30, stagger: 3, scale: 0.55 }), snd(22, 'Bubble2'), { t: 22, shake: 'target', amp: 3, dur: 8 }],
  WATERPULSE: [snd(0, 'Water3'), fly('Water pulse', [0, 6], { every: 3, dur: 21 }), hitAt('018-Water01', [6, 9], { t: 21 })],
  SURF: [snd(0, 'Water3'), { t: 0, wave: '#3C8CF0', dur: 36 }, snd(18, 'Water5'), hitAt('water3', [1, 9], { t: 16, every: 2 }), { t: 20, shake: 'screen', amp: 4, dur: 12 }],
  HYDROPUMP: [snd(0, 'Water5'), { t: 0, beam: TYPE_GLOW.WATER, width: 22, dur: 26 }, hitAt('water3', [1, 9], { t: 10, every: 2 }), { t: 12, shake: 'target', amp: 6, dur: 14 }],
  THUNDERSHOCK: [snd(0, 'Paralyze1'), hitAt('T. Shock', [0, 5], { t: 0 }), snd(10, 'Thunder3'), hitAt('Thunder2', [0, 5], { t: 10 }), { t: 12, shake: 'target', amp: 3, dur: 8 }],
  THUNDERBOLT: [snd(0, 'Thunder9'), { t: 0, flash: 'rgba(255,240,120,0.35)', dur: 6 }, hitAt('017-Thunder01', [2, 5], { t: 2, every: 3 }), snd(12, 'Thunder3'), hitAt('Thunder2', [0, 5], { t: 12 }), { t: 12, flash: 'rgba(255,255,200,0.45)', dur: 4 }, { t: 12, shake: 'target', amp: 5, dur: 14 }],
  THUNDER: [snd(0, 'Thunder4'), { t: 0, flash: 'rgba(40,40,80,0.45)', dur: 10 }, hitAt('017-Thunder01', [2, 5], { t: 8, every: 3, scale: 1.4, dy: -40 }), { t: 12, flash: 'rgba(255,255,255,0.7)', dur: 5 }, { t: 12, shake: 'screen', amp: 6, dur: 16 }, hitAt('Trovao', [0, 4], { t: 16, every: 2 })],
  THUNDERWAVE: [snd(0, 'Paralyze3'), hitAt('T. Shock', [0, 5], { every: 3, count: 2, spread: 30 })],
  ICEBEAM: [snd(0, 'Ice2'), { t: 0, beam: TYPE_GLOW.ICE, width: 12, dur: 22 }, fly('016-Ice01', [5, 7], { dur: 20, count: 3, spread: 10, stagger: 4, scale: 0.7 }), snd(18, 'Ice8'), hitAt('Ice1', [5, 8], { t: 18, every: 4 })],
  BLIZZARD: [snd(0, 'Wind8'), { t: 0, flash: 'rgba(220,240,255,0.35)', dur: 30 }, hitAt('icewater', [0, 6], { t: 0, every: 3, count: 3, spread: 50 }), snd(18, 'Ice8'), hitAt('Ice1', [5, 8], { t: 18, every: 4 }), { t: 18, shake: 'screen', amp: 3, dur: 12 }],
  POWDERSNOW: [snd(0, 'Wind7'), fly('icewater', [3, 6], { dur: 20, scale: 0.6 })],
  VINEWHIP: contact(hitAt('grass', [5, 7], { every: 3 }), 'Twine'),
  RAZORLEAF: [snd(0, 'Slash2'), fly('grass', [0, 7], { every: 2, dur: 18, count: 4, spread: 20, stagger: 3 }), snd(18, 'Slash1'), { t: 18, shake: 'target', amp: 3, dur: 8 }],
  LEAFBLADE: contact(hitAt('Sword5', [3, 9], { every: 2 }), 'Slash8', [hitAt('Wind1', [8, 13], { t: 18 })]),
  SOLARBEAM: [snd(0, 'Saint8'), onUser('Light1', [0, 6], { every: 2 }), { t: 14, beam: '#FFF0A0', width: 20, dur: 22 }, snd(14, 'HyperBeam'), hitAt('Light1', [6, 12], { t: 24, every: 2 }), { t: 24, shake: 'target', amp: 5, dur: 12 }],
  ABSORB: [snd(0, 'Absorb2'), { cel: 'State1', f: [0, 13], at: 'back', every: 2, dur: 26, count: 3, spread: 18, stagger: 4, t: 0 }, { t: 22, glow: TYPE_GLOW.GRASS, at: 'user', dur: 14 }],
  MEGADRAIN: [snd(0, 'Absorb2'), { cel: 'State1', f: [0, 13], at: 'back', every: 2, dur: 28, count: 4, spread: 22, stagger: 3, t: 0 }, { t: 24, glow: TYPE_GLOW.GRASS, at: 'user', dur: 14 }],
  GIGADRAIN: [snd(0, 'Absorb2'), { cel: 'State1', f: [0, 13], at: 'back', every: 2, dur: 30, count: 6, spread: 26, stagger: 3, t: 0 }, { t: 26, glow: TYPE_GLOW.GRASS, at: 'user', dur: 16 }],
  LEECHSEED: [snd(0, 'LeechSeedThrowing'), fly('leech-seed', [0, 3], { dur: 14, arc: 40 }), snd(14, 'LeechSeedPlanted'), hitAt('leech-seed', [4, 11], { t: 14, every: 3 })],
  SLEEPPOWDER: [snd(0, 'Pollen'), hitAt('Special5', [0, 13], { every: 2, count: 2, spread: 24 })],
  STUNSPORE: [snd(0, 'Pollen'), hitAt('State1', [0, 13], { every: 2, count: 2, spread: 24 })],
  POISONPOWDER: [snd(0, 'Pollen'), hitAt('poison', [0, 8], { every: 3, count: 2, spread: 24 })],
  TOXIC: [snd(0, 'Poison'), hitAt('poison4', [0, 14], { every: 2 })],
  SLUDGEBOMB: shot(fly('poison2', [0, 6], { arc: 30 }), hitAt('poison', [0, 8], { every: 2 }), ['Poison', 'Splat']),
  EARTHQUAKE: [snd(0, 'Earth5'), { t: 0, shake: 'screen', amp: 8, dur: 36 }, hitAt('Earth1', [2, 6], { t: 6, every: 3 }), snd(18, 'Earth4')],
  DIG: contact(hitAt('Earth1', [0, 6]), 'Earth3', [{ t: 6, shake: 'screen', amp: 4, dur: 10 }]),
  MUDSLAP: [snd(0, 'Sand'), fly('Sand-Attack', [0, 2], { every: 3, dur: 14 }), hitAt('Earth1', [3, 6], { t: 14 })],
  SANDATTACK: [snd(0, 'Sand'), fly('Sand-Attack', [0, 2], { every: 3, dur: 16, count: 3, spread: 16, stagger: 3 })],
  GUST: [snd(0, 'gust'), hitAt('Gust', [0, 0], { every: 20, dur: 20, rise: 20 }), hitAt('Wind1', [0, 13], { t: 6, every: 2 })],
  WINGATTACK: contact(hitAt('Aerial Ace', [0, 6]), 'Wind5'),
  FLY: contact(hitAt('Aerial Ace', [0, 6]), 'Wind8', [{ t: 6, shake: 'target', amp: 6, dur: 10 }]),
  BRAVEBIRD: contact(hitAt('Firebird', [10, 18], { every: 2 }), 'Wind8', [{ t: 6, glow: '#FF9040', at: 'user', dur: 20 }]),
  PSYCHIC: [snd(0, 'Psych Up'), { t: 0, flash: 'rgba(255,110,190,0.28)', dur: 30 }, hitAt('estranho', [1, 14], { every: 2 }), { t: 6, shake: 'target', amp: 5, dur: 24 }],
  CONFUSION: [snd(0, 'confusion1'), hitAt('estranho', [1, 9], { every: 2 }), { t: 4, shake: 'target', amp: 4, dur: 14 }],
  PSYBEAM: [snd(0, 'Psych Up'), { t: 0, beam: TYPE_GLOW.PSYCHIC, width: 10, dur: 22 }, fly('Water pulse', [0, 6], { every: 3, dur: 20, count: 3, stagger: 5, scale: 0.6 }), hitAt('estranho', [4, 12], { t: 18, every: 2 })],
  PSYCHOCUT: contact(hitAt('Psycho Cut', [0, 12], { every: 2 }), 'Psycho Cut'),
  SHADOWBALL: shot(fly('022-Darkness01', [0, 2], { every: 3, dur: 18, scale: 0.8 }), hitAt('022-Darkness01', [3, 5], { every: 4 }), ['Darkness6', 'Explosion2']),
  NIGHTSHADE: [snd(0, 'Nightshade'), { t: 0, flash: 'rgba(30,0,50,0.45)', dur: 24 }, hitAt('face and eye', [0, 7], { every: 3 })],
  LICK: contact(hitAt('ghost1', [0, 7]), 'Nightshade'),
  DRAGONPULSE: shot(fly('efftest4', [0, 2], { dur: 18 }), hitAt('efftest4', [9, 14]), ['Charge_Beam', 'Explosion2']),
  DRAGONBREATH: [snd(0, 'Fire3'), fly('efftest4', [0, 2], { every: 2, dur: 24, count: 3, spread: 12, stagger: 5, scale: 0.7 }), hitAt('efftest4', [9, 12], { t: 20 })],
  OUTRAGE: [{ t: 0, glow: '#FF4040', at: 'user', dur: 20 }, { t: 10, lunge: 'user', dist: 40, dur: 12 }, snd(16, 'Slash10'), hitAt('dragon claw', [1, 13], { t: 16, every: 2 }), { t: 18, shake: 'screen', amp: 5, dur: 14 }],
  DARKPULSE: [snd(0, 'Darkness6'), hitAt('022-Darkness01', [0, 5], { every: 3, count: 3, spread: 36 }), { t: 10, shake: 'target', amp: 4, dur: 12 }],
  ROCKTHROW: shot(fly('Rock Tomb', [0, 7], { arc: 40 }), hitAt('rockice', [0, 4], { every: 4 }), ['throw', 'rock1']),
  ROCKSLIDE: [snd(0, 'rock2'), { cel: 'Rock Tomb', f: [0, 7], at: 'target', every: 2, dur: 18, count: 4, spread: 50, stagger: 4, fall: 110, t: 0 }, snd(16, 'Earth5'), { t: 16, shake: 'screen', amp: 5, dur: 12 }, hitAt('rockice', [0, 4], { t: 16, every: 4 })],
  STONEEDGE: [snd(0, 'Earth4'), hitAt('016-Ice01', [12, 19], { every: 2, count: 3, spread: 36 }), { t: 10, shake: 'target', amp: 6, dur: 12 }],
  ANCIENTPOWER: shot(fly('Ancient-PowerFilesheet', [0, 8], { arc: 30 }), hitAt('rockice', [0, 4], { every: 4 }), ['rock2', 'Earth5']),
  HYPERBEAM: [snd(0, 'HyperBeam'), onUser('Light1', [0, 6], { every: 2 }), { t: 10, beam: '#FFD0FF', width: 30, dur: 30 }, { t: 18, flash: 'rgba(255,255,255,0.4)', dur: 8 }, hitAt('030-Explosion01', [0, 6], { t: 20, every: 3 }), snd(20, 'Explosion3'), { t: 20, shake: 'screen', amp: 7, dur: 18 }],
  GIGAIMPACT: [{ t: 0, glow: '#FFFFFF', at: 'user', dur: 12 }, { t: 8, lunge: 'user', dist: 70, dur: 14 }, snd(14, 'Explosion2'), hitAt('030-Explosion01', [0, 6], { t: 14, every: 3 }), { t: 14, shake: 'screen', amp: 8, dur: 18 }],
  EXPLOSION: [snd(0, 'Explosion7'), onUser('030-Explosion01', [0, 7], { every: 3, scale: 1.5 }), { t: 12, flash: 'rgba(255,255,255,0.85)', dur: 12 }, { t: 12, shake: 'screen', amp: 10, dur: 24 }],
  SELFDESTRUCT: [snd(0, 'Explosion6'), onUser('030-Explosion01', [0, 7], { every: 3, scale: 1.2 }), { t: 12, flash: 'rgba(255,255,255,0.7)', dur: 10 }, { t: 12, shake: 'screen', amp: 8, dur: 18 }],
  SWIFT: [snd(0, 'Saint6'), fly('007-Weapon02', [11, 13], { every: 3, dur: 18, count: 5, spread: 30, stagger: 3 }), hitAt('003-Attack01', [9, 9], { t: 18, dur: 8 })],
  AURORABEAM: [snd(0, 'Saint9'), { t: 0, beam: '#C0FFE0', width: 14, dur: 24 }, fly('023-Burst01', [1, 7], { every: 3, dur: 22, scale: 0.5 }), hitAt('023-Burst01', [2, 7], { t: 20, every: 2 })],
  MOONBLAST: [snd(0, 'Saint3'), onUser('normal2', [12, 12], { dur: 16, rise: 30 }), fly('normal2', [12, 12], { t: 16, dur: 14, scale: 0.6 }), hitAt('Light1', [5, 12], { t: 30, every: 2 }), { t: 30, flash: 'rgba(255,200,240,0.35)', dur: 8 }],
  DAZZLINGGLEAM: [snd(0, 'Saint7'), { t: 0, flash: 'rgba(255,220,250,0.5)', dur: 14 }, hitAt('Light1', [5, 12], { t: 4, every: 2, count: 3, spread: 40 })],
  // status moves
  GROWL: [{ t: 0, cry: 'user' }, onUser('Growl', [0, 2], { every: 6, dx: 60, scale: 1.8 }), onUser('Growl', [0, 2], { t: 6, every: 6, dx: 90, scale: 1.8 })],
  LEER: [snd(0, 'Leer'), onUser('leer', [0, 4], { every: 3 })],
  SCARYFACE: [snd(0, 'Scary Face'), hitAt('normal2', [10, 10], { dur: 20 })],
  SING: [snd(0, 'Sing'), fly('normal1', [0, 5], { every: 4, dur: 30, count: 3, spread: 20, stagger: 6 })],
  SUPERSONIC: [snd(0, 'Sound2'), fly('Water pulse', [0, 6], { every: 3, dur: 20, count: 3, stagger: 6, scale: 0.7 })],
  CONFUSERAY: [snd(0, 'Confuse'), fly('028-State01', [0, 0], { dur: 20, arc: 20 }), hitAt('confused', [0, 15], { t: 20, every: 2 })],
  SWORDSDANCE: [snd(0, 'Swords Dance'), onUser('Sword5', [0, 20], { every: 2, scale: 1.5 }), { t: 20, glow: '#FF9050', at: 'user', dur: 18 }],
  AGILITY: [snd(0, 'Wind1'), onUser('Wind1', [0, 13], { every: 2 }), { t: 0, lunge: 'user', dist: -16, dur: 12 }],
  DRAGONDANCE: [snd(0, 'Saint8'), onUser('efftest4', [3, 8], { every: 3 }), { t: 8, glow: TYPE_GLOW.DRAGON, at: 'user', dur: 20 }],
  RECOVER: [snd(0, 'Recovery'), onUser('Heal3', [11, 17], { every: 3, scale: 1.4 }), onUser('Heal3', [15, 17], { t: 12, every: 4, scale: 1.2, rise: 30 }), { t: 6, glow: '#B0FFB0', at: 'user', dur: 24 }],
  SOFTBOILED: [snd(0, 'Recovery'), onUser('Heal3', [11, 17], { every: 3, scale: 1.4 }), { t: 6, glow: '#FFF0B0', at: 'user', dur: 24 }],
  ROOST: [snd(0, 'Recovery'), onUser('Heal5', [0, 12], { every: 2 })],
  SYNTHESIS: [snd(0, 'Saint1'), onUser('Heal3', [0, 9], { every: 3 })],
  REST: [snd(0, 'Sleep'), onUser('028-State01', [8, 8], { dur: 30, rise: 40 })],
  PROTECT: [snd(0, 'Refresh'), onUser('anim sheet', [18, 18], { dur: 28, alpha: 0.8 })],
  DETECT: [snd(0, 'Refresh'), onUser('anim sheet', [18, 18], { dur: 28, alpha: 0.8 })],
  REFLECT: [snd(0, 'Saint3'), onUser('anim sheet', [15, 15], { dur: 28, alpha: 0.6 })],
  LIGHTSCREEN: [snd(0, 'Saint3'), onUser('anim sheet', [15, 15], { dur: 28, alpha: 0.6 })],
  SUBSTITUTE: [snd(0, 'Substitute'), onUser('Light1', [0, 6], { every: 2 })],
  METRONOME: [snd(0, 'Metronome'), onUser('finger.spoon', [0, 5], { every: 4 })],
  SPLASH: [snd(0, 'Water1'), { t: 0, lunge: 'user', dist: -1, dur: 20, hop: 18 }],
  HARDEN: [snd(0, 'Harden'), { t: 0, glow: '#FFFFFF', at: 'user', dur: 20 }],
  DEFENSECURL: [snd(0, 'Defense Curl'), { t: 0, glow: '#FFE0A0', at: 'user', dur: 20 }],
  CHARM: [snd(0, 'Love'), hitAt('electric2', [9, 13], { every: 4, count: 3, spread: 30 })],
  ATTRACT: [snd(0, 'Love'), fly('electric2', [9, 13], { every: 4, dur: 24, count: 3, spread: 20, stagger: 5 })],
  SWEETKISS: [snd(0, 'Lovely Kiss'), fly('electric2', [9, 13], { every: 4, dur: 20 })],
  BABYDOLLEYES: [snd(0, 'Lovely Kiss'), onUser('normal2', [7, 8], { every: 6 }), hitAt('electric2', [9, 13], { t: 12, every: 3 })],
  HYPNOSIS: [snd(0, 'Sleep'), fly('Water pulse', [0, 6], { every: 3, dur: 22, count: 3, stagger: 6, scale: 0.6 })],
  SMOKESCREEN: [snd(0, 'Smokescreen'), hitAt('weather', [10, 10], { dur: 26, alpha: 0.7 })],
  WHIRLWIND: [snd(0, 'Whirlwind'), hitAt('many', [10, 12], { every: 4 })],
  ROAR: [snd(0, 'Uproar'), onUser('Growl', [0, 2], { every: 5, dx: 50 }), { t: 6, shake: 'target', amp: 4, dur: 16 }],
  WILLOWISP: [snd(0, 'Fire1'), fly('ghost2', [0, 4], { every: 3, dur: 20, count: 3, spread: 16, stagger: 4 }), hitAt('fire5', [0, 5], { t: 20 })],
  SPORE: [snd(0, 'Pollen'), hitAt('Special5', [0, 13], { every: 2, count: 3, spread: 30 })],
  YAWN: [snd(0, 'Yawn'), hitAt('028-State01', [8, 8], { dur: 24, rise: 30 })],
};

/**
 * The steps for a move, by its own recipe or by type and contact. `hit` is when it lands (the first shake of the
 * target or the screen), so a game can crack its rock or raise its shield right then.
 */
export function recipeFor(move) {
  const own = SPECIAL[move.id];
  const T = TYPE[move.type] || TYPE.NORMAL;
  const steps = own || (move.contact ? contact(T.hit[0], T.hit[1]) : shot(T.shot[0], T.shot[1], T.shot[2]));
  const dur = Math.max(...steps.map(s => (s.t || 0) + stepDur(s))) + 4;
  const shakes = steps.filter(s => s.shake === 'target' || s.shake === 'screen').map(s => s.t || 0);
  return { steps, dur, hit: shakes.length ? Math.min(...shakes) : Math.round(dur * 0.6) };
}

/** Every cel sheet and sound a move uses (tools/check-data.mjs checks they exist). */
export function assetsFor(move) {
  const { steps } = recipeFor(move);
  return { sheets: [...new Set(steps.filter(s => s.cel).map(s => ANIM(s.cel)))], sounds: [...new Set(steps.filter(s => s.se).map(s => `audio/se/move-anims/${s.se}`))] };
}

/** How long a step lasts, in frames. */
export function stepDur(s) {
  if (s.dur) return s.dur + (s.count && s.stagger ? (s.count - 1) * s.stagger : 0);
  if (s.cel) return celList(s).length * (s.every || 3) + (s.count && s.stagger ? (s.count - 1) * s.stagger : 0);
  return 1;
}
export function celList(s) {
  if (Array.isArray(s.f) && s.f.length === 2 && typeof s.f[0] === 'number' && s.f.length === 2 && !s.list) {
    const [a, b] = s.f, out = [];
    for (let i = a; i <= b; i++) out.push(i);
    return out;
  }
  return s.f;
}
export const sheetPath = ANIM;
export const RECIPES = SPECIAL;
