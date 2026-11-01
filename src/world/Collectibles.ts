import * as THREE from 'three';
import { loadGltf } from '../character/AvatarNpc';
import { ZONES, type ZoneId } from '../content/cityPlan';
import { minorRoadCenter, zoneStart, ZONE_SIZE, type ZoneLayout } from './cityLayout';
import type { CollisionWorld } from './Collision';
import { TRAIL } from './landmarks/decor';
import { BRIDGES, deckHeight, RIVER } from './landmarks/river';
import { LAWN_Y, PLAZA, RAMP, TRAMPOLINE } from './landmarks/plaza';

/**
 * Golden coins and treasure chests hidden around the world: trails of coins
 * down every district street, coins high in the air that need a jump, coins
 * over the bridges, and a few chests in out-of-the-way places. Collecting is
 * by walking (or jumping) through them. Positions are deterministic, so the
 * save stores only the ids that were found.
 */

export interface CoinSpot {
  id: string;
  x: number;
  z: number;
  /** Height of the coin's centre. */
  y: number;
}

export interface ChestSpot extends CoinSpot {
  /** In-game coins inside. */
  coins: number;
}

export const GOLD_TOTAL = 100;
/** A coin is picked up within this distance (metres, on the ground plane). */
const REACH = 1.15;

/** Every coin and chest position, built from the city layout. */
export function collectibleSpots(layout: ZoneLayout[], collision: CollisionWorld): { coins: CoinSpot[]; chests: ChestSpot[] } {
  const coins: CoinSpot[] = [];
  const ground = (x: number, z: number) => collision.groundHeight(x, z, 0.5);
  const add = (x: number, z: number, lift = 1.0, tag = 'c') => {
    const id = `${tag}${coins.length}`;
    coins.push({ id, x, z, y: ground(x, z) + lift });
  };

  // the opening square: a ring round the fountain and two high ones that teach jumping
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(PLAZA.fountain.x + Math.cos(a) * 6.5, PLAZA.fountain.z + Math.sin(a) * 6.5);
  }
  add(-4, 12, 2.6, 'j');
  add(6, 14, 2.6, 'j');

  // the playground: a column of coins over the trampoline (the top one needs a timed jump) and an arc off the ramp
  const tp = PLAZA.trampoline;
  for (const lift of [2.2, 4.2, 6.0, 8.2]) coins.push({ id: `t${coins.length}`, x: tp.x, z: tp.z, y: TRAMPOLINE.top + lift });
  const rp = PLAZA.ramp;
  for (const [dx, lift] of [[-2.2, 2.1], [-3.6, 1.9], [-5.0, 1.2]] as const) coins.push({ id: `r${coins.length}`, x: rp.x - RAMP.length / 2 + dx, z: rp.z, y: LAWN_Y + lift });

  // every district: a trail down the middle of its side street, ending in a high coin
  for (const zone of layout) {
    if (ZONES[zone.id as ZoneId].kind !== 'district') continue;
    const zx = zoneStart(zone.col);
    const zz = zoneStart(zone.row);
    const mz = minorRoadCenter(zone.row);
    const mx = minorRoadCenter(zone.col);
    for (let k = 0; k < 6; k++) add(zx + 6 + k * 4, mz);
    add(zx + ZONE_SIZE - 6, mz, 2.6, 'j');
    for (let k = 0; k < 4; k++) add(mx, zz + 8 + k * 4);
    add(mx, zz + ZONE_SIZE - 7, 2.6, 'j');
  }

  // over each bridge: you get them by crossing
  for (const b of BRIDGES) {
    for (const u of [-6, 0, 6]) {
      const x = b.along === 'x' ? b.x + u : b.x;
      const z = b.along === 'z' ? b.z + u : b.z;
      coins.push({ id: `b${coins.length}`, x, z, y: deckHeight(u) + 1.0 });
    }
  }

  // the far banks
  for (let k = 0; k < 5; k++) add(-60 + k * 30, RIVER.south + RIVER.width / 2 + 9);
  for (let k = 0; k < 4; k++) add(RIVER.east + RIVER.width / 2 + 9, -60 + k * 40);

  // the waterfall trail (open after the first quest)
  for (let k = 0; k < 6; k++) add(0, TRAIL.z1 - 8 - k * 8);

  // top up or trim to exactly GOLD_TOTAL along the south promenade
  let extra = 0;
  while (coins.length < GOLD_TOTAL) add(-110 + extra++ * 9, RIVER.south - RIVER.width / 2 - 6);
  coins.length = GOLD_TOTAL;

  const chests: ChestSpot[] = [
    { id: 'chestBridge', x: BRIDGES[0].x, z: BRIDGES[0].z, y: deckHeight(0), coins: 25 },
    { id: 'chestSouth', x: 0, z: RIVER.south + RIVER.width / 2 + 16, y: 0, coins: 25 },
    { id: 'chestEast', x: RIVER.east + RIVER.width / 2 + 16, z: 60, y: 0, coins: 25 },
    { id: 'chestCorner', x: RIVER.east + RIVER.width / 2 + 14, z: RIVER.south + RIVER.width / 2 + 14, y: 0, coins: 40 },
    { id: 'chestFalls', x: 7, z: TRAIL.z0 - 10, y: 0, coins: 40 },
  ];
  for (const c of chests) if (c.y === 0) c.y = ground(c.x, c.z);
  return { coins, chests };
}

export type FoundEvent = { kind: 'coin'; id: string; count: number } | { kind: 'chest'; id: string; coins: number; count: number };

