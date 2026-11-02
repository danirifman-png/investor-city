import * as THREE from 'three';
import type { Slot } from '../content/shop';
import { loadGltf } from './AvatarNpc';
import type { PlayerController } from './PlayerController';
import { followHead, wearHelmet, type HeadFrame } from './riderGear';

/**
 * Shows what the player bought: hats, glasses and a backpack on the head
 * frame, a balloon on a string, a pet that follows, and a treat held in the
 * hand for a few seconds. Rides are swapped on the PlayerController.
 *
 * Worn things are fitted to whichever head is shown (sizes are relative to
 * the head), so they follow every hero model.
 */

const DIR = 'models/meshy/shop/';

interface WearFit {
  file: string;
  /** Width as a share of the head's width. */
  width: number;
  /** Height of the item's bottom as a share of the head's height. */
  sit: number;
  /** 'front': glasses on the face; 'back': below and behind the head. */
  place?: 'top' | 'front' | 'back';
  rotY?: number;
  tint?: string;
}
const WEAR: Record<string, WearFit> = {
  capPlain: { file: 'cap_baseball.glb', width: 1.12, sit: 0.6 },
  capBrand: { file: 'cap_baseball.glb', width: 1.12, sit: 0.6, tint: '#e2364b' },
  beanie: { file: 'beanie.glb', width: 1.1, sit: 0.55 },
  sunHat: { file: 'sun_hat.glb', width: 1.9, sit: 0.7 },
  crown: { file: 'crown_toy.glb', width: 0.8, sit: 0.88 },
  sunglasses: { file: 'sunglasses.glb', width: 0.92, sit: 0.42, place: 'front' },
  backpack: { file: 'backpack.glb', width: 1.5, sit: 0, place: 'back', rotY: Math.PI },
};

const PETS: Record<string, { file: string; hover?: boolean }> = {
  dog: { file: 'pet_dog.glb' },
  cat: { file: 'pet_cat.glb' },
  robotPet: { file: 'pet_robot.glb', hover: true },
};

const TREATS: Record<string, string> = {
  iceCream: 'ice_cream_cone.glb',
  milkshake: 'milkshake.glb',
  cottonCandy: 'cotton_candy.glb',
  popcorn: 'popcorn_box.glb',
  pizzaSlice: 'pizza_slice.glb',
};
/** Eating a treat: it is held up for a moment, then taken in bites (seconds from the start). */
const BITES = [1.3, 3.1, 4.9, 6.7];
const BITE_TIME = 1.0;
const EAT_SECONDS = BITES[BITES.length - 1] + BITE_TIME;
/** Where the hand holds the treat, relative to the mouth: in front of the chest, then up at the mouth. */
const HOLD_AT = new THREE.Vector3(-0.1, -0.32, 0.16);
const BITE_AT = new THREE.Vector3(-0.02, -0.13, 0.07);

/** How high the hand is raised during a bite (0..1, eased up, a short pause, eased down). */
export function biteLift(t: number): number {
  for (const b of BITES) {
    const u = (t - b) / BITE_TIME;
    if (u < 0 || u > 1) continue;
    const ease = (x: number) => x * x * (3 - 2 * x);
    return u < 0.35 ? ease(u / 0.35) : u < 0.65 ? 1 : ease((1 - u) / 0.35);
  }
  return 0;
}

/** How much of the treat is left at time t (1 whole, 0 eaten): a piece goes with each bite. */
export function treatLeft(t: number): number {
  let n = 0;
  for (const b of BITES) if (t >= b + BITE_TIME * 0.5) n++;
  return 1 - n / BITES.length;
}

const v = new THREE.Vector3();
const v2 = new THREE.Vector3();

async function model(file: string): Promise<THREE.Object3D> {
  const g = await loadGltf(DIR + file);
  const m = g.scene.clone(true);
  m.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  return m;
}

function tint(obj: THREE.Object3D, color: string): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    mat.color = new THREE.Color(color);
    m.material = mat;
  });
}

/** Fits a worn model to a head and returns the wrapper that follows it. */
function fitWorn(raw: THREE.Object3D, fit: WearFit, f: HeadFrame): THREE.Object3D {
  const size = f.box.getSize(new THREE.Vector3());
  const c = f.box.getCenter(new THREE.Vector3());
  raw.rotation.y = fit.rotY ?? 0;
  const mb = new THREE.Box3().setFromObject(raw);
  const ms = mb.getSize(new THREE.Vector3());
  const s = (size.x * fit.width) / Math.max(ms.x, 1e-3);
  raw.scale.setScalar(s);
  // centre the model on its own bottom middle
  raw.position.set(-((mb.min.x + mb.max.x) / 2) * s, -mb.min.y * s, -((mb.min.z + mb.max.z) / 2) * s);
  const wrap = new THREE.Group();
  wrap.add(raw);
  const at = new THREE.Vector3(c.x, f.box.min.y + size.y * fit.sit, c.z);
  if (fit.place === 'front') at.z = f.box.max.z + size.z * 0.02 - (ms.z * s) / 2;
  if (fit.place === 'back') {
    // hangs between the shoulders, just below the head
    at.y = f.box.min.y - ms.y * s * 1.05;
    at.z = f.box.min.z - (ms.z * s) * 0.15;
  }
  followHead(wrap, f, at, fit.place !== 'back');
  return wrap;
}

