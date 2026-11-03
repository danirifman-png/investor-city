import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

/**
 * The "vivid" art direction: a bright, saturated, stylised cartoon look
 * (heroic-cartoon games are the reference for mood, nothing is copied).
 * Everything here is additive on top of the classic look:
 *  - colour grading (saturation, warm light / cool shadow split, soft vignette)
 *    and a gentle bloom on bright surfaces, as post-processing;
 *  - a painted gradient sky with puffy drifting clouds, which also lights the
 *    city through an environment map;
 *  - world-space surface detail on the flat-coloured city materials.
 * The classic look stays one switch away (help panel, or ?gfx=classic).
 */

export type Graphics = 'vivid' | 'classic';
const GFX_KEY = 'investor-city.graphics';

export function loadGraphics(): Graphics {
  const forced = new URLSearchParams(location.search).get('gfx');
  if (forced === 'classic' || forced === 'vivid') return forced;
  try {
    return localStorage.getItem(GFX_KEY) === 'classic' ? 'classic' : 'vivid';
  } catch {
    return 'vivid';
  }
}

export function saveGraphics(g: Graphics): void {
  try {
    localStorage.setItem(GFX_KEY, g);
  } catch {
    /* private mode: the choice lasts for this visit only */
  }
}

/** Bakes a sky gradient (plus a warm sun glow) into an environment map for soft, colourful fill light. */
export function skyEnvironment(renderer: THREE.WebGLRenderer, top: THREE.Color, bottom: THREE.Color, ground: THREE.Color): THREE.Texture {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { top: { value: top }, bottom: { value: bottom }, ground: { value: ground } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 bottom; uniform vec3 ground;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 sky = mix(bottom, top, pow(clamp(h, 0.0, 1.0), 0.6));
        vec3 c = h > 0.0 ? sky : mix(bottom * 0.8, ground, clamp(-h * 3.0, 0.0, 1.0));
        // warm sun glow on one side
        float sun = pow(max(dot(vDir, normalize(vec3(0.53, 0.68, 0.5))), 0.0), 24.0);
        gl_FragColor = vec4(c + vec3(1.0, 0.85, 0.6) * sun * 2.0, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0, 1, 1000).texture;
  pmrem.dispose();
  mat.dispose();
  return tex;
}

/** Puffy cartoon clouds drifting high over the city. */
export class Clouds {
  readonly group = new THREE.Group();
  private material: THREE.MeshLambertMaterial;
  private day = new THREE.Color('#ffffff');
  private night = new THREE.Color('#33406b');

  constructor(count = 16, seed = 7) {
    this.group.name = 'clouds';
    this.material = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: new THREE.Color('#9fb6d6'), emissiveIntensity: 0.55, fog: false, flatShading: false });
    const puff = new THREE.IcosahedronGeometry(1, 2);
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const cloud = new THREE.Group();
      const n = 4 + Math.floor(rnd() * 4);
      // the puffs of one cloud are merged into a single mesh (one draw call)
      const puffs: THREE.BufferGeometry[] = [];
      for (let k = 0; k < n; k++) {
        const r = 7 + rnd() * 7;
        const g = puff.clone();
        g.scale(r, r * 0.72, r);
        g.translate((k - n / 2) * 8 + rnd() * 4, rnd() * 4 + (k % 2) * 3, rnd() * 8 - 4);
        puffs.push(g);
      }
      cloud.add(new THREE.Mesh(mergeGeometries(puffs)!, this.material));
      puffs.forEach((g) => g.dispose());
      const ang = (i / count) * Math.PI * 2 + rnd() * 0.3;
      const dist = 260 + rnd() * 260;
      cloud.position.set(Math.cos(ang) * dist, 110 + rnd() * 70, Math.sin(ang) * dist);
      cloud.rotation.y = rnd() * Math.PI;
      // flatter bottoms read as "cartoon cloud"
      cloud.scale.set(1.4, 0.8, 1);
      this.group.add(cloud);
    }
  }

  update(dt: number, night: number): void {
    for (const c of this.group.children) {
      c.position.x += dt * 2.2;
      if (c.position.x > 560) c.position.x -= 1120;
    }
    this.material.color.copy(this.day).lerp(this.night, night);
    this.material.emissiveIntensity = 0.55 * (1 - night) + 0.1;
  }
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.06 },
    contrast: { value: 1.06 },
    warm: { value: new THREE.Vector3(1.02, 0.985, 0.93) },
    cool: { value: new THREE.Vector3(0.9, 0.95, 1.03) },
    vignette: { value: 0.14 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation; uniform float contrast; uniform float vignette;
    uniform vec3 warm; uniform vec3 cool;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 col = mix(vec3(l), c.rgb, saturation);
      col = (col - 0.5) * contrast + 0.5;
      // split toning: cool shadows, warm highlights (values are display-space multipliers)
      col *= mix(cool, warm, smoothstep(0.15, 0.85, l));
      vec2 d = vUv - 0.5;
      col *= 1.0 - vignette * smoothstep(0.35, 0.85, length(d * vec2(1.25, 1.0)));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

/**
 * Ambient occlusion that only sees solid surfaces: glows, sprites, water and
 * other see-through things would otherwise leave dark boxes behind them.
 */
class SolidAOPass extends GTAOPass {
  private hidden: THREE.Object3D[] = [];
  overrideVisibility(): void {
    super.overrideVisibility();
    this.hidden.length = 0;
    this.scene.traverse((o) => {
      if (!o.visible) return;
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      const first = Array.isArray(m) ? m[0] : m;
      if ((o as THREE.Sprite).isSprite || (first && (first.transparent || !first.depthWrite))) {
        o.visible = false;
        this.hidden.push(o);
      }
    });
  }
  restoreVisibility(): void {
    for (const o of this.hidden) o.visible = true;
    this.hidden.length = 0;
    super.restoreVisibility();
  }
}

/** Post-processing chain for the vivid look: render -> ambient occlusion (ultra) -> bloom (high and up) -> tone map -> grade. */
export class PostFX {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass | null = null;
  private ao: SolidAOPass | null = null;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    o: { bloom: boolean; samples: number; ao: boolean },
  ) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    // multisampled HDR target keeps edges smooth (the renderer's own antialias does not apply to passes)
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: o.samples });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    if (o.ao) {
      // soft contact darkening where things meet: under benches, in corners, at the foot of walls
      this.ao = new SolidAOPass(scene, camera, size.x, size.y);
      this.ao.updateGtaoMaterial({ radius: 1.0, distanceExponent: 1.4, thickness: 1.5, scale: 1.3, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
      this.ao.blendIntensity = 0.9;
      this.composer.addPass(this.ao);
    }
    if (o.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.55, 0.92);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new ShaderPass(GradeShader));
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}

