import * as THREE from 'three';
import { majorRoadCenters, minorRoadCenter } from './cityLayout';

/**
 * Shows the way to the current goal without words: glowing footprints that
 * flow from the player along the streets toward it, and a soft light column
 * with a bouncing arrow over the goal itself. One goal at a time (whatever
 * the quest tracker talks about).
 *
 * The route follows the street grid: from the player to the nearest street,
 * along it, and across to the goal (an L or a Z through the blocks' roads),
 * so the footprints do not cut through buildings.
 */

const STEP = 1.1;
/** Footprints shown ahead of the player (metres along the route). */
const AHEAD = 28;
const MAX_PRINTS = Math.ceil(AHEAD / STEP) + 2;
const NEAR = 7;

/** Street centre lines (the same on both axes: the city is a square grid). */
export const STREETS: number[] = [...majorRoadCenters(), ...[0, 1, 2].map((i) => minorRoadCenter(i))].sort((a, b) => a - b);

type P = { x: number; z: number };

function nearest(v: number): number {
  let best = STREETS[0];
  for (const s of STREETS) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
  return best;
}

function length(path: P[]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  return d;
}

/** A route from `a` to `b` along the street grid (straight when they are close). Pure, for tests. */
export function route(a: P, b: P): P[] {
  const direct = Math.hypot(b.x - a.x, b.z - a.z);
  if (direct < 22) return [a, b];
  // go down a north-south street first, or an east-west one first; keep the shorter
  const xa = nearest(a.x);
  const zb = nearest(b.z);
  const viaX: P[] = [a, { x: xa, z: a.z }, { x: xa, z: zb }, { x: b.x, z: zb }, b];
  const za = nearest(a.z);
  const xb = nearest(b.x);
  const viaZ: P[] = [a, { x: a.x, z: za }, { x: xb, z: za }, { x: xb, z: b.z }, b];
  const clean = (p: P[]) => p.filter((q, i) => i === 0 || Math.hypot(q.x - p[i - 1].x, q.z - p[i - 1].z) > 0.5);
  const x = clean(viaX);
  const z = clean(viaZ);
  return length(x) <= length(z) ? x : z;
}

export class Guide {
  readonly group = new THREE.Group();
  private prints: THREE.InstancedMesh;
  private beam: THREE.Mesh;
  private arrow: THREE.Mesh;
  private path: P[] = [];
  private target: P | null = null;
  private time = 0;
  private replan = 0;
  private dummy = new THREE.Object3D();
  private beamMat: THREE.ShaderMaterial;

  constructor(private ground: (x: number, z: number) => number) {
    this.group.name = 'guide';
    // a footprint: a rounded sole, flat on the ground
    const sole = new THREE.CircleGeometry(0.5, 14).rotateX(-Math.PI / 2);
    sole.scale(0.2, 1, 0.38);
    this.prints = new THREE.InstancedMesh(
      sole,
      new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.95, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      MAX_PRINTS,
    );
    this.prints.count = 0;
    this.prints.frustumCulled = false;
    this.prints.renderOrder = 2;
    // a soft column of light that fades upward
    this.beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'varying vec2 vUv; uniform float uTime; uniform float uFade; void main() { float a = pow(1.0 - vUv.y, 1.5) * (0.5 + 0.15 * sin(uTime * 3.0 - vUv.y * 8.0)); gl_FragColor = vec4(1.0, 0.78, 0.15, a * uFade); }',
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 10, 24, 1, true).translate(0, 5, 0), this.beamMat);
    this.beam.renderOrder = 2;
    // a big gold arrow pointing down, with a dark rim so it reads against a bright sky
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.4, 6).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffc81e', fog: false }));
    const rim = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 6).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#1d2f5c', side: THREE.BackSide, fog: false }));
    this.arrow.add(rim);
    this.group.add(this.prints, this.beam, this.arrow);
    this.group.visible = false;
  }

  /** The goal to lead to (null hides everything). */
  setTarget(t: P | null): void {
    if (t && this.target && Math.hypot(t.x - this.target.x, t.z - this.target.z) < 0.5) {
      // the same goal (characters move a little): keep the route, follow the point
      this.target = t;
      return;
    }
    this.target = t;
    this.replan = 0;
  }

  update(dt: number, player: THREE.Vector3, enabled: boolean): void {
    const t = this.target;
    this.group.visible = enabled && !!t;
    if (!t || !enabled) return;
    this.time += dt;
    const dist = Math.hypot(t.x - player.x, t.z - player.z);
    // the beacon over the goal
    const gy = this.ground(t.x, t.z);
    this.beam.position.set(t.x, gy, t.z);
    this.beamMat.uniforms.uTime.value = this.time;
    // fades out when the player is there
    const fade = THREE.MathUtils.clamp((dist - 2) / (NEAR - 2), 0, 1);
    this.beamMat.uniforms.uFade.value = fade;
    this.arrow.position.set(t.x, gy + 4.2 + Math.abs(Math.sin(this.time * 3)) * 0.6, t.z);
    this.arrow.rotation.y += dt * 1.5;
    this.arrow.visible = fade > 0.05;
    // footprints along the route, flowing toward the goal
    if ((this.replan -= dt) <= 0) {
      this.path = route({ x: player.x, z: player.z }, t);
      this.replan = 0.5;
    } else if (this.path.length) this.path[0] = { x: player.x, z: player.z };
    let n = 0;
    if (dist > NEAR - 2) {
      const flow = (this.time * 1.6) % STEP;
      let seg = 0;
      let segStart = 0;
      const total = Math.min(AHEAD, length(this.path) - 2.5);
      for (let d = 1.2 + flow; d < total && n < MAX_PRINTS; d += STEP, n++) {
        while (seg < this.path.length - 2) {
          const l = Math.hypot(this.path[seg + 1].x - this.path[seg].x, this.path[seg + 1].z - this.path[seg].z);
          if (d - segStart <= l) break;
          segStart += l;
          seg++;
        }
        const a = this.path[seg];
        const b = this.path[seg + 1] ?? a;
        const l = Math.max(1e-3, Math.hypot(b.x - a.x, b.z - a.z));
        const k = Math.min(1, (d - segStart) / l);
        const dx = (b.x - a.x) / l;
        const dz = (b.z - a.z) / l;
        // left and right feet, a little apart
        const side = n % 2 === 0 ? 0.17 : -0.17;
        const x = a.x + (b.x - a.x) * k + dz * side;
        const z = a.z + (b.z - a.z) * k - dx * side;
        // the far end fades away by shrinking
        const s = Math.min(1, (total - d) / 4) * Math.min(1, d / 1.5);
        // a little above the ground mesh (pavements sit higher than the collision floor)
        this.dummy.position.set(x, this.ground(x, z) + 0.12, z);
        this.dummy.rotation.set(0, Math.atan2(dx, dz), 0);
        this.dummy.scale.setScalar(Math.max(0.01, s));
        this.dummy.updateMatrix();
        this.prints.setMatrixAt(n, this.dummy.matrix);
      }
    }
    this.prints.count = n;
    this.prints.instanceMatrix.needsUpdate = true;
  }
}
