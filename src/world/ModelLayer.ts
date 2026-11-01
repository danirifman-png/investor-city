import * as THREE from 'three';
import { loadGltf } from '../character/AvatarNpc';
import type { CollisionWorld } from './Collision';

/**
 * Static Meshy models placed in the world, loaded area by area.
 *
 * Builders call `add()` while the city is built. Collision boxes are
 * registered at once (from the sizes below), so the world is solid even before
 * a model has downloaded. The models themselves are grouped into areas of
 * AREA metres; an area's files are fetched when the player comes within
 * LOAD_RANGE of it, and its group is only drawn within DRAW_RANGE. That keeps
 * the first load and the per-frame cost on phones independent of how big the
 * world grows.
 */

/** Bounds of each model file in metres at scale 1 (origin at the bottom centre, front toward +Z). */
export const MODEL_SIZES = {
  pizzeria: [7.16, 7, 6.28],
  burger_shop: [5.82, 9, 6.36],
  market_hall: [7.98, 10.24, 6.85],
  market_stall: [3.44, 3, 2.14],
  filler_food_bakery: [4.96, 8, 4.8],
  filler_food_grocery: [6.9, 5, 6.9],
  cafe: [4.28, 5, 5.98],
  cafe_set: [1.66, 1, 1.12],
  mall: [20.1, 10, 19.46],
  supermarket: [11.24, 5.5, 8.02],
  street_kiosk: [2.32, 3, 2.08],
  bus_stop: [2.2, 2.7, 1.94],
  trash_bin: [0.66, 1, 0.66],
  planter: [1.48, 0.9, 0.78],
  mailbox: [0.66, 1.3, 0.42],
  fire_hydrant: [0.52, 0.8, 0.52],
  bicycle: [1.66, 1.1, 0.68],
  delivery_van: [3.8, 2.3, 2.4],
  notice_board: [1.66, 2.2, 0.28],
  name_sign: [1.38, 1.3, 0.2],
  stone_bridge: [20.38, 5, 3.86],
  sailboat: [5.4, 7, 2.16],
  duck: [0.34, 0.35, 0.56],
  lemon_stand: [2.0, 2.75, 1.42],
  lemon_cart: [3.0, 4.88, 1.94],
  juice_shop: [6.0, 8.07, 5.96],
  juice_bar: [9.0, 10.83, 8.28],
  trampoline: [3.0, 0.91, 3.0],
  skate_ramp: [1.88, 1.2, 2.6],
  // realistic furniture for the walk-in rooms (world-v6/interiors)
  bank_teller_counter: [3.0, 2.83, 1.38],
  vault_door: [2.56, 2.4, 0.79],
  leather_armchair: [1.49, 1.0, 1.39],
  brass_queue_post: [0.35, 1.0, 0.35],
  ficus_plant_pot: [0.72, 1.8, 0.73],
  trading_desk_monitors: [1.6, 1.4, 0.72],
  office_chair: [0.76, 1.1, 0.71],
  classroom_desk_chair: [0.86, 0.9, 0.82],
  bookshelf_full: [0.84, 2.2, 0.29],
  standing_globe: [0.63, 1.2, 0.64],
  news_anchor_desk: [3.5, 1.13, 1.23],
  studio_camera_tripod: [1.26, 1.7, 0.98],
  studio_softbox_light: [0.82, 2.0, 0.89],
  beanbag: [0.96, 0.7, 0.99],
  whiteboard_wheels: [1.2, 1.9, 0.65],
  ping_pong_table: [2.02, 0.8, 1.56],
  modern_sofa: [2.2, 1.04, 1.06],
  architectural_model_table: [1.38, 1.2, 1.18],
  reception_desk: [1.88, 1.1, 0.87],
  pizza_oven_brick: [1.85, 2.2, 1.83],
  bistro_table_chairs: [1.34, 0.9, 0.84],
} as const satisfies Record<string, readonly [number, number, number]>;

export type ModelKey = keyof typeof MODEL_SIZES;

