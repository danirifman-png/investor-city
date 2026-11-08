import he from './locales/he.json';
import heDialogue from './locales/he.dialogue.json';
import heLearn from './locales/he.learn.json';
import heQuests from './locales/he.quests.json';
import heMissions from './locales/he.missions.json';
import heShop from './locales/he.shop.json';
import heTown from './locales/he.town.json';
import heDecisions from './locales/he.decisions.json';
import heLife from './locales/he.life.json';
import heFriends from './locales/he.friends.json';
import heTreasure from './locales/he.treasure.json';
import heService from './locales/he.service.json';
import heJobs from './locales/he.jobs.json';
import heAlbum from './locales/he.album.json';
import heTravel from './locales/he.travel.json';

/**
 * Minimal localization layer. All player-facing strings live in
 * `locales/<lang>.json` (and `<lang>.dialogue.json` for conversations); code
 * only references keys. Adding a language means
 * adding a JSON file and registering it here.
 */
type Dictionary = Record<string, string>;

const LOCALES: Record<string, { dict: Dictionary; dir: 'rtl' | 'ltr' }> = {
  // conversations and learning content (missions, concepts, curiosities) are kept
  // in their own files so writers can work on them separately
  he: { dict: { ...(he as Dictionary), ...(heDialogue as Dictionary), ...(heLearn as Dictionary), ...(heQuests as Dictionary), ...(heMissions as Dictionary), ...(heShop as Dictionary), ...(heTown as Dictionary), ...(heDecisions as Dictionary), ...(heLife as Dictionary), ...(heFriends as Dictionary), ...(heTreasure as Dictionary), ...(heService as Dictionary), ...(heJobs as Dictionary), ...(heAlbum as Dictionary), ...(heTravel as Dictionary) }, dir: 'rtl' },
};

let current = 'he';

export function setLocale(lang: string): void {
  if (!LOCALES[lang]) throw new Error(`Unknown locale: ${lang}`);
  current = lang;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = LOCALES[lang].dir;
  }
}

export function getDirection(): 'rtl' | 'ltr' {
  return LOCALES[current].dir;
}

/** Translate a key; `{name}` placeholders are filled from `vars`. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const value = LOCALES[current].dict[key];
  if (value === undefined) {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

export function hasKey(key: string, lang = current): boolean {
  return LOCALES[lang]?.dict[key] !== undefined;
}
