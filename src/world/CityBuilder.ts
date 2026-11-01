import { CAR_SIZE, ParkedCars, TreeLayer, type CarKind, type ParkedCar, type TreeKind, type TreeSpot } from './Trees';
import * as THREE from 'three';
import { ZONES } from '../content/cityPlan';
import { Batcher } from './Batcher';
import { CollisionWorld } from './Collision';
import {
  buildLayout,
  CITY_SIZE,
  HALF_CITY,
  MAJOR_ROAD,
  majorRoadCenters,
  minorRoadCenter,
  mulberry32,
  rectCenter,
  rectSize,
  zoneStart,
  ZONE_SIZE,
  type Rect,
  type ZoneLayout,
} from './cityLayout';
import { Frame } from './Frame';
import { balloons, blimp, countryside, signpost, trailGate } from './landmarks/decor';
import { buildAcademyPark, buildCentralPlaza } from './landmarks/hubs';
import { LANDMARK_LOT_TYPES, LOT_BUILDERS } from './landmarks/districts';
import { createMaterials, type CityMaterials } from './Materials';
import { ModelLayer } from './ModelLayer';
import { streetLamp, tree } from './props';
import type { Animator, BuildContext, Poi } from './types';

export interface City {
  root: THREE.Group;
  /** Realistic trees (instanced); call `trees.load()` once. */
  trees: TreeLayer;
  /** Cars parked along the main roads; call `parked.load()` once. */
  parked: ParkedCars;
  layout: ZoneLayout[];
  pois: Poi[];
  hitboxes: THREE.Mesh[];
  /** Sidewalk loops pedestrians can walk along. */
  walkLoops: Rect[];
  materials: CityMaterials;
  collision: CollisionWorld;
  /** Meshy models, streamed in by area (call `models.update` every frame). */
  models: ModelLayer;
  update(time: number, dt: number): void;
  setNight(amount: number): void;
  /** The gate of the waterfall trail (closed until the mentor quest opens it). */
  trailGate: { setOpen(open: boolean): void };
}

// warm stone: the ground shader turns these into cobbles and paving
const SIDEWALK_COLOR = '#e6d8bd';
const CURB_COLOR = '#b8a586';
const ASPHALT = '#c4ae8e';

function isMajorEdge(v: number): boolean {
  for (let i = 0; i < 3; i++) {
    const s = zoneStart(i);
    if (Math.abs(v - s) < 0.01 || Math.abs(v - (s + ZONE_SIZE)) < 0.01) return true;
  }
  return false;
}

function buildStreets(f: Frame, layout: ZoneLayout[], rng: () => number, walkLoops: Rect[]): void {
  // asphalt under the whole city, grass beyond it
  f.box(CITY_SIZE + 2, 0.1, CITY_SIZE + 2, ASPHALT, { y: -0.1 });
  f.box(1400, 0.1, 1400, '#8fbf68', { y: -0.2 });

  // raised sidewalks for every block
  for (const zone of layout) {
    for (const lot of zone.lots) {
      const { x, z } = rectCenter(lot.rect);
      const { w, d } = rectSize(lot.rect);
      f.box(w, 0.28, d, CURB_COLOR, { x, z });
      f.box(w - 0.5, 0.03, d - 0.5, SIDEWALK_COLOR, { x, z, y: 0.28 });
      walkLoops.push({ x0: lot.rect.x0 + 1.4, z0: lot.rect.z0 + 1.4, x1: lot.rect.x1 - 1.4, z1: lot.rect.z1 - 1.4 });
      // lamps along major roads, trees along minor streets
      const r = lot.rect;
      const edges: { major: boolean; pts: [number, number][]; facing: number }[] = [
        { major: isMajorEdge(r.z0), pts: [], facing: Math.PI },
        { major: isMajorEdge(r.z1), pts: [], facing: 0 },
        { major: isMajorEdge(r.x0), pts: [], facing: -Math.PI / 2 },
        { major: isMajorEdge(r.x1), pts: [], facing: Math.PI / 2 },
      ];
      const len = w;
      const n = Math.max(2, Math.round(len / 16));
      for (let i = 0; i <= n; i++) {
        const tt = -len / 2 + 2 + ((len - 4) * i) / n;
        edges[0].pts.push([x + tt, r.z0 + 0.9]);
        edges[1].pts.push([x - tt, r.z1 - 0.9]);
        edges[2].pts.push([r.x0 + 0.9, z - tt]);
        edges[3].pts.push([r.x1 - 0.9, z + tt]);
      }
      for (const e of edges) {
        e.pts.forEach(([px, pz], i) => {
          if (e.major) {
            if (i % 2 === 0) streetLamp(f, px, pz, e.facing);
          } else if (i % 2 === 1 && rng() < 0.8) {
            tree(f, px, pz, 0.75, rng);
          }
        });
      }
    }
  }

  // no road markings: the streets are cobbled pedestrian lanes. The wide
  // avenues get a green promenade down the middle: planters, round trees,
  // lanterns and benches, with gaps wherever another street crosses.
  const centers = majorRoadCenters();
  const crossings = [...centers, ...[0, 1, 2].map((i) => minorRoadCenter(i))];
  const open = (v: number) => crossings.some((c) => Math.abs(v - c) < 9);
  for (const c of centers) {
    for (const axis of ['x', 'z'] as const) {
      let start: number | null = null;
      for (let v = -HALF_CITY; v <= HALF_CITY + 0.01; v += 1) {
        const blocked = open(v) || v >= HALF_CITY;
        if (!blocked && start === null) start = v;
        if (blocked && start !== null) {
          const len = v - start;
          if (len > 6) {
            const mid = (start + v) / 2;
            const at = (u: number) => (axis === 'x' ? { x: u, z: c } : { x: c, z: u });
            const m = at(mid);
            f.box(axis === 'x' ? len : 3, 0.45, axis === 'x' ? 3 : len, '#b39b78', { ...m });
            f.box(axis === 'x' ? len - 0.3 : 2.6, 0.12, axis === 'x' ? 2.6 : len - 0.3, '#5fae45', { ...m, y: 0.45 });
            for (let u = start + 4; u < v - 3; u += 9) {
              const p = at(u);
              if (Math.round(u) % 2 === 0) tree(f, p.x, p.z, 0.95, rng);
              else streetLamp(f, p.x, p.z);
            }
          }
          start = null;
        }
      }
    }
  }
}

