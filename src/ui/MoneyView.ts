import { dayKey } from '../core/Business';
import {
  accrue,
  buy,
  COMPANIES,
  COMPANY_IDS,
  deposit,
  grow,
  history,
  portfolioValue,
  SAVINGS_RATE,
  sell,
  spread,
  withdraw,
  type CompanyId,
  type MoneyState,
} from '../core/Money';
import { t } from '../i18n';
import { h, iconButton } from './dom';

export interface MoneyHooks {
  /** The player's coins and money state (live objects owned by the save). */
  view(): { wallet: number; money: MoneyState } | null;
  /** Commits a change: the new wallet and money state. `learn` names concepts the action teaches. */
  commit(wallet: number, money: MoneyState, learn: string[]): void;
  onClose(): void;
}

export type MoneyTab = 'savings' | 'shares';

const COMPANY_ICON: Record<CompanyId, string> = { marco: '🍕', wind: '🌬️', startup: '🚀', bank: '🏦', builder: '🏗️' };

/** A small line chart of recent prices, coloured by whether the price went up. */
function sparkline(values: number[]): SVGSVGElement {
  const w = 96;
  const hgt = 30;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1, hi - lo);
  const pts = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * w).toFixed(1)},${(hgt - 3 - ((v - lo) / span) * (hgt - 6)).toFixed(1)}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
  svg.setAttribute('class', `spark ${up ? 'up' : 'down'}`);
  svg.setAttribute('aria-hidden', 'true');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', pts);
  svg.appendChild(line);
  return svg;
}

/**
 * The money panel: a savings account at the city bank and shares in the
 * city's companies. Prices change once a day; all rules live in core/Money.
 */
export class MoneyView {
  readonly el: HTMLDivElement;
  private panel: HTMLDivElement;
  private tab: MoneyTab = 'savings';

