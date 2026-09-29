"""Copy the assets this game uses out of ../pokemon-adventure. (Already done — the game doesn't need the adventure
project to run or build. Rerun this only to pull in something more.)

    python tools/import-assets.py            # copy (skips files that are already here and unchanged)
    python tools/import-assets.py --list     # just print what would be copied

The manifest below is the single record of what we took and why. Want something else from the adventure
game? Add a line here and rerun; don't copy by hand. Source layout: ../pokemon-adventure/dist/assests/
(sic - that folder name has a typo; ours is plain `assets/`).

A source ending in '/' copies that whole folder tree (keeping subfolders); anything else is a glob.
"""
import glob, json, os, shutil, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, '..', 'pokemon-adventure', 'dist', 'assests')
DST = os.path.join(HERE, 'assets')

# (source relative to SRC, destination folder relative to DST, why)
MANIFEST = [
    # --- Pokémon
    ('overworld/pokemon-followers/*.png', 'pokemon/run', 'racers + farm: 4x4 walk sheets (rows: down, left, right, up), 64x64 cells'),
    ('pokemon/front/*.png', 'pokemon/front', 'hero shot, cards, evolution (96x96, keyed by dex number)'),
    ('pokemon/icons/*.png', 'pokemon/icons', 'menus / pick screen / map pins (2-frame bounce, 64x64 each)'),
    ('pokemon/eggs/*.png', 'pokemon/eggs', 'not in the plan yet (eggs were dropped); kept for later'),
    ('pokemon/shadow/*.png', 'pokemon/shadow', 'ground shadows'),
    ('audio/cries/*.ogg', 'audio/cries', 'a cry for every species'),
    ('data/species.json', 'data', 'rewritten by slim_species()'),
    ('data/types.json', 'data', 'type names / weaknesses'),
    ('data/terrain_tags.json', 'data', 'what each tileset terrain tag means'),

    # --- the track, the farm, the trophy room
    ('overworld/tilesets/*.png', 'tilesets', 'Outside (track + farm), Caves, Interior general / Museum (trophy room), and the rest'),
    ('overworld/autotiles/*.png', 'autotiles', 'animated water, sand, flowers, lava, cave floors'),
    ('data/tilesets.json', 'data', 'rewritten by fix_tilesets(): passability / priority / terrain tag per tile id'),
    ('overworld/characters/*.png', 'characters', 'objects (boulder, rock, trees), berry trees, NPCs, player sheets, Pokemon props, doors'),
    ('overworld/weather/*.png', 'weather', 'rain / hail / sandstorm / storm overlays'),
    ('overworld/fogs/*.png', 'effects', 'explosion, smoke, sparkle, portal'),

    # --- effects
    ('battle/backgrounds/*.png', 'backgrounds', 'parallax backdrops (*_bg) + platforms (*_base0/1)'),
    ('battle/animations/*.png', 'effects/anims', '192x192 cel sheets: impacts, shields, fire, thunder...'),
    ('battle/move-animations/*.png', 'effects/move', 'ball bursts and other small effect sprites'),
    ('battle/transitions/*.png', 'effects/transitions', 'screen wipes (race start!)'),

    # --- people
    ('Trainers/', 'trainers', 'trainer battle portraits by generation (avatars, results screen)'),
    ('battle/trainers-essentials/*.png', 'trainers/essentials', 'more portraits'),

    # --- UI, items
    ('ui/', 'ui', 'the whole Essentials UI: ribbons (Summary/ribbons.png), windowskins, PWT boards, Pokedex, Summary, Party...'),
    ('ui/sel_arrow.png', 'ui', 'menu cursor (core/ui.js)'),
    ('ui/pause_arrow.png', 'ui', 'message arrow (core/ui.js)'),
    ('items/*.png', 'items', 'item icons: berries and treats for the farm'),
    ('fonts/*.ttf', 'fonts', 'Power Clear / Power Green pixel fonts'),

    # --- sound (only .ogg/.wav music: browsers can't play .mid)
    ('audio/bgm/*.ogg', 'audio/bgm', 'every rendered track, so each venue can have its own song'),
    ('audio/bgm/*.wav', 'audio/bgm', 'original chiptunes from the adventure game'),
    ('audio/bgm/EBDX/*.ogg', 'audio/bgm/EBDX', 'Evolution, Low HP, victory themes'),
    ('audio/jingles/', 'audio/jingles', 'Bug catching 1st/2nd/3rd, Egg get, Evolution, Badge get...'),
    ('audio/se/', 'audio/se', 'UI, Rock Smash, Cut, Strength push... (+ move-anims/)'),
]

