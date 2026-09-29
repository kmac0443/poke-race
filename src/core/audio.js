// Music and sound effects. Only one BGM plays at a time (all players share the speakers),
// so callers request music with a priority and the highest request wins.
import { ASSET_BASE } from './assets.js';

const url = p => ASSET_BASE + p.split('/').map(encodeURIComponent).join('/');
let unlocked = false;
let current = null;       // { path, el }
const requests = new Map(); // key -> { path, priority }
export const volume = { bgm: 0.45, se: 0.7 };

export function unlock() { unlocked = true; refresh(); }

function pickBgmFile(name) {
  // MIDI can't play in browsers; the tools/convert-midi script produces .ogg next to it.
  if (name.endsWith('.mid')) return 'audio/bgm/' + name.replace(/\.mid$/, '.ogg');
  return 'audio/bgm/' + name;
}

export function requestBgm(key, name, priority = 0) {
  if (!name) requests.delete(key); else requests.set(key, { name, priority });
  refresh();
}

function refresh() {
  if (!unlocked) return;
  let best = null;
  for (const r of requests.values()) if (!best || r.priority > best.priority) best = r;
  const path = best ? pickBgmFile(best.name) : null;
  if (current && current.path === path) return;
  if (current) { current.el.pause(); current = null; }
  if (!path) return;
  const el = new Audio(url(path));
  el.loop = true;
  el.volume = volume.bgm;
  el.play().catch(() => {});
  el.onerror = () => {};
  current = { path, el };
}

const seCache = new Map();
export function se(name, vol = 1) {
  if (!unlocked) return;
  const path = name.startsWith('audio/') ? name : 'audio/se/' + name + '.ogg';
  let base = seCache.get(path);
  if (!base) { base = new Audio(url(path)); seCache.set(path, base); }
  const el = base.cloneNode();
  el.volume = volume.se * vol;
  el.play().catch(() => {});
}

export function jingle(name) {
  if (!unlocked) return;
  const el = new Audio(url('audio/jingles/' + name + '.ogg'));
  el.volume = volume.bgm;
  if (current) current.el.volume = volume.bgm * 0.25;
  el.onended = () => { if (current) current.el.volume = volume.bgm; };
  el.play().catch(() => {});
}

export function cry(path, vol = 1) {
  if (path) se(path, vol);
}
