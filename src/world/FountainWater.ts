import * as THREE from 'three';

/**
 * Moving water for the plaza fountain: rippling pools, sheets of water that
 * pour over each bowl's rim (a streaked texture scrolling down), a jet at the
 * top, foam rings where the water lands and droplets that arc and splash.
 * Everything is built in the fountain's local space; `update` animates it.
 */

/** Vertical streaks with soft gaps: the look of water falling in threads. */
function streakTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, w, h);
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const x = rnd() * w;
    const lw = 1.5 + rnd() * 4;
    const y0 = rnd() * h;
    const len = h * (0.35 + rnd() * 0.65);
    const a = 0.35 + rnd() * 0.5;
    const grad = g.createLinearGradient(0, y0, 0, y0 + len);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.3, `rgba(235,250,255,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    // wrap vertically so the scroll has no seam
    g.fillRect(x, y0, lw, len);
    g.fillRect(x, y0 - h, lw, len);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft rings of ripples, tiling, for the pools. */
function rippleTexture(): THREE.CanvasTexture {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const base = g.createLinearGradient(0, 0, s, s);
  base.addColorStop(0, '#2f9fd6');
  base.addColorStop(1, '#46b8e6');
  g.fillStyle = base;
  g.fillRect(0, 0, s, s);
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * s;
    const y = rnd() * s;
    const r = 6 + rnd() * 26;
    g.strokeStyle = `rgba(220,248,255,${0.12 + rnd() * 0.25})`;
    g.lineWidth = 1 + rnd() * 2;
    for (const dx of [-s, 0, s])
      for (const dy of [-s, 0, s]) {
        g.beginPath();
        g.arc(x + dx, y + dy, r, rnd() * Math.PI, rnd() * Math.PI + Math.PI * 0.8);
        g.stroke();
      }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function dropTexture(): THREE.CanvasTexture {
  const s = 32;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.45, 'rgba(225,246,255,0.8)');
  r.addColorStop(1, 'rgba(225,246,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A bowl the water pours over: its rim, the height of its pool and where the sheet lands. */
export interface Pour {
  rim: number;
  top: number;
  land: number;
  /** Radius where the falling sheet meets the pool below. */
  landR: number;
}

interface Drop {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  floor: number;
}

const GRAVITY = 9.8;

export class FountainWater {
  readonly group = new THREE.Group();
  private streaks: THREE.CanvasTexture[] = [];
  private ripples: THREE.CanvasTexture;
  private foams: THREE.Mesh[] = [];
  private jet: THREE.Mesh;
  private drops: Drop[] = [];
  private pos: Float32Array;
  private points: THREE.Points;

  /**
   * `pools`: [radius, y] of each pool surface; `pours`: each bowl that spills;
   * `jetY`: where the top jet starts.
   */
  constructor(pools: [number, number][], private pours: Pour[], private jetY: number) {
    this.group.name = 'fountainWater';
    this.ripples = rippleTexture();
    this.ripples.repeat.set(2, 2);
    const pool = new THREE.MeshStandardMaterial({ map: this.ripples, color: '#ffffff', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.92, envMapIntensity: 0.35 });
    for (const [r, y] of pools) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), pool);
      m.position.y = y;
      m.receiveShadow = true;
      this.group.add(m);
    }

    // pouring sheets: a slightly flared open tube per bowl, streaks scrolling down
    for (const p of pours) {
      const tex = streakTexture();
      tex.repeat.set(Math.round(p.rim * 5), 1);
      this.streaks.push(tex);
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: '#d9f4ff', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const h = p.top - p.land;
      const sheet = new THREE.Mesh(new THREE.CylinderGeometry(p.rim, p.landR, h, 40, 1, true), mat);
      sheet.position.y = p.land + h / 2;
      this.group.add(sheet);
      // white water where it lands
      const foam = new THREE.Mesh(
        new THREE.RingGeometry(p.landR - 0.25, p.landR + 0.35, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#f4fcff', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }),
      );
      foam.position.y = p.land + 0.02;
      this.foams.push(foam);
      this.group.add(foam);
    }

    // the jet: a narrow column of streaks shooting up
    const jetTex = streakTexture();
    jetTex.repeat.set(2, 1);
    this.streaks.push(jetTex);
    this.jet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.16, 1.5, 12, 1, true),
      new THREE.MeshBasicMaterial({ map: jetTex, color: '#e6f8ff', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    this.jet.position.y = jetY + 0.75;
    this.group.add(this.jet);

    // droplets: from the jet's top and along each rim
    const count = 420;
    this.pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const d: Drop = { x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, floor: 0 };
      this.spawn(d, i);
      // start spread over their life so the fountain is full at once
      this.step(d, Math.random() * 1.2);
      this.drops.push(d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ map: dropTexture(), size: 0.13, sizeAttenuation: true, transparent: true, depthWrite: false, color: '#ffffff', opacity: 0.9 }),
    );
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  private spawn(d: Drop, i: number): void {
    const a = Math.random() * Math.PI * 2;
    if (i % 3 === 0) {
      // from the top of the jet, out in a crown
      const out = 0.6 + Math.random() * 0.9;
      d.x = Math.cos(a) * 0.1;
      d.z = Math.sin(a) * 0.1;
      d.y = this.jetY + 1.5;
      d.vx = Math.cos(a) * out;
      d.vz = Math.sin(a) * out;
      d.vy = 1.2 + Math.random() * 1.4;
      d.floor = this.pours[this.pours.length - 1]?.top ?? 0;
    } else {
      // tumbling off a rim
      const p = this.pours[i % this.pours.length];
      const r = p.rim + 0.05;
      d.x = Math.cos(a) * r;
      d.z = Math.sin(a) * r;
      d.y = p.top - Math.random() * 0.1;
      const out = 0.3 + Math.random() * 0.5;
      d.vx = Math.cos(a) * out;
      d.vz = Math.sin(a) * out;
      d.vy = Math.random() * 0.4;
      d.floor = p.land;
    }
  }

  private step(d: Drop, dt: number): void {
    d.vy -= GRAVITY * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.z += d.vz * dt;
  }

  update(dt: number, time: number): void {
    const k = Math.min(dt, 0.05);
    for (const t of this.streaks) t.offset.y = (t.offset.y + k * 1.6) % 1;
    this.ripples.offset.set(Math.sin(time * 0.1) * 0.2, (time * 0.03) % 1);
    this.foams.forEach((f, i) => {
      const s = 1 + Math.sin(time * 5 + i) * 0.03;
      f.scale.set(s, 1, s);
    });
    this.jet.scale.set(1, 1 + Math.sin(time * 7) * 0.06, 1);
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      this.step(d, k);
      if (d.y < d.floor) this.spawn(d, i);
      this.pos[i * 3] = d.x;
      this.pos[i * 3 + 1] = d.y;
      this.pos[i * 3 + 2] = d.z;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
