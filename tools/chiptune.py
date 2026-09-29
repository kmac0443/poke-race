"""A tiny GBA-style chiptune synth: new area music without MIDI tools.

    python tools/chiptune.py                 # render every song to assets/audio/bgm/<name>.wav
    python tools/chiptune.py "Aurora Harbor" # just one

Every song is written below as data: a tempo, a chord progression, a hand-written melody, and a few style
switches (arpeggio pattern, bass pattern, drum pattern). Four voices, like the GBA's sound chip: two pulse waves
(lead + arpeggio/harmony), a stepped triangle for the bass, and LFSR noise for the drums. Songs loop seamlessly
(everything is rendered exactly N bars long, with the echo tail wrapped round to the start).

Notation: a melody is a string of tokens "C5:1" (note + octave : beats), "r:.5" (rest), "-:1" (hold the
previous note longer). Sharps are "C#5", flats "Bb4". Chords are names like "C", "Am", "F", "G7", "Dm7", "Esus4",
"Bb", "F#m", one per bar unless written "C/2" (two beats).
"""
import sys, wave, math
import numpy as np

SR = 22050
OUT = 'assets/audio/bgm/'

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(tok):
    n, i = NOTE[tok[0]], 1
    while i < len(tok) and tok[i] in '#b':
        n += 1 if tok[i] == '#' else -1
        i += 1
    return n + 12 * (int(tok[i:]) + 1)


def freq(m):
    return 440.0 * 2 ** ((m - 69) / 12)


CHORD = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11],
         'sus4': [0, 5, 7], 'sus2': [0, 2, 7], 'dim': [0, 3, 6], 'add9': [0, 4, 7, 14], 'aug': [0, 4, 8]}


def chord(name):
    root = name[0]
    i = 1
    if len(name) > 1 and name[1] in '#b':
        i = 2
    q = name[i:]
    r = NOTE[root] + (1 if name[1:2] == '#' else -1 if name[1:2] == 'b' else 0)
    return r, CHORD[q]


# ---------------------------------------------------------------- voices
def pulse(f, n, duty, t0=0):
    t = (np.arange(n) + t0) / SR
    ph = (t * f) % 1.0
    return np.where(ph < duty, 1.0, -1.0) - (2 * duty - 1)      # centred: no DC offset


def vib_pulse(f, n, duty, depth=0.004, rate=5.5, delay=0.18):
    t = np.arange(n) / SR
    v = 1 + depth * np.sin(2 * np.pi * rate * t) * np.clip((t - delay) / 0.15, 0, 1)
    ph = np.cumsum(f * v / SR) % 1.0
    return np.where(ph < duty, 1.0, -1.0) - (2 * duty - 1)


def tri(f, n):
    ph = (np.arange(n) / SR * f) % 1.0
    x = 4 * np.abs(ph - 0.5) - 1
    return np.round(x * 7.5) / 7.5          # 4-bit stepped, like the GBA's wave channel


_lfsr = None


