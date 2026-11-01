import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Batcher } from '../src/world/Batcher';
import { CollisionWorld } from '../src/world/Collision';
import { Frame } from '../src/world/Frame';
import { ModelLayer } from '../src/world/ModelLayer';
import { BRIDGES, buildRiver, deckHeight, RIVER } from '../src/world/landmarks/river';
import type { BuildContext } from '../src/world/types';
import { LAWN_Y, PLAZA, playground, RAMP, TRAMPOLINE } from '../src/world/landmarks/plaza';

/** Builds just the river into a fresh collision world. */
function riverWorld(): CollisionWorld {
  const collision = new CollisionWorld();
  const ctx = {
    batch: new Batcher(collision),
    dynamic: new THREE.Group(),
    materials: {} as BuildContext['materials'],
    models: new ModelLayer(collision),
    rng: () => 0.5,
    addAnimator: () => undefined,
    addPoi: () => undefined,
    onNight: () => undefined,
  } as unknown as BuildContext;
  buildRiver(new Frame(ctx, 0, 0), ctx, new THREE.CanvasTexture({ width: 1, height: 1 } as unknown as HTMLCanvasElement));
  return collision;
}

/** Walks a straight line the way the player controller does; returns the furthest point and the highest feet. */
function walk(c: CollisionWorld, x: number, z: number, dx: number, dz: number, metres: number, y0 = 0) {
  const R = 0.42;
  let y = c.groundHeight(x, z, y0 + 0.4);
  let top = y;
  for (let i = 0; i < metres / 0.05; i++) {
    const r = c.resolve(x + dx * 0.05, z + dz * 0.05, R, y);
    x = r.x;
    z = r.z;
    const g = c.groundHeight(x, z, y);
    y = g >= y - 0.02 ? y + (g - y) * 0.35 : Math.max(g, y - 0.2);
    top = Math.max(top, y);
  }
  return { x, z, y, top };
}

describe('river and bridges', () => {
  const c = riverWorld();

  it('the deck is highest in the middle', () => {
    expect(deckHeight(0)).toBeGreaterThan(deckHeight(10));
  });

  it('every bridge can be crossed both ways', () => {
    for (const b of BRIDGES) {
      const span = 22;
      const [dx, dz] = b.along === 'z' ? [0, 1] : [1, 0];
      const there = walk(c, b.x - dx * span, b.z - dz * span, dx, dz, span * 2);
      expect(b.along === 'z' ? there.z : there.x).toBeGreaterThan((b.along === 'z' ? b.z : b.x) + RIVER.width / 2 + 2);
      expect(there.top).toBeGreaterThan(3.5);
      const back = walk(c, there.x, there.z, -dx, -dz, span * 2, there.y);
      expect(b.along === 'z' ? back.z : back.x).toBeLessThan((b.along === 'z' ? b.z : b.x) - RIVER.width / 2 - 2);
    }
  });

  it('the water cannot be waded through', () => {
    const r = walk(c, 40, RIVER.south - 14, 0, 1, 30);
    expect(r.z).toBeLessThan(RIVER.south - RIVER.width / 2);
    const e = walk(c, RIVER.east - 14, 30, 1, 0, 30);
    expect(e.x).toBeLessThan(RIVER.east - RIVER.width / 2);
  });

  it('nobody falls off the side of a bridge', () => {
    const b = BRIDGES[1];
    const start = walk(c, b.x, b.z - 22, 0, 1, 22); // on the top of the arch
    expect(start.y).toBeGreaterThan(3.5);
    const side = walk(c, start.x, start.z, 1, 0, 6, start.y);
    expect(Math.abs(side.x - b.x)).toBeLessThan(2);
  });
});

describe('plaza playground', () => {
  function playWorld(): CollisionWorld {
    const collision = new CollisionWorld();
    const ctx = {
      batch: new Batcher(collision),
      dynamic: new THREE.Group(),
      materials: {} as BuildContext['materials'],
      models: new ModelLayer(collision),
      rng: () => 0.5,
      addAnimator: () => undefined,
      addPoi: () => undefined,
      onNight: () => undefined,
    } as unknown as BuildContext;
    // the lawn the playground stands on
    collision.add({ x0: -24, z0: 10, x1: -10, z1: 20, bottom: 0, top: LAWN_Y, water: false });
    playground(new Frame(ctx, 0, 0, 0, 0.3), ctx);
    return collision;
  }
  it('the skate ramp can be climbed from its low edge to the top', () => {
    const c = playWorld();
    const r = walk(c, PLAZA.ramp.x + 3, PLAZA.ramp.z, -1, 0, 4.4, LAWN_Y);
    expect(r.top).toBeGreaterThan(LAWN_Y + RAMP.height - 0.15);
  });
  it('the trampoline cannot be walked onto (you jump on), and its top is the bounce surface', () => {
    const c = playWorld();
    const r = walk(c, PLAZA.trampoline.x + 4, PLAZA.trampoline.z, -1, 0, 4, LAWN_Y);
    expect(r.x).toBeGreaterThan(PLAZA.trampoline.x + 1);
    expect(c.groundHeight(PLAZA.trampoline.x, PLAZA.trampoline.z, TRAMPOLINE.top + 0.2)).toBeCloseTo(TRAMPOLINE.top, 2);
  });
});
