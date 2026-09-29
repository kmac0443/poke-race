# Working on Pokémon Race

A math-training / racing Pokémon game for one family: two players, split screen. Train your Pokémon in short math
minigames (steered with the movement keys, never typed), watch it race three opponents, and look after it on a
shared farm. A parent tunes everything on `admin.html`. Vanilla ES modules + canvas, **no build step**.

It started as a spin-off of the family's 3-player RPG (`../pokemon-adventure`). **Everything needed from that
project has been copied here** (assets, core modules, tools, and reference code), so there's no need to open it.

## Start here (a fresh session)

1. **[DESIGN.md](DESIGN.md)**: what we're building and why. Every mechanic is specified there. Respect its **To
   decide** list: don't build an undecided mechanic as if it were settled. Ask.
2. This file's **Golden rules** below.
3. **[assets/ASSETS.md](assets/ASSETS.md)**: every asset's format and use.
4. **[reference/README.md](reference/README.md)**: code from the RPG worth copying (the split-screen shell, tile
   maps, walking, autotiles, the evolution scene, effect playback, music choice). Read it before writing the same
   thing from scratch.
5. Then follow DESIGN.md's **Build order**. Step 1 is the shell.

`brainstorm.txt` is the original conversation, for background only; DESIGN.md supersedes it.

## Run it

```
node server.js            # or start.bat → http://localhost:8081
npm install               # once, for the headless playtests (puppeteer-core; uses the installed Chrome/Edge)
node tools/shot.js tools/playtests/<script>.js shots
```

Windows machine; Git Bash and PowerShell both available. `src/package.json` is `{"type":"module"}` so
`node --check src/**.js` works on the browser modules.

## What's here so far

