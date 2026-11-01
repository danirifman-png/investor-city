import * as THREE from 'three';
import { HALF_CITY } from '../cityLayout';
import type { Frame } from '../Frame';
import { bench, streetLamp } from '../props';
import type { BuildContext } from '../types';

/**
 * The river that wraps the city on the south and east, with stone bridges.
 *
 * The water itself is solid (the player can't wade in), except under each
 * bridge, where an invisible walkway follows the arch of the Meshy bridge and
 * stone stairs lead up to it from both banks.
 */

/** Centre lines of the two arms and their width. */
export const RIVER = { south: HALF_CITY + 23, east: HALF_CITY + 23, width: 18 };

/** Where the player can walk once the river is in: the city plus the far banks. */
export const RIVER_BOUNDS = { x1: RIVER.east + RIVER.width / 2 + 24, z1: RIVER.south + RIVER.width / 2 + 24 };

export interface Bridge {
  /** Where it crosses: the centre of the bridge. */
  x: number;
  z: number;
  /** Direction of travel across the bridge. */
  along: 'x' | 'z';
}

export const BRIDGES: Bridge[] = [
  { x: -82, z: RIVER.south, along: 'z' },
  { x: 0, z: RIVER.south, along: 'z' },
  { x: 82, z: RIVER.south, along: 'z' },
  { x: RIVER.east, z: -82, along: 'x' },
  { x: RIVER.east, z: 0, along: 'x' },
  { x: RIVER.east, z: 82, along: 'x' },
];

const BRIDGE_SCALE = 1.2;
/** Half the length of the bridge model at this scale. */
const HALF_SPAN = (20.38 / 2) * BRIDGE_SCALE;
/** Half the walkable width of the deck (between the parapets). */
const DECK_HALF = 1.45;
const STAIRS = 8;
const STAIR_RUN = 0.6;
const STONE = '#cdbf9f';
const STONE_DARK = '#a8987a';

/** Height of the bridge deck at `u` metres from its centre (fitted to the model: 3.49 in the middle, 2.82 at the ends). */
export function deckHeight(u: number): number {
  const x = u / BRIDGE_SCALE;
  return (3.49 - 0.0067 * x * x) * BRIDGE_SCALE;
}

export function rippleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3fb4ea';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.35})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 10 + Math.random() * 24, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** True when (x, z) is in the river or on its banks, so scenery stays clear of it. */
export function nearRiver(x: number, z: number, margin = 4): boolean {
  const hw = RIVER.width / 2 + margin;
  const inSouth = Math.abs(z - RIVER.south) < hw && x < RIVER.east + hw;
  const inEast = Math.abs(x - RIVER.east) < hw && z < RIVER.south + hw;
  return inSouth || inEast;
}

