import * as THREE from 'three';
import type { CharacterLook } from '../content/characterOptions';
import { AvatarAnimator, loadAvatar } from './AvatarNpc';
import { CharacterAnimator } from './CharacterAnimator';
import { heroModel, type HeroId } from './hero';
import { buildCharacter, disposeCharacter, type Rig } from './CharacterModel';

/**
 * The character creator's 3D preview: a small lit stage rendered by the main
 * renderer instead of the city while the creator is open. The character is
 * framed in the part of the screen the creator panel leaves free.
 */
export class Studio {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private rig: Rig | null = null;
  private animator: CharacterAnimator | null = null;
  private hero: { scene: THREE.Object3D; animator: AvatarAnimator } | null = null;
  private heroes = new Map<string, { scene: THREE.Object3D; animator: AvatarAnimator }>();
  private loading = new Set<string>();
  private heroId = '';
  private look: CharacterLook | null = null;
  private turntable = new THREE.Group();
  private spin = 0.5;
  private spinVel = 0;
  private dragging = false;

  constructor() {
    this.scene.background = new THREE.Color('#203152');
    this.scene.fog = new THREE.Fog('#203152', 12, 30);
    this.scene.add(new THREE.HemisphereLight('#dfeaff', '#2a2f3c', 1.3));
    const key = new THREE.DirectionalLight('#fff2dc', 2.4);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -2;
    key.shadow.camera.right = key.shadow.camera.top = 2;
    const rim = new THREE.DirectionalLight('#7ec8ff', 1.4);
    rim.position.set(-3, 3, -4);
    this.scene.add(key, rim);

    const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.25, 48), new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.4, metalness: 0.3 }));
    stage.position.y = -0.125;
    stage.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.02, 48), new THREE.MeshStandardMaterial({ color: '#fff3c9', roughness: 0.6 }));
    top.position.y = 0.005;
    top.receiveShadow = true;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a3d63', roughness: 0.9 }));
    floor.position.y = -0.25;
    floor.receiveShadow = true;
    this.scene.add(stage, top, floor, this.turntable);
    // floating coins for a little magic
    const coinMat = new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 0.8, roughness: 0.3 });
    for (let i = 0; i < 9; i++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.025, 20), coinMat);
      const a = (i / 9) * Math.PI * 2;
      coin.position.set(Math.cos(a) * 2.6, 0.6 + (i % 3) * 0.7, Math.sin(a) * 2.6 - 1);
      coin.rotation.x = Math.PI / 2;
      coin.userData.phase = i;
      coin.name = 'coin';
      this.scene.add(coin);
    }
  }

  setLook(look: CharacterLook): void {
    this.look = look;
    if (look.model !== 'custom' && heroModel(look.hero).id !== this.heroId) this.loadHero(look.hero);
    if (this.rig) disposeCharacter(this.rig);
    this.rig = buildCharacter(look);
    this.turntable.add(this.rig.root);
    if (this.animator) this.animator.setRig(this.rig);
    else this.animator = new CharacterAnimator(this.rig);
    this.showModel();
  }

  /** Loads a hero model for the preview (each one once; the built body shows until it arrives). */
  loadHero(id?: HeroId): void {
    const h = heroModel(id);
    this.heroId = h.id;
    const cached = this.heroes.get(h.id);
    if (cached) {
      this.hero = cached;
      this.showModel();
      return;
    }
    if (this.loading.has(h.id)) return;
    this.loading.add(h.id);
    void loadAvatar(h.model)
      .then(({ scene, clips }) => {
        scene.scale.setScalar(h.scale);
        this.turntable.add(scene);
        const entry = { scene, animator: new AvatarAnimator(scene, clips, h.walkSpeed) };
        this.heroes.set(h.id, entry);
        if (this.heroId === h.id) this.hero = entry;
        this.showModel();
      })
      .catch((err) => console.warn('hero model failed to load', err));
  }

  private showModel(): void {
    const hero = !!this.hero && this.look?.model !== 'custom';
    if (this.rig) this.rig.root.visible = !hero;
    for (const e of this.heroes.values()) e.scene.visible = hero && e === this.hero;
  }

  private get active(): { play(k: 'wave' | 'cheer'): void } | null {
    return this.hero && this.look?.model !== 'custom' ? this.hero.animator : this.animator;
  }

  wave(): void {
    this.active?.play('wave');
  }

  cheer(): void {
    this.active?.play('cheer');
  }

  /** Drag rotation from the creator UI. */
  drag(dx: number): void {
    this.dragging = true;
    this.spin += dx * 0.01;
    this.spinVel = dx * 0.6;
  }

  release(): void {
    this.dragging = false;
  }

  /** Frames the character in the free part of the screen. */
  layout(width: number, height: number, panel: { side: 'right' | 'bottom'; size: number }): void {
    this.camera.aspect = width / height;
    // the character is ~1.9 m tall; keep it filling about 70% of the free space
    const freeH = panel.side === 'bottom' ? height * (1 - panel.size) : height;
    const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const visibleH = (2.5 * height) / freeH;
    const dist = visibleH / 2 / Math.tan(fovRad / 2);
    this.camera.position.set(0, 1.25, dist);
    this.camera.lookAt(0, 0.95, 0);
    // shift the image so the character sits in the middle of the free area
    const fullW = width;
    const fullH = height;
    const offX = panel.side === 'right' ? (width * panel.size) / 2 : 0;
    const offY = panel.side === 'bottom' ? (height * panel.size) / 2 : 0;
    this.camera.setViewOffset(fullW, fullH, offX, offY, fullW, fullH);
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, time: number): void {
    if (!this.dragging) {
      this.spinVel *= Math.exp(-dt * 3);
      this.spin += this.spinVel * dt + dt * 0.25;
    }
    this.turntable.rotation.y = this.spin;
    this.animator?.update(dt, 0);
    this.hero?.animator.update(dt, 0);
    this.scene.traverse((o) => {
      if (o.name === 'coin') {
        o.rotation.z = time * 1.5 + o.userData.phase;
        o.position.y += Math.sin(time * 1.2 + o.userData.phase) * 0.002;
      }
    });
  }
}
