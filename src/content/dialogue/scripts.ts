import type { NpcId } from '../npcs';
import { addMission, BRANCH_DIALOGUE } from './branchMission';
import { addMentorQuest } from './mentorQuest';
import { choiceTextKey, type Choice, type Cond, type DialogueDef, type DNode, type Effect } from './types';

/**
 * DATA: the conversation graphs of the eight characters. Only structure lives
 * here (who says what next, which answers exist, what they change). The words
 * are in `i18n/locales/he.dialogue.json` under `dlg.<npc>.<node>` and
 * `dlg.<npc>.<node>.<choice number>`.
 *
 * Every character follows the same backbone so kids learn the pattern:
 *   first meeting -> backstory -> a choice that shows their personality ->
 *   an errand offer -> (errand) -> a short "what did you learn?" question ->
 *   a topic menu they can come back to.
 * After a rude answer the next talk starts cold until the player apologises.
 * How the player talks (kind, curious, rude) changes the reputation and the
 * greeting next time.
 */

const REP = { kind: 5, smart: 10, rude: -10, sorry: 10, accept: 5, errand: 15 };

const rep = (n: number): Effect => ({ rep: n });
const startErrand: Effect[] = [{ errand: 'active' }, rep(REP.accept)];
const finishErrand: Effect[] = [{ errand: 'done' }, rep(REP.errand)];
const errandNone: Cond = { errand: 'none' };

/** Opening lines in priority order; `cross` are errands of other characters routed through this one. */
function entries(cross: { if: Cond; node: string }[] = []): DialogueDef['entry'] {
  return [
    { if: { met: false }, node: 'hello' },
    // an offended character wants an apology before anything else
    { if: { maxRep: 5 }, node: 'cold' },
    { if: { errand: 'ready' }, node: 'done1' },
    ...cross,
    { if: { errand: 'active' }, node: 'remind' },
    { if: { minRep: 45 }, node: 'friend' },
    { node: 'back' },
  ];
}

/** The "rude last time" greeting and the apology path, shared by everyone. */
const coldNodes: Record<string, DNode> = {
  cold: { mood: 'sad', choices: [{ to: 'sorry', do: [rep(REP.sorry)], tone: 'kind' }, { to: 'coldBye', tone: 'bye' }] },
  sorry: { mood: 'happy', next: 'hub' },
  coldBye: { mood: 'shake', end: true },
};

const ch = (to: string, tone?: Choice['tone'], effects?: Effect[], cond?: Cond): Choice => ({ to, tone, do: effects, if: cond });
const kind = (to: string) => ch(to, 'kind', [rep(REP.kind)]);
const curious = (to: string) => ch(to, 'curious', [rep(REP.kind)]);
const smart = (to: string) => ch(to, 'smart', [rep(REP.smart)]);
const rude = (to: string) => ch(to, 'rude', [rep(REP.rude)]);
const accept = (to = 'accept') => ch(to, 'kind', startErrand);
const later = () => ch('later', 'bye');
const bye = () => ch('bye', 'bye');
const offerAgain = () => ch('offer', 'curious', undefined, errandNone);

function script(npc: NpcId, nodes: Record<string, DNode>, cross: { if: Cond; node: string }[] = []): DialogueDef {
  return { npc, entry: entries(cross), nodes: { ...coldNodes, ...nodes } };
}

