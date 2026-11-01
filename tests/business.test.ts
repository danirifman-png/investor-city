import { describe, expect, it } from 'vitest';
import {
  BIZ_STAGES, bestBizPlan, bizDemand, canUpgrade, cityEventFor, clampBizPlan, newBizDay, newBusinessRecord, paybackDays,
  playBizDay, recordBizDay, sanitizeBusinessRecord, STAGE_RULES, takeHome, upgrade,
} from '../src/core/Business';

describe('my business', () => {
  it('each stage earns more on an ordinary sunny day and pays back its price in a reasonable time', () => {
    let prev = -Infinity;
    for (const s of BIZ_STAGES) {
      const best = bestBizPlan(s, 'sunny', 'ordinary').profit;
      expect(best).toBeGreaterThan(prev);
      prev = best;
    }
    for (const s of [0, 1, 2] as const) {
      const days = paybackDays(s)!;
      expect(days).toBeGreaterThanOrEqual(3);
      expect(days).toBeLessThanOrEqual(14);
    }
    expect(paybackDays(3)).toBeNull();
  });

  it('a bigger business loses more on a bad day (fixed costs)', () => {
    const bad = (s: 0 | 3) => playBizDay({ stage: s, city: 'roadworks', weather: 'rain', forecast: { likely: 'rain', other: 'hot', chance: 1 } }, { cups: STAGE_RULES[s].capacity, price: 5 }).profit;
    expect(bad(3)).toBeLessThan(bad(0));
  });

  it('higher prices mean fewer customers; events and weather change demand', () => {
    expect(bizDemand(0, 'sunny', 'ordinary', 7)).toBeLessThan(bizDemand(0, 'sunny', 'ordinary', 4));
    expect(bizDemand(0, 'hot', 'festival', 5)).toBeGreaterThan(bizDemand(0, 'rain', 'roadworks', 5));
  });

  it('the stand forecast is sure; days are deterministic for a seed', () => {
    for (let seed = 1; seed < 40; seed++) expect(newBizDay(0, 'ordinary', seed).weather).toBe(newBizDay(0, 'ordinary', seed).forecast.likely);
    expect(newBizDay(2, 'match', 7)).toEqual(newBizDay(2, 'match', 7));
  });

  it('profit fills the till, the till pays for growth or goes home, and never goes negative', () => {
    let rec = newBusinessRecord();
    const day = { stage: 0 as const, city: 'festival' as const, weather: 'hot' as const, forecast: { likely: 'hot' as const, other: 'rain' as const, chance: 1 } };
    const plan = bestBizPlan(0, 'hot', 'festival').plan;
    while (!canUpgrade(rec)) rec = recordBizDay(rec, playBizDay(day, plan));
    const till = rec.till;
    rec = upgrade(rec);
    expect(rec.stage).toBe(1);
    expect(rec.till).toBe(till - STAGE_RULES[1].upgradeCost);
    const loss = playBizDay({ ...day, stage: 1, weather: 'rain', city: 'roadworks' }, { cups: 80, price: 7 });
    expect(loss.profit).toBeLessThan(0);
    rec = recordBizDay({ ...rec, till: 5 }, loss);
    expect(rec.till).toBe(0);
    const home = takeHome({ ...rec, till: 42 });
    expect(home.coins).toBe(42);
    expect(home.rec.till).toBe(0);
    expect(upgrade(home.rec)).toEqual(home.rec);
  });

  it('cleans saved data and the plan', () => {
    expect(sanitizeBusinessRecord({ stage: 9, till: -4, days: 'x' })).toMatchObject({ stage: 3, till: 0, days: 0 });
    expect(clampBizPlan(0, { cups: 999, price: 99 })).toEqual({ cups: STAGE_RULES[0].capacity, price: 5 });
  });

  it('the city event depends only on the date', () => {
    expect(cityEventFor('2026-11-01')).toBe(cityEventFor('2026-11-01'));
    const seen = new Set(Array.from({ length: 30 }, (_, i) => cityEventFor(`2026-11-${String(i + 1).padStart(2, '0')}`)));
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});
