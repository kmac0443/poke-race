# Asset Guide

How to use every asset in `dist/assests/` in the game. Art style: **GBA (FireRed / Emerald)**, pre-scaled **2×**.
Sources and licenses are in [CREDITS.md](CREDITS.md).

## Global conventions

| Thing | Value |
|---|---|
| Screen | **512 × 384** (everything is authored for this; = 256×192 at 2×) |
| Map tile | **32 × 32** (a 16px GBA tile at 2×) |
| Scaling | Nearest-neighbour only (`image-rendering: pixelated`, `ctx.imageSmoothingEnabled = false`) |
| Transparency | PNG alpha (no colour-key) |
| Species keys | Two schemes — see below |

### Species keys (important)

- `pokemon/front/`, `pokemon/back/` use **National Dex number**: `25.png`
- Everything else uses the **internal ID**: `PIKACHU.png`, `PIKACHU.ogg`
- Alternate forms add `_<form>`: `ROTOM_1.png`. Female variants add `_female`.
- `000.png` in a folder is the fallback / missing sprite.

Don't build paths by hand — **use `data/species.json`**, which has every path resolved:

```json
{ "dex": 25, "id": "PIKACHU", "name": "Pikachu", "types": ["ELECTRIC"],
  "sprites": { "front": "pokemon/front/25.png", "back": "pokemon/back/25.png",
               "icon": "pokemon/icons/PIKACHU.png", "follower": "overworld/pokemon-followers/PIKACHU.png",
               "followerShiny": "...", "footprint": "...", "cry": "audio/cries/PIKACHU.ogg" } }
```

All 7 sprite/sound entries exist for dex **#1–#649**. #650–#1025 have data, icons, followers and cries but **no front/back battle sprites** (value is `null`).

---

## Data (`data/`)

Generated from Pokémon Essentials v21 PBS files. All IDs are UPPERCASE strings that cross-reference each other.

| File | Count | Contents |
|---|---|---|
| `species.json` | 1025 | dex, id, name, types, baseStats (`hp atk def spe spa spd`), abilities, catchRate, baseExp, growthRate, genderRatio, category, height, weight, pokedex text, `levelMoves` `[[level, MOVE_ID]]`, `evolutions` `[{into, method, param}]`, sprite paths |
| `moves.json` | 832 | id, name, type, category (Physical/Special/Status), power, accuracy, pp, priority, target, effect (Essentials function code), effectChance, flags, description |
| `types.json` | 19 | id, name, `iconRow` (row in type-icon sheets), weaknesses, resistances, immunities |
| `abilities.json` | 310 | id, name, description |
| `items.json` | 752 | id, name, pocket (1–8) + pocketName, price, fieldUse, battleUse, move (for TMs), flags, description, `icon` path |
| `trainer_types.json` | 72 | id, name, gender, baseMoney, battleSprite, battleBackSprite, overworld sheet |
| `tilesets.json` | 23 | per-tile passability / priority / terrain tag (see Overworld) |
| `terrain_tags.json` | 18 | what each terrain tag number means |

**Type effectiveness:** for a defender of type T, attacker type A is 2× if `A in T.weaknesses`, 0.5× if in `T.resistances`, 0× if in `T.immunities`. Multiply across both defender types.

