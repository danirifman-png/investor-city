import * as THREE from 'three';
import type { InteriorId } from '../../content/interiors';

/**
 * Realistic finishes for the walk-in rooms: each building has its own floor,
 * walls, lower panelling, trim and lights, drawn as textures on a canvas (no
 * image files). The room builders keep the furniture; these are the surfaces.
 */

export type SurfaceKind = 'planks' | 'parquet' | 'marble' | 'tiles' | 'carpet' | 'concrete' | 'brick' | 'plaster' | 'panels' | 'acoustic' | 'terrazzo';

export interface Surface {
  kind: SurfaceKind;
  base: string;
  alt: string;
  /** Metres covered by one texture tile. */
  tile: number;
  rough: number;
  /** How much the texture's light and dark parts raise the surface. */
  bump?: number;
}

export interface Finish {
  floor: Surface;
  wall: Surface;
  /** Lower wall panelling up to `h` metres. */
  wainscot?: Surface & { h: number };
  /** Skirting boards, window frames and cornices. */
  trim: string;
  /** Ceiling lamps: their light colour and the lamp shade colour. */
  lamp: { color: string; shade: string; intensity: number; style: 'pendant' | 'globe' | 'spot' };
  /** Windows on the side walls with daylight behind them. */
  windows: boolean;
}

export const FINISHES: Partial<Record<InteriorId, Finish>> = {
  pizzeria: {
    floor: { kind: 'tiles', base: '#b5583a', alt: '#9c4a31', tile: 1.2, rough: 0.7, bump: 0.02 },
    wall: { kind: 'plaster', base: '#efdcbc', alt: '#e2cba5', tile: 3, rough: 0.95 },
    wainscot: { kind: 'brick', base: '#a5523a', alt: '#8e4330', tile: 2, rough: 0.9, bump: 0.03, h: 1.4 },
    trim: '#5b3a24',
    lamp: { color: '#ffc27a', shade: '#2c2c2c', intensity: 9, style: 'pendant' },
    windows: true,
  },
  bank: {
    floor: { kind: 'marble', base: '#f1eee8', alt: '#c9c3b8', tile: 2.4, rough: 0.12, bump: 0.005 },
    wall: { kind: 'plaster', base: '#efe7d6', alt: '#e4d9c3', tile: 3, rough: 0.9 },
    wainscot: { kind: 'panels', base: '#6b4329', alt: '#55341f', tile: 2.4, rough: 0.45, bump: 0.02, h: 1.3 },
    trim: '#c9a35a',
    lamp: { color: '#fff0d0', shade: '#c9a35a', intensity: 9, style: 'globe' },
    windows: true,
  },
  exchange: {
    floor: { kind: 'carpet', base: '#2a3a5c', alt: '#22304d', tile: 2, rough: 1, bump: 0.01 },
    wall: { kind: 'plaster', base: '#d9dde6', alt: '#cfd4de', tile: 3, rough: 0.8 },
    wainscot: { kind: 'panels', base: '#2b3446', alt: '#232b3a', tile: 2.4, rough: 0.35, bump: 0.015, h: 1.0 },
    trim: '#9aa6bd',
    lamp: { color: '#e8f0ff', shade: '#eef2f8', intensity: 9, style: 'spot' },
    windows: true,
  },
  academy: {
    floor: { kind: 'parquet', base: '#a8743f', alt: '#8e5f31', tile: 1.6, rough: 0.5, bump: 0.02 },
    wall: { kind: 'plaster', base: '#f0e6cf', alt: '#e6d9bd', tile: 3, rough: 0.92 },
    wainscot: { kind: 'panels', base: '#3f5e45', alt: '#334d38', tile: 2.4, rough: 0.55, bump: 0.02, h: 1.2 },
    trim: '#6e4a2c',
    lamp: { color: '#ffe0a8', shade: '#f4ead2', intensity: 9, style: 'globe' },
    windows: true,
  },
  newsTower: {
    floor: { kind: 'concrete', base: '#3a3d44', alt: '#2f3238', tile: 4, rough: 0.25, bump: 0.008 },
    wall: { kind: 'acoustic', base: '#2e3240', alt: '#262a36', tile: 1.8, rough: 1, bump: 0.02 },
    trim: '#d8392b',
    lamp: { color: '#e6efff', shade: '#20242e', intensity: 10, style: 'spot' },
    windows: false,
  },
  startupHub: {
    floor: { kind: 'concrete', base: '#c9c6bf', alt: '#bcb8b0', tile: 4, rough: 0.3, bump: 0.008 },
    wall: { kind: 'brick', base: '#f2efe9', alt: '#e3dfd7', tile: 2, rough: 0.95, bump: 0.025 },
    trim: '#2b2f36',
    lamp: { color: '#fff1dc', shade: '#2b2f36', intensity: 9, style: 'pendant' },
    windows: true,
  },
  realEstateAgency: {
    floor: { kind: 'planks', base: '#d9b98c', alt: '#c9a575', tile: 2.4, rough: 0.45, bump: 0.015 },
    wall: { kind: 'plaster', base: '#fbf7f2', alt: '#f1ebe3', tile: 3, rough: 0.9 },
    wainscot: { kind: 'panels', base: '#f4efe8', alt: '#e7e0d6', tile: 2.4, rough: 0.6, bump: 0.015, h: 1.0 },
    trim: '#d8cfc2',
    lamp: { color: '#fff4e4', shade: '#ffffff', intensity: 9, style: 'pendant' },
    windows: true,
  },
  mall: {
    floor: { kind: 'marble', base: '#f4f1ec', alt: '#d9d3ca', tile: 3, rough: 0.15, bump: 0.004 },
    wall: { kind: 'plaster', base: '#f7f3ee', alt: '#eee7de', tile: 3, rough: 0.85 },
    trim: '#f08a4b',
    lamp: { color: '#fff4e4', shade: '#ffffff', intensity: 11, style: 'spot' },
    windows: true,
  },
  home: {
    floor: { kind: 'planks', base: '#c99a6b', alt: '#b8895b', tile: 2.4, rough: 0.5, bump: 0.015 },
    wall: { kind: 'plaster', base: '#fdf1dc', alt: '#f4e4c8', tile: 3, rough: 0.9 },
    wainscot: { kind: 'panels', base: '#bfe0d6', alt: '#acd3c7', tile: 2.4, rough: 0.6, bump: 0.015, h: 1.0 },
    trim: '#ffffff',
    lamp: { color: '#fff1d6', shade: '#ffe7b3', intensity: 9, style: 'globe' },
    windows: true,
  },
};

