import type { ConceptId } from '../content/concepts';
import {
  ADVISORS,
  BASE_STARS,
  CLUE_CONCEPTS,
  CLUE_IDS,
  MAX_REASONS,
  MAX_TRIES,
  OPTION_IDS,
  OUTCOME_CONCEPTS,
  QUESTIONS,
  REASONS,
  REQUIRED_ADVISORS,
  RISKS,
  type ClueId,
  type OptionId,
} from '../content/missions/branch';

/**
 * Rules of Marco's branch mission, kept free of rendering and DOM so they can
 * be unit-tested. The UI (Notebook) and the world (clues inside the pizzeria,
 * advisor conversations) only call these functions and read the state.
 *
 * Steps: start (talk to Marco) -> clues -> calc -> consult -> risks -> decide -> done.
 * Consulting can happen at any time after the start; the step list just shows
 * the earliest thing still missing.
 */

export type MissionStatus = 'locked' | 'active' | 'done';
export type Step = 'start' | 'clues' | 'calc' | 'consult' | 'risks' | 'decide' | 'done';
export const STEPS: Step[] = ['start', 'clues', 'calc', 'consult', 'risks', 'decide', 'done'];

export interface AnswerState {
  tries: number;
  correct: boolean;
  /** Shown the worked solution after too many wrong tries. */
  revealed: boolean;
  /** Right on the first try (counts toward the investigation score). */
  firstTry: boolean;
}

export interface BranchState {
  status: MissionStatus;
  clues: ClueId[];
  answers: Record<string, AnswerState>;
  /** Risks the player marked, once submitted. */
  risks: string[] | null;
  choice: OptionId | null;
  reasons: string[];
  stars: number;
}

export function newBranch(): BranchState {
  return { status: 'locked', clues: [], answers: {}, risks: null, choice: null, reasons: [], stars: 0 };
}

export function advisorsAsked(flags: string[]): number {
  return ADVISORS.filter((a) => a.key && flags.includes(a.flag)).length;
}

export function questionDone(s: BranchState, id: string): boolean {
  const a = s.answers[id];
  return !!a && (a.correct || a.revealed);
}

export function currentStep(s: BranchState, flags: string[]): Step {
  if (s.status === 'done') return 'done';
  if (s.status === 'locked') return 'start';
  if (CLUE_IDS.some((c) => !s.clues.includes(c))) return 'clues';
  if (QUESTIONS.some((q) => !questionDone(s, q.id))) return 'calc';
  if (advisorsAsked(flags) < REQUIRED_ADVISORS) return 'consult';
  if (!s.risks) return 'risks';
  return 'decide';
}

/** Whether a step's section is open in the notebook (later steps unlock in order, consulting is always open). */
export function stepOpen(s: BranchState, flags: string[], step: Step): boolean {
  if (s.status === 'locked') return step === 'start';
  if (step === 'consult') return true;
  return STEPS.indexOf(step) <= STEPS.indexOf(currentStep(s, flags));
}

/** Records a found clue; returns the concepts it teaches (empty if already found). */
export function findClue(s: BranchState, id: ClueId): ConceptId[] {
  if (s.status !== 'active' || s.clues.includes(id)) return [];
  s.clues.push(id);
  return CLUE_CONCEPTS[id];
}

/** Parses what a kid types: "2,000", "2000 ₪", " 11.5 " all work. */
export function parseNumber(text: string): number | null {
  const clean = text.replace(/[,\s₪]/g, '').replace(/[^\d.-]/g, '');
  if (!clean || clean === '-' || clean === '.') return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

export type AnswerResult = 'correct' | 'wrong' | 'revealed' | 'invalid' | 'locked';

export function answer(s: BranchState, id: string, text: string): AnswerResult {
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q || s.status !== 'active') return 'locked';
  const prev = s.answers[id];
  if (prev && (prev.correct || prev.revealed)) return prev.correct ? 'correct' : 'revealed';
  const value = parseNumber(text);
  if (value === null) return 'invalid';
  const a = (s.answers[id] = prev ?? { tries: 0, correct: false, revealed: false, firstTry: false });
  a.tries++;
  const ok = q.min !== undefined && q.max !== undefined ? value >= q.min && value <= q.max : Math.abs(value - q.answer) < 0.01;
  if (ok) {
    a.correct = true;
    a.firstTry = a.tries === 1;
    return 'correct';
  }
  if (a.tries >= MAX_TRIES) {
    a.revealed = true;
    return 'revealed';
  }
  return 'wrong';
}

export interface RiskReport {
  /** Real risks the player spotted, out of all real ones. */
  found: number;
  real: number;
  /** Non-risks (rumours, nonsense) the player marked as risks. */
  falseAlarms: number;
}

