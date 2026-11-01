import * as THREE from 'three';
import type { MaterialKey, Placement } from './Batcher';
import type { BuildContext } from './types';
import { makeSign, type SignOptions } from './Materials';
import type { ModelKey, ModelPlacement } from './ModelLayer';

/**
 * A local coordinate frame (origin + rotation about Y) on top of the batcher.
 * Lot builders work in local space where +z is the building front, so the same
 * builder works for any orientation.
 */
export class Frame {
  private cos: number;
  private sin: number;

  constructor(
    readonly ctx: BuildContext,
    readonly ox: number,
    readonly oz: number,
    readonly rot = 0,
    readonly baseY = 0,
  ) {
    this.cos = Math.cos(rot);
    this.sin = Math.sin(rot);
  }

  /** Local placement to world placement. */
  world(p: Placement = {}): Placement {
    const lx = p.x ?? 0;
    const lz = p.z ?? 0;
    return {
      x: this.ox + lx * this.cos + lz * this.sin,
      z: this.oz - lx * this.sin + lz * this.cos,
      y: this.baseY + (p.y ?? 0),
      rotX: p.rotX,
      rotY: (p.rotY ?? 0) + this.rot,
      rotZ: p.rotZ,
    };
  }

  /** A Meshy model at a local position (rotY is local too). */
  model(key: ModelKey, p: Omit<ModelPlacement, 'x' | 'z'> & { x?: number; z?: number } = {}): void {
    const w = this.world({ x: p.x, z: p.z, y: p.y, rotY: p.rotY });
    this.ctx.models.add(key, { ...p, x: w.x!, z: w.z!, y: w.y, rotY: w.rotY });
  }

  /** Child frame offset from this one. */
  sub(x: number, z: number, rot = 0, y = 0): Frame {
    const w = this.world({ x, z, y });
    return new Frame(this.ctx, w.x!, w.z!, this.rot + rot, w.y!);
  }

  box(w: number, h: number, d: number, color: THREE.ColorRepresentation, p: Placement = {}, mat: MaterialKey = 'paint'): void {
    this.ctx.batch.box(w, h, d, color, this.world(p), mat);
  }

  facade(w: number, h: number, d: number, color: THREE.ColorRepresentation, p: Placement = {}, floorH?: number, bayW?: number): void {
    this.ctx.batch.facade(w, h, d, color, this.world(p), floorH, bayW);
  }

  cyl(rt: number, rb: number, h: number, color: THREE.ColorRepresentation, p: Placement = {}, seg = 12, mat: MaterialKey = 'paint'): void {
    this.ctx.batch.cyl(rt, rb, h, color, this.world(p), seg, mat);
  }

  sphere(r: number, color: THREE.ColorRepresentation, p: Placement = {}, seg = 10, mat: MaterialKey = 'paint'): void {
    this.ctx.batch.sphere(r, color, this.world(p), seg, mat);
  }

  gable(w: number, h: number, d: number, color: THREE.ColorRepresentation, p: Placement = {}): void {
    this.ctx.batch.gable(w, h, d, color, this.world(p));
  }

  /** Arbitrary geometry (ownership taken). */
  geo(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, p: Placement = {}, mat: MaterialKey = 'paint'): void {
    this.ctx.batch.add(g, color, mat, this.world(p));
  }

  /** Places an Object3D (not batched) in this frame. */
  place<T extends THREE.Object3D>(obj: T, p: Placement = {}): T {
    const w = this.world(p);
    obj.position.set(w.x!, w.y!, w.z!);
    obj.rotation.set(p.rotX ?? 0, w.rotY ?? 0, p.rotZ ?? 0, 'YXZ');
    this.ctx.dynamic.add(obj);
    return obj;
  }

  /** Hebrew sign facing local +z. */
  sign(text: string, w: number, h: number, p: Placement = {}, o: SignOptions = {}): THREE.Mesh {
    return this.place(makeSign(text, w, h, o), p);
  }
}
