import { CAR, HOME } from '../content/life';
import { buyCar, buyHome, carValue, homeDeal, homeValue, moveOut, rentHome, sellCar, sellHome, toggleDrive, type LifeState } from '../core/Life';
import { t } from '../i18n';
import { h, iconButton } from './dom';

export type LifeTab = 'home' | 'car';

export interface LifeHooks {
  view(): { wallet: number; level: number; life: LifeState; day: number } | null;
  /** Commits a change: the new wallet and life state, a message for the player and concepts it teaches. */
  commit(wallet: number, life: LifeState, message: string, learn: string[]): void;
  onClose(): void;
}

/**
 * The big things: rent or buy a home (at the real estate agency) and buy an
 * electric car (at the mall). Each choice shows what you get and what you
 * give up, in numbers; all rules live in core/Life.
 */
export class LifeView {
  readonly el: HTMLDivElement;
  private panel: HTMLDivElement;
  private tab: LifeTab = 'home';
  private note = '';

  constructor(private hooks: LifeHooks) {
    this.panel = h('div', { class: 'modal-panel shop-panel life-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('life.kicker') });
    this.el = h('div', { class: 'modal shop-modal life-modal', hidden: true }, [this.panel]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(tab: LifeTab): void {
    this.tab = tab;
    this.note = '';
    this.el.hidden = false;
    this.draw();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.hooks.onClose();
  }

  private btn(label: string, onClick: () => void, disabled = false, primary = true): HTMLButtonElement {
    const b = h('button', { class: primary ? 'primary-btn' : 'secondary-btn', type: 'button', onclick: onClick }, [label]);
    b.disabled = disabled;
    return b;
  }

  private choice(title: string, facts: string, gain: string, cost: string, action: HTMLElement | null): HTMLElement {
    return h('div', { class: 'life-choice' }, [
      h('strong', { class: 'life-choice-title' }, [title]),
      h('p', { class: 'life-facts' }, [facts]),
      h('p', { class: 'decision-gain' }, [h('strong', {}, [`${t('life.gain')}: `]), gain]),
      h('p', { class: 'decision-cost' }, [h('strong', {}, [`${t('life.cost')}: `]), cost]),
      ...(action ? [h('div', { class: 'life-action' }, [action])] : []),
    ]);
  }

  private commit(wallet: number, life: LifeState, message: string, learn: string[]): void {
    this.note = message;
    this.hooks.commit(wallet, life, message, learn);
    this.draw();
  }

  private draw(): void {
    const v = this.hooks.view();
    if (!v) return;
    const body = this.tab === 'home' ? this.home(v) : this.car(v);
    this.panel.replaceChildren(
      iconButton('close', t('hud.close'), () => this.close(), 'modal-close'),
      h('div', { class: 'card-kicker' }, [h('span', { class: 'shop-kicker-icon', 'aria-hidden': 'true' }, [this.tab === 'home' ? '🏠' : '🚗']), t('life.kicker')]),
      h('h2', {}, [t(`life.${this.tab}.title`)]),
      h('div', { class: 'money-wallet' }, [h('span', { class: 'pc-coin', 'aria-hidden': 'true' }), t('life.wallet', { n: v.wallet })]),
      ...(this.note ? [h('div', { class: 'card-note life-note', role: 'status' }, [this.note])] : []),
      ...body,
      h('p', { class: 'shop-note' }, [t('life.billsNote')]),
      h('div', { class: 'card-actions shop-actions' }, [this.btn(t('dec.close'), () => this.close(), false, false)]),
    );
  }

  private home(v: { wallet: number; level: number; life: LifeState; day: number }): HTMLElement[] {
    const out: HTMLElement[] = [h('p', { class: 'card-body' }, [t('life.home.intro')])];
    if (v.level < HOME.minLevel) return [...out, h('p', { class: 'card-note' }, [`🔒 ${t('life.locked', { n: HOME.minLevel })}`])];
    const home = v.life.home;
    const deal = homeDeal();
    if (home?.kind === 'own') {
      const value = homeValue(home.price, home.since, v.day);
      const diff = value - home.price;
      out.push(
        h('div', { class: 'life-status' }, [
          h('p', {}, [t('life.home.owning', { value, owed: home.owed })]),
          h('p', { class: diff >= 0 ? 'up' : 'down' }, [t('life.home.change', { sign: diff >= 0 ? '+' : '', n: diff })]),
          home.owed === 0 ? h('p', {}, [t('life.home.paidOff')]) : null,
        ].filter((x): x is HTMLParagraphElement => !!x)),
      );
      const sold = sellHome(v.life, v.day)!;
      out.push(this.btn(t('life.home.sell', { n: sold.coins }), () => this.commit(v.wallet + sold.coins, sold.life, t('life.home.sold', { n: sold.coins }), ['mortgage']), false, false));
      return out;
    }
    if (home?.kind === 'rent') {
      out.push(h('div', { class: 'life-status' }, [h('p', {}, [t('life.home.renting', { n: HOME.rent.perDay })])]));
      out.push(this.btn(t('life.home.moveOut'), () => this.commit(v.wallet, moveOut(v.life), t('life.home.left'), []), false, false));
    } else {
      out.push(
        this.choice(
          t('life.home.rent'),
          t('life.home.rent.facts', { n: HOME.rent.perDay }),
          t('life.home.rent.gain'),
          t('life.home.rent.cost'),
          this.btn(t('life.home.doRent'), () => this.commit(v.wallet, rentHome(v.life, v.day), t('life.home.rented'), ['fixedCost', 'opportunityCost'])),
        ),
      );
    }
    const canBuyLevel = v.level >= HOME.buyLevel;
    const short = deal.down - v.wallet;
    const buy = canBuyLevel && short <= 0 ? buyHome(v.life, v.wallet, v.day) : null;
    out.push(
      this.choice(
        t('life.home.buy'),
        t('life.home.buy.facts', { price: deal.price, down: deal.down, loan: deal.loan, owed: deal.owed, perDay: deal.perDay, upkeep: HOME.upkeep }),
        t('life.home.buy.gain'),
        t('life.home.buy.cost'),
        !canBuyLevel
          ? h('span', { class: 'shop-note' }, [`🔒 ${t('life.home.buyNeed', { n: HOME.buyLevel })}`])
          : buy
            ? this.btn(t('life.home.doBuy', { n: deal.down }), () => this.commit(v.wallet - buy.cost, buy.life, t('life.home.bought'), ['mortgage', 'interest', 'netWorth']))
            : h('span', { class: 'shop-note' }, [t('life.home.needDown', { n: short })]),
      ),
    );
    return out;
  }

  private car(v: { wallet: number; level: number; life: LifeState; day: number }): HTMLElement[] {
    const out: HTMLElement[] = [h('p', { class: 'card-body' }, [t('life.car.intro')])];
    if (v.level < CAR.minLevel) return [...out, h('p', { class: 'card-note' }, [`🔒 ${t('life.locked', { n: CAR.minLevel })}`])];
    const car = v.life.car;
    if (car) {
      const value = carValue(car.price, car.since, v.day);
      out.push(h('div', { class: 'life-status' }, [h('p', {}, [t('life.car.owning', { value, price: car.price })])]));
      out.push(this.btn(car.drive ? t('life.car.park') : t('life.car.drive'), () => this.commit(v.wallet, toggleDrive(v.life), car.drive ? t('life.car.parked') : t('life.car.driving'), [])));
      const sold = sellCar(v.life, v.day)!;
      out.push(this.btn(t('life.car.sell', { n: sold.coins }), () => this.commit(v.wallet + sold.coins, sold.life, t('life.car.sold', { n: sold.coins }), ['depreciation']), false, false));
      return out;
    }
    const b = buyCar(v.life, v.wallet, v.day);
    out.push(
      this.choice(
        t('life.car.title'),
        t('life.car.facts', { price: CAR.price, perDay: CAR.perDay, drop: Math.round(CAR.drop * 1000) / 10 }),
        t('life.car.gain'),
        t('life.car.cost'),
        b
          ? this.btn(t('life.car.doBuy', { n: CAR.price }), () => this.commit(v.wallet - b.cost, b.life, t('life.car.bought'), ['depreciation', 'expenses']))
          : h('span', { class: 'shop-note' }, [t('life.car.need', { n: CAR.price - v.wallet })]),
      ),
    );
    return out;
  }
}
