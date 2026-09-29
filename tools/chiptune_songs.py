"""The tunes for tools/chiptune.py. One song per place.
Each melody must add up to exactly as many beats as its chords (the renderer checks)."""

SONGS = [
    # The farm (home): calm and warm; no drums. C major, 16 bars, ends on G to lead back round.
    dict(name='Home Farm', bpm=84, arp='broken', bass='fifths', drums='none', leadVol=0.22, harmVol=0.08, echo=0.25,
         chords='C G Am F  C Em F G  F C Dm G  C Am F G',
         melody='''E5:1.5 D5:.5 C5:1 G4:1   D5:1.5 C5:.5 B4:2   C5:1 A4:1 E5:1 D5:1   C5:3 r:1
                   E5:1.5 D5:.5 C5:1 G4:1   G5:1.5 E5:.5 B4:2   A4:1 C5:1 F5:1 E5:1   D5:3 r:1
                   F5:1 E5:1 D5:1 C5:1   E5:1 G4:1 C5:2   D5:1 F5:1 A5:1 F5:1   G5:2 B4:1 D5:1
                   E5:1.5 G5:.5 E5:1 C5:1   A4:1 C5:1 E5:2   F5:1 E5:1 D5:1 A4:1   B4:1 C5:.5 D5:.5 G4:2'''),

    # Speed training (the track out east): a race. E minor, 172 bpm, driving eighths over rolling arpeggios.
    dict(name='Speed Track', bpm=172, arp='roll', arpStep=.25, bass='drive', drums='drive', duty=0.25,
         leadVol=0.26, drumVol=0.38, echo=0.12,
         chords='Em C D Em  Em C D B7  C D Bm Em  C D B7 B7',
         melody='''E5:.5 E5:.5 B4:.5 E5:.5 G5:.5 F#5:.5 E5:1   E5:.5 E5:.5 C5:.5 E5:.5 G5:1 A5:1
                   F#5:.5 F#5:.5 D5:.5 F#5:.5 A5:.5 G5:.5 F#5:1   E5:2 r:.5 B4:.5 D5:.5 E5:.5
                   E5:.5 E5:.5 B4:.5 E5:.5 G5:.5 A5:.5 B5:1   C6:.5 B5:.5 A5:.5 G5:.5 E5:1 G5:1
                   A5:.5 G5:.5 F#5:.5 D5:.5 F#5:1 A5:1   B5:2 A5:.5 G5:.5 F#5:.5 D#5:.5
                   E5:.5 G5:.5 C6:.5 G5:.5 E5:.5 G5:.5 C6:1   F#5:.5 A5:.5 D6:.5 A5:.5 F#5:.5 A5:.5 D6:1
                   B5:.5 A5:.5 F#5:.5 D5:.5 B4:1 D5:1   E5:1.5 G5:.5 B5:2
                   C6:.5 B5:.5 G5:.5 E5:.5 C6:.5 B5:.5 G5:1   D6:.5 C6:.5 A5:.5 F#5:.5 D6:.5 C6:.5 A5:1
                   B5:1 F#5:1 D#5:1 F#5:1   B5:.5 A5:.5 G5:.5 F#5:.5 D#5:1 B4:1'''),

    # Strength training (the quarry out west): heavy and stompy. A minor, a march beat, low melody.
    dict(name='Quarry', bpm=100, arp='sparse', bass='pulse', drums='march', leadVol=0.25, drumVol=0.4,
         chords='Am Am F G  Am Am F E  Dm Dm Am Am  F G E E',
         melody='''A4:1 A4:1 C5:1 A4:1   E5:1.5 D5:.5 C5:1 B4:1   A4:1 C5:1 F5:1 E5:1   D5:2 B4:1 G4:1
                   A4:1 A4:1 C5:1 E5:1   A5:1.5 G5:.5 E5:1 C5:1   D5:1 C5:1 A4:1 C5:1   B4:2 G#4:2
                   D5:1 D5:1 F5:1 D5:1   A5:1.5 G5:.5 F5:1 E5:1   E5:1 E5:1 A5:1 E5:1   C5:2 E5:2
                   F5:1 E5:1 D5:1 C5:1   D5:1 E5:1 G5:2   E5:1 D5:1 B4:1 G#4:1   E4:2 r:2'''),

    # Defense training (the arena): tense but playful. D minor, a march beat, ends on A to lead back round.
    dict(name='Arena', bpm=132, arp='broken', bass='pulse', drums='march', leadVol=0.25, drumVol=0.34,
         chords='Dm Bb C Dm  Dm Bb C A  Gm Dm Bb A  Gm C A A',
         melody='''D5:.5 F5:.5 A5:1 G5:.5 F5:.5 E5:1   D5:.5 F5:.5 Bb5:1 A5:.5 G5:.5 F5:1
                   E5:.5 G5:.5 C6:1 Bb5:.5 A5:.5 G5:1   A5:2 F5:1 D5:1
                   D5:.5 F5:.5 A5:1 G5:.5 F5:.5 E5:1   F5:.5 G5:.5 A5:1 Bb5:1 D6:1
                   C6:.5 Bb5:.5 A5:.5 G5:.5 E5:1 C5:1   C#5:1 E5:1 A5:2
                   G5:1 Bb5:1 D6:1 Bb5:1   A5:1 F5:1 D5:2
                   Bb5:.5 A5:.5 G5:.5 F5:.5 D5:1 F5:1   E5:1 C#5:1 A4:2
                   G5:.5 A5:.5 Bb5:1 A5:.5 G5:.5 F5:1   E5:.5 F5:.5 G5:1 C6:2
                   A5:1 G5:1 F5:1 E5:1   C#5:.5 D5:.5 E5:.5 F5:.5 G5:1 A5:1'''),

    # The trophy house: proud, a little fanfare. G major, a gentle march.
    dict(name='Trophy House', bpm=108, arp='broken', bass='pulse', drums='march', leadVol=0.24, drumVol=0.25, echo=0.2,
         chords='G C D G  Em C D G',
         melody='''G4:.5 B4:.5 D5:1 G5:1.5 D5:.5   E5:1 G5:1 E5:1 C5:1   F#5:1 A5:1 D5:1 F#5:1   G5:3 r:1
                   B5:1 G5:1 E5:1 G5:1   C6:1.5 B5:.5 A5:1 G5:1   F#5:1 E5:1 D5:1 F#5:1   G5:2 D5:1 G4:1'''),

    # A child's house: cosy, a music box. D major, slow, soft arpeggios, no drums.
    dict(name='Home', bpm=76, arp='broken', bass='fifths', drums='none', leadVol=0.2, harmVol=0.08, echo=0.35,
         chords='D Bm G A  D F#m G A',
         melody='''F#5:1.5 E5:.5 D5:1 A4:1   B4:1 D5:1 F#5:2   G5:1 F#5:1 E5:1 D5:1   E5:3 r:1
                   F#5:1.5 A5:.5 F#5:1 D5:1   C#5:1 E5:1 A5:2   B5:1 A5:1 G5:1 E5:1   D5:3 r:1'''),
]