**Stat formula (Gen 3+):** `HP = floor((2*B + IV) * L / 100) + L + 10`, other stats `floor((2*B + IV) * L / 100) + 5` (ignoring EVs/nature — fine for a kids' game).

---

## Overworld (`overworld/`)

### Tilesets — `overworld/tilesets/*.png`

RPG Maker XP layout: **8 tiles wide (256px)**, any number of rows. Grey tiles with a red ✕ are unused placeholders.

| File | Use |
|---|---|
| `Outside.png` | Towns, routes, buildings, trees, grass, paths, fences, signs (the main one — 502 rows) |
| `Caves.png`, `Dungeon cave.png`, `Dungeon forest.png`, `Underground path.png` | Caves / forests |
| `Interior general.png` | Houses, labs, general indoor furniture |
| `Poke Centre interior.png`, `Mart interior.png`, `Gyms interior.png` | The obvious ones |
| `Department store`, `Bike shop`, `Game Corner`, `Museum`, `Mansion`, `Factory`, `Harbour`, `Boat`, `Ruins`, `Graveyard tower`, `Trainer Tower`, `Multiplayer rooms`, `Underwater` | Special locations |
| `hgss/` | ⚠️ HeartGold/SoulSilver buildings — **DS style, doesn't match GBA**. Kept for reference only. |

#### Tile IDs (for map data)

Use the RMXP numbering so `tilesets.json` lines up:

| Tile ID | Meaning |
|---|---|
| `0` | Empty |
| `48 … 383` | Autotiles: autotile slot `a = floor(id/48) - 1` (0–6), shape `id % 48` |
| `384 +` | Normal tile: `i = id - 384`, `sx = (i % 8) * 32`, `sy = floor(i / 8) * 32` |

Maps are 3 layers (ground, detail, overhead), each a 2D array of tile IDs.

#### `data/tilesets.json`

```json
{ "id": 1, "name": "Outside", "image": "overworld/tilesets/Outside.png",
  "autotiles": ["overworld/autotiles/Sea.png", ... 7 slots, null if empty],
  "passages":    [ ...indexed by tile ID ],
  "priorities":  [ ...indexed by tile ID ],
  "terrainTags": [ ...indexed by tile ID ] }
```

- **passages** (bit flags): side blocked — `0x01` bottom, `0x02` left, `0x04` right, `0x08` top → `15` = solid. `0x40` bush (hide lower body), `0x80` counter (talk across it).
  RMXP passability check for moving out of / into a cell in direction `d` (bit for that side):
  ```js
  for (layer = 2; layer >= 0; layer--) {       // top layer first
    const t = map[layer][y][x]; if (t === 0) continue;
    if (passages[t] & bit) return false;          // this side blocked
    if ((passages[t] & 0x0F) === 0x0F) return false; // fully solid
    if (priorities[t] === 0) return true;         // ground-level tile decides
  }
  return true;
  ```
  Check the current cell with the side you're leaving and the target cell with the opposite side.
- **priorities**: `0` draw under characters; `1–5` draw above characters (higher = further above). Tree tops and roofs are `1`.
- **terrainTags**: 0 None, 1 Ledge, 2 Grass (wild encounters), 3 Sand, 4 Rock, 5 DeepWater, 6 StillWater, 7 Water (surf/fish), 8 Waterfall, 9 WaterfallCrest, 10 TallGrass, 11 UnderwaterGrass, 12 Ice, 13 Neutral, 14 SootGrass, 15 Bridge, 16 Puddle, 17 NoEffect. Details and battle backgrounds in `terrain_tags.json`.

Tileset ids 1 and 2 are both `Outside.png`; #2 swaps in the waterfall autotiles.

### Autotiles — `overworld/autotiles/*.png`

Self-joining terrain (water edges, sand shores, flowers, cave floors).

| Size | Format |
|---|---|
| 96 × 128 | Standard RMXP autotile, 1 frame (3×4 grid of 32px tiles) |
| 96·N × 128 (e.g. 768×128) | N animation frames side by side (Sea = 8 frames) |
| 32·N × 32 (e.g. 160×32) | Single-tile animation, no edge joining (Flowers1 = 5 frames) |

Animate at ~one frame every 0.25s.

`Lava.png` is **made by us**: `Sea without shore.png` recoloured through a red → orange → yellow ramp. It sits in the
Caves tileset's spare autotile slot 4 (tile ids 192–239; `tilesets.json` marks them walkable — the map builder
blocks lava itself so a boulder can fill it).