export interface ModelPlacement {
  x: number;
  z: number;
  y?: number;
  /** Radians; quarter turns keep the collision box exact. */
  rotY?: number;
  scale?: number;
  /** Solid for the player (default true). Small things like bins and ducks pass false. */
  solid?: boolean;
  /** Called with the model once it is in the scene (bridges build their walkway from it). */
  onLoad?: (obj: THREE.Object3D) => void;
}

const AREA = 60;
const LOAD_RANGE = 150;
const DRAW_RANGE = 170;

interface Area {
  group: THREE.Group;
  cx: number;
  cz: number;
  items: { key: ModelKey; p: ModelPlacement }[];
  state: 'idle' | 'loading' | 'ready';
}

export const modelUrl = (key: ModelKey) => `models/meshy/props/${key}.glb`;

export class ModelLayer {
  readonly root = new THREE.Group();
  private areas = new Map<string, Area>();
  private failed = new Set<ModelKey>();

  constructor(private collision: CollisionWorld) {
    this.root.name = 'models';
  }

  add(key: ModelKey, p: ModelPlacement): void {
    const s = p.scale ?? 1;
    const [w, h, d] = MODEL_SIZES[key];
    if (p.solid !== false) {
      const quarter = Math.round(((p.rotY ?? 0) / (Math.PI / 2)) % 2) !== 0;
      const hw = ((quarter ? d : w) * s) / 2;
      const hd = ((quarter ? w : d) * s) / 2;
      const y = p.y ?? 0;
      this.collision.add({ x0: p.x - hw, z0: p.z - hd, x1: p.x + hw, z1: p.z + hd, bottom: y, top: y + h * s, water: false });
    }
    const ax = Math.floor(p.x / AREA);
    const az = Math.floor(p.z / AREA);
    const id = `${ax},${az}`;
    let area = this.areas.get(id);
    if (!area) {
      const group = new THREE.Group();
      group.name = `models-${id}`;
      group.visible = false;
      this.root.add(group);
      area = { group, cx: (ax + 0.5) * AREA, cz: (az + 0.5) * AREA, items: [], state: 'idle' };
      this.areas.set(id, area);
    }
    area.items.push({ key, p });
  }

  /** Streams areas in and out around `focus` (the player, or the camera target). */
  update(focus: { x: number; z: number }): void {
    for (const area of this.areas.values()) {
      const dist = Math.max(0, Math.hypot(focus.x - area.cx, focus.z - area.cz) - AREA * 0.7);
      if (area.state === 'idle' && dist < LOAD_RANGE) void this.load(area);
      area.group.visible = area.state === 'ready' && dist < DRAW_RANGE;
    }
  }

  /** Loads everything within `range` of a point now (used before the first frame and by tests). */
  async preload(x: number, z: number, range = LOAD_RANGE): Promise<void> {
    await Promise.all(
      [...this.areas.values()]
        .filter((a) => Math.hypot(x - a.cx, z - a.cz) - AREA * 0.7 < range)
        .map(async (a) => {
          await this.load(a);
          a.group.visible = true;
        }),
    );
  }

  /** How many areas are loaded, for the debug state. */
  get loadedAreas(): number {
    return [...this.areas.values()].filter((a) => a.state === 'ready').length;
  }

  private async load(area: Area): Promise<void> {
    if (area.state !== 'idle') return;
    area.state = 'loading';
    await Promise.all(
      area.items.map(async ({ key, p }) => {
        if (this.failed.has(key)) return;
        try {
          const gltf = await loadGltf(modelUrl(key));
          const obj = gltf.scene.clone(true);
          obj.position.set(p.x, p.y ?? 0, p.z);
          obj.rotation.y = p.rotY ?? 0;
          obj.scale.setScalar(p.scale ?? 1);
          obj.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            m.castShadow = MODEL_SIZES[key][1] * (p.scale ?? 1) > 1.5;
            m.receiveShadow = true;
          });
          obj.name = `model:${key}`;
          obj.matrixAutoUpdate = false;
          obj.updateMatrix();
          area.group.add(obj);
          p.onLoad?.(obj);
        } catch (err) {
          this.failed.add(key);
          console.warn(`model ${key} failed to load`, err);
        }
      }),
    );
    area.state = 'ready';
  }
}
