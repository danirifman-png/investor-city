import * as THREE from 'three';
import type { LotType } from '../../content/cityPlan';
import { MODEL_SIZES, type ModelKey } from '../ModelLayer';
import { t } from '../../i18n';
import type { Frame } from '../Frame';
import { beacon, bench, bin, car, fence, flowerBed, lotGround, palm, smoke, streetLamp, tree, truck, umbrellaTable, windTurbine } from '../props';
import type { BuildContext } from '../types';

/**
 * Builders for every regular lot. Each works in a local frame centred on the
 * lot with the usable area spanning [-12, 12] on both axes and the front of
 * the lot facing +z. Builders return the height of their tallest structure so
 * the floating label can sit above it.
 */
export type LotBuilder = (f: Frame, ctx: BuildContext) => number;

const S = 12; // half size of the usable lot area
const GRASS = '#7dbb5c';
const PAVING = '#d8d2c4';
const CAR_COLORS = ['#e34b4b', '#3d7be0', '#f2c14e', '#ffffff', '#2c2f36', '#4fc79a', '#f08a4b'];

const pick = <T,>(arr: T[], rng: () => number) => arr[Math.floor(rng() * arr.length)];

/** Shop with awning and sign, front facing local +z at z = front. */
function shopFront(f: Frame, x: number, front: number, w: number, d: number, floors: number, wall: string, awning: string, sign: string): void {
  const h = floors * 3.4;
  f.facade(w, h, d, wall, { x, z: front - d / 2 }, 3.4, 3);
  // glass storefront
  f.box(w - 0.8, 2.6, 0.2, '#9fd0ec', { x, z: front + 0.02, y: 0.1 }, 'glass');
  // striped awning
  const stripes = Math.max(3, Math.round(w / 1.1));
  const sw = w / stripes;
  for (let i = 0; i < stripes; i++) {
    f.box(sw, 0.12, 1.6, i % 2 ? '#ffffff' : awning, { x: x - w / 2 + sw * (i + 0.5), z: front + 0.75, y: 2.95, rotX: 0.35 });
  }
  f.box(w + 0.2, 0.4, d + 0.2, '#efe9df', { x, z: front - d / 2, y: h });
  f.sign(sign, Math.min(w - 1, 6), 1, { x, z: front + 0.12, y: 3.85 }, { bg: awning, fg: '#ffffff' });
}

/** Rooftop clutter that makes flat roofs read as real buildings. */
function roofUnits(f: Frame, x: number, z: number, y: number, w: number, d: number, rng: () => number): void {
  const n = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    f.box(1.4 + rng() * 1.6, 0.9 + rng() * 0.8, 1.2 + rng() * 1.2, '#b9bec6', {
      x: x + (rng() - 0.5) * (w - 3),
      z: z + (rng() - 0.5) * (d - 3),
      y,
    });
  }
}

/** Israeli-style rooftop solar water heaters. */
function solarHeater(f: Frame, x: number, z: number, y: number): void {
  f.box(1.8, 0.1, 1.2, '#22406e', { x, z, y: y + 0.7, rotX: -0.6 }, 'glass');
  f.cyl(0.35, 0.35, 1.6, '#e9ecef', { x, z: z - 0.8, y: y + 1.05, rotZ: Math.PI / 2 }, 8);
}

function sidewalkTrees(f: Frame, rng: () => number, edges: ('n' | 's' | 'e' | 'w')[] = ['s']): void {
  for (const e of edges) {
    for (let i = -1; i <= 1; i += 2) {
      const a = i * 8;
      const [x, z] = e === 's' ? [a, S + 1.4] : e === 'n' ? [a, -S - 1.4] : e === 'e' ? [S + 1.4, a] : [-S - 1.4, a];
      tree(f, x, z, 0.85, rng);
    }
  }
}

/* ---------------------------- Technology ---------------------------- */

