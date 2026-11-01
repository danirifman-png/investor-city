import * as THREE from 'three';
import { HALF_CITY, majorRoadCenters, mulberry32, type Rect } from './cityLayout';
import { Crowd } from './Crowd';

/**
 * Moving life in the city: traffic, pedestrians and drifting clouds. Each
 * category is a couple of InstancedMeshes, so hundreds of agents cost only a
 * few draw calls.
 */

interface CarAgent {
  axis: 'x' | 'z';
  lane: number;
  dir: 1 | -1;
  pos: number;
  speed: number;
  /** 0..1 throttle; drops to 0 while the player stands in the lane ahead. */
  throttle: number;
}

const CAR_COLORS = ['#e34b4b', '#3d7be0', '#f2c14e', '#f4f4f4', '#2c2f36', '#4fc79a', '#f08a4b', '#a57cf2'];

/** Walking loops around the plaza: the fountain, the academy front and the square's width. */
export const PLAZA_LOOPS: Rect[] = [
  { x0: -4.5, z0: -11, x1: 15.5, z1: 9 },
  { x0: -9, z0: -9.5, x1: 9, z1: 24 },
  { x0: -22, z0: -9, x1: 22, z1: 4 },
];

export class Ambient {
  readonly group = new THREE.Group();
  private cars: CarAgent[] = [];
  private carBody: THREE.InstancedMesh;
  private carCabin: THREE.InstancedMesh;
  readonly crowd: Crowd;
  private clouds: THREE.Group[] = [];
  private dummy = new THREE.Object3D();
  private headlightMat: THREE.MeshBasicMaterial;
  private headlights: THREE.InstancedMesh;

  constructor(walkLoops: Rect[], quality: 'high' | 'low') {
    const rng = mulberry32(4242);
    this.group.name = 'ambient';

    // ---- traffic: right-hand driving, two lanes per major road
    const centers = majorRoadCenters();
    // the town is pedestrian now (like the reference art): no traffic
    const perLane = 0;
    for (const c of centers) {
      for (const axis of ['x', 'z'] as const) {
        for (const dir of [1, -1] as const) {
          // driving along +x keeps to +z; driving along +z keeps to -x
          const side = axis === 'x' ? dir : -dir;
          for (let i = 0; i < perLane; i++) {
            this.cars.push({
              axis,
              dir,
              lane: c + side * 3.3,
              pos: -HALF_CITY - 20 + ((HALF_CITY * 2 + 40) * (i + rng() * 0.5)) / perLane,
              speed: 9 + rng() * 6,
              throttle: 1,
            });
          }
        }
      }
    }
    const carMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3 });
    this.carBody = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.95, 4.2).translate(0, 0.85, 0), carMat, this.cars.length);
    this.carCabin = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.7, 0.75, 2.1).translate(0, 1.7, -0.2),
      new THREE.MeshStandardMaterial({ color: '#2a3a52', roughness: 0.1, metalness: 0.6 }),
      this.cars.length,
    );
    this.headlightMat = new THREE.MeshBasicMaterial({ color: '#fff6d0' });
    this.headlights = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.25, 0.1).translate(0, 0.95, 2.12), this.headlightMat, this.cars.length);
    const color = new THREE.Color();
    this.cars.forEach((_, i) => this.carBody.setColorAt(i, color.set(CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)])));
    for (const m of [this.carBody, this.carCabin]) {
      m.castShadow = true;
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.headlights.frustumCulled = false;
    this.group.add(this.headlights);

    // ---- people on the sidewalks (one draw call for all of them, see Crowd.ts)
    // a few strollers also circle the fountain and cross in front of the academy
    const plaza = PLAZA_LOOPS;
    // a light crowd: enough life in the streets without hiding the characters who matter
    const loops = [...walkLoops, ...plaza];
    // the named townsfolk (character/Townsfolk.ts) are the city's people now; the
    // instanced crowd stays available but empty
    this.crowd = new Crowd(loops, 0);
    void quality;
    this.group.add(this.crowd.group);

    // ---- clouds (they cast soft moving shadows over the city)
    const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.92 });
    const puff = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Group();
      const n = 4 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(puff, cloudMat);
        const s = 6 + rng() * 6;
        m.scale.set(s * 1.3, s * 0.7, s);
        m.position.set(k * 7 - n * 3.5, rng() * 2, (rng() - 0.5) * 8);
        m.castShadow = true;
        cloud.add(m);
      }
      cloud.position.set((rng() - 0.5) * 500, 85 + rng() * 25, (rng() - 0.5) * 400);
      cloud.userData.speed = 2 + rng() * 2;
      this.clouds.push(cloud);
      this.group.add(cloud);
    }
  }

  /** `player` (feet position) makes cars brake when the player is in their lane just ahead. */
  update(time: number, dt: number, player: THREE.Vector3 | null = null): void {
    const d = this.dummy;
    const span = HALF_CITY + 22;
    this.cars.forEach((car, i) => {
      let want = 1;
      if (player) {
        const across = car.axis === 'x' ? player.z : player.x;
        const along = (car.axis === 'x' ? player.x : player.z) - car.pos;
        const ahead = along * car.dir;
        if (Math.abs(across - car.lane) < 2.4 && ahead > -1.5 && ahead < 9) want = 0;
      }
      car.throttle += (want - car.throttle) * (1 - Math.exp(-dt * (want ? 2 : 9)));
      car.pos += car.dir * car.speed * car.throttle * dt;
      if (car.pos > span) car.pos = -span;
      if (car.pos < -span) car.pos = span;
      // shrink at the city edge so wrapping is not visible
      const edge = Math.min(1, Math.max(0, (span - Math.abs(car.pos)) / 8));
      if (car.axis === 'x') {
        d.position.set(car.pos, 0, car.lane);
        d.rotation.set(0, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      } else {
        d.position.set(car.lane, 0, car.pos);
        d.rotation.set(0, car.dir > 0 ? 0 : Math.PI, 0);
      }
      d.scale.setScalar(edge);
      d.updateMatrix();
      this.carBody.setMatrixAt(i, d.matrix);
      this.carCabin.setMatrixAt(i, d.matrix);
      this.headlights.setMatrixAt(i, d.matrix);
    });
    this.carBody.instanceMatrix.needsUpdate = true;
    this.carCabin.instanceMatrix.needsUpdate = true;
    this.headlights.instanceMatrix.needsUpdate = true;

    this.crowd.update(time, dt, player);

    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 300) c.position.x = -300;
    }
  }

  setNight(n: number): void {
    this.headlights.visible = n > 0.3;
  }
}
