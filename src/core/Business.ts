import { mulberry32 } from '../world/cityLayout';

/**
 * "My business": the player's own lemonade business in the plaza. It starts
 * as a small stand and can grow into a cart, a juice shop and a juice bar.
 * Each business day the player reads the weather forecast and the city event,
 * then picks how many cups to prepare and the price. Profit goes into the
 * business till; from there the player decides whether to take it home (their
 * coins) or invest it in the next stage, which serves more customers but costs
 * more to run. The lesson is reinvesting, fixed costs that grow with the
 * business, and payback time.
 *
 * Pure rules with no DOM so they can be unit-tested. Coins are an in-game
 * score only.
 */

export type BizStage = 0 | 1 | 2 | 3;
export const BIZ_STAGES: BizStage[] = [0, 1, 2, 3];

export interface StageRules {
  /** The model drawn in the plaza. */
  model: string;
  /** Model scale, so the four stages read as growing. */
  scale: number;
  /** Customers on an ordinary day at the reference price. */
  customers: number;
  /** Most cups that can be prepared in a day. */
  capacity: number;
  /** Ingredients and a cup, per cup prepared. */
  cupCost: number;
  /** Paid every day whatever happens (rent, a helper, electricity). */
  fixedCost: number;
  /** Price to grow into this stage from the one before (0 for the stand). */
  upgradeCost: number;
  /** Prices on the menu board. */
  prices: number[];
}

export const STAGE_RULES: Record<BizStage, StageRules> = {
  0: { model: 'lemon_stand', scale: 1.2, customers: 24, capacity: 40, cupCost: 2, fixedCost: 0, upgradeCost: 0, prices: [3, 4, 5, 6, 7] },
  1: { model: 'lemon_cart', scale: 1.0, customers: 45, capacity: 80, cupCost: 2, fixedCost: 20, upgradeCost: 250, prices: [3, 4, 5, 6, 7] },
  2: { model: 'juice_shop', scale: 0.72, customers: 90, capacity: 160, cupCost: 2, fixedCost: 70, upgradeCost: 700, prices: [4, 5, 6, 7, 8] },
  3: { model: 'juice_bar', scale: 0.78, customers: 170, capacity: 300, cupCost: 2, fixedCost: 160, upgradeCost: 1800, prices: [4, 5, 6, 7, 8, 9] },
};

export const MAX_STAGE: BizStage = 3;
export const BIZ_BASE_PRICE = 5;

export type WeatherId = 'hot' | 'sunny' | 'cloudy' | 'rain';
/** How the weather changes lemonade customers. */
export const WEATHER: Record<WeatherId, number> = { hot: 1.6, sunny: 1.2, cloudy: 0.85, rain: 0.45 };
const WEATHER_ORDER: WeatherId[] = ['hot', 'sunny', 'cloudy', 'rain'];

export type CityEventId = 'ordinary' | 'festival' | 'marathon' | 'match' | 'market' | 'roadworks' | 'concert';
/** The city's event of the day and how much it changes the number of people in the plaza. */
export const CITY_EVENTS: Record<CityEventId, number> = {
  ordinary: 1,
  festival: 1.7,
  marathon: 1.5,
  match: 1.3,
  market: 1.25,
  roadworks: 0.7,
  concert: 1.45,
};
const CITY_ORDER: CityEventId[] = ['ordinary', 'festival', 'marathon', 'match', 'market', 'roadworks', 'concert', 'ordinary'];

/** A calendar day as YYYY-MM-DD in local time. */
export function dayKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** The city event for a calendar day: the same for everyone on that day, a different one most days. */
export function cityEventFor(key: string): CityEventId {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const rng = mulberry32(h >>> 0);
  return CITY_ORDER[Math.floor(rng() * CITY_ORDER.length)];
}

export interface BizForecast {
  /** The likely weather and the other possibility. */
  likely: WeatherId;
  other: WeatherId;
  /** Chance of the likely weather (from the cart on, forecasts are less sure). */
  chance: number;
}

export interface BizPlan {
  cups: number;
  price: number;
}

export interface BizDay {
  stage: BizStage;
  city: CityEventId;
  forecast: BizForecast;
  /** What really happens (hidden until the day is played). */
  weather: WeatherId;
}

