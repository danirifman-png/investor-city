import * as THREE from 'three';
import { loadGltf } from '../character/AvatarNpc';
import { stylizeCanopy, type CanopyStyle } from './treeCanopy';

/** Leaves become soft clumps (palms keep their fronds). */
const CANOPY: Partial<Record<TreeKind, CanopyStyle>> = {
  olive: { cell: 0.27, color: '#8fa864' },
  plane: { cell: 0.3, color: '#6aa84a' },
  cypress: { cell: 0.2, color: '#47804a' },
};

/**
 * Realistic trees for the city. While the city is built, every tree spot is
 * recorded (and a simple batched tree is drawn as the fallback). Then each
 * kind of tree is loaded once and drawn with one instanced mesh per part, so
 * hundreds of detailed trees cost a few draw calls. When a kind has loaded,
 * its fallback trees are hidden.
 */

export type TreeKind = 'plane' | 'olive' | 'cypress' | 'palm';

export interface TreeSpot {
  kind: TreeKind;
  x: number;
  y: number;
  z: number;
  /** 1 is the model's natural height. */
  scale: number;
  rotY: number;
}

/** Model files (metres, origin at the bottom centre). */
const FILES: Record<TreeKind, string> = {
  plane: 'models/meshy/outdoor/tree_plane.glb',
  olive: 'models/meshy/outdoor/tree_olive.glb',
  cypress: 'models/meshy/outdoor/tree_cypress.glb',
  palm: 'models/meshy/outdoor/palm_tree.glb',
};

/** Picks a kind for an ordinary street or park tree. */
export function pickTreeKind(r: number): TreeKind {
  return r < 0.6 ? 'plane' : r < 0.86 ? 'olive' : 'cypress';
}

export class TreeLayer {
  readonly group = new THREE.Group();

  constructor(
    private spots: TreeSpot[],
    /** The batched fallback trees, one group per kind. */
    private fallback: Partial<Record<TreeKind, THREE.Object3D>>,
  ) {
    this.group.name = 'trees';
  }

  get count(): number {
    return this.spots.length;
  }

  /** Loads every kind in use; resolves with the kinds that are now realistic. */
  async load(): Promise<TreeKind[]> {
    const kinds = [...new Set(this.spots.map((s) => s.kind))];
    const done: TreeKind[] = [];
    await Promise.all(
      kinds.map(async (kind) => {
        try {
          const gltf = await loadGltf(FILES[kind]);
          this.instance(kind, gltf.scene);
          const fb = this.fallback[kind];
          if (fb) fb.visible = false;
          done.push(kind);
        } catch {
          // keep the simple trees for this kind
        }
      }),
    );
    return done;
  }

  private instance(kind: TreeKind, scene: THREE.Object3D): void {
    const style = CANOPY[kind];
    if (style) {
      try {
        stylizeCanopy(scene, style);
      } catch {
        // keep the scanned leaves
      }
    }
    // foliage is never metal: a metalness texture turns leaves in shade black
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      m.metalness = 0;
      m.metalnessMap = null;
      m.roughness = 1;
      mesh.material = m;
    });
    this.group.add(instancedCopies(scene, this.spots.filter((s) => s.kind === kind), `trees:${kind}`));
  }
}

export interface Placement3 {
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
}

/** One instanced mesh per part of a model, with a copy at every placement. */
export function instancedCopies(scene: THREE.Object3D, spots: Placement3[], name: string): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  scene.updateMatrixWorld(true);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // bake the part's own transform so each instance only needs its spot
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const im = new THREE.InstancedMesh(geo, mesh.material, spots.length);
    spots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.rotY);
      im.setMatrixAt(i, m.compose(pos.set(s.x, s.y, s.z), q, scl.setScalar(s.scale)));
    });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    g.add(im);
  });
  return g;
}

/* ------------------------------------------------------------------ */
/* Parked cars                                                         */
/* ------------------------------------------------------------------ */

export type CarKind = 'car_sedan' | 'car_hatchback' | 'car_suv';
const CAR_FILES: Record<CarKind, string> = {
  car_sedan: 'models/meshy/outdoor/car_sedan.glb',
  car_hatchback: 'models/meshy/outdoor/car_hatchback.glb',
  car_suv: 'models/meshy/outdoor/car_suv.glb',
};
export const CAR_SIZE: Record<CarKind, [number, number, number]> = { car_sedan: [1.95, 1.35, 4.5], car_hatchback: [1.88, 1.45, 4.0], car_suv: [2.15, 1.69, 4.7] };

export interface ParkedCar extends Placement3 {
  kind: CarKind;
}

/** Cars parked along the kerbs: drawn instanced once their models load (their collision is added at build time). */
export class ParkedCars {
  readonly group = new THREE.Group();

  constructor(readonly cars: ParkedCar[]) {
    this.group.name = 'parked-cars';
  }

  async load(): Promise<void> {
    await Promise.all(
      (Object.keys(CAR_FILES) as CarKind[]).map(async (kind) => {
        const spots = this.cars.filter((c) => c.kind === kind);
        if (!spots.length) return;
        try {
          const gltf = await loadGltf(CAR_FILES[kind]);
          this.group.add(instancedCopies(gltf.scene, spots, `cars:${kind}`));
        } catch {
          // no cars of this kind
        }
      }),
    );
  }
}
