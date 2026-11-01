import * as THREE from 'three';
import { NPC_IDS, NPCS, type NpcDef, type NpcId } from '../content/npcs';
import type { CollisionWorld } from '../world/Collision';
import type { Poi } from '../world/types';
import { AvatarAnimator, dressAvatar, loadAvatar, type GestureAnimator } from './AvatarNpc';
import { CharacterAnimator, type OneShot } from './CharacterAnimator';
import { buildNpc, npcHeight } from './NpcModel';

const NOTICE_RANGE = 7;
const IDLE_GESTURES: OneShot[] = ['think', 'nod', 'talk', 'think'];

/** One character standing in the city: looks at the player, greets, fidgets. */
export class NpcActor {
  readonly object = new THREE.Group();
  readonly position = new THREE.Vector3();
  animator: GestureAnimator;
  height: number;
  /** True once the realistic model replaced the procedural body. */
  realistic = false;
  private body: THREE.Object3D;
  heading: number;
  /** Set while a conversation with this character is open. */
  talking = false;
  private home: { x: number; z: number; heading: number };
  private greeted = false;
  private nextGesture: number;
  private paceDir = 1;
  private speed = 0;

  constructor(
    readonly def: NpcDef,
    x: number,
    z: number,
    heading: number,
  ) {
    const rig = buildNpc(def);
    this.body = rig.root;
    this.object.add(rig.root);
    this.object.name = `npc-${def.id}`;
    this.object.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.5 * def.scale, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.2, depthWrite: false }),
    );
    blob.position.y = 0.02;
    this.object.add(blob);
    this.animator = new CharacterAnimator(rig);
    this.height = npcHeight(def);
    this.home = { x, z, heading };
    this.heading = heading;
    this.position.set(x, this.ground(x, z), z);
    this.nextGesture = 3 + Math.random() * 6;
    this.sync();
  }

  /** Swaps the procedural body for a loaded realistic avatar. */
  useAvatar(scene: THREE.Object3D, clips: THREE.AnimationClip[]): void {
    const a = this.def.avatar!;
    dressAvatar(scene, a);
    if (a.scale) scene.scale.setScalar(a.scale);
    scene.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
    this.object.remove(this.body);
    this.object.add(scene);
    this.body = scene;
    if (a.prop === 'tablet') holdTablet(scene);
    this.animator = new AvatarAnimator(scene, clips, a.walkSpeed === undefined ? undefined : a.walkSpeed * (a.scale ?? 1));
    this.height = a.height;
    this.realistic = true;
  }

  /** Lip movement while a line of dialogue is on screen. */
  speak(seconds: number): void {
    this.animator.speak?.(seconds);
  }

  get id(): NpcId {
    return this.def.id;
  }

  private street: { x: number; z: number; heading: number } | null = null;

  /** Height of the floor under a spot (steps, plazas, room floors); set by Npcs. */
  ground: (x: number, z: number) => number = () => 0;

  /** Puts the feet on the floor at the current spot. */
  settle(): void {
    this.position.y = this.ground(this.position.x, this.position.z);
    this.sync();
  }

  /** Steps into a building (stands at a new spot until `goBack`). */
  moveTo(x: number, z: number, heading: number): void {
    this.street ??= { ...this.home };
    this.home = { x, z, heading };
    this.position.set(x, this.ground(x, z), z);
    this.heading = heading;
    this.sync();
  }

  /** Back to the street spot after a visit indoors. */
  goBack(): void {
    if (!this.street) return;
    this.moveTo(this.street.x, this.street.z, this.street.heading);
    this.street = null;
  }

  /** Distance from the player's feet to this character, in metres. */
  distanceTo(p: THREE.Vector3): number {
    return Math.hypot(p.x - this.position.x, p.z - this.position.z);
  }

  update(dt: number, player: THREE.Vector3 | null): void {
    const d = player ? this.distanceTo(player) : Infinity;
    let want = this.home.heading;
    this.speed = 0;
    if (player && (this.talking || d < NOTICE_RANGE)) {
      want = Math.atan2(player.x - this.position.x, player.z - this.position.z);
      if (!this.talking && !this.greeted && !this.animator.playing) {
        this.greeted = true;
        this.animator.play('wave');
      }
    } else if (this.def.pace) {
      // pacing back and forth (Leo can't stand still)
      const half = this.def.pace / 2;
      const target = this.home.x + this.paceDir * half;
      const step = 1.5 * dt;
      if (Math.abs(target - this.position.x) <= step) this.paceDir *= -1;
      this.position.x += Math.sign(target - this.position.x) * step;
      this.position.y = this.ground(this.position.x, this.position.z);
      this.speed = 1.5;
      want = this.paceDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    if (d > NOTICE_RANGE * 2) this.greeted = false;

    // turn smoothly toward what we look at
    let diff = want - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.heading += diff * (1 - Math.exp(-dt * 6));

    // small signs of life when nobody is around
    this.nextGesture -= dt;
    if (this.nextGesture <= 0) {
      this.nextGesture = 7 + Math.random() * 8;
      if (!this.talking && d > NOTICE_RANGE && !this.animator.playing && this.speed === 0) {
        this.animator.play(IDLE_GESTURES[Math.floor(Math.random() * IDLE_GESTURES.length)]);
      }
    }
    this.animator.update(dt, this.speed);
    this.sync();
  }

  private sync(): void {
    this.object.position.copy(this.position);
    this.object.rotation.y = this.heading;
  }
}

