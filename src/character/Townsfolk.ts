import * as THREE from 'three';
import { TOWN_LINES, TOWNSFOLK, type TownsfolkDef } from '../content/townsfolk';
import { mulberry32, type Rect } from '../world/cityLayout';
import { AvatarAnimator, loadAvatar } from './AvatarNpc';

/**
 * The friendly people of the city: ten animated characters, each walking a
 * loop around a block of their own. Now and then they stop to look around;
 * when the player comes close they stop, turn, wave and say one of their
 * lines (one person talks at a time). They wait instead of walking through
 * the player. Far away they are hidden and not animated.
 */

const DRAW_RANGE = 70;
const GREET_RANGE = 3.6;
const TALK_SECONDS = 5;

interface Walker {
  def: TownsfolkDef;
  loop: Rect;
  s: number;
  dir: 1 | -1;
  x: number;
  z: number;
  heading: number;
  pause: number;
  nextPause: number;
  quiet: number;
  line: number;
  greeted: boolean;
  object: THREE.Object3D | null;
  animator: AvatarAnimator | null;
  height: number;
  /** How far the model's feet sit below its origin (lifted so they stand on the ground). */
  foot: number;
  y: number;
  /** Chatting with another walker: who, and seconds left. */
  chat: { with: Walker; left: number; next: number } | null;
  /** Seconds before this person may stop for a chat again. */
  chatCool: number;
}

/** What people do when they stop for a moment (on top of their idle). */
const PAUSE_MOVES = ['think', 'nod', 'happy', 'surprised', 'talk'] as const;
/** What two people do while chatting, taking turns. */
const CHAT_MOVES = ['talk', 'laugh', 'nod', 'happy', 'talk', 'shake'] as const;

/** A point on a loop's edge and the heading of walking along it (s in 0..1). */
function along(r: Rect, s: number): { x: number; z: number; heading: number } {
  const W = r.x1 - r.x0;
  const D = r.z1 - r.z0;
  let d = (((s % 1) + 1) % 1) * 2 * (W + D);
  if (d < W) return { x: r.x0 + d, z: r.z0, heading: Math.PI / 2 };
  if ((d -= W) < D) return { x: r.x1, z: r.z0 + d, heading: 0 };
  if ((d -= D) < W) return { x: r.x1 - d, z: r.z1, heading: -Math.PI / 2 };
  d -= W;
  return { x: r.x0, z: r.z1 - d, heading: Math.PI };
}

export class Townsfolk {
  readonly group = new THREE.Group();
  private walkers: Walker[] = [];
  private speaker: Walker | null = null;
  private speakTime = 0;
  private rng = mulberry32(777);

  /** `plaza` loops come first so a few people are always near the start. */
  constructor(
    plaza: Rect[],
    loops: Rect[],
    /** Height of the walkable ground at a point (plaza steps, podiums). */
    private ground: (x: number, z: number, feet: number) => number = () => 0,
  ) {
    this.group.name = 'townsfolk';
    // three around the plaza, the rest spread evenly over the city's blocks
    const spread = loops.filter((_, i) => i % Math.max(1, Math.floor(loops.length / (TOWNSFOLK.length - plaza.length))) === 0);
    TOWNSFOLK.forEach((def, i) => {
      const loop = i < plaza.length ? plaza[i] : spread[(i - plaza.length) % Math.max(1, spread.length)] ?? plaza[0];
      const s = this.rng();
      const p = along(loop, s);
      const w: Walker = {
        def,
        loop,
        s,
        dir: this.rng() < 0.5 ? 1 : -1,
        x: p.x,
        z: p.z,
        heading: p.heading,
        pause: 0,
        nextPause: 6 + this.rng() * 14,
        quiet: 0,
        line: Math.floor(this.rng() * TOWN_LINES),
        greeted: false,
        object: null,
        animator: null,
        height: 1.75,
        foot: 0,
        y: 0,
        chat: null,
        chatCool: 10 + this.rng() * 20,
      };
      this.walkers.push(w);
      void loadAvatar(def.model)
        .then(({ scene, clips }) => {
          w.object = scene;
          w.animator = new AvatarAnimator(scene, clips, 1.3, true);
          // measured in the posed (skinned) shape, so the feet land on the ground
          scene.updateMatrixWorld(true);
          scene.traverse((o) => (o as THREE.SkinnedMesh).skeleton?.update());
          const box = new THREE.Box3().setFromObject(scene, true);
          w.height = Math.max(1.2, box.max.y - box.min.y);
          w.foot = -box.min.y;
          w.y = Math.min(0.45, this.ground(w.x, w.z, 0.6));
          scene.position.set(w.x, w.y + w.foot, w.z);
          this.group.add(scene);
        })
        .catch((err) => console.warn(`${def.model} failed to load`, err));
    });
  }

  get size(): number {
    return this.walkers.length;
  }

  /** Where everyone is (for tests). */
  get loaded(): number {
    return this.walkers.filter((w) => w.object).length;
  }

