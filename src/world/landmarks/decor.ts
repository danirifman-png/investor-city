import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DISTRICT_IDS } from '../../content/cityPlan';
import { t } from '../../i18n';
import { HALF_CITY, rectCenter, type ZoneLayout } from '../cityLayout';
import type { Frame } from '../Frame';
import { bench, flowerBed } from '../props';
import type { BuildContext } from '../types';
import { buildRiver, nearRiver, rippleTexture, RIVER } from './river';

/**
 * Set dressing for the vivid world: market stalls, lanterns, bunting, a
 * signpost, hot-air balloons, and the countryside around the city (cliffs,
 * pines, a waterfall, a river with a bridge, sunflowers, glowing market
 * boards on the far bank). Original designs, built from simple shapes so they
 * batch into a few draw calls.
 */

const AWNINGS: [string, string][] = [
  ['#e34b4b', '#fff6e8'],
  ['#3fb6e8', '#fff6e8'],
  ['#4fc79a', '#fff6e8'],
  ['#f5b80f', '#fff6e8'],
  ['#a57cf2', '#fff6e8'],
];
const PRODUCE = ['#e34b4b', '#ff9e3d', '#ffd84d', '#7de38f', '#b07cff', '#ff6b8a'];
const WOOD = '#9a6a3e';
const WOOD_DARK = '#6e4a2a';
/** The waterfall trail north of the city (opened by the first mentor quest). */
export const TRAIL = { x0: -11, x1: 11, z0: -HALF_CITY - 62, z1: -HALF_CITY - 2, gateZ: -HALF_CITY - 9 };

const ROCK = ['#b39ad6', '#a28cc8', '#c3aee0', '#9887c0'];
const GRASS_CAP = ['#79c060', '#8bcf6a', '#6ab455'];
const PINE = ['#2f7a4a', '#3a8a52', '#2a6e44'];

/** A market stall facing local +z: counter, posts, striped awning, crates of produce. */
export function marketStall(f: Frame, rng: () => number, colors = AWNINGS[0]): void {
  const w = 3.4;
  f.box(w, 0.9, 1.2, WOOD, { z: 0.3 });
  f.box(w + 0.1, 0.08, 1.35, WOOD_DARK, { z: 0.3, y: 0.9 });
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) {
    for (const z of [-0.6, 1.0]) f.box(0.12, 2.7, 0.12, WOOD_DARK, { x, z });
  }
  f.box(w, 1.4, 0.1, WOOD, { z: -0.65, y: 0.9 });
  f.ctx.batch.noCollision(() => {
    // striped awning sloping toward the customers
    const n = 7;
    for (let i = 0; i < n; i++) {
      const sw = w / n;
      f.box(sw + 0.01, 0.06, 2.2, colors[i % 2], { x: -w / 2 + sw * (i + 0.5), z: 0.4, y: 2.75, rotX: -0.28 });
    }
    // scalloped edge
    for (let i = 0; i < 9; i++) f.sphere(0.2, colors[0], { x: -w / 2 + (w / 8) * i, z: 1.45, y: 2.38 }, 5);
    // crates and fruit
    for (let i = 0; i < 3; i++) {
      const cx = -1.1 + i * 1.1;
      f.box(0.9, 0.25, 0.7, '#c08a52', { x: cx, z: 0.35, y: 0.98 });
      const fruit = PRODUCE[Math.floor(rng() * PRODUCE.length)];
      for (let k = 0; k < 6; k++) f.sphere(0.13, fruit, { x: cx - 0.3 + (k % 3) * 0.3, z: 0.22 + Math.floor(k / 3) * 0.26, y: 1.3 }, 5);
    }
  });
  // chalkboard with a rising arrow (the market's mood)
  f.box(0.7, 0.9, 0.06, '#2c3a2e', { x: w / 2 + 0.6, z: 1.3, y: 0.15, rotX: -0.15 });
  f.box(0.5, 0.05, 0.02, '#f4f4f4', { x: w / 2 + 0.6, z: 1.34, y: 0.6, rotZ: 0.6 });
  f.box(0.75, 0.08, 0.08, WOOD, { x: w / 2 + 0.6, z: 1.2, y: 0.08 });
}

