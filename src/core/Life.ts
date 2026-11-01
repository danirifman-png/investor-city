import { CAR, HOME } from '../content/life';
import { mulberry32 } from '../world/cityLayout';

/**
 * Rules for the big things: renting or buying a home, owning a car, the daily
 * bills they bring, what they are worth, and net worth. Pure logic with no DOM.
 *
 * Bills are charged once for each day the player plays (never for days away,
 * so taking a break costs nothing). When the wallet is short, the rest is
 * noted as unpaid (no interest, no penalty) and paid first from later coins.
 * Home prices move once a day, the same for everyone, like the share prices.
 */

export type Home = { kind: 'rent'; since: number } | { kind: 'own'; since: number; price: number; owed: number; perDay: number };

export interface LifeState {
  home: Home | null;
  /** `drive`: the car is the ride in use (instead of the one from the mall). */
  car: { since: number; price: number; drive: boolean } | null;
  /** Bills that could not be paid yet. */
  unpaid: number;
  /** The last day bills were charged. */
  paidTo: number;
  /** Net worth on the last days played (for the chart), oldest first, at most 7. */
  history: { day: number; net: number }[];
}

export function newLife(): LifeState {
  return { home: null, car: null, unpaid: 0, paidTo: -1, history: [] };
}

/* ------------------------------ values ------------------------------ */

/** The city's home price change on a day (the same for every player). */
export function homeMove(day: number): number {
  const r = mulberry32(((day + 1) * 2654435761) >>> 0)();
  return HOME.move.lo + (HOME.move.hi - HOME.move.lo) * r;
}

/** What a home bought for `price` on day `since` is worth on `day`. */
export function homeValue(price: number, since: number, day: number): number {
  let v = price;
  const end = Math.min(day, since + 730);
  for (let d = since + 1; d <= end; d++) v *= 1 + homeMove(d);
  return Math.round(v);
}

/** What a car bought on `since` is worth on `day`: it loses value every day, down to a floor. */
export function carValue(price: number, since: number, day: number): number {
  const days = Math.max(0, day - since);
  return Math.round(price * Math.max(CAR.floor, Math.pow(1 - CAR.drop, days)));
}

/* ------------------------------ buying ------------------------------ */

export function rentHome(s: LifeState, day: number): LifeState {
  if (s.home) return s;
  return { ...s, home: { kind: 'rent', since: day }, paidTo: Math.max(s.paidTo, day) };
}

export function moveOut(s: LifeState): LifeState {
  return s.home?.kind === 'rent' ? { ...s, home: null } : s;
}

/** The down payment and the loan for the home. */
export function homeDeal(): { price: number; down: number; loan: number; owed: number; perDay: number } {
  const { price, downShare, days, interest } = HOME.buy;
  const down = Math.round(price * downShare);
  const loan = price - down;
  const owed = Math.round(loan * (1 + interest));
  return { price, down, loan, owed, perDay: Math.ceil(owed / days) };
}

/** Buys the home (moving out of a rented one). Needs the down payment in the wallet. */
export function buyHome(s: LifeState, wallet: number, day: number): { life: LifeState; cost: number } | null {
  if (s.home?.kind === 'own') return null;
  const deal = homeDeal();
  if (wallet < deal.down) return null;
  return { life: { ...s, home: { kind: 'own', since: day, price: deal.price, owed: deal.owed, perDay: deal.perDay }, paidTo: Math.max(s.paidTo, day) }, cost: deal.down };
}

/** Sells the home at today's price; the loan still owed is paid back from it. */
export function sellHome(s: LifeState, day: number): { life: LifeState; coins: number } | null {
  const h = s.home;
  if (h?.kind !== 'own') return null;
  const coins = Math.max(0, homeValue(h.price, h.since, day) - h.owed);
  return { life: { ...s, home: null }, coins };
}

export function buyCar(s: LifeState, wallet: number, day: number): { life: LifeState; cost: number } | null {
  if (s.car || wallet < CAR.price) return null;
  return { life: { ...s, car: { since: day, price: CAR.price, drive: true }, paidTo: Math.max(s.paidTo, day) }, cost: CAR.price };
}

/** Drive the car, or go back to the ride from the mall. */
export function toggleDrive(s: LifeState): LifeState {
  return s.car ? { ...s, car: { ...s.car, drive: !s.car.drive } } : s;
}

