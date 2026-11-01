import {
  clampPlan,
  dayOver,
  LEVEL_RULES,
  newDay,
  playShift,
  SHOP_LEVELS,
  shiftTip,
  summarize,
  type DaySummary,
  type ShiftPlan,
  type ShiftResult,
  type ShopDay,
  type ShopLevel,
  type ShopRecord,
} from '../core/PizzaShop';
import { t } from '../i18n';
import { h, iconButton } from './dom';

export interface PizzaShopHooks {
  /** The day ended; the game hands out rewards and saves. */
  onDayDone(level: ShopLevel, summary: DaySummary): void;
  onClose(): void;
}

const EVENT_ICON: Record<string, string> = { quiet: '🌤️', sunny: '☀️', rain: '🌧️', match: '⚽', festival: '🎉', school: '🎒' };

/** Three stars, the earned ones gold and the rest pale. */
function starRow(n: number, label: string, big = false): HTMLElement {
  return h(
    big ? 'div' : 'span',
    { class: big ? 'shop-stars big' : 'shop-stars', role: 'img', 'aria-label': label },
    [0, 1, 2].map((i) => h('span', { class: i < n ? 'on' : 'off' }, ['★'])),
  );
}

/**
 * The "day at Marco's" panel: pick a level, then plan, play and review three
 * shifts. All the rules live in core/PizzaShop; this only draws them.
 */
export class PizzaShopView {
  readonly el: HTMLDivElement;
  private panel: HTMLDivElement;
  private day: ShopDay | null = null;
  private plan: ShiftPlan = { dough: 20, price: 10 };
  private record: ShopRecord | null = null;

