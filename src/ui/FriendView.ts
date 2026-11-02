import { FRIEND_MAX, FRIENDS } from '../content/friends';
import { canPresent, friendLevel, hasSecret, toNextLevel, type Friend } from '../core/Friends';
import { t } from '../i18n';
import { h, iconButton } from './dom';

export type FriendAction = 'chat' | 'gift' | 'favorTake' | 'favorReport' | 'present';

export interface FriendHooks {
  view(id: string): { friend: Friend; wallet: number; day: number; place: string } | null;
  /** Does the action; returns what the friend says back (or null when nothing happened). */
  act(id: string, a: FriendAction): string | null;
  onClose(): void;
}

/** A word in the right grammatical gender: `key` or `keyF`. */
export const gendered = (id: string, key: string, vars?: Record<string, string | number>): string => t(FRIENDS[id]?.f ? `${key}F` : key, vars);

/**
 * Talking to someone walking around the city: hearts that grow with a daily
 * chat, a small gift and a favour, a secret about the city at "good friends",
 * and a thank-you present for best friends.
 */
export class FriendView {
  readonly el: HTMLDivElement;
  private panel: HTMLDivElement;
  private id = '';
  private say = '';

  constructor(private hooks: FriendHooks) {
    this.panel = h('div', { class: 'modal-panel friend-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('friend.kicker') });
    this.el = h('div', { class: 'modal friend-modal', hidden: true, onclick: (e: Event) => e.target === this.el && this.close() }, [this.panel]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  get who(): string | null {
    return this.open ? this.id : null;
  }

  show(id: string): void {
    this.id = id;
    this.say = t(`friend.${id}.hello`);
    this.el.hidden = false;
    this.draw();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.hooks.onClose();
  }

  private do(a: FriendAction): void {
    const said = this.hooks.act(this.id, a);
    if (said) this.say = said;
    this.draw();
  }

  private btn(label: string, a: FriendAction, disabled = false, primary = false): HTMLButtonElement {
    const b = h('button', { class: `${primary ? 'primary-btn' : 'secondary-btn'} friend-${a}`, type: 'button', onclick: () => this.do(a) }, [label]);
    b.disabled = disabled;
    return b;
  }

  draw(): void {
    const v = this.hooks.view(this.id);
    const def = FRIENDS[this.id];
    if (!v || !def) return;
    const { friend: f, wallet, day, place } = v;
    const id = this.id;
    const level = friendLevel(f.points);
    const next = toNextLevel(f.points);
    const hearts = h('div', { class: 'friend-hearts', 'aria-label': t(`friend.level.${level}`) }, [
      ...Array.from({ length: FRIEND_MAX }, (_, i) => h('i', { class: i < level ? 'on' : '' }, [i < level ? '❤' : '♡'])),
      h('span', {}, [t(`friend.level.${level}`)]),
    ]);
    const name = t(`friend.${id}.name`);

    const giftShort = def.gift.price - wallet;
    const actions = h('div', { class: 'friend-actions' }, [
      this.btn(t('friend.chat'), 'chat', false, f.chatDay !== day),
      this.btn(t('friend.giftBtn', { icon: def.gift.icon, n: def.gift.price }), 'gift', f.giftDay === day || giftShort > 0),
    ]);
    const giftNote = f.giftDay === day ? t('friend.giftToday') : giftShort > 0 ? t('friend.giftShort', { n: giftShort }) : `${def.gift.icon} ${t(`friend.${id}.gift`)}`;

    const favor = h('section', { class: `friend-box friend-favor ${f.favor}` }, [
      h('strong', {}, [t('friend.favorTitle')]),
      f.favor === 'done'
        ? h('p', {}, [`✅ ${t(`friend.${id}.favorDone`)}`])
        : h('p', {}, [t(`friend.${id}.favor`)]),
      ...(f.favor === 'none' ? [this.btn(t('friend.favorTake'), 'favorTake', false, true)] : []),
      ...(f.favor === 'active' ? [h('span', { class: 'friend-status' }, [`📍 ${t('friend.favorActive', { place })}`])] : []),
      ...(f.favor === 'ready' ? [this.btn(t('friend.favorReport'), 'favorReport', false, true)] : []),
    ]);

    const secret = h('section', { class: `friend-box friend-secret ${hasSecret(f) ? 'open' : 'locked'}` }, [
      h('strong', {}, [t('friend.secretTitle')]),
      h('p', {}, [hasSecret(f) ? t(`friend.${id}.secret`) : gendered(id, 'friend.secretLocked', { name })]),
    ]);

    this.panel.replaceChildren(
      iconButton('close', t('hud.close'), () => this.close(), 'modal-close'),
      h('div', { class: 'card-kicker' }, [h('span', { class: 'shop-kicker-icon', 'aria-hidden': 'true' }, ['💛']), t('friend.kicker')]),
      h('h2', {}, [name]),
      h('em', { class: 'friend-role' }, [t(`friend.${id}.role`)]),
      hearts,
      h('p', { class: 'friend-next' }, [next ? t('friend.next', { n: next }) : t('friend.top')]),
      h('div', { class: 'friend-say', role: 'status' }, [this.say]),
      actions,
      h('p', { class: 'shop-note friend-gift-note' }, [giftNote]),
      ...(canPresent(f) ? [h('div', { class: 'friend-present' }, [this.btn(t('friend.presentBtn'), 'present', false, true)])] : []),
      favor,
      secret,
      h('p', { class: 'shop-note' }, [t('friend.money')]),
      h('div', { class: 'card-actions' }, [h('button', { class: 'secondary-btn', type: 'button', onclick: () => this.close() }, [t('friend.close')])]),
    );
  }
}