export interface BizResult {
  plan: BizPlan;
  weather: WeatherId;
  city: CityEventId;
  wanted: number;
  sold: number;
  missed: number;
  wasted: number;
  revenue: number;
  cupCost: number;
  fixedCost: number;
  profit: number;
  /** The best profit possible had the weather been known. */
  bestProfit: number;
}

export interface BusinessRecord {
  stage: BizStage;
  /** Coins in the business till (not yet taken home). */
  till: number;
  days: number;
  /** All the profit the business has made, minus losses. */
  earned: number;
  /** The best single day. */
  bestDay: number;
  /** Coins taken home from the till. */
  takenHome: number;
}

export function newBusinessRecord(): BusinessRecord {
  return { stage: 0, till: 0, days: 0, earned: 0, bestDay: 0, takenHome: 0 };
}

const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);

export function sanitizeBusinessRecord(v: unknown): BusinessRecord {
  const s = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    stage: int(s.stage, 0, MAX_STAGE, 0) as BizStage,
    till: int(s.till, 0, 1e7, 0),
    days: int(s.days, 0, 1e6, 0),
    earned: int(s.earned, -1e7, 1e7, 0),
    bestDay: int(s.bestDay, -1e6, 1e6, 0),
    takenHome: int(s.takenHome, 0, 1e7, 0),
  };
}

/** How often each weather is the city's weather of the day (out of 20). */
const WEATHER_ODDS: [WeatherId, number][] = [['sunny', 8], ['hot', 4], ['cloudy', 5], ['rain', 3]];

/** The city's weather for a calendar day: the sky shows it and the business forecast leans on it. */
export function cityWeatherFor(key: string): WeatherId {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const rng = mulberry32((h ^ 0x9e3779b9) >>> 0);
  let roll = rng() * 20;
  for (const [id, n] of WEATHER_ODDS) if ((roll -= n) < 0) return id;
  return 'sunny';
}

/**
 * A new business day. The forecast is sure at the stand and gets less sure as the business grows.
 * `likely` is today's city weather when known, so the sky outside matches the forecast.
 */
export function newBizDay(stage: BizStage, city: CityEventId, seed: number, likelyWeather?: WeatherId): BizDay {
  const rng = mulberry32(seed);
  const rolled = WEATHER_ORDER[Math.floor(rng() * WEATHER_ORDER.length)];
  const likely = likelyWeather ?? rolled;
  let other: WeatherId;
  do other = WEATHER_ORDER[Math.floor(rng() * WEATHER_ORDER.length)];
  while (other === likely);
  const chance = stage === 0 ? 1 : stage === 1 ? 0.8 : 0.7;
  const weather = rng() < chance ? likely : other;
  return { stage, city, forecast: { likely, other, chance }, weather };
}

/** Customers who buy at `price`: each coin above 5 loses about 18%, each coin below gains 8%. */
export function bizDemand(stage: BizStage, weather: WeatherId, city: CityEventId, price: number): number {
  const d = price - BIZ_BASE_PRICE;
  const priceFactor = d >= 0 ? Math.max(0, 1 - 0.18 * d) : 1 + 0.08 * -d;
  return Math.round(STAGE_RULES[stage].customers * WEATHER[weather] * CITY_EVENTS[city] * priceFactor);
}

export function clampBizPlan(stage: BizStage, plan: BizPlan): BizPlan {
  const r = STAGE_RULES[stage];
  const cups = Math.max(0, Math.min(r.capacity, Math.round(plan.cups)));
  const price = r.prices.includes(plan.price) ? plan.price : BIZ_BASE_PRICE;
  return { cups, price };
}

export function settleBiz(stage: BizStage, plan: BizPlan, weather: WeatherId, city: CityEventId): Omit<BizResult, 'bestProfit'> {
  const r = STAGE_RULES[stage];
  const p = clampBizPlan(stage, plan);
  const wanted = bizDemand(stage, weather, city, p.price);
  const sold = Math.min(wanted, p.cups);
  const revenue = sold * p.price;
  const cupCost = p.cups * r.cupCost;
  const profit = revenue - cupCost - r.fixedCost;
  return { plan: p, weather, city, wanted, sold, missed: wanted - sold, wasted: p.cups - sold, revenue, cupCost, fixedCost: r.fixedCost, profit };
}

