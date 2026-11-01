import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { OneShot } from './CharacterAnimator';

/**
 * Realistic characters: a skinned glTF avatar with motion-captured clips
 * (baked onto its skeleton by tools/retarget.mjs) and procedural gesture
 * layers for the moods the clips do not cover. It exposes the same
 * play/playing/update surface as the procedural CharacterAnimator, so an
 * NpcActor can swap one for the other once the model has loaded.
 */

export interface GestureAnimator {
  play(kind: OneShot): void;
  readonly playing: OneShot | null;
  update(dt: number, speed: number): void;
  /** Moves the mouth for roughly `seconds` while a line is shown. */
  speak?(seconds: number): void;
}

interface BakedClip {
  name: string;
  duration: number;
  times: number[];
  rot: Record<string, number[]>;
  hips: number[];
}

export interface AvatarAssets {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
}

const DURATION: Record<OneShot, number> = { wave: 1.8, cheer: 1.4, happy: 1.4, laugh: 1.8, think: 2.6, sad: 2.4, surprised: 1.2, nod: 1.8, shake: 2.2, talk: 2.6 };
/** Gestures played from captured clips; the rest are procedural layers. */
const CLIP_GESTURES: Partial<Record<OneShot, string>> = { nod: 'nod', shake: 'shake', sad: 'sad' };
/** Ground speed of the captured walk cycle, used to keep the feet from sliding. */
const WALK_CLIP_SPEED = 1.45;

function toClip(c: BakedClip): THREE.AnimationClip {
  const times = new Float32Array(c.times);
  const tracks: THREE.KeyframeTrack[] = Object.entries(c.rot).map(([bone, q]) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, q));
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, c.hips));
  return new THREE.AnimationClip(c.name, c.duration, tracks);
}

/**
 * Fallback for hosts that refuse .glb files and block data:/blob: URLs (the
 * claude.ai artifact host): scripts/make-artifact.mjs ships the model as
 * base64 text "<model>.txt" with its textures as separate image files.
 */
async function loadEncodedGlb(modelUrl: string): Promise<GLTF> {
  const res = await fetch(`${modelUrl}.txt`);
  if (!res.ok) throw new Error(`model ${res.status}`);
  const text = await res.text();
  const bytes = Uint8Array.from(atob(text.trim()), (c) => c.charCodeAt(0));
  return new GLTFLoader().parseAsync(bytes.buffer, modelUrl.slice(0, modelUrl.lastIndexOf('/') + 1));
}

const gltfCache = new Map<string, Promise<GLTF>>();

/** Loads a glTF once per URL (shared by every copy placed in the world). */
export function loadGltf(url: string): Promise<GLTF> {
  let p = gltfCache.get(url);
  if (!p) {
    p = new GLTFLoader().loadAsync(url).catch(() => loadEncodedGlb(url));
    gltfCache.set(url, p);
  }
  return p;
}

/**
 * A skinned avatar ready to animate. Clips come from a baked JSON file
 * (tools/retarget.mjs) or, without one, from the clips embedded in the model
 * (the Meshy characters carry their own idle and walk).
 */
export async function loadAvatar(modelUrl: string, animUrl?: string): Promise<AvatarAssets> {
  const [gltf, baked] = await Promise.all([
    loadGltf(modelUrl),
    animUrl
      ? fetch(animUrl).then((r) => {
          if (!r.ok) throw new Error(`animations ${r.status}`);
          return r.json() as Promise<{ clips: BakedClip[] }>;
        })
      : Promise.resolve(null),
  ]);
  const scene = cloneSkinned(gltf.scene) as THREE.Group;
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isMesh) {
      m.castShadow = true;
      // skinned bounds are the bind pose; culling them can pop limbs out of view
      m.frustumCulled = false;
    }
  });
  return { scene, clips: baked ? baked.clips.map(toClip) : gltf.animations };
}

const smooth = (v: number) => v * v * (3 - 2 * v);
/** 0 → 1 → 0 envelope over a one-shot, with eased in and out ramps. */
function envelope(t: number, dur: number, ramp = 0.25): number {
  return smooth(Math.min(1, t / ramp, (dur - t) / ramp, 1));
}

export class AvatarAnimator implements GestureAnimator {
  private mixer: THREE.AnimationMixer;
  private idle: THREE.AnimationAction;
  private walk: THREE.AnimationAction;
  private clipActions = new Map<string, THREE.AnimationAction>();
  private oneShot: { kind: OneShot; t: number; dur: number } | null = null;
  private run: THREE.AnimationAction | null = null;
  private speed = 0;
  private time = 0;
  private speaking = 0;
  private bones = new Map<string, THREE.Object3D>();
  private morphs: { mesh: THREE.Mesh; open: number; smile: number }[] = [];
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private axis = new THREE.Vector3();
  /**
   * How much the head keeps steady (0..1): the walk and run clips nod and
   * sway the head; the player's hero keeps a calmer, smoothed head instead.
   */
  steady = 0;
  private headSmooth: THREE.Quaternion | null = null;

