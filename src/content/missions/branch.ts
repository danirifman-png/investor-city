import type { ConceptId } from '../concepts';
import type { NpcId } from '../npcs';

/**
 * DATA: Marco's mission, "Should Marco open a second branch?". Numbers live
 * here (the text in `he.learn.json` quotes them, and a unit test checks that
 * the two agree). Every option is playable; the outcome and the stars depend
 * on the choice AND on how well the player's reasons support it.
 *
 * Pizzeria today, per month: 200 pizzas x 40 = 8,000 revenue;
 * expenses 2,500 rent + 1,600 ingredients (8 per pizza) + 1,500 helper + 400 power = 6,000; profit 2,000.
 * New branch: fixed costs 3,000 rent + 3,000 manager + 400 power = 6,400; each pizza leaves 40 - 8 = 32;
 * break-even 6,400 / 32 = 200 pizzas; one-time investment 18,000 (savings 6,000 + loan 12,000 at 10%).
 */
export const NUMBERS = {
  price: 40,
  pizzas: 200,
  revenue: 8000,
  rent: 2500,
  ingredients: 1600,
  unitCost: 8,
  helper: 1500,
  power: 400,
  expenses: 6000,
  profit: 2000,
  newRent: 3000,
  manager: 3000,
  newFixed: 6400,
  margin: 32,
  breakEven: 200,
  investment: 18000,
  savings: 6000,
  loan: 12000,
  interestRate: 0.1,
  hopefulPizzas: 250,
  sales: [7200, 7600, 8400, 8000, 7800, 9000],
} as const;

export const CLUE_IDS = ['ledger', 'menu', 'oven', 'register', 'letter', 'jar'] as const;
export type ClueId = (typeof CLUE_IDS)[number];

export const CLUE_CONCEPTS: Record<ClueId, ConceptId[]> = {
  ledger: ['revenue', 'expenses', 'fixedCost'],
  menu: ['variableCost'],
  oven: ['capacity'],
  register: ['average'],
  letter: ['fixedCost'],
  jar: ['savings'],
};

export interface Question {
  id: string;
  answer: number;
  /** Accepted range for answers that may be rounded. */
  min?: number;
  max?: number;
  concept: ConceptId;
}

export const QUESTIONS: Question[] = [
  { id: 'profit', answer: NUMBERS.revenue - NUMBERS.expenses, concept: 'profit' },
  { id: 'unit', answer: NUMBERS.price - NUMBERS.unitCost, concept: 'variableCost' },
  { id: 'breakEven', answer: NUMBERS.newFixed / NUMBERS.margin, concept: 'breakEven' },
  { id: 'payback', answer: NUMBERS.investment / (NUMBERS.hopefulPizzas * NUMBERS.margin - NUMBERS.newFixed), min: 11, max: 12, concept: 'payback' },
  { id: 'interest', answer: NUMBERS.loan * NUMBERS.interestRate, concept: 'interest' },
];

/** After this many wrong tries the worked solution is shown. */
export const MAX_TRIES = 2;

/** Who can be asked, and the flag their conversation sets. */
export const ADVISORS: { id: NpcId; flag: string; key: boolean }[] = [
  { id: 'daniel', flag: 'branch.askDaniel', key: true },
  { id: 'ben', flag: 'branch.askBen', key: true },
  { id: 'nina', flag: 'branch.askNina', key: true },
  // Leo's hype is optional: hearing it out is part of the lesson, but it doesn't count as advice
  { id: 'leo', flag: 'branch.askLeo', key: false },
];
export const REQUIRED_ADVISORS = 2;

export const RISKS: { id: string; real: boolean }[] = [
  { id: 'empty', real: true },
  { id: 'trend', real: false },
  { id: 'contract', real: true },
  { id: 'loan', real: true },
  { id: 'tomorrow', real: false },
  { id: 'quality', real: true },
];

export const OPTION_IDS = ['pilot', 'oven', 'wait', 'openNow', 'three'] as const;
export type OptionId = (typeof OPTION_IDS)[number];

/** Stars an option earns before the reasons are judged. */
export const BASE_STARS: Record<OptionId, number> = { pilot: 3, oven: 3, wait: 2, openNow: 2, three: 1 };

export const REASONS: { id: string; supports: OptionId[]; rumor?: boolean }[] = [
  { id: 'breakEven', supports: ['pilot', 'wait', 'oven'] },
  { id: 'data', supports: ['pilot'] },
  { id: 'capacity', supports: ['oven', 'openNow'] },
  { id: 'debt', supports: ['pilot', 'wait', 'oven'] },
  { id: 'hype', supports: ['three'], rumor: true },
  { id: 'savings', supports: ['oven', 'wait'] },
  { id: 'payback', supports: ['openNow'] },
];
export const MAX_REASONS = 3;

/** Concepts every outcome teaches (plus opportunity cost when waiting). */
export const OUTCOME_CONCEPTS: Record<OptionId, ConceptId[]> = {
  pilot: ['pilot'],
  oven: ['capacity'],
  wait: ['opportunityCost'],
  openNow: ['risk'],
  three: ['rumor', 'risk'],
};
