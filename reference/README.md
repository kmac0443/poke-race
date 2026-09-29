# Reference code from Pokémon Solara Adventure

Read-only copies of code from the sister project (`../pokemon-adventure`), kept here so this game never needs to
open that project. **Nothing here is imported by the game.** Copy what you need into `src/` and adapt it:

- asset paths there start `dist/assests/…`; ours are `assets/…`, laid out as in `assets/ASSETS.md`
  (`overworld/tilesets/` → `tilesets/`, `overworld/pokemon-followers/` → `pokemon/run/`,
  `overworld/characters/` → `characters/`, `battle/animations/` → `effects/anims/`);
- that game has **three** players in a 2×2 grid; this one has **two**, side by side;
- imports point at modules we don't have (`../game/data.js`, `../maps/…`). Rewire them to ours
  (e.g. `SPECIES` → `assets/data/species.json`).

| File | What it's good for here |
|---|---|
| `main.js` | The split-screen shell: canvas setup, integer scaling (`fit`), per-player views (`VIEWS`, `VIEW_POS`), the fixed 60 Hz loop (`loop`/`step`/`render`), font + data loading, title screen, per-player setup. Start the shell from this. |
| `index.html` | The page: canvas, `@font-face` for the Power fonts, pixelated scaling CSS. |
| `world/tileset.js` | Loading `data/tilesets.json`, terrain tags, **autotile drawing** (`autotileQuarters`, `drawAutotile`): water, flowers, sand edges. |
| `world/map.js` | `GameMap`: 3 tile layers, RMXP passability (`tilePassable`, `canMove`), drawing layers below/above characters with a camera. **The farm and the trophy room** are maps like this. |
| `world/character.js` | Tile-to-tile walking with a 4×4 sheet (16 frames a tile walking, 8 running), facing, drawing. Players and Pokémon on the farm. |
| `world/builder.js` | ASCII layout → tile layers. Nine-slice ground patches (`pathTile`, `PATH9`: town path 425, dirt 481, sand 537, gravel 593, snow 649), forests drawn as one mass (`drawForest`), cliffs (`drawRock`), building `STAMPS`, and Gym floors. Use it to author the farm, and for the track's ground strips. |
| `mapgen.py` | How that game authored outdoor maps (the `M` class: `carve`, `fill`, `wall`, `block`, `put`). Trees and cliffs come in **2×3 units** (even x/width, height a multiple of 3), or they draw half-trees. |
| `scenes/evolution.js` | The evolution cutscene (flashing between the two sprites, music, cry). Nearly drop-in. |
| `battle/anims.js` | Recipes for playing `effects/anims/*` cel sheets (timed steps: cels on a target/user/path, sounds, shakes, flashes). Good for barrier smashes and Defense attacks. Browse the sheets with `python tools/anim-sheets.py shots/anims`. |
| `game/updateMusic.js` | One speaker, several players: the song goes where most of the recently active players are, a tie keeps the current song, and a new song stays at least 8 s. (Following whoever moved last made it flip constantly.) |
| `playtests/walk.js`, `setup.js` | Headless playtest helpers for `tools/shot.js`: BFS pathfinding with the map's own rules, then real key presses (`follow`). `setup.js` gets through a title screen. |
| `ADVENTURE-CLAUDE.md` | That project's developer briefing. The **"Mistakes already made"** table and the map-authoring rules are worth reading before building the farm. |
| `ADVENTURE-ASSETS.md` | The full Essentials asset guide: tile id numbering, passage bit flags, priorities, terrain tags, **the 48-shape autotile table**, stat formula. |
