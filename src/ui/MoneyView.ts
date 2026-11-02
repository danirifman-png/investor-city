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
import type { Worth } from '../core/Life';
import type { CityEventId } from '../core/Business';
import { t } from '../i18n';
import { h, iconButton } from './dom';

export interface MoneyHooks {
  /** The player's coins and money state (live objects owned by the save). */
  view(): { wallet: number; money: MoneyState } | null;
  /** Commits a change: the new wallet and money state. `learn` names concepts the action teaches. */
  commit(wallet: number, money: MoneyState, learn: string[]): void;
  onClose(): void;
  /** A tab was chosen (the money lesson listens). */
  onTab?(tab: MoneyTab): void;
  /** Opens the mall. */
  onStore?(): void;
  /** Today's city event (the newspaper's headline). */
  cityEvent?(): CityEventId;
  /** Net worth today, the level, recent history and today's bills. */
  worth?(): { worth: Worth; level: number; history: { day: number; net: number }[]; bills: number } | null;
}

export type MoneyTab = 'worth' | 'savings' | 'shares';

/** A photo from the city for a company or the bank (falls back to a coloured panel). */
function picture(id: string): HTMLElement {
  const img = h('img', { class: 'money-photo', src: `img/money/${id}.jpg`, alt: '', decoding: 'async' }) as HTMLImageElement;
  img.addEventListener('error', () => (img.style.visibility = 'hidden'));
  return h('div', { class: `money-photo-box ph-${id}` }, [img]);
}

