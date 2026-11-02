import { describe, expect, it } from 'vitest';
import { FAVOR_REWARD, FRIEND_LEVELS, FRIEND_MAX, FRIENDS } from '../src/content/friends';
import { TOWNSFOLK } from '../src/content/townsfolk';
import { canPresent, chat, finishFavor, friendLevel, giveGift, hasSecret, reachPlace, sanitizeFriends, startFavor, takePresent, toNextLevel, type FriendsState } from '../src/core/Friends';
import he from '../src/i18n/locales/he.friends.json';

describe('friends', () => {
  it('every walker in the city can be a friend, with all texts', () => {
    const dict = he as Record<string, string>;
    for (const { id } of TOWNSFOLK) {
      expect(FRIENDS[id]).toBeDefined();
      for (const k of ['name', 'role', 'gift', 'favor', 'favorDone', 'secret', 'present']) expect(dict[`friend.${id}.${k}`], `${id}.${k}`).toBeTruthy();
    }
  });

  it('levels follow the points', () => {
    expect(friendLevel(0)).toBe(0);
    expect(friendLevel(FRIEND_LEVELS[1])).toBe(1);
    expect(friendLevel(999)).toBe(FRIEND_MAX);
    expect(toNextLevel(0)).toBe(FRIEND_LEVELS[1]);
    expect(toNextLevel(999)).toBe(0);
  });

  it('a chat adds a point once a day', () => {
    let s: FriendsState = {};
    const a = chat(s, 'grandma', 3);
    expect(a.gained).toBe(1);
    s = a.state;
    expect(chat(s, 'grandma', 3).gained).toBe(0);
    expect(chat(s, 'grandma', 4).gained).toBe(1);
  });

  it('a gift costs coins and counts once a day', () => {
    const price = FRIENDS.grandma.gift.price;
    expect(giveGift({}, 'grandma', price - 1, 1)).toBeNull();
    const g = giveGift({}, 'grandma', price, 1)!;
    expect(g.cost).toBe(price);
    expect(g.gained).toBe(3);
    expect(giveGift(g.state, 'grandma', 100, 1)).toBeNull();
    expect(giveGift(g.state, 'grandma', 100, 2)).not.toBeNull();
  });

  it('a favour: take it, reach the place, report back', () => {
    let s = startFavor({}, 'nurse');
    expect(s.nurse.favor).toBe('active');
    expect(finishFavor(s, 'nurse')).toBeNull();
    expect(reachPlace(s, 'bank').ready).toEqual([]);
    const r = reachPlace(s, FRIENDS.nurse.favor.poi);
    expect(r.ready).toEqual(['nurse']);
    s = r.state;
    const f = finishFavor(s, 'nurse')!;
    expect(f.coins).toBe(FAVOR_REWARD.coins);
    expect(f.state.nurse.favor).toBe('done');
    expect(startFavor(f.state, 'nurse')).toBe(f.state);
  });

  it('secret and the once-only best-friend present', () => {
    const top: FriendsState = { jogger: { points: 99, chatDay: 0, giftDay: 0, favor: 'done', present: false } };
    expect(hasSecret(top.jogger)).toBe(true);
    expect(canPresent(top.jogger)).toBe(true);
    const s = takePresent(top, 'jogger')!;
    expect(takePresent(s, 'jogger')).toBeNull();
    expect(hasSecret({ points: 0, chatDay: -1, giftDay: -1, favor: 'none', present: false })).toBe(false);
  });

  it('a level up is reported', () => {
    const s: FriendsState = { baker: { points: FRIEND_LEVELS[1] - 1, chatDay: 0, giftDay: 0, favor: 'none', present: false } };
    expect(chat(s, 'baker', 1).levelUp).toBe(1);
  });

  it('saves are cleaned', () => {
    expect(sanitizeFriends(null)).toEqual({});
    const s = sanitizeFriends({ grandma: { points: 4.7, favor: 'weird', present: 'yes' }, nobody: { points: 3 } });
    expect(Object.keys(s)).toEqual(['grandma']);
    expect(s.grandma).toEqual({ points: 4, chatDay: -1, giftDay: -1, favor: 'none', present: false });
  });
});