const NOISE_GLSL = /* glsl */ `
  varying vec3 vRealWorld;
  float rHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float rNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(rHash(i), rHash(i + vec3(1, 0, 0)), f.x), mix(rHash(i + vec3(0, 1, 0)), rHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(rHash(i + vec3(0, 0, 1)), rHash(i + vec3(1, 0, 1)), f.x), mix(rHash(i + vec3(0, 1, 1)), rHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
`;

/**
 * Ground patterns picked by colour on flat surfaces near the ground (the city
 * has no UVs): green becomes grass with patches and tiny flowers, light stone
 * becomes irregular cobbles, dark asphalt gets a speckle.
 */
const GROUND_GLSL = /* glsl */ `
  if (rGround > 0.5 && vRealNormal.y > 0.8 && vRealWorld.y < 1.3) {
    vec3 c = diffuseColor.rgb;
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float sat = (mx - mn) / max(mx, 0.001);
    vec2 q = vRealWorld.xz;
    if (c.g > c.r * 1.12 && c.g > c.b * 1.05 && sat > 0.25) {
      // natural lawn: darker and less saturated, with dry and lush patches and fine blades
      float patchy = rNoise(vec3(q * 0.15, 1.0));
      float dry = rNoise(vec3(q * 0.05, 8.0));
      float blade = rHash(vec3(floor(q * 18.0), 2.0));
      vec3 lawn = mix(vec3(0.24, 0.38, 0.15), vec3(0.42, 0.45, 0.22), smoothstep(0.55, 0.85, dry));
      diffuseColor.rgb = mix(diffuseColor.rgb, lawn, 0.65) * (0.82 + patchy * 0.3 + (blade - 0.5) * 0.16);
      float fl = rHash(vec3(floor(q * 1.6), 3.0));
      vec2 fq = fract(q * 1.6) - 0.5;
      if (fl > 0.993 && length(fq) < 0.1) diffuseColor.rgb = vec3(0.95, 0.92, 0.8);
    } else if (sat < 0.46 && mx > 0.22) {
      // real paving: rectangular stones (60 x 30 cm) in a running bond, thin grout,
      // each stone slightly lighter or darker, with fine grit and soft weathering
      vec2 g = q / vec2(0.6, 0.3);
      float row = floor(g.y);
      g.x += mod(row, 2.0) * 0.5;
      vec2 ip = floor(g);
      vec2 fp = fract(g);
      float id = rHash(vec3(ip, 9.0));
      vec2 e = min(fp, 1.0 - fp) * vec2(0.6, 0.3);
      float edge = min(e.x, e.y);
      float grit = rHash(vec3(floor(q * 40.0), 2.0));
      float stain = rNoise(vec3(q * 0.35, 6.0));
      diffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.004, 0.018, edge)) * (0.92 + id * 0.12) * (0.95 + grit * 0.06) * (0.9 + stain * 0.14);
    } else if (mx < 0.12) {
      // asphalt: aggregate grit, tyre wear and patches
      float grit = rHash(vec3(floor(q * 30.0), 4.0));
      diffuseColor.rgb *= (0.82 + rNoise(vec3(q * 0.4, 4.0)) * 0.3) * (0.9 + grit * 0.22);
    }
  }
`;

