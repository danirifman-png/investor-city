import { describe, expect, it } from 'vitest';
import { DISTRICT_IDS, ZONE_GRID, ZONES } from '../src/content/cityPlan';
import { LOT_BUILDERS } from '../src/world/landmarks/districts';
import { buildLayout, CITY_SIZE, HALF_CITY, rectsOverlap, zoneAt, ZONE_SIZE } from '../src/world/cityLayout';

describe('city layout', () => {
  const layout = buildLayout();

  it('has the seven districts plus two hubs on a 3x3 grid', () => {
    expect(layout).toHaveLength(9);
    for (const id of DISTRICT_IDS) expect(layout.some((z) => z.id === id)).toBe(true);
    expect(DISTRICT_IDS).toHaveLength(7);
    expect(new Set(ZONE_GRID.flat()).size).toBe(9);
  });

  it('gives every normal zone four lots and every merged zone one', () => {
    for (const z of layout) expect(z.lots).toHaveLength(ZONES[z.id].merged ? 1 : 4);
  });

  it('keeps every lot inside the city and inside its zone', () => {
    for (const z of layout) {
      for (const lot of z.lots) {
        expect(lot.rect.x0).toBeGreaterThanOrEqual(-HALF_CITY);
        expect(lot.rect.x1).toBeLessThanOrEqual(HALF_CITY);
        expect(lot.rect.x0).toBeGreaterThanOrEqual(z.rect.x0);
        expect(lot.rect.z1).toBeLessThanOrEqual(z.rect.z1);
      }
    }
  });

  it('never overlaps two lots', () => {
    const lots = layout.flatMap((z) => z.lots);
    for (let i = 0; i < lots.length; i++) {
      for (let j = i + 1; j < lots.length; j++) expect(rectsOverlap(lots[i].rect, lots[j].rect)).toBe(false);
    }
  });

  it('has a builder for every lot type used by the plan', () => {
    const hubTypes = new Set(['centralPlaza', 'academyPark']);
    for (const z of layout) for (const lot of z.lots) if (!hubTypes.has(lot.type)) expect(LOT_BUILDERS[lot.type], lot.type).toBeTypeOf('function');
  });

  it('finds the right zone for positions, including on roads', () => {
    for (const z of layout) {
      const cx = (z.rect.x0 + z.rect.x1) / 2;
      const cz = (z.rect.z0 + z.rect.z1) / 2;
      expect(zoneAt(layout, cx, cz)?.id).toBe(z.id);
    }
    expect(zoneAt(layout, 0, 0)?.id).toBe('central');
    expect(zoneAt(layout, -HALF_CITY + 2, -HALF_CITY + 2)?.id).toBe('tech');
    expect(zoneAt(layout, 9999, 0)).toBeNull();
  });

  it('city size adds up', () => {
    expect(CITY_SIZE).toBe(4 * 14 + 3 * ZONE_SIZE);
  });
});
