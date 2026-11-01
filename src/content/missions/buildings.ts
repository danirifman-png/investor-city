import type { NpcId } from "../npcs";

/**
 * DATA: the missions inside the walk-in buildings. Each building has three
 * tiers (easy, medium, hard) of three questions. A tier opens when the player
 * reaches its level and has passed the tier before it, so missions raise the
 * level and the level opens harder missions. Text lives in
 * `he.missions.json` as `bm.<building>.<tier>.title / .intro / .q<n> /
 * .q<n>.a<k> / .q<n>.why`. `correct` is the index of the right answer of
 * each question; `learn` names the notebook concepts a pass collects.
 */
export type MissionBuilding =
  | "bank"
  | "exchange"
  | "academy"
  | "newsTower"
  | "startupHub"
  | "realEstateAgency";

export interface TierDef {
  correct: number[];
  learn: string[];
}

export interface BuildingMissionDef {
  npc: NpcId;
  tiers: TierDef[];
}

export const BUILDING_MISSIONS: Record<MissionBuilding, BuildingMissionDef> = {
  bank: {
    npc: "daniel",
    tiers: [
      { correct: [1, 0, 2], learn: ["savings", "interest"] },
      { correct: [2, 1, 0], learn: ["interest", "savings"] },
      { correct: [0, 2, 1], learn: ["loan", "interest"] },
    ],
  },
  exchange: {
    npc: "nina",
    tiers: [
      { correct: [2, 1, 0], learn: ["shares", "profit"] },
      { correct: [0, 2, 1], learn: ["diversification", "risk"] },
      { correct: [1, 0, 2], learn: ["risk", "diversification"] },
    ],
  },
  academy: {
    npc: "oliver",
    tiers: [
      { correct: [1, 0, 2], learn: ["savings", "opportunityCost"] },
      { correct: [2, 1, 0], learn: ["savings", "opportunityCost"] },
      { correct: [0, 2, 1], learn: ["interest", "savings"] },
    ],
  },
  newsTower: {
    npc: "leo",
    tiers: [
      { correct: [0, 2, 1], learn: ["rumor"] },
      { correct: [1, 0, 2], learn: ["rumor", "opportunityCost"] },
      { correct: [2, 1, 0], learn: ["risk", "rumor"] },
    ],
  },
  startupHub: {
    npc: "maya",
    tiers: [
      { correct: [1, 0, 2], learn: ["revenue", "profit"] },
      { correct: [2, 1, 0], learn: ["pilot", "breakEven"] },
      { correct: [0, 2, 1], learn: ["risk", "diversification"] },
    ],
  },
  realEstateAgency: {
    npc: "ben",
    tiers: [
      { correct: [1, 0, 2], learn: ["expenses", "revenue"] },
      { correct: [2, 1, 0], learn: ["payback", "loan"] },
      { correct: [0, 2, 1], learn: ["risk", "fixedCost"] },
    ],
  },
};

export const MISSION_BUILDINGS = Object.keys(
  BUILDING_MISSIONS,
) as MissionBuilding[];

/** Level needed to open each tier, and what passing it gives. */
export const TIER_RULES = [
  { minLevel: 1, xp: 60, coins: 15 },
  { minLevel: 3, xp: 110, coins: 30 },
  { minLevel: 5, xp: 180, coins: 50 },
] as const;

/** Right answers needed to pass a tier (out of 3). */
export const PASS_MARK = 2;
