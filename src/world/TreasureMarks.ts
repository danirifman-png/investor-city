import * as THREE from 'three';
import type { TreasureAt, TreasureStep } from '../content/treasure';
import type { Poi } from './types';

/**
 * The one treasure thing waiting in the world: a glowing map scroll, the
 * fountain's locked chest, or the founder's vault door. Only the next step is
 * shown, so the player always knows what to look for.
 */

export function treasurePos(at: TreasureAt | undefined, pois: Poi[]): { x: number; z: number } | null {
  if (!at) return null;
  if ('x' in at) return { x: at.x, z: at.z };
  const poi = pois.find((p) => p.key === at.poi);
  return poi ? { x: poi.x + at.dx, z: poi.z + at.dz } : null;
}

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,240,170,1)');
  r.addColorStop(0.35, 'rgba(255,214,90,0.55)');
  r.addColorStop(1, 'rgba(255,200,60,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const gold = new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 0.75, roughness: 0.3, emissive: '#5a3c00', emissiveIntensity: 0.4 });

function scroll(): THREE.Group {
  const g = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({ color: '#f1deaa', roughness: 0.8, emissive: '#6b5420', emissiveIntensity: 0.35 });
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 16), paper);
  roll.rotation.z = Math.PI / 2;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.42), new THREE.MeshStandardMaterial({ color: '#f1deaa', roughness: 0.85, side: THREE.DoubleSide, emissive: '#6b5420', emissiveIntensity: 0.3 }));
  sheet.position.set(0, -0.22, 0.02);
  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 20), new THREE.MeshStandardMaterial({ color: '#d33a3a', roughness: 0.5 }));
  ribbon.rotation.y = Math.PI / 2;
  // a red X on the sheet, the classic treasure mark
  const xMat = new THREE.MeshBasicMaterial({ color: '#c0392b' });
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.03), xMat);
    bar.position.set(0.1, -0.26, 0.025);
    bar.rotation.z = a;
    g.add(bar);
  }
  g.add(roll, sheet, ribbon);
  return g;
}

function chest(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.75 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), wood);
  body.position.y = 0.25;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2;
  lid.position.y = 0.5;
  for (const x of [-0.36, 0, 0.36]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.62), gold);
    band.position.set(x, 0.25, 0);
    const arc = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.07, 16, 1, false, 0, Math.PI), gold);
    arc.rotation.z = Math.PI / 2;
    arc.position.set(x, 0.5, 0);
    g.add(band, arc);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), gold);
  lock.position.set(0, 0.42, 0.32);
  g.add(body, lid, lock);
  return g;
}

function vault(): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#7d8794', metalness: 0.8, roughness: 0.35 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.4), new THREE.MeshStandardMaterial({ color: '#5b5048', roughness: 0.9 }));
  frame.position.y = 1.3;
  const door = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.3, 40), steel);
  door.rotation.x = Math.PI / 2;
  door.position.set(0, 1.3, 0.3);
  const wheel = new THREE.Group();
  wheel.position.set(0, 1.3, 0.5);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 10, 30), gold));
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), gold);
    spoke.rotation.z = (i * Math.PI) / 3;
    wheel.add(spoke);
  }
  wheel.name = 'wheel';
  // seven slots around the door, one for each map piece
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const slot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), new THREE.MeshBasicMaterial({ color: '#ffe27a' }));
    slot.position.set(Math.sin(a) * 0.82, 1.3 + Math.cos(a) * 0.82, 0.46);
    g.add(slot);
  }
  g.add(frame, door, wheel);
  return g;
}

export class TreasureMarks {
  readonly group = new THREE.Group();
  private thing: THREE.Group | null = null;
  private glow: THREE.Sprite;
  private at: { x: number; z: number } | null = null;
  private kind: TreasureStep['kind'] | null = null;
  private stepId: string | null = null;

  constructor(private pois: Poi[]) {
    this.group.name = 'treasure';
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.glow.renderOrder = 5;
  }

  /** Shows the next step (or nothing when the treasure is found or the step has no place). */
  show(step: TreasureStep | null): void {
    if (step?.id === this.stepId) return;
    this.stepId = step?.id ?? null;
    if (this.thing) this.group.remove(this.thing);
    this.group.remove(this.glow);
    this.thing = null;
    this.at = step ? treasurePos(step.at, this.pois) : null;
    this.kind = step?.kind ?? null;
    if (!step || !this.at) return;
    this.thing = step.kind === 'vault' ? vault() : step.kind === 'chest' ? chest() : scroll();
    this.thing.position.set(this.at.x, 0, this.at.z);
    this.group.add(this.thing);
    this.glow.scale.setScalar(step.kind === 'vault' ? 4 : 1.8);
    this.glow.position.set(this.at.x, step.kind === 'vault' ? 1.3 : 0.9, this.at.z + (step.kind === 'vault' ? 0.6 : 0));
    this.group.add(this.glow);
  }

  get position(): { x: number; z: number } | null {
    return this.thing ? this.at : null;
  }

  get id(): string | null {
    return this.thing ? this.stepId : null;
  }

  setInside(inside: boolean): void {
    this.group.visible = !inside;
  }

  update(time: number, ground: number): void {
    const o = this.thing;
    if (!o) return;
    if (this.kind === 'free') {
      o.position.y = ground + 0.95 + Math.sin(time * 2.2) * 0.12;
      o.rotation.y = time * 1.4;
    } else {
      o.position.y = ground;
      o.getObjectByName('wheel')?.rotation.set(0, 0, Math.sin(time * 0.8) * 0.3);
    }
    this.glow.material.opacity = 0.65 + Math.sin(time * 3) * 0.25;
  }
}
