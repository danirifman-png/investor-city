import * as THREE from 'three';

/**
 * Shop windows you can look into: one painted atlas holds the inside of every
 * kind of shop (shelves, goods, a warm ceiling light and a glass sheen), and
 * each window is a plane that shows its cell. All windows share one material.
 */

export const SHOP_KINDS = ['bakery', 'books', 'toys', 'flowers', 'sweets', 'clothes', 'cafe'] as const;
export type ShopKind = (typeof SHOP_KINDS)[number];

const COLS = 2;
const ROWS = 4;
/** Goods are drawn in square tiles; each shop's cell is two tiles wide (a 2:1 window). */
const CELL = 256;
const CW = CELL * 2;

let shared: THREE.MeshBasicMaterial | null = null;

function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function shelf(g: CanvasRenderingContext2D, y: number): void {
  g.fillStyle = '#8a5a34';
  g.fillRect(8, y, CELL - 16, 7);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(8, y + 7, CELL - 16, 5);
}

/** Back wall, light from above, a display table at the bottom. */
function room(g: CanvasRenderingContext2D, wall: string, wall2: string): void {
  const grad = g.createLinearGradient(0, 0, 0, CELL);
  grad.addColorStop(0, wall);
  grad.addColorStop(1, wall2);
  g.fillStyle = grad;
  g.fillRect(0, 0, CELL, CELL);
  const light = g.createRadialGradient(CELL / 2, 10, 4, CELL / 2, 40, CELL * 0.75);
  light.addColorStop(0, 'rgba(255,240,200,0.55)');
  light.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = light;
  g.fillRect(0, 0, CELL, CELL);
  // pendant lamps
  for (const x of [CELL * 0.3, CELL * 0.7]) {
    g.strokeStyle = '#3a2e26';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 22);
    g.stroke();
    g.fillStyle = '#fff3c8';
    g.beginPath();
    g.arc(x, 26, 7, 0, Math.PI * 2);
    g.fill();
  }
  // display table
  g.fillStyle = '#a06c3e';
  g.fillRect(0, CELL - 46, CELL, 46);
  g.fillStyle = '#c48a52';
  g.fillRect(0, CELL - 46, CELL, 6);
}

function drawBakery(g: CanvasRenderingContext2D, r: () => number): void {
  room(g, '#f6dfb8', '#e9c58f');
  for (const y of [86, 150]) {
    shelf(g, y);
    for (let x = 22; x < CELL - 20; x += 30 + r() * 8) {
      g.fillStyle = r() > 0.5 ? '#c27a35' : '#d9984a';
      g.beginPath();
      g.ellipse(x, y - 9, 13, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,230,180,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 6, y - 12);
      g.lineTo(x - 2, y - 6);
      g.moveTo(x + 2, y - 12);
      g.lineTo(x + 6, y - 6);
      g.stroke();
    }
  }
  // a cake on a stand and croissants on the table
  g.fillStyle = '#e8e2d8';
  g.fillRect(CELL / 2 - 4, CELL - 70, 8, 24);
  g.fillStyle = '#f7c6d4';
  g.fillRect(CELL / 2 - 30, CELL - 98, 60, 28);
  g.fillStyle = '#fff6f0';
  g.fillRect(CELL / 2 - 30, CELL - 102, 60, 6);
  g.fillStyle = '#e8434f';
  g.beginPath();
  g.arc(CELL / 2, CELL - 106, 5, 0, Math.PI * 2);
  g.fill();
  for (const x of [40, 74, 182, 216]) {
    g.fillStyle = '#e0a04d';
    g.beginPath();
    g.ellipse(x, CELL - 52, 15, 8, 0, Math.PI, 0);
    g.fill();
  }
}

function drawBooks(g: CanvasRenderingContext2D, r: () => number): void {
  room(g, '#e3d5c0', '#cdb894');
  const spines = ['#c0392b', '#2e6da4', '#e7b13c', '#3d8b5a', '#7d4ea8', '#e07b39', '#2f3e57'];
  for (const y of [70, 130, 190]) {
    shelf(g, y);
    let x = 14;
    while (x < CELL - 20) {
      const w = 8 + r() * 9;
      const h = 30 + r() * 20;
      g.fillStyle = spines[Math.floor(r() * spines.length)];
      g.fillRect(x, y - h, w, h);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x + 2, y - h + 6, w - 4, 3);
      x += w + 1.5;
    }
  }
}

