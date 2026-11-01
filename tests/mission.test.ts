import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK } from '../src/content/characterOptions';
import { CONCEPT_IDS } from '../src/content/concepts';
import { CURIOSITIES } from '../src/content/curiosities';
import { DIALOGUES } from '../src/content/dialogue/scripts';
import { INTERIORS } from '../src/content/interiors';
import { ADVISORS, CLUE_IDS, NUMBERS, OPTION_IDS, QUESTIONS, REASONS, RISKS } from '../src/content/missions/branch';
import { NPC_IDS } from '../src/content/npcs';
import {
  advisorsAsked,
  answer,
  currentStep,
  decide,
  evaluate,
  findClue,
  newBranch,
  parseNumber,
  sanitizeBranch,
  stepOpen,
  submitRisks,
  type BranchState,
} from '../src/core/Mission';
import { migrate, newSave, SAVE_VERSION } from '../src/core/Save';
import { Conversation, newSocial } from '../src/core/Social';
import { hasKey } from '../src/i18n';
import he from '../src/i18n/locales/he.learn.json';

const active = (): BranchState => ({ ...newBranch(), status: 'active' });

/** A mission ready for the decision: all clues, all answers, two advisors, risks marked. */
function ready(): { s: BranchState; flags: string[] } {
  const s = active();
  for (const c of CLUE_IDS) findClue(s, c);
  for (const q of QUESTIONS) answer(s, q.id, String(q.answer));
  submitRisks(s, ['empty', 'contract', 'loan', 'quality']);
  return { s, flags: ['branch.started', 'branch.askDaniel', 'branch.askBen'] };
}