/** A classic street lantern with a warm glowing globe. */
export function lantern(f: Frame, x: number, z: number): void {
  f.cyl(0.32, 0.4, 0.4, '#24303f', { x, z }, 8);
  f.cyl(0.08, 0.12, 3.6, '#24303f', { x, z }, 8);
  f.cyl(0.3, 0.12, 0.25, '#24303f', { x, z, y: 3.6 }, 8);
  f.ctx.batch.noCollision(() => {
    f.sphere(0.36, '#fff1c4', { x, z, y: 4.15 }, 10, 'glow');
    f.cyl(0.05, 0.32, 0.25, '#24303f', { x, z, y: 4.5 }, 8);
  });
}

/** A string of little flags between two points. */
export function bunting(f: Frame, x0: number, z0: number, x1: number, z1: number, y: number, rng: () => number): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(4, Math.round(len / 0.9));
  const rot = Math.atan2(x1 - x0, z1 - z0);
  const colors = ['#e34b4b', '#ffd84d', '#3fb6e8', '#4fc79a', '#ff9e3d', '#a57cf2'];
  const off = Math.floor(rng() * colors.length);
  f.ctx.batch.noCollision(() => {
    for (let i = 0; i <= n; i++) {
      const t0 = i / n;
      const sag = Math.sin(t0 * Math.PI) * 0.9;
      const x = x0 + (x1 - x0) * t0;
      const z = z0 + (z1 - z0) * t0;
      if (i < n) f.box(0.03, 0.03, len / n, '#f4f4f4', { x: x + ((x1 - x0) / n) * 0.5, z: z + ((z1 - z0) / n) * 0.5, y: y - sag, rotY: rot });
      const flag = new THREE.ConeGeometry(0.22, 0.42, 3).rotateX(Math.PI).rotateY(Math.PI / 6);
      f.geo(flag, colors[(i + off) % colors.length], { x, z, y: y - sag - 0.25, rotY: rot + Math.PI / 2 });
    }
  });
}

export function pine(f: Frame, x: number, z: number, s: number, rng: () => number): void {
  f.cyl(0.2 * s, 0.3 * s, 1.6 * s, '#6e4a2a', { x, z }, 6);
  const c = PINE[Math.floor(rng() * PINE.length)];
  f.ctx.batch.noCollision(() => {
    for (let i = 0; i < 3; i++) f.cyl(0, (2.0 - i * 0.5) * s, (2.6 - i * 0.3) * s, c, { x, z, y: (1.2 + i * 1.5) * s }, 8);
  });
}

function sunflower(f: Frame, x: number, z: number, h: number, rot: number): void {
  f.cyl(0.04, 0.05, h, '#4c9a44', { x, z }, 5);
  f.geo(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 10).rotateX(Math.PI / 2 - 0.3), '#ffcf2e', { x, z, y: h, rotY: rot });
  f.geo(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 8).rotateX(Math.PI / 2 - 0.3), '#6b3f1d', { x: x + Math.sin(rot) * 0.03, z: z + Math.cos(rot) * 0.03, y: h, rotY: rot });
}

/** A signpost of wooden arrows pointing at each district, from where it stands. */
export function signpost(f: Frame, x: number, z: number, layout: ZoneLayout[]): void {
  f.cyl(0.14, 0.16, 4.6, WOOD_DARK, { x, z }, 6);
  f.cyl(0.2, 0.2, 0.2, WOOD_DARK, { x, z, y: 4.6 }, 6);
  const here = f.world({ x, z });
  const targets = DISTRICT_IDS.map((id) => layout.find((l) => l.id === id)!).filter(Boolean);
  targets.slice(0, 5).forEach((zone, i) => {
    const c = rectCenter(zone.rect);
    const ang = Math.atan2(c.x - here.x!, c.z - here.z!);
    // a plank pointing at the district, with its name on both faces
    const y = 4.1 - i * 0.62;
    const sub = f.sub(x, z, ang - f.rot, 0);
    f.ctx.batch.noCollision(() => {
      sub.box(0.12, 0.46, 2.3, WOOD, { z: 1.25, y });
      sub.geo(new THREE.ConeGeometry(0.33, 0.45, 3).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), WOOD, { z: 2.6, y });
    });
    const name = t(`district.${zone.id}.name`);
    const opts = { bg: '#a8743f', fg: '#fff8e6' } as const;
    sub.sign(name, 2.1, 0.38, { x: 0.07, z: 1.25, y, rotY: Math.PI / 2 }, opts);
  });
}

