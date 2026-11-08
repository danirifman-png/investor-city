import { describe, expect, it } from 'vitest';
import { INTERIORS, ISLAND_ENTRY, ISLAND_PLANE_DOOR, ISLAND_SIZE } from '../src/content/interiors';
import { TICKETS, buyTicket, comfortExtra } from '../src/content/travel';
import { ISLAND, ISLAND_CHEST, PLANE, SHIP, VOLCANO, islandCoins, volcanoTop } from '../src/world/interiors/island';
import { hasKey } from '../src/i18n';

/** Jump take-off speed and gravity from PlayerController: about 1.5 m high. */
const JUMP_H = (8.2 * 8.2) / (2 * 22);

describe('travel agency', () => {
  it('sells a ticket only with enough coins and says what is missing', () => {
    expect(buyTicket(100, 'economy')).toEqual({ ok: true, wallet: 100 - TICKETS.economy.price, price: TICKETS.economy.price });
    expect(buyTicket(10, 'economy')).toEqual({ ok: false, missing: TICKETS.economy.price - 10, price: TICKETS.economy.price });
    expect(buyTicket(TICKETS.comfort.price, 'comfort').ok).toBe(true);
  });

  it('comfort costs more for the same trip', () => {
    expect(TICKETS.comfort.price).toBeGreaterThan(TICKETS.economy.price);
    expect(comfortExtra()).toBe(Math.round(((TICKETS.comfort.price - TICKETS.economy.price) / TICKETS.economy.price) * 100));
  });

  it('the mall has the travel desk with its text', () => {
    const spot = INTERIORS.mall.hotspots.find((h) => h.kind === 'travel');
    expect(spot).toBeTruthy();
    expect(hasKey('spot.mall.travel.prompt')).toBe(true);
  });
});

describe('Adventure Island', () => {
  it('has no door in the city: only the plane leads there and back', () => {
    const def = INTERIORS.island;
    expect(def.poi).toBe('');
    expect(def.at).toBeUndefined();
    expect(def.open).toBe(true);
    expect(def.hotspots.some((h) => h.kind === 'fly')).toBe(true);
    expect(def.hotspots.some((h) => h.kind === 'exit')).toBe(false);
  });

  it('every spot is on land and has its texts', () => {
    for (const s of INTERIORS.island.hotspots) {
      expect(Math.hypot(s.x, s.z), s.id).toBeLessThan(ISLAND.r);
      expect(hasKey(`spot.island.${s.id}.prompt`), s.id).toBe(true);
      if (s.kind === 'info') expect(hasKey(`spot.island.${s.id}.body`), s.id).toBe(true);
    }
  });

  it('the landing spot and the plane door are on the beach, clear of the plane', () => {
    expect(Math.hypot(ISLAND_ENTRY.x, ISLAND_ENTRY.z)).toBeLessThan(ISLAND.r);
    expect(ISLAND_PLANE_DOOR.z).toBeLessThan(PLANE.z - PLANE.r);
    expect(ISLAND_ENTRY.z).toBeLessThan(PLANE.z - 6.5 - 1);
    expect(ISLAND.r * 2 + 6).toBeLessThan(ISLAND_SIZE);
  });

  it('every volcano ring is one jump above the last and wide enough to land on', () => {
    expect(VOLCANO.step).toBeLessThan(JUMP_H);
    for (let i = 1; i < VOLCANO.rings.length; i++) expect(VOLCANO.rings[i - 1] - VOLCANO.rings[i]).toBeGreaterThan(1.0);
    expect(volcanoTop()).toBeGreaterThan(4);
  });

  it('coins have unique ids, sit on the island and can be reached', () => {
    const coins = islandCoins();
    expect(new Set(coins.map((c) => c.id)).size).toBe(coins.length);
    for (const c of coins) {
      expect(c.id.startsWith('isl')).toBe(true);
      expect(Math.hypot(c.x, c.z)).toBeLessThan(ISLAND.r);
      expect(c.y).toBeLessThan(volcanoTop() + 2);
    }
    // on deck: the hull is low enough to jump onto
    expect(SHIP.deck + 0.1).toBeLessThan(JUMP_H);
  });

  it('the island gives back less than the cheapest ticket costs (a holiday is spending)', () => {
    expect(islandCoins().length + ISLAND_CHEST.coins).toBeLessThan(TICKETS.economy.price);
  });
});
