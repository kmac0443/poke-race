// Excerpt: a method of the RPG's Game class (src/game/game.js), not a standalone module.
// MAPS[mapId].music is each place's song; p.activeAt is the frame a player last moved; requestBgm is core/audio.js.
  updateMusic() {
    // One speaker for three players, so ONE song is picked — never a rapid back-and-forth between everybody's maps
    // (following whoever stepped last flipped the song every few steps, which sounded like two songs at once).
    // The song goes where most of the players who are actually playing are (anyone who moved in the last
    // half-minute); a tie keeps the song that's on. Once it changes it stays at least 8 seconds, unless nobody
    // playing is still in that place.
    const now = this.world.frame;
    const active = this.players.filter(p => p.mapId && p.activeAt !== undefined && now - p.activeAt < 60 * 30);
    const who = active.length ? active : this.players.filter(p => p.mapId);
    const songOf = p => { const d = MAPS[p.mapId]; return d ? (p.surfing ? 'Surfing.ogg' : d.music) : null; };
    const counts = new Map();
    for (const p of who) { const s = songOf(p); if (s) counts.set(s, (counts.get(s) || 0) + 1); }
    if (!counts.size) return;
    const cur = this.music, top = Math.max(...counts.values());
    let song = cur;
    if (!counts.has(cur) || (counts.get(cur) < top && now - (this.musicSince || 0) > 60 * 8)) {
      song = who.map(songOf).find(s => counts.get(s) === top);   // ties → the lowest-numbered player's song
    }
    if (song !== cur) { this.music = song; this.musicSince = now; }
    requestBgm('map', this.music, 0);
  }
