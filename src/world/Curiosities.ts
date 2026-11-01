import * as THREE from 'three';
import { CURIOSITIES } from '../content/curiosities';
import type { InteriorId } from '../content/interiors';
import type { Interiors } from './Interiors';
import { Marker } from './Markers';
import type { Poi } from './types';

/**
 * The gold "?" markers of "Did you know?" discoveries. City markers live in
 * their own group (hidden indoors); room markers are parented to their room,
 * so they show and hide with it.
 */
export class Curiosities {
  readonly group = new THREE.Group();
  private items: { id: string; room: InteriorId | null; marker: Marker }[] = [];

  constructor(pois: Poi[], interiors: Interiors) {
    this.group.name = 'curiosities';
    for (const c of CURIOSITIES) {
      if ('poi' in c.at) {
        const at = c.at;
        const poi = pois.find((p) => p.key === at.poi);
        if (!poi) continue;
        const m = new Marker('curio', poi.x + at.dx, 1.7, poi.z + at.dz, c.id);
        this.group.add(m.sprite);
        this.items.push({ id: c.id, room: null, marker: m });
      } else {
        const room = interiors.rooms.get(c.at.interior);
        if (!room) continue;
        const m = new Marker('curio', room.ox + c.at.x, 1.6, room.oz + c.at.z, c.id);
        room.group.add(m.sprite);
        this.items.push({ id: c.id, room: c.at.interior, marker: m });
      }
    }
  }

  setFound(found: string[]): void {
    for (const it of this.items) it.marker.setDone(found.includes(it.id));
  }

  setInside(room: InteriorId | null): void {
    this.group.visible = !room;
  }

  /** The closest discovery (found or not) in the player's current place. */
  nearest(p: THREE.Vector3, range: number, room: InteriorId | null): string | null {
    let best: string | null = null;
    let bd = range;
    for (const it of this.items) {
      if (it.room !== room) continue;
      const d = Math.hypot(p.x - it.marker.position.x, p.z - it.marker.position.z);
      if (d < bd) {
        bd = d;
        best = it.id;
      }
    }
    return best;
  }

  position(id: string): THREE.Vector3 | null {
    return this.items.find((i) => i.id === id)?.marker.position ?? null;
  }

  update(time: number, room: InteriorId | null, near: string | null): void {
    for (const it of this.items) if (it.room === room) it.marker.update(time, near === it.id);
  }
}
