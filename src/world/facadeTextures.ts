import * as THREE from 'three';
import { mulberry32 } from './cityLayout';

/**
 * Painted textures for the realistic city facades.
 *
 * Every texture is drawn on three canvases at once:
 *  - colour (white plaster, so the building's vertex colour tints it),
 *  - height (turned into a normal map, so frames, sills and string courses
 *    stand out and windows sit in a recess),
 *  - surface (red = how much the building's colour tints this pixel,
 *    green = roughness, blue = metalness).
 * Glass, frames and railings keep their own colour (red 0), which is what
 * lets a brick building still have grey glass.
 */

export interface FacadeTextures {
  map: THREE.Texture;
  lit: THREE.Texture;
  normal: THREE.Texture;
  surface: THREE.Texture;
}

interface Layer {
  color?: string | CanvasGradient;
  /** 0..1 */
  height?: number;
  /** 0..1, how much the wall colour tints it */
  tint?: number;
  rough?: number;
  metal?: number;
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  return [c, g];
}

class Painter {
  readonly size: number;
  readonly color: CanvasRenderingContext2D;
  readonly height: CanvasRenderingContext2D;
  readonly surface: CanvasRenderingContext2D;
  readonly lit: CanvasRenderingContext2D;
  private canvases: HTMLCanvasElement[] = [];

  constructor(size: number) {
    this.size = size;
    const make = () => {
      const [c, g] = canvas(size);
      this.canvases.push(c);
      return g;
    };
    this.color = make();
    this.height = make();
    this.surface = make();
    this.lit = make();
    this.lit.fillStyle = '#000';
    this.lit.fillRect(0, 0, size, size);
  }

  rect(x: number, y: number, w: number, h: number, l: Layer): void {
    if (l.color !== undefined) {
      this.color.fillStyle = l.color;
      this.color.fillRect(x, y, w, h);
    }
    if (l.height !== undefined) {
      const v = Math.round(l.height * 255);
      this.height.fillStyle = `rgb(${v},${v},${v})`;
      this.height.fillRect(x, y, w, h);
    }
    if (l.tint !== undefined || l.rough !== undefined || l.metal !== undefined) {
      const r = Math.round((l.tint ?? 0) * 255);
      const g = Math.round((l.rough ?? 0.9) * 255);
      const b = Math.round((l.metal ?? 0) * 255);
      this.surface.fillStyle = `rgb(${r},${g},${b})`;
      this.surface.fillRect(x, y, w, h);
    }
  }

  textures(normalStrength: number): FacadeTextures {
    const [colorC, heightC, surfaceC, litC] = this.canvases;
    const tex = (c: HTMLCanvasElement, srgb: boolean) => {
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      return t;
    };
    return {
      map: tex(colorC, true),
      lit: tex(litC, true),
      normal: tex(normalFromHeight(heightC, normalStrength), false),
      surface: tex(surfaceC, false),
    };
  }
}

/** Sobel-free central differences; wraps at the edges so the tile repeats seamlessly. */
function normalFromHeight(src: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const n = src.width;
  const h = src.getContext('2d')!.getImageData(0, 0, n, n).data;
  const [out, g] = canvas(n);
  const img = g.createImageData(n, n);
  const at = (x: number, y: number) => h[(((y + n) % n) * n + ((x + n) % n)) * 4] / 255;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // canvas y runs down while the texture's v runs up
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      img.data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return out;
}

const CURTAINS = ['#efe6d2', '#d9cdb5', '#c8d3dc', '#e8d8c8', '#b9a48a', '#f4f1ea'];
const SHUTTER = ['#cfcac0', '#bfb8aa', '#d8d3c8', '#a9a39a'];

/**
 * 4 bays x 4 floors of real windows: stone surrounds, sills, string courses
 * between floors, roller shutters half down, curtains, iron balconies with
 * French doors, the odd air conditioner, and rain streaks under the sills.
 */
