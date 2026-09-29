// admin.html: the parent's page. Everything is per child. Each change is a read-modify-write of the save, so the
// game (another tab) and this page don't overwrite each other.
import { LEVELS, EEVEELUTIONS } from './data/defaults.js';
import { AVATARS } from './data/avatars.js';
import { loadSave, writeSave, SAVE_KEY, CHILD_COLORS } from './game/save.js';
import { settingsFor, isCustom, setSetting, resetSetting } from './game/settings.js';
import { loadSpecies, SPECIES, canRace, STATS, STAT_BASE, STAT_ICON, growthPips } from './game/species.js';
import { givePokemon } from './game/pokemon.js';
import { factsForLevel, currentLevel, levelStatus, upcoming, cardFor, resetFact, problemText } from './game/math.js';
import { goalsFor } from './game/goals.js';
import { ASSET_BASE } from './core/assets.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const asset = p => ASSET_BASE + p.split('/').map(encodeURIComponent).join('/');

let save = loadSave();
let child = 0;
try { child = Number(sessionStorage.getItem('pokemon-race-admin-child')) === 1 ? 1 : 0; } catch {}
let query = '';
let giveQuery = '';

const profile = () => save.profiles[child];
const other = () => save.profiles[1 - child];

/** Change this child's profile and save it (on top of the latest save, in case the game wrote meanwhile). */
function mutate(fn) {
  save = loadSave();
  fn(save.profiles[child]);
  writeSave(save);
  render();
}

// ------------------------------------------------------------------ setting row controls
function controls(key) {
  const custom = isCustom(profile(), key);
  return `<span class="badge ${custom ? 'custom' : ''}">${custom ? 'customised' : 'default'}</span>
    ${custom ? `<button class="small" data-reset="${key}">Reset to default</button>` : ''}
    <button class="small" data-copy="${key}">Copy from ${esc(other().name)}</button>`;
}

function growthHtml(sp) {
  return `<div class="growth">${STATS.map(s => `<span title="${s}">${STAT_ICON[s].repeat(growthPips(sp.baseStats[STAT_BASE[s]]))}</span>`).join('')}</div>`;
}

// ------------------------------------------------------------------ sections
function renderTabs() {
  $('tabs').innerHTML = save.profiles.map((p, i) =>
    `<button data-child="${i}" class="${i === child ? 'on' : ''}" style="border-top: 3px solid ${p.color}">${esc(p.name)}</button>`).join('');
}

function renderPlayer() {
  const p = profile();
  $('player').innerHTML = `<h2>Player</h2>
    <div class="row"><label for="name">Name</label><input type="text" id="name" maxlength="12" value="${esc(p.name)}">
      <span class="hint">Shown in the game. The child doesn't need to read it: their picture is next to it.</span></div>
    <div class="row"><label>Picture</label><div class="avatars">${Object.entries(AVATARS).map(([k, a]) =>
      `<label class="${p.avatar === k ? 'on' : ''}"><input type="radio" name="avatar" value="${k}" ${p.avatar === k ? 'checked' : ''}>
        <img src="${asset(a.portrait)}" alt="${k}" title="${k}"></label>`).join('')}</div></div>
    <div class="row"><label>Colour</label><div class="swatches">${CHILD_COLORS.map(c => {
      const taken = other().color === c;
      return `<button class="swatch ${p.color === c ? 'on' : ''}" data-color="${c}" style="background:${c}" ${taken ? 'disabled title="the other child\'s colour"' : ''}></button>`;
    }).join('')}</div><span class="hint">Their half of the screen, and a ring under them and their Pokémon on the farm.</span></div>
    <div class="row"><label for="coins">🪙 Coins</label><input type="number" id="coins" min="0" max="99999" value="${p.coins || 0}" style="width: 90px">
      <span class="hint">Won in races; spent in the shop on treats that raise a Pokémon's friendship.</span></div>
    <div class="row hint">${p.pokemon.length} Pokémon so far${p.pokemon.length ? ': ' + p.pokemon.map(pk => esc(SPECIES.get(pk.species)?.name || pk.species) + (pk.branch ? ` (→ ${esc(SPECIES.get(pk.branch)?.name)})` : '')).join(', ') : ''}.</div>`;
}

