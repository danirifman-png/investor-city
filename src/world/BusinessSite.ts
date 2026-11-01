import * as THREE from 'three';
import { loadGltf } from '../character/AvatarNpc';
import { STAGE_RULES, type BizStage } from '../core/Business';
import type { Block, CollisionWorld } from './Collision';
import { LAWN_Y, PLAZA } from './landmarks/plaza';
import { createCanvas, SIGN_FONT } from './Materials';
import { Marker } from './Markers';
import { MODEL_SIZES, modelUrl, type ModelKey } from './ModelLayer';

/**
 * The player's lemonade business on the plaza's east lawn. It shows the model
 * of the current stage (stand, cart, shop, bar) with its back edge fixed, so
 * it visibly grows toward the path, plus a name board and a ★ marker at the
 * counter. The collision box follows the stage: it is registered once at the
 * biggest size (so the collision grid covers it) and then resized in place.
 */

/** The front faces -X (toward the plaza path). */
const ROT = -Math.PI / 2;

export class BusinessSite {
  readonly group = new THREE.Group();
  readonly marker: Marker;
  private block: Block;
  private stage: BizStage | null = null;
  private model: THREE.Object3D | null = null;
  private board: THREE.Mesh;
  private boardText = '';
  private token = 0;
  private sparkle: THREE.PointLight;

  constructor(collision: CollisionWorld) {
    this.group.name = 'business';
    const big = this.footprint(3);
    this.block = { x0: big.x0, z0: big.z0, x1: big.x1, z1: big.z1, bottom: LAWN_Y, top: LAWN_Y + big.h, water: false };
    collision.add(this.block);
    this.marker = new Marker('game', 0, 2.6, PLAZA.business.z, 'business');
    this.group.add(this.marker.sprite);

    // a little painted name board on a post, beside the counter
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 8), new THREE.MeshStandardMaterial({ color: '#7b5a3a', roughness: 0.8 }));
    post.position.y = 0.95;
    this.board = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.96), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }));
    this.board.position.y = 1.95;
    this.board.rotation.y = -Math.PI / 2;
    const boardGroup = new THREE.Group();
    boardGroup.name = 'business-board';
    boardGroup.add(post, this.board);
    boardGroup.userData.isBoard = true;
    this.group.add(boardGroup);

    this.sparkle = new THREE.PointLight('#ffe27a', 0, 9, 1.5);
    this.group.add(this.sparkle);
  }

  /** Where the counter is (the player stands here to run the business). */
  get counter(): { x: number; z: number } {
    const f = this.footprint(this.stage ?? 0);
    return { x: f.x0 - 1.0, z: PLAZA.business.z };
  }

  private footprint(stage: BizStage): { x0: number; z0: number; x1: number; z1: number; h: number } {
    const r = STAGE_RULES[stage];
    const [w, h, d] = MODEL_SIZES[r.model as ModelKey];
    const depth = d * r.scale;
    const width = w * r.scale;
    const back = PLAZA.business.backX;
    const z = PLAZA.business.z;
    return { x0: back - depth, z0: z - width / 2, x1: back, z1: z + width / 2, h: h * r.scale };
  }

  /** Shows a stage (and celebrates when it is a step up). */
  setStage(stage: BizStage, owner: string, celebrate = false): void {
    const f = this.footprint(stage);
    Object.assign(this.block, { x0: f.x0, z0: f.z0, x1: f.x1, z1: f.z1, top: LAWN_Y + f.h });
    const c = this.counter;
    this.marker.position.set(c.x + 0.3, Math.min(3.4, f.h * 0.75), c.z);
    const boardGroup = this.group.children.find((o) => o.userData.isBoard)!;
    boardGroup.position.set(c.x + 0.2, LAWN_Y, f.z0 - 0.9);
    this.setBoard(stage, owner);
    if (stage === this.stage) return;
    this.stage = stage;
    const r = STAGE_RULES[stage];
    const token = ++this.token;
    void loadGltf(modelUrl(r.model as ModelKey))
      .then((g) => {
        if (token !== this.token) return;
        if (this.model) this.group.remove(this.model);
        const obj = g.scene.clone(true);
        obj.scale.setScalar(r.scale);
        obj.rotation.y = ROT;
        obj.position.set((f.x0 + f.x1) / 2, LAWN_Y, (f.z0 + f.z1) / 2);
        obj.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
        });
        this.group.add(obj);
        this.model = obj;
        if (celebrate) {
          obj.scale.setScalar(r.scale * 0.2);
          obj.userData.grow = 0;
          this.sparkle.position.set((f.x0 + f.x1) / 2, f.h + 1, (f.z0 + f.z1) / 2);
        }
      })
      .catch(() => undefined);
  }

  private setBoard(stage: BizStage, owner: string): void {
    const text = `${owner}|${stage}`;
    if (text === this.boardText) return;
    this.boardText = text;
    const [c, g] = createCanvas(384, 160);
    g.fillStyle = '#fff6c9';
    g.fillRect(0, 0, 384, 160);
    g.strokeStyle = '#e0a400';
    g.lineWidth = 12;
    g.strokeRect(6, 6, 372, 148);
    g.fillStyle = '#5a3d00';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.font = `800 40px ${SIGN_FONT}`;
    g.fillText('🍋 ' + owner, 192, 62);
    g.font = `700 28px ${SIGN_FONT}`;
    g.fillText('★'.repeat(stage + 1) + '☆'.repeat(3 - stage), 192, 118);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = this.board.material as THREE.MeshStandardMaterial;
    mat.map?.dispose();
    mat.map = tex;
    mat.needsUpdate = true;
  }

  update(time: number, dt: number, near: boolean): void {
    this.marker.update(time, near);
    const m = this.model;
    if (m && m.userData.grow !== undefined) {
      m.userData.grow = Math.min(1, m.userData.grow + dt / 1.2);
      const k = m.userData.grow as number;
      const s = STAGE_RULES[this.stage!].scale;
      // a springy pop up to full size
      m.scale.setScalar(s * (1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.12));
      this.sparkle.intensity = 8 * Math.sin(k * Math.PI);
      if (k >= 1) {
        delete m.userData.grow;
        m.scale.setScalar(s);
        this.sparkle.intensity = 0;
      }
    }
  }
}
