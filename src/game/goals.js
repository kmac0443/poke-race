// Which evolutions a species can head for, and what each needs (DESIGN.md "Evolution: a visible goal").
// Import-free (the species map is passed in) so tools/check-data.mjs can run it in node.
//
// settings.evolutionGoals has hand-made goals for the default lines. Any other species (one a parent added to a
// pick list: Vulpix, Oddish…) gets goals from its real evolutions in species.json, with the default criteria for
// its place in its line (settings.evolutionDefaults): the first of two evolutions, the second of two, or the only
// one. Evolutions into species we can't draw (no front sprite or run sheet) are left out.

const drawable = sp => !!(sp && sp.sprites.front && sp.sprites.run);

const evolvedFrom = new WeakMap();      // species map → Set of every species something evolves into
function hasPrevo(species, id) {
  if (!evolvedFrom.has(species)) evolvedFrom.set(species, new Set([...species.values()].flatMap(s => s.evolutions.map(e => e.into))));
  return evolvedFrom.get(species).has(id);
}

/** { [into]: [criteria] } for a species; {} when it doesn't evolve (or not into anything we can draw). */
export function goalsFor(speciesId, settings, species) {
  const own = settings.evolutionGoals[speciesId];
  if (own) return own;
  const sp = species.get(speciesId);
  if (!sp) return {};
  const into = [...new Set(sp.evolutions.map(e => e.into))].filter(id => drawable(species.get(id)));
  if (!into.length) return {};
  const middle = hasPrevo(species, speciesId), d = settings.evolutionDefaults, out = {};
  for (const id of into) {
    const evolvesAgain = species.get(id).evolutions.some(e => drawable(species.get(e.into)));
    out[id] = evolvesAgain ? d.firstOfTwo : middle ? d.secondOfTwo : d.only;
  }
  return out;
}
