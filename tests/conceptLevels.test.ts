import { describe, expect, it } from 'vitest';
import { CONCEPT_IDS } from '../src/content/concepts';
import learn from '../src/i18n/locales/he.learn.json';
import shop from '../src/i18n/locales/he.shop.json';
import { SHOP_ITEMS } from '../src/content/shop';

const L = learn as Record<string, string>;
const S = shop as Record<string, string>;

describe('texts by level', () => {
  it('every concept has a simple and an advanced version', () => {
    for (const id of CONCEPT_IDS) {
      expect(L[`concept.${id}.simple`], id).toBeTruthy();
      expect(L[`concept.${id}.deep`], id).toBeTruthy();
    }
  });
  it('every shop item has a name and description, and treats a fun fact', () => {
    for (const i of SHOP_ITEMS) {
      expect(S[`shop.item.${i.id}.name`], i.id).toBeTruthy();
      expect(S[`shop.item.${i.id}.desc`], i.id).toBeTruthy();
      if (i.kind === 'treat') expect(S[`shop.item.${i.id}.fact`], i.id).toBeTruthy();
    }
  });
});