  constructor(
    private root: THREE.Object3D,
    clips: THREE.AnimationClip[],
    private walkSpeed = WALK_CLIP_SPEED,
    /** Blend into the model's own run clip at running speed (when it has one). */
    useRun = false,
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    const action = (name: string) => {
      const clip = clips.find((c) => c.name === name);
      if (!clip) throw new Error(`avatar clip ${name} missing`);
      return this.mixer.clipAction(clip);
    };
    this.idle = action('idle');
    this.walk = action('walk');
    this.idle.play();
    this.walk.play().setEffectiveWeight(0);
    const runClip = useRun ? clips.find((c) => c.name === 'run') : undefined;
    if (runClip) {
      this.run = this.mixer.clipAction(runClip);
      this.run.play().setEffectiveWeight(0);
    }
    for (const name of Object.values(CLIP_GESTURES)) {
      // gesture clips are optional; without one the procedural layer plays it
      if (!clips.some((c) => c.name === name)) continue;
      const a = action(name!);
      a.setLoop(name === 'sad' ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = true;
      this.clipActions.set(name!, a);
    }
    root.traverse((o) => {
      this.bones.set(o.name, o);
      const m = o as THREE.Mesh;
      const dict = m.morphTargetDictionary;
      if (m.isMesh && dict && dict.mouthOpen !== undefined) this.morphs.push({ mesh: m, open: dict.mouthOpen, smile: dict.mouthSmile ?? -1 });
    });
  }

  play(kind: OneShot): void {
    this.oneShot = { kind, t: 0, dur: DURATION[kind] };
    const a = this.clipActions.get(CLIP_GESTURES[kind] ?? '');
    if (a) a.reset().setEffectiveWeight(1).fadeIn(0.25).play();
  }

  get playing(): OneShot | null {
    return this.oneShot?.kind ?? null;
  }

  speak(seconds: number): void {
    this.speaking = Math.min(6, Math.max(0.6, seconds));
  }

  update(dt: number, speed: number): void {
    this.time += dt;
    this.speed += (speed - this.speed) * (1 - Math.exp(-dt * 8));
    const walk = Math.min(1, this.speed / 1.2);
    // above a brisk walk the run clip takes over (only for avatars that asked for it)
    const run = this.run ? THREE.MathUtils.clamp((this.speed - 1.9) / 1.0, 0, 1) : 0;
    this.walk.setEffectiveWeight(walk * (1 - run));
    this.walk.timeScale = this.speed > 0.05 ? Math.min(this.speed, 1.9) / this.walkSpeed : 1;
    if (this.run) {
      this.run.setEffectiveWeight(walk * run);
      this.run.timeScale = Math.max(0.6, this.speed / 3.2);
    }
    this.idle.setEffectiveWeight(1 - walk);

    const o = this.oneShot;
    if (o) {
      o.t += dt;
      if (o.t >= o.dur) {
        this.clipActions.get(CLIP_GESTURES[o.kind] ?? '')?.fadeOut(0.3);
        this.oneShot = null;
      }
    }
    this.mixer.update(dt);
    this.root.updateMatrixWorld(true);
    this.steadyHead(dt);
    this.layer();
    this.face(dt);
  }

  /** Smooths the head's turn (in the body's own space) so quick nods and sways from the clips fade out. */
  private steadyHead(dt: number): void {
    const head = this.bones.get('Head');
    if (!head?.parent || this.steady <= 0) {
      this.headSmooth = null;
      return;
    }
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    const now = head.getWorldQuaternion(this.tmpQ).premultiply(rootQ.clone().invert());
    if (!this.headSmooth) this.headSmooth = now.clone();
    this.headSmooth.slerp(now, 1 - Math.exp(-dt * 2));
    const world = rootQ.multiply(now.slerp(this.headSmooth, this.steady));
    head.quaternion.copy(head.parent.getWorldQuaternion(this.tmpQ2).invert().multiply(world));
    head.updateMatrixWorld(true);
  }

  /** Rotates a bone about an axis given in the character's own space (x left, y up, z forward). */
  private turn(name: string, x: number, y: number, z: number, angle: number): void {
    const bone = this.bones.get(name);
    if (!bone || !bone.parent || angle === 0) return;
    this.axis.set(x, y, z).applyQuaternion(this.root.getWorldQuaternion(this.tmpQ)).normalize();
    const delta = this.tmpQ.setFromAxisAngle(this.axis, angle);
    const world = bone.getWorldQuaternion(this.tmpQ2).premultiply(delta);
    bone.quaternion.copy(bone.parent.getWorldQuaternion(this.tmpQ).invert().multiply(world));
    bone.updateMatrixWorld(true);
  }

  /** Procedural gestures layered on top of the captured idle. */
  private layer(): void {
    const o = this.oneShot;
    if (!o || this.clipActions.has(CLIP_GESTURES[o.kind] ?? '')) return;
    const w = envelope(o.t, o.dur);
    const t = o.t;
    switch (o.kind) {
      case 'wave':
        this.turn('RightArm', 0, 0, 1, -2.25 * w);
        this.turn('RightForeArm', 0, 0, 1, (-0.5 + Math.sin(t * 11) * 0.38) * w);
        this.turn('Head', 0, 0, 1, 0.12 * w);
        break;
      case 'cheer':
        this.turn('RightArm', 0, 0, 1, -2.6 * w);
        this.turn('LeftArm', 0, 0, 1, 2.6 * w);
        this.turn('Spine', 1, 0, 0, -0.12 * w * (1 + Math.sin(t * 9) * 0.5));
        break;
      case 'happy':
        this.turn('Spine', 1, 0, 0, -0.08 * w);
        this.turn('Head', 0, 0, 1, Math.sin(t * 6) * 0.1 * w);
        break;
      case 'laugh':
        this.turn('Spine', 1, 0, 0, (-0.12 + Math.sin(t * 14) * 0.06) * w);
        this.turn('Head', 1, 0, 0, -0.18 * w);
        break;
      case 'think':
        this.turn('Head', 0, 0, 1, 0.22 * w);
        this.turn('Head', 1, 0, 0, -0.15 * w);
        this.turn('RightArm', 1, 0, 0, -0.7 * w);
        this.turn('RightForeArm', 0, 1, 0, -2.0 * w);
        break;
      case 'surprised':
        this.turn('Spine', 1, 0, 0, -0.14 * w);
        this.turn('Head', 1, 0, 0, -0.16 * w);
        this.turn('RightArm', 0, 0, 1, -0.5 * w);
        this.turn('LeftArm', 0, 0, 1, 0.5 * w);
        break;
      case 'talk':
        this.turn('RightArm', 1, 0, 0, -0.45 * w);
        this.turn('RightForeArm', 0, 1, 0, (-1.0 + Math.sin(t * 3) * 0.3) * w);
        this.turn('Head', 0, 1, 0, Math.sin(t * 1.7) * 0.12 * w);
        break;
    }
  }

  /** Mouth and smile from the face blend shapes. */
  private face(dt: number): void {
    const kind = this.oneShot?.kind;
    if (kind === 'talk' || kind === 'laugh') this.speaking = Math.max(this.speaking, 0.2);
    this.speaking = Math.max(0, this.speaking - dt);
    const t = this.time;
    const talking = this.speaking > 0 ? (0.5 + 0.5 * Math.sin(t * 17)) * (0.55 + 0.45 * Math.sin(t * 5.3)) : 0;
    const open = kind === 'surprised' ? 0.7 : kind === 'laugh' ? 0.4 + 0.3 * Math.abs(Math.sin(t * 14)) : talking * 0.55;
    const smile = kind === 'happy' || kind === 'laugh' || kind === 'cheer' || kind === 'wave' ? 0.9 : kind === 'sad' ? 0 : 0.25;
    for (const m of this.morphs) {
      const inf = m.mesh.morphTargetInfluences!;
      inf[m.open] += (open - inf[m.open]) * Math.min(1, dt * 18);
      if (m.smile >= 0) inf[m.smile] += (smile - inf[m.smile]) * Math.min(1, dt * 6);
    }
  }
}

export interface AvatarDress {
  /** Recolours the outfit top (the texture is dropped, the normal map keeps the folds). */
  topColor?: string;
  bottomColor?: string;
  chefHat?: boolean;
}

/** Wardrobe tweaks so one base avatar can become a specific character. */
export function dressAvatar(scene: THREE.Object3D, dress: AvatarDress): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    const colour = mat.name === 'Wolf3D_Outfit_Top' ? dress.topColor : mat.name === 'Wolf3D_Outfit_Bottom' ? dress.bottomColor : undefined;
    if (colour) {
      mat.map = null;
      mat.color.set(colour);
      mat.roughness = 0.85;
      mat.needsUpdate = true;
    }
  });
  if (dress.chefHat) {
    const head = scene.getObjectByName('HeadTop_End') ?? scene.getObjectByName('Head');
    if (!head) return;
    const cloth = new THREE.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.92 });
    const hat = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.1, 0.11, 24, 1, true), cloth);
    band.position.y = 0.02;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 16), cloth);
    puff.scale.set(1, 0.72, 1);
    puff.position.y = 0.12;
    for (const part of [band, puff]) {
      part.castShadow = true;
      hat.add(part);
    }
    hat.position.set(0, -0.045, -0.005);
    // keep the hat upright in the rest pose, whatever the bone's own orientation is
    scene.updateMatrixWorld(true);
    const holder = new THREE.Group();
    holder.quaternion.copy(head.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(scene.getWorldQuaternion(new THREE.Quaternion())));
    holder.add(hat);
    head.add(holder);
  }
}
