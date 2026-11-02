import { describe, expect, it } from 'vitest';
import { planService, RECIPES, SERVICE, ServiceRun } from '../src/core/Service';

describe('service', () => {
  it('splits the demand into customers over the day', () => {
    const o = planService(40, 7);
    expect(o.reduce((s, x) => s + x.cups, 0)).toBe(40);
    expect(o.length).toBeGreaterThanOrEqual(SERVICE.minCustomers);
    expect(o.length).toBeLessThanOrEqual(SERVICE.maxCustomers);
    for (let i = 1; i < o.length; i++) expect(o[i].at).toBeGreaterThanOrEqual(o[i - 1].at);
    expect(o.at(-1)!.at).toBeLessThan(SERVICE.seconds);
    expect(planService(0, 1)).toEqual([]);
    expect(planService(2, 1).reduce((s, x) => s + x.cups, 0)).toBe(2);
    expect(planService(40, 7)).toEqual(o);
  });

  it('steps must follow the recipe, then the first in line is served', () => {
    const run = new ServiceRun([{ id: 0, at: 0, cups: 2, patience: 20, look: 0 }], 10, RECIPES.lemonade);
    expect(run.update(0.1)[0].kind).toBe('arrive');
    expect(run.serve()).toBeNull();
    expect(run.step('ice')).toBe(false);
    for (const s of RECIPES.lemonade.steps) expect(run.step(s)).toBe(true);
    const e = run.serve()!;
    expect(e.kind).toBe('served');
    expect(run.sold).toBe(2);
    expect(run.stock).toBe(8);
    expect(run.over).toBe(true);
  });

  it('the oven takes time', () => {
    const run = new ServiceRun([{ id: 0, at: 0, cups: 1, patience: 20, look: 0 }], 5, RECIPES.pizza);
    run.update(0.1);
    for (const s of ['dough', 'sauce', 'cheese', 'oven'] as const) run.step(s);
    expect(run.step('slice')).toBe(false);
    run.update(3.1);
    expect(run.step('slice')).toBe(true);
    expect(run.serve()?.kind).toBe('served');
  });

  it('customers leave after waiting too long, or when the line is too long', () => {
    const many = Array.from({ length: SERVICE.maxLine + 2 }, (_, i) => ({ id: i, at: 0, cups: 1, patience: 5, look: 0 }));
    const run = new ServiceRun(many, 50, RECIPES.lemonade);
    const ev = run.update(0.1);
    expect(ev.filter((e) => e.kind === 'left').length).toBe(2);
    expect(run.leftLine).toBe(2);
    run.update(6);
    expect(run.line.length).toBe(0);
    expect(run.leftWaiting).toBe(SERVICE.maxLine);
  });

  it('stock runs out', () => {
    const run = new ServiceRun([{ id: 0, at: 0, cups: 3, patience: 20, look: 0 }], 2, RECIPES.lemonade);
    run.update(0.1);
    for (const s of RECIPES.lemonade.steps) run.step(s);
    expect(run.serve()).toMatchObject({ kind: 'served', cups: 2 });
    expect(run.stock).toBe(0);
  });
});

import { bizDemand, newBizDay, playBizDay, playServedDay } from '../src/core/Business';
describe('a served business day', () => {
  it('counts only what was served', () => {
    const day = newBizDay(0, 'ordinary', 42);
    const plan = { cups: 30, price: 5 };
    const auto = playBizDay(day, plan);
    const all = playServedDay(day, plan, 999);
    expect(all.sold).toBe(auto.sold);
    expect(all.profit).toBe(auto.profit);
    const part = playServedDay(day, plan, 5);
    expect(part.sold).toBe(Math.min(5, bizDemand(0, day.weather, 'ordinary', 5)));
    expect(part.missed + part.sold).toBe(part.wanted);
    expect(part.wasted).toBe(30 - part.sold);
  });
});

import { newDay, playServedShift, playShift, shiftDemand } from '../src/core/PizzaShop';
describe('a shift in the kitchen', () => {
  it('counts only the pizzas served', () => {
    const a = newDay('explorer', 9);
    const b = newDay('explorer', 9);
    const plan = { dough: 20, price: 10 };
    const want = shiftDemand(a, 10);
    expect(want).toBeGreaterThan(0);
    const auto = playShift(a, plan)!;
    const all = playServedShift(b, plan, 999)!;
    expect(all.profit).toBe(auto.profit);
    const c = newDay('explorer', 9);
    const part = playServedShift(c, plan, 3)!;
    expect(part.sold).toBe(Math.min(3, want));
    expect(part.wasted).toBe(20 - part.sold);
  });
});
