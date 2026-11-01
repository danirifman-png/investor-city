import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Block, CollisionWorld } from './Collision';

/**
 * Collects static geometry per material and merges it into a handful of
 * meshes. A whole city of thousands of boxes ends up as ~5 draw calls, which
 * is what keeps the game smooth on phones. Per-object colour is stored as a
 * vertex colour, so one material serves every building.
 */
export type MaterialKey = 'paint' | 'glass' | 'facade' | 'glow' | 'water' | 'tower' | 'roof';

const tmpColor = new THREE.Color();
const WHITE = new THREE.Color('#ffffff');
/** Real building colours: limestone, sandstone, brick, render and concrete. */
const PASTELS = ['#d9cbb3', '#c9b394', '#e4dccd', '#b86a4f', '#d6d1c7', '#cdb08c', '#e8dfcf', '#a99a88'];
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const tmpScale = new THREE.Vector3(1, 1, 1);
const tmpPos = new THREE.Vector3();

export interface Placement {
  x?: number;
  y?: number;
  z?: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
}

export class Batcher {
  private parts = new Map<MaterialKey, THREE.BufferGeometry[]>();
  private collide = true;
  private box3 = new THREE.Box3();

  /** Every added piece also registers its bounds here (see Collision.ts). */
  constructor(private collision?: CollisionWorld) {}

  /** Collision only, nothing drawn (water edges, bridge walkways). */
  solid(b: Block): void {
    this.collision?.add(b);
  }

  /** Adds geometry without collision (foliage, flowers, decorations). */
  noCollision(fn: () => void): void {
    const prev = this.collide;
    this.collide = false;
    try {
      fn();
    } finally {
      this.collide = prev;
    }
  }

  /** Adds a geometry (ownership is taken) with a colour and placement. */
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, mat: MaterialKey = 'paint', p: Placement = {}): void {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    tmpEuler.set(p.rotX ?? 0, p.rotY ?? 0, p.rotZ ?? 0);
    tmpQuat.setFromEuler(tmpEuler);
    tmpPos.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    g.applyMatrix4(tmpMatrix);
    if (this.collision && this.collide && mat !== 'glow') {
      const b = this.box3.setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);
      this.collision.add({ x0: b.min.x, z0: b.min.z, x1: b.max.x, z1: b.max.z, bottom: b.min.y, top: b.max.y, water: mat === 'water' });
    }

    tmpColor.set(color);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    let list = this.parts.get(mat);
    if (!list) this.parts.set(mat, (list = []));
    list.push(g);
  }

  /** Box whose bottom sits at `y` (more natural for buildings). */
  box(w: number, h: number, d: number, color: THREE.ColorRepresentation, p: Placement = {}, mat: MaterialKey = 'paint'): void {
    this.add(new THREE.BoxGeometry(w, h, d), color, mat, { ...p, y: (p.y ?? 0) + h / 2 });
  }

  /** Cylinder whose bottom sits at `y`. */
  cyl(rTop: number, rBottom: number, h: number, color: THREE.ColorRepresentation, p: Placement = {}, seg = 12, mat: MaterialKey = 'paint'): void {
    this.add(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, mat, { ...p, y: (p.y ?? 0) + h / 2 });
  }

  /** Spheres are decorative (foliage, fruit, flowers) and never collide. */
  sphere(r: number, color: THREE.ColorRepresentation, p: Placement = {}, seg = 10, mat: MaterialKey = 'paint'): void {
    this.noCollision(() => this.add(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))), color, mat, p));
  }

  /**
   * Gable roof with its ridge along the x axis: two tiled slopes (UVs in
   * metres, so the tiles keep their size) and two plain gable ends.
   */
  gable(w: number, h: number, d: number, color: THREE.ColorRepresentation, p: Placement = {}): void {
    const half = d / 2;
    const slope = Math.hypot(half, h);
    const tilt = Math.atan2(half, h);
    for (const side of [1, -1]) {
      const geo = new THREE.PlaneGeometry(w, slope);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 2, (uv.getY(i) * slope) / 2);
      geo.rotateX(-tilt);
      geo.translate(0, h / 2, half / 2);
      if (side < 0) geo.rotateY(Math.PI);
      this.add(geo, color, 'roof', p);
    }
    const end = new THREE.Shape();
    end.moveTo(-half, 0);
    end.lineTo(half, 0);
    end.lineTo(0, h);
    end.closePath();
    for (const side of [1, -1]) {
      const geo = new THREE.ShapeGeometry(end);
      geo.rotateY(side * (Math.PI / 2));
      geo.translate((side * w) / 2, 0, 0);
      this.noCollision(() => this.add(geo, color, 'paint', p));
    }
  }

  /**
   * Building body with a repeating window texture. UVs are scaled so one
   * texture tile covers 4 bays x 4 floors regardless of the box size.
   */
  facade(w: number, h: number, d: number, color: THREE.ColorRepresentation, p: Placement = {}, floorH = 3.4, bayW = 3.2): void {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each).
    const faceWidths = [d, d, 0, 0, w, w];
    for (let face = 0; face < 6; face++) {
      for (let v = 0; v < 4; v++) {
        const i = face * 4 + v;
        if (face === 2 || face === 3) {
          uv.setXY(i, 0.01, 0.01); // roof/floor sample a plain wall pixel
        } else {
          uv.setXY(i, (uv.getX(i) * faceWidths[face]) / bayW / 4, (uv.getY(i) * h) / floorH / 4);
        }
      }
    }
    // tall buildings are blue glass towers (like the skyline of the reference art); low ones are storybook houses
    const tower = h > 24;
    if (tower) {
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.2, uv.getY(i) * 2.6);
    }
    // plain grey or white houses get a storybook pastel (picked by position, so it is stable)
    let tint: THREE.ColorRepresentation = color;
    if (!tower) {
      const c = tmpColor.set(color);
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      if (hsl.s < 0.18) {
        const k = Math.abs(Math.floor((p.x ?? 0) * 7.3 + (p.z ?? 0) * 3.1 + h * 11)) % PASTELS.length;
        tint = PASTELS[k];
      }
    }
    this.add(geo, tower ? '#ffffff' : tint, tower ? 'tower' : 'facade', { ...p, y: (p.y ?? 0) + h / 2 });
    if (!tower && h > 2.5) {
      // a stone cornice and a slim coping where the wall meets the roof
      const stone = tmpColor.set(tint).lerp(WHITE, 0.55).getHex();
      this.noCollision(() => {
        this.add(new THREE.BoxGeometry(w + 0.34, 0.3, d + 0.34), stone, 'paint', { ...p, y: (p.y ?? 0) + h - 0.42 });
        this.add(new THREE.BoxGeometry(w + 0.12, 0.16, d + 0.12), stone, 'paint', { ...p, y: (p.y ?? 0) + h - 0.1 });
      });
    }
  }

  build(materials: Record<MaterialKey, THREE.Material>): THREE.Group {
    const group = new THREE.Group();
    group.name = 'static-city';
    for (const [key, list] of this.parts) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) throw new Error(`Failed to merge geometry for ${key}`);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, materials[key]);
      mesh.name = `batch-${key}`;
      mesh.castShadow = key !== 'water' && key !== 'glow';
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}
