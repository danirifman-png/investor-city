import * as THREE from 'three';

/**
 * A skeleton for a pet model that came as one static mesh. The bones and the
 * weights are worked out from where each vertex sits (legs under the belly,
 * the head in front and above, the tail behind), so the dog can trot, sit,
 * eat, drink and curl up to sleep without a hand-made rig. `PetMotion` then
 * poses the bones procedurally every frame.
 */

/** Joint positions of one model, in the model's own units (facing +z). */
export interface QuadrupedShape {
  /** Body pivot (centre of the chest and belly). */
  body: [number, number, number];
  /** Where the neck meets the body. */
  neck: [number, number, number];
  /** Where the tail starts. */
  tail: [number, number, number];
  /** Hip height and the front and back hip positions along z, and how far apart the legs are in x. */
  hipY: number;
  frontZ: number;
  backZ: number;
  hipX: number;
  /** Vertices below `legTop` belong to the legs (blending up to `legBlend`). */
  legTop: number;
  legBlend: number;
  /** The head: in front of `headZ` and above `headY` (with a blend band). */
  headZ: number;
  headY: number;
  /** The tail: behind `tailZ` and above `tailY`. */
  tailZ: number;
  tailY: number;
  band: number;
}

export const DOG_SHAPE: QuadrupedShape = {
  body: [0, 0.16, 0],
  neck: [0, 0.24, 0.08],
  tail: [0, 0.2, -0.19],
  hipY: 0.1,
  frontZ: 0.11,
  backZ: -0.165,
  hipX: 0.055,
  legTop: 0.075,
  legBlend: 0.115,
  headZ: 0.04,
  headY: 0.22,
  tailZ: -0.185,
  tailY: 0.17,
  band: 0.04,
};

export type LegId = 'fl' | 'fr' | 'bl' | 'br';

export interface PetBones {
  root: THREE.Bone;
  body: THREE.Bone;
  head: THREE.Bone;
  tail: THREE.Bone;
  legs: Record<LegId, THREE.Bone>;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Replaces the first mesh in `obj` with a skinned copy and returns its bones (null when there is no mesh). */
export function rigQuadruped(obj: THREE.Object3D, s: QuadrupedShape): PetBones | null {
  let mesh: THREE.Mesh | null = null;
  obj.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
  });
  if (!mesh) return null;
  const src = mesh as THREE.Mesh;
  const geo = src.geometry.clone();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;

  const v3 = (p: [number, number, number]) => new THREE.Vector3(...p);
  const root = new THREE.Bone();
  root.name = 'pet_root';
  const body = new THREE.Bone();
  body.name = 'pet_body';
  body.position.copy(v3(s.body));
  root.add(body);
  const head = new THREE.Bone();
  head.name = 'pet_head';
  head.position.copy(v3(s.neck).sub(v3(s.body)));
  body.add(head);
  const tail = new THREE.Bone();
  tail.name = 'pet_tail';
  tail.position.copy(v3(s.tail).sub(v3(s.body)));
  body.add(tail);
  const legs = {} as Record<LegId, THREE.Bone>;
  const hip: Record<LegId, [number, number, number]> = {
    fl: [s.hipX, s.hipY, s.frontZ],
    fr: [-s.hipX, s.hipY, s.frontZ],
    bl: [s.hipX, s.hipY, s.backZ],
    br: [-s.hipX, s.hipY, s.backZ],
  };
  for (const id of ['fl', 'fr', 'bl', 'br'] as LegId[]) {
    const b = new THREE.Bone();
    b.name = `pet_leg_${id}`;
    b.position.copy(v3(hip[id]).sub(v3(s.body)));
    body.add(b);
    legs[id] = b;
  }
  const bones = [root, body, head, tail, legs.fl, legs.fr, legs.bl, legs.br];
  const index: Record<string, number> = { body: 1, head: 2, tail: 3, fl: 4, fr: 5, bl: 6, br: 7 };

  const n = pos.count;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const midZ = (s.frontZ + s.backZ) / 2;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let part = 'body';
    let w = 0;
    const leg = 1 - smooth(s.legTop, s.legBlend, y);
    if (leg > 0) {
      part = `${z > midZ ? 'f' : 'b'}${x >= 0 ? 'l' : 'r'}`;
      w = leg;
    } else {
      const hw = smooth(s.headZ - s.band, s.headZ + s.band, z) * smooth(s.headY - s.band, s.headY + s.band, y);
      const tw = smooth(-s.tailZ - s.band, -s.tailZ + s.band, -z) * smooth(s.tailY - s.band, s.tailY + s.band, y);
      if (hw >= tw && hw > 0) {
        part = 'head';
        w = hw;
      } else if (tw > 0) {
        part = 'tail';
        w = tw;
      }
    }
    skinIndex[i * 4] = index.body;
    skinWeight[i * 4] = 1 - w;
    skinIndex[i * 4 + 1] = index[part];
    skinWeight[i * 4 + 1] = w;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

  const skinned = new THREE.SkinnedMesh(geo, src.material);
  skinned.name = src.name;
  skinned.castShadow = src.castShadow;
  skinned.receiveShadow = src.receiveShadow;
  skinned.position.copy(src.position);
  skinned.quaternion.copy(src.quaternion);
  skinned.scale.copy(src.scale);
  skinned.frustumCulled = false;
  skinned.add(root);
  skinned.updateMatrixWorld(true);
  skinned.bind(new THREE.Skeleton(bones));
  src.parent!.add(skinned);
  src.removeFromParent();
  return { root, body, head, tail, legs };
}