export const DIALOGUES: Record<NpcId, DialogueDef> = {
  /* ------------------------------ Oliver ------------------------------ */
  oliver: script('oliver', {
    hello: { mood: 'wave', choices: [kind('who'), ch('weird', 'joke'), rude('rude')] },
    who: { mood: 'happy', next: 'who2' },
    who2: { mood: 'think', choices: [kind('lesson'), curious('rumorQ')] },
    weird: { mood: 'laugh', next: 'who' },
    rude: { mood: 'sad', end: true },
    lesson: { mood: 'nod', next: 'offer' },
    rumorQ: { mood: 'think', next: 'offer' },
    offer: { choices: [accept(), ch('tip', 'curious'), later()] },
    tip: { mood: 'think', choices: [accept(), later()] },
    accept: { mood: 'happy', end: true },
    later: { mood: 'nod', end: true },
    remind: { choices: [ch('remindOk', 'kind'), ch('tip2', 'curious')] },
    remindOk: { mood: 'nod', end: true },
    tip2: { mood: 'think', end: true },
    done1: { mood: 'cheer', choices: [smart('done2'), ch('doneFast'), ch('doneJoke', 'joke', [rep(REP.kind)])] },
    done2: { mood: 'happy', next: 'done3' },
    doneFast: { mood: 'think', next: 'done3' },
    doneJoke: { mood: 'laugh', next: 'done3' },
    done3: { mood: 'cheer', do: finishErrand, next: 'hub' },
    back: { mood: 'wave', next: 'hub' },
    friend: { mood: 'happy', next: 'hub' },
    hub: { choices: [ch('invest', 'curious'), ch('save', 'curious'), offerAgain(), bye()] },
    invest: { mood: 'think', choices: [smart('risk'), ch('hub', 'kind')] },
    risk: { mood: 'nod', next: 'hub' },
    save: { choices: [curious('saveStart'), ch('saveFun', 'joke')] },
    saveStart: { mood: 'nod', next: 'hub' },
    saveFun: { mood: 'laugh', next: 'hub' },
    bye: { mood: 'wave', end: true },
  }),

  /* ------------------------------ Marco ------------------------------- */
  marco: script(
    'marco',
    {
      hello: { mood: 'wave', choices: [curious('story'), ch('free', 'joke'), rude('rude')] },
      story: { mood: 'think', next: 'story2' },
      story2: { mood: 'happy', choices: [curious('unsure'), ch('yolo')] },
      unsure: { mood: 'think', next: 'offer' },
      yolo: { mood: 'laugh', next: 'offer' },
      free: { mood: 'laugh', choices: [curious('cost'), ch('story', 'kind')] },
      cost: { mood: 'think', choices: [smart('profit'), ch('profitWrong')] },
      profit: { mood: 'cheer', next: 'offer' },
      profitWrong: { mood: 'shake', next: 'offer' },
      rude: { mood: 'sad', end: true },
      offer: { choices: [accept(), ch('why', 'curious'), later()] },
      why: { mood: 'think', choices: [accept(), later()] },
      accept: { mood: 'happy', end: true },
      later: { mood: 'nod', end: true },
      remind: { mood: 'think', end: true },
      rumor: { mood: 'surprised', choices: [ch('rumor2', 'smart', [rep(REP.kind)])] },
      rumor2: { mood: 'laugh', do: [{ flag: 'marco.rumorChecked' }], end: true },
      done1: { mood: 'happy', choices: [smart('done2'), ch('doneBad')] },
      done2: { mood: 'cheer', next: 'done3' },
      doneBad: { mood: 'shake', next: 'done3' },
      done3: { mood: 'cheer', do: finishErrand, next: 'hub' },
      back: { mood: 'wave', next: 'hub' },
      friend: { mood: 'happy', next: 'hub' },
      hub: {
        choices: [
          ch('hard', 'curious'),
          ch('success', 'curious'),
          ch('rumor', 'smart', undefined, { errandOf: 'leo', errand: 'active', notFlag: 'marco.rumorChecked' }),
          offerAgain(),
          bye(),
        ],
      },
      hard: { mood: 'think', next: 'hub' },
      success: { next: 'hub' },
      bye: { mood: 'wave', end: true },
    },
    [{ if: { errandOf: 'leo', errand: 'active', notFlag: 'marco.rumorChecked', met: true }, node: 'rumor' }],
  ),

  /* ------------------------------- Maya ------------------------------- */
  maya: script('maya', {
    hello: { mood: 'wave', choices: [kind('story'), rude('rude'), curious('startup')] },
    story: { mood: 'laugh', next: 'story2' },
    story2: { mood: 'think', choices: [curious('investors'), ch('rich', 'joke')] },
    investors: { next: 'offer' },
    rich: { mood: 'laugh', next: 'offer' },
    startup: { next: 'story2' },
    rude: { mood: 'sad', end: true },
    offer: { mood: 'think', choices: [accept(), ch('where', 'curious'), later()] },
    where: { choices: [accept(), later()] },
    accept: { mood: 'cheer', end: true },
    later: { mood: 'nod', end: true },
    remind: { mood: 'surprised', end: true },
    done1: { mood: 'surprised', choices: [smart('done2'), ch('doneLogo', 'joke')] },
    done2: { mood: 'cheer', next: 'done3' },
    doneLogo: { mood: 'laugh', next: 'done3' },
    done3: { mood: 'happy', do: finishErrand, next: 'hub' },
    back: { mood: 'wave', next: 'hub' },
    friend: { mood: 'happy', next: 'hub' },
    hub: { choices: [ch('innovation', 'curious'), ch('fail', 'curious'), offerAgain(), bye()] },
    innovation: { next: 'hub' },
    fail: { mood: 'think', next: 'hub' },
    bye: { mood: 'wave', end: true },
  }),

  /* ------------------------------ Daniel ------------------------------ */
  daniel: script('daniel', {
    hello: { mood: 'nod', choices: [curious('what'), ch('vault', 'joke'), rude('rude')] },
    what: { choices: [curious('interest'), ch('lend', 'curious')] },
    interest: { mood: 'think', choices: [smart('compound'), ch('little')] },
    compound: { mood: 'happy', next: 'story' },
    little: { mood: 'nod', next: 'story' },
    lend: { next: 'story' },
    vault: { mood: 'laugh', choices: [ch('what', 'curious')] },
    rude: { mood: 'shake', end: true },
    story: { mood: 'think', next: 'offer' },
    offer: { choices: [accept(), ch('why', 'curious'), later()] },
    why: { mood: 'think', choices: [accept(), later()] },
    accept: { mood: 'nod', end: true },
    later: { mood: 'nod', end: true },
    remind: { mood: 'think', end: true },
    done1: { mood: 'think', choices: [smart('done2'), ch('doneLuck')] },
    done2: { mood: 'happy', next: 'done3' },
    doneLuck: { mood: 'shake', next: 'done3' },
    done3: { mood: 'happy', do: finishErrand, next: 'hub' },
    back: { mood: 'nod', next: 'hub' },
    friend: { mood: 'happy', next: 'hub' },
    hub: { choices: [ch('loan', 'curious'), ch('bond', 'curious'), offerAgain(), bye()] },
    loan: { mood: 'think', choices: [smart('loanWhen'), ch('hub', 'kind')] },
    loanWhen: { mood: 'nod', next: 'hub' },
    bond: { next: 'hub' },
    bye: { mood: 'wave', end: true },
  }),

  /* ------------------------------- Nina ------------------------------- */
  nina: script(
    'nina',
    {
      hello: { mood: 'nod', choices: [curious('what'), rude('rude'), ch('guess', 'joke')] },
      what: { choices: [curious('healthy'), ch('always', 'curious')] },
      healthy: { mood: 'think', next: 'story' },
      always: { mood: 'nod', next: 'story' },
      guess: { mood: 'shake', choices: [smart('what')] },
      rude: { mood: 'think', end: true },
      story: { mood: 'think', next: 'offer' },
      offer: { choices: [accept(), later()] },
      accept: { mood: 'nod', end: true },
      later: { mood: 'nod', end: true },
      remind: { mood: 'think', end: true },
      mayaQ: { mood: 'surprised', next: 'mayaQ2' },
      mayaQ2: { do: [{ flag: 'nina.toldMaya' }], choices: [kind('mayaQ3')] },
      mayaQ3: { mood: 'laugh', end: true },
      done1: { mood: 'think', choices: [smart('done2'), ch('doneUp')] },
      done2: { mood: 'happy', next: 'done3' },
      doneUp: { mood: 'shake', next: 'done3' },
      done3: { mood: 'nod', do: finishErrand, next: 'hub' },
      back: { mood: 'nod', next: 'hub' },
      friend: { mood: 'happy', next: 'hub' },
      hub: {
        choices: [
          ch('fact', 'curious'),
          ch('spread', 'curious'),
          ch('mayaQ', 'kind', undefined, { errandOf: 'maya', errand: 'active', notFlag: 'nina.toldMaya' }),
          offerAgain(),
          bye(),
        ],
      },
      fact: { mood: 'think', next: 'hub' },
      spread: { next: 'hub' },
      bye: { mood: 'wave', end: true },
    },
    [{ if: { errandOf: 'maya', errand: 'active', notFlag: 'nina.toldMaya', met: true }, node: 'mayaQ' }],
  ),

  /* -------------------------------- Leo ------------------------------- */
  leo: script('leo', {
    hello: { mood: 'surprised', choices: [curious('how'), smart('doubt'), ch('calm'), rude('rude')] },
    rude: { mood: 'sad', end: true },
    how: { choices: [smart('check'), ch('fomo')] },
    doubt: { mood: 'laugh', next: 'how' },
    calm: { mood: 'nod', next: 'how' },
    check: { mood: 'think', next: 'offer' },
    fomo: { mood: 'cheer', next: 'offer' },
    offer: { choices: [accept(), later()] },
    accept: { mood: 'cheer', end: true },
    later: { mood: 'sad', end: true },
    remind: { mood: 'surprised', end: true },
    done1: { mood: 'surprised', choices: [ch('done2', 'kind', [rep(REP.smart)]), rude('doneMock')] },
    done2: { mood: 'sad', next: 'done3' },
    doneMock: { mood: 'sad', next: 'done3' },
    done3: { mood: 'think', do: finishErrand, next: 'hub' },
    back: { mood: 'wave', next: 'hub' },
    friend: { mood: 'cheer', next: 'hub' },
    hub: { choices: [ch('fomo2', 'curious'), ch('mistake', 'curious'), offerAgain(), bye()] },
    fomo2: { mood: 'think', next: 'hub' },
    mistake: { mood: 'sad', next: 'hub' },
    bye: { mood: 'wave', end: true },
  }),

  /* ------------------------------- Sara ------------------------------- */
  sara: script('sara', {
    hello: { mood: 'wave', choices: [curious('wind'), kind('story'), rude('rude')] },
    wind: { next: 'patience' },
    story: { mood: 'think', next: 'patience' },
    rude: { mood: 'laugh', end: true },
    patience: { mood: 'nod', choices: [curious('why'), ch('quit')] },
    why: { next: 'offer' },
    quit: { mood: 'think', next: 'offer' },
    offer: { choices: [accept(), later()] },
    accept: { mood: 'happy', end: true },
    later: { mood: 'nod', end: true },
    remind: { mood: 'think', end: true },
    done1: { mood: 'happy', choices: [smart('done2'), ch('doneRich')] },
    done2: { mood: 'cheer', next: 'done3' },
    doneRich: { mood: 'think', next: 'done3' },
    done3: { mood: 'happy', do: finishErrand, next: 'hub' },
    back: { mood: 'wave', next: 'hub' },
    friend: { mood: 'happy', next: 'hub' },
    hub: { choices: [ch('long', 'curious'), ch('green', 'curious'), offerAgain(), bye()] },
    long: { next: 'hub' },
    green: { mood: 'think', next: 'hub' },
    bye: { mood: 'wave', end: true },
  }),

  /* -------------------------------- Ben ------------------------------- */
  ben: script('ben', {
    hello: { mood: 'nod', choices: [curious('how'), ch('many', 'curious'), rude('rude')] },
    how: { next: 'story' },
    many: { mood: 'laugh', next: 'story' },
    rude: { mood: 'shake', end: true },
    story: { mood: 'think', choices: [curious('out'), smart('bad')] },
    out: { mood: 'nod', next: 'offer' },
    bad: { mood: 'think', next: 'offer' },
    offer: { choices: [accept(), later()] },
    accept: { mood: 'happy', end: true },
    later: { mood: 'laugh', end: true },
    remind: { mood: 'think', end: true },
    done1: { mood: 'think', choices: [smart('done2'), ch('doneEasy')] },
    done2: { mood: 'happy', next: 'done3' },
    doneEasy: { mood: 'laugh', next: 'done3' },
    done3: { mood: 'cheer', do: finishErrand, next: 'hub' },
    back: { mood: 'wave', next: 'hub' },
    friend: { mood: 'happy', next: 'hub' },
    hub: { choices: [ch('rent', 'curious'), ch('mortgage', 'curious'), offerAgain(), bye()] },
    rent: { next: 'hub' },
    mortgage: { mood: 'think', next: 'hub' },
    bye: { mood: 'wave', end: true },
  }),
};

/** Every locale key the scripts need (used by tests to keep text and structure in sync). */
// phase 4: Marco's branch mission threads through five characters
addMission(DIALOGUES, BRANCH_DIALOGUE);
addMentorQuest(DIALOGUES.oliver);

export function dialogueKeys(): string[] {
  const keys: string[] = [];
  for (const def of Object.values(DIALOGUES)) {
    for (const [id, node] of Object.entries(def.nodes)) {
      keys.push(`dlg.${def.npc}.${id}`);
      node.choices?.forEach((_, i) => keys.push(choiceTextKey(def.npc, id, node.choices!, i)));
    }
  }
  return keys;
}
