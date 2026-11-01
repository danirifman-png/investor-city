import * as THREE from 'three';
import type { CharacterLook } from '../content/characterOptions';
import type { Input } from '../core/Input';
import type { CollisionWorld } from '../world/Collision';
import { HALF_CITY } from '../world/cityLayout';
import { RIVER_BOUNDS } from '../world/landmarks/river';
import { AvatarAnimator, loadGltf, type GestureAnimator } from './AvatarNpc';
import { CharacterAnimator, RUN_SPEED, WALK_SPEED } from './CharacterAnimator';
import { buildCharacter, characterHeight, disposeCharacter, type Rig } from './CharacterModel';
import { heroArms, heroHead, heroHelmet, reach, rigArms, rigHead, rigHelmet, wearHelmet, type HeadFrame } from './riderGear';

/**
 * How each ride is shown: its model, how high the rider stands, where the
 * hands hold on (left grip, rider space, +z forward) and how it is turned.
 * The plain kick scooter is the starting ride; the rest are bought in the mall.
 */
interface RideFit {
  file: string;
  scale?: number;
  deck: number;
  grip?: [number, number, number];
  rotY?: number;
  z?: number;
  /** Floats and bobs above the ground. */
  hover?: number;
}
const RIDES: Record<string, RideFit> = {
  scooter: { file: 'models/meshy/props/scooter.glb', scale: 0.95, deck: 0.14, grip: [0.22, 1.1, 0.25] },
  skateboard: { file: 'models/meshy/shop/skateboard.glb', deck: 0.13 },
  scooterPro: { file: 'models/meshy/shop/scooter_pro.glb', deck: 0.14, grip: [0.2, 1.0, 0.36] },
  bicycle: { file: 'models/meshy/props/bicycle.glb', deck: 0.42, grip: [0.24, 1.05, 0.52], rotY: Math.PI / 2, z: -0.1 },
  goKart: { file: 'models/meshy/shop/go_kart.glb', deck: 0.12, grip: [0.15, 0.6, 0.12], z: -0.42 },
  hoverboard: { file: 'models/meshy/shop/hoverboard.glb', deck: 0.15, hover: 0.28 },
};

const RADIUS = 0.42;
const tmpGrip = new THREE.Vector3();
const tmpPole = new THREE.Vector3();
/** Take-off speed of a jump (about 1.5 m high with the gravity below). */
const JUMP_SPEED = 8.2;
const GRAVITY = 22;
/** Top speed on the kick scooter. */
export const SCOOTER_SPEED = 9;
const BOUND = HALF_CITY + 10;
export interface Bounds {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}
/** The city plus the far banks of the river (south and east), reached over the bridges. */
export const CITY_BOUNDS: Bounds = { x0: -BOUND, z0: -BOUND, x1: RIVER_BOUNDS.x1, z1: RIVER_BOUNDS.z1 };

/**
 * Moves the player character through the city: camera-relative movement,
 * walking/running, smooth turning, collision against buildings, stepping onto
 * curbs and stairs, and gravity when stepping down.
 */
export class PlayerController {
  readonly object = new THREE.Group();
  /** Feet position in world space (the camera follows this vector). */
  readonly position = new THREE.Vector3();
  heading = 0;
  speed = 0;
  /** Metres walked, for progress stats. */
  distance = 0;
  private rig: Rig;
  private rigAnimator: CharacterAnimator;
  /** The hero model (Meshy kid) once loaded; it replaces the built body. */
  private hero: { scene: THREE.Object3D; animator: AvatarAnimator; height: number } | null = null;
  private velY = 0;
  private velocity = new THREE.Vector2();
  private jumpQueued = 0;
  /** Called when the player leaves the ground by jumping or bouncing. */
  onJump: ((bounce: boolean) => void) | null = null;
  private airborne = false;
  /** Riding the kick scooter (faster, glides, leans into turns). */
  private riding = false;
  /** Speed multipliers from bought gear (a faster ride, running shoes). */
  rideBoost = 1;
  walkBoost = 1;
  private scooter: THREE.Group | null = null;
  /** Which ride the scooter key gets on (a bought one, or the plain scooter). */
  private rideId = 'scooter';
  private rideTime = 0;
  private lean = 0;
  frozen = false;
  look: CharacterLook;

