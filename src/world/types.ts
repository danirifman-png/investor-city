import type { TreeKind, TreeSpot } from './Trees';
import type * as THREE from 'three';
import type { ZoneId } from '../content/cityPlan';
import type { Batcher } from './Batcher';
import type { CityMaterials } from './Materials';
import type { ModelLayer } from './ModelLayer';

/** A point of interest the player can tap to learn about. */
export interface Poi {
  /** Unique id, also the locale key base: `poi.<key>.name`. */
  id: string;
  key: string;
  zone: ZoneId;
  x: number;
  z: number;
  /** Top of the building, used to place the floating label. */
  height: number;
  /** Footprint of the clickable hit box. */
  w: number;
  d: number;
  landmark: boolean;
}

export type Animator = (time: number, dt: number) => void;

export interface BuildContext {
  batch: Batcher;
  /** Non-batched objects: signs, animated parts. */
  dynamic: THREE.Group;
  materials: CityMaterials;
  /** Meshy models, streamed in by area. */
  models: ModelLayer;
  rng: () => number;
  /** City only: realistic tree spots, with the simple trees drawn per kind as a fallback (see Trees.ts). */
  trees?: { spots: TreeSpot[]; batch: Record<TreeKind, Batcher> };
  addAnimator(fn: Animator): void;
  addPoi(poi: Poi): void;
  /** Called with `true` at night, so lights can switch on. */
  onNight(fn: (night: number) => void): void;
}
