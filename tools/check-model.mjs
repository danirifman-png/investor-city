// Checks a character GLB before it goes into the game (docs/CHARACTERS.md, "Model checklist").
//   node tools/check-model.mjs public/models/<name>.glb
// Exit code 1 if a hard requirement fails; warnings are printed but do not fail.
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/check-model.mjs <model.glb>');
  process.exit(2);
}

const LIMITS = { maxBytes: 3_000_000, maxTriangles: 40_000, maxTexture: 1024, minHeight: 1.3, maxHeight: 2.3 };
// the bones the shared animations drive (Mixamo names, with or without the "mixamorig:" prefix)
const REQUIRED_BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];

const buf = fs.readFileSync(file);
const results = [];
const pass = (ok, label, detail, hard = true) => results.push({ ok, label, detail, hard });

if (buf.readUInt32LE(0) !== 0x46546c67) {
  console.error('not a binary glTF (.glb) file');
  process.exit(1);
}
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8;

pass(buf.length <= LIMITS.maxBytes, 'File size', `${(buf.length / 1e6).toFixed(2)} MB (limit ${LIMITS.maxBytes / 1e6} MB)`);

// triangles and bounds of every primitive (bounds from accessor min/max, which glTF requires for POSITION)
let tris = 0;
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (const mesh of gltf.meshes ?? []) {
  for (const p of mesh.primitives) {
    const pos = gltf.accessors[p.attributes.POSITION];
    const count = p.indices !== undefined ? gltf.accessors[p.indices].count : pos.count;
    tris += (p.mode ?? 4) === 4 ? count / 3 : 0;
    pos.min?.forEach((v, i) => (min[i] = Math.min(min[i], v)));
    pos.max?.forEach((v, i) => (max[i] = Math.max(max[i], v)));
  }
}
pass(tris > 0 && tris <= LIMITS.maxTriangles, 'Triangle count', `${Math.round(tris).toLocaleString()} (limit ${LIMITS.maxTriangles.toLocaleString()})`);

// node scale on the path to the meshes (e.g. a 0.01 armature) changes the real height
const scaleOf = (i) => (gltf.nodes[i].scale ?? [1, 1, 1])[1];
const parents = new Map();
gltf.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parents.set(c, i)));
const meshNode = gltf.nodes.findIndex((n) => n.mesh !== undefined);
let s = 1;
for (let i = meshNode; i !== undefined && i >= 0; i = parents.get(i)) s *= scaleOf(i);
const skinned = gltf.nodes[meshNode]?.skin !== undefined;
const height = (max[1] - min[1]) * (skinned ? 1 : s);
pass(height >= LIMITS.minHeight && height <= LIMITS.maxHeight, 'Height (metres, Y-up)', `${height.toFixed(2)} m, expected ${LIMITS.minHeight}-${LIMITS.maxHeight}`);
pass(Math.abs(min[1]) < 0.08, 'Origin at the feet', `lowest point y = ${min[1].toFixed(3)}`);
pass(Math.abs((min[0] + max[0]) / 2) < 0.15 && Math.abs((min[2] + max[2]) / 2) < 0.25, 'Centred on the origin', `centre x ${((min[0] + max[0]) / 2).toFixed(2)}, z ${((min[2] + max[2]) / 2).toFixed(2)}`);

// skeleton
const skin = gltf.skins?.[0];
const boneNames = new Set((skin?.joints ?? []).map((j) => (gltf.nodes[j].name ?? '').replace(/^mixamorig:?/, '')));
const missing = REQUIRED_BONES.filter((b) => !boneNames.has(b));
pass(!!skin, 'Has a skeleton', skin ? `${skin.joints.length} bones` : 'no skin: the model cannot be animated');
pass(missing.length === 0, 'Mixamo-compatible bone names', missing.length ? `missing: ${missing.join(', ')}` : 'all 20 key bones found');

// facing +Z: the toes should sit in front of the heels
const nodeWorldZ = (name) => {
  const idx = gltf.nodes.findIndex((n) => (n.name ?? '').replace(/^mixamorig:?/, '') === name);
  if (idx < 0) return null;
  let z = 0;
  for (let i = idx; i !== undefined; i = parents.get(i)) z += (gltf.nodes[i].translation ?? [0, 0, 0])[2];
  return z;
};
const toe = nodeWorldZ('LeftToeBase');
const foot = nodeWorldZ('LeftFoot');
if (toe !== null && foot !== null && Math.abs(toe - foot) < 0.02) pass(false, 'Faces forward (+Z)', 'cannot tell from the bone offsets; check in the preview', false);
else if (toe !== null && foot !== null) pass(toe > foot, 'Faces forward (+Z)', `toe z ${toe.toFixed(3)} vs ankle z ${foot.toFixed(3)}`, false);

// materials and textures
const images = gltf.images ?? [];
pass((gltf.materials ?? []).length > 0, 'Has materials', `${(gltf.materials ?? []).length} materials`);
const external = images.filter((im) => im.uri && !im.uri.startsWith('data:'));
pass(external.length === 0, 'Textures embedded', external.length ? `${external.length} external texture files: re-export as .glb with embedded textures` : `${images.length} embedded images`);
let biggest = 0;
for (const im of images) {
  if (im.bufferView === undefined) continue;
  const bv = gltf.bufferViews[im.bufferView];
  const data = buf.subarray(binStart + (bv.byteOffset ?? 0), binStart + (bv.byteOffset ?? 0) + bv.byteLength);
  let w = 0;
  if (data[0] === 0x89) w = data.readUInt32BE(16); // PNG
  else if (data.toString('ascii', 8, 12) === 'WEBP') w = data.toString('ascii', 12, 16) === 'VP8X' ? 1 + data.readUIntLE(24, 3) : data.readUInt16LE(26) & 0x3fff;
  else if (data[0] === 0xff) for (let i = 2; i < data.length - 9; ) {
    if (data[i] !== 0xff) break;
    const marker = data[i + 1];
    if (marker >= 0xc0 && marker <= 0xc2) {
      w = data.readUInt16BE(i + 7);
      break;
    }
    i += 2 + data.readUInt16BE(i + 2);
  }
  biggest = Math.max(biggest, w);
}
pass(biggest <= LIMITS.maxTexture, 'Texture size', `largest ${biggest}px (limit ${LIMITS.maxTexture}px; run tools/prep-avatar.mjs to shrink)`, false);

const anims = (gltf.animations ?? []).map((a) => a.name);
pass(true, 'Embedded animations', anims.length ? anims.join(', ') : 'none (the shared baked clips are used)', false);

const copyright = gltf.asset?.copyright;
pass(true, 'Licence note in file', copyright ? `"${copyright}"` : 'none: record the source and licence in public/models/CREDITS.md', false);

let failed = 0;
for (const r of results) {
  const mark = r.ok ? 'PASS' : r.hard ? 'FAIL' : 'WARN';
  if (!r.ok && r.hard) failed++;
  console.log(`${mark.padEnd(4)}  ${r.label.padEnd(30)} ${r.detail}`);
}
console.log(failed ? `\n${failed} check(s) failed.` : '\nModel is ready for the game (remember the licence check).');
process.exit(failed ? 1 : 0);