/** Market, lanterns and bunting around the central plaza (local frame centred on the plaza). */
export function plazaMarket(f: Frame, rng: () => number): void {
  const stalls: [number, number, number][] = [
    [-24.5, -2, Math.PI / 2],
    [-24.5, 5, Math.PI / 2],
    [-24.5, 12, Math.PI / 2],
    [24.5, -1, -Math.PI / 2],
    [24.5, 6, -Math.PI / 2],
  ];
  stalls.forEach(([x, z, r], i) => marketStall(f.sub(x, z, r), rng, AWNINGS[i % AWNINGS.length]));
  for (const [x, z] of [[-21, -6], [-21, 16], [21, -5], [21, 10], [-8, 22], [8, 22]]) lantern(f, x, z);
  bunting(f, -21, -6, -21, 16, 4.6, rng);
  bunting(f, 21, -5, 21, 10, 4.6, rng);
  flowerBed(f, -15, -8, 3, 2, rng);
  flowerBed(f, 15, -8, 3, 2, rng);
  bench(f, -19, 3, Math.PI / 2);
  bench(f, 19, 2, -Math.PI / 2);
}

/** Hot-air balloons drifting slowly over the city. */
export function balloons(ctx: BuildContext): void {
  const stripes = (a: string, b: string) => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 8;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? a : b;
      g.fillRect(i * 16, 0, 16, 8);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const sets: [string, string, number, number, number, number][] = [
    ['#e34b4b', '#ffd84d', -60, -40, 58, 90],
    ['#3fb6e8', '#ffffff', 70, 30, 66, 120],
    ['#a57cf2', '#ff9e3d', -20, 80, 50, 70],
    ['#4fc79a', '#ff6b8a', 90, -90, 74, 140],
    // two that hang over the academy, in view from the opening square
    ['#ff7a59', '#fff2c9', 30, -75, 38, 16],
    ['#e85a8a', '#ffd84d', -45, -95, 46, 22],
  ];
  sets.forEach(([a, b, cx, cz, y, r], i) => {
    const g = new THREE.Group();
    const env = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16).scale(1, 1.18, 1), new THREE.MeshStandardMaterial({ map: stripes(a, b), roughness: 0.6 }));
    // basket and ropes in one mesh (two draw calls per balloon)
    const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(1.6, 1.2, 1.6).translate(0, -8.4, 0)];
    for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
      const rope = new THREE.CylinderGeometry(0.05, 0.05, 3.4, 4);
      rope.rotateX(dz * 0.25).rotateZ(-dx * 0.25).translate(dx * 1.6, -6.3, dz * 1.6);
      parts.push(rope);
    }
    const basket = new THREE.Mesh(mergeGeometries(parts.map((p) => p.toNonIndexed())), new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.9 }));
    g.add(env, basket);
    g.name = `balloon-${i}`;
    g.traverse((o) => (o.castShadow = false));
    ctx.dynamic.add(g);
    const speed = 0.012 + i * 0.004;
    ctx.addAnimator((time) => {
      const a0 = time * speed + i * 1.7;
      g.position.set(cx + Math.cos(a0) * r, y + Math.sin(time * 0.3 + i) * 3, cz + Math.sin(a0) * r);
      g.rotation.y = time * 0.05 + i;
    });
  });
}

