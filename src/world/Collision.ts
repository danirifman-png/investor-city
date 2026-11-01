/**
 * Walkability and collision for the player and the camera.
 *
 * Every static piece of the city registers its world-space bounding box as a
 * "block" with a bottom and a top. A block stops the player when it rises more
 * than STEP_HEIGHT above their feet and starts below their head; lower blocks
 * (curbs, stairs, plaza paving) are walked onto. Water always blocks.
 *
 * Boxes live in a uniform spatial hash so queries only look at nearby cells.
 */

export const STEP_HEIGHT = 0.55;
export const PLAYER_HEIGHT = 1.7;

export interface Block {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  bottom: number;
  top: number;
  water: boolean;
}

const CELL = 6;

export class CollisionWorld {
  readonly blocks: Block[] = [];
  private grid = new Map<number, number[]>();
  private stamp: Uint32Array = new Uint32Array(0);
  private query = 0;

  add(b: Block): void {
    if ((b.x1 - b.x0) * (b.z1 - b.z0) < 0.01) return;
    // the far-away scenery is never reachable
    if (b.x1 - b.x0 > 120 || b.z1 - b.z0 > 120) return;
    const id = this.blocks.push(b) - 1;
    for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++) {
      for (let cz = Math.floor(b.z0 / CELL); cz <= Math.floor(b.z1 / CELL); cz++) {
        const key = cx * 73856093 ^ cz * 19349663;
        let list = this.grid.get(key);
        if (!list) this.grid.set(key, (list = []));
        list.push(id);
      }
    }
  }

  /** Visits each block overlapping the rectangle once. */
  each(x0: number, z0: number, x1: number, z1: number, fn: (b: Block) => void): void {
    if (this.stamp.length < this.blocks.length) this.stamp = new Uint32Array(this.blocks.length + 1024);
    const q = ++this.query;
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
        const list = this.grid.get(cx * 73856093 ^ cz * 19349663);
        if (!list) continue;
        for (const id of list) {
          if (this.stamp[id] === q) continue;
          this.stamp[id] = q;
          const b = this.blocks[id];
          if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue;
          fn(b);
        }
      }
    }
  }

  private blocksAt(b: Block, feet: number): boolean {
    return b.water || (b.top > feet + STEP_HEIGHT && b.bottom < feet + PLAYER_HEIGHT);
  }

  /** Height of the walkable surface under a point, for feet currently at `feet`. */
  groundHeight(x: number, z: number, feet: number, radius = 0.2): number {
    let h = 0;
    this.each(x - radius, z - radius, x + radius, z + radius, (b) => {
      if (b.water || b.top > feet + STEP_HEIGHT) return;
      if (b.top > h) h = b.top;
    });
    return h;
  }

  /**
   * Pushes a circle out of every blocking box. Returns the corrected position
   * and whether anything was hit.
   */
  resolve(x: number, z: number, radius: number, feet: number): { x: number; z: number; hit: boolean } {
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      this.each(x - radius, z - radius, x + radius, z + radius, (b) => {
        if (!this.blocksAt(b, feet)) return;
        const cx = Math.max(b.x0, Math.min(x, b.x1));
        const cz = Math.max(b.z0, Math.min(z, b.z1));
        let dx = x - cx;
        let dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) return;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * radius;
          z = cz + (dz / d) * radius;
        } else {
          // centre inside the box: leave by the nearest side
          const left = x - b.x0;
          const right = b.x1 - x;
          const near = z - b.z0;
          const far = b.z1 - z;
          const m = Math.min(left, right, near, far);
          if (m === left) x = b.x0 - radius;
          else if (m === right) x = b.x1 + radius;
          else if (m === near) z = b.z0 - radius;
          else z = b.z1 + radius;
          dx = dz = 0;
        }
        moved = hit = true;
      });
      if (!moved) break;
    }
    return { x, z, hit };
  }

  /** True when the player could stand at this point. */
  isFree(x: number, z: number, radius: number, feet: number): boolean {
    let free = true;
    this.each(x - radius, z - radius, x + radius, z + radius, (b) => {
      if (free && this.blocksAt(b, feet)) {
        const cx = Math.max(b.x0, Math.min(x, b.x1));
        const cz = Math.max(b.z0, Math.min(z, b.z1));
        if ((x - cx) ** 2 + (z - cz) ** 2 < radius * radius) free = false;
      }
    });
    return free;
  }

  /** The free spot nearest to (x, z), searched in growing rings; null if none within `maxR`. */
  findFree(x: number, z: number, radius: number, feet = 0.4, maxR = 30): { x: number; z: number } | null {
    if (this.isFree(x, z, radius, feet)) return { x, z };
    for (let r = 1.5; r < maxR; r += 1.5) {
      for (let a = 0; a < 16; a++) {
        const tx = x + Math.cos((a / 16) * Math.PI * 2) * r;
        const tz = z + Math.sin((a / 16) * Math.PI * 2) * r;
        if (this.isFree(tx, tz, radius, feet)) return { x: tx, z: tz };
      }
    }
    return null;
  }

  /**
   * First hit along a 3D segment (camera occlusion). Returns the hit fraction
   * in [0, 1], or 1 when the segment is clear. Ignores low blocks.
   */
  raycast(ax: number, ay: number, az: number, bx: number, by: number, bz: number, minTop = 2.2): number {
    let best = 1;
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    this.each(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), (b) => {
      if (b.top < minTop) return;
      let t0 = 0;
      let t1 = best;
      const slab = (o: number, d: number, lo: number, hi: number) => {
        if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
        let ta = (lo - o) / d;
        let tb = (hi - o) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        return t0 <= t1;
      };
      if (slab(ax, dx, b.x0, b.x1) && slab(ay, dy, b.bottom, b.top) && slab(az, dz, b.z0, b.z1) && t0 < best) best = t0;
    });
    return best;
  }
}
