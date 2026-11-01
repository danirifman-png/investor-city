import { choiceTextKey, type Choice, type Cond, type DialogueDef, type DNode, type Effect, type ErrandState, type Mood } from '../content/dialogue/types';
import { NPC_IDS, REP_MAX, REP_MIN, type NpcId } from '../content/npcs';

/**
 * Relationships, story flags and errands, plus the conversation runner. Pure
 * logic with no rendering, so the whole dialogue system is unit-testable and
 * the same state object is what gets saved.
 */

export interface NpcState {
  met: boolean;
  rep: number;
  talks: number;
}

export interface SocialState {
  npcs: Record<NpcId, NpcState>;
  flags: string[];
  errands: Record<NpcId, ErrandState>;
}

export function newSocial(): SocialState {
  const npcs = {} as Record<NpcId, NpcState>;
  const errands = {} as Record<NpcId, ErrandState>;
  for (const id of NPC_IDS) {
    npcs[id] = { met: false, rep: 10, talks: 0 };
    errands[id] = 'none';
  }
  return { npcs, flags: [], errands };
}

export function metCount(s: SocialState): number {
  return NPC_IDS.filter((id) => s.npcs[id].met).length;
}

export function hasFlag(s: SocialState, flag: string): boolean {
  return s.flags.includes(flag);
}

/** Does `cond` hold for a conversation with `npc`? `met` is "met before this talk". */
export function check(s: SocialState, npc: NpcId, cond: Cond | undefined, metBefore = s.npcs[npc].met): boolean {
  if (!cond) return true;
  const me = s.npcs[npc];
  if (cond.flag !== undefined && !hasFlag(s, cond.flag)) return false;
  if (cond.notFlag !== undefined && hasFlag(s, cond.notFlag)) return false;
  if (cond.flags && !cond.flags.every((f) => hasFlag(s, f))) return false;
  if (cond.notFlags && cond.notFlags.some((f) => hasFlag(s, f))) return false;
  if (cond.minRep !== undefined && me.rep < cond.minRep) return false;
  if (cond.maxRep !== undefined && me.rep > cond.maxRep) return false;
  if (cond.met !== undefined && metBefore !== cond.met) return false;
  if (cond.metCount !== undefined && metCount(s) < cond.metCount) return false;
  if (cond.errand !== undefined) {
    const state = s.errands[cond.errandOf ?? npc];
    const wanted = Array.isArray(cond.errand) ? cond.errand : [cond.errand];
    if (!wanted.includes(state)) return false;
  }
  return true;
}

export interface EffectResult {
  repDelta: number;
  errand?: { npc: NpcId; state: ErrandState };
  /** Flags newly set by this step (missions and the notebook listen for these). */
  flags?: string[];
}

export function apply(s: SocialState, npc: NpcId, effects: Effect[] | undefined): EffectResult {
  const out: EffectResult = { repDelta: 0 };
  for (const e of effects ?? []) {
    if (e.rep) {
      const me = s.npcs[npc];
      const before = me.rep;
      me.rep = Math.max(REP_MIN, Math.min(REP_MAX, me.rep + e.rep));
      out.repDelta += me.rep - before;
    }
    if (e.flag && !hasFlag(s, e.flag)) {
      s.flags.push(e.flag);
      (out.flags ??= []).push(e.flag);
    }
    if (e.errand) {
      const who = e.errandOf ?? npc;
      s.errands[who] = e.errand;
      out.errand = { npc: who, state: e.errand };
    }
  }
  return out;
}

/** What the conversation screen shows for the current line. */
export interface Line {
  npc: NpcId;
  nodeId: string;
  textKey: string;
  by: 'npc' | 'player';
  mood: Mood;
  /** Visible choices with their locale keys; empty when the line just continues. */
  choices: { index: number; textKey: string; tone?: Choice['tone'] }[];
  end: boolean;
}

/**
 * Runs one conversation. Call `line` to read the current line, `choose(i)` to
 * pick a visible choice, `next()` to continue a line without choices. Effects
 * are applied to the shared state as the conversation goes, and reported to
 * `onEffect` so the game can react (show reputation changes, update errands).
 */
export class Conversation {
  private nodeId: string;
  private readonly metBefore: boolean;
  done = false;

  constructor(
    private def: DialogueDef,
    private state: SocialState,
    private onEffect: (r: EffectResult) => void = () => {},
  ) {
    const npc = def.npc;
    this.metBefore = state.npcs[npc].met;
    const entry = def.entry.find((e) => check(state, npc, e.if, this.metBefore));
    if (!entry) throw new Error(`No dialogue entry for ${npc}`);
    state.npcs[npc].met = true;
    state.npcs[npc].talks++;
    this.nodeId = entry.node;
    this.enter();
  }

  private get node(): DNode {
    const n = this.def.nodes[this.nodeId];
    if (!n) throw new Error(`Missing dialogue node ${this.def.npc}.${this.nodeId}`);
    return n;
  }

  private enter(): void {
    const r = apply(this.state, this.def.npc, this.node.do);
    if (r.repDelta || r.errand || r.flags) this.onEffect(r);
  }

  private visible(): { c: Choice; index: number }[] {
    return (this.node.choices ?? []).map((c, index) => ({ c, index })).filter(({ c }) => check(this.state, this.def.npc, c.if, this.metBefore));
  }

  get line(): Line {
    const n = this.node;
    const npc = this.def.npc;
    return {
      npc,
      nodeId: this.nodeId,
      textKey: `dlg.${npc}.${this.nodeId}`,
      by: n.by ?? 'npc',
      mood: n.mood ?? 'talk',
      choices: this.visible().map(({ c, index }) => ({ index, textKey: choiceTextKey(npc, this.nodeId, n.choices!, index), tone: c.tone })),
      end: !!n.end || (!n.next && !n.choices?.length),
    };
  }

  /** Continue a line that has no choices. */
  next(): void {
    if (this.done) return;
    const n = this.node;
    if (n.choices?.length) return;
    if (!n.next || n.end) {
      this.done = true;
      return;
    }
    this.nodeId = n.next;
    this.enter();
  }

  /** Pick choice number `index` (its position in the node's full choice list). */
  choose(index: number): void {
    if (this.done) return;
    const pick = this.visible().find((v) => v.index === index);
    if (!pick) return;
    const r = apply(this.state, this.def.npc, pick.c.do);
    if (r.repDelta || r.errand || r.flags) this.onEffect(r);
    this.nodeId = pick.c.to;
    this.enter();
  }
}
