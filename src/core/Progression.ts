import { isItem, type ItemId } from '../content/items';
import { AREA_IDS, LEVELS, QUESTS, questById, type AreaId, type QuestDef, type QuestReward } from '../content/quests';

/**
 * XP, levels, coins, the bag, unlocked areas and quest progress. Pure logic
 * with no rendering: the game asks `advance()` every moment with what the
 * player is near and which flags are set, and shows whatever events come back.
 * Coins are an in-game score only; nothing here touches real money.
 */

export type QuestStatus = 'active' | 'done';

export interface QuestProgress {
  status: QuestStatus;
  step: number;
  /** Places already visited for the current "visit" step. */
  seen: string[];
}

export interface ProgressionState {
  xp: number;
  coins: number;
  items: ItemId[];
  unlocked: AreaId[];
  quests: Record<string, QuestProgress>;
}

export interface Reward {
  xp: number;
  coins: number;
  items: ItemId[];
  unlock: AreaId[];
}

export type ProgressEvent =
  | { type: 'started'; quest: string }
  | { type: 'step'; quest: string; step: string }
  | { type: 'complete'; quest: string; reward: Reward; level: number; levelUp: boolean };

/** What the world looks like right now, as far as quests care. */
export interface QuestWorld {
  hasFlag(flag: string): boolean;
  nearPoi(poi: string): boolean;
  nearNpc(npc: string): boolean;
  /** Called when a step that `sets` a flag completes. */
  setFlag(flag: string): void;
}

export function newProgression(): ProgressionState {
  return { xp: 0, coins: 0, items: [], unlocked: [], quests: {} };
}

export function levelInfo(xp: number): { level: number; into: number; need: number; frac: number; max: boolean } {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1]) i++;
  const max = i + 1 >= LEVELS.length;
  const into = xp - LEVELS[i];
  const need = max ? 0 : LEVELS[i + 1] - LEVELS[i];
  return { level: i + 1, into, need, frac: max ? 1 : into / need, max };
}

/** Adds a reward; returns the new level and whether it went up. */
export function grant(p: ProgressionState, r: Partial<Reward>): { level: number; levelUp: boolean } {
  const before = levelInfo(p.xp).level;
  p.xp += Math.max(0, r.xp ?? 0);
  p.coins += Math.max(0, r.coins ?? 0);
  for (const it of r.items ?? []) if (!p.items.includes(it)) p.items.push(it);
  for (const a of r.unlock ?? []) if (!p.unlocked.includes(a)) p.unlocked.push(a);
  const level = levelInfo(p.xp).level;
  return { level, levelUp: level > before };
}

function rewardOf(def: QuestDef, world: QuestWorld): Reward {
  const r: QuestReward = def.reward;
  const bonus = r.bonus && !world.hasFlag(r.bonus.unlessFlag) ? r.bonus.xp : 0;
  return { xp: r.xp + bonus, coins: r.coins, items: [...(r.items ?? [])], unlock: [...(r.unlock ?? [])] };
}

function stepDone(def: QuestDef, q: QuestProgress, world: QuestWorld): boolean {
  const goal = def.steps[q.step].goal;
  if (goal.kind === 'flag') return world.hasFlag(goal.flag);
  if (goal.kind === 'near') return world.nearNpc(goal.npc);
  for (const poi of goal.pois) if (!q.seen.includes(poi) && world.nearPoi(poi)) q.seen.push(poi);
  return goal.pois.every((poi) => q.seen.includes(poi));
}

/** Starts quests whose requirements are met and moves active ones forward. */
export function advance(p: ProgressionState, world: QuestWorld): ProgressEvent[] {
  const events: ProgressEvent[] = [];
  for (const def of QUESTS) {
    let q = p.quests[def.id];
    if (!q) {
      if (!def.requires.every((id) => p.quests[id]?.status === 'done')) continue;
      q = p.quests[def.id] = { status: 'active', step: 0, seen: [] };
      events.push({ type: 'started', quest: def.id });
    }
    // several steps can complete at once (e.g. a flag that was already set)
    while (q.status === 'active' && stepDone(def, q, world)) {
      const step = def.steps[q.step];
      if (step.sets) world.setFlag(step.sets);
      q.step++;
      q.seen = [];
      if (q.step >= def.steps.length) {
        q.status = 'done';
        q.step = def.steps.length - 1;
        const reward = rewardOf(def, world);
        const { level, levelUp } = grant(p, reward);
        events.push({ type: 'complete', quest: def.id, reward, level, levelUp });
      } else {
        events.push({ type: 'step', quest: def.id, step: step.id });
      }
    }
  }
  return events;
}

/** The quest the HUD should show: the first active one. */
export function currentQuest(p: ProgressionState): { def: QuestDef; q: QuestProgress } | null {
  for (const def of QUESTS) {
    const q = p.quests[def.id];
    if (q?.status === 'active') return { def, q };
  }
  return null;
}

export function sanitizeProgression(raw: unknown): ProgressionState {
  const out = newProgression();
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1e7, Math.round(v))) : 0);
  out.xp = n(src.xp);
  out.coins = n(src.coins);
  if (Array.isArray(src.items)) out.items = [...new Set(src.items.filter((x): x is ItemId => typeof x === 'string' && isItem(x)))];
  if (Array.isArray(src.unlocked)) out.unlocked = [...new Set(src.unlocked.filter((x): x is AreaId => (AREA_IDS as readonly unknown[]).includes(x)))];
  const quests = (src.quests ?? {}) as Record<string, Record<string, unknown> | undefined>;
  for (const [id, q] of Object.entries(quests)) {
    const def = questById(id);
    if (!def || !q || typeof q !== 'object') continue;
    const status: QuestStatus = q.status === 'done' ? 'done' : 'active';
    const step = Math.min(def.steps.length - 1, n(q.step));
    const seen = Array.isArray(q.seen) ? q.seen.filter((s): s is string => typeof s === 'string').slice(0, 20) : [];
    out.quests[id] = { status, step, seen };
  }
  return out;
}
