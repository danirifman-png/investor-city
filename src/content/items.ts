/**
 * DATA: things the player can carry in the bag. Rewards only (no shop, no real
 * money). Text: `item.<id>.name` and `item.<id>.desc`.
 */
export const ITEM_IDS = ['mentorBadge', 'trailMap', 'piggyBank'] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export const ITEMS: Record<ItemId, { icon: string }> = {
  mentorBadge: { icon: '🦉' },
  trailMap: { icon: '🗺️' },
  piggyBank: { icon: '🐷' },
};

export function isItem(id: string): id is ItemId {
  return (ITEM_IDS as readonly string[]).includes(id);
}
