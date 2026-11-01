import * as THREE from 'three';
import type { Input } from '../core/Input';
import type { CollisionWorld } from '../world/Collision';
import { HALF_CITY } from '../world/cityLayout';

/**
 * Orbit camera with two modes:
 *
 * - **free**: orbits a ground point (title screen, cinematic flights). Dragging
 *   grabs the ground and pans.
 * - **follow**: third-person camera behind the player. Dragging (mouse or one
 *   finger) orbits, wheel / pinch zooms, Q/E rotate. The camera is pulled in
 *   when a building gets between it and the player.
 *
 * All motion is damped toward "goal" values so it always feels smooth.
 */

export interface CameraState {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  distance: number;
}

interface Limits {
  minDist: number;
  maxDist: number;
  minPitch: number;
  maxPitch: number;
}

const FREE: Limits = { minDist: 16, maxDist: 190, minPitch: 0.42, maxPitch: 1.3 };
const FOLLOW: Limits = { minDist: 4, maxDist: 48, minPitch: 0.08, maxPitch: 1.25 };
const BOUND = HALF_CITY + 15;

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  /** Current (damped) state. */
  readonly state: CameraState = { x: 0, z: 18, yaw: 0, pitch: 0.82, distance: 95 };
  private goal: CameraState = { ...this.state };
  private pointers = new Map<number, { x: number; y: number }>();
  private dragMode: 'none' | 'pan' | 'rotate' = 'none';
  private grabPoint: THREE.Vector3 | null = null;
  private pinch: { dist: number; angle: number; midY: number } | null = null;
  private tapStart: { x: number; y: number; t: number; moved: boolean } | null = null;
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private flight: { from: CameraState; to: CameraState; t: number; dur: number } | null = null;
  private lookY = 0;
  /** Distance actually used after pulling in for walls. */
  private clearDist = 95;
  private follow: { pos: THREE.Vector3; lookHeight: number } | null = null;
  onTap: ((clientX: number, clientY: number) => void) | null = null;
  enabled = true;
  /** Player setting: multiplies how fast keys and drags turn the camera. */
  turnSpeed = 1;
  /** Slow automatic orbit used behind the title screen. */
  attract = false;
  collision: CollisionWorld | null = null;

  constructor(
    private dom: HTMLElement,
    aspect: number,
    private input: Input,
  ) {
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.3, 2000);
    this.bind();
    this.applyToCamera(0);
  }

  get mode(): 'free' | 'follow' {
    return this.follow ? 'follow' : 'free';
  }

  private get limits(): Limits {
    return this.follow ? FOLLOW : FREE;
  }

  get target(): THREE.Vector3 {
    return new THREE.Vector3(this.state.x, 0, this.state.z);
  }

  /** Starts following a moving point (the player). */
  setFollow(pos: THREE.Vector3 | null, lookHeight = 1.4): void {
    this.follow = pos ? { pos, lookHeight } : null;
    this.clampGoal();
  }

  setState(s: Partial<CameraState>, immediate = false): void {
    Object.assign(this.goal, s);
    this.clampGoal();
    if (immediate) {
      Object.assign(this.state, this.goal);
      this.clearDist = this.state.distance;
      this.applyToCamera(0);
    }
  }

  flyTo(x: number, z: number, distance = this.goal.distance, duration = 1.4, extra: Partial<CameraState> = {}): void {
    const to: CameraState = { ...this.goal, x, z, distance, ...extra };
    this.flight = { from: { ...this.state }, to, t: 0, dur: duration };
  }

  get isFlying(): boolean {
    return this.flight !== null;
  }

  rotateBy(radians: number): void {
    this.flight = null;
    this.goal.yaw += radians;
  }

  zoomBy(factor: number): void {
    this.flight = null;
    this.goal.distance *= factor;
    this.clampGoal();
  }

  /** Puts the camera right behind a heading (used when spawning). */
  snapBehind(heading: number): void {
    this.goal.yaw = heading + Math.PI;
    this.state.yaw = this.goal.yaw;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.8 ? 64 : 58;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    if (this.flight) {
      const f = this.flight;
      if (this.follow) {
        f.to.x = this.follow.pos.x;
        f.to.z = this.follow.pos.z;
      }
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
      const lift = Math.sin(f.t * Math.PI) * Math.min(60, Math.hypot(f.to.x - f.from.x, f.to.z - f.from.z) * 0.35);
      this.state.x = THREE.MathUtils.lerp(f.from.x, f.to.x, e);
      this.state.z = THREE.MathUtils.lerp(f.from.z, f.to.z, e);
      this.state.yaw = THREE.MathUtils.lerp(f.from.yaw, f.to.yaw, e);
      this.state.pitch = THREE.MathUtils.lerp(f.from.pitch, f.to.pitch, e);
      this.state.distance = THREE.MathUtils.lerp(f.from.distance, f.to.distance, e) + lift;
      this.clearDist = this.state.distance;
      if (f.t >= 1) {
        this.flight = null;
        Object.assign(this.goal, f.to);
      }
      this.applyToCamera(dt);
      return;
    }

    if (this.attract) this.goal.yaw += dt * 0.06;

    if (this.enabled) {
      const i = this.input;
      if (i.down('KeyQ')) this.goal.yaw += dt * 1.8 * this.turnSpeed;
      if (i.down('KeyE') && !this.follow) this.goal.yaw -= dt * 1.8 * this.turnSpeed;
      if (i.down('KeyR')) this.goal.yaw -= dt * 1.8 * this.turnSpeed;
      if (i.down('Equal') || i.down('NumpadAdd')) this.goal.distance *= 1 - dt * 1.2;
      if (i.down('Minus') || i.down('NumpadSubtract')) this.goal.distance *= 1 + dt * 1.2;
      if (!this.follow) {
        // free mode: keys pan the view
        const m = i.move();
        if (m.magnitude) {
          const speed = (18 + this.goal.distance * 0.75) * (i.running() ? 2 : 1) * dt;
          const s = Math.sin(this.goal.yaw);
          const c = Math.cos(this.goal.yaw);
          this.goal.x += (m.x * c - m.y * s) * speed;
          this.goal.z += (-m.x * s - m.y * c) * speed;
        }
      }
    }
    if (this.follow) {
      this.goal.x = this.follow.pos.x;
      this.goal.z = this.follow.pos.z;
    }
    this.clampGoal();

    const k = 1 - Math.exp(-dt * (this.follow ? 14 : 9));
    const kr = 1 - Math.exp(-dt * 7);
    this.state.x += (this.goal.x - this.state.x) * k;
    this.state.z += (this.goal.z - this.state.z) * k;
    this.state.yaw += (this.goal.yaw - this.state.yaw) * kr;
    this.state.pitch += (this.goal.pitch - this.state.pitch) * kr;
    this.state.distance += (this.goal.distance - this.state.distance) * kr;
    this.applyToCamera(dt);
  }

  private clampGoal(): void {
    const g = this.goal;
    const l = this.limits;
    // the free camera stays over the city; following, the player's own bounds apply (rooms lie outside it)
    if (!this.follow) {
      g.x = THREE.MathUtils.clamp(g.x, -BOUND, BOUND);
      g.z = THREE.MathUtils.clamp(g.z, -BOUND, BOUND);
    }
    g.distance = THREE.MathUtils.clamp(g.distance, l.minDist, l.maxDist);
    g.pitch = THREE.MathUtils.clamp(g.pitch, l.minPitch, l.maxPitch);
  }

  private applyToCamera(dt: number): void {
    const s = this.state;
    const lookTarget = this.follow ? this.follow.pos.y + this.follow.lookHeight : 0;
    this.lookY += (lookTarget - this.lookY) * (dt ? 1 - Math.exp(-dt * 10) : 1);
    const lx = s.x;
    const lz = s.z;
    const ly = this.lookY;
    let dist = s.distance;
    if (this.follow && this.collision && !this.flight) {
      // pull the camera in front of any wall between it and the player
      const h = Math.cos(s.pitch);
      const cx = lx + Math.sin(s.yaw) * h * dist;
      const cy = ly + Math.sin(s.pitch) * dist;
      const cz = lz + Math.cos(s.yaw) * h * dist;
      const hit = this.collision.raycast(lx, ly, lz, cx, cy, cz);
      const wanted = Math.max(1.6, hit < 1 ? hit * dist - 0.6 : dist);
      // snap in quickly, ease back out slowly
      const rate = wanted < this.clearDist ? 25 : 3;
      this.clearDist += (wanted - this.clearDist) * (dt ? 1 - Math.exp(-dt * rate) : 1);
      dist = Math.min(dist, this.clearDist);
    } else {
      this.clearDist = dist;
    }
    const h = Math.cos(s.pitch) * dist;
    this.camera.position.set(lx + Math.sin(s.yaw) * h, ly + Math.max(0.6 - ly, Math.sin(s.pitch) * dist), lz + Math.cos(s.yaw) * h);
    this.camera.lookAt(lx, ly, lz);
  }

  private groundAt(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.ground, p) ? p : null;
  }

  private bind(): void {
    const el = this.dom;
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.flight = null;
      if (this.pointers.size === 1) {
        this.tapStart = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
        const rotate = this.follow || e.button === 2 || e.ctrlKey || e.shiftKey;
        this.dragMode = rotate ? 'rotate' : 'pan';
        this.grabPoint = rotate ? null : this.groundAt(e.clientX, e.clientY);
      } else if (this.pointers.size === 2) {
        this.tapStart = null;
        this.dragMode = 'none';
        this.pinch = this.pinchInfo();
      }
    });

    el.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev || !this.enabled) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;
      if (this.tapStart && Math.hypot(e.clientX - this.tapStart.x, e.clientY - this.tapStart.y) > 8) this.tapStart.moved = true;

      if (this.pointers.size === 2 && this.pinch) {
        const now = this.pinchInfo();
        this.goal.distance *= this.pinch.dist / Math.max(1, now.dist);
        let da = now.angle - this.pinch.angle;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        this.goal.yaw -= da;
        this.goal.pitch += (now.midY - this.pinch.midY) * 0.004;
        this.pinch = now;
        this.clampGoal();
        return;
      }
      if (this.dragMode === 'rotate') {
        this.goal.yaw -= dx * 0.006 * this.turnSpeed;
        this.goal.pitch += dy * 0.004;
        this.clampGoal();
      } else if (this.dragMode === 'pan' && this.grabPoint) {
        const now = this.groundAt(e.clientX, e.clientY);
        if (now) {
          this.goal.x += this.grabPoint.x - now.x;
          this.goal.z += this.grabPoint.z - now.z;
          this.clampGoal();
          this.state.x = this.goal.x;
          this.state.z = this.goal.z;
          this.applyToCamera(0);
        }
      }
    });

    const end = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.tapStart && !this.tapStart.moved && performance.now() - this.tapStart.t < 450 && this.pointers.size === 0) {
        this.onTap?.(e.clientX, e.clientY);
      }
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 0) {
        this.dragMode = 'none';
        this.tapStart = null;
      } else if (this.pointers.size === 1) {
        const [p] = [...this.pointers.values()];
        this.dragMode = this.follow ? 'rotate' : 'pan';
        this.grabPoint = this.follow ? null : this.groundAt(p.x, p.y);
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    el.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this.flight = null;
        this.goal.distance *= Math.exp(e.deltaY * 0.0012);
        this.clampGoal();
      },
      { passive: false },
    );
  }

  private pinchInfo(): { dist: number; angle: number; midY: number } {
    const [a, b] = [...this.pointers.values()];
    return { dist: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x), midY: (a.y + b.y) / 2 };
  }
}