function drawToys(g: CanvasRenderingContext2D, r: () => number): void {
  room(g, '#cfe6f7', '#a9cfe9');
  const cols = ['#ff5a5f', '#ffc93c', '#3ec1d3', '#7ed957', '#a66cff', '#ff8c42'];
  for (const y of [90, 160]) {
    shelf(g, y);
    for (let x = 26; x < CELL - 20; x += 40) {
      const c = cols[Math.floor(r() * cols.length)];
      g.fillStyle = c;
      if (r() > 0.5) {
        g.beginPath();
        g.arc(x, y - 14, 13, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.fillRect(x - 13, y - 16, 26, 4);
      } else {
        g.fillRect(x - 12, y - 26, 24, 24);
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.font = '700 16px Arial';
        g.fillText('ABC'[Math.floor(r() * 3)], x - 6, y - 8);
      }
    }
  }
  // a teddy bear on the table
  g.fillStyle = '#a8703c';
  const bx = CELL / 2;
  const by = CELL - 70;
  g.beginPath();
  g.arc(bx, by, 22, 0, Math.PI * 2);
  g.arc(bx, by - 30, 15, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(bx - 12, by - 42, 6, 0, Math.PI * 2);
  g.arc(bx + 12, by - 42, 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2b1b10';
  g.fillRect(bx - 6, by - 33, 3, 3);
  g.fillRect(bx + 3, by - 33, 3, 3);
}

function drawFlowers(g: CanvasRenderingContext2D, r: () => number): void {
  room(g, '#e9f2e1', '#cfe0c2');
  const petals = ['#ff6f91', '#ffd23f', '#ffffff', '#c86bfa', '#ff9671', '#ee4266'];
  for (let i = 0; i < 6; i++) {
    const x = 26 + i * 41;
    const base = i % 2 ? CELL - 46 : CELL - 60;
    g.strokeStyle = '#3f8a3a';
    g.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      const tx = x + (r() - 0.5) * 34;
      const ty = base - 60 - r() * 70;
      g.beginPath();
      g.moveTo(x, base - 10);
      g.lineTo(tx, ty);
      g.stroke();
      g.fillStyle = petals[Math.floor(r() * petals.length)];
      g.beginPath();
      g.arc(tx, ty, 7 + r() * 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f9e076';
      g.beginPath();
      g.arc(tx, ty, 2.5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = i % 2 ? '#8c9aa6' : '#b26a3c';
    g.fillRect(x - 13, base - 14, 26, 24);
  }
}

function drawSweets(g: CanvasRenderingContext2D, r: () => number): void {
  room(g, '#fde3ee', '#f7c3d9');
  const cols = ['#ff4f79', '#ffd166', '#06d6a0', '#118ab2', '#c77dff', '#ff9f1c'];
  for (const y of [96, 168]) {
    shelf(g, y);
    for (let x = 30; x < CELL - 20; x += 48) {
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(x - 16, y - 40, 32, 40);
      g.fillStyle = '#e9e9f0';
      g.fillRect(x - 12, y - 46, 24, 7);
      for (let k = 0; k < 14; k++) {
        g.fillStyle = cols[Math.floor(r() * cols.length)];
        g.beginPath();
        g.arc(x - 12 + r() * 24, y - 4 - r() * 26, 3.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  // lollipops on the table
  for (const x of [40, 90, 166, 216]) {
    g.strokeStyle = '#f4f4f4';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, CELL - 46);
    g.lineTo(x, CELL - 76);
    g.stroke();
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.beginPath();
    g.arc(x, CELL - 84, 12, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, CELL - 84, 6, 0, Math.PI * 1.5);
    g.stroke();
  }
}

function drawClothes(g: CanvasRenderingContext2D, r: () => number): void {
  room(g, '#efe9f6', '#d9cfe8');
  // a rail of shirts
  g.fillStyle = '#7a7f88';
  g.fillRect(14, 54, CELL - 28, 4);
  const cols = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#ffb4c6', '#264653', '#e9c46a'];
  for (let x = 30; x < CELL - 20; x += 30) {
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.beginPath();
    g.moveTo(x - 9, 60);
    g.lineTo(x + 9, 60);
    g.lineTo(x + 15, 72);
    g.lineTo(x + 10, 76);
    g.lineTo(x + 10, 122);
    g.lineTo(x - 10, 122);
    g.lineTo(x - 10, 76);
    g.lineTo(x - 15, 72);
    g.closePath();
    g.fill();
  }
  // a mannequin with a dress
  const mx = CELL * 0.72;
  g.fillStyle = '#f1e3d3';
  g.beginPath();
  g.arc(mx, 140, 10, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#8e5bd6';
  g.beginPath();
  g.moveTo(mx - 12, 152);
  g.lineTo(mx + 12, 152);
  g.lineTo(mx + 30, CELL - 50);
  g.lineTo(mx - 30, CELL - 50);
  g.closePath();
  g.fill();
  // folded jumpers on the table
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 3; k++) {
      g.fillStyle = cols[(i + k * 2) % cols.length];
      g.fillRect(16 + i * 34, CELL - 58 - k * 9, 28, 8);
    }
  }
}

function drawCafe(g: CanvasRenderingContext2D, r: () => number): void {
  room(g, '#e8d7c4', '#c9ab8a');
  // a chalk menu
  g.fillStyle = '#2d3a33';
  g.fillRect(24, 40, 96, 74);
  g.strokeStyle = '#a0784e';
  g.lineWidth = 5;
  g.strokeRect(24, 40, 96, 74);
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(34, 56 + i * 15);
    g.lineTo(34 + 40 + r() * 36, 56 + i * 15);
    g.stroke();
  }
  // a coffee machine
  g.fillStyle = '#c9ccd1';
  g.fillRect(150, 70, 70, 60);
  g.fillStyle = '#7d8590';
  g.fillRect(160, 80, 50, 10);
  g.fillStyle = '#2b2b2b';
  g.fillRect(172, 104, 8, 14);
  g.fillRect(192, 104, 8, 14);
  shelf(g, 150);
  // cups and cake slices on the table
  for (const x of [34, 70, 106]) {
    g.fillStyle = '#ffffff';
    g.fillRect(x - 10, CELL - 66, 20, 18);
    g.fillStyle = '#6b3e22';
    g.fillRect(x - 8, CELL - 66, 16, 4);
  }
  for (const x of [160, 204]) {
    g.fillStyle = '#f4d9a4';
    g.beginPath();
    g.moveTo(x - 16, CELL - 48);
    g.lineTo(x + 16, CELL - 48);
    g.lineTo(x + 16, CELL - 70);
    g.closePath();
    g.fill();
    g.fillStyle = '#7b3f20';
    g.fillRect(x - 16, CELL - 56, 32, 4);
  }
}

const DRAW: Record<ShopKind, (g: CanvasRenderingContext2D, r: () => number) => void> = {
  bakery: drawBakery,
  books: drawBooks,
  toys: drawToys,
  flowers: drawFlowers,
  sweets: drawSweets,
  clothes: drawClothes,
  cafe: drawCafe,
};

/** A soft diagonal sheen and a darker bottom edge so the plane reads as glass. */
function glass(g: CanvasRenderingContext2D): void {
  g.save();
  g.globalCompositeOperation = 'screen';
  const s = g.createLinearGradient(0, 0, CW, CELL * 1.4);
  s.addColorStop(0.0, 'rgba(255,255,255,0)');
  s.addColorStop(0.28, 'rgba(255,255,255,0)');
  s.addColorStop(0.34, 'rgba(220,235,255,0.35)');
  s.addColorStop(0.42, 'rgba(255,255,255,0)');
  s.addColorStop(0.55, 'rgba(255,255,255,0)');
  s.addColorStop(0.6, 'rgba(220,235,255,0.22)');
  s.addColorStop(0.64, 'rgba(255,255,255,0)');
  g.fillStyle = s;
  g.fillRect(0, 0, CW, CELL);
  g.restore();
  const v = g.createLinearGradient(0, 0, 0, CELL);
  v.addColorStop(0, 'rgba(40,30,20,0.25)');
  v.addColorStop(0.15, 'rgba(40,30,20,0)');
  v.addColorStop(0.9, 'rgba(40,30,20,0)');
  v.addColorStop(1, 'rgba(40,30,20,0.25)');
  g.fillStyle = v;
  g.fillRect(0, 0, CW, CELL);
}

function atlas(): THREE.MeshBasicMaterial {
  if (shared) return shared;
  const c = document.createElement('canvas');
  c.width = CW * COLS;
  c.height = CELL * ROWS;
  const g = c.getContext('2d')!;
  SHOP_KINDS.forEach((kind, i) => {
    const ox = (i % COLS) * CW;
    const oy = Math.floor(i / COLS) * CELL;
    // two different tiles side by side, so the shop is wide without repeating exactly
    for (const half of [0, 1]) {
      g.save();
      g.translate(ox + half * CELL, oy);
      g.beginPath();
      g.rect(0, 0, CELL, CELL);
      g.clip();
      DRAW[kind](g, rng(31 + i * 7 + half * 101));
      g.restore();
    }
    g.save();
    g.translate(ox, oy);
    g.beginPath();
    g.rect(0, 0, CW, CELL);
    g.clip();
    glass(g);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // lit from inside: not shaded by the sun, a touch dimmer than pure white
  shared = new THREE.MeshBasicMaterial({ map: tex, color: '#f2ece2' });
  shared.name = 'shopWindows';
  return shared;
}

/** A window plane (facing +z) showing the inside of one kind of shop. */
export function shopWindow(kind: ShopKind, w: number, h: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h);
  const i = SHOP_KINDS.indexOf(kind);
  const u0 = (i % COLS) / COLS;
  const v0 = 1 - (Math.floor(i / COLS) + 1) / ROWS;
  // crop the 2:1 cell to the window's shape so goods are not stretched
  // (a wider window keeps the lower part: the table and the shelves)
  const aspect = w / h;
  const cu = aspect >= 2 ? 1 : aspect / 2;
  const cv = aspect >= 2 ? 2 / aspect : 1;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let k = 0; k < uv.count; k++) {
    const u = 0.5 + (uv.getX(k) - 0.5) * cu;
    const v = (1 - cv) * 0.3 + uv.getY(k) * cv;
    uv.setXY(k, u0 + u / COLS, v0 + v / ROWS);
  }
  const mesh = new THREE.Mesh(geo, atlas());
  mesh.name = `shopWindow:${kind}`;
  return mesh;
}
