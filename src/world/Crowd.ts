import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, type Rect } from './cityLayout';

/**
 * The people walking around the city. Every person is one instance of a
 * single merged body (head, torso, arms, legs, every hair style and every
 * accessory), so the whole crowd is one draw call (plus one for the dogs).
 * The vertex shader picks each person's colours, hides the hair styles and
 * accessories they don't wear, swings arms and legs, and raises an arm to wave.
 *
 * Kinds of people: walkers, joggers, kids (smaller, quicker) and dog walkers.
 * They stop at shop windows now and then, wait instead of walking through
 * the player, and wave and say a line when the player comes close.
 */

type Kind = 'walk' | 'jog' | 'kid' | 'dog';

interface Person {
  kind: Kind;
  loop: Rect;
  s: number;
  dir: 1 | -1;
  speed: number;
  /** Walking cycle position (radians); advances with distance walked. */
  stride: number;
  scale: number;
  x: number;
  z: number;
  heading: number;
  /** Seconds left standing still (window shopping, phone, letting the player pass). */
  pause: number;
  nextPause: number;
  wave: number;
  greeted: boolean;
  /** Seconds before this person may speak again. */
  quiet: number;
  line: number;
  /** Arm swing, eased toward the walking/standing target. */
  swing: number;
}

/** People further than this from the player are not drawn (nor shadowed). */
const DRAW_RANGE = 80;
const COLOR_ATTRS = ['iSkin', 'iShirt', 'iPants', 'iHair', 'iShoes', 'iAccent'] as const;

const SKIN = ['#f6d6bd', '#f1c7a5', '#e0ac85', '#c68b5e', '#a8714a', '#7a4d2e', '#5c3a22'];
const HAIR = ['#2b1d14', '#5a3a22', '#8a5a2b', '#e3b862', '#c4452c', '#1b1b1f', '#9aa0aa', '#3b4fa8', '#ff6b9a'];
const SHIRT = ['#e34b4b', '#3d7be0', '#f2c14e', '#4fc79a', '#f08a4b', '#a57cf2', '#ffffff', '#ff6b9a', '#2c3e5f', '#3fb6e8', '#7de38f', '#ffd96b'];
const PANTS = ['#2f4a7a', '#2c2f36', '#3a3f46', '#7a5a3a', '#c9b48a', '#4c7a4c', '#5b4a8a', '#e8e2d4'];
const SHOES = ['#f4f4f4', '#2c2f36', '#e34b4b', '#3fb6e8', '#f2c14e', '#7a5a3a'];
const ACCENT = ['#ff8a3c', '#3d5bd9', '#e34b4b', '#4fc79a', '#f5b80f', '#a57cf2', '#2c2f36', '#ff6b9a'];
const SPORT = ['#ff3d6e', '#00c2a8', '#ffb200', '#4f6bff', '#b4ff3a'];
const DOGS = ['#c8964e', '#f4efe6', '#2c2a28', '#8a5a2b', '#e3c08a'];

/** Colour slots a vertex can take; 6 is a fixed dark (eyes). */
const C = { skin: 0, shirt: 1, pants: 2, hair: 3, shoes: 4, accent: 5, ink: 6 } as const;
/** Which limb a vertex follows. */
const L = { none: 0, legL: 1, legR: 2, armL: 3, armR: 4 } as const;
/** Hair styles 1-4 (0 = bald) and accessory bits (variant = 10 + bit). */
const HAIR_STYLES = 5;
const ACC = { hat: 1, backpack: 2, bag: 4, scarf: 8 } as const;

const HIP_Y = 0.9;
const SHOULDER_Y = 1.45;
const ARM_X = 0.3;

const LINE_COUNT = 24;
const TALK_RANGE = 4.2;
const GREET_RANGE = 3.4;