const techHQ: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, PAVING);
  f.box(18, 4, 18, '#294766', { z: -1 }, 'glass');
  f.box(18.6, 0.4, 18.6, '#e6eef6', { z: -1, y: 4 });
  const floors = 13;
  let y = 4.4;
  for (let i = 0; i < floors; i++) {
    const rot = i * 0.075;
    f.box(11.5, 2.9, 11.5, '#4fb4e3', { z: -1, y, rotY: rot }, 'glass');
    f.box(12.1, 0.35, 12.1, '#f0f6fb', { z: -1, y: y + 2.9, rotY: rot });
    y += 3.25;
  }
  f.cyl(0.15, 0.3, 7, '#d0d8e0', { z: -1, y }, 6);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.18, 8, 40), new THREE.MeshBasicMaterial({ color: '#7ef0ff' }));
  ring.rotation.x = Math.PI / 2;
  f.place(ring, { z: -1, y: y + 0.6 });
  ctx.addAnimator((time) => {
    ring.scale.setScalar(1 + Math.sin(time * 2) * 0.05);
  });
  beacon(f, 0, y + 7.2, -1, '#ff4040');
  f.sign(t('sign.pixel'), 8, 1.6, { z: 8.12, y: 2.2 }, { bg: '#13233a', fg: '#7ef0ff' });
  for (const x of [-9, 9]) palm(f, x, 10, 0.9);
  bench(f, -4, 10.5, Math.PI);
  return y + 7;
};

const dataCenter: LotBuilder = (f) => {
  lotGround(f, 24, 24, '#c9ccd2');
  for (const z of [-5.5, 5.5]) {
    f.box(21, 6.5, 9, '#dfe4ea', { z });
    f.box(21, 0.5, 0.3, '#3fb6e8', { z: z + 4.6, y: 4.6 }, 'glow');
    for (let i = 0; i < 4; i++) {
      f.cyl(1.2, 1.2, 0.9, '#9aa3ad', { x: -7.5 + i * 5, z, y: 6.5 }, 14);
      f.cyl(1.0, 1.0, 0.1, '#3a4048', { x: -7.5 + i * 5, z, y: 7.41 }, 14);
    }
    for (let i = 0; i < 6; i++) beacon(f, -9 + i * 3.6, 1.6, z + 4.55, i % 2 ? '#46f08f' : '#3fb6e8', 0.6 + i * 0.13, 0.14);
  }
  f.sign(t('sign.cloud'), 6, 1.2, { z: 10.06, y: 2.6 }, { bg: '#1c2b44', fg: '#a8e6ff' });
  fence(f.sub(0, 0), 24, 24, '#8d96a0', 5);
  return 8;
};

const startupHub: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, PAVING);
  const colors = ['#ff7a59', '#ffc94a', '#4fc79a', '#3fb6e8', '#a57cf2', '#ff6b9a'];
  const rng = ctx.rng;
  for (let level = 0; level < 4; level++) {
    for (let k = 0; k < 3 - Math.floor(level / 2); k++) {
      const x = -6 + k * 6 + (rng() - 0.5) * 2;
      const z = -3 + (rng() - 0.5) * 4;
      f.facade(7, 3.1, 4, colors[(level * 3 + k) % colors.length], { x, z, y: level * 3.15, rotY: (rng() - 0.5) * 0.25 }, 3.1, 2.4);
    }
  }
  umbrellaTable(f, -6, 8, '#ffc94a');
  umbrellaTable(f, 0, 8, '#4fc79a');
  f.sign(t('sign.startup'), 7, 1.2, { z: 1.2, y: 3.3 }, { bg: '#ff7a59' });
  sidewalkTrees(f, rng);
  return 14;
};

const techCampus: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, GRASS);
  f.cyl(9.5, 9.5, 15, '#5ba7d6', { z: -1 }, 36, 'glass');
  for (let y = 0; y <= 15; y += 3.75) f.cyl(9.9, 9.9, 0.35, '#f1f5f9', { z: -1, y }, 36);
  f.cyl(9.3, 9.3, 0.3, '#78b957', { z: -1, y: 15.35 }, 36);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    tree(f, Math.sin(a) * 5.5, -1 + Math.cos(a) * 5.5, 0.55, ctx.rng);
  }
  f.sign(t('sign.cloud'), 6, 1.2, { z: 8.7, y: 1.6 }, { bg: '#1c2b44', fg: '#a8e6ff' });
  sidewalkTrees(f, ctx.rng);
  return 19;
};

/* ------------------------------ Health ------------------------------ */

