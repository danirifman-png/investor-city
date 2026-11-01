import { HERO_IDS, type HeroId } from '../character/hero';
/**
 * Data for the character creator. Display names live in the locale files
 * under `char.<group>.<id>`; colours are language-neutral swatches.
 */

export const SKIN_TONES = ['#f6d6bd', '#f1c7a5', '#e0ac85', '#c68b5e', '#9a6440', '#6e452b'];
export const HAIR_COLORS = ['#2b1d14', '#5a3a22', '#a8692f', '#e3b862', '#c4452c', '#3b4fa8', '#e98fbf'];
export const CLOTH_COLORS = ['#e34b4b', '#f08a4b', '#f2c14e', '#4fc79a', '#3fb6e8', '#3d5bd9', '#a57cf2', '#ff6b9a', '#f4f4f4', '#2c2f36'];
export const PANTS_COLORS = ['#2f4a7a', '#3a3f46', '#7a5a3a', '#c9b48a', '#4c7a4c', '#e34b4b', '#a57cf2', '#f4f4f4'];
export const SHOE_COLORS = ['#f4f4f4', '#2c2f36', '#e34b4b', '#3fb6e8', '#f2c14e', '#7a5a3a'];

export const HAIR_STYLES = ['short', 'buzz', 'spiky', 'curly', 'long', 'ponytail', 'bun'] as const;
export const TOP_STYLES = ['tshirt', 'hoodie', 'shirt'] as const;
export const BOTTOM_STYLES = ['jeans', 'shorts', 'skirt'] as const;
export const HEADWEAR = ['none', 'cap', 'headphones', 'beanie'] as const;
export const EYEWEAR = ['none', 'glasses', 'sunglasses'] as const;
export const BACKWEAR = ['none', 'backpack'] as const;
export const BUILDS = ['regular', 'tall', 'short'] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];
export type TopStyle = (typeof TOP_STYLES)[number];
export type BottomStyle = (typeof BOTTOM_STYLES)[number];
export type Headwear = (typeof HEADWEAR)[number];
export type Eyewear = (typeof EYEWEAR)[number];
export type Backwear = (typeof BACKWEAR)[number];
export type Build = (typeof BUILDS)[number];

export const MODELS = ['hero', 'custom'] as const;
export type ModelChoice = (typeof MODELS)[number];

export interface CharacterLook {
  nickname: string;
  /** 'hero' is the ready-made illustrated kid; 'custom' is built from the options below. */
  model?: ModelChoice;
  /** Which ready-made hero (when model is 'hero'). */
  hero?: HeroId;
  build: Build;
  skin: string;
  hairStyle: HairStyle;
  hairColor: string;
  top: TopStyle;
  topColor: string;
  bottom: BottomStyle;
  bottomColor: string;
  shoeColor: string;
  headwear: Headwear;
  headwearColor: string;
  eyewear: Eyewear;
  backwear: Backwear;
  backwearColor: string;
}

export const NICKNAME_MAX = 14;

export const DEFAULT_LOOK: CharacterLook = {
  nickname: '',
  model: 'hero',
  hero: 'kid',
  build: 'regular',
  skin: SKIN_TONES[1],
  hairStyle: 'short',
  hairColor: HAIR_COLORS[1],
  top: 'tshirt',
  topColor: CLOTH_COLORS[4],
  bottom: 'jeans',
  bottomColor: PANTS_COLORS[0],
  shoeColor: SHOE_COLORS[0],
  headwear: 'none',
  headwearColor: CLOTH_COLORS[0],
  eyewear: 'none',
  backwear: 'none',
  backwearColor: CLOTH_COLORS[3],
};

/** Keeps letters (any script), digits, spaces and a few symbols. */
export function cleanNickname(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N} _\-'.]/gu, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, NICKNAME_MAX);
}

/** Fills missing or invalid fields with defaults (used when loading saves). */
export function sanitizeLook(input: unknown): CharacterLook {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const pick = <T extends string>(key: keyof CharacterLook, allowed: readonly T[]): T =>
    allowed.includes(src[key] as T) ? (src[key] as T) : (DEFAULT_LOOK[key] as T);
  const color = (key: keyof CharacterLook) =>
    typeof src[key] === 'string' && /^#[0-9a-f]{6}$/i.test(src[key] as string) ? (src[key] as string) : (DEFAULT_LOOK[key] as string);
  return {
    nickname: typeof src.nickname === 'string' ? cleanNickname(src.nickname).trim() : '',
    model: pick('model', MODELS),
    hero: (HERO_IDS as readonly string[]).includes(src.hero as string) ? (src.hero as HeroId) : 'kid',
    build: pick('build', BUILDS),
    skin: color('skin'),
    hairStyle: pick('hairStyle', HAIR_STYLES),
    hairColor: color('hairColor'),
    top: pick('top', TOP_STYLES),
    topColor: color('topColor'),
    bottom: pick('bottom', BOTTOM_STYLES),
    bottomColor: color('bottomColor'),
    shoeColor: color('shoeColor'),
    headwear: pick('headwear', HEADWEAR),
    headwearColor: color('headwearColor'),
    eyewear: pick('eyewear', EYEWEAR),
    backwear: pick('backwear', BACKWEAR),
    backwearColor: color('backwearColor'),
  };
}

export function randomLook(rng: () => number = Math.random, nickname = ''): CharacterLook {
  const any = <T,>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)];
  return {
    nickname,
    model: 'custom',
    hero: 'kid',
    build: any(BUILDS),
    skin: any(SKIN_TONES),
    hairStyle: any(HAIR_STYLES),
    hairColor: any(HAIR_COLORS),
    top: any(TOP_STYLES),
    topColor: any(CLOTH_COLORS),
    bottom: any(BOTTOM_STYLES),
    bottomColor: any(PANTS_COLORS),
    shoeColor: any(SHOE_COLORS),
    headwear: rng() < 0.6 ? 'none' : any(HEADWEAR),
    headwearColor: any(CLOTH_COLORS),
    eyewear: rng() < 0.65 ? 'none' : any(EYEWEAR),
    backwear: rng() < 0.5 ? 'none' : 'backpack',
    backwearColor: any(CLOTH_COLORS),
  };
}
