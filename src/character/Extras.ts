import * as THREE from 'three';
import { PLAZA } from '../world/landmarks/plaza';
import type { CollisionWorld } from '../world/Collision';
import { AvatarAnimator, loadAvatar } from './AvatarNpc';

/**
 * Characters of the opening square: the market vendor (in the background:
 * idles, turns to greet the player and waves) and Bit the robot, who becomes
 * the player's buddy.
 */
interface Extra {
  model: string;
  x: number;
  z: number;
  heading: number;
  walkSpeed: number;
}

const STALL_ROT = Math.PI / 2 - 0.25;

/** A point in the stall's own frame (x along the counter, z toward the customers) in plaza coordinates. */
function stallSpot(lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(STALL_ROT);
  const s = Math.sin(STALL_ROT);
  return { x: PLAZA.stall.x + lx * c + lz * s, z: PLAZA.stall.z - lx * s + lz * c };
}

const EXTRAS: Extra[] = [
  // in front of the big stall, beside its counter, facing the customers (behind the counter there is no room to stand)
  { model: 'models/meshy/vendor.glb', ...stallSpot(1.1, 2.1), heading: STALL_ROT, walkSpeed: 1.3 },
];

const ROBOT: Extra = { model: 'models/meshy/robot.glb', x: PLAZA.robot.x, z: PLAZA.robot.z, heading: -Math.PI / 2 - 0.4, walkSpeed: 1.0 };

/** Where the buddy floats relative to the player: a little behind and to the right, at shoulder height. */
const FOLLOW = { side: 0.9, back: 0.8 };
/** Bit is a small hovering helper: about a third of a kid's height, floating at shoulder height. */
const BIT_SCALE = 0.42;
const HOVER = 1.05;

/**
 * Bit, the helper robot. It waits in the plaza until the player meets it, then
 * walks beside the player everywhere outdoors and now and then says something
 * useful (a gold coin nearby, a tip). It never blocks the player.
 */
export class RobotBuddy {
  object: THREE.Object3D | null = null;
  readonly position = new THREE.Vector3(ROBOT.x, 0, ROBOT.z);
  following = false;
  private heading = ROBOT.heading;
  private animator: AvatarAnimator | null = null;
  private greeted = false;
  private line: { text: string; time: number } | null = null;
  private time = 0;
  private lean = 0;
  /** Leg bones, folded away every frame: Bit has no legs, it floats on a glow. */
  private legs: THREE.Object3D[] = [];

  constructor(
    private collision: CollisionWorld,
    private block: { x0: number; z0: number; x1: number; z1: number },
  ) {}

  attach(object: THREE.Object3D, animator: AvatarAnimator): void {
    this.object = object;
    this.animator = animator;
    object.scale.multiplyScalar(BIT_SCALE);
    object.position.copy(this.position);
    object.rotation.y = this.heading;
    this.legs = ['LeftUpLeg', 'RightUpLeg'].map((n) => object.getObjectByName(n)).filter((b): b is THREE.Object3D => !!b);
    this.foldLegs();
    // a soft thruster glow where the legs were
    object.updateMatrixWorld(true);
    const hips = object.getObjectByName('Hips');
    const hy = hips ? (hips.getWorldPosition(new THREE.Vector3()).y - object.position.y) / object.scale.y : 0.9;
    const glow = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.42, 20, 1, true).rotateX(Math.PI),
      new THREE.MeshBasicMaterial({ color: '#7ff4ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    glow.scale.setScalar(0.42 / object.scale.y);
    glow.position.y = hy - (0.1 / object.scale.y);
    glow.name = 'bitGlow';
    object.add(glow);
  }

  private foldLegs(): void {
    for (const b of this.legs) b.scale.setScalar(0.001);
  }

  /** Starts following (and stops being an obstacle in the plaza). */
  follow(): void {
    if (this.following) return;
    this.following = true;
    Object.assign(this.block, { x0: 0, z0: 0, x1: 0, z1: 0 });
    this.animator?.play('wave');
  }

  /** Puts the buddy next to the player at once (after a teleport or leaving a building). */
  snap(p: THREE.Vector3, heading: number): void {
    if (!this.following) return;
    this.position.set(p.x + Math.cos(heading) * -FOLLOW.side - Math.sin(heading) * FOLLOW.back, p.y, p.z + Math.sin(heading) * FOLLOW.side - Math.cos(heading) * FOLLOW.back);
  }

  say(text: string, seconds = 4): void {
    this.line = { text, time: seconds };
  }

  /** The current speech bubble (world position over its head), if any. */
  get bubble(): { x: number; y: number; z: number; text: string } | null {
    return this.line && this.object?.visible ? { x: this.position.x, y: this.position.y + HOVER + 0.85, z: this.position.z, text: this.line.text } : null;
  }

  update(dt: number, player: { position: THREE.Vector3; heading: number; speed: number } | null): void {
    if (this.line && (this.line.time -= dt) <= 0) this.line = null;
    const o = this.object;
    if (!o || !this.animator) return;
    let speed = 0;
    if (!this.following || !player) {
      // waiting in the plaza: turn to greet the player
      const d = player ? Math.hypot(player.position.x - ROBOT.x, player.position.z - ROBOT.z) : Infinity;
      let want = ROBOT.heading;
      if (player && d < 6) {
        want = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
        if (!this.greeted && !this.animator.playing) {
          this.greeted = true;
          this.animator.play('wave');
        }
      } else if (d > 12) this.greeted = false;
      this.turn(want, dt);
    } else {
      const p = player.position;
      const h = player.heading;
      // right of the player is (-cos h, +sin h) for a heading measured from +Z toward +X
      const tx = p.x - Math.cos(h) * FOLLOW.side - Math.sin(h) * FOLLOW.back;
      const tz = p.z + Math.sin(h) * FOLLOW.side - Math.cos(h) * FOLLOW.back;
      const dx = tx - this.position.x;
      const dz = tz - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 30) this.snap(p, h);
      else if (dist > 0.25) {
        // catch up quickly when far, ease in when close
        const top = Math.max(3.2, player.speed + 2.5);
        const step = Math.min(dist, Math.min(top, dist * 3) * dt);
        this.position.x += (dx / dist) * step;
        this.position.z += (dz / dist) * step;
        speed = dt > 0 ? step / dt : 0;
        this.turn(Math.atan2(dx, dz), dt);
      } else this.turn(h, dt);
      const ground = this.collision.groundHeight(this.position.x, this.position.z, this.position.y + 0.6);
      this.position.y += (ground - this.position.y) * Math.min(1, dt * 12);
    }
    // it floats: a gentle bob, and leans into the direction it flies
    this.time += dt;
    o.position.set(this.position.x, this.position.y + HOVER + Math.sin(this.time * 2.2) * 0.08, this.position.z);
    o.rotation.y = this.heading;
    this.lean += (Math.min(speed * 0.05, 0.3) - this.lean) * Math.min(1, dt * 4);
    o.rotation.x = this.lean;
    // it flies instead of walking: the legs stay still
    this.animator.update(dt, 0);
    this.foldLegs();
    const glow = o.getObjectByName('bitGlow');
    if (glow) (glow as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.45 + Math.sin(this.time * 9) * 0.12;
  }

  private turn(want: number, dt: number): void {
    const diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.heading += diff * (1 - Math.exp(-dt * 6));
  }
}

class ExtraActor {
  private heading: number;
  private greeted = false;

