import { describe, expect, it } from 'vitest';
import { SHOP_ITEMS, SHOP_BY_ID } from '../src/content/shop';
import { buy, canBuy, newShop, payUpkeep, rideSpeed, sanitizeShop, sell, sellPrice, toggleEquip } from '../src/core/Shop';

describe('shop', () => {
  it('has unique ids and sane prices', () => {
    expect(new Set(SHOP_ITEMS.map((i) => i.id)).size).toBe(SHOP_ITEMS.length);
    for (const i of SHOP_ITEMS) {
      expect(i.price).toBeGreaterThan(0);
      if (i.kind === 'keep') expect(!!i.slot || !!i.furniture).toBe(true);
      if (i.sameAs) expect(SHOP_BY_ID[i.sameAs].price).toBeLessThan(i.price);
    }
  });

  it('checks level, coins and ownership', () => {
    const s = newShop();
    expect(canBuy(s, SHOP_BY_ID.goKart, 1, 9999)).toBe('level');
    expect(canBuy(s, SHOP_BY_ID.iceCream, 1, 2)).toBe('coins');
    const { shop } = buy(s, 'capPlain', 1, 100, '2026-11-01');
    expect(canBuy(shop, SHOP_BY_ID.capPlain, 1, 100)).toBe('owned');
    // treats can be bought again and again
    const t = buy(shop, 'iceCream', 1, 100, '2026-11-01');
    expect(t.spent).toBe(4);
    expect(canBuy(t.shop, SHOP_BY_ID.iceCream, 1, 100)).toBe('ok');
  });

  it('wears what it buys, and sells back for less', () => {
    let { shop, spent } = buy(newShop(), 'bicycle', 4, 200, '2026-11-01');
    expect(spent).toBe(180);
    expect(shop.equipped.ride).toBe('bicycle');
    expect(rideSpeed(shop)).toBeGreaterThan(1);
    shop = toggleEquip(shop, 'bicycle');
    expect(rideSpeed(shop)).toBe(1);
    const sold = sell(shop, 'bicycle');
    expect(sold.coins).toBe(sellPrice(SHOP_BY_ID.bicycle));
    expect(sold.coins).toBeLessThan(180);
    expect(sold.shop.owned).not.toContain('bicycle');
  });

  it('feeds the pet once per day, at most a week, and never punishes', () => {
    const { shop } = buy(newShop(), 'dog', 3, 200, '2026-11-01');
    expect(payUpkeep(shop, 50, '2026-11-01').spent).toBe(0);
    const later = payUpkeep(shop, 50, '2026-11-04');
    expect(later.spent).toBe(9);
    expect(later.shop.fedDay).toBe('2026-11-04');
    expect(payUpkeep(shop, 500, '2027-01-01').days).toBe(7);
    const broke = payUpkeep(shop, 1, '2026-11-05');
    expect(broke.home).toBe(true);
    expect(broke.shop.owned).toContain('dog');
    expect(broke.shop.equipped.pet).toBeUndefined();
  });

  it('cleans up bad saves', () => {
    expect(sanitizeShop(null)).toEqual(newShop());
    const s = sanitizeShop({ owned: ['dog', 'nope', 'iceCream'], equipped: { pet: 'dog', hat: 'crown' }, fedDay: 'x', treats: -3 });
    expect(s.owned).toEqual(['dog']);
    expect(s.equipped).toEqual({ pet: 'dog' });
    expect(s.fedDay).toBeNull();
    expect(s.treats).toBe(0);
  });
});
