/**
 * DATA and rules: the travel agency in the mall sells a return trip to
 * Adventure Island. Two classes fly the same plane to the same place; the
 * comfort class costs almost twice as much for a softer seat and a snack, so
 * the player compares what they get for the extra coins. Coins only buy the
 * ticket here; the flight home is included. Pure logic, no DOM.
 */

export type TripClass = 'economy' | 'comfort';

export interface TripTicket {
  id: TripClass;
  price: number;
  icon: string;
}

export const TICKETS: Record<TripClass, TripTicket> = {
  economy: { id: 'economy', price: 40, icon: '🎫' },
  comfort: { id: 'comfort', price: 75, icon: '🛋️' },
};

export const TRIP_CLASSES = Object.keys(TICKETS) as TripClass[];

/** A coconut drink at the beach stand: holidays have their own small costs. */
export const COCONUT = { price: 3, water: 35, food: 10 };

export type BuyResult = { ok: true; wallet: number; price: number } | { ok: false; missing: number; price: number };

/** Buys a ticket from the wallet, or says how many coins are missing. */
export function buyTicket(wallet: number, cls: TripClass): BuyResult {
  const price = TICKETS[cls].price;
  if (wallet < price) return { ok: false, missing: price - wallet, price };
  return { ok: true, wallet: wallet - price, price };
}

/** How much more the comfort class costs than economy, as a whole percent. */
export function comfortExtra(): number {
  return Math.round(((TICKETS.comfort.price - TICKETS.economy.price) / TICKETS.economy.price) * 100);
}
