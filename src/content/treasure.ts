/**
 * DATA: the founder's treasure, the city's big mystery. Seven pieces of an old
 * map lead from the plaza across the city to a vault under the bank. Each
 * piece tells where the next one is (`treasure.<id>.*` in he.treasure.json),
 * and the guide footprints show the way. Rules live in core/Treasure.
 *
 * Kinds:
 * - `free`: a glowing scroll on the ground; walking into it picks it up.
 * - `chest`: a locked chest with a coin lock; the coins come back with more.
 * - `friend`: someone in the street found it and hands it over once you are friends.
 * - `vault`: the end. Opens with all seven pieces.
 */

export type TreasureAt = { x: number; z: number } | { poi: string; dx: number; dz: number };

export interface TreasureStep {
  id: string;
  kind: 'free' | 'chest' | 'friend' | 'vault';
  at?: TreasureAt;
  /** chest: coins to open it. */
  price?: number;
  /** What is inside besides the piece. */
  coins?: number;
  xp?: number;
}

export const TREASURE: TreasureStep[] = [
  { id: 'plaza', kind: 'free', at: { x: 3.2, z: 12.5 }, xp: 30 },
  { id: 'fountain', kind: 'chest', at: { poi: 'fountain', dx: 3.5, dz: 9 }, price: 10, coins: 22, xp: 50 },
  { id: 'friend', kind: 'friend', xp: 50 },
  { id: 'news', kind: 'free', at: { poi: 'newsTower', dx: 3.5, dz: 8 }, coins: 5, xp: 60 },
  { id: 'hospital', kind: 'free', at: { poi: 'hospital', dx: 3, dz: 12 }, coins: 5, xp: 60 },
  { id: 'mall', kind: 'free', at: { poi: 'mall', dx: -4, dz: 12 }, coins: 5, xp: 60 },
  { id: 'tree', kind: 'free', at: { poi: 'solarField', dx: 3, dz: 13 }, coins: 5, xp: 80 },
  { id: 'vault', kind: 'vault', at: { poi: 'bank', dx: -4.5, dz: 10 }, coins: 150, xp: 500 },
];

/** Map pieces (every step but the vault). */
export const TREASURE_PIECES = TREASURE.filter((s) => s.kind !== 'vault').length;
/** The friendship level (hearts) at which a friend hands over their piece. */
export const TREASURE_FRIEND_LEVEL = 1;
