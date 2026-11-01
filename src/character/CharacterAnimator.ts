import type { Rig } from './CharacterModel';

/**
 * Procedural animation for the character rig. Idle, walk and run are blended
 * continuously from the current speed, so there is never a visible snap
 * between states; "interact" (a wave) and "celebrate" are one-shot layers on
 * top. Walk and run thresholds match the PlayerController speeds.
 */

export const WALK_SPEED = 2.9;
export const RUN_SPEED = 5.6;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

/** Gestures layered on top of the gait; conversation moods map onto these. */
export type OneShot = 'wave' | 'cheer' | 'happy' | 'laugh' | 'think' | 'sad' | 'surprised' | 'nod' | 'shake' | 'talk';

const DURATION: Record<OneShot, number> = { wave: 1.5, cheer: 1.2, happy: 1.1, laugh: 1.5, think: 2.4, sad: 2.2, surprised: 1.0, nod: 1.0, shake: 1.1, talk: 2.6 };

export class CharacterAnimator {
  private phase = 0;
  private time = 0;
  private speed = 0;
  private oneShot: { kind: OneShot; t: number; dur: number } | null = null;

  constructor(private rig: Rig) {}

  setRig(rig: Rig): void {
    this.rig = rig;
  }

  play(kind: OneShot): void {
    this.oneShot = { kind, t: 0, dur: DURATION[kind] };
  }

  get playing(): OneShot | null {
    return this.oneShot?.kind ?? null;
  }