# Sprites the adventure game doesn't have, kept in this repo: (glob relative to this project, destination folder).
# Front sprites for species after Gen 5 are Gen-5-style fan sprites from Pokemon Showdown
# (https://play.pokemonshowdown.com/sprites/gen5/<name>.png), saved as RGBA <dex>.png. See assets/CREDITS.md.
EXTRAS = [
    ('tools/extra-sprites/front/*.png', 'pokemon/front'),  # 661-663 Fletchling, Fletchinder, Talonflame
]

GENERATED = {os.path.join('data', 'species.json'), os.path.join('data', 'tilesets.json')}


def plan():
    out = []
    for pattern, dest in EXTRAS:
        for src in sorted(glob.glob(os.path.join(HERE, pattern))):
            out.append((src, os.path.join(DST, dest, os.path.basename(src))))
    for pattern, dest, _ in MANIFEST:
        if pattern.endswith('/'):
            root = os.path.join(SRC, pattern)
            hits = [os.path.join(dp, f) for dp, _, fs in os.walk(root) for f in fs]
            if not hits:
                print('!! empty folder', pattern)
            for src in sorted(hits):
                out.append((src, os.path.join(DST, dest, os.path.relpath(src, root))))
            continue
        hits = glob.glob(os.path.join(SRC, pattern))
        if not hits:
            print('!! nothing matches', pattern)
        for src in sorted(hits):
            out.append((src, os.path.join(DST, dest, os.path.basename(src))))
    return out


SPECIES_KEEP = ['dex', 'id', 'name', 'types', 'baseStats', 'growthRate', 'category', 'height', 'weight',
                'color', 'habitat', 'generation', 'evolutions']


def slim_species():
    """Rewrite data/species.json for this game: drop battle-only fields (moves, abilities, dex text) and point
    the sprite paths at our asset layout. Paths are relative to assets/; null means that sprite doesn't exist."""
    src = json.load(open(os.path.join(SRC, 'data', 'species.json'), encoding='utf-8'))
    out = []
    for s in src:
        e = {k: s[k] for k in SPECIES_KEEP if k in s}
        sp = s.get('sprites', {})
        base = lambda p: p and os.path.basename(p)
        e['sprites'] = {
            'front': sp.get('front') and 'pokemon/front/' + base(sp['front']),
            'icon': sp.get('icon') and 'pokemon/icons/' + base(sp['icon']),
            'run': sp.get('follower') and 'pokemon/run/' + base(sp['follower']),
            'cry': sp.get('cry') and 'audio/cries/' + base(sp['cry']),
        }
        if not e['sprites']['front']:  # some were added later (Sylveon = 700.png, tools/extra-sprites)
            e['sprites']['front'] = f"pokemon/front/{s['dex']}.png"
        for k, p in e['sprites'].items():
            if p and not os.path.exists(os.path.join(DST, p)):
                e['sprites'][k] = None
        out.append(e)
    with open(os.path.join(DST, 'data', 'species.json'), 'w', encoding='utf-8') as f:
        f.write('[\n' + ',\n'.join(json.dumps(e, ensure_ascii=False) for e in out) + '\n]\n')
    have = sum(1 for e in out if e['sprites']['front'] and e['sprites']['run'])
    print(f'species.json: {len(out)} species, {have} with both a front sprite and a run sheet')


def fix_tilesets():
    """data/tilesets.json with image/autotile paths pointing at our layout (tilesets/, autotiles/)."""
    src = json.load(open(os.path.join(SRC, 'data', 'tilesets.json'), encoding='utf-8'))
    fix = lambda p: p and p.replace('overworld/tilesets/', 'tilesets/').replace('overworld/autotiles/', 'autotiles/')
    for t in src:
        t['image'] = fix(t['image'])
        t['autotiles'] = [fix(a) for a in t.get('autotiles', [])]
        missing = [p for p in [t['image']] + t['autotiles'] if p and not os.path.exists(os.path.join(DST, p))]
        if missing:
            print(f"   tileset {t['id']} {t['name']}: missing {missing}")
    with open(os.path.join(DST, 'data', 'tilesets.json'), 'w', encoding='utf-8') as f:
        json.dump(src, f, separators=(',', ':'))
    print(f'tilesets.json: {len(src)} tilesets')


def main():
    files = plan()
    if '--list' in sys.argv:
        sys.stdout.reconfigure(encoding='utf-8')  # some file names are accented ("Routé 1.ogg")
        for s, d in files:
            print(os.path.relpath(d, HERE))
        return
    copied = 0
    for s, d in files:
        if os.path.relpath(d, DST) in GENERATED:
            continue
        if os.path.exists(d) and os.path.getsize(d) == os.path.getsize(s):
            continue
        os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copy2(s, d)
        copied += 1
    os.makedirs(os.path.join(DST, 'data'), exist_ok=True)
    slim_species()
    fix_tilesets()
    total = sum(os.path.getsize(d) for _, d in files if os.path.exists(d))
    print(f'{len(files)} files in manifest, {copied} copied, {total / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
