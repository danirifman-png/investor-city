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
}

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
  constructor(plaza: Rect[], loops: Rect[]) {
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
      };
      this.walkers.push(w);
      void loadAvatar(def.model)
        .then(({ scene, clips }) => {
          w.object = scene;
          w.animator = new AvatarAnimator(scene, clips, 1.3);
          const box = new THREE.Box3().setFromObject(scene);
          w.height = Math.max(1.2, box.max.y - box.min.y);
          scene.position.set(w.x, 0, w.z);
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
            w.pause = 2 + this.rng() * 4;
            w.nextPause = 10 + this.rng() * 18;
          }
        }
      }
      const diff = Math.atan2(Math.sin(want - w.heading), Math.cos(want - w.heading));
      w.heading += diff * (1 - Math.exp(-dt * 6));
      if (!o.visible) continue;
      o.position.set(w.x, 0, w.z);
      o.rotation.y = w.heading;
      a.update(dt, speed);
    }
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

  /** What the person next to the player is saying, if anyone. */
  bubble(): { x: number; y: number; z: number; key: string } | null {
    const w = this.speaker;
    if (!w?.object?.visible) return null;
    return { x: w.x, y: w.height + 0.3, z: w.z, key: `town.${w.def.id}.${w.line}` };
  }
}
