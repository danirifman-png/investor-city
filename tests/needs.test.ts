import { describe, expect, it } from 'vitest';
import { ENERGY_FLOOR_HOMELESS, FOOD_VALUES } from '../src/content/needs';
import { FURNITURE } from '../src/content/home';
import { SHOP_ITEMS } from '../src/content/shop';
import { consume, drain, lowNeeds, needSpeed, newNeeds, sanitizeNeeds, sleep } from '../src/core/Needs';

describe('needs', () => {
  it('go down slowly while playing, and energy keeps a floor without a home', () => {
    const n = drain(newNeeds(), 600, true);
    expect(n.food).toBeLessThan(100);
    expect(n.water).toBeLessThan(n.food);
    expect(drain(newNeeds(), 36000, false).energy).toBe(ENERGY_FLOOR_HOMELESS);
    expect(drain(newNeeds(), 36000, true).energy).toBe(0);
  });

  it('are filled by eating, drinking and sleeping, never above 100', () => {
    const empty = { energy: 0, food: 0, water: 0 };
    expect(consume(empty, 'pizzaSlice').food).toBe(FOOD_VALUES.pizzaSlice.food);
    expect(consume(empty, 'water').water).toBe(45);
    expect(consume(newNeeds(), 'pizzaSlice').food).toBe(100);
    expect(consume(empty, 'crown')).toEqual(empty);
    expect(sleep(empty, 65).energy).toBe(65);
    expect(sleep({ ...empty, energy: 80 }, 65).energy).toBe(80);
  });

  it('only slow the hero a little', () => {
    expect(needSpeed(newNeeds())).toBe(1);
    expect(needSpeed({ energy: 100, food: 10, water: 100 })).toBeGreaterThan(0.85);
    expect(needSpeed({ energy: 0, food: 0, water: 0 })).toBe(0.8);
    expect(lowNeeds({ energy: 100, food: 10, water: 20 })).toEqual(['food', 'water']);
  });

  it('sanitizes saved values', () => {
    expect(sanitizeNeeds(null)).toEqual(newNeeds());
    expect(sanitizeNeeds({ energy: 150, food: -3, water: 'x' })).toEqual({ energy: 100, food: 0, water: 100 });
  });

  it('every food in the shop fills something and every furniture item has a spot at home', () => {
    for (const i of SHOP_ITEMS) {
      if (i.category === 'food') expect(FOOD_VALUES[i.id], i.id).toBeTruthy();
      if (i.furniture) expect(FURNITURE[i.id], i.id).toBeTruthy();
    }
  });
});