const hospital: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, PAVING);
  f.facade(22, 15, 10, '#f4f7f9', { z: -6 }, 3.75, 3);
  f.facade(9, 9, 9, '#e7f2ee', { x: -6, z: 4 }, 3, 3);
  f.box(22.4, 0.4, 10.4, '#cfe3dc', { z: -6, y: 15 });
  // helipad
  f.cyl(4, 4, 0.2, '#3a4048', { z: -6, y: 15.4 }, 24);
  f.box(0.5, 0.05, 3, '#ffffff', { x: -0.9, z: -6, y: 15.62 });
  f.box(0.5, 0.05, 3, '#ffffff', { x: 0.9, z: -6, y: 15.62 });
  f.box(1.8, 0.05, 0.5, '#ffffff', { z: -6, y: 15.62 });
  // green plus sign (health symbol)
  f.box(3.4, 1.0, 0.3, '#2fbf71', { x: 6, z: -0.8, y: 11 }, 'glow');
  f.box(1.0, 3.4, 0.3, '#2fbf71', { x: 6, z: -0.8, y: 9.8 }, 'glow');
  f.sign(t('poi.hospital.name'), 9, 1.3, { x: 4, z: -0.82, y: 6.6 }, { bg: '#2fbf71' });
  // ambulance
  f.box(2.2, 2.2, 5, '#ffffff', { x: 5, z: 6, y: 0.4 });
  f.box(2.25, 0.4, 5.05, '#e8473f', { x: 5, z: 6, y: 1.4 });
  beacon(f, 5, 2.8, 7.8, '#3d7be0', 0.5, 0.2);
  sidewalkTrees(f, ctx.rng);
  return 17;
};

const lab: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, GRASS);
  f.facade(18, 9, 10, '#f2f4f7', { z: -5 }, 3, 3);
  f.geo(new THREE.SphereGeometry(3.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#e9eef3', { x: -4, z: -5, y: 9 });
  f.geo(new THREE.SphereGeometry(2.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#e9eef3', { x: 4, z: -5, y: 9 });
  // greenhouse
  f.box(10, 3.5, 6, '#bfe8d2', { x: 4, z: 6 }, 'glass');
  f.gable(10, 1.6, 6, '#bfe8d2', { x: 4, z: 6, y: 3.5 });
  for (let i = 0; i < 5; i++) f.box(0.15, 3.5, 6.1, '#f5f5f5', { x: -0.5 + i * 2.25, z: 6 });
  f.sign(t('sign.lab'), 5, 1.1, { x: -4, z: 0.07, y: 3 }, { bg: '#5b6bd8' });
  flowerBed(f, -7, 7, 5, 3, ctx.rng);
  return 13;
};

const pharmacy: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, PAVING);
  shopFront(f, -4, 6, 12, 10, 3, '#f6efe4', '#2fbf71', t('sign.pharmacy'));
  f.box(1.6, 0.5, 0.3, '#2fbf71', { x: 2.6, z: 6.2, y: 8.6 }, 'glow');
  f.box(0.5, 1.6, 0.3, '#2fbf71', { x: 2.6, z: 6.2, y: 8.05 }, 'glow');
  f.facade(8, 13.6, 9, '#e8dccb', { x: 7, z: -5 }, 3.4, 3);
  solarHeater(f, 7, -5, 13.6);
  sidewalkTrees(f, ctx.rng);
  return 15;
};

const fitness: LotBuilder = (f) => {
  lotGround(f, 24, 24, GRASS);
  f.facade(20, 7, 9, '#ffe2c7', { z: -6.5 }, 3.5, 4);
  f.box(19.5, 4.5, 0.2, '#9fd0ec', { z: -1.95, y: 1 }, 'glass');
  f.sign(t('sign.fitness'), 6, 1.2, { z: -1.8, y: 6.1 }, { bg: '#ff7a59' });
  f.box(14, 0.3, 7, '#d8eef7', { x: -1, z: 6 });
  f.box(13, 0.32, 6, '#38a9e0', { x: -1, z: 6 }, 'water');
  for (let i = 0; i < 4; i++) f.box(0.8, 0.3, 2, '#ffffff', { x: 8, z: 3.5 + i * 2.1, y: 0.3 });
  umbrellaTable(f, 9, 10, '#ff7a59');
  return 9;
};

/* ------------------------------ Energy ------------------------------ */

const windFarm: LotBuilder = (f) => {
  lotGround(f, 24, 24, '#93c56a');
  windTurbine(f, -6, -6, 26, 1.1);
  windTurbine(f, 6, -2, 24, 0.9);
  windTurbine(f, -3, 7, 22, 1.3);
  f.box(3, 2.4, 2.4, '#e9edf1', { x: 7, z: 8 });
  return 38;
};

const solarField: LotBuilder = (f) => {
  lotGround(f, 24, 24, '#c9bf9f');
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 3; c++) {
      const x = -7.5 + c * 7.5;
      const z = -9.5 + r * 3.6;
      f.box(6.6, 0.12, 2.4, '#1f3f74', { x, z, y: 1.2, rotX: -0.55 }, 'glass');
      f.box(0.15, 1.1, 0.15, '#9aa3ad', { x: x - 3, z });
      f.box(0.15, 1.1, 0.15, '#9aa3ad', { x: x + 3, z });
    }
  }
  f.box(3, 2.4, 2, '#e9edf1', { x: 9, z: 10 });
  return 4;
};