function buildOutskirts(f: Frame, ctx: BuildContext, rng: () => number): void {
  countryside(f, ctx, rng);
  // rolling hills on the horizon
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rng() * 0.2;
    const r = 330 + rng() * 120;
    const s = 50 + rng() * 60;
    const geo = new THREE.SphereGeometry(1, 14, 8).scale(s * 1.6, s * (0.35 + rng() * 0.3), s);
    f.geo(geo, rng() < 0.5 ? '#7fb35e' : '#6fa456', { x: Math.cos(a) * r, z: Math.sin(a) * r, y: -6, rotY: a });
  }
}

export function buildCity(): City {
  const layout = buildLayout();
  const materials = createMaterials();
  const collision = new CollisionWorld();
  const batch = new Batcher(collision);
  const models = new ModelLayer(collision);
  const root = new THREE.Group();
  root.name = 'city';
  const dynamic = new THREE.Group();
  dynamic.name = 'city-dynamic';
  const animators: Animator[] = [];
  const nightListeners: ((n: number) => void)[] = [];
  const pois: Poi[] = [];
  const walkLoops: Rect[] = [];
  // trees: spots for the realistic tree layer, and the simple trees per kind as its fallback
  const treeSpots: TreeSpot[] = [];
  const treeBatch: Record<TreeKind, Batcher> = { plane: new Batcher(), olive: new Batcher(), cypress: new Batcher(), palm: new Batcher() };

  const makeCtx = (seed: number): BuildContext => ({
    batch,
    dynamic,
    materials,
    models,
    rng: mulberry32(seed),
    trees: { spots: treeSpots, batch: treeBatch },
    addAnimator: (fn) => animators.push(fn),
    addPoi: (p) => pois.push(p),
    onNight: (fn) => nightListeners.push(fn),
  });

  const baseCtx = makeCtx(1);
  const ground = new Frame(baseCtx, 0, 0, 0, 0);
  buildStreets(ground, layout, baseCtx.rng, walkLoops);
  buildOutskirts(ground, baseCtx, mulberry32(99));
  balloons(baseCtx);
  blimp(baseCtx);
  signpost(ground, 8, 25, layout);
  const gate = trailGate(ground);

  layout.forEach((zone, zi) => {
    zone.lots.forEach((lot) => {
      const ctx = makeCtx(1000 + zi * 10 + lot.index);
      if (lot.type === 'centralPlaza') return buildCentralPlaza(lot, ctx);
      if (lot.type === 'academyPark') return buildAcademyPark(lot, ctx);
      const builder = LOT_BUILDERS[lot.type];
      if (!builder) throw new Error(`No builder for lot type ${lot.type}`);
      const c = rectCenter(lot.rect);
      const height = builder(new Frame(ctx, c.x, c.z, 0, 0.3), ctx);
      pois.push({
        id: `${zone.id}-${lot.index}`,
        key: lot.type,
        zone: zone.id,
        x: c.x,
        z: c.z,
        height,
        w: 24,
        d: 24,
        landmark: LANDMARK_LOT_TYPES.includes(lot.type),
      });
    });
  });

  // subtle district tint on the sidewalk edge so districts read on the map
  for (const zone of layout) {
    const { x, z } = rectCenter(zone.rect);
    const { w } = rectSize(zone.rect);
    const col = new THREE.Color(ZONES[zone.id].color);
    for (const [dx, dz, ww, dd] of [
      [0, -w / 2 - 0.6, w + 2.4, 1.2],
      [0, w / 2 + 0.6, w + 2.4, 1.2],
      [-w / 2 - 0.6, 0, 1.2, w],
      [w / 2 + 0.6, 0, 1.2, w],
    ]) {
      ground.box(ww, 0.03, dd, col, { x: x + dx, z: z + dz, y: 0.0 });
    }
  }

  const staticGroup = batch.build(materials.byKey);
  root.add(staticGroup, dynamic, models.root);
  const treeFallback: Partial<Record<TreeKind, THREE.Object3D>> = {};
  for (const kind of Object.keys(treeBatch) as TreeKind[]) {
    const g = treeBatch[kind].build(materials.byKey);
    g.name = `trees-simple-${kind}`;
    treeFallback[kind] = g;
    root.add(g);
  }
  const trees = new TreeLayer(treeSpots, treeFallback);
  root.add(trees.group);
  const parked = new ParkedCars(parkCars(collision, mulberry32(77)));
  root.add(parked.group);
  dynamic.traverse((o) => {
    // unlit things (signs, screens, the waterfall) and balloons cast no shadow
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.name.startsWith('sign') && !(m.material instanceof THREE.MeshBasicMaterial) && !m.parent?.name.startsWith('balloon') && m.parent?.name !== 'blimp') o.castShadow = true;
  });

  // invisible hit boxes for tapping on buildings
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitboxes = pois.map((p) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, Math.max(4, p.height), p.d), hitMat);
    m.position.set(p.x, Math.max(4, p.height) / 2, p.z);
    m.userData.poiId = p.id;
    m.name = `hit:${p.id}`;
    root.add(m);
    return m;
  });

  return {
    root,
    trees,
    parked,
    layout,
    pois,
    hitboxes,
    walkLoops,
    materials,
    collision,
    models,
    trailGate: gate,
    update(time, dt) {
      for (const a of animators) a(time, dt);
    },
    setNight(n) {
      materials.facade.emissiveIntensity = n * 1.1;
      materials.tower.emissiveIntensity = 0.15 + n * 0.9;
      nightListeners.forEach((fn) => fn(n));
    },
  };
}

