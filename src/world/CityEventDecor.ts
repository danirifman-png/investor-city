import * as THREE from 'three';
import type { CityEventId } from '../core/Business';

/**
 * What the day's city event looks like in the plaza: strings of party flags
 * over the main path on busy days, and traffic cones on a roadworks day. Purely
 * visual (no collision), built once and switched by `show()`.
 */
const FLAG_COLORS = ['#e8443a', '#f5b80f', '#3fb6e8', '#3ec27a', '#b05de0', '#ff8a3c'];
const BUSY: CityEventId[] = ['festival', 'concert', 'market', 'marathon', 'match'];

export class CityEventDecor {
  readonly group = new THREE.Group();
  private flags: THREE.Group;
  private cones: THREE.Group;

  constructor() {
    this.group.name = 'city-event';
    this.flags = new THREE.Group();
    this.cones = new THREE.Group();
    this.group.add(this.flags, this.cones);

    // flag strings across the path, from pole to pole
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.42, 0], 3));
    tri.computeVertexNormals();
    const rows = [-6, 2, 10, 18, 26];
    const perRow = 22;
    const flagMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 });
    const flags = new THREE.InstancedMesh(tri, flagMat, rows.length * perRow);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    let k = 0;
    const poleMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 5.2, 8);
    const ropeMat = new THREE.LineBasicMaterial({ color: '#f3efe6' });
    for (const z of rows) {
      for (const x of [-7, 7]) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 2.6, z);
        this.flags.add(pole);
      }
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        pts.push(new THREE.Vector3(-7 + 14 * u, 5 - Math.sin(u * Math.PI) * 1.1, z));
      }
      this.flags.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ropeMat));
      for (let i = 0; i < perRow; i++) {
        const u = (i + 0.5) / perRow;
        m.makeTranslation(-7 + 14 * u, 5 - Math.sin(u * Math.PI) * 1.1, z);
        flags.setMatrixAt(k, m);
        flags.setColorAt(k, c.set(FLAG_COLORS[(i + z) % FLAG_COLORS.length]));
        k++;
      }
    }
    flags.instanceMatrix.needsUpdate = true;
    this.flags.add(flags);

    // a row of cones and a barrier at the plaza's south entrance
    const coneGeo = new THREE.ConeGeometry(0.28, 0.75, 12);
    const coneMat = new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.6 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    for (let i = 0; i < 7; i++) {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(-9 + i * 3, 0.67, 30);
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.12, 12), stripeMat);
      stripe.position.set(cone.position.x, 0.75, 30);
      cone.castShadow = true;
      this.cones.add(cone, stripe);
    }
    this.show('ordinary');
  }

  show(ev: CityEventId): void {
    this.flags.visible = BUSY.includes(ev);
    this.cones.visible = ev === 'roadworks';
  }
}
