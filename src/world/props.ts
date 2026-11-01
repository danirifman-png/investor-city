import * as THREE from 'three';
import { Frame } from './Frame';
import type { BuildContext } from './types';
import { pickTreeKind, type TreeKind } from './Trees';

/** Reusable street furniture and small set pieces, all batched. */

const FOLIAGE = ['#4f7d38', '#5a8a3c', '#46703a', '#6b8f45', '#3f6633'];
const BLOSSOM = ['#f2a7c3', '#f6d36b', '#e97a5f'];

/**
 * In the city a tree is recorded for the realistic tree layer (Trees.ts) and the
 * simple tree is drawn into that kind's fallback batch; returns the frame to draw in.
 */
function treeSpot(f: Frame, x: number, z: number, kind: TreeKind, scale: number, rotY: number): Frame {
  const t = f.ctx.trees;
  if (!t) return f;
  const w = f.world({ x, z });
  t.spots.push({ kind, x: w.x!, y: w.y!, z: w.z!, scale, rotY });
  // the trunk stays solid whichever tree is shown
  f.ctx.batch.solid({ x0: w.x! - 0.3, z0: w.z! - 0.3, x1: w.x! + 0.3, z1: w.z! + 0.3, bottom: w.y!, top: w.y! + 3, water: false });
  return new Frame({ ...f.ctx, batch: t.batch[kind] }, f.ox, f.oz, f.rot, f.baseY);
}

export function tree(f0: Frame, x: number, z: number, scale = 1, rng: () => number = Math.random): void {
  // lush, round, storybook trees: a cluster of soft blobs on a short trunk
  const s = scale * (0.85 + rng() * 0.4);
  const kind = pickTreeKind(rng());
  // model heights: plane 7 m, olive 5 m, cypress 8 m; the simple tree is about 5.8 m at s = 1
  const f = treeSpot(f0, x, z, kind, s * (kind === 'olive' ? 1.1 : kind === 'cypress' ? 0.85 : 0.9), rng() * Math.PI * 2);
  const trunkH = 2.0 * s;
  f.cyl(0.2 * s, 0.32 * s, trunkH + 0.6 * s, '#7a5434', { x, z }, 7);
  f.ctx.batch.noCollision(() => {
    const color = rng() < 0.04 ? BLOSSOM[Math.floor(rng() * BLOSSOM.length)] : FOLIAGE[Math.floor(rng() * FOLIAGE.length)];
    const light = new THREE.Color(color).offsetHSL(0.02, 0.05, 0.08);
    const y = trunkH + 1.4 * s;
    f.sphere(1.75 * s, color, { x, z, y }, 10);
    const n = 4 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng();
      const r = 1.15 * s;
      f.sphere((0.95 + rng() * 0.35) * s, i % 2 ? light : color, { x: x + Math.sin(a) * r, z: z + Math.cos(a) * r, y: y + (rng() - 0.3) * 0.9 * s }, 8);
    }
    f.sphere(1.05 * s, light, { x: x + 0.2 * s, z: z - 0.1 * s, y: y + 1.35 * s }, 8);
  });
}

/** Mediterranean palm: tall trunk and drooping fronds. */
export function palm(f0: Frame, x: number, z: number, s = 1): void {
  const f = treeSpot(f0, x, z, 'palm', s * 0.85, (x * 7 + z * 3) % 6.28);
  const h = 6.5 * s;
  f.cyl(0.22 * s, 0.32 * s, h, '#8b6a45', { x, z }, 6);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    f.box(0.5 * s, 0.08 * s, 3.2 * s, '#3f9a48', {
      x: x + Math.sin(a) * 1.4 * s,
      z: z + Math.cos(a) * 1.4 * s,
      y: h - 0.3 * s,
      rotY: a,
      rotX: 0.45,
    });
  }
  f.sphere(0.45 * s, '#6b4f32', { x, z, y: h }, 6);
}

