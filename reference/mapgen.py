# Draws the ASCII layouts for the Solara outdoor maps -> src/maps/layouts.js
#   python tools/mapgen.py src/maps/layouts.js && node tools/check-layouts.mjs && node tools/check-events.mjs
#
# Legend: . grass  , wild grass  ; tall grass  T forest  = town path  : dirt path  ~ water
#         B wooden deck/bridge  _ ledge (jump down)  f flowers  # fence  r rock  s signpost  x invisible wall
#         W snow  y / Y wild / tall grass poking through snow   (a map drawn with snow=True is snow all over)
#         H stone stairs up a rock face (a ramp between terraces)
#         O rocks in the sea — solid. Every stretch of sea that doesn't lead on ends in a band of these,
#           so the edge of the world is something you can SEE (never an invisible wall).
#   caves (tileset 6): i slippery ice, k/K thin ice (only K holds), I the Ice Rock, L steps, r rocks,
#                      l lava, q/Q flame jets (volcano caves)
#
# HOW THESE MAPS ARE BUILT
#   Every map starts as SOLID FOREST and the walkable area is *carved* out of it, so a route has no open
#   margin you can skirt around: to reach the next town you follow the corridor, cross its grass and pass
#   its trainers.
#
#   carve() only accepts rectangles on the grid the tileset needs: a tree is 2 tiles wide and 3 tall, so
#   carved rectangles start on an even column and a row that is a multiple of 3, with an even width and a
#   height that is a multiple of 3. That keeps every remaining forest run whole — no half-drawn trees.
import sys

BAND = 3   # a tree is 3 rows tall


class M:
    def __init__(s, w, h, fill='T'):
        s.w, s.h = w, h
        s.g = [[fill] * w for _ in range(h)]
        s.carved = [[False] * w for _ in range(h)]

    def carve(s, x, y, w, h, c='.'):
        assert x % 2 == 0 and w % 2 == 0, ('carve x/w must be even', x, w)
        assert y % BAND == 0 and h % BAND == 0, ('carve y/h must be multiples of 3', y, h)
        for j in range(y, y + h):
            for i in range(x, x + w):
                if 0 <= i < s.w and 0 <= j < s.h:
                    s.g[j][i] = c
                    s.carved[j][i] = True
        return s

    def fill(s, x, y, w, h, c):
        """Paint terrain inside already-carved ground (any shape)."""
        for j in range(y, y + h):
            for i in range(x, x + w):
                if 0 <= i < s.w and 0 <= j < s.h and s.carved[j][i]:
                    s.g[j][i] = c
        return s

    def put(s, x, y, c):
        s.g[y][x] = c
        s.carved[y][x] = True
        return s

    def wall(s, x, y, w, h, c):
        """Repaint a block of *uncarved* wall as a different wall (forest in a cliff face, say).
        Walls are drawn in 2x3 units, so the block has to sit on that grid too."""
        assert x % 2 == 0 and w % 2 == 0, ('wall x/w must be even', x, w)
        assert y % BAND == 0 and h % BAND == 0, ('wall y/h must be multiples of 3', y, h)
        for j in range(y, y + h):
            for i in range(x, x + w):
                if 0 <= i < s.w and 0 <= j < s.h and not s.carved[j][i]:
                    s.g[j][i] = c
        return s

    def block(s, x, y, w, h, c='C'):
        """Drop a lump of wall back into carved ground — an outcrop to cut a cave mouth into."""
        assert x % 2 == 0 and w % 2 == 0, ('block x/w must be even', x, w)
        assert y % BAND == 0 and h % BAND == 0, ('block y/h must be multiples of 3', y, h)
        for j in range(y, y + h):
            for i in range(x, x + w):
                if 0 <= i < s.w and 0 <= j < s.h:
                    s.g[j][i] = c
                    s.carved[j][i] = False
        return s

    def rows(s):
        return [''.join(r) for r in s.g]


def sea(w, h):
    """A sea map: all water, carved, ready for islands."""
    m = M(w, h)
    m.carve(0, 0, w, h, '~')
    return m


def blob(m, cx, cy, rx, ry, c, only=None):
    """Paint a rough ellipse of terrain (an island, a patch of grass). `only` limits it to cells that are
    already one of those characters (grass inside the sand, say)."""
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if 0 <= x < m.w and 0 <= y < m.h and ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2 <= 1:
                if only is None or m.g[y][x] in only:
                    m.g[y][x] = c
                    m.carved[y][x] = True
    return m