  constructor(
    look: CharacterLook,
    private input: Input,
    private collision: CollisionWorld,
  ) {
    this.look = look;
    this.object.name = 'player';
    this.rig = buildCharacter(look);
    this.object.add(this.rig.root);
    this.rigAnimator = new CharacterAnimator(this.rig);
    // soft blob shadow keeps the character grounded even where shadows are off
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false }),
    );
    blob.position.y = 0.02;
    blob.renderOrder = 1;
    this.object.add(blob);
  }

  get animator(): GestureAnimator {
    return this.hero && this.look.model !== 'custom' ? this.hero.animator : this.rigAnimator;
  }

  get height(): number {
    return this.hero && this.look.model !== 'custom' ? this.hero.height : characterHeight(this.look);
  }

  setLook(look: CharacterLook): void {
    this.look = look;
    disposeCharacter(this.rig);
    this.rig = buildCharacter(look);
    this.object.add(this.rig.root);
    this.rigAnimator.setRig(this.rig);
    this.rig.root.position.y = this.riding ? this.lift : 0;
    this.showModel();
  }

  /** Uses the hero model for the "hero" look (the built body stays as the custom look and fallback). */
  useHero(scene: THREE.Object3D, clips: THREE.AnimationClip[], scale: number, walkSpeed: number): void {
    // a different hero replaces the one shown now
    if (this.hero) this.object.remove(this.hero.scene);
    scene.scale.setScalar(scale);
    scene.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh));
    this.object.add(scene);
    // precise: skinned meshes are measured in their posed shape (their raw
    // geometry sits under a 0.01 armature scale and would read as 1.4 cm)
    scene.updateMatrixWorld(true);
    scene.traverse((o) => (o as THREE.SkinnedMesh).skeleton?.update());
    const box = new THREE.Box3().setFromObject(scene, true);
    this.hero = { scene, animator: new AvatarAnimator(scene, clips, walkSpeed * scale), height: box.max.y - this.object.position.y };
    this.showModel();
  }

  private showModel(): void {
    const hero = !!this.hero && this.look.model !== 'custom';
    this.rig.root.visible = !hero;
    if (this.hero) this.hero.scene.visible = hero;
  }

  /** Places the player, nudging them to the nearest free spot if needed. */
  /** Where the player may walk (the city, or a room while indoors). */
  bounds: Bounds = CITY_BOUNDS;
  /** Round pads that throw the player up on landing (trampolines). Cleared indoors by the game. */
  bouncers: { x: number; z: number; r: number; top: number; launch: number }[] = [];
  /** Trampoline bounces so far (for tests and stats). */
  bounces = 0;
  /** Extra walkable rectangles outside `bounds` (areas unlocked by quests). Ignored indoors. */
  extraAreas: Bounds[] = [];

  /** Moves the player; `floor` is the height of the floor there (steps, podiums). */
  teleport(x: number, z: number, heading = this.heading, floor = 0): void {
    const free = this.collision.findFree(x, z, RADIUS, floor + 0.4) ?? { x, z };
    const px = free.x;
    const pz = free.z;
    this.position.set(px, 0, pz);
    this.position.y = this.collision.groundHeight(px, pz, floor + 1.0);
    this.heading = heading;
    this.velocity.set(0, 0);
    this.velY = 0;
    this.sync();
  }

  update(dt: number, cameraYaw: number): void {
    const m = this.frozen ? { x: 0, y: 0, magnitude: 0 } : this.input.move();
    const running = this.input.running();
    // analog stick: a gentle push walks slowly; the run toggle keeps a real run even on a half push
    const top = this.riding ? SCOOTER_SPEED * this.rideBoost : (running ? RUN_SPEED : WALK_SPEED) * this.walkBoost;
    const target = m.magnitude > 0.05 ? top * Math.max(this.riding ? 0.5 : running ? 0.75 : 0.35, m.magnitude) : 0;

    // camera-relative direction: "up" walks away from the camera
    const s = Math.sin(cameraYaw);
    const c = Math.cos(cameraYaw);
    // unit direction; how far the stick is pushed only scales `target`
    const inv = m.magnitude > 1e-6 ? 1 / m.magnitude : 0;
    const dx = (m.x * c - m.y * s) * inv;
    const dz = (-m.x * s - m.y * c) * inv;
    // a scooter speeds up a little slower and rolls on after you let go
    const accel = 1 - Math.exp(-dt * (this.riding ? (target > 0 ? 3.5 : 1.6) : target > 0 ? 10 : 14));
    this.velocity.x += (dx * target - this.velocity.x) * accel;
    this.velocity.y += (dz * target - this.velocity.y) * accel;

    if (m.magnitude > 0.05) {
      const want = Math.atan2(dx, dz);
      let diff = want - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += diff * (1 - Math.exp(-dt * (this.riding ? 6 : 14)));
      this.lean += (THREE.MathUtils.clamp(-diff * 0.8, -0.35, 0.35) - this.lean) * (1 - Math.exp(-dt * 6));
    } else this.lean *= 1 - Math.min(1, dt * 4);

    const before = this.position.clone();
    let nx = this.position.x + this.velocity.x * dt;
    let nz = this.position.z + this.velocity.y * dt;
    // stay inside the main bounds or any extra open area (unlocked trails)
    const inside = (r: Bounds, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
    const areas = [this.bounds, ...this.extraAreas];
    if (!areas.some((r) => inside(r, nx, nz))) {
      const home = areas.find((r) => inside(r, this.position.x, this.position.z)) ?? this.bounds;
      nx = THREE.MathUtils.clamp(nx, home.x0, home.x1);
      nz = THREE.MathUtils.clamp(nz, home.z0, home.z1);
    }
    const res = this.collision.resolve(nx, nz, RADIUS, this.position.y);
    this.position.x = res.x;
    this.position.z = res.z;

    // step up instantly onto curbs and stairs, fall with gravity when stepping down,
    // and jump when asked while standing on something
    const ground = this.collision.groundHeight(this.position.x, this.position.z, this.position.y);
    this.jumpQueued = Math.max(0, this.jumpQueued - dt);
    if (this.velY <= 0 && ground >= this.position.y - 0.02) {
      this.position.y += (ground - this.position.y) * (1 - Math.exp(-dt * 25));
      this.velY = 0;
      if (this.airborne) this.airborne = false;
      const pad = this.bouncers.find((b) => Math.abs(ground - b.top) < 0.08 && Math.hypot(this.position.x - b.x, this.position.z - b.z) < b.r);
      if (pad && !this.frozen) {
        // a trampoline: always bounces, higher when jump is pressed on landing
        this.velY = pad.launch * (this.jumpQueued > 0 ? 1.18 : 1);
        this.jumpQueued = 0;
        this.airborne = true;
        this.position.y += 0.02;
        this.bounces++;
        this.onJump?.(true);
      } else if (this.jumpQueued > 0 && !this.frozen) {
        this.jumpQueued = 0;
        this.velY = JUMP_SPEED;
        this.airborne = true;
        this.position.y += 0.02;
        this.onJump?.(false);
      }
    } else {
      this.velY -= GRAVITY * dt;
      this.position.y = Math.max(ground, this.position.y + this.velY * dt);
      if (this.position.y === ground && this.velY <= 0) this.velY = 0;
    }

    const moved = Math.hypot(this.position.x - before.x, this.position.z - before.z);
    this.speed = dt > 0 ? moved / dt : 0;
    this.distance += moved;
    // on the scooter the rider stands still and glides; the wheels turn with speed
    this.animator.update(dt, this.riding ? 0 : this.airborne ? Math.min(this.speed, 1) : this.speed);
    if (this.scooter) {
      for (const w of this.scooter.userData.wheels as THREE.Object3D[]) w.rotation.x += (moved / 0.09) * 0.5;
      this.object.rotation.z = 0;
    }
    this.sync();
    if (this.riding) {
      const hover = RIDES[this.rideId].hover;
      if (hover && this.scooter) {
        this.rideTime += dt;
        const bob = Math.sin(this.rideTime * 3) * 0.04;
        this.scooter.position.y = bob;
        this.setLift(this.lift + bob);
      }
      this.holdOn();
    }
  }

  /** On the scooter: helmet on, both hands on the handlebar (after the animation has posed the arms). */
  private holdOn(): void {
    const useHero = !!this.hero && this.look.model !== 'custom';
    const helmet = useHero ? heroHelmet(this.hero!.scene) : rigHelmet(this.rig.head);
    this.object.updateMatrixWorld(true);
    if (helmet) {
      helmet.visible = true;
      wearHelmet(helmet);
    }
    const arms = useHero ? heroArms(this.hero!.scene) : rigArms(this.rig);
    const grips = this.scooter?.userData.grips as THREE.Vector3[] | undefined;
    if (!arms || !grips) return;
    this.object.updateMatrixWorld(true);
    // grips[0] is on the rider's left (+x), elbows bend out, down and back
    for (const [arm, grip, side] of [
      [arms.left, grips[0], 1],
      [arms.right, grips[1], -1],
    ] as const) {
      this.object.localToWorld(tmpGrip.copy(grip));
      tmpPole.set(side * 0.7, -0.6, -0.4).applyQuaternion(this.object.quaternion);
      reach(arm, tmpGrip, tmpPole);
    }
  }

  /** Hides the helmets when getting off (each body keeps its own). */
  private helmetsOff(): void {
    for (const head of [this.hero?.scene.getObjectByName('Head'), this.rig.head]) {
      const h = head?.userData.helmet as THREE.Object3D | undefined;
      if (h) h.visible = false;
    }
  }

  /** Asks for a jump; it happens on the next frame the player stands on something (a short grace window). */
  jump(): void {
    this.jumpQueued = 0.15;
  }

  /** Current ground velocity (x, and z in `y`), even when pushing against a wall. */
  get moving(): THREE.Vector2 {
    return this.velocity;
  }

  get isAirborne(): boolean {
    return this.airborne;
  }

  get isRiding(): boolean {
    return this.riding;
  }

  private get lift(): number {
    const fit = RIDES[this.rideId];
    return fit.deck + (fit.hover ?? 0);
  }

  /** Chooses the ride (null: the plain scooter). Swaps it at once when riding. */
  setRide(id: string | null): void {
    const next = id && RIDES[id] ? id : 'scooter';
    if (next === this.rideId) return;
    this.rideId = next;
    if (this.scooter) {
      this.object.remove(this.scooter);
      this.scooter = null;
    }
    if (this.riding) this.setRiding(true);
  }

  get ride(): string {
    return this.rideId;
  }

  /** Gets on or off the ride. */
  setRiding(on: boolean): void {
    this.riding = on;
    if (on && !this.scooter) {
      const fit = RIDES[this.rideId];
      this.scooter = buildScooter();
      this.object.add(this.scooter);
      // swap in the model once it has loaded; the primitive scooter stays as the fallback
      const holder = this.scooter;
      void loadGltf(fit.file)
        .then((g) => {
          const model = g.scene.clone(true);
          model.scale.setScalar(fit.scale ?? 1);
          model.rotation.y = fit.rotY ?? 0;
          model.position.set(0, fit.hover ?? 0, fit.z ?? 0);
          model.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
          for (const c of [...holder.children]) c.visible = false;
          holder.add(model);
          if (fit.hover) holder.add(hoverGlow());
          holder.userData.wheels = [];
          holder.userData.grips = fit.grip ? [new THREE.Vector3(...fit.grip), new THREE.Vector3(-fit.grip[0], fit.grip[1], fit.grip[2])] : undefined;
        })
        .catch(() => undefined);
    }
    if (this.scooter) this.scooter.visible = on;
    if (!on) this.helmetsOff();
    // stand on the deck
    this.setLift(on ? this.lift : 0);
  }

  private setLift(y: number): void {
    this.rig.root.position.y = y;
    if (this.hero) this.hero.scene.position.y = y;
  }

  /** The head being shown now, for hats and glasses. */
  headFrame(): HeadFrame | null {
    return this.hero && this.look.model !== 'custom' ? heroHead(this.hero.scene) : rigHead(this.rig.head);
  }

  /** World position of the right hand (for holding a treat). */
  rightHand(out: THREE.Vector3): THREE.Vector3 {
    const arms = this.hero && this.look.model !== 'custom' ? heroArms(this.hero.scene) : rigArms(this.rig);
    if (arms) return arms.right.hand(out);
    return this.object.localToWorld(out.set(-0.3, 0.8, 0.2));
  }

  private sync(): void {
    this.object.position.copy(this.position);
    this.object.rotation.y = this.heading;
    // lean into turns on the scooter
    const body = this.hero && this.look.model !== 'custom' ? this.hero.scene : this.rig.root;
    body.rotation.z = this.riding ? this.lean : 0;
  }
}

