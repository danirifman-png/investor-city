import { mulberry32 } from '../world/cityLayout';

/**
 * "A day at Marco's": the player runs the pizzeria for three shifts. Before
 * each shift they read the forecast and decide how many pizza doughs to
 * prepare (and, from the second level, the price). Customers come according to
 * the day's event and the price; unsold dough is thrown away. The lesson is
 * revenue, costs and profit, and that both too little and too much stock cost
 * money.
 *
 * Pure rules with no DOM, so they can be unit-tested. Everything is
 * deterministic for a given seed; coins earned are an in-game score only.
 */

export type ShopLevel = 'explorer' | 'adventurer' | 'pro';
export const SHOP_LEVELS: ShopLevel[] = ['explorer', 'adventurer', 'pro'];

export type DayEventId = 'quiet' | 'sunny' | 'rain' | 'match' | 'festival' | 'school';

export interface DayEvent {
  id: DayEventId;
  /** Customers at the reference price. */
  customers: number;
}

export const DAY_EVENTS: Record<DayEventId, DayEvent> = {
  quiet: { id: 'quiet', customers: 14 },
  sunny: { id: 'sunny', customers: 22 },
  rain: { id: 'rain', customers: 9 },
  match: { id: 'match', customers: 34 },
  festival: { id: 'festival', customers: 40 },
  school: { id: 'school', customers: 26 },
};

export interface LevelRules {
  shifts: number;
  /** The price is fixed at this level (the player picks only the dough). */
  fixedPrice: number | null;
  prices: number[];
  /** Cost of one dough with toppings, in coins. */
  doughCost: number;
  /** Paid every shift whatever happens (rent, electricity). 0 hides it. */
  fixedCost: number;
  /** The forecast names two possible events instead of the sure one. */
  uncertain: boolean;
  maxDough: number;
}

export const LEVEL_RULES: Record<ShopLevel, LevelRules> = {
  explorer: { shifts: 3, fixedPrice: 10, prices: [10], doughCost: 4, fixedCost: 0, uncertain: false, maxDough: 50 },
  adventurer: { shifts: 3, fixedPrice: null, prices: [8, 10, 12, 14], doughCost: 4, fixedCost: 30, uncertain: false, maxDough: 50 },
  pro: { shifts: 3, fixedPrice: null, prices: [8, 10, 12, 14, 16], doughCost: 5, fixedCost: 40, uncertain: true, maxDough: 50 },
};

/** The reference price at which the event's customer count holds. */
export const BASE_PRICE = 10;

/** How many customers buy at `price`: each coin above 10 loses about 9%, each coin below gains 7%. */
export function demand(event: DayEvent, price: number): number {
  const d = price - BASE_PRICE;
  const factor = d >= 0 ? Math.max(0, 1 - 0.09 * d) : 1 + 0.07 * -d;
  return Math.round(event.customers * factor);
}

export interface Forecast {
  /** The events that may happen; one entry when the forecast is sure. */
  events: DayEventId[];
  /** The chance of the first event, for an uncertain forecast. */
  chance: number;
}

export interface ShiftPlan {
  dough: number;
  price: number;
}

export interface ShiftResult {
  plan: ShiftPlan;
  event: DayEventId;
  wanted: number;
  sold: number;
  /** Customers who left because the dough ran out. */
  missed: number;
  /** Doughs thrown away at closing. */
  wasted: number;
  revenue: number;
  variableCost: number;
  fixedCost: number;
  profit: number;
  /** The best profit possible had the player known the real event. */
  bestProfit: number;
}

export interface ShopDay {
  level: ShopLevel;
  seed: number;
  forecasts: Forecast[];
  /** What actually happens each shift (hidden from the player until it is played). */
  actual: DayEventId[];
  results: ShiftResult[];
}

const EVENT_ORDER: DayEventId[] = ['quiet', 'sunny', 'rain', 'match', 'festival', 'school'];

export function newDay(level: ShopLevel, seed: number): ShopDay {
  const rng = mulberry32(seed);
  const rules = LEVEL_RULES[level];
  const forecasts: Forecast[] = [];
  const actual: DayEventId[] = [];
  let last: DayEventId | null = null;
  for (let i = 0; i < rules.shifts; i++) {
    let a: DayEventId;
    do a = EVENT_ORDER[Math.floor(rng() * EVENT_ORDER.length)];
    while (a === last);
    last = a;
    if (!rules.uncertain) {
      forecasts.push({ events: [a], chance: 1 });
      actual.push(a);
      continue;
    }
    // two candidates; the real one is the likely one about 70% of the time
    let b: DayEventId;
    do b = EVENT_ORDER[Math.floor(rng() * EVENT_ORDER.length)];
    while (b === a);
    const chance = rng() < 0.5 ? 0.7 : 0.6;
    forecasts.push({ events: [a, b], chance });
    actual.push(rng() < chance ? a : b);
  }
  return { level, seed, forecasts, actual, results: [] };
}

export function clampPlan(level: ShopLevel, plan: ShiftPlan): ShiftPlan {
  const rules = LEVEL_RULES[level];
  const dough = Math.max(0, Math.min(rules.maxDough, Math.round(plan.dough)));
  const price = rules.fixedPrice ?? (rules.prices.includes(plan.price) ? plan.price : BASE_PRICE);
  return { dough, price };
}