const battery: LotBuilder = (f) => {
  lotGround(f, 24, 24, '#cfcfc6');
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const x = -8.5 + c * 5.4;
      const z = -8 + r * 5;
      f.box(4.2, 2.6, 2.6, '#f4f6f8', { x, z });
      f.box(0.4, 1.4, 0.05, '#46f08f', { x: x + 1.5, z: z + 1.33, y: 0.6 }, 'glow');
    }
  }
  // substation
  for (let i = 0; i < 4; i++) {
    f.box(0.3, 7, 0.3, '#9aa3ad', { x: -9 + i * 6, z: 8 });
    f.cyl(0.25, 0.25, 0.8, '#7e6a5a', { x: -9 + i * 6, z: 8, y: 7 }, 6);
  }
  f.box(18.5, 0.25, 0.25, '#9aa3ad', { x: 0, z: 8, y: 6.6 });
  for (const x of [-2.8, 2.8]) f.box(0.15, 2.2, 0.15, '#6b7280', { x, z: 10.4 });
  f.sign(t('sign.battery'), 6, 1.1, { x: 0, z: 10.5, y: 1.7 }, { bg: '#2f7d4d' });
  return 8;
};

const energyHQ: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, GRASS);
  f.facade(18, 15, 12, '#f4f1e6', { z: -3 }, 3.75, 3.6);
  f.box(0.6, 15, 12, '#4c9a44', { x: -9.3, z: -3 }); // green wall
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) f.box(3.6, 0.1, 2.4, '#1f3f74', { x: -6 + c * 4, z: -7 + r * 3.4, y: 16, rotX: -0.45 }, 'glass');
  }
  windTurbine(f.sub(0, 0, 0, 15), 7.5, -7.5, 5, 2.0);
  f.sign(t('sign.energy'), 7.5, 1.4, { z: 3.07, y: 3.2 }, { bg: '#f2c14e', fg: '#3b2a00' });
  sidewalkTrees(f, ctx.rng);
  return 24;
};

/* --------------------------- Food & shops --------------------------- */

/** A Meshy building with its front on local z = `front`; returns its height. */
function shop(f: Frame, key: ModelKey, x: number, front: number, scale: number): number {
  const [, h, d] = MODEL_SIZES[key];
  f.model(key, { x, z: front - (d * scale) / 2, scale });
  return h * scale;
}

/** Sidewalk life in front of a shop row: bins, planters, a bike. */
function streetKit(f: Frame, z: number, xs: number[], rng: () => number): void {
  xs.forEach((x, i) => {
    const kind = (['planter', 'trash_bin', 'planter', 'bicycle'] as const)[(i + Math.floor(rng() * 4)) % 4];
    f.model(kind, { x, z, solid: kind !== 'trash_bin', rotY: kind === 'bicycle' ? 0.2 : 0 });
  });
}

const pizzeria: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, PAVING);
  // Marco's pizzeria: the door lines up with the interior's entrance (x -4)
  const h = shop(f, 'pizzeria', -4, 4, 1.5);
  f.sign(t('sign.pizza'), 5.2, 1.1, { x: -4, z: 4.15, y: 4.9 }, { bg: '#d8392b' });
  smoke(ctx, -7.5 + f.ox, f.baseY + h + 0.6, -2 + f.oz, '#e6e6e6', 10);
  shop(f, 'burger_shop', 7.4, 4, 1.25);
  f.sign(t('sign.burger'), 3.6, 0.9, { x: 7.4, z: 4.15, y: 3.9 }, { bg: '#f2a23a', fg: '#3b2a00' });
  for (const x of [-9, -5.5, -2]) f.model('cafe_set', { x, z: 8.6, scale: 1.15, solid: false });
  streetKit(f, 10.6, [-10.5, 3, 10.5], ctx.rng);
  f.model('notice_board', { x: 3.2, z: 7.5, rotY: -0.3 });
  sidewalkTrees(f, ctx.rng);
  return h;
};

