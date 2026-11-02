import { sanitizeFriends, type FriendsState } from './Friends';
import { sanitizeMissionRecord, type MissionRecord } from './BuildingMissions';
import { sanitizeDecisions, type DecisionRecord } from './Decisions';
import { newLife, sanitizeLife, type LifeState } from './Life';
import { newNeeds, sanitizeNeeds, type Needs } from './Needs';
import { newMoney, sanitizeMoney, type MoneyState } from './Money';
import { newShop, sanitizeShop, type ShopState } from './Shop';
import { newBusinessRecord, sanitizeBusinessRecord, type BusinessRecord } from './Business';
import { sanitizeLook, type CharacterLook } from '../content/characterOptions';
import { DISTRICT_IDS, type ZoneId } from '../content/cityPlan';
import type { ErrandState } from '../content/dialogue/types';
import { NPC_IDS, REP_MAX, REP_MIN } from '../content/npcs';
import { CONCEPT_IDS } from '../content/concepts';
import { CURIOSITIES } from '../content/curiosities';
import { newBranch, sanitizeBranch, type BranchState } from './Mission';
import { newShopRecord, sanitizeShopRecord, type ShopRecord } from './PizzaShop';
import { newProgression, sanitizeProgression, type ProgressionState } from './Progression';
import { newSocial, type SocialState } from './Social';

/**
 * Local save game. One JSON document in localStorage with a schema version,
 * so later phases (quests, portfolio, scores) can add fields and migrate old
 * saves forward. Storage can be unavailable (private mode, blocked cookies);
 * every access is guarded and the game simply runs without saving.
 */

export const SAVE_KEY = 'investor-city.save';
/** v1: phase 2 (character, position, districts). v2: phase 3 adds `social`. v3: phase 4 adds `missions` and `learning`. v4 adds `growth` (XP, coins, bag, quests). */
export const SAVE_VERSION = 4;

export interface Settings {
  night: boolean;
  /** Speech bubbles of people in the street. */
  bubbles: boolean;
  /** Fewer camera moves and effects. */
  calm: boolean;
  /** Camera turn speed multiplier (0.5 to 2). */
  camSpeed: number;
  /** The glowing footprints and beacon that lead to the current goal. */
  guide: boolean;
}

export function defaultSettings(): Settings {
  return { night: false, bubbles: true, calm: false, camSpeed: 1, guide: true };
}

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  character: CharacterLook;
  player: { x: number; y: number; z: number; heading: number };
  settings: Settings;
  progress: {
    visited: ZoneId[];
    metresWalked: number;
    playSeconds: number;
  };
  /** Relationships with the characters, story flags and errands. */
  social: SocialState;
  /** Mission progress (phase 4: Marco's branch decision). */
  missions: { branch: BranchState; pizzaShop: ShopRecord; business: BusinessRecord; buildings: MissionRecord; decisions: DecisionRecord };
  /** Golden coins and chests picked up (ids from world/Collectibles). */
  found: string[];
  /** Concepts collected in the notebook and "Did you know?" discoveries found. */
  learning: { concepts: string[]; curiosities: string[] };
  /** XP, level, coins, the bag, unlocked areas and quests. */
  growth: ProgressionState;
  /** Savings account and city shares. */
  money: MoneyState;
  /** Shop items owned and worn (added without a version bump: missing means empty). */
  shop: ShopState;
  /** Home, car, bills and the net worth history (added without a version bump: missing means none). */
  life: LifeState;
  /** Energy, food and water (added without a version bump: missing means full). */
  needs: Needs;
  /** Friendships with the people walking around the city (added without a version bump: missing means none). */
  friends: FriendsState;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const ZONE_IDS: ZoneId[] = [...DISTRICT_IDS, 'central', 'park'];

export function newSave(character: CharacterLook, now = Date.now()): SaveData {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    character,
    player: { x: 0, y: 0, z: 14, heading: Math.PI },
    settings: defaultSettings(),
    progress: { visited: [], metresWalked: 0, playSeconds: 0 },
    social: newSocial(),
    missions: { branch: newBranch(), pizzaShop: newShopRecord(), business: newBusinessRecord(), buildings: {}, decisions: {} },
    found: [],
    money: newMoney(),
    shop: newShop(),
    life: newLife(),
    needs: newNeeds(),
    friends: {},
    learning: { concepts: [], curiosities: [] },
    growth: newProgression(),
  };
}

