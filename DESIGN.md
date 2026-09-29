# Pokémon Race — Design

Train your Pokémon with fast math, then watch that training pay off in a race. Look after your Pokémon on a
shared farm, collect ribbons and trophies, and evolve toward a goal you picked.

This consolidates `brainstorm.txt` and the decisions made since. Anything under **To decide** isn't settled — don't
build it as if it were. Numbers marked *(tune)* are starting points; most of them can be edited on the admin screen.

---

## The loop

```
 TRAIN (math, 60–90 s) ──► STATS go up ──► RACE (watch; stat-driven) ──► RIBBONS, TROPHIES
        ▲                                                                       │
        │     FARM: feed and care for your Pokémon with little math tasks ──► FRIENDSHIP
        │                                                                       │
        └──── new Pokémon (pick from the list) · evolution (a goal you chose) ◄─┘
```

References: **Pokéathlon** (HGSS: Pokémon athletics with stats; the closest existing game), **Chao Races**
(Sonic Adventure: raise a pet, watch it race).

## Players and screen (decided)

- **Two players, split screen**, like the adventure game but with two halves: side by side, 512×384 each → a
  1024×384 canvas, integer-scaled. Each half is independent: one child can train while the other watches a race.
- **No competition between the players.** The kids are different ages. Each has their own Pokémon, math level,
  races and trophies. They never race each other, and nothing ranks them against each other. The one place they
  meet is the **farm**, and there they help each other.
- Keyboard (decided, in `src/core/input.js`):

  | | Move | Yes | No | Menu |
  |---|---|---|---|---|
  | Player 1 | W A S D | Q | E | Tab |
  | Player 2 | Numpad 8 4 5 6 | Numpad 7 | Numpad 9 | Numpad Enter |

  Gamepads 1–2 work too.
- One speaker, one song: the music follows where the players are, and a new song stays at least 8 s
  (`reference/game/updateMusic.js`).

## Pillars (decided)

1. **Movement keys only.** The child never types. Answers sit in lanes, directions, or places on the map, and you
   steer or walk to them.
2. **Running is automatic.** In Speed training the Pokémon runs by itself, and you only change lanes. In races you
   don't press anything: you watch your training at work.
3. **Three stats:** ⚡ Speed, 💪 Strength, 🛡️ Defense. Plus **friendship** from the farm, which only matters for
   some evolutions.
4. **Math facts only:** add/subtract within 12+12, times tables 1–12, their divisions, simple fractions later. Not
   multi-digit sums like 17 + 34.
5. **Everything is tracked per Pokémon.** Stats, races won, ribbons, training done, friendship and evolution
   progress belong to that Pokémon, not the player.
6. **Rewards are things you keep:** ribbons, trophies, new Pokémon, farm unlocks, and **🪙 coins** for each race won
   (10 × its rank), spent in the farm's shop on treats and toys that raise a Pokémon's friendship. No XP.
7. **Goals are visible.** Evolution criteria are shown as a goal with progress bars, so the child always knows
   what they're working toward.
8. **No reading needed to play:** icons, pictures, sounds. Numbers appear in math problems and progress counters.
9. **A parent can tune it, per child:** an admin screen sets difficulty, the Pokémon list, evolution goals and
   pacing **separately for each child**, and fixes progress.

---

## Math engine

### Problem families

| Family | Range | Example |
|---|---|---|
| Add | 1–12 + 1–12 | 7 + 5 |
| Subtract | inverses of the above (answer ≥ 0) | 12 − 5 |
| Multiply | 1–12 × 1–12, introduced a table at a time (2, 5, 10 → 3, 4 → … → 12) | 7 × 6 |
| Divide | inverses of the multiplication facts | 42 ÷ 6 |
| Fractions (later) | visual first: "which is bigger, ½ or ¼?", then ½ + ¼ | |

The engine picks the **family and the fact**. Each game (training, farm) only shows a problem and 2–4 answers.
Every game gets its problems from this engine, **per player**.

### Levels