function part(geo: THREE.BufferGeometry, color: number, limb: number, variant = 0): THREE.BufferGeometry {
  const g = geo;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  // colour slot, limb and variant packed in one attribute (WebGL allows only 16 per draw)
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([color, limb, variant], i * 3);
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(a, 3));
  return g;
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const ball = (r: number, x: number, y: number, z: number, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 10, 8).scale(1, sy, sz).translate(x, y, z);
const capsule = (r: number, len: number, x: number, y: number, z: number, sx = 1, sz = 1) => new THREE.CapsuleGeometry(r, len, 3, 8).scale(sx, 1, sz).translate(x, y, z);

/** One body with every option on it, facing +z, feet at y = 0, about 1.8 m tall. */
function personGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const leg = side < 0 ? L.legL : L.legR;
    const arm = side < 0 ? L.armL : L.armR;
    parts.push(part(capsule(0.085, 0.62, side * 0.12, 0.5, 0), C.pants, leg));
    parts.push(part(box(0.17, 0.11, 0.3, side * 0.12, 0.055, 0.04), C.shoes, leg));
    parts.push(part(capsule(0.07, 0.42, side * ARM_X, 1.17, 0), C.shirt, arm));
    parts.push(part(ball(0.075, side * ARM_X, 0.88, 0), C.skin, arm));
    parts.push(part(ball(0.025, side * 0.065, 1.7, 0.155), C.ink, L.none));
  }
  parts.push(part(box(0.38, 0.2, 0.24, 0, 0.93, 0), C.pants, L.none));
  parts.push(part(capsule(0.2, 0.3, 0, 1.22, 0, 1.18, 0.82), C.shirt, L.none));
  parts.push(part(capsule(0.06, 0.05, 0, 1.52, 0), C.skin, L.none));
  parts.push(part(ball(0.17, 0, 1.69, 0, 1.08, 1), C.skin, L.none));
  // hair styles: 1 short, 2 long, 3 bun, 4 curly
  const cap = (v: number) => part(ball(0.18, 0, 1.75, -0.02, 0.72, 1.02), C.hair, L.none, v);
  parts.push(cap(1));
  parts.push(cap(2), part(box(0.32, 0.36, 0.1, 0, 1.56, -0.12), C.hair, L.none, 2));
  parts.push(cap(3), part(ball(0.085, 0, 1.9, -0.09), C.hair, L.none, 3));
  for (const [x, y, z] of [[0, 1.85, 0], [-0.13, 1.79, 0], [0.13, 1.79, 0], [0, 1.8, -0.12], [-0.09, 1.76, -0.1], [0.09, 1.76, -0.1]]) {
    parts.push(part(ball(0.085, x, y, z), C.hair, L.none, 4));
  }
  // accessories
  parts.push(part(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 14).translate(0, 1.82, 0.03), C.accent, L.none, 10 + ACC.hat));
  parts.push(part(new THREE.CylinderGeometry(0.17, 0.18, 0.16, 14).translate(0, 1.9, 0), C.accent, L.none, 10 + ACC.hat));
  parts.push(part(box(0.32, 0.38, 0.15, 0, 1.24, -0.24), C.accent, L.none, 10 + ACC.backpack));
  parts.push(part(box(0.2, 0.24, 0.09, ARM_X + 0.03, 0.72, 0), C.accent, L.armR, 10 + ACC.bag));
  parts.push(part(new THREE.TorusGeometry(0.14, 0.05, 6, 14).rotateX(Math.PI / 2).translate(0, 1.5, 0), C.accent, L.none, 10 + ACC.scarf));
  return mergeGeometries(parts)!;
}

function dogGeometry(): THREE.BufferGeometry {
  const g = mergeGeometries([
    box(0.22, 0.2, 0.5, 0, 0.32, 0),
    box(0.18, 0.17, 0.2, 0, 0.47, 0.3),
    box(0.1, 0.07, 0.1, 0, 0.44, 0.43),
    box(0.06, 0.1, 0.05, -0.07, 0.6, 0.27),
    box(0.06, 0.1, 0.05, 0.07, 0.6, 0.27),
    box(0.04, 0.04, 0.2, 0, 0.42, -0.3).rotateX(-0.6),
    ...[-0.08, 0.08].flatMap((x) => [box(0.06, 0.22, 0.06, x, 0.11, 0.18), box(0.06, 0.22, 0.06, x, 0.11, -0.18)]),
  ].map((b) => (b.deleteAttribute('uv'), b)))!;
  return g;
}