export function makeFacadeTextures(): FacadeTextures {
  const size = 1024;
  const cs = size / 4;
  const p = new Painter(size);
  const rng = mulberry32(19);

  // plaster with mottling
  p.rect(0, 0, size, size, { color: '#ffffff', height: 0.5, tint: 1, rough: 0.94, metal: 0 });
  for (let k = 0; k < 2600; k++) {
    const s = 4 + rng() * 40;
    p.color.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '255,255,255'},${0.012 + rng() * 0.03})`;
    p.color.fillRect(rng() * size, rng() * size, s, s * (0.4 + rng()));
  }
  for (let k = 0; k < 9000; k++) {
    const v = Math.round(118 + rng() * 20);
    p.height.fillStyle = `rgb(${v},${v},${v})`;
    p.height.fillRect(rng() * size, rng() * size, 2, 2);
  }

  for (let j = 0; j < 4; j++) {
    const top = j * cs;
    const bottom = top + cs;
    // string course along the floor line, with a shadow under it
    p.rect(0, bottom - 15, size, 13, { color: '#f4f0e8', height: 0.82, tint: 0.55, rough: 0.85 });
    p.rect(0, bottom - 2, size, 2, { color: 'rgba(0,0,0,0.22)', height: 0.35 });
    p.rect(0, bottom - 15, size, 2, { color: 'rgba(255,255,255,0.35)' });

    for (let i = 0; i < 4; i++) {
      const left = i * cs;
      const balcony = j !== 3 && rng() < 0.28;
      const ww = cs * (balcony ? 0.4 : 0.36);
      const x = left + (cs - ww) / 2;
      const y = top + cs * 0.15;
      const wh = balcony ? bottom - 26 - y : cs * 0.58;

      // rain streaks below the window
      const streak = p.color.createLinearGradient(0, y + wh, 0, y + wh + cs * 0.5);
      streak.addColorStop(0, 'rgba(40,36,30,0.12)');
      streak.addColorStop(1, 'rgba(40,36,30,0)');
      p.color.fillStyle = streak;
      p.color.fillRect(x + 4, y + wh, ww - 8, cs * 0.5);

      // stone surround, then the dark reveal of the recess
      p.rect(x - 13, y - 15, ww + 26, wh + 15, { color: '#efe9dd', height: 0.78, tint: 0.3, rough: 0.8 });
      p.rect(x - 13, y - 22, ww + 26, 8, { color: '#e6dfd1', height: 0.9, tint: 0.3, rough: 0.8 });
      p.rect(x - 2, y - 2, ww + 4, wh + 4, { color: '#2b2c2c', height: 0.12, tint: 0, rough: 0.8 });

      // glass that reflects the sky (and lets the environment map do the rest)
      const glass = p.color.createLinearGradient(x, y, x + ww * 0.4, y + wh);
      glass.addColorStop(0, '#9fb3c4');
      glass.addColorStop(0.45, '#4b5c6c');
      glass.addColorStop(1, '#2f3a45');
      p.rect(x, y, ww, wh, { color: glass, height: 0.1, tint: 0, rough: 0.06, metal: 0.1 });
      const lit = rng() < 0.45;
      if (lit) {
        p.lit.fillStyle = rng() < 0.8 ? '#ffcf86' : '#cfe6ff';
        p.lit.fillRect(x, y, ww, wh);
      }

      // curtains just behind the glass
      if (rng() < 0.55) {
        const cc = CURTAINS[Math.floor(rng() * CURTAINS.length)];
        const cw = ww * (0.18 + rng() * 0.2);
        p.color.globalAlpha = 0.75;
        p.rect(x, y, cw, wh, { color: cc });
        p.rect(x + ww - cw, y, cw, wh, { color: cc });
        p.color.globalAlpha = 1;
        p.lit.fillStyle = 'rgba(0,0,0,0.45)';
        p.lit.fillRect(x, y, cw, wh);
        p.lit.fillRect(x + ww - cw, y, cw, wh);
      }

      // roller shutter pulled part way down
      if (rng() < 0.45) {
        const sh = wh * (0.15 + rng() * 0.7);
        const sc = SHUTTER[Math.floor(rng() * SHUTTER.length)];
        p.rect(x, y, ww, sh, { color: sc, height: 0.3, tint: 0, rough: 0.7 });
        for (let yy = y + 5; yy < y + sh; yy += 6) p.rect(x, yy, ww, 1.5, { color: 'rgba(0,0,0,0.22)', height: 0.24 });
        p.rect(x, y + sh - 4, ww, 4, { color: '#8d877d', height: 0.32 });
        p.lit.fillStyle = '#000';
        p.lit.fillRect(x, y, ww, sh);
      }

      // white window frame and glazing bars
      const frame: Layer = { color: '#f2f1ec', height: 0.26, tint: 0, rough: 0.5 };
      p.rect(x, y, ww, 4, frame);
      p.rect(x, y + wh - 4, ww, 4, frame);
      p.rect(x, y, 4, wh, frame);
      p.rect(x + ww - 4, y, 4, wh, frame);
      p.rect(x + ww / 2 - 2.5, y, 5, wh, frame);
      p.rect(x, y + wh * 0.28, ww, 4, frame);

      if (balcony) {
        // slab, iron railing in front of a French door
        const by = bottom - 26;
        p.rect(x - 30, by, ww + 60, 11, { color: '#ddd7cb', height: 0.98, tint: 0.2, rough: 0.8 });
        p.rect(x - 30, by + 11, ww + 60, 3, { color: 'rgba(0,0,0,0.3)', height: 0.4 });
        const iron: Layer = { color: '#2a2d31', height: 0.95, tint: 0, rough: 0.45, metal: 0.6 };
        p.rect(x - 30, by - 46, ww + 60, 5, iron);
        p.rect(x - 30, by - 8, ww + 60, 3, iron);
        for (let bx = x - 30; bx <= x + ww + 30; bx += 9) p.rect(bx, by - 46, 2.5, 46, iron);
        if (rng() < 0.6) {
          // a pot plant on the balcony
          p.rect(x + ww + 8, by - 16, 16, 16, { color: '#a8603b', height: 0.97, tint: 0, rough: 0.9 });
          p.color.fillStyle = '#4c7a3a';
          p.color.beginPath();
          p.color.arc(x + ww + 16, by - 22, 13, 0, Math.PI * 2);
          p.color.fill();
        }
      } else {
        // sill
        p.rect(x - 16, y + wh, ww + 32, 10, { color: '#ebe4d7', height: 0.97, tint: 0.3, rough: 0.8 });
        p.rect(x - 16, y + wh + 10, ww + 32, 3, { color: 'rgba(0,0,0,0.28)', height: 0.4 });
        if (rng() < 0.16) {
          // air conditioner beside the window
          const ax = rng() < 0.5 ? x - 66 : x + ww + 18;
          const ay = y + wh * 0.55;
          p.rect(ax, ay, 48, 34, { color: '#e8e8e4', height: 0.98, tint: 0, rough: 0.6 });
          for (let gy = ay + 6; gy < ay + 30; gy += 5) p.rect(ax + 18, gy, 26, 2, { color: '#a7a7a2', height: 0.9 });
          p.color.strokeStyle = '#8a8a86';
          p.color.lineWidth = 2;
          p.color.beginPath();
          p.color.arc(ax + 10, ay + 17, 7, 0, Math.PI * 2);
          p.color.stroke();
          p.rect(ax, ay + 34, 48, 3, { color: 'rgba(0,0,0,0.3)', height: 0.4 });
        }
      }
    }
  }
  return p.textures(6);
}

/**
 * Curtain wall: per floor a band of spandrel panels and a band of vision
 * glass in slightly different tints, silver mullions, and blinds here and there.
 */
export function makeTowerTextures(): FacadeTextures {
  const size = 512;
  const cols = 8;
  const rows = 8;
  const cw = size / cols;
  const rh = size / rows;
  const p = new Painter(size);
  const rng = mulberry32(23);
  p.rect(0, 0, size, size, { color: '#2e4a63', height: 0.4, tint: 0, rough: 0.05, metal: 0.65 });
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * cw;
      const y = j * rh;
      const t = rng();
      const glass = p.color.createLinearGradient(x, y, x + cw, y + rh);
      glass.addColorStop(0, t < 0.5 ? '#6f93b3' : '#5a7f9f');
      glass.addColorStop(0.6, '#2d4b66');
      glass.addColorStop(1, '#3c5e7d');
      p.rect(x, y, cw, rh * 0.74, { color: glass, height: 0.4, rough: 0.04 + rng() * 0.05, metal: 0.65 });
      // spandrel band hiding the floor slab
      p.rect(x, y + rh * 0.74, cw, rh * 0.26, { color: '#33434f', height: 0.45, rough: 0.35, metal: 0.4 });
      if (rng() < 0.25) {
        // blinds lowered behind the glass
        p.rect(x + 2, y + 2, cw - 4, rh * (0.2 + rng() * 0.45), { color: '#b7c0c6', rough: 0.5, metal: 0.1 });
      }
      if (rng() < 0.22) {
        p.lit.fillStyle = rng() < 0.6 ? '#dff0ff' : '#ffe2a8';
        p.lit.fillRect(x + 2, y + 2, cw - 4, rh * 0.74 - 4);
      }
    }
  }
  const mullion: Layer = { color: '#c5ccd2', height: 0.75, rough: 0.3, metal: 0.9 };
  for (let i = 0; i <= cols; i++) p.rect(i * cw - 1.5, 0, 3, size, mullion);
  for (let j = 0; j <= rows; j++) p.rect(0, j * rh - 2, size, 4, mullion);
  return p.textures(3);
}

/**
 * Makes a material's vertex colour tint only the parts of the texture whose
 * surface red channel says so (walls yes, glass and frames no). Expects the
 * surface texture as `roughnessMap`.
 */
export function maskVertexColour(material: THREE.MeshStandardMaterial): void {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `#if defined( USE_COLOR ) && defined( USE_ROUGHNESSMAP )
        diffuseColor.rgb *= mix(vec3(1.0), vColor, texture2D(roughnessMap, vRoughnessMapUv).r);
      #else
        #include <color_fragment>
      #endif`,
    );
  };
}

