import { describe, expect, it } from 'vitest';
import { ESCALATOR, ESCALATORS, MALL, escalatorHeight } from '../src/content/mall';
import { INTERIORS } from '../src/content/interiors';
import he from '../src/i18n/locales/he.life.json';

describe('mall', () => {
  it('escalators climb from the floor to the upper floor', () => {
    expect(escalatorHeight(ESCALATOR.zBottom)).toBe(0);
    expect(escalatorHeight(ESCALATOR.zTop)).toBeCloseTo(MALL.upper);
    expect(escalatorHeight(ESCALATOR.zBottom + 3)).toBe(0);
    expect(escalatorHeight(ESCALATOR.zTop - 3)).toBeCloseTo(MALL.upper);
    // each step is low enough to walk up
    expect(MALL.upper / ESCALATOR.steps).toBeLessThan(0.55);
    expect(ESCALATORS.map((e) => e.dir).sort()).toEqual(['down', 'up']);
  });

  it('every shop spot opens a shop tab and every spot has its texts', () => {
    const def = INTERIORS.mall;
    const dict = he as Record<string, string>;
    expect(def.wallH).toBeGreaterThan(MALL.upper + 3);
    for (const s of def.hotspots) {
      if (s.kind === 'shop') expect(s.tab).toBeTruthy();
      if (s.kind !== 'exit') expect(dict[`spot.mall.${s.id}.prompt`], s.id).toBeTruthy();
      if (s.kind === 'info') expect(dict[`spot.mall.${s.id}.body`]).toBeTruthy();
      expect(Math.abs(s.x)).toBeLessThan(MALL.w / 2);
      expect(Math.abs(s.z)).toBeLessThan(MALL.d / 2);
    }
  });
});
