/**
 * DATA: what the player can buy with game coins. Coins are an in-game score
 * only; nothing here is real money. Text lives in `he.shop.json` as
 * `shop.item.<id>.name`, `.desc` and, for some, `.lesson`.
 *
 * Every price is meant to be saved up for: cheap treats cost a few coins,
 * rides cost as much as several missions, and the best things also need a
 * higher level. There are no sales, timers or "only today" offers.
 */

export type ShopCategory = 'food' | 'clothes' | 'rides' | 'pets' | 'fun';
export const SHOP_CATEGORIES: ShopCategory[] = ['food', 'clothes', 'rides', 'pets', 'fun'];

/** Where a worn item goes on the hero. */
export type Slot = 'hat' | 'glasses' | 'back' | 'feet' | 'ride' | 'pet';

export type ItemKind =
  /** Used up when bought (food, fireworks). */
  | 'treat'
  /** Kept, worn or ridden, can be sold back for less. */
  | 'keep';

export interface ShopItem {
  id: string;
  category: ShopCategory;
  kind: ItemKind;
  price: number;
  /** Lowest player level that may buy it. */
  level: number;
  icon: string;
  slot?: Slot;
  /** A need or a want, shown on the card as a small lesson. */
  need: boolean;
  /** Rides: speed multiplier while riding (the plain scooter is 1). Shoes: walking and running. */
  speed?: number;
  /** Pets: coins of food per day. */
  upkeep?: number;
  /** A cheaper item that does the same job (the logo lesson). */
  sameAs?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  // food: used up at once, a small joy and a fun fact
  { id: 'iceCream', category: 'food', kind: 'treat', price: 4, level: 1, icon: '🍦', need: false },
  { id: 'pizzaSlice', category: 'food', kind: 'treat', price: 5, level: 1, icon: '🍕', need: true },
  { id: 'milkshake', category: 'food', kind: 'treat', price: 6, level: 1, icon: '🥤', need: false },
  { id: 'cottonCandy', category: 'food', kind: 'treat', price: 4, level: 1, icon: '🍭', need: false },
  { id: 'popcorn', category: 'food', kind: 'treat', price: 3, level: 1, icon: '🍿', need: false },
  { id: 'apple', category: 'food', kind: 'treat', price: 2, level: 1, icon: '🍎', need: true },
  // clothes: the same cap with and without a logo
  { id: 'sneakers', category: 'clothes', kind: 'keep', price: 40, level: 1, icon: '👟', slot: 'feet', need: true, speed: 1.15 },
  { id: 'capPlain', category: 'clothes', kind: 'keep', price: 15, level: 1, icon: '🧢', slot: 'hat', need: false },
  { id: 'capBrand', category: 'clothes', kind: 'keep', price: 35, level: 1, icon: '🧢', slot: 'hat', need: false, sameAs: 'capPlain' },
  { id: 'beanie', category: 'clothes', kind: 'keep', price: 18, level: 1, icon: '🧶', slot: 'hat', need: false },
  { id: 'sunHat', category: 'clothes', kind: 'keep', price: 22, level: 2, icon: '👒', slot: 'hat', need: false },
  { id: 'sunglasses', category: 'clothes', kind: 'keep', price: 25, level: 2, icon: '🕶️', slot: 'glasses', need: false },
  { id: 'backpack', category: 'clothes', kind: 'keep', price: 30, level: 2, icon: '🎒', slot: 'back', need: true },
  { id: 'crown', category: 'clothes', kind: 'keep', price: 90, level: 5, icon: '👑', slot: 'hat', need: false },
  // rides: faster than walking, sold back for less (depreciation)
  { id: 'skateboard', category: 'rides', kind: 'keep', price: 60, level: 2, icon: '🛹', slot: 'ride', need: false, speed: 1.1 },
  { id: 'scooterPro', category: 'rides', kind: 'keep', price: 120, level: 3, icon: '🛴', slot: 'ride', need: false, speed: 1.25 },
  { id: 'bicycle', category: 'rides', kind: 'keep', price: 180, level: 4, icon: '🚲', slot: 'ride', need: false, speed: 1.4 },
  { id: 'goKart', category: 'rides', kind: 'keep', price: 400, level: 6, icon: '🏎️', slot: 'ride', need: false, speed: 1.6 },
  { id: 'hoverboard', category: 'rides', kind: 'keep', price: 700, level: 8, icon: '🛸', slot: 'ride', need: false, speed: 1.75 },
  // pets: a friend that follows you and eats every day
  { id: 'dog', category: 'pets', kind: 'keep', price: 150, level: 3, icon: '🐶', slot: 'pet', need: false, upkeep: 3 },
  { id: 'cat', category: 'pets', kind: 'keep', price: 130, level: 3, icon: '🐱', slot: 'pet', need: false, upkeep: 2 },
  { id: 'robotPet', category: 'pets', kind: 'keep', price: 260, level: 5, icon: '🤖', slot: 'pet', need: false, upkeep: 1 },
  // fun
  { id: 'balloon', category: 'fun', kind: 'keep', price: 8, level: 1, icon: '🎈', slot: 'back', need: false },
  { id: 'fireworks', category: 'fun', kind: 'treat', price: 25, level: 2, icon: '🎆', need: false },
];

export const SHOP_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i]));

/** What a kept item sells back for: 60% of the price (things lose value once used). */
export const RESALE = 0.6;
