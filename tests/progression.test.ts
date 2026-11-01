import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK } from '../src/content/characterOptions';
import { DIALOGUES } from '../src/content/dialogue/scripts';
import { ITEM_IDS } from '../src/content/items';
import { LEVELS, QUESTS } from '../src/content/quests';
import { advance, currentQuest, grant, levelInfo, newProgression, sanitizeProgression, type QuestWorld } from '../src/core/Progression';
import { migrate, newSave, SAVE_VERSION } from '../src/core/Save';
import { Conversation, hasFlag, newSocial, type SocialState } from '../src/core/Social';
import { hasKey } from '../src/i18n';

/** A test world: flags live in a social state; the player "stands" next to whatever is listed. */
function world(s: SocialState, at: { pois?: string[]; npcs?: string[] } = {}): QuestWorld {
  return {
    hasFlag: (f) => hasFlag(s, f),
    nearPoi: (p) => !!at.pois?.includes(p),
    nearNpc: (n) => !!at.npcs?.includes(n),
    setFlag: (f) => void (!hasFlag(s, f) && s.flags.push(f)),
  };
}

/** Plays Oliver's conversation, answering the challenge with `answers` in order (1-based choice numbers). */
function talkToOliver(s: SocialState, answers: number[]): string[] {
  const conv = new Conversation(DIALOGUES.oliver, s);
  const seen: string[] = [];
  for (let i = 0; i < 40 && !conv.done; i++) {
    const line = conv.line;
    seen.push(line.nodeId);
    if (line.nodeId === 'mentorQ') conv.choose(answers.shift()! - 1);
    else if (line.choices.length) conv.choose(line.choices[line.choices.length - 1].index);
    else conv.next();
  }
  return seen;
}

describe('levels and rewards', () => {
  it('maps XP to levels with progress inside the level', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, into: 0, need: LEVELS[1] });
    expect(levelInfo(LEVELS[1])).toMatchObject({ level: 2, into: 0 });
    expect(levelInfo(LEVELS[1] + 10).frac).toBeCloseTo(10 / (LEVELS[2] - LEVELS[1]));
    expect(levelInfo(1e6)).toMatchObject({ level: LEVELS.length, max: true, frac: 1 });
  });

  it('grants XP, coins, items and unlocks once, and reports level ups', () => {
    const p = newProgression();
    expect(grant(p, { xp: 50 })).toEqual({ level: 1, levelUp: false });
    expect(grant(p, { xp: 60, coins: 5, items: ['trailMap'], unlock: ['trail'] })).toEqual({ level: 2, levelUp: true });
    grant(p, { items: ['trailMap'], unlock: ['trail'] });
    expect(p).toMatchObject({ xp: 110, coins: 5, items: ['trailMap'], unlocked: ['trail'] });
  });
});

describe('the first mentor quest', () => {
  it('runs step by step: explore, approach Oliver, talk, solve; then the trail quest starts', () => {
    const s = newSocial();
    const p = newProgression();
    let ev = advance(p, world(s));
    expect(ev).toEqual([{ type: 'started', quest: 'mentor' }]);
    expect(currentQuest(p)?.q.step).toBe(0);

    // the square: any order, one place at a time
    advance(p, world(s, { pois: ['fountain'] }));
    advance(p, world(s, { pois: ['exchange'] }));
    expect(p.quests.mentor.seen).toEqual(['fountain', 'exchange']);
    ev = advance(p, world(s, { pois: ['plazaMarket'] }));
    expect(ev).toEqual([{ type: 'step', quest: 'mentor', step: 'explore' }]);

    // walking up to Oliver sets the flag his conversation waits for
    expect(hasFlag(s, 'mentor.ready')).toBe(false);
    advance(p, world(s, { npcs: ['oliver'] }));
    expect(hasFlag(s, 'mentor.ready')).toBe(true);
    expect(p.quests.mentor.step).toBe(2);

    const seen = talkToOliver(s, [2]);
    expect(seen.slice(0, 3)).toEqual(['mentor1', 'mentor2', 'mentorQ']);
    expect(seen).toContain('mentorRight');
    expect(hasFlag(s, 'mentor.solved')).toBe(true);

    ev = advance(p, world(s));
    const done = ev.find((e) => e.type === 'complete');
    expect(done).toMatchObject({ quest: 'mentor', levelUp: true, reward: { xp: 150, coins: 30, items: ['mentorBadge', 'trailMap'], unlock: ['trail'] } });
    expect(p.unlocked).toEqual(['trail']);
    expect(ev).toContainEqual({ type: 'started', quest: 'trail' });

    ev = advance(p, world(s, { pois: ['waterfall'] }));
    expect(ev[0]).toMatchObject({ type: 'complete', quest: 'trail' });
    expect(p.items).toContain('piggyBank');
    expect(currentQuest(p)).toBeNull();
  });

  it('a wrong answer is explained, asked again, and costs the first-try bonus', () => {
    const s = newSocial();
    s.flags.push('mentor.ready');
    const seen = talkToOliver(s, [1, 3, 2]);
    expect(seen).toContain('mentorSpend');
    expect(seen).toContain('mentorRumor');
    expect(seen.filter((n) => n === 'mentorQ').length).toBe(3);
    expect(hasFlag(s, 'mentor.wrong')).toBe(true);
    const p = newProgression();
    p.quests.mentor = { status: 'active', step: 2, seen: [] };
    const done = advance(p, world(s)).find((e) => e.type === 'complete');
    expect(done).toMatchObject({ reward: { xp: 120 } });
  });

  it("Oliver keeps his usual first meeting until the player is sent to him", () => {
    expect(new Conversation(DIALOGUES.oliver, newSocial()).line.nodeId).toBe('hello');
  });
});