/** A friendly blimp cruising slowly behind the academy. */
export function blimp(ctx: BuildContext): void {
  const body = new THREE.SphereGeometry(1, 28, 16).scale(9, 3, 3).rotateY(Math.PI / 2);
  const finGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.BoxGeometry(0.25, 2.6, 2.4).translate(0, 2.1, 0).rotateZ((i * Math.PI) / 2).translate(0, 0, -7.6);
    finGeos.push(fin.toNonIndexed());
  }
  const gondola = new THREE.BoxGeometry(1.4, 0.9, 3.2).translate(0, -3.1, 0.6).toNonIndexed();
  const silver = new THREE.MeshStandardMaterial({ color: '#eef2f8', roughness: 0.35, metalness: 0.25 });
  const accent = new THREE.MeshStandardMaterial({ color: '#2f62c9', roughness: 0.5 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(body, silver), new THREE.Mesh(mergeGeometries([...finGeos, gondola]), accent));
  // a gold stripe band around the middle
  const band = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 1.2, 28, 1, true).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f0c143', roughness: 0.4, side: THREE.DoubleSide }));
  g.add(band);
  g.name = 'blimp';
  ctx.dynamic.add(g);
  ctx.addAnimator((time) => {
    const a = time * 0.018;
    g.position.set(Math.sin(a) * 120, 62 + Math.sin(time * 0.4) * 1.5, -150 + Math.cos(a) * 30);
    g.rotation.y = Math.atan2(Math.cos(a) * 120, -Math.sin(a) * 30) ;
  });
}

