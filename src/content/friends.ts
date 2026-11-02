/**
 * DATA: making friends with the people who walk around the city
 * (content/townsfolk). Each one has a favourite small gift and one favour to
 * ask; text lives in he.friends.json under `friend.<id>.*`. Rules live in
 * core/Friends.
 *
 * Nothing here punishes a missed day: points only go up, a day away costs
 * nothing, and the daily chat and gift are simply once a day.
 */

export interface FriendDef {
  /** A favourite small gift the player can buy for them (coins are the game score). */
  gift: { icon: string; price: number };
  /** The favour: go to a place in the city (a POI key) and come back. */
  favor: { poi: string };
  /** Grammatical gender for Hebrew sentences about them. */
  f?: true;
}

export const FRIENDS: Record<string, FriendDef> = {
  grandma: { f: true, gift: { icon: '💐', price: 4 }, favor: { poi: 'pharmacy' } },
  grandpa: { gift: { icon: '📰', price: 2 }, favor: { poi: 'bank' } },
  baker: { gift: { icon: '🧂', price: 3 }, favor: { poi: 'market' } },
  mail_carrier: { f: true, gift: { icon: '🧃', price: 3 }, favor: { poi: 'warehouses' } },
  officer: { gift: { icon: '☕', price: 3 }, favor: { poi: 'fountain' } },
  nurse: { f: true, gift: { icon: '🍎', price: 2 }, favor: { poi: 'hospital' } },
  gardener: { f: true, gift: { icon: '🌱', price: 3 }, favor: { poi: 'solarField' } },
  teen_girl: { f: true, gift: { icon: '🎧', price: 5 }, favor: { poi: 'mall' } },
  jogger: { gift: { icon: '💧', price: 1 }, favor: { poi: 'fitness' } },
  musician: { gift: { icon: '🎸', price: 5 }, favor: { poi: 'cafe' } },
};

/** Points needed for each friendship level (0 = just met, 5 = best friends). */
export const FRIEND_LEVELS = [0, 2, 5, 9, 14, 20];
export const FRIEND_MAX = FRIEND_LEVELS.length - 1;

export const FRIEND_POINTS = {
  /** The first chat of the day. */
  chat: 1,
  /** A gift (once a day). */
  gift: 3,
  /** A favour done. */
  favor: 4,
};

/** Coins and XP for a favour. */
export const FAVOR_REWARD = { coins: 12, xp: 40 };
/** From this level a friend tells you a secret about the city. */
export const SECRET_LEVEL = 3;
/** Best friends give a thank-you present, once. */
export const BEST_GIFT = { coins: 30, xp: 120 };
