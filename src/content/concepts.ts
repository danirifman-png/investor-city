/**
 * DATA: the money concepts the player can collect in the notebook. Text lives
 * in `he.learn.json` as `concept.<id>.title / .body / .example`. A concept is
 * unlocked by a clue, a mission question, or a conversation flag `learn.<id>`.
 */
export const CONCEPT_IDS = [
  'revenue',
  'expenses',
  'profit',
  'fixedCost',
  'variableCost',
  'capacity',
  'average',
  'breakEven',
  'payback',
  'savings',
  'loan',
  'interest',
  'risk',
  'pilot',
  'rumor',
  'opportunityCost',
  'demand',
  'inventory',
  'reinvest',
  'shares',
  'diversification',
  'depreciation',
  'netWorth',
  'mortgage',
] as const;

export type ConceptId = (typeof CONCEPT_IDS)[number];

export function isConcept(id: string): id is ConceptId {
  return (CONCEPT_IDS as readonly string[]).includes(id);
}