// ------------------------------------------------------------------ their Pokémon (Progress)
/** Branches this Pokémon may head for: Eevee's allowed Eeveelutions not taken by another of the child's Eevees;
 *  otherwise the species' evolutions when there's more than one (Kirlia, Poliwhirl). */
function branchesFor(p, pk) {
  const s = settingsFor(p);
  if (pk.species === 'EEVEE') {
    const taken = new Set(p.pokemon.filter(o => o !== pk && o.species === 'EEVEE').map(o => o.branch));
    return s.eeveelutions.filter(b => !taken.has(b) || b === pk.branch);
  }
  const goals = Object.keys(goalsFor(pk.species, s, SPECIES));
  return goals.length > 1 ? goals : [];
}

/** Can this child be given `id`? One of each species line, except Eevee (one per open Eeveelution). */
function canGive(p, id) {
  if (id === 'EEVEE') return branchesFor(p, { species: 'EEVEE' }).length > 0;
  return !p.pokemon.some(o => o.picked === id || o.species === id);
}

function renderOwned() {
  const p = profile();
  const card = pk => {
    const sp = SPECIES.get(pk.species), follow = p.active === pk.uid, br = branchesFor(p, pk);
    const num = (field, label, v) => `<label>${label}</label><input type="number" min="0" max="999" data-uid="${pk.uid}" data-field="${field}" value="${v}">`;
    const was = pk.formerSpecies.length ? 'was ' + pk.formerSpecies.map(id => esc(SPECIES.get(id)?.name || id)).join(', ') + ' · ' : '';
    return `<div class="card ${follow ? 'following' : ''}">
      <div class="top"><img class="front" src="${asset(sp.sprites.front)}" alt="">
        <div><div class="name"><b>${esc(sp.name)}</b> ${follow ? '<span class="tag">following</span>' : ''}</div>
          <div class="hint">${was}trainings ⚡${pk.trainings.speed || 0} 💪${pk.trainings.strength || 0} 🛡️${pk.trainings.defense || 0} · races won ${pk.wins.length}</div>
          ${br.length ? `<div>Goal: <select data-uid="${pk.uid}" data-field="branch">${br.map(b => `<option value="${b}" ${pk.branch === b ? 'selected' : ''}>${esc(SPECIES.get(b)?.name || b)}</option>`).join('')}</select></div>` : ''}
        </div></div>
      <div class="stats">${num('speed', '⚡ Speed', pk.stats.speed)}${num('strength', '💪 Strength', pk.stats.strength)}${num('defense', '🛡️ Defense', pk.stats.defense)}${num('friendship', '❤️ Friendship', pk.friendship)}</div>
      <div class="actions">${follow ? `<button class="small" data-unfollow="${pk.uid}">Send exploring</button>` : `<button class="small" data-follow="${pk.uid}">Make follower</button>`}
        <button class="small" data-drop="${pk.uid}">Remove…</button></div>
    </div>`;
  };
  $('owned').innerHTML = `<h2>Their Pokémon</h2>
    <p class="hint">What ${esc(p.name)} has right now. The follower is the one they train and race. Changes reach the game
      straight away, even if it's open. Removing a Pokémon also removes its stats, races and history.</p>
    <div class="owned">${p.pokemon.length ? p.pokemon.map(card).join('') : '<p class="hint">None yet: they pick their first one in the game (or give one below).</p>'}</div>
    <h3>Give a Pokémon</h3>
    <div class="row"><input type="search" id="give" placeholder="Name or dex number" value="${esc(giveQuery)}" size="28">
      <span class="hint">One of each; Eevee once per Eeveelution (pick its goal on its card afterwards).</span></div>
    <div class="results mon-list" id="give-results"></div>`;
  renderGiveResults();
}

