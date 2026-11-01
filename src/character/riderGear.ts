import * as THREE from 'three';

/**
 * What the rider wears and does on the kick scooter: hands that hold the
 * handlebar (a small two-bone reach, applied after the animation each frame)
 * and a helmet that fits whichever head the player has.
 */

const vS = new THREE.Vector3();
const vE = new THREE.Vector3();
const vH = new THREE.Vector3();
const vT = new THREE.Vector3();
const vDir = new THREE.Vector3();
const vU = new THREE.Vector3();
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const qD = new THREE.Quaternion();
const qW = new THREE.Quaternion();
const qP = new THREE.Quaternion();

/** An arm: the upper bone (shoulder), the lower bone (elbow) and where the hand ends up. */
export interface ArmChain {
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  /** World position of the hand (the wrist or the palm). */
  hand(out: THREE.Vector3): THREE.Vector3;
}

/** Turns a bone so that the world direction `from` points along `to`. */
function aim(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3): void {
  if (!bone.parent) return;
  qD.setFromUnitVectors(from, to);
  bone.getWorldQuaternion(qW).premultiply(qD);
  bone.quaternion.copy(bone.parent.getWorldQuaternion(qP).invert().multiply(qW));
  bone.updateMatrixWorld(true);
}

/**
 * Bends an arm so the hand reaches `target` (world space), with the elbow
 * pointing towards `pole` (a world direction). World matrices must be current.
 */
export function reach(arm: ArmChain, target: THREE.Vector3, pole: THREE.Vector3): void {
  arm.upper.getWorldPosition(vS);
  arm.lower.getWorldPosition(vE);
  arm.hand(vH);
  const a = vE.distanceTo(vS);
  const b = vH.distanceTo(vE);
  if (a < 1e-5 || b < 1e-5) return;
  vT.copy(target).sub(vS);
  const d = THREE.MathUtils.clamp(vT.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  vDir.copy(vT).normalize();
  vU.copy(pole).addScaledVector(vDir, -pole.dot(vDir));
  if (vU.lengthSq() < 1e-8) vU.set(0, -1, 0);
  vU.normalize();
  const cos = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sin = Math.sqrt(1 - cos * cos);
  // where the elbow should be
  const elbow = vA.copy(vS).addScaledVector(vDir, a * cos).addScaledVector(vU, a * sin);
  aim(arm.upper, vB.copy(vE).sub(vS).normalize(), elbow.clone().sub(vS).normalize());
  // then point the forearm at the target
  arm.lower.getWorldPosition(vE);
  arm.hand(vH);
  const goal = vT.copy(vS).addScaledVector(vDir, d);
  aim(arm.lower, vB.copy(vH).sub(vE).normalize(), goal.sub(vE).normalize());
}

/** Arm chains of a Meshy hero (Mixamo-style bone names). Null if the rig has no such bones. */
export function heroArms(scene: THREE.Object3D): { left: ArmChain; right: ArmChain } | null {
  const chain = (side: 'Left' | 'Right'): ArmChain | null => {
    const upper = scene.getObjectByName(`${side}Arm`);
    const lower = scene.getObjectByName(`${side}ForeArm`);
    const hand = scene.getObjectByName(`${side}Hand`);
    if (!upper || !lower || !hand) return null;
    return { upper, lower, hand: (out) => hand.getWorldPosition(out) };
  };
  const left = chain('Left');
  const right = chain('Right');
  return left && right ? { left, right } : null;
}

/** Arm chains of the built (custom) body: shoulder and elbow joints, hand 0.26 m below the elbow. */
export function rigArms(rig: { lShoulder: THREE.Object3D; lElbow: THREE.Object3D; rShoulder: THREE.Object3D; rElbow: THREE.Object3D }): { left: ArmChain; right: ArmChain } {
  const hand = (elbow: THREE.Object3D) => (out: THREE.Vector3) => elbow.localToWorld(out.set(0, -0.2, 0));
  // the built body's +x side is its left (it faces +z)
  return {
    left: { upper: rig.lShoulder, lower: rig.lElbow, hand: hand(rig.lElbow) },
    right: { upper: rig.rShoulder, lower: rig.rElbow, hand: hand(rig.rElbow) },
  };
}

/* ------------------------------------------------------------------ */
/* Helmet                                                              */
/* ------------------------------------------------------------------ */

/** A bike helmet as a shell that fits a box (world size of the head and hair). */
function buildHelmet(rx: number, ry: number, rz: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'helmet';
  const shellMat = new THREE.MeshStandardMaterial({ color: '#ff7a3d', roughness: 0.35, metalness: 0.05 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#f7f7f2', roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#253041', roughness: 0.6 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), shellMat);
  shell.scale.set(rx, ry, rz);
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(1.012, 8, 12, -0.16, 0.32, 0, Math.PI * 0.5), stripeMat);
  stripe.scale.set(rx, ry, rz);
  stripe.rotation.y = Math.PI / 2;
  // vents: three dark slots on top
  const vents = [-0.35, 0, 0.35].map((x) => {
    const v = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 3, 8).rotateX(Math.PI / 2), darkMat);
    v.scale.set(rx * 0.55, ry * 0.25, rz * 0.9);
    v.position.set(x * rx, ry * 0.93, 0);
    return v;
  });
  // the brim over the eyes
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.04, 20, 1, false, -0.9, 1.8), shellMat);
  visor.scale.set(rx * 0.95, 1, rz * 0.45);
  visor.position.set(0, 0.02 * ry, rz * 0.62);
  visor.rotation.x = 0.18;
  g.add(shell, stripe, ...vents, visor);
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  return g;
}