/** A soft cyan glow under a hoverboard. */
function hoverGlow(): THREE.Mesh {
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#5ff3ff', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  glow.scale.set(0.6, 1, 1.2);
  glow.position.y = 0.04;
  return glow;
}

/** A kid's kick scooter built from primitives (a Meshy model can replace it later). Front toward +Z. */
function buildScooter(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'scooter';
  const deckMat = new THREE.MeshStandardMaterial({ color: '#2fb3e8', roughness: 0.5, metalness: 0.2 });
  const metal = new THREE.MeshStandardMaterial({ color: '#cfd6de', roughness: 0.35, metalness: 0.7 });
  const grip = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.9 });
  const tyre = new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.6 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.75), deckMat);
  deck.position.set(0, 0.1, -0.05);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.01, 0.6), grip);
  tape.position.set(0, 0.13, -0.08);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 8), metal);
  stem.position.set(0, 0.52, 0.34);
  stem.rotation.x = -0.18;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8), metal);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.93, 0.42);
  const handles = [-0.2, 0.2].map((x) => {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), grip);
    h.rotation.z = Math.PI / 2;
    h.position.set(x, 0.93, 0.42);
    return h;
  });
  const wheels = [0.32, -0.42].map((z) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14).rotateZ(Math.PI / 2), tyre);
    w.position.set(0, 0.09, z);
    return w;
  });
  g.add(deck, tape, stem, bar, ...handles, ...wheels);
  g.userData.wheels = wheels;
  g.userData.grips = [new THREE.Vector3(0.2, 0.93, 0.42), new THREE.Vector3(-0.2, 0.93, 0.42)];
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  return g;
}