```
assets/                 all art, sound and data (≈130 MB, mostly music), see assets/ASSETS.md
assets/data/species.json   1,025 species: names, types, base stats, evolutions, sprite paths
assets/data/tilesets.json  tile passability / priority / terrain tags (paths fixed for our layout)
src/core/assets.js      img(path) / preload / loadJson / draw: paths are relative to assets/
src/core/audio.js       requestBgm(key, name, priority) (one song at a time), se(name), jingle(name), cry(path)
src/core/input.js       PlayerInput(i): P1 WASD + Q yes / E no / Tab menu; P2 numpad 8456 + 7 yes / 9 no / Enter menu;
                        + gamepads 1–2;
                        pressed / isDown / repeatPressed / dir
src/core/ui.js          GBA text + 9-slice windows, Scene base class, MessageScene, ChoiceScene, NumberScene
server.js, start.bat    static server
index.html, src/main.js the game page: boot, 60 Hz loop, the two 512×384 halves, window.game
src/game/game.js        Game (save, music, hub) + Seat = one half of the screen: input, scene stack, push() → promise,
                        profileIndex (which child is in that half). window.game.players[i] is seat i
src/game/save.js        the localStorage save (layout in its header comment); ?dev never writes
src/game/settings.js    settingsFor(profile), setSetting / resetSetting (an override equal to the default is dropped)
src/game/species.js     loadSpecies(), SPECIES (id → species.json entry), canRace, STATS / STAT_BASE, growthPips
src/game/pokemon.js     a child's Pokémon (fields in its header), givePokemon, pickOptions (one of each; Eevee per branch),
                        activePokemon (the follower; null = it's off exploring), picksWaiting / nextPickProgress (earned
                        Pokémon: worked out from wins and Pokémon owned, nothing extra saved)
src/game/evolution.js   evolutionGoal(pk): the next form + each criterion as { icon, have, need }; evolutionOptions;
                        needsBranch / readyToEvolve / evolve (stat jump, formerSpecies)
src/game/bag.js         the 🎒 bag: profile.bag { ITEM: n }, profile.holding, addToBag / takeFromBag, giveTreat
src/game/house.js       a child's house: profile.house.items [{ item, x, y }] + walls [{ x, y, style }] (toggleWall,
                        canWall) on an 18×11 tile floor, DOOR kept clear,
                        canPlace / place / move / putAway / walkable, pk.home (lives there: off the farm), sendHome / takeAlong
src/game/needs.js       needs from training: noteTraining (every needsEverySessions, the Pokémon that trained), profile.needs
src/game/goals.js       goalsFor(species, settings, speciesMap): evolutionGoals, else goals from species.json's real
                        evolutions + evolutionDefaults (Vulpix, Oddish…); import-free (check-data runs it)
src/game/gain.js        statGain: the one training-gain formula (import-free: the ladder's yardstick uses it in node)
src/game/math.js        the math engine: factsForLevel, levelStatus / masteryLevel (accuracy first), currentLevel
                        (answers only, no stats), nextProblem (flash cards: boxes, due by problems/days, a saved
                        line-up of the next 5 in profile.math.queue, new facts only while doing well; upcoming()),
                        choices (neighbouring facts, shuffled), record (the table + boxes; pass settings: a miss goes
                        back in the line-up 2 later), problemText, Ease (a run of misses → opts.easy + `slower`)
src/game/anims.js       move-animation recipes ported from the RPG: recipeFor(move) → { steps, dur, hit }, assetsFor
src/game/moves.js       movesFor(species): three moves (src/data/moves.js: LINE_MOVES by first stage, else TYPE_MOVES)
src/game/training.js    trainingGain / finishTraining: stats only go up, × growth, shrinking as the stat grows
src/game/race.js        the race simulator (no randomness): simulate, runRace, lossHint, budgetFor (LADDER: stats after
                        2 + 3 × n training sessions), winningBuilds, scaledRace (a child's opponent strength).
                        Change a number here (or a training default) → regenerate the ladder
src/game/ladder.js      a Pokémon's place on the ladder: currentRank, nextRace, venueProgress, winsAtType
src/data/venues.js      the 8 venues: type, terrain, obstacle mix, ground tiles, picture, music, ribbon colour
src/data/races.js       GENERATED by tools/gen-races.mjs (never edit by hand)
src/data/defaults.js    DEFAULTS (every parent-tunable setting), LEVELS (math level specs), EEVEELUTIONS, evolution goals
src/data/avatars.js     trainer looks (portrait + walk sheet)
src/data/moves.js       MOVES { id, name, type, contact }, TYPE_MOVES, LINE_MOVES (check-data checks every sheet/sound)
src/scenes/             title → playerSelect → pickPokemon (+ Eeveelution choice) → farm; common.js = drawing helpers
src/scenes/farm.js      FarmScene: one seat's camera + input on the shared farm; PLACE_SCENES (place key → scene
                        factory; null = not built, shows 🚧); NEEDS_FOLLOWER (❔ without one); LeaveScene (Tab, ✔/✖);
                        B held standing still lets the follower go (B while walking = run); the lab's 🎁; Tab →
                        FarmMenuScene (🎒 / 🚪); checkGrowth → BranchScene / EvolutionScene for the follower; draws
                        needs, care spots, held items, ❤️ meters, houses' bubbles in their child's colour
src/scenes/speedTraining.js  ⚡ the lane run (place `speed`): moves burst through right gates, boards fly; 3 in a row → boost
src/scenes/strengthTraining.js  💪 break the rock with moves: arrow + A on the move with the answer (place `strength`)
src/scenes/defenseTraining.js  🛡️ guess the attack: shield + A (no timer), a wild Pokémon attacks (place `defense`)
src/scenes/moveFx.js    MoveFx: plays anims.js recipes between two points; offset('user'/'target'), shake, preload
src/scenes/shop.js      🛒 the shop (place `shop`): two shelves (🍓 treats, 🛋️ furniture), 🪙 → into the bag; drawItem
src/scenes/bag.js       🎒 the bag (Tab → 🎒 on the farm): hold a treat (A on any Pokémon gives it), ✋ put it away
src/scenes/house.js     🏠 a child's house (places `home0` / `home1`): 🚶 walk mode (walk about, A: hello / use furniture
                        after a question; follow / move in with A or held B, as on the farm; out the door) and ✏️ edit
                        mode (Tab; 🪑 ✋ 🗑️ 🧱 each behind a question, 🚶);
                        residents are Characters; a visitor can't edit
src/scenes/mathAsk.js   MathAskScene: "answer to do it" (three answers, wrong → answer shown + ask again, B gives up)
src/scenes/evolution.js EvolutionScene (the cutscene, no text) and BranchScene (pick the way it will go)
src/world/care.js       FarmCare: the saved needs (game/needs.js), A → problem + three numbered spots to fetch
                        from, deliver; right → careFriendship. Hub.interact: care task → held treat → a need → follow
src/scenes/stadium.js   🏁 the stadium (place `race`): venue map → preview → race (barriers: smash with its own move,
                        or headbutts; dust; photo-finish slow motion) → results (ribbon + 🪙 + confetti / what to train)
src/scenes/trainingResults.js  the end of every training session: applies + saves the gain, shows ✔s, trophies, the bar
src/scenes/lab.js       🧪 the lab (place `lab`): a Poké Ball while a Pokémon is earned → pick → it follows you; else 🏁s to go
src/scenes/trophyRoom.js  🏆 the trophy house (place `trophy`): a case per Pokémon, card (stats, wins, ❤️, goal) / ribbons
src/world/hub.js        the farm map (FARM layout, places, spawns) + Hub: walkers and followers per seat, exploring
                        Pokémon (everyone nobody is walking with), follow / let go, hellos, effects. game.hub, once a frame
src/world/              builder.js (ASCII → tiles, stamps, fenced pens, 2×3 forest check), map.js, character.js,
                        tileset.js: ported from reference/world/, trimmed
admin.html, src/admin.js   parent page: child tabs, name/picture, their Pokémon (give / remove / follower / goal /
                        stats), math floor/ceiling, Pokémon list + lookup,
                        Eeveelutions, races per new Pokémon, pacing (session length, gain, easing, opponents, coins),
                        flash cards (summary, next 5, a grid per level coloured by box, hover history, click to reset),
                        bag and house (+ / − any item, ↩ placed furniture back to the bag, knock down the walls).
                        Read-modify-writes the save; the open game reloads on change
tools/gen-races.mjs     builds src/data/races.js (seeded; opponents from tools/race-pool.mjs)
tools/check-races.mjs   simulates every race: ≥2 winning builds at its budget, no repeated opponents; reports
                        race lengths, which builds win where, each starter played by a child who follows the loss
                        hint (sessions per race), one-stat-only children. Run both after touching race.js
tools/test-math.mjs     the math engine without a browser: mastery, floor/ceiling, flash cards (misses back soon,
                        gaps growing, the saved line-up, old facts returning, no new facts while struggling), choices
tools/check-data.mjs    defaults.js vs species.json (IDs exist, have sprites, evolutions are real) + every move's
                        animation sheets and sounds exist + shop items / furniture (names, icons, src inside the
                        sheet, known uses) + wall styles: node tools/check-data.mjs
tools/import-assets.py  THE list of assets we took (and why). Already run; only rerun to pull in more
tools/extra-sprites/    sprites the source didn't have (front sprites for the Fletchling line)
tools/sheet.py          render tileset tiles with their ids + passability: python tools/sheet.py 1 1240 1272 out.png
tools/anim-sheets.py    numbered contact sheets of the effect animations: python tools/anim-sheets.py shots/anims
tools/playtests/        shell.js (title → pick → farm, leave, save, ?dev), farm.js (walking, exploring, follow/let go,
                        🚧/❔, a place's enter/exit; saves farm-map.png), speed.js (a bot plays Speed training; checks the
                        problem table and the gain), strength.js, defense.js (same), escape.js (the menu button ends a
                        game early and keeps the gain), tellapart.js (child colours, goal icons), race.js (lose →
                        hint, win → ribbon + 🎁 + 🪙 + saved), shop.js (buy → bag → hold → give), care.js (needs from training; a need: wrong spot, then right),
                        house.js (walk / edit, place / move / put away / use / walls behind questions; move in / follow / hold B;
                        a visitor), evolve.js (Charmander → Charmeleon;
                        Gloom's choice), earn.js (a first win → the lab → a new Pokémon; the trophy house), race-look.js (a picture of every venue), admin.js, admin-played.js (a played save; managing their Pokémon) (admin page + live reload), admin-cards.js
                        (the flash-card view; Vulpix's goal), admin-house.js
                        (bag + / −, ↩, walls); _walk.js = BFS walk helpers
reference/              code from the RPG to copy and adapt; NOT imported by the game (reference/README.md)
tools/shot.js           headless Chrome driver with real key presses (t.press/hold/wait/shot/eval)
tools/chiptune.py       GBA-style synth: python tools/chiptune.py "Name" → assets/audio/bgm/Name.wav
                        (songs are data in tools/chiptune_songs.py: Home Farm, Speed Track, Quarry, Arena, Trophy House, Home;
                        the venues, the lab (Lab.ogg) and the shop (Poke Mart.ogg) use existing tracks)
```

