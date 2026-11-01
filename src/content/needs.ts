/**
 * DATA: the hero's everyday needs: energy, food and water (0 to 100). They go
 * down slowly while playing (never while away), and come back by sleeping,
 * eating and drinking. Running low only slows the hero a little and shows a
 * hint; nothing is lost. Free options always exist (water at home, a nap).
 */

export type NeedId = 'energy' | 'food' | 'water';
export const NEED_IDS: NeedId[] = ['energy', 'food', 'water'];

/** Points lost per minute of play. */
export const NEED_DRAIN: Record<NeedId, number> = { energy: 1.4, food: 1.8, water: 2.4 };

/** Below this a need is "low": a hint and an icon. */
export const NEED_LOW = 25;

/** Without a home of your own, energy does not go below this (a home gives real rest). */
export const ENERGY_FLOOR_HOMELESS = 35;

/** What each food from the market and mall gives. */
export const FOOD_VALUES: Record<string, Partial<Record<NeedId, number>>> = {
  iceCream: { food: 10, water: 5 },
  pizzaSlice: { food: 35 },
  milkshake: { food: 10, water: 30 },
  cottonCandy: { food: 5 },
  popcorn: { food: 10 },
  apple: { food: 20, water: 5 },
  water: { water: 45 },
  sandwich: { food: 40, water: 5 },
};

/** At home: a cooked meal costs a little (cheaper than eating out), tap water is free. */
export const HOME_MEAL = { price: 3, food: 55, water: 20 };
export const TAP_WATER = 60;

/** Sleeping in a bed fills energy; on the floor without a bed, only part of it. */
export const SLEEP_BED = 100;
export const SLEEP_FLOOR = 65;