**Drawing an autotile shape:** each of the 48 shapes is built from four 16×16 quarter-tiles (TL, TR, BL, BR). The source sheet is divided into 16px chunks numbered 1–48 (6 per row, 8 rows). Quarter lookup table (from Essentials `TileDrawingHelper`), indexed `[shape >> 3][shape % 8]`:

```js
const AUTOTILE_PATTERNS = [
 [[27,28,33,34],[5,28,33,34],[27,6,33,34],[5,6,33,34],[27,28,33,12],[5,28,33,12],[27,6,33,12],[5,6,33,12]],
 [[27,28,11,34],[5,28,11,34],[27,6,11,34],[5,6,11,34],[27,28,11,12],[5,28,11,12],[27,6,11,12],[5,6,11,12]],
 [[25,26,31,32],[25,6,31,32],[25,26,31,12],[25,6,31,12],[15,16,21,22],[15,16,21,12],[15,16,11,22],[15,16,11,12]],
 [[29,30,35,36],[29,30,11,36],[5,30,35,36],[5,30,11,36],[39,40,45,46],[5,40,45,46],[39,6,45,46],[5,6,45,46]],
 [[25,30,31,36],[15,16,45,46],[13,14,19,20],[13,14,19,12],[17,18,23,24],[17,18,11,24],[41,42,47,48],[5,42,47,48]],
 [[37,38,43,44],[37,6,43,44],[13,18,19,24],[13,14,43,44],[37,42,43,48],[17,18,47,48],[13,18,43,48],[1,2,7,8]]];
// chunk c (1-based) → sx = ((c-1) % 6) * 16 + frame*96, sy = floor((c-1) / 6) * 16
```

To choose the shape from neighbours at runtime instead of storing it, use the `NEIGHBORS_TO_AUTOTILE_INDEX` table in Essentials' `TileDrawingHelper.rb` (8-bit N/NE/E/SE/S/SW/W/NW mask → shape).

### Characters — `overworld/characters/*.png`

**Sheet format: 4 columns × 4 rows.** Frame size = width/4 × height/4.

- Rows (top→bottom): **down, left, right, up**
- Columns: walk cycle `[stand, step-L, stand, step-R]`. Idle = column 0.
- Anchor: bottom-centre of the frame sits on the bottom-centre of the tile. A 32×48 frame sticks 16px up into the tile above.

| Files | Frame | Notes |
|---|---|---|
| `trainer_POKEMONTRAINER_Red.png` / `_Leaf` / `_Brendan` / `_May` | 32×48 | **Player walking** (Red/Leaf = FRLG, Brendan/May = RSE) |
| `boy_run.png` / `girl_run.png` | 32×48 | Player running |
| `boy_bike.png` / `girl_bike.png` | 48×48 | Player on bike |
| `boy_surf.png` / `girl_surf.png` + `base_surf.png` (64×64) | 32×48 | Player riding; draw `base_surf` (the Lapras-like mount) underneath |
| `boy_fish_offset.png` / `girl_fish_offset.png` | 96×80 | Fishing animation |
| `base_dive.png` | 64×64 | Diving mount |
| `trainer_<TRAINERTYPE>.png` | 32×48 | Overworld sprite for each trainer class (Lass, Youngster, Gym Leaders…); matches `trainer_types.json` |
| `NPC 01–29.png` | 32×48 | Generic townsfolk |
| `Pokemon 01–12.png` | varies | Misc overworld Pokémon (Snorlax blocking a road, etc.) |
| `doors1–9.png` | 32×32 | Door **opening** animation: use one column, rows top→bottom = closed→open |
| `Object ball.png`, `Object boulder.png`, `Object rock.png`, `Object tree 1/2.png` | 32×32 | Item ball, Strength boulder, Rock Smash rock, Cut tree (rows = break animation) |
| `berrytree_<BERRY>.png`, `berrytreeplanted.png` … | 32×64 | Berry tree growth stages |
| `Healing balls 1/2.png` | | Poké Center healing machine animation |
| `phone001.png`, `e4wall.png`, `elevatorwall.png` | | Misc event graphics |

