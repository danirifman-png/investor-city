import { BUILDING_MISSIONS, MISSION_BUILDINGS, PASS_MARK, TIER_RULES, type MissionBuilding } from '../content/missions/buildings';

/**
 * Rules for the building missions: which tiers are open, grading a tier, and
 * the saved record (best stars per tier). Pure logic with no DOM.
 */

/** Best stars (0-3) per tier for each building; 0 means not passed yet. */
export type MissionRecord = Partial<Record<MissionBuilding, number[]>>;

export type TierState = { kind: 'open' } | { kind: 'done'; stars: number } | { kind: 'needLevel'; level: number } | { kind: 'needPrev' };

export function tierState(rec: MissionRecord, b: MissionBuilding, tier: number, level: number): TierState {
  const stars = rec[b]?.[tier] ?? 0;
  if (stars > 0) return { kind: 'done', stars };
  if (tier > 0 && !((rec[b]?.[tier - 1] ?? 0) > 0)) return { kind: 'needPrev' };
  const need = TIER_RULES[tier].minLevel;
  if (level < need) return { kind: 'needLevel', level: need };
  return { kind: 'open' };
}

export interface Grade {
  right: number;
  total: number;
  passed: boolean;
  stars: number;
}

export function grade(b: MissionBuilding, tier: number, answers: number[]): Grade {
  const correct = BUILDING_MISSIONS[b].tiers[tier].correct;
  const right = correct.filter((c, i) => answers[i] === c).length;
  const passed = right >= PASS_MARK;
  return { right, total: correct.length, passed, stars: passed ? (right === correct.length ? 3 : 2) : 0 };
}

export function isRight(b: MissionBuilding, tier: number, q: number, answer: number): boolean {
  return BUILDING_MISSIONS[b].tiers[tier].correct[q] === answer;
}

/**
 * Records a result. Returns the new record and whether this was the first
 * pass (rewards are only given the first time, so replaying to farm XP is pointless).
 */
export function recordTier(rec: MissionRecord, b: MissionBuilding, tier: number, g: Grade): { rec: MissionRecord; firstPass: boolean } {
  const list = [...(rec[b] ?? [0, 0, 0])];
  const before = list[tier] ?? 0;
  list[tier] = Math.max(before, g.stars);
  return { rec: { ...rec, [b]: list }, firstPass: g.passed && before === 0 };
}

/** How many tiers are passed across all buildings, and how many there are. */
export function missionProgress(rec: MissionRecord): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const b of MISSION_BUILDINGS) {
    const n = BUILDING_MISSIONS[b].tiers.length;
    total += n;
    for (let i = 0; i < n; i++) if ((rec[b]?.[i] ?? 0) > 0) done++;
  }
  return { done, total };
}

export function sanitizeMissionRecord(raw: unknown): MissionRecord {
  const out: MissionRecord = {};
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (const b of MISSION_BUILDINGS) {
    const v = src[b];
    if (!Array.isArray(v)) continue;
    out[b] = [0, 1, 2].map((i) => (typeof v[i] === 'number' && Number.isFinite(v[i]) ? Math.max(0, Math.min(3, Math.round(v[i]))) : 0));
  }
  return out;
}
