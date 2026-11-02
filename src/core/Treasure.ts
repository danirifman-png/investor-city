import { TREASURE, TREASURE_PIECES, type TreasureStep } from '../content/treasure';

/**
 * Progress through the founder's treasure (content/treasure): which step is
 * next and what taking it gives. Pure logic with no DOM.
 */

export interface TreasureState {
  /** Steps done (pieces found, then the vault). */
  step: number;
}

export const newTreasure = (): TreasureState => ({ step: 0 });

/** The next step, or null when the treasure is found. */
export function nextStep(s: TreasureState): TreasureStep | null {
  return TREASURE[s.step] ?? null;
}

export function piecesFound(s: TreasureState): number {
  return Math.min(s.step, TREASURE_PIECES);
}

export const treasureDone = (s: TreasureState): boolean => s.step >= TREASURE.length;

export interface TakeResult {
  state: TreasureState;
  step: TreasureStep;
  /** Coins paid to open (a chest). */
  cost: number;
  coins: number;
  xp: number;
}

/**
 * Takes step `id` if it is the next one and can be taken now (a chest needs
 * its coins). Returns null otherwise.
 */
export function take(s: TreasureState, id: string, wallet: number): TakeResult | null {
  const step = nextStep(s);
  if (!step || step.id !== id) return null;
  const cost = step.price ?? 0;
  if (wallet < cost) return null;
  return { state: { step: s.step + 1 }, step, cost, coins: step.coins ?? 0, xp: step.xp ?? 0 };
}

export function sanitizeTreasure(raw: unknown): TreasureState {
  const v = raw && typeof raw === 'object' ? (raw as { step?: unknown }).step : 0;
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0;
  return { step: Math.max(0, Math.min(TREASURE.length, n)) };
}
