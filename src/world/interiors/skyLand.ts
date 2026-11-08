import * as THREE from 'three';
import { t } from '../../i18n';
import { loadGltf } from '../../character/AvatarNpc';
import type { Frame } from '../Frame';
import { buildPortal } from '../Portal';
import type { BuildContext } from '../types';

/**
 * Cloud Land: a secret place above the city, reached through a portal. You
 * walk on clouds, climb a staircase of floating islands (each step shows how
 * savings grow by 10%: compound interest) up to a treasure chest, and bounce
 * on a trampoline for coins in the sky. Room coordinates, front (+z) is where
 * the portal home stands.
 */

/** Floating steps: x, z and the height of the top. Each one is 10% higher in "savings". */
export const SKY_STEPS: { x: number; z: number; top: number }[] = [
  { x: -3.0, z: 1.0, top: 0.9 },
  { x: -5.2, z: -1.4, top: 1.8 },
  { x: -4.4, z: -4.6, top: 2.7 },
  { x: -1.4, z: -6.4, top: 3.6 },
  { x: 1.8, z: -5.6, top: 4.5 },
  { x: 3.6, z: -2.8, top: 5.4 },
];
/** The treasure island at the top of the steps. */
export const SKY_TOP = { x: 6.6, z: -0.6, top: 6.3, r: 2.0 };
/** The trampoline on the clouds and its launch. */
export const SKY_TRAMPOLINE = { x: 9.5, z: 7, r: 1.35, top: 0.91, launch: 15 };
/** The island you arrive on. */
const ISLAND = { x: 0, z: 6, r: 5, top: 0.35 };
/** Where the portal home stands. */
export const SKY_PORTAL = { x: 0, z: 16.6 };

/** Savings on each step: 100 growing by 10% a step. */
export const stepSavings = (i: number) => Math.round(100 * Math.pow(1.1, i));

