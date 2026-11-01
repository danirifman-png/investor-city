import * as THREE from 'three';

/**
 * A magic portal: a glowing ring standing on two stones, a swirling disc
 * inside and sparks circling it. It faces local +z. `update` spins it.
 */

let swirlTex: THREE.Texture | null = null;

/** A spiral painted on a canvas (shared by every portal). */
function swirl(): THREE.Texture {
  if (swirlTex) return swirlTex;
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  g.addColorStop(0, '#fff6ff');
  g.addColorStop(0.35, '#c18cff');
  g.addColorStop(0.75, '#6a3fd8');
  g.addColorStop(1, '#2a1a6e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.translate(s / 2, s / 2);
  for (let arm = 0; arm < 4; arm++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const r = t * s * 0.5;
      const a = t * Math.PI * 2.2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 10;
    ctx.stroke();
  }
  swirlTex = new THREE.CanvasTexture(c);
  swirlTex.colorSpace = THREE.SRGBColorSpace;
  return swirlTex;
}

export interface Portal {
  object: THREE.Group;
  update(time: number): void;
}

export function buildPortal(color = '#a26bff'): Portal {
  const g = new THREE.Group();
  g.name = 'portal';
  const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.3 });
  const stone = new THREE.MeshStandardMaterial({ color: '#8d93a6', roughness: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.13, 12, 40), glow);
  ring.position.y = 1.45;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.05, 40), new THREE.MeshBasicMaterial({ map: swirl(), transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }));
  disc.position.y = 1.45;
  for (const s of [-1, 1]) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), stone);
    rock.scale.set(1, 0.7, 0.9);
    rock.position.set(s * 0.95, 0.22, 0);
    rock.castShadow = true;
    g.add(rock);
  }
  const sparkMat = new THREE.MeshBasicMaterial({ color: '#fff3a8' });
  const sparks = Array.from({ length: 8 }, () => new THREE.Mesh(new THREE.OctahedronGeometry(0.07), sparkMat));
  const light = new THREE.PointLight(color, 3, 6, 1.6);
  light.position.set(0, 1.45, 0.4);
  g.add(ring, disc, light, ...sparks);
  return {
    object: g,
    update(time: number) {
      disc.rotation.z = -time * 1.6;
      const k = 1 + Math.sin(time * 3) * 0.04;
      ring.scale.set(k, k, 1);
      glow.emissiveIntensity = 1.2 + Math.sin(time * 4) * 0.3;
      sparks.forEach((sp, i) => {
        const a = time * 1.3 + (i / sparks.length) * Math.PI * 2;
        const r = 1.35 + Math.sin(time * 2 + i) * 0.1;
        sp.position.set(Math.cos(a) * r, 1.45 + Math.sin(a) * r, Math.sin(time * 3 + i) * 0.15);
        sp.rotation.y = time * 4;
      });
    },
  };
}