export class Gear {
  readonly group = new THREE.Group();
  private worn = new Map<string, THREE.Object3D>();
  private head: HeadFrame | null = null;
  private equipped: Partial<Record<Slot, string>> = {};
  private pet: { id: string; obj: THREE.Object3D; hover: boolean; t: number } | null = null;
  private balloon: { obj: THREE.Object3D; line: THREE.Line; t: number } | null = null;
  private treat: { obj: THREE.Object3D; t: number; size: number; bites: number; drink: boolean } | null = null;
  /** Bumped on every apply so that late model loads for old choices are dropped. */
  private gen = 0;

  constructor(private player: PlayerController) {
    this.group.name = 'gear';
  }

  apply(equipped: Partial<Record<Slot, string>>): void {
    this.equipped = { ...equipped };
    this.player.setRide(equipped.ride ?? null);
    this.refit();
    this.setPet(equipped.pet ?? null);
    this.setBalloon(equipped.back === 'balloon');
  }

  /** Takes worn things off and puts the equipped ones on the current head. */
  private refit(): void {
    const gen = ++this.gen;
    for (const o of this.worn.values()) o.removeFromParent();
    this.worn.clear();
    const head = (this.head = this.player.headFrame());
    if (!head) return;
    for (const slot of ['hat', 'glasses', 'back'] as const) {
      const id = this.equipped[slot];
      const fit = id ? WEAR[id] : undefined;
      if (!id || !fit) continue;
      void model(fit.file)
        .then((raw) => {
          if (gen !== this.gen) return;
          if (fit.tint) tint(raw, fit.tint);
          this.worn.set(slot, fitWorn(raw, fit, head));
        })
        .catch(() => undefined);
    }
  }

  private setPet(id: string | null): void {
    if (this.pet?.id === id) return;
    this.pet?.obj.removeFromParent();
    this.pet = null;
    const p = id ? PETS[id] : undefined;
    if (!id || !p) return;
    void model(p.file)
      .then((obj) => {
        if (this.equipped.pet !== id) return;
        this.pet?.obj.removeFromParent();
        this.group.add(obj);
        this.player.object.localToWorld(obj.position.set(0.9, 0, -0.9));
        this.pet = { id, obj, hover: !!p.hover, t: 0 };
      })
      .catch(() => undefined);
  }

