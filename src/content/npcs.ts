import { DEFAULT_LOOK, type CharacterLook } from './characterOptions';

/**
 * DATA: the eight main characters of the city. Names, roles, personality and
 * backstory text live in the locale files under `npc.<id>.*`; this file only
 * holds how they look and where they stand.
 */

export const NPC_IDS = ['oliver', 'marco', 'maya', 'daniel', 'nina', 'leo', 'sara', 'ben'] as const;
export type NpcId = (typeof NPC_IDS)[number];

/** Clothing pieces only grown-ups in the city wear (the player creator doesn't offer them). */
export type NpcExtra = 'chefHat' | 'apron' | 'tie' | 'blazer' | 'mustache' | 'beard' | 'hardHat' | 'vest' | 'scarf' | 'laptop' | 'phone' | 'clipboard' | 'tablet';

export interface NpcDef {
  id: NpcId;
  /** 'owl' is Oliver's own model; everyone else is a person built like the player. */
  body: 'owl' | 'person';
  /** Grammatical gender, for Hebrew sentences about the character. */
  gender: 'm' | 'f';
  look: CharacterLook;
  extras: NpcExtra[];
  /** Grown-ups are a bit taller than the kid player. */
  scale: number;
  /** Signature colour for their name tag, portrait and journal entry. */
  color: string;
  /** The building (POI key) they stand in front of. */
  home: string;
  /** Sideways offset along the building front, so two neighbours don't overlap. */
  offset: number;
  /** Leo can't stand still: he paces back and forth this many metres. */
  pace?: number;
  /**
   * Optional realistic model (realistic graphics mode). The procedural body
   * stays as the fallback while it loads or if loading fails.
   */
  avatar?: NpcAvatar;
}

export interface NpcAvatar {
  /** Paths relative to the game's base URL. */
  model: string;
  /** Baked clips (tools/retarget.mjs); without it the clips embedded in the model are used. */
  anims?: string;
  /** Ground speed of the walk clip, m/s (keeps the feet from sliding). */
  walkSpeed?: number;
  /** Something held in the right hand. */
  prop?: 'tablet';
  /** Load in every graphics mode (the stylised Meshy cast), not only the vivid one. */
  always?: boolean;
  /** Uniform scale applied to the model (Meshy models are already in metres). */
  scale?: number;
  /** Height of the top of the head (with hat), for name tags and camera framing. */
  height: number;
  topColor?: string;
  bottomColor?: string;
  chefHat?: boolean;
}

const person = (l: Partial<CharacterLook>): CharacterLook => ({ ...DEFAULT_LOOK, nickname: '', ...l });

