import { describe, expect, it } from 'vitest';
import { buildLayout } from '../src/world/cityLayout';
import { CollisionWorld } from '../src/world/Collision';
import { collectibleSpots, GOLD_TOTAL } from '../src/world/Collectibles';
import { TRAMPOLINE } from '../src/world/landmarks/plaza';

describe('golden coins and chests', () => {
  const { coins, chests } = collectibleSpots(buildLayout(), new CollisionWorld());
  it('there are exactly 100 coins with unique ids', () => {
    expect(coins).toHaveLength(GOLD_TOTAL);
    expect(new Set(coins.map((c) => c.id)).size).toBe(GOLD_TOTAL);
  });
  it('chests have unique ids and some coins', () => {
    expect(new Set(chests.map((c) => c.id)).size).toBe(chests.length);
    expect(chests.every((c) => c.coins > 0)).toBe(true);
  });
  it('some coins need a jump, and none float out of reach', () => {
    expect(coins.filter((c) => c.y - 0 > 2.2 && c.id.startsWith('j')).length).toBeGreaterThan(5);
    // trampoline coins (t) can sit higher: the bounce reaches them
    expect(coins.filter((c) => !c.id.startsWith('t')).every((c) => c.y < 8)).toBe(true);
    const apex = (v: number) => TRAMPOLINE.top + (v * v) / (2 * 22);
    const t = coins.filter((c) => c.id.startsWith('t'));
    expect(t.length).toBe(4);
    // every one is within pickup reach (feet up to 2 m below the coin) of a boosted bounce, and the top one needs the boost
    expect(t.every((c) => c.y - apex(TRAMPOLINE.launch * 1.18) < 2.0)).toBe(true);
    expect(Math.max(...t.map((c) => c.y)) - apex(TRAMPOLINE.launch)).toBeGreaterThan(2.0);
  });
});
