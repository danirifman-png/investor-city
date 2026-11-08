import * as THREE from 'three';
import { INTERIORS, type InteriorDef, type InteriorId } from '../content/interiors';
import { t } from '../i18n';
import { Batcher } from './Batcher';
import { mulberry32 } from './cityLayout';
import type { CollisionWorld } from './Collision';
import { Frame } from './Frame';
import { buildAcademyInterior, buildEstateInterior, buildExchangeInterior, buildNewsInterior, buildStartupInterior } from './interiors/missionRooms';
import { buildBankInterior, buildHomeInterior, buildPizzeriaInterior } from './interiors/rooms';
import { FURNITURE } from '../content/home';
import { loadGltf } from '../character/AvatarNpc';
import { buildSkyLandInterior, roomPortal } from './interiors/skyLand';
import { buildMallInterior } from './interiors/mall';
import { buildIslandInterior } from './interiors/island';
import type { CityMaterials } from './Materials';
import { Marker } from './Markers';
import { buildPortal, type Portal } from './Portal';
import { FINISHES, metreUVs, surfaceMaterial, type Finish } from './interiors/finish';
import { ModelLayer } from './ModelLayer';
import type { Animator, BuildContext, Poi } from './types';

/**
 * Walk-in buildings. Each room is a little diorama built far outside the city
 * (so it shares the collision world and the player controller), with no
 * ceiling and walls that fade when they stand between the camera and the
 * player, so the follow camera keeps working indoors. Entering hides the
 * city and moves the room's owner inside; leaving puts everything back.
 */

const ORIGIN = { x: 620, z: 620 };
const SPACING = 60;
const INTERIOR_COUNT = Object.keys(INTERIORS).length;
const WALL_HEIGHT = 3.4;
const WALL_T = 0.3;
const DOOR_W = 1.8;

const ROOM_BUILDERS: Record<InteriorId, (f: Frame, ctx: BuildContext) => void> = {
  pizzeria: buildPizzeriaInterior,
  bank: buildBankInterior,
  exchange: buildExchangeInterior,
  academy: buildAcademyInterior,
  newsTower: buildNewsInterior,
  startupHub: buildStartupInterior,
  realEstateAgency: buildEstateInterior,
  skyLand: buildSkyLandInterior,
  home: buildHomeInterior,
  mall: buildMallInterior,
  island: buildIslandInterior,
};

export interface Room {
  def: InteriorDef;
  ox: number;
  oz: number;
  group: THREE.Group;
  walls: { parts: THREE.Mesh[]; nx: number; nz: number; offset: number }[];
  markers: Marker[];
  animators: Animator[];
}

export interface Door {
  id: InteriorId;
  x: number;
  z: number;
  y: number;
  /** A building door has a floating arrow; a portal shows itself. */
  marker: Marker | null;
}

export class Interiors {
  readonly group = new THREE.Group();
  readonly doorGroup = new THREE.Group();
  readonly rooms = new Map<InteriorId, Room>();
  readonly doors: Door[] = [];
  current: InteriorId | null = null;
  private stage: THREE.Mesh;
  private mats: THREE.Mesh[] = [];
  private portals: Portal[] = [];
  private tmp = new THREE.Vector3();