export function buildSkyLandInterior(f: Frame, ctx: BuildContext): void {
  const cloud = '#ffffff';
  const shade = '#e8eefc';
  // the cloud floor (you can walk anywhere on it) with puffs around the edge; clouds get their
  // own soft material so the city's ground pattern (flagstones on light colours) stays off them
  const soft = new THREE.MeshStandardMaterial({ color: cloud, roughness: 1 });
  const softShade = new THREE.MeshStandardMaterial({ color: shade, roughness: 1 });
  const puff = (g: THREE.BufferGeometry, x: number, y: number, z: number, m = soft) => {
    const mesh = f.place(new THREE.Mesh(g, m), { x, y, z });
    mesh.receiveShadow = true;
  };
  puff(new THREE.CylinderGeometry(19, 18, 0.5, 40), 0, -0.21, 0);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = 17 + (i % 3) * 0.8;
    puff(new THREE.SphereGeometry(1.6 + (i % 4) * 0.5, 12, 8).scale(1, 0.5, 1), Math.cos(a) * r, 0.1, Math.sin(a) * r, i % 2 ? soft : softShade);
  }
  for (const [x, z, r] of [[-10, 8, 1.6], [12, -6, 2.0], [-12, -8, 1.8], [6, 12, 1.2], [-6, 13, 1.3]] as const) {
    puff(new THREE.SphereGeometry(r, 12, 8).scale(1.3, 0.45, 1), x, 0.05, z, softShade);
  }

  // the arrival island with a tree and flowers
  f.cyl(ISLAND.r, ISLAND.r - 0.3, ISLAND.top, '#6cbf4c', { x: ISLAND.x, z: ISLAND.z }, 32);
  ctx.batch.noCollision(() => {
    f.cyl(ISLAND.r - 0.2, ISLAND.r - 1.6, 1.4, '#9a7350', { x: ISLAND.x, z: ISLAND.z, y: -1.4 }, 24);
    f.cyl(0.25, 0.32, 1.8, '#8a5a3b', { x: -2.6, z: 7.6, y: ISLAND.top }, 10);
    f.sphere(1.2, '#4f9a45', { x: -2.6, z: 7.6, y: ISLAND.top + 2.3 }, 10);
    f.sphere(0.85, '#6cbf4c', { x: -2.0, z: 7.4, y: ISLAND.top + 2.9 }, 10);
    const petals = ['#ff7aa8', '#ffd84a', '#ffffff', '#a57cf2'];
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      const r = 1.5 + (i % 4) * 0.8;
      f.sphere(0.12, petals[i % 4], { x: ISLAND.x + Math.cos(a) * r, z: ISLAND.z + Math.sin(a) * r, y: ISLAND.top + 0.12 }, 6);
    }
  });
  // the rule of the steps
  f.sign(t('sky.sign'), 4.2, 0.9, { x: -1.4, z: 3.2, y: ISLAND.top + 1.2, rotY: 0.35 }, { bg: '#5b3fc4', fg: '#ffffff' });
  ctx.batch.noCollision(() => f.box(0.12, 1.2, 0.12, '#8a5a3b', { x: -1.4, z: 3.15, y: ISLAND.top }));

  // the staircase of floating islands, each with its savings over it
  const stepColors = ['#7fd36a', '#6cc7e8', '#ffd84a', '#ff9f6b', '#c79bff', '#ff7aa8'];
  SKY_STEPS.forEach((s, i) => {
    f.cyl(1.3, 1.0, 0.35, stepColors[i], { x: s.x, z: s.z, y: s.top - 0.35 }, 20);
    puff(new THREE.SphereGeometry(1.1, 12, 8).scale(1.2, 0.45, 1.2), s.x, s.top - 0.5, s.z);
    f.sign(t('sky.step', { n: stepSavings(i) }), 1.6, 0.42, { x: s.x, z: s.z, y: s.top + 2.0 }, { bg: '#ffffff', fg: '#5b3fc4' });
  });
  const tp = SKY_TOP;
  f.cyl(tp.r, tp.r - 0.4, 0.4, '#ffd84a', { x: tp.x, z: tp.z, y: tp.top - 0.4 }, 24);
  puff(new THREE.SphereGeometry(1.8, 14, 8).scale(1.3, 0.5, 1.3), tp.x, tp.top - 0.6, tp.z);
  f.sign(t('sky.top', { n: stepSavings(SKY_STEPS.length) }), 2.4, 0.5, { x: tp.x, z: tp.z - 1.2, y: tp.top + 2.2 }, { bg: '#5b3fc4', fg: '#ffd84a' });

  // a rainbow behind it all
  ctx.batch.noCollision(() => {
    ['#ff5d5d', '#ff9f43', '#ffd84a', '#5fd36a', '#4fb6ff', '#8a6bff'].forEach((c, i) => {
      f.geo(new THREE.TorusGeometry(12 - i * 0.36, 0.18, 8, 48, Math.PI), c, { z: -13, y: -0.5 });
    });
  });

  // the trampoline on the clouds
  f.model('trampoline', { x: SKY_TRAMPOLINE.x, z: SKY_TRAMPOLINE.z, y: -0.3, solid: false });
  const h = 1.15;
  ctx.batch.solid({ x0: f.ox + SKY_TRAMPOLINE.x - h, z0: f.oz + SKY_TRAMPOLINE.z - h, x1: f.ox + SKY_TRAMPOLINE.x + h, z1: f.oz + SKY_TRAMPOLINE.z + h, bottom: 0, top: SKY_TRAMPOLINE.top, water: false });

  // the portal home
  const portal = buildPortal('#ffb347');
  f.place(portal.object, { x: SKY_PORTAL.x, z: SKY_PORTAL.z, rotY: Math.PI });
  ctx.addAnimator((time) => portal.update(time));
}

/** A portal standing in a room (the startup hub's prototype). */
export function roomPortal(f: Frame, ctx: BuildContext, x: number, z: number, rotY: number): void {
  const portal = buildPortal();
  f.place(portal.object, { x, z, rotY });
  ctx.addAnimator((time) => portal.update(time));
}

/* ------------------------------------------------------------------ */
/* Coins and the treasure chest                                        */
/* ------------------------------------------------------------------ */

export interface SkySpot {
  id: string;
  x: number;
  y: number;
  z: number;
}

