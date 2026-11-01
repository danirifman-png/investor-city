import { DECISION_BY_BUILDING, type DecisionDef, type DecisionPart } from '../content/decisions';
import type { MissionBuilding } from '../content/missions/buildings';
import { mulberry32 } from '../world/cityLayout';

/**
 * Rules for the money decisions (content/decisions): when one is open, what a
 * choice turns into, and the saved record. Pure logic with no DOM.
 *
 * Chance is deterministic: the same day, decision and attempt always give the
 * same result, so reopening the panel cannot be used to re-roll.
 */

export interface DecisionPartResult {
  kind: DecisionPart['kind'];
  /** Coins put into this part. */
  amount: number;
  /** What it is worth a week later. */
  result: number;
  /** For an investment: the worst and best it could have ended at. */
  lo?: number;
  hi?: number;
}

export interface DecisionResult {
  parts: DecisionPartResult[];
  /** Coins in hand now (whatever was not spent). */
  now: number;
  /** What it all is worth a week later (the coins the player gets). */
  later: number;
  /** Some of it was spent on fun. */
  joy: boolean;
}

/** Per building: the last day a decision was made there and how many so far. */
export type DecisionRecord = Partial<Record<MissionBuilding, { lastDay: number; count: number }>>;

/** A stable seed from the day, the decision and the attempt. */
export function decisionSeed(day: number, id: string, count: number): number {
  let h = 2166136261 ^ day;
  for (const c of `${id}#${count}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** What option `k` of a decision turns into. */
export function resolveDecision(def: DecisionDef, k: number, seed: number): DecisionResult {
  const opt = def.options[k];
  if (!opt) throw new Error(`decision ${def.id} has no option ${k}`);
  const rnd = mulberry32(seed);
  const parts = opt.parts.map(({ share, part }): DecisionPartResult => {
    const amount = Math.round(def.pot * share);
    switch (part.kind) {
      case 'spend':
        return { kind: 'spend', amount, result: 0 };
      case 'save':
        return { kind: 'save', amount, result: Math.round(amount * (1 + part.rate)) };
      case 'fixed':
        return { kind: 'fixed', amount, result: part.value };
      case 'invest': {
        const r = part.lo + (part.hi - part.lo) * rnd();
        return { kind: 'invest', amount, result: Math.max(0, Math.round(amount * (1 + r))), lo: Math.max(0, Math.round(amount * (1 + part.lo))), hi: Math.round(amount * (1 + part.hi)) };
      }
    }
  });
  return {
    parts,
    now: parts.filter((p) => p.kind !== 'spend').reduce((s, p) => s + p.amount, 0),
    later: parts.reduce((s, p) => s + p.result, 0),
    joy: parts.some((p) => p.kind === 'spend'),
  };
}

export type DecisionState = { kind: 'none' } | { kind: 'locked' } | { kind: 'open'; def: DecisionDef } | { kind: 'doneToday'; def: DecisionDef };

/**
 * Whether the building's decision can be made: it opens once the first
 * mission tier there is passed, and can be made once a day.
 */
export function decisionState(rec: DecisionRecord, b: MissionBuilding, firstTierPassed: boolean, day: number): DecisionState {
  const def = DECISION_BY_BUILDING[b];
  if (!def) return { kind: 'none' };
  if (!firstTierPassed) return { kind: 'locked' };
  if (rec[b]?.lastDay === day) return { kind: 'doneToday', def };
  return { kind: 'open', def };
}

/** Records a decision made today. `first` is true the first time (XP and concepts are given once). */
export function recordDecision(rec: DecisionRecord, b: MissionBuilding, day: number): { rec: DecisionRecord; first: boolean } {
  const count = rec[b]?.count ?? 0;
  return { rec: { ...rec, [b]: { lastDay: day, count: count + 1 } }, first: count === 0 };
}

export function sanitizeDecisions(v: unknown): DecisionRecord {
  const out: DecisionRecord = {};
  if (!v || typeof v !== 'object') return out;
  for (const [b, r] of Object.entries(v as Record<string, unknown>)) {
    if (!DECISION_BY_BUILDING[b as MissionBuilding] || !r || typeof r !== 'object') continue;
    const { lastDay, count } = r as { lastDay?: unknown; count?: unknown };
    if (typeof lastDay !== 'number' || typeof count !== 'number' || !Number.isFinite(lastDay) || !Number.isFinite(count)) continue;
    out[b as MissionBuilding] = { lastDay: Math.floor(lastDay), count: Math.max(0, Math.floor(count)) };
  }
  return out;
}
