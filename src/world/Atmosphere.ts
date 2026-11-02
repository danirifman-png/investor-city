import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Clouds, skyEnvironment } from './Style';

/**
 * Sky dome, sun, ambient light, fog and the day/night blend. The sun's shadow
 * frustum follows the camera target so shadows stay crisp at any zoom level
 * without a huge shadow map.
 */

interface Palette {
  skyTop: THREE.Color;
  skyBottom: THREE.Color;
  fog: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  env: number;
  exposure: number;
}

const DAY: Palette = {
  skyTop: new THREE.Color('#4f9be6'),
  skyBottom: new THREE.Color('#cfe8ff'),
  fog: new THREE.Color('#cfe3f5'),
  sun: new THREE.Color('#fff2d9'),
  sunIntensity: 2.6,
  hemiSky: new THREE.Color('#d7ecff'),
  hemiGround: new THREE.Color('#8a9a6a'),
  hemiIntensity: 0.9,
  env: 0.45,
  exposure: 1.0,
};

/** Vivid mode: deeper blue sky, warm sun, colourful fill from the sky itself. */
const VIVID_DAY: Palette = {
  skyTop: new THREE.Color('#3d86d6'),
  skyBottom: new THREE.Color('#dbe8f2'),
  fog: new THREE.Color('#d3dfe8'),
  sun: new THREE.Color('#fff0dc'),
  sunIntensity: 3.1,
  hemiSky: new THREE.Color('#d4e4f4'),
  hemiGround: new THREE.Color('#9a8a70'),
  hemiIntensity: 0.7,
  env: 0.85,
  exposure: 1.0,
};

const NIGHT: Palette = {
  skyTop: new THREE.Color('#050b1f'),
  skyBottom: new THREE.Color('#1c2a52'),
  fog: new THREE.Color('#141d38'),
  sun: new THREE.Color('#9db4ff'),
  sunIntensity: 0.55,
  hemiSky: new THREE.Color('#3a4f8a'),
  hemiGround: new THREE.Color('#1a1f2e'),
  hemiIntensity: 0.55,
  env: 0.12,
  exposure: 1.05,
};

/** A grey day; rain is the same sky, darker. */
const OVERCAST: Palette = {
  skyTop: new THREE.Color('#7e8b99'),
  skyBottom: new THREE.Color('#c9d0d7'),
  fog: new THREE.Color('#bcc4cc'),
  sun: new THREE.Color('#e8edf2'),
  sunIntensity: 1.3,
  hemiSky: new THREE.Color('#d0d8e0'),
  hemiGround: new THREE.Color('#7f8a78'),
  hemiIntensity: 1.05,
  env: 0.45,
  exposure: 1.0,
};

const RAIN: Palette = {
  skyTop: new THREE.Color('#566270'),
  skyBottom: new THREE.Color('#99a3ad'),
  fog: new THREE.Color('#8e98a2'),
  sun: new THREE.Color('#d6dde4'),
  sunIntensity: 0.8,
  hemiSky: new THREE.Color('#b4bec8'),
  hemiGround: new THREE.Color('#5f6a5c'),
  hemiIntensity: 1.0,
  env: 0.35,
  exposure: 0.98,
};

/** A hot day: a paler, warmer sky and a stronger sun. */
const HOT: Palette = {
  skyTop: new THREE.Color('#5aa0d8'),
  skyBottom: new THREE.Color('#f3e6c8'),
  fog: new THREE.Color('#ece0c6'),
  sun: new THREE.Color('#ffe2b0'),
  sunIntensity: 3.3,
  hemiSky: new THREE.Color('#f0e4cc'),
  hemiGround: new THREE.Color('#a08a62'),
  hemiIntensity: 0.85,
  env: 0.8,
  exposure: 1.04,
};

export type SkyWeather = 'hot' | 'sunny' | 'cloudy' | 'rain';

const RAIN_DROPS = 900;
const RAIN_BOX = { w: 70, h: 34 };