function boardTexture(seed: number): { tex: THREE.CanvasTexture; draw(time: number): void } {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const pts: number[] = [];
  let v = 0.5;
  for (let i = 0; i < 40; i++) {
    v = Math.min(0.9, Math.max(0.1, v + Math.sin(i * 1.7 + seed) * 0.08 + 0.012));
    pts.push(v);
  }
  return {
    tex,
    draw(time: number) {
      g.fillStyle = '#0b1a3a';
      g.fillRect(0, 0, 512, 256);
      g.strokeStyle = 'rgba(120, 170, 255, 0.18)';
      g.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        g.beginPath();
        g.moveTo(i * 64, 0);
        g.lineTo(i * 64, 256);
        g.stroke();
      }
      const shift = (time * 0.6 + seed) % 1;
      g.strokeStyle = '#4dff9a';
      g.lineWidth = 6;
      g.shadowColor = '#4dff9a';
      g.shadowBlur = 14;
      g.beginPath();
      pts.forEach((p, i) => {
        const x = ((i - shift) / (pts.length - 1)) * 512;
        const y = 236 - p * 200 + Math.sin(time * 2 + i) * 3;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();
      g.shadowBlur = 0;
      tex.needsUpdate = true;
    },
  };
}

/** The countryside around the city: cliffs, pines, sunflowers, a waterfall and a river with a bridge. */
export function countryside(f: Frame, ctx: BuildContext, rng: () => number): void {
  const edge = HALF_CITY;
  const ripples = rippleTexture();
  const waterMat = new THREE.MeshStandardMaterial({ map: ripples, roughness: 0.2, metalness: 0.05, emissive: '#0d5e8c', emissiveIntensity: 0.25 });
  // terraced cliffs on three sides (the south is the river valley)
  for (let i = 0; i < 46; i++) {
    const side = i % 3;
    const along = (rng() - 0.5) * (edge * 2 + 120);
    const out = edge + 55 + rng() * 70;
    const [x, z] = side === 0 ? [along, -out] : side === 1 ? [-out, along] : [out, along];
    if (side === 0 && Math.abs(x) < 45) continue; // keep the waterfall valley open
    cliff(f, x, z, 8 + rng() * 16, 10 + rng() * 14, rng);
  }
  // pines and lush trees between the city and the cliffs
  let placed = 0;
  for (let i = 0; i < 1400 && placed < 190; i++) {
    const x = (rng() - 0.5) * (edge * 2 + 150);
    const z = (rng() - 0.5) * (edge * 2 + 150);
    if (Math.abs(x) < edge + 8 && Math.abs(z) < edge + 8) continue;
    if (nearRiver(x, z, 5)) continue; // the river
    if (Math.abs(x) < 16 && z < -edge && z > TRAIL.z0 - 30) continue; // the waterfall trail
    pine(f, x, z, 1.1 + rng() * 0.9, rng);
    placed++;
  }
  // sunflower fields near the river
  for (let k = 0; k < 6; k++) {
    const fx = -170 + k * 66 + rng() * 20;
    const fz = edge + 40 + rng() * 14;
    for (let i = 0; i < 18; i++) sunflower(f, fx + (rng() - 0.5) * 10, fz + (rng() - 0.5) * 6, 1.3 + rng() * 0.6, Math.PI + (rng() - 0.5) * 0.6);
  }

  // the river around the south and east, with its bridges
  const rz = RIVER.south;
  buildRiver(f, ctx, ripples.clone());
  // glowing market boards on the far bank
  const boards: { draw(t: number): void }[] = [];
  [-46, 0, 46].forEach((x, i) => {
    const b = boardTexture(i * 3.1);
    boards.push(b);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: b.tex, toneMapped: false, fog: false }));
    mesh.rotation.y = Math.PI;
    f.place(mesh, { x: x + 14, z: rz + 26, y: 9 });
    mesh.rotation.y = Math.PI;
    f.box(14.6, 7.6, 0.4, '#1c2440', { x: x + 14, z: rz + 26.3, y: 5.2 });
    f.box(0.5, 6, 0.5, '#1c2440', { x: x + 14, z: rz + 26.4 });
  });
  let last = -1;
  ctx.addAnimator((time) => {
    // redraw a few times a second; the boards are far away
    if (time - last < 0.25) return;
    last = time;
    boards.forEach((b) => b.draw(time));
  });

  // a waterfall pouring from the northern cliffs into a pool, at the end of the trail
  const wx = 0;
  const wz = TRAIL.z0 - 24;
  f.cyl(30, 34, 30, ROCK[0], { x: wx, z: wz - 22, rotY: Math.PI / 14 }, 7);
  f.cyl(31, 31, 1.2, GRASS_CAP[0], { x: wx, z: wz - 22, y: 30, rotY: Math.PI / 14 }, 7);
  f.cyl(16, 20, 12, ROCK[2], { x: wx, z: wz - 26, y: 31, rotY: 0.4 }, 7);
  f.cyl(17, 17, 1, GRASS_CAP[1], { x: wx, z: wz - 26, y: 43, rotY: 0.4 }, 7);
  for (const s of [-1, 1]) {
    f.cyl(14, 17, 18, ROCK[1], { x: wx + s * 30, z: wz - 6, rotY: s }, 7);
    f.cyl(15, 15, 0.8, GRASS_CAP[2], { x: wx + s * 30, z: wz - 6, y: 18, rotY: s }, 7);
  }
  // the trail: a dirt path with fences, from the city's north gate to the pool
  f.box(6, 0.06, TRAIL.z1 - TRAIL.z0, '#d9b98a', { x: 0, z: (TRAIL.z0 + TRAIL.z1) / 2, y: 0.01 });
  for (let z = TRAIL.z0 + 4; z < TRAIL.z1 - 2; z += 4) {
    for (const s of [-1, 1]) {
      f.box(0.18, 1.0, 0.18, WOOD_DARK, { x: s * 4.2, z });
      f.ctx.batch.noCollision(() => f.box(0.1, 0.12, 4, WOOD, { x: s * 4.2, z: z + 2, y: 0.75 }));
    }
  }
  const fallTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#7fd3ff';
    g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.5})`;
      g.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 3, 20 + Math.random() * 50);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(9, 30), new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.92 }));
  f.place(fall, { x: wx, z: wz + 8.6, y: 15 });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(9, 24).rotateX(-Math.PI / 2), waterMat);
  f.place(pool, { x: wx, z: wz + 14, y: 0.05 });
  ctx.addPoi({ id: 'waterfall', key: 'waterfall', zone: 'park', x: wx, z: wz + 14, height: 30, w: 18, d: 18, landmark: false });
  ctx.addAnimator((time) => {
    fallTex.offset.y = time * 0.8;
    ripples.offset.x = time * 0.04;
  });
}

function cliff(f: Frame, x: number, z: number, w: number, h: number, rng: () => number): void {
  // stacked low-poly mesas with grassy tops, like terraced cartoon cliffs
  const steps = 2 + Math.floor(rng() * 2);
  let y = 0;
  let r = w * 0.6;
  for (let i = 0; i < steps; i++) {
    const hh = h * (0.45 + rng() * 0.25) * (i === 0 ? 1 : 0.7);
    const ox = x + (rng() - 0.5) * r * 0.5;
    const oz = z + (rng() - 0.5) * r * 0.5;
    const rot = rng() * Math.PI;
    const seg = 6 + Math.floor(rng() * 3);
    f.cyl(r * 0.86, r, hh, ROCK[Math.floor(rng() * ROCK.length)], { x: ox, z: oz, y, rotY: rot }, seg);
    f.cyl(r * 0.9, r * 0.88, 0.7, GRASS_CAP[Math.floor(rng() * GRASS_CAP.length)], { x: ox, z: oz, y: y + hh, rotY: rot }, seg);
    y += hh;
    r *= 0.62;
  }
}

/** The wooden gate at the city's north edge where the waterfall trail starts. Closed until the trail is unlocked. */
export function trailGate(f: Frame): { setOpen(open: boolean): void } {
  const z = TRAIL.gateZ;
  for (const s of [-1, 1]) f.cyl(0.32, 0.38, 5.2, WOOD_DARK, { x: s * 4.6, z }, 8);
  f.ctx.batch.noCollision(() => f.box(10.4, 0.6, 0.5, WOOD, { z, y: 5.0 }));
  f.sign(t('trail.sign'), 6.4, 0.9, { z: z + 0.27, y: 5.0 }, { bg: '#a8743f', fg: '#fff8e6' });
  f.sign(t('trail.sign'), 6.4, 0.9, { z: z - 0.27, y: 5.0, rotY: Math.PI }, { bg: '#a8743f', fg: '#fff8e6' });
  const mat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.7 });
  const parts: THREE.Object3D[] = [];
  for (const y of [0.7, 1.5]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.32, 0.22), mat);
    parts.push(f.place(bar, { z, y }));
  }
  parts.push(f.sign(t('trail.locked'), 3.6, 0.8, { z: z + 0.2, y: 2.45 }, { bg: '#fff6e8', fg: '#c0392b' }));
  return {
    setOpen(open) {
      parts.forEach((p) => (p.visible = !open));
    },
  };
}

const PLASTER = ['#e8cfa8', '#efe2c4', '#d9b48c', '#c98f6c', '#e6ddd0', '#d7c5a3', '#cbb79b'];
const ROOF = ['#b8583a', '#a64b32', '#c46a45', '#8e4a35', '#6b6f75'];

/**
 * A row of storybook shop houses facing local +z: pastel plaster, a tiled roof
 * with a dormer, a striped awning and a lit shop window at street level.
 */
export function shopRow(f: Frame, rng: () => number, along: number[]): void {
  along.forEach((x, i) => {
    const w = 7.4;
    const h = 7.5 + rng() * 3.5;
    const d = 4.2;
    const col = PLASTER[Math.floor(rng() * PLASTER.length)];
    const roof = ROOF[Math.floor(rng() * ROOF.length)];
    f.box(w, 0.7, d + 0.2, '#d6c7aa', { x, z: 0 });
    f.facade(w, h, d, col, { x, y: 0.7 }, 3.6, 3.7);
    f.box(w + 0.4, 0.35, d + 0.4, '#fff6e6', { x, y: h + 0.7 });
    f.gable(w + 0.6, 2.6 + rng() * 1.2, d + 0.8, roof, { x, y: h + 1.05 });
    // shop front: a glowing window, a door and a striped awning
    f.ctx.batch.noCollision(() => {
      f.box(w * 0.62, 2.0, 0.1, '#ffe9b0', { x: x - 0.6, z: d / 2 + 0.03, y: 1.0 }, 'glow');
      f.box(1.2, 2.4, 0.12, '#6b4a2e', { x: x + w * 0.36, z: d / 2 + 0.04, y: 0.7 });
      const [a, b] = AWNINGS[(i + Math.floor(rng() * 5)) % AWNINGS.length];
      for (let k = 0; k < 7; k++) f.box(w / 7, 0.08, 1.6, k % 2 ? b : a, { x: x - w / 2 + (k + 0.5) * (w / 7), z: d / 2 + 0.8, y: 3.25, rotX: 0.38 });
      f.box(w, 0.25, 0.08, a, { x, z: d / 2 + 1.55, y: 2.95 });
    });
  });
}
