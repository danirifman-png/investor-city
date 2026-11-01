import { describe, expect, it } from 'vitest';
import {
  accrue, buy, COMPANIES, COMPANY_IDS, dayIndex, deposit, grow, history, keyOfIndex, newMoney, newPortfolio, newSavings,
  portfolioValue, priceOn, sanitizeMoney, sell, spread, withdraw,
} from '../src/core/Money';

describe('savings account', () => {
  it('grows by compound interest for each real day and pays nothing on the same day', () => {
    let s = deposit(newSavings(), 100, '2026-11-01');
    expect(s.balance).toBe(100);
    expect(accrue(s, '2026-11-01').earned).toBe(0);
    s = accrue(s, '2026-11-11').savings;
    expect(s.balance).toBeCloseTo(grow(100, 10), 1);
    expect(s.balance).toBeGreaterThan(120); // more than 10 x 2 coins: interest on interest
    expect(s.interest).toBeCloseTo(s.balance - 100, 1);
  });
  it('withdraws only whole coins that are there', () => {
    const s = deposit(newSavings(), 50, '2026-11-01');
    const w = withdraw(s, 999, '2026-11-01');
    expect(w.coins).toBe(50);
    expect(w.savings.balance).toBe(0);
  });
  it('day keys round-trip', () => {
    for (const k of ['2026-01-01', '2026-03-31', '2026-11-01', '2027-02-28']) expect(keyOfIndex(dayIndex(k))).toBe(k);
  });
});

describe('city shares', () => {
  it('prices are deterministic, positive, change once a day, and every company moves', () => {
    for (const id of COMPANY_IDS) {
      expect(priceOn(id, '2026-11-01')).toBe(priceOn(id, '2026-11-01'));
      const h = history(id, '2026-11-01', 30);
      expect(h).toHaveLength(30);
      expect(h.every((p) => p >= 1)).toBe(true);
      expect(new Set(h).size).toBeGreaterThan(2);
    }
  });
  it('the risky startup moves more than the bank, and nothing explodes over a year', () => {
    const swing = (id: (typeof COMPANY_IDS)[number]) => {
      const h = history(id, '2026-12-31', 300);
      let s = 0;
      for (let i = 1; i < h.length; i++) s += Math.abs(h[i] / h[i - 1] - 1);
      return s / (h.length - 1);
    };
    expect(swing('startup')).toBeGreaterThan(swing('bank') * 3);
    for (const id of COMPANY_IDS) {
      const p = priceOn(id, '2026-12-31');
      expect(p).toBeLessThan(COMPANIES[id].start * 12);
      expect(p).toBeGreaterThan(1);
    }
  });
  it('buying spends the wallet, selling returns coins and records the gain', () => {
    const day = '2026-11-01';
    const later = '2026-11-20';
    const price = priceOn('wind', day);
    const b = buy(newPortfolio(), 'wind', 3, price * 2 + 1, day);
    expect(b.cost).toBe(price * 2); // the wallet only covers two
    expect(b.portfolio.shares.wind).toBe(2);
    expect(portfolioValue(b.portfolio, day)).toEqual({ value: price * 2, paid: price * 2 });
    const s = sell(b.portfolio, 'wind', 5, later);
    expect(s.coins).toBe(priceOn('wind', later) * 2);
    expect(s.gain).toBe(s.coins - price * 2);
    expect(s.portfolio.shares.wind).toBe(0);
    expect(spread(b.portfolio)).toBe(1);
  });
  it('cleans saved data', () => {
    const m = sanitizeMoney({ savings: { balance: -5, paidTo: 'x' }, portfolio: { shares: { wind: 3.7, nope: 2 }, paid: { wind: 90 } } });
    expect(m.savings).toEqual({ balance: 0, paidTo: '', interest: 0 });
    expect(m.portfolio.shares).toEqual({ wind: 3 });
    expect(sanitizeMoney(null)).toEqual(newMoney());
  });
});