/** A tablet showing a rising chart, held in the right hand of a Meshy avatar. */
function holdTablet(scene: THREE.Object3D): void {
  const hand = scene.getObjectByName('RightHand');
  if (!hand) return;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0d2a5c';
  g.fillRect(0, 0, 128, 96);
  g.strokeStyle = '#4be38a';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(10, 80);
  g.lineTo(44, 54);
  g.lineTo(70, 62);
  g.lineTo(116, 18);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const tablet = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.19, 0.018), new THREE.MeshStandardMaterial({ color: '#22262e', roughness: 0.4 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.16), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.z = 0.0095;
  body.castShadow = true;
  tablet.add(body, screen);
  // keep the tablet level in the rest pose, whatever the bone's own axes are
  scene.updateMatrixWorld(true);
  const holder = new THREE.Group();
  holder.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(scene.getWorldQuaternion(new THREE.Quaternion())));
  const s = 1 / hand.getWorldScale(new THREE.Vector3()).x;
  holder.scale.setScalar(s);
  tablet.position.set(0, -0.02, 0.1);
  tablet.rotation.x = -0.9;
  holder.add(tablet);
  hand.add(holder);
}

/** All eight characters, placed in front of the building they belong to. */
export class Npcs {
  readonly group = new THREE.Group();
  readonly actors: NpcActor[] = [];

  constructor(pois: Poi[], collision: CollisionWorld) {
    this.group.name = 'npcs';
    for (const id of NPC_IDS) {
      const def = NPCS[id];
      const poi = pois.find((p) => p.key === def.home);
      if (!poi) throw new Error(`No building "${def.home}" for ${id}`);
      // stand on the sidewalk in front (south side) of the building, facing the street
      const spot = collision.findFree(poi.x + def.offset, poi.z + poi.d / 2 + 2.2, 0.7) ?? { x: poi.x, z: poi.z + poi.d / 2 + 2.2 };
      const actor = new NpcActor(def, spot.x, spot.z, 0);
      // stand on whatever is there (a building's steps, the plaza), not sunk into it
      actor.ground = (x, z) => collision.groundHeight(x, z, 0.6, 0.25);
      actor.settle();
      // standing characters are solid; Leo walks around, so the player may brush past him
      if (!def.pace) collision.add({ x0: spot.x - 0.35, z0: spot.z - 0.35, x1: spot.x + 0.35, z1: spot.z + 0.35, bottom: actor.position.y, top: actor.position.y + 1.8, water: false });
      this.actors.push(actor);
      this.group.add(actor.object);
    }
  }

  /**
   * Loads realistic avatars for the characters that have one (`vivid`: all of
   * them, otherwise only the stylised cast). Failures keep the procedural body.
   */
  async loadAvatars(vivid = true): Promise<NpcId[]> {
    const loaded: NpcId[] = [];
    await Promise.all(
      this.actors
        .filter((a) => a.def.avatar && (vivid || a.def.avatar.always))
        .map(async (a) => {
          try {
            const { scene, clips } = await loadAvatar(a.def.avatar!.model, a.def.avatar!.anims);
            a.useAvatar(scene, clips);
            loaded.push(a.id);
          } catch (err) {
            console.warn(`avatar for ${a.id} failed to load`, err);
          }
        }),
    );
    return loaded;
  }

  get(id: NpcId): NpcActor {
    return this.actors.find((a) => a.id === id)!;
  }

  /** The closest character within `range` metres of the player. */
  nearest(p: THREE.Vector3, range: number): NpcActor | null {
    let best: NpcActor | null = null;
    let bestD = range;
    for (const a of this.actors) {
      const d = a.distanceTo(p);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  update(dt: number, player: THREE.Vector3 | null): void {
    for (const a of this.actors) a.update(dt, player);
  }
}
