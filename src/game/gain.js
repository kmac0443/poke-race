// What one training session adds to a stat. Import-free, so the race ladder's yardstick (game/race.js, run by the
// tools in node) uses exactly the formula the game does (game/training.js).
//   right    right answers in the session
//   growth   the species' base stat ÷ 70 (1 = an average grower), never below settings.minGrowth: Abra's Defense
//            (base 15) would otherwise train at a fifth of the pace, and a child who picked Abra would be stuck
//   now      the stat before the session: the gain shrinks as it grows, so all three get trained
export function statGain(right, growth, now, settings) {
  if (right <= 0) return 0;
  const soft = 1 / (1 + now / settings.statSoftCap);
  return Math.max(1, Math.round(right * settings.trainingGainPerRight * Math.max(settings.minGrowth, growth) * soft));
}