/** Coins in Cloud Land, in room coordinates. */
export function skyCoins(): SkySpot[] {
  const out: SkySpot[] = [];
  SKY_STEPS.forEach((s, i) => out.push({ id: `sky${out.length}`, x: s.x, z: s.z, y: s.top + 1.0 + (i === 0 ? 0 : 0) }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    out.push({ id: `sky${out.length}`, x: Math.cos(a) * 9.5, z: Math.sin(a) * 9.5 + 2, y: 1.0 });
  }
  for (const lift of [2.4, 4.4, 6.4, 8.6]) out.push({ id: `sky${out.length}`, x: SKY_TRAMPOLINE.x, z: SKY_TRAMPOLINE.z, y: SKY_TRAMPOLINE.top + lift });
  return out;
}

export const SKY_CHEST = { id: 'skyChest', coins: 30 };

export type SkyEvent = { kind: 'coin'; id: string; count: number; total: number } | { kind: 'chest'; id: string };

const REACH = 0.9;

/** Coins and one treasure chest in a place away from the city (room coordinates). */
export interface TreasureConfig {
  /** Every id starts with it, so `restore` picks this place's finds out of the save. */
  prefix: string;
  coins: SkySpot[];
  chest: { id: string; x: number; y: number; z: number; rotY?: number; scale?: number };
}

/** The coins and the chest of a place (Cloud Land, Adventure Island): drawn in the room and picked up by touch. */
export class RoomTreasure {
  readonly group = new THREE.Group();
  readonly coins: SkySpot[];
  private found = new Set<string>();
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private chest = new THREE.Group();
  private chestAt: THREE.Vector3;
  private opening = -1;
  private prefix: string;
  private chestId: string;

  constructor(ox: number, oz: number, cfg: TreasureConfig) {
    this.group.name = `${cfg.prefix}-treasure`;
    this.prefix = cfg.prefix;
    this.chestId = cfg.chest.id;
    this.coins = cfg.coins.map((c) => ({ ...c, x: c.x + ox, z: c.z + oz }));
    const mat = new THREE.MeshStandardMaterial({ color: '#ffc928', metalness: 0.75, roughness: 0.28, emissive: '#7a4a00', emissiveIntensity: 0.35 });
    this.mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 24).rotateX(Math.PI / 2), mat, this.coins.length);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    this.chestAt = new THREE.Vector3(ox + cfg.chest.x, cfg.chest.y, oz + cfg.chest.z);
    this.chest.position.copy(this.chestAt);
    this.chest.rotation.y = cfg.chest.rotY ?? -Math.PI / 2;
    this.group.add(this.chest);
    const scale = cfg.chest.scale ?? 1.6;
    void loadGltf('models/meshy/props/treasure_chest.glb')
      .then((g) => {
        const obj = g.scene.clone(true);
        obj.scale.setScalar(scale);
        obj.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
        this.chest.add(obj);
      })
      .catch(() => {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), new THREE.MeshStandardMaterial({ color: '#9a5a2a' }));
        box.position.y = 0.45;
        this.chest.add(box);
      });
  }

  restore(ids: string[]): void {
    this.found = new Set(ids.filter((id) => id.startsWith(this.prefix)));
    this.chest.visible = !this.found.has(this.chestId);
  }

  get coinCount(): number {
    return this.coins.filter((c) => this.found.has(c.id)).length;
  }

  update(time: number, dt: number, player: THREE.Vector3 | null): SkyEvent[] {
    const events: SkyEvent[] = [];
    this.coins.forEach((c, i) => {
      if (!this.found.has(c.id) && player && Math.hypot(player.x - c.x, player.z - c.z) < REACH) {
        const rel = c.y - player.y;
        if (rel > 0.1 && rel < 2.0) {
          this.found.add(c.id);
          events.push({ kind: 'coin', id: c.id, count: this.coinCount, total: this.coins.length });
        }
      }
      this.dummy.position.set(c.x, c.y + Math.sin(time * 2 + i) * 0.08, c.z);
      this.dummy.rotation.set(0, time * 2.4 + i, 0);
      this.dummy.scale.setScalar(this.found.has(c.id) ? 0 : 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!this.found.has(this.chestId) && player && Math.hypot(player.x - this.chestAt.x, player.z - this.chestAt.z) < 1.6 && Math.abs(player.y - this.chestAt.y) < 1.2) {
      this.found.add(this.chestId);
      this.opening = 0;
      events.push({ kind: 'chest', id: this.chestId });
    }
    if (this.opening >= 0) {
      this.opening += dt;
      const k = Math.min(1, this.opening / 1.2);
      this.chest.scale.setScalar(Math.max(0.001, 1 + Math.sin(k * Math.PI) * 0.3 - k));
      if (k >= 1) {
        this.chest.visible = false;
        this.opening = -1;
      }
    }
    return events;
  }
}

/** Cloud Land's coins and the chest on the treasure island. */
export class SkyTreasure extends RoomTreasure {
  constructor(ox: number, oz: number) {
    super(ox, oz, { prefix: 'sky', coins: skyCoins(), chest: { id: SKY_CHEST.id, x: SKY_TOP.x, y: SKY_TOP.top, z: SKY_TOP.z } });
  }
}