export class Collectibles {
  readonly group = new THREE.Group();
  readonly coins: CoinSpot[];
  readonly chests: ChestSpot[];
  private found = new Set<string>();
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private chestObjects = new Map<string, THREE.Object3D>();
  private popping: { obj: THREE.Object3D; t: number }[] = [];

  constructor(layout: ZoneLayout[], collision: CollisionWorld) {
    this.group.name = 'collectibles';
    const spots = collectibleSpots(layout, collision);
    this.coins = spots.coins;
    this.chests = spots.chests;

    // a chunky gold coin with a raised rim, standing upright
    const face = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 24).rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffc928', metalness: 0.75, roughness: 0.28, emissive: '#7a4a00', emissiveIntensity: 0.35 });
    this.mesh = new THREE.InstancedMesh(face, mat, this.coins.length);
    this.mesh.name = 'gold-coins';
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    // the Meshy coin (a star on its face) replaces the plain disc once it loads
    void loadGltf('models/meshy/props/coin.glb')
      .then((g) => {
        let src: THREE.Mesh | null = null;
        g.scene.traverse((o) => ((o as THREE.Mesh).isMesh && !src ? (src = o as THREE.Mesh) : null));
        if (!src) return;
        const m = src as THREE.Mesh;
        m.updateWorldMatrix(true, false);
        const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
        geo.computeBoundingBox();
        const bb = geo.boundingBox!;
        geo.translate(0, -(bb.min.y + bb.max.y) / 2, 0);
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        mat.emissive = new THREE.Color('#6a4000');
        mat.emissiveIntensity = 0.45;
        this.mesh.geometry.dispose();
        this.mesh.geometry = geo;
        this.mesh.material = mat;
      })
      .catch(() => undefined);

    for (const c of this.chests) {
      const holder = new THREE.Group();
      holder.position.set(c.x, c.y, c.z);
      holder.name = `chest:${c.id}`;
      this.group.add(holder);
      this.chestObjects.set(c.id, holder);
      void loadGltf('models/meshy/props/treasure_chest.glb')
        .then((g) => {
          const obj = g.scene.clone(true);
          obj.scale.setScalar(1.6);
          obj.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
          holder.add(obj);
        })
        .catch(() => {
          // a plain box chest if the model can't load
          const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), new THREE.MeshStandardMaterial({ color: '#9a5a2a' }));
          box.position.y = 0.45;
          holder.add(box);
        });
    }
  }

  /** Marks what an earlier session already found. */
  restore(ids: string[]): void {
    this.found = new Set(ids);
    for (const [id, obj] of this.chestObjects) obj.visible = !this.found.has(id);
  }

  get coinCount(): number {
    return this.coins.filter((c) => this.found.has(c.id)).length;
  }

  get chestCount(): number {
    return this.chests.filter((c) => this.found.has(c.id)).length;
  }

  /** Spins the coins and picks up whatever the player touches. */
  update(time: number, dt: number, player: THREE.Vector3 | null): FoundEvent[] {
    const events: FoundEvent[] = [];
    const d = this.dummy;
    this.coins.forEach((c, i) => {
      const got = this.found.has(c.id);
      if (!got && player && Math.hypot(player.x - c.x, player.z - c.z) < REACH) {
        const rel = c.y - player.y;
        if (rel > 0.1 && rel < 2.0) {
          this.found.add(c.id);
          events.push({ kind: 'coin', id: c.id, count: this.coinCount });
        }
      }
      d.position.set(c.x, c.y + Math.sin(time * 2 + i) * 0.08, c.z);
      d.rotation.set(0, time * 2.4 + i, 0);
      d.scale.setScalar(this.found.has(c.id) ? 0 : 1);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;

    for (const c of this.chests) {
      if (this.found.has(c.id) || !player) continue;
      if (Math.hypot(player.x - c.x, player.z - c.z) < 1.6 && Math.abs(player.y - c.y) < 1.2) {
        this.found.add(c.id);
        const obj = this.chestObjects.get(c.id);
        if (obj) this.popping.push({ obj, t: 0 });
        events.push({ kind: 'chest', id: c.id, coins: c.coins, count: this.chestCount });
      }
    }
    // an opened chest hops, swaps to the open one full of coins, glows and then fades away
    this.popping = this.popping.filter((p) => {
      p.t += dt;
      if (p.t < 0.35) {
        p.obj.scale.setScalar(1 + Math.sin((p.t / 0.35) * Math.PI) * 0.25);
        return true;
      }
      if (!p.obj.userData.opened) {
        p.obj.userData.opened = true;
        p.obj.scale.setScalar(1);
        this.showOpen(p.obj);
      }
      const k = Math.min(1, (p.t - 0.35) / 2.6);
      const light = p.obj.userData.light as THREE.PointLight | undefined;
      if (light) light.intensity = 6 * Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * (1 - k);
      if (k > 0.75) p.obj.scale.setScalar(Math.max(0.001, 1 - (k - 0.75) * 4));
      if (k >= 1) p.obj.visible = false;
      return k < 1;
    });
    return events;
  }

  /** Replaces a closed chest with the open, coin-filled one and a warm light. */
  private showOpen(holder: THREE.Object3D): void {
    const light = new THREE.PointLight('#ffcf4a', 0, 7, 1.6);
    light.position.y = 1.4;
    holder.add(light);
    holder.userData.light = light;
    void loadGltf('models/meshy/props/chest_open_glow.glb')
      .then((g) => {
        for (const c of holder.children) if (c !== light) c.visible = false;
        const open = g.scene.clone(true);
        open.scale.setScalar(1.6);
        holder.add(open);
      })
      .catch(() => undefined);
  }

  get foundIds(): string[] {
    return [...this.found];
  }
}
