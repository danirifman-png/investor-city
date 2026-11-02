import * as THREE from 'three';
import { FountainWater } from '../FountainWater';
import { t } from '../../i18n';
import type { Lot } from '../cityLayout';
import { rectCenter } from '../cityLayout';
import { Frame } from '../Frame';
import { createCanvas, SIGN_FONT } from '../Materials';
import { bench, bin, flowerBed, streetLamp, tree } from '../props';
import type { BuildContext } from '../types';
import { shopRow } from './decor';

/**
 * The opening square, composed after the reference art: a compact, cosy
 * cobbled plaza seen from a low camera. Straight ahead stands the Invest
 * Academy with its arched chart window over a flight of steps; a tiered
 * fountain sits just to the right of the path; a big market stall waits on the
 * left; a lawn with benches and a helper robot on the right; pastel shops line
 * both sides and the glass towers of the city rise behind.
 */

const STONE = '#f3e6cc';
const STONE_DARK = '#dcc9a6';
const TRIM = '#e9a86a';
const GOLD = '#f0c143';
const DOME = '#3f74d8';
const WOOD = '#a8743f';
const WOOD_DARK = '#7a5230';

/** Plaza-local positions shared with other systems (POIs, spawn). */
export const PLAZA = {
  academyZ: -24,
  academyFront: -12,
  fountain: { x: 5.5, z: -1 },
  stall: { x: -11, z: 7 },
  robot: { x: 12.5, z: 6 },
  /** The player's lemonade business, on the east lawn (its back edge stays put as it grows). */
  business: { backX: 22.5, z: 15 },
  /** The playground on the west lawn: a trampoline and a skate ramp that rises toward -X. */
  trampoline: { x: -20, z: 15.5 },
  ramp: { x: -12.2, z: 15.5 },
};

/** Lawn top height in the plaza (world y). */
export const LAWN_Y = 0.5;
/** Trampoline radius, surface height and launch speed (m/s up). */
export const TRAMPOLINE = { r: 1.35, top: LAWN_Y + 0.91, launch: 15 };
export const RAMP = { length: 2.6, width: 1.88, height: 1.2 };

/** Trampoline and skate ramp: models with their own collision (the ramp is a slope of thin steps). */
export function playground(f: Frame, ctx: BuildContext): void {
  const tp = PLAZA.trampoline;
  f.model('trampoline', { x: tp.x, z: tp.z, y: LAWN_Y - 0.3, solid: false });
  const h = 1.15;
  ctx.batch.solid({ x0: tp.x - h, z0: tp.z - h, x1: tp.x + h, z1: tp.z + h, bottom: LAWN_Y, top: TRAMPOLINE.top, water: false });
  const rp = PLAZA.ramp;
  // model front (+Z, the low edge) turned to face +X, toward the path
  f.model('skate_ramp', { x: rp.x, z: rp.z, y: LAWN_Y - 0.3, rotY: Math.PI / 2, solid: false });
  const n = 12;
  const hw = RAMP.width / 2;
  for (let i = 0; i < n; i++) {
    // slice i runs from the low edge (x + L/2) toward the high edge (x - L/2)
    const a = rp.x + RAMP.length / 2 - (i * RAMP.length) / n;
    const top = LAWN_Y + (RAMP.height * (i + 1)) / n;
    ctx.batch.solid({ x0: a - RAMP.length / n, z0: rp.z - hw, x1: a, z1: rp.z + hw, bottom: LAWN_Y, top, water: false });
  }
}

/* ------------------------------------------------------------------ */
/* Textures                                                            */
/* ------------------------------------------------------------------ */