/** The top of the body's chain under the player (the hero scene or the built body's root). */
function rootOf(o: THREE.Object3D): THREE.Object3D {
  let r = o;
  while (r.parent && r.parent.name !== 'player') r = r.parent;
  return r;
}

/** The size of a hero's head (with hair) in the hero's own space, from the vertices above the neck. */
function heroHeadBox(scene: THREE.Object3D): THREE.Box3 | null {
  const neck = scene.getObjectByName('Neck') ?? scene.getObjectByName('Head');
  if (!neck) return null;
  scene.updateWorldMatrix(true, true);
  const toLocal = scene.matrixWorld.clone().invert();
  const neckP = neck.getWorldPosition(new THREE.Vector3()).applyMatrix4(toLocal);
  // everything above the neck: the head and hair (hands are below it while posed)
  const pts: THREE.Vector3[] = [];
  let maxY = neckP.y;
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      const v = m.getVertexPosition(i, new THREE.Vector3());
      m.localToWorld(v).applyMatrix4(toLocal);
      if (v.y > neckP.y) {
        pts.push(v);
        maxY = Math.max(maxY, v.y);
      }
    }
  });
  // keep the ones within a head's reach of the neck (not a raised hand)
  const near = (maxY - neckP.y) * 0.9;
  const box = new THREE.Box3();
  for (const v of pts) if (v.y > neckP.y + near * 0.12 && Math.hypot(v.x - neckP.x, v.z - neckP.z) < near) box.expandByPoint(v);
  return box.isEmpty() ? null : box;
}

/**
 * Puts a (hidden) helmet on a head bone or head group. `box` is the head's
 * size in `root` space (upright, facing +z). Stored on the head's userData.
 */
function fitHelmet(head: THREE.Object3D, root: THREE.Object3D, box: THREE.Box3): THREE.Object3D {
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  // the shell sits a little above the middle of the head and covers the hair
  const baseY = box.min.y + size.y * 0.48;
  const helmet = buildHelmet((size.x / 2) * 1.1, (box.max.y - baseY) * 1.14, (size.z / 2) * 1.1);
  // it lives on the body root (bone frames may carry scale and shear) and follows the head each frame
  root.add(helmet);
  root.updateWorldMatrix(true, true);
  const headAt = root.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
  helmet.userData.follow = { head, root, offset: new THREE.Vector3(c.x, baseY, c.z).sub(headAt) };
  helmet.visible = false;
  head.userData.helmet = helmet;
  wearHelmet(helmet);
  return helmet;
}

/** The helmet of a hero model (made on first use, so it fits the hero's own hair). */
export function heroHelmet(scene: THREE.Object3D): THREE.Object3D | null {
  const head = scene.getObjectByName('Head');
  if (!head) return null;
  if (head.userData.helmet) return head.userData.helmet as THREE.Object3D;
  const box = heroHeadBox(scene);
  return box ? fitHelmet(head, scene, box) : null;
}

/** The helmet of the built body (made on first use). */
export function rigHelmet(head: THREE.Object3D): THREE.Object3D {
  if (head.userData.helmet) return head.userData.helmet as THREE.Object3D;
  const root = rootOf(head);
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  head.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).applyMatrix4(toLocal));
  });
  return fitHelmet(head, root, box);
}

const tmpHead = new THREE.Vector3();

/** Keeps a helmet on its head (call after the animation has posed the body). */
export function wearHelmet(helmet: THREE.Object3D): void {
  const f = helmet.userData.follow as { head: THREE.Object3D; root: THREE.Object3D; offset: THREE.Vector3 } | undefined;
  if (!f) return;
  f.root.worldToLocal(f.head.getWorldPosition(tmpHead));
  helmet.position.copy(tmpHead).add(f.offset);
}
