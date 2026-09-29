"""Contact sheets of the move-animation cel sheets (assets/effects/anims/*.png, 192x192 cells), each cell shrunk and
numbered, several sheets per image — for picking frames for effects (see reference/battle/anims.js).
  python tools/anim-sheets.py OUTDIR [cell_px=56] [sheets_per_image=8]"""
import os, sys
from PIL import Image, ImageDraw
D = 'assets/effects/anims'
out = sys.argv[1]; px = int(sys.argv[2]) if len(sys.argv) > 2 else 56; per = int(sys.argv[3]) if len(sys.argv) > 3 else 8
os.makedirs(out, exist_ok=True)
files = sorted(f for f in os.listdir(D) if f.endswith('.png'))
for page in range(0, len(files), per):
    group = files[page:page + per]
    rows = []
    for f in group:
        im = Image.open(os.path.join(D, f)).convert('RGBA')
        cols, rws = im.width // 192, im.height // 192
        cells = [im.crop(((i % cols) * 192, (i // cols) * 192, (i % cols) * 192 + 192, (i // cols) * 192 + 192)).resize((px, px)) for i in range(cols * rws)]
        rows.append((f, cells))
    width = 170 + max(len(c) for _, c in rows) * (px + 2)
    sheet = Image.new('RGBA', (width, len(rows) * (px + 14)), (60, 60, 70, 255))
    g = ImageDraw.Draw(sheet)
    for r, (f, cells) in enumerate(rows):
        y = r * (px + 14)
        g.text((4, y + px // 2), f[:26], fill=(255, 255, 255, 255))
        for i, c in enumerate(cells):
            x = 170 + i * (px + 2)
            sheet.paste((90, 90, 104, 255), (x, y, x + px, y + px))
            sheet.alpha_composite(c, (x, y))
            g.text((x + 2, y + px), str(i), fill=(255, 230, 120, 255))
    sheet.save(os.path.join(out, 'anims_%02d.png' % (page // per)))
    print('anims_%02d.png' % (page // per), ', '.join(group))