/**
 * Cars parked along both kerbs of the main roads, away from crossings and only
 * where the road is clear (not the pedestrian plaza or a park). Each car is solid.
 */
function parkCars(collision: CollisionWorld, rng: () => number): ParkedCar[] {
  const centers = majorRoadCenters();
  const kinds: CarKind[] = ['car_sedan', 'car_hatchback', 'car_suv'];
  const out: ParkedCar[] = [];
  const kerb = MAJOR_ROAD / 2 - 1.3;
  for (const c of centers) {
    for (const side of [-1, 1]) {
      for (const axis of ['x', 'z'] as const) {
        for (let t = -HALF_CITY + 6; t < HALF_CITY - 6; t += 9.5) {
          if (rng() > 0.45) continue;
          if (centers.some((c2) => Math.abs(t - c2) < MAJOR_ROAD)) continue;
          const kind = kinds[Math.floor(rng() * kinds.length)];
          const [w, h, l] = CAR_SIZE[kind];
          const x = axis === 'x' ? t : c + side * kerb;
          const z = axis === 'x' ? c + side * kerb : t;
          const hx = (axis === 'x' ? l : w) / 2 + 0.2;
          const hz = (axis === 'x' ? w : l) / 2 + 0.2;
          // only on bare road: nothing solid there and the ground at street level
          let clear = collision.groundHeight(x, z, 0.4, Math.max(hx, hz)) < 0.05;
          collision.each(x - hx, z - hz, x + hx, z + hz, (b) => {
            if (b.top > 0.05) clear = false;
          });
          if (!clear) continue;
          // facing along the road, the way traffic on that side drives
          const rotY = axis === 'x' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? Math.PI : 0;
          out.push({ kind, x, y: 0, z, rotY, scale: 1 });
          collision.add({ x0: x - hx + 0.2, z0: z - hz + 0.2, x1: x + hx - 0.2, z1: z + hz - 0.2, bottom: 0, top: h, water: false });
        }
      }
    }
  }
  return out;
}
