import { describe, expect, it } from 'vitest';
import { DECISIONS } from '../src/content/decisions';
import { decisionSeed, decisionState, recordDecision, resolveDecision, sanitizeDecisions } from '../src/core/Decisions';
import { biteLift, treatLeft } from '../src/character/Gear';
import he from '../src/i18n/locales/he.decisions.json';

const dict = he as Record<string, string>;
const byId = (id: string) => DECISIONS.find((d) => d.id === id)!;

describe('decisions content', () => {
  it('every option splits the whole pot and has its texts', () => {
    for (const d of DECISIONS) {
      expect(dict[`dec.${d.id}.title`]).toBeTruthy();
      expect(dict[`dec.${d.id}.story`]).toBeTruthy();
      expect(d.options.length).toBeGreaterThanOrEqual(2);
      expect(d.options.length).toBeLessThanOrEqual(4);
      d.options.forEach((o, k) => {
        expect(o.parts.reduce((s, p) => s + p.share, 0)).toBeCloseTo(1);
        for (const suffix of ['', '.gain', '.cost']) expect(dict[`dec.${d.id}.o${k}${suffix}`], `${d.id} o${k}${suffix}`).toBeTruthy();
      });
    }
  });

  it('has one decision per building', () => {
    expect(new Set(DECISIONS.map((d) => d.building)).size).toBe(DECISIONS.length);
  });
});

describe('resolveDecision', () => {
  it('spending is enjoyed now and worth nothing later; saving grows by its rate', () => {
    const d = byId('birthday');
    expect(resolveDecision(d, 0, 1)).toMatchObject({ now: 0, later: 0, joy: true });
    expect(resolveDecision(d, 1, 1)).toMatchObject({ now: 20, later: 22, joy: false });
    expect(resolveDecision(d, 2, 1)).toMatchObject({ now: 10, later: 11, joy: true });
  });

  it('a fixed result is the same every time', () => {
    const d = byId('lemonade');
    expect([0, 1, 2].map((k) => resolveDecision(d, k, 5).later)).toEqual([18, 24, 12]);
  });

  it('an investment ends inside its range, never below zero, and the same seed gives the same result', () => {
    const d = byId('friendStartup');
    for (let s = 0; s < 200; s++) {
      const r = resolveDecision(d, 0, decisionSeed(s, d.id, 0));
      const p = r.parts[0];
      expect(p.result).toBeGreaterThanOrEqual(p.lo!);
      expect(p.result).toBeLessThanOrEqual(p.hi!);
      expect(p.lo).toBe(0);
      expect(p.hi).toBe(120);
    }
    expect(resolveDecision(d, 0, 42)).toEqual(resolveDecision(d, 0, 42));
  });

  it('spreading the risk narrows the range', () => {
    const d = byId('basket');
    const one = resolveDecision(d, 0, 3).parts[0];
    const three = resolveDecision(d, 1, 3).parts[0];
    expect(three.hi! - three.lo!).toBeLessThan(one.hi! - one.lo!);
  });

  it('seeds differ by day and attempt', () => {
    expect(decisionSeed(10, 'kiosk', 0)).not.toBe(decisionSeed(11, 'kiosk', 0));
    expect(decisionSeed(10, 'kiosk', 0)).not.toBe(decisionSeed(10, 'kiosk', 1));
  });
});

describe('decision record', () => {
  it('opens after the first tier, once a day', () => {
    expect(decisionState({}, 'bank', false, 5).kind).toBe('locked');
    expect(decisionState({}, 'bank', true, 5).kind).toBe('open');
    const first = recordDecision({}, 'bank', 5);
    expect(first.first).toBe(true);
    expect(decisionState(first.rec, 'bank', true, 5).kind).toBe('doneToday');
    expect(decisionState(first.rec, 'bank', true, 6).kind).toBe('open');
    expect(recordDecision(first.rec, 'bank', 6)).toMatchObject({ first: false, rec: { bank: { lastDay: 6, count: 2 } } });
  });

  it('sanitizes saved records', () => {
    expect(sanitizeDecisions(null)).toEqual({});
    expect(sanitizeDecisions({ bank: { lastDay: 3.7, count: 2 }, nowhere: { lastDay: 1, count: 1 }, exchange: { lastDay: 'x', count: 1 } })).toEqual({ bank: { lastDay: 3, count: 2 } });
  });
});

describe('eating a treat', () => {
  it('raises the hand for each bite and the treat gets smaller until it is gone', () => {
    expect(biteLift(0.5)).toBe(0);
    expect(biteLift(1.8)).toBe(1);
    expect(treatLeft(0)).toBe(1);
    expect(treatLeft(2)).toBe(0.75);
    expect(treatLeft(9)).toBe(0);
  });
});
