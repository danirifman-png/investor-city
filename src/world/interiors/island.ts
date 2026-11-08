import * as THREE from 'three';
import { ISLAND_ENTRY, ISLAND_PLANE_DOOR } from '../../content/interiors';
import { t } from '../../i18n';
import { loadGltf } from '../../character/AvatarNpc';
import type { Frame } from '../Frame';
import type { BuildContext } from '../types';
import { RoomTreasure, type SkySpot } from './skyLand';

/**
 * Adventure Island: the holiday you fly to from the mall's travel agency. A
 * round tropical island in an endless sea: the plane parked on the beach, a
 * path to a smoking volcano you climb ring by ring to a treasure chest, a
 * pirate shipwreck on the east beach, a little village with a coconut stand
 * and palm trees all round. Room coordinates: x across, +z toward the plane.
 */

/** The land: sand out to `r`, grass inside `grass`. */
export const ISLAND = { r: 30, grass: 19 };
/** The volcano's rings, from the foot up: each one jump higher than the last. */
export const VOLCANO = { x: 0, z: -13, rings: [10, 8.4, 6.8, 5.2, 3.6], step: 1.0 };
export const volcanoTop = () => VOLCANO.rings.length * VOLCANO.step;
/** The shipwreck on the east beach: hull centre, half sizes and deck height. */
export const SHIP = { x: 23.2, z: 0, hw: 1.5, hd: 4.6, deck: 1.3 };
/** The plane parked on the south beach (fuselage centre; it points along +x). */
export const PLANE = { x: 0, z: ISLAND_PLANE_DOOR.z + 2.0, y: 1.9, len: 12, r: 1.25 };
export const ISLAND_CHEST = { id: 'islChest', coins: 20 };

/** Solid ground for a round thing, as slabs that stay inside the circle (an AABB of a disc has walkable corners). */
function discSolid(f: Frame, ctx: BuildContext, x: number, z: number, r: number, bottom: number, top: number, slices = 8): void {
  for (let i = 0; i < slices; i++) {
    const z0 = -r + (2 * r * i) / slices;
    const z1 = -r + (2 * r * (i + 1)) / slices;
    const mid = (z0 + z1) / 2;
    const hw = Math.sqrt(Math.max(0, r * r - mid * mid));
    if (hw < 0.2) continue;
    ctx.batch.solid({ x0: f.ox + x - hw, x1: f.ox + x + hw, z0: f.oz + z + z0, z1: f.oz + z + z1, bottom, top, water: false });
  }
}

