import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/world/Collision';

function world() {
  const w = new CollisionWorld();
  // a building, a curb, a high bridge deck, and a pond
  w.add({ x0: 0, z0: 0, x1: 10, z1: 10, bottom: 0, top: 20, water: false });
  w.add({ x0: 20, z0: 0, x1: 30, z1: 10, bottom: 0, top: 0.3, water: false });
  w.add({ x0: 40, z0: 0, x1: 50, z1: 10, bottom: 5, top: 5.5, water: false });
  w.add({ x0: 60, z0: 0, x1: 70, z1: 10, bottom: -1, top: 0.05, water: true });
  return w;
}

describe('collision world', () => {
  it('pushes the player out of a building', () => {
    const r = world().resolve(-0.2, 5, 0.5, 0);
    expect(r.hit).toBe(true);
    expect(r.x).toBeCloseTo(-0.5);
    expect(r.z).toBeCloseTo(5);
  });

  it('leaves free space alone', () => {
    const r = world().resolve(-5, -5, 0.5, 0);
    expect(r).toEqual({ x: -5, z: -5, hit: false });
  });

  it('steps up onto low curbs but not walls', () => {
    const w = world();
    expect(w.resolve(25, 5, 0.5, 0).hit).toBe(false);
    expect(w.groundHeight(25, 5, 0)).toBeCloseTo(0.3);
    expect(w.groundHeight(5, 5, 0)).toBe(0);
  });

  it('walks under things that are above head height', () => {
    expect(world().resolve(45, 5, 0.5, 0).hit).toBe(false);
  });

  it('water always blocks', () => {
    const w = world();
    expect(w.isFree(65, 5, 0.5, 0)).toBe(false);
    expect(w.isFree(-5, 5, 0.5, 0)).toBe(true);
  });

  it('raycast reports the first tall block on a segment', () => {
    const w = world();
    const f = w.raycast(-10, 2, 5, 20, 2, 5);
    expect(f).toBeCloseTo(1 / 3, 2);
    expect(w.raycast(-10, 2, -5, 20, 2, -5)).toBe(1);
    // low curb never occludes the camera
    expect(w.raycast(15, 0.2, 5, 35, 0.2, 5)).toBe(1);
  });
});