  constructor(collision: CollisionWorld, materials: CityMaterials, pois: Poi[]) {
    this.group.name = 'interiors';
    this.doorGroup.name = 'doors';
    Object.values(INTERIORS).forEach((def, i) => {
      const room = this.build(def, ORIGIN.x + i * SPACING, ORIGIN.z, collision, materials);
      this.rooms.set(def.id, room);
      this.group.add(room.group);
      if (def.at) {
        this.doors.push({ id: def.id, x: def.at.x, z: def.at.z, y: def.at.y, marker: null });
        const portal = buildPortal();
        portal.object.position.set(def.at.x, def.at.y, def.at.z);
        this.doorGroup.add(portal.object);
        this.portals.push(portal);
      }
      const poi = def.poi ? pois.find((p) => p.key === def.poi) : undefined;
      if (poi) {
        const marker = new Marker('door', poi.x + def.door.dx, def.door.y + 2.7, poi.z + def.door.dz, def.id);
        this.doorGroup.add(marker.sprite);
        this.doors.push({ id: def.id, x: poi.x + def.door.dx, z: poi.z + def.door.dz, y: def.door.y, marker });
        const dm = doorMat(poi.x + def.door.dx, def.door.y, poi.z + def.door.dz);
        this.mats.push(dm);
        this.doorGroup.add(dm);
      }
    });
    // a dark stage under the rooms, so they read as dioramas rather than floating boxes
    const stage = (this.stage = new THREE.Mesh(new THREE.CircleGeometry(260, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#241d30', fog: false })));
    stage.position.set(ORIGIN.x + (SPACING * (INTERIOR_COUNT - 1)) / 2, -0.35, ORIGIN.z);
    this.group.add(stage);
    this.group.visible = false;
  }

  private build(def: InteriorDef, ox: number, oz: number, collision: CollisionWorld, materials: CityMaterials): Room {
    const group = new THREE.Group();
    group.name = `room:${def.id}`;
    const dynamic = new THREE.Group();
    const animators: Animator[] = [];
    const batch = new Batcher(collision);
    const models = new ModelLayer(collision);
    group.add(models.root);
    const ctx: BuildContext = {
      batch,
      dynamic,
      materials,
      models,
      rng: mulberry32(def.id.length * 977),
      addAnimator: (fn) => animators.push(fn),
      addPoi: () => undefined,
      onNight: () => undefined,
    };
    const f = new Frame(ctx, ox, oz, 0, 0);
    // rooms are small: load their models right away
    queueMicrotask(() => void models.preload(ox, oz, Infinity));
    ROOM_BUILDERS[def.id](f, ctx);
    for (const s of def.hotspots) if (s.kind === 'portal') roomPortal(f, ctx, s.x, s.z, Math.PI / 2);
    const walls: Room['walls'] = [];
    if (!def.open) this.buildWalls(def, ox, oz, group, walls, collision);
    const markers: Marker[] = def.hotspots.map((s) => new Marker(s.kind === 'mission' || s.kind === 'life' || s.kind === 'rest' || s.kind === 'kitchen' || s.kind === 'shop' || s.kind === 'travel' || s.kind === 'coconut' ? 'game' : s.kind === 'portal' || s.kind === 'fly' ? 'door' : s.kind, ox + s.x, s.y ?? 1.6, oz + s.z, s.id));
    for (const m of markers) group.add(m.sprite);

    const staticMeshes = batch.build(materials.byKey);
    staticMeshes.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    group.add(staticMeshes, dynamic);
    return { def, ox, oz, group, walls, markers, animators };
  }

  /** Four walls with a doorway, the room's own floor, panelling, windows and lamps (see interiors/finish.ts). */
  private buildWalls(def: InteriorDef, ox: number, oz: number, group: THREE.Group, walls: Room['walls'], collision: CollisionWorld): void {
    const { w, d } = def.size;
    const WALL_H = def.wallH ?? WALL_HEIGHT;
    const fin = FINISHES[def.id];
    const seed = def.id.length * 131 + w;

    // the floor, over the builder's plain one
    if (fin) {
      const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
      const floorMesh = new THREE.Mesh(g, surfaceMaterial(fin.floor, seed));
      floorMesh.position.set(ox, 0.047, oz);
      floorMesh.receiveShadow = true;
      group.add(floorMesh);
    }

    const trimMat = () => new THREE.MeshStandardMaterial({ color: fin?.trim ?? '#d8cfc2', roughness: 0.5, transparent: true });
    // walls are separate meshes so each can fade on its own; panelling, trim and windows fade with their wall
    const wall = (cx: number, cz: number, sx: number, sz: number, nx: number, nz: number) => {
      const parts: THREE.Mesh[] = [];
      const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(ox + x, y, oz + z);
        m.receiveShadow = true;
        group.add(m);
        parts.push(m);
        return m;
      };
      const mat = fin ? surfaceMaterial(fin.wall, seed + 1, true) : new THREE.MeshStandardMaterial({ color: def.style?.wall ?? '#efe6d2', roughness: 0.85, transparent: true });
      add(metreUVs(new THREE.BoxGeometry(sx, WALL_H, sz), sx, WALL_H, sz), mat, cx, WALL_H / 2, cz);
      collision.add({ x0: ox + cx - sx / 2, z0: oz + cz - sz / 2, x1: ox + cx + sx / 2, z1: oz + cz + sz / 2, bottom: 0, top: WALL_H, water: false });
      if (fin) {
        const len = nx ? sz : sx;
        // a strip on the inner face: depth t, from y0 to y1
        const strip = (t: number, y0: number, y1: number, m: THREE.Material, uvs = false) => {
          const ix = cx - nx * (WALL_T / 2 + t / 2);
          const iz = cz - nz * (WALL_T / 2 + t / 2);
          const bx = nx ? t : len;
          const bz = nx ? len : t;
          const geo = new THREE.BoxGeometry(bx, y1 - y0, bz);
          add(uvs ? metreUVs(geo, bx, y1 - y0, bz) : geo, m, ix, (y0 + y1) / 2, iz);
        };
        if (fin.wainscot) {
          strip(0.04, 0, fin.wainscot.h, surfaceMaterial(fin.wainscot, seed + 2, true), true);
          strip(0.07, fin.wainscot.h - 0.03, fin.wainscot.h + 0.04, trimMat());
        }
        strip(0.06, 0, 0.14, trimMat());
        strip(0.1, WALL_H - 0.14, WALL_H, trimMat());
        // windows with daylight on the side walls
        if (fin.windows && nx) {
          for (const wz of [-d / 4, d / 4]) {
            const fx = cx - nx * (WALL_T / 2 + 0.03);
            const pane = add(new THREE.PlaneGeometry(1.5, 1.5).rotateY(-nx * Math.PI / 2), windowMaterial(), fx, 1.95, wz);
            pane.receiveShadow = false;
            const fm = trimMat();
            for (const [bw, bh, y, z] of [
              [1.66, 0.08, 2.74, wz],
              [1.66, 0.12, 1.16, wz],
              [0.08, 1.6, 1.95, wz - 0.79],
              [0.08, 1.6, 1.95, wz + 0.79],
              [0.05, 1.5, 1.95, wz],
              [1.5, 0.05, 1.95, wz],
            ] as const) {
              add(new THREE.BoxGeometry(0.08, bh, bw), fm, cx - nx * (WALL_T / 2 + 0.05), y, z);
            }
          }
        }
      }
      // the offset along the outward normal where "outside" begins
      walls.push({ parts, nx, nz, offset: nx ? Math.abs(cx) : Math.abs(cz) });
    };
    wall(0, -d / 2, w + WALL_T * 2, WALL_T, 0, -1);
    wall(-w / 2, 0, WALL_T, d, -1, 0);
    wall(w / 2, 0, WALL_T, d, 1, 0);
    const side = (w - DOOR_W) / 2;
    wall(-(DOOR_W / 2 + side / 2), d / 2, side, WALL_T, 0, 1);
    wall(DOOR_W / 2 + side / 2, d / 2, side, WALL_T, 0, 1);
    // the doorway itself: you leave with the exit button, not by walking into the void
    collision.add({ x0: ox - DOOR_W / 2, z0: oz + d / 2 - WALL_T / 2, x1: ox + DOOR_W / 2, z1: oz + d / 2 + WALL_T, bottom: 0, top: WALL_H, water: false });
    const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, 2.6), new THREE.MeshBasicMaterial({ color: '#fff4d6', transparent: true, opacity: 0.85 }));
    doorGlow.position.set(ox, 1.3, oz + d / 2 + 0.05);
    doorGlow.rotation.y = Math.PI;
    group.add(doorGlow);

    if (!fin) {
      const lamp = new THREE.PointLight(def.style?.lamp ?? '#fff1d6', 26, 22, 1.6);
      lamp.position.set(ox, 3.2, oz - 0.5);
      group.add(lamp);
      return;
    }
    // two lights and four lamps hanging from the (unseen) ceiling
    for (const lz of [-d / 4, d / 4]) {
      const light = new THREE.PointLight(fin.lamp.color, fin.lamp.intensity * 1.6, 18, 1.4);
      light.position.set(ox, 3.0, oz + lz);
      group.add(light);
    }
    // tall rooms (the mall) light themselves
    if (!def.wallH) for (const lx of [-w / 4, w / 4]) for (const lz of [-d / 4, d / 4]) group.add(lampFixture(fin, ox + lx, oz + lz));
  }

