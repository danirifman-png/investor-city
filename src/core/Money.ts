import { mulberry32 } from '../world/cityLayout';
import { cityEventFor, dayKey, type CityEventId } from './Business';

/**
 * What the player can do with their coins besides spending them: keep them in
 * a savings account at the city bank, which grows a little every real day, or
 * buy shares in the city's companies, whose prices move once a day by chance
 * and get a one-day bump from the city event.
 *
 * Everything is deterministic by calendar date, so every player sees the same
 * prices on the same day and the prices only change once a day (no fast
 * ticking that invites gambling). Pure rules with no DOM; coins are an in-game
 * score only.
 */

/* ------------------------------------------------------------------ */
/* Days                                                                */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;
/** Day 0 of the city's share prices. */
const EPOCH = Date.UTC(2026, 0, 1);

/** Whole days from the epoch to a YYYY-MM-DD key. */
export function dayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS);
}

export function keyOfIndex(i: number): string {
  return dayKey(new Date(EPOCH + i * DAY_MS + 12 * 3_600_000));
}

/* ------------------------------------------------------------------ */
/* Savings                                                             */
/* ------------------------------------------------------------------ */

/** Interest per real day (a city day is short: think of it as a month). */
export const SAVINGS_RATE = 0.02;
/** Interest is paid for at most this many missed days at once. */
const MAX_ACCRUE_DAYS = 60;

export interface Savings {
  /** Coins in the account, with fractions so small balances still grow. */
  balance: number;
  /** The last day interest was paid up to (YYYY-MM-DD), '' before the first deposit. */
  paidTo: string;
  /** All the interest earned so far. */
  interest: number;
}

export function newSavings(): Savings {
  return { balance: 0, paidTo: '', interest: 0 };
}

/** Pays interest for every day since `paidTo`, compounding daily. */
export function accrue(s: Savings, today: string): { savings: Savings; earned: number } {
  if (!s.paidTo || s.balance <= 0) return { savings: { ...s, paidTo: today }, earned: 0 };
  const days = Math.max(0, Math.min(MAX_ACCRUE_DAYS, dayIndex(today) - dayIndex(s.paidTo)));
  if (days === 0) return { savings: s, earned: 0 };
  const balance = s.balance * Math.pow(1 + SAVINGS_RATE, days);
  const earned = balance - s.balance;
  return { savings: { balance: round2(balance), paidTo: today, interest: round2(s.interest + earned) }, earned };
}

export function deposit(s: Savings, amount: number, today: string): Savings {
  const a = Math.max(0, Math.floor(amount));
  return { ...accrue(s, today).savings, balance: round2(s.balance + a) };
}

/** Takes out whole coins; returns how many actually came out. */
export function withdraw(s: Savings, amount: number, today: string): { savings: Savings; coins: number } {
  const cur = accrue(s, today).savings;
  const coins = Math.max(0, Math.min(Math.floor(cur.balance), Math.floor(amount)));
  return { savings: { ...cur, balance: round2(cur.balance - coins) }, coins };
}