Each child moves through an ordered list of **levels**. Both children **start at level 1, basic adding** (decided).

| # | Level | Facts |
|---|---|---|
| 1 | Add within 5 | a + b with a, b ≥ 1 and a sum ≤ 5 (10 facts) |
| 2 | Add within 10 | the new sums 6–10 |
| 3 | Add to 12 + 12 | the rest of 1–12 + 1–12 (split it if it feels long; it's the biggest level) |
| 4 | Subtract within 10 | inverses of level 2 |
| 5 | Subtract within 24 | inverses of level 3 |
| 6 | × 2, 5, 10 | |
| 7 | × 3, 4 | |
| 8 | × 6, 7, 8, 9 | |
| 9 | × 11, 12 (all tables) | |
| 10 | ÷ (inverses of the tables so far) | |
| 11+ | fractions (later) | |

*(The list is a starting point; the admin screen can reorder or split it per child.)*

### Difficulty (decided)

```
level = clamp( mastery level,  admin floor,  admin ceiling )
```

- **Admin floor / ceiling** (per child): set by a parent. Both children start at floor 1 with no ceiling.
- **Mastery level: accuracy first.** A child moves on only when they're *accurate* on the current level, not just
  quick. The default bar *(tune per child)*:
  - every fact in the level has been answered at least **3 times**, and
  - each fact's **last 3 answers were all right**, and
  - the level as a whole is **≥ 90% right** over its last 30 answers.

  Speed is **tracked but doesn't gate** by default: slow facts get practised more often, and a parent can turn on a
  time requirement (e.g. "and under 4 s") on the admin screen.
- **Only answers move the level** *(decided)*: learning depends on how the child answers each fact, never on their
  Pokémon's stats. *(There used to be a stat ceiling; it's gone.)*
- **Easing off after a run of misses** *(tune per child: `ease`)*: in a training session, 3 wrong among the last
  5 answers eases the game off. Problems come from facts the child got right last time (earlier levels first; with
  none yet, the smallest facts of their level), and the game gives 1.5× the time where it has a clock (Speed's gates
  further apart). 3 right in a row and it's back to normal. Mastery is unaffected: it's still worked out from the
  problem table.
- **Choosing the next problem: flash cards** *(decided; tune per child: `srs`)*. Every fact the child has met sits
  in a **box**. Right → up a box; wrong → box 0. A fact comes back after 2, 3, 6, 12, 25, 50, 100, 200 more problems
  as it climbs the boxes (and from box 3 up also after 1, 2, 4, 7, 14 days), so a fact that's going well comes back
  less and less often but **never stops coming back**. A **miss comes back two problems later**; missed again, a
  little later each time (4, 6, up to 8), so one stuck fact doesn't crowd out everything else.
  The **next 5 problems are planned ahead** and saved (`profile.math.queue`), as if each were answered right; after
  every answer one more is chosen from how the child is doing right now: a just-missed fact that's due, else **a new
  fact** (at most one every 3 problems, only while fewer than 4 facts are still being learned and the last 10
  answers are ≥ 80% right; the next unseen fact of their level, smallest first, then the next level once every fact
  of this one is out and 70% solid, which is often a new kind of problem), else the most overdue fact. When the
  child starts missing, new facts already planned are taken back out, so they practise what they've met until it
  settles.

### Tracking every problem (decided)

**Every individual problem is tracked per child**, e.g. `2+3`, `3+2`, `5×7`, `35÷5`. It's keyed exactly as shown,
so `2+3` and `3+2` are separate entries; the admin grid can combine them. For each problem, the save keeps:

| Field | Meaning |
|---|---|
| `seen` | times asked |
| `right` / `wrong` | counts |
| `last` | the last 10 results, newest first (e.g. `"✓✓✗✓…"`) |
| `avgMs`, `bestMs` | response time (problem shown → answer committed) |
| `wrongPicks` | which wrong answers they chose and how often (`{ "6": 3, "4": 1 }` for 2+3), which shows the kind of mistake |
| `lastSeen` | when it was last asked |
| `box`, `lastStep`, `firstStep` | the flash-card box, and the child's problem count when it was last / first asked |