export function streetLamp(f: Frame, x: number, z: number, rotY = 0): void {
  // a classic town lantern: fluted base, slim post, glass lantern with a cap
  void rotY;
  const IRON = '#262b33';
  f.cyl(0.32, 0.4, 0.7, IRON, { x, z }, 8);
  f.cyl(0.09, 0.13, 4.2, IRON, { x, z, y: 0.7 }, 8);
  f.cyl(0.22, 0.12, 0.25, IRON, { x, z, y: 4.85 }, 8);
  f.ctx.batch.noCollision(() => {
    f.cyl(0.26, 0.2, 0.75, '#ffe7a8', { x, z, y: 5.1 }, 6, 'glow');
    f.cyl(0, 0.38, 0.4, IRON, { x, z, y: 5.85 }, 6);
    f.sphere(0.08, '#d9b45a', { x, z, y: 6.3 }, 6);
  });
}

export function bench(f: Frame, x: number, z: number, rotY = 0): void {
  f.box(1.8, 0.12, 0.55, '#a36b3c', { x, z, y: 0.45, rotY });
  const bx = x - Math.sin(rotY) * 0.25;
  const bz = z - Math.cos(rotY) * 0.25;
  f.box(1.8, 0.45, 0.1, '#a36b3c', { x: bx, z: bz, y: 0.6, rotY });
  f.box(1.6, 0.45, 0.4, '#3a3f46', { x, z, rotY });
}

export function bin(f: Frame, x: number, z: number): void {
  f.cyl(0.28, 0.24, 0.85, '#2e7d5b', { x, z }, 8);
}

export function car(f: Frame, x: number, z: number, rotY: number, color: THREE.ColorRepresentation): void {
  const dx = Math.sin(rotY);
  const dz = Math.cos(rotY);
  f.box(1.9, 0.9, 4.2, color, { x, z, y: 0.35, rotY });
  f.box(1.7, 0.75, 2.2, '#28364a', { x: x - dx * 0.2, z: z - dz * 0.2, y: 1.25, rotY }, 'glass');
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const px = x + Math.cos(rotY) * side * 0.85 + dx * end * 1.35;
      const pz = z - Math.sin(rotY) * side * 0.85 + dz * end * 1.35;
      f.cyl(0.38, 0.38, 0.3, '#1d1f24', { x: px, z: pz, y: 0.38, rotZ: Math.PI / 2, rotY }, 8);
    }
  }
}

export function truck(f: Frame, x: number, z: number, rotY: number, color: THREE.ColorRepresentation): void {
  const dx = Math.sin(rotY);
  const dz = Math.cos(rotY);
  f.box(2.4, 2.8, 6, '#eef1f4', { x: x - dx * 1.2, z: z - dz * 1.2, y: 0.6, rotY });
  f.box(2.4, 2.2, 2.2, color, { x: x + dx * 2.9, z: z + dz * 2.9, y: 0.6, rotY });
  f.box(2.2, 0.9, 0.1, '#28364a', { x: x + dx * 4.0, z: z + dz * 4.0, y: 2.0, rotY }, 'glass');
}

export function flowerBed(f: Frame, x: number, z: number, w: number, d: number, rng: () => number): void {
  f.box(w, 0.4, d, '#8a6a4a', { x, z });
  f.box(w - 0.3, 0.1, d - 0.3, '#5f9a3f', { x, z, y: 0.4 });
  const n = Math.max(3, Math.round(w * d * 0.6));
  const colors = ['#ff6b8a', '#ffd84d', '#ffffff', '#b07cff', '#ff9e3d'];
  for (let i = 0; i < n; i++) {
    f.sphere(0.22, colors[Math.floor(rng() * colors.length)], {
      x: x + (rng() - 0.5) * (w - 0.6),
      z: z + (rng() - 0.5) * (d - 0.6),
      y: 0.6,
    }, 5);
  }
}

