import * as THREE from 'three';
import type { NpcDef, NpcExtra } from '../content/npcs';
import { buildCharacter, characterHeight, compactRig, type Rig } from './CharacterModel';

/**
 * The city's characters. People reuse the player's rig and add grown-up
 * clothing on top (chef hat, blazer, hard hat...); Oliver is an owl with his
 * own body but the same joint names, so the same animator brings him to life.
 */

const cache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, rough = 0.7, metal = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}|${metal}`;
  let m = cache.get(key);
  if (!m) cache.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })));
  return m;
}

function mesh(geo: THREE.BufferGeometry, color: string, rough?: number, metal?: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color, rough, metal));
  m.castShadow = true;
  return m;
}

function put(parent: THREE.Object3D, m: THREE.Object3D, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Object3D {
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

/** Hand position at the end of a forearm pivot. */
const HAND_Y = -0.27;

function addExtra(rig: Rig, extra: NpcExtra, def: NpcDef): void {
  const { head, spine, hips, lElbow, rElbow } = rig;
  const hair = def.look.hairColor;
  switch (extra) {
    case 'chefHat':
      put(head, mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 18), '#ffffff', 0.9), 0, 0.3, -0.02);
      put(head, mesh(new THREE.SphereGeometry(0.25, 16, 10).scale(1, 0.62, 1), '#ffffff', 0.9), 0, 0.46, -0.02);
      break;
    case 'apron':
      put(spine, mesh(new THREE.BoxGeometry(0.34, 0.42, 0.03), '#ffffff', 0.9), 0, 0.22, 0.17);
      put(hips, mesh(new THREE.BoxGeometry(0.36, 0.34, 0.03), '#ffffff', 0.9), 0, -0.1, 0.2);
      put(spine, mesh(new THREE.BoxGeometry(0.24, 0.04, 0.035), '#e34b4b', 0.8), 0, 0.02, 0.18);
      break;
    case 'mustache':
      for (const s of [-1, 1]) put(head, mesh(new THREE.CapsuleGeometry(0.03, 0.08, 4, 8), hair, 0.9), s * 0.055, -0.06, 0.25, 0, 0, s * 1.2);
      break;
    case 'beard':
      put(head, mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45).scale(1, 1.1, 0.9), hair, 0.95), 0, 0.02, 0.04);
      put(head, mesh(new THREE.CapsuleGeometry(0.025, 0.12, 4, 8), hair, 0.9), 0, -0.06, 0.25, 0, 0, Math.PI / 2);
      break;
    case 'tie':
      put(spine, mesh(new THREE.BoxGeometry(0.06, 0.05, 0.03), '#c4452c'), 0, 0.45, 0.17);
      put(spine, mesh(new THREE.ConeGeometry(0.055, 0.3, 4).rotateY(Math.PI / 4).scale(1, 1, 0.3), '#c4452c'), 0, 0.28, 0.18, Math.PI);
      break;
    case 'blazer': {
      const color = def.id === 'nina' ? '#2c2f36' : '#2c3e5f';
      // open jacket: back and two front panels leave the shirt and tie visible
      put(spine, mesh(new THREE.BoxGeometry(0.46, 0.46, 0.04), color, 0.8), 0, 0.26, -0.15);
      for (const s of [-1, 1]) {
        put(spine, mesh(new THREE.BoxGeometry(0.13, 0.44, 0.04), color, 0.8), s * 0.16, 0.25, 0.15, 0, s * 0.25, 0);
        put(spine, mesh(new THREE.BoxGeometry(0.06, 0.4, 0.3), color, 0.8), s * 0.225, 0.25, 0);
      }
      for (const sh of [rig.lShoulder, rig.rShoulder]) {
        const sleeve = new THREE.CapsuleGeometry(0.078, 0.15, 4, 10);
        sleeve.translate(0, -0.13, 0);
        put(sh, mesh(sleeve, color, 0.8), 0, 0, 0);
      }
      break;
    }
    case 'hardHat':
      put(head, mesh(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#f2c14e', 0.4), 0, 0.06, 0);
      put(head, mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 20), '#f2c14e', 0.4), 0, 0.07, 0.03);
      break;
    case 'vest':
      put(spine, mesh(new THREE.CapsuleGeometry(0.21, 0.2, 4, 12).scale(1.14, 1, 0.82), '#ff8a3d', 0.7), 0, 0.24, 0);
      for (const y of [0.16, 0.3]) put(spine, mesh(new THREE.BoxGeometry(0.5, 0.035, 0.38), '#f4f4f4', 0.3), 0, y, 0);
      break;
    case 'scarf':
      put(spine, mesh(new THREE.TorusGeometry(0.1, 0.05, 8, 16).rotateX(Math.PI / 2), '#e46f8e', 0.95), 0, 0.5, 0);
      put(spine, mesh(new THREE.BoxGeometry(0.08, 0.22, 0.04), '#e46f8e', 0.95), 0.06, 0.38, 0.15, 0, 0, 0.1);
      break;
    case 'laptop': {
      const lap = new THREE.Group();
      lap.add(mesh(new THREE.BoxGeometry(0.34, 0.025, 0.24), '#aab4c4', 0.3, 0.6));
      const lid = mesh(new THREE.BoxGeometry(0.34, 0.22, 0.02), '#aab4c4', 0.3, 0.6);
      lid.position.set(0, 0.11, -0.12);
      lid.rotation.x = -0.3;
      lap.add(lid);
      put(lElbow, lap, 0.05, HAND_Y - 0.02, 0.08, 1.2, 0, 0);
      break;
    }
    case 'phone':
      put(rElbow, mesh(new THREE.BoxGeometry(0.08, 0.15, 0.015), '#2c2f36', 0.2, 0.5), 0, HAND_Y - 0.04, 0.05, 0.3);
      break;
    case 'clipboard':
      put(lElbow, mesh(new THREE.BoxGeometry(0.2, 0.27, 0.015), '#7a5a3a', 0.8), 0, HAND_Y - 0.06, 0.06, 0.4);
      break;
    case 'tablet':
      put(lElbow, mesh(new THREE.BoxGeometry(0.22, 0.29, 0.015), '#1f2a44', 0.2, 0.4), 0, HAND_Y - 0.06, 0.07, 0.6);
      break;
  }
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Oliver: a round brown owl with big eyes, ear tufts, glasses and a graduation cap. */
function buildOwl(): Rig {
  const root = new THREE.Group();
  root.name = 'owl';
  const body = joint(root, 0, 0, 0);
  const hips = joint(body, 0, 0.32, 0);
  const brown = '#8a6a4a';
  const light = '#e9d2a8';
  const orange = '#f0a23b';

  const legs: [THREE.Group, THREE.Group][] = [];
  for (const side of [1, -1]) {
    const hip = joint(hips, side * 0.14, 0, 0);
    hip.add(put(new THREE.Group(), mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), orange), 0, -0.1, 0));
    const knee = joint(hip, 0, -0.2, 0);
    for (const a of [-0.5, 0, 0.5]) put(knee, mesh(new THREE.CapsuleGeometry(0.025, 0.1, 3, 6), orange), Math.sin(a) * 0.06, -0.08, 0.06, Math.PI / 2 - 0.2, a, 0);
    legs.push([hip, knee]);
  }

  const spine = joint(hips, 0, 0, 0);
  put(spine, mesh(new THREE.SphereGeometry(0.42, 22, 16).scale(1, 1.15, 0.92), brown, 0.85), 0, 0.42, 0);
  put(spine, mesh(new THREE.SphereGeometry(0.33, 20, 14).scale(0.95, 1.1, 0.7), light, 0.9), 0, 0.36, 0.13);
  // feather chevrons on the belly
  for (let i = 0; i < 3; i++) put(spine, mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 8, Math.PI), '#b8946a'), (i - 1) * 0.11, 0.3 - (i % 2) * 0.08, 0.36, 0, 0, Math.PI);

  const head = joint(spine, 0, 0.92, 0);
  put(head, mesh(new THREE.SphereGeometry(0.36, 22, 16).scale(1.1, 0.92, 0.95), brown, 0.85), 0, 0, 0);
  // facial disc, eyes, beak
  put(head, mesh(new THREE.SphereGeometry(0.3, 18, 12).scale(1.15, 0.85, 0.45), light, 0.9), 0, -0.02, 0.18);
  for (const s of [-1, 1]) {
    put(head, mesh(new THREE.SphereGeometry(0.11, 16, 12), '#ffffff', 0.3), s * 0.14, 0.02, 0.27);
    put(head, mesh(new THREE.SphereGeometry(0.06, 12, 10), '#2c1d10', 0.2), s * 0.14, 0.02, 0.36);
    put(head, mesh(new THREE.SphereGeometry(0.018, 8, 6), '#ffffff', 0.1), s * 0.14 + 0.02, 0.045, 0.415);
    // round glasses
    put(head, mesh(new THREE.TorusGeometry(0.125, 0.012, 6, 24), '#3a2a1a', 0.4, 0.4), s * 0.14, 0.02, 0.37);
    // ear tufts
    put(head, mesh(new THREE.ConeGeometry(0.08, 0.22, 6), brown, 0.85), s * 0.25, 0.3, -0.02, 0, 0, s * -0.45);
  }
  put(head, mesh(new THREE.BoxGeometry(0.06, 0.01, 0.01), '#3a2a1a'), 0, 0.03, 0.4);
  put(head, mesh(new THREE.ConeGeometry(0.05, 0.13, 8), orange, 0.5), 0, -0.1, 0.36, Math.PI / 2 + 0.6, 0, 0);
  // graduation cap
  put(head, mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 16), '#1f2a44', 0.6), 0, 0.33, -0.02);
  put(head, mesh(new THREE.BoxGeometry(0.56, 0.03, 0.56), '#1f2a44', 0.6), 0, 0.4, -0.02, 0, Math.PI / 4, 0);
  put(head, mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4), '#f2c14e'), 0.2, 0.3, 0.16, 0.2, 0, 0.2);
  put(head, mesh(new THREE.SphereGeometry(0.03, 8, 6), '#f2c14e'), 0.22, 0.19, 0.18);

  // wings hang from the shoulders like arms
  const arms: [THREE.Group, THREE.Group][] = [];
  for (const side of [1, -1]) {
    const shoulder = joint(spine, side * 0.38, 0.65, -0.02);
    const wing = mesh(new THREE.SphereGeometry(0.2, 14, 10).scale(0.45, 1.25, 1), brown, 0.85);
    wing.position.y = -0.18;
    shoulder.add(wing);
    const elbow = joint(shoulder, 0, -0.32, 0);
    put(elbow, mesh(new THREE.ConeGeometry(0.08, 0.2, 6), '#6e5038', 0.85), 0, -0.06, 0, Math.PI, 0, 0);
    arms.push([shoulder, elbow]);
  }

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

export function buildNpc(def: NpcDef): Rig {
  const rig = def.body === 'owl' ? buildOwl() : buildCharacter(def.look);
  for (const e of def.extras) addExtra(rig, e, def);
  compactRig(rig.root);
  rig.root.scale.setScalar(def.scale);
  return rig;
}

/** Top of the head, for the floating name tag and camera framing. */
export function npcHeight(def: NpcDef): number {
  return (def.body === 'owl' ? 1.72 : characterHeight(def.look) + (def.extras.includes('chefHat') ? 0.3 : 0)) * def.scale;
}
