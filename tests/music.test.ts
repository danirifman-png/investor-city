import { describe, expect, it } from 'vitest';
import { THEMES, barChords, noteNumber, parseBar, themeFor } from '../src/content/music';

describe('music data', () => {
  it('reads notes', () => {
    expect(noteNumber('A4')).toBe(69);
    expect(noteNumber('C5')).toBe(72);
    expect(noteNumber('Bb4')).toBe(70);
    expect(noteNumber('F#6')).toBe(90);
    expect(noteNumber('-')).toBeNull();
  });

  for (const [id, theme] of Object.entries(THEMES)) {
    it(`${id}: every bar is 4 beats and every bar has chords`, () => {
      for (const part of [theme.a, theme.b].filter(Boolean)) {
        expect(part!.tune.length).toBe(part!.chords.length);
        for (const bar of part!.tune) {
          const total = parseBar(bar).reduce((s, e) => s + e.beats, 0);
          expect(total, `${id}: ${bar}`).toBeCloseTo(4, 6);
        }
        for (const c of part!.chords) expect(barChords(c).length).toBeGreaterThan(0);
      }
    });
  }

  it('picks a theme by place and time', () => {
    expect(themeFor({ zone: 'food', room: null, night: false })).toBe('market');
    expect(themeFor({ zone: 'food', room: null, night: true })).toBe('night');
    expect(themeFor({ zone: 'central', room: 'bank', night: true })).toBe('room');
    expect(themeFor({ zone: null, room: 'skyLand', night: false })).toBe('sky');
    expect(themeFor({ zone: 'central', room: null, night: false })).toBe('town');
  });
});
