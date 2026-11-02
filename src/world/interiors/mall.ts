import * as THREE from 'three';
import { ESCALATOR, ESCALATORS, MALL } from '../../content/mall';
import { t } from '../../i18n';
import type { Frame } from '../Frame';
import type { BuildContext } from '../types';

/**
 * The mall: shop fronts around a bright ground floor, a gallery along the back
 * on the upper floor, and two moving escalators between them. The steps are
 * real collision stairs (12 steps of 0.3 m); the game carries the player along
 * them (Game.rideEscalator) and the yellow step edges move to show it.
 */

const SLOPE = Math.atan2(MALL.upper, ESCALATOR.zBottom - ESCALATOR.zTop);
const RUN = ESCALATOR.zBottom - ESCALATOR.zTop;

/** A shop front against a wall: a coloured frame, a glass window, a sign and a bit of stock. */
function shopFront(f: Frame, ctx: BuildContext, x: number, z: number, rotY: number, y: number, sign: string, color: string, stock: (s: Frame) => void): void {
  const s = f.sub(x, z, rotY, y);
  // the shop's own back room (solid), its frame and the window
  s.box(4.2, 3.1, 0.4, color, { z: -1.4 });
  s.box(0.25, 3.1, 1.6, color, { x: -2.0, z: -0.6 });
  s.box(0.25, 3.1, 1.6, color, { x: 2.0, z: -0.6 });
  ctx.batch.noCollision(() => {
    s.box(4.2, 0.5, 0.3, color, { z: 0.15, y: 2.6 });
    s.box(1.2, 2.2, 0.05, '#bfe6ff', { x: -1.3, z: 0.1, y: 0.2 }, 'glass');
    s.box(1.2, 2.2, 0.05, '#bfe6ff', { x: 1.3, z: 0.1, y: 0.2 }, 'glass');
  });
  s.sign(sign, 3.4, 0.42, { z: 0.32, y: 2.85 }, { bg: color, fg: '#ffffff' });
  stock(s);
}