Build order steps 1–8 are done (plus the bag and the houses): the shell, the farm as the shared home (no home menu; every
activity is a place you walk into), the math engine, all three training games, and races. Each child has a colour
(profile.color; a seat's colour is its child's), shown on their Pokémon too. Every activity except races ends early
on the menu button, keeping what was earned (`TrainingResults`). A new activity plugs in via `PLACE_SCENES[key]` in `src/scenes/farm.js`;
the player's follower (`activePokemon(profile)`) is the Pokémon it's for. Every farm place is built now. **Math vs
not:** training, farm care and house changes are math-driven; races and using rewards (the shop, giving treats,
choosing who lives at home) aren't. **Next:** step 9 (admin: evolution table, backup) and whatever the family's
playtesting shows.

`tools/shot.js`'s `t.top(i)` / `t.mashUntil` expect `window.game.players[i].top` (the top scene's class). Keep
exposing `window.game` the same way so the helpers work.

## Golden rules

1. **Movement keys only.** The child never types a number. An answer lives in a lane, a direction or a spot on the
   farm, and you steer or walk to it. Keep the link physical: the answer *is* the place, never a code like "24 means
   right". Typing is allowed only on `admin.html`.
2. **Running is automatic.** Speed training steers lanes only; races take no input at all.
3. **Two players, no competition between them.** The kids are different ages. Never race them against each other,
   compare them, or rank them. The shared farm is co-op.
