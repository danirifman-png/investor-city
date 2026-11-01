import { describe, expect, it } from 'vitest';
import { CITY_PORTAL, INTERIORS } from '../src/content/interiors';
import { SKY_STEPS, SKY_TOP, SKY_TRAMPOLINE, skyCoins, stepSavings } from '../src/world/interiors/skyLand';

/** Jump take-off speed and gravity from PlayerController: about 1.5 m high. */
const JUMP_H = (8.2 * 8.2) / (2 * 22);

describe('Cloud Land', () => {
  it('every step is reachable with one jump from the one before', () => {
    const path = [{ x: 0, z: 6, top: 0.35, r: 5 }, ...SKY_STEPS.map((s) => ({ ...s, r: 1.3 })), SKY_TOP];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const gap = Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
      expect(b.top - a.top).toBeLessThan(JUMP_H);
      expect(gap).toBeLessThan(1.6);
    }
  });

  it('the step savings grow by 10% each, faster than simple interest', () => {
    expect(SKY_STEPS.map((_, i) => stepSavings(i))).toEqual([100, 110, 121, 133, 146, 161]);
    expect(stepSavings(SKY_STEPS.length)).toBe(177);
    expect(stepSavings(SKY_STEPS.length)).toBeGreaterThan(100 + 10 * SKY_STEPS.length);
  });

  it('coins have unique ids and sit inside the place', () => {
    const coins = skyCoins();
    expect(new Set(coins.map((c) => c.id)).size).toBe(coins.length);
    const { w, d } = INTERIORS.skyLand.size;
    for (const c of coins) {
      expect(Math.abs(c.x)).toBeLessThan(w / 2);
      expect(Math.abs(c.z)).toBeLessThan(d / 2);
    }
    // the highest trampoline coin is within a boosted bounce (jump on landing: x1.18), picked up 2 m over the feet
    const v = SKY_TRAMPOLINE.launch * 1.18;
    expect(Math.max(...coins.map((c) => c.y)) - 2.0 - SKY_TRAMPOLINE.top).toBeLessThan((v * v) / (2 * 22));
  });

  it('is reached by a portal in the city and in the startup hub', () => {
    expect(INTERIORS.skyLand.at).toEqual(CITY_PORTAL);
    expect(INTERIORS.startupHub.hotspots.some((h) => h.kind === 'portal')).toBe(true);
  });
});