export function buildMallInterior(f: Frame, ctx: BuildContext): void {
  const { w, upper, edge } = MALL;
  const backZ = -MALL.d / 2;
  const deep = edge - backZ;

  // ------------------------------ upper floor ------------------------------
  f.box(w, 0.3, deep, '#ece7df', { z: (backZ + edge) / 2, y: upper - 0.3 });
  ctx.batch.noCollision(() => {
    // a coloured band along the edge and a soft underside
    f.box(w, 0.45, 0.12, '#f08a4b', { z: edge - 0.02, y: upper - 0.5 });
    f.box(w, 0.04, deep, '#f6f2ec', { z: (backZ + edge) / 2, y: upper - 0.34 });
  });
  // columns holding it up
  for (const x of [-9.5, 9.5, 0]) f.cyl(0.28, 0.28, upper - 0.3, '#f6f2ec', { x, z: edge - 0.5 }, 16);
  // glass railing with openings for the escalators
  const gaps = ESCALATORS.map((e) => [e.x - ESCALATOR.width / 2 - 0.1, e.x + ESCALATOR.width / 2 + 0.1]).sort((a, b) => a[0] - b[0]);
  let from = -w / 2;
  for (const [g0, g1] of [...gaps, [w / 2, w / 2]]) {
    const len = g0 - from;
    if (len > 0.2) {
      const cx = (from + g0) / 2;
      f.box(len, 1.0, 0.06, '#cfe9ff', { x: cx, z: edge + 0.05, y: upper }, 'glass');
      ctx.batch.noCollision(() => f.box(len, 0.07, 0.12, '#c7ccd3', { x: cx, z: edge + 0.05, y: upper + 1.0 }));
    }
    from = g1;
  }

  // ------------------------------ escalators -------------------------------
  const tread = RUN / ESCALATOR.steps;
  const rise = upper / ESCALATOR.steps;
  for (const e of ESCALATORS) {
    for (let i = 1; i <= ESCALATOR.steps; i++) {
      f.box(ESCALATOR.width, i * rise, tread, '#5b636d', { x: e.x, z: ESCALATOR.zBottom - (i - 0.5) * tread });
    }
    const midZ = (ESCALATOR.zBottom + ESCALATOR.zTop) / 2;
    const len = Math.hypot(RUN, upper) + 0.6;
    ctx.batch.noCollision(() => {
      // the metal sides, the glass balustrades and the black handrails
      for (const side of [-1, 1]) {
        const sx = e.x + side * (ESCALATOR.width / 2 + 0.06);
        f.box(0.1, 0.55, len, '#c7ccd3', { x: sx, z: midZ, y: upper / 2 - 0.3, rotX: SLOPE });
        f.box(0.04, 0.85, len - 0.4, '#d9f0ff', { x: sx, z: midZ, y: upper / 2 + 0.25, rotX: SLOPE }, 'glass');
        f.box(0.1, 0.08, len - 0.2, '#1d1f24', { x: sx, z: midZ, y: upper / 2 + 1.1, rotX: SLOPE });
      }
      // landing plates at both ends
      f.box(ESCALATOR.width + 0.2, 0.03, 0.9, '#a7adb5', { x: e.x, z: ESCALATOR.zBottom + 0.45 });
      f.box(ESCALATOR.width + 0.2, 0.03, 0.7, '#a7adb5', { x: e.x, z: ESCALATOR.zTop - 0.35, y: upper });
    });
    // collision rails so nobody steps off the side halfway up
    for (const side of [-1, 1]) {
      const sx = f.ox + e.x + side * (ESCALATOR.width / 2 + 0.06);
      ctx.batch.solid({ x0: sx - 0.06, x1: sx + 0.06, z0: f.oz + ESCALATOR.zTop, z1: f.oz + ESCALATOR.zBottom, bottom: 0, top: upper + 1.2, water: false });
    }
    f.sign(t(e.dir === 'up' ? 'room.mall.up' : 'room.mall.down'), 1.1, 0.3, { x: e.x, z: ESCALATOR.zBottom + 0.95, y: 2.3 }, { bg: '#2b3446', fg: '#ffd96b' });
    // moving step edges
    const edges: THREE.Mesh[] = [];
    const mat = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
    for (let i = 0; i < ESCALATOR.steps; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ESCALATOR.width - 0.05, 0.03, 0.05), mat);
      edges.push(m);
      ctx.dynamic.add(m);
    }
    const sign = e.dir === 'up' ? 1 : -1;
    ctx.addAnimator((time) => {
      for (let i = 0; i < edges.length; i++) {
        const s = (((i / edges.length + (sign * time * ESCALATOR.speed) / RUN) % 1) + 1) % 1;
        // the nosing of a step: snap to the stair so the edges ride on the treads
        const k = Math.min(ESCALATOR.steps, Math.floor(s * ESCALATOR.steps) + 1);
        edges[i].position.set(f.ox + e.x, k * rise + 0.02, f.oz + ESCALATOR.zBottom - (k - 1) * tread - (s * ESCALATOR.steps - (k - 1)) * tread);
      }
    });
  }

  // ------------------------------ shops ------------------------------------
  const L = -w / 2 + 1.6;
  const R = w / 2 - 1.6;
  // ground floor, left wall: fashion and toys
  shopFront(f, ctx, L, 1.5, Math.PI / 2, 0, t('room.mall.fashion'), '#e46f8e', (s) => {
    for (const x of [-1, 0, 1]) s.cyl(0.18, 0.22, 1.3, '#f4d7e0', { x, z: -0.7 }, 10);
  });
  shopFront(f, ctx, L, 6.5, Math.PI / 2, 0, t('room.mall.toys'), '#7a5cff', (s) => {
    s.box(1.2, 0.8, 0.6, '#ffd23f', { x: -0.8, z: -0.8 });
    s.sphere(0.3, '#ff6b6b', { x: 0.9, z: -0.8, y: 0.3 });
  });
  // ground floor, right wall: the food court and sports
  shopFront(f, ctx, R, 1.5, -Math.PI / 2, 0, t('room.mall.food'), '#f08a4b', (s) => {
    s.box(3.2, 1.0, 0.6, '#fff4e4', { z: -0.75 });
  });
  shopFront(f, ctx, R, 6.5, -Math.PI / 2, 0, t('room.mall.sports'), '#35b37e', (s) => {
    s.cyl(0.35, 0.35, 0.06, '#222', { x: -0.6, z: -0.8, y: 0.4, rotX: Math.PI / 2 }, 16);
    s.cyl(0.35, 0.35, 0.06, '#222', { x: 0.6, z: -0.8, y: 0.4, rotX: Math.PI / 2 }, 16);
  });
  // under the gallery: the old elevator with no button for the top floor
  f.box(2.2, 3.1, 0.4, '#8a94a3', { x: -7, z: backZ + 0.25 });
  ctx.batch.noCollision(() => {
    f.box(1.6, 2.4, 0.05, '#c9d1dc', { x: -7, z: backZ + 0.48 }, 'glass');
    f.box(0.02, 2.4, 0.06, '#5b636d', { x: -7, z: backZ + 0.5 });
  });
  f.sign(t('room.mall.lift'), 1.8, 0.35, { x: -7, z: backZ + 0.52, y: 2.7 }, { bg: '#2b3446', fg: '#ffffff' });
  // upper floor, along the back wall: home & furniture and the arcade
  shopFront(f, ctx, -6.5, backZ + 1.6, 0, upper, t('room.mall.home'), '#4aa3df', (s) => {
    s.box(1.6, 0.45, 0.7, '#8fb8c9', { x: -0.6, z: -0.8 });
  });
  shopFront(f, ctx, 6.5, backZ + 1.6, 0, upper, t('room.mall.fun'), '#ff7a45', (s) => {
    s.box(0.7, 1.6, 0.6, '#3b3f8f', { x: -0.9, z: -0.8 });
    s.box(0.7, 1.6, 0.6, '#8f3b6e', { x: 0.2, z: -0.8 });
  });
  // a bench and plants on the gallery
  f.model('planter', { x: 0, z: backZ + 2.6, y: upper });
  f.model('ficus_plant_pot', { x: -11.5, z: edge - 1, y: upper });
  f.model('ficus_plant_pot', { x: 11.5, z: edge - 1, y: upper });

  // ------------------------------ the middle -------------------------------
  // a round fountain with benches, a kiosk and plants
  f.cyl(1.5, 1.6, 0.5, '#e8e2d8', { x: 0, z: 4 }, 28);
  ctx.batch.noCollision(() => f.cyl(1.3, 1.3, 0.05, '#6fc3e8', { x: 0, z: 4, y: 0.48 }, 28, 'water'));
  f.cyl(0.18, 0.25, 1.1, '#e8e2d8', { x: 0, z: 4, y: 0.5 }, 12);
  f.model('bistro_table_chairs', { x: -4.5, z: 7, scale: 0.9 });
  f.model('bistro_table_chairs', { x: 4.5, z: 7, scale: 0.9 });
  for (const x of [-11.6, 11.6]) f.model('ficus_plant_pot', { x, z: 8.8 });
  f.model('trash_bin', { x: 8.5, z: 8.6 });
  // a big sign over the gallery
  f.sign(t('sign.mall'), 6, 1.2, { z: backZ + 0.3, y: upper + 3.0 }, { bg: '#f08a4b' });
  // lights for the upper floor and the atrium
  for (const x of [-7, 7]) {
    const light = new THREE.PointLight('#fff4e4', 14, 16, 1.4);
    light.position.set(f.ox + x, upper + 2.8, f.oz + backZ + 3);
    ctx.dynamic.add(light);
  }
  const atrium = new THREE.PointLight('#fff4e4', 16, 22, 1.3);
  atrium.position.set(f.ox, 6.5, f.oz + 3);
  ctx.dynamic.add(atrium);
}
