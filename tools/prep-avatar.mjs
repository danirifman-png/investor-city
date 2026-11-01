// Asset prep for realistic NPC avatars (run once, output is committed under public/models).
// Needs @gltf-transform/core + functions available on NODE_PATH (dev tooling only, not a game dependency):
//   node tools/prep-avatar.mjs <in.glb> <out.glb> [meshNameToDrop ...]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const [, , input, output, ...drop] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (mesh && drop.includes(mesh.getName())) {
    node.setMesh(null);
    node.dispose();
  }
}
await doc.transform(
  prune(),
  dedup(),
  // 512px is plenty for a character seen at 2-10 m; webp keeps the file small
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 82 }),
);
await io.write(output, doc);
console.log('wrote', output);
