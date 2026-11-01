/**
 * DATA: the game's music. Every tune here is an original composition for this
 * game (cheerful adventure-town style), written as notes so the synthesiser in
 * `core/Sound.ts` can play it without any audio files.
 *
 * Notation: a bar is a string of `note:beats` tokens (4 beats per bar),
 * `-` is a rest, notes are like `C5`, `F#6`, `Bb4`. Chords are one or two
 * per bar, separated by a space (`Dm7 G`).
 */

export type ThemeId = 'town' | 'market' | 'tech' | 'park' | 'night' | 'room' | 'sky';
export type Lead = 'square' | 'bell' | 'flute' | 'accordion' | 'synth';
export type Drums = 'bounce' | 'swing' | 'electro' | 'soft' | 'none';

export interface Theme {
  bpm: number;
  /** 0.5 is straight; higher pushes every second eighth later. */
  swing: number;
  lead: Lead;
  drums: Drums;
  /** Arpeggio of the chord in eighths under the tune. */
  arp: boolean;
  /** Sustained chord pad. */
  pad: boolean;
  a: { chords: string[]; tune: string[] };
  b?: { chords: string[]; tune: string[] };
}

export const THEMES: Record<ThemeId, Theme> = {
  // the central plaza, the bank and real estate: a bouncy main theme
  town: {
    bpm: 128,
    swing: 0.5,
    lead: 'square',
    drums: 'bounce',
    arp: true,
    pad: false,
    a: {
      chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm7 G', 'C'],
      tune: [
        'E5:1 G5:.5 C6:.5 B5:1 G5:1',
        'A5:1.5 G5:.5 E5:1 C5:1',
        'F5:.5 G5:.5 A5:1 C6:1 A5:1',
        'G5:2 -:1 D5:1',
        'E5:1 G5:.5 C6:.5 D6:1 C6:1',
        'B5:.5 A5:.5 G5:1 E5:1 G5:1',
        'F5:1 A5:.5 F5:.5 D5:1 B4:1',
        'C5:3 -:1',
      ],
    },
    b: {
      chords: ['F', 'G', 'Em', 'Am', 'F', 'G', 'E7', 'Am G'],
      tune: [
        'A5:.5 C6:.5 F6:1 E6:1 C6:1',
        'D6:1.5 B5:.5 G5:2',
        'G5:.5 B5:.5 E6:1 D6:1 B5:1',
        'C6:1.5 A5:.5 E5:2',
        'A5:1 C6:1 F6:1 A6:1',
        'G6:1.5 F6:.5 D6:2',
        'E6:1 D6:.5 C6:.5 B5:1 G#5:1',
        'A5:2 B5:2',
      ],
    },
  },
  // food and industry: a swinging market tune on an accordion-like lead
  market: {
    bpm: 112,
    swing: 0.62,
    lead: 'accordion',
    drums: 'swing',
    arp: false,
    pad: false,
    a: {
      chords: ['G', 'C', 'D', 'G', 'Em', 'C', 'D7', 'G'],
      tune: [
        'D5:.5 G5:.5 B5:1 A5:.5 G5:.5 F#5:1',
        'E5:1 G5:1 C6:1.5 -:.5',
        'A5:.5 B5:.5 A5:.5 F#5:.5 D5:1 F#5:1',
        'G5:3 -:1',
        'B5:.5 A5:.5 G5:1 E5:1 G5:1',
        'C6:1 B5:.5 A5:.5 G5:1 E5:1',
        'D5:.5 E5:.5 F#5:1 A5:1 C6:1',
        'B5:2 G5:2',
      ],
    },
    b: {
      chords: ['C', 'G', 'Am', 'D', 'C', 'G', 'Am D', 'G'],
      tune: [
        'E6:1 D6:.5 C6:.5 G5:2',
        'B5:.5 C6:.5 D6:1 G5:2',
        'A5:.5 B5:.5 C6:1 E6:1 C6:1',
        'D6:3 -:1',
        'E6:.5 F#6:.5 G6:1 E6:1 C6:1',
        'D6:1 B5:1 G5:2',
        'A5:1 C6:1 B5:1 A5:1',
        'G5:3 -:1',
      ],
    },
  },
  // tech, energy and health: shiny synth arpeggios in A minor
  tech: {
    bpm: 120,
    swing: 0.5,
    lead: 'synth',
    drums: 'electro',
    arp: true,
    pad: true,
    a: {
      chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'],
      tune: [
        'A5:.75 C6:.75 E6:.5 D6:1 C6:1',
        'A5:2 -:.5 C6:.5 D6:1',
        'E6:.75 G6:.75 E6:.5 D6:1 C6:1',
        'B5:2 G5:2',
        'A5:.75 C6:.75 E6:.5 A6:1 G6:1',
        'F6:1 E6:.5 C6:.5 A5:2',
        'B5:1 C6:1 D6:1 G5:1',
        'G#5:2 E5:2',
      ],
    },
    b: {
      chords: ['Dm', 'Am', 'Dm', 'E', 'F', 'C', 'Dm E', 'Am'],
      tune: [
        'F5:1 A5:1 D6:1.5 C6:.5',
        'E6:2 C6:1 A5:1',
        'D6:1 F6:1 A6:1 G6:.5 F6:.5',
        'E6:3 -:1',
        'C6:1 A5:1 F6:1.5 E6:.5',
        'E6:1 D6:.5 C6:.5 G5:2',
        'A5:1 F6:1 E6:1 G#5:1',
        'A5:3 -:1',
      ],
    },
  },
  // the park: a gentle flute over soft chords
  park: {
    bpm: 96,
    swing: 0.5,
    lead: 'flute',
    drums: 'soft',
    arp: true,
    pad: true,
    a: {
      chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb C', 'F'],
      tune: [
        'C6:1.5 A5:.5 F5:1 A5:1',
        'D6:2 A5:2',
        'Bb5:1 D6:1 F6:1 D6:1',
        'C6:3 -:1',
        'A5:1 C6:1 F6:1.5 E6:.5',
        'E6:1 C6:1 A5:2',
        'Bb5:1 D6:1 C6:1 E6:1',
        'F6:3 -:1',
      ],
    },
    b: {
      chords: ['Bb', 'F', 'Gm', 'C', 'Bb', 'F', 'Gm C', 'F'],
      tune: [
        'D6:1 F6:1 Bb6:2',
        'A6:1.5 G6:.5 F6:2',
        'G6:1 Bb6:1 D6:1 G6:1',
        'E6:3 -:1',
        'F6:1 D6:1 Bb5:1 D6:1',
        'C6:1 F6:1 A6:2',
        'G6:1.5 F6:.5 E6:1 C6:1',
        'F6:3 -:1',
      ],
    },
  },
  // night anywhere outside: a slow music box
  night: {
    bpm: 76,
    swing: 0.5,
    lead: 'bell',
    drums: 'none',
    arp: true,
    pad: true,
    a: {
      chords: ['D', 'Bm', 'G', 'A', 'D', 'F#m', 'G A', 'D'],
      tune: [
        'F#6:2 A6:1 F#6:1',
        'D6:3 B5:1',
        'B5:1 D6:1 G6:2',
        'E6:4',
        'F#6:1 E6:1 D6:1 A6:1',
        'C#6:3 A5:1',
        'B5:1 D6:1 E6:1 C#6:1',
        'D6:4',
      ],
    },
    b: {
      chords: ['G', 'D', 'Em', 'A', 'G', 'D', 'Em A', 'D'],
      tune: [
        'B6:2 A6:1 G6:1',
        'F#6:3 D6:1',
        'E6:1 G6:1 B6:1 A6:1',
        'A6:4',
        'G6:1.5 F#6:.5 E6:1 D6:1',
        'F#6:2 A6:2',
        'G6:1 E6:1 C#6:1 E6:1',
        'D6:4',
      ],
    },
  },
  // inside the buildings: a cosy, jazzy tune
  room: {
    bpm: 100,
    swing: 0.64,
    lead: 'flute',
    drums: 'swing',
    arp: false,
    pad: true,
    a: {
      chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'A7', 'Dm7 G7', 'C'],
      tune: [
        'E5:.5 G5:.5 B5:1 A5:1 G5:1',
        'C6:1.5 A5:.5 E5:2',
        'F5:.5 A5:.5 C6:1 D6:1 C6:1',
        'B5:2 G5:1 F5:1',
        'E5:.5 G5:.5 B5:1 D6:1 C6:1',
        'C#6:1 E6:1 G5:2',
        'F5:1 A5:1 B5:1 D6:1',
        'C6:3 -:1',
      ],
    },
  },
  // Cloud Land: dreamy bells in E major
  sky: {
    bpm: 104,
    swing: 0.5,
    lead: 'bell',
    drums: 'soft',
    arp: true,
    pad: true,
    a: {
      chords: ['E', 'C#m', 'A', 'B', 'E', 'G#m', 'A B', 'E'],
      tune: [
        'B5:1 E6:1 G#6:1 F#6:1',
        'E6:2 C#6:2',
        'A5:1 C#6:1 E6:1 A6:1',
        'F#6:3 -:1',
        'G#6:1 F#6:1 E6:1 B5:1',
        'D#6:2 B5:2',
        'C#6:1 E6:1 F#6:1 D#6:1',
        'E6:3 -:1',
      ],
    },
  },
};

const PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pitchClass(name: string): number {
  return (PITCH[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0) + 12) % 12;
}

/** `F#6` -> MIDI note number, `-` -> null. */
export function noteNumber(token: string): number | null {
  if (token === '-') return null;
  const m = /^([A-G][#b]?)(\d)$/.exec(token);
  if (!m) throw new Error(`bad note ${token}`);
  return 12 * (Number(m[2]) + 1) + pitchClass(m[1]);
}

export interface NoteEvent {
  /** MIDI number, or null for a rest. */
  note: number | null;
  /** Start in beats from the bar's start. */
  at: number;
  beats: number;
}

export function parseBar(bar: string): NoteEvent[] {
  let at = 0;
  return bar
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [n, d] = tok.split(':');
      const e = { note: noteNumber(n), at, beats: Number(d) };
      at += e.beats;
      return e;
    });
}

export interface Chord {
  /** Pitch class of the root, 0 = C. */
  root: number;
  /** Semitones above the root. */
  tones: number[];
}

export function parseChord(name: string): Chord {
  const m = /^([A-G][#b]?)(maj7|m7|m|7)?$/.exec(name);
  if (!m) throw new Error(`bad chord ${name}`);
  const q = m[2] ?? '';
  const tones = q === 'maj7' ? [0, 4, 7, 11] : q === 'm7' ? [0, 3, 7, 10] : q === '7' ? [0, 4, 7, 10] : q === 'm' ? [0, 3, 7] : [0, 4, 7];
  return { root: pitchClass(m[1]), tones };
}

/** The chords of one bar with their start beat (one chord = whole bar, two = half each). */
export function barChords(bar: string): { chord: Chord; at: number; beats: number }[] {
  const names = bar.trim().split(/\s+/);
  const len = 4 / names.length;
  return names.map((n, i) => ({ chord: parseChord(n), at: i * len, beats: len }));
}

/** Which theme plays where. Night wins outdoors; rooms have their own. */
export function themeFor(where: { zone: string | null; room: string | null; night: boolean }): ThemeId {
  if (where.room === 'skyLand') return 'sky';
  if (where.room) return 'room';
  if (where.night) return 'night';
  switch (where.zone) {
    case 'food':
    case 'industry':
      return 'market';
    case 'tech':
    case 'energy':
    case 'health':
      return 'tech';
    case 'park':
      return 'park';
    default:
      return 'town';
  }
}