export function sellCar(s: LifeState, day: number): { life: LifeState; coins: number } | null {
  if (!s.car) return null;
  return { life: { ...s, car: null }, coins: carValue(s.car.price, s.car.since, day) };
}

/* ------------------------------ bills ------------------------------- */

export interface Bills {
  rent: number;
  loan: number;
  upkeep: number;
  car: number;
  total: number;
}

/** Today's bills (one day's worth). */
export function billsFor(s: LifeState): Bills {
  const h = s.home;
  const rent = h?.kind === 'rent' ? HOME.rent.perDay : 0;
  const loan = h?.kind === 'own' ? Math.min(h.perDay, h.owed) : 0;
  const upkeep = h?.kind === 'own' ? HOME.upkeep : 0;
  const car = s.car ? CAR.perDay : 0;
  return { rent, loan, upkeep, car, total: rent + loan + upkeep + car };
}

/**
 * Charges one day's bills on the first visit of a new day. Returns the new
 * state, the wallet after paying, and the bills (null when nothing was due).
 */
export function payBills(s: LifeState, wallet: number, day: number): { life: LifeState; wallet: number; bills: Bills | null; paid: number } {
  if (day <= s.paidTo) return { life: s, wallet, bills: null, paid: 0 };
  const bills = billsFor(s);
  const due = bills.total + s.unpaid;
  const paid = Math.min(wallet, due);
  const h = s.home;
  // the loan goes down by its daily payment (counted as paid even if part of it waits as unpaid)
  const home: Home | null = h?.kind === 'own' ? { ...h, owed: Math.max(0, h.owed - bills.loan) } : h;
  return {
    life: { ...s, home, unpaid: due - paid, paidTo: day },
    wallet: wallet - paid,
    bills: bills.total > 0 ? bills : null,
    paid,
  };
}

/* ---------------------------- net worth ----------------------------- */

export interface Worth {
  cash: number;
  savings: number;
  investments: number;
  /** Things that are worth money: the home and the car. */
  things: number;
  /** What is still owed: the home loan and unpaid bills. */
  owe: number;
  net: number;
}

export function worth(s: LifeState, cash: number, savings: number, investments: number, day: number): Worth {
  const h = s.home;
  const home = h?.kind === 'own' ? homeValue(h.price, h.since, day) : 0;
  const car = s.car ? carValue(s.car.price, s.car.since, day) : 0;
  const owe = (h?.kind === 'own' ? h.owed : 0) + s.unpaid;
  const things = home + car;
  return { cash, savings, investments, things, owe, net: cash + savings + investments + things - owe };
}

/** Notes today's net worth in the 7-day history (replacing today's earlier note). */
export function noteWorth(s: LifeState, day: number, net: number): LifeState {
  const rest = s.history.filter((p) => p.day !== day && p.day < day);
  return { ...s, history: [...rest, { day, net: Math.round(net) }].slice(-7) };
}

/* ----------------------------- saving ------------------------------- */

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function sanitizeLife(raw: unknown): LifeState {
  const out = newLife();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  const h = r.home as Record<string, unknown> | null | undefined;
  if (h && h.kind === 'rent') out.home = { kind: 'rent', since: Math.floor(num(h.since)) };
  else if (h && h.kind === 'own' && num(h.price) > 0)
    out.home = { kind: 'own', since: Math.floor(num(h.since)), price: num(h.price), owed: Math.max(0, num(h.owed)), perDay: Math.max(1, num(h.perDay, homeDeal().perDay)) };
  const c = r.car as Record<string, unknown> | null | undefined;
  if (c && num(c.price) > 0) out.car = { since: Math.floor(num(c.since)), price: num(c.price), drive: c.drive !== false };
  out.unpaid = Math.max(0, Math.round(num(r.unpaid)));
  out.paidTo = Math.floor(num(r.paidTo, -1));
  if (Array.isArray(r.history))
    out.history = r.history
      .filter((p): p is { day: number; net: number } => !!p && typeof p === 'object' && Number.isFinite((p as { day: unknown }).day) && Number.isFinite((p as { net: unknown }).net))
      .map((p) => ({ day: Math.floor(p.day), net: Math.round(p.net) }))
      .slice(-7);
  return out;
}