def rim(m, up=(), down=(), left=(), right=(), t=2):
    """Sea rocks round the edges of a map, except the gaps (ranges) that lead on to the next map.
    Only water turns to rock. The Water rock autotile draws one rock where four cells meet, so rocks
    always go down in 2x2 blocks; now and then a block juts out further so the edge isn't ruled."""
    def gap(spans, i):
        return any(a <= i < b for a, b in spans)

    def rock(x, y):
        if 0 <= x < m.w and 0 <= y < m.h and m.g[y][x] == '~':
            m.g[y][x] = 'O'
    for x in range(m.w):
        deep = t + (2 if (x // 2 * 7) % 5 == 0 and 4 <= x < m.w - 4 else 0)
        for j in range(deep):
            if not gap(up, x) and not gap(up, x ^ 1): rock(x, j)
            if not gap(down, x) and not gap(down, x ^ 1): rock(x, m.h - 1 - j)
    for y in range(m.h):
        deep = t + (2 if (y // 2 * 5) % 7 == 0 and 4 <= y < m.h - 4 else 0)
        for j in range(deep):
            if not gap(left, y): rock(j, y)
            if not gap(right, y): rock(m.w - 1 - j, y)
    return m


def rocks(m, cells):
    """2x2 sea rocks, by top-left corner."""
    for x, y in cells:
        for j in (0, 1):
            for i in (0, 1):
                if m.g[y + j][x + i] == '~':
                    m.g[y + j][x + i] = 'O'
    return m


def reef(m, y, x0, x1):
    """A 2-deep line of sea rocks from x0 to x1 (exclusive)."""
    for x in range(x0, x1, 2):
        rocks(m, [(x, y)])
    return m


def boardwalk(m, x, y, w, h):
    """A street that turns into a wooden walkway where it crosses water."""
    for j in range(y, y + h):
        for i in range(x, x + w):
            m.g[j][i] = 'B' if m.g[j][i] == '~' else '='
    return m


L, stamps = {}, {}

SIZES = {'house_green': (5, 4), 'house_blue': (5, 4), 'house_gray': (5, 4), 'house_purple': (5, 4),
         'house_orange': (5, 5), 'house_teal': (6, 4), 'lab': (6, 4), 'pokecenter': (5, 5), 'mart': (4, 4),
         'gym': (7, 5), 'institute': (7, 5), 'rocket_hq': (6, 5), 'fountain': (3, 3),
         'cliff_cave': (3, 2), 'cave_mouth': (1, 1), 'cave_mouth_grey': (1, 1), 'dome_tower': (7, 13)}


def check_stamps(key, rows, sts):
    """Buildings must stand on carved ground and must not overlap each other."""
    used = set()
    for (name, x, y, _to) in sts:
        w, h = SIZES[name]
        for j in range(y, y + h):
            for i in range(x, x + w):
                assert 0 <= i < len(rows[0]) and 0 <= j < len(rows), (key, name, 'off map', i, j)
                if not name.startswith('cave_mouth'):   # a cave mouth belongs IN the rock
                    assert rows[j][i] not in 'T~CcRO', (key, name, 'sits on trees/cliffs/water at', i, j)
                assert (i, j) not in used, (key, name, 'overlaps another building at', i, j)
                used.add((i, j))


# ================================================================= Maplebrook Town 36x30 — meadow village
# Home. Three houses on the main street, the neighbour's cottage, a duck pond, and Professor Aspen's lab down
# the lane at the bottom of town. Woods crowd in at the corners.
m = M(36, 30)
m.carve(4, 3, 28, 24)
m.block(4, 3, 2, 3, 'T'); m.block(28, 24, 4, 3, 'T'); m.block(4, 24, 2, 3, 'T')   # woods in the corners
m.carve(14, 0, 2, 3, '=')                  # road north to Route 1
m.fill(14, 3, 2, 7, '=')
m.fill(5, 10, 26, 2, '=')                  # main street
m.fill(14, 12, 2, 6, '=')
m.fill(14, 18, 12, 2, '=')                 # lane to the lab
m.fill(7, 15, 6, 5, '~'); m.fill(8, 14, 4, 1, '~'); m.fill(8, 20, 4, 1, '~')    # the duck pond
m.fill(7, 5, 5, 1, 'f'); m.fill(23, 4, 5, 1, 'f'); m.fill(27, 17, 4, 1, 'f'); m.fill(6, 22, 6, 1, 'f')
m.fill(20, 25, 7, 1, '#'); m.fill(8, 25, 6, 1, '#')
m.put(17, 12, 's')
L['maplebrook'] = m.rows()
stamps['maplebrook'] = [('house_green', 6, 6, 'home1'), ('house_blue', 17, 6, 'home2'), ('house_orange', 23, 5, 'home3'),
                        ('house_gray', 25, 12, 'neighbor'), ('lab', 18, 20, 'lab')]

# ================================================================= Route 1 28x45 — meadow corridor
r = M(28, 45)
r.carve(12, 42, 4, 3, ':')                 # south gate (from Maplebrook)
r.carve(10, 36, 8, 6)                      # lower junction
r.carve(4, 36, 6, 3)                       # west leg
r.carve(4, 27, 6, 9)                       # long north leg — the grass crossing
r.carve(4, 24, 16, 3)                      # eastward leg
r.carve(16, 12, 4, 12)                     # north leg, all wild grass
r.carve(20, 15, 6, 6)                      # tall grass on the orchard trail
r.carve(18, 36, 6, 3)                      # a fork: the orchard trail east of the meadow
r.carve(22, 21, 4, 15)                     # north along the orchard
r.carve(10, 9, 10, 3)                      # west leg toward the north gate
r.carve(18, 6, 8, 6)                       # berry farm yard
r.carve(12, 0, 4, 9, ':')                  # north gate to Cedarwood
r.fill(14, 42, 2, 3, ':'); r.fill(14, 39, 2, 3, ':')
r.fill(10, 36, 8, 2, ':'); r.fill(4, 36, 6, 2, ':')
r.fill(4, 27, 6, 9, ',')                   # the road gives out: cross the meadow
r.fill(4, 24, 16, 2, ':')
r.fill(16, 12, 4, 12, ',')
r.fill(16, 12, 2, 3, ':')
r.fill(20, 15, 6, 6, ';')
r.fill(10, 9, 10, 2, ':')
r.fill(12, 3, 4, 6, ':')
r.fill(6, 26, 4, 1, '_')                   # ledge beside the lane at x=4-5: a one-way hop home
r.fill(18, 23, 2, 1, '_')                  # ledge beside the lane at x=16-17
r.fill(6, 37, 4, 1, 'f'); r.fill(18, 8, 6, 1, 'f')
r.fill(18, 36, 6, 2, ':'); r.fill(22, 21, 2, 15, ':'); r.fill(24, 26, 2, 6, ','); r.fill(24, 33, 2, 1, 'f')
r.put(16, 41, 's')
L['route1'] = r.rows()
stamps['route1'] = [('house_green', 20, 6, 'farmhouse')]

# ================================================================= Cedarwood City 64x45 — stone city
# Two districts either side of the Cedar River. The old town, where Route 1 comes in: the Gym and the Pokémon
# Center on the main street, houses round a yard. Over the bridges, the market quarter: the Institute, the Mart,
# a fountain plaza, a park to the west and a garden to the east. Route 2 leaves from the top of the hill.
c = M(64, 45)
c.carve(10, 3, 46, 18)                     # the market quarter
c.carve(2, 9, 8, 9)                        # the west park
c.carve(6, 21, 52, 3)                      # the river
c.carve(6, 24, 52, 18)                     # the old town
c.carve(56, 27, 6, 9)                      # the east garden
c.carve(30, 42, 4, 3, '=')                 # south gate (from Route 1)
c.carve(40, 0, 4, 3, '=')                  # north gate (to Route 2)
c.fill(6, 21, 52, 3, '~')                  # the Cedar River
c.fill(18, 21, 2, 3, 'B'); c.fill(44, 21, 2, 3, 'B')    # two bridges
c.fill(30, 30, 2, 12, '=')                 # the avenue up from the south gate
c.fill(7, 30, 55, 2, '=')                  # main street
c.fill(18, 24, 2, 6, '='); c.fill(44, 24, 2, 6, '=')    # up to the bridges
c.fill(3, 12, 52, 2, '=')                  # market street
c.fill(18, 14, 2, 7, '='); c.fill(44, 14, 2, 7, '=')    # down to the bridges
c.fill(40, 3, 2, 9, '=')                   # up to the north gate
c.fill(26, 15, 11, 1, '=')                 # round the fountain
c.fill(26, 19, 11, 1, '=')
c.fill(26, 16, 1, 3, 'f'); c.fill(36, 16, 1, 3, 'f')
c.fill(4, 10, 5, 1, 'f'); c.fill(4, 15, 4, 2, '~')      # the park: flowers and a pond
c.fill(57, 28, 4, 2, 'f'); c.fill(57, 33, 4, 2, 'f'); c.fill(57, 30, 4, 3, ',')   # the garden
c.fill(22, 33, 1, 8, '#'); c.fill(22, 41, 7, 1, '#')    # a fenced yard
c.fill(23, 34, 5, 1, 'f')
c.fill(46, 39, 10, 1, 'f')
c.put(28, 39, 's'); c.put(16, 28, 's'); c.put(38, 14, 's'); c.put(5, 14, 's')
L['cedarwood'] = c.rows()
stamps['cedarwood'] = [('pokecenter', 34, 25, 'cedar_pc'), ('mart', 34, 8, 'cedar_mart'), ('institute', 46, 7, 'institute'),
                       ('gym', 8, 25, 'cedar_gym'), ('house_blue', 48, 15, 'condo'), ('house_purple', 12, 8, 'cedar_house'),
                       ('house_green', 24, 8, 'cedar_house2'), ('house_orange', 23, 35, 'cedar_house3'),
                       ('house_teal', 46, 33, 'cedar_house4'), ('fountain', 30, 16, None)]

# ================================================================= Route 2 36x66 — the deep forest
# Twice the length of Route 1 and a different animal: a long wild-grass run, a ranger's hut half way (heal),
# then the Mosswood — a little maze of forest paths with dead ends worth exploring (one behind a Cut tree) —
# and a hidden pond (Surf) before the road comes out at Lakeshore.
q = M(36, 66)
q.carve(22, 63, 4, 3, ':')                 # south gate (from Cedarwood)
q.carve(18, 54, 10, 9)                     # the first clearing (ledge + lane)
q.carve(6, 54, 12, 3)                      # west along the forest edge
q.carve(6, 39, 6, 15)                      # the long grass: no way round it
q.carve(6, 36, 24, 6)                      # the ranger's clearing
q.carve(26, 21, 4, 15)                     # into the Mosswood
q.carve(14, 21, 12, 3)
q.carve(30, 21, 4, 3)                      # a dead end (east)
q.carve(14, 24, 2, 3)                      # a dead end (south), behind a Cut tree
q.carve(14, 27, 4, 6)
q.carve(10, 12, 4, 12)
q.carve(2, 15, 8, 3)                       # a dead end (west)…
q.carve(0, 15, 2, 3)                       # …with a secret way on to the Berry Forest (a Cut tree at 1,16)
q.carve(14, 12, 12, 3)                     # to the hidden pond
q.carve(18, 3, 12, 9)                      # the pond
q.carve(8, 0, 4, 12, ':')                  # north gate to Lakeshore
q.fill(22, 57, 4, 8, ':'); q.fill(18, 54, 10, 3, ',')
q.fill(18, 57, 8, 1, '_')                  # hop down (the lane at x=26-27 walks back up)
q.fill(6, 54, 12, 2, ':')
q.fill(6, 39, 6, 15, ';'); q.fill(6, 51, 2, 3, ':')
q.fill(6, 36, 24, 2, ':'); q.fill(6, 38, 12, 4, ',')
q.fill(26, 21, 4, 15, ','); q.fill(26, 30, 2, 6, ':')
q.fill(14, 21, 12, 3, ','); q.fill(14, 24, 4, 9, ';'); q.fill(30, 21, 4, 3, ';')
q.fill(10, 12, 4, 12, ','); q.fill(2, 15, 8, 3, ';')
q.fill(14, 12, 12, 3, ','); q.fill(18, 3, 12, 9, '~'); q.fill(18, 9, 12, 3, '.'); q.fill(24, 5, 2, 2, '.')
q.fill(20, 40, 8, 1, 'f')
for x, y in ((0, 15), (1, 15), (0, 17), (1, 17)):
    q.put(x, y, 'r')
q.put(24, 62, 's'); q.put(15, 38, 's')
L['route2'] = q.rows()
stamps['route2'] = [('house_teal', 21, 36, 'ranger_hut')]

# ================================================================= Lakeshore Town 44x36 — the lake village
# The town wraps round its lake: a ring road with the Pokémon Center, the Mart and the Eevee House along the
# north shore, the Day Care to the west, cottages to the east and a dock out onto the water. An islet in the
# middle for when you can Surf.
k = M(44, 36)
k.carve(2, 3, 40, 30)
k.block(2, 3, 6, 3, 'T'); k.block(36, 30, 6, 3, 'T'); k.block(2, 27, 4, 6, 'T')   # woods in the corners
k.carve(8, 33, 4, 3, '=')                  # south gate (from Route 2)
k.carve(30, 0, 4, 3, '=')                  # north gate to Route 3
blob(k, 21, 18, 8, 6, '~')                 # the lake
k.fill(20, 17, 2, 2, '.')                  # its islet
k.fill(8, 8, 28, 2, '='); k.fill(8, 27, 28, 2, '=')     # the ring road
k.fill(8, 8, 2, 21, '='); k.fill(34, 8, 2, 21, '=')
k.fill(30, 3, 2, 5, '='); k.fill(8, 29, 2, 4, '=')
k.fill(20, 22, 2, 5, 'B')                  # the dock
k.fill(12, 30, 6, 1, 'f'); k.fill(24, 30, 8, 1, 'f'); k.fill(36, 25, 5, 1, 'f'); k.fill(3, 7, 4, 1, 'f')
k.fill(3, 22, 4, 3, ',')
k.put(11, 29, 's'); k.put(23, 26, 's')
L['lakeshore'] = k.rows()
stamps['lakeshore'] = [('pokecenter', 12, 3, 'lake_pc'), ('mart', 19, 4, 'lake_mart'), ('house_purple', 24, 4, 'eevee_house'),
                       ('house_orange', 2, 15, 'daycare'), ('house_green', 37, 12, 'lake_house'),
                       ('house_blue', 37, 19, 'lake_house2')]

# ================================================================= Route 3 38x60 — the riverside road
# The Lakeshore River runs the whole length of the route. The road climbs the west side through a meadow, a
# long trail (ledge + lane) and a tall-grass hollow; a bridge crosses to Echo Cave in the east cliff; the far
# bank is Surf-only (items, a fisherman). The way north to Harbor is overgrown — the first time through you
# must take Echo Cave. A side trail west leads to Frostmere Hollow.
v = M(38, 60)
v.carve(30, 57, 4, 3, ':')                 # south gate (from Lakeshore)
v.carve(22, 48, 14, 9)                     # the south meadow
v.carve(4, 48, 18, 3)                      # west along the river flats
v.carve(4, 33, 8, 15)                      # the west trail (ledge + lane)
v.carve(0, 36, 4, 3, ':')                  # west gap: a side trail to Frostmere Hollow
v.carve(4, 24, 20, 9)                      # the tall-grass hollow
v.carve(12, 15, 12, 9)                     # the riverbank road
v.carve(12, 6, 12, 9)                      # the north wood
v.carve(16, 3, 2, 3)                       # the overgrown gap (Cut)
v.carve(16, 0, 4, 3, ':')                  # north gate to Harbor
v.carve(24, 6, 8, 42)                      # the river
v.carve(32, 15, 4, 9)                      # the landing in front of Echo Cave
v.block(32, 12, 4, 3, 'c')                 # the cliff the cave is cut into
v.carve(32, 27, 4, 15)                     # the far bank (Surf only)
v.fill(24, 6, 8, 42, '~')
v.fill(24, 18, 8, 2, 'B')                  # the bridge to the cave
v.fill(22, 48, 14, 9, ','); v.fill(30, 48, 4, 12, ':'); v.fill(22, 48, 8, 2, ':')
v.fill(4, 48, 18, 2, ':')
v.fill(4, 33, 8, 15, ','); v.fill(4, 33, 2, 15, ':')
v.fill(6, 40, 6, 1, '_')                   # hop down the trail (the lane at x=4-5 walks back up)
v.fill(4, 24, 20, 9, ';'); v.fill(4, 24, 10, 2, ':'); v.fill(12, 24, 2, 9, ':')
v.fill(12, 15, 12, 9, '.'); v.fill(12, 18, 12, 2, ':'); v.fill(16, 15, 2, 3, ':')
v.fill(12, 6, 12, 9, ','); v.fill(16, 6, 2, 9, ':')
v.fill(32, 15, 4, 9, 'G')
v.fill(32, 27, 4, 15, '.'); v.fill(33, 36, 2, 3, 'f')
v.put(29, 55, 's'); v.put(6, 35, 's'); v.put(22, 16, 's')
v.put(10, 44, 'r'); v.put(20, 30, 'r'); v.put(35, 52, 'r')
L['route3'] = v.rows()
stamps['route3'] = [('cave_mouth', 33, 14, 'echo_cave')]

# ================================================================= Harbor Town 56x39 — the port
# A real waterfront: the whole east side of town is a quay with the sea beyond it. Piers run out over the
# water, and Team Rocket's warehouse stands on its own jetty. The old mine ladder from Echo Cave comes up in a
# cliff in the south-west corner of town.
hb = M(56, 39)
hb.carve(2, 3, 36, 33)                     # the town
hb.carve(38, 0, 18, 39, '~')               # the sea
hb.carve(8, 0, 4, 3, '=')                  # north gate to Route 4
hb.carve(16, 36, 4, 3, '=')                # south gate (from Route 3)
hb.block(2, 27, 8, 6, 'c')                 # the old mine cliff
hb.fill(34, 3, 2, 33, '=')                 # the waterfront
hb.fill(36, 3, 2, 33, 'B')                 # the quay
hb.fill(3, 12, 31, 2, '=')                 # main street
hb.fill(10, 24, 24, 2, '=')                # dock street
hb.fill(8, 3, 2, 9, '=')                   # up to the north gate
hb.fill(16, 26, 2, 10, '=')                # down to the south gate
hb.fill(22, 14, 2, 10, '=')
hb.fill(5, 33, 11, 1, '=')                 # from the mine ladder
hb.fill(38, 8, 10, 2, 'B')                 # the north pier
hb.fill(38, 18, 8, 2, 'B')                 # the pier out to the warehouse jetty
hb.fill(44, 20, 10, 12, 'G')               # the jetty
hb.fill(38, 32, 6, 2, 'B')                 # the fishing pier
hb.fill(4, 22, 5, 1, 'f'); hb.fill(26, 27, 6, 1, 'f'); hb.fill(10, 29, 5, 3, ',')
hb.fill(24, 30, 8, 1, '#')
rim(hb, right=[(27, 33)])                  # a gap in the rocks past the jetty: Lighthouse Point
hb.put(19, 33, 's'); hb.put(25, 11, 's'); hb.put(47, 28, 's')
hb.put(27, 32, 'r'); hb.put(28, 32, 'r'); hb.put(52, 30, 'r')
L['harbor'] = hb.rows()
stamps['harbor'] = [('pokecenter', 3, 6, 'harbor_pc'), ('mart', 11, 8, 'harbor_mart'),
                    ('gym', 18, 6, 'harbor_gym'), ('house_blue', 27, 7, 'harbor_house'),
                    ('institute', 46, 22, 'warehouse'), ('house_orange', 3, 15, 'harbor_house2'),
                    ('house_teal', 25, 17, 'harbor_house3'), ('cave_mouth', 5, 32, 'echo_cave_b1')]

# ================================================================= Route 4 40x57 — the rocky pass
# A long switchback up to Sunspire: a rocky meadow, an east run through tall grass (a Cut alcove at the end),
# up and back west, then a rock wedged in the only gap north — Rock Smash it (the hiker at the south gate hands
# out TM98). A hiker's cabin in the clearing half way heals you. The upper meadow has a Strength alcove for later.
w4 = M(40, 57)
w4.carve(8, 54, 4, 3, ':')                 # south gate (from Harbor)
w4.carve(4, 45, 14, 9)                     # the rocky meadow
w4.block(12, 48, 4, 3, 'c')                # an outcrop
w4.carve(4, 39, 28, 6)                     # east through the tall grass
w4.carve(32, 39, 4, 3)                     # an alcove behind a Cut tree
w4.carve(26, 27, 8, 12)                    # north
w4.carve(8, 27, 18, 3)                     # and back west
w4.carve(8, 15, 6, 12)                     # the boulder gap
w4.carve(14, 18, 12, 6)                    # the hiker's clearing
w4.carve(8, 6, 24, 9)                      # the upper meadow
w4.block(16, 9, 4, 3, 'c')                 # an outcrop
w4.carve(32, 9, 4, 3)                      # an alcove behind a smashable rock
w4.carve(20, 0, 4, 6, ':')                 # north gate to Sunspire
w4.fill(4, 45, 14, 9, ','); w4.fill(8, 45, 4, 12, ':')
w4.fill(4, 47, 4, 1, '_')                  # hop down toward Harbor (the path beside it walks back up)
w4.fill(4, 39, 28, 6, ';'); w4.fill(4, 39, 28, 2, ':')
w4.fill(26, 27, 8, 12, ','); w4.fill(30, 27, 2, 12, ':')
w4.fill(8, 27, 18, 3, ':')
w4.fill(8, 15, 6, 12, ','); w4.fill(10, 15, 2, 12, ':')
for x in (8, 9, 11, 12, 13):
    w4.put(x, 21, 'r')                     # a rock wall with one gap — and a smashable rock in it
w4.fill(14, 18, 12, 6, '.'); w4.fill(14, 22, 5, 2, ':')
w4.fill(8, 6, 24, 9, ','); w4.fill(20, 6, 4, 3, ':'); w4.fill(8, 12, 8, 3, ';')
w4.put(32, 39, 'r'); w4.put(32, 41, 'r'); w4.put(32, 9, 'r'); w4.put(32, 11, 'r')
w4.fill(26, 36, 4, 1, 'f')
w4.put(13, 52, 's'); w4.put(15, 24 - 1, 's')
L['route4'] = w4.rows()
stamps['route4'] = [('house_gray', 19, 18, 'route4_cabin')]

# ================================================================= Sunspire Town 44x42 — the hill town
# Built up the side of a hill in three terraces, with ramps cut through the rock between them. The bottom
# terrace (from Route 4) has the Pokémon Center and the Mart; the middle one the relay station; the top one
# the Gym, and the road on up the mountain.
sp = M(44, 42)
sp.carve(2, 30, 40, 9)                     # the bottom terrace
sp.carve(4, 15, 36, 12)                    # the middle terrace
sp.carve(6, 3, 32, 9)                      # the top terrace
sp.wall(2, 27, 40, 3, 'c'); sp.wall(2, 12, 40, 3, 'c')   # rock faces between them
sp.carve(20, 27, 4, 3, 'H')                # stairs up to the middle terrace
sp.carve(30, 12, 4, 3, 'H')                # and up to the top
sp.carve(20, 39, 4, 3, '=')                # south gate (from Route 4)
sp.carve(12, 0, 4, 3, '=')                 # north gate to Route 5 (the mountain road)
sp.fill(3, 30, 38, 2, '='); sp.fill(3, 37, 38, 2, '='); sp.fill(20, 32, 2, 5, '=')
sp.fill(5, 24, 34, 2, '='); sp.fill(20, 26, 2, 1, '='); sp.fill(30, 15, 2, 9, '=')
sp.fill(7, 10, 30, 2, '='); sp.fill(12, 3, 2, 7, '=')
sp.fill(5, 16, 10, 2, ','); sp.fill(24, 16, 5, 1, 'f'); sp.fill(34, 16, 5, 1, 'f')
sp.fill(7, 4, 4, 1, 'f'); sp.fill(33, 4, 4, 1, 'f'); sp.fill(32, 33, 8, 1, 'f')
sp.put(18, 31, 's'); sp.put(26, 9, 's'); sp.put(15, 4, 's'); sp.put(18, 26, 's')
L['sunspire'] = sp.rows()
stamps['sunspire'] = [('pokecenter', 6, 32, 'sun_pc'), ('mart', 13, 33, 'sun_mart'),
                      ('gym', 18, 5, 'sun_gym'), ('house_purple', 27, 6, 'sun_house'),
                      ('institute', 8, 19, 'relay_station'), ('house_blue', 24, 20, 'sun_house2'),
                      ('house_green', 34, 20, 'sun_house3'), ('house_orange', 26, 32, 'sun_house4')]

# ================================================================= Route 5 30x72 — the Switchback Trail
# The long one: a mountain climb in four switchbacks with a rest house half way up. The walls are
# grey rock instead of forest, the road turns from dirt to gravel as you gain height, and every
# switchback has a ledge you can hop down on the way home.
r5 = M(30, 72, 'C')
r5.wall(20, 54, 10, 18, 'T'); r5.wall(0, 39, 4, 12, 'T')      # pine belt along the lower slopes
r5.wall(24, 21, 6, 12, 'T')
r5.carve(12, 69, 4, 3, ':')                # south gate (from Sunspire)
r5.carve(8, 63, 12, 6)                     # trailhead clearing
r5.carve(4, 60, 16, 3)                     # west lane
r5.carve(4, 51, 6, 9)                      # first climb, through the grass
r5.carve(4, 48, 20, 3)                     # long traverse east
r5.carve(18, 39, 6, 9)                     # second climb
r5.carve(6, 36, 18, 3)                     # traverse back west
r5.carve(6, 27, 8, 9)                      # rest house plateau
r5.carve(14, 30, 10, 6)                    # camp yard
r5.carve(4, 18, 10, 9)                     # upper tall-grass field
r5.carve(14, 15, 12, 12)                   # tarn meadow (the pond)
r5.carve(6, 12, 10, 3)                     # summit lane
r5.carve(12, 3, 6, 9)                      # final climb, ending under the tunnel mouth
r5.fill(13, 63, 2, 9, ':')                 # the road up from the gate
r5.fill(8, 64, 4, 4, ','); r5.fill(16, 66, 3, 1, 'f')
r5.fill(4, 60, 16, 2, ':')
r5.fill(4, 51, 6, 9, ',')
r5.fill(8, 51, 2, 9, ':')                  # the walking lane beside the first ledge
r5.fill(4, 59, 4, 1, '_')
r5.fill(4, 48, 20, 2, ':')
r5.fill(18, 39, 6, 9, ',')
r5.fill(22, 39, 2, 9, 'G')                 # gravel lane beside the second ledge
r5.fill(18, 47, 4, 1, '_')
r5.fill(6, 36, 18, 2, 'G')                 # above the rest house the road is all gravel
r5.fill(6, 27, 8, 9, 'G')
r5.fill(14, 30, 10, 6, 'G')
r5.fill(20, 30, 4, 6, 'G')
r5.fill(14, 35, 6, 1, '_')
r5.put(15, 33, 'r'); r5.put(22, 31, 'r'); r5.put(16, 30, 'R')
r5.fill(4, 18, 10, 9, ';')                 # upper field: tall grass, tougher Pokémon
r5.fill(10, 18, 4, 9, 'G')
r5.fill(4, 26, 6, 1, '_')
r5.fill(14, 15, 12, 3, 'G'); r5.fill(14, 24, 12, 3, 'G')
r5.fill(14, 18, 12, 6, '~')                # the tarn
r5.fill(20, 20, 2, 2, '.')                 # islet — Surf out for what's on it
r5.fill(24, 18, 2, 6, 'G')
r5.fill(6, 12, 10, 3, 'G')
r5.fill(12, 3, 6, 9, 'G')
r5.put(13, 7, 'R'); r5.put(16, 9, 'R'); r5.put(13, 4, 'r')
r5.put(17, 68, 's'); r5.put(13, 36, 's')
L['route5'] = r5.rows()
stamps['route5'] = [('house_teal', 7, 29, 'trail_house'), ('cave_mouth_grey', 14, 2, 'solara_tunnel')]

# ================================================================= Route 6 34x48 — Dust Basin
# Desert on the far side of the mountain: sand instead of grass, brown rock walls, an oasis at the
# top and a ranger camp half way that will patch your team up.
r6 = M(34, 51, 'c')                        # (the bottom three rows stay rock: the map's edge)
r6.wall(0, 0, 10, 12, 'T'); r6.wall(20, 0, 8, 6, 'T')          # the oasis grove
r6.carve(8, 36, 18, 12)                    # the basin floor, running down to the tunnel
r6.block(14, 42, 4, 3, 'c')                # outcrop with the tunnel mouth in it
r6.carve(4, 33, 22, 3)                     # west track
r6.carve(4, 24, 12, 9)                     # dune field
r6.carve(4, 21, 26, 3)                     # mid track
r6.carve(22, 24, 8, 6)                     # a nook off the track: the Safari Zone gate
r6.carve(22, 12, 8, 9)                     # east canyon
r6.carve(8, 9, 22, 3)                      # north track
r6.carve(8, 0, 14, 9)                      # oasis
r6.carve(18, 0, 4, 3, ':')                 # north gate to Stonewatch
r6.fill(8, 36, 18, 12, 'S')
r6.fill(14, 38, 4, 4, ':'); r6.fill(14, 45, 4, 3, ':')
r6.fill(8, 40, 4, 3, ';'); r6.fill(20, 37, 6, 4, ';')
r6.put(11, 46, 'R'); r6.put(24, 43, 'R'); r6.put(9, 37, 'r')
r6.fill(4, 33, 22, 3, 'S'); r6.fill(4, 33, 22, 2, ':')
r6.fill(4, 24, 12, 9, 'S')
r6.fill(4, 24, 12, 6, ';')                 # deep dunes, thick with wild Pokémon
r6.fill(12, 24, 4, 9, ':')
r6.fill(4, 32, 8, 1, '_')
r6.fill(4, 21, 26, 3, 'S'); r6.fill(4, 21, 26, 2, ':')
r6.fill(22, 12, 8, 9, 'S'); r6.fill(26, 12, 4, 9, ':')
r6.fill(22, 14, 4, 6, ',')
r6.fill(22, 24, 8, 6, 'S')
r6.fill(22, 20, 6, 1, '_')
r6.put(23, 13, 'R'); r6.put(29, 19, 'r')
r6.fill(8, 9, 22, 3, 'S'); r6.fill(8, 9, 22, 2, ':')
r6.fill(8, 0, 14, 9, 'S')
r6.fill(8, 3, 10, 5, '~')                  # the oasis pool
r6.fill(14, 5, 2, 2, '.')
r6.fill(18, 0, 4, 3, ':'); r6.fill(10, 8, 12, 1, ':'); r6.fill(18, 3, 4, 6, ':')
r6.fill(8, 8, 2, 1, 'f')
r6.put(19, 46, 's'); r6.put(9, 21, 's')
L['route6'] = r6.rows()
stamps['route6'] = [('cave_mouth', 14, 44, 'solara_tunnel'), ('cave_mouth', 14, 20, 'sealed_ruins'), ('house_teal', 23, 25, 'safari_gate')]

# ================================================================= Stonewatch City 48x42 — the quarry city
# Cut into the mountainside in three terraces, like the quarry above it. The bottom terrace (from Route 6):
# the Pokémon Center, the Mart and the quarry office. Up the first ramp: the Gym, the fountain square, and the
# road east to Route 7. Up the second: the watchtower and the pit gate.
sw = M(48, 42, 'C')
sw.carve(2, 30, 44, 9)                     # the bottom terrace
sw.carve(2, 15, 44, 12)                    # the middle terrace
sw.carve(4, 3, 36, 9)                      # the top terrace
sw.carve(26, 27, 4, 3, 'H')                # stairs up to the middle terrace
sw.carve(10, 12, 4, 3, 'H')                # and up to the top
sw.carve(10, 0, 4, 3, 'G')                 # north gate to the quarry
sw.carve(18, 39, 4, 3, ':')                # south gate to Route 6
sw.carve(46, 18, 2, 3, 'G')                # east gate to Route 7 (Chapter 6)
sw.fill(3, 30, 42, 2, 'G'); sw.fill(3, 37, 42, 2, 'G'); sw.fill(18, 32, 2, 5, 'G')
sw.fill(3, 24, 42, 2, 'G'); sw.fill(26, 26, 2, 1, 'G'); sw.fill(10, 15, 2, 9, 'G')
sw.fill(40, 18, 6, 3, 'G'); sw.fill(40, 21, 2, 3, 'G')
sw.fill(30, 16, 7, 1, 'G'); sw.fill(30, 20, 7, 1, 'G'); sw.fill(30, 17, 1, 3, 'G'); sw.fill(36, 17, 1, 3, 'G')
sw.fill(10, 3, 4, 9, 'G'); sw.fill(5, 10, 34, 2, 'G')
sw.fill(4, 16, 4, 2, ','); sw.fill(38, 34, 6, 2, ','); sw.fill(22, 4, 8, 1, 'f'); sw.fill(33, 33, 4, 1, 'f')
sw.put(44, 32, 'R'); sw.put(15, 6, 'R'); sw.put(6, 34, 'r')
sw.put(17, 31, 's'); sw.put(24, 23, 's'); sw.put(14, 9, 's'); sw.put(43, 17, 's'); sw.put(25, 26, 's')
L['stonewatch'] = sw.rows()
stamps['stonewatch'] = [('pokecenter', 4, 32, 'stone_pc'), ('mart', 11, 33, 'stone_mart'),
                        ('gym', 18, 17, 'stone_gym'), ('house_purple', 4, 19, 'stone_house'),
                        ('house_blue', 38, 32, 'stone_house2'), ('fountain', 32, 17, None),
                        ('house_orange', 26, 32, 'quarry_office'), ('house_gray', 26, 5, 'stone_tower')]

# ================================================================= Rocket Quarry 30x54 — the open pit
# Chapter 5. Three terraces, each with its own lock: keycard terminals, weighted plates that take
# the boulders you shove onto them, and a relay of shutters. Rocket's own medic bay is half way down.
rq = M(30, 54, 'C')
rq.carve(10, 51, 4, 3, 'G')                # south gate (from Stonewatch)
rq.carve(8, 42, 14, 9)                     # entrance yard — terminals
rq.carve(14, 39, 4, 3)                     # chokepoint north (gate A)
rq.carve(4, 30, 22, 9)                     # second terrace — weighted plates
rq.carve(10, 27, 4, 3)                     # chokepoint north (gate B)
rq.carve(6, 18, 18, 9)                     # third terrace — shutter relay + medic bay
rq.carve(18, 15, 4, 3)                     # chokepoint north (gate C)
rq.carve(8, 6, 14, 9)                      # the pit floor — the boss
rq.carve(12, 3, 6, 3)                      # the drill platform
rq.fill(8, 42, 14, 9, 'G'); rq.fill(14, 39, 4, 3, 'G')
rq.fill(4, 30, 22, 9, 'G'); rq.fill(10, 27, 4, 3, 'G')
rq.fill(6, 18, 18, 9, 'G'); rq.fill(18, 15, 4, 3, 'G')
rq.fill(8, 6, 14, 9, 'G'); rq.fill(12, 3, 6, 3, 'G')
rq.fill(8, 48, 4, 3, ','); rq.fill(4, 36, 6, 3, ','); rq.fill(18, 21, 4, 3, ',')   # scrub growing back in the pit
rq.put(9, 43, 'R'); rq.put(20, 50, 'R'); rq.put(5, 38, 'R'); rq.put(24, 31, 'R')
rq.put(7, 19, 'R'); rq.put(22, 26, 'R'); rq.put(9, 7, 'R'); rq.put(20, 13, 'R')
rq.put(15, 50, 's')
rq.put(10, 45, 's'); rq.put(15, 47, 's'); rq.put(20, 45, 's')    # the three keycard terminals
rq.put(7, 20, 's'); rq.put(12, 25, 's'); rq.put(22, 22, 's')     # scrawled notes with the door code
rq.put(19, 18, 's')                                              # the keypad on the last shutter
L['rocket_quarry'] = rq.rows()
stamps['rocket_quarry'] = [('rocket_hq', 12, 8, None)]

# ================================================================= Mount Solara 34x36 — the tunnel
# A cave we draw ourselves (tileset 6) so the puzzle fits the rock. Three galleries, one per trainer:
# first all three stand on the step plates at once to raise the shutters, then each shoves the boulder
# behind their shutter onto a weight plate. Three weights open the rockfall to the north.
ms = M(34, 36)
ms.carve(14, 33, 6, 3)                     # south entrance (from Route 5)
ms.carve(8, 24, 18, 9)                     # entrance hall
ms.carve(4, 15, 8, 9)                      # west gallery
ms.carve(14, 15, 6, 9)                     # middle gallery
ms.carve(22, 15, 8, 9)                     # east gallery
ms.carve(16, 12, 2, 3)                     # the rockfall gap
ms.carve(8, 3, 18, 9)                      # north hall
ms.carve(14, 0, 6, 3)                      # north exit (to Route 6)
ms.fill(8, 30, 18, 3, ',')                 # rubble across the entrance hall
ms.fill(4, 21, 8, 3, ','); ms.fill(22, 21, 8, 3, ',')
ms.fill(8, 9, 18, 3, ',')
ms.put(10, 26, 'r'); ms.put(23, 27, 'r'); ms.put(11, 6, 'r'); ms.put(22, 5, 'r')
ms.put(5, 22, 'r'); ms.put(28, 22, 'r')
L['mount_solara'] = ms.rows()
stamps['mount_solara'] = []

# ================================================================= Frostmere Hollow 36x33 — a side valley
# No Gym, no story lock: a cold little valley off Route 3 you can wander into from Chapter 2 on. A frozen
# pond, a cabin with a girl who's lost her Eevee, and Frostmere Grotto, where the Ice Rock turns Eevee into
# Glaceon. Snow all over, pines and grey rock.
fm = M(36, 33)
fm.wall(0, 0, 12, 12, 'C'); fm.wall(24, 0, 12, 9, 'C')
fm.carve(32, 18, 4, 3)                     # east gap (from Route 3)
fm.carve(24, 18, 8, 3)                     # the way in
fm.carve(24, 15, 10, 3)                    # pond bank
fm.carve(24, 9, 10, 6)                     # the frozen pond (Surf out to the islet)
fm.carve(12, 12, 12, 12)                   # the snowfield
fm.carve(12, 3, 12, 9)                     # cabin clearing
fm.carve(16, 0, 4, 3)                      # north: the way to the Frozen Falls (a snowdrift until the festival)
fm.carve(2, 12, 10, 6)                     # under the grotto cliff
fm.carve(2, 18, 10, 9)                     # the west hollow
fm.carve(12, 24, 12, 3)                    # back round to the snowfield
fm.fill(24, 9, 10, 6, '~'); fm.fill(30, 11, 2, 2, '.')
fm.fill(14, 14, 8, 6, 'Y'); fm.fill(4, 20, 6, 6, 'y')
fm.fill(12, 24, 6, 3, 'y')
fm.put(10, 13, 'r'); fm.put(3, 26, 'r'); fm.put(22, 25, 'r')
fm.put(26, 17, 's'); fm.put(7, 13, 's')
L['frostmere'] = fm.rows()
stamps['frostmere'] = [('house_gray', 14, 4, 'frostmere_cabin'), ('cave_mouth_grey', 6, 11, 'frostmere_grotto')]

# ================================================================= Frostmere Grotto 24x24 — the Ice Rock
# A small ice cave. Slide across the rink to reach the Ice Rock at the back (and a lost Eevee).
fg = M(24, 24)
fg.carve(10, 21, 4, 3)                     # entrance (from Frostmere)
fg.carve(4, 15, 16, 6)                     # entrance hall
fg.carve(4, 6, 16, 9, 'i')                 # the rink
fg.carve(8, 3, 8, 3)                       # the Ice Rock's nook
fg.fill(4, 15, 16, 2, ',')
for x in (8, 9, 10, 11, 12, 14, 15):
    fg.put(x, 5, 'r')                      # ice boulders across the nook: one way in, at x=13
for x, y in ((13, 12), (4, 8), (14, 9), (9, 11), (17, 7), (7, 13), (18, 11)):
    fg.put(x, y, 'r')
fg.put(11, 4, 'I')
L['frostmere_grotto'] = fg.rows()
stamps['frostmere_grotto'] = []

# ================================================================= Route 7 64x30 — Pinefrost Pass
# Chapter 6, east out of Stonewatch: pine meadows turning to snow. Two roads — the high road along the ridge
# and the low road by the river — with a ledge shortcut between them, a woodcutter's cabin half way (heal),
# and alcoves behind a cut tree, a boulder and smashable rocks.
r7 = M(64, 30)
r7.wall(44, 0, 20, 6, 'C'); r7.wall(0, 24, 14, 6, 'C')
r7.carve(0, 18, 4, 3, ':')                 # west gate (from Stonewatch)
r7.carve(4, 12, 10, 12)                    # trailhead meadow
r7.carve(4, 6, 6, 6)                       # up to the high road
r7.carve(10, 6, 34, 3)                     # the high road
r7.carve(28, 0, 8, 6)                      # woodcutter's clearing (the cabin)
r7.carve(18, 3, 2, 3)                      # alcove behind a cut tree
r7.carve(24, 9, 4, 9)                      # the drop between the roads (ledge + lane)
r7.carve(14, 18, 30, 3)                    # the low road
r7.carve(14, 21, 30, 6)                    # the river
r7.carve(36, 15, 2, 3)                     # alcove behind a boulder
r7.carve(40, 6, 8, 6)                      # high road bends down into the snow
r7.carve(44, 18, 4, 3)                     # low road into the snow
r7.carve(48, 6, 12, 18)                    # the snowfield
r7.carve(56, 3, 4, 3)                      # rock smash pocket
r7.carve(60, 9, 4, 3)                      # east gate to Frostfall
r7.fill(40, 0, 24, 30, 'W')                # snow from here on
r7.fill(0, 18, 4, 3, ':'); r7.fill(4, 18, 10, 2, ':')
r7.fill(4, 12, 10, 6, ','); r7.fill(4, 20, 10, 4, ',')
r7.fill(4, 6, 6, 6, ':'); r7.fill(10, 6, 30, 2, ':')
r7.fill(28, 0, 8, 6, ':')
r7.fill(24, 9, 4, 9, ','); r7.fill(26, 9, 2, 9, ':')
r7.fill(24, 13, 2, 1, '_')                 # hop down to the low road (the lane beside it walks back up)
r7.fill(14, 18, 30, 2, ':')
r7.fill(14, 21, 30, 6, '~'); r7.fill(30, 24, 2, 2, '.')
r7.fill(32, 6, 8, 3, ',')
r7.fill(42, 9, 6, 3, 'y')
r7.fill(50, 12, 8, 9, 'Y'); r7.fill(48, 6, 4, 6, 'y')
r7.put(37, 17, 'r')                        # the boulder's the only way into its alcove
r7.put(58, 5, 'r'); r7.put(59, 5, 'r')
r7.put(4, 17, 's'); r7.put(59, 8, 's'); r7.put(26, 8, 's')
# three rows of forest along the top, so the woodcutter's clearing has a visible edge
L['route7'] = [''.join(c if c in 'TCc' else 'T' for c in r7.rows()[0])] * 3 + r7.rows()
stamps['route7'] = [('house_gray', 30, 4, 'route7_cabin')]

# ================================================================= Frostfall Town 64x27 — the snow town
# A long lodge town strung along the valley under the glacier: one main street from the Route 7 gate in the
# west to the skating pond in the east, houses either side, pines between them, the Glacier Cave in the ice
# cliff above and the road south to the coast.
ff = M(64, 27)
ff.wall(0, 0, 64, 6, 'C')                  # the glacier cliff
ff.carve(0, 9, 4, 3)                       # west gate (from Route 7)
ff.carve(4, 6, 56, 15)                     # the valley
ff.carve(18, 21, 4, 6)                     # south gate to Route 8 (Chapter 7)
ff.block(36, 15, 4, 6, 'T'); ff.block(56, 15, 4, 6, 'T'); ff.block(4, 18, 2, 3, 'T')   # pines
ff.fill(0, 12, 60, 2, 'G'); ff.fill(0, 9, 6, 3, 'G')    # the main street
ff.fill(18, 14, 2, 13, 'G')                # down to the coast road
ff.fill(40, 6, 2, 6, 'G')                  # up to the Glacier Cave
ff.fill(46, 15, 8, 4, '~')                 # the skating pond
ff.fill(8, 20, 6, 1, 'y'); ff.fill(28, 19, 6, 2, 'y'); ff.fill(42, 19, 4, 2, 'y')
ff.carve(60, 12, 4, 3); ff.fill(60, 12, 4, 2, 'G')   # east: the Cycling Road (bikes only)
ff.put(42, 7, 's'); ff.put(5, 14, 's'); ff.put(29, 12 - 1, 's'); ff.put(45, 14, 's')
L['frostfall'] = ff.rows()
stamps['frostfall'] = [('pokecenter', 6, 7, 'frost_pc'), ('mart', 13, 8, 'frost_mart'), ('gym', 22, 6, 'frost_gym'),
                       ('house_teal', 32, 8, 'frost_lodge'), ('house_blue', 8, 15, 'frost_house'),
                       ('house_purple', 50, 8, 'frost_house2'), ('cave_mouth_grey', 40, 5, 'glacier_cave'),
                       ('house_green', 26, 15, 'frost_house3')]

# ================================================================= Glacier Cave 1F 34x36
# Slide across the frozen hall to reach the steps down.
g1 = M(34, 36)
g1.carve(14, 33, 6, 3)                     # south entrance (from Frostfall)
g1.carve(10, 27, 14, 6)                    # entrance hall
g1.carve(4, 12, 26, 15, 'i')               # the frozen hall
g1.carve(14, 6, 6, 6)                      # the landing with the steps down
g1.carve(4, 9, 8, 3)                       # a side ledge off the hall (items)
g1.fill(10, 27, 14, 2, ',')
for x in (14, 15, 17, 18, 19):
    g1.put(x, 11, 'r')                     # boulders along the landing's edge: the way up is at x=16
for x, y in ((16, 20), (12, 22), (4, 15), (10, 16), (9, 13), (22, 13), (27, 18), (20, 24), (25, 12),
             (6, 20), (15, 17), (24, 21), (17, 14), (28, 25), (7, 25), (22, 16), (22, 24),
             (12, 19)):                     # the way back: down from the landing, left into this one, down to the hall
    g1.put(x, y, 'r')
g1.put(16, 7, 'L')
L['glacier_cave'] = g1.rows()
stamps['glacier_cave'] = []

# ================================================================= Glacier Cave B1F 32x33
# Team Rocket's cold-storage lab. The thin-ice field in the middle: only the K tiles hold, and only
# whoever stands on a lookout can see them — they talk the others across.
g2 = M(32, 33)
g2.carve(10, 24, 12, 6)                    # the landing (steps up, the hermit's fire)
g2.carve(8, 15, 16, 9, 'k')                # the thin-ice field
g2.carve(8, 9, 16, 6)                      # the far shore
g2.carve(12, 3, 8, 6)                      # the Rocket lab
g2.put(15, 28, 'L')
g2.put(9, 11, 'I')                         # the glacier's own Ice Rock
PATH = ['....K...........',
        '....K...........',
        '....KKKKKK......',
        '.........K......',
        '...KKKKKKK......',
        '...K............',
        '...KKKKKKKKKK...',
        '............K...',
        '............K...']
for j, row in enumerate(PATH):
    for i, c in enumerate(row):
        if c == 'K':
            g2.put(8 + i, 15 + j, 'K')
L['glacier_cave_b1'] = g2.rows()
stamps['glacier_cave_b1'] = []

# ================================================================= Route 8 40x60 — the Long Descent
# Chapter 7: down from Frostfall's snow, through pine meadows, to the beach and the open sea. The longest
# drop in Solara, with the coastguard lookout half way (heal). The sea at the bottom runs on south into the
# Coral Sea.
r8 = M(40, 60)
r8.wall(34, 0, 6, 39, 'C')                 # sea cliffs down the east side
r8.carve(18, 0, 4, 3)                      # north gate (from Frostfall)
r8.carve(18, 3, 4, 6)                      # down out of town
r8.carve(8, 9, 14, 3)                      # the snowy west lane
r8.carve(8, 12, 6, 9)                      # down through deep snow
r8.carve(8, 21, 24, 3)                     # east along the snow line
r8.carve(26, 24, 6, 15)                    # the meadow run down to the beach (ledge + lane)
r8.carve(10, 27, 16, 9)                    # the lookout clearing
r8.carve(10, 36, 8, 3)                     # a path down from the clearing
r8.carve(4, 39, 32, 12)                    # the beach
r8.carve(0, 51, 40, 9)                     # the sea
r8.fill(0, 0, 40, 21, 'W')                 # snow above the snow line
r8.fill(8, 12, 4, 9, 'Y'); r8.fill(10, 9, 6, 3, 'y')
r8.fill(26, 24, 6, 15, ','); r8.fill(30, 24, 2, 15, ':')
r8.fill(26, 33, 4, 1, '_')                 # hop down toward the beach (the lane beside it climbs back)
r8.fill(10, 27, 16, 9, '.'); r8.fill(18, 31, 6, 4, ','); r8.fill(10, 35, 8, 1, ':'); r8.fill(10, 36, 8, 3, ':')
r8.fill(4, 39, 32, 12, 'S')
r8.fill(6, 41, 6, 4, ';'); r8.fill(24, 42, 8, 4, ';')    # dune grass
r8.fill(0, 51, 40, 9, '~')
r8.fill(20, 51, 2, 5, 'B')                 # the pier
rim(r8, down=[(2, 38)])                    # sea rocks at the sides; south is the Coral Sea
rocks(r8, [(8, 54), (30, 53)])
r8.put(14, 44, 'r'); r8.put(28, 48, 'r'); r8.put(8, 48, 'R')
r8.put(20, 3, 's'); r8.put(24, 27, 's'); r8.put(18, 49, 's')
L['route8'] = r8.rows()
stamps['route8'] = [('house_blue', 12, 28, 'coast_lookout')]

# ================================================================= Coral Sea 40x54 — a sea route
# Chapter 7: Surf south from Route 8's beach. Five screens of open water with swimmers and tubers to battle,
# a sailor on a raft, reefs of sea rock to steer between, Gull Rock, and Shell Island in the middle — a
# camper there patches your team up, and a sea cave is cut into its cliff. A gap in the rocks to the east
# leads to Sandbar Cove.
cs1 = sea(40, 54)
blob(cs1, 28, 10, 3, 2, 'S')               # Gull Rock
cs1.put(29, 9, 'r')
blob(cs1, 8, 22, 2, 1, 'S')                 # the sailor's sandbar
blob(cs1, 25, 31, 9, 7, 'S')               # Shell Island
blob(cs1, 26, 33, 6, 4, '.', only='S')
cs1.block(22, 24, 6, 6, 'C')               # its cliff, with the sea cave at the bottom
cs1.fill(28, 33, 4, 3, ';'); cs1.fill(19, 32, 3, 2, 'f')
cs1.put(20, 35, 'r'); cs1.put(33, 30, 'r')
rocks(cs1, [(10, 8), (18, 14), (20, 15), (33, 18), (4, 29), (35, 42), (12, 26)])
reef(cs1, 45, 2, 16); reef(cs1, 45, 26, 38)   # a reef across the sea: one channel through, past a swimmer
rocks(cs1, [(14, 43), (24, 43)])
rim(cs1, up=[(2, 38)], down=[(2, 38)], right=[(27, 36)], left=[(4, 8)])   # west: the Harbor Strait
cs1.put(21, 36, 's')
L['coral_sea'] = cs1.rows()
stamps['coral_sea'] = [('cave_mouth_grey', 24, 29, 'tidepool_cave')]

# ================================================================= Tidepool Cave 24x27 — Shell Island's sea cave
# A side cave: tide pools you Surf across, a sunken channel, and the treasures the sea washed in.
tp = M(24, 27)
tp.carve(10, 24, 4, 3)                     # entrance (from Shell Island)
tp.carve(4, 15, 16, 9)                     # the tide-pool hall
tp.fill(8, 17, 8, 4, '~')                  # a pool (a swimmer lives in it)
tp.carve(2, 6, 20, 9)                      # the upper gallery
tp.fill(2, 9, 20, 3, '~')                  # the sunken channel: Surf across
tp.carve(8, 3, 8, 3)                       # the back nook
tp.fill(4, 15, 16, 1, ',')
for x, y in ((5, 22), (18, 17), (4, 7), (19, 13), (13, 4), (6, 16)):
    tp.put(x, y, 'r')
L['tidepool_cave'] = tp.rows()
stamps['tidepool_cave'] = []

# ================================================================= Coral Isle 56x48 — the island town
# Surf south across the Coral Sea. Not a square: a main island with the town on it, a wooded headland to
# the north, the Gym on its own islet across a boardwalk, a flowery cove to the south-west and a long pier.
# East across the water: Team Rocket's fort. South: the Cinder Strait.
ci = sea(56, 48)
blob(ci, 22, 25, 14, 11, 'S')              # the main island
blob(ci, 30, 13, 7, 5, 'S')                # the headland
blob(ci, 46, 23, 7, 7, 'S')                # the Gym islet
blob(ci, 14, 37, 6, 4, 'S')                # the south-west cove
blob(ci, 22, 25, 12, 9, '.', only='S')
blob(ci, 46, 23, 5, 5, '.', only='S')
blob(ci, 30, 13, 5, 3, '.', only='S')
ci.block(28, 9, 6, 6, 'T')                 # woods on the headland
boardwalk(ci, 10, 23, 42, 2)               # the harbour street, over the water to the Gym
boardwalk(ci, 22, 14, 2, 30)               # the high street, out to the end of the pier
ci.fill(10, 38, 8, 1, 'f'); ci.fill(12, 36, 4, 1, 'f'); ci.fill(30, 31, 5, 1, 'f')
ci.put(25, 22, 's'); ci.put(21, 33, 's'); ci.put(40, 22, 's'); ci.put(26, 12, 's')
rocks(ci, [(6, 12), (41, 38), (4, 30), (50, 10), (32, 40)])
rim(ci, up=[(10, 46)], down=[(10, 46)], right=[(36, 45)])
L['coral_isle'] = ci.rows()
stamps['coral_isle'] = [('pokecenter', 13, 17, 'coral_pc'), ('mart', 18, 18, 'coral_mart'), ('gym', 43, 18, 'coral_gym'),
                        ('house_orange', 12, 26, 'coral_house'), ('house_teal', 27, 26, 'coral_fishing')]

# ================================================================= Sea fort waters 30x30
ft = sea(30, 30)
ft.fill(10, 9, 12, 12, 'G')                # the fort's rock
ft.fill(8, 15, 2, 3, 'B')                  # the landing stage (Surf up to it)
ft.put(11, 19, 's')
rocks(ft, [(24, 6), (6, 24), (22, 23), (4, 4)])
rim(ft, left=[(9, 18)])
L['sea_fort'] = ft.rows()
stamps['sea_fort'] = [('rocket_hq', 13, 10, 'fort_lower')]

# ================================================================= Sandbar Cove 30x30 — a hidden beach
# A side area: through the gap in the Coral Sea's eastern reef. Sandbars, a beachcomber's hut, and things
# buried in the sand.
sc = sea(30, 30)
sc.block(22, 0, 8, 12, 'C')                # a sea stack
sc.fill(8, 12, 16, 9, 'S')                 # the main sandbar
sc.fill(10, 14, 12, 5, '.')
sc.fill(4, 24, 6, 3, 'S'); sc.fill(20, 23, 6, 4, 'S'); sc.fill(14, 3, 4, 3, 'S')
sc.fill(12, 16, 4, 2, 'f'); sc.fill(8, 20, 16, 1, 'S')
sc.put(16, 19, 's')
rim(sc, left=[(9, 18)])
L['sandbar_cove'] = sc.rows()
stamps['sandbar_cove'] = [('house_green', 17, 13, 'cove_hut'), ('cave_mouth_grey', 22, 11, 'pirate_grotto')]

# ================================================================= Cinder Strait 40x45 — a sea route
# Chapter 8: Surf south from Coral Isle toward the volcano. Dark rock stacks, a sailor on a raft, swimmers,
# and Basalt Isle, whose little cave is warm with lava.
st = sea(40, 45)
blob(st, 12, 19, 7, 6, 'S')                # Basalt Isle
st.block(8, 12, 8, 6, 'c')                 # its cliff, with the cave at the bottom
st.fill(9, 21, 6, 2, ';')
blob(st, 28, 12, 2, 1, 'S')                 # the sailor's sandbar
blob(st, 31, 34, 3, 2, 'S')                # a sandbar
reef(st, 29, 2, 22); reef(st, 29, 28, 38)   # a reef: the channel is by the swimmers
rocks(st, [(22, 6), (34, 20), (6, 38), (16, 40), (20, 14)])
rim(st, up=[(2, 38)], down=[(2, 38)])
st.put(15, 20, 's')
L['cinder_strait'] = st.rows()
stamps['cinder_strait'] = [('cave_mouth', 11, 17, 'basalt_cave')]

# ================================================================= Basalt Cave 24x24 — Basalt Isle's sea cave
# A side cave on a volcanic islet: warm rock, pools of lava and a few rare finds.
bc = M(24, 24)
bc.carve(10, 21, 4, 3)                     # entrance (from Basalt Isle)
bc.carve(4, 12, 16, 9)                     # the hall
bc.carve(2, 3, 20, 9)                      # the back cavern
bc.fill(4, 12, 4, 3, 'l'); bc.fill(16, 15, 4, 3, 'l'); bc.fill(2, 3, 4, 3, 'l'); bc.fill(18, 6, 4, 3, 'l')
bc.fill(8, 13, 8, 2, ',')
for x, y in ((12, 8), (8, 5), (15, 5), (9, 17)):
    bc.put(x, y, 'r')
L['basalt_cave'] = bc.rows()
stamps['basalt_cave'] = []

# ================================================================= Route 9 40x66 — the Cinder Road
# Chapter 8: Surf down the Cinder Strait to a black-sand shore, then up the volcano's flank through ash fields
# (ash falls the whole way — the map is drawn with `ash: true`). The hot-spring inn half way heals you;
# a side trail west leads to Cinder Springs.
r9 = M(40, 66, 'c')
r9.carve(0, 0, 40, 9, '~')                 # the end of the Cinder Strait
r9.carve(4, 9, 32, 6, 'S')                 # black-sand shore
r9.carve(16, 15, 8, 6)                     # up off the beach
r9.carve(4, 21, 20, 3)                     # the west lane
r9.carve(4, 24, 12, 12)                    # the ash field
r9.carve(4, 36, 28, 3)                     # the east lane
r9.carve(24, 27, 12, 9)                    # the hot-spring inn's yard
r9.carve(26, 39, 6, 12)                    # the descent (ledge + lane)
r9.carve(8, 51, 24, 6)                     # the lower field
r9.carve(0, 51, 8, 3)                      # west to Cinder Springs
r9.carve(16, 57, 8, 9)                     # south to Emberpeak
r9.fill(16, 15, 8, 6, 'G'); r9.fill(4, 21, 20, 3, 'G')
r9.fill(4, 24, 12, 12, ';'); r9.fill(14, 24, 2, 12, 'G')
r9.fill(4, 36, 28, 3, 'G'); r9.fill(24, 27, 12, 9, 'G'); r9.fill(32, 30, 4, 3, '~')   # the hot spring
r9.fill(26, 39, 6, 12, 'G'); r9.fill(26, 44, 4, 1, '_')
r9.fill(8, 51, 24, 6, ';'); r9.fill(8, 51, 24, 2, 'G'); r9.fill(0, 51, 8, 3, 'G')
r9.fill(16, 57, 8, 9, 'G')
r9.put(10, 30, 'R'); r9.put(20, 55, 'r'); r9.put(28, 47, 'r'); r9.put(6, 12, 'r'); r9.put(30, 11, 'r')
r9.put(18, 15, 's'); r9.put(24, 36, 's'); r9.put(2, 52, 's')
rim(r9, up=[(2, 38)])
L['route9'] = r9.rows()
stamps['route9'] = [('house_teal', 25, 28, 'hot_spring_inn')]

# ================================================================= Cinder Springs 34x30 — a side valley
# Steam, hot springs and a bathhouse. No Gym, no story lock — just a warm place off the Cinder Road.
cs = M(34, 30, 'c')
cs.carve(26, 12, 8, 3)                     # east gap (from Route 9)
cs.carve(6, 6, 20, 18)                     # the valley
cs.carve(10, 3, 8, 3)                      # the berry terrace
cs.carve(20, 24, 4, 6)                     # south: the way to the Ember Terrace (rubble until the spring is hot)
cs.fill(26, 12, 8, 3, 'G')
cs.fill(7, 13, 8, 7, 'S'); cs.fill(8, 14, 6, 5, '~')      # the big spring
cs.fill(17, 7, 7, 6, 'S'); cs.fill(18, 8, 5, 4, '~')      # the little spring
cs.fill(6, 6, 4, 4, ';'); cs.fill(16, 21, 10, 3, ';')
cs.fill(10, 3, 8, 3, 'f'); cs.fill(12, 4, 4, 1, '.')
cs.put(24, 13, 's')
L['cinder_springs'] = cs.rows()
stamps['cinder_springs'] = [('house_green', 18, 15, 'bathhouse'), ('cave_mouth', 13, 2, 'steam_vents')]

# ================================================================= Emberpeak Town 52x39
# A mining town on the volcano's shoulder, built round the Crag — a great black rock in the middle of town.
# Gravel streets ring it; the Pokémon Center and the Mart sit under the cliff by the Route 9 gate, the Gym is
# on the far side of the Crag, a hot spring steams in the west, and Mount Ember's cave mouth is in the cliff
# above town. Ash falls the whole time.
ep = M(52, 39, 'c')
ep.carve(2, 6, 48, 30)                     # the town
ep.carve(16, 0, 8, 6, 'G')                 # north gate (from Route 9)
ep.block(20, 15, 12, 9, 'c')               # the Crag
ep.fill(2, 6, 48, 30, 'G')
ep.fill(6, 12, 40, 2, ':'); ep.fill(6, 25, 40, 2, ':')     # streets round the Crag
ep.fill(16, 14, 2, 11, ':'); ep.fill(34, 14, 2, 11, ':')
ep.fill(18, 0, 2, 12, ':'); ep.fill(36, 6, 2, 6, ':')
ep.fill(4, 16, 6, 5, '~')                  # the hot spring
ep.carve(50, 24, 2, 3, ':'); ep.fill(46, 25, 6, 2, ':')   # east gate to Route 10 (Chapter 9)
ep.fill(38, 16, 10, 7, ','); ep.fill(6, 33, 10, 1, 'f'); ep.fill(38, 30, 8, 2, 'f')
ep.put(15, 11, 's'); ep.put(35, 7, 's'); ep.put(29, 27, 's'); ep.put(19, 16, 's')
ep.put(12, 22, 'r'); ep.put(47, 9, 'R'); ep.put(33, 33, 'r')
L['emberpeak'] = ep.rows()
stamps['emberpeak'] = [('pokecenter', 4, 7, 'ember_pc'), ('mart', 10, 8, 'ember_mart'), ('gym', 22, 28, 'ember_gym'),
                       ('house_orange', 24, 7, 'ember_house'), ('house_blue', 8, 29, 'ember_house2'),
                       ('cave_mouth', 36, 5, 'mount_ember'), ('house_gray', 40, 8, 'ember_house3')]

# ================================================================= Mount Ember 1F 34x36
# A lava river cuts the cave in two. Shove Strength boulders into it: each one sinks and leaves a rock to
# stand on. Two in the same column makes a crossing. (Pushed boulders roll home when everyone leaves.)
em = M(34, 36)
em.carve(14, 33, 6, 3)                     # entrance (from Emberpeak)
em.carve(6, 24, 22, 9)                     # the south bank
em.carve(6, 18, 22, 6)                     # the river and the north bank's edge
em.carve(6, 6, 22, 12)                     # the north side: a hot spring and the way up
em.fill(6, 21, 22, 2, 'l')                 # the lava river
em.fill(20, 9, 6, 3, 'l')                  # a lava pool
em.fill(8, 9, 4, 3, '~')                   # a hot spring
em.fill(6, 30, 22, 3, ',')
em.put(24, 7, 'L')
em.put(8, 26, 'r'); em.put(25, 29, 'r'); em.put(18, 14, 'r')
L['mount_ember'] = em.rows()
stamps['mount_ember'] = []

# ================================================================= Mount Ember summit 34x30 — the crater
# The mirror puzzle: a shaft of light from the crater wall has to bounce off all three mirrors to reach the
# crystal in the seal. Each mirror belongs to one trainer and only they can turn it.
es = M(34, 30)
es.carve(4, 21, 26, 6)                     # the arrival ledge
es.carve(4, 9, 26, 12)                     # the crater floor
es.carve(12, 3, 10, 6)                     # the sealed chamber
es.fill(16, 13, 6, 4, 'l'); es.fill(6, 15, 6, 4, 'l'); es.fill(26, 12, 4, 6, 'l')
es.fill(4, 21, 26, 2, ',')
es.put(8, 24, 'L')
L['ember_summit'] = es.rows()
stamps['ember_summit'] = []

# ================================================================= Emberpeak Gym 18x24 — inside the volcano
# Rows of flame jets on a shared clock (q fires, then Q). Cross each row while it's quiet.
eg = M(18, 24)
eg.carve(2, 3, 14, 21)
for y in (19, 13, 7):
    eg.fill(2, y, 14, 1, 'q')
for y in (17, 11, 5):
    eg.fill(2, y, 14, 1, 'Q')
for x in range(2, 16):
    if x != 14:
        eg.put(x, 15, 'r')                 # a rock wall with one gap (east)
    if x != 3:
        eg.put(x, 9, 'r')                  # and another (west)
eg.fill(2, 20, 14, 3, ',')
L['ember_gym'] = eg.rows()
stamps['ember_gym'] = []

# ================================================================= Route 10 70x36 — the Skyreach Highway
# Chapter 9: east out of Emberpeak, up onto the highlands. Grey rock and wind-bent grass: a scrub meadow, a
# bridge over the Skyreach Gorge (Surf the river for an islet), a rest lodge on the far bank, a ledge climb, the
# high road (a rock in the way — Rock Smash) and down to the city gate. A secret: a Cut tree on the far bank
# hides the Overlook.
r10 = M(70, 36, 'C')
r10.carve(0, 24, 4, 3, ':')                # west gate (from Emberpeak)
r10.carve(4, 21, 16, 9)                    # the scrub meadow
r10.carve(20, 24, 8, 3)                    # to the bridge
r10.carve(28, 6, 6, 27)                    # the Skyreach Gorge
r10.carve(34, 18, 12, 12)                  # the far bank (the lodge)
r10.carve(46, 24, 10, 6)                   # the Overlook — behind a Cut tree
r10.carve(40, 6, 6, 12)                    # the ledge climb
r10.carve(46, 6, 18, 6)                    # the high road
r10.carve(58, 12, 6, 6)                    # down to the gate
r10.carve(58, 18, 12, 3)                   # east gate to Skyreach City
r10.fill(28, 6, 6, 27, '~'); r10.fill(28, 24, 6, 2, 'B'); r10.fill(30, 12, 2, 2, '.')
r10.fill(4, 21, 16, 9, ';'); r10.fill(4, 24, 24, 2, ':'); r10.fill(12, 26, 2, 4, ':')
r10.fill(34, 18, 12, 12, ','); r10.fill(34, 24, 12, 2, ':'); r10.fill(40, 18, 2, 6, ':')
r10.fill(40, 6, 6, 12, ','); r10.fill(40, 6, 2, 12, ':')
r10.fill(42, 12, 4, 1, '_')                # hop down (the lane at x=40-41 climbs back up)
r10.fill(46, 6, 18, 6, ';'); r10.fill(46, 8, 18, 2, ':')
r10.fill(58, 12, 6, 6, ','); r10.fill(60, 12, 2, 6, ':'); r10.fill(58, 18, 12, 2, ':')
r10.fill(47, 25, 8, 4, '.'); r10.fill(48, 28, 6, 1, 'f')
for y in range(24, 30):
    if y != 27:
        r10.put(46, y, 'r')                # a rock wall — the gap at (46,27) is a Cut tree
for y in range(6, 12):
    if y != 8:
        r10.put(54, y, 'r')                # rocks across the high road — the gap at (54,8) is a smashable rock
r10.put(19, 23, 's'); r10.put(35, 26, 's'); r10.put(62, 21 - 1, 's')
r10.put(8, 28, 'r'); r10.put(17, 22, 'r')
L['route10'] = r10.rows()
stamps['route10'] = [('house_teal', 36, 19, 'route10_lodge')]

# ================================================================= Skyreach City 64x51 — the big city
# Chapter 9. Streets on a grid, three avenues and three cross streets: the Pokémon Center and a Mart by the
# west gate, the Department Store, the Dragon Gym, the Game Corner (Team Rocket's front — the hideout is under
# it), a fountain plaza, a park with a pond, and houses. Route 10 comes in from the west.
sc = M(64, 51)
sc.carve(2, 3, 60, 45)
sc.carve(0, 18, 2, 3, '=')                 # west gate (from Route 10)
sc.carve(32, 0, 2, 3, '=')                 # north gate to Route 11 and Victory Road (Chapter 10)
sc.fill(3, 12, 58, 2, '='); sc.fill(3, 27, 58, 2, '='); sc.fill(3, 40, 58, 2, '=')     # cross streets
sc.fill(16, 3, 2, 45, '='); sc.fill(32, 3, 2, 45, '='); sc.fill(48, 3, 2, 45, '=')     # avenues
sc.fill(0, 19, 16, 2, '=')                 # in from the west gate
sc.fill(4, 14, 6, 4, '~'); sc.fill(4, 22, 8, 2, 'f'); sc.fill(11, 14, 3, 3, ',')         # the park
sc.block(12, 21, 2, 3, 'T')
sc.fill(20, 17, 9, 1, '='); sc.fill(20, 23, 9, 1, '='); sc.fill(20, 18, 1, 5, 'f'); sc.fill(28, 18, 1, 5, 'f')   # the plaza
sc.fill(51, 31, 10, 6, ','); sc.fill(51, 37, 10, 1, 'f')                                 # the green
sc.fill(4, 44, 11, 2, 'f'); sc.fill(19, 44, 12, 2, 'f'); sc.fill(35, 44, 12, 2, 'f')
sc.carve(62, 27, 2, 3, '='); sc.fill(60, 27, 4, 2, '=')   # east: the Cycling Road
sc.put(11, 36, 's'); sc.put(14, 21, 's'); sc.put(30, 11, 's'); sc.put(46, 11, 's'); sc.put(35, 26, 's'); sc.put(3, 17, 's')
L['skyreach'] = sc.rows()
stamps['skyreach'] = [('pokecenter', 5, 6, 'sky_pc'), ('mart', 10, 7, 'sky_mart'), ('institute', 21, 6, 'sky_dept'),
                      ('gym', 37, 6, 'sky_gym'), ('house_purple', 52, 7, 'sky_house1'), ('fountain', 23, 19, None),
                      ('rocket_hq', 37, 20, 'sky_corner'), ('house_blue', 52, 21, 'sky_house2'),
                      ('house_green', 52, 15, 'sky_house3'), ('house_orange', 5, 32, 'sky_house4'),
                      ('house_teal', 21, 33, 'sky_house5'), ('house_gray', 37, 33, 'sky_house6'),
                      ('institute', 53, 32, 'sky_tower')]

# ================================================================= Route 11 30x30 — the Victory Path
# Chapter 10: north out of Skyreach. A short climb to the badge check — two guards at a gap in the fence let
# through only trainers with all eight badges — and Victory Road's mouth in the cliff above.
r11 = M(30, 30, 'C')
r11.carve(14, 27, 2, 3, '=')               # south gate (from Skyreach)
r11.carve(6, 6, 18, 21)                    # the climb
r11.fill(6, 6, 18, 21, ','); r11.fill(14, 6, 2, 21, '=')
r11.fill(6, 21, 6, 6, ';'); r11.fill(18, 21, 6, 6, ';')
r11.fill(6, 17, 7, 1, '#'); r11.fill(17, 17, 7, 1, '#')   # the fence at the badge check (gap at x=13-16)
r11.fill(8, 8, 4, 1, 'f'); r11.fill(18, 8, 4, 1, 'f')
r11.put(11, 26, 's'); r11.put(16, 7, 's')
L['route11'] = r11.rows()
stamps['route11'] = [('cave_mouth_grey', 14, 5, 'victory_road')]

# ================================================================= Victory Road 1F 40x36 — dark
# A long cave (Flash lights it): a rock wall with one gap and a boulder in it (Strength), an underground river
# (Surf), smashable rocks over alcoves, a trainers' camp half way (heal), and steps up to 2F.
v1 = M(40, 36)
v1.carve(18, 33, 4, 3)                     # entrance (from Route 11)
v1.carve(6, 24, 28, 9)                     # the lower hall
v1.carve(34, 24, 4, 3)                     # the trainers' camp (past the boulder)
v1.carve(2, 30, 4, 3)                      # an alcove behind a smashable rock
v1.put(5, 30, 'r'); v1.put(5, 32, 'r')     # (the rock itself is an event at 5,31)
v1.carve(6, 15, 28, 9)                     # the river
v1.carve(6, 6, 28, 9)                      # the upper hall
v1.carve(34, 6, 4, 3)                      # an alcove
v1.fill(6, 18, 28, 3, '~')                 # the underground river: Surf
v1.fill(6, 30, 28, 3, ',')
for x in range(6, 34):
    if x != 20:
        v1.put(x, 28, 'r')                 # a rock wall with one gap — a boulder in it
for x, y in ((10, 9), (25, 12), (14, 22), (28, 16), (9, 25)):
    v1.put(x, y, 'r')
v1.put(30, 7, 'L')                         # steps up to 2F
L['victory_road'] = v1.rows()
stamps['victory_road'] = []

# ================================================================= Victory Road 2F 36x30
# The last climb: a long hall, the east climb (ledge-like switchbacks of rock), the exit to the Pokémon League
# — and, across a still lake behind a sealed rock door, a chamber that only opens for Champions.
v2 = M(36, 30)
v2.carve(2, 21, 32, 6)                     # the arrival hall
v2.carve(28, 3, 6, 18)                     # the east climb
v2.carve(14, 3, 14, 6)                     # the top gallery
v2.carve(8, 0, 4, 3)                       # the way out (daylight — the League)
v2.carve(8, 3, 6, 6)
v2.carve(2, 9, 12, 12)                     # the still lake
v2.fill(2, 12, 12, 9, '~'); v2.fill(4, 15, 4, 3, '.')     # the lake, and the chamber islet in it
v2.fill(2, 21, 32, 2, ',')
for x, y in ((20, 24), (8, 23), (30, 10), (31, 16), (18, 5)):
    v2.put(x, y, 'r')
v2.put(3, 24, 'L')                         # steps down to 1F
L['victory_road_2f'] = v2.rows()
stamps['victory_road_2f'] = []

# ================================================================= Berry Forest 36x33 — a secret side area
# West of Route 2, through a Cut tree at the back of the Mosswood's west dead end. Winding paths, a pond, and
# berry trees everywhere — plus the berry grandma who planted them.
bf = M(36, 33)
bf.carve(32, 15, 4, 3)                     # east gate (the secret way from Route 2)
bf.carve(12, 0, 4, 6)                      # north gate to the Deep Grove
bf.carve(20, 12, 12, 9)                    # the orchard clearing
bf.carve(8, 6, 16, 6)                      # the north path
bf.carve(4, 12, 6, 15)                     # the west run
bf.carve(10, 21, 18, 6)                    # the pond glade
bf.fill(20, 12, 12, 9, ','); bf.fill(20, 15, 16, 2, ':')
bf.fill(8, 6, 16, 6, '.'); bf.fill(8, 8, 16, 2, ':'); bf.fill(12, 0, 4, 6, ':')
bf.fill(4, 12, 6, 15, ';'); bf.fill(4, 12, 2, 15, ':')
bf.fill(10, 21, 18, 6, '.'); bf.fill(14, 22, 6, 3, '~'); bf.fill(22, 23, 5, 1, 'f'); bf.fill(10, 25, 4, 1, 'f')
bf.fill(12, 7, 4, 1, 'f'); bf.fill(26, 13, 4, 1, 'f')
bf.put(31, 18, 's'); bf.put(27, 22, 'r'); bf.put(8, 20, 'r')
L['berry_forest'] = bf.rows()
stamps['berry_forest'] = [('house_green', 17, 7, 'berry_cottage')]

# ================================================================= the Deep Grove 30x30 — north of the Berry Forest
# The berry thief's hideout: a winding grove, a narrow gap where a Snorlax has fallen asleep (Grandma's Poké Flute
# wakes it), and beyond it the old tree shrine — where Celebi appears once you're all Champions.
dg = M(30, 30)
dg.carve(12, 27, 4, 3)                     # south gate (from the Berry Forest)
dg.carve(8, 21, 16, 6)                     # the grove floor
dg.carve(4, 12, 6, 12)                     # the west path
dg.carve(10, 12, 14, 3)                    # to the gap
dg.carve(12, 3, 12, 9)                     # the old tree shrine
dg.fill(12, 27, 4, 3, ':'); dg.fill(8, 21, 16, 6, ','); dg.fill(8, 24, 16, 1, ':')
dg.fill(4, 12, 6, 12, ';'); dg.fill(4, 12, 2, 12, ':')
dg.fill(10, 12, 14, 3, ','); dg.fill(12, 3, 12, 9, '.'); dg.fill(14, 4, 8, 1, 'f'); dg.fill(14, 10, 8, 1, 'f')
for x in range(12, 24):
    if x != 17:
        dg.put(x, 11, 'r')                 # a wall of boulders round the shrine — the gap at (17,11) is where Snorlax sleeps
dg.put(10, 25, 's')
L['deep_grove'] = dg.rows()
stamps['deep_grove'] = []

# ================================================================= Lighthouse Point 30x33 — a secret side area
# Surf through the gap in the sea rocks past Harbor's warehouse jetty. A rocky islet, an old lighthouse keeper's
# cottage (the light went out years ago), a swimmer and a sailor, and the best Dratini fishing in Solara.
lp = sea(30, 33)
blob(lp, 16, 17, 9, 8, 'S')                # the islet
blob(lp, 17, 16, 6, 5, '.', only='S')
lp.block(18, 9, 4, 6, 'C')                 # the old lighthouse rock
lp.fill(11, 22, 2, 3, 'B')                 # the landing stage
rocks(lp, [(4, 4), (24, 6), (6, 26), (22, 28), (24, 2)])
rim(lp, left=[(9, 15)], right=[(16, 20)])   # east: the Harbor Strait
lp.put(14, 23, 's'); lp.put(21, 19, 'r')
L['lighthouse_point'] = lp.rows()
stamps['lighthouse_point'] = [('house_gray', 12, 13, 'lighthouse_cottage'), ('cave_mouth_grey', 19, 14, 'lighthouse_1f')]

# ================================================================= the Sealed Ruins 30x30 — a secret off Route 6
# Behind a smashable rock in the desert cliff. An old hall with a tablet, and three sealed doors — each opens a
# different way: the ROCK door to a Pokémon that can smash rock, the ICE door to an Ice-type leading your team,
# the STEEL door to the weight of a Strength boulder on its seal. Behind each sleeps a Regi.
sr = M(30, 30)
sr.carve(14, 27, 2, 3)                     # entrance (from Route 6)
sr.carve(4, 18, 22, 9)                     # the great hall
sr.carve(4, 9, 2, 9); sr.carve(14, 9, 2, 9); sr.carve(24, 9, 2, 9)    # three passages (each has a sealed door)
sr.carve(2, 3, 8, 6); sr.carve(12, 3, 6, 6); sr.carve(20, 3, 8, 6)    # three chambers
sr.fill(4, 18, 22, 2, ','); sr.fill(12, 22, 6, 3, ',')
for x, y in ((8, 21), (21, 21), (8, 25), (21, 25)):
    sr.put(x, y, 'r')                      # old pillars
L['sealed_ruins'] = sr.rows()
stamps['sealed_ruins'] = []

# ================================================================= the Frozen Falls 36x30 — Frostmere's secret gorge
# North of Frostmere Hollow, through the snowdrift the festival clears. A snowy gorge climbing to a frozen waterfall,
# and the Snow Shrine at the top.
ff2 = M(36, 30, 'C')
ff2.carve(16, 27, 4, 3)                    # south gate (from Frostmere)
ff2.carve(8, 18, 20, 9)                    # the snowfield
ff2.carve(4, 9, 8, 9)                      # the west slope
ff2.carve(12, 9, 16, 3)                    # across to the falls
ff2.carve(12, 3, 16, 6)                    # the shrine terrace
ff2.fill(8, 18, 20, 9, 'Y'); ff2.fill(16, 18, 4, 12, ':'); ff2.fill(4, 9, 8, 9, 'y'); ff2.fill(4, 9, 2, 9, ':')
ff2.fill(12, 9, 16, 3, ':'); ff2.fill(24, 4, 4, 5, '~')     # the frozen falls' pool
ff2.put(10, 22, 'r'); ff2.put(25, 20, 'r'); ff2.put(14, 5, 's')
L['frozen_falls'] = ff2.rows()
stamps['frozen_falls'] = [('house_gray', 16, 4, 'snow_shrine')]

# ================================================================= the Pirate's Grotto 24x24 — Sandbar Cove's sea cave
# In the foot of the sea stack, opened by the bottled map. Tide pools, an old wreck's timbers, and the treasure.
pg = M(24, 24)
pg.carve(10, 21, 4, 3)                     # entrance (from Sandbar Cove)
pg.carve(4, 12, 16, 9)                     # the tide hall
pg.fill(4, 15, 6, 4, '~'); pg.fill(14, 12, 6, 4, '~')
pg.carve(2, 3, 20, 9)                      # the treasure cave
pg.fill(2, 6, 20, 2, '~')                  # a channel to Surf
for x, y in ((6, 4), (17, 4), (12, 9), (8, 19), (16, 19)):
    pg.put(x, y, 'r')
L['pirate_grotto'] = pg.rows()
stamps['pirate_grotto'] = []

# ================================================================= the Steam Vents 24x21 — under Cinder Springs
# The springs' three vents, choked with rockfall. Smash them open and the water runs hot again.
sv = M(24, 21)
sv.carve(10, 18, 4, 3)                     # entrance (from the berry terrace)
sv.carve(2, 9, 20, 9)                      # the vent hall
sv.carve(2, 3, 6, 6); sv.carve(10, 3, 4, 6); sv.carve(16, 3, 6, 6)   # three vent chambers
sv.fill(2, 9, 20, 2, ','); sv.fill(6, 13, 4, 3, 'l'); sv.fill(14, 13, 4, 3, 'l')
L['steam_vents'] = sv.rows()
stamps['steam_vents'] = []

# ================================================================= the Ember Terrace 34x27 — south of Cinder Springs
# A hidden volcanic meadow the rockfall had closed off: warm grass, Ponyta running wild, and a lookout over the sea.
et = M(34, 27, 'c')
et.carve(20, 0, 4, 6)                      # north gate (from Cinder Springs)
et.carve(6, 6, 22, 12)                     # the meadow
et.carve(6, 18, 10, 6)                     # the lookout
et.fill(20, 0, 4, 6, 'G'); et.fill(6, 6, 22, 12, ';'); et.fill(6, 9, 22, 2, 'G'); et.fill(20, 11, 2, 7, 'G')
et.fill(6, 18, 10, 6, 'G'); et.fill(8, 22, 6, 1, 'f')
et.put(12, 20, 's'); et.put(26, 8, 'r'); et.put(9, 15, 'r')
L['ember_terrace'] = et.rows()
stamps['ember_terrace'] = []


# ================================================================================ THE AURORA ARCHIPELAGO
# After the League. A second region, reached by the ferry from Harbor Town: sea and sky, and every island with
# a story that opens the way to the next one (see ROADMAP.md, Part 2). Its own Town Map, rooted at Aurora Harbor.

# ================================================================= Aurora Harbor 40x36 — the arrival town
# A fishing town on the west shore of a bay. The ferry pier juts east; the bay opens onto the Aurora Sea.
ah = M(40, 36, 'T')
ah.carve(2, 3, 26, 30, '.')                # the town
ah.carve(28, 0, 12, 36, '~')               # the bay
ah.fill(24, 3, 4, 30, 'S')                 # the beach
ah.fill(2, 12, 22, 2, '='); ah.fill(2, 24, 22, 2, '=')      # two streets…
ah.fill(12, 3, 2, 30, '=')                 # …and the high street
boardwalk(ah, 24, 18, 12, 2)               # the ferry pier
ah.fill(2, 30, 8, 3, 'f'); ah.fill(20, 3, 4, 2, 'f'); ah.fill(16, 29, 6, 1, 'f')
ah.put(14, 11, 's'); ah.put(22, 17, 's')
rocks(ah, [(30, 8), (34, 28)])
rim(ah, right=[(3, 33)])
L['aurora_harbor'] = ah.rows()
stamps['aurora_harbor'] = [('pokecenter', 4, 6, 'aurora_pc'), ('mart', 16, 7, 'aurora_mart'),
                           ('house_teal', 4, 17, 'chart_room'), ('house_blue', 16, 17, 'harbormaster'),
                           ('house_orange', 4, 26, 'eevee_breeder'), ('house_purple', 16, 26, 'aurora_house')]

# ================================================================= the Aurora Sea 44x42 — between the islands
# Open water with sandbars. East: Sunfall Isle. South: Verdant Isle, past a current too strong to Surf until the
# first chart piece shows the safe channel.
asea = sea(44, 42)
blob(asea, 30, 11, 5, 2, 'S')              # a sandbar with a sailor on it
blob(asea, 12, 30, 4, 2, 'S')
blob(asea, 12, 30, 2, 1, '.', only='S')
rocks(asea, [(20, 8), (22, 8), (8, 18), (34, 30), (36, 30), (26, 22), (18, 34)])
asea.put(12, 29, 's')
rim(asea, up=[(16, 28)], left=[(3, 33)], right=[(12, 25)], down=[(16, 28)])
L['aurora_sea'] = asea.rows()
stamps['aurora_sea'] = []

# ================================================================= Sunfall Isle 40x39 — beaches, dunes and a wreck
# The Aurora Star ran aground here forty years ago; its hull is wedged in the sea cliff on the north shore.
sf = sea(40, 39)
blob(sf, 23, 20, 14, 14, 'S')              # the island
blob(sf, 22, 21, 10, 9, '.', only='S')     # grass inland
sf.block(22, 3, 8, 6, 'c')                 # the sea cliff (the wreck's in there)
sf.block(10, 12, 4, 6, 'T'); sf.block(26, 27, 6, 3, 'T')   # palm groves
sf.block(32, 15, 4, 6, 'c')                # a rocky knoll: the Captain's Cache is in its foot
sf.fill(14, 21, 6, 5, ';'); sf.fill(26, 15, 4, 6, ';'); sf.fill(18, 30, 6, 2, ';')        # the dunes' long grass
blob(sf, 13, 27, 2, 2, '~')                # a rock pool
sf.fill(22, 9, 2, 20, ':')                 # a sandy track from the cliff down the island
sf.put(24, 10, 's'); sf.put(18, 12, 's'); sf.put(35, 21, 's')
rocks(sf, [(6, 6), (34, 34), (4, 30)])
rim(sf, left=[(12, 25)], right=[(14, 24)])
L['sunfall_isle'] = sf.rows()
stamps['sunfall_isle'] = [('cave_mouth', 25, 8, 'wreck_deck'), ('house_green', 15, 13, 'sunfall_hut'),
                          ('cave_mouth', 33, 20, 'captains_cache')]

# ================================================================= The Captain's Cache 22x21 — keys for somebody else
# Marina's grandad's treasure, in the knoll on Sunfall's east shore (a side story). Three sea chests in the hall,
# each with one trainer's name on it — only they can open it — and inside each, a key with a DIFFERENT trainer's
# name: it only turns in their hand. Hand the keys on (face a friend, A → KEY), then the three locked doors up the
# passage open, one for each of you, and the captain's vault is at the top.
cc = M(22, 21)
cc.carve(8, 18, 4, 3)                      # entrance
cc.carve(2, 12, 18, 6)                     # the chest hall
cc.carve(10, 6, 2, 6)                      # the passage: three locked doors
cc.carve(6, 3, 10, 3)                      # the vault
cc.fill(2, 15, 18, 3, ',')
cc.put(4, 12, 'r'); cc.put(7, 12, 'r'); cc.put(15, 12, 'r')   # the three sea chests sit on these
cc.put(2, 17, 'r'); cc.put(19, 16, 'r'); cc.put(11, 3, 'r')   # …and the captain's own chest
L['captains_cache'] = cc.rows()
stamps['captains_cache'] = []

# ================================================================= Verdant Isle 44x48 — jungle, a river, a temple
# In from the north through a narrow channel. Jungle trails, a river with a rope bridge, three lost idols (one
# behind a tree to Cut, one across a lagoon to Surf, one behind a boulder), and the old temple at the south end.
vi = M(44, 48, 'T')
vi.carve(16, 0, 12, 6, '~')                # the channel from the Aurora Sea
vi.carve(8, 6, 28, 9, 'S')                 # the landing beach
vi.fill(12, 6, 20, 2, '~')                 # the bay
vi.carve(18, 12, 8, 30, ':')               # the main trail, all the way south
vi.carve(4, 15, 14, 9, ';')                # the west thicket
vi.carve(26, 15, 14, 9, ';')               # the east thicket
vi.carve(2, 24, 40, 3, '~')                # the river
vi.fill(18, 24, 8, 3, 'B')                 # the rope bridge
vi.carve(2, 27, 8, 6, '.')                 # idol glade (behind the Cut tree)
vi.carve(10, 27, 8, 3, ':')                # the path to the glade
vi.carve(28, 27, 14, 9, '~')               # the lagoon…
vi.carve(36, 36, 6, 12, '~')               # …and its channel south to the sea (a current until the Frostpeak chart piece)
vi.fill(34, 30, 6, 3, 'S')                 # …with an islet (the second idol)
vi.carve(4, 33, 14, 3, ';')                # the south-west thicket
vi.carve(4, 39, 6, 3, '.')                 # the boulder nook (the third idol)
vi.block(18, 36, 8, 6, 'C')                # the temple rock
vi.carve(12, 42, 20, 3, 'G')               # the temple court
vi.carve(10, 39, 8, 3, ';')                # the way from the court to the nook (boulders)
vi.carve(26, 33, 6, 3, ':'); vi.carve(26, 36, 6, 6, ':')   # round the temple rock to the court
vi.fill(19, 13, 6, 1, 'f'); vi.fill(13, 43, 3, 1, 'f'); vi.fill(28, 43, 3, 1, 'f')
vi.block(4, 15, 4, 6, 'c')                 # a rocky outcrop in the west thicket, tangled with roots…
vi.put(24, 13, 's'); vi.put(17, 43, 's'); vi.put(8, 21, 's')
L['verdant_isle'] = vi.rows()
stamps['verdant_isle'] = [('house_green', 30, 8, 'ranger_station'), ('cave_mouth_grey', 21, 41, 'verdant_temple'),
                          ('cave_mouth', 5, 20, 'root_hollow')]   # …and the Trial of Roots in its foot

# ================================================================= Root Hollow 24x21 + Root Depths 24x21 — the Trial of Roots
# Verdant Isle's ranger trial (per player). The hall is scattered with leaf piles; some hide trapdoors down to the
# dark Root Depths, landing you at the same spot below. The Depths are four walled-off pockets, each with steps
# back up — and only one of them climbs to the Heartwood. Once you've fallen through a pile you see it as a hole.
rh = M(24, 21)
rh.carve(10, 18, 4, 3)                     # entrance (from the thicket)
rh.carve(2, 9, 20, 9)                      # the root hall
rh.carve(8, 3, 8, 3)                       # the Heartwood (only up from the Depths)
rh.carve(18, 3, 4, 3)                      # a root nook (only up from the Depths)
rh.fill(2, 9, 20, 3, ',')
rh.put(15, 4, 'L'); rh.put(21, 3, 'L')     # steps down from the Heartwood and the nook
for x, y in ((3, 13), (20, 14), (9, 10), (17, 10), (7, 17), (16, 17)):
    rh.put(x, y, 'r')
L['root_hollow'] = rh.rows()
stamps['root_hollow'] = []

rd = M(24, 21)
rd.carve(2, 9, 6, 9)                       # west pocket (a dead end: steps back up)
rd.carve(10, 3, 6, 9)                      # north pocket: steps up to the Heartwood
rd.carve(10, 15, 6, 3)                     # south pocket (a dead end)
rd.carve(18, 9, 4, 9)                      # east pocket: steps up to the root nook
rd.fill(10, 3, 6, 3, ',')
rd.put(2, 16, 'L'); rd.put(12, 3, 'L'); rd.put(10, 10, 'L'); rd.put(15, 16, 'L'); rd.put(21, 16, 'L'); rd.put(20, 9, 'L')
for x, y in ((6, 10), (14, 6), (20, 13)):
    rd.put(x, y, 'r')
L['root_depths'] = rd.rows()
stamps['root_depths'] = []


# ================================================================= Stormwatch 40x45 — windy cliffs and a weather station
# North of the Aurora Sea, through the current the Verdant chart piece shows. A cove and a beach at the bottom,
# two cliff paths up (west: long, with ledges and a lane; east: short and steep), and the weather station on
# the windswept plateau at the top. It rains here until the storm is calmed.
sw = M(40, 45, 'C')
sw.carve(16, 36, 12, 9, '~')               # the cove, from the Aurora Sea
sw.carve(10, 30, 22, 6, 'S')               # the beach
sw.carve(4, 18, 6, 15, 'G')                # the west cliff path…
sw.carve(32, 12, 4, 21, 'G')               # …and the east one
sw.carve(4, 3, 32, 15, '.')                # the plateau
sw.fill(4, 12, 10, 6, ';'); sw.fill(24, 12, 8, 6, ';'); sw.fill(6, 3, 8, 3, 'y')
sw.fill(16, 9, 8, 9, 'G')                  # the station yard
sw.fill(4, 24, 4, 1, '_')                  # a ledge down the west path (the lane beside it is x 8–9)
sw.put(15, 10, 's'); sw.put(12, 31, 's'); sw.put(26, 14, 'r'); sw.put(8, 7, 'r')
sw.carve(18, 0, 4, 3, 'G')                 # north: the old trail to Frostpeak (rubble until the chart shows it)
L['stormwatch'] = sw.rows()
stamps['stormwatch'] = [('institute', 16, 4, 'weather_1f'), ('house_gray', 22, 30, 'storm_hut')]


# ================================================================= Frostpeak Isle 40x51 — snow, a hamlet, the Bell Tower
# Over the old trail north of Stormwatch. A snowfield with a hamlet at the bottom, a rocky terrace (a ramp up the
# west side, a ledge down the east), and the domed Bell Tower on the summit plaza.
fp = M(40, 51, 'C')
fp.carve(18, 45, 4, 6, 'W')                # the trail from Stormwatch
fp.carve(6, 36, 28, 9, 'W')                # the snowfield
fp.fill(8, 39, 8, 5, 'Y'); fp.fill(24, 38, 8, 4, 'Y')
fp.carve(6, 33, 4, 3, 'W')                 # the west ramp up
fp.carve(28, 33, 4, 3, 'W'); fp.fill(28, 33, 4, 1, '_')    # the east ledge down (the ramp is the way up)
fp.carve(6, 24, 28, 9, 'W')                # the terrace
fp.fill(12, 26, 10, 4, 'Y'); fp.fill(26, 25, 6, 3, 'y')
fp.carve(30, 21, 4, 3, 'W')                # the stair to the summit
fp.carve(8, 3, 24, 18, 'W')                # the summit
fp.fill(8, 3, 6, 9, 'y'); fp.fill(26, 3, 6, 9, 'y')
fp.carve(0, 27, 6, 3, 'W')                 # west: Gale Ridge (a side area)
fp.put(15, 18, 's'); fp.put(20, 42, 's'); fp.put(10, 28, 'r'); fp.put(31, 30, 'r'); fp.put(9, 16, 'r'); fp.put(7, 26, 's')
L['frostpeak'] = fp.rows()
stamps['frostpeak'] = [('dome_tower', 16, 4, 'bell_1f'), ('house_gray', 10, 37, 'frost_hut'), ('house_blue', 26, 37, 'frost_house')]

# ================================================================= Harbor Strait 56x24 — a sea route across the inner sea
# East from Lighthouse Point to the Coral Sea: the shortcut between the west of Solara and the islands. A band of
# rapids runs across the middle; only a Pokémon that can use Waterfall (HM05, the Volcano Badge) swims through it.
hs = sea(56, 24)
blob(hs, 16, 8, 3, 2, 'S'); hs.put(16, 7, 'r')      # Tern Rock
blob(hs, 44, 15, 4, 3, 'S')                        # Kelp Islet
blob(hs, 44, 15, 2, 1, '.', only='S')
rocks(hs, [(8, 16), (24, 4), (26, 16), (50, 6), (6, 4)])
reef(hs, 20, 20, 34)
rim(hs, left=[(8, 12)], right=[(14, 18)])
hs.put(42, 14, 's')
L['harbor_strait'] = hs.rows()
stamps['harbor_strait'] = []

# ================================================================= Cycling Road 24x90 — Frostfall to Skyreach, bikes only
# The long road down Solara's east coast: from Frostfall's snowfields, through pine forest and highland meadows, to
# the east gate of Skyreach. Gatekeepers at both ends turn back anyone who isn't on a Bicycle. A rest hut half way.
cr = M(24, 90, 'T')
cr.carve(0, 3, 10, 3, 'W')                 # in from Frostfall
cr.carve(8, 3, 8, 24, 'W')                 # the snowy top stretch
cr.carve(4, 27, 16, 6)                     # the first bend
cr.carve(4, 33, 8, 24)                     # the long straight through the pines
cr.carve(4, 57, 16, 6)                     # the rest hut bend
cr.carve(12, 63, 8, 21)                    # the last straight
cr.carve(0, 84, 20, 3)                     # out to Skyreach's east gate
cr.fill(0, 4, 13, 1, ':'); cr.fill(12, 4, 2, 26, ':')              # the road
cr.fill(6, 29, 8, 1, ':'); cr.fill(6, 29, 2, 34, ':')
cr.fill(6, 62, 10, 1, ':'); cr.fill(14, 62, 2, 24, ':'); cr.fill(0, 85, 16, 1, ':')
cr.fill(8, 8, 3, 9, 'y'); cr.fill(8, 36, 3, 18, ';'); cr.fill(16, 66, 3, 15, ';'); cr.fill(14, 28, 5, 2, 'f')
cr.put(11, 6, 's'); cr.put(3, 84, 's')
L['cycling_road'] = cr.rows()
stamps['cycling_road'] = [('house_gray', 9, 57, 'cycling_hut')]

# ================================================================= Rainbow Falls 30x30 — above Route 3's river
# A side area you can only reach by climbing the waterfall at the head of Route 3's river (HM05 Waterfall + the
# Volcano Badge) — you pass the falls early and come back for them late. A basin of meadows round a still lake
# with a mossy islet; the pool at the bottom spills back over the falls.
rf = M(30, 30, 'C')
rf.carve(10, 21, 10, 6, '~')               # the pool at the top of the falls (you arrive here)
rf.carve(4, 12, 22, 9, '.')                # the basin meadow
rf.carve(6, 3, 18, 9, '.')                 # the upper terrace
rf.fill(8, 4, 14, 6, '~')                  # the still lake…
rf.fill(14, 6, 2, 2, '.')                  # …and its islet
rf.fill(4, 12, 6, 6, ';'); rf.fill(20, 12, 6, 6, ';'); rf.fill(10, 18, 10, 2, 'f')
rf.put(12, 13, 's'); rf.put(9, 15, 'r'); rf.put(21, 19, 'r')
L['rainbow_falls'] = rf.rows()
stamps['rainbow_falls'] = []

# ================================================================= Gorge Headwaters 30x30 — above Route 10's gorge
# The spring the Route 10 gorge river rises from, up its waterfall (HM05). Grey rock, a clear spring, an old shrine
# stone — and, once you're Champion, the colt who guards it.
gh = M(30, 30, 'C')
gh.carve(10, 21, 10, 6, '~')               # the pool at the top of the falls (you arrive here)
gh.carve(4, 12, 22, 9, 'G')                # the gravel shelf
gh.carve(8, 3, 14, 9, 'G')                 # the spring hollow
gh.fill(12, 4, 6, 4, '~')                  # the spring
gh.fill(4, 15, 4, 3, ';'); gh.fill(22, 15, 4, 3, ';')
gh.put(14, 10, 's'); gh.put(6, 13, 'r'); gh.put(23, 13, 'r'); gh.put(10, 9, 'r')
L['gorge_headwaters'] = gh.rows()
stamps['gorge_headwaters'] = []

# ================================================================= Gale Ridge 24x36 — the human windbreak
# West off Frostpeak's terrace (a side area). A narrow path up a ridge, with the sea wind howling through two
# cracks in the cliff on its west side. Anyone who stops in a gust is blown back down — unless a friend is
# standing in the crack (or just in front of it) as a windbreak. Two cracks, three trainers: two hold the
# cracks, the third reaches the old snow-fence winch at the top, which stops the gusts for good.
# Each crack is an L: the gust row, and a nook below it you reach from the sheltered path.
gr = M(24, 36, 'C')
gr.carve(12, 27, 12, 3, 'W')               # the way in, from Frostpeak
gr.carve(6, 24, 8, 9, 'W')                 # the foot of the ridge
gr.carve(8, 6, 2, 18, 'W')                 # the ridge path (x 8-9)
gr.carve(6, 21, 2, 3, 'W')                 # the lower crack: gust row 21, nook (7, 22)
gr.put(6, 22, 'r'); gr.put(6, 23, 'r'); gr.put(7, 23, 'r')
gr.carve(6, 12, 2, 3, 'W')                 # the upper crack: gust row 12, nook (7, 13)
gr.put(6, 13, 'r'); gr.put(6, 14, 'r'); gr.put(7, 14, 'r')
gr.carve(6, 3, 12, 3, 'W')                 # the top: the winch, and the grotto in the cliff
gr.fill(8, 25, 4, 6, 'y'); gr.fill(14, 3, 4, 3, 'y')
gr.put(12, 25, 's'); gr.put(12, 32, 'r')
L['gale_ridge'] = gr.rows()
stamps['gale_ridge'] = [('cave_mouth_grey', 14, 2, 'rime_grotto')]

# ================================================================= Rime Grotto 20x18 — the second Ice Rock
# At the top of Gale Ridge. A still, frozen cave (no sliding — the ridge was the puzzle), with Frostpeak's
# Ice Rock at the back. Yuki is stuck in here until the gusts stop.
rg = M(20, 18)
rg.carve(8, 15, 4, 3)                      # entrance
rg.carve(2, 9, 16, 6)                      # the hall
rg.carve(4, 3, 12, 6)                      # the Ice Rock's chamber
rg.fill(2, 12, 16, 3, ',')
for x, y in ((3, 10), (16, 13), (5, 4), (14, 7), (12, 10)):
    rg.put(x, y, 'r')
rg.put(9, 4, 'I')
L['rime_grotto'] = rg.rows()
stamps['rime_grotto'] = []


# ================================================================= Ember Reef 44x45 — a volcanic reef
# South of Verdant Isle, down the lagoon's channel. A black-sand island round a smoking cone, hot springs, the old
# diver's hut, and the cave into the reef's heart.
er = sea(44, 45)
blob(er, 22, 25, 14, 11, 'S')              # the island
blob(er, 22, 25, 10, 8, 'G', only='S')     # ash and gravel inland
er.block(18, 12, 8, 9, 'c')                # the cone
blob(er, 32, 30, 3, 2, '~', only='SG'); blob(er, 12, 31, 2, 2, '~', only='SG')   # hot springs
er.fill(14, 22, 4, 3, ';'); er.fill(26, 22, 6, 3, ';')
er.put(20, 22, 's'); er.put(9, 25, 's')
rocks(er, [(6, 8), (8, 8), (34, 12), (36, 40), (4, 36), (26, 40)])
reef(er, 6, 20, 30)
rim(er, up=[(36, 42)])
L['ember_reef'] = er.rows()
stamps['ember_reef'] = [('cave_mouth', 21, 20, 'ember_cave'), ('house_teal', 10, 24, 'diver_hut')]

# ================================================================= Ember Cave 24x27 — the reef's heart
# A lava lake with a basalt shelf across it, and six stone turnstiles in the gaps. (The shelf was found by a
# search that proves it can be crossed and that it needs the turnstiles; see ember_cave in index.js.)
ec = M(24, 27)
ec.carve(10, 24, 4, 3)                     # the way in
ec.carve(4, 18, 16, 6)                     # the antechamber
ec.carve(4, 9, 16, 9)                      # the lava lake
ec.carve(4, 3, 16, 6)                      # the heart
ec.fill(4, 9, 1, 9, 'l'); ec.fill(18, 9, 2, 9, 'l')
FIELD = ['.............', '.l........a..', 'lllllaPalaPal', '......a....l.', 'laPalaPalllll', '...l.....l..l', 'laPalllllaPal', '..a..l..l..l.', '.............']
for j, row in enumerate(FIELD):
    for i, c in enumerate(row):
        ec.put(5 + i, 9 + j, 'l' if c == 'l' else '.')
ec.fill(6, 20, 3, 2, 'l'); ec.fill(15, 21, 3, 2, 'l'); ec.fill(5, 4, 3, 2, 'l'); ec.fill(16, 4, 3, 2, 'l')
ec.put(11, 4, 'r'); ec.put(6, 19, ',')
L['ember_cave'] = ec.rows()
stamps['ember_cave'] = []


# ================================================================= the Ruin Shoals 40x36 — east of Sunfall
# Open sea over the Sunken Ruins: a ring of reef round a patch of dark, deep water (Dive there), and the way east
# to the Whirlpool Trench.
rs = sea(40, 36)
reef(rs, 11, 14, 26); reef(rs, 21, 14, 26)
rocks(rs, [(14, 13), (14, 15), (24, 13), (24, 17)])
blob(rs, 30, 28, 3, 2, 'S'); rs.put(30, 27, 's')
rocks(rs, [(6, 6), (32, 6), (6, 28), (22, 30)])
rim(rs, left=[(14, 24)], right=[(14, 24)])
L['ruin_shoals'] = rs.rows()
stamps['ruin_shoals'] = []

# ================================================================= the Whirlpool Trench 36x36 — the end of the chart
# Whirlpools all round (drawn by the game over sea rocks), and a deep blue hole in the middle.
wt = sea(36, 36)
for x, y in ((8, 8), (26, 8), (8, 26), (26, 26), (16, 6), (6, 16), (26, 16), (16, 26), (12, 12), (22, 12), (12, 22), (22, 22)):
    rocks(wt, [(x, y)])
rim(wt, left=[(14, 24)])
L['whirlpool_trench'] = wt.rows()
stamps['whirlpool_trench'] = []

# ================================================================= under the sea (caves drawn with the underwater look)
sb = M(30, 27)                              # the seabed over the Sunken Ruins
sb.carve(4, 9, 22, 15)
sb.carve(12, 3, 6, 6)                       # the ruins' door, to the north
sb.fill(6, 11, 4, 3, ','); sb.fill(20, 17, 4, 4, ','); sb.fill(8, 19, 5, 2, ',')
sb.put(13, 3, 'L'); sb.put(14, 3, 'L'); sb.put(15, 3, 'L'); sb.put(16, 3, 'L')
for x, y in ((6, 16), (22, 11), (17, 21), (10, 13)):
    sb.put(x, y, 'r')
L['ruins_seabed'] = sb.rows()
stamps['ruins_seabed'] = []

ll = M(24, 21)                              # Lugia's hollow, at the bottom of the trench
ll.carve(2, 3, 20, 15)
ll.fill(4, 5, 4, 3, ','); ll.fill(16, 13, 4, 3, ',')
ll.put(5, 14, 'r'); ll.put(18, 6, 'r')
L['lugia_lair'] = ll.rows()
stamps['lugia_lair'] = []

for key, rows in L.items():
    assert len(rows) % BAND == 0, (key, 'height must be a multiple of 3')
    assert len(rows[0]) % 2 == 0, (key, 'width must be even')
    for y, row in enumerate(rows):
        assert len(row) == len(rows[0]), (key, y, len(row))
    check_stamps(key, rows, stamps[key])

NL = chr(10)
with open(sys.argv[1], 'w', encoding='utf8') as f:
    out = ['// Map layouts for the Solara region. Legend and design rules live in tools/mapgen.py.',
           '// Generated by tools/mapgen.py — regenerate after editing, then run the two linters.', '']
    for key, rows in L.items():
        out.append('export const %s = {' % key.upper())
        out.append('  ascii: [')
        for y, row in enumerate(rows):
            out.append("    '%s', // %d" % (row, y))
        out.append('  ],')
        out.append('  stamps: [')
        for st in stamps[key]:
            to = (", to: '%s'" % st[3]) if st[3] else ''
            out.append("    { s: '%s', x: %d, y: %d%s }," % (st[0], st[1], st[2], to))
        out.append('  ],')
        out.append('};')
        out.append('')
    f.write(NL.join(out))
print('wrote', sys.argv[1], '-', len(L), 'maps')
