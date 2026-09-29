// Image / JSON loading. All asset paths are relative to assets/.
export const ASSET_BASE = 'assets/';

const images = new Map();

export function img(path) {
  let i = images.get(path);
  if (!i) {
    i = new Image();
    i.src = ASSET_BASE + path.split('/').map(encodeURIComponent).join('/');
    images.set(path, i);
  }
  return i;
}

export const isReady = i => i && i.complete && i.naturalWidth > 0;

export function preload(paths) {
  return Promise.all(paths.map(p => new Promise(res => {
    const i = img(p);
    if (i.complete) return res(i);
    i.onload = () => res(i);
    i.onerror = () => { console.warn('missing image', p); res(i); };
  })));
}

export async function loadJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load ${url}`);
  return r.json();
}

// Draw helper that silently skips images that aren't loaded yet.
export function draw(ctx, path, ...args) {
  const i = img(path);
  if (isReady(i)) ctx.drawImage(i, ...args);
  return i;
}