4. **Everything is per Pokémon:** stats, races won (a won race is closed *for that Pokémon*), ribbons, trainings,
   friendship, evolution progress. The player owns Pokémon, a math profile and settings.
5. **Three stats: Speed, Strength, Defense** (+ friendship: treats from the shop, later farm care). Don't add more
   without asking.
6. **Math facts only** (add/subtract within 12+12, times tables 1–12, their divisions, simple fractions later).
   Problems come from the math engine, per player and clamped to that player's admin floor/ceiling. They're never
   hard-coded in a game. **Every individual problem (`2+3`, `5×7`) is tracked per child** (seen, right, wrong, last
   10, times, wrong answers picked, flash-card box). Mastery is **accuracy first**: a child moves up a level only when
   every fact in it is reliably right. Learning depends on answers only, never on Pokémon stats. Both children
   start at level 1 (add within 5).
7. **Wrong answers must be plausible** (neighbouring facts), never in a learnable position, and after a miss the
   correct answer is shown briefly.
8. **Stats never go down.** A bad session earns less, it doesn't take anything away. Races use momentum, not HP.
   Farm needs never decay in real time.
9. **Races are decided by stats, with no randomness at all.** The same stats always give the same race, so a
   retry without training changes nothing (retries are allowed). Every race has its own 3
   opponents. The ladder is generated (`tools/gen-races.mjs`) and must pass `tools/check-races.mjs`, with **at least
   two winning builds** that a child can reach by then.
10. **Goals are visible.** Evolution criteria show as progress bars. Branching evolutions are picked ahead of time.
11. **No reading needed to play.** Icons, pictures and sounds; numbers only in math problems and progress counters.
    Show race difficulty as pictures (barrier size, preview icons), not stat numbers.
