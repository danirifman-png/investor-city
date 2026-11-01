import { describe, expect, it } from 'vitest';
import { DIALOGUES, dialogueKeys } from '../src/content/dialogue/scripts';
import { ERRANDS } from '../src/content/errands';
import { NPC_IDS, NPCS, repLevel, type NpcId } from '../src/content/npcs';
import { Conversation, metCount, newSocial, type SocialState } from '../src/core/Social';
import { migrate, newSave, SAVE_VERSION } from '../src/core/Save';
import { DEFAULT_LOOK } from '../src/content/characterOptions';
import heDialogue from '../src/i18n/locales/he.dialogue.json';
import { hasKey } from '../src/i18n';

const HEBREW = /[֐-׿]/;

/** Walks a conversation, picking answers with `pick` (index into the visible choices). */
function talk(s: SocialState, npc: NpcId, pick: (nodeId: string, n: number) => number = () => 0, maxSteps = 60): string[] {
  const conv = new Conversation(DIALOGUES[npc], s);
  const path: string[] = [];
  for (let i = 0; i < maxSteps && !conv.done; i++) {
    const line = conv.line;
    path.push(line.nodeId);
    if (line.choices.length) conv.choose(line.choices[Math.min(pick(line.nodeId, line.choices.length), line.choices.length - 1)].index);
    else conv.next();
  }
  expect(conv.done, `${npc} conversation ends (path ${path.join('>')})`).toBe(true);
  return path;
}

/** Always leave the topic menu, otherwise take the first answer. */
const firstThenBye = (node: string, n: number) => (node === 'hub' ? n - 1 : 0);