const market: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, '#e2d6bd');
  const h = shop(f, 'market_hall', 0, -2.5, 1.35);
  f.sign(t('sign.market'), 3.4, 0.9, { z: -2.35, y: 4.3 }, { bg: '#e34b4b' });
  // two rows of stalls leading to the hall
  for (const x of [-7.5, 7.5]) {
    for (const z of [1.5, 6.5]) f.model('market_stall', { x, z, rotY: x < 0 ? Math.PI / 2 : -Math.PI / 2, scale: 1.1 });
  }
  f.model('street_kiosk', { x: 0, z: 9.2, rotY: Math.PI, scale: 1.1 });
  streetKit(f, 10.8, [-10, -4, 4, 10], ctx.rng);
  return h;
};

const mall: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, PAVING);
  const h = shop(f, 'mall', 0, 7.2, 1.05);
  f.sign(t('sign.mall'), 6, 1.2, { z: 7.35, y: 7.6 }, { bg: '#f08a4b' });
  f.model('bus_stop', { x: 8.5, z: 10.6, rotY: Math.PI, scale: 1.1 });
  streetKit(f, 10.6, [-10, -5, 4], ctx.rng);
  return h;
};

const cafe: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, PAVING);
  shop(f, 'cafe', -8, 4, 1.4);
  f.sign(t('sign.cafe'), 3, 0.8, { x: -8, z: 4.15, y: 3.3 }, { bg: '#8a5a2b' });
  shop(f, 'filler_food_bakery', -0.5, 4, 1.25);
  f.sign(t('sign.bakery'), 3.2, 0.8, { x: -0.5, z: 4.15, y: 3.4 }, { bg: '#e46f8e' });
  const h = shop(f, 'supermarket', 7.5, 0, 0.8);
  f.sign(t('sign.grocery'), 4.4, 0.9, { x: 7.5, z: 0.15, y: 3.9 }, { bg: '#4c9a44' });
  for (const x of [-10, -6]) f.model('cafe_set', { x, z: 8.4, scale: 1.15, solid: false });
  f.model('delivery_van', { x: 7.5, z: 6.5, rotY: Math.PI / 2, scale: 1.3 });
  flowerBed(f, 2.5, 8, 3, 1.6, ctx.rng);
  streetKit(f, 10.8, [-3, 11], ctx.rng);
  return h;
};

/* ----------------------------- Banking ------------------------------ */

const bank: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, PAVING);
  for (let i = 0; i < 3; i++) f.box(22 - i, 0.4, 20 - i, '#d9cdb2', { y: i * 0.4, z: -1 + i * -0.2 });
  f.facade(19, 11, 13, '#ece3cf', { y: 1.2, z: -3 }, 5.5, 3.6);
  for (let i = 0; i < 6; i++) f.cyl(0.55, 0.62, 9.6, '#fbf7ee', { x: -7.5 + i * 3, z: 5.2, y: 1.2 }, 12);
  f.box(20, 1.4, 16, '#e6dcc4', { y: 12.2, z: -1.2 });
  f.gable(20.4, 3.2, 3.4, '#e6dcc4', { y: 13.6, z: 5.3 });
  f.box(20.4, 0.5, 13, '#d9cdb2', { y: 13.6, z: -3 });
  f.sign(t('sign.bank'), 5, 1.2, { z: 6.82, y: 12.9 }, { bg: '#e6dcc4', fg: '#7a5a12' });
  // gold coin emblem
  f.cyl(1.4, 1.4, 0.3, '#e7b83c', { y: 14.9, z: 7.05, rotX: Math.PI / 2 }, 20);
  for (const x of [-10.5, 10.5]) streetLamp(f, x, 9, Math.PI);
  sidewalkTrees(f, ctx.rng);
  return 18;
};