/** Falling rain streaks in a box that travels with the view. */
class Rain {
  readonly lines: THREE.LineSegments;
  private pos: Float32Array;
  private speed: Float32Array;
  constructor() {
    this.pos = new Float32Array(RAIN_DROPS * 6);
    this.speed = new Float32Array(RAIN_DROPS);
    for (let i = 0; i < RAIN_DROPS; i++) {
      const x = (Math.random() - 0.5) * RAIN_BOX.w;
      const y = Math.random() * RAIN_BOX.h;
      const z = (Math.random() - 0.5) * RAIN_BOX.w;
      this.pos.set([x, y, z, x + 0.05, y + 0.7, z + 0.03], i * 6);
      this.speed[i] = 16 + Math.random() * 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#c4d2e0', transparent: true, opacity: 0, depthWrite: false }));
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    this.lines.name = 'rain';
  }
  update(dt: number, amount: number): void {
    const mat = this.lines.material as THREE.LineBasicMaterial;
    mat.opacity = 0.55 * amount;
    this.lines.visible = amount > 0.02;
    if (!this.lines.visible) return;
    for (let i = 0; i < RAIN_DROPS; i++) {
      const o = i * 6;
      const d = this.speed[i] * dt;
      this.pos[o + 1] -= d;
      this.pos[o + 4] -= d;
      if (this.pos[o + 1] < 0) {
        const y = RAIN_BOX.h * (0.9 + Math.random() * 0.1);
        this.pos[o + 1] = y;
        this.pos[o + 4] = y + 0.7;
      }
    }
    (this.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

export class Atmosphere {
  readonly sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private skyMat: THREE.ShaderMaterial;
  private sky!: THREE.Mesh;
  private stars: THREE.Points;
  private night = 0;
  private nightTarget = 0;
  private sunOffset = new THREE.Vector3(-60, 80, 70);
  private shadowExtent = 80;
  private day: Palette;
  /** The weather palette the day blends toward, and how far (0 clear .. 1 full). */
  private weather: SkyWeather = 'sunny';
  private wx = 0;
  private wxTarget = 0;
  private wxPalette: Palette = OVERCAST;
  private rain = new Rain();
  private indoors = false;
  private mixed: Palette = { ...DAY, skyTop: new THREE.Color(), skyBottom: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color() };
  readonly clouds: Clouds | null = null;

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    shadowMapSize: number,
    readonly vivid = false,
  ) {
    this.day = vivid ? VIVID_DAY : DAY;
    if (vivid) {
      scene.environment = skyEnvironment(renderer, VIVID_DAY.skyTop.clone(), VIVID_DAY.skyBottom.clone(), VIVID_DAY.hemiGround.clone());
      this.clouds = new Clouds();
      scene.add(this.clouds.group);
    } else {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: this.day.skyTop.clone() },
        bottom: { value: this.day.skyBottom.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 bottom;
        varying vec3 vPos;
        void main() {
          float h = clamp(vPos.y * 1.6 + 0.15, 0.0, 1.0);
          gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const sky = (this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat));
    sky.name = 'sky';
    sky.renderOrder = -1;
    scene.add(sky);

    // stars, only visible at night
    const starGeo = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i < 700; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9);
      const r = 850;
      pts.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    scene.add(this.stars);

    scene.fog = new THREE.Fog(this.day.fog.clone(), vivid ? 170 : 260, vivid ? 720 : 720);

    this.hemi = new THREE.HemisphereLight(this.day.hemiSky, this.day.hemiGround, this.day.hemiIntensity);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(this.day.sun, this.day.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 420;
    scene.add(this.sun, this.sun.target);
    scene.add(this.rain.lines);
    this.apply();
  }

  get isNight(): boolean {
    return this.nightTarget > 0.5;
  }

  get nightAmount(): number {
    return this.night;
  }

  setNight(on: boolean): void {
    this.nightTarget = on ? 1 : 0;
  }

  get currentWeather(): SkyWeather {
    return this.weather;
  }

  /** Blends the sky toward a weather; `immediate` skips the slow change. */
  setWeather(w: SkyWeather, immediate = false): void {
    if (w !== this.weather) {
      // fade the old weather out before switching palettes, unless clear
      if (this.wx > 0.01 && !immediate) {
        this.pending = w;
        this.wxTarget = 0;
        return;
      }
      this.weather = w;
    }
    this.pending = null;
    this.wxPalette = w === 'rain' ? RAIN : w === 'cloudy' ? OVERCAST : w === 'hot' ? HOT : this.day;
    this.wxTarget = w === 'sunny' ? 0 : 1;
    if (immediate) {
      this.wx = this.wxTarget;
      this.apply();
    }
  }
  private pending: SkyWeather | null = null;

  /** No rain inside rooms. */
  setIndoors(on: boolean): void {
    this.indoors = on;
  }

  /** Re-centres the shadow frustum on what the camera is looking at. */
  follow(target: THREE.Vector3, viewDistance: number): void {
    const extent = THREE.MathUtils.clamp(viewDistance * 0.95, 45, 150);
    if (Math.abs(extent - this.shadowExtent) > 4) {
      this.shadowExtent = extent;
      const cam = this.sun.shadow.camera;
      cam.left = cam.bottom = -extent;
      cam.right = cam.top = extent;
      cam.updateProjectionMatrix();
    }
    // snap to shadow texels to avoid shimmering edges while panning
    const texel = (this.shadowExtent * 2) / this.sun.shadow.mapSize.x;
    const tx = Math.round(target.x / texel) * texel;
    const tz = Math.round(target.z / texel) * texel;
    this.sun.target.position.set(tx, 0, tz);
    // the sky and stars travel with the view (Cloud Land is far from the city centre)
    this.sky.position.set(target.x, 0, target.z);
    this.stars.position.copy(this.sky.position);
    this.rain.lines.position.set(target.x, 0, target.z);
    this.sun.position.set(tx + this.sunOffset.x, this.sunOffset.y, tz + this.sunOffset.z);
  }

  /** Returns true while a day/night transition is in progress. */
  update(dt: number): boolean {
    this.clouds?.update(dt, this.night);
    this.rain.update(dt, this.weather === 'rain' && !this.indoors ? this.wx : 0);
    if (this.wx !== this.wxTarget) {
      const ws = dt / 4;
      this.wx = this.wxTarget > this.wx ? Math.min(this.wxTarget, this.wx + ws) : Math.max(this.wxTarget, this.wx - ws);
      if (this.wx === 0 && this.pending) this.setWeather(this.pending);
      if (this.night === this.nightTarget) {
        this.apply();
        return false;
      }
    }
    if (this.night === this.nightTarget) return false;
    const step = dt / 1.8;
    this.night = this.nightTarget > this.night ? Math.min(this.nightTarget, this.night + step) : Math.max(this.nightTarget, this.night - step);
    this.apply();
    return true;
  }

  private apply(): void {
    const n = THREE.MathUtils.smoothstep(this.night, 0, 1);
    // the day blended toward the weather, then toward night (grey nights stay a little greyer)
    const w = THREE.MathUtils.smoothstep(this.wx, 0, 1);
    const m = this.mixed, d = this.day, x = this.wxPalette;
    for (const k of ['skyTop', 'skyBottom', 'fog', 'sun', 'hemiSky', 'hemiGround'] as const) m[k].copy(d[k]).lerp(x[k], w);
    for (const k of ['sunIntensity', 'hemiIntensity', 'env', 'exposure'] as const) m[k] = THREE.MathUtils.lerp(d[k], x[k], w);
    const day = m;
    const lerp = (a: THREE.Color, b: THREE.Color, out: THREE.Color) => out.copy(a).lerp(b, n);
    lerp(day.skyTop, NIGHT.skyTop, this.skyMat.uniforms.top.value);
    lerp(day.skyBottom, NIGHT.skyBottom, this.skyMat.uniforms.bottom.value);
    lerp(day.fog, NIGHT.fog, (this.scene.fog as THREE.Fog).color);
    lerp(day.sun, NIGHT.sun, this.sun.color);
    lerp(day.hemiSky, NIGHT.hemiSky, this.hemi.color);
    lerp(day.hemiGround, NIGHT.hemiGround, this.hemi.groundColor);
    this.sun.intensity = THREE.MathUtils.lerp(day.sunIntensity, NIGHT.sunIntensity, n);
    this.hemi.intensity = THREE.MathUtils.lerp(day.hemiIntensity, NIGHT.hemiIntensity, n);
    this.scene.environmentIntensity = THREE.MathUtils.lerp(day.env, NIGHT.env, n);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(day.exposure, NIGHT.exposure, n);
    (this.stars.material as THREE.PointsMaterial).opacity = n;

    this.stars.visible = n > 0.01;
    // the moon sits on the other side of the sky
    this.sunOffset.set(THREE.MathUtils.lerp(70, -60, n), THREE.MathUtils.lerp(110, 120, n), THREE.MathUtils.lerp(55, 40, n));
  }
}