Walk speed in the originals: 16 frames per tile (~0.27s), running twice as fast. Step animation advances every half tile.

### Overworld Pokémon — `overworld/pokemon-followers/<ID>.png`

Same 4×4 layout (down/left/right/up), usually **64×64 frames** (legendaries up to 128×128). Great for: Pokémon walking behind the player, Pokémon standing in the overworld, starter-select scenes. Shiny versions in `pokemon-followers-shiny/`.

### Weather & fogs

- `overworld/weather/` — rain, storm, snow, blizzard, sandstorm, sun particles and tiling overlays (`*_tile.png` = full-screen scrolling layer; small ones = particles).
- `overworld/fogs/` — tiling fog overlays for caves/forests.

---

## Battle (`battle/`, `ui/Battle/`)

### Screen layout (single battle, 512×384)

| Element | Position |
|---|---|
| Background `<name>_bg.png` (512×288) | (0, 0) |
| Player platform `<name>_base0.png` (512×64) | anchor **bottom-centre** at (128, 304) |
| Foe platform `<name>_base1.png` (256×128) | anchor **centre** at (384, 176) |
| Player Pokémon back sprite | bottom-centre on (128, 304) |
| Foe Pokémon front sprite | bottom-centre on (384, 176) (roughly; nudge per species) |
| Message box `<name>_message.png` (512×96) | (0, 288) |
| Player data box `databox_normal.png` | (256, 196) |
| Foe data box `databox_normal_foe.png` | (-16, 24) |
| Player trainer back sprite | bottom-centre on (128, 288) |
| Foe trainer sprite | bottom-centre on (384, 182) |

Pokémon sprites are 96×96; draw them at **2×** (192×192) to match the platforms.

### Battle backgrounds — `battle/backgrounds/`

Each environment is a set of 4 files: `<name>_bg`, `<name>_base0` (player), `<name>_base1` (foe), `<name>_message`. Many have `_eve` and `_night` variants.

Names: `field` (default route), `grass`, `forest`, `sand`, `water`, `rocky`, `snow`, `ice`, `city`, `indoor1-3`, `cave1-3` (+`_ice`, `_water`), `underwater`, `champion1-2`, `elite1-8`, `distortion`.

Pick by the terrain tag the player is standing on: Grass/TallGrass → `grass`, Water → `water`, Sand → `sand`, Rock → `rocky`, Ice → `ice`. Otherwise use the map's default (`field` outside, `cave1` in caves, `indoor1` inside).

### Battle UI — `ui/Battle/`

| File | Layout |
|---|---|
| `databox_normal.png` 260×84 | Player HP box (has EXP bar area). Left 24px is the sloped edge. |
| `databox_normal_foe.png` / `databox_thin*.png` | Foe box / compact boxes for doubles |
| `overlay_hp.png` 96×18 | HP bar fill, **3 rows × 6px**: green (>50%), yellow (>20%), red. Crop width to `96 * hp / maxHp`. Put at databox + (24+124, 40) player, (16+124, 40) foe |
| `overlay_exp.png` 192×4 | EXP fill, at databox + (24+28, 74) |
| `overlay_lv.png` | "Lv" label |
| `icon_numbers.png` 176×14 | Digits `0-9` then `/`, 16px each |
| `icon_statuses.png` 44×96 | 6 rows × 16px: SLP, PSN, BRN, PAR, FRZ, TOX |
| `icon_own.png` | "Caught" ball shown on foe box |
| `overlay_message.png` / `overlay_command.png` / `overlay_fight.png` 512×96 | Bottom panel for text / main menu / move menu |
| `cursor_command.png` 260×460 | Menu buttons, **2 cols (normal / selected) × 10 rows of 46px**: FIGHT, POKéMON, BAG, RUN, CALL, BALL, ROCK, BAIT, BALL, CANCEL |
| `cursor_fight.png` 384×874 | Move buttons, one row per type (order = `types.json` iconRow) + selected column |
| `icon_ball*.png` | Party-lineup balls (healthy / status / fainted / empty) |
| `ability_bar.png` | Ability pop-up banner |