  private setBalloon(on: boolean): void {
    if (!!this.balloon === on) return;
    if (!on) {
      this.balloon?.obj.removeFromParent();
      this.balloon?.line.removeFromParent();
      this.balloon = null;
      return;
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), new THREE.LineBasicMaterial({ color: '#f5f5f5' }));
    line.frustumCulled = false;
    const holder = new THREE.Group();
    this.balloon = { obj: holder, line, t: 0 };
    this.group.add(holder, line);
    void model('balloon.glb')
      .then((m) => {
        // the model is a balloon on a short string: keep it about 1 m tall
        const b = new THREE.Box3().setFromObject(m);
        const s = 1 / Math.max(b.max.y - b.min.y, 1e-3);
        m.scale.setScalar(s);
        m.position.y = -b.min.y * s;
        holder.add(m);
      })
      .catch(() => undefined);
    this.player.object.localToWorld(holder.position.set(-0.4, 1.6, -0.4));
  }

  /** Holds a treat and eats it in a few bites (waits while a window is open). */
  holdTreat(id: string): void {
    this.treat?.obj.removeFromParent();
    this.treat = null;
    const file = TREATS[id];
    const holder = new THREE.Group();
    // a bit larger than life so it reads on a phone screen
    if (file) void model(file).then((m) => holder.add(m)).catch(() => undefined);
    else if (id === 'apple') {
      const apple = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshStandardMaterial({ color: '#d8262e', roughness: 0.4 }));
      apple.position.y = 0.05;
      holder.add(apple);
    } else if (id === 'water') {
      // a small blue bottle with a white cap
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 12), new THREE.MeshStandardMaterial({ color: '#5ab8f0', roughness: 0.2, transparent: true, opacity: 0.85 }));
      bottle.position.y = 0.07;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.025, 10), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
      cap.position.y = 0.152;
      holder.add(bottle, cap);
    } else if (id === 'sandwich') {
      // two slices of bread with a green and red filling
      const bread = new THREE.MeshStandardMaterial({ color: '#e9c48a', roughness: 0.8 });
      for (const [y, c] of [[0.01, bread], [0.045, bread]] as const) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.09), c);
        b.position.y = y;
        holder.add(b);
      }
      const fill = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.016, 0.095), new THREE.MeshStandardMaterial({ color: '#6fbf5a' }));
      fill.position.y = 0.028;
      holder.add(fill);
    } else return;
    this.group.add(holder);
    holder.rotation.order = 'YXZ';
    this.treat = { obj: holder, t: 0, size: 1.6, bites: 0, drink: id === 'water' || id === 'milkshake' };
  }

  /** Call after the player has moved and been posed. */
  update(dt: number): void {
    const p = this.player;
    // a new hero model or look: fit again
    if (p.headFrame() !== this.head) this.refit();
    const riding = p.isRiding;
    for (const [slot, o] of this.worn) {
      // the helmet goes on instead of a hat while riding
      o.visible = !(riding && slot === 'hat') && p.object.visible;
      wearHelmet(o);
    }
    const yaw = p.heading;
    if (this.pet) {
      const pet = this.pet;
      pet.t += dt;
      // trots beside and a little behind
      p.object.localToWorld(v.set(0.95, 0, -0.9));
      v.y = p.position.y;
      const far = pet.obj.position.distanceTo(v);
      if (far > 8) pet.obj.position.copy(v);
      const k = 1 - Math.exp(-dt * 5);
      const before = v2.copy(pet.obj.position);
      pet.obj.position.x += (v.x - pet.obj.position.x) * k;
      pet.obj.position.z += (v.z - pet.obj.position.z) * k;
      const step = Math.hypot(pet.obj.position.x - before.x, pet.obj.position.z - before.z);
      const moving = step / Math.max(dt, 1e-3) > 0.4;
      if (moving) pet.obj.rotation.y = Math.atan2(pet.obj.position.x - before.x, pet.obj.position.z - before.z);
      else pet.obj.rotation.y += (yaw - pet.obj.rotation.y) * k * 0.3;
      pet.obj.position.y = p.position.y + (pet.hover ? 0.55 + Math.sin(pet.t * 2.6) * 0.06 : moving ? Math.abs(Math.sin(pet.t * 9)) * 0.09 : 0);
      pet.obj.visible = p.object.visible;
    }
    if (this.balloon) {
      const b = this.balloon;
      b.t += dt;
      p.rightHand(v2);
      p.object.localToWorld(v.set(-0.35, 1.7, -0.35));
      v.x += Math.sin(b.t * 1.3) * 0.12;
      v.z += Math.cos(b.t * 1.1) * 0.12;
      v.y = v2.y + 1.3;
      b.obj.position.lerp(v, 1 - Math.exp(-dt * 3));
      b.obj.rotation.z = Math.sin(b.t * 1.3) * 0.12;
      const pos = b.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      pos.setXYZ(0, v2.x, v2.y, v2.z);
      pos.setXYZ(1, b.obj.position.x, b.obj.position.y, b.obj.position.z);
      pos.needsUpdate = true;
      b.obj.visible = b.line.visible = p.object.visible;
    }
    if (this.treat) {
      const tr = this.treat;
      // the shop window may still be open: start eating once the player is back in the city
      if (!p.frozen) tr.t += dt;
      const t = tr.t;
      // raise the hand to hold it in front, then up to the mouth for each bite
      const hold = Math.min(1, t / 0.4) * Math.min(1, Math.max(0, (EAT_SECONDS + 0.4 - t) / 0.4));
      const lift = biteLift(t);
      v.copy(HOLD_AT).lerp(BITE_AT, lift);
      p.handNearMouth(v, hold);
      p.rightHand(tr.obj.position);
      tr.obj.rotation.y = yaw;
      // a drink tips toward the mouth for each sip
      tr.obj.rotation.x = tr.drink ? -lift * 1.15 : 0;
      // a piece goes with every bite; chew (the mouth moves) after each one
      const left = treatLeft(t);
      const bites = Math.round((1 - left) * BITES.length);
      if (bites > tr.bites) {
        tr.bites = bites;
        p.animator.speak?.(0.7);
      }
      const want = tr.size * (left > 0 ? 0.45 + 0.55 * left : 0);
      const now = tr.obj.scale.x;
      tr.obj.scale.setScalar(Math.max(0.0001, now + (want - now) * Math.min(1, dt * 10)));
      if (t >= EAT_SECONDS + 0.4) {
        tr.obj.removeFromParent();
        this.treat = null;
        p.animator.play('happy');
      }
    }
  }
}