Everything else (level mastery, which facts to practise, the admin screen) is worked out from this table, so it's
the only thing the game has to save (plus the planned line-up, the problem count and the last 20 results). Wrong answers are offered on purpose, so they need to be plausible (next
section) for `wrongPicks` to mean something.

### Rules for every problem

- **Plausible wrong answers**, never random ones: for 7 × 6 offer 42 / 48 / 36; for 2 + 3 offer 5 / 4 / 6.
- **No learnable positions**: the correct answer never favours a lane, a direction, or a bin on the farm.
- **After a wrong answer, show the right one** for about half a second (`7 × 6 = 42`).
- A problem **counts once**, on the first answer. Trying again after a miss is for learning; it isn't recorded as
  right.

---

## Training (per Pokémon)

All three share one structure: an escalating session with a soft cap (60–90 s). **The menu button (Tab / Enter /
Start) leaves any activity early and keeps what was earned** (straight to the results); in a race it skips the rest straight to the results (the outcome can't change). A correct answer adds momentum and
a wrong one costs a little. **Stats only go up**, and a bad session just earns less. The gain goes to the Pokémon you
trained, and diminishes as a stat gets high *(tune)* so all three get trained.

### ⚡ Speed: the lane run (runs by itself)

- The track is seen from above and scrolls right. The Pokémon **runs automatically** (the run sheet's right-facing
  row). There are 3 lanes, and **up/down** is the only control.
- A problem appears, and each lane's upcoming gate shows an answer. Be in the right lane when it arrives.
- Correct → faster (1.0× → 1.1× → …): speed lines, dust, a cry, and **the Pokémon uses one of its own moves** to
  burst through the gate (the answer boards fly apart). **3 right in a row → a boost:** a flash, a burst of speed,
  afterimages; 🔥 counts the streak. Wrong → a stumble, the boards topple, it eases back and the streak ends.
- Higher Speed stat → a higher top speed is possible. "How fast can you get it today?"

### 💪 Strength: break the rock (decided)

- The Pokémon stands in a quarry, seen from behind, with something heavy in front of it: small tree → rock →
  boulder → dark boulder. Heavier ones come as Strength grows, and every two broken in a session brings a heavier one.
- It knows **three real moves** (`src/data/moves.js`: its line's own, e.g. Charmander's Scratch / Ember /
  Flamethrower, or its type's), listed as buttons, **each showing an answer**. Up/down moves an arrow, A uses the
  move. The move's real animation plays (the RPG's recipes, `game/anims.js`).
- Right → the move hits: a crack per hit, enough → **CRACK**, and the next one rolls in. Wrong → the move flies wide
  (💫) and the right answer shows.

### 🛡️ Defense: guess the attack

- The Pokémon stands in an arena. A problem appears, and each of the four sides (up, left, right, down) shows an
  answer. **The correct answer marks the side a wild Pokémon will attack from.** Turn the shield toward it.
- **No timer** *(decided)*: press **A to brace**, which locks the shield. Only then does the attacker (a real
  Pokémon, one of the race opponents near your Pokémon's Defense, so bigger ones as it grows) run in from that side
  and use one of its moves. Nothing gives the side away beforehand, so the math is required.
- Blocked → the move bursts on the shield. Hit → a flinch (nothing is lost) and the right answer.

---

## Races (per Pokémon; watch only)

### Format

- **You + 3 opponents**, each in a row of the same top-down track, scrolling right. **Fully automatic:** no buttons (the menu button skips to the results, ⏭️).
  It's 30–45 s of watching training pay off. Big moments get big feedback *(built: your Pokémon smashes barriers
  with its own moves and the screen shakes; dust trails; 🛡️ when Defense shrugs off a trap; a finish within half a
  second is a **photo finish**, the last stretch in slow motion and a 📸 flash; confetti when you win)*: smashing a barrier, shrugging off a
  trap, a photo finish.
- Obstacles are **mixed through each course**. Every course has its own character (forest run, mountain pass,
  ruins full of traps, beach, cave, volcano…), backdrop, weather and music.
- The entrance shows a **preview** in icons (🏃🏃🏃 🧱🧱 🛡️🛡️🛡️) and the opponents' faces. No stat numbers.
- **Win → the race is complete for that Pokémon** and can't be run again. **Lose → retry whenever you like**, but
  **races have no randomness**: the same stats give exactly the same race, so only training changes the result. The
  results screen shows where your Pokémon lost time (stuck at a barrier 🧱, slowed by traps 🛡️, just not fast enough
  🏃) as a hint for what to train.

### Race completion is per Pokémon

Races are tracked per Pokémon because a newly earned Pokémon starts weak. If completions were shared, a new one
would only be offered races it could never win. With per-Pokémon completion, every new Pokémon starts at the first
races and climbs its own ladder, and a child with several Pokémon has a ladder in progress for each.

### Lots of opponents, always changing

- **Every race has its own 3 opponents.** No two races on a Pokémon's ladder use the same line-up, and a species
  doesn't come back until much later on the ladder.
- The pool is large: any species with a front sprite and a run sheet (653 of them) outside the player roster.
  Opponents get tougher along the ladder: early races bring small first-stage Pokémon (Pidgey, Caterpie, Sentret),
  and later ones bring evolved and eventually legendary Pokémon.
- Opponent stats come from their real base stats, scaled to the race's place on the ladder. A Pokémon is only as
  good as its species: Rapidash is quick and Onix is a wall.
- **The ladder is generated, then checked.** `tools/gen-races.mjs` builds the whole ladder (venues × ranks × races,
  opponents picked without repeats) into `src/data/races.js`. `tools/check-races.mjs` simulates every race and fails
  if a race has only one winning build, or none a child could have reached by then. Start with roughly **8 venues ×
  4 ranks × 3 races ≈ 96 races** *(tune)*.

### Simulation (starting point)

| Segment | Time |
|---|---|
| Run (length L, terrain m) | `L × m / (base × Speed^0.3)` *(was `base + k·Speed`, which let Speed swamp everything once stats got big)* |
| Barrier (hardness H) | Strength ≥ H → one quick smash; otherwise **headbutt it until it breaks** *(decided)*: H ÷ Strength headbutts (2–6), each 1.3 s, shown as dots filling. |
| Trap zone (power P) | run time × `(1 + s × max(0, 1 − Defense / P))` |

*(Built: a smash is 0.5 s; a trap zone at most triples its time. Barriers and traps are
sized from each race's own opponents, so about half of them smash a barrier at a normal venue. A race has 5–10
obstacles (a venue's first race 4 + rank, one more per race after). Venues, easiest first: meadow, forest, beach,
mountain pass, cave, snowfield, ruins, volcano. At a rank all 8 venues are open, a venue's 3 races go in order,
and the next rank opens when the rank is won. Every new Pokémon starts at the same total (36), split like its base
stats, so no pick is a bad start; a species' growth never counts below 0.6 (`minGrowth`), so Abra's Defense still
trains.)*

**The yardstick is training sessions** *(decided)*. A race's place on the ladder `n` counts the races before it in
the order a child usually meets them (a rank's first races meadow → volcano, then its second races, …). The ladder
expects 2 sessions before the first win and **3 more per race** (about one of each), each session 16 right
answers, earned exactly the way training earns them (`budgetFor`, `LADDER` in `game/race.js`). Every race is as
hard as it can be while at least two of four builds (balanced / fast / strong / tough) win at that total.
*(It used to count only the races that had to be won first, 0–2 at every rank-1 venue, so a few sessions won all
24 rank-1 races.)* `tools/check-races.mjs` also plays each starter as a child who trains whatever the results screen
says (about 4–5 sessions a race) and one who only ever trains one stat (loses almost everything).

**No randomness at all** (decided): opponents' stats are fixed per race, and there are no dice anywhere in the
simulation. Different builds should win different races: fast and strong enough, tanky and slow, or balanced.

---

## Pokémon

### Choosing Pokémon (decided)

The first Pokémon, and **every Pokémon earned later**, is picked from a list (the default below; **each child has
their own list**, edited on the admin screen):

> Eevee · Pikachu · Charmander · Squirtle · Abra · Zorua · Fletchling · Snivy · Ralts · Purrloin · Shinx ·
> Riolu · Poliwag

(Shinx is the first stage of Luxio's line.) A parent edits each child's list on the admin screen with a lookup tool.

- **One of each.** A species a child already has is greyed out on their pick screen (whatever it has evolved into
  since).
- **Except Eevee:** a child can have several Eevees, **one per Eeveelution**. When Eevee is picked, the child also
  picks which Eeveelution it will become. That's fixed from the start and becomes its goal. Eevee stays on the list
  until every Eeveelution the child's list allows is taken, and branches already taken are greyed out.

- **Earning a new Pokémon:** the **first race a child wins earns their second Pokémon** (so there's soon someone
  else on the farm), then every *N* more races won across that child's Pokémon *(tune; start N = 8)*. The pick
  screen shows the list: front sprites, cries, and icons for growth.
- Starting stats and growth come from base stats: Speed ← `spe`, Strength ← `atk`, Defense ← `def`. (Every species
  starts at the same total, split in its base stats' proportions; growth follows the species.) Growth shows as
  icons (⚡⚡⚡⚡⚡), never numbers.
- Your first Pokémon never goes away. You choose which one to train, race or feed.

### Evolution: a visible goal

Each Pokémon's card (on the farm and in the trophy room) shows its **next evolution as a goal**: the silhouette,
then the criteria as icons with progress bars.

```
  ??? (Jolteon silhouette)
  ⚡ Speed      ████████░░  48 / 60
  🏁 Races won  ██████████   6 / 6 ✓
```

When every bar fills, it evolves: glow, `bgm/Evolution.ogg`, `jingles/Evolution success`, big stat jump, better
growth. *(Built: it happens on the farm, to the Pokémon following you, as soon as its goal is full; the stat jump is
`evolutionStatBoost` (15%, at least +2 each); growth follows the new species; the card remembers its old forms.)* **Criteria are a table the admin screen can edit.** They're made of: a stat ≥ n, total stats ≥ n, races won
by this Pokémon ≥ n, races won at a venue type ≥ n, friendship ≥ n.

**Branching evolutions are chosen ahead of time.** Eevee's is chosen when it's picked and can't change (see
above). For Kirlia → Gardevoir/Gallade and Poliwhirl → Poliwrath/Politoed, the child chooses when the Pokémon reaches
that stage and can change their mind until it evolves. The chosen branch's criteria become the goal. Default criteria
*(all tune; each child can have their own)*:

| Line | Evolution | Default goal |
|---|---|---|
| Eevee → | Jolteon | Speed 60 |
| | Flareon | Strength 60 |
| | Vaporeon | all three stats ≥ 40 |
| | Leafeon | Defense 50 + 3 forest races won |
| | Glaceon | Defense 50 + 3 snow races won |
| | Espeon | Speed 45 + friendship full |
| | Umbreon | Defense 45 + friendship full |
| | Sylveon | friendship full + 8 races won |
| Two-stage lines | 1st evolution | total stats 90 + 4 races won |
| (Charmander, Squirtle, Abra, Snivy, Ralts, Shinx, Poliwag, Fletchling) | 2nd evolution | total stats 180 + 12 races won |
| Kirlia → | Gardevoir / Gallade | 2nd-stage goal + (Speed 70 / Strength 70) |
| Poliwhirl → | Poliwrath / Politoed | 2nd-stage goal + (Strength 70 / friendship full) |
| One-stage lines | Pikachu → Raichu, Zorua → Zoroark, Purrloin → Liepard | total stats 120 + 6 races won |
| | Riolu → Lucario | total stats 120 + friendship full |

A Pokémon keeps its race ladder, ribbons and history when it evolves.

**Species outside the default lines** (a parent adds Vulpix or Oddish to a pick list) get goals from their real
evolutions in `species.json`, with default criteria by their place in their line (`evolutionDefaults`: the first
of two evolutions = the two-stage 1st-evolution goal, the second = the 2nd-evolution goal, the only one = the
one-stage goal). Vulpix → Ninetales: total stats 120 + 6 races won. A branch not chosen yet shows its first option
(`src/game/goals.js`).

---

## The farm: the shared home (decided)

*Each child has a colour (set on the admin page): their half of the screen, a ring under them, and a smaller ring
under each of their Pokémon, so two children's Pikachu can be told apart. A Pokémon heading for a chosen
evolution shows that goal's icon over its head (one child's Eevees).*

**The farm is home.** There's no home menu: once a child has picked who they are, they're standing on the farm, a
top-down place both players walk around at once, each half of the screen with its own camera on the same map (the
RPG's overworld view and tiles; `reference/world/`). The players see each other, and **everyone's Pokémon live
here**, exploring the farm, including the Pokémon of a child who isn't playing right now.

- **Your follower is the one you train and race.** Pokémon that aren't following anyone **explore the farm**
  freely. Walk up to one of yours and press A: it follows you (the one that was following goes off exploring).
  Press A facing your follower, or **hold B standing still** (a ring fills over it), to let it go exploring, so you
  walk alone. Your sibling's Pokémon greet you (a
  cry, a heart).
- With no follower, the training places and the stadium won't let you in (a ❔ over your head): pick someone first.
- **Treats** (with farm care, build step 8): bring treats to exploring Pokémon for friendship, then pick one to
  follow. The care tasks below are how treats are earned and given.
- **Every activity is a place you walk to** (nothing to read, and the answer to "what do I do" is "go there"):

  | Place | Where | Opens |
  |---|---|---|
  | ⚡ The track | the road out east | Speed training |
  | 💪 The quarry | the road out west | Strength training |
  | 🛡️ The arena | a gym building | Defense training |
  | 🏁 The stadium | the big building up north | Races (venue map → preview → race → ribbon) |
  | 🏆 The trophy house | a house | the trophy room (each child's own cases) |
  | The lab | a building | picking a new Pokémon when one is earned |
  | 🛒 The shop | the blue house | treats, toys and furniture, bought with 🪙, into the 🎒 bag |
  | 🏠 Your house | two green houses | your room: furniture, and Pokémon who live there |

  A floating icon over each entrance shows what it is. You enter by walking in, and come back out at the door.
  A place that isn't built yet shows 🚧 when you bump into it.
- While one child is in a place, the other keeps playing on the farm; the one inside disappears from the farm
  until they come out.
- **Tab (the menu button)** opens a small menu: 🎒 the bag, or 🚪 leave (back to picking who's playing).
- **The bag** *(decided)*: everything bought in the shop goes in the child's 🎒 bag. From the bag they **hold** a treat
  (it shows over their head) and press A facing any Pokémon, theirs or their sibling's, to give it: that Pokémon's
  ❤️ friendship bar pops up over it and fills. Buying and giving are rewards, so they need no math.

- **Needs** show as bubbles: hungry 🍎, thirsty 💧, wants to play ⚽, wants brushing ✨.
- **Caring is math with your feet.** Walk up and press A. The bubble shows a problem (`6 + 7`). Around the pen,
  treat baskets, troughs and toy boxes are each labelled with a number. **Walk to the right one**, press A to pick up,
  walk back and give it. Wrong one → the Pokémon shakes its head, the right answer shows, and you try again.
- Correct → hearts, a happy animation, a cry → **friendship** for that Pokémon (it counts toward some evolutions).
- **Co-op, not competition:** you can look after your sibling's Pokémon too, and it gets the friendship. Problems use
  *your* math level.
- Needs come **from training** (not from arriving), never on a real-time timer. Nothing gets sick or sad while the kids are away.
- *(Built: **needs come from training**: every `needsEverySessions` sessions (2) the Pokémon that trained gets one,
  matched to the work: ⚡ → 💧 thirsty, 💪 → 🍎 hungry, 🛡️ → ✨ brushing / ⚽ play. The results screen shows it; it's saved
  until someone looks after it. A on one starts it: the problem over the Pokémon, three numbered berries / water /
  toys / scarves a few steps away in the child's colour. Right → `careFriendship`. A need on a Pokémon comes before
  following / letting go with A.)*
- The farm grows with ribbons: new pens, decorations, a pond, a berry garden (farm unlocks are a ribbon reward).
- The **trophy room** is a building on the farm.

## Houses (decided)

Each child has **their own house** on the farm (two green houses side by side, a 🏠 bubble in the child's colour).
Inside is a **big room** (18 × 11 floor tiles at the farm's scale, scrolling) with two modes:

- **🚶 Walk mode** (how you come in): walk about with the arrows (B runs), your follower behind you. **Pokémon work
  just as on the farm** (free): A facing one of yours who lives there → it follows you (your old follower moves in
  where it stood); A facing your follower, or B held standing still (a ring fills) → it moves in. In a sibling's
  house A says hello. **A facing furniture uses it, after a right answer:** 🛏️ a nap (the lights go down,
  💤), 🛋️ sit down (🎵), 📺 the TV or computer comes on (a Pokémon on screen, its cry), 🌴 water the plant (💧 ✨, it
  sways), 🍰 a snack on the table or a 🥤 from the drinks machine (the Pokémon who live there hop with ❤️), ✨ tidy the
  cabinet, 🌀 a twirl at the dresser. Walk out through the door to leave. Tab: edit mode.
- **✏️ Edit mode** (the owner only): a toolbar and a cursor on the floor.

| Tool | What it does | Math? |
|---|---|---|
| 🪑 place | pick furniture from the bag, steer it (green = fits, red = doesn't), A | **yes**: a right answer first |
| ✋ move | steer to a piece, A to lift, steer, A | **yes** |
| 🗑️ put away | steer to a piece, A: back in the bag | **yes** |
| 🧱 walls | pick a style (wood, brick, white, blue, hedge), then build or knock down up to `wallsPerAnswer` (6) blocks with A | **yes**: one answer per run |
| 🚶 walk | (B or Tab too) back to walking | |

The question is `scenes/mathAsk.js`: three answers side by side; wrong → the answer shows and it asks again (only the
first answer is recorded); B gives up. Furniture comes from the shop's 🛋️ shelf (`settings.furniture`: sprites cut
from `Interior general.png`, found by rendering the sheet; `fw × fh` tiles; `use`; 30 pieces). Rugs lie under
everything; walls block walking and furniture; the doorway stays clear. On admin.html a parent can add or remove
anything in a child's bag, take placed furniture back into the bag, and knock down all the walls. Pokémon who live in a house aren't on the farm; they wander about the room and hop with a ❤️
when something new arrives. A sibling can visit, walk about, say hello and use things, but not edit.

## Trophy room

A building on the farm with a display case for each Pokémon:

- its **ribbons**, one per race won, from `ui/Summary/ribbons.png` (colour = venue type, ranks 1–4 = venue rank);
- **trophies** (cups) for finishing a whole venue, or all ranks of it;
- its **card**: front sprite, stats as icon bars, races won, trainings done, friendship, the evolution goal, and
  its past forms ("evolved from Eevee after 14 races").

Walk up to a case and press A to look closer. The trophy room belongs to each player. The farm is shared, but each
child's cases are their own.

*(Built as a shelf rather than a room to walk round: left/right picks a case, up/down turns it between the card and
the ribbon case, a row of ribbons per venue with a 🏆 for each rank of it won in full. The card doesn't show
trainings done yet.)*

---

## Admin screen (parent only)

A separate page, **`admin.html`** (open it at `/admin.html`; there's no link from the game). It's an ordinary web
page with mouse, typing, buttons and tables: this is the one place typing is fine. It reads and writes the same save
as the game (localStorage on this machine).

**Everything is per child.** Pick a child at the top of the page; every section below edits that child's settings.
Each setting shows whether it's the default or customised, with a "reset to default" button and "copy from the
other child".

| Section | What you can do |
|---|---|
| **Players** | names, avatar |
| **Flash cards** ✓ | problems answered, level, facts met / solid, the last answers, **the next 5 problems**, and a grid per level: every fact coloured by its box, outlined when due, marked when it's in the next 5; hover for its history (right/wrong, last 10, times, wrong answers picked, when it's due); click to reset it |
| **Math** | the level list (reorder, split, turn families on/off); **floor and ceiling level**; move the child to a level by hand; the mastery bar (answers per fact, last-N-right, level %, optional time limit); **the problem table as a grid** (e.g. an addition square, a times table): each cell coloured by accuracy, with times, counts and common wrong answers on hover; reset a fact |
| **Pokémon list** | this child's pick list: **a lookup tool** (search by name or dex number; shows front sprite, run animation, base stats → growth icons; only species with sprites can be added), add, remove, reorder; which Eeveelutions Eevee may become; races per new Pokémon (N) |
| **Evolution goals** | the criteria table above, per line and branch |
| **Pacing** | training session length, stat gain per session, how fast training speeds up, farm tasks per visit |
| **Races** | how hard the ladder is for this child (opponent strength), re-run the checker's summary |
| **Progress** (per Pokémon) | view and edit stats, friendship, races won, ribbons; open or close a race; give a Pokémon; set a branch; reset a Pokémon |
| **Backup** | export / import the whole save as a JSON file; reset everything |

Settings live in the save with **defaults in `src/data/defaults.js`**. Each child's settings are that child's
overrides on top of the defaults: `settings = { ...defaults, ...child.overrides }`. The save stores only what's
changed, so new defaults still reach an old save. The race ladder itself is shared (generated once). A child's
opponent-strength setting scales it.

---

## Screens

```
Title → (each half) who's playing → [first Pokémon pick] → THE FARM (shared, walk around; your follower is
                                                           the Pokémon you train and race)
   walk to the track   → ⚡ Speed          walk into the arena    → 🛡️ Defense
   walk to the quarry  → 💪 Strength       walk into the stadium  → 🏁 venue map → preview → race → ribbon
   walk into the trophy house → 🏆          walk into the lab      → new Pokémon pick (when earned)
admin.html  (separate page, parent only)
```

## To decide

Nothing open right now. New questions go here.

## Build order

1. **Shell:** two-player split screen, save/profiles, `defaults.js`, and a first `admin.html` (players + math
   floor/ceiling + the Pokémon list lookup). ✓
1b. **The farm as home:** the shared map, walking, followers, exploring Pokémon, follow / let go, and entrances
   (🚧 until each place is built). ✓
2. **Speed training** (auto-run, lanes). ✓ (with the first part of the math engine: facts, plausible answers,
   the per-problem table)
3. **Math engine:** levels, the per-problem table, mastery, plausible wrong answers, choosing the next problem. ✓
4. **Race simulator + `gen-races` + `check-races`**, then the race screen. ✓
5. **Per-Pokémon records, ribbons, trophy room**, and picking new Pokémon. ✓ (the lab: a 🎁 over it and on the
   race results when one is earned; the trophy house: a case per Pokémon with its card, goal and ribbons)
6. **Evolution** with visible goals and branch choice. ✓ (on the farm; a Pokémon with more than one way to go
   picks first; admin.html can change the branch)
7. **Strength** ✓ and **Defense** ✓ training.
8. **Farm care** (needs, care tasks, friendship). ✓ Also the 🎒 bag and each child's 🏠 house.
9. Admin: progress editing (✓ so far: give / remove a Pokémon, the follower, a branch, stats and friendship), mastery
   grid, evolution table, backup.
