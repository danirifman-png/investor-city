import { friendLevel } from './Friends';
import type { SaveData } from './Save';
import { treasureDone } from './Treasure';

/**
 * The album of moments: the first time something real happens in the
 * player's city life (a first shift, a first share, a home of their own).
 * Moments are read from the saved state, so nothing else has to report them,
 * and each one keeps the day it happened. No rewards: it is a keepsake.
 */

export const MOMENT_IDS = [
  'biz_day',
  'biz_profit',
  'pizza',
  'shift',
  'jobs3',
  'saving',
  'interest',
  'share',
  'friend',
  'best_friend',
  'home',
  'car',
  'treasure',
  'walker',
] as const;
export type MomentId = (typeof MOMENT_IDS)[number];

/** Moment id → the day index it happened. */
export type Album = Partial<Record<MomentId, number>>;

type AlbumSource = Pick<SaveData, 'missions' | 'jobs' | 'money' | 'friends' | 'life' | 'treasure' | 'progress'>;

const TESTS: Record<MomentId, (d: AlbumSource) => boolean> = {
  biz_day: (d) => d.missions.business.days > 0,
  biz_profit: (d) => d.missions.business.bestDay > 0,
  pizza: (d) => d.missions.pizzaShop.days > 0,
  shift: (d) => Object.values(d.jobs).some((j) => j.shifts > 0),
  jobs3: (d) => Object.values(d.jobs).filter((j) => j.shifts > 0).length >= 3,
  saving: (d) => d.money.savings.balance >= 1,
  interest: (d) => d.money.savings.interest >= 1,
  share: (d) => Object.values(d.money.portfolio.shares).some((n) => (n ?? 0) > 0) || d.money.portfolio.realized !== 0,
  friend: (d) => Object.values(d.friends).some((f) => friendLevel(f.points) >= 1),
  best_friend: (d) => Object.values(d.friends).some((f) => friendLevel(f.points) >= 5),
  home: (d) => !!d.life.home,
  car: (d) => !!d.life.car,
  treasure: (d) => treasureDone(d.treasure),
  walker: (d) => d.progress.metresWalked >= 5000,
};

/** The moments reached that are not in the album yet. */
export function newMoments(album: Album, d: AlbumSource): MomentId[] {
  return MOMENT_IDS.filter((id) => album[id] === undefined && TESTS[id](d));
}

export function addMoments(album: Album, ids: MomentId[], day: number): Album {
  const out = { ...album };
  for (const id of ids) out[id] ??= day;
  return out;
}

export function sanitizeAlbum(v: unknown): Album {
  const out: Album = {};
  if (!v || typeof v !== 'object') return out;
  for (const id of MOMENT_IDS) {
    const day = (v as Record<string, unknown>)[id];
    if (typeof day === 'number' && Number.isFinite(day)) out[id] = Math.max(-1, Math.min(1e6, Math.round(day)));
  }
  return out;
}