/**
 * Breaks up flat colours with large stains, mid-scale wear and fine grain,
 * plus darker grime near the ground. Strength 0..1.
 */
export function addSurfaceDetail(material: THREE.MeshStandardMaterial, strength = 1, ground = false): void {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    shader.uniforms.rDetail = { value: strength };
    shader.uniforms.rGround = { value: ground ? 1 : 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRealWorld;\nvarying vec3 vRealNormal;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvRealWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvRealNormal = normalize(mat3(modelMatrix) * objectNormal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float rDetail;\nuniform float rGround;\nvarying vec3 vRealNormal;\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        ${GROUND_GLSL}
        {
          vec3 p = vRealWorld;
          float stains = rNoise(p * 0.07) * 0.6 + rNoise(p * 0.23) * 0.4;
          float wear = rNoise(p * 1.3);
          float grain = rNoise(p * 9.0);
          float grime = 1.0 - 0.16 * (1.0 - smoothstep(0.0, 1.6, p.y));
          float d = 1.0 + rDetail * ((stains - 0.5) * 0.16 + (wear - 0.5) * 0.08 + (grain - 0.5) * 0.07);
          diffuseColor.rgb *= mix(1.0, d * grime, rDetail);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + rDetail * (rNoise(vRealWorld * 0.9) - 0.5) * 0.25, 0.04, 1.0);`,
      );
    // patches set earlier (the facade's colour mask) apply after these
    prev.call(material, shader, renderer);
  };
  material.customProgramCacheKey = () => `real-detail-${strength}-${ground}`;
  material.needsUpdate = true;
}
