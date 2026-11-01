/**
 * Data-driven city plan. The city is a 3x3 grid of zones; each zone is either
 * one of the seven districts or a hub (central plaza, academy park). A normal
 * zone is split into four blocks by minor streets, and each block gets a lot
 * type. Merged zones are one large block (plazas and parks).
 *
 * Names and descriptions are not here: they live in the locale files under
 * `district.<id>.*` and `poi.<lot>.*`.
 */

export type ZoneId =
  | 'tech'
  | 'energy'
  | 'health'
  | 'food'
  | 'banking'
  | 'realEstate'
  | 'industry'
  | 'central'
  | 'park';

export type LotType =
  | 'centralPlaza'
  | 'academyPark'
  | 'techHQ'
  | 'dataCenter'
  | 'techCampus'
  | 'startupHub'
  | 'hospital'
  | 'lab'
  | 'pharmacy'
  | 'fitness'
  | 'windFarm'
  | 'solarField'
  | 'energyHQ'
  | 'battery'
  | 'pizzeria'
  | 'market'
  | 'mall'
  | 'cafe'
  | 'bank'
  | 'portfolioHQ'
  | 'officeTower'
  | 'apartments'
  | 'houses'
  | 'construction'
  | 'realEstateAgency'
  | 'factory'
  | 'warehouses'
  | 'containerYard'
  | 'workshop';

export interface ZoneDef {
  id: ZoneId;
  kind: 'district' | 'hub';
  /** Signature colour used for the ground tint, minimap and HUD badge. */
  color: string;
  /** Emoji-free short icon glyph for the minimap (kept language-neutral). */
  merged: boolean;
  /** 4 lots (NW, NE, SW, SE) for normal zones, 1 lot for merged zones. */
  lots: LotType[];
}

/** Rows go north (negative z) to south; columns go west (negative x) to east. */
export const ZONE_GRID: ZoneId[][] = [
  ['tech', 'health', 'energy'],
  ['food', 'central', 'banking'],
  ['realEstate', 'park', 'industry'],
];

export const ZONES: Record<ZoneId, ZoneDef> = {
  tech: { id: 'tech', kind: 'district', color: '#3fb6e8', merged: false, lots: ['techHQ', 'dataCenter', 'startupHub', 'techCampus'] },
  health: { id: 'health', kind: 'district', color: '#4fc79a', merged: false, lots: ['hospital', 'lab', 'pharmacy', 'fitness'] },
  energy: { id: 'energy', kind: 'district', color: '#f2c14e', merged: false, lots: ['windFarm', 'solarField', 'battery', 'energyHQ'] },
  food: { id: 'food', kind: 'district', color: '#f08a4b', merged: false, lots: ['market', 'pizzeria', 'mall', 'cafe'] },
  central: { id: 'central', kind: 'hub', color: '#e8d7a8', merged: true, lots: ['centralPlaza'] },
  banking: { id: 'banking', kind: 'district', color: '#8a7bd8', merged: false, lots: ['bank', 'officeTower', 'portfolioHQ', 'officeTower'] },
  realEstate: { id: 'realEstate', kind: 'district', color: '#e46f8e', merged: false, lots: ['apartments', 'construction', 'houses', 'realEstateAgency'] },
  park: { id: 'park', kind: 'hub', color: '#7cc56a', merged: true, lots: ['academyPark'] },
  industry: { id: 'industry', kind: 'district', color: '#9aa3ad', merged: false, lots: ['factory', 'warehouses', 'workshop', 'containerYard'] },
};

/** The seven districts required by the design, in presentation order. */
export const DISTRICT_IDS: ZoneId[] = ['tech', 'energy', 'health', 'food', 'banking', 'realEstate', 'industry'];

/** Key buildings that must exist and are always labelled in the world. */
export const LANDMARK_LOTS: string[] = ['bank', 'exchange', 'newsTower', 'academy', 'portfolioHQ'];
