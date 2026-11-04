import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { t } from '../../i18n';
import type { Lot } from '../cityLayout';
import { rectCenter, rectSize, SIDEWALK } from '../cityLayout';
import { Frame } from '../Frame';
import { buildOpeningPlaza } from './plaza';
import { createCanvas, SIGN_FONT } from '../Materials';
import { beacon, bench, flowerBed, streetLamp, tree } from '../props';
import type { BuildContext } from '../types';

/* ------------------------------------------------------------------ */
/* Central plaza: stock exchange, news tower, coin fountain           */
/* ------------------------------------------------------------------ */

const STONE = '#efe6d2';
const STONE_DARK = '#d9cdb2';
const GOLD = '#e7b83c';

function newsScreenTexture(): { tex: THREE.CanvasTexture; draw: (i: number) => void } {
  const [c, ctx] = createCanvas(512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const headlines = [1, 2, 3, 4].map((i) => t(`news.headline${i}`));
  const draw = (i: number) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#16284d');
    g.addColorStop(1, '#0a1428');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#e8473f';
    ctx.fillRect(0, 0, 512, 56);
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 34px ${SIGN_FONT}`;
    ctx.fillText(t('sign.news'), 492, 30);
    // word-wrap the headline (RTL)
    ctx.font = `700 36px ${SIGN_FONT}`;
    const words = headlines[i % headlines.length].split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > 460 && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
    lines.slice(0, 4).forEach((l, n) => ctx.fillText(l, 492, 96 + n * 44));
    tex.needsUpdate = true;
  };
  draw(0);
  return { tex, draw };
}

function newsTower(f: Frame, ctx: BuildContext): void {
  f.box(8, 0.6, 8, STONE_DARK);
  // a slim storybook clock tower with a spire; the news runs on screens around its top storey
  f.model('news_tower', { y: 0.6 });
  const sy = 0.6 + 22.5;
  const { tex, draw } = newsScreenTexture();
  const screenMat = new THREE.MeshBasicMaterial({ map: tex });
  // four screen faces in one geometry (one draw call)
  const faces = [0, 1, 2, 3].map((i) => {
    const a = (i * Math.PI) / 2;
    const g = new THREE.PlaneGeometry(5, 2.6);
    g.rotateY(a);
    g.translate(Math.sin(a) * 2.95, 0, Math.cos(a) * 2.95);
    return g;
  });
  f.place(new THREE.Mesh(mergeGeometries(faces)!, screenMat), { y: sy });
  let idx = 0;
  let acc = 0;
  ctx.addAnimator((_, dt) => {
    acc += dt;
    if (acc > 5) {
      acc = 0;
      draw(++idx);
    }
  });
  beacon(f, 0, 0.6 + 31.2, 0, '#ff3b3b', 1.4, 0.45);
}

export function buildCentralPlaza(lot: Lot, ctx: BuildContext): void {
  buildOpeningPlaza(lot, ctx, newsTower);
}

/* ------------------------------------------------------------------ */
/* Academy park                                                       */
/* ------------------------------------------------------------------ */

function owlStatue(f: Frame): void {
  f.box(3, 2, 3, STONE_DARK);
  const y = 2;
  f.geo(new THREE.SphereGeometry(1, 14, 10).scale(1.25, 1.55, 1.15), '#8a6a4a', { y: y + 1.6 });
  f.geo(new THREE.SphereGeometry(1, 12, 8).scale(0.85, 1.05, 0.6), '#e9d7b4', { y: y + 1.35, z: 0.65 });
  for (const s of [-1, 1]) {
    f.sphere(0.5, '#ffffff', { x: s * 0.5, y: y + 2.55, z: 0.9 }, 10);
    f.sphere(0.25, '#1d1d1d', { x: s * 0.5, y: y + 2.55, z: 1.3 }, 8);
    f.cyl(0, 0.3, 0.7, '#8a6a4a', { x: s * 0.75, y: y + 3.0, z: 0.1 }, 5);
    f.geo(new THREE.SphereGeometry(1, 8, 6).scale(0.35, 1.0, 0.7), '#6e523a', { x: s * 1.15, y: y + 1.5 });
  }
  f.cyl(0, 0.2, 0.5, '#f0a030', { y: y + 2.05, z: 1.2, rotX: Math.PI / 2 + 0.5 }, 6);
  // graduation cap
  f.box(1.9, 0.12, 1.9, '#1f2a44', { y: y + 3.5, rotY: Math.PI / 4 });
  f.cyl(0.6, 0.6, 0.35, '#1f2a44', { y: y + 3.15 }, 10);
  f.box(0.06, 0.8, 0.06, GOLD, { x: 0.9, y: y + 2.8 });
}

function academy(f: Frame): void {
  for (let i = 0; i < 3; i++) f.box(26 - i * 1.2, 0.45, 16 - i * 1.0, STONE_DARK, { y: i * 0.45, z: 1 });
  f.facade(20, 11, 13, '#f1e4cc', { y: 1.35 }, 3.7, 3.2);
  for (const s of [-1, 1]) {
    f.facade(13, 8.5, 11, '#ead9bb', { x: s * 16.5, y: 0.3, z: -1 }, 4.25, 3.2);
    f.box(13.6, 0.6, 11.6, STONE_DARK, { x: s * 16.5, y: 8.8, z: -1 });
  }
  // portico
  for (let i = 0; i < 6; i++) f.cyl(0.55, 0.62, 8.6, '#fbf7ee', { x: -7.5 + i * 3, z: 8.2, y: 1.35 }, 12);
  f.box(19, 1.5, 4, STONE, { y: 9.9, z: 7.6 });
  f.gable(19.6, 3.2, 4.4, '#e6d9bd', { y: 11.4, z: 7.6 });
  f.sign(t('sign.academy'), 7, 1.4, { z: 9.82, y: 10.65 }, { bg: '#e8dcc2', fg: '#1f2a44' });
  // dome
  f.box(20.6, 0.7, 13.6, STONE_DARK, { y: 12.35 });
  f.cyl(6, 6.4, 2.6, '#f4ead6', { y: 13 }, 24);
  f.geo(new THREE.SphereGeometry(6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#5a8fb8', { y: 15.6 });
  f.cyl(0.9, 1.1, 2.2, '#f4ead6', { y: 21.3 }, 10);
  f.sphere(0.8, GOLD, { y: 24.1 }, 10);
}

export function buildAcademyPark(lot: Lot, ctx: BuildContext): void {
  const c = rectCenter(lot.rect);
  const { w } = rectSize(lot.rect);
  const inner = w - SIDEWALK * 2;
  const f = new Frame(ctx, c.x, c.z, 0, 0.3);
  const rng = ctx.rng;
  f.box(inner, 0.08, inner, '#79b85a');
  // paths
  f.box(4, 0.1, inner, '#e8dcc0', { z: 0 });
  f.box(inner, 0.1, 3.5, '#e8dcc0', { z: 8 });
  f.box(14, 0.1, 6, '#e8dcc0', { z: -8 });
  academy(f.sub(0, -21));
  owlStatue(f.sub(0, -7));
  // pond with island and bridge
  const pond = f.sub(15, 20);
  pond.geo(new THREE.CylinderGeometry(1, 1, 0.3, 32).scale(9, 1, 6.5), '#cfc3a4', { y: -0.05 });
  pond.geo(new THREE.CylinderGeometry(1, 1, 0.32, 32).scale(8.3, 1, 5.8), '#4aa0d8', { y: -0.04 }, 'water');
  pond.geo(new THREE.CylinderGeometry(1, 1.2, 0.5, 16).scale(2, 1, 1.6), '#7bbf5a', { x: 2.5, z: 0.5 });
  tree(pond, 2.6, 0.5, 0.9, rng);
  pond.box(9, 0.3, 1.8, '#a36b3c', { x: -5, z: 0.5, y: 0.45 });
  pond.box(9, 0.6, 0.12, '#7a4f2c', { x: -5, z: -0.35, y: 0.7 });
  pond.box(9, 0.6, 0.12, '#7a4f2c', { x: -5, z: 1.35, y: 0.7 });
  // playground
  const pg = f.sub(-17, 19);
  pg.box(12, 0.12, 9, '#e9b77f');
  pg.box(1.4, 3, 1.4, '#e65b4f', { x: -3, z: -1 });
  pg.box(1.3, 0.15, 5, '#f7c948', { x: -3, z: 2.1, y: 1.6, rotX: 0.55 });
  for (const sx of [1.5, 4.5]) pg.cyl(0.1, 0.1, 3.2, '#4f7fd9', { x: sx, z: -2 }, 6);
  pg.box(3.4, 0.15, 0.15, '#4f7fd9', { x: 3, z: -2, y: 3.1 });
  pg.box(0.8, 0.1, 0.4, '#e65b4f', { x: 2.3, z: -2, y: 1.0 });
  pg.box(0.8, 0.1, 0.4, '#e65b4f', { x: 3.7, z: -2, y: 1.0 });
  pg.cyl(1.4, 1.4, 0.3, '#3fb6e8', { x: 1, z: 2.5, y: 0.3 }, 16);
  // trees scattered in the free areas
  let placed = 0;
  for (let i = 0; i < 160 && placed < 34; i++) {
    const x = (rng() - 0.5) * (inner - 4);
    const z = (rng() - 0.5) * (inner - 4);
    if (z < -6) continue; // academy grounds
    if (Math.abs(x) < 4 || Math.abs(z - 8) < 3.5) continue; // paths
    if (Math.hypot((x - 15) / 10, (z - 20) / 7.5) < 1) continue; // pond
    if (x < -10 && z > 13) continue; // playground
    tree(f, x, z, 1.1, rng);
    placed++;
  }
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) bench(f, s * 3.4, -2 + k * 9 + (k > 0 ? 2 : 0), s > 0 ? -Math.PI / 2 : Math.PI / 2);
    streetLamp(f, s * 3, 4, s > 0 ? -Math.PI / 2 : Math.PI / 2);
    streetLamp(f, s * 3, 22, s > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  flowerBed(f, -9, -6, 5, 2.5, rng);
  flowerBed(f, 9, -6, 5, 2.5, rng);

  ctx.addPoi({ id: 'academy', key: 'academy', zone: lot.zone, x: c.x, z: c.z - 21, height: 25, w: 46, d: 15, landmark: true });
}
