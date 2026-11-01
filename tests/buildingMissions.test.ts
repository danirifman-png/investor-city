import { describe, expect, it } from 'vitest';
import { isConcept } from '../src/content/concepts';
import { BUILDING_MISSIONS, MISSION_BUILDINGS, TIER_RULES } from '../src/content/missions/buildings';
import { grade, missionProgress, recordTier, sanitizeMissionRecord, tierState } from '../src/core/BuildingMissions';
import { t } from '../src/i18n';

describe('building missions', () => {
  it('six buildings, three tiers of three questions, every text present and answers in range', () => {
    expect(MISSION_BUILDINGS).toHaveLength(6);
    for (const b of MISSION_BUILDINGS) {
      const def = BUILDING_MISSIONS[b];
      expect(def.tiers).toHaveLength(TIER_RULES.length);
      def.tiers.forEach((tier, ti) => {
        expect(tier.correct).toHaveLength(3);
        for (const k of ['title', 'intro']) expect(t(`bm.${b}.${ti}.${k}`)).not.toBe(`bm.${b}.${ti}.${k}`);
        tier.correct.forEach((c, qi) => {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(3);
          for (const k of [`q${qi}`, `q${qi}.why`, `q${qi}.a0`, `q${qi}.a1`, `q${qi}.a2`]) expect(t(`bm.${b}.${ti}.${k}`)).not.toBe(`bm.${b}.${ti}.${k}`);
        });
        for (const c of tier.learn) expect(isConcept(c)).toBe(true);
      });
      // the right answer is not always in the same place
      expect(new Set(def.tiers.flatMap((x) => x.correct)).size).toBeGreaterThan(1);
    }
  });

  it('tiers open by passing the one before and reaching its level', () => {
    let rec = {};
    expect(tierState(rec, 'bank', 0, 1)).toEqual({ kind: 'open' });
    expect(tierState(rec, 'bank', 1, 9)).toEqual({ kind: 'needPrev' });
    const right = BUILDING_MISSIONS.bank.tiers[0].correct;
    const g = grade('bank', 0, right);
    expect(g).toEqual({ right: 3, total: 3, passed: true, stars: 3 });
    const r1 = recordTier(rec, 'bank', 0, g);
    expect(r1.firstPass).toBe(true);
    rec = r1.rec;
    expect(tierState(rec, 'bank', 0, 1)).toEqual({ kind: 'done', stars: 3 });
    expect(tierState(rec, 'bank', 1, 2)).toEqual({ kind: 'needLevel', level: 3 });
    expect(tierState(rec, 'bank', 1, 3)).toEqual({ kind: 'open' });
    // replaying gives no second reward
    expect(recordTier(rec, 'bank', 0, g).firstPass).toBe(false);
    expect(missionProgress(rec)).toEqual({ done: 1, total: 18 });
  });

  it('two right of three passes with two stars; one right fails', () => {
    const c = BUILDING_MISSIONS.exchange.tiers[1].correct;
    expect(grade('exchange', 1, [c[0], c[1], (c[2] + 1) % 3]).stars).toBe(2);
    const fail = grade('exchange', 1, [c[0], (c[1] + 1) % 3, (c[2] + 1) % 3]);
    expect(fail.passed).toBe(false);
    expect(recordTier({}, 'exchange', 1, fail).firstPass).toBe(false);
  });

  it('cleans saved data', () => {
    expect(sanitizeMissionRecord({ bank: [5, -1, 'x'], nope: [1] })).toEqual({ bank: [3, 0, 0] });
  });
});
