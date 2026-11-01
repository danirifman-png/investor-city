/**
 * The ready-made hero (the illustrated kid from the reference art, made with
 * Meshy). Players who pick "design my own" get the built character instead.
 */
export const HERO = {
  model: 'models/meshy/kid_v2.glb',
  /** The model is 1.40 m tall; scaled to read as a 12-year-old next to the adults. */
  scale: 1.12,
  /** Ground speed of the embedded walk clip at scale 1, m/s. */
  walkSpeed: 1.25,
};

/** The ready-made heroes the player can pick (all share kid_v2's rig and clips). */
export const HERO_IDS = ['kid', 'g1', 'g2', 'g3', 'g4', 'b1', 'b2', 'b3', 'b4'] as const;
export type HeroId = (typeof HERO_IDS)[number];

const HERO_FILES: Record<HeroId, string> = {
  kid: HERO.model,
  g1: 'models/meshy/heroes/hero_g1.glb',
  g2: 'models/meshy/heroes/hero_g2.glb',
  g3: 'models/meshy/heroes/hero_g3.glb',
  g4: 'models/meshy/heroes/hero_g4.glb',
  b1: 'models/meshy/heroes/hero_b1.glb',
  b2: 'models/meshy/heroes/hero_b2.glb',
  b3: 'models/meshy/heroes/hero_b3.glb',
  b4: 'models/meshy/heroes/hero_b4.glb',
};

/** Model file, scale and walk-clip speed for a hero. The new heroes are 1.45 m, kid_v2 is 1.40 m. */
export function heroModel(id: HeroId | undefined): { id: HeroId; model: string; scale: number; walkSpeed: number } {
  const h = id && HERO_FILES[id] ? id : 'kid';
  return { id: h, model: HERO_FILES[h], scale: h === 'kid' ? HERO.scale : (HERO.scale * 1.4) / 1.45, walkSpeed: HERO.walkSpeed };
}
