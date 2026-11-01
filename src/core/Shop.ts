import { RESALE, SHOP_BY_ID, type ShopItem, type Slot } from '../content/shop';

/**
 * Buying, wearing and selling shop items. Pure logic on plain data, so it is
 * tested without the game. Coins live in the progression state; these
 * functions take the wallet and return how it changes.
 */

export interface ShopState {
  /** Kept items the player owns. */
  owned: string[];
  /** What is worn or ridden in each slot. */
  equipped: Partial<Record<Slot, string>>;
  /** The last day pet food was paid for (day key, YYYY-MM-DD). */
  fedDay: string | null;
  /** How many treats were eaten, for fun facts and stats. */
  treats: number;
}

export function newShop(): ShopState {
  return { owned: [], equipped: {}, fedDay: null, treats: 0 };
}

export type BuyCheck = 'ok' | 'level' | 'coins' | 'owned';

export function canBuy(s: ShopState, item: ShopItem, level: number, coins: number): BuyCheck {
  if (item.kind === 'keep' && s.owned.includes(item.id)) return 'owned';
  if (level < item.level) return 'level';
  if (coins < item.price) return 'coins';
  return 'ok';
}

/** Buys an item; kept items are put on at once. Returns the coins spent (0 when not allowed). */
export function buy(s: ShopState, id: string, level: number, coins: number, today: string): { shop: ShopState; spent: number } {
  const item = SHOP_BY_ID[id];
  if (!item || canBuy(s, item, level, coins) !== 'ok') return { shop: s, spent: 0 };
  const next: ShopState = { ...s, owned: [...s.owned], equipped: { ...s.equipped } };
  if (item.kind === 'treat') next.treats++;
  else {
    next.owned.push(id);
    if (item.slot) next.equipped[item.slot] = id;
    // a new pet has eaten today
    if (item.slot === 'pet') next.fedDay = today;
  }
  return { shop: next, spent: item.price };
}

export function sellPrice(item: ShopItem): number {
  return Math.floor(item.price * RESALE);
}

/** Sells a kept item back for less than it cost. Returns the coins received. */
export function sell(s: ShopState, id: string): { shop: ShopState; coins: number } {
  const item = SHOP_BY_ID[id];
  if (!item || item.kind !== 'keep' || !s.owned.includes(id)) return { shop: s, coins: 0 };
  const equipped = { ...s.equipped };
  if (item.slot && equipped[item.slot] === id) delete equipped[item.slot];
  return { shop: { ...s, owned: s.owned.filter((o) => o !== id), equipped }, coins: sellPrice(item) };
}

/** Puts on an owned item, or takes it off when it is already on. */
export function toggleEquip(s: ShopState, id: string): ShopState {
  const item = SHOP_BY_ID[id];
  if (!item?.slot || !s.owned.includes(id)) return s;
  const equipped = { ...s.equipped };
  if (equipped[item.slot] === id) delete equipped[item.slot];
  else equipped[item.slot] = id;
  return { ...s, equipped };
}

/** The ride's speed multiplier (1 without a bought ride). */
export function rideSpeed(s: ShopState): number {
  const id = s.equipped.ride;
  return (id && SHOP_BY_ID[id]?.speed) || 1;
}

/** Running shoes make walking and running faster. */
export function walkSpeed(s: ShopState): number {
  const id = s.equipped.feet;
  return (id && SHOP_BY_ID[id]?.speed) || 1;
}

const DAY = 86_400_000;
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

/**
 * Pet food for every day since the last meal, paid from the wallet when the
 * player comes back. At most 7 days are charged (the pet is looked after by
 * a neighbour beyond that). When the wallet cannot pay, the pet waits at home
 * (unequipped, still owned) until it can: nothing bad happens to it.
 */
export function payUpkeep(s: ShopState, coins: number, today: string): { shop: ShopState; spent: number; days: number; home: boolean } {
  const id = s.equipped.pet;
  const item = id ? SHOP_BY_ID[id] : undefined;
  if (!item?.upkeep || !s.fedDay) return { shop: s, spent: 0, days: 0, home: false };
  const days = Math.min(7, Math.max(0, daysBetween(s.fedDay, today)));
  if (days === 0) return { shop: s, spent: 0, days: 0, home: false };
  const cost = days * item.upkeep;
  if (coins < cost) {
    const equipped = { ...s.equipped };
    delete equipped.pet;
    return { shop: { ...s, equipped, fedDay: today }, spent: 0, days, home: true };
  }
  return { shop: { ...s, fedDay: today }, spent: cost, days, home: false };
}

export function sanitizeShop(raw: unknown): ShopState {
  const base = newShop();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const owned = Array.isArray(r.owned) ? r.owned.filter((x): x is string => typeof x === 'string' && SHOP_BY_ID[x]?.kind === 'keep') : [];
  const equipped: Partial<Record<Slot, string>> = {};
  if (r.equipped && typeof r.equipped === 'object') {
    for (const [slot, id] of Object.entries(r.equipped as Record<string, unknown>)) {
      if (typeof id === 'string' && owned.includes(id) && SHOP_BY_ID[id]?.slot === slot) equipped[slot as Slot] = id;
    }
  }
  const fedDay = typeof r.fedDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.fedDay) ? r.fedDay : null;
  const treats = typeof r.treats === 'number' && Number.isFinite(r.treats) ? Math.max(0, Math.floor(r.treats)) : 0;
  return { owned: [...new Set(owned)], equipped, fedDay, treats };
}
