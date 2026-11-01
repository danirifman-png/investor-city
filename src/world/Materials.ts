import * as THREE from 'three';
import type { MaterialKey } from './Batcher';
import { makeFacadeTextures, makeRoofTextures, makeTowerTextures, maskVertexColour } from './facadeTextures';

/** Font used for in-world signage; loaded in index.html. */
export const SIGN_FONT = '"Rubik", "Arial Hebrew", "Noto Sans Hebrew", Arial, sans-serif';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

export interface CityMaterials {
  byKey: Record<MaterialKey, THREE.Material>;
  facade: THREE.MeshStandardMaterial;
  glow: THREE.MeshBasicMaterial;
  water: THREE.MeshStandardMaterial;
  tower: THREE.MeshStandardMaterial;
}

export function createMaterials(): CityMaterials {
  const walls = makeFacadeTextures();
  const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });
  const glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.55, envMapIntensity: 1.4 });
  // roughness and metalness come from the surface texture (green and blue)
  const facade = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: walls.map,
    normalMap: walls.normal,
    roughnessMap: walls.surface,
    metalnessMap: walls.surface,
    emissiveMap: walls.lit,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0,
    roughness: 1,
    metalness: 1,
    envMapIntensity: 1.1,
  });
  maskVertexColour(facade);
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const towerTex = makeTowerTextures();
  const tower = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: towerTex.map,
    normalMap: towerTex.normal,
    roughnessMap: towerTex.surface,
    metalnessMap: towerTex.surface,
    emissiveMap: towerTex.lit,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.15,
    roughness: 1,
    metalness: 1,
    envMapIntensity: 1.3,
  });
  maskVertexColour(tower);
  const tiles = makeRoofTextures();
  const roof = new THREE.MeshStandardMaterial({ vertexColors: true, map: tiles.map, normalMap: tiles.normal, roughness: 0.85, metalness: 0 });
  const water = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  return { byKey: { paint, glass, facade, glow, water, tower, roof }, facade, glow, water, tower };
}

export interface SignOptions {
  bg?: string;
  fg?: string;
  border?: string;
  width?: number;
  height?: number;
  fontSize?: number;
}

/** Renders a Hebrew sign onto a texture (RTL-aware canvas text). */
export function makeSignTexture(text: string, o: SignOptions = {}): THREE.CanvasTexture {
  const w = o.width ?? 512;
  const h = o.height ?? 128;
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = o.bg ?? '#1f2a44';
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, h * 0.2);
  ctx.fill();
  if (o.border) {
    ctx.lineWidth = 8;
    ctx.strokeStyle = o.border;
    ctx.stroke();
  }
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = o.fg ?? '#ffffff';
  let size = o.fontSize ?? h * 0.58;
  ctx.font = `700 ${size}px ${SIGN_FONT}`;
  while (ctx.measureText(text).width > w * 0.88 && size > 12) {
    size -= 2;
    ctx.font = `700 ${size}px ${SIGN_FONT}`;
  }
  ctx.fillText(text, w / 2, h / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Flat sign mesh (front face only) sized in world units. */
export function makeSign(text: string, width: number, height: number, o: SignOptions = {}): THREE.Mesh {
  const ratio = width / height;
  const texH = 128;
  const tex = makeSignTexture(text, { ...o, height: texH, width: Math.round(texH * ratio) });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.name = `sign:${text}`;
  return mesh;
}

export { canvas as createCanvas };
