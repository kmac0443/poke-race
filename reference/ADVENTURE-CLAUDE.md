# Working on Pokémon Solara Adventure

A 3-player split-screen Pokémon game for one family. Vanilla ES modules + canvas, **no build step**.
`README.md` is the player-facing doc (controls, chapters, roadmap). This file is the developer/agent briefing:
how the thing is put together, the rules that must not be broken, and the mistakes already made so they
aren't made twice.

## Run it

```
node server.js            # or start.bat → http://localhost:8080
```

Windows machine. Git Bash and PowerShell are both available. `src/package.json` is `{"type":"module"}`
purely so `node --check src/**.js` works on the browser modules.

## The loop you must run after any map or event change

```
python tools/mapgen.py src/maps/layouts.js     # regenerate layouts (mapgen.py is the source of truth)
node tools/check-layouts.mjs                   # tile-unit rules, connectivity, two-way traversal
node tools/check-events.mjs                    # every event on a sensible tile, sight lines, warp targets
node tools/shot.js tools/playtests/walk-routes.js shots      # actually walks routes 1–4 both ways
node tools/shot.js tools/playtests/walk-chapter5.js shots    # mountain road + every lock in the quarry
node tools/shot.js tools/playtests/walk-chapter6.js shots    # Chapter 6 doors/edges, thin-ice lookout, Eevee evolutions
node tools/shot.js tools/playtests/walk-chapter7.js shots    # Chapter 7 sea edges, fishing, Fly, all 3 players working the fort lifts
node tools/shot.js tools/playtests/walk-chapter8.js shots    # Chapter 8: lava + boulders, the 3-owner mirrors, a live walk through the flame jets
node tools/shot.js tools/playtests/walk-chapter9.js shots    # Chapter 9: Route 10, Skyreach, the hideout plates, synchronised switches, Sable
node tools/shot.js tools/playtests/walk-chapter10.js shots   # Chapter 10: badge check, Victory Road, the League per player, the finale
node tools/check-gyms.mjs [--map]                            # solves every Gym (and slide) puzzle: there and back
node tools/check-anims.mjs                                   # every move's animation: sheets, frames, sounds
node tools/audit-maps.mjs                                    # house rules: heal on long maps, fish in water, Eevee, music clashes…
node tools/audit-dungeons.mjs [--map id]                     # every dungeon: size, trainers, items, and can you dodge every trainer?
node tools/shot.js tools/playtests/services.js shots         # Move Deleter / Move Reminder / Day Care
node tools/shot.js tools/playtests/townmap.js shots          # the Town Map, the secret ways in, Fly on the map
node tools/shot.js tools/playtests/walk-shortcuts.js shots   # the Harbor Strait's rapids (Waterfall) and the Cycling Road (bikes only)
node tools/shot.js tools/playtests/walk-tower.js shots       # Skyreach Tower: card keys, pads, six floors, the boardroom
node tools/shot.js tools/playtests/walk-secrets.js shots     # the Old Lighthouse, the Deep Grove, legendaries coming back
node tools/shot.js tools/playtests/walk-rocket-sites.js shots # the multi-floor Institute, warehouse, relay station, sea fort
node tools/shot.js tools/playtests/walk-ruins.js shots       # the Sealed Ruins' three doors, the Regis, the beasts
node tools/shot.js tools/playtests/walk-safari.js shots      # the Safari Zone (gate, Safari battle, steps) and the island ferry
node tools/shot.js tools/playtests/walk-mini.js shots        # the side-area stories: snowdrift, bottles, steam vents
node tools/shot.js tools/playtests/walk-aurora.js shots      # the Aurora Islands: ferry, currents, the wreck relay, the temple song
node tools/shot.js tools/playtests/walk-stormwatch.js shots  # heavy crates (one can't, two can), the storm, Tornadus/Thundurus
node tools/shot.js tools/playtests/walk-frostpeak.js shots   # a real walk through the mist floor's invisible maze, the bell, Ho-Oh
node tools/shot.js tools/playtests/walk-ember.js shots       # the turnstiles, solved with the game's own rules and walked both ways
node tools/shot.js tools/playtests/walk-depths.js shots      # Dive (and surfacing), the sliding stones (solved + pushed), Lugia
node tools/shot.js tools/playtests/give-pokemon.js shots     # giving a Pokémon (full party → box, refusals, trade evolutions)
node tools/shot.js tools/playtests/walk-gale.js shots        # Gale Ridge: the human windbreak (two cracks, three trainers), Yuki, Kyurem
node tools/shot.js tools/playtests/walk-roots.js shots       # the Trial of Roots: leaf piles, trapdoors to the Depths, the Heartwood
node tools/shot.js tools/playtests/walk-cache.js shots       # the Captain's Cache: chests for one, keys for another, the A → KEY hand-off
node tools/shot.js tools/playtests/bike.js shots             # the Bicycle (Skyreach Cycle Shop) and the "always run" option
node tools/shot.js tools/playtests/life.js shots             # every critter/trade/errand/says script runs; trades evolve; errands pay out
node tools/shot.js tools/playtests/anims.js shots            # plays move animations in a real battle, both ways (ANIMS="SURF …" to pick)
node tools/shot.js tools/playtests/learn.js shots            # the learn-a-move screen (level-up + TMs, forget/keep) and TMs listed by name
node tools/shot.js tools/playtests/hm-gates.js shots         # every field move needs its badge; Flash lights dark caves; both waterfalls
node tools/shot.js tools/playtests/music.js shots            # one song at a time while players walk on different maps; the marked exits
node tools/audit-dex.mjs                                     # how much of the Pokédex can be caught (it's all 650) + empty rooms
node tools/audit-hm.mjs                                      # where each field move is needed, map by map
node tools/shot.js tools/playtests/gyms.js shots             # replays those solutions with real key presses
```

