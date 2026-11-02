import { describe, expect, it } from 'vitest';
import { TREASURE, TREASURE_PIECES } from '../src/content/treasure';
import { newTreasure, nextStep, piecesFound, sanitizeTreasure, take, treasureDone } from '../src/core/Treasure';
import he from '../src/i18n/locales/he.treasure.json';

describe('treasure', () => {
  it('seven pieces, then the vault, each with its texts', () => {
    expect(TREASURE_PIECES).toBe(7);
    expect(TREASURE.at(-1)!.kind).toBe('vault');
    const dict = he as Record<string, string>;
    for (const s of TREASURE) for (const k of ['title', 'body', 'next']) expect(dict[`treasure.${s.id}.${k}`], `${s.id}.${k}`).toBeTruthy();
    for (const s of TREASURE) if (s.kind !== 'friend') expect(s.at).toBeDefined();
  });

  it('only the next step can be taken, in order', () => {
    let s = newTreasure();
    expect(take(s, 'fountain', 999)).toBeNull();
    const a = take(s, 'plaza', 0)!;
    s = a.state;
    expect(piecesFound(s)).toBe(1);
    expect(nextStep(s)!.id).toBe('fountain');
  });

  it('the chest needs its coins and pays back more', () => {
    const s = { step: 1 };
    const price = TREASURE[1].price!;
    expect(take(s, 'fountain', price - 1)).toBeNull();
    const r = take(s, 'fountain', price)!;
    expect(r.cost).toBe(price);
    expect(r.coins).toBeGreaterThan(price);
  });

  it('ends after the vault', () => {
    let s = newTreasure();
    for (const st of TREASURE) s = take(s, st.id, 999)!.state;
    expect(treasureDone(s)).toBe(true);
    expect(nextStep(s)).toBeNull();
    expect(piecesFound(s)).toBe(7);
  });

  it('saves are cleaned', () => {
    expect(sanitizeTreasure(null)).toEqual({ step: 0 });
    expect(sanitizeTreasure({ step: 99 })).toEqual({ step: TREASURE.length });
    expect(sanitizeTreasure({ step: 2.6 })).toEqual({ step: 2 });
  });
});
