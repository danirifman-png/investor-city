import type { InteriorId } from './interiors';

/**
 * DATA: "Did you know?" discoveries hidden around the city and inside
 * buildings. Text: `curio.<id>.title / .body` in `he.learn.json`.
 * City spots are relative to a building (POI key); interior spots are in the
 * room's own coordinates (see content/interiors.ts).
 */
export type CurioPlace = { poi: string; dx: number; dz: number } | { interior: InteriorId; x: number; z: number };

export interface CurioDef {
  id: string;
  at: CurioPlace;
}

export const CURIOSITIES: CurioDef[] = [
  { id: 'bull', at: { poi: 'exchange', dx: -13, dz: 20 } },
  { id: 'fountain', at: { poi: 'fountain', dx: 0, dz: 9 } },
  { id: 'bankWord', at: { poi: 'bank', dx: -9, dz: 10 } },
  { id: 'lydia', at: { poi: 'market', dx: 0, dz: 13 } },
  { id: 'fakeNews', at: { poi: 'newsTower', dx: 0, dz: 8 } },
  { id: 'wind', at: { poi: 'windFarm', dx: 0, dz: 13 } },
  { id: 'building', at: { poi: 'construction', dx: 0, dz: 13 } },
  { id: 'compound', at: { poi: 'academy', dx: 8, dz: 10 } },
  { id: 'startups', at: { poi: 'techHQ', dx: 0, dz: 13 } },
  { id: 'riverTrade', at: { poi: 'riverBridge', dx: 6, dz: -17 } },
  { id: 'coinEdge', at: { poi: 'realEstateAgency', dx: 8, dz: 13 } },
  { id: 'bitcoinPizza', at: { interior: 'pizzeria', x: 5.2, z: -3.4 } },
  { id: 'pizzaPrinciple', at: { interior: 'pizzeria', x: -6.2, z: 3.4 } },
  { id: 'shekel', at: { interior: 'bank', x: 5.5, z: -2.5 } },
  { id: 'vault', at: { interior: 'bank', x: -5.5, z: -4.6 } },
  { id: 'tulips', at: { interior: 'exchange', x: 8.0, z: -3.8 } },
  { id: 'index', at: { interior: 'exchange', x: -6.8, z: 3.2 } },
  { id: 'scarcity', at: { interior: 'academy', x: 5.8, z: 3.0 } },
  { id: 'barter', at: { interior: 'academy', x: -6.6, z: -1.0 } },
  { id: 'adMoney', at: { interior: 'newsTower', x: 5.4, z: 3.0 } },
  { id: 'headline', at: { interior: 'newsTower', x: 0, z: 2.4 } },
  { id: 'garage', at: { interior: 'startupHub', x: -4.6, z: 4.4 } },
  { id: 'pivot', at: { interior: 'startupHub', x: 4.6, z: 1.0 } },
  { id: 'location', at: { interior: 'realEstateAgency', x: -4.2, z: 2.6 } },
  { id: 'mortgage', at: { interior: 'realEstateAgency', x: 4.4, z: 1.4 } },
  { id: 'rule72', at: { interior: 'skyLand', x: 3.0, z: 7.6 } },
];