/** Profit for a plan when the event is known. */
export function settle(level: ShopLevel, plan: ShiftPlan, event: DayEventId): Omit<ShiftResult, 'bestProfit'> {
  const rules = LEVEL_RULES[level];
  const p = clampPlan(level, plan);
  const wanted = demand(DAY_EVENTS[event], p.price);
  const sold = Math.min(wanted, p.dough);
  const revenue = sold * p.price;
  const variableCost = p.dough * rules.doughCost;
  const profit = revenue - variableCost - rules.fixedCost;
  return { plan: p, event, wanted, sold, missed: wanted - sold, wasted: p.dough - sold, revenue, variableCost, fixedCost: rules.fixedCost, profit };
}

/** The best plan when the event is known: every price, exactly the demand in dough. */
export function bestPlan(level: ShopLevel, event: DayEventId): { plan: ShiftPlan; profit: number } {
  const rules = LEVEL_RULES[level];
  let best = { plan: { dough: 0, price: rules.fixedPrice ?? BASE_PRICE }, profit: -Infinity };
  for (const price of rules.fixedPrice ? [rules.fixedPrice] : rules.prices) {
    const dough = Math.min(rules.maxDough, demand(DAY_EVENTS[event], price));
    const profit = settle(level, { dough, price }, event).profit;
    if (profit > best.profit) best = { plan: { dough, price }, profit };
  }
  return best;
}

/** Plays the next shift. Returns null once the day is over. */
export function playShift(day: ShopDay, plan: ShiftPlan): ShiftResult | null {
  const i = day.results.length;
  if (i >= day.actual.length) return null;
  const event = day.actual[i];
  const result: ShiftResult = { ...settle(day.level, plan, event), bestProfit: bestPlan(day.level, event).profit };
  day.results.push(result);
  return result;
}

export function dayOver(day: ShopDay): boolean {
  return day.results.length >= day.actual.length;
}

export interface DaySummary {
  profit: number;
  bestProfit: number;
  wasted: number;
  missed: number;
  /** 0-3: how close the day came to the best possible. */
  stars: number;
  /** In-game coins for the bag: a share of the profit, never negative. */
  coins: number;
  xp: number;
}

export function summarize(day: ShopDay): DaySummary {
  const sum = (f: (r: ShiftResult) => number) => day.results.reduce((a, r) => a + f(r), 0);
  const profit = sum((r) => r.profit);
  const bestProfit = sum((r) => r.bestProfit);
  const ratio = bestProfit > 0 ? profit / bestProfit : 0;
  // an uncertain forecast makes the best plan unreachable, so the bar is lower
  const bar = LEVEL_RULES[day.level].uncertain ? [0.45, 0.65, 0.8] : [0.55, 0.75, 0.9];
  const stars = profit <= 0 ? 0 : bar.filter((b) => ratio >= b).length;
  return {
    profit,
    bestProfit,
    wasted: sum((r) => r.wasted),
    missed: sum((r) => r.missed),
    stars,
    coins: Math.max(0, Math.round(profit / 10)),
    xp: 20 + stars * 15,
  };
}

/** The main lesson of a shift, as a locale key under `shop.tip.`. */
export function shiftTip(r: ShiftResult): string {
  if (r.profit < 0 && r.wasted > r.sold) return 'tooMuch';
  if (r.missed >= 5) return 'ranOut';
  if (r.wasted >= 5) return 'waste';
  if (r.profit >= r.bestProfit * 0.95) return 'perfect';
  return 'good';
}

export interface ShopRecord {
  /** Best stars per level. */
  best: Record<ShopLevel, number>;
  days: number;
}

export function newShopRecord(): ShopRecord {
  return { best: { explorer: 0, adventurer: 0, pro: 0 }, days: 0 };
}

export function sanitizeShopRecord(raw: unknown): ShopRecord {
  const out = newShopRecord();
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  const best = (src.best ?? {}) as Record<string, unknown>;
  for (const l of SHOP_LEVELS) {
    const v = Number(best[l]);
    out.best[l] = Number.isFinite(v) ? Math.max(0, Math.min(3, Math.round(v))) : 0;
  }
  const days = Number(src.days);
  out.days = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
  return out;
}

/** Plays the next shift worked in the kitchen: only the pizzas actually served count as sold. */
export function playServedShift(day: ShopDay, plan: ShiftPlan, served: number): ShiftResult | null {
  const i = day.results.length;
  if (i >= day.actual.length) return null;
  const event = day.actual[i];
  const rules = LEVEL_RULES[day.level];
  const p = clampPlan(day.level, plan);
  const wanted = demand(DAY_EVENTS[event], p.price);
  const sold = Math.max(0, Math.min(served, wanted, p.dough));
  const revenue = sold * p.price;
  const variableCost = p.dough * rules.doughCost;
  const result: ShiftResult = {
    plan: p,
    event,
    wanted,
    sold,
    missed: wanted - sold,
    wasted: p.dough - sold,
    revenue,
    variableCost,
    fixedCost: rules.fixedCost,
    profit: revenue - variableCost - rules.fixedCost,
    bestProfit: bestPlan(day.level, event).profit,
  };
  day.results.push(result);
  return result;
}

/** How many customers come to the next shift at this price. */
export function shiftDemand(day: ShopDay, price: number): number {
  const event = day.actual[day.results.length];
  return event ? demand(DAY_EVENTS[event], price) : 0;
}