All three checkers must print `layouts look clean` / `events look good` / `gyms look good`. They catch real bugs (half-drawn trees,
buildings on top of trees, pockets you can't reach, routes that only work downhill) — treat a failure as a
blocker, not a nit.

## Golden rules

1. **Never hand-edit `src/maps/layouts.js`.** It is generated. Edit `tools/mapgen.py` and regenerate.
2. **Never guess a tile ID.** Render the tileset and look: `python tools/sheet.py 1 1240 1272 out.png`
   (add `--strip` to see tiles in their sheet layout, which is how you read multi-tile objects like cliffs
   and buildings). The label shows `X`/`o` for impassable/walkable, `p<priority>`, `t<terrainTag>`.
3. **Walls come in 2×3 units.** Trees (`T`) and cliffs (`C`, `c`) are 2 tiles wide and 3 tall, so every run
   of them must start on an even column, be an even number wide, and be a multiple of 3 tall. `carve()`,
   `wall()` and `block()` in mapgen assert this; the linter re-checks the generated output.
4. **Routes are carved corridors, not fields with a border.** There must be no margin to skirt the grass and
   the trainers. Every map starts as solid wall and you carve the walkable area out of it.
5. **Every route must be walkable in both directions.** Ledges are one-way, so a ledge must never be the only
   link between two legs — always leave a walking lane beside it. The linter checks this, and
   `walk-routes.js` proves it by actually walking.
6. **Anything called from the game loop must be import-checked.** An exception inside `world.update()` kills
   the whole 60 Hz loop and the game silently freezes. Run a headless smoke test after adding any callback
   (`onDone`, `onStep`, plate handlers…).
7. **Verify species and item IDs exist** before using them: `data/pokemon.json` (Gen 1–5's 649 species, plus Sylveon #700) and
   `dist/assests/data/items.json`. A typo is a runtime crash in a battle. For TMs/HMs check the item's `move`
   field — the numbering is **not** the GBA one (HM05 is Waterfall, HM06 is Dive; Rock Smash is TM98, Flash TM70).
8. **Gym puzzles are per player; world puzzles are shared or they reset.** A Gym's puzzle state lives on the
   player (`p.solo`) so two kids in one Gym never undo each other. Anything in the overworld is either a team
   puzzle all three solve together (plates, gates → permanent story flags) or it resets when the map is empty
   (cut trees, smashed rocks, pushed boulders — `World.resetMap`). Never add a third kind.

## Map authoring

`tools/mapgen.py` draws every outdoor map and our own caves, then writes `src/maps/layouts.js`.

```python
m = M(30, 72, 'C')          # width, height, wall char ('T' forest, 'C' grey cliff, 'c' brown cliff)
m.carve(12, 69, 4, 3, ':')  # cut walkable ground (x/w even, y/h multiples of 3)
m.fill(4, 51, 6, 9, ',')    # paint terrain *inside already carved* ground, any shape
m.wall(20, 54, 10, 18, 'T') # repaint uncarved wall as a different wall (a pine belt in a cliff face)
m.block(14, 42, 4, 3, 'c')  # drop a lump of wall back into carved ground (an outcrop for a cave mouth)
m.put(17, 68, 's')          # a single tile (signpost, rock…)
```

Legend (full version at the top of `src/world/builder.js`):
`.` grass, `,` wild grass, `;` tall grass, `T` forest, `P` pine, `=` town path, `:` dirt path, `S` sand,
`G` gravel, `~` water, `B` deck/bridge, `_` ledge, `f` flowers, `#` fence, `r` rock, `R` rubble,
`C`/`c` cliff walls, `s` signpost, `x` invisible wall, `W` snow, `y`/`Y` wild/tall grass poking through snow,
`O` rocks in the sea (solid), `H` stone stairs (ramps between terraces).
A map def with `snow: true` is snow all over (no `W` needed); `battleBack: 'snow'` gives it snowy battles.

**Our own caves** (`caveAscii: true, tileset: 6`): `T` rock wall (2x3 units), `.` floor, `,` rubble, `r` rocks,
`L` steps, `~` water. With `ice: true` the same layout is drawn from the frozen half of the sheet (exactly 792
tiles on), plus `i` slippery ice, `k`/`K` a thin-ice field (only `K` holds — see `thinIce` below) and `I` the
Ice Rock (give the map `locationFlags: ['IceRock']` — that's what turns Eevee into Glaceon; `MossRock` is Leafeon).
With `volcano: true` it's the red rock set (+208) over a tan floor, plus `l` **lava** (the Lava autotile we made from
the sea animation, in the Caves tileset's spare slot 4 — ids 192+, marked walkable in the tile data and blocked by
the builder) and `q`/`Q` **flame jets**. A Strength boulder shoved into lava sinks and leaves a walkable rock
(`World.sinkBoulders`); like every field-move puzzle it resets when the map empties.
A cave can be a Gym too (Emberpeak's is): give it `leaderCheck: true` and `@return` warps, and `check-gyms` solves it.
Outdoor maps can set `ash: true` (hazy tint + falling ash, drawn in `OverworldScene.drawAsh`).

- `=`, `:`, `S`, `G` are **nine-slice** ground patches drawn by `pathTile()`. A set's `base` is the tile after
  the row start (row `424` → base `425`), with rows 8 apart. That is how sand (537) and gravel (593) were found.
- **Give each area its own palette.** Forest+grass for Routes 1–4, grey cliff+gravel for the mountain,
  brown cliff+sand for the desert, gravel streets for Stonewatch. Ground under a cliff is painted rock
  automatically so walls never sit in a field of grass.
- **Buildings** are `STAMPS` in `builder.js`, listed per map in mapgen with `('gym', x, y, 'interior_id')`.
  `check_stamps()` refuses to put one on trees, cliffs, water or another building.
- **Cave mouths** (`cave_mouth`, `cave_mouth_grey`) are 1×1 and go in the **bottom row** of a cliff block
  (`block(x, y, w, 6, 'C')`, mouth at `y + 5`). The player walks up into it from the tile beneath.
- **Walls are drawn as one mass**, the way the Essentials maps do it: forests in overlapping 2-wide pairs with
  crowns on top and trunks along the bottom (`drawForest`), rock as a nine-slice with spires and boulders
  filling the deep middle (`drawRock`), cave walls as a nine-slice too. Don't place wall tiles by hand.

### The sea, and the edge of the world

- **No invisible walls.** Anywhere you can walk or Surf up to the edge of an outdoor map must lead to another
  map; everywhere else the edge must be something you can *see* is solid (trees, rock, sea rocks).
  `check-events` fails on any reachable edge tile that leads nowhere.
- Sea maps start from `sea(w, h)`; islands are `blob(m, cx, cy, rx, ry, 'S')` (then `blob(..., '.', only='S')`
  for grass inside the sand). `rim(m, up=[(2, 38)], ...)` rings the map with sea rocks, leaving the listed
  gaps open for the edges that lead on. Line up the gaps with the neighbour's gaps via the `edges` offset.
- **Sea rocks (`O`) come in 2×2 blocks** — the Water rock autotile draws one rock where four cells meet, so a
  single `O` or a 1-deep line renders as plain water. Use `rocks(m, [(x, y)…])` (top-left corners) and
  `reef(m, y, x0, x1)`; `rim()` already does.
- Water routes need **swimmers**: `swimmer(x, y, 'SWIMMER_F' | 'SWIMMER_M' | 'TUBER_F' | 'TUBER_M', …)` stands
  in the water (drawn waist-deep with a ripple), spots you across open water and battles on the water backdrop.
  Put sailors on a tiny sandbar, not a deck patch (a lone `B` square looks like cardboard).

### Warps, doors and gates

- A stamp with `to:` becomes a door. Its cell is found in the **bottom row** of the stamp unless the stamp
  declares `door: [dx, dy]`. If a building's door is higher up, the stamp's height is wrong — check it with
  the sheet tool rather than adding a `door:` hack.
- A door with no `tx/ty` lands the player one tile above the target map's `@return` mat. That is right for a
  building and **wrong for a tunnel with two ends** — give those stamps explicit `tx`, `ty` and `dir`
  (see `route5`/`route6` in `src/maps/index.js`).
- Interiors reuse Essentials maps (`ess: 53`). Their exit comes from an event named Exit/Door that warps —
  **some maps have none** (ess 37 didn't), in which case add `warps: [{ x, y, to: '@return', sfx: 'Door exit' }]`
  or you build a room with no way out. Check with:
  `python -c "import json;d=json.load(open('data/maps/ess_037.json'));print([(e['name'],e['x'],e['y'],bool(e['pages'][0].get('warp'))) for e in d['events']])"`
- Edge connections (`edges: { up: [{ to: 'route5', offset: 0 }] }`) need the two gates to **overlap in x**
  (or you must work out the offset). Easiest is to make both gates the same 4-wide span in mapgen.
- `gates: [{ flag, cells }]` blocks cells until a world flag is set — this is how a story lock (a grunt
  guarding a road) actually stops anyone, rather than an NPC standing in a doorway people walk around.

### Placement tools

```
node tools/spots.mjs route5 [--pick 6]                    # open spots for new people/Pokémon (they can't block a path)
node tools/audit-life.mjs                                 # people, critters, trainers, items per outdoor map — find the quiet ones
node tools/enc-summary.mjs                                # every species you can meet on each map (for trades and errands)
node tools/show-layout.mjs route5                         # ASCII + coordinate ruler (for placing events)
node tools/passmap.js 53                                  # walkable map of an Essentials interior
node tools/export-map.mjs route5_preview out.json && python tools/render-map.py out.json out.png 0.5
python tools/sheet.py 6 504 560 caves.png [--strip]       # find tile IDs
```

Every layout in `layouts.js` is previewable as `<lowercase_key>_preview` via `src/maps/preview.js`
(add new caves to its `CAVES` list so they render with the cave tileset).

## Engine notes

- **Per-player scene stacks.** Each player has their own stack (overworld at the bottom, battles/menus pushed
  on top); `scene.push()` returns a promise. Three players run independently in one 60 Hz loop.
- **Co-op primitives** (`src/game/coop.js`): `needEveryone` (gather check), `teamEvent` (locks all three into
  a cutscene), `battleEach` (three trainers at once), `raid` (one boss, shared HP), `sayAll`, `everyone`.
- **Puzzle primitives** (`src/world/world.js`):
  - `plateSets: [{ plates: [[x,y]…], flag, boulders, onDone }]` — all plates held at the same moment sets the
    flag permanently. With `boulders: true` a Strength boulder parked on a plate counts as holding it.
  - `holdGates: [{ plate, cells }]` — open only while someone stands on the plate (relay puzzles).
  - `gates: [{ flag, cells }]` — opens for good when the flag is set.
  - `platforms: [{ id, start: [x, y], w, h, consoles: [[x, y]…] }]` + `%` chasm tiles in a Gym-builder map — lifts.
    Stepping onto a console makes you the operator: your arrows move the lift (`World.movePlatform`) and
    everyone standing on it rides along; B steps away. Give every lift a console on each shore so nobody can
    be stranded. Lifts roll back to `start` when the map empties.
  - `mirrors: { source: [x, y, dir], target: [x, y], flag, onDone, list: [{ x, y, owner, state }] }` + a
    `mirror(x, y, owner)` event at each one — a beam (`World.traceBeam`) runs from the source, turning at mirrors
    ('/' or '\\'); it crosses lava but not rock. Only the owner (player index) can turn their mirror (anyone can in
    dev mode). Lighting the target sets the flag for good. `check-events` insists it starts unsolved and that
    exactly one setting of the mirrors works.
  - `thinIce: { back, lookouts, view, solidFlag }` — an ice cave's `k`/`K` field. Stepping on `k` drops you back
    at `back`; only a player *standing on a lookout* sees the `K` path (and their camera swings to `view`), so
    one player has to talk the others across. Solid once `solidFlag` is set.
  - `sync: { switches: [[x, y]…], flag, beat: 90, window: 30, onDone }` — synchronised switches (Rocket Hideout B2F).
    A lamp over each switch lights for the first `window` frames of every `beat`; standing on a switch and pressing
    A while it's lit hits that beat (`World.pressSync`). All switches hit on the SAME beat sets the flag for good.
  - `gale: { flag, back, gusts: [{ cells, safe }] }` — the human windbreak (Gale Ridge). Each gust blows along its
    `cells` (upwind → downwind); the first `safe` cells are the crack and the spot in front of it, where you can brace.
    Stop anywhere further along with nobody upwind of you in the gust and you're blown back to `back`
    (`World.gustExposed`); the flag (a winch) stops the gusts for good. Give each crack a nook you reach from the
    sheltered path, or nobody can get into it.
  - `trapdoors: { to, holes, piles }` — leaf piles in a cave; the `holes` drop you to `to` at the same x,y (per player,
    and each player sees the holes *they've* fallen through). `check-events` insists every hole lands on floor.
  - `chests: [{ x, y, owner, open }]` — drawn sea chests (put an `r` under each so they're solid, and a sign for the
    talk). The Captain's Cache keys live in `p.flags.crewKeys` and move between players with face a friend → A → KEY.
  - `slideCheck: [[fromX, fromY], [toX, toY]]` on a map with slippery ice makes `check-gyms.mjs` prove it can be
    crossed both ways.
  - Obstacles cleared with a field move clear for everyone on the map (`World.clearObstacle`), and come back
    once the last player leaves it (`World.resetMap`: trees regrow, rocks return, boulders roll home). Not saved.
- **Field moves need no teaching**: owning the HM/TM + the badge + any party Pokémon that *could* learn it is
  enough (`src/game/hm.js`). Don't add HM-slave requirements. Fly shows up in the party menu for any Pokémon
  that could learn it (HM02 + the Mirage Badge).
- **Each field move has its own badge**, in the order you get them, so badges genuinely open the map: Cut — Pebble (1),
  Rock Smash and Surf — Tide (2), Strength — Spark (3), Flash — Granite (4, TM70 from Mason), Fly — Mirage (6),
  Waterfall — Volcano (7, HM05 from Blaze), Dive — none (post-game). Before gating a *main* path with a field move,
  check the badge comes before it (`node tools/audit-hm.mjs`). Flash is automatic: walk into a `dark: true` map with
  TM70 + the badge and it lights up (`Game.transfer`). Dark places: Victory Road, Tidepool Cave, Basalt Cave, the Root Depths.
- **Waterfalls**: `waterfalls: [{ cells, to, tx, ty }]` on the map below — cells on the cliff face, drawn as falling
  water; Surf up into them with Waterfall (`OverworldScene.climbWaterfall`). The map above has `waterfalls: [{ cells,
  crest: true }]` plus ordinary warps on those water cells to ride back down. Route 3 → Rainbow Falls; Route 10 → the
  Gorge Headwaters.
- **Learning moves**: `learnMoveFlow(p, pk, move, say, { tm })` — with a free slot a level-up move is simply learned;
  otherwise (and always for a TM) `scenes/learnmove.js` shows the known moves beside the new one: type, category,
  power, accuracy, PP, and what changes if you swap. The Bag lists TMs/HMs by their move's name (sorted), with the
  type and the TM number.
- **Fishing**: `encounters.fish = { old, good, super }` (lists like any other table). A rod from the Bag casts
  at the water you're facing (`Game.fish`); a better rod falls back to the list below it. Give every map with
  water a fish table.
- **The League is per player**: `p.flags['league:<room>']` records each member you've beaten; the hall's door
  (`leagueDoor`) sends you to your next unbeaten room, each room's back door only opens once *you* have beaten its
  member, and entering the Hall of Fame sets `p.flags.champion`. When everyone is, `world.flags.allChampions` +
  the credits (`CREDITS`, `Credits.mid` via `requestBgm('credits', …)`). Badge checks are tile events per player
  (`badgeCheck`), never world gates. Essentials maps can be adjusted after building with `patch: m => …`.
- **Legendaries**: `legendary(x, y, species, level, { when, intro, gone, back })` (maps/helpers.js). Per player: caught
  (`caught:<id>`) or got away (`legendGone:<id>`) hides it for that player only — `World.npcsOn/npcAt(map, …, player)`
  take the player for this. Resting (`ScriptContext.heal`, whiteout) calls `restLegends` (game/legends.js) and
  brings it back.
- **Safari Zone**: `safari: true` on a map makes its wild battles Safari battles (`BattleScene.safariTurn`: BALL/BAIT/
  ROCK/RUN, no Exp.); `p.flags.safari = { balls, steps }` is the pass, counted down in `onStepDone`.
- A `gates` entry can take `style: 'snow' | 'rubble'` to draw a snowdrift or a rockfall instead of a shutter — use
  those for story locks outdoors.
- **Regions**: `REGIONS` in `src/scenes/townmap.js`, each with its own Town Map (`REGION_ART`). The Aurora Archipelago
  is a second region reached by ferry; you see (and Fly within) the region you're standing in.
- **More field puzzle pieces** (all shared by everyone on the map, and reset by `World.resetMap` when it empties):
  `heavyCrate(x, y, group)` (spread into events; two tiles wide, up/down only, two players push together);
  `h` in a Gym-builder layout = an invisible wall (`World.revealWalls`); `turnstiles: [{ at, arms }]`
  (`World.turnstileMove`); `slideStone(x, y)` (slides until it hits something) with `plateSets: [{ stonesOnly }]`.
  `quiet()` in playtests hides every obstacle, crates and stones included — un-hide them (`delete ev.showIf`).
- **Dive**: `dive: [{ area: [x, y, w, h], to, tx, ty }]` on a sea map (drawn as dark water; A while surfing there,
  with HM06); `underwater: true` on the map below (blue look, the diving sprite, A with nothing in front →
  surface where you dived, else `surfaceTo`). Weather: `rain: 'flag'` (rains until the flag is set).
- **Timed hatches** (the wreck): a `holdGates` entry with `lever: [x, y]` (a wall cell you face and press A at)
  instead of `plate` opens for `secs`; `backLevers` open it from its far side; `flag` keeps it open for good;
  `sets: flag` makes a lever that sets that flag. **Island song**: `simon: { plates: [[x, y, 'SUN']…], order,
  flag, after }` (`World.updateSimon`). Gates can be `style: 'current'` (white water) on the sea.
- `offMap: true` was for the first Town Map (the Safari Zone, the mythical islands); the illustrated one shows them.
- **Every way out must be visible.** A warp we add to an Essentials map lands on whatever tile is there; if that's
  bare floor, draw one (`patch: m => m.set(2, x, y, 548)` — the cave ladder) or give the warp `arrow: 'down'` (a red
  exit arrow, hidden while a gate covers it; `OverworldScene.drawExitArrow`).
- **Walking into a warp ignores tile data (doors in walls), but never a shut gate or hold-gate** — so a staircase
  can sit behind a `gates` lock (the warehouse office, the Institute hatch).
- **Colour card-key doors** (Skyreach Tower): `gates: [{ flag, cells, color }]` are drawn in their colour; the panel is
  a sign on the door cell with `talk: keyDoor(color, flag)`, and `p.flags.towerKey` is each player's colour.
- **Multi-floor buildings** are Gym-builder maps (`fort: true` so check-gyms skips them) with `=` stairs and warps.
  Floors live in maps/gyms.js (TOWER_*, LIGHT_*, HIDEOUT_*); give each a playtest (walk-tower.js, walk-secrets.js).
- **The Town Map** (`src/scenes/townmap.js`) is an illustrated map like the games': a picture of the region
  (`dist/assests/ui/townmap/<region>.png`, 512×288 — drawn to `docs/TOWNMAP_ART.md`; until it exists, a painted stand-in
  from `src/scenes/regionart.js`), with markers on top: squares for places you can Fly to, small ones for caves and
  landmarks, a pin per player. **A new place needs an entry in `REGION_ART`** (`src/scenes/regionart.js`): a `marker`
  if it's a town / side area / cave, and a `where` box (in 128×72 map units) for every map, so a player's pin moves
  across it as they walk. `secret: true` places (and `hidden: true` markers) stay off the map until `visited:<id>`
  (set on entering any map); Fly only goes to visited places with a `flyTo`. `tools/playtests/townmap.js` asserts
  every outdoor map and Fly spot is placed. The first Town Map (drawn tile by tile from the layouts) is kept, unused,
  in `src/scenes/townmap-tiles.js`.
- **The ring of Solara**: the west spine (Maplebrook → Stonewatch), the snowy north (→ Frostfall), the coast down to
  the Coral Sea, the volcanic south (Emberpeak), Skyreach and the League in the south-east — and far out in the open
  ocean, Berth and Faraday Islands. Two late shortcuts close the ring: the **Harbor Strait** (Lighthouse Point ⇄ the
  Coral Sea; `rapids: [[x, y]…]` cells only let a Surfer through if a Pokémon can use Waterfall) and the **Cycling
  Road** (Frostfall ⇄ Skyreach; `bikesOnly` tiles at both gates).
- **Town services** (`maps/index.js`): `moveDeleter`, `moveReminder` (relearn any level-up move of the line) and
  `dayCare` (one Pokémon per player in `p.flags.daycare`; it earns ⌈level/2⌉ Exp. per step you take — counted in
  `OverworldScene.onStepDone`).
- **Life** (`src/maps/life.js`, the towns-and-routes pass): `critter(x, y, species, line, { still, swim, when: 'day'|'night' })`
  — a Pokémon out and about (cry + a line; `quiet()` in playtests hides the wandering ones); `says([cond, text]…, default)`
  — lines that follow the story (`badges(n)`, `flag(f)`, `pflag(f)`; list the latest first); `tradeNpc(x, y, sprite,
  { id, name, want, give, nick, heldItem })` — once per player, trade evolutions happen (give a Kadabra, a Graveler, a
  Haunter, or something holding a Metal Coat…); `errand(x, y, sprite, { id, name, ask, show | bring, reward })` — show me
  a Pokémon (`{ species }`, `{ type }` or a test), or bring me an item. Every town and route has some of each; keep it
  that way for new places. `check-events` checks their species, items and sprites.
- **Move animations** (`src/battle/anims.js`): every move has a recipe of timed steps — cel sheets from
  `battle/animations` (192×192 cels; see them with `python tools/anim-sheets.py shots/anims`), flying along a path,
  bursting on the target or glowing on the user, plus sounds, lunges, shakes, flashes, beams and Surf's wave. About 115
  moves have their own; the rest come from their type + category (contact / special / status). `BattleScene.moveAnim`
  plays one; the engine calls it once per move, after the accuracy check and before any damage.
- **Rest stops**: `restSpot(x, y, sprite, { intro, offer, done, rest })` in `src/maps/helpers.js` heals the
  party and sets `lastHeal` (respawn). Long routes and long dungeons get one — see the pacing rules below.
- **Saving/placement**: `Game.safeSpot()` rescues a player whose save puts them inside scenery, and `load()`
  falls back to `lastHeal`/`RESPAWN` if a map no longer exists. Keep that in mind when renaming maps.
- Badges are plain strings on `player.badges`; there is no obedience system, so badge text is flavour.
- **Moving**: walk 16 frames a tile, run 8, Bicycle 6 (`BIKE_FRAMES`). Start → OPTIONS → RUNNING: ALWAYS flips B
  (`p.flags.autoRun`: run by default, hold B to walk). The Bicycle (Skyreach Cycle Shop) rides from the Start menu or
  the Bag; you hop off going indoors, underwater or onto the water (`Game.toggleBike`).
- **Exp.**: Team Exp is always on (sitting-out Pokémon still learn a little). The family likes it simple — don't
  hand out Exp. Share as a reward.
- **Dev mode** (`?dev`, or `start-dev.bat`; `game.dev`): no encounters, trainers never battle, every field move
  works (`canUseHM(p, move, game)`), Start menu → DEV → WARP/HEAL (`src/scenes/dev.js`). Never saved.

### Gyms (`src/maps/gyms.js`, built by `buildGym()` in `builder.js`, tileset 14)

A Gym is an ASCII layout plus a theme (`rock`, `water`, `electric`, `ground`); the frame (roof, back wall,
side walls, the exit mat under `D`) is drawn automatically. Inside: `.` floor, `,` second floor, `o` rock or
machine, `s` statue, `~` pool, and the per-player puzzle tiles from `src/world/solo.js`:

- `i` **ice** — you slide until something stops you
- `< > ^ v` **conveyors** and `+` **stop pad** — carried along (arrows turn you) until a stop pad or a wall
- `*` **switch** and `A`/`B` **lasers** — each switch flips *that player's* phase; `A` cells are shut in
  phase 0, `B` in phase 1. Lasers are drawn per player in `OverworldScene.drawSolo`.
- `t` **thin ice** and `g` **ice gate** — each tile cracks once stood on (per player); stepping on a crack drops
  you back to the door. A gate row opens when every `t` between it and the next gate row below is cracked.
  Keep each thin-ice floor small (≤ ~20 tiles) or the checker's state space explodes.
- `1`–`9` **teleport pads** — each digit appears exactly twice; stepping on one puts you on its twin. No state.
- `q`/`Q` **flame jets** (volcano caves) — a shared 6-tick clock (a tick is one step, 16 frames): `q` burns on ticks
  0–1, `Q` on 3–4, each sparks the tick before. Standing in a burning jet sends you to `jetStart`. `check-gyms`
  solves them with the clock in the state (and 'wait' as a move); `gyms.js` skips timed Gyms and
  `walk-chapter8.js` walks the Fire Gym live, stepping into a jet row only when it'll stay quiet.
- `=` in a Gym-builder map is a staircase (grey steps, 459 over 467); put the warp on it in the map def.
- Themes: `rock`, `water`, `ice`, `electric`, `psychic`, `ground`, `dragon`, and `fort` (a Rocket base built with the same
  frame; give it `fort: true` so `check-gyms` doesn't look for a leader).

Mark the leader NPC `{ leader: true }`, keep trainers off puzzle tiles, then run `node tools/check-gyms.mjs --map`:
it solves the Gym with the same `canStep`/`carry` functions the game uses, prints the shortest solution and every
tile you can come to rest on, and fails if the leader, the way back out, or any trainer can't be reached.
Grey/metal tiles in the Gyms sheet (916–950) are **walls** even though they look like floor — check `passages`.

## Content conventions

- **Level curve** so far: R1 2–5, R2 4–9, R3 9–13, R4 16–22, R5 22–28, Mt. Solara 26–29, R6 27–33,
  R7 32–37, Glacier Cave 34–38, R8 + the sea 38–42, the sea fort 40–44, R9 44–48, Mount Ember 45–50,
  R10 49–52, the hideout 50–53 (Sable's Mewtwo 57), **R11 52–55, Victory Road 52–56, Elite Four 55–60, Champion 62,
  post-game Mewtwo 70**; gym leader aces Lv. 11 → 16 → 24 → 33 → 38 → 43 → 48 → 53. Legendaries so far: Articuno (seen, flew off), Moltres
  (one per player, with a Master Ball from Blaze). The Aurora Archipelago runs Lv. 55–70 (Lugia 70). Frostmere Hollow (a side area
  off Route 3) is Lv. 11–16. Keep climbing past the originals.
- **Side areas** — places with no Gym and no story lock — are something the originals skimp on and this family
  likes. Frostmere Hollow is the first; add more along the way (a secret beach, a berry forest…).
- **Eevee**: every evolution must stay possible before Chapter 4 (stones from the Eevee House's Stone Collector,
  Route 2 moss, the Frostmere Ice Rock, friendship + Soothe Bell, and Sylveon: friendship + a Fairy move — the
  Eevee House's Fairy fan teaches Baby-Doll Eyes).
- **Towns and routes need life**: Pokémon out and about (one at night somewhere), people whose lines change with your
  progress, and at least one favour or trade per town. Run `node tools/audit-life.mjs` and give the quiet ones some.
- **Species after Gen 5** can join if they have battle sprites: add them to `EXTRA` in `tools/build-data.js`
  (front/back 96×96, Gen-5 style — Showdown's `sprites/gen5` fan sprites match) and rerun it. The Pokédex skips
  the missing numbers in between.
- **Wild tables** use exciting Gen 1–5 species, no legendaries outside story content, with a `night:` list.
  Every one of the 650 species can be caught, traded for, received or evolved into (`node tools/audit-dex.mjs`
  must say 650 / 650). The rarer lines are in `MORE_WILD` (just after `ENC`); legendaries not in the story have
  homes too, mostly after you're Champion (`champOnly`) — the lake trio, the swords, the weather trio, the
  creation trio + Arceus, the Tao dragons, and the mythicals.
  Eevee appears on most routes on purpose (a child in this family loves Eevee).
- **Music**: one track per town and route from `dist/assests/audio/bgm` — reusing a neighbour's track makes two
  places feel like the same place. Three kinds of place share one theme on purpose, applied at the end of
  `maps/index.js`: `THEMES.gym` (every Gym), `THEMES.rocket` (`ROCKET_PLACES`, "Team Rocket.wav") and
  `THEMES.secret` (`SECRET_PLACES`, "Secret Place.wav"). A new Rocket base or hidden place goes in that list rather
  than getting its own tune. One speaker plays ONE song (`Game.updateMusic`): where most of the players who moved in the
  last 30 s are (`p.activeAt`); a tie keeps the current song, and a new song stays at least 8 s — following whoever
  stepped last made it flip every few steps, which sounded like two songs mixed together. **Every Essentials track is now used.** New areas get new tunes from
  `tools/chiptune.py` (a small GBA-style synth: two pulse voices, a stepped-triangle bass, noise drums): write the
  song as data in `tools/chiptune_songs.py` (chords + a hand-written melody that adds up to the same number of
  beats) and run `python tools/chiptune.py "Song Name"` → `audio/bgm/Song Name.wav` (loops seamlessly).
- **Encounters** have a short cooldown: after a wild battle (or arriving on a map) you get 3–4 free steps
  (`p.encCooldown`, counted down in `OverworldScene`) before the normal rate applies. The user asked for at least
  3–4, and asked that it not be much more — people hunt for Pokémon.
- **Dungeons must not be skippable.** Every cave, base and tower floor should have at least one trainer you
  can't walk around: stand them where a corridor or doorway opens out, looking *across* the mouth
  (`audit-dungeons.mjs` says `dodge no`). The audit can't follow Surf, pads, lifts or crates, so for those, check
  the `--map` grid by eye.
- **Pacing rules the user asked for:** routes should vary a lot in length; anything long needs a heal station
  half way; every town and route should look and feel distinct; routes need several navigation elements
  (ledges, Surf, Rock Smash, boulders, forks), not one; puzzles must escalate and never repeat, and Team
  Rocket dungeons should carry several puzzles each plus their own heal point.
- **Puzzle types used so far** (pick a *new* one next time): gather-everyone → three plates at once →
  split-up plates in separate chambers → shutter relay (hold a switch for the next player) → boulder weight
  plates → one keycard terminal per trainer → a door code split across three notes.
  → a thin-ice path only the player on a lookout can see (asymmetric vision) → lifts one player steers while
  the others ride (operator + riders) → a light beam through three mirrors, each owned by one trainer →
  synchronised switches pressed on the same beat → personal card keys (each colour door opens only for its holder)
  → a relay race against the clock (a lever opens a far-off hatch for 4 seconds; a friend dashes through) →
  a song split across the three screens (listening stones give each player 2 of the 6 notes; glyph plates) →
  heavy crates two players push together → invisible walls found for everyone (mist floor) → rotating
  turnstiles over lava → sliding stones into sockets that only stones can hold → a human windbreak (stand in the
  crack so the others can pass; Gale Ridge) → keys only a friend can turn (hand them on; the Captain's Cache).
  Gyms (per player): boulder maze → slippery floor → laser switches → conveyor belts → thin ice → teleport pads →
  flame jets on a clock → everything at once (belts over switches that flip lasers, pads between halves);
  Trials (per player): trapdoors under leaf piles down to a lower floor (the Trial of Roots).
  Unused ideas for both are listed at the bottom of `ROADMAP.md`.

## Headless playtesting

`node tools/shot.js <script.js> <outDir>` drives the real game in Chrome with real key presses.
Scripts get `t.press/hold/keys/wait/shot/eval/top/mashUntil`; `tools/playtests/setup.js` gets through the
title and naming, `give.js` hands out a starter and items.

Three things will silently ruin a scripted walk:

1. **Wild encounters** and 2. **trainers spotting you** — easiest: `window.game.dev = true` (dev mode turns both
   off). Or the old way: set every table's `rate = 0` (`rate: 0` genuinely means zero) and pre-beat trainers with
   `p.flags['trainer:'+mapId+':'+(ev.id||ev.x+','+ev.y)] = true`.
3. **Messages.** A team message blocks walking; press A (`KeyQ`) until the top scene is `OverworldScene`.

Obstacles: cleared trees regrow when a map empties, so a walk that crosses maps should hide them instead
(`ev.showIf = () => false`, as `walk-routes.js` does). Ice and conveyors keep you moving after you let go of
the key — `playtests/gyms.js` holds a direction only until the player sets off, then waits for them to settle.

For traversal, prefer pathfinding over guessed key timings: BFS with the map's own `canMove`/`ledges`/`npcAt`,
then hold each direction until the run's last cell is reached (that's what `walk-routes.js` does — holding a
key "until the player stops moving" overshoots corners).

## Mistakes already made (don't repeat)

| What went wrong | Why | Now |
|---|---|---|
| Half-drawn trees everywhere | forest masses weren't multiples of 3 rows | 2×3 unit rule + linter |
| Players could skirt every route | maps were fields with a tree border | carve corridors out of solid wall |
| A ledge blocked the only path north | ledge spanned the whole corridor | leave a lane; two-way traversal check |
| A house sat on top of trees | stamps weren't validated | `check_stamps()` |
| Save left a player stuck in trees | no validation on placement | `Game.safeSpot()` ring search |
| A bridge you couldn't walk on | tile 1633 has priority 4 | use 1637 + Bridge terrain override in `tilePassable` |
| Rest house door unreachable | stamp was 6×5; the building is 6×4 | check stamp height with `tools/sheet.py` |
| Whole game froze at a puzzle | `se` wasn't imported in `maps/index.js` | smoke-test callbacks; exceptions kill the loop |
| Tunnel dropped you at the wrong end | stamp door had no `tx/ty` | explicit `tx/ty/dir` on two-ended warps |
| `STRUGGLE` crashed battles | missing from Essentials data | synthesized in `tools/build-data.js` |
| Scripted walks always ended in a battle | encounters/trainers not silenced | see the three rules above |
| Heredoc edits mangled quotes and regexes | shell escaping | use the Write/Edit tools for JS, Python for mechanical replaces |
| Rock Smash never worked for anyone | `HMS` looked for HM06, which is **Dive** here; the game hands out TM98 | check an item's `move` field, never assume GBA numbering |
| Pressing A at a boulder did nothing | `strengthHint` was called but never written (the error was swallowed by `runEvent`) | watch the console in playtests; `runEvent` catches, it doesn't fix |
| Surf needed teaching, unlike every other field move | `trySurf` checked `knows('SURF')` | every field move goes through `canUseHM` |
| Two towns shared one song | Sunspire reused Cedarwood's track, Route 4 reused Route 3's | one track per area — grep `music:` before picking |
| A Gym floor you couldn't walk on | grey "floor" tiles in the Gyms sheet are raised walls | check `passages` (0 = walkable), render, run `check-gyms` |
| You could walk into (and through) cliff faces | cliff tiles 1257/1177 are walkable in the tileset data, 1249/1169 only block one side | the builder marks every `C`/`c` cell blocked; `check-events` fails if any wall tile is walkable |
| The Ice Rock blocked the tile above it | its top half was a solid tile on layer 2 | tops of tall objects must be priority tiles with passage 0 (1350 here) |
| Steering a lift felt broken | a 3-second help message held the controls every time you stepped on a console | explain once per player (`flags.liftHelp`); never block a control the player just reached for |
| The lift drove off the operator's screen | the camera sat half way between operator and lift | the operator's camera centres on the lift |
| A playtest walked straight through the boulders it was meant to push | `quiet()` hides every field-move obstacle | un-hide the ones a test needs (`delete ev.showIf`) |
| A playtest's "refused" mirror turned anyway | dev mode lets anyone turn any mirror | switch `game.dev` off for ownership tests |
| Invisible walls at the edge of the sea (and Route 6/7) | carved ground and water ran off the map with nothing there | `rim()` sea rocks / a wall row; `check-events` edge audit |
| Sea rocks vanished in game | the Water rock autotile only draws rocks where 2×2 cells meet | `O` in 2×2 blocks (`rocks`, `reef`, `rim`) |
| You could Surf through sea rocks | the surf step only checked the terrain tag | surf moves also check `map.blocked` |
| Doubled-up cave mouths, lumpy cliffs, phantom tree trunks | walls were stamped in 2×3 lumps | walls drawn as one mass (`drawForest`/`drawRock`) |
| A Strength boulder could be shoved onto an item | `pushBoulder` only checked walls and NPCs | it also refuses any tile with an event on it |
| A patch script wiped half of `maps/index.js` | it cut from `"  lakeshore: {"` — which is also the key of the encounter table near the top — to the next map | anchor edits on `id: '<map>'`, and assert the span you replace is small |
| A route blocked by a field move you don't have yet | Route 4's only way north was a Strength boulder; HM04 comes from the relay station *after* Route 4 | check where each HM/TM is handed out before gating a main path with it (Route 4 uses Rock Smash — TM98 is given at its south gate) |
| No way back over Mount Ember's lava from the crater | every boulder was on the south bank, and the lava resets when the map empties | a crossing puzzle needs its materials on both sides |
| The whole game failed to load (`Cannot access 'npc' before initialization`) | game.js imported from maps/helpers.js, closing an import cycle (game → helpers → shop → menus → townmap → maps/index → helpers) | keep game/ and world/ imports away from maps/; tiny shared helpers go in their own import-free module (game/legends.js) |
| Stepping out of a cave left you standing on a sign (the Aurora Star) | the exit mat's landing tile had an event on it | `check-events` rejects any warp or door landing on a solid event, or a door with no free step out; `safeSpot` skips occupied tiles |
| A house with two front doors (the quarry office) | its Essentials map (ess 46) has two exit events | check an interior's exits with the `python -c` one-liner above before choosing an `ess:` |
| The Town Map put you in Stonewatch while you stood on Verdant Isle | `regionOf` used the last outdoor map of the *first* region it matched | the current map is looked up across every region first |
| Every trainer in a dungeon could be walked around | trainers faced into open rooms | `audit-dungeons.mjs`; a trainer looks across each mouth |
| A playtest read a position mid-fade | falling through ice fades before it moves you | "at rest" = not moving, not busy, not transferring, top scene isn't a `FadeScene` |

## Where things live

```
src/main.js            boot, 60 Hz loop, 2×2 split screen, title/setup, team panel
src/core/              assets, audio, input (3 keymaps + gamepads), ui
src/world/             tileset.js, map.js (RMXP passability), builder.js (ASCII + Essentials + caves),
                       world.js (NPCs, flags, plates/gates), script.js (event scripts), character.js
src/scenes/            overworld.js, menus.js, shop.js, battle screens live in src/battle/
src/battle/            engine.js (rules, UI-agnostic) + scene.js (per-player battle UI)
src/game/              game.js (transfers, battles, saving), pokemon, player, items, encounters, hm, coop, trade
src/maps/layouts.js    GENERATED ASCII layouts
src/maps/gyms.js       Gym floors (hand-written ASCII; checked by tools/check-gyms.mjs)
src/world/solo.js      per-player puzzle floors: ice, conveyors, laser switches
src/scenes/dev.js      dev mode's Start-menu page (warp, heal)
tools/walkmap.mjs      what the game thinks is walkable on one map, beside its ASCII (`node tools/walkmap.mjs route6`)
tools/playtests/walk.js  shared playtest helpers: path (overworld rules), follow (real key presses, any player), gates
src/maps/index.js      the region: every map def, NPCs, trainers, encounter tables, story scripts
src/maps/helpers.js    npc/walker/sign/item/trainer/nurse/clerk/pc/berryTree/cutTree/smashRock/boulder/restSpot
tools/                 mapgen.py, sheet.py, show-layout.mjs, export-map.mjs, render-map.py, passmap.js,
                       check-layouts.mjs, check-events.mjs, shot.js, playtests/, build-data.js, convert-*.py
data/                  generated pokemon.json, moves.json, maps/ess_*.json
dist/assests/          sprites, tilesets, audio, data/items.json + tilesets.json (see ASSETS.md, CREDITS.md)
```

## Region so far

Maplebrook → Route 1 → Cedarwood (Gym 1, Institute raid) → Route 2 → Lakeshore (Eevee House) → Route 3 →
Echo Cave (split-up puzzle) → Harbor (Gym 2, warehouse switches) → Route 4 → Sunspire (Gym 3, relay station) →
Route 5 (Trail House) → Mount Solara (plates + boulder weights) → Route 6 (desert) → Stonewatch (Gym 4,
Rocket Quarry: terminals / weights / code) → **Route 7 (woodcutter's cabin) → Frostfall (Gym 5, thin ice) →
Glacier Cave (slide hall, thin-ice lookout puzzle, hermit's fire, Rocket lab, Articuno)**.
→ **Route 8 (coastguard lookout) → Coral Sea (water route, Shell Island camper) → Coral Isle (Gym 6, teleport
pads) → the Sea Fort (lifts, Lapras)**.
→ **Cinder Strait (water route) → Route 9 (hot-spring inn) → Emberpeak (Gym 7, flame jets) → Mount Ember (lava + boulders, crater mirrors,
the admins, Moltres)**.
→ **Route 10 (lodge; the secret Overlook) → Skyreach City (Gym 8, Dept. Store, Game Corner) → the Rocket Hideout
(plates + a boulder, synchronised switches, Sable, Mewtwo)** → **Route 11 (badge check) → Victory Road (dark; boulder,
river, camp) → the Pokémon League (Elite Four + Champion per player, Hall of Fame, credits; post-game Mewtwo)**.
Side areas: **Frostmere Hollow + Grotto** off Route 3 (Ice Rock, lost Eevee, Grandma's heal; the Snow Festival opens the
**Frozen Falls + Snow Shrine**); **Sandbar Cove**
through the Coral Sea's eastern reef (buried treasure, Lapras; bottled map → **Pirate's Grotto**, fossils); **Berry Forest** (Cut tree at the back of Route 2's west dead end); **Lighthouse Point** (Surf through the gap in Harbor's
sea rocks; a Dratini each); **Tidepool Cave** on Shell Island (Deep Sea
Tooth/Scale, King's Rock); **Basalt Cave** on Basalt Isle in the Cinder Strait (Dragon Scale, Heat Rock); **Cinder Springs** off Route 9 (bathhouse, Magmarizer; the **Steam Vents** reopen the rockfall to the **Ember Terrace**).

Solara's story is complete, and so is **the Aurora Archipelago** (after the League, by ferry from Harbor): Aurora
Harbor → the Aurora Sea → Sunfall Isle (the wreck) → Verdant Isle (temple) → Stormwatch (weather station) →
Frostpeak (Bell Tower) → Ember Reef (turnstile cave, Dive) → Ruin Shoals / Sunken Ruins → the Whirlpool Trench
(Lugia). Island side stories: **Gale Ridge + the Rime Grotto** off Frostpeak (the windbreak, Yuki, the second Ice
Rock, Kyurem), **the Trial of Roots** on Verdant (trapdoors, the Heartwood, Virizion), **the Captain's Cache** on
Sunfall (Marina's grandad's treasure: keys for somebody else, a red Gyarados). Each island's story gives a chart piece (`chartSunfall` … `chartRuins`) that opens a `style: 'current'`
gate to the next. Next — **`ROADMAP.md`**. Keep the pacing rules above: a new puzzle type per chapter, a heal point on anything long, and a look of
its own for every new place.
