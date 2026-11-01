import type { NpcId } from './npcs';

/**
 * DATA: buildings the player can walk into. Each room is built far outside the
 * city (see world/Interiors.ts) in its own coordinates: x across, z from the
 * back wall (-d/2) to the door (+d/2). Text: `interior.<id>.name`,
 * `spot.<interior>.<spot>.prompt` and, for info spots, `.title / .body`.
 */
export type InteriorId = 'pizzeria' | 'bank' | 'exchange' | 'academy' | 'newsTower' | 'startupHub' | 'realEstateAgency' | 'skyLand';

export interface Hotspot {
  id: string;
  /** clue: evidence for a mission; info: a short explanation; game: a minigame; mission: the building's missions; exit: the way out; portal: a magic portal to Cloud Land; life: renting or buying a home. */
  kind: 'clue' | 'info' | 'game' | 'mission' | 'exit' | 'portal' | 'life';
  x: number;
  z: number;
  /** Marker height (default 1.6). */
  y?: number;
}

export interface InteriorDef {
  id: InteriorId;
  /** The building (POI key) whose door leads here ('' when `at` places the way in). */
  poi: string;
  /** A way in that is not a building door (a portal in the city), in world coordinates. */
  at?: { x: number; z: number; y: number };
  /** Open-air place: no walls, lamp or dark stage (Cloud Land). */
  open?: boolean;
  /** Where the player appears inside (default: just in from the door). */
  entry?: { x: number; z: number };
  /** Door position outside, relative to the building centre, and the floor height there. */
  door: { dx: number; dz: number; y: number };
  size: { w: number; d: number };
  /** Who works here; they step inside while the player visits. */
  npc?: { id: NpcId; x: number; z: number; heading: number };
  hotspots: Hotspot[];
  /** Wall and lamp colours (defaults: warm cream, warm white). */
  style?: { wall: string; lamp: string };
}

/** The secret portal in the city (in the playground, between the trampoline and the ramp) that leads to Cloud Land (world coordinates). */
export const CITY_PORTAL = { x: -16.4, z: 15.2, y: 0.5 };