def noise(n, short=False):
    global _lfsr
    if _lfsr is None:
        rng = np.random.default_rng(7)
        _lfsr = rng.choice([-1.0, 1.0], SR * 2)
    x = _lfsr[:n] if not short else np.repeat(_lfsr[: n // 8 + 1], 8)[:n]
    return x


def env(n, a=0.005, d=0.08, s=0.6, r=0.04, gate=None):
    gate = n if gate is None else min(gate, n)
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.arange(n) - gate
    e = np.where(rel > 0, e * np.clip(1 - rel / (r * SR), 0, 1), e)
    return e


# ---------------------------------------------------------------- song rendering
def parse_melody(s):
    out, last = [], None
    for tok in s.split():
        name, beats = tok.split(':')
        beats = float(beats)
        if name == '-':
            if out:
                out[-1][1] += beats
            continue
        out.append([None if name == 'r' else midi(name), beats])
    return out


def parse_chords(s, bar):
    out = []
    for tok in s.split():
        name, _, b = tok.partition('/')
        out.append((chord(name), float(b) if b else bar))
    return out


def place(buf, start, x):
    n = min(len(x), len(buf) - start)
    if n > 0:
        buf[start:start + n] += x[:n]
    rest = len(x) - n
    if rest > 0:                               # wrap the tail round to the start: seamless loops
        buf[:rest] += x[n:]


ARP = {
    'up': [0, 1, 2, 1], 'updown': [0, 1, 2, 3, 2, 1], 'roll': [0, 1, 2, 3], 'waltz': [0, 1, 2],
    'broken': [0, 2, 1, 2], 'sparse': [0, None, 2, None],
}
BASS = {
    'root': [(0, 1)], 'pulse': [(0, .5), (0, .5)], 'walk': [(0, 1), (7, 1), (12, 1), (7, 1)],
    'drive': [(0, .5), (0, .5), (12, .5), (0, .5)], 'fifths': [(0, 2), (7, 2)], 'waltz': [(0, 1), (7, 1), (7, 1)],
    'long': [(0, 4)], 'island': [(0, 1.5), (7, .5), (12, 1), (7, 1)],
}
DRUMS = {   # per beat in the bar: k kick, s snare, h hat, . nothing (each char is half a beat)
    'none': '', 'march': 'k.h.s.h.k.h.s.h.', 'calypso': 'k.hkh.s.k.hkh.sh', 'soft': 'k...h...k...h...',
    'drive': 'khhhskhhkhhhskhh', 'waltz': 'k.h.h.', 'shuffle': 'k.hsh.k.hsh.', 'tribal': 'k.kh.hs.k.kh.hsh',
    'rain': 'h.h.h.h.h.h.h.h.',
}


def render(song):
    bpm, bar = song['bpm'], song.get('bar', 4)
    spb = 60.0 / bpm
    chords = parse_chords(song['chords'], bar)
    total_beats = sum(b for _, b in chords)
    n = int(round(total_beats * spb * SR))
    lead, harm, bass, drum = (np.zeros(n) for _ in range(4))
    B = lambda beat: int(round(beat * spb * SR)) % n

    # the melody: pulse 50% (or the song's duty) with a little vibrato
    t = 0.0
    duty = song.get('duty', 0.5)
    for m, beats in parse_melody(song['melody']):
        if m is not None:
            ln = int(beats * spb * SR)
            x = vib_pulse(freq(m), ln + int(0.06 * SR), duty) * env(ln + int(0.06 * SR), d=0.25, s=0.55, r=0.06, gate=ln)
            place(lead, B(t), x)
        t += beats
    assert abs(t - total_beats) < 1e-6 or 'melody_loops' in song, (song['name'], t, total_beats)

    # harmony: arpeggios on a 12.5% pulse (the classic shimmer), or held pads
    arp = ARP[song.get('arp', 'up')]
    step = song.get('arpStep', 0.5)
    oct_ = song.get('arpOct', 4)
    t = 0.0
    for (root, ivs), beats in chords:
        k, tt = 0, 0.0
        if song.get('pad'):
            for iv in ivs[:3]:
                m = 12 * (oct_ + 1) + root + iv
                ln = int(beats * spb * SR)
                place(harm, B(t), pulse(freq(m), ln, 0.25) * env(ln, a=0.03, d=0.4, s=0.5, r=0.1, gate=ln - 200) * 0.45)
        else:
            while tt < beats - 1e-6:
                i = arp[k % len(arp)]
                if i is not None:
                    m = 12 * (oct_ + 1) + root + ivs[i % len(ivs)] + (12 if i >= len(ivs) else 0)
                    ln = int(step * spb * SR)
                    place(harm, B(t + tt), pulse(freq(m), ln, 0.125) * env(ln, d=0.06, s=0.3, r=0.02, gate=ln - 100))
                k += 1
                tt += step
        t += beats

    # bass: the stepped triangle
    pat = BASS[song.get('bass', 'root')]
    t = 0.0
    for (root, ivs), beats in chords:
        tt, k = 0.0, 0
        while tt < beats - 1e-6:
            iv, ln_b = pat[k % len(pat)]
            ln_b = min(ln_b, beats - tt)
            m = 12 * 4 + root + iv - (12 if root > 6 else 0)   # C3 and down to F#2: audible on small speakers
            ln = int(ln_b * spb * SR)
            place(bass, B(t + tt), tri(freq(m), ln) * env(ln, a=0.002, d=0.3, s=0.8, r=0.02, gate=ln - 150))
            tt += ln_b
            k += 1
        t += beats

    # drums: noise
    dp = DRUMS[song.get('drums', 'none')]
    if dp:
        per = len(dp) / 2       # beats per pattern
        t = 0.0
        while t < total_beats - 1e-6:
            for i, c in enumerate(dp):
                at = t + i * 0.5
                if at >= total_beats:
                    break
                if c == 'k':
                    ln = int(0.12 * SR)
                    tt = np.arange(ln) / SR
                    x = np.sin(2 * np.pi * np.cumsum(110 * np.exp(-tt * 30) + 45) / SR) * np.exp(-tt * 25)
                    place(drum, B(at), x * 0.9)
                elif c == 's':
                    ln = int(0.14 * SR)
                    place(drum, B(at), noise(ln, short=True) * np.exp(-np.arange(ln) / SR * 22) * 0.45)
                elif c == 'h':
                    ln = int(0.04 * SR)
                    place(drum, B(at), noise(ln) * np.exp(-np.arange(ln) / SR * 90) * 0.18)
            t += per

    mix = lead * song.get('leadVol', 0.26) + harm * song.get('harmVol', 0.10) + bass * 0.30 + drum * song.get('drumVol', 0.35)
    # a short echo on everything (GBA games faked this with a second channel); wraps for the loop
    d = int(song.get('echo', 0.19) * SR)
    mix = mix + np.roll(mix, d) * 0.22
    # a gentle low-pass so the square waves aren't harsh
    k = np.exp(-2 * np.pi * 5200 / SR)
    y = np.empty_like(mix)
    acc = 0.0
    for _ in range(2):                          # run twice so the loop point is settled
        for i in range(len(mix)):
            acc = (1 - k) * mix[i] + k * acc
            y[i] = acc
    y = y / max(1e-6, np.max(np.abs(y))) * 0.8
    return (y * 32767).astype(np.int16)


def write(song):
    data = render(song)
    path = OUT + song['name'] + '.wav'
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"wrote {path}  {len(data) / SR:.1f}s")


from chiptune_songs import SONGS  # noqa: E402  (the tunes live in their own file)

if __name__ == '__main__':
    want = sys.argv[1:]
    for s in SONGS:
        if not want or s['name'] in want:
            write(s)