Text colours: message text `#505058` with shadow `#A0A0A8`; Pokémon name `#484848` shadow `#B8B8B8`; ♂ `#3060D8`, ♀ `#F85828`.

### Trainers (battle sprites)

- `Trainers/gen3/FRLG/` and `Trainers/gen3/RSE/` — **GBA-accurate** trainer battle sprites (lowercase names, e.g. `lass.png`, `brock.png`). Use these first.
- `Trainers/gen1`, `gen2`, `gen4/*`, `gen5` — other generations' art (mixed styles).
- `battle/trainers-essentials/<TRAINERTYPE>.png` (128×128) — matches `trainer_types.json` IDs. `POKEMONTRAINER_Red_back.png` etc. are **player back sprites** for throwing a ball: 5 frames in a row (wide sheet, frame width = width/5).

### Animations & transitions

- `battle/animations/*.png` — move animation cel sheets of **192×192 cells** (5 per row on 960-wide sheets, 4 on 768-wide).
- `battle/move-animations/` — small effect graphics.
- `battle/transitions/` — battle intro wipes (`021-Normal01.png` etc. are 512×384 grayscale wipe masks: reveal pixels darkest→lightest), `vsBar_*` / `vs_*` for gym leader intros, `ball_*`, `black_wedge_*`.

---

## Menus & UI (`ui/`)

| Folder | Screen |
|---|---|
| `ui/Party/` | Party screen: `bg.png` 512×384, `panel_round*` (first slot), `panel_rect*` (others), `_sel`/`_faint`/`_swap` states, `overlay_hp.png` (3 rows × 8px), `icon_ball*` |
| `ui/Summary/` | Summary pages `bg_1…5`, `icon_ball_<BALL>.png` caught-in ball, markings |
| `ui/Bag/` | `bag_1…8.png` bag image per pocket (`_f` = female), `bg_1…8`, cursor, slider |
| `ui/bag-pockets/` | `bagPocket1…8.png` small pocket icons |
| `ui/Pokedex/` | List, info, area, search screens; `icon_types.png` 96×608 = 19 rows × 32px |
| `ui/Storage/` | PC box screen + box wallpapers |
| `ui/Trainer Card/`, `ui/Town Map/`, `ui/Pokegear/`, `ui/Load/`, `ui/Naming/`, `ui/Mart/`, `ui/Hall of Fame/`, `ui/Phone/`, `ui/Mail/` | As named |
| `ui/Voltorb Flip/`, `ui/Slot Machine/`, `ui/Mining/`, `ui/Tile Puzzle/`, `ui/Triple Triad/` | Mini-games |
| `ui/types.png` | Type label icons, 64×532 = **19 rows × 28px** (row = `types.json` iconRow) |
| `ui/shiny.png`, `ui/sel_arrow.png`, `ui/pause_arrow.png`, `ui/*_arrow.png` | Shiny star, menu cursor, "more text" arrow |
| `ui/titles/` | `title.png` title screen, `start.png` "press start", `splash*.png`, `credits*.png` |
| `ui/pictures/` | Intro: `introOak.png`, `introBoy.png`, `introGirl.png`, `introbg.png` |

### Text boxes — `ui/windowskins/`

**9-slice** images. Border size = `(width - 16) / 2` horizontally and `(height - 16) / 2` vertically; the centre 16×16 is stretched/tiled.

| File | Style |
|---|---|
| `speech frlg.png` 80×80 (32px border) | **FireRed/LeafGreen dialogue box** ← use for GBA look |
| `speech em.png`, `speech rs.png` 80×48 | Emerald / Ruby-Sapphire dialogue box |
| `choice 1…28.png` 48×48 (16px border) | Menu / choice boxes (pause menu, Yes/No) |
| `signskin.png` | Signpost text |
| `speech dp/pl/hgss *.png`, `sign hgss *.png` | DS styles — not GBA, ignore |