const officeTower: LotBuilder = (f, ctx) => {
  const rng = ctx.rng;
  lotGround(f, 24, 24, PAVING);
  const h1 = 24 + rng() * 14;
  const glass = pick(['#5d86b8', '#4f9bb5', '#6c7fb0', '#7d9cc0'], rng);
  f.box(11, h1, 11, glass, { x: -5, z: -4 }, 'glass');
  for (let y = 3.6; y < h1; y += 3.6) f.box(11.3, 0.3, 11.3, '#e9eef4', { x: -5, z: -4, y });
  roofUnits(f, -5, -4, h1, 11, 11, rng);
  const h2 = 14 + rng() * 10;
  f.facade(8, h2, 9, pick(['#e8e1d6', '#d9e2ea', '#efe3d1'], rng), { x: 6.5, z: 2 }, 3.4, 2.8);
  roofUnits(f, 6.5, 2, h2, 8, 9, rng);
  for (const x of [-9, -2]) tree(f, x, 9, 0.9, rng);
  bench(f, -5.5, 9.5, Math.PI);
  return Math.max(h1, h2) + 2;
};

const portfolioHQ: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, '#e2e6ec');
  f.facade(20, 8, 18, '#2a3550', { z: -1 }, 4, 3.5);
  const H = 44;
  f.box(14, H, 14, '#3d5a8a', { z: -1, y: 8 }, 'glass');
  for (let y = 8; y < 8 + H; y += 4.4) f.box(14.4, 0.35, 14.4, '#d8c27a', { z: -1, y });
  f.box(10, 8, 10, '#4a6ca3', { z: -1, y: 8 + H }, 'glass');
  const top = 8 + H + 8;
  f.box(10.6, 0.5, 10.6, '#d8c27a', { z: -1, y: top });
  // golden crown
  f.geo(new THREE.OctahedronGeometry(3.4, 0).scale(1, 1.7, 1), '#e7b83c', { z: -1, y: top + 5.2 }, 'glass');
  const halo = new THREE.Mesh(new THREE.TorusGeometry(5.8, 0.2, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffd96b' }));
  halo.rotation.x = Math.PI / 2;
  f.place(halo, { z: -1, y: top + 1.2 });
  ctx.addAnimator((time) => {
    halo.position.y = f.baseY + top + 1.2 + Math.sin(time * 1.2) * 0.4;
  });
  f.sign(t('sign.portfolio'), 9, 1.6, { z: 8.07, y: 5.5 }, { bg: '#1f2a44', fg: '#ffd96b' });
  for (const x of [-10, 10]) palm(f, x, 10, 1);
  return top + 11;
};

/* ---------------------------- Real estate --------------------------- */

const PASTELS = ['#ead7bd', '#efe4c9', '#d8c3a5', '#e3cdb6', '#d6d0c4', '#e9d2b8'];

const apartments: LotBuilder = (f, ctx) => {
  const rng = ctx.rng;
  lotGround(f, 24, 24, GRASS);
  let top = 0;
  const spots: [number, number][] = [[-6, -5], [6, -5], [-6, 6]];
  for (const [x, z] of spots) {
    const floors = 5 + Math.floor(rng() * 4);
    const h = floors * 3.2;
    top = Math.max(top, h);
    f.facade(9, h, 8, pick(PASTELS, rng), { x, z }, 3.2, 3);
    for (let fl = 1; fl < floors; fl++) {
      for (const bx of [-2.2, 2.2]) {
        f.box(2.6, 0.2, 1.2, '#f4f4f4', { x: x + bx, z: z + 4.6, y: fl * 3.2 });
        f.box(2.6, 0.9, 0.08, '#cfd6dd', { x: x + bx, z: z + 5.15, y: fl * 3.2 + 0.2 }, 'glass');
      }
    }
    solarHeater(f, x - 2, z, h);
    solarHeater(f, x + 2, z, h);
  }
  flowerBed(f, 6, 6, 6, 4, rng);
  bench(f, 6, 10, Math.PI);
  return top + 3;
};

const houses: LotBuilder = (f, ctx) => {
  const rng = ctx.rng;
  lotGround(f, 24, 24, GRASS);
  const roofs = ['#c4553f', '#a9472f', '#7a4b3a', '#5d6b7a'];
  for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]] as [number, number][]) {
    f.box(10.5, 0.6, 0.3, '#ffffff', { x, z: z + 5.2 }); // picket fence
    f.facade(7, 4.4, 6, pick(PASTELS, rng), { x, z: z - 0.5 }, 4.4, 2.4);
    f.gable(7.6, 2.4, 6.8, pick(roofs, rng), { x, z: z - 0.5, y: 4.4 });
    f.box(0.9, 1.8, 0.9, '#8a6a5a', { x: x + 2, z: z - 1.5, y: 5 });
    f.box(1.2, 2.2, 0.15, '#7a5236', { x, z: z + 2.55 });
    tree(f, x + 4, z + 3, 0.7, rng);
  }
  car(f, -1.5, 4.5, 0, pick(CAR_COLORS, rng));
  return 8;
};

