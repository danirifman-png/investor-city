import { describe, expect, it } from 'vitest';
import { route, STREETS } from '../src/world/Guide';

describe('guide route', () => {
  it('goes straight to a close goal', () => {
    expect(route({ x: 0, z: 0 }, { x: 10, z: 5 })).toEqual([{ x: 0, z: 0 }, { x: 10, z: 5 }]);
  });

  it('follows the streets to a far goal', () => {
    const a = { x: 3, z: -40 };
    const b = { x: 70, z: 55 };
    const path = route(a, b);
    expect(path[0]).toEqual(a);
    expect(path[path.length - 1]).toEqual(b);
    // the middle legs run along street centre lines, one axis at a time
    for (let i = 1; i < path.length - 2; i++) {
      const p = path[i];
      const q = path[i + 1];
      expect(p.x === q.x || p.z === q.z).toBe(true);
      expect(STREETS.includes(p.x) || STREETS.includes(p.z)).toBe(true);
    }
  });
});
