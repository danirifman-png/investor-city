import * as THREE from 'three';
import { SIGN_FONT } from './Materials';

/**
 * Floating icons over things the player can use: clues (!), info (i),
 * "Did you know?" discoveries (?), doors and exits (arrow). Sprites always
 * face the camera and draw over scenery so they are easy to spot; found
 * items fade and show a check mark.
 */
export type MarkerKind = 'clue' | 'info' | 'curio' | 'door' | 'exit' | 'game';

const STYLE: Record<MarkerKind, { bg: string; ring: string; glyph: string }> = {
  clue: { bg: '#ff8a3c', ring: '#fff3d6', glyph: '!' },
  info: { bg: '#3fb6e8', ring: '#e6f7ff', glyph: 'i' },
  curio: { bg: '#f5b80f', ring: '#fff8d6', glyph: '?' },
  door: { bg: '#3ec27a', ring: '#e3ffef', glyph: '⇧' },
  exit: { bg: '#3ec27a', ring: '#e3ffef', glyph: '⇩' },
  game: { bg: '#d8392b', ring: '#fff1d6', glyph: '★' },
};

const cache = new Map<string, THREE.Texture>();

function iconTexture(kind: MarkerKind, done: boolean): THREE.Texture {
  const key = `${kind}:${done}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const st = STYLE[kind];
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(s / 2, s / 2 + 4, s * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = done ? '#9aa3b5' : st.bg;
  ctx.strokeStyle = st.ring;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${s * 0.52}px ${SIGN_FONT}`;
  ctx.fillText(done ? '✓' : st.glyph, s / 2, s / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

export class Marker {
  readonly sprite: THREE.Sprite;
  private material: THREE.SpriteMaterial;
  private baseY: number;
  private phase = Math.random() * Math.PI * 2;
  done = false;

  constructor(
    readonly kind: MarkerKind,
    x: number,
    y: number,
    z: number,
    readonly id: string,
  ) {
    this.material = new THREE.SpriteMaterial({ map: iconTexture(kind, false), depthTest: false, transparent: true, fog: false });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.renderOrder = 10;
    this.sprite.position.set(x, y, z);
    this.sprite.scale.setScalar(0.62);
    this.sprite.name = `marker:${kind}:${id}`;
    this.baseY = y;
  }

  get position(): THREE.Vector3 {
    return this.sprite.position;
  }

  setDone(done: boolean): void {
    if (done === this.done) return;
    this.done = done;
    this.material.map = iconTexture(this.kind, done);
    this.material.opacity = done ? 0.55 : 1;
    this.material.needsUpdate = true;
  }

  /** Bobbing; `near` makes it pulse a little to say "you can use this". */
  update(time: number, near: boolean): void {
    this.sprite.position.y = this.baseY + Math.sin(time * 2.2 + this.phase) * 0.08;
    const s = this.done ? 0.45 : near ? 0.72 + Math.sin(time * 6) * 0.05 : 0.62;
    this.sprite.scale.setScalar(s);
  }
}