---

## Items — `items/<ITEM_ID>.png`

48×48 icons (a few are slightly bigger; centre them). Use `data/items.json` → `icon` (115 items with no art fall back to `items/000.png`).
Pockets: 1 Items, 2 Medicine, 3 Poké Balls, 4 TMs & HMs, 5 Berries, 6 Mail, 7 Battle Items, 8 Key Items.

## Other Pokémon graphics — `pokemon/`

| Folder | Format |
|---|---|
| `front/<dex>.png`, `back/<dex>.png` | 96×96 battle sprites, #1–649. ⚠️ These are **Gen 5 (DS) style** — see Known gaps |
| `icons/<ID>.png` | Party/PC icon 128×64 = **2 frames of 64×64** (bob between them, ~0.2s) |
| `footprints/<ID>.png` | 32×32 Pokédex footprint |
| `eggs/000.png` | Egg battle sprite; `000_icon.png` egg party icon; `000_cracks.png` hatch cracks (5 frames) |
| `shadow/1-3.png` | Ellipse shadows (small/medium/large) under battle sprites |

---

## Audio — `audio/`

| Folder | Contents |
|---|---|
| `cries/<ID>.ogg` | Pokémon cries (forms: `<ID>_1.ogg`) — path in `species.json` |
| `bgm/` | Music. **33 are `.mid`, 13 are `.ogg`.** Browsers can't play MIDI directly: convert to OGG/MP3 (e.g. `timidity` or `fluidsynth` + `soundfont.sf2`) or use a JS MIDI player. Key tracks: `Title.ogg`, `Battle wild.ogg`, `Battle trainer.ogg`, `Battle victory *.ogg`, `Surfing.ogg`, `Bicycle.ogg`, `Route 1-3.mid`, `Poke Center.mid`, `Poke Mart.mid`, `Gym.mid`, `Cave.mid`, `Lab.mid`, `Battle Gym Leader.mid` |
| `jingles/` | Short fanfares: `Pkmn get`, `Item get`, `Badge get`, `Pkmn healing`, `Evolution start/success`, `Battle capture success`, `GUI save game` |
| `se/` | Sound effects: `GUI sel cursor/decision/cancel/buzzer`, `GUI menu open/close`, `Door enter/exit`, `Player bump`, `Player jump`, `Exclaim` (trainer spots you), `Battle throw/ball shake/ball drop/recall/flee`, `Battle damage normal/super/weak`, `Pkmn faint/level up/exp gain`, `Cut`, `Rock Smash`, `Strength push`, `PC open/close`, `Mart buy item`, `Repel` … |
| `se/move-anims/` | 209 attack sound effects used by move animations |

## Fonts — `fonts/`

| File | Use |
|---|---|
| `power clear.ttf` / `power clear bold.ttf` | Default dialogue font (FRLG-style) |
| `power green.ttf`, `power green narrow.ttf`, `power green small.ttf` | Menus, compact labels |
| `power red and blue.ttf`, `power red and green.ttf`, `power red and blue intl.ttf` | Gen 1 style |

Pixel fonts: find the size that renders crisply (try multiples of the base size) and keep anti-aliasing off. GBA-style text is drawn twice: shadow colour offset (+2,+2), then the main colour.

---

## Known gaps

1. **Battle sprites aren't GBA style.** `pokemon/front|back` are Gen 5 (Black/White) sprites. GBA-style (Emerald/FRLG) sprites exist for #1–386 only — PokeAPI/sprites `versions/generation-iii/emerald`. Decide: keep Gen 5 for all 649, or use GBA for 1–386.
2. **No ready-made maps.** Tilesets + passability are here, but towns/routes must be built (e.g. in [Tiled](https://www.mapeditor.org/) using the 32px tilesets, exporting tile IDs as above).
3. **MIDI music** needs converting for web playback.
4. `overworld/tilesets/hgss/` and DS windowskins are off-style — ignore or delete.