describe('progression save', () => {
  it(`save v${SAVE_VERSION} keeps growth and settings; older saves start fresh`, () => {
    expect(SAVE_VERSION).toBe(4);
    const data = newSave({ ...DEFAULT_LOOK, nickname: 'דני' });
    grant(data.growth, { xp: 130, coins: 12, items: ['mentorBadge'], unlock: ['trail'] });
    data.growth.quests.mentor = { status: 'done', step: 3, seen: [] };
    data.settings = { night: true, bubbles: false, calm: true, camSpeed: 1.5, guide: false };
    const back = migrate(JSON.parse(JSON.stringify(data)))!;
    expect(back.growth).toEqual(data.growth);
    expect(back.settings).toEqual(data.settings);
    const v3 = { ...JSON.parse(JSON.stringify(data)), version: 3, growth: undefined, settings: { night: true } };
    const old = migrate(v3)!;
    expect(old.growth).toEqual(newProgression());
    expect(old.settings).toEqual({ night: true, bubbles: true, calm: false, camSpeed: 1, guide: true });
  });

  it('drops unknown quests, items and areas and clamps numbers', () => {
    const p = sanitizeProgression({ xp: -5, coins: 1e12, items: ['mentorBadge', 'gold', 'mentorBadge'], unlocked: ['trail', 'moon'], quests: { mentor: { status: 'active', step: 99, seen: ['fountain'] }, fake: { status: 'done' } } });
    expect(p).toEqual({ xp: 0, coins: 1e7, items: ['mentorBadge'], unlocked: ['trail'], quests: { mentor: { status: 'active', step: 3, seen: ['fountain'] } } });
  });
});

describe('quest text', () => {
  it('every quest, step, item and mentor line has Hebrew text', () => {
    const keys: string[] = [];
    for (const q of QUESTS) keys.push(`quest.${q.id}.title`, `quest.${q.id}.desc`, ...q.steps.map((s) => `quest.${q.id}.step.${s.id}`));
    for (const it of ITEM_IDS) keys.push(`item.${it}.name`, `item.${it}.desc`);
    keys.push('poi.plazaMarket.name', 'poi.waterfall.name', 'area.trail', 'complete.title', 'trail.sign', 'trail.locked');
    for (const id of Object.keys(DIALOGUES.oliver.nodes).filter((n) => n.startsWith('mentor'))) keys.push(`dlg.oliver.${id}`);
    keys.push('dlg.oliver.mentorQ.1', 'dlg.oliver.mentorQ.2', 'dlg.oliver.mentorQ.3');
    expect(keys.filter((k) => !hasKey(k))).toEqual([]);
  });

  it('quest steps point at real places, characters and flags set somewhere', () => {
    for (const q of QUESTS) {
      for (const r of q.requires) expect(QUESTS.some((x) => x.id === r)).toBe(true);
      for (const s of q.steps) {
        if (s.goal.kind === 'flag') {
          const flag = s.goal.flag;
          const setBy = Object.values(DIALOGUES).some((d) => JSON.stringify(d.nodes).includes(`"flag":"${flag}"`));
          expect(setBy, flag).toBe(true);
        }
      }
    }
  });
});