  update(dt: number, player: THREE.Vector3 | null): void {
    let best: Walker | null = null;
    let bestD = GREET_RANGE;
    for (const w of this.walkers) {
      const o = w.object;
      const a = w.animator;
      const dp = player ? Math.hypot(player.x - w.x, player.z - w.z) : Infinity;
      if (!o || !a) continue;
      o.visible = dp < DRAW_RANGE;
      w.quiet = Math.max(0, w.quiet - dt);
      if (dp > GREET_RANGE + 6) w.greeted = false;
      let speed = 0;
      let want = w.heading;
      const near = player && dp < GREET_RANGE;
      if (near) {
        // stop, face the player and wave once
        want = Math.atan2(player.x - w.x, player.z - w.z);
        if (!w.greeted && !a.playing) {
          w.greeted = true;
          a.play('wave');
        }
        if (w.quiet === 0 && dp < bestD) {
          best = w;
          bestD = dp;
        }
      } else if (w.chat) {
        // chatting: face each other and take turns
        const c = w.chat;
        c.left -= dt;
        want = Math.atan2(c.with.x - w.x, c.with.z - w.z);
        if ((c.next -= dt) <= 0 && !a.playing) {
          a.play(CHAT_MOVES[Math.floor(this.rng() * CHAT_MOVES.length)]);
          c.next = 2.2 + this.rng() * 1.5;
        }
        if (c.left <= 0) {
          w.chat = null;
          w.chatCool = 25 + this.rng() * 25;
          w.dir = w.dir === 1 ? -1 : 1;
        }
      } else if (w.pause > 0) {
        w.pause -= dt;
      } else {
        const perim = 2 * (w.loop.x1 - w.loop.x0 + w.loop.z1 - w.loop.z0);
        const ahead = along(w.loop, w.s + (w.dir * 1.2) / perim);
        // wait for the player to pass instead of walking through them
        const blocked = player && Math.hypot(player.x - ahead.x, player.z - ahead.z) < 1 + (w.def.radius ?? 0.4);
        if (!blocked) {
          speed = w.def.pace;
          w.s += (w.dir * speed * dt) / perim;
          const p = along(w.loop, w.s);
          w.x = p.x;
          w.z = p.z;
          want = w.dir === 1 ? p.heading : p.heading + Math.PI;
          w.nextPause -= dt;
          if (w.nextPause <= 0) {
            // stop for a moment: look around, think, nod, smile
            w.pause = 2.5 + this.rng() * 3.5;
            w.nextPause = 10 + this.rng() * 18;
            a.play(PAUSE_MOVES[Math.floor(this.rng() * PAUSE_MOVES.length)]);
            w.heading += (this.rng() - 0.5) * 2.4;
          }
        }
      }
      const diff = Math.atan2(Math.sin(want - w.heading), Math.cos(want - w.heading));
      w.heading += diff * (1 - Math.exp(-dt * 6));
      w.chatCool = Math.max(0, w.chatCool - dt);
      if (!o.visible) continue;
      w.y += (Math.min(0.45, this.ground(w.x, w.z, 0.6)) - w.y) * Math.min(1, dt * 10);
      o.position.set(w.x, w.y + w.foot, w.z);
      o.rotation.y = w.heading;
      a.update(dt, speed);
    }
    this.startChats(player);
    // one person at a time talks to the player
    if (best !== this.speaker) {
      if (this.speaker) this.speaker.quiet = 8;
      this.speaker = best;
      this.speakTime = 0;
      if (best) best.line = (best.line + 1) % TOWN_LINES;
    } else if (best) {
      this.speakTime += dt;
      if (this.speakTime > TALK_SECONDS) {
        best.quiet = 12;
        this.speaker = null;
      }
    }
  }

  /** Two people who meet on their walk stop and chat for a while. */
  private startChats(player: THREE.Vector3 | null): void {
    for (let i = 0; i < this.walkers.length; i++) {
      const a = this.walkers[i];
      if (a.chat || a.chatCool > 0 || !a.object) continue;
      for (let j = i + 1; j < this.walkers.length; j++) {
        const b = this.walkers[j];
        if (b.chat || b.chatCool > 0 || !b.object) continue;
        if (Math.hypot(a.x - b.x, a.z - b.z) > 2.4) continue;
        // not while the player is standing right there (they greet the player instead)
        if (player && Math.min(Math.hypot(player.x - a.x, player.z - a.z), Math.hypot(player.x - b.x, player.z - b.z)) < GREET_RANGE + 1) continue;
        const left = 6 + this.rng() * 5;
        a.chat = { with: b, left, next: 0 };
        b.chat = { with: a, left, next: 1.2 };
        break;
      }
    }
  }

  /** The closest loaded person within `range` of `p` (for talking to them). */
  nearest(p: THREE.Vector3, range: number): { id: string; x: number; z: number } | null {
    let best: Walker | null = null;
    let bestD = range;
    for (const w of this.walkers) {
      if (!w.object) continue;
      const d = Math.hypot(p.x - w.x, p.z - w.z);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    return best && { id: best.def.id, x: best.x, z: best.z };
  }

  /** Where someone is now. */
  position(id: string): { x: number; z: number } | null {
    const w = this.walkers.find((x) => x.def.id === id);
    return w ? { x: w.x, z: w.z } : null;
  }

  /** Makes someone wave or smile (a gift, a level up). */
  react(id: string, move: 'wave' | 'happy' | 'cheer' = 'happy'): void {
    this.walkers.find((x) => x.def.id === id)?.animator?.play(move);
  }

  /** What the person next to the player is saying, if anyone. */
  bubble(): { x: number; y: number; z: number; key: string } | null {
    const w = this.speaker;
    if (!w?.object?.visible) return null;
    return { x: w.x, y: w.height + 0.3, z: w.z, key: `town.${w.def.id}.${w.line}` };
  }
}
