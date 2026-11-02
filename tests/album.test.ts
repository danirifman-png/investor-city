import { describe, expect, it } from 'vitest';
import { addMoments, MOMENT_IDS, newMoments, sanitizeAlbum } from '../src/core/Album';
import { hasKey } from '../src/i18n';
import { DEFAULT_LOOK } from '../src/content/characterOptions';
import { migrate, newSave } from '../src/core/Save';

describe('album of moments', () => {
  const look = () => newSave({ ...DEFAULT_LOOK, nickname: 'Dana' });

  it('finds first times from the saved state, once', () => {
    const d = look();
    expect(newMoments({}, d)).toEqual([]);
    d.jobs = { bank_teller: { day: 5, shifts: 1, best: 6 } };
    d.life.home = { kind: 'rent', since: 0 } as never;
    const fresh = newMoments({}, d);
    expect(fresh).toEqual(['shift', 'home']);
    const album = addMoments({}, fresh, 7);
    expect(album).toEqual({ shift: 7, home: 7 });
    expect(newMoments(album, d)).toEqual([]);
    // a later add never changes the day of a moment
    expect(addMoments(album, ['shift'], 9).shift).toBe(7);
  });

  it('sanitizes and fills old saves quietly', () => {
    expect(sanitizeAlbum({ shift: 3, bogus: 1, home: 'x' })).toEqual({ shift: 3 });
    const old = look() as unknown as Record<string, unknown>;
    (old.life as Record<string, unknown>).home = { kind: 'rent', since: 0 };
    delete old.album;
    const loaded = migrate(JSON.parse(JSON.stringify(old)));
    expect(loaded?.album).toEqual({ home: -1 });
  });

  it('has text for every moment', () => {
    for (const id of MOMENT_IDS) for (const k of ['title', 'body', 'hint']) expect(hasKey(`album.${id}.${k}`)).toBe(true);
  });
});
