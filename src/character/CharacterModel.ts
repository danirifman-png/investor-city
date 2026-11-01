import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CharacterLook } from '../content/characterOptions';

/**
 * The player character: a stylised kid built from primitives on a joint
 * hierarchy (a hand-built skeleton). Each joint is an Object3D pivot, so the
 * animator poses it exactly like bones of a skinned GLTF rig would be posed.
 * Building it in code keeps every look option (hair, clothes, accessories)
 * swappable at runtime without shipping dozens of model files.
 *
 * The character faces +z. Its right side is -x.
 */

const SCALE: Record<CharacterLook['build'], number> = { regular: 1, tall: 1.08, short: 0.92 };

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  head: THREE.Group;
  lShoulder: THREE.Group;
  lElbow: THREE.Group;
  rShoulder: THREE.Group;
  rElbow: THREE.Group;
  lHip: THREE.Group;
  lKnee: THREE.Group;
  rHip: THREE.Group;
  rKnee: THREE.Group;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, rough = 0.7): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}`;
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness: rough })));
  return m;
}

function mesh(geo: THREE.BufferGeometry, color: string, rough?: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color, rough));
  m.castShadow = true;
  return m;
}

/** Capsule hanging down from its pivot (top at y = 0). */
function limb(radius: number, length: number, color: string): THREE.Mesh {
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 4, 10);
  geo.translate(0, -length / 2, 0);
  return mesh(geo, color);
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const HEAD_R = 0.27;

function buildHair(look: CharacterLook, head: THREE.Group): void {
  const c = look.hairColor;
  const covered = look.headwear === 'cap' || look.headwear === 'beanie';
  // the base cap of hair every style shares
  const capGeo = new THREE.SphereGeometry(HEAD_R + 0.018, 18, 12, 0, Math.PI * 2, 0, Math.PI * (look.hairStyle === 'buzz' ? 0.42 : 0.52));
  const cap = mesh(capGeo, c, 0.85);
  cap.rotation.x = -0.25; // sits a little back so the forehead shows
  cap.position.y = 0.01;
  head.add(cap);
  if (look.hairStyle !== 'buzz') {
    const fringe = mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI, 0, Math.PI / 2).scale(0.2, 0.08, 0.1), c, 0.85);
    fringe.rotation.y = -Math.PI / 2;
    fringe.position.set(0, 0.17, 0.2);
    head.add(fringe);
  }
  switch (look.hairStyle) {
    case 'spiky':
      if (covered) break;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const spike = mesh(new THREE.ConeGeometry(0.07, 0.2, 6), c, 0.85);
        spike.position.set(Math.sin(a) * 0.14, 0.27, Math.cos(a) * 0.12 - 0.03);
        spike.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
        head.add(spike);
      }
      break;
    case 'curly':
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const ring = i % 2 ? 0.2 : 0.25;
        const curl = mesh(new THREE.SphereGeometry(0.085, 8, 6), c, 0.9);
        curl.position.set(Math.sin(a) * ring, covered ? 0.02 : 0.15 + (i % 2) * 0.06, Math.cos(a) * ring - 0.03);
        head.add(curl);
      }
      break;
    case 'long': {
      const back = mesh(new THREE.CapsuleGeometry(0.2, 0.32, 4, 10).scale(1.25, 1, 0.55), c, 0.85);
      back.position.set(0, -0.12, -0.15);
      head.add(back);
      for (const s of [-1, 1]) {
        const lock = mesh(new THREE.CapsuleGeometry(0.07, 0.3, 4, 8), c, 0.85);
        lock.position.set(s * 0.24, -0.1, 0.02);
        head.add(lock);
      }
      break;
    }
    case 'ponytail': {
      const tie = mesh(new THREE.SphereGeometry(0.06, 8, 6), look.topColor);
      tie.position.set(0, 0.08, -0.29);
      const tail = mesh(new THREE.CapsuleGeometry(0.08, 0.28, 4, 8), c, 0.85);
      tail.position.set(0, -0.12, -0.33);
      tail.rotation.x = 0.25;
      head.add(tie, tail);
      break;
    }
    case 'bun': {
      if (covered) break;
      const bun = mesh(new THREE.SphereGeometry(0.12, 10, 8), c, 0.85);
      bun.position.set(0, 0.27, -0.1);
      head.add(bun);
      break;
    }
  }
}

function buildHeadwear(look: CharacterLook, head: THREE.Group): void {
  const c = look.headwearColor;
  if (look.headwear === 'cap') {
    const dome = mesh(new THREE.SphereGeometry(HEAD_R + 0.035, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), c);
    dome.position.y = 0.02;
    const brim = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 16, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.2), c);
    brim.position.set(0, 0.1, 0.2);
    brim.rotation.x = 0.12;
    head.add(dome, brim);
  } else if (look.headwear === 'beanie') {
    const dome = mesh(new THREE.SphereGeometry(HEAD_R + 0.04, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 1.15, 1), c, 0.95);
    dome.position.y = 0.02;
    const band = mesh(new THREE.CylinderGeometry(HEAD_R + 0.045, HEAD_R + 0.045, 0.08, 20), '#f4f4f4', 0.95);
    band.position.y = 0.05;
    const pom = mesh(new THREE.SphereGeometry(0.07, 8, 6), '#f4f4f4', 0.95);
    pom.position.y = 0.38;
    head.add(dome, band, pom);
  } else if (look.headwear === 'headphones') {
    const band = mesh(new THREE.TorusGeometry(HEAD_R + 0.04, 0.025, 6, 20, Math.PI), c);
    band.position.y = 0.02;
    head.add(band);
    for (const s of [-1, 1]) {
      const cup = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14), c);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(s * (HEAD_R + 0.03), 0.0, 0);
      head.add(cup);
    }
  }
}

function buildEyewear(look: CharacterLook, head: THREE.Group): void {
  if (look.eyewear === 'none') return;
  const sun = look.eyewear === 'sunglasses';
  const frame = sun ? '#1d1f24' : '#3a3f46';
  for (const s of [-1, 1]) {
    if (sun) {
      const lens = mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 14), '#1d1f24', 0.2);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(s * 0.09, 0.03, HEAD_R - 0.005);
      head.add(lens);
    } else {
      const ring = mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16), frame);
      ring.position.set(s * 0.09, 0.03, HEAD_R - 0.0);
      head.add(ring);
    }
  }
  const bridge = mesh(new THREE.BoxGeometry(0.06, 0.014, 0.014), frame);
  bridge.position.set(0, 0.04, HEAD_R + 0.005);
  head.add(bridge);
}

function buildFace(look: CharacterLook, head: THREE.Group): void {
  for (const s of [-1, 1]) {
    const white = mesh(new THREE.SphereGeometry(0.05, 10, 8), '#ffffff', 0.4);
    white.scale.set(1, 1.15, 0.6);
    white.position.set(s * 0.09, 0.03, HEAD_R - 0.03);
    const pupil = mesh(new THREE.SphereGeometry(0.03, 8, 6), '#1d1f24', 0.3);
    pupil.position.set(s * 0.09, 0.025, HEAD_R - 0.0);
    const shine = mesh(new THREE.SphereGeometry(0.01, 6, 4), '#ffffff', 0.2);
    shine.position.set(s * 0.09 + 0.012, 0.04, HEAD_R + 0.025);
    const brow = mesh(new THREE.BoxGeometry(0.075, 0.016, 0.02), look.hairColor);
    brow.position.set(s * 0.09, 0.11, HEAD_R - 0.02);
    brow.rotation.z = s * -0.12;
    const cheek = mesh(new THREE.SphereGeometry(0.035, 8, 6), '#f19a9a', 0.9);
    cheek.scale.set(1, 0.6, 0.3);
    cheek.position.set(s * 0.15, -0.05, HEAD_R - 0.05);
    head.add(white, pupil, shine, brow, cheek);
  }
  const smile = mesh(new THREE.TorusGeometry(0.05, 0.011, 6, 12, Math.PI), '#7a3b2e', 0.5);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.07, HEAD_R - 0.01);
  const nose = mesh(new THREE.SphereGeometry(0.025, 8, 6), look.skin);
  nose.position.set(0, -0.01, HEAD_R + 0.005);
  head.add(smile, nose);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.05, 8, 6), look.skin);
    ear.scale.set(0.6, 1, 0.8);
    ear.position.set(s * (HEAD_R - 0.01), 0, -0.01);
    head.add(ear);
  }
}

export function buildCharacter(look: CharacterLook): Rig {
  const root = new THREE.Group();
  root.name = 'character';
  const body = joint(root, 0, 0, 0);
  const s = SCALE[look.build];
  body.scale.setScalar(s);

  const legLen = 0.7;
  const hips = joint(body, 0, legLen, 0);

  // pelvis
  const pelvis = mesh(new THREE.SphereGeometry(0.2, 12, 8).scale(1.1, 0.7, 0.85), look.bottom === 'skirt' ? look.bottomColor : look.bottomColor);
  pelvis.position.y = 0.02;
  hips.add(pelvis);
  if (look.bottom === 'skirt') {
    const skirt = mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.3, 16), look.bottomColor);
    skirt.position.y = -0.1;
    hips.add(skirt);
  }

  // legs
  const legs: [THREE.Group, THREE.Group][] = [];
  for (const side of [1, -1]) {
    const hip = joint(hips, side * 0.1, -0.02, 0);
    const upperColor = look.bottom === 'skirt' ? look.skin : look.bottomColor;
    const lowerColor = look.bottom === 'jeans' ? look.bottomColor : look.skin;
    hip.add(limb(0.085, 0.36, upperColor));
    const knee = joint(hip, 0, -0.34, 0);
    knee.add(limb(0.075, 0.32, lowerColor));
    if (look.bottom === 'shorts') {
      const cuff = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), look.bottomColor);
      cuff.position.y = 0.0;
      knee.add(cuff);
    }
    const shoe = mesh(new THREE.BoxGeometry(0.15, 0.09, 0.26), look.shoeColor, 0.5);
    shoe.position.set(0, -0.32, 0.04);
    const sole = mesh(new THREE.BoxGeometry(0.16, 0.025, 0.27), '#f4f4f4', 0.6);
    sole.position.set(0, -0.36, 0.04);
    knee.add(shoe, sole);
    legs.push([hip, knee]);
  }

  // torso
  const spine = joint(hips, 0, 0.05, 0);
  const torso = mesh(new THREE.CapsuleGeometry(0.2, 0.24, 4, 12).scale(1.12, 1, 0.78), look.topColor);
  torso.position.y = 0.24;
  spine.add(torso);
  if (look.top === 'hoodie') {
    const hood = mesh(new THREE.TorusGeometry(0.13, 0.06, 8, 16, Math.PI).rotateX(Math.PI / 2 + 0.6), look.topColor, 0.85);
    hood.rotation.z = Math.PI;
    hood.position.set(0, 0.48, -0.08);
    const pocket = mesh(new THREE.BoxGeometry(0.24, 0.1, 0.03), look.topColor, 0.95);
    pocket.position.set(0, 0.14, 0.16);
    const strings = mesh(new THREE.BoxGeometry(0.1, 0.12, 0.01), '#f4f4f4');
    strings.position.set(0, 0.38, 0.16);
    spine.add(hood, pocket, strings);
  } else if (look.top === 'shirt') {
    for (const sx of [-1, 1]) {
      const collar = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.06), '#ffffff');
      collar.position.set(sx * 0.06, 0.47, 0.11);
      collar.rotation.z = sx * 0.4;
      spine.add(collar);
    }
    for (let i = 0; i < 3; i++) {
      const button = mesh(new THREE.SphereGeometry(0.014, 6, 4), '#ffffff');
      button.position.set(0, 0.36 - i * 0.1, 0.17);
      spine.add(button);
    }
  } else {
    const print = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 16), '#ffffff', 0.9);
    print.rotation.x = Math.PI / 2;
    print.position.set(0, 0.3, 0.165);
    const coin = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16), '#e7b83c', 0.4);
    coin.rotation.x = Math.PI / 2;
    coin.position.set(0, 0.3, 0.17);
    spine.add(print, coin);
  }
  if (look.backwear === 'backpack') {
    const pack = mesh(new THREE.BoxGeometry(0.3, 0.34, 0.14), look.backwearColor, 0.8);
    pack.position.set(0, 0.26, -0.21);
    const flap = mesh(new THREE.BoxGeometry(0.31, 0.1, 0.15), look.backwearColor, 0.6);
    flap.position.set(0, 0.4, -0.21);
    const pocket = mesh(new THREE.BoxGeometry(0.2, 0.1, 0.05), '#2c2f36', 0.8);
    pocket.position.set(0, 0.16, -0.29);
    spine.add(pack, flap, pocket);
    for (const sx of [-1, 1]) {
      const strap = mesh(new THREE.BoxGeometry(0.04, 0.3, 0.02), '#2c2f36');
      strap.position.set(sx * 0.12, 0.3, 0.16);
      spine.add(strap);
    }
  }

  // neck and head
  const neck = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), look.skin);
  neck.position.y = 0.5;
  spine.add(neck);
  const head = joint(spine, 0, 0.78, 0);
  const skull = mesh(new THREE.SphereGeometry(HEAD_R, 20, 16), look.skin, 0.6);
  skull.scale.set(1, 0.98, 0.95);
  head.add(skull);
  buildFace(look, head);
  buildHair(look, head);
  buildHeadwear(look, head);
  buildEyewear(look, head);

  // arms
  const arms: [THREE.Group, THREE.Group][] = [];
  for (const side of [1, -1]) {
    const shoulder = joint(spine, side * 0.27, 0.43, 0);
    const longSleeve = look.top !== 'tshirt';
    shoulder.add(limb(0.07, 0.27, look.topColor));
    const elbow = joint(shoulder, 0, -0.25, 0);
    elbow.add(limb(0.06, 0.24, longSleeve ? look.topColor : look.skin));
    const hand = mesh(new THREE.SphereGeometry(0.065, 10, 8), look.skin);
    hand.position.y = -0.26;
    elbow.add(hand);
    arms.push([shoulder, elbow]);
  }

  compactRig(root);
  return {
    root,
    body,
    hips,
    spine,
    head,
    lShoulder: arms[0][0],
    lElbow: arms[0][1],
    rShoulder: arms[1][0],
    rElbow: arms[1][1],
    lHip: legs[0][0],
    lKnee: legs[0][1],
    rHip: legs[1][0],
    rKnee: legs[1][1],
  };
}

/** Frees the geometries of a character (materials are shared and kept). */
export function disposeCharacter(rig: Rig): void {
  rig.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
  });
  rig.root.removeFromParent();
}

/** Height of the top of the head, for name tags and camera framing. */
export function characterHeight(look: CharacterLook): number {
  return 1.82 * SCALE[look.build];
}

/**
 * Merges the static meshes hanging from each joint by material, so a whole
 * character costs about 20 draw calls instead of 60+. Joints keep moving
 * independently because merging never crosses a joint.
 */
export function compactRig(root: THREE.Object3D): void {
  const joints: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) joints.push(o);
  });
  for (const joint of joints) {
    const byMat = new Map<THREE.Material, THREE.Mesh[]>();
    for (const c of joint.children) {
      const m = c as THREE.Mesh;
      if (!m.isMesh || m.children.length || Array.isArray(m.material)) continue;
      const list = byMat.get(m.material) ?? [];
      list.push(m);
      byMat.set(m.material, list);
    }
    for (const [material, meshes] of byMat) {
      if (meshes.length < 2) continue;
      const geos = meshes.map((m) => {
        m.updateMatrix();
        const g = m.geometry.clone();
        g.applyMatrix4(m.matrix);
        return g;
      });
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      for (const m of meshes) {
        joint.remove(m);
        m.geometry.dispose();
      }
      const one = new THREE.Mesh(merged, material);
      one.castShadow = true;
      joint.add(one);
    }
  }
}
