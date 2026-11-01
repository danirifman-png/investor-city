import { ENERGY_FLOOR_HOMELESS, FOOD_VALUES, NEED_DRAIN, NEED_IDS, NEED_LOW, type NeedId } from '../content/needs';

/** The hero's needs, 0 to 100 each. Pure rules with no DOM. */
export type Needs = Record<NeedId, number>;

export function newNeeds(): Needs {
  return { energy: 100, food: 100, water: 100 };
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Needs after `seconds` of play. Energy stops at a floor without a home of one's own. */
export function drain(n: Needs, seconds: number, hasHome: boolean): Needs {
  const m = seconds / 60;
  const energy = n.energy - NEED_DRAIN.energy * m;
  return {
    energy: clamp(hasHome ? energy : Math.max(Math.min(n.energy, ENERGY_FLOOR_HOMELESS), energy)),
    food: clamp(n.food - NEED_DRAIN.food * m),
    water: clamp(n.water - NEED_DRAIN.water * m),
  };
}

/** Eats or drinks a food by its shop id (unknown ids change nothing). */
export function consume(n: Needs, id: string): Needs {
  const v = FOOD_VALUES[id];
  if (!v) return n;
  return { energy: n.energy, food: clamp(n.food + (v.food ?? 0)), water: clamp(n.water + (v.water ?? 0)) };
}

export function add(n: Needs, d: Partial<Needs>): Needs {
  return { energy: clamp(n.energy + (d.energy ?? 0)), food: clamp(n.food + (d.food ?? 0)), water: clamp(n.water + (d.water ?? 0)) };
}

/** Sleep raises energy to `to` (never lowers it). */
export function sleep(n: Needs, to: number): Needs {
  return { ...n, energy: Math.max(n.energy, clamp(to)) };
}

/** Which needs are low now. */
export function lowNeeds(n: Needs): NeedId[] {
  return NEED_IDS.filter((id) => n[id] < NEED_LOW);
}

/** A tired, hungry or thirsty hero walks a bit slower (never stops). */
export function needSpeed(n: Needs): number {
  const empty = NEED_IDS.filter((id) => n[id] <= 0).length;
  const low = lowNeeds(n).length;
  return empty ? 0.8 : low ? 0.92 : 1;
}

export function sanitizeNeeds(raw: unknown): Needs {
  const out = newNeeds();
  if (!raw || typeof raw !== 'object') return out;
  for (const id of NEED_IDS) {
    const v = (raw as Record<string, unknown>)[id];
    if (typeof v === 'number' && Number.isFinite(v)) out[id] = clamp(v);
  }
  return out;
}