/** A line chart with a soft fill, the high and low marked, and labels for its two ends. */
function lineChart(values: number[], o: { from: string; to: string; up: boolean }): HTMLElement {
  const w = 300;
  const hgt = 90;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1, hi - lo);
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w;
  const y = (v: number) => 8 + (1 - (v - lo) / span) * (hgt - 16);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', `chart ${o.up ? 'up' : 'down'}`);
  svg.setAttribute('aria-hidden', 'true');
  const area = document.createElementNS(ns, 'polygon');
  area.setAttribute('points', `0,${hgt} ${pts} ${w},${hgt}`);
  area.setAttribute('class', 'chart-area');
  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', pts);
  line.setAttribute('class', 'chart-line');
  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', String(x(values.length - 1)));
  dot.setAttribute('cy', String(y(values[values.length - 1])));
  dot.setAttribute('r', '4');
  dot.setAttribute('class', 'chart-dot');
  svg.append(area, line, dot);
  return h('div', { class: 'chart-box' }, [
    h('div', { class: 'chart-range' }, [h('span', {}, [t('money.chart.high', { n: hi })]), h('span', {}, [t('money.chart.low', { n: lo })])]),
    svg as unknown as HTMLElement,
    h('div', { class: 'chart-axis' }, [h('span', {}, [o.from]), h('span', {}, [o.to])]),
  ]);
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
      ((this.hooks.worth ? ['worth', 'savings', 'shares'] : ['savings', 'shares']) as MoneyTab[]).map((id) =>
        h('button', { class: 'money-tab', type: 'button', role: 'tab', 'aria-selected': String(id === this.tab), 'data-tab': id, onclick: () => ((this.tab = id), this.hooks.onTab?.(id), this.draw()) }, [t(`money.tab.${id}`)]),
      ),
    );
    const wallet = h('div', { class: 'money-wallet' }, [
      h('span', { class: 'pc-coin', 'aria-hidden': 'true' }),
      t('money.wallet', { n: v.wallet }),
      this.hooks.onStore ? h('button', { class: 'shop-price money-store-btn', type: 'button', onclick: () => this.hooks.onStore?.() }, [t('store.openShort')]) : null,
    ]);
    const body = this.tab === 'worth' ? this.worth() : this.tab === 'savings' ? this.savings(v.wallet, v.money) : this.shares(v.wallet, v.money);
    this.panel.replaceChildren(
      iconButton('close', t('hud.close'), () => this.close(), 'modal-close'),
      h('div', { class: 'card-kicker' }, [t('money.kicker')]),
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

  /* ---------------------------- net worth ---------------------------- */

  /** What I have and what I owe; things and debts from level 3, with the last days as bars. */
  private worth(): HTMLElement[] {
    const v = this.hooks.worth?.();
    if (!v) return [];
    const w = v.worth;
    const full = v.level >= 3;
    const coins = (n: number) => t('shop.coins', { n });
    const table = h('div', { class: 'shop-table worth-table' }, [
      this.line(t('worth.cash'), coins(w.cash)),
      this.line(t('worth.savings'), coins(w.savings)),
      this.line(t('worth.investments'), coins(w.investments)),
      full ? this.line(t('worth.things'), coins(w.things)) : null,
      full ? this.line(t('worth.owe'), w.owe ? `-${w.owe}` : '0', w.owe ? 'minus' : '') : null,
      full ? this.line(t('worth.net'), coins(w.net), 'plus worth-net') : null,
    ]);
    const out: HTMLElement[] = [table];
    if (full) out.push(h('p', { class: 'shop-note' }, [t('worth.netNote')]));
    else out.push(h('p', { class: 'shop-note' }, [t('worth.lockedRows')]));
    if (v.bills) out.push(h('p', { class: 'shop-tip' }, [t('worth.bills', { n: v.bills })]));
    if (full) {
      out.push(h('strong', { class: 'worth-title' }, [t('worth.history')]));
      if (v.history.length < 2) out.push(h('p', { class: 'shop-note' }, [t('worth.historyEmpty')]));
      else {
        const top = Math.max(1, ...v.history.map((p) => Math.abs(p.net)));
        out.push(
          h(
            'div',
            { class: 'worth-chart', role: 'img', 'aria-label': v.history.map((p) => p.net).join(', ') },
            v.history.map((p, i) =>
              h('div', { class: 'worth-col' }, [
                h('small', {}, [String(p.net)]),
                h('div', { class: `worth-bar ${p.net < 0 ? 'neg' : ''} ${i === v.history.length - 1 ? 'today' : ''}`, style: `height:${Math.max(4, (Math.abs(p.net) / top) * 100)}%` }),
              ]),
            ),
          ),
        );
      }
    }
    return out;
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
    const base = Math.max(bal, 100);
    const days = Array.from({ length: 31 }, (_, d) => Math.floor(grow(base, d)));
    const hero = h('div', { class: 'money-hero savings' }, [
      picture('savings'),
      h('div', { class: 'money-hero-text' }, [
        h('span', {}, [t('money.balance')]),
        h('strong', { class: 'money-big' }, [t('shop.coins', { n: bal })]),
        h('span', { class: 'money-sub' }, [t('money.earnedLine', { n: Math.floor(s.interest), pct: Math.round(SAVINGS_RATE * 100) })]),
      ]),
    ]);
    const chart = h('div', { class: 'money-chart-box' }, [
      h('strong', {}, [t('money.futureTitle', { n: base })]),
      lineChart(days, { from: t('money.chart.today'), to: t('money.chart.month'), up: true }),
      h('span', { class: 'money-sub' }, [t('money.future', { d7: days[7], d30: days[30] })]),
    ]);
    return [
      hero,
      h('p', { class: 'card-body' }, [t('money.savingsIntro')]),
      chart,
      h('div', { class: 'money-actions' }, [
        h('div', { class: 'money-action' }, [
          h('span', { class: 'shop-label' }, [t('money.deposit')]),
          h('div', { class: 'shop-prices money-deposit' }, [this.btn('10', () => dep(10), wallet < 1), this.btn('50', () => dep(50), wallet < 1), this.btn(t('money.all'), () => dep(wallet), wallet < 1)]),
        ]),
        h('div', { class: 'money-action' }, [
          h('span', { class: 'shop-label' }, [t('money.withdraw')]),
          h('div', { class: 'shop-prices' }, [this.btn('10', () => out(10), bal < 1), this.btn(t('money.all'), () => out(bal), bal < 1)]),
        ]),
      ]),
      h('p', { class: 'shop-note' }, [t('money.savingsNote')]),
    ];
  }

  /* ------------------------------ shares ----------------------------- */

  private shares(wallet: number, money: MoneyState): HTMLElement[] {
    const today = this.today();
    const p = money.portfolio;
    const { value, paid } = portfolioValue(p, today);
    const gain = value - paid;
    const prices = Object.fromEntries(COMPANY_IDS.map((id) => [id, history(id, today, 14)])) as Record<CompanyId, number[]>;
    // what the portfolio is made of
    const parts = COMPANY_IDS.map((id) => ({ id, v: (p.shares[id] ?? 0) * prices[id][prices[id].length - 1] })).filter((x) => x.v > 0);
    const mix = h(
      'div',
      { class: 'money-mix', role: 'img', 'aria-label': parts.map((x) => `${t(`company.${x.id}`)} ${Math.round((x.v / Math.max(1, value)) * 100)}%`).join(', ') },
      parts.map((x) => h('span', { class: `mix-${x.id}`, style: `flex:${x.v}` })),
    );
    const summary = h('div', { class: 'money-summary' }, [
      h('span', {}, [t('money.portfolio')]),
      h('strong', { class: 'money-big' }, [t('shop.coins', { n: value })]),
      paid
        ? h('span', { class: `money-sub ${gain > 0 ? 'up' : gain < 0 ? 'down' : ''}` }, [t(gain > 0 ? 'money.gainLine' : gain < 0 ? 'money.lossLine' : 'money.evenLine', { n: Math.abs(gain), paid, pct: Math.round((Math.abs(gain) / Math.max(1, paid)) * 100) })])
        : h('span', { class: 'money-sub' }, [t('money.emptyPortfolio')]),
      parts.length ? mix : null,
      parts.length ? h('div', { class: 'money-mix-legend' }, parts.map((x) => h('span', {}, [h('i', { class: `mix-${x.id}` }), t(`company.${x.id}`)]))) : null,
      p.realized ? h('span', { class: 'money-sub' }, [t('money.realizedLine', { n: `${p.realized >= 0 ? '+' : ''}${p.realized}` })]) : null,
    ]);
    const cards = COMPANY_IDS.map((id) => {
      const hist = prices[id];
      const price = hist[hist.length - 1];
      const prev = hist[hist.length - 2] ?? price;
      const ch = prev ? Math.round(((price - prev) / prev) * 1000) / 10 : 0;
      const held = p.shares[id] ?? 0;
      const mine = held * price - (p.paid[id] ?? 0);
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
      const risk = COMPANIES[id].risk;
      return h('article', { class: 'stock', 'data-company': id }, [
        h('div', { class: 'stock-photo' }, [picture(id), h('span', { class: `stock-risk r${risk}` }, [t(`money.riskWord.${risk}`)])]),
        h('div', { class: 'stock-body' }, [
          h('div', { class: 'stock-title' }, [
            h('strong', {}, [t(`company.${id}`)]),
            h('div', { class: 'stock-price' }, [
              h('strong', {}, [t('shop.coins', { n: price })]),
              h('span', { class: ch > 0 ? 'up' : ch < 0 ? 'down' : '' }, [ch === 0 ? t('money.flat') : t(ch > 0 ? 'money.upToday' : 'money.downToday', { n: Math.abs(ch) })]),
            ]),
          ]),
          h('p', { class: 'stock-about' }, [t(`company.${id}.about`)]),
          lineChart(hist, { from: t('money.chart.twoWeeks'), to: t('money.chart.today'), up: price >= hist[0] }),
          h('div', { class: 'stock-foot' }, [
            h('span', { class: 'stock-held' }, [
              held ? t(held === 1 ? 'money.heldOne' : 'money.held', { n: held, value: held * price }) : t('money.none'),
              held ? h('b', { class: mine >= 0 ? 'up' : 'down' }, [` (${mine >= 0 ? '+' : ''}${mine})`]) : null,
            ]),
            h('div', { class: 'shop-prices' }, [this.btn(t('money.buyFor', { n: price }), doBuy, wallet < price, 'shop-price stock-buy'), this.btn(t('money.sell'), doSell, held < 1)]),
          ]),
        ]),
      ]);
    });
    const n = spread(p);
    const tip = h('p', { class: 'shop-tip' }, [t(n === 0 ? 'money.tip.start' : n < 3 ? 'money.tip.spread' : 'money.tip.good')]);
    return [summary, ...[this.news()].filter((x): x is HTMLDivElement => !!x), h('p', { class: 'card-body' }, [t('money.sharesIntro')]), ...cards, tip, h('p', { class: 'shop-note' }, [t('money.sharesNote')])];
  }

  /** The city newspaper: today's event and which companies it helps or hurts. */
  private news(): HTMLDivElement | null {
    const ev = this.hooks.cityEvent?.();
    if (!ev) return null;
    const hit = COMPANY_IDS.map((id) => ({ id, k: COMPANIES[id].events[ev] ?? 0 })).filter((x) => x.k !== 0);
    return h('div', { class: 'money-news' }, [
      h('div', { class: 'money-news-head' }, [t('news.paper')]),
      h('strong', { class: 'money-news-title' }, [t(`news.headline.${ev}`)]),
      h(
        'p',
        {},
        hit.length
          ? [hit.map((x) => t(x.k > 0 ? 'news.helps' : 'news.hurts', { name: t(`company.${x.id}`) })).join(' ')]
          : [t('news.quiet')],
      ),
      h('small', {}, [t('news.note')]),
    ]);
  }

  private line(label: string, value: string, cls = ''): HTMLElement {
    return h('div', { class: `shop-line ${cls}` }, [h('span', {}, [label]), h('strong', {}, [value])]);
  }
}