  constructor(private hooks: MoneyHooks) {
    this.panel = h('div', { class: 'modal-panel shop-panel money-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('money.title') });
    this.el = h('div', { class: 'modal shop-modal money-modal', hidden: true }, [this.panel]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(tab: MoneyTab = this.tab): void {
    this.tab = tab;
    this.el.hidden = false;
    this.draw();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.hooks.onClose();
  }

  private today(): string {
    return dayKey(new Date());
  }

  private draw(): void {
    const v = this.hooks.view();
    if (!v) return;
    const tabs = h(
      'div',
      { class: 'money-tabs', role: 'tablist' },
      (['savings', 'shares'] as MoneyTab[]).map((id) =>
        h('button', { class: 'money-tab', type: 'button', role: 'tab', 'aria-selected': String(id === this.tab), 'data-tab': id, onclick: () => ((this.tab = id), this.draw()) }, [t(`money.tab.${id}`)]),
      ),
    );
    const wallet = h('div', { class: 'money-wallet' }, [h('span', { class: 'pc-coin', 'aria-hidden': 'true' }), t('money.wallet', { n: v.wallet })]);
    const body = this.tab === 'savings' ? this.savings(v.wallet, v.money) : this.shares(v.wallet, v.money);
    this.panel.replaceChildren(
      iconButton('close', t('hud.close'), () => this.close(), 'modal-close'),
      h('div', { class: 'card-kicker' }, [h('span', { class: 'shop-kicker-icon', 'aria-hidden': 'true' }, ['💰']), t('money.kicker')]),
      h('h2', {}, [t('money.title')]),
      tabs,
      wallet,
      ...body,
    );
  }

  private btn(label: string, onClick: () => void, disabled = false, cls = 'shop-price'): HTMLButtonElement {
    const b = h('button', { class: cls, type: 'button', onclick: onClick }, [label]);
    b.disabled = disabled;
    return b;
  }

  /* ------------------------------ savings ---------------------------- */

  private savings(wallet: number, money: MoneyState): HTMLElement[] {
    const today = this.today();
    const s = accrue(money.savings, today).savings;
    const bal = Math.floor(s.balance);
    const dep = (n: number) => {
      const a = Math.min(wallet, n);
      if (a <= 0) return;
      this.hooks.commit(wallet - a, { ...money, savings: deposit(money.savings, a, today) }, ['savings', 'interest']);
      this.draw();
    };
    const out = (n: number) => {
      const w = withdraw(money.savings, n, today);
      if (w.coins <= 0) return;
      this.hooks.commit(wallet + w.coins, { ...money, savings: w.savings }, []);
      this.draw();
    };
    const table = h('div', { class: 'shop-table' }, [
      this.line(t('money.balance'), t('shop.coins', { n: bal }), 'plus'),
      this.line(t('money.rate'), t('money.rateValue', { pct: Math.round(SAVINGS_RATE * 100) })),
      this.line(t('money.earned'), t('shop.coins', { n: Math.floor(s.interest) })),
    ]);
    const base = Math.max(bal, 100);
    const future = h('div', { class: 'shop-cost money-future' }, [
      h('strong', {}, [t('money.futureTitle', { n: base })]),
      h('span', {}, [t('money.future', { d7: Math.floor(grow(base, 7)), d30: Math.floor(grow(base, 30)) })]),
    ]);
    return [
      h('p', { class: 'card-body' }, [t('money.savingsIntro')]),
      table,
      future,
      h('div', { class: 'shop-row' }, [
        h('span', { class: 'shop-label' }, [t('money.deposit')]),
        h('div', { class: 'shop-prices' }, [this.btn('10', () => dep(10), wallet < 1), this.btn('50', () => dep(50), wallet < 1), this.btn(t('money.all'), () => dep(wallet), wallet < 1)]),
      ]),
      h('div', { class: 'shop-row' }, [
        h('span', { class: 'shop-label' }, [t('money.withdraw')]),
        h('div', { class: 'shop-prices' }, [this.btn('10', () => out(10), bal < 1), this.btn(t('money.all'), () => out(bal), bal < 1)]),
      ]),
      h('p', { class: 'shop-note' }, [t('money.savingsNote')]),
    ];
  }

  /* ------------------------------ shares ----------------------------- */

  private shares(wallet: number, money: MoneyState): HTMLElement[] {
    const today = this.today();
    const p = money.portfolio;
    const rows = COMPANY_IDS.map((id) => {
      const hist = history(id, today, 14);
      const price = hist[hist.length - 1];
      const prev = hist[hist.length - 2] ?? price;
      const ch = prev ? Math.round(((price - prev) / prev) * 1000) / 10 : 0;
      const held = p.shares[id] ?? 0;
      const paid = p.paid[id] ?? 0;
      const gain = held * price - paid;
      const doBuy = () => {
        const b = buy(p, id, 1, wallet, today);
        if (!b.cost) return;
        const learn = ['shares', 'risk'];
        if (spread(b.portfolio) >= 3) learn.push('diversification');
        this.hooks.commit(wallet - b.cost, { ...money, portfolio: b.portfolio }, learn);
        this.draw();
      };
      const doSell = () => {
        const s = sell(p, id, 1, today);
        if (!s.coins) return;
        this.hooks.commit(wallet + s.coins, { ...money, portfolio: s.portfolio }, ['profit']);
        this.draw();
      };
      return h('div', { class: 'stock', 'data-company': id }, [
        h('div', { class: 'stock-head' }, [
          h('span', { class: 'stock-icon', 'aria-hidden': 'true' }, [COMPANY_ICON[id]]),
          h('div', { class: 'stock-name' }, [
            h('strong', {}, [t(`company.${id}`)]),
            h('span', { class: 'stock-risk', 'aria-label': t('money.risk', { n: COMPANIES[id].risk }) }, [t('money.riskShort') + ' ' + '●'.repeat(COMPANIES[id].risk) + '○'.repeat(3 - COMPANIES[id].risk)]),
          ]),
          sparkline(hist),
          h('div', { class: 'stock-price' }, [
            h('strong', {}, [t('shop.coins', { n: price })]),
            h('span', { class: ch > 0 ? 'up' : ch < 0 ? 'down' : '' }, [`${ch > 0 ? '▲' : ch < 0 ? '▼' : '•'} ${Math.abs(ch)}%`]),
          ]),
        ]),
        h('div', { class: 'stock-foot' }, [
          h('span', { class: 'stock-held' }, [
            held ? t('money.held', { n: held, value: held * price }) : t('money.none'),
            held ? h('b', { class: gain >= 0 ? 'up' : 'down' }, [` ${gain >= 0 ? '+' : ''}${gain}`]) : null,
          ]),
          h('div', { class: 'shop-prices' }, [this.btn(t('money.buy'), doBuy, wallet < price), this.btn(t('money.sell'), doSell, held < 1)]),
        ]),
      ]);
    });
    const { value, paid } = portfolioValue(p, today);
    const total = h('div', { class: 'shop-table' }, [
      this.line(t('money.portfolio'), t('shop.coins', { n: value }), 'plus'),
      paid ? this.line(t('money.gain'), `${value - paid >= 0 ? '+' : ''}${value - paid}`, value - paid >= 0 ? 'plus' : 'minus') : null,
      p.realized ? this.line(t('money.realized'), `${p.realized >= 0 ? '+' : ''}${p.realized}`, p.realized >= 0 ? 'plus' : 'minus') : null,
    ]);
    const n = spread(p);
    const tip = h('p', { class: 'shop-tip' }, [t(n === 0 ? 'money.tip.start' : n < 3 ? 'money.tip.spread' : 'money.tip.good')]);
    return [h('p', { class: 'card-body' }, [t('money.sharesIntro')]), ...rows, total, tip, h('p', { class: 'shop-note' }, [t('money.sharesNote')])];
  }

  private line(label: string, value: string, cls = ''): HTMLElement {
    return h('div', { class: `shop-line ${cls}` }, [h('span', {}, [label]), h('strong', {}, [value])]);
  }
}
