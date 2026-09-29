# Asset Guide

Everything here was copied from the sister project by `tools/import-assets.py`. That script holds the full list
and the reason for each entry, and you don't need the other project to use any of it. Sources and licence:
[CREDITS.md](CREDITS.md). Deeper Essentials details (tile id maths, passage bits, the autotile shape table) are in
`reference/ADVENTURE-ASSETS.md`.

Art style: GBA (FireRed / Emerald), **pre-scaled 2×**. Each player's half of the screen is **512 × 384**. Always
draw with nearest-neighbour (`ctx.imageSmoothingEnabled = false`, `image-rendering: pixelated`). PNG alpha, no colour
key. About 130 MB in all, mostly music (~100 MB).

## Species

Never build a sprite path by hand. **Use `data/species.json`**: 1,025 entries, one per line.

```json
{ "dex": 25, "id": "PIKACHU", "name": "Pikachu", "types": ["ELECTRIC"],
  "baseStats": { "hp": 35, "atk": 55, "def": 40, "spe": 90, "spa": 50, "spd": 50 },
  "growthRate": "Medium", "evolutions": [{ "into": "RAICHU", "method": "Item", "param": "THUNDERSTONE" }],
  "sprites": { "front": "pokemon/front/25.png", "icon": "pokemon/icons/PIKACHU.png",
               "run": "pokemon/run/PIKACHU.png", "cry": "audio/cries/PIKACHU.ogg" } }
```