/**
 * Clay roof tiles, 2 x 2 m per tile of texture: courses run across (u) and
 * go down the slope (v). White-ish, so each roof's colour tints it.
 */
export function makeRoofTextures(): FacadeTextures {
  const size = 512;
  const p = new Painter(size);
  const rng = mulberry32(29);
  p.rect(0, 0, size, size, { color: '#e9e2da', height: 0.5, tint: 1, rough: 0.82 });
  const course = size / 7; // about 0.29 m
  const tile = size / 9; // about 0.22 m
  for (let r = 0; r < 7; r++) {
    const y = r * course;
    const shift = r % 2 ? tile / 2 : 0;
    for (let c = -1; c < 10; c++) {
      const x = c * tile + shift;
      const v = 0.82 + rng() * 0.2;
      const shade = Math.round(233 * v);
      // a barrel tile: lighter crest, darker troughs at the sides
      const grad = p.color.createLinearGradient(x, 0, x + tile, 0);
      grad.addColorStop(0, `rgb(${shade * 0.72},${shade * 0.7},${shade * 0.68})`);
      grad.addColorStop(0.5, `rgb(${shade},${shade * 0.97},${shade * 0.94})`);
      grad.addColorStop(1, `rgb(${shade * 0.72},${shade * 0.7},${shade * 0.68})`);
      p.color.fillStyle = grad;
      p.color.fillRect(x, y, tile, course);
      const hg = p.height.createLinearGradient(x, 0, x + tile, 0);
      hg.addColorStop(0, 'rgb(70,70,70)');
      hg.addColorStop(0.5, 'rgb(190,190,190)');
      hg.addColorStop(1, 'rgb(70,70,70)');
      p.height.fillStyle = hg;
      p.height.fillRect(x, y, tile, course);
      if (rng() < 0.12) {
        // lichen and weathering
        p.color.fillStyle = `rgba(${rng() < 0.5 ? '90,96,70' : '40,36,32'},0.25)`;
        p.color.fillRect(x + tile * 0.2, y + course * 0.3, tile * 0.6, course * 0.6);
      }
    }
    // the shadow where each course overlaps the one below it
    p.rect(0, y + course - 7, size, 7, { color: 'rgba(30,20,15,0.45)', height: 0.15 });
  }
  return p.textures(5);
}