  private furniture = new Map<string, THREE.Object3D>();
  private mattress: THREE.Object3D | null = null;

  /**
   * Shows the furniture the player owns in their home (models load as they
   * arrive; a coloured block stands in until then). Without a bed, a
   * mattress on the floor.
   */
  setFurniture(owned: string[]): void {
    const room = this.rooms.get('home');
    if (!room) return;
    for (const [id, o] of this.furniture) {
      if (owned.includes(id)) continue;
      o.removeFromParent();
      this.furniture.delete(id);
    }
    for (const id of owned) {
      const fit = FURNITURE[id];
      if (!fit || this.furniture.has(id)) continue;
      const holder = new THREE.Group();
      holder.name = `furniture:${id}`;
      holder.position.set(room.ox + fit.x, 0.05, room.oz + fit.z);
      holder.rotation.y = fit.rotY;
      const [bw, bh, bd, color] = fit.box;
      const block = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
      block.position.y = bh / 2;
      block.castShadow = true;
      holder.add(block);
      room.group.add(holder);
      this.furniture.set(id, holder);
      void loadGltf(`models/meshy/furniture/${id}.glb`)
        .then((g) => {
          const m = g.scene.clone(true);
          const box = new THREE.Box3().setFromObject(m);
          const size = box.getSize(new THREE.Vector3());
          // the models are made at real size; only an oversized one is scaled down to its spot
          const s = Math.min(1, (fit.width * 1.05) / Math.max(size.x, size.z, 1e-3));
          m.scale.setScalar(s);
          m.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s + (id === 'rug' ? 0.005 : 0), -((box.min.z + box.max.z) / 2) * s);
          m.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o.castShadow = true), (o.receiveShadow = true)) : null));
          block.visible = false;
          holder.add(m);
          if (id === 'lamp') {
            // a warm glow from the shade
            const glow = new THREE.PointLight('#ffd9a0', 4, 6, 1.6);
            glow.position.y = 1.45;
            holder.add(glow);
          }
        })
        .catch(() => undefined);
    }
    // a mattress on the floor until there is a bed
    if (!owned.includes('bed') && !this.mattress) {
      const fit = FURNITURE.bed;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 1.9), new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.9 }));
      m.position.set(room.ox + fit.x, 0.13, room.oz + fit.z);
      m.receiveShadow = true;
      room.group.add(m);
      this.mattress = m;
    } else if (owned.includes('bed') && this.mattress) {
      this.mattress.removeFromParent();
      this.mattress = null;
    }
  }

  /** A point in a room's own coordinates, in world space. */
  toWorld(id: InteriorId, x: number, z: number): { x: number; z: number } {
    const r = this.rooms.get(id)!;
    return { x: r.ox + x, z: r.oz + z };
  }

  /** Where the player appears inside (just in from the door, facing the room). */
  entry(id: InteriorId): { x: number; z: number; heading: number } {
    const r = this.rooms.get(id)!;
    if (r.def.entry) return { x: r.ox + r.def.entry.x, z: r.oz + r.def.entry.z, heading: Math.PI };
    return { x: r.ox, z: r.oz + r.def.size.d / 2 - 2.8, heading: Math.PI };
  }

  /** Where the player appears outside when leaving (in front of the door, facing the street). */
  exit(id: InteriorId): { x: number; z: number; y: number; heading: number } {
    // Adventure Island has no door in the city (only the plane reaches it): its way out is the mall, where the agency is
    const door = this.doors.find((d) => d.id === id) ?? this.doors.find((d) => d.id === 'mall')!;
    return { x: door.x, z: door.z + 1.4, y: door.y, heading: 0 };
  }

  setInside(id: InteriorId | null): void {
    this.current = id;
    this.group.visible = !!id;
    for (const [rid, r] of this.rooms) r.group.visible = rid === id;
    this.doorGroup.visible = !id;
    this.stage.visible = !!id && !INTERIORS[id].open;
  }

  roomName(id: InteriorId): string {
    return t(`interior.${id}.name`);
  }

  /** The nearest door (outside) or hotspot (inside) within `range` metres of `p`. */
  nearest(p: THREE.Vector3, range: number): { kind: 'door'; id: InteriorId } | { kind: 'spot'; room: InteriorId; spot: string } | null {
    if (!this.current) {
      let best: Door | null = null;
      let bd = range;
      for (const d of this.doors) {
        const dist = Math.hypot(p.x - d.x, p.z - d.z);
        if (dist < bd) {
          bd = dist;
          best = d;
        }
      }
      return best ? { kind: 'door', id: best.id } : null;
    }
    const r = this.rooms.get(this.current)!;
    let best: Marker | null = null;
    let bd = range;
    for (const m of r.markers) {
      // a marker on another floor (the mall) is out of reach
      if (r.def.wallH && Math.abs(m.position.y - p.y - 2) > 2.6) continue;
      const dist = Math.hypot(p.x - m.position.x, p.z - m.position.z);
      if (dist < bd) {
        bd = dist;
        best = m;
      }
    }
    return best ? { kind: 'spot', room: r.def.id, spot: best.id } : null;
  }

  marker(room: InteriorId, spot: string): Marker | undefined {
    return this.rooms.get(room)?.markers.find((m) => m.id === spot);
  }

  update(time: number, dt: number, camera: THREE.Camera, near: string | null): void {
    if (!this.current) {
      for (const d of this.doors) d.marker?.update(time, near === `door:${d.id}`);
      for (const p of this.portals) p.update(time);
      for (const m of this.mats) ((m.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(time * 3) * 0.15);
      return;
    }
    const r = this.rooms.get(this.current)!;
    for (const fn of r.animators) fn(time, dt);
    for (const m of r.markers) m.update(time, near === `spot:${m.id}`);
    // fade every wall that stands between the camera and the player
    const cam = camera.getWorldPosition(this.tmp);
    const cx = cam.x - r.ox;
    const cz = cam.z - r.oz;
    for (const wl of r.walls) {
      const along = wl.nx ? cx * wl.nx : cz * wl.nz;
      const hide = along > wl.offset - 0.2;
      const target = hide ? 0.12 : 1;
      for (const part of wl.parts) {
        const mat = part.material as THREE.MeshStandardMaterial;
        mat.opacity += (target - mat.opacity) * Math.min(1, dt * 8);
        mat.depthWrite = mat.opacity > 0.9;
        part.castShadow = !hide;
      }
    }
  }
}

