import type { NpcId } from '../npcs';
import type { Choice, Cond, DialogueDef, DNode } from './types';

/**
 * DATA: the conversations of Marco's branch mission, layered on top of the
 * characters' own scripts. Marco starts it and hears the verdict; Daniel,
 * Ben and Nina give advice (two are needed), and Leo pushes a rumour.
 * Words: `dlg.<npc>.<node>` in he.dialogue.json, like every other line.
 */

const STARTED = 'branch.started';
const DONE = 'branch.done';

interface MissionLines {
  nodes: Record<string, DNode>;
  /** Opening lines, checked after "offended" and "errand ready" but before everything else. */
  entries: { if: Cond; node: string }[];
  /** Openings checked just before the usual greetings (after errand reminders). */
  late?: { if: Cond; node: string }[];
  /** A topic in the character's menu (inserted before "goodbye"). */
  hub?: Choice;
}

const learn = (...ids: string[]) => ids.map((id) => ({ flag: `learn.${id}` }));

/** An advisor's opening, and the same topic in their menu, while the mission runs and they weren't asked yet. */
function advisor(flag: string, first: string, nodes: Record<string, DNode>): MissionLines {
  const cond: Cond = { flags: [STARTED], notFlags: [DONE, flag] };
  return {
    nodes,
    entries: [{ if: { ...cond, met: true }, node: first }],
    hub: { to: first, key: 'hub.branch', tone: 'curious', if: cond },
  };
}

const OUTCOMES = ['pilot', 'oven', 'wait', 'openNow', 'three'];

export const BRANCH_DIALOGUE: Partial<Record<NpcId, MissionLines>> = {
  marco: {
    nodes: {
      // Marco raises it himself until the player agrees to help
      branchHook: { mood: 'surprised', next: 'branch1' },
      branch1: { mood: 'think', choices: [{ to: 'branch2', tone: 'curious' }, { to: 'branchYolo', tone: 'joke' }] },
      branchYolo: { mood: 'shake', next: 'branch2' },
      branch2: { mood: 'nod', choices: [{ to: 'branchYes', tone: 'kind', do: [{ flag: STARTED }, { rep: 5 }] }, { to: 'branchLater', tone: 'bye' }] },
      branchYes: { mood: 'cheer', end: true },
      branchLater: { mood: 'nod', end: true },
      branchRemind: { mood: 'think', choices: [{ to: 'branchWorry', tone: 'curious' }, { to: 'hub', tone: 'kind' }, { to: 'branchBye', tone: 'bye' }] },
      branchWorry: { mood: 'sad', next: 'branchBye' },
      branchBye: { mood: 'wave', end: true },
      ...Object.fromEntries(OUTCOMES.map((o) => [`after_${o}`, { mood: o === 'three' ? 'sad' : o === 'wait' ? 'think' : 'cheer', do: [{ flag: 'branch.thanked' }], next: 'hub' } as DNode])),
    },
    entries: [
      ...OUTCOMES.map((o) => ({ if: { flags: [`branch.result.${o}`], notFlag: 'branch.thanked' }, node: `after_${o}` })),
      { if: { flags: [STARTED], notFlag: DONE }, node: 'branchRemind' },
    ],
    // after Marco's own errand reminder, so that one still gets its say
    late: [{ if: { notFlag: STARTED, met: true }, node: 'branchHook' }],
    hub: { to: 'branch1', key: 'hub.branch', tone: 'curious', if: { notFlag: STARTED } },
  },

  daniel: advisor('branch.askDaniel', 'bLoan1', {
    bLoan1: { mood: 'think', choices: [{ to: 'bLoan2', tone: 'curious' }, { to: 'bLoanWhy', tone: 'smart', do: [{ rep: 5 }] }] },
    bLoanWhy: { mood: 'nod', next: 'bLoan2' },
    bLoan2: {
      mood: 'think',
      do: [{ flag: 'branch.askDaniel' }, ...learn('loan', 'interest')],
      choices: [{ to: 'bLoan3', tone: 'smart', do: [{ rep: 10 }] }, { to: 'bLoanEnd', tone: 'kind' }],
    },
    bLoan3: { mood: 'happy', end: true },
    bLoanEnd: { mood: 'nod', end: true },
  }),

  ben: advisor('branch.askBen', 'bRent1', {
    bRent1: { mood: 'think', choices: [{ to: 'bRent2', tone: 'curious' }, { to: 'bRentFew', tone: 'smart', do: [{ rep: 10 }] }] },
    bRentFew: { mood: 'nod', next: 'bRent2' },
    bRent2: {
      mood: 'think',
      do: [{ flag: 'branch.askBen' }, ...learn('fixedCost')],
      choices: [{ to: 'bRentPilot', tone: 'curious' }, { to: 'bRentEnd', tone: 'kind' }],
    },
    bRentPilot: { mood: 'happy', do: learn('pilot'), end: true },
    bRentEnd: { mood: 'wave', end: true },
  }),

  nina: advisor('branch.askNina', 'bRisk1', {
    bRisk1: { mood: 'think', choices: [{ to: 'bRisk2', tone: 'smart', do: [{ rep: 10 }] }, { to: 'bRiskCover' }] },
    bRiskCover: { mood: 'shake', next: 'bRisk2' },
    bRisk2: {
      mood: 'nod',
      do: [{ flag: 'branch.askNina' }, ...learn('risk')],
      choices: [{ to: 'bRisk3', tone: 'curious' }, { to: 'bRiskEnd', tone: 'bye' }],
    },
    bRisk3: { mood: 'happy', do: learn('pilot'), end: true },
    bRiskEnd: { mood: 'nod', end: true },
  }),

  leo: advisor('branch.askLeo', 'bHype1', {
    bHype1: { mood: 'cheer', choices: [{ to: 'bHypeSrc', tone: 'smart', do: [{ rep: 5 }] }, { to: 'bHypeYes', tone: 'joke' }] },
    bHypeSrc: { mood: 'think', do: [{ flag: 'branch.askLeo' }, ...learn('rumor')], end: true },
    bHypeYes: { mood: 'cheer', do: [{ flag: 'branch.askLeo' }, ...learn('rumor')], end: true },
  }),
};

/** Merges the mission into the characters' scripts (entries after "cold" and "errand ready", topic before "bye"). */
export function addMission(dialogues: Record<NpcId, DialogueDef>, mission: Partial<Record<NpcId, MissionLines>>): void {
  for (const [npc, m] of Object.entries(mission) as [NpcId, MissionLines][]) {
    const def = dialogues[npc];
    Object.assign(def.nodes, m.nodes);
    const at = def.entry.findIndex((e) => e.node === 'done1') + 1;
    def.entry.splice(at, 0, ...m.entries);
    if (m.late) def.entry.splice(def.entry.findIndex((e) => e.node === 'remind') + 1, 0, ...m.late);
    const hub = def.nodes.hub;
    if (m.hub && hub?.choices) {
      const bye = hub.choices.findIndex((c) => c.to === 'bye');
      hub.choices.splice(bye < 0 ? hub.choices.length : bye, 0, m.hub);
    }
  }
}