export type PetAction = 'eat' | 'drink' | 'sleep' | 'beg' | null;

interface Pose {
  rootY: number;
  bodyX: number;
  bodyY: number;
  headX: number;
  headY: number;
  tailX: number;
  tailY: number;
  fl: number;
  fr: number;
  bl: number;
  br: number;
}

const ZERO: Pose = { rootY: 0, bodyX: 0, bodyY: 0, headX: 0, headY: 0, tailX: 0, tailY: 0, fl: 0, fr: 0, bl: 0, br: 0 };

/** How long the dog stands around before it sits, and then before it lies down. */
const SIT_AFTER = 5;
const LIE_AFTER = 22;

/**
 * Procedural movement on the pet bones: a trot that follows the walking
 * speed, a wagging tail, a head that looks around, sitting when the hero
 * waits, eating and drinking with the head in the bowl, and sleeping curled up.
 */
export class PetMotion {
  private t = 0;
  private gait = 0;
  private still = 0;
  private pose: Pose = { ...ZERO };

  constructor(private b: PetBones) {}

  update(dt: number, speed: number, action: PetAction): void {
    this.t += dt;
    const t = this.t;
    const moving = speed > 0.25;
    this.still = moving || action ? 0 : this.still + dt;
    const want: Pose = { ...ZERO };
    if (moving) {
      // trot: diagonal legs together, faster and longer steps at speed
      this.gait += dt * (6 + speed * 3.2);
      const a = Math.min(0.75, 0.3 + speed * 0.14);
      const s = Math.sin(this.gait);
      want.fl = a * s;
      want.br = a * s;
      want.fr = -a * s;
      want.bl = -a * s;
      want.bodyY = Math.abs(Math.cos(this.gait)) * 0.012;
      want.bodyX = Math.sin(this.gait * 2) * 0.03;
      want.headX = -0.08 + Math.sin(this.gait * 2) * 0.05;
      want.tailX = 0.45;
      want.tailY = Math.sin(t * 11) * 0.45;
    } else if (action === 'sleep' || (!action && this.still > LIE_AFTER)) {
      // curled up: legs folded, chin down, slow breathing, tail around
      const deep = action === 'sleep';
      want.rootY = -0.075;
      want.fl = want.fr = -1.35;
      want.bl = want.br = 1.3;
      want.headX = deep ? 0.32 : 0.15;
      want.headY = deep ? 0.45 : Math.sin(t * 0.4) * 0.3;
      want.bodyY = Math.sin(t * (deep ? 1.4 : 2)) * 0.005;
      want.tailX = -0.25;
      want.tailY = deep ? 0.9 : 0.6 + Math.sin(t * 2) * 0.15;
    } else if (action === 'eat' || action === 'drink') {
      // head in the bowl, nodding (lapping is quicker than chewing)
      const rate = action === 'drink' ? 13 : 7;
      want.bodyX = 0.14;
      want.fl = want.fr = -0.14;
      want.bl = want.br = -0.14;
      want.headX = 0.62 + Math.sin(t * rate) * (action === 'drink' ? 0.05 : 0.09);
      want.tailX = 0.35;
      want.tailY = Math.sin(t * 9) * 0.4;
    } else if (action === 'beg' || this.still > SIT_AFTER) {
      // sitting: rear down, front legs straight, looking up (begging when someone eats)
      const beg = action === 'beg';
      want.rootY = -0.025;
      want.bodyX = -0.42;
      want.fl = want.fr = 0.42;
      want.bl = want.br = -1.1;
      want.headX = beg ? -0.35 + Math.sin(t * 3) * 0.04 : 0.25;
      want.headY = beg ? Math.sin(t * 1.3) * 0.12 : Math.sin(t * 0.6) * 0.4;
      want.tailX = 0.1;
      want.tailY = Math.sin(t * (beg ? 12 : 4)) * (beg ? 0.5 : 0.25);
    } else {
      // standing: looking around, easy wag
      want.headY = Math.sin(t * 0.7) * 0.35;
      want.headX = Math.sin(t * 0.45) * 0.08;
      want.tailX = 0.3;
      want.tailY = Math.sin(t * 6) * 0.35;
      want.bodyY = Math.sin(t * 2.2) * 0.003;
    }
    // ease toward the wanted pose (legs quickly while walking so steps stay crisp)
    const k = 1 - Math.exp(-dt * (moving ? 22 : 6));
    const p = this.pose;
    for (const key of Object.keys(p) as (keyof Pose)[]) p[key] += (want[key] - p[key]) * k;
    const b = this.b;
    b.root.position.y = p.rootY;
    b.body.rotation.x = p.bodyX;
    b.body.position.y = bodyRestY(b) + p.bodyY;
    b.head.rotation.set(p.headX, p.headY, 0, 'YXZ');
    b.tail.rotation.set(p.tailX, p.tailY, 0, 'YXZ');
    b.legs.fl.rotation.x = p.fl;
    b.legs.fr.rotation.x = p.fr;
    b.legs.bl.rotation.x = p.bl;
    b.legs.br.rotation.x = p.br;
  }
}

const restY = new WeakMap<THREE.Bone, number>();
/** The body bone's rest height (remembered on first use). */
function bodyRestY(b: PetBones): number {
  let y = restY.get(b.body);
  if (y === undefined) {
    y = b.body.position.y;
    restY.set(b.body, y);
  }
  return y;
}