describe('branch mission rules', () => {
  it('starts locked and walks through the steps in order', () => {
    const s = newBranch();
    expect(currentStep(s, [])).toBe('start');
    expect(findClue(s, 'ledger')).toEqual([]);
    s.status = 'active';
    expect(currentStep(s, [])).toBe('clues');
    expect(stepOpen(s, [], 'calc')).toBe(false);
    expect(stepOpen(s, [], 'consult')).toBe(true);
    for (const c of CLUE_IDS) findClue(s, c);
    expect(currentStep(s, [])).toBe('calc');
    for (const q of QUESTIONS) answer(s, q.id, String(q.answer));
    expect(currentStep(s, [])).toBe('consult');
    // Leo is not a real advisor
    expect(currentStep(s, ['branch.askLeo', 'branch.askNina'])).toBe('consult');
    const flags = ['branch.askNina', 'branch.askBen'];
    expect(advisorsAsked(flags)).toBe(2);
    expect(currentStep(s, flags)).toBe('risks');
    submitRisks(s, []);
    expect(currentStep(s, flags)).toBe('decide');
  });

  it('finding a clue teaches its concepts once', () => {
    const s = active();
    expect(findClue(s, 'ledger').length).toBeGreaterThan(0);
    expect(findClue(s, 'ledger')).toEqual([]);
    expect(s.clues).toEqual(['ledger']);
  });

  it('reads numbers the way kids type them', () => {
    expect(parseNumber('2,000')).toBe(2000);
    expect(parseNumber(' 2000 ₪ ')).toBe(2000);
    expect(parseNumber('11.25')).toBe(11.25);
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('')).toBeNull();
  });

  it('gives a hint, then the solution after two wrong tries', () => {
    const s = active();
    expect(answer(s, 'profit', 'x')).toBe('invalid');
    expect(s.answers.profit).toBeUndefined();
    expect(answer(s, 'profit', '1000')).toBe('wrong');
    expect(answer(s, 'profit', '3000')).toBe('revealed');
    expect(s.answers.profit.correct).toBe(false);
    expect(answer(s, 'profit', '2000')).toBe('revealed');
    expect(answer(s, 'unit', '32')).toBe('correct');
    expect(s.answers.unit.firstTry).toBe(true);
    // payback accepts "about a year"
    expect(answer(s, 'payback', '11')).toBe('correct');
    expect(answer(active(), 'payback', '12')).toBe('correct');
    expect(answer(active(), 'payback', '18')).toBe('wrong');
  });

  it('the answers follow from the numbers in the clues', () => {
    const n = NUMBERS;
    expect(n.price * n.pizzas).toBe(n.revenue);
    expect(n.rent + n.ingredients + n.helper + n.power).toBe(n.expenses);
    expect(n.unitCost * n.pizzas).toBe(n.ingredients);
    expect(n.revenue - n.expenses).toBe(n.profit);
    expect(n.newRent + n.manager + n.power).toBe(n.newFixed);
    expect(n.price - n.unitCost).toBe(n.margin);
    expect(n.newFixed / n.margin).toBe(n.breakEven);
    expect(n.investment - n.savings).toBe(n.loan);
    expect(n.sales.reduce((a, b) => a + b, 0) / n.sales.length).toBe(n.revenue);
    const q = Object.fromEntries(QUESTIONS.map((x) => [x.id, x.answer]));
    expect(q).toMatchObject({ profit: 2000, unit: 32, breakEven: 200, interest: 1200 });
    expect(q.payback).toBeCloseTo(11.25);
  });

  it('the Hebrew texts quote the same numbers', () => {
    const text = (k: string) => (he as Record<string, string>)[k];
    expect(text('clue.ledger.body')).toContain('8,000');
    expect(text('clue.ledger.body')).toContain('2,500');
    expect(text('clue.menu.body')).toContain('40');
    expect(text('clue.letter.body')).toContain('18,000');
    expect(text('clue.jar.body')).toContain('6,000');
    expect(text('q.profit.explain')).toContain('2,000');
    expect(text('q.breakEven.explain')).toContain('6,400 ÷ 32 = 200');
    expect(text('q.interest.explain')).toContain('1,200');
  });

  it('cannot decide before the investigation is finished', () => {
    const s = active();
    expect(decide(s, 'pilot', ['data'], [])).toBeNull();
    expect(s.status).toBe('active');
  });

  it('judges the recommendation by its reasons', () => {
    const best = ready();
    const ev = decide(best.s, 'pilot', ['breakEven', 'data'], best.flags)!;
    expect(ev.stars).toBe(3);
    expect(best.s.status).toBe('done');
    expect(ev.verdicts.every((v) => v.verdict === 'supports')).toBe(true);

    // a risky option backed by a rumour
    const r = ready();
    const hype = evaluate('three', ['hype'], r.s, r.flags);
    expect(hype.stars).toBe(1);
    expect(hype.verdicts[0].verdict).toBe('rumor');

    // a good option with reasons that don't support it loses a star
    const u = ready();
    expect(evaluate('pilot', ['capacity'], u.s, u.flags).stars).toBe(2);

    // opening now with real reasons and a careful risk check earns its ceiling back
    const o = ready();
    expect(evaluate('openNow', ['capacity', 'payback'], o.s, o.flags).stars).toBe(3);
    // ...but false alarms in the risk list don't
    submitRisks(o.s, ['empty', 'contract', 'loan', 'quality', 'trend']);
    expect(evaluate('openNow', ['capacity', 'payback'], o.s, o.flags).stars).toBe(2);
  });

  it('every option can be supported by some reason', () => {
    for (const o of OPTION_IDS) expect(REASONS.some((r) => !r.rumor && r.supports.includes(o)) || o === 'three').toBe(true);
    expect(RISKS.filter((r) => r.real).length).toBeGreaterThan(2);
  });

  it('sanitizes stored mission state', () => {
    expect(sanitizeBranch(null)).toEqual(newBranch());
    const s = sanitizeBranch({ status: 'done', clues: ['ledger', 'ledger', 'nope'], answers: { profit: { tries: -3, correct: true } }, risks: ['empty', 'x'], reasons: ['data', 'z'], stars: 9 });
    expect(s.status).toBe('active'); // done without a choice is not done
    expect(s.clues).toEqual(['ledger']);
    expect(s.answers.profit).toEqual({ tries: 0, correct: true, revealed: false, firstTry: false });
    expect(s.risks).toEqual(['empty']);
    expect(s.reasons).toEqual(['data']);
    expect(s.stars).toBe(3);
  });
});

