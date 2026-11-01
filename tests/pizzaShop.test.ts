import { describe, expect, it } from 'vitest';
import { bestPlan, DAY_EVENTS, dayOver, demand, LEVEL_RULES, newDay, playShift, sanitizeShopRecord, settle, SHOP_LEVELS, summarize } from '../src/core/PizzaShop';

describe('pizza shop day', () => {
  it('demand falls as the price rises', () => {
    const e = DAY_EVENTS.sunny;
    expect(demand(e, 10)).toBe(22);
    expect(demand(e, 8)).toBeGreaterThan(demand(e, 10));
    expect(demand(e, 14)).toBeLessThan(demand(e, 10));
  });

  it('settles revenue, costs and waste', () => {
    const r = settle('adventurer', { dough: 30, price: 10 }, 'sunny');
    expect(r.sold).toBe(22);
    expect(r.wasted).toBe(8);
    expect(r.revenue).toBe(220);
    expect(r.variableCost).toBe(120);
    expect(r.profit).toBe(220 - 120 - LEVEL_RULES.adventurer.fixedCost);
  });

  it('running out loses customers', () => {
    const r = settle('explorer', { dough: 10, price: 99 }, 'festival');
    expect(r.plan.price).toBe(10); // the explorer price is fixed
    expect(r.missed).toBe(30);
    expect(r.wasted).toBe(0);
  });

  it('the best plan is never beaten', () => {
    for (const level of SHOP_LEVELS) {
      for (const ev of Object.keys(DAY_EVENTS) as (keyof typeof DAY_EVENTS)[]) {
        const best = bestPlan(level, ev).profit;
        for (const price of LEVEL_RULES[level].prices) {
          for (let dough = 0; dough <= 50; dough += 3) expect(settle(level, { dough, price }, ev).profit).toBeLessThanOrEqual(best);
        }
      }
    }
  });

  it('is deterministic per seed and plays three shifts', () => {
    expect(newDay('pro', 7)).toEqual(newDay('pro', 7));
    const day = newDay('explorer', 3);
    expect(day.forecasts.every((f) => f.events.length === 1)).toBe(true);
    while (!dayOver(day)) playShift(day, bestPlan('explorer', day.actual[day.results.length]).plan);
    expect(day.results).toHaveLength(3);
    expect(playShift(day, { dough: 1, price: 10 })).toBeNull();
    expect(summarize(day).stars).toBe(3);
  });

  it('a bad day earns no stars or coins', () => {
    const day = newDay('adventurer', 11);
    while (!dayOver(day)) playShift(day, { dough: 50, price: 8 });
    const s = summarize(day);
    if (s.profit <= 0) {
      expect(s.stars).toBe(0);
      expect(s.coins).toBe(0);
    }
  });

  it('uncertain forecasts name two events', () => {
    const day = newDay('pro', 5);
    for (let i = 0; i < 3; i++) {
      expect(day.forecasts[i].events).toHaveLength(2);
      expect(day.forecasts[i].events).toContain(day.actual[i]);
    }
  });

  it('sanitizes the saved record', () => {
    expect(sanitizeShopRecord({ best: { explorer: 9, pro: 'x' }, days: -2 })).toEqual({ best: { explorer: 3, adventurer: 0, pro: 0 }, days: 0 });
  });
});