export function buildIslandInterior(f: Frame, ctx: BuildContext): void {
  const nc = (fn: () => void) => ctx.batch.noCollision(fn);

  // ------------------------------ sea and land -----------------------------
  nc(() => {
    f.cyl(240, 240, 0.1, '#2f9fd0', { y: -0.45 }, 64, 'water');
    // shallow turquoise water round the beach
    f.cyl(ISLAND.r + 6, ISLAND.r + 8, 0.1, '#5fd4d8', { y: -0.4 }, 64, 'water');
    f.cyl(ISLAND.r, ISLAND.r + 2.2, 0.62, '#f2dca2', { y: -0.62 }, 64);
    f.cyl(ISLAND.grass, ISLAND.grass + 1.2, 0.08, '#79c25a', { y: -0.04 }, 48);
    // a sandy path from the plane to the foot of the volcano
    f.box(2.4, 0.04, 26, '#ead19a', { x: 0, z: 6, y: 0.01 });
  });
  // the sea is not for walking: a ring of water blocks just past the beach
  const RING = 96;
  for (let i = 0; i < RING; i++) {
    const a = (i / RING) * Math.PI * 2;
    const cx = f.ox + Math.cos(a) * (ISLAND.r + 2.1);
    const cz = f.oz + Math.sin(a) * (ISLAND.r + 2.1);
    ctx.batch.solid({ x0: cx - 1.5, x1: cx + 1.5, z0: cz - 1.5, z1: cz + 1.5, bottom: -1, top: 3, water: true });
  }

  // ------------------------------ the volcano ------------------------------
  const rock = ['#8a6a4e', '#7b5d45', '#6d523e', '#5f4737', '#523d30'];
  VOLCANO.rings.forEach((r, i) => {
    const top = (i + 1) * VOLCANO.step;
    nc(() => {
      f.cyl(r, r + 0.5, VOLCANO.step, rock[i], { x: VOLCANO.x, z: VOLCANO.z, y: top - VOLCANO.step }, 28);
      // a green fringe on the lower rings
      if (i < 2) f.cyl(r - 0.1, r - 0.1, 0.05, '#6aa84f', { x: VOLCANO.x, z: VOLCANO.z, y: top }, 28);
    });
    discSolid(f, ctx, VOLCANO.x, VOLCANO.z, r, 0, top);
  });
  const vt = volcanoTop();
  // the crater at the back of the top with glowing lava
  nc(() => {
    f.cyl(1.9, 2.3, 0.7, '#3f2f26', { x: VOLCANO.x, z: VOLCANO.z - 1.6, y: vt }, 20);
    f.cyl(1.5, 1.5, 0.06, '#ff7a1a', { x: VOLCANO.x, z: VOLCANO.z - 1.6, y: vt + 0.66 }, 20, 'glow');
  });
  // lava rivers down the back
  nc(() => {
    for (let i = 0; i < 4; i++) f.box(0.5, 0.05, 1.7, '#ff5a1a', { x: VOLCANO.x + 0.7 * Math.sin(i * 1.7), z: VOLCANO.z - 4.4 - i * 1.6, y: vt - (i + 1) * VOLCANO.step + 0.02 }, 'glow');
  });
  f.sign(t('island.volcano'), 3.4, 0.7, { x: 3.4, z: VOLCANO.z + VOLCANO.rings[0] + 1.6, y: 1.6, rotY: -0.2 }, { bg: '#b23a1a', fg: '#fff3c4' });
  nc(() => f.box(0.14, 1.6, 0.14, '#7a5230', { x: 3.4, z: VOLCANO.z + VOLCANO.rings[0] + 1.55 }));
  // smoke puffs rising out of the crater
  const smokeMat = new THREE.MeshStandardMaterial({ color: '#e9e4e0', roughness: 1, transparent: true, opacity: 0.7, depthWrite: false });
  const puffs = Array.from({ length: 6 }, (_, i) => {
    const m = f.place(new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), smokeMat), { x: VOLCANO.x, z: VOLCANO.z - 1.6, y: vt + 1 });
    m.userData.phase = i / 6;
    return m;
  });
  const base = new THREE.Vector3(f.ox + VOLCANO.x, vt + 0.8, f.oz + VOLCANO.z - 1.6);
  ctx.addAnimator((time) => {
    for (const p of puffs) {
      const k = (time * 0.12 + p.userData.phase) % 1;
      p.position.set(base.x + Math.sin(k * 5 + p.userData.phase * 9) * 0.8 + k * 2, base.y + k * 9, base.z - k * 1.5);
      p.scale.setScalar(0.6 + k * 2.2);
    }
    smokeMat.opacity = 0.55;
  });

  // ------------------------------ the plane --------------------------------
  const P = PLANE;
  const fuse = '#f7f7fb';
  const stripe = '#2f7de1';
  // (Frame.cyl lifts by half its height before turning, so lying cylinders are built as geometry)
  f.geo(new THREE.CylinderGeometry(P.r, P.r, P.len, 20).rotateZ(Math.PI / 2), fuse, { x: P.x, z: P.z, y: P.y });
  nc(() => {
    f.sphere(P.r, fuse, { x: P.x + P.len / 2, z: P.z, y: P.y }, 16);
    f.geo(new THREE.ConeGeometry(P.r, 3, 16).rotateZ(Math.PI / 2), fuse, { x: P.x - P.len / 2 - 1.5, z: P.z, y: P.y });
    // a blue stripe and windows
    f.box(P.len, 0.22, P.r * 2 + 0.04, stripe, { x: P.x, z: P.z, y: P.y - 0.1 });
    for (let i = 0; i < 7; i++) {
      for (const s of [-1, 1]) f.box(0.45, 0.42, 0.06, '#28344a', { x: P.x - 4 + i * 1.4, z: P.z + s * (P.r - 0.02), y: P.y + 0.45 });
    }
    // the cockpit window
    f.box(0.7, 0.4, 1.6, '#28344a', { x: P.x + P.len / 2 + 0.55, z: P.z, y: P.y + 0.55, rotZ: -0.5 });
    // wings, tail fin and tailplane
    f.box(2.6, 0.18, 13, fuse, { x: P.x + 0.6, z: P.z, y: P.y - 0.5 });
    f.box(2.6, 0.04, 0.6, stripe, { x: P.x + 0.6, z: P.z + 6.2, y: P.y - 0.38 });
    f.box(2.6, 0.04, 0.6, stripe, { x: P.x + 0.6, z: P.z - 6.2, y: P.y - 0.38 });
    f.box(2.2, 2.4, 0.2, stripe, { x: P.x - P.len / 2 - 1.6, z: P.z, y: P.y + 0.6, rotZ: 0.35 });
    f.box(1.6, 0.14, 5, fuse, { x: P.x - P.len / 2 - 1.8, z: P.z, y: P.y + 0.3 });
    // engines under the wings
    for (const s of [-1, 1]) f.geo(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 14).rotateZ(Math.PI / 2), '#c9ced8', { x: P.x + 1.2, z: P.z + s * 3.6, y: P.y - 1.0 });
    // wheels
    for (const [x, z] of [[P.x + 4.8, P.z], [P.x - 0.4, P.z - 1.2], [P.x - 0.4, P.z + 1.2]] as const) {
      f.box(0.12, P.y - P.r, 0.12, '#5b636d', { x, z, y: 0.3 });
      f.geo(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 12).rotateX(Math.PI / 2), '#1f2328', { x, z, y: 0.32 });
    }
    // the stairs up to the door
    const D = ISLAND_PLANE_DOOR;
    for (let i = 0; i < 6; i++) f.box(1.2, 0.12, 0.34, '#d7dbe2', { x: D.x, z: D.z + 0.2 + i * 0.13, y: 0.1 + i * 0.3 });
    for (const s of [-1, 1]) f.box(0.06, 0.06, 1.9, '#9aa3ad', { x: D.x + s * 0.62, z: D.z + 0.8, y: 1.6, rotX: -0.95 });
    f.box(0.9, 1.4, 0.08, '#28344a', { x: D.x, z: P.z - P.r + 0.02, y: P.y - 0.3 });
  });
  f.sign(t('island.planeSign'), 2.6, 0.5, { x: ISLAND_PLANE_DOOR.x, z: P.z - P.r - 0.06, y: P.y + 0.85 }, { bg: stripe, fg: '#ffffff' });

  // ------------------------------ the welcome arch -------------------------
  for (const s of [-1, 1]) f.cyl(0.18, 0.22, 3.2, '#8a5a3b', { x: s * 2.5, z: ISLAND_ENTRY.z - 4 }, 10);
  f.sign(t('island.welcome'), 5.4, 0.9, { x: 0, z: ISLAND_ENTRY.z - 4, y: 3.0 }, { bg: '#ff8a3d', fg: '#ffffff' });
  // the holiday budget board beside the path
  f.model('notice_board', { x: 4.2, z: 14.6 });

  // ------------------------------ the village ------------------------------
  const huts: [number, number, string][] = [
    [-17, -1, '#d9b382'],
    [-21, 7, '#e2c08f'],
    [-15.5, 13, '#d4aa77'],
  ];
  for (const [x, z, wall] of huts) {
    f.cyl(1.9, 2.0, 2.2, wall, { x, z }, 14);
    nc(() => {
      f.geo(new THREE.ConeGeometry(2.8, 1.9, 12), '#c9a25a', { x, z, y: 2.2 + 0.95 });
      f.box(0.9, 1.6, 0.1, '#5a3b22', { x: x + 0.6, z: z + 1.95 });
    });
  }
  // the coconut stand
  const C = { x: -11.5, z: 5 };
  f.box(3.2, 1.1, 1.0, '#a8733f', { x: C.x, z: C.z });
  nc(() => {
    f.box(3.3, 0.08, 1.1, '#e8c48c', { x: C.x, z: C.z, y: 1.1 });
    for (const sx of [-1.5, 1.5]) f.box(0.12, 2.6, 0.12, '#7a5230', { x: C.x + sx, z: C.z - 0.4, y: 1.1 });
    ['#ff5d5d', '#ffffff', '#ff5d5d', '#ffffff', '#ff5d5d', '#ffffff'].forEach((c, i) => f.box(0.6, 0.1, 1.8, c, { x: C.x - 1.5 + i * 0.6, z: C.z - 0.1, y: 3.65, rotX: 0.18 }));
    for (let i = 0; i < 5; i++) f.sphere(0.24, i % 2 ? '#6b4a2b' : '#7fb04a', { x: C.x - 1.1 + i * 0.55, z: C.z + 0.1, y: 1.36 }, 10);
    // a straw sticking out of one coconut
    f.box(0.04, 0.5, 0.04, '#ff7aa8', { x: C.x - 0.55, z: C.z + 0.1, y: 1.5, rotZ: 0.3 });
  });
  f.sign(t('island.coconutSign'), 2.4, 0.5, { x: C.x, z: C.z + 0.56, y: 2.6 }, { bg: '#2fae7a', fg: '#ffffff' });
  f.model('barrel', { x: C.x + 2.2, z: C.z + 0.4 });
  f.model('crate_wooden', { x: C.x - 2.3, z: C.z + 0.3 });

  // ------------------------------ the shipwreck ----------------------------
  const S = SHIP;
  const wood = '#6b4a2b';
  f.box(S.hw * 2, S.deck, S.hd * 2, wood, { x: S.x, z: S.z, rotZ: 0.06 });
  nc(() => {
    // a pointed bow, a broken stern and planks
    f.geo(new THREE.ConeGeometry(S.hw * 1.05, 2.4, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).scale(1, 0.6, 1), wood, { x: S.x, z: S.z - S.hd - 1.1, y: S.deck * 0.55 });
    for (let i = 0; i < 5; i++) f.box(S.hw * 2 + 0.06, 0.08, 0.3, '#8a643c', { x: S.x, z: S.z - S.hd + 1 + i * 1.8, y: S.deck + 0.03 });
    f.box(S.hw * 2 + 0.1, 0.5, 0.2, '#4f3520', { x: S.x, z: S.z + S.hd, y: S.deck - 0.1, rotZ: 0.2 });
    // the mast (leaning) and a torn sail
    f.cyl(0.13, 0.16, 6.5, '#5a3b22', { x: S.x, z: S.z - 1, y: S.deck, rotZ: 0.18 }, 8);
    f.box(0.06, 2.6, 3.2, '#efe6d0', { x: S.x - 0.55, z: S.z - 1, y: S.deck + 2.4, rotZ: 0.18 });
    f.box(0.08, 0.08, 3.6, '#5a3b22', { x: S.x - 0.75, z: S.z - 1, y: S.deck + 5.0, rotZ: 0.18 });
    // a pirate flag
    f.box(0.04, 0.7, 1.0, '#1d1f24', { x: S.x - 1.2, z: S.z - 1.5, y: S.deck + 5.6, rotZ: 0.18 });
    f.sphere(0.13, '#ffffff', { x: S.x - 1.24, z: S.z - 1.5, y: S.deck + 6.0 }, 8);
  });
  // crates to climb aboard and the captain's logbook on a barrel
  f.model('crate_wooden', { x: S.x - S.hw - 0.6, z: S.z + 1.6 });
  f.model('barrel', { x: 19.8, z: 3.4 });
  nc(() => f.box(0.5, 0.1, 0.36, '#7a1f1f', { x: 19.8, z: 3.4, y: 0.92, rotY: 0.3 }));

  // ------------------------------ beach life -------------------------------
  const umbrellas: [number, number, string][] = [
    [8, 18, '#ff5d5d'],
    [12, 14, '#ffd84a'],
    [-9, 19, '#4fb6ff'],
  ];
  for (const [x, z, c] of umbrellas) {
    f.cyl(0.06, 0.06, 2.4, '#e8e8e8', { x, z }, 6);
    nc(() => {
      f.geo(new THREE.ConeGeometry(1.6, 0.7, 8), c, { x, z, y: 2.5 });
      f.box(0.9, 0.03, 1.8, c === '#ffd84a' ? '#4fb6ff' : '#ffd84a', { x: x + 1.0, z: z + 0.6, y: 0.01, rotY: 0.3 });
    });
  }
  f.model('sailboat', { x: -44, z: -18, y: -0.4, rotY: 0.6, solid: false });
  f.model('sailboat', { x: 40, z: 30, y: -0.4, rotY: -1.1, scale: 0.8, solid: false });
  // rocks on the beach
  const rocks: [number, number, number][] = [
    [26, -9, 0.9],
    [-25, -10, 1.2],
    [-6, -26, 1.0],
    [17, -20, 0.8],
    [-27, 3, 0.7],
  ];
  nc(() => {
    for (const [x, z, s] of rocks) f.geo(new THREE.DodecahedronGeometry(s, 0).scale(1.3, 0.8, 1), '#8d93a6', { x, z, y: s * 0.4 });
  });
  // flowers in the grass
  nc(() => {
    const petals = ['#ff7aa8', '#ffd84a', '#ffffff', '#ff8a3d'];
    for (let i = 0; i < 40; i++) {
      const a = i * 2.39;
      const r = 4 + ((i * 7) % 14);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.rings[0] + 0.6 || Math.abs(x) < 1.6) continue;
      f.sphere(0.13, petals[i % 4], { x, z, y: 0.1 }, 6);
    }
  });

  // ------------------------------ palm trees -------------------------------
  const palms: [number, number, number][] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.2;
    const r = 24 + (i % 3) * 1.6;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // keep the plane, the ship and the paths clear
    if (Math.hypot(x - PLANE.x, z - PLANE.z) < 9 || Math.hypot(x - S.x, z - S.z) < 6.5) continue;
    palms.push([x, z, 0.85 + (i % 4) * 0.12]);
  }
  palms.push([-19, 2.5, 0.8], [-13, 10, 0.9], [-23, 11, 1.0], [-7.5, 2, 0.75], [9, 4, 0.85], [13, -4, 0.95]);
  for (const [x, z] of palms) ctx.batch.solid({ x0: f.ox + x - 0.25, x1: f.ox + x + 0.25, z0: f.oz + z - 0.25, z1: f.oz + z + 0.25, bottom: 0, top: 6, water: false });
  const grove = f.place(new THREE.Group());
  grove.position.set(f.ox, 0, f.oz);
  void loadGltf('models/meshy/outdoor/palm_tree.glb')
    .then((g) => {
      const box = new THREE.Box3().setFromObject(g.scene);
      const size = box.getSize(new THREE.Vector3());
      const k = 7 / Math.max(0.01, size.y);
      palms.forEach(([x, z, s], i) => {
        const obj = g.scene.clone(true);
        obj.scale.setScalar(k * s);
        obj.position.set(x - ((box.min.x + box.max.x) / 2) * k * s, -box.min.y * k * s, z - ((box.min.z + box.max.z) / 2) * k * s);
        obj.rotation.y = i * 1.3;
        obj.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
        grove.add(obj);
      });
    })
    .catch(() => {
      // simple palms if the model cannot load
      const trunk = new THREE.MeshStandardMaterial({ color: '#8a5a3b' });
      const leaf = new THREE.MeshStandardMaterial({ color: '#3f9a45' });
      for (const [x, z, s] of palms) {
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 6 * s, 8), trunk);
        tr.position.set(x, 3 * s, z);
        const cr = new THREE.Mesh(new THREE.SphereGeometry(1.6 * s, 8, 6).scale(1, 0.4, 1), leaf);
        cr.position.set(x, 6 * s, z);
        grove.add(tr, cr);
      }
    });
}