const num = (v: unknown, fallback: number, min = -1e6, max = 1e6) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** Validates and upgrades any stored object into the current schema. */
export function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const version = num(src.version, 0);
  if (version < 1 || version > SAVE_VERSION) return null;
  // v1 saves have no `social`; sanitizeSocial() fills in a fresh one
  const base = newSave(sanitizeLook(src.character), num(src.createdAt, Date.now()));
  const player = (src.player ?? {}) as Record<string, unknown>;
  const settings = (src.settings ?? {}) as Record<string, unknown>;
  const progress = (src.progress ?? {}) as Record<string, unknown>;
  base.updatedAt = num(src.updatedAt, base.createdAt);
  base.player = {
    x: num(player.x, base.player.x, -200, 200),
    y: num(player.y, 0, -5, 60),
    z: num(player.z, base.player.z, -200, 200),
    heading: num(player.heading, base.player.heading, -100, 100),
  };
  base.settings = {
    night: settings.night === true,
    bubbles: settings.bubbles !== false,
    calm: settings.calm === true,
    camSpeed: num(settings.camSpeed, 1, 0.5, 2),
    guide: settings.guide !== false,
  };
  base.progress = {
    visited: Array.isArray(progress.visited) ? [...new Set(progress.visited.filter((z): z is ZoneId => ZONE_IDS.includes(z as ZoneId)))] : [],
    metresWalked: num(progress.metresWalked, 0, 0, 1e9),
    playSeconds: num(progress.playSeconds, 0, 0, 1e9),
  };
  base.social = sanitizeSocial(src.social);
  // v1/v2 saves have neither; the sanitizers start them fresh
  const missions = (src.missions ?? {}) as Record<string, unknown>;
  base.missions = { branch: sanitizeBranch(missions.branch), pizzaShop: sanitizeShopRecord(missions.pizzaShop), business: sanitizeBusinessRecord(missions.business), buildings: sanitizeMissionRecord(missions.buildings), decisions: sanitizeDecisions(missions.decisions) };
  base.money = sanitizeMoney(src.money);
  base.shop = sanitizeShop(src.shop);
  base.life = sanitizeLife(src.life);
  base.needs = sanitizeNeeds(src.needs);
  base.friends = sanitizeFriends(src.friends);
  base.found = Array.isArray(src.found) ? [...new Set(src.found.filter((x): x is string => typeof x === 'string' && x.length < 40))].slice(0, 400) : [];
  const learning = (src.learning ?? {}) as Record<string, unknown>;
  const pick = (list: unknown, allowed: readonly string[]) =>
    Array.isArray(list) ? [...new Set(list.filter((x): x is string => typeof x === 'string' && allowed.includes(x)))] : [];
  base.learning = {
    concepts: pick(learning.concepts, CONCEPT_IDS),
    curiosities: pick(learning.curiosities, CURIOSITIES.map((c) => c.id)),
  };
  base.growth = sanitizeProgression(src.growth);
  return base;
}

const ERRAND_STATES: ErrandState[] = ['none', 'active', 'ready', 'done'];

function sanitizeSocial(raw: unknown): SocialState {
  const out = newSocial();
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  const npcs = (src.npcs ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const errands = (src.errands ?? {}) as Record<string, unknown>;
  for (const id of NPC_IDS) {
    const n = npcs[id];
    if (n && typeof n === 'object') {
      out.npcs[id] = { met: n.met === true, rep: Math.round(num(n.rep, 10, REP_MIN, REP_MAX)), talks: Math.round(num(n.talks, 0, 0, 1e6)) };
    }
    if (ERRAND_STATES.includes(errands[id] as ErrandState)) out.errands[id] = errands[id] as ErrandState;
  }
  if (Array.isArray(src.flags)) {
    out.flags = [...new Set(src.flags.filter((f): f is string => typeof f === 'string' && /^[\w.]{1,40}$/.test(f)))].slice(0, 200);
  }
  return out;
}

export class SaveStore {
  constructor(private storage: StorageLike | null = defaultStorage()) {}

  get available(): boolean {
    return this.storage !== null;
  }

  load(): SaveData | null {
    try {
      const text = this.storage?.getItem(SAVE_KEY);
      return text ? migrate(JSON.parse(text)) : null;
    } catch {
      return null;
    }
  }

  save(data: SaveData): boolean {
    try {
      if (!this.storage) return false;
      data.updatedAt = Date.now();
      this.storage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }
}

function defaultStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = '__ic_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