/** What a balance becomes after `days` with no deposits (for the "if you wait" preview). */
export function grow(balance: number, days: number): number {
  return balance * Math.pow(1 + SAVINGS_RATE, days);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/* Shares                                                              */
/* ------------------------------------------------------------------ */

export type CompanyId = 'marco' | 'wind' | 'startup' | 'bank' | 'builder';
export const COMPANY_IDS: CompanyId[] = ['marco', 'wind', 'startup', 'bank', 'builder'];

export interface Company {
  id: CompanyId;
  /** Share price on day 0. */
  start: number;
  /** Average daily growth. */
  drift: number;
  /** How much the price jumps around on an ordinary day. */
  wobble: number;
  /** Extra move on days with these city events. */
  events: Partial<Record<CityEventId, number>>;
  /** 1-3, shown to the player. */
  risk: 1 | 2 | 3;
}

export const COMPANIES: Record<CompanyId, Company> = {
  marco: { id: 'marco', start: 24, drift: 0.002, wobble: 0.02, risk: 2, events: { festival: 0.05, match: 0.06, concert: 0.03, market: 0.02, roadworks: -0.05 } },
  wind: { id: 'wind', start: 40, drift: 0.0025, wobble: 0.012, risk: 1, events: {} },
  startup: { id: 'startup', start: 12, drift: 0.003, wobble: 0.06, risk: 3, events: { concert: 0.02 } },
  bank: { id: 'bank', start: 55, drift: 0.0015, wobble: 0.007, risk: 1, events: {} },
  builder: { id: 'builder', start: 30, drift: 0.002, wobble: 0.025, risk: 2, events: { roadworks: 0.05, marathon: -0.02 } },
};

const priceCache = new Map<CompanyId, number[]>();

/** One company's prices from day 0 up to `day` (cached; it only grows). */
function series(id: CompanyId, day: number): number[] {
  let s = priceCache.get(id);
  if (!s) priceCache.set(id, (s = [COMPANIES[id].start]));
  const c = COMPANIES[id];
  while (s.length <= day) {
    const i = s.length;
    const rng = mulberry32((i * 2654435761) ^ (COMPANY_IDS.indexOf(id) * 40503 + 7));
    // a symmetric bump from two uniforms, so most days move a little and few move a lot
    const noise = (rng() + rng() - 1) * c.wobble * 1.7;
    s.push(Math.max(1, s[i - 1] * (1 + c.drift + noise)));
  }
  return s;
}

/** A city event moves a price for that day only (news gives a bump, then things settle). */
function quoted(id: CompanyId, day: number): number {
  const ev = COMPANIES[id].events[cityEventFor(keyOfIndex(day))] ?? 0;
  return Math.max(1, Math.round(series(id, day)[day] * (1 + ev)));
}

/** A company's share price on a calendar day (whole coins, at least 1). */
export function priceOn(id: CompanyId, key: string): number {
  return quoted(id, Math.max(0, dayIndex(key)));
}

/** The last `n` daily prices up to and including `key`. */
export function history(id: CompanyId, key: string, n = 14): number[] {
  const d = Math.max(0, dayIndex(key));
  const out: number[] = [];
  for (let i = Math.max(0, d - n + 1); i <= d; i++) out.push(quoted(id, i));
  return out;
}

export interface Portfolio {
  /** Shares held per company. */
  shares: Partial<Record<CompanyId, number>>;
  /** Coins paid for the shares still held, per company (for profit and loss). */
  paid: Partial<Record<CompanyId, number>>;
  /** Profit or loss from shares already sold. */
  realized: number;
}

export function newPortfolio(): Portfolio {
  return { shares: {}, paid: {}, realized: 0 };
}

/** Buys `n` shares at today's price if the wallet allows. Returns the cost (0 when nothing was bought). */
export function buy(p: Portfolio, id: CompanyId, n: number, wallet: number, today: string): { portfolio: Portfolio; cost: number } {
  const price = priceOn(id, today);
  const k = Math.max(0, Math.min(Math.floor(n), Math.floor(wallet / price)));
  if (k === 0) return { portfolio: p, cost: 0 };
  return {
    portfolio: {
      ...p,
      shares: { ...p.shares, [id]: (p.shares[id] ?? 0) + k },
      paid: { ...p.paid, [id]: (p.paid[id] ?? 0) + k * price },
    },
    cost: k * price,
  };
}

/** Sells up to `n` shares at today's price. Returns the coins received. */
export function sell(p: Portfolio, id: CompanyId, n: number, today: string): { portfolio: Portfolio; coins: number; gain: number } {
  const held = p.shares[id] ?? 0;
  const k = Math.max(0, Math.min(Math.floor(n), held));
  if (k === 0) return { portfolio: p, coins: 0, gain: 0 };
  const price = priceOn(id, today);
  const paidShare = ((p.paid[id] ?? 0) * k) / held;
  const coins = k * price;
  const gain = Math.round(coins - paidShare);
  return {
    portfolio: {
      shares: { ...p.shares, [id]: held - k },
      paid: { ...p.paid, [id]: Math.round((p.paid[id] ?? 0) - paidShare) },
      realized: p.realized + gain,
    },
    coins,
    gain,
  };
}

/** Today's value of everything held, and what it cost. */
export function portfolioValue(p: Portfolio, today: string): { value: number; paid: number } {
  let value = 0;
  let paid = 0;
  for (const id of COMPANY_IDS) {
    value += (p.shares[id] ?? 0) * priceOn(id, today);
    paid += p.paid[id] ?? 0;
  }
  return { value, paid };
}

/** How many different companies the player owns (for the "don't put all eggs in one basket" tip). */
export function spread(p: Portfolio): number {
  return COMPANY_IDS.filter((id) => (p.shares[id] ?? 0) > 0).length;
}

/* ------------------------------------------------------------------ */
/* Saving and loading                                                  */
/* ------------------------------------------------------------------ */

export interface MoneyState {
  savings: Savings;
  portfolio: Portfolio;
}

export function newMoney(): MoneyState {
  return { savings: newSavings(), portfolio: newPortfolio() };
}

const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);
const isKey = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function sanitizeMoney(raw: unknown): MoneyState {
  const out = newMoney();
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, Record<string, unknown> | undefined>;
  const s = src.savings ?? {};
  out.savings = { balance: round2(num(s.balance, 0, 1e7)), paidTo: isKey(s.paidTo) ? s.paidTo : '', interest: round2(num(s.interest, 0, 1e7)) };
  const p = src.portfolio ?? {};
  const shares = (p.shares ?? {}) as Record<string, unknown>;
  const paid = (p.paid ?? {}) as Record<string, unknown>;
  for (const id of COMPANY_IDS) {
    const n = Math.floor(num(shares[id], 0, 1e6));
    if (n > 0) {
      out.portfolio.shares[id] = n;
      out.portfolio.paid[id] = Math.round(num(paid[id], 0, 1e8));
    }
  }
  out.portfolio.realized = Math.round(num(p.realized, -1e8, 1e8));
  return out;
}