describe('phase 4 content', () => {
  const look = { ...DEFAULT_LOOK, nickname: 'Dana' };

  it('every concept, curiosity, clue, question, risk, option and reason has Hebrew text', () => {
    const keys = [
      ...CONCEPT_IDS.flatMap((c) => [`concept.${c}.title`, `concept.${c}.body`, `concept.${c}.example`]),
      ...CURIOSITIES.flatMap((c) => [`curio.${c.id}.title`, `curio.${c.id}.body`]),
      ...CLUE_IDS.flatMap((c) => [`clue.${c}.title`, `clue.${c}.body`, `clue.${c}.fact`]),
      ...QUESTIONS.flatMap((q) => [`q.${q.id}.text`, `q.${q.id}.hint`, `q.${q.id}.explain`]),
      ...RISKS.flatMap((r) => [`risk.${r.id}`, `risk.${r.id}.why`]),
      ...OPTION_IDS.flatMap((o) => [`option.${o}`, `outcome.${o}.title`, `outcome.${o}.body`, `outcome.${o}.lesson`]),
      ...REASONS.map((r) => `reason.${r.id}`),
      ...ADVISORS.map((a) => `nb.advisor.${a.id}`),
      ...Object.values(INTERIORS).flatMap((i) => [
        `interior.${i.id}.name`,
        ...i.hotspots.filter((h) => h.kind !== 'exit').map((h) => `spot.${i.id}.${h.id}.prompt`),
        ...i.hotspots.filter((h) => h.kind === 'info').flatMap((h) => [`spot.${i.id}.${h.id}.title`, `spot.${i.id}.${h.id}.body`]),
      ]),
    ];
    expect(keys.filter((k) => !hasKey(k))).toEqual([]);
  });

  it('pizzeria clues match the mission clues', () => {
    const spots = INTERIORS.pizzeria.hotspots.filter((h) => h.kind === 'clue').map((h) => h.id);
    expect(spots.sort()).toEqual([...CLUE_IDS].sort());
  });

  it('every learn.* flag in conversations names a real concept', () => {
    const flags = Object.values(DIALOGUES).flatMap((d) =>
      Object.values(d.nodes).flatMap((n) => [...(n.do ?? []), ...(n.choices ?? []).flatMap((c) => c.do ?? [])].map((e) => e.flag).filter((f): f is string => !!f?.startsWith('learn.'))),
    );
    expect(flags.length).toBeGreaterThan(0);
    for (const f of flags) expect(CONCEPT_IDS).toContain(f.slice(6));
  });

  it('Marco offers the mission once met, and advisors open up once it runs', () => {
    const s = newSocial();
    s.npcs.marco.met = true;
    s.npcs.marco.rep = 30;
    expect(new Conversation(DIALOGUES.marco, s).line.nodeId).toBe('branchHook');
    s.flags.push('branch.started');
    s.npcs.daniel.met = true;
    expect(new Conversation(DIALOGUES.daniel, s).line.nodeId).toBe('bLoan1');
    s.flags.push('branch.askDaniel');
    expect(new Conversation(DIALOGUES.daniel, s).line.nodeId).not.toBe('bLoan1');
    s.flags.push('branch.done', 'branch.result.pilot');
    expect(new Conversation(DIALOGUES.marco, s).line.nodeId).toBe('after_pilot');
  });

  it('save v3 keeps the mission and learning, and older saves gain empty ones', () => {
    expect(SAVE_VERSION).toBe(4);
    const data = newSave(look);
    data.missions.branch.status = 'active';
    data.missions.branch.clues = ['jar'];
    data.learning.concepts = ['profit', 'bogus'];
    data.learning.curiosities = ['bull'];
    const back = migrate(JSON.parse(JSON.stringify(data)))!;
    expect(back.missions.branch.clues).toEqual(['jar']);
    expect(back.learning.concepts).toEqual(['profit']);
    expect(back.learning.curiosities).toEqual(['bull']);
    const old = JSON.parse(JSON.stringify(newSave(look)));
    old.version = 2;
    delete old.missions;
    delete old.learning;
    const up = migrate(old)!;
    expect(up.missions.branch.status).toBe('locked');
    expect(up.learning).toEqual({ concepts: [], curiosities: [] });
  });

  it('NPC ids used by the mission exist', () => {
    for (const a of ADVISORS) expect(NPC_IDS).toContain(a.id);
    expect(NPC_IDS).toContain(INTERIORS.pizzeria.npc!.id);
  });
});