/** Shared shader edit for the colour pass and the shadow pass. */
const POSE_HEADER = /* glsl */ `
attribute vec3 aPart;     // colour slot, limb, variant
#define aColor aPart.x
#define aLimb aPart.y
#define aVariant aPart.z
attribute vec4 iAnim;     // stride phase, swing amount, wave (0..1), hair style
attribute float iAcc;     // accessory bits
attribute vec3 iSkin;
attribute vec3 iShirt;
attribute vec3 iPants;
attribute vec3 iHair;
attribute vec3 iShoes;
attribute vec3 iAccent;
uniform float uTime;
varying vec3 vCrowdColor;

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

bool crowdHidden() {
  if (aVariant > 0.5 && aVariant < 9.5) return abs(aVariant - iAnim.w) > 0.5;
  if (aVariant > 9.5) return (int(iAcc + 0.5) & int(aVariant - 10.0 + 0.5)) == 0;
  return false;
}

mat3 crowdLimb(out vec3 pivot) {
  float swing = sin(iAnim.x) * iAnim.y;
  pivot = vec3(0.0);
  if (aLimb < 0.5) return mat3(1.0);
  if (aLimb < 2.5) {
    pivot = vec3(0.0, ${HIP_Y.toFixed(2)}, 0.0);
    return rotX(aLimb < 1.5 ? swing : -swing);
  }
  float side = aLimb < 3.5 ? -1.0 : 1.0;
  pivot = vec3(side * ${ARM_X.toFixed(2)}, ${SHOULDER_Y.toFixed(2)}, 0.0);
  float a = aLimb < 3.5 ? -swing * 0.8 : swing * 0.8;
  mat3 m = rotX(a);
  // the right arm waves: up over the head, hand rocking
  if (aLimb > 3.5 && iAnim.z > 0.0) m = rotZ(iAnim.z * (2.6 + sin(uTime * 12.0) * 0.25)) * rotX(a * (1.0 - iAnim.z));
  return m;
}
`;

