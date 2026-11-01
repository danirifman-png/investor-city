import type { NpcId } from './npcs';

/**
 * DATA: one small errand per character. These are short "go and see" tasks
 * that tie the characters to the city (the full story missions arrive in
 * phase 4). The goal is checked by the game; the conversations decide when an
 * errand is offered, accepted and completed. Text: `errand.<npc>.title` and
 * `errand.<npc>.goal`.
 */

export type ErrandGoal =
  | { kind: 'visit'; poi: string }
  | { kind: 'flag'; flag: string }
  | { kind: 'meet'; count: number };

export interface ErrandDef {
  npc: NpcId;
  goal: ErrandGoal;
}

export const ERRANDS: Record<NpcId, ErrandDef> = {
  oliver: { npc: 'oliver', goal: { kind: 'meet', count: 4 } },
  marco: { npc: 'marco', goal: { kind: 'visit', poi: 'market' } },
  maya: { npc: 'maya', goal: { kind: 'flag', flag: 'nina.toldMaya' } },
  daniel: { npc: 'daniel', goal: { kind: 'visit', poi: 'fountain' } },
  nina: { npc: 'nina', goal: { kind: 'visit', poi: 'exchange' } },
  leo: { npc: 'leo', goal: { kind: 'flag', flag: 'marco.rumorChecked' } },
  sara: { npc: 'sara', goal: { kind: 'visit', poi: 'windFarm' } },
  ben: { npc: 'ben', goal: { kind: 'visit', poi: 'construction' } },
};

/** How close (metres from the footprint) counts as "visited". */
export const VISIT_RANGE = 6;