export function buildRiver(f: Frame, ctx: BuildContext, ripples: THREE.CanvasTexture): void {
  ripples.needsUpdate = true;
  const hw = RIVER.width / 2;
  const far = 520;
  const waterMat = new THREE.MeshStandardMaterial({ map: ripples, roughness: 0.2, metalness: 0.05, emissive: '#0d5e8c', emissiveIntensity: 0.25 });

  // water: the south arm runs west to the edge of the world, the east arm north
  const southLen = RIVER.east + hw + far;
  const south = new THREE.Mesh(new THREE.PlaneGeometry(southLen, RIVER.width).rotateX(-Math.PI / 2), waterMat);
  f.place(south, { x: RIVER.east + hw - southLen / 2, z: RIVER.south, y: 0.02 });
  const eastLen = RIVER.south - hw + far;
  const eastMat = waterMat.clone();
  eastMat.map = ripples.clone();
  eastMat.map.needsUpdate = true;
  eastMat.map.rotation = Math.PI / 2;
  const east = new THREE.Mesh(new THREE.PlaneGeometry(RIVER.width, eastLen).rotateX(-Math.PI / 2), eastMat);
  f.place(east, { x: RIVER.east, z: RIVER.south - hw - eastLen / 2, y: 0.02 });
  for (const m of [south, east]) m.receiveShadow = true;
  ripples.repeat.set(southLen / 14, 2);
  eastMat.map.repeat.set(eastLen / 14, 2);
  ctx.addAnimator((time) => {
    ripples.offset.x = time * 0.04;
    eastMat.map!.offset.x = time * 0.04;
  });

  // stone embankments along both banks of both arms
  const gaps = (along: 'x' | 'z') => BRIDGES.filter((b) => (along === 'x' ? b.along === 'z' : b.along === 'x')).map((b) => (along === 'x' ? b.x : b.z));
  const runs = (from: number, to: number, cuts: number[], gap: number) => {
    const out: [number, number][] = [];
    let start = from;
    for (const c of [...cuts].sort((a, b) => a - b)) {
      if (c - gap > start) out.push([start, c - gap]);
      start = Math.max(start, c + gap);
    }
    if (to > start) out.push([start, to]);
    return out;
  };
  // the river bed walls (low curbs) and the water's solid edges
  const westEnd = RIVER.east + hw - southLen;
  for (const [a, b] of runs(westEnd, RIVER.east + hw, gaps('x'), DECK_HALF)) {
    const mid = (a + b) / 2;
    const len = b - a;
    for (let x = a; x < b; x += 50) ctx.batch.solid({ x0: x, x1: Math.min(b, x + 50), z0: RIVER.south - hw, z1: RIVER.south + hw, bottom: -1, top: 0.1, water: true });
    for (const side of [-1, 1]) f.box(len, 0.35, 0.7, STONE, { x: mid, z: RIVER.south + side * (hw + 0.35) });
  }
  const northEnd = RIVER.south - hw - eastLen;
  for (const [a, b] of runs(northEnd, RIVER.south - hw, gaps('z'), DECK_HALF)) {
    const mid = (a + b) / 2;
    const len = b - a;
    for (let z = a; z < b; z += 50) ctx.batch.solid({ x0: RIVER.east - hw, x1: RIVER.east + hw, z0: z, z1: Math.min(b, z + 50), bottom: -1, top: 0.1, water: true });
    for (const side of [-1, 1]) f.box(0.7, 0.35, len, STONE, { x: RIVER.east + side * (hw + 0.35), z: mid });
  }
  // the corner where the arms meet
  ctx.batch.solid({ x0: RIVER.east - hw, x1: RIVER.east + hw, z0: RIVER.south - hw, z1: RIVER.south + hw, bottom: -1, top: 0.1, water: true });

  BRIDGES.forEach((b, i) => bridge(f, ctx, b, i));

  // life on the water and the banks
  f.model('sailboat', { x: -40, z: RIVER.south + 2, rotY: 0.1, solid: false });
  f.model('sailboat', { x: RIVER.east - 2, z: 40, rotY: Math.PI / 2 + 0.15, solid: false });
  f.model('sailboat', { x: 130, z: RIVER.south - 3, rotY: Math.PI - 0.2, scale: 0.8, solid: false });
  const ducks: [number, number][] = [[-20, RIVER.south + 4], [-18.8, RIVER.south + 4.6], [-17.9, RIVER.south + 3.7], [RIVER.east + 4, -40], [RIVER.east + 4.8, -39]];
  ducks.forEach(([x, z], k) => f.model('duck', { x, z, rotY: k * 1.3, scale: 1.4, solid: false }));
  // benches and lamps on the city bank, facing the water
  for (const x of [-120, -60, -30, 30, 60, 120]) {
    bench(f, x, RIVER.south - hw - 3, Math.PI);
    if (x % 60 === 0) streetLamp(f, x + 3, RIVER.south - hw - 2.2);
  }
  for (const z of [-120, -50, 40, 120]) {
    bench(f, RIVER.east - hw - 3, z, -Math.PI / 2);
    streetLamp(f, RIVER.east - hw - 2.2, z + 3);
  }
}

function bridge(f: Frame, ctx: BuildContext, b: Bridge, index: number): void {
  // local frame: +u runs across the river, +c across the deck
  const rot = b.along === 'z' ? 0 : Math.PI / 2;
  const L = f.sub(b.x - f.ox, b.z - f.oz, rot);
  // the model's long axis is X: turn it to lie along the frame's z
  L.model('stone_bridge', { rotY: Math.PI / 2, scale: BRIDGE_SCALE, solid: false });
  const world = (u: number, c: number) => L.world({ x: c, z: u });
  // walkway over the arch, in half-metre slices, with parapets on both sides
  for (let u = -HALF_SPAN; u < HALF_SPAN; u += 0.5) {
    const h = deckHeight(u + 0.25);
    const p0 = world(u, -DECK_HALF);
    const p1 = world(u + 0.5, DECK_HALF);
    ctx.batch.solid({ x0: Math.min(p0.x!, p1.x!), x1: Math.max(p0.x!, p1.x!), z0: Math.min(p0.z!, p1.z!), z1: Math.max(p0.z!, p1.z!), bottom: -1, top: h, water: false });
    for (const side of [-1, 1]) {
      const q0 = world(u, side * DECK_HALF);
      const q1 = world(u + 0.5, side * (DECK_HALF + 0.9));
      ctx.batch.solid({ x0: Math.min(q0.x!, q1.x!), x1: Math.max(q0.x!, q1.x!), z0: Math.min(q0.z!, q1.z!), z1: Math.max(q0.z!, q1.z!), bottom: -1, top: h + 1.3, water: false });
    }
  }
  // stone stairs up to each end
  const top = deckHeight(HALF_SPAN);
  const rise = top / STAIRS;
  for (const dir of [-1, 1]) {
    for (let s = 0; s < STAIRS; s++) {
      const hgt = rise * (s + 1);
      const u = dir * (HALF_SPAN + (STAIRS - s - 0.5) * STAIR_RUN);
      L.box(DECK_HALF * 2 + 0.6, hgt, STAIR_RUN, s % 2 ? STONE : STONE_DARK, { z: u });
    }
    // a lamp at the foot of each stair
    for (const side of [-1, 1]) streetLamp(L, side * (DECK_HALF + 1.2), dir * (HALF_SPAN + STAIRS * STAIR_RUN + 0.6));
  }
  if (index === 1) {
    ctx.addPoi({ id: 'riverBridge', key: 'riverBridge', zone: 'park', x: b.x, z: b.z, height: 6, w: 6, d: 26, landmark: false });
  }
}