/** The best plan for a known weather: every price, exactly the demand in cups. */
export function bestBizPlan(stage: BizStage, weather: WeatherId, city: CityEventId): { plan: BizPlan; profit: number } {
  const r = STAGE_RULES[stage];
  let best = { plan: { cups: 0, price: BIZ_BASE_PRICE }, profit: -Infinity };
  for (const price of r.prices) {
    const cups = Math.min(r.capacity, bizDemand(stage, weather, city, price));
    const profit = settleBiz(stage, { cups, price }, weather, city).profit;
    if (profit > best.profit) best = { plan: { cups, price }, profit };
  }
  return best;
}

export function playBizDay(day: BizDay, plan: BizPlan): BizResult {
  return { ...settleBiz(day.stage, plan, day.weather, day.city), bestProfit: bestBizPlan(day.stage, day.weather, day.city).profit };
}

/**
 * Applies a day's result to the record. Profit goes into the till; a loss is
 * paid from the till, and what the till can't cover is simply lost (the till
 * never goes below zero).
 */
export function recordBizDay(rec: BusinessRecord, r: BizResult): BusinessRecord {
  return {
    ...rec,
    till: Math.max(0, rec.till + r.profit),
    days: rec.days + 1,
    earned: rec.earned + r.profit,
    bestDay: rec.days === 0 ? r.profit : Math.max(rec.bestDay, r.profit),
  };
}

/** 0-3 stars: how close the day came to the best possible. */
export function bizStars(r: BizResult): number {
  if (r.profit <= 0 || r.bestProfit <= 0) return 0;
  const ratio = r.profit / r.bestProfit;
  return [0.5, 0.75, 0.9].filter((b) => ratio >= b).length;
}

export function nextStage(rec: BusinessRecord): BizStage | null {
  return rec.stage < MAX_STAGE ? ((rec.stage + 1) as BizStage) : null;
}

export function canUpgrade(rec: BusinessRecord): boolean {
  const n = nextStage(rec);
  return n !== null && rec.till >= STAGE_RULES[n].upgradeCost;
}

export function upgrade(rec: BusinessRecord): BusinessRecord {
  const n = nextStage(rec);
  if (n === null || !canUpgrade(rec)) return rec;
  return { ...rec, stage: n, till: rec.till - STAGE_RULES[n].upgradeCost };
}

/** Takes the till home. Returns the new record and how many coins moved. */
export function takeHome(rec: BusinessRecord): { rec: BusinessRecord; coins: number } {
  return { rec: { ...rec, till: 0, takenHome: rec.takenHome + rec.till }, coins: rec.till };
}

/**
 * Roughly how many ordinary sunny days the next stage needs to earn back its
 * price, compared with staying put. null when it never pays back.
 */
export function paybackDays(stage: BizStage): number | null {
  if (stage >= MAX_STAGE) return null;
  const n = (stage + 1) as BizStage;
  const now = bestBizPlan(stage, 'sunny', 'ordinary').profit;
  const then = bestBizPlan(n, 'sunny', 'ordinary').profit;
  const gain = then - now;
  return gain > 0 ? Math.ceil(STAGE_RULES[n].upgradeCost / gain) : null;
}

/** Which lesson to show after a day. */
export function bizTip(r: BizResult): 'great' | 'missed' | 'wasted' | 'price' | 'loss' {
  if (r.profit < 0) return 'loss';
  if (r.bestProfit > 0 && r.profit >= r.bestProfit * 0.9) return 'great';
  if (r.missed > Math.max(3, r.wanted * 0.15)) return 'missed';
  if (r.wasted > Math.max(3, r.plan.cups * 0.15)) return 'wasted';
  return 'price';
}

/**
 * The day's result when the player worked the counter: the people who came
 * are the same as in `playBizDay`, but only the cups actually served count as
 * sold (customers who waited too long or found the line too long went home).
 */
export function playServedDay(day: BizDay, plan: BizPlan, sold: number): BizResult {
  const r = STAGE_RULES[day.stage];
  const p = clampBizPlan(day.stage, plan);
  const wanted = bizDemand(day.stage, day.weather, day.city, p.price);
  const s = Math.max(0, Math.min(sold, wanted, p.cups));
  const revenue = s * p.price;
  const cupCost = p.cups * r.cupCost;
  return {
    plan: p,
    weather: day.weather,
    city: day.city,
    wanted,
    sold: s,
    missed: wanted - s,
    wasted: p.cups - s,
    revenue,
    cupCost,
    fixedCost: r.fixedCost,
    profit: revenue - cupCost - r.fixedCost,
    bestProfit: bestBizPlan(day.stage, day.weather, day.city).profit,
  };
}
