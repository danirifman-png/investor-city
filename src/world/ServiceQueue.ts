import * as THREE from 'three';
import { AvatarAnimator, loadAvatar } from '../character/AvatarNpc';
import { TOWNSFOLK } from '../content/townsfolk';

/**
 * Customers at the player's counter during a business day (core/Service):
 * they walk in from the street, stand in line facing the counter, and walk
 * off happy or disappointed. Looks come from the city's walking people.
 */

const WALK = 1.5;
const GAP = 0.95;

interface Customer {
  id: number;
  object: THREE.Object3D | null;
  animator: AvatarAnimator | null;
  foot: number;
  x: number;
  z: number;
  heading: number;
  target: { x: number; z: number };
  out: boolean;
}

export class ServiceQueue {
  readonly group = new THREE.Group();
  private people = new Map<number, Customer>();
  private counter = { x: 0, z: 0, y: 0 };
  /** Unit vector from the counter toward the customers. */
  private dir = { x: -1, z: 0 };

  constructor() {
    this.group.name = 'service-queue';
  }

  /** Where the counter is, which way the customers stand, and the ground height. */
  setCounter(x: number, z: number, y: number, dirX: number, dirZ: number): void {
    this.counter = { x, z, y };
    const l = Math.hypot(dirX, dirZ) || 1;
    this.dir = { x: dirX / l, z: dirZ / l };
  }

  /** The spot of place `i` in line (0 is at the counter). */
  slot(i: number): { x: number; z: number } {
    const d = 1.25 + i * GAP;
    return { x: this.counter.x + this.dir.x * d, z: this.counter.z + this.dir.z * d };
  }

  private side(sign: number, far: number): { x: number; z: number } {
    // across the line: a perpendicular to dir
    const px = -this.dir.z;
    const pz = this.dir.x;
    return { x: this.counter.x + this.dir.x * far + px * sign * 7, z: this.counter.z + this.dir.z * far + pz * sign * 7 };
  }

  arrive(id: number, look: number): void {
    const from = this.side(id % 2 ? 1 : -1, 9);
    const c: Customer = { id, object: null, animator: null, foot: 0, x: from.x, z: from.z, heading: 0, target: from, out: false };
    this.people.set(id, c);
    void loadAvatar(TOWNSFOLK[look % TOWNSFOLK.length].model)
      .then(({ scene, clips }) => {
        if (!this.people.has(id)) return;
        scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(scene, true);
        c.foot = -box.min.y;
        c.object = scene;
        c.animator = new AvatarAnimator(scene, clips, 1.3, true);
        scene.position.set(c.x, this.counter.y + c.foot, c.z);
        this.group.add(scene);
      })
      .catch(() => undefined);
  }

  /** Puts everyone waiting into their places, in this order. */
  arrange(ids: number[]): void {
    ids.forEach((id, i) => {
      const c = this.people.get(id);
      if (c && !c.out) c.target = this.slot(i);
    });
  }

  /** Sends someone away, happy or not. */
  leave(id: number, happy: boolean): void {
    const c = this.people.get(id);
    if (!c) return;
    c.out = true;
    c.animator?.play(happy ? 'happy' : 'shake');
    c.target = this.side(id % 2 ? -1 : 1, 11);
  }

  clear(): void {
    for (const c of this.people.values()) if (c.object) this.group.remove(c.object);
    this.people.clear();
  }

  update(dt: number): void {
    for (const c of this.people.values()) {
      const dx = c.target.x - c.x;
      const dz = c.target.z - c.z;
      const dist = Math.hypot(dx, dz);
      // a reaction plays out before walking on
      const busy = c.animator?.playing === 'happy' || c.animator?.playing === 'shake';
      let speed = 0;
      if (dist > 0.05 && !busy) {
        const step = Math.min(dist, WALK * dt);
        c.x += (dx / dist) * step;
        c.z += (dz / dist) * step;
        speed = WALK;
        c.heading = Math.atan2(dx, dz);
      } else if (!c.out) {
        // in line: face the counter
        c.heading = Math.atan2(-this.dir.x, -this.dir.z);
      }
      if (c.out && dist <= 0.05) {
        if (c.object) this.group.remove(c.object);
        this.people.delete(c.id);
        continue;
      }
      if (!c.object || !c.animator) continue;
      c.object.position.set(c.x, this.counter.y + c.foot, c.z);
      c.object.rotation.y = c.heading;
      c.animator.update(dt, speed);
    }
  }
}