function renderGiveResults() {
  const box = $('give-results'), p = profile(), q = giveQuery.trim().toLowerCase();
  if (!q) { box.innerHTML = ''; return; }
  const hits = [...SPECIES.values()].filter(sp => canRace(sp) &&
    (sp.name.toLowerCase().includes(q) || String(sp.dex) === q.replace(/^#/, ''))).slice(0, 40);
  box.innerHTML = hits.length ? hits.map(sp => {
    const ok = canGive(p, sp.id);
    return `<div class="mon"><img class="front" src="${asset(sp.sprites.front)}" alt="">
      <div class="info"><div class="name">${esc(sp.name)} <span class="hint">#${sp.dex}</span></div>${growthHtml(sp)}</div>
      <button class="small btns" data-give="${sp.id}" ${ok ? '' : 'disabled'}>${ok ? 'Give' : 'Has it'}</button></div>`;
  }).join('') : '<p class="hint">No Pokémon with sprites match.</p>';
}

function renderMath() {
  const s = settingsFor(profile());
  const opt = (i, sel, dis) => `<option value="${i}" ${sel ? 'selected' : ''} ${dis ? 'disabled' : ''}>${i}. ${esc(LEVELS[i - 1].label)}</option>`;
  const levels = LEVELS.map((_, k) => k + 1);
  $('math').innerHTML = `<h2>Math</h2>
    <p class="hint">Problems stay between these levels. Inside them the child moves up only when every fact in their level
      is reliably right. Both children start at level 1.</p>
    <div class="row"><label for="floor">Lowest level (floor)</label>
      <select id="floor">${levels.map(i => opt(i, i === s.mathFloor, s.mathCeiling !== null && i > s.mathCeiling)).join('')}</select>
      ${controls('mathFloor')}</div>
    <div class="row"><label for="ceiling">Highest level (ceiling)</label>
      <select id="ceiling"><option value="" ${s.mathCeiling === null ? 'selected' : ''}>No ceiling</option>
        ${levels.map(i => opt(i, i === s.mathCeiling, i < s.mathFloor)).join('')}</select>
      ${controls('mathCeiling')}</div>`;
}

function monRow(id, i, n) {
  const sp = SPECIES.get(id);
  if (!sp) return `<div class="mon"><div class="info warn">Unknown species ${esc(id)}</div><button class="small" data-remove="${i}">✕</button></div>`;
  return `<div class="mon"><img class="front" src="${asset(sp.sprites.front)}" alt="">
    <div class="info"><div class="name">${esc(sp.name)} <span class="hint">#${sp.dex}</span></div>${growthHtml(sp)}</div>
    <div class="btns"><button class="small" data-up="${i}" ${i === 0 ? 'disabled' : ''} title="Move earlier">↑</button>
      <button class="small" data-down="${i}" ${i === n - 1 ? 'disabled' : ''} title="Move later">↓</button>
      <button class="small" data-remove="${i}" title="Remove from the list">✕</button></div></div>`;
}

function renderPokemon() {
  const s = settingsFor(profile());
  $('pokemon').innerHTML = `<h2>Pokémon list</h2>
    <p class="hint">What this child can pick, for their first Pokémon and every one they earn. Removing a species doesn't take
      away one they already have. Growth icons come from base stats (⚡ Speed, 💪 Strength, 🛡️ Defense).</p>
    <div class="row">${controls('pickList')}</div>
    <div class="mon-list">${s.pickList.map((id, i) => monRow(id, i, s.pickList.length)).join('')}</div>
    <h3>Add a Pokémon</h3>
    <div class="row"><input type="search" id="lookup" placeholder="Name or dex number" value="${esc(query)}" size="28">
      <span class="hint">Only species with a front sprite and a running animation can be added.</span></div>
    <div class="results mon-list" id="results"></div>
    <h3>Eeveelutions Eevee may become</h3>
    <div class="row">${controls('eeveelutions')}</div>
    <div class="eevee">${EEVEELUTIONS.map(id => {
      const sp = SPECIES.get(id);
      return `<label><input type="checkbox" data-eevee="${id}" ${s.eeveelutions.includes(id) ? 'checked' : ''} hidden>
        <img src="${asset(sp.sprites.front)}" alt="">${esc(sp.name)}</label>`;
    }).join('')}</div>
    <h3>New Pokémon</h3>
    <div class="row"><label for="n">Races won per new Pokémon</label>
      <input type="number" id="n" min="1" max="99" value="${s.racesPerNewPokemon}" style="width: 70px">
      ${controls('racesPerNewPokemon')}</div>`;
  renderResults();
}

function renderResults() {
  const box = $('results');
  const q = query.trim().toLowerCase();
  if (!q) { box.innerHTML = ''; return; }
  const inList = new Set(settingsFor(profile()).pickList);
  const hits = [...SPECIES.values()].filter(sp => canRace(sp) &&
    (sp.name.toLowerCase().includes(q) || String(sp.dex) === q.replace(/^#/, ''))).slice(0, 40);
  box.innerHTML = hits.length ? hits.map(sp => `<div class="mon">
      <img class="front" src="${asset(sp.sprites.front)}" alt="">
      <div class="run" style="background-image: url('${asset(sp.sprites.run)}')"></div>
      <div class="info"><div class="name">${esc(sp.name)} <span class="hint">#${sp.dex}</span></div>${growthHtml(sp)}</div>
      <button class="small btns" data-add="${sp.id}" ${inList.has(sp.id) ? 'disabled' : ''}>${inList.has(sp.id) ? 'In list' : 'Add'}</button>
    </div>`).join('') : '<p class="hint">No Pokémon with sprites match.</p>';
}

// Number settings: [key, sub-key (inside an object setting) or null, label, min, max, step, hint]
const PACING = [
  ['sessionSeconds', null, 'Training session length (seconds)', 20, 300, 5, ''],
  ['trainingGainPerRight', null, 'Stat points per right answer', 0.1, 3, 0.1, 'Before growth; shrinks as a stat gets high. Higher = races come sooner.'],
  ['ease', 'misses', 'Misses (of the last 5) before a game eases off', 0, 5, 1, 'Then problems come from what they know, with more time, until 3 right in a row. 0 = never.'],
  ['needsEverySessions', null, 'Training sessions per farm need', 0, 20, 1, 'Every this many sessions, the Pokémon that trained gets hungry, thirsty… Looking after it is math on the farm. 0 = never.'],
  ['careFriendship', null, 'Friendship for looking after a need', 0, 50, 1, ''],
  ['wallsPerAnswer', null, 'Wall blocks per right answer (house)', 1, 30, 1, ''],
  ['coinsPerWin', null, 'Coins for a race won (× its rank)', 0, 100, 1, ''],
  ['opponentStrength', null, 'Race opponents (1 = normal)', 0.5, 2, 0.05, 'Below 1 makes every race easier for this child; above 1, harder. Races expect about 3 training sessions per win at 1.'],
];

function renderPacing() {
  const s = settingsFor(profile());
  $('pacing').innerHTML = `<h2>Pacing and races</h2>
    ${PACING.map(([key, sub, label, min, max, step, hint]) => `<div class="row">
      <label for="num-${key}">${esc(label)}</label>
      <input type="number" id="num-${key}" data-num="${key}" ${sub ? `data-sub="${sub}"` : ''} min="${min}" max="${max}" step="${step}"
        value="${sub ? s[key][sub] : s[key]}" style="width: 80px">
      ${controls(key)}${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>`).join('')}`;
}

// ------------------------------------------------------------------ flash cards (game/math.js)
const openLevels = new Set();
function renderCards() {
  const p = profile(), s = settingsFor(p), math = p.math, table = math.problems;
  const lv = currentLevel(p, s), queue = new Set(math.queue || []);
  const met = Object.keys(table).length, solidN = Object.keys(table).filter(k => (cardFor(p, s, k)?.box ?? 0) >= s.srs.solidBox).length;
  const recent = (math.recent || '').split('').map(c => `<span class="${c === '✓' ? 'v' : 'x'}">${c}</span>`).join('');
  const due = f => { const c = cardFor(p, s, f.key); return c && (c.dueIn <= 0 || (c.dueDate && c.dueDate <= Date.now())); };
  const when = c => c.dueIn <= 0 ? 'due now' : `due in ${c.dueIn} problem${c.dueIn === 1 ? '' : 's'}` +
    (c.dueDate ? ` or on ${new Date(c.dueDate).toLocaleDateString()}` : '');
  const cell = f => {
    const c = cardFor(p, s, f.key), txt = esc(problemText(f));
    if (!c) return `<div class="fc${queued(f)}" title="${txt} = ${f.answer}
not met yet" data-fact="">${txt}<small>–</small></div>`;
    const picks = Object.entries(c.wrongPicks).sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} ×${n}`).join(', ');
    const tip = `${txt} = ${f.answer}
box ${c.box} · ${when(c)}
seen ${c.seen}: ${c.right} right, ${c.wrong} wrong
last: ${c.last || '–'}` +
      (c.avgMs ? `
average ${(c.avgMs / 1000).toFixed(1)} s (best ${(c.bestMs / 1000).toFixed(1)} s)` : '') +
      (picks ? `
wrong answers picked: ${picks}` : '') + `
last asked ${new Date(c.lastSeen).toLocaleString()}
(click to reset this fact)`;
    return `<div class="fc b${Math.min(5, c.box)}${due(f) ? ' due' : ''}${queued(f)}" title="${esc(tip)}" data-fact="${esc(f.key)}">${txt}<small>${c.last.slice(0, 5) || '–'}</small></div>`;
  };
  const queued = f => (queue.has(f.key) ? ' queued' : '');
  const levels = LEVELS.map((L, i) => {
    const n = i + 1, facts = factsForLevel(n), st = levelStatus(p, s, n);
    const seenN = facts.filter(f => table[f.key]).length;
    if (!openLevels.size && n === lv) openLevels.add(n);
    const tag = n === lv ? ' <span class="tag">current</span>' : st.mastered ? ' ✓' : '';
    return `<details class="level" data-level="${n}" ${openLevels.has(n) ? 'open' : ''}><summary>${n}. ${esc(L.label)}${tag}
      <span class="hint">${seenN}/${facts.length} met · ${Math.round(st.solid * 100)}% solid · ${Math.round(st.accuracy * 100)}% right lately</span></summary>
      <div class="fc-grid">${facts.map(cell).join('')}</div></details>`;
  }).join('');
  $('cards').innerHTML = `<h2>Flash cards</h2>
    <p class="hint">Every fact moves between boxes: right → up a box and it comes back later (after ${s.srs.steps.join(', ')} problems),
      wrong → box 0 and it's back ${s.srs.missGap} problems later. New facts come in while few are being learned and the child
      is mostly right. Hover a fact for its history; click to reset it.</p>
    <div class="fc-summary">
      <div><b>${math.step || 0}</b><span class="hint">problems answered</span></div>
      <div><b>${esc(LEVELS[lv - 1].label)}</b><span class="hint">level ${lv}</span></div>
      <div><b>${met}</b><span class="hint">facts met</span></div>
      <div><b>${solidN}</b><span class="hint">solid (box ${s.srs.solidBox}+)</span></div>
      <div><b class="recent">${recent || '–'}</b><span class="hint">last answers, newest first</span></div>
    </div>
    <div class="row"><label>Next up</label><div class="fc-next">${upcoming(p, s).map(f => `<span>${esc(problemText(f))}</span>`).join('') || '<span class="hint">–</span>'}</div></div>
    <div class="legend"><span class="hint">Boxes:</span>
      <span class="fc">not met</span><span class="fc b0">0 missed</span><span class="fc b1">1</span><span class="fc b2">2</span>
      <span class="fc b3">3 solid</span><span class="fc b4">4</span><span class="fc b5">5+</span>
      <span class="fc due">due now</span><span class="fc queued">in the next 5</span></div>
    ${levels}`;
}

// ------------------------------------------------------------------ bag and house
/** A furniture sprite cut from its sheet (scaled to fit 48 px), or an item icon. */
function thingPic(it) {
  if (!it.sheet) return `<img src="${asset(`items/${it.item}.png`)}" alt="">`;
  const [sx, sy, w, h] = it.src, k = Math.min(1, 48 / Math.max(w, h));
  return `<div style="width:${w}px;height:${h}px;background:url('${asset(it.sheet)}') -${sx}px -${sy}px;transform:scale(${k})"></div>`;
}

function renderHouse() {
  const p = profile(), s = settingsFor(p), bag = p.bag || {}, house = p.house || { items: [], walls: [] };
  const placed = id => (house.items || []).filter(i => i.item === id).length;
  const row = (it, furniture) => `<div class="thing">
      <div class="pic">${thingPic(it)}</div>
      <div class="info"><b>${esc(it.name || it.item)}</b>🪙 ${it.price}${furniture ? ` · in the house: ${placed(it.item)}` : ` · ❤️ +${it.friendship}`}</div>
      <div class="count"><button class="small" data-bag="${it.item}" data-n="-1" ${bag[it.item] ? '' : 'disabled'}>−</button>
        <span title="in the bag">${bag[it.item] || 0}</span><button class="small" data-bag="${it.item}" data-n="1">+</button>
        ${furniture && placed(it.item) ? `<button class="small" data-unplace="${it.item}" title="take it out of the house, back into the bag">↩</button>` : ''}</div>
    </div>`;
  $('house').innerHTML = `<h2>Bag and house</h2>
    <p class="hint">What ${esc(p.name)} has in their 🎒 bag (− / + change it), and what stands in their 🏠 house (↩ puts it back in
      the bag). In the game, placing, moving, using and taking furniture away each need a right answer.</p>
    <h3>Treats and toys</h3><div class="things">${s.shopItems.map(it => row(it, false)).join('')}</div>
    <h3>Furniture</h3><div class="things">${(s.furniture || []).map(it => row(it, true)).join('')}</div>
    <div class="row"><label>Walls</label><span>${(house.walls || []).length} blocks built</span>
      <button class="small" data-clearwalls="1" ${(house.walls || []).length ? '' : 'disabled'}>Knock them all down</button></div>`;
}

function render() {
  renderTabs(); renderPlayer(); renderOwned(); renderHouse(); renderMath(); renderCards(); renderPokemon(); renderPacing();
}

// ------------------------------------------------------------------ events
const editList = fn => mutate(p => { const list = [...settingsFor(p).pickList]; fn(list); setSetting(p, 'pickList', list); });

document.addEventListener('click', e => {
  const fc = e.target.closest('.fc[data-fact]');
  if (fc && fc.dataset.fact) {
    const key = fc.dataset.fact;
    if (confirm(`Reset ${key} for ${profile().name}? Its history goes and it's met again from scratch.`)) mutate(p => resetFact(p, key));
    return;
  }
  const d = e.target.closest('button')?.dataset;
  if (!d) return;
  if (d.bag) {                                         // one more / one fewer in the bag
    mutate(p => {
      p.bag = p.bag || {};
      const n = Math.max(0, (p.bag[d.bag] || 0) + Number(d.n));
      if (n) p.bag[d.bag] = n; else { delete p.bag[d.bag]; if (p.holding === d.bag) p.holding = null; }
    });
    return;
  }
  if (d.unplace) {                                     // out of the house, back into the bag
    mutate(p => {
      const h = p.house || { items: [] }, n = h.items.filter(i => i.item === d.unplace).length;
      h.items = h.items.filter(i => i.item !== d.unplace);
      p.bag = p.bag || {}; p.bag[d.unplace] = (p.bag[d.unplace] || 0) + n;
    });
    return;
  }
  if (d.clearwalls) { if (confirm(`Knock down every wall in ${profile().name}'s house?`)) mutate(p => { if (p.house) p.house.walls = []; }); return; }
  if (d.child !== undefined) {
    child = Number(d.child);
    try { sessionStorage.setItem('pokemon-race-admin-child', child); } catch {}
    render();
  } else if (d.reset) mutate(p => resetSetting(p, d.reset));
  else if (d.copy) mutate(p => setSetting(p, d.copy, settingsFor(save.profiles[1 - child])[d.copy]));
  else if (d.up !== undefined) editList(l => { const i = Number(d.up); [l[i - 1], l[i]] = [l[i], l[i - 1]]; });
  else if (d.down !== undefined) editList(l => { const i = Number(d.down); [l[i + 1], l[i]] = [l[i], l[i + 1]]; });
  else if (d.remove !== undefined) editList(l => l.splice(Number(d.remove), 1));
  else if (d.add) editList(l => l.push(d.add));
  else if (d.color) mutate(p => { if (save.profiles[1 - child].color !== d.color) p.color = d.color; });
  else if (d.follow) mutate(p => { p.active = Number(d.follow); const pk = p.pokemon.find(o => o.uid === p.active); if (pk) pk.home = false; });
  else if (d.unfollow) mutate(p => { p.active = null; });
  else if (d.drop) {
    const pk = profile().pokemon.find(o => o.uid === Number(d.drop));
    const name = SPECIES.get(pk.species)?.name;
    if (!confirm(`Remove ${name} from ${profile().name}? Its stats, races won and history go too.`)) return;
    mutate(p => { p.pokemon = p.pokemon.filter(o => o.uid !== pk.uid); if (p.active === pk.uid) p.active = null; });
  } else if (d.give) mutate(p => {
    if (!canGive(p, d.give)) return;
    const had = p.active;
    const pk = givePokemon(p, settingsFor(p), d.give, d.give === 'EEVEE' ? branchesFor(p, { species: 'EEVEE' })[0] : null);
    if (!pk.branch) { const br = branchesFor(p, pk); if (br.length) pk.branch = br[0]; }
    p.active = had ?? pk.uid;           // giving doesn't change who's following (unless nobody was)
  });
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'name') {
    const name = el.value.trim();
    if (name) mutate(p => { p.name = name; }); else el.value = profile().name;
  } else if (el.name === 'avatar') mutate(p => { p.avatar = el.value; });
  else if (el.id === 'floor') mutate(p => setSetting(p, 'mathFloor', Number(el.value)));
  else if (el.id === 'ceiling') mutate(p => setSetting(p, 'mathCeiling', el.value === '' ? null : Number(el.value)));
  else if (el.dataset.eevee) mutate(p => {
    const on = new Set(settingsFor(p).eeveelutions);
    if (el.checked) on.add(el.dataset.eevee); else on.delete(el.dataset.eevee);
    setSetting(p, 'eeveelutions', EEVEELUTIONS.filter(id => on.has(id)));
  });
  else if (el.dataset.uid && el.dataset.field) mutate(p => {
    const pk = p.pokemon.find(o => o.uid === Number(el.dataset.uid));
    if (!pk) return;
    const f = el.dataset.field;
    if (f === 'branch') pk.branch = el.value;
    else {
      const v = Math.max(0, Math.round(Number(el.value)) || 0);
      if (f === 'friendship') pk.friendship = Math.min(v, settingsFor(p).friendshipMax); else pk.stats[f] = v;
    }
  });
  else if (el.id === 'coins') {
    const v = Math.round(Number(el.value));
    if (el.value !== '' && v >= 0) mutate(p => { p.coins = v; }); else el.value = profile().coins || 0;
  }
  else if (el.dataset.num) {
    const [key, sub, , min, max] = PACING.find(r => r[0] === el.dataset.num);
    const v = Number(el.value);
    if (el.value === '' || !(v >= min && v <= max)) { renderPacing(); return; }
    mutate(p => setSetting(p, key, sub ? { ...settingsFor(p)[key], [sub]: v } : v));
  }
  else if (el.id === 'n') {
    const n = Math.round(Number(el.value));
    if (n >= 1) mutate(p => setSetting(p, 'racesPerNewPokemon', n)); else el.value = settingsFor(profile()).racesPerNewPokemon;
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'lookup') { query = e.target.value; renderResults(); }
  if (e.target.id === 'give') { giveQuery = e.target.value; renderGiveResults(); }
});

// the game saved (another tab): show its version, unless the parent is typing
addEventListener('storage', e => {
  if (e.key !== SAVE_KEY) return;
  save = loadSave();
  if (document.activeElement?.matches('input[type=text], input[type=number]')) return;
  const focusLookup = document.activeElement?.id === 'lookup';
  render();
  if (focusLookup) $('lookup').focus();
});

await loadSpecies();
render();

// which flash-card levels are open survives a re-render (toggle doesn't bubble: listen in the capture phase)
document.addEventListener('toggle', e => {
  const d = e.target;
  if (!d.matches || !d.matches('details.level')) return;
  if (d.open) openLevels.add(Number(d.dataset.level)); else openLevels.delete(Number(d.dataset.level));
}, true);