  constructor(private hooks: PizzaShopHooks) {
    this.panel = h('div', { class: 'modal-panel shop-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('shop.title') });
    this.el = h('div', { class: 'modal shop-modal', hidden: true }, [this.panel]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(record: ShopRecord): void {
    this.record = record;
    this.day = null;
    this.el.hidden = false;
    this.drawLevels();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.day = null;
    this.hooks.onClose();
  }

  private frame(kicker: string, title: string, body: (HTMLElement | null)[], actions: HTMLElement[]): void {
    const parts = [
      iconButton('close', t('hud.close'), () => this.close(), 'modal-close'),
      h('div', { class: 'card-kicker' }, [h('span', { class: 'shop-kicker-icon', 'aria-hidden': 'true' }, ['🍕']), kicker]),
      h('h2', {}, [title]),
      ...body,
      h('div', { class: 'card-actions shop-actions' }, actions),
    ];
    this.panel.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
    (actions[0] as HTMLButtonElement | undefined)?.focus();
  }

  private button(label: string, onClick: () => void, primary = true): HTMLButtonElement {
    return h('button', { class: primary ? 'primary-btn' : 'secondary-btn', type: 'button', onclick: onClick }, [label]);
  }

  /* ------------------------------ level ------------------------------ */

  private drawLevels(): void {
    const list = h(
      'div',
      { class: 'shop-levels' },
      SHOP_LEVELS.map((level) => {
        const best = this.record?.best[level] ?? 0;
        return h('button', { class: `shop-level level-${level}`, type: 'button', 'data-level': level, onclick: () => this.start(level) }, [
          h('strong', {}, [t(`shop.level.${level}`)]),
          h('span', { class: 'shop-level-age' }, [t(`shop.level.${level}.age`)]),
          h('span', { class: 'shop-level-desc' }, [t(`shop.level.${level}.desc`)]),
          starRow(best, t('shop.bestStars', { n: best })),
        ]);
      }),
    );
    this.frame(t('shop.kicker'), t('shop.title'), [h('p', { class: 'card-body' }, [t('shop.intro')]), list, h('p', { class: 'shop-note' }, [t('shop.levelNote')])], []);
  }

  private start(level: ShopLevel): void {
    this.day = newDay(level, (Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const rules = LEVEL_RULES[level];
    this.plan = { dough: 20, price: rules.fixedPrice ?? 10 };
    this.drawPlan();
  }

  /* ------------------------------ plan ------------------------------- */

  private drawPlan(): void {
    const day = this.day!;
    const rules = LEVEL_RULES[day.level];
    const i = day.results.length;
    const fc = day.forecasts[i];
    const forecast = h('div', { class: 'shop-forecast' }, [
      h('div', { class: 'shop-forecast-title' }, [t('shop.forecast', { n: i + 1, total: rules.shifts })]),
      ...fc.events.map((ev, k) =>
        h('div', { class: 'shop-event' }, [
          h('span', { class: 'shop-event-icon', 'aria-hidden': 'true' }, [EVENT_ICON[ev]]),
          h('div', {}, [
            h('strong', {}, [t(`shop.event.${ev}`) + (fc.events.length > 1 ? ` (${Math.round((k === 0 ? fc.chance : 1 - fc.chance) * 100)}%)` : '')]),
            h('span', {}, [t(`shop.event.${ev}.desc`)]),
          ]),
        ]),
      ),
    ]);

    const doughOut = h('output', { class: 'shop-dough-value', 'aria-live': 'polite' });
    const costOut = h('div', { class: 'shop-cost' });
    const refresh = () => {
      this.plan = clampPlan(day.level, this.plan);
      doughOut.textContent = String(this.plan.dough);
      const variable = this.plan.dough * rules.doughCost;
      costOut.textContent = rules.fixedCost
        ? t('shop.costLineFixed', { dough: this.plan.dough, unit: rules.doughCost, variable, fixed: rules.fixedCost, total: variable + rules.fixedCost })
        : t('shop.costLine', { dough: this.plan.dough, unit: rules.doughCost, variable });
      priceRow?.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.price) === this.plan.price)));
    };
    const step = (d: number) =>
      h('button', { class: 'shop-step', type: 'button', 'data-step': d, onclick: () => ((this.plan.dough += d), refresh()) }, [d > 0 ? `+${d}` : `${d}`]);
    const doughRow = h('div', { class: 'shop-row' }, [
      h('span', { class: 'shop-label' }, [t('shop.dough')]),
      h('div', { class: 'shop-stepper' }, [step(-5), step(-1), doughOut, step(1), step(5)]),
    ]);
    const priceRow = rules.fixedPrice
      ? null
      : h('div', { class: 'shop-row' }, [
          h('span', { class: 'shop-label' }, [t('shop.price')]),
          h(
            'div',
            { class: 'shop-prices' },
            rules.prices.map((p) => h('button', { class: 'shop-price', type: 'button', 'data-price': p, onclick: () => ((this.plan.price = p), refresh()) }, [t('shop.coins', { n: p })])),
          ),
        ]);
    const fixedNote = rules.fixedPrice ? h('p', { class: 'shop-note' }, [t('shop.fixedPrice', { n: rules.fixedPrice })]) : null;
    refresh();
    this.frame(
      t('shop.kicker'),
      t('shop.planTitle'),
      [forecast, doughRow, priceRow, fixedNote, costOut],
      [this.button(t('shop.open'), () => this.play())],
    );
  }

  /* ------------------------------ result ----------------------------- */

  private play(): void {
    const r = playShift(this.day!, this.plan);
    if (r) this.drawResult(r);
  }

  private drawResult(r: ShiftResult): void {
    const day = this.day!;
    const line = (label: string, value: string, cls = '') => h('div', { class: `shop-line ${cls}` }, [h('span', {}, [label]), h('strong', {}, [value])]);
    const money = (n: number) => t('shop.coins', { n });
    const table = h('div', { class: 'shop-table' }, [
      line(t('shop.r.customers'), String(r.wanted)),
      line(t('shop.r.sold'), String(r.sold)),
      r.missed ? line(t('shop.r.missed'), String(r.missed), 'bad') : null,
      r.wasted ? line(t('shop.r.wasted'), String(r.wasted), 'bad') : null,
      line(t('shop.r.revenue'), money(r.revenue), 'plus'),
      line(t('shop.r.variable'), `-${money(r.variableCost)}`, 'minus'),
      r.fixedCost ? line(t('shop.r.fixed'), `-${money(r.fixedCost)}`, 'minus') : null,
      line(t('shop.r.profit'), money(r.profit), r.profit >= 0 ? 'profit good' : 'profit bad'),
    ].filter((x): x is HTMLDivElement => !!x));
    const happened = h('div', { class: 'shop-event happened' }, [
      h('span', { class: 'shop-event-icon', 'aria-hidden': 'true' }, [EVENT_ICON[r.event]]),
      h('div', {}, [h('strong', {}, [t('shop.happened', { event: t(`shop.event.${r.event}`) })])]),
    ]);
    const tip = h('p', { class: 'shop-tip' }, [t(`shop.tip.${shiftTip(r)}`, { best: r.bestProfit })]);
    const next = dayOver(day)
      ? this.button(t('shop.toSummary'), () => this.drawSummary())
      : this.button(t('shop.nextShift'), () => this.drawPlan());
    this.frame(t('shop.kicker'), t('shop.resultTitle', { n: day.results.length }), [happened, table, tip], [next]);
  }

  /* ------------------------------ summary ---------------------------- */

  private drawSummary(): void {
    const day = this.day!;
    const s = summarize(day);
    this.hooks.onDayDone(day.level, s);
    const stars = starRow(s.stars, t('shop.stars', { n: s.stars }), true);
    const body = [
      stars,
      h('p', { class: 'card-body' }, [t(s.profit > 0 ? 'shop.sum.profit' : 'shop.sum.loss', { n: Math.abs(s.profit), best: s.bestProfit })]),
      h('p', { class: 'shop-note' }, [t('shop.sum.stock', { wasted: s.wasted, missed: s.missed })]),
      h('div', { class: 'card-note' }, [t('shop.sum.reward', { coins: s.coins, xp: s.xp })]),
    ];
    this.frame(t('shop.kicker'), t('shop.sumTitle'), body, [
      this.button(t('shop.again'), () => this.start(day.level)),
      this.button(t('shop.otherLevel'), () => this.drawLevels(), false),
      this.button(t('shop.done'), () => this.close(), false),
    ]);
  }
}