- Paths are relative to `assets/`. `null` means the sprite doesn't exist.
- **653 species have everything** (#1–649, Fletchling/Fletchinder/Talonflame #661–663, Sylveon #700). Other later
  species have a run sheet, icon and cry but **no front sprite**. To add one, save Showdown's
  `sprites/gen5/<name>.png` as RGBA `tools/extra-sprites/front/<dex>.png` and rerun the import. Only species with
  both `front` and `run` can be picked or raced.
- Our stats map to base stats: **Speed ← `spe`, Strength ← `atk`, Defense ← `def`**.
- `evolutions[].method` is the real game's (Level, Item, Happiness…). We use our own criteria; the data only tells
  us what a species *becomes*. Alternate forms (`PIKACHU_2.png`…) exist for some run sheets and icons.

## Pokémon sprites

| Folder | Format | Use |
|---|---|---|
| `pokemon/run/<ID>.png` | 256×256, **4×4 grid of 64×64**. Rows: **0 down, 1 left, 2 right, 3 up**; 4 walk frames each. | Racing and Speed training (row 2, facing right); walking around the farm (all rows). It's a walk cycle: for a sprint, run the frames 2–3× faster, add a vertical bob and dust. |
| `pokemon/front/<dex>.png` | 96×96, one frame (keyed by **dex number**) | Cards, pick screen, results, trophy room, evolution |
| `pokemon/icons/<ID>.png` | 128×64: two 64×64 frames (bounce) | Menus, lists, map pins |
| `pokemon/shadow/` | small ellipses | Under Pokémon on the track |
| `pokemon/eggs/` | egg + 5-stage crack strip | Not in the plan for now |
| `audio/cries/<ID>.ogg` | | Correct answers, winning, greeting on the farm |

## Track, farm, trophy room

| Folder | Format | Use |
|---|---|---|
| `tilesets/*.png` | RPG Maker XP layout: 8 tiles wide, 32×32 tiles. Tile id `384 + i` → `sx = (i%8)*32, sy = floor(i/8)*32`; ids 48–383 are autotiles. | `Outside.png`: the track and the farm (grass, paths, trees, cliffs, water, fences, flowers). `Caves.png`: cave venues. `Interior general.png`, `Museum interior.png`: the **trophy room** (display cases). Also Poké Centre, Mart, Gyms, Department store, Bike shop, Game Corner, Mansion, Factory, Harbour, Boat, Ruins, Graveyard tower, Trainer Tower, Multiplayer rooms, Underwater, Dungeon cave/forest, Underground path. |
| `data/tilesets.json` | 23 tilesets: `image`, 7 `autotiles`, and per tile id `passages` (bit flags), `priorities` (≥ 1 draws **over** characters: tree tops, roofs), `terrainTags` | Walkability and draw order for the farm and trophy room. Paths already point at our layout. |
| `autotiles/*.png` | 96×128 (joins edges), 96·N wide (N animation frames), or 32·N×32 (single-tile animation) | Animated water, sand shores, flowers, fountains, lava, cave floors. Animate at about one frame every 0.25 s. |
| `data/terrain_tags.json` | what each terrain tag means | |
| `backgrounds/<biome>_bg.png` | 512×288, horizontally streaked | Parallax backdrops / speed lines. Biomes: `field`, `forest`, `rocky`, `snow`, `water`, `city` (each with `_eve` / `_night`), `cave1-3`, `underwater`, `indoor1-3`, `pwt` (tournament), `elite1-8` / `champion1-2` (dramatic finals), `distortion`. `_base0/1.png` are battle platforms. |
| `weather/*.png` | rain/storm/hail/sandstorm/blizzard frames (`_1…_4`) + `*_tile.png` | Course personality, Defense trap zones |

**Finding tile ids:** never guess one. `python tools/sheet.py 1 1240 1272 out.png` renders tiles 1240–1272 of tileset
1 (Outside) with each id, `X`/`o` (solid/walkable) and priority printed on it. Add `--strip` to see the raw sheet,
which is how you read multi-tile objects like buildings and cliffs. Useful ids from the adventure game's builder
(`reference/world/builder.js`): nine-slice ground patches start at 425 (town path), 481 (dirt), 537 (sand),
593 (gravel), 649 (snow), with rows 8 apart. Cliffs start at 1248 (grey) and 1168 (brown).

## Characters, obstacles, props (`characters/`)

All 4×4 sheets (4 directions × 4 frames, or 4 rows of an animation).

| File | Cell | Use |
|---|---|---|
| `Object boulder.png` | 32×32 | Strength pull, big barriers |
| `Object rock.png` | 32×32; rows play the **Rock Smash shatter** | Breakable barrier |
| `Object tree 1.png`, `Object tree 2.png` | 32×32; rows play the **Cut** animation | Breakable barrier |
| `Object ball.png` | 32×32 | Poké Ball prop |
| `berrytree_<BERRY>.png` (+ `berrytreeplanted/wet/dry/damp.png`) | 32×64, growth stages | The farm's berry garden |
| `trainer_POKEMONTRAINER_{Red,Leaf,Brendan,May}.png`, `boy_run.png`, `girl_run.png` | 32×48 | The kids walking on the farm |
| `NPC 01–29.png` | 32×48 | A farm keeper, a race announcer, the trophy-room curator |
| `Pokemon 01–12.png` | | Old-style Pokémon overworld props |
| `doors1–9.png` | | Opening doors (the trophy room) |
| `Healing balls *.png`, `base_surf/dive.png`, … | | Misc |

Trainer battle portraits (bigger, front-facing) are in `trainers/gen1`…`gen5/` and `trainers/essentials/`: the kids'
portraits on results screens.

## Effects

| Folder | Format | Use |
|---|---|---|
| `effects/anims/*.png` | **192×192 cels** in a grid (e.g. `Crunch.png` 768×960 = 4×5 cels) | Impacts, shields, fire, thunder. `python tools/anim-sheets.py shots/anims` renders numbered contact sheets; `reference/battle/anims.js` shows how they were played. |
| `effects/move/*.png` | small sprites | Poké Ball bursts (`ballBurst_*`), rings, sparkles |
| `effects/transitions/*.png` | screen-wipe masks | The race starting |
| `effects/*.png` | 32×32-ish | explosion, smoke, star, portal |

## UI (`ui/`, the whole Essentials UI)

| File | Use |
|---|---|
| `ui/Summary/ribbons.png` | 512×640 = **8 × 10 cells of 64×64**. Rows 0–4 are contest-style ribbons in several colours, each in **4 ranks** (plain → fancier). Rows 5–9 are specials (medals, hearts, crests). One colour per venue type, one rank per venue tier. |
| `ui/pictures/PWT/scoreboard.png` (512×384), `pwtMiniBoard_*` | Race scoreboard / versus board |
| `ui/windowskins/*.png` | 9-slice windows (`choice 1.png`) and speech boxes (`speech frlg.png`), used by `src/core/ui.js` |
| `ui/sel_arrow.png`, `ui/pause_arrow.png` | Menu cursor, "more text" arrow (`core/ui.js`) |
| `ui/Summary/`, `ui/Party/`, `ui/Pokedex/`, `ui/Storage/`, `ui/Trainer Card/`, `ui/Hall of Fame/`, `ui/Battle/`, … | Backgrounds, panels, bars, type icons and cursors to build the card, pick screen and trophy room from |
| `ui/titles/` | Title-screen art |
| `items/<ITEM>.png` | 48×48 item icons: berries (`ORANBERRY`…) and treats (`RARECANDY`, `LAVACOOKIE`, `BERRYJUICE`, `BERRYSWEET`…) for the farm |
| `fonts/*.ttf` | `power clear.ttf` (main), `power clear bold.ttf` (titles), `power green*.ttf`. Register them with `@font-face` (see `reference/index.html`). |

## Audio

| Folder | What |
|---|---|
| `audio/bgm/` | **Every** rendered track (46 `.ogg` + 25 original `.wav` chiptunes from the adventure game), so each venue, the farm and each training game can have its own song. Suggested: race `B2W2 212 PWT Final Round!` / `Battle Frontier`; won `B2W2 213 Winning in the PWT!`; ceremony `B2W2 214 PWT Victor!` / `Hall of Fame`; Speed training `Bicycle` / `Cycling Road.wav`; farm `Lappet Town` / `Natural Park`; `Evolution`, `Title`. |
| `audio/bgm/EBDX/` | Evolution, victory themes |
| `audio/jingles/` | Placings: `Bug catching 1st/2nd/3rd`. `Pkmn get` (new Pokémon), `Evolution start/success`, `Badge get` (ribbon), `Item get`, `Berry get`, `Slots win`, `BP Fanfare` |
| `audio/se/` | UI (`GUI sel cursor/decision/buzzer`), `Rock Smash`, `Cut`, `Strength push`, `Player bump`, `Player jump`, `Pkmn level up`, `Vs flash`, `Exclaim`, `Mining hammer`, `Voltorb Flip *` (right/wrong stings), `Water berry plant`; `se/move-anims/` holds per-move sounds |

New music: `python tools/chiptune.py "Song Name"` renders a GBA-style loop from `tools/chiptune_songs.py` into
`audio/bgm/`. Only `.ogg`/`.wav` were copied (browsers can't play `.mid`).
