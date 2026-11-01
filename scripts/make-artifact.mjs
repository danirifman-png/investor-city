// Turns the Vite build in dist/ into a page that can be published as a
// claude.ai Artifact: CSS is inlined (the artifact host only allows Google
// Fonts stylesheets) and the script keeps its relative path.
// Usage: npm run build && node scripts/make-artifact.mjs <outDir>
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const outDir = process.argv[2] ?? 'artifact';
const html = readFileSync('dist/index.html', 'utf8');
const assets = readdirSync('dist/assets');
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join('dist/assets', f), 'utf8')).join('\n');
const js = assets.find((f) => f.endsWith('.js'));
if (!js) throw new Error('No JS bundle in dist/assets');

const fonts = html.match(/<link[^>]+fonts\.googleapis\.com\/css2[^>]+>/)?.[0] ?? '';
const page = `<title>עיר המשקיעים</title>
<meta name="theme-color" content="#1f2a44">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>
${css}
</style>
<div id="app"></div>
<div id="boot" class="boot">עיר המשקיעים</div>
<script type="module" src="./assets/${js}"></script>
`;

mkdirSync(join(outDir, 'assets'), { recursive: true });
writeFileSync(join(outDir, 'index.html'), page);
copyFileSync(join('dist/assets', js), join(outDir, 'assets', js));
// models (loaded at run time, relative to the page), in subfolders too. Files the
// source never mentions are left out to keep the upload small.
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const srcText = walk('src').filter((f) => /\.(ts|json)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
const used = (rel) => {
  const base = rel.split('/').pop().replace(/\.(glb|json)$/, '');
  return srcText.includes(`models/${rel}`) || (rel.startsWith('meshy/props/') && new RegExp(`\\b${base}: \\[`).test(srcText));
};
const models = walk('dist/models')
  .map((f) => relative('dist/models', f).split('\\').join('/'))
  .filter((f) => (f.endsWith('.glb') || f.endsWith('.json')) && used(f));
mkdirSync(join(outDir, 'models'), { recursive: true });
for (const f of models) {
  mkdirSync(join(outDir, 'models', dirname(f)), { recursive: true });
  if (!f.endsWith('.glb')) {
    copyFileSync(join('dist/models', f), join(outDir, 'models', f));
    continue;
  }
  // The artifact host does not serve .glb, and its security policy blocks data: and
  // blob: URLs. So the textures become their own image files, and the rest of the GLB
  // ships base64-encoded as "<model>.txt", which AvatarNpc decodes and parses itself.
  const glb = readFileSync(join('dist/models', f));
  const jsonLen = glb.readUInt32LE(12);
  const gltf = JSON.parse(glb.subarray(20, 20 + jsonLen).toString());
  const bin = glb.subarray(28 + jsonLen, 28 + jsonLen + glb.readUInt32LE(20 + jsonLen));
  const base = f.replace(/\.glb$/, '');
  const imageViews = new Set();
  (gltf.images ?? []).forEach((im, i) => {
    if (im.bufferView === undefined) return;
    const bv = gltf.bufferViews[im.bufferView];
    const ext = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }[im.mimeType] ?? 'png';
    const name = `${base}-${i}.${ext}`;
    writeFileSync(join(outDir, 'models', name), bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength));
    imageViews.add(im.bufferView);
    gltf.images[i] = { name: im.name, uri: name.split('/').pop(), mimeType: im.mimeType };
  });
  // GLTFLoader tests WebP support with a data: image, which the policy blocks; every
  // browser the game supports decodes WebP, so point textures at the image directly
  for (const tex of gltf.textures ?? []) {
    const webp = tex.extensions?.EXT_texture_webp;
    if (!webp) continue;
    tex.source = webp.source;
    delete tex.extensions.EXT_texture_webp;
    if (!Object.keys(tex.extensions).length) delete tex.extensions;
  }
  for (const key of ['extensionsUsed', 'extensionsRequired']) {
    if (gltf[key]) gltf[key] = gltf[key].filter((e) => e !== 'EXT_texture_webp');
    if (gltf[key] && !gltf[key].length) delete gltf[key];
  }
  // rebuild the binary chunk without the image bytes, keeping the other views' indices
  const parts = [];
  let offset = 0;
  gltf.bufferViews.forEach((bv, i) => {
    const data = imageViews.has(i) ? Buffer.alloc(0) : bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    const pad = (4 - (offset % 4)) % 4;
    if (pad) parts.push(Buffer.alloc(pad));
    offset += pad;
    bv.byteOffset = offset;
    bv.byteLength = Math.max(data.length, imageViews.has(i) ? 0 : bv.byteLength);
    parts.push(data);
    offset += data.length;
  });
  const newBin = Buffer.concat(parts);
  gltf.buffers = [{ byteLength: newBin.length }];
  // unused image views stay valid but empty (glTF needs byteLength >= 1)
  for (const i of imageViews) gltf.bufferViews[i].byteLength = 1;
  const padBin = Buffer.concat([newBin, Buffer.alloc((4 - (newBin.length % 4)) % 4 + 4)]);
  gltf.buffers[0].byteLength = padBin.length;
  let json = Buffer.from(JSON.stringify(gltf));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + padBin.length, 8);
  const chunk = (len, type) => {
    const c = Buffer.alloc(8);
    c.writeUInt32LE(len, 0);
    c.writeUInt32LE(type, 4);
    return c;
  };
  const out = Buffer.concat([header, chunk(json.length, 0x4e4f534a), json, chunk(padBin.length, 0x004e4942), padBin]);
  writeFileSync(join(outDir, 'models', `${f}.txt`), out.toString('base64'));
}
console.log(`${outDir}/index.html + assets/${js} + models/ (${models.length} files)`);
