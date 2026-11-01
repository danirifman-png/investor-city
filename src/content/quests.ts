import type { ItemId } from './items';
import type { NpcId } from './npcs';

/**
 * DATA: quests. A quest is an ordered list of steps; each step has one goal the
 * game checks every moment (being near a place or a character, or a story flag
 * set by a conversation). A quest starts by itself once the quests it requires
 * are done. Text: `quest.<id>.title`, `quest.<id>.desc`, `quest.<id>.step.<step>`.
 *
 * Adding a quest: add an entry here, its text in he.quests.json, and (if a
 * character is involved) its conversation in content/dialogue.
 */

export const AREA_IDS = ['trail'] as const;
export type AreaId = (typeof AREA_IDS)[number];

export type QuestGoal =
  /** Be near every one of these places (in any order). */
  | { kind: 'visit'; pois: string[] }
  /** Walk up to a character. */
  | { kind: 'near'; npc: NpcId }
  /** A story flag, usually set by a conversation. */
  | { kind: 'flag'; flag: string };

export interface QuestStep {
  id: string;
  goal: QuestGoal;
  /** Set when this step completes (conversations can react to it). */
  sets?: string;
}

export interface QuestReward {
  xp: number;
  coins: number;
  items?: ItemId[];
  unlock?: AreaId[];
  /** Extra XP if this flag is NOT set when the quest ends (e.g. "answered right first time"). */
  bonus?: { xp: number; unlessFlag: string };
}

export interface QuestDef {
  id: string;
  /** Who the quest is about (shown in the quest log, "take me there"). */
  giver: NpcId | null;
  requires: string[];
  steps: QuestStep[];
  reward: QuestReward;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'mentor',
    giver: 'oliver',
    requires: [],
    steps: [
      { id: 'explore', goal: { kind: 'visit', pois: ['fountain', 'plazaMarket', 'exchange'] } },
      { id: 'approach', goal: { kind: 'near', npc: 'oliver' }, sets: 'mentor.ready' },
      { id: 'talk', goal: { kind: 'flag', flag: 'mentor.met' } },
      { id: 'challenge', goal: { kind: 'flag', flag: 'mentor.solved' } },
    ],
    reward: { xp: 120, coins: 30, items: ['mentorBadge', 'trailMap'], unlock: ['trail'], bonus: { xp: 30, unlessFlag: 'mentor.wrong' } },
  },
  {
    id: 'trail',
    giver: 'oliver',
    requires: ['mentor'],
    steps: [{ id: 'waterfall', goal: { kind: 'visit', pois: ['waterfall'] } }],
    reward: { xp: 80, coins: 20, items: ['piggyBank'] },
  },
];

export const QUEST_IDS = QUESTS.map((q) => q.id);

export function questById(id: string): QuestDef | undefined {
  return QUESTS.find((q) => q.id === id);
}

/** Total XP needed to reach each level (index 0 = level 1). */
export const LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];

/** XP and coins for things that are not quests. */
export const XP = {
  errand: { xp: 40, coins: 10 },
  missionBase: { xp: 50, coins: 10 },
  missionStar: { xp: 30, coins: 10 },
  curio: { xp: 10, coins: 2 },
  concept: { xp: 5, coins: 0 },
};
