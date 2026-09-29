# Renders a slice of a tileset with each tile's ID, passability and priority printed on it.
# This is how you find tile IDs for the track, the farm and the trophy room — never guess them.
#   python tools/sheet.py <tilesetId> <firstId> <lastId> <out.png>          one tile per cell, labelled
#   python tools/sheet.py <tilesetId> <firstId> <lastId> <out.png> --strip  the raw sheet, 2x, row IDs only
#
# Tileset IDs: 1 Outside, 3 Inside, 4 Poké Center, 5 Mart, 6 Caves, 14 Gyms … (assets/data/tilesets.json).
# Tile IDs 384+ are plain tiles (id-384 indexes the sheet, 8 per row); 48..383 are autotile slots.
# The label reads "<id> X p2" = impassable, priority 2 (drawn above the player); "o p0" = walkable ground.
import json
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
A = os.path.join(ROOT, 'assets')


def load(tsid):
    ts = [t for t in json.load(open(os.path.join(A, 'data', 'tilesets.json'), encoding='utf8')) if t['id'] == tsid][0]
    im = Image.open(os.path.join(A, ts['image'])).convert('RGBA')
    return ts, Image.alpha_composite(Image.new('RGBA', im.size, (40, 40, 60, 255)), im).convert('RGB')


def strip(tsid, lo, hi, out):
    """The tiles as they sit on the sheet, so multi-tile objects (cliffs, buildings) read properly."""
    ts, im = load(tsid)
    r0, r1 = (lo - 384) // 8, (hi - 384) // 8 + 1
    c = im.crop((0, r0 * 32, 256, r1 * 32)).resize((512, (r1 - r0) * 64), Image.NEAREST)
    d = ImageDraw.Draw(c)
    for r in range(r1 - r0):
        d.text((2, r * 64 + 2), str(384 + (r0 + r) * 8), fill=(255, 255, 0))
    c.save(out)
    print(out, c.size)


def grid(tsid, lo, hi, out):
    """One tile per cell with its ID and flags — for picking a single tile."""
    ts, im = load(tsid)
    cols, cell = 8, 56
    rows = (hi - lo + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell, rows * cell + 16), (30, 30, 40))
    d = ImageDraw.Draw(sheet)
    for n in range(lo, hi):
        i = n - 384
        if i < 0:
            continue
        src = im.crop(((i % 8) * 32, (i // 8) * 32, (i % 8) * 32 + 32, (i // 8) * 32 + 32))
        k = n - lo
        x, y = (k % cols) * cell, (k // cols) * cell
        sheet.paste(src, (x + 12, y + 2))
        pas, pri = ts['passages'][n] or 0, ts['priorities'][n] or 0
        tag = ts['terrainTags'][n] or 0
        d.text((x + 1, y + 36), '%d' % n, fill=(255, 255, 120))
        d.text((x + 28, y + 36), '%s p%d t%d' % ('X' if (pas & 0x0F) == 0x0F else 'o', pri, tag), fill=(160, 220, 255))
    sheet.save(out)
    print(out, sheet.size)


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) < 4:
        print(__doc__ or 'usage: python tools/sheet.py <tilesetId> <firstId> <lastId> <out.png> [--strip]')
        sys.exit(1)
    (strip if '--strip' in a else grid)(int(a[0]), int(a[1]), int(a[2]), a[3])
