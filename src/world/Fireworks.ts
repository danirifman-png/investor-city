import * as THREE from 'three';

/**
 * A short fireworks show above a point: a few rockets that burst into
 * coloured sparks and fall. One Points object per burst, removed when done.
 */

const COLORS = ['#ff5a6e', '#ffd84d', '#4fc3ff', '#7dff8a', '#c77dff', '#ffffff'];

interface Burst {
  points: THREE.Points;
  vel: Float32Array;
  age: number;
  delay: number;
}

export class Fireworks {
  readonly group = new THREE.Group();
  private bursts: Burst[] = [];

  /** Launches `count` bursts around (x, z), spread over a couple of seconds. */
  show(x: number, z: number, count = 6): void {
    for (let b = 0; b < count; b++) {
      const n = 90;
      const pos = new Float32Array(n * 3);
      const vel = new Float32Array(n * 3);
      const cx = x + (Math.random() - 0.5) * 16;
      const cy = 18 + Math.random() * 10;
      const cz = z + (Math.random() - 0.5) * 16;
      for (let i = 0; i < n; i++) {
        pos.set([cx, cy, cz], i * 3);
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(Math.random() * 2 - 1);
        const sp = 7 + Math.random() * 3;
        vel.set([Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: COLORS[b % COLORS.length], size: 0.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const points = new THREE.Points(geo, mat);
      points.visible = false;
      this.group.add(points);
      this.bursts.push({ points, vel, age: 0, delay: b * 0.45 });
    }
  }

  update(dt: number): void {
    for (const b of this.bursts) {
      if (b.delay > 0) {
        b.delay -= dt;
        continue;
      }
      b.points.visible = true;
      b.age += dt;
      const pos = b.points.geometry.attributes.position as THREE.BufferAttribute;
      const a = pos.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) {
        b.vel[i + 1] -= 6 * dt;
        b.vel[i] *= 1 - dt * 1.2;
        b.vel[i + 2] *= 1 - dt * 1.2;
        a[i] += b.vel[i] * dt;
        a[i + 1] += b.vel[i + 1] * dt;
        a[i + 2] += b.vel[i + 2] * dt;
      }
      pos.needsUpdate = true;
      (b.points.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - b.age / 2.2);
    }
    this.bursts = this.bursts.filter((b) => {
      if (b.age < 2.2) return true;
      this.group.remove(b.points);
      b.points.geometry.dispose();
      (b.points.material as THREE.Material).dispose();
      return false;
    });
  }
}