/* ------------------------------------------------------------------ */
/* Texture painting                                                    */
/* ------------------------------------------------------------------ */

const SIZE = 512;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A colour shifted lighter (+) or darker (-) by `k` (-1..1). */
function shift(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + k, 0, 1));
  return `#${c.getHexString()}`;
}

/** Soft blotches and specks so no surface is a flat colour. */
function grain(ctx: CanvasRenderingContext2D, r: () => number, amount: number, light = '#ffffff', dark = '#000000'): void {
  for (let i = 0; i < 260; i++) {
    ctx.globalAlpha = amount * (0.2 + r() * 0.5);
    ctx.fillStyle = r() < 0.5 ? light : dark;
    const x = r() * SIZE;
    const y = r() * SIZE;
    const s = 6 + r() * 60;
    // draw wrapped so the texture tiles without seams
    for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, s, s * (0.4 + r() * 0.6), r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i < 2500; i++) {
    ctx.globalAlpha = amount * 0.6 * r();
    ctx.fillStyle = r() < 0.5 ? light : dark;
    ctx.fillRect(r() * SIZE, r() * SIZE, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  ctx.globalAlpha = 1;
}

/** Wood grain inside a rectangle (lines along the plank). */
function woodGrain(ctx: CanvasRenderingContext2D, r: () => number, x: number, y: number, w: number, h: number, color: string, vertical: boolean): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = shift(color, -0.08);
  const len = vertical ? h : w;
  const across = vertical ? w : h;
  for (let i = 0; i < across / 2.5; i++) {
    ctx.globalAlpha = 0.15 + r() * 0.25;
    ctx.lineWidth = 0.6 + r() * 1.2;
    const off = r() * across;
    const amp = 1 + r() * 3;
    const ph = r() * 6;
    ctx.beginPath();
    for (let t = 0; t <= len; t += 8) {
      const a = off + Math.sin(t / 40 + ph) * amp;
      if (vertical) ctx.lineTo(x + a, y + t);
      else ctx.lineTo(x + t, y + a);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function paint(s: Surface, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const r = rng(seed);
  ctx.fillStyle = s.base;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const grout = (w: number) => {
    ctx.lineWidth = w;
  };
  switch (s.kind) {
    case 'planks': {
      const rows = 6;
      const ph = SIZE / rows;
      for (let i = 0; i < rows; i++) {
        let x = -r() * SIZE * 0.5;
        while (x < SIZE) {
          const len = SIZE * (0.35 + r() * 0.4);
          const col = shift(r() < 0.5 ? s.base : s.alt, (r() - 0.5) * 0.06);
          for (const dx of [0, SIZE]) {
            ctx.fillStyle = col;
            ctx.fillRect(x - dx, i * ph, len, ph);
            woodGrain(ctx, r, x - dx, i * ph, len, ph, col, false);
          }
          ctx.fillStyle = shift(s.base, -0.3);
          for (const dx of [0, SIZE]) ctx.fillRect(x + len - 1 - dx, i * ph, 2, ph);
          x += len;
        }
        ctx.fillStyle = shift(s.base, -0.3);
        ctx.fillRect(0, i * ph, SIZE, 2);
      }
      break;
    }
    case 'parquet': {
      // basket weave: squares of three strips, turned every other square
      const n = 4;
      const q = SIZE / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const vertical = (i + j) % 2 === 0;
          for (let k = 0; k < 3; k++) {
            const col = shift(k % 2 ? s.alt : s.base, (r() - 0.5) * 0.08);
            const x = i * q + (vertical ? (k * q) / 3 : 0);
            const y = j * q + (vertical ? 0 : (k * q) / 3);
            const w = vertical ? q / 3 : q;
            const h = vertical ? q : q / 3;
            ctx.fillStyle = col;
            ctx.fillRect(x, y, w, h);
            woodGrain(ctx, r, x, y, w, h, col, vertical);
            ctx.strokeStyle = shift(s.base, -0.3);
            grout(1.5);
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
          }
        }
      break;
    }
    case 'marble': {
      // two big tiles each way, checker of light and darker marble, with veins
      const n = 2;
      const q = SIZE / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = (i + j) % 2 ? s.alt : s.base;
          ctx.fillRect(i * q, j * q, q, q);
        }
      grain(ctx, r, 0.08, '#ffffff', '#6b665e');
      ctx.strokeStyle = '#8f8a82';
      for (let v = 0; v < 9; v++) {
        let x = r() * SIZE;
        let y = r() * SIZE;
        ctx.globalAlpha = 0.18 + r() * 0.3;
        ctx.lineWidth = 0.6 + r() * 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        let a = r() * Math.PI * 2;
        for (let k = 0; k < 40; k++) {
          a += (r() - 0.5) * 0.7;
          x += Math.cos(a) * 9;
          y += Math.sin(a) * 9;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#a7a196';
      for (let i = 0; i <= n; i++) {
        ctx.fillRect(i * q - 1, 0, 2, SIZE);
        ctx.fillRect(0, i * q - 1, SIZE, 2);
      }
      return c;
    }
    case 'tiles':
    case 'terrazzo': {
      const n = 4;
      const q = SIZE / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = shift(r() < 0.5 ? s.base : s.alt, (r() - 0.5) * 0.06);
          ctx.fillRect(i * q, j * q, q, q);
        }
      grain(ctx, r, 0.1);
      ctx.fillStyle = shift(s.base, 0.25);
      for (let i = 0; i <= n; i++) {
        ctx.fillRect(i * q - 2, 0, 4, SIZE);
        ctx.fillRect(0, i * q - 2, SIZE, 4);
      }
      return c;
    }
    case 'carpet': {
      grain(ctx, r, 0.12);
      ctx.strokeStyle = s.alt;
      ctx.lineWidth = 3;
      const q = SIZE / 4;
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          ctx.beginPath();
          ctx.moveTo(i * q + q / 2, j * q + 8);
          ctx.lineTo(i * q + q - 8, j * q + q / 2);
          ctx.lineTo(i * q + q / 2, j * q + q - 8);
          ctx.lineTo(i * q + 8, j * q + q / 2);
          ctx.closePath();
          ctx.stroke();
        }
      for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = r() < 0.5 ? shift(s.base, 0.06) : shift(s.base, -0.06);
        ctx.fillRect(r() * SIZE, r() * SIZE, 1, 1);
      }
      return c;
    }
    case 'concrete': {
      grain(ctx, r, 0.12);
      ctx.strokeStyle = shift(s.base, -0.12);
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 0.8;
      for (let k = 0; k < 4; k++) {
        let x = r() * SIZE;
        let y = r() * SIZE;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 0; i < 14; i++) ctx.lineTo((x += (r() - 0.5) * 30), (y += (r() - 0.3) * 20));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // saw cuts between slabs
      ctx.fillStyle = shift(s.base, -0.15);
      ctx.fillRect(0, 0, SIZE, 2);
      ctx.fillRect(0, 0, 2, SIZE);
      return c;
    }
    case 'brick': {
      const rows = 8;
      const bh = SIZE / rows;
      const bw = SIZE / 4;
      ctx.fillStyle = shift(s.base, 0.12);
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (let i = 0; i < rows; i++) {
        const off = i % 2 ? bw / 2 : 0;
        for (let k = -1; k < 5; k++) {
          ctx.fillStyle = shift(r() < 0.5 ? s.base : s.alt, (r() - 0.5) * 0.08);
          ctx.fillRect(k * bw + off + 3, i * bh + 3, bw - 6, bh - 6);
        }
      }
      grain(ctx, r, 0.1);
      return c;
    }
    case 'panels': {
      const n = 4;
      const q = SIZE / n;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = shift(s.base, (r() - 0.5) * 0.04);
        ctx.fillRect(i * q, 0, q, SIZE);
        woodGrain(ctx, r, i * q, 0, q, SIZE, s.base, true);
        // a raised panel: lighter top and left edges, darker bottom and right
        ctx.strokeStyle = shift(s.base, 0.08);
        ctx.lineWidth = 4;
        ctx.strokeRect(i * q + 14, 24, q - 28, SIZE - 48);
        ctx.strokeStyle = shift(s.alt, -0.1);
        ctx.lineWidth = 2;
        ctx.strokeRect(i * q + 18, 28, q - 36, SIZE - 56);
        ctx.fillStyle = shift(s.alt, -0.15);
        ctx.fillRect(i * q, 0, 3, SIZE);
      }
      return c;
    }
    case 'acoustic': {
      const n = 4;
      const q = SIZE / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = shift((i + j) % 2 ? s.base : s.alt, (r() - 0.5) * 0.04);
          ctx.fillRect(i * q + 3, j * q + 3, q - 6, q - 6);
        }
      for (let i = 0; i < 12000; i++) {
        ctx.fillStyle = r() < 0.5 ? shift(s.base, 0.05) : shift(s.base, -0.05);
        ctx.fillRect(r() * SIZE, r() * SIZE, 1, 1);
      }
      return c;
    }
    case 'plaster':
    default:
      grain(ctx, r, 0.06, s.alt, shift(s.base, -0.1));
      return c;
  }
  grain(ctx, r, 0.05);
  return c;
}

