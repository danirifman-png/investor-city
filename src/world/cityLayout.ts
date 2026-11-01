import { ZONE_GRID, ZONES, type LotType, type ZoneId } from '../content/cityPlan';

/** World units are roughly metres. */
export const BLOCK = 30;
export const MINOR_ROAD = 8;
export const MAJOR_ROAD = 14;
export const SIDEWALK = 3;
export const ZONE_SIZE = BLOCK * 2 + MINOR_ROAD;
export const CITY_SIZE = 4 * MAJOR_ROAD + 3 * ZONE_SIZE;
export const HALF_CITY = CITY_SIZE / 2;

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface Lot {
  zone: ZoneId;
  type: LotType;
  /** Index within the zone (0..3), stable for seeding variation. */
  index: number;
  rect: Rect;
}

export interface ZoneLayout {
  id: ZoneId;
  row: number;
  col: number;
  rect: Rect;
  lots: Lot[];
}

export const rectCenter = (r: Rect) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
export const rectSize = (r: Rect) => ({ w: r.x1 - r.x0, d: r.z1 - r.z0 });

/** Start coordinate of zone `i` along either axis. */
export function zoneStart(i: number): number {
  return -HALF_CITY + MAJOR_ROAD + i * (ZONE_SIZE + MAJOR_ROAD);
}

/** Centre lines of the four major roads along one axis. */
export function majorRoadCenters(): number[] {
  return [0, 1, 2, 3].map((i) => -HALF_CITY + MAJOR_ROAD / 2 + i * (ZONE_SIZE + MAJOR_ROAD));
}

/** Centre lines of the minor roads (one through every non-merged zone). */
export function minorRoadCenter(zoneIndex: number): number {
  return zoneStart(zoneIndex) + BLOCK + MINOR_ROAD / 2;
}

export function buildLayout(): ZoneLayout[] {
  const zones: ZoneLayout[] = [];
  ZONE_GRID.forEach((rowIds, row) => {
    rowIds.forEach((id, col) => {
      const def = ZONES[id];
      const x0 = zoneStart(col);
      const z0 = zoneStart(row);
      const rect: Rect = { x0, z0, x1: x0 + ZONE_SIZE, z1: z0 + ZONE_SIZE };
      const lots: Lot[] = [];
      if (def.merged) {
        lots.push({ zone: id, type: def.lots[0], index: 0, rect });
      } else {
        for (let i = 0; i < 4; i++) {
          const bx = x0 + (i % 2) * (BLOCK + MINOR_ROAD);
          const bz = z0 + Math.floor(i / 2) * (BLOCK + MINOR_ROAD);
          lots.push({ zone: id, type: def.lots[i], index: i, rect: { x0: bx, z0: bz, x1: bx + BLOCK, z1: bz + BLOCK } });
        }
      }
      zones.push({ id, row, col, rect, lots });
    });
  });
  return zones;
}

/** Which zone a world position belongs to (roads count toward the nearest zone). */
export function zoneAt(layout: ZoneLayout[], x: number, z: number): ZoneLayout | null {
  if (Math.abs(x) > HALF_CITY + 40 || Math.abs(z) > HALF_CITY + 40) return null;
  const cell = (v: number) => {
    const i = Math.floor((v + HALF_CITY) / (ZONE_SIZE + MAJOR_ROAD) + 0.0001);
    return Math.max(0, Math.min(2, i));
  };
  const col = cell(x);
  const row = cell(z);
  return layout.find((zl) => zl.row === row && zl.col === col) ?? null;
}

/** Deterministic pseudo-random generator so the city is identical every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
}
