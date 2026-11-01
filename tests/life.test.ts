import { describe, expect, it } from 'vitest';
import { CAR, HOME } from '../src/content/life';
import { buyCar, buyHome, carValue, homeDeal, homeValue, newLife, noteWorth, payBills, rentHome, sanitizeLife, sellCar, sellHome, worth } from '../src/core/Life';

describe('home', () => {
  it('renting charges the rent once per day played, starting the next day', () => {
    let s = rentHome(newLife(), 10);
    expect(payBills(s, 100, 10).bills).toBeNull();
    const r = payBills(s, 100, 11);
    expect(r.wallet).toBe(100 - HOME.rent.perDay);
    s = r.life;
    // a day away costs nothing extra: only one day is charged on return
    expect(payBills(s, 100, 20).paid).toBe(HOME.rent.perDay);
  });

  it('buying takes the down payment and pays the loan down day by day', () => {
    const deal = homeDeal();
    expect(buyHome(newLife(), deal.down - 1, 0)).toBeNull();
    const b = buyHome(newLife(), deal.down, 0)!;
    expect(b.cost).toBe(deal.down);
    expect(deal.owed).toBeGreaterThan(deal.loan);
    let s = b.life;
    let paid = 0;
    for (let d = 1; d <= HOME.buy.days + 5; d++) {
      const r = payBills(s, 1000, d);
      s = r.life;
      paid += r.paid;
    }
    expect(s.home?.kind === 'own' && s.home.owed).toBe(0);
    expect(paid).toBe(deal.owed + (HOME.buy.days + 5) * HOME.upkeep);
  });

  it('a short wallet leaves the rest unpaid, paid first later', () => {
    const s = rentHome(newLife(), 0);
    const r = payBills(s, 2, 1);
    expect(r.wallet).toBe(0);
    expect(r.life.unpaid).toBe(HOME.rent.perDay - 2);
    const r2 = payBills(r.life, 100, 2);
    expect(r2.paid).toBe(HOME.rent.perDay * 2 - 2);
    expect(r2.life.unpaid).toBe(0);
  });

  it('home prices move the same way for everyone, and selling repays the loan', () => {
    expect(homeValue(800, 0, 30)).toBe(homeValue(800, 0, 30));
    expect(homeValue(800, 5, 5)).toBe(800);
    const b = buyHome(newLife(), 1000, 0)!;
    const sold = sellHome(b.life, 0)!;
    expect(sold.coins).toBe(800 - homeDeal().owed);
    expect(sold.life.home).toBeNull();
  });
});

describe('car', () => {
  it('loses value every day down to a floor and costs money to run', () => {
    expect(carValue(500, 0, 0)).toBe(500);
    expect(carValue(500, 0, 10)).toBeLessThan(carValue(500, 0, 5));
    expect(carValue(500, 0, 1000)).toBe(Math.round(500 * CAR.floor));
    const b = buyCar(newLife(), 600, 0)!;
    expect(b.cost).toBe(CAR.price);
    expect(payBills(b.life, 100, 1).paid).toBe(CAR.perDay);
    expect(sellCar(b.life, 20)!.coins).toBe(carValue(CAR.price, 0, 20));
  });
});

describe('net worth', () => {
  it('adds what you have and subtracts what you owe', () => {
    const b = buyHome(newLife(), 1000, 0)!;
    const w = worth(b.life, 50, 20, 30, 0);
    expect(w.things).toBe(800);
    expect(w.owe).toBe(homeDeal().owed);
    expect(w.net).toBe(50 + 20 + 30 + 800 - homeDeal().owed);
  });

  it('keeps one note per day, the last 7 days', () => {
    let s = newLife();
    for (let d = 0; d < 10; d++) s = noteWorth(s, d, d * 10);
    s = noteWorth(s, 9, 5);
    expect(s.history).toHaveLength(7);
    expect(s.history[6]).toEqual({ day: 9, net: 5 });
  });

  it('sanitizes saved data', () => {
    expect(sanitizeLife(undefined)).toEqual(newLife());
    const s = sanitizeLife({ home: { kind: 'own', since: 2, price: 800, owed: 100, perDay: 12 }, car: { since: 1, price: 500 }, unpaid: -5, paidTo: 3, history: [{ day: 1, net: 2 }, 'x'] });
    expect(s.home).toEqual({ kind: 'own', since: 2, price: 800, owed: 100, perDay: 12 });
    expect(s.unpaid).toBe(0);
    expect(s.history).toEqual([{ day: 1, net: 2 }]);
  });
});