/** A glowing mat on the ground in front of a door: step on it and walk in. */
function doorMat(x: number, y: number, z: number): THREE.Mesh {
  const mat = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7dffb0', transparent: true, opacity: 0.4, depthWrite: false }));
  mat.position.set(x, y + 0.04, z);
  mat.renderOrder = 2;
  mat.name = 'door-mat';
  return mat;
}

let windowTex: THREE.Texture | null = null;

/** Daylight through a window: a soft sky with a hint of trees and buildings far away. */
function windowMaterial(): THREE.MeshBasicMaterial {
  if (!windowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#9fd0ff');
    g.addColorStop(0.65, '#e4f3ff');
    g.addColorStop(1, '#cfe6c8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(150,170,190,0.55)';
    for (const [x, w, h] of [[6, 18, 40], [30, 14, 26], [80, 22, 46], [106, 16, 30]]) ctx.fillRect(x, 128 - 24 - h, w, h);
    ctx.fillStyle = 'rgba(110,160,100,0.7)';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(i * 16 + 6, 110, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    windowTex = new THREE.CanvasTexture(c);
    windowTex.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshBasicMaterial({ map: windowTex, transparent: true, fog: false });
}

/** A ceiling lamp hanging over the room (pendant shade, opal globe or a small spot). */
function lampFixture(fin: Finish, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const shade = new THREE.MeshStandardMaterial({ color: fin.lamp.shade, roughness: 0.4, metalness: fin.lamp.style === 'globe' ? 0.6 : 0.2 });
  const bulb = new THREE.MeshBasicMaterial({ color: fin.lamp.color });
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), shade);
  cord.position.y = WALL_HEIGHT + 0.05 - 0.35;
  g.add(cord);
  if (fin.lamp.style === 'pendant') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.26, 20, 1, true), shade);
    cone.material.side = THREE.DoubleSide;
    cone.position.y = WALL_HEIGHT - 0.4;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), bulb);
    b.position.y = WALL_HEIGHT - 0.5;
    g.add(cone, b);
  } else if (fin.lamp.style === 'globe') {
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: fin.lamp.color, emissiveIntensity: 0.9, roughness: 0.3 }));
    glass.position.y = WALL_HEIGHT - 0.5;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.08, 12), shade);
    cap.position.y = WALL_HEIGHT - 0.3;
    g.add(glass, cap);
  } else {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.22, 14), shade);
    can.position.y = WALL_HEIGHT - 0.45;
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14).rotateX(Math.PI / 2), bulb);
    b.position.y = WALL_HEIGHT - 0.57;
    g.add(can, b);
  }
  return g;
}
