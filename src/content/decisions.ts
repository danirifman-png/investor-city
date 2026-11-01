import type { MissionBuilding } from './missions/buildings';

/**
 * DATA: money decisions with consequences, one in each mission building.
 *
 * The coins in a decision come from the story (a birthday gift, a lemonade
 * stand), never from the player's wallet, so the player can try the risky
 * choice without losing anything they earned. Each option splits that story
 * pot into parts; core/Decisions turns a choice into what it is worth now and
 * "a week later". Text lives in he.decisions.json as
 * `dec.<id>.title / .story / .o<k> / .o<k>.gain / .o<k>.cost`.
 */

/** What one part of the pot does. Rates are fractions: 0.05 is +5%. */
export type DecisionPart =
  /** Spent on something fun now: worth nothing later, but enjoyed. */
  | { kind: 'spend' }
  /** Kept safe with a sure, small return. */
  | { kind: 'save'; rate: number }
  /** Invested: ends somewhere between lo and hi (chance decides, the range is shown). */
  | { kind: 'invest'; lo: number; hi: number }
  /** A known result (a stand's profit at a given price). */
  | { kind: 'fixed'; value: number };

export interface DecisionOption {
  /** Shares of the pot (they add up to 1) and what each one does. */
  parts: { share: number; part: DecisionPart }[];
}

export interface DecisionDef {
  id: string;
  building: MissionBuilding;
  /** Coins the story puts in the player's hands for this decision. */
  pot: number;
  options: DecisionOption[];
  /** Concepts collected the first time the decision is made. */
  learn: string[];
  /** XP the first time. */
  xp: number;
}

export const DECISIONS: DecisionDef[] = [
  {
    id: 'birthday',
    building: 'bank',
    pot: 20,
    options: [
      { parts: [{ share: 1, part: { kind: 'spend' } }] },
      { parts: [{ share: 1, part: { kind: 'save', rate: 0.1 } }] },
      { parts: [{ share: 0.5, part: { kind: 'spend' } }, { share: 0.5, part: { kind: 'save', rate: 0.1 } }] },
    ],
    learn: ['savings', 'opportunityCost'],
    xp: 15,
  },
  {
    id: 'basket',
    building: 'exchange',
    pot: 30,
    options: [
      { parts: [{ share: 1, part: { kind: 'invest', lo: -0.4, hi: 0.6 } }] },
      { parts: [{ share: 1, part: { kind: 'invest', lo: -0.1, hi: 0.25 } }] },
      { parts: [{ share: 1, part: { kind: 'save', rate: 0.05 } }] },
    ],
    learn: ['diversification', 'risk'],
    xp: 20,
  },
  {
    id: 'lemonade',
    building: 'academy',
    pot: 12,
    options: [
      // the lemons cost 12; the price decides how many cups sell
      { parts: [{ share: 1, part: { kind: 'fixed', value: 18 } }] },
      { parts: [{ share: 1, part: { kind: 'fixed', value: 24 } }] },
      { parts: [{ share: 1, part: { kind: 'fixed', value: 12 } }] },
    ],
    learn: ['demand', 'profit'],
    xp: 15,
  },
  {
    id: 'rumor',
    building: 'newsTower',
    pot: 25,
    options: [
      { parts: [{ share: 1, part: { kind: 'invest', lo: -0.3, hi: 0.1 } }] },
      { parts: [{ share: 1, part: { kind: 'save', rate: 0.05 } }] },
      { parts: [{ share: 1, part: { kind: 'save', rate: 0 } }] },
    ],
    learn: ['rumor', 'risk'],
    xp: 20,
  },
  {
    id: 'friendStartup',
    building: 'startupHub',
    pot: 40,
    options: [
      { parts: [{ share: 1, part: { kind: 'invest', lo: -1, hi: 2 } }] },
      { parts: [{ share: 0.25, part: { kind: 'invest', lo: -1, hi: 2 } }, { share: 0.75, part: { kind: 'save', rate: 0.05 } }] },
      { parts: [{ share: 1, part: { kind: 'save', rate: 0.05 } }] },
    ],
    learn: ['risk', 'diversification'],
    xp: 25,
  },
  {
    id: 'kiosk',
    building: 'realEstateAgency',
    pot: 50,
    options: [
      { parts: [{ share: 1, part: { kind: 'invest', lo: 0.3, hi: 1.4 } }] },
      { parts: [{ share: 1, part: { kind: 'save', rate: 0.1 } }] },
    ],
    learn: ['payback', 'opportunityCost'],
    xp: 25,
  },
];

export const DECISION_BY_BUILDING: Partial<Record<MissionBuilding, DecisionDef>> = Object.fromEntries(DECISIONS.map((d) => [d.building, d]));
