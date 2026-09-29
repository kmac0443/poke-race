// Drawing helpers shared by the menus: Pokémon sprites, growth icons, stat bars, ribbons, the seat header.
import { img, isReady } from '../core/assets.js';
import { text } from '../core/ui.js';
import { SPECIES, STATS, STAT_BASE, STAT_ICON, growthPips } from '../game/species.js';
import { ribbonCell } from '../data/venues.js';

/** Emoji / icon text (no shadow: a shadow would draw a second coloured copy). */
export function icon(g, str, x, y, size = 20, align = 'left') {
  g.font = `${size}px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  g.textBaseline = 'top';
  g.textAlign = align;
  g.fillStyle = '#000';
  g.fillText(str, x, y);
  g.textAlign = 'left';
}

/** Front sprite (96×96) centred on (cx, cy). opts: scale, gray, alpha, silhouette, white. */
export function drawFront(g, speciesId, cx, cy, opts = {}) {
  const sp = SPECIES.get(speciesId);
  const i = sp && sp.sprites.front && img(sp.sprites.front);
  if (!isReady(i)) return;
  const s = opts.scale || 1, w = i.width * s, h = i.height * s;
  g.save();
  if (opts.gray) g.filter = 'grayscale(1)';
  if (opts.silhouette) g.filter = 'brightness(0)';
  if (opts.white) g.filter = 'brightness(0) invert(1)';          // evolving: a glowing white shape
  if (opts.alpha !== undefined) g.globalAlpha = opts.alpha;
  g.drawImage(i, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
  g.restore();
}

/** One 64×64 frame of a run sheet (rows: 0 down, 1 left, 2 right, 3 up), feet at (cx, footY). */
export function drawRun(g, speciesId, row, frame, cx, footY, scale = 1) {
  const sp = SPECIES.get(speciesId);
  const i = sp && sp.sprites.run && img(sp.sprites.run);
  if (!isReady(i)) return;
  const fw = i.width / 4, fh = i.height / 4;
  g.drawImage(i, (frame % 4) * fw, row * fh, fw, fh, Math.round(cx - fw * scale / 2), Math.round(footY - fh * scale),
    fw * scale, fh * scale);
}

/** Growth as icons: one row per stat, 1–5 icons (from base stats). */
export function drawGrowth(g, speciesId, x, y, size = 18) {
  const sp = SPECIES.get(speciesId);
  if (!sp) return;
  STATS.forEach((s, r) => {
    const n = growthPips(sp.baseStats[STAT_BASE[s]]);
    for (let k = 0; k < n; k++) icon(g, STAT_ICON[s], x + k * (size + 4), y + r * (size + 6), size);
  });
}

const BAR_COLORS = { speed: '#F8C820', strength: '#E86040', defense: '#5890E8' };

/** A Pokémon's stats as icon + bar + counter. The bar is full at `max`. */
export function drawStatBars(g, pk, x, y, w = 180, max = 100) {
  STATS.forEach((s, r) => {
    const yy = y + r * 30;
    icon(g, STAT_ICON[s], x, yy, 20);
    g.fillStyle = '#404048'; g.fillRect(x + 30, yy + 4, w, 16);
    g.fillStyle = BAR_COLORS[s]; g.fillRect(x + 32, yy + 6, Math.round((w - 4) * Math.min(1, pk.stats[s] / max)), 12);
    text(g, String(pk.stats[s]), x + 40 + w, yy, { size: 22 });
  });
}

/** The coloured bar across the top of a seat's half. */
export function drawHeader(g, seat, title = '') {
  g.fillStyle = seat.color; g.fillRect(0, 0, 512, 36);
  text(g, `P${seat.index + 1}`, 12, 6, { color: '#F8F8F8', shadow: '#303030' });
  if (title) text(g, title, 256, 6, { color: '#F8F8F8', shadow: '#303030', align: 'center' });
}

/** Horizontal shake offset for `t` frames of a shake (0 = none). */
export const shake = t => (t > 0 ? Math.round(Math.sin(t * 1.3) * Math.min(6, t)) : 0);

/** A race's ribbon (its venue's colour, its rank's style), size × size at (x, y); `dim` = not won yet. */
export function drawRibbon(g, venue, rank, x, y, size = 64, dim = false) {
  const [sx, sy] = ribbonCell(venue, rank);
  const i = img('ui/Summary/ribbons.png');
  if (!isReady(i)) return;
  g.save();
  if (dim) { g.filter = 'grayscale(1)'; g.globalAlpha = 0.35; }
  g.drawImage(i, sx, sy, 64, 64, x, y, size, size);
  g.restore();
}

/** A progress bar: an icon, then have / need filling a bar, then the counter. */
export function drawProgress(g, iconStr, have, need, x, y, w = 160, color = '#48B848') {
  icon(g, iconStr, x, y, 18);
  const bx = x + Math.max(26, Math.ceil(g.measureText(iconStr).width) + 6);   // icon() left its font set
  g.fillStyle = '#404048'; g.fillRect(bx, y + 3, w, 14);
  g.fillStyle = have >= need ? '#F8C820' : color; g.fillRect(bx + 2, y + 5, Math.round((w - 4) * Math.min(1, have / need)), 10);
  text(g, have >= need ? '✓' : `${have}/${need}`, bx + w + 6, y - 2, { size: 18 });
}