/* ------------------------------------------------------------------ */
/* Shells of gold and the volcano chest                                */
/* ------------------------------------------------------------------ */

/** Gold coins around the island, in room coordinates (ids start with `isl`). */
export function islandCoins(): SkySpot[] {
  const out: SkySpot[] = [];
  const add = (x: number, z: number, y: number) => out.push({ id: `isl${out.length}`, x, z, y });
  // one on each volcano ring, spiralling up
  VOLCANO.rings.forEach((r, i) => {
    const inner = VOLCANO.rings[i + 1] ?? 0;
    const mid = (r + inner) / 2;
    const a = Math.PI / 2 + i * 0.9;
    add(VOLCANO.x + Math.cos(a) * mid, VOLCANO.z + Math.sin(a) * mid, (i + 1) * VOLCANO.step + 1.0);
  });
  // on the deck of the shipwreck
  for (const dz of [-3, 0, 3]) add(SHIP.x, SHIP.z + dz, SHIP.deck + 1.2);
  // along the beach
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    add(Math.cos(a) * 21.5, Math.sin(a) * 21.5, 1.0);
  }
  // in the village
  add(-18.5, 3.2, 1.0);
  add(-13.5, 15.6, 1.0);
  return out;
}

export class IslandTreasure extends RoomTreasure {
  constructor(ox: number, oz: number) {
    super(ox, oz, { prefix: 'isl', coins: islandCoins(), chest: { id: ISLAND_CHEST.id, x: VOLCANO.x, y: volcanoTop(), z: VOLCANO.z + 1.6, rotY: 0 } });
  }
}