12. **Anything a parent might want to change goes in `src/data/defaults.js`** and is editable on `admin.html`
    **per child**: the Pokémon pick list, evolution criteria, math levels, pacing knobs. Read settings through one
    function (`settingsFor(player)` = defaults + that child's overrides), never from `defaults.js` directly.
    The save stores only overrides.
    **One of each species per child, except Eevee** (one per Eeveelution, fixed when it's picked).
13. **Never build a sprite path by hand.** Use `assets/data/species.json`'s `sprites` (null = doesn't exist). Only
    species with both `front` and `run` (653) can be a player's Pokémon or an opponent. Verify every species ID
    exists before using it.
14. **Anything called from the game loop must be smoke-tested.** An exception in the update loop freezes the whole
    game silently. Run a headless playtest after adding any callback.
15. **Need another asset?** Look in `assets/` first (it's the whole useful library). If it really isn't there, add
    it to `tools/import-assets.py`'s manifest and rerun (that needs `../pokemon-adventure`). Don't copy by hand.
    Sprites neither project has go in `tools/extra-sprites/` (listed in `EXTRAS`) with a credit in
    `assets/CREDITS.md`.
16. **Never guess a tile id.** Render it with `tools/sheet.py` and look. Trees and cliffs are **2 tiles wide × 3
    tall**; place them in whole units or they draw as half-trees (see `reference/mapgen.py`).

## Conventions carried over from the RPG

- Each player's half is **512 × 384** (two side by side = 1024 × 384), integer-scaled to the window,
  nearest-neighbour everywhere. Assets are already 2×.
- Per-player scene stacks: each half has its own stack (title, player select, then the farm; places and menus pushed on top), and
  both run in one 60 Hz loop. `scene.push()` returns a promise.
- Scenes on a stack (`core/ui.js` `Scene`); `update()` then `draw(ctx)` at 60 Hz.
- The track is **seen from above and scrolls right** (the overworld's 3/4 view), not a side-on platformer. There's
  no side-view ground art; the top-down tiles and the run sheets' right-facing row are made for this camera.
  Lanes are rows of the track.
- One song per place (a venue, the farm, each training game). New places get new tunes from `tools/chiptune.py`
  rather than reusing a neighbour's. **One speaker, two players:** pick one song by where the active players are,
  and keep a new song at least 8 s (`reference/game/updateMusic.js`). Following whoever acted last flips the song
  constantly.
- Dev mode (`?dev`): shortcuts for testing are fine, but nothing done in dev mode may be saved into a child's
  progress.
- The family likes it simple: short sessions, big feedback (cries, shakes, sparkles), nothing to read.

## Mistakes already made (add to this)

Carried over from the RPG, where they actually happened:

| What went wrong | Why | Now |
|---|---|---|
| The whole game froze at a puzzle | a callback used a function that wasn't imported; the exception killed the loop | smoke-test every callback headlessly |
| An error vanished silently | an event runner caught exceptions and carried on | watch the console in playtests (`tools/shot.js` prints errors); catching isn't fixing |
| The game failed to load (`Cannot access 'x' before initialization`) | an import cycle between game code and data modules | keep core/game modules from importing data-heavy modules that import them back; tiny shared helpers go in their own import-free module |
| Heredoc edits mangled quotes and regexes | shell escaping | use the Write/Edit tools for JS; Python scripts in files for mechanical replaces |
| A patch script wiped half a file | it cut from a marker that appeared twice | anchor edits on something unique and assert the span is small |
| Playtests ended in surprise events / got stuck on messages | random events and dialogs weren't silenced | give playtests a dev switch; press A until the top scene is the one you expect |
| A playtest read a position mid-fade | a fade was still running | "at rest" = not moving, not busy, top scene isn't a fade |
| Half-drawn trees | tree masses weren't in 2×3 units | whole units only; `tools/sheet.py` before any tile id |
| A save put a player inside scenery | no validation on load | on load, move anyone on a solid tile to the nearest free one |
| Two places shared one song | a track was reused | one track per place |
| Music flipped between songs every few steps | it followed whoever moved last | majority of active players + minimum 8 s |

In this project:

| What went wrong | Why | Now |
|---|---|---|
| A playtest read `window.game.save` and got undefined | the page has `<canvas id="game">`, so `window.game` is that element until boot finishes (slow in a background tab) | `waitForFunction(() => window.game && window.game.save)` before touching the game |
| The farm threw `Cannot set properties of null` right after leaving | a scene closed itself in a promise `.then`, which runs only after the frame's catch-up steps, so its `update()` ran once more with its player gone | a scene whose state can vanish guards `update()`; don't count on `.then` running before the next step |
| A playtest's short key tap made the player step instead of turn | headless Chrome runs frames in bursts, so a tap can span many 60 Hz steps | test timing-sensitive rules by driving them directly (`hub.updateWalker` with an intent), not by key-press length |
| Coming back out of the track, a tap walked instead of turning | the farm's held-key counter still counted the press that walked in | reset per-scene input state when the scene gets the top back |
| Races were won by Speed alone, then far too easily | `base + k × Speed` let Speed swamp everything as numbers grew; barriers were sized from the child's yardstick, so the weakened opponents all detoured | speed ∝ Speed^0.3; barriers/traps sized from the opponents; check-races reports which builds win where |
| An import regenerated the whole race ladder | check-races imported a helper from gen-races, whose top level generates | shared code lives in side-effect-free modules (tools/race-pool.mjs) |
| Races were far too easy even after re-tuning the simulator | the yardstick counted only races that *had to* be won first, 0–2 at every rank-1 venue, so all 24 rank-1 races expected ≤ 76 stats (a few sessions) | the yardstick is training sessions at the race's usual place on the ladder (`LADDER`); check-races plays a hint-following child and reports sessions per race |
| Vulpix (added on admin.html) had no evolution goal | goals were a hand-written table covering only the default lines | goals.js falls back to species.json's real evolutions + `evolutionDefaults`; check-data checks every drawable species that evolves has one |
| One always-missed fact froze a child's learning (3 facts for 60 problems) | a miss came back every 2 problems forever, keeping accuracy under the bar for new facts | a fact missed again and again backs off (2, 4, 6, 8); test-math checks a stuck child still meets new facts |
| A house action silently did nothing (`this.done is not a function`) | a scene method named `done` was shadowed by the Scene base class's `done` flag | don't name scene members `done`, `result`, `seat`, `opaque`, `music`: the base class and the stack use them |
| A Puppeteer click on admin.html did nothing | the sticky header was on top of the button | scroll the element to the centre before clicking (`click()` in `tools/playtests/admin.js`) |
