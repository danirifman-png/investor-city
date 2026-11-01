import type { NpcId } from '../npcs';

/**
 * Conversation data model. A dialogue is a graph of nodes; each node is one
 * line spoken by the character (or the player), followed either by the next
 * node or by a set of choices. Text is never stored here: the text of node
 * `n` of character `c` is the locale key `dlg.c.n`, and its choices are
 * `dlg.c.n.1`, `dlg.c.n.2`, ... in order.
 */

export type Mood = 'happy' | 'laugh' | 'think' | 'sad' | 'surprised' | 'nod' | 'shake' | 'wave' | 'cheer' | 'talk';

export type ErrandState = 'none' | 'active' | 'ready' | 'done';

/** A condition on the conversation state. Every field that is set must hold. */
export interface Cond {
  flag?: string;
  notFlag?: string;
  /** All of these flags must be set / none of these may be set. */
  flags?: string[];
  notFlags?: string[];
  minRep?: number;
  maxRep?: number;
  /** Has the player met this character before this conversation started? */
  met?: boolean;
  /** State of this character's errand (or of `errandOf`'s). */
  errand?: ErrandState | ErrandState[];
  errandOf?: NpcId;
  /** How many of the eight characters the player has met. */
  metCount?: number;
}

export interface Effect {
  /** Change in this character's opinion of the player. */
  rep?: number;
  flag?: string;
  /** Moves this character's errand (or `errandOf`'s) to a new state. */
  errand?: ErrandState;
  errandOf?: NpcId;
}

/** The kind of answer, shown as a small hint so kids learn that tone matters. */
export type Tone = 'kind' | 'curious' | 'smart' | 'rude' | 'joke' | 'bye';

export interface Choice {
  to: string;
  /**
   * Text key suffix for choices added by a mission (`dlg.<npc>.<key>`), so they
   * can sit anywhere in a menu without renumbering the other answers.
   */
  key?: string;
  if?: Cond;
  do?: Effect[];
  tone?: Tone;
}

export interface DNode {
  /** Who speaks this line. Defaults to the character. */
  by?: 'npc' | 'player';
  mood?: Mood;
  /** Applied when the line is shown. */
  do?: Effect[];
  next?: string;
  choices?: Choice[];
  /** The conversation ends after this line. */
  end?: boolean;
}

export interface DialogueDef {
  npc: NpcId;
  /** The first entry whose condition holds picks the opening line. */
  entry: { if?: Cond; node: string }[];
  nodes: Record<string, DNode>;
}

/** Locale key of choice `i` of a node: numbered answers count only the un-keyed ones. */
export function choiceTextKey(npc: NpcId, nodeId: string, choices: Choice[], i: number): string {
  const c = choices[i];
  if (c.key) return `dlg.${npc}.${c.key}`;
  const n = choices.slice(0, i + 1).filter((x) => !x.key).length;
  return `dlg.${npc}.${nodeId}.${n}`;
}
