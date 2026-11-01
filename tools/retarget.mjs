// Bakes Mixamo-rig animation clips onto another humanoid skeleton with the same
// bone names (Ready Player Me style, no "mixamorig:" prefix) and writes them as JSON.
// Both rigs must share a rest pose (T-pose). Rotations are transferred as world-space
// deltas from the rest pose, so differing joint orientations between the rigs do not matter.
//   node tools/retarget.mjs <source-anims.glb> <target.glb> <out.json> clip[=newName] ...
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const [, , srcPath, dstPath, outPath, ...clipArgs] = process.argv;
const FPS = 30;

function parseGlb(path) {
  const buf = fs.readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + jsonLen).toString());
}

/** Builds a bare node hierarchy from glTF JSON (no meshes, so no image decoding in Node). */
function buildNodes(json) {
  const objs = json.nodes.map((n) => {
    const o = new THREE.Object3D();
    o.name = n.name ?? '';
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => objs[i].add(objs[c])));
  const root = new THREE.Object3D();
  for (const i of json.scenes[json.scene ?? 0].nodes) root.add(objs[i]);
  root.updateMatrixWorld(true);
  return root;
}

const loader = new GLTFLoader();
const srcBuf = fs.readFileSync(srcPath);
const src = await new Promise((res, rej) => loader.parse(srcBuf.buffer.slice(srcBuf.byteOffset, srcBuf.byteOffset + srcBuf.byteLength), '', res, rej));
const srcRoot = src.scene;
const dstRoot = buildNodes(parseGlb(dstPath));

const strip = (n) => n.replace(/^mixamorig:?/, '');
const srcBones = new Map();
srcRoot.traverse((o) => o.name.startsWith('mixamorig') && srcBones.set(strip(o.name), o));
const dstBones = [];
dstRoot.traverse((o) => srcBones.has(o.name) && dstBones.push(o));

srcRoot.updateMatrixWorld(true);
const q = () => new THREE.Quaternion();
const v = () => new THREE.Vector3();

// The target may rest in an A-pose. Swing each bone so it points along the source
// rest direction (bone -> main child), turning the target's rest into the same T-pose.
const PREFERRED_CHILD = { Hips: 'Spine', Spine2: 'Neck', LeftHand: 'LeftHandMiddle1', RightHand: 'RightHandMiddle1' };
for (const b of dstBones) {
  const kids = b.children.filter((c) => srcBones.has(c.name));
  const child = kids.find((c) => c.name === PREFERRED_CHILD[b.name]) ?? kids[0];
  if (!child) continue;
  const s = srcBones.get(b.name);
  const sDir = srcBones.get(child.name).getWorldPosition(v()).sub(s.getWorldPosition(v())).normalize();
  b.updateMatrixWorld(true);
  const dDir = child.getWorldPosition(v()).sub(b.getWorldPosition(v())).normalize();
  if (sDir.lengthSq() < 0.5 || dDir.lengthSq() < 0.5) continue;
  const swing = q().setFromUnitVectors(dDir, sDir);
  const world = swing.multiply(b.getWorldQuaternion(q()));
  b.quaternion.copy(b.parent.getWorldQuaternion(q()).invert().multiply(world));
  b.updateMatrixWorld(true);
}
const rest = new Map();
for (const b of dstBones) {
  const s = srcBones.get(b.name);
  rest.set(b.name, {
    src: s.getWorldQuaternion(q()),
    dst: b.getWorldQuaternion(q()),
    local: b.quaternion.clone(),
  });
}
const srcHips = srcBones.get('Hips');
const dstHips = dstRoot.getObjectByName('Hips');
const srcHipsRest = srcHips.getWorldPosition(new THREE.Vector3());
const dstHipsRest = dstHips.position.clone();
const hipScale = dstHips.getWorldPosition(new THREE.Vector3()).y / srcHipsRest.y;

// sanity check: arms point the same way in both rest poses
for (const side of ['Left', 'Right']) {
  const dir = (bones, get) => get(`${side}Hand`).getWorldPosition(new THREE.Vector3()).sub(get(`${side}Arm`).getWorldPosition(new THREE.Vector3())).normalize();
  const a = dir(null, (n) => srcBones.get(n));
  const b = dir(null, (n) => dstRoot.getObjectByName(n));
  console.log(`${side} arm rest direction src`, a.toArray().map((v) => v.toFixed(2)), 'dst', b.toArray().map((v) => v.toFixed(2)));
}

const mixer = new THREE.AnimationMixer(srcRoot);
const out = [];
for (const arg of clipArgs) {
  const [name, rename] = arg.split('=');
  const clip = src.animations.find((c) => c.name === name);
  if (!clip) throw new Error(`no clip ${name}`);
  mixer.stopAllAction();
  const action = mixer.clipAction(clip);
  action.reset().play();
  const frames = Math.max(2, Math.round(clip.duration * FPS) + 1);
  const tracks = Object.fromEntries(dstBones.map((b) => [b.name, []]));
  const hips = [];
  const times = [];
  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, f / FPS);
    times.push(+t.toFixed(4));
    mixer.setTime(t);
    srcRoot.updateMatrixWorld(true);
    // reset the target to rest, then pose top-down so parents are solved first
    for (const b of dstBones) b.quaternion.copy(rest.get(b.name).local);
    dstRoot.updateMatrixWorld(true);
    for (const b of dstBones) {
      const r = rest.get(b.name);
      const delta = srcBones.get(b.name).getWorldQuaternion(q()).multiply(r.src.clone().invert());
      const world = delta.multiply(r.dst);
      const parentWorld = b.parent.getWorldQuaternion(q());
      b.quaternion.copy(parentWorld.invert().multiply(world));
      b.updateMatrixWorld(true);
      tracks[b.name].push(...b.quaternion.toArray().map((v) => +v.toFixed(4)));
    }
    const hp = srcHips.getWorldPosition(new THREE.Vector3()).sub(srcHipsRest).multiplyScalar(hipScale);
    // keep the bob, drop root travel so the game controls movement
    hips.push(+dstHipsRest.x.toFixed(4), +(dstHipsRest.y + hp.y).toFixed(4), +dstHipsRest.z.toFixed(4));
  }
  out.push({ name: rename ?? name, duration: +clip.duration.toFixed(4), times, rot: tracks, hips });
  console.log('baked', name, '->', rename ?? name, frames, 'frames');
}
fs.writeFileSync(outPath, JSON.stringify({ fps: FPS, clips: out }));
console.log('wrote', outPath, (fs.statSync(outPath).size / 1024).toFixed(0), 'KB');