/** Blue stained-glass arch with a gold rising chart (the academy's emblem). */
function chartWindowTexture(): THREE.CanvasTexture {
  const [c, g] = createCanvas(256, 320);
  const sky = g.createLinearGradient(0, 0, 0, 320);
  sky.addColorStop(0, '#2b6fe0');
  sky.addColorStop(1, '#123a8f');
  g.fillStyle = sky;
  g.fillRect(0, 0, 256, 320);
  // soft glow behind the chart
  const glow = g.createRadialGradient(128, 190, 10, 128, 190, 130);
  glow.addColorStop(0, 'rgba(120,200,255,0.55)');
  glow.addColorStop(1, 'rgba(120,200,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 256, 320);
  // bars
  g.fillStyle = '#ffd34d';
  [[52, 238, 40], [96, 214, 64], [140, 186, 92], [184, 150, 128]].forEach(([x, y, h]) => g.fillRect(x, y, 30, h));
  // arrow
  g.strokeStyle = '#ffd34d';
  g.lineWidth = 16;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(44, 214);
  g.lineTo(104, 166);
  g.lineTo(142, 184);
  g.lineTo(206, 108);
  g.stroke();
  g.beginPath();
  g.moveTo(222, 86);
  g.lineTo(178, 96);
  g.lineTo(214, 132);
  g.closePath();
  g.fill();
  // leading of the glass
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 3;
  for (let x = 64; x < 256; x += 64) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 320);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Glowing arched blue doors. */
function doorTexture(): THREE.CanvasTexture {
  const [c, g] = createCanvas(128, 192);
  const grad = g.createLinearGradient(0, 0, 0, 192);
  grad.addColorStop(0, '#7fd0ff');
  grad.addColorStop(1, '#1d5fd0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 192);
  g.strokeStyle = '#0f2f73';
  g.lineWidth = 6;
  g.strokeRect(8, 70, 52, 116);
  g.strokeRect(68, 70, 52, 116);
  g.beginPath();
  g.moveTo(64, 0);
  g.lineTo(64, 192);
  g.stroke();
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo(64, 64);
    g.lineTo(64 + Math.cos(Math.PI + (i * Math.PI) / 4) * 64, 64 + Math.sin(Math.PI + (i * Math.PI) / 4) * 64);
    g.stroke();
  }
  g.fillStyle = '#ffd34d';
  g.fillRect(54, 120, 6, 18);
  g.fillRect(68, 120, 6, 18);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Scrolling price ticker (made-up city companies, no real tickers). */
function tickerTexture(): THREE.CanvasTexture {
  const [c, g] = createCanvas(1024, 64);
  g.fillStyle = '#0d1a3a';
  g.fillRect(0, 0, 1024, 64);
  const items: [string, string, boolean][] = [
    ['פיצה מרקו', '2.4%', true], ['רובוטים', '1.7%', false], ['אנרגיה ירוקה', '3.1%', true],
    ['בנק העיר', '0.6%', true], ['משחקים', '1.2%', false], ['בתי קפה', '0.9%', true],
  ];
  g.font = `700 34px ${SIGN_FONT}`;
  g.textBaseline = 'middle';
  g.direction = 'rtl';
  let x = 1010;
  for (const [name, pct, up] of items) {
    g.fillStyle = '#ffffff';
    g.textAlign = 'right';
    g.fillText(name, x, 33);
    x -= g.measureText(name).width + 12;
    g.fillStyle = up ? '#4be38a' : '#ff6161';
    const label = `${up ? '▲' : '▼'} ${pct}`;
    g.fillText(label, x, 33);
    x -= g.measureText(label).width + 40;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** A rectangle topped by a half circle (an arch), centred on x, base at y=0. */
function archGeometry(w: number, h: number): THREE.ShapeGeometry {
  const r = w / 2;
  const s = new THREE.Shape();
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h - r);
  s.absarc(0, h - r, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  const geo = new THREE.ShapeGeometry(s, 24);
  // planar UVs over the bounding box
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + r) / w, pos.getY(i) / h);
  return geo;
}

function chalkboardTexture(): THREE.CanvasTexture {
  const [c, g] = createCanvas(160, 200);
  g.fillStyle = '#7a5230';
  g.fillRect(0, 0, 160, 200);
  g.fillStyle = '#2f3a33';
  g.fillRect(10, 10, 140, 180);
  g.strokeStyle = '#f4f1e8';
  g.fillStyle = '#f4f1e8';
  g.lineWidth = 5;
  [[30, 150, 22], [62, 130, 42], [94, 104, 68], [126, 76, 96]].forEach(([x, y, h]) => g.strokeRect(x - 10, y, 20, h));
  g.beginPath();
  g.moveTo(22, 120);
  g.lineTo(62, 96);
  g.lineTo(90, 104);
  g.lineTo(132, 46);
  g.stroke();
  g.beginPath();
  g.moveTo(140, 34);
  g.lineTo(116, 42);
  g.lineTo(136, 62);
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Invest Academy                                                      */
/* ------------------------------------------------------------------ */

/** Built in a frame whose origin is the centre of the main block, front +z. */
function investAcademy(f: Frame, ctx: BuildContext): void {
  const D = 12;
  const front = D / 2;
  // plinth
  f.box(30, 1.3, D + 1, STONE_DARK);
  // wings with arched windows and terracotta roofs
  for (const s of [-1, 1]) {
    const x = s * 9;
    f.facade(10, 9, D - 1, '#f6e7c9', { x, y: 1.3, z: -0.5 }, 4.5, 2.5);
    f.box(10.6, 0.6, D - 0.4, STONE, { x, y: 10.3, z: -0.5 });
    f.box(10.2, 0.25, 0.3, TRIM, { x, y: 5.6, z: front - 0.85 });
    f.gable(10.2, 2.6, D - 0.8, '#d0703f', { x, y: 10.9, z: -0.5 });
    // corner tower with a blue dome and a gold tip
    const tx = s * 14.2;
    const tz = front - 1.6;
    f.cyl(2, 2.1, 12.5, STONE, { x: tx, z: tz, y: 1.3 }, 16);
    f.cyl(2.25, 2.25, 0.5, TRIM, { x: tx, z: tz, y: 6.5 }, 16);
    f.cyl(2.3, 2.3, 0.6, STONE_DARK, { x: tx, z: tz, y: 13.8 }, 16);
    f.geo(new THREE.SphereGeometry(2.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), DOME, { x: tx, z: tz, y: 14.4 });
    f.cyl(0, 0.35, 2.4, GOLD, { x: tx, z: tz, y: 16.3 }, 8);
    f.sphere(0.22, GOLD, { x: tx, z: tz, y: 18.8 }, 6);
    // narrow arched windows on the tower
    for (const y of [3.2, 8.4]) f.box(0.9, 2.4, 0.1, '#2f63c4', { x: tx, z: tz + 2.08, y }, 'glow');
  }
  // central pavilion (stands proud of the wings)
  const pz = 1;
  const pw = 10;
  const pd = D + 2;
  f.box(pw, 14, pd, '#fbf0da', { y: 1.3, z: pz - 1 });
  const pf = pz - 1 + pd / 2; // pavilion front face
  // pilasters and twin columns either side of the doors
  for (const s of [-1, 1]) {
    for (const k of [0, 1]) {
      const x = s * (3.4 + k * 1.3);
      f.cyl(0.42, 0.48, 8.6, '#fffaf0', { x, z: pf + 0.7, y: 1.3 }, 12);
      f.box(1, 0.35, 1, STONE, { x, z: pf + 0.7, y: 1.3 });
      f.box(1.05, 0.4, 1.05, STONE, { x, z: pf + 0.7, y: 9.7 });
    }
  }
  f.box(pw + 1.2, 0.9, 2, STONE, { y: 10.1, z: pf + 0.4 });
  f.box(pw + 1.4, 0.3, 2.1, TRIM, { y: 11, z: pf + 0.4 });
  // glowing price ticker across the entablature
  const tickTex = tickerTexture();
  tickTex.repeat.set(0.75, 1);
  const ticker = new THREE.Mesh(new THREE.PlaneGeometry(pw + 0.8, 0.72), new THREE.MeshBasicMaterial({ map: tickTex, toneMapped: false }));
  f.place(ticker, { y: 10.55, z: pf + 1.42 });
  ctx.addAnimator((_, dt) => {
    tickTex.offset.x = (tickTex.offset.x + dt * 0.04) % 1;
  });
  // round-topped pediment framing the chart window
  const arch = new THREE.CylinderGeometry(5.4, 5.4, 1.6, 28, 1, false, -Math.PI / 2, Math.PI);
  arch.rotateX(Math.PI / 2);
  f.geo(arch, STONE, { y: 11.3, z: pf + 0.2 });
  const archTrim = new THREE.TorusGeometry(5.5, 0.32, 6, 28, Math.PI);
  f.geo(archTrim, TRIM, { y: 11.3, z: pf + 1 });
  // the chart window (glowing stained glass) and its stone frame
  const win = new THREE.Mesh(archGeometry(7, 7.6), new THREE.MeshBasicMaterial({ map: chartWindowTexture(), toneMapped: false }));
  f.place(win, { y: 8.6, z: pf + 1.04 });
  const frame = new THREE.TorusGeometry(3.5, 0.3, 6, 24, Math.PI);
  f.geo(frame, GOLD, { y: 12.7, z: pf + 1.05 });
  for (const s of [-1, 1]) f.box(0.5, 4.1, 0.4, GOLD, { x: s * 3.5, y: 8.6, z: pf + 1.05 });
  f.box(7.4, 0.4, 0.5, GOLD, { y: 8.4, z: pf + 1.05 });
  // arched glowing doors
  const door = new THREE.Mesh(archGeometry(3.4, 5.2), new THREE.MeshBasicMaterial({ map: doorTexture(), toneMapped: false }));
  f.place(door, { y: 1.3, z: pf + 0.04 });
  const doorFrame = new THREE.TorusGeometry(1.85, 0.25, 6, 18, Math.PI);
  f.geo(doorFrame, STONE_DARK, { y: 4.8, z: pf + 0.1 });
  // drum, dome and a tall gold spire
  f.cyl(3, 3.2, 2.4, STONE, { y: 15.3, z: -1 }, 20);
  f.cyl(3.3, 3.3, 0.4, TRIM, { y: 17.6, z: -1 }, 20);
  f.geo(new THREE.SphereGeometry(3.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), DOME, { y: 18, z: -1 });
  f.cyl(0.55, 0.7, 1.4, STONE, { y: 20.8, z: -1 }, 10);
  f.cyl(0, 0.5, 3.4, GOLD, { y: 22.2, z: -1 }, 8);
  f.sphere(0.3, GOLD, { y: 25.7, z: -1 }, 6);
  // sign above the doors
  f.sign(t('sign.academyHall'), 6, 1.1, { y: 6.9, z: pf + 1.1 }, { bg: '#16336f', fg: '#ffd34d' });
  // flight of steps up to the doors
  const steps = 6;
  for (let k = 0; k < steps; k++) {
    const h = 1.3 * ((k + 1) / steps);
    f.box(16 - k * 0.4, h, 1.05, k % 2 ? STONE : STONE_DARK, { z: pf + 6 - k });
  }
  // planters with round shrubs along the steps
  for (const s of [-1, 1]) {
    f.box(1.6, 1.0, 5.6, STONE_DARK, { x: s * 8.9, z: pf + 3.2 });
    for (let i = 0; i < 3; i++) f.sphere(0.8, i % 2 ? '#56b047' : '#6cc457', { x: s * 8.9, z: pf + 1.4 + i * 1.8, y: 1.5 }, 8);
    streetLamp(f, s * 8.9, pf + 6.6);
  }
}

/* ------------------------------------------------------------------ */
/* Tiered fountain                                                     */
/* ------------------------------------------------------------------ */

function tieredFountain(f: Frame, ctx: BuildContext): void {
  // basin
  f.cyl(5.6, 5.8, 0.8, STONE_DARK, {}, 36);
  f.cyl(5.2, 5.2, 0.7, '#4fb8ec', { y: 0.15 }, 36, 'water');
  f.cyl(5.65, 5.65, 0.18, STONE, { y: 0.8 }, 36);
  // pedestals and bowls
  f.cyl(0.75, 1.0, 1.9, STONE, { y: 0.8 }, 14);
  f.cyl(2.7, 1.2, 0.6, STONE, { y: 2.3 }, 24);
  f.cyl(2.5, 2.5, 0.12, '#62c6f2', { y: 2.82 }, 24, 'water');
  f.cyl(0.42, 0.55, 1.3, STONE, { y: 2.9 }, 12);
  f.cyl(1.35, 0.6, 0.4, STONE, { y: 4.0 }, 18);
  f.cyl(1.2, 1.2, 0.1, '#7fd6ff', { y: 4.36 }, 18, 'water');
  // moving water: pools, sheets pouring over both bowls, a jet and droplets
  const water = new FountainWater(
    [
      [5.2, 0.87],
      [2.5, 2.95],
      [1.2, 4.47],
    ],
    [
      { rim: 2.72, top: 2.95, land: 0.87, landR: 3.05 },
      { rim: 1.37, top: 4.47, land: 2.95, landR: 1.62 },
    ],
    4.47,
  );
  f.place(water.group);
  ctx.addAnimator((time, dt) => water.update(dt, time));
}

/* ------------------------------------------------------------------ */
/* Big market stall                                                    */
/* ------------------------------------------------------------------ */

const PRODUCE = ['#f28a1e', '#e8432f', '#f6d13a', '#77c043', '#a54bb8'];

/** Frame front (+z) is where customers stand. */
function bigStall(f: Frame, rng: () => number): void {
  const w = 6;
  // counter and back wall
  f.box(w, 1.1, 1.4, WOOD, { z: 0.6 });
  f.box(w + 0.2, 0.12, 1.6, WOOD_DARK, { z: 0.6, y: 1.1 });
  f.box(w, 2.6, 0.2, '#c08a52', { z: -1.6, y: 1.1 });
  for (const x of [-w / 2, w / 2]) {
    f.box(0.22, 3.6, 0.22, WOOD_DARK, { x, z: 1.3 });
    f.box(0.22, 3.9, 0.22, WOOD_DARK, { x, z: -1.6 });
  }
  f.ctx.batch.noCollision(() => {
    // red-and-white striped awning with a scalloped edge
    const n = 10;
    for (let i = 0; i < n; i++) {
      f.box(w / n + 0.01, 0.08, 3.4, i % 2 ? '#ffffff' : '#e84a4a', { x: -w / 2 + (w / n) * (i + 0.5), z: 0.1, y: 3.95, rotX: -0.3 });
    }
    for (let i = 0; i <= 12; i++) f.sphere(0.24, i % 2 ? '#ffffff' : '#e84a4a', { x: -w / 2 + (w / 12) * i, z: 1.75, y: 3.4 }, 6);
    // wooden name board on top
    f.box(3.6, 0.8, 0.15, WOOD_DARK, { z: -1.4, y: 4.6 });
    // shelves with crates of produce
    for (const y of [1.6, 2.5]) {
      f.box(w - 0.4, 0.1, 0.5, WOOD_DARK, { z: -1.3, y });
      for (let i = 0; i < 4; i++) {
        const cx = -2.1 + i * 1.4;
        const fruit = PRODUCE[Math.floor(rng() * PRODUCE.length)];
        for (let k = 0; k < 4; k++) f.sphere(0.15, fruit, { x: cx - 0.3 + k * 0.2, z: -1.25, y: y + 0.2 }, 5);
      }
    }
    // crates on the counter
    for (let i = 0; i < 4; i++) {
      const cx = -2.2 + i * 1.45;
      f.box(1.2, 0.35, 0.95, '#c99a5e', { x: cx, z: 0.6, y: 1.22 });
      const fruit = PRODUCE[(i * 2 + 1) % PRODUCE.length];
      for (let k = 0; k < 6; k++) f.sphere(0.17, fruit, { x: cx - 0.35 + (k % 3) * 0.35, z: 0.42 + Math.floor(k / 3) * 0.36, y: 1.68 }, 6);
    }
    // crates on the ground in front
    for (const [x, z] of [[-3.8, 1.6], [-3.8, 0.2], [3.9, 1.4]]) {
      f.box(1.1, 0.7, 1.0, '#b98549', { x, z });
      const fruit = PRODUCE[Math.floor(rng() * PRODUCE.length)];
      for (let k = 0; k < 4; k++) f.sphere(0.18, fruit, { x: x - 0.22 + (k % 2) * 0.44, z: z - 0.2 + Math.floor(k / 2) * 0.4, y: 0.85 }, 6);
    }
    // hanging lanterns
    for (const x of [-2, 2]) {
      f.cyl(0.02, 0.02, 0.5, '#333', { x, z: 1.2, y: 3.0 }, 4);
      f.cyl(0.18, 0.15, 0.38, '#ffd98a', { x, z: 1.2, y: 2.62 }, 6, 'glow');
    }
  });
  // chalkboard with a rising chart, standing in front
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), new THREE.MeshStandardMaterial({ map: chalkboardTexture(), roughness: 0.9 }));
  f.place(board, { x: 4.2, z: 2.9, y: 0.95, rotX: -0.18, rotY: -0.35 });
  f.box(0.08, 1.6, 0.08, WOOD_DARK, { x: 3.7, z: 2.75, rotZ: 0.1 });
  f.box(0.08, 1.6, 0.08, WOOD_DARK, { x: 4.7, z: 2.6, rotZ: -0.1 });
}

function bull(f: Frame, x: number, z: number): void {
  f.box(3.2, 1.6, 4.5, STONE_DARK, { x, z });
  const y = 1.6;
  f.geo(new THREE.SphereGeometry(1, 10, 8).scale(1.2, 1.0, 1.9), '#9a6a3a', { x, z, y: y + 1.6 });
  f.geo(new THREE.SphereGeometry(0.7, 8, 6).scale(1, 0.9, 1.2), '#9a6a3a', { x, z: z + 1.9, y: y + 1.8 });
  f.cyl(0.08, 0.16, 1.1, '#f1e1b8', { x: x - 0.6, z: z + 2.0, y: y + 2.2, rotZ: 1.0 }, 5);
  f.cyl(0.08, 0.16, 1.1, '#f1e1b8', { x: x + 0.6, z: z + 2.0, y: y + 2.2, rotZ: -1.0 }, 5);
  for (const [lx, lz] of [[-0.7, -1.2], [0.7, -1.2], [-0.7, 1.2], [0.7, 1.2]]) {
    f.cyl(0.25, 0.25, 1.0, '#9a6a3a', { x: x + lx, z: z + lz, y }, 6);
  }
}

/* ------------------------------------------------------------------ */
/* The plaza                                                           */
/* ------------------------------------------------------------------ */

export function buildOpeningPlaza(lot: Lot, ctx: BuildContext, newsTower: (f: Frame, ctx: BuildContext) => void): void {
  const c = rectCenter(lot.rect);
  const f = new Frame(ctx, c.x, c.z, 0, 0.3);
  const rng = ctx.rng;
  // warm flagstone paving (the ground shader adds the stones), a lighter path
  // to the academy, and a ring around the fountain
  f.box(62, 0.08, 62, '#cbb9a2');
  f.box(9, 0.1, 40, '#d2c4b0', { z: 8 });
  f.cyl(8.2, 8.2, 0.11, '#d6cab8', { x: PLAZA.fountain.x, z: PLAZA.fountain.z }, 40);
  // lawns either side with flower borders
  for (const s of [-1, 1]) {
    f.box(13, 0.2, 9, '#6cbf4c', { x: s * 17, z: 15 });
    f.box(13.4, 0.12, 9.4, '#b9a07c', { x: s * 17, z: 15 });
    flowerBed(f, s * 12, 19.2, 3, 0.9, rng);
  }

  investAcademy(f.sub(0, PLAZA.academyZ), ctx);
  tieredFountain(f.sub(PLAZA.fountain.x, PLAZA.fountain.z), ctx);
  bigStall(f.sub(PLAZA.stall.x, PLAZA.stall.z, Math.PI / 2 - 0.25), rng);
  newsTower(f.sub(23, -23), ctx);
  playground(f, ctx);
  bull(f, -13, -6);

  // benches around the fountain ring and on the lawns
  for (const a of [0.6, 1.6, 2.6]) bench(f, PLAZA.fountain.x + Math.sin(a) * 9.4, PLAZA.fountain.z + Math.cos(a) * 9.4, a + Math.PI);
  bench(f, 14, 12, -Math.PI / 2 + 0.3);
  bench(f, -15, 12.5, Math.PI / 2);
  // lamps lining the path
  for (const [x, z] of [[-6, -3], [11.5, 9], [-16, 19], [17, 19.5]]) streetLamp(f, x, z);
  // lush round trees framing the academy and the square
  const trees: [number, number, number][] = [
    [-19, -12, 1.35], [-24, -2, 1.25], [19, -11, 1.3], [26, -4, 1.2],
    [-27, 24, 1.3], [27, 25, 1.25], [-20, 26, 1.1], [20, 27, 1.15],
    [-13, -15, 1.0], [13, -15, 1.0],
  ];
  for (const [x, z, s] of trees) tree(f, x, z, s, rng);
  bin(f, -6.5, 12);
  bin(f, 6.5, 12);
  // pastel shop rows on both sides
  shopRow(f.sub(-30.6, 6, Math.PI / 2), rng, [-12, -4, 4, 12]);
  shopRow(f.sub(30.6, 4, -Math.PI / 2), rng, [-4, 4, 12]);

  const ax = c.x;
  const az = c.z + PLAZA.academyZ;
  ctx.addPoi({ id: 'exchange', key: 'exchange', zone: lot.zone, x: ax, z: az - 2, height: 26, w: 30, d: 18, landmark: true });
  ctx.addPoi({ id: 'newsTower', key: 'newsTower', zone: lot.zone, x: c.x + 23, z: c.z - 23, height: 50, w: 11, d: 11, landmark: true });
  ctx.addPoi({ id: 'plazaMarket', key: 'plazaMarket', zone: lot.zone, x: c.x + PLAZA.stall.x, z: c.z + PLAZA.stall.z, height: 4.5, w: 7, d: 5, landmark: false });
  ctx.addPoi({ id: 'fountain', key: 'fountain', zone: lot.zone, x: c.x + PLAZA.fountain.x, z: c.z + PLAZA.fountain.z, height: 6, w: 12, d: 12, landmark: false });
}