export function umbrellaTable(f: Frame, x: number, z: number, color: THREE.ColorRepresentation): void {
  f.cyl(0.6, 0.6, 0.08, '#f4f4f4', { x, z, y: 0.75 }, 10);
  f.cyl(0.05, 0.05, 2.3, '#cfcfcf', { x, z }, 5);
  f.cyl(0.02, 1.4, 0.55, color, { x, z, y: 2.1 }, 8);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    f.box(0.4, 0.45, 0.4, '#6b4a2f', { x: x + Math.sin(a) * 0.95, z: z + Math.cos(a) * 0.95 });
  }
}

/** Ground slab that fills a lot's interior. */
export function lotGround(f: Frame, w: number, d: number, color: THREE.ColorRepresentation): void {
  f.box(w, 0.08, d, color, {});
}

/** Simple fence around a rectangle with an opening on the front (+z). */
export function fence(f: Frame, w: number, d: number, color: THREE.ColorRepresentation, gap = 6): void {
  const h = 1.6;
  f.box(w, h, 0.12, color, { z: -d / 2 });
  f.box(0.12, h, d, color, { x: -w / 2 });
  f.box(0.12, h, d, color, { x: w / 2 });
  const side = (w - gap) / 2;
  f.box(side, h, 0.12, color, { x: -w / 2 + side / 2, z: d / 2 });
  f.box(side, h, 0.12, color, { x: w / 2 - side / 2, z: d / 2 });
}

/* ---------------------------------------------------------------- */
/* Animated set pieces                                              */
/* ---------------------------------------------------------------- */

export function windTurbine(f: Frame, x: number, z: number, height: number, speed: number): void {
  f.cyl(0.45, 0.85, height, '#f3f5f7', { x, z }, 10);
  f.box(1.1, 1.1, 2.6, '#e9edf1', { x, z: z - 0.3, y: height });
  const rotor = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat);
  rotor.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.7, 10.5, 0.18);
  bladeGeo.translate(0, 5.4, 0);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(bladeGeo, mat);
    blade.rotation.z = (i / 3) * Math.PI * 2;
    blade.castShadow = true;
    rotor.add(blade);
  }
  f.place(rotor, { x, z: z + 1.1, y: height + 0.55 });
  const phase = Math.random() * Math.PI;
  f.ctx.addAnimator((t) => {
    rotor.rotation.z = phase + t * speed;
  });
}

let smokeTexture: THREE.Texture | null = null;
function getSmokeTexture(): THREE.Texture {
  if (smokeTexture) return smokeTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  smokeTexture = new THREE.CanvasTexture(c);
  return smokeTexture;
}

/** Rising puffs from a chimney (CPU particles, tiny count). */
export function smoke(ctx: BuildContext, x: number, y: number, z: number, color = '#d9dde2', count = 14): void {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size: 3.2,
    map: getSmokeTexture(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  ctx.dynamic.add(points);
  const life = Array.from({ length: count }, (_, i) => i / count);
  ctx.addAnimator((_, dt) => {
    for (let i = 0; i < count; i++) {
      life[i] += dt * 0.18;
      if (life[i] > 1) life[i] -= 1;
      const l = life[i];
      pos[i * 3] = x + Math.sin(i * 12.9 + l * 3) * l * 1.6 + l * 2.5;
      pos[i * 3 + 1] = y + l * 9;
      pos[i * 3 + 2] = z + Math.cos(i * 7.3 + l * 2) * l * 1.2;
    }
    geo.attributes.position.needsUpdate = true;
  });
}

/** A blinking light (aviation beacon, server LEDs). */
export function beacon(f: Frame, x: number, y: number, z: number, color: string, period = 1.2, r = 0.35): void {
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
  f.place(mesh, { x, y, z });
  const offset = Math.random() * period;
  f.ctx.addAnimator((t) => {
    mesh.visible = ((t + offset) % period) < period * 0.5;
  });
}
