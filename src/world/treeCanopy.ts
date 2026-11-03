import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Turns a scanned tree (one mesh whose leaves are large flat triangles) into a
 * stylized tree: the trunk and branches stay, and the leaves become soft
 * clumps of foliage. Leaf triangles are told apart from bark by the colour
 * of the texture under them (leaves are green, bark is brown), the clumps sit
 * where the leaves were, and their normals bend out from the crown's centre
 * so the whole crown shades as one soft shape, lit on top and darker below.
 */

export interface CanopyStyle {
  /** Clump size relative to the crown (smaller = more, finer clumps). */
  cell: number;
  /** The foliage colour (sRGB); the crown shades from darker below to sunlit on top. */
  color: THREE.ColorRepresentation;
}

function sampler(tex: THREE.Texture | null): ((u: number, v: number) => [number, number, number]) | null {
  const img = tex?.image as CanvasImageSource & { width: number; height: number } | undefined;
  if (!img || !img.width) return null;
  const w = Math.min(256, img.width);
  const h = Math.min(256, img.height);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(img, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h).data;
  const flip = tex!.flipY;
  return (u, v) => {
    const x = Math.min(w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * w)));
    const vv = v - Math.floor(v);
    const y = Math.min(h - 1, Math.max(0, Math.floor((flip ? 1 - vv : vv) * h)));
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
}

/** Deterministic hash noise for the clump shapes. */
function hash(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Replaces the leaves of every mesh in `root` with clumps. Returns false
 * (and leaves the model alone) when the leaves cannot be told apart.
 */
export function stylizeCanopy(root: THREE.Object3D, style: CanopyStyle): boolean {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  let changed = false;
  for (const mesh of meshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const sample = sampler(mat.map);
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (!sample || !uv) continue;
    const index = geo.index ? Array.from(geo.index.array) : [...Array(pos.count).keys()];
    const trunk: number[] = [];
    const leafPts: THREE.Vector3[] = [];
    let leafN = 0;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let t = 0; t < index.length; t += 3) {
      const [i0, i1, i2] = [index[t], index[t + 1], index[t + 2]];
      const u = (uv.getX(i0) + uv.getX(i1) + uv.getX(i2)) / 3;
      const v = (uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3;
      const [r, g, bl] = sample(u, v);
      const leaf = g > r * 1.02 && g >= bl * 0.95;
      if (!leaf) {
        trunk.push(i0, i1, i2);
        continue;
      }
      a.fromBufferAttribute(pos, i0);
      b.fromBufferAttribute(pos, i1);
      c.fromBufferAttribute(pos, i2);
      leafPts.push(a.clone(), b.clone(), c.clone());
      leafN++;
    }
    // need a real split: some bark and plenty of leaves
    if (leafN < 50 || trunk.length < 30) continue;

    // crown bounds
    const box = new THREE.Box3().setFromPoints(leafPts);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const crown = Math.max(size.x, size.y, size.z);
    const cell = crown * style.cell;

    // clump centres: occupied cells of a grid over the leaf points
    const cells = new Map<string, { sum: THREE.Vector3; n: number; min: THREE.Vector3; max: THREE.Vector3 }>();
    for (const p of leafPts) {
      const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`;
      let e = cells.get(key);
      if (!e) cells.set(key, (e = { sum: new THREE.Vector3(), n: 0, min: p.clone(), max: p.clone() }));
      e.sum.add(p);
      e.n++;
      e.min.min(p);
      e.max.max(p);
    }
    const minN = Math.max(3, leafPts.length / cells.size / 6);
    const base = new THREE.Color(style.color);
    const dark = base.clone().multiplyScalar(0.6);
    const light = base.clone().lerp(new THREE.Color('#fff0b8'), 0.22).multiplyScalar(1.25);

    const parts: THREE.BufferGeometry[] = [];
    const n = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    for (const e of cells.values()) {
      if (e.n < minN) continue;
      const mid = e.sum.divideScalar(e.n);
      const ext = e.max.clone().sub(e.min);
      const r = THREE.MathUtils.clamp(Math.max(ext.x, ext.y, ext.z) * 0.55, cell * 0.45, cell * 0.85);
      const g = new THREE.IcosahedronGeometry(r, 1);
      const p = g.getAttribute('position') as THREE.BufferAttribute;
      const nor = g.getAttribute('normal') as THREE.BufferAttribute;
      const col = new Float32Array(p.count * 3);
      for (let k = 0; k < p.count; k++) {
        tmp.fromBufferAttribute(p, k);
        // lumpy outline (same displacement for shared corners, so no cracks)
        const wob = 0.82 + hash(Math.round((tmp.x + mid.x) * 40), Math.round((tmp.y + mid.y) * 40), Math.round((tmp.z + mid.z) * 40)) * 0.32;
        tmp.multiplyScalar(wob).add(mid);
        p.setXYZ(k, tmp.x, tmp.y, tmp.z);
        // soft crown shading: the normal points away from the crown's centre
        n.copy(tmp).sub(centre);
        n.y *= 0.8;
        n.normalize();
        nor.setXYZ(k, n.x, n.y, n.z);
        // colour: darker deep inside and underneath, sunlit on the top
        const h = THREE.MathUtils.clamp((tmp.y - box.min.y) / Math.max(size.y, 0.001), 0, 1);
        const out = THREE.MathUtils.clamp(tmp.distanceTo(centre) / (crown * 0.5), 0, 1);
        const shade = THREE.MathUtils.clamp(0.25 + h * 0.55 + out * 0.3 + (hash(k, mid.x, mid.z) - 0.5) * 0.12, 0, 1);
        const cc = dark.clone().lerp(light, shade);
        col[k * 3] = cc.r;
        col[k * 3 + 1] = cc.g;
        col[k * 3 + 2] = cc.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.deleteAttribute('uv');
      parts.push(g);
    }
    if (parts.length < 3) continue;
    const canopyGeo = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    if (!canopyGeo) continue;
    const canopy = new THREE.Mesh(
      canopyGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.6 }),
    );
    canopy.name = `${mesh.name || 'tree'}:canopy`;
    canopy.position.copy(mesh.position);
    canopy.quaternion.copy(mesh.quaternion);
    canopy.scale.copy(mesh.scale);
    mesh.parent?.add(canopy);

    // the bark keeps only its own triangles
    const bark = geo.clone();
    bark.setIndex(trunk);
    mesh.geometry = bark;
    changed = true;
  }
  return changed;
}
