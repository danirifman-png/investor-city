import { describe, expect, it } from 'vitest';
import { cityWeatherFor, newBizDay } from '../src/core/Business';
import { keyOfIndex } from '../src/core/Money';

const keyOfDay = (i: number): string => keyOfIndex(300 + i);

describe('city weather', () => {
  it('is the same all day and varies across days', () => {
    expect(cityWeatherFor('2026-11-03')).toBe(cityWeatherFor('2026-11-03'));
    const seen = new Map<string, number>();
    for (let i = 0; i < 400; i++) {
      const w = cityWeatherFor(keyOfDay(i));
      seen.set(w, (seen.get(w) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual(['cloudy', 'hot', 'rain', 'sunny']);
    // sunny days are the most common, rain the least
    expect(seen.get('sunny')!).toBeGreaterThan(seen.get('rain')!);
  });

  it('makes the business forecast lean on the sky', () => {
    for (let seed = 1; seed < 30; seed++) {
      const d = newBizDay(1, 'ordinary', seed, 'rain');
      expect(d.forecast.likely).toBe('rain');
      expect(d.forecast.other).not.toBe('rain');
    }
    // the stand's forecast is always right
    expect(newBizDay(0, 'ordinary', 5, 'hot').weather).toBe('hot');
  });
});