  /** `speed` is the actual ground speed in m/s. */
  update(dt: number, speed: number): void {
    this.time += dt;
    // smooth the speed so starts and stops ease in
    this.speed += (speed - this.speed) * (1 - Math.exp(-dt * 10));
    const v = this.speed;
    const walk = clamp01(v / WALK_SPEED);
    const run = clamp01((v - WALK_SPEED) / (RUN_SPEED - WALK_SPEED));
    const idle = 1 - walk;
    // stride frequency grows slower than speed (longer strides when running)
    this.phase += dt * (v > 0.05 ? 3.2 + v * 1.05 : 0);
    const p = this.phase;
    const r = this.rig;

    const legAmp = 0.55 * walk + 0.3 * run;
    const swing = Math.sin(p) * legAmp;
    r.lHip.rotation.set(-swing, 0, 0);
    r.rHip.rotation.set(swing, 0, 0);
    const kneeAmp = 0.5 * walk + 0.7 * run;
    r.lKnee.rotation.x = kneeAmp * Math.max(0, Math.sin(p + 1.3));
    r.rKnee.rotation.x = kneeAmp * Math.max(0, Math.sin(p + Math.PI + 1.3));

    const armAmp = 0.45 * walk + 0.45 * run;
    const armSwing = Math.sin(p) * armAmp;
    const sway = idle * Math.sin(this.time * 1.3) * 0.03;
    r.lShoulder.rotation.set(armSwing, 0, 0.1 + sway);
    r.rShoulder.rotation.set(-armSwing, 0, -0.1 - sway);
    const elbow = -0.15 - 0.25 * walk - 0.9 * run;
    r.lElbow.rotation.set(elbow, 0, 0);
    r.rElbow.rotation.set(elbow, 0, 0);

    const bob = Math.abs(Math.sin(p)) * (0.045 * walk + 0.07 * run);
    r.body.position.y = bob + idle * Math.sin(this.time * 2.2) * 0.008;
    r.spine.rotation.set(0.04 * walk + 0.16 * run, Math.sin(p) * 0.08 * walk, 0);
    r.spine.scale.y = 1 + idle * Math.sin(this.time * 2.2) * 0.012;
    r.hips.rotation.y = -Math.sin(p) * 0.08 * walk;
    // idle: an occasional curious look around
    const look = idle * Math.sin(this.time * 0.45) * Math.max(0, Math.sin(this.time * 0.21)) * 0.6;
    r.head.rotation.set(-0.03 * run, look, 0);

    if (this.oneShot) {
      const o = this.oneShot;
      o.t += dt;
      const k = o.t / o.dur;
      const w = smooth(clamp01(Math.min(k * 5, (1 - k) * 5)));
      const t = o.t;
      switch (o.kind) {
        case 'wave':
          // right arm up beside the head, forearm waving
          r.rShoulder.rotation.z = lerp(r.rShoulder.rotation.z, -2.7, w);
          r.rShoulder.rotation.x = lerp(r.rShoulder.rotation.x, 0, w);
          r.rElbow.rotation.x = lerp(r.rElbow.rotation.x, 0, w);
          r.rElbow.rotation.z = lerp(0, Math.sin(t * 14) * 0.45 - 0.2, w);
          r.head.rotation.z = lerp(0, 0.08, w);
          break;
        case 'cheer':
          // both arms up, a little hop
          r.rShoulder.rotation.z = lerp(r.rShoulder.rotation.z, -2.6, w);
          r.lShoulder.rotation.z = lerp(r.lShoulder.rotation.z, 2.6, w);
          r.body.position.y += Math.max(0, Math.sin(k * Math.PI * 2)) * 0.18 * w;
          break;
        case 'happy':
          // one fist pump and a small bounce
          r.rShoulder.rotation.z = lerp(r.rShoulder.rotation.z, -2.2, w);
          r.rElbow.rotation.x = lerp(r.rElbow.rotation.x, -1.2, w);
          r.body.position.y += Math.abs(Math.sin(t * 9)) * 0.06 * w;
          r.head.rotation.x = lerp(0, -0.12, w);
          break;
        case 'laugh':
          // head back, shoulders shaking, hand on the belly
          r.head.rotation.x = lerp(0, -0.35, w);
          r.spine.rotation.x = lerp(r.spine.rotation.x, -0.1, w) + Math.sin(t * 22) * 0.03 * w;
          r.body.position.y += Math.abs(Math.sin(t * 11)) * 0.03 * w;
          r.lShoulder.rotation.x = lerp(r.lShoulder.rotation.x, -0.5, w);
          r.lElbow.rotation.x = lerp(r.lElbow.rotation.x, -1.6, w);
          break;
        case 'think':
          // hand to the chin, head tilted
          r.rShoulder.rotation.x = lerp(r.rShoulder.rotation.x, -1.0, w);
          r.rShoulder.rotation.z = lerp(r.rShoulder.rotation.z, 0.25, w);
          r.rElbow.rotation.x = lerp(r.rElbow.rotation.x, -2.1, w);
          r.head.rotation.z = lerp(0, 0.18, w);
          r.head.rotation.x = lerp(0, -0.08 + Math.sin(t * 2) * 0.03, w);
          break;
        case 'sad':
          // head down, shoulders forward
          r.head.rotation.x = lerp(0, 0.4, w);
          r.spine.rotation.x = lerp(r.spine.rotation.x, 0.15, w);
          r.lShoulder.rotation.z = lerp(r.lShoulder.rotation.z, 0.02, w);
          r.rShoulder.rotation.z = lerp(r.rShoulder.rotation.z, -0.02, w);
          break;
        case 'surprised':
          // jump back with open arms
          r.rShoulder.rotation.z = lerp(r.rShoulder.rotation.z, -1.3, w);
          r.lShoulder.rotation.z = lerp(r.lShoulder.rotation.z, 1.3, w);
          r.head.rotation.x = lerp(0, -0.15, w);
          r.body.position.y += Math.max(0, Math.sin(k * Math.PI)) * 0.12 * w;
          break;
        case 'nod':
          r.head.rotation.x = Math.sin(t * 12) * 0.2 * w;
          break;
        case 'shake':
          r.head.rotation.y = Math.sin(t * 13) * 0.35 * w;
          break;
        case 'talk':
          // relaxed hand gestures while speaking
          r.rShoulder.rotation.x = lerp(r.rShoulder.rotation.x, -0.5 + Math.sin(t * 3.1) * 0.25, w);
          r.rElbow.rotation.x = lerp(r.rElbow.rotation.x, -1.0 + Math.sin(t * 4.3) * 0.3, w);
          r.lShoulder.rotation.x = lerp(r.lShoulder.rotation.x, -0.3 + Math.sin(t * 2.3 + 1) * 0.2, w);
          r.lElbow.rotation.x = lerp(r.lElbow.rotation.x, -0.8, w);
          r.head.rotation.x = lerp(0, Math.sin(t * 5) * 0.05, w);
          break;
      }
      if (o.t >= o.dur) {
        r.rElbow.rotation.z = 0;
        r.head.rotation.z = 0;
        r.head.rotation.y = 0;
        this.oneShot = null;
      }
    } else {
      r.rElbow.rotation.z = 0;
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
