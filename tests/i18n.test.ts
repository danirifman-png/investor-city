import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISTRICT_IDS, ZONES } from '../src/content/cityPlan';
import he from '../src/i18n/locales/he.json';
import { hasKey, t } from '../src/i18n';

const HEBREW = /[֐-׿]/;

describe('Hebrew content', () => {
  it('names and describes every zone and lot type', () => {
    for (const id of Object.keys(ZONES)) {
      expect(hasKey(`district.${id}.name`), id).toBe(true);
      expect(hasKey(`district.${id}.tagline`), id).toBe(true);
    }
    const lotTypes = new Set(Object.values(ZONES).flatMap((z) => z.lots));
    lotTypes.delete('centralPlaza');
    lotTypes.delete('academyPark');
    for (const k of [...lotTypes, 'exchange', 'newsTower', 'fountain', 'academy']) {
      expect(hasKey(`poi.${k}.name`), k).toBe(true);
      expect(hasKey(`poi.${k}.desc`), k).toBe(true);
    }
    expect(DISTRICT_IDS.length).toBe(7);
  });

  it('is actually written in Hebrew', () => {
    for (const [key, value] of Object.entries(he as Record<string, string>)) expect(HEBREW.test(value), key).toBe(true);
  });

  it('covers every key the source code asks for', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (p.endsWith('.ts')) files.push(p);
      }
    };
    walk(join(__dirname, '../src'));
    const missing: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\('([a-zA-Z0-9_.]+)'\)/g)) if (!hasKey(m[1])) missing.push(`${m[1]} (${f})`);
    }
    expect(missing).toEqual([]);
  });

  it('substitutes placeholders and reports missing keys as the key', () => {
    expect(t('no.such.key')).toBe('no.such.key');
    expect(t('game.title')).toBe('עיר המשקיעים');
  });
});
