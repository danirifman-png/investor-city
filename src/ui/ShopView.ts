import { SHOP_BY_ID, SHOP_CATEGORIES, SHOP_ITEMS, type ShopCategory, type ShopItem } from '../content/shop';
import { dayKey } from '../core/Business';
import { buy, canBuy, sell, sellPrice, toggleEquip, type ShopState } from '../core/Shop';
import { t } from '../i18n';
import { h, iconButton } from './dom';

export interface ShopHooks {
  view(): { wallet: number; level: number; shop: ShopState } | null;
  /** Commits a change; `bought` / `sold` name the item for effects and lessons. */
  commit(wallet: number, shop: ShopState, change: { bought?: string; sold?: string; equip?: string }): void;
  onClose(): void;
  /** Opens the car lot (cars are bought with their running costs, see LifeView). */
  onCarLot?(): void;
}

const CAT_ICON: Record<ShopCategory, string> = { food: '🍦', clothes: '👕', rides: '🛹', pets: '🐶', fun: '🎈' };

/**
 * The city mall: tabs per category, a card per item with its price, whether
 * it is a need or a want, and how far the player is from affording it.
 * Bought things are put on at once; kept things can be sold back for less.
 */
export class ShopView {
  readonly el: HTMLDivElement;
  private panel: HTMLDivElement;
  private tab: ShopCategory = 'food';

  constructor(private hooks: ShopHooks) {
    this.panel = h('div', { class: 'modal-panel shop-panel store-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('store.title') });
    this.el = h('div', { class: 'modal shop-modal store-modal', hidden: true }, [this.panel]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(tab: ShopCategory = this.tab): void {
    this.tab = tab;
    this.el.hidden = false;
    this.draw();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.hooks.onClose();
  }

  private draw(): void {
    const v = this.hooks.view();
    if (!v) return;
    const tabs = h(
      'div',
      { class: 'money-tabs store-tabs', role: 'tablist' },
      SHOP_CATEGORIES.map((id) =>
        h('button', { class: 'money-tab', type: 'button', role: 'tab', 'aria-selected': String(id === this.tab), 'data-tab': id, onclick: () => ((this.tab = id), this.draw()) }, [
          `${CAT_ICON[id]} ${t(`store.cat.${id}`)}`,
        ]),
      ),
    );
    const wallet = h('div', { class: 'money-wallet' }, [h('span', { class: 'pc-coin', 'aria-hidden': 'true' }), t('money.wallet', { n: v.wallet })]);
    const items = SHOP_ITEMS.filter((i) => i.category === this.tab);
    this.panel.replaceChildren(
      iconButton('close', t('hud.close'), () => this.close(), 'modal-close'),
      h('div', { class: 'card-kicker' }, [h('span', { class: 'shop-kicker-icon', 'aria-hidden': 'true' }, ['🛍️']), t('store.kicker')]),
      h('h2', {}, [t('store.title')]),
      tabs,
      wallet,
      h('p', { class: 'card-body store-tip' }, [t(`store.tip.${this.tab}`)]),
      ...(this.tab === 'rides' && this.hooks.onCarLot
        ? [h('button', { class: 'mission-tier decision-card car-lot', type: 'button', onclick: () => this.hooks.onCarLot?.() }, [
            h('span', { class: 'mission-tier-badge', 'aria-hidden': 'true' }, ['🚗']),
            h('div', { class: 'mission-tier-text' }, [h('small', {}, [t('store.carLot')]), h('strong', {}, [t('life.car.title')]), h('span', {}, [t('store.carLotNote')])]),
          ])]
        : []),
      h('div', { class: 'store-grid' }, items.map((i) => this.card(i, v.wallet, v.level, v.shop))),
    );
  }

  private card(item: ShopItem, wallet: number, level: number, shop: ShopState): HTMLElement {
    const check = canBuy(shop, item, level, wallet);
    const owned = shop.owned.includes(item.id);
    const worn = item.slot ? shop.equipped[item.slot] === item.id : false;
    const actions: HTMLElement[] = [];
    if (owned) {
      actions.push(
        h('button', { class: 'shop-price', type: 'button', onclick: () => (this.hooks.commit(wallet, toggleEquip(shop, item.id), { equip: item.id }), this.draw()) }, [
          worn ? t('store.takeOff') : t('store.putOn'),
        ]),
      );
      actions.push(
        h('button', { class: 'shop-price ghost', type: 'button', onclick: () => this.doSell(item, wallet, shop) }, [t('store.sell', { n: sellPrice(item) })]),
      );
    } else {
      const b = h('button', { class: 'shop-price', type: 'button', onclick: () => this.doBuy(item, wallet, level, shop) }, [t('store.buy', { n: item.price })]);
      b.disabled = check !== 'ok';
      actions.push(b);
    }
    let status = '';
    if (check === 'level') status = t('store.needLevel', { n: item.level });
    else if (check === 'coins') status = t('store.missing', { n: item.price - wallet });
    else if (owned) status = worn ? t('store.wearing') : t('store.owned');
    const progress =
      check === 'coins'
        ? h('div', { class: 'store-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(item.price), 'aria-valuenow': String(wallet) }, [
            h('span', { style: { width: `${Math.round((wallet / item.price) * 100)}%` } }),
          ])
        : null;
    const extra: string[] = [];
    if (item.speed) extra.push(t('store.speed', { pct: Math.round((item.speed - 1) * 100) }));
    if (item.upkeep) extra.push(t('store.upkeep', { n: item.upkeep }));
    if (item.sameAs) extra.push(t('store.sameAs', { name: t(`shop.item.${item.sameAs}.name`), n: SHOP_BY_ID[item.sameAs].price }));
    return h('div', { class: `store-card${check === 'level' ? ' locked' : ''}`, 'data-item': item.id }, [
      h('div', { class: 'store-icon', 'aria-hidden': 'true' }, [check === 'level' ? '🔒' : item.icon]),
      h('div', { class: 'store-info' }, [
        h('strong', {}, [t(`shop.item.${item.id}.name`)]),
        h('span', { class: `store-tag ${item.need ? 'need' : 'want'}` }, [item.need ? t('store.need') : t('store.want')]),
        h('p', {}, [t(`shop.item.${item.id}.desc`)]),
        ...extra.map((x) => h('p', { class: 'store-extra' }, [x])),
        status ? h('p', { class: 'store-status' }, [status]) : null,
        progress,
      ]),
      h('div', { class: 'store-actions' }, actions),
    ]);
  }

  private doBuy(item: ShopItem, wallet: number, level: number, shop: ShopState): void {
    const today = dayKey(new Date());
    const r = buy(shop, item.id, level, wallet, today);
    if (!r.spent) return;
    this.hooks.commit(wallet - r.spent, r.shop, { bought: item.id });
    this.draw();
  }

  private doSell(item: ShopItem, wallet: number, shop: ShopState): void {
    const r = sell(shop, item.id);
    if (!r.coins) return;
    this.hooks.commit(wallet + r.coins, r.shop, { sold: item.id });
    this.draw();
  }
}