const cache = new Map<string, THREE.Texture>();

function texture(s: Surface, seed: number): THREE.Texture {
  const key = `${s.kind}:${s.base}:${s.alt}:${seed}`;
  let tex = cache.get(key);
  if (!tex) {
    tex = new THREE.CanvasTexture(paint(s, seed));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    cache.set(key, tex);
  }
  return tex;
}

/** A material for a surface; UVs are expected in metres (see `metreUVs`). */
export function surfaceMaterial(s: Surface, seed: number, transparent = false): THREE.MeshStandardMaterial {
  const map = texture(s, seed);
  const m = new THREE.MeshStandardMaterial({ map, roughness: s.rough, metalness: 0, transparent });
  if (s.bump) {
    m.bumpMap = map;
    m.bumpScale = s.bump * 40;
  }
  // one texture tile per `tile` metres
  m.userData.tile = s.tile;
  map.repeat.set(1 / s.tile, 1 / s.tile);
  return m;
}

/** Sets a box's UVs to world metres (so textures keep their real size on any wall). */
export function metreUVs(geo: THREE.BoxGeometry, w: number, h: number, d: number): THREE.BoxGeometry {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // BoxGeometry faces: +x, -x, +y, -y, +z, -z (4 vertices each): (u, v) sizes
  const sizes: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * sizes[f][0], uv.getY(i) * sizes[f][1]);
  }
  uv.needsUpdate = true;
  return geo;
}