export const NPCS: Record<NpcId, NpcDef> = {
  oliver: {
    id: 'oliver',
    gender: 'm',
    body: 'owl',
    look: person({ topColor: '#8a6a4a' }),
    extras: [],
    scale: 1.1,
    color: '#8a7bd8',
    // the mentor waits by the steps of the Invest Academy on the opening square
    home: 'exchange',
    offset: 10,
    // owl in a graduation gown; scaled up so the mentor stands a little taller than the kid
    avatar: { model: 'models/meshy/oliver.glb', always: true, scale: 1.2, height: 1.85, walkSpeed: 1.0 },
  },
  marco: {
    id: 'marco',
    gender: 'm',
    body: 'person',
    look: person({ build: 'regular', skin: '#e0ac85', hairStyle: 'short', hairColor: '#2b1d14', top: 'shirt', topColor: '#f4f4f4', bottom: 'jeans', bottomColor: '#3a3f46', shoeColor: '#2c2f36' }),
    extras: ['chefHat', 'apron', 'mustache'],
    scale: 1.14,
    color: '#f08a4b',
    home: 'pizzeria',
    offset: 0,
    avatar: { model: 'models/meshy/marco.glb', always: true, height: 1.9 },
  },
  maya: {
    id: 'maya',
    gender: 'f',
    body: 'person',
    look: person({ build: 'tall', skin: '#c68b5e', hairStyle: 'ponytail', hairColor: '#3b4fa8', top: 'hoodie', topColor: '#a57cf2', bottom: 'jeans', bottomColor: '#2f4a7a', shoeColor: '#3fb6e8', headwear: 'headphones', headwearColor: '#2c2f36', eyewear: 'glasses' }),
    extras: ['laptop'],
    scale: 1.08,
    color: '#3fb6e8',
    home: 'techHQ',
    offset: 0,
    avatar: { model: 'models/meshy/maya.glb', always: true, height: 1.75 },
  },
  daniel: {
    id: 'daniel',
    gender: 'm',
    body: 'person',
    look: person({ build: 'tall', skin: '#f1c7a5', hairStyle: 'short', hairColor: '#5a3a22', top: 'shirt', topColor: '#ffffff', bottom: 'jeans', bottomColor: '#2c2f36', shoeColor: '#2c2f36' }),
    extras: ['blazer', 'tie'],
    scale: 1.12,
    color: '#8a7bd8',
    home: 'bank',
    offset: 0,
    avatar: { model: 'models/meshy/daniel.glb', always: true, height: 1.9 },
  },
  nina: {
    id: 'nina',
    gender: 'f',
    body: 'person',
    look: person({ build: 'regular', skin: '#f6d6bd', hairStyle: 'bun', hairColor: '#c4452c', top: 'shirt', topColor: '#3d5bd9', bottom: 'skirt', bottomColor: '#2c2f36', shoeColor: '#2c2f36', eyewear: 'glasses' }),
    extras: ['blazer', 'tablet'],
    scale: 1.1,
    color: '#3d5bd9',
    home: 'portfolioHQ',
    offset: 0,
    avatar: { model: 'models/meshy/nina.glb', always: true, height: 1.75, prop: 'tablet' },
  },
  leo: {
    id: 'leo',
    gender: 'm',
    body: 'person',
    look: person({ build: 'regular', skin: '#d9a47c', hairStyle: 'spiky', hairColor: '#e3b862', top: 'tshirt', topColor: '#ff6b9a', bottom: 'shorts', bottomColor: '#4c7a4c', shoeColor: '#f2c14e', eyewear: 'sunglasses' }),
    extras: ['phone'],
    scale: 1.1,
    color: '#ff6b9a',
    home: 'newsTower',
    offset: 0,
    pace: 5,
    avatar: { model: 'models/meshy/leo.glb', always: true, height: 1.8 },
  },
  sara: {
    id: 'sara',
    gender: 'f',
    body: 'person',
    look: person({ build: 'regular', skin: '#9a6440', hairStyle: 'curly', hairColor: '#2b1d14', top: 'shirt', topColor: '#4fc79a', bottom: 'jeans', bottomColor: '#c9b48a', shoeColor: '#7a5a3a' }),
    extras: ['hardHat', 'vest', 'clipboard'],
    scale: 1.1,
    color: '#f2c14e',
    home: 'energyHQ',
    offset: 0,
    avatar: { model: 'models/meshy/sara.glb', always: true, height: 1.75 },
  },
  ben: {
    id: 'ben',
    gender: 'm',
    body: 'person',
    look: person({ build: 'tall', skin: '#6e452b', hairStyle: 'buzz', hairColor: '#2b1d14', top: 'shirt', topColor: '#c9b48a', bottom: 'jeans', bottomColor: '#7a5a3a', shoeColor: '#7a5a3a' }),
    extras: ['beard', 'scarf'],
    scale: 1.14,
    color: '#e46f8e',
    home: 'realEstateAgency',
    offset: 0,
    avatar: { model: 'models/meshy/ben.glb', always: true, height: 1.92 },
  },
};

/* --------------------------- relationships ------------------------------ */

export const REP_MIN = 0;
export const REP_MAX = 100;

/** Relationship levels, from strangers to close friends (locale keys `rep.level.<n>`). */
export const REP_LEVELS = [0, 20, 45, 75] as const;

export function repLevel(rep: number): 0 | 1 | 2 | 3 {
  let level = 0;
  REP_LEVELS.forEach((min, i) => {
    if (rep >= min) level = i;
  });
  return level as 0 | 1 | 2 | 3;
}