export const INTERIORS: Record<InteriorId, InteriorDef> = {
  pizzeria: {
    id: 'pizzeria',
    poi: 'pizzeria',
    door: { dx: -4, dz: 4.3, y: 0.3 },
    size: { w: 14, d: 10 },
    npc: { id: 'marco', x: 1.6, z: -3.1, heading: 0 },
    hotspots: [
      { id: 'ledger', kind: 'clue', x: 0.2, z: -1.2, y: 1.5 },
      { id: 'register', kind: 'clue', x: 3.4, z: -1.2, y: 1.6 },
      { id: 'menu', kind: 'clue', x: -6.1, z: 0.4, y: 2.9 },
      { id: 'oven', kind: 'clue', x: -4.6, z: -3.2, y: 2.6 },
      { id: 'letter', kind: 'clue', x: -3.6, z: 2.2, y: 1.3 },
      { id: 'jar', kind: 'clue', x: 6.1, z: 0.4, y: 1.8 },
      // run the pizzeria for a day (the business minigame)
      { id: 'shift', kind: 'game', x: -1.6, z: -1.2, y: 1.9 },
      { id: 'exit', kind: 'exit', x: 0, z: 4.4, y: 2.2 },
    ],
  },
  bank: {
    id: 'bank',
    poi: 'bank',
    door: { dx: 0, dz: 4.1, y: 1.5 },
    size: { w: 16, d: 12 },
    npc: { id: 'daniel', x: 0, z: -3.2, heading: 0 },
    hotspots: [
      { id: 'rates', kind: 'info', x: 3.4, z: -5.0, y: 3.75 },
      { id: 'mission', kind: 'mission', x: -1.2, z: -1.6, y: 1.9 },
      { id: 'exit', kind: 'exit', x: 0, z: 5.4, y: 2.2 },
    ],
  },
  exchange: {
    id: 'exchange',
    poi: 'exchange',
    door: { dx: 0, dz: 9.6, y: 1.6 },
    size: { w: 18, d: 12 },
    npc: { id: 'nina', x: 0, z: -4.0, heading: 0 },
    style: { wall: '#f3ead8', lamp: '#fff1d6' },
    hotspots: [
      { id: 'board', kind: 'info', x: 0, z: -5.2, y: 3.9 },
      { id: 'mission', kind: 'mission', x: 1.2, z: -2.4, y: 1.9 },
      { id: 'exit', kind: 'exit', x: 0, z: 5.4, y: 2.2 },
    ],
  },
  academy: {
    id: 'academy',
    poi: 'academy',
    door: { dx: 0, dz: 7.2, y: 1.65 },
    size: { w: 16, d: 12 },
    npc: { id: 'oliver', x: 0, z: -4.3, heading: 0 },
    style: { wall: '#f1e6cf', lamp: '#ffe2b0' },
    hotspots: [
      { id: 'board', kind: 'info', x: -2.6, z: -5.2, y: 3.4 },
      { id: 'mission', kind: 'mission', x: 1.2, z: -2.7, y: 1.9 },
      { id: 'exit', kind: 'exit', x: 0, z: 5.4, y: 2.2 },
    ],
  },
  newsTower: {
    id: 'newsTower',
    poi: 'newsTower',
    door: { dx: 0, dz: 5.6, y: 0.9 },
    size: { w: 14, d: 10 },
    npc: { id: 'leo', x: 0, z: -3.5, heading: 0 },
    style: { wall: '#2c3142', lamp: '#d6e6ff' },
    hotspots: [
      { id: 'check', kind: 'info', x: -6.2, z: 0.5, y: 2.9 },
      { id: 'mission', kind: 'mission', x: 1.4, z: -2.0, y: 1.9 },
      { id: 'exit', kind: 'exit', x: 0, z: 4.4, y: 2.2 },
    ],
  },
  startupHub: {
    id: 'startupHub',
    poi: 'startupHub',
    door: { dx: 0, dz: 1.8, y: 0.38 },
    size: { w: 16, d: 12 },
    npc: { id: 'maya', x: 0, z: -4.1, heading: 0 },
    style: { wall: '#fbf6ee', lamp: '#fff4e0' },
    hotspots: [
      { id: 'board', kind: 'info', x: 0, z: -5.2, y: 3.3 },
      { id: 'mission', kind: 'mission', x: 1.1, z: -2.5, y: 1.9 },
      // the startup's prototype: a portal (it really works)
      { id: 'portal', kind: 'portal', x: -6.6, z: -3.4, y: 3.4 },
      { id: 'exit', kind: 'exit', x: 0, z: 5.4, y: 2.2 },
    ],
  },
  realEstateAgency: {
    id: 'realEstateAgency',
    poi: 'realEstateAgency',
    door: { dx: -3, dz: 5.7, y: 0.38 },
    size: { w: 14, d: 10 },
    npc: { id: 'ben', x: 0, z: -3.4, heading: 0 },
    style: { wall: '#fdf3f5', lamp: '#fff1e6' },
    hotspots: [
      { id: 'model', kind: 'info', x: -4.2, z: 1.2, y: 2.0 },
      { id: 'mission', kind: 'mission', x: 1.3, z: -1.8, y: 1.9 },
      { id: 'homes', kind: 'life', x: 4.6, z: 0.6, y: 1.9 },
      { id: 'exit', kind: 'exit', x: 0, z: 4.4, y: 2.2 },
    ],
  },
  skyLand: {
    id: 'skyLand',
    poi: '',
    at: CITY_PORTAL,
    open: true,
    size: { w: 38, d: 38 },
    door: { dx: 0, dz: 0, y: 0 },
    entry: { x: 0, z: 13 },
    hotspots: [{ id: 'exit', kind: 'exit', x: 0, z: 16.6, y: 3.4 }],
  },
};

export const INTERIOR_IDS = Object.keys(INTERIORS) as InteriorId[];