describe('characters', () => {
  it('has the eight main characters with names, roles, stories and homes', () => {
    expect(NPC_IDS.length).toBe(8);
    for (const id of NPC_IDS) {
      for (const k of ['name', 'short', 'role', 'bio']) expect(hasKey(`npc.${id}.${k}`), `${id}.${k}`).toBe(true);
      expect(hasKey(`poi.${NPCS[id].home}.name`), `${id} home`).toBe(true);
      expect(hasKey(`errand.${id}.title`) && hasKey(`errand.${id}.goal`), `${id} errand`).toBe(true);
      expect(ERRANDS[id].npc).toBe(id);
    }
  });

  it('gives every character a distinct look', () => {
    const looks = NPC_IDS.map((id) => JSON.stringify([NPCS[id].body, NPCS[id].look, NPCS[id].extras]));
    expect(new Set(looks).size).toBe(8);
  });

  it('maps reputation to four relationship levels', () => {
    expect([0, 19, 20, 44, 45, 74, 75, 100].map(repLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});

describe('dialogue scripts', () => {
  it('has Hebrew text for every line and answer, and no orphan text', () => {
    const keys = dialogueKeys();
    const missing = keys.filter((k) => !hasKey(k));
    expect(missing).toEqual([]);
    const used = new Set(keys);
    const orphans = Object.keys(heDialogue).filter((k) => !used.has(k));
    expect(orphans).toEqual([]);
    for (const [k, v] of Object.entries(heDialogue as Record<string, string>)) expect(HEBREW.test(v), k).toBe(true);
  });

  it('only links to nodes that exist, and every node is reachable', () => {
    for (const def of Object.values(DIALOGUES)) {
      const ids = new Set(Object.keys(def.nodes));
      const seen = new Set<string>();
      const stack = def.entry.map((e) => e.node);
      for (const n of stack) expect(ids.has(n), `${def.npc} entry ${n}`).toBe(true);
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const node = def.nodes[id];
        expect(node, `${def.npc}.${id}`).toBeDefined();
        const next = [node.next, ...(node.choices ?? []).map((c) => c.to)].filter(Boolean) as string[];
        for (const n of next) expect(ids.has(n), `${def.npc}.${id} -> ${n}`).toBe(true);
        stack.push(...next);
      }
      expect([...ids].filter((i) => !seen.has(i)), `${def.npc} unreachable nodes`).toEqual([]);
      expect(def.entry.at(-1)?.if, `${def.npc} has a fallback entry`).toBeUndefined();
    }
  });

  it('can always reach the end of a conversation from any line', () => {
    for (const def of Object.values(DIALOGUES)) {
      const canEnd = new Set<string>();
      let grew = true;
      while (grew) {
        grew = false;
        for (const [id, n] of Object.entries(def.nodes)) {
          if (canEnd.has(id)) continue;
          const next = [n.next, ...(n.choices ?? []).map((c) => c.to)].filter(Boolean) as string[];
          if (n.end || next.length === 0 || next.some((x) => canEnd.has(x))) {
            canEnd.add(id);
            grew = true;
          }
        }
      }
      expect(Object.keys(def.nodes).filter((id) => !canEnd.has(id)), def.npc).toEqual([]);
    }
  });
});

describe('conversations', () => {
  it('first meeting: everyone introduces themselves and offers an errand', () => {
    for (const id of NPC_IDS) {
      const s = newSocial();
      const path = talk(s, id);
      expect(path[0], id).toBe('hello');
      expect(path, id).toContain('offer');
      expect(s.npcs[id].met).toBe(true);
      expect(s.errands[id], `${id} errand accepted`).toBe('active');
      expect(s.npcs[id].rep, `${id} likes a friendly first chat`).toBeGreaterThan(10);
    }
  });

  it('a rude answer ends the chat, lowers reputation, and changes the next greeting', () => {
    for (const id of NPC_IDS) {
      const s = newSocial();
      // pick the rude answer at hello
      const rudeIndex = DIALOGUES[id].nodes.hello.choices!.findIndex((c) => c.tone === 'rude');
      expect(rudeIndex, `${id} has a rude option`).toBeGreaterThanOrEqual(0);
      const path = talk(s, id, (node) => (node === 'hello' ? rudeIndex : 0));
      expect(path).toEqual(['hello', 'rude']);
      expect(s.npcs[id].rep).toBe(0);
      // next time: a cold greeting, and apologising mends it
      const again = talk(s, id, firstThenBye);
      expect(again[0]).toBe('cold');
      expect(again[1]).toBe('sorry');
      expect(s.npcs[id].rep).toBeGreaterThan(0);
    }
  });

  it('declining the errand keeps it available from the topic menu', () => {
    const s = newSocial();
    talk(s, 'sara', (node, n) => (node === 'offer' ? n - 1 : 0));
    expect(s.errands.sara).toBe('none');
    const again = talk(s, 'sara', (node) => (node === 'hub' ? 2 : 0));
    expect(again).toContain('offer');
    expect(s.errands.sara).toBe('active');
  });

  it('an active errand gets a reminder, a ready errand gets the "what did you learn?" scene', () => {
    for (const id of NPC_IDS) {
      const s = newSocial();
      talk(s, id);
      expect(talk(s, id)[0], `${id} reminds`).toBe('remind');
      s.errands[id] = 'ready';
      const before = s.npcs[id].rep;
      const path = talk(s, id, firstThenBye);
      expect(path.slice(0, 2), id).toEqual(['done1', 'done2']);
      expect(path).toContain('done3');
      expect(s.errands[id]).toBe('done');
      expect(s.npcs[id].rep - before, `${id} reward`).toBeGreaterThanOrEqual(25);
    }
  });

  it('different answers lead to different reactions', () => {
    const a = newSocial();
    const b = newSocial();
    const pa = talk(a, 'marco', (node) => (node === 'hello' ? 1 : node === 'cost' ? 0 : 0));
    const pb = talk(b, 'marco', (node) => (node === 'hello' ? 1 : node === 'cost' ? 1 : 0));
    expect(pa).toContain('profit');
    expect(pb).toContain('profitWrong');
    expect(a.npcs.marco.rep).toBeGreaterThan(b.npcs.marco.rep);
  });

  it('a friend gets a warmer greeting', () => {
    const s = newSocial();
    talk(s, 'daniel', (node, n) => (node === 'offer' ? n - 1 : 0));
    s.npcs.daniel.rep = 60;
    expect(talk(s, 'daniel', firstThenBye)[0]).toBe('friend');
  });

  it("Leo's rumor is checked with Marco, and Maya's question with Nina", () => {
    const s = newSocial();
    talk(s, 'marco', (node, n) => (node === 'offer' ? n - 1 : 0));
    talk(s, 'nina', (node, n) => (node === 'offer' ? n - 1 : 0));
    talk(s, 'leo');
    talk(s, 'maya');
    expect(s.errands.leo).toBe('active');
    expect(talk(s, 'marco')[0]).toBe('rumor');
    expect(s.flags).toContain('marco.rumorChecked');
    expect(talk(s, 'nina')[0]).toBe('mayaQ');
    expect(s.flags).toContain('nina.toldMaya');
    // back to normal afterwards
    expect(talk(s, 'marco', firstThenBye)[0]).not.toBe('rumor');
  });

  it('counts the people met', () => {
    const s = newSocial();
    for (const id of ['oliver', 'marco', 'ben'] as NpcId[]) talk(s, id);
    expect(metCount(s)).toBe(3);
  });
});

describe('save upgrade', () => {
  it('upgrades a phase 2 save and keeps relationships through a round trip', () => {
    const v1 = { ...newSave({ ...DEFAULT_LOOK, nickname: 'Noa' }), version: 1 } as Record<string, unknown>;
    delete v1.social;
    const up = migrate(JSON.parse(JSON.stringify(v1)))!;
    expect(up.version).toBe(SAVE_VERSION);
    expect(up.social.npcs.oliver).toEqual({ met: false, rep: 10, talks: 0 });

    talk(up.social, 'leo');
    const again = migrate(JSON.parse(JSON.stringify(up)))!;
    expect(again.social.npcs.leo.met).toBe(true);
    expect(again.social.errands.leo).toBe('active');
  });

  it('cleans tampered relationship data', () => {
    const save = newSave(DEFAULT_LOOK) as unknown as Record<string, unknown>;
    save.social = { npcs: { leo: { met: 'yes', rep: 9999, talks: -4 } }, flags: ['ok.flag', '<script>', 7], errands: { leo: 'hacked', ben: 'done' } };
    const s = migrate(save)!.social;
    expect(s.npcs.leo).toEqual({ met: false, rep: 100, talks: 0 });
    expect(s.flags).toEqual(['ok.flag']);
    expect(s.errands.leo).toBe('none');
    expect(s.errands.ben).toBe('done');
  });
});
