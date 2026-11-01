# Townsfolk walkers

Made 2026-11-01 with Meshy in the same Pixar-like style and pipeline as the heroes and maya.glb.
Each file is a rigged GLB with Mixamo-style bone names and three embedded clips: `idle`, `walk` and `run`. The rig was made from a T-pose model.
Every file passes `tools/check-model.mjs`. Each has about 20.6k triangles and 1024 px webp textures; normals, UVs and weights are quantized.
They have no props in the hands. Preview (walk clip): `preview.jpg`.

| file | height (m) | MB | look |
|---|---|---|---|
| grandma.glb | 1.60 | 1.20 | silver bun, glasses, lavender cardigan, crossbody shoulder bag |
| grandpa.glb | 1.70 | 1.07 | dark skin, white beard, flat cap, green vest |
| baker.glb | 1.75 | 1.00 | tall baker hat, white apron, checked trousers |
| mail_carrier.glb | 1.65 | 1.08 | blue cap, braid, crossbody mail bag |
| officer.glb | 1.80 | 0.96 | soft navy uniform with a star badge, no gear on the belt |
| nurse.glb | 1.65 | 1.07 | teal scrubs |
| gardener.glb | 1.65 | 1.11 | straw sun hat, green overalls, boots (height includes the hat) |
| teen_girl.glb | 1.60 | 1.14 | mint hoodie, red headphones around the neck |
| jogger.glb | 1.78 | 1.08 | headband, orange tee, running shorts |
| musician.glb | 1.75 | 1.36 | denim jacket, acoustic guitar on his back |

Odd bits:
- The musician's guitar neck sticks out about 0.3 m past his left shoulder, and the guitar is skinned to the spine, so it sways a little with the walk. Give him a wider collision radius.
- The grandma's and mail carrier's bags are skinned to the body and swing with the hips, which looks fine.
- Heights include hats and hair.

Cost: 410 credits (10 concepts, models, rigs and idle clips).
Licence: Meshy paid plan, privately owned by the project.
