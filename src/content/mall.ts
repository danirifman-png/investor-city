/**
 * DATA: the walk-in mall. Two floors: shops around the ground floor and a
 * gallery along the back at `upper` metres, joined by two escalators (one up,
 * one down). Room coordinates as in content/interiors (x across, z from the
 * back wall -d/2 to the door +d/2). Built in world/interiors/mall.ts.
 */

export const MALL = {
  w: 26,
  d: 20,
  /** Height of the upper floor. */
  upper: 3.6,
  /** Where the upper floor ends (its front edge, toward the door). */
  edge: -4.5,
  /** Walls tall enough for two floors. */
  wallH: 7.6,
};

export interface Escalator {
  x: number;
  /** 'up' carries toward the back (and up); 'down' toward the door (and down). */
  dir: 'up' | 'down';
}

export const ESCALATOR = {
  width: 1.2,
  /** The bottom end (toward the door) and the top end (at the upper floor's edge). */
  zBottom: 1.5,
  zTop: MALL.edge,
  /** How fast the steps carry you, m/s. */
  speed: 1.1,
  steps: 12,
};

export const ESCALATORS: Escalator[] = [
  { x: -4, dir: 'up' },
  { x: 4, dir: 'down' },
];

/** Height of the escalator at `z` (0 at the bottom, `upper` at the top). */
export function escalatorHeight(z: number): number {
  const t = (ESCALATOR.zBottom - z) / (ESCALATOR.zBottom - ESCALATOR.zTop);
  return Math.max(0, Math.min(1, t)) * MALL.upper;
}
