import { FAVOR_REWARD, FRIEND_LEVELS, FRIEND_MAX, FRIEND_POINTS, FRIENDS, SECRET_LEVEL } from '../content/friends';

/**
 * Rules for friendships with the people walking around the city: points from
 * a daily chat, a gift and a favour, the level they add up to, and the secret
 * and present that come with it. Pure logic with no DOM.
 */

export type FavorState = 'none' | 'active' | 'ready' | 'done';

export interface Friend {
  points: number;
  /** The last day of a chat and of a gift (each counts once a day). */
  chatDay: number;
  giftDay: number;
  favor: FavorState;
  /** The best-friend present was given. */
  present: boolean;
}

export type FriendsState = Record<string, Friend>;

export const newFriend = (): Friend => ({ points: 0, chatDay: -1, giftDay: -1, favor: 'none', present: false });

export function friendOf(s: FriendsState, id: string): Friend {
  return s[id] ?? newFriend();
}

export function friendLevel(points: number): number {
  let lvl = 0;
  for (let i = 0; i <= FRIEND_MAX; i++) if (points >= FRIEND_LEVELS[i]) lvl = i;
  return lvl;
}

/** Points still needed for the next level (0 at the top). */
export function toNextLevel(points: number): number {
  const lvl = friendLevel(points);
  return lvl >= FRIEND_MAX ? 0 : FRIEND_LEVELS[lvl + 1] - points;
}

export const hasSecret = (f: Friend): boolean => friendLevel(f.points) >= SECRET_LEVEL;
export const canPresent = (f: Friend): boolean => friendLevel(f.points) >= FRIEND_MAX && !f.present;

export interface FriendChange {
  state: FriendsState;
  /** Points added. */
  gained: number;
  /** The new level when it went up. */
  levelUp: number | null;
}

function add(s: FriendsState, id: string, f: Friend, gained: number): FriendChange {
  const before = friendLevel(friendOf(s, id).points);
  const after = friendLevel(f.points + gained);
  return { state: { ...s, [id]: { ...f, points: f.points + gained } }, gained, levelUp: after > before ? after : null };
}

/** A chat: the first one of the day adds a point; later ones are just nice. */
export function chat(s: FriendsState, id: string, day: number): FriendChange {
  const f = friendOf(s, id);
  if (f.chatDay === day) return { state: s[id] ? s : { ...s, [id]: f }, gained: 0, levelUp: null };
  return add(s, id, { ...f, chatDay: day }, FRIEND_POINTS.chat);
}

/** Gives the friend's favourite gift (once a day). Null when it can't be given. */
export function giveGift(s: FriendsState, id: string, wallet: number, day: number): (FriendChange & { cost: number }) | null {
  const def = FRIENDS[id];
  const f = friendOf(s, id);
  if (!def || f.giftDay === day || wallet < def.gift.price) return null;
  return { ...add(s, id, { ...f, giftDay: day }, FRIEND_POINTS.gift), cost: def.gift.price };
}

/** Takes on the friend's favour . */
export function startFavor(s: FriendsState, id: string): FriendsState {
  const f = friendOf(s, id);
  if (!FRIENDS[id] || f.favor !== 'none') return s;
  return { ...s, [id]: { ...f, favor: 'active' } };
}

/** The player reached a place: favours that wanted it are now ready to report. */
export function reachPlace(s: FriendsState, poi: string): { state: FriendsState; ready: string[] } {
  const ready = Object.keys(s).filter((id) => s[id].favor === 'active' && FRIENDS[id]?.favor.poi === poi);
  if (!ready.length) return { state: s, ready };
  const out = { ...s };
  for (const id of ready) out[id] = { ...out[id], favor: 'ready' };
  return { state: out, ready };
}

/** Reports a ready favour back to the friend. */
export function finishFavor(s: FriendsState, id: string): (FriendChange & { coins: number; xp: number }) | null {
  const f = friendOf(s, id);
  if (f.favor !== 'ready') return null;
  return { ...add(s, id, { ...f, favor: 'done' }, FRIEND_POINTS.favor), ...FAVOR_REWARD };
}

/** The once-only best-friend present. */
export function takePresent(s: FriendsState, id: string): FriendsState | null {
  const f = friendOf(s, id);
  if (!canPresent(f)) return null;
  return { ...s, [id]: { ...f, present: true } };
}

export function friendCount(s: FriendsState, minLevel = 1): number {
  return Object.values(s).filter((f) => friendLevel(f.points) >= minLevel).length;
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const FAVORS: FavorState[] = ['none', 'active', 'ready', 'done'];

export function sanitizeFriends(raw: unknown): FriendsState {
  const out: FriendsState = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!FRIENDS[id] || !v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    out[id] = {
      points: Math.max(0, Math.floor(num(r.points, 0))),
      chatDay: Math.floor(num(r.chatDay, -1)),
      giftDay: Math.floor(num(r.giftDay, -1)),
      favor: FAVORS.includes(r.favor as FavorState) ? (r.favor as FavorState) : 'none',
      present: r.present === true,
    };
  }
  return out;
}