function pose(shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }, time: THREE.IUniform, withColor: boolean): void {
  shader.uniforms.uTime = time;
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${POSE_HEADER}`);
  if (shader.vertexShader.includes('#include <beginnormal_vertex>')) {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      { vec3 pv; mat3 lm = crowdLimb(pv); objectNormal = lm * objectNormal; }`,
    );
  }
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    { vec3 pv; mat3 lm = crowdLimb(pv); transformed = lm * (transformed - pv) + pv; }
    if (crowdHidden()) transformed = vec3(0.0);
    ${
      withColor
        ? `vCrowdColor = aColor < 0.5 ? iSkin : aColor < 1.5 ? iShirt : aColor < 2.5 ? iPants : aColor < 3.5 ? iHair : aColor < 4.5 ? iShoes : aColor < 5.5 ? iAccent : vec3(0.06);`
        : ''
    }`,
  );
}

export class Crowd {
  readonly group = new THREE.Group();
  private people: Person[] = [];
  private mesh: THREE.InstancedMesh;
  private dogs: THREE.InstancedMesh;
  private dogOwners: number[] = [];
  private anim: THREE.InstancedBufferAttribute;
  private time = { value: 0 };
  private dummy = new THREE.Object3D();
  private rng = mulberry32(777);
  private speaker: number | null = null;
  private hairStyle: number[] = [];
  private source!: Record<(typeof COLOR_ATTRS)[number] | 'iAcc', Float32Array>;
  /** Which person each GPU slot currently shows (-1: none yet). */
  private slotOwner!: Int32Array;
  private dogColors: THREE.Color[] = [];
  private speakTime = 0;

  constructor(walkLoops: Rect[], count: number) {
    this.group.name = 'crowd';
    const rng = this.rng;
    const pick = <T>(a: T[]) => a[Math.floor(rng() * a.length)];
    const geo = personGeometry();

    // buffers need at least one slot even for an empty crowd
    const n = Math.max(1, count);
    const cols = { iSkin: new Float32Array(n * 3), iShirt: new Float32Array(n * 3), iPants: new Float32Array(n * 3), iHair: new Float32Array(n * 3), iShoes: new Float32Array(n * 3), iAccent: new Float32Array(n * 3) };
    const anim = new Float32Array(n * 4);
    const acc = new Float32Array(n);
    const c = new THREE.Color();
    const put = (arr: Float32Array, i: number, hex: string) => c.set(hex).toArray(arr, i * 3);

    for (let i = 0; i < count; i++) {
      const r = rng();
      const kind: Kind = r < 0.12 ? 'jog' : r < 0.3 ? 'kid' : r < 0.4 ? 'dog' : 'walk';
      const loop = pick(walkLoops);
      const speed = kind === 'jog' ? 3 + rng() * 0.8 : kind === 'kid' ? 1.5 + rng() * 0.5 : 1.0 + rng() * 0.5;
      this.people.push({
        kind,
        loop,
        s: rng(),
        dir: rng() < 0.5 ? -1 : 1,
        speed,
        stride: rng() * 10,
        scale: kind === 'kid' ? 0.68 + rng() * 0.1 : 0.92 + rng() * 0.14,
        x: 0,
        z: 0,
        heading: 0,
        pause: 0,
        nextPause: 6 + rng() * 30,
        wave: 0,
        greeted: false,
        quiet: 0,
        line: Math.floor(rng() * LINE_COUNT),
        swing: 0,
      });
      put(cols.iSkin, i, pick(SKIN));
      put(cols.iHair, i, pick(HAIR));
      put(cols.iShirt, i, kind === 'jog' ? pick(SPORT) : pick(SHIRT));
      put(cols.iPants, i, kind === 'jog' ? pick(['#2c2f36', '#3a3f46', '#2f4a7a']) : pick(PANTS));
      put(cols.iShoes, i, kind === 'jog' ? pick(SPORT) : pick(SHOES));
      put(cols.iAccent, i, pick(ACCENT));
      this.hairStyle.push(Math.floor(rng() * HAIR_STYLES));
      let bits = 0;
      if (kind !== 'jog') {
        if (rng() < 0.22) bits |= ACC.hat;
        if (rng() < (kind === 'kid' ? 0.6 : 0.2)) bits |= ACC.backpack;
        if (kind === 'walk' && rng() < 0.3) bits |= ACC.bag;
        if (rng() < 0.15) bits |= ACC.scarf;
      }
      acc[i] = bits;
      if (kind === 'dog') this.dogOwners.push(i);
    }
    // per-person looks live in `source`; the GPU attributes hold only the people
    // drawn this frame, packed at the front (see `update`)
    this.source = { ...cols, iAcc: acc };
    for (const [name, arr] of Object.entries(cols)) geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr.slice(), 3));
    this.anim = new THREE.InstancedBufferAttribute(anim, 4);
    this.anim.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iAnim', this.anim);
    geo.setAttribute('iAcc', new THREE.InstancedBufferAttribute(acc.slice(), 1));
    this.slotOwner = new Int32Array(n).fill(-1);

    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 });
    mat.onBeforeCompile = (shader) => {
      pose(shader, this.time, true);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCrowdColor;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vCrowdColor;');
    };
    mat.customProgramCacheKey = () => 'crowd';
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (shader) => pose(shader, this.time, false);
    depth.customProgramCacheKey = () => 'crowd-depth';

    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.customDepthMaterial = depth;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'crowd-people';
    this.group.add(this.mesh);

    this.dogs = new THREE.InstancedMesh(dogGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.85 }), Math.max(1, this.dogOwners.length));
    this.dogColors = this.dogOwners.map(() => new THREE.Color(pick(DOGS)));
    this.dogColors.forEach((col, k) => this.dogs.setColorAt(k, col));
    this.dogs.count = this.dogOwners.length;
    this.dogs.castShadow = true;
    this.dogs.frustumCulled = false;
    this.dogs.name = 'crowd-dogs';
    this.group.add(this.dogs);
  }

  get size(): number {
    return this.people.length;
  }

  /** Position along a loop: point, walking heading, and the heading that faces the building inside it. */
  private along(r: Rect, s: number): { x: number; z: number; heading: number; inward: number } {
    const W = r.x1 - r.x0;
    const D = r.z1 - r.z0;
    let d = s * 2 * (W + D);
    if (d < W) return { x: r.x0 + d, z: r.z0, heading: Math.PI / 2, inward: 0 };
    if ((d -= W) < D) return { x: r.x1, z: r.z0 + d, heading: 0, inward: -Math.PI / 2 };
    if ((d -= D) < W) return { x: r.x1 - d, z: r.z1, heading: -Math.PI / 2, inward: Math.PI };
    d -= W;
    return { x: r.x0, z: r.z1 - d, heading: Math.PI, inward: Math.PI / 2 };
  }

  update(time: number, dt: number, player: THREE.Vector3 | null): void {
    this.time.value = time;
    const d = this.dummy;
    const anim = this.anim.array as Float32Array;
    let best: number | null = null;
    let bestD = TALK_RANGE;
    let slot = 0;
    let looksChanged = false;

    this.people.forEach((p, i) => {
      const r = p.loop;
      const perim = 2 * (r.x1 - r.x0 + r.z1 - r.z0);
      const toPlayer = player ? Math.hypot(player.x - p.x, player.z - p.z) : Infinity;
      // don't walk through the player: wait while they stand just ahead
      let blocked = false;
      if (player && toPlayer < 1.3) {
        const ahead = Math.sin(p.heading) * (player.x - p.x) + Math.cos(p.heading) * (player.z - p.z);
        blocked = ahead > 0;
      }
      p.nextPause -= dt;
      if (p.nextPause <= 0 && p.kind !== 'jog') {
        p.nextPause = 18 + this.rng() * 30;
        p.pause = 2 + this.rng() * 3;
      }
      p.quiet = Math.max(0, p.quiet - dt);
      const moving = p.pause <= 0 && !blocked;
      if (p.pause > 0) p.pause -= dt;
      if (moving) {
        p.s = (p.s + (p.dir * p.speed * dt) / perim + 1) % 1;
        p.stride += (p.speed * dt * (p.kind === 'jog' ? 3.2 : 4.4)) / p.scale;
      }
      const at = this.along(r, p.s);
      p.x = at.x;
      p.z = at.z;
      let want = p.dir > 0 ? at.heading : at.heading + Math.PI;
      if (p.pause > 0) want = at.inward;
      // notice the player: turn, wave once, maybe say something
      if (player && toPlayer < GREET_RANGE && p.kind !== 'jog') {
        want = Math.atan2(player.x - p.x, player.z - p.z);
        if (!p.greeted) {
          p.greeted = true;
          p.wave = 1.6;
          p.pause = Math.max(p.pause, 2.2);
        }
      }
      if (toPlayer > GREET_RANGE * 3) p.greeted = false;
      let diff = want - p.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.heading += diff * (1 - Math.exp(-dt * 8));
      p.wave = Math.max(0, p.wave - dt);
      if (toPlayer < bestD && p.kind !== 'jog' && (p.quiet === 0 || i === this.speaker)) {
        bestD = toPlayer;
        best = i;
      }

      const swing = moving ? (p.kind === 'jog' ? 0.75 : 0.45) : 0;
      p.swing += (swing - p.swing) * Math.min(1, dt * 10);
      if (player && toPlayer > DRAW_RANGE) return;
      const k = slot++;
      if (this.slotOwner[k] !== i) {
        this.slotOwner[k] = i;
        this.copyLook(i, k);
        looksChanged = true;
      }
      anim[k * 4] = p.stride;
      anim[k * 4 + 1] = p.swing;
      anim[k * 4 + 2] = Math.min(1, p.wave * 3) * (p.wave > 0 ? 1 : 0);
      anim[k * 4 + 3] = this.hairStyle[i];
      const bounce = moving ? Math.abs(Math.sin(p.stride)) * (p.kind === 'jog' ? 0.09 : 0.04) : 0;
      d.position.set(p.x, 0.3 + bounce, p.z);
      d.rotation.set(0, p.heading, 0);
      d.scale.setScalar(p.scale);
      d.updateMatrix();
      this.mesh.setMatrixAt(k, d.matrix);
    });
    this.mesh.count = slot;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.anim.needsUpdate = true;
    if (looksChanged) for (const name of [...COLOR_ATTRS, 'iAcc']) this.mesh.geometry.getAttribute(name).needsUpdate = true;

    // dogs trot a metre ahead of their owner
    let dogSlot = 0;
    this.dogOwners.forEach((i, n) => {
      const p = this.people[i];
      if (player && Math.hypot(player.x - p.x, player.z - p.z) > DRAW_RANGE) return;
      const k = dogSlot++;
      this.dogs.setColorAt(k, this.dogColors[n]);
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const moving = p.swing > 0.1;
      d.position.set(p.x + fx * 1.1 + fz * 0.35, 0.3 + (moving ? Math.abs(Math.sin(p.stride * 1.6)) * 0.05 : 0), p.z + fz * 1.1 - fx * 0.35);
      d.rotation.set(0, p.heading + (moving ? 0 : Math.sin(time * 2 + n) * 0.6), 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      this.dogs.setMatrixAt(k, d.matrix);
    });
    this.dogs.count = dogSlot;
    this.dogs.instanceMatrix.needsUpdate = true;
    if (this.dogs.instanceColor) this.dogs.instanceColor.needsUpdate = true;

    // one person at a time talks to the player
    if (best !== this.speaker) {
      if (this.speaker !== null) this.people[this.speaker].quiet = 8;
      this.speaker = best;
      this.speakTime = 0;
      if (best !== null) this.people[best].line = (this.people[best].line + 1 + Math.floor(this.rng() * 3)) % LINE_COUNT;
    } else if (best !== null) {
      this.speakTime += dt;
      if (this.speakTime > 5) {
        this.people[best].quiet = 10;
        this.speaker = null;
      }
    }
  }

  /** Copies person `i`'s colours and accessories into GPU slot `k`. */
  private copyLook(i: number, k: number): void {
    const geo = this.mesh.geometry;
    for (const name of COLOR_ATTRS) {
      const dst = geo.getAttribute(name).array as Float32Array;
      const src = this.source[name];
      dst[k * 3] = src[i * 3];
      dst[k * 3 + 1] = src[i * 3 + 1];
      dst[k * 3 + 2] = src[i * 3 + 2];
    }
    (geo.getAttribute('iAcc').array as Float32Array)[k] = this.source.iAcc[i];
  }

  /** What the nearest person is saying to the player, if anyone. */
  bubble(): { x: number; y: number; z: number; line: number; kid: boolean } | null {
    if (this.speaker === null) return null;
    const p = this.people[this.speaker];
    return { x: p.x, y: 0.3 + 2.0 * p.scale, z: p.z, line: p.line, kid: p.kind === 'kid' };
  }

  /** For tests: what kinds of people exist. */
  census(): Record<Kind, number> {
    const out: Record<Kind, number> = { walk: 0, jog: 0, kid: 0, dog: 0 };
    for (const p of this.people) out[p.kind]++;
    return out;
  }
}

export const CROWD_LINES = LINE_COUNT;