const construction: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, '#b9a68a');
  fence(f, 23.5, 23.5, '#e8b53a', 5);
  const floors = 5;
  for (let fl = 0; fl <= floors; fl++) {
    const y = fl * 3.2;
    if (fl < floors) f.box(14, 0.35, 10, '#c9c4bb', { x: -3, z: -3, y });
    for (const cx of [-9.5, -3, 3.5]) for (const cz of [-7.5, -3, 1.5]) if (fl < floors) f.box(0.5, 3.2, 0.5, '#a9a49b', { x: cx, z: cz, y });
  }
  f.facade(14, 6.4, 10, '#e7ddcf', { x: -3, z: -3 }, 3.2, 3);
  // crane: mast, then a slewing jib that slowly turns
  const mx = 7;
  const mz = -6;
  for (let y = 0; y < 30; y += 2) f.box(1.2, 2, 1.2, '#f2c14e', { x: mx, z: mz, y });
  const jib = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.6 });
  const arm = new THREE.Mesh(new THREE.BoxGeometry(22, 0.9, 0.9), yellow);
  arm.position.x = -5;
  const weight = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.6, 1.6), new THREE.MeshStandardMaterial({ color: '#6b7280' }));
  weight.position.set(5, -0.4, 0);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  cab.position.set(0.6, -0.9, 0);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 10, 4), new THREE.MeshStandardMaterial({ color: '#333333' }));
  cable.position.set(-13, -5, 0);
  const load = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: '#8a6a4a' }));
  load.position.set(-13, -10.2, 0);
  for (const m of [arm, weight, cab, cable, load]) {
    m.castShadow = true;
    jib.add(m);
  }
  f.place(jib, { x: mx, z: mz, y: 30.5 });
  ctx.addAnimator((time) => {
    jib.rotation.y = Math.sin(time * 0.15) * 1.3 + 0.6;
  });
  // material piles
  for (let i = 0; i < 4; i++) f.cyl(0.3, 0.3, 4, '#8a6a4a', { x: 5 + i * 0.65, z: 7, y: 0.3, rotZ: Math.PI / 2 }, 6);
  f.box(3, 1.2, 2, '#d0ccc4', { x: -8, z: 8 });
  f.sign(t('sign.forSale'), 5, 1.4, { z: 11.9, y: 1.8 }, { bg: '#e46f8e' });
  return 32;
};

const realEstateAgency: LotBuilder = (f, ctx) => {
  const rng = ctx.rng;
  lotGround(f, 24, 24, GRASS);
  shopFront(f, -3, 5, 12, 9, 2, '#fff4e8', '#e46f8e', t('sign.realEstate'));
  f.facade(7, 9.6, 8, pick(PASTELS, rng), { x: 7.5, z: -5 }, 3.2, 3);
  f.gable(7.6, 2.4, 8.6, '#c4553f', { x: 7.5, z: -5, y: 9.6 });
  for (const [x, z] of [[-9, 9], [9, 6]] as [number, number][]) {
    f.box(0.15, 2.2, 0.15, '#7a5236', { x, z });
    f.sign(t('sign.forSale'), 2.4, 1, { x, z: z + 0.1, y: 2.4 }, { bg: '#ffffff', fg: '#e46f8e', border: '#e46f8e' });
  }
  sidewalkTrees(f, rng);
  return 13;
};

/* ----------------------------- Industry ----------------------------- */

