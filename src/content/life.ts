/**
 * DATA: the big things in a grown-up's money life, in kid-sized numbers: a
 * home (rent one, or buy one with a loan) and a car. Rules live in core/Life;
 * text in he.life.json. A city day stands for a month, like the savings.
 */

export const HOME = {
  /** Renting: a fixed rent every day you play, and you can move out any time. */
  rent: { perDay: 6 },
  /** Buying: a price, a down payment from the wallet, and a loan paid back day by day with interest. */
  buy: { price: 800, downShare: 0.2, days: 60, interest: 0.1 },
  /** An owner pays for repairs and upkeep. */
  upkeep: 3,
  /** How much home prices in the city can move in a day (the same for every player). */
  move: { lo: -0.01, hi: 0.016 },
  /** Opens at this level. */
  minLevel: 4,
  /** Buying needs this level (renting comes first). */
  buyLevel: 5,
};

export const CAR = {
  price: 500,
  /** Fuel and insurance every day you own it. */
  perDay: 5,
  /** A car loses value every day (depreciation), down to a floor. */
  drop: 0.025,
  floor: 0.3,
  minLevel: 6,
};