  constructor(
    private def: Extra,
    readonly object: THREE.Object3D,
    private animator: AvatarAnimator,
  ) {
    this.heading = def.heading;
    object.position.set(def.x, 0, def.z);
    object.rotation.y = def.heading;
  }

  update(dt: number, player: THREE.Vector3 | null): void {
    const d = player ? Math.hypot(player.x - this.def.x, player.z - this.def.z) : Infinity;
    let want = this.def.heading;
    if (player && d < 6) {
      want = Math.atan2(player.x - this.def.x, player.z - this.def.z);
      // the vendor keeps to the stall: only a half turn toward the player
      if (this.def.model.includes('vendor')) want = this.def.heading + THREE.MathUtils.clamp(Math.atan2(Math.sin(want - this.def.heading), Math.cos(want - this.def.heading)), -0.9, 0.9);
      if (!this.greeted && !this.animator.playing) {
        this.greeted = true;
        this.animator.play('wave');
      }
    } else if (d > 12) this.greeted = false;
    const diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.heading += diff * (1 - Math.exp(-dt * 5));
    this.object.rotation.y = this.heading;
    this.animator.update(dt, 0);
  }
}

export class PlazaExtras {
  readonly group = new THREE.Group();
  private actors: ExtraActor[] = [];
  readonly buddy: RobotBuddy;

  constructor(collision: CollisionWorld) {
    this.group.name = 'plaza-extras';
    const r = ROBOT;
    const block = { x0: r.x - 0.35, z0: r.z - 0.35, x1: r.x + 0.35, z1: r.z + 0.35, bottom: 0, top: 1.8, water: false };
    collision.add(block);
    this.buddy = new RobotBuddy(collision, block);
    void loadAvatar(r.model)
      .then(({ scene, clips }) => {
        this.buddy.attach(scene, new AvatarAnimator(scene, clips, r.walkSpeed));
        this.group.add(scene);
      })
      .catch((err) => console.warn(`${r.model} failed to load`, err));
    for (const def of EXTRAS) {
      // stand on the paving (it is a little above y 0), measured before the actor's own block is added
      const y = Math.min(0.4, collision.groundHeight(def.x, def.z, 0.4));
      collision.add({ x0: def.x - 0.35, z0: def.z - 0.35, x1: def.x + 0.35, z1: def.z + 0.35, bottom: 0, top: 1.8, water: false });
      void loadAvatar(def.model)
        .then(({ scene, clips }) => {
          const actor = new ExtraActor(def, scene, new AvatarAnimator(scene, clips, def.walkSpeed));
          scene.position.y = y;
          this.actors.push(actor);
          this.group.add(scene);
        })
        .catch((err) => console.warn(`${def.model} failed to load`, err));
    }
  }

  update(dt: number, player: THREE.Vector3 | null): void {
    for (const a of this.actors) a.update(dt, player);
  }
}
