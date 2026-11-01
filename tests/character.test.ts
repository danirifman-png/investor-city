import { describe, expect, it } from 'vitest';
import {
  BUILDS,
  cleanNickname,
  DEFAULT_LOOK,
  HAIR_STYLES,
  NICKNAME_MAX,
  randomLook,
  sanitizeLook,
} from '../src/content/characterOptions';
import { mulberry32 } from '../src/world/cityLayout';

describe('character options', () => {
  it('cleans nicknames: Hebrew and English kept, symbols dropped, length capped', () => {
    expect(cleanNickname('דנה')).toBe('דנה');
    expect(cleanNickname('  Dana_7  ')).toBe('Dana_7 ');
    expect(cleanNickname('a<b>c{}@!')).toBe('abc');
    expect(cleanNickname('x'.repeat(40)).length).toBe(NICKNAME_MAX);
    expect(cleanNickname('a    b')).toBe('a b');
  });

  it('sanitizeLook returns defaults for nonsense', () => {
    expect(sanitizeLook(undefined)).toEqual({ ...DEFAULT_LOOK, nickname: '' });
    expect(sanitizeLook({ build: 'giant' }).build).toBe(DEFAULT_LOOK.build);
  });

  it('sanitizeLook keeps a valid look unchanged', () => {
    const look = randomLook(mulberry32(3), 'Noa');
    expect(sanitizeLook(look)).toEqual(look);
  });

  it('randomLook always produces valid looks and real variety', () => {
    const rng = mulberry32(11);
    const styles = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const l = randomLook(rng, 'x');
      expect(sanitizeLook(l)).toEqual(l);
      expect(BUILDS).toContain(l.build);
      styles.add(l.hairStyle);
    }
    expect(styles.size).toBe(HAIR_STYLES.length);
  });
});