const factory: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, '#bdbdb5');
  f.box(22, 8, 15, '#c9ccd1', { z: -3.5 });
  // sawtooth roof
  for (let i = 0; i < 5; i++) {
    const x = -8.8 + i * 4.4;
    f.box(4.4, 0.25, 4.6, '#9aa3ad', { x: x + 0.3, z: -3.5, y: 9.4, rotZ: -0.5 });
    f.box(0.2, 2.2, 15, '#bfe3ff', { x: x + 2.1, z: -3.5, y: 8 }, 'glass');
  }
  f.box(22, 0.3, 15, '#9aa3ad', { z: -3.5, y: 8 });
  // chimneys
  for (const [x, z] of [[-7, -9], [-3, -9]] as [number, number][]) {
    f.cyl(0.9, 1.2, 18, '#e8e8e8', { x, z }, 12);
    for (let y = 12; y < 18; y += 3) f.cyl(0.95, 0.95, 1.2, '#e34b4b', { x, z, y }, 12);
    smoke(ctx, x + f.ox, f.baseY + 18.5, z + f.oz, '#cfd3d8');
  }
  f.box(8, 5, 0.2, '#5d6670', { x: 3, z: 4.05 });
  f.sign(t('sign.factory'), 8, 1.3, { x: -5, z: 4.12, y: 5.6 }, { bg: '#9aa3ad', fg: '#1f2a44' });
  truck(f, 6, 9, Math.PI / 2, '#3d7be0');
  return 20;
};

const warehouses: LotBuilder = (f) => {
  lotGround(f, 24, 24, '#c2c2ba');
  const colors = ['#d4dbe3', '#e7d7c1'];
  for (let k = 0; k < 2; k++) {
    const z = -6.5 + k * 11;
    f.box(22, 5.5, 8.5, colors[k], { z });
    f.geo(new THREE.CylinderGeometry(4.25, 4.25, 22, 16, 1, false, -Math.PI / 2, Math.PI), colors[k], { z, y: 5.5, rotZ: Math.PI / 2 });
    for (let i = 0; i < 4; i++) f.box(3, 3.5, 0.15, '#5d6670', { x: -8 + i * 5.3, z: z + 4.3 });
  }
  f.sign(t('sign.logistics'), 6, 1.2, { z: -2.1, y: 4.2 }, { bg: '#3d7be0' });
  truck(f, -6, 11, Math.PI / 2, '#e34b4b');
  return 10;
};

const containerYard: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, '#b5b2a8');
  const colors = ['#e34b4b', '#3d7be0', '#f2c14e', '#4fc79a', '#f08a4b', '#7d8ea3'];
  const rng = ctx.rng;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const stack = 1 + Math.floor(rng() * 3);
      for (let s = 0; s < stack; s++) {
        f.box(6.6, 2.6, 2.5, pick(colors, rng), { x: -7 + c * 7, z: -9 + r * 4.2, y: s * 2.6 });
      }
    }
  }
  // gantry crane
  for (const x of [-11, 11]) for (const z of [7, 10.5]) f.box(0.7, 10, 0.7, '#f2c14e', { x, z });
  f.box(23, 1, 4.2, '#f2c14e', { z: 8.75, y: 10 });
  f.box(2.4, 1.6, 2.4, '#ffffff', { x: 2, z: 8.75, y: 8.4 });
  return 12;
};

const workshop: LotBuilder = (f, ctx) => {
  lotGround(f, 24, 24, '#c9bf9f');
  f.box(14, 6, 10, '#b5583f', { z: -4 });
  f.gable(14.4, 3, 10.6, '#5d4a3d', { z: -4, y: 6 });
  f.box(4, 4, 0.15, '#6b4a2f', { x: -3, z: 1.05 });
  f.sign(t('sign.workshop'), 5, 1.1, { x: 3, z: 1.1, y: 4 }, { bg: '#6b4a2f' });
  for (let i = 0; i < 6; i++) f.cyl(0.35, 0.35, 5, '#a9774a', { x: 4 + (i % 3) * 0.75, z: 6 + Math.floor(i / 3) * 0.7, y: 0.35 + Math.floor(i / 3) * 0.6, rotX: Math.PI / 2 }, 7);
  truck(f, -6, 7, 0, '#4fc79a');
  bin(f, 9, 2);
  sidewalkTrees(f, ctx.rng);
  return 10;
};

export const LOT_BUILDERS: Partial<Record<LotType, LotBuilder>> = {
  techHQ,
  dataCenter,
  startupHub,
  techCampus,
  hospital,
  lab,
  pharmacy,
  fitness,
  windFarm,
  solarField,
  battery,
  energyHQ,
  pizzeria,
  market,
  mall,
  cafe,
  bank,
  officeTower,
  portfolioHQ,
  apartments,
  houses,
  construction,
  realEstateAgency,
  factory,
  warehouses,
  containerYard,
  workshop,
};

/** Landmark lots get permanent labels; everything else is a business. */
export const LANDMARK_LOT_TYPES: LotType[] = ['bank', 'portfolioHQ'];