export function submitRisks(s: BranchState, picked: string[]): RiskReport {
  s.risks = picked.filter((id) => RISKS.some((r) => r.id === id));
  return riskReport(s);
}

export function riskReport(s: BranchState): RiskReport {
  const picked = s.risks ?? [];
  return {
    found: RISKS.filter((r) => r.real && picked.includes(r.id)).length,
    real: RISKS.filter((r) => r.real).length,
    falseAlarms: RISKS.filter((r) => !r.real && picked.includes(r.id)).length,
  };
}

export type ReasonVerdict = 'supports' | 'unrelated' | 'rumor';

export function judgeReason(choice: OptionId, reasonId: string): ReasonVerdict {
  const r = REASONS.find((x) => x.id === reasonId);
  if (!r) return 'unrelated';
  if (r.rumor) return 'rumor';
  return r.supports.includes(choice) ? 'supports' : 'unrelated';
}

export interface Evaluation {
  choice: OptionId;
  stars: number;
  verdicts: { id: string; verdict: ReasonVerdict }[];
  /** The investigation behind the decision, for the score card. */
  clues: number;
  firstTry: number;
  questions: number;
  advisors: number;
  risks: RiskReport;
  concepts: ConceptId[];
}

/**
 * Judges the decision. The option sets the ceiling (some ideas are just risky),
 * the reasons must back it up: no supporting reason, or leaning on a rumour,
 * costs a star. A careful investigation (spotting most risks without false
 * alarms) earns one back, but never above three.
 */
export function evaluate(choice: OptionId, reasons: string[], s: BranchState, flags: string[]): Evaluation {
  const verdicts = reasons.slice(0, MAX_REASONS).map((id) => ({ id, verdict: judgeReason(choice, id) }));
  const support = verdicts.filter((v) => v.verdict === 'supports').length;
  const rumor = verdicts.some((v) => v.verdict === 'rumor');
  const risks = riskReport(s);
  let stars = BASE_STARS[choice];
  if (support === 0 || rumor) stars--;
  if (risks.found >= risks.real - 1 && risks.falseAlarms === 0 && support > 0) stars++;
  stars = Math.max(1, Math.min(3, stars));
  return {
    choice,
    stars,
    verdicts,
    clues: s.clues.length,
    firstTry: QUESTIONS.filter((q) => s.answers[q.id]?.firstTry).length,
    questions: QUESTIONS.length,
    advisors: advisorsAsked(flags),
    risks,
    concepts: OUTCOME_CONCEPTS[choice],
  };
}

/** Commits the decision and closes the mission. */
export function decide(s: BranchState, choice: OptionId, reasons: string[], flags: string[]): Evaluation | null {
  if (s.status !== 'active' || currentStep(s, flags) !== 'decide' || !OPTION_IDS.includes(choice)) return null;
  const ev = evaluate(choice, reasons, s, flags);
  s.choice = choice;
  s.reasons = ev.verdicts.map((v) => v.id);
  s.stars = ev.stars;
  s.status = 'done';
  return ev;
}

/** Validates a stored mission state (save files can be old or tampered with). */
export function sanitizeBranch(raw: unknown): BranchState {
  const out = newBranch();
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  if (src.status === 'active' || src.status === 'done') out.status = src.status;
  if (Array.isArray(src.clues)) out.clues = [...new Set(src.clues.filter((c): c is ClueId => CLUE_IDS.includes(c as ClueId)))];
  const answers = (src.answers ?? {}) as Record<string, Record<string, unknown>>;
  for (const q of QUESTIONS) {
    const a = answers[q.id];
    if (a && typeof a === 'object') {
      out.answers[q.id] = {
        tries: typeof a.tries === 'number' && a.tries >= 0 ? Math.min(99, Math.round(a.tries)) : 0,
        correct: a.correct === true,
        revealed: a.revealed === true,
        firstTry: a.firstTry === true,
      };
    }
  }
  if (Array.isArray(src.risks)) out.risks = src.risks.filter((r): r is string => RISKS.some((x) => x.id === r));
  if (OPTION_IDS.includes(src.choice as OptionId)) out.choice = src.choice as OptionId;
  if (Array.isArray(src.reasons)) out.reasons = src.reasons.filter((r): r is string => REASONS.some((x) => x.id === r)).slice(0, MAX_REASONS);
  if (typeof src.stars === 'number') out.stars = Math.max(0, Math.min(3, Math.round(src.stars)));
  // a "done" mission without a decision is not done
  if (out.status === 'done' && !out.choice) out.status = 'active';
  return out;
}
