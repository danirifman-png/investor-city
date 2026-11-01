import {
  bizStars,
  bizTip,
  canUpgrade,
  CITY_EVENTS,
  clampBizPlan,
  newBizDay,
  nextStage,
  paybackDays,
  playBizDay,
  STAGE_RULES,
  type BizDay,
  type BizPlan,
  type BizResult,
  type BizStage,
  type BusinessRecord,
  type CityEventId,
  type WeatherId,
} from '../core/Business';
import { t } from '../i18n';
import { h, iconButton } from './dom';

export interface BusinessHooks {
  /** A business day was played; the game records it, rewards and saves. */
  onDay(result: BizResult, stars: number): BusinessRecord;
  /** The player invests the till in the next stage. Returns the new record. */
  onUpgrade(): BusinessRecord;
  /** The player takes the till home. Returns the new record. */
  onTakeHome(): BusinessRecord;
  /** The calendar day's city event. */
  cityEvent(): CityEventId;
  onClose(): void;
}

const WEATHER_ICON: Record<WeatherId, string> = { hot: '🔥', sunny: '☀️', cloudy: '⛅', rain: '🌧️' };
export const CITY_ICON: Record<CityEventId, string> = { ordinary: '🏙️', festival: '🎉', marathon: '🏃', match: '⚽', market: '🧺', roadworks: '🚧', concert: '🎸' };

function starRow(n: number, label: string): HTMLElement {
  return h('div', { class: 'shop-stars big', role: 'img', 'aria-label': label }, [0, 1, 2].map((i) => h('span', { class: i < n ? 'on' : 'off' }, ['★'])));
}

const pct = (k: number) => `${Math.round(k * 100 - 100) >= 0 ? '+' : ''}${Math.round(k * 100 - 100)}%`;

/**
 * "My business" panel: the business's state with what to do next (open for a
 * day, invest in growing, take the till home), the day's plan, and the result.
 * All rules live in core/Business.
 */
export class BusinessView {
  readonly el: HTMLDivElement;
  private panel: HTMLDivElement;
  private rec: BusinessRecord | null = null;
  private day: BizDay | null = null;
  private plan: BizPlan = { cups: 20, price: 5 };

  constructor(private hooks: BusinessHooks) {
    this.panel = h('div', { class: 'modal-panel shop-panel biz-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('biz.title') });
    this.el = h('div', { class: 'modal shop-modal biz-modal', hidden: true }, [this.panel]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(rec: BusinessRecord): void {
    this.rec = rec;
    this.day = null;
    this.el.hidden = false;
    this.drawHome();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.day = null;
    this.hooks.onClose();
  }

  private frame(title: string, body: (HTMLElement | null)[], actions: HTMLElement[]): void {
    const parts = [
      iconButton('close', t('hud.close'), () => this.close(), 'modal-close'),
      h('div', { class: 'card-kicker' }, [h('span', { class: 'shop-kicker-icon', 'aria-hidden': 'true' }, ['🍋']), t('biz.kicker')]),
      h('h2', {}, [title]),
      ...body,
      h('div', { class: 'card-actions shop-actions' }, actions),
    ];
    this.panel.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
    (actions[0] as HTMLButtonElement | undefined)?.focus();
  }

  private button(label: string, onClick: () => void, primary = true, disabled = false): HTMLButtonElement {
    const b = h('button', { class: primary ? 'primary-btn' : 'secondary-btn', type: 'button', onclick: onClick }, [label]);
    b.disabled = disabled;
    return b;
  }

  private cityBanner(): HTMLElement {
    const ev = this.hooks.cityEvent();
    const k = CITY_EVENTS[ev];
    return h('div', { class: `biz-city ${k > 1 ? 'up' : k < 1 ? 'down' : ''}` }, [
      h('span', { class: 'shop-event-icon', 'aria-hidden': 'true' }, [CITY_ICON[ev]]),
      h('div', {}, [
        h('strong', {}, [t('biz.cityToday', { event: t(`city.${ev}`) })]),
        h('span', {}, [k === 1 ? t('biz.cityNone') : t('biz.cityEffect', { pct: pct(k) })]),
      ]),
    ]);
  }

  /* ------------------------------ home ------------------------------- */

  private drawHome(): void {
    const rec = this.rec!;
    const r = STAGE_RULES[rec.stage];
    const n = nextStage(rec);
    const stats = h('div', { class: 'shop-table' }, [
      this.line(t('biz.till'), t('shop.coins', { n: rec.till }), 'plus'),
      this.line(t('biz.daysRun'), String(rec.days)),
      this.line(t('biz.capacity'), t('biz.cups', { n: r.capacity })),
      this.line(t('biz.fixed'), r.fixedCost ? t('shop.coins', { n: r.fixedCost }) : t('biz.noFixed')),
    ]);
    const steps = h(
      'ol',
      { class: 'biz-steps', 'aria-label': t('biz.stagesLabel') },
      ([0, 1, 2, 3] as BizStage[]).map((s) => h('li', { class: s < rec.stage ? 'done' : s === rec.stage ? 'now' : '' }, [t(`biz.stage.${s}`)])),
    );
    const body: (HTMLElement | null)[] = [steps, h('p', { class: 'card-body' }, [t(`biz.stage.${rec.stage}.desc`)]), this.cityBanner(), stats];
    const actions = [this.button(t('biz.openDay'), () => this.startDay())];
    if (n !== null) {
      const cost = STAGE_RULES[n].upgradeCost;
      const k = Math.min(1, rec.till / cost);
      body.push(
        h('div', { class: 'biz-goal' }, [
          h('div', { class: 'biz-goal-title' }, [t('biz.goal', { stage: t(`biz.stage.${n}`), cost })]),
          h('div', { class: 'biz-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(cost), 'aria-valuenow': String(rec.till) }, [
            h('span', { style: `width:${Math.round(k * 100)}%` }),
          ]),
          h('span', { class: 'shop-note' }, [t('biz.payback', { n: paybackDays(rec.stage) ?? 0 })]),
        ]),
      );
      actions.push(this.button(t('biz.grow', { stage: t(`biz.stage.${n}`) }), () => this.drawUpgrade(n), canUpgrade(rec), !canUpgrade(rec)));
    } else body.push(h('p', { class: 'shop-tip' }, [t('biz.maxed')]));
    if (rec.till > 0) actions.push(this.button(t('biz.takeHome', { n: rec.till }), () => this.drawTakeHome(), false));
    this.frame(t(`biz.stage.${rec.stage}.name`), body, actions);
  }

  private line(label: string, value: string, cls = ''): HTMLElement {
    return h('div', { class: `shop-line ${cls}` }, [h('span', {}, [label]), h('strong', {}, [value])]);
  }

  /* ------------------------------ grow ------------------------------- */

  private drawUpgrade(n: BizStage): void {
    const rec = this.rec!;
    const now = STAGE_RULES[rec.stage];
    const then = STAGE_RULES[n];
    const table = h('div', { class: 'shop-table' }, [
      this.line(t('biz.cost'), `-${t('shop.coins', { n: then.upgradeCost })}`, 'minus'),
      this.line(t('biz.customers'), `${now.customers} → ${then.customers}`, 'plus'),
      this.line(t('biz.capacity'), `${now.capacity} → ${then.capacity}`, 'plus'),
      this.line(t('biz.fixed'), `${now.fixedCost} → ${then.fixedCost}`, 'minus'),
    ]);
    this.frame(
      t('biz.growTitle', { stage: t(`biz.stage.${n}`) }),
      [h('p', { class: 'card-body' }, [t(`biz.stage.${n}.desc`)]), table, h('p', { class: 'shop-tip' }, [t('biz.growTip')])],
      [
        this.button(t('biz.invest'), () => {
          this.rec = this.hooks.onUpgrade();
          this.close();
        }),
        this.button(t('biz.notNow'), () => this.drawHome(), false),
      ],
    );
  }

  private drawTakeHome(): void {
    const rec = this.rec!;
    const n = nextStage(rec);
    this.frame(
      t('biz.takeTitle', { n: rec.till }),
      [h('p', { class: 'card-body' }, [n !== null ? t('biz.takeBody', { stage: t(`biz.stage.${n}`), cost: STAGE_RULES[n].upgradeCost }) : t('biz.takeBodyMax')])],
      [
        this.button(t('biz.takeYes', { n: rec.till }), () => {
          this.rec = this.hooks.onTakeHome();
          this.drawHome();
        }),
        this.button(t('biz.keep'), () => this.drawHome(), false),
      ],
    );
  }

  /* ------------------------------ plan ------------------------------- */

  private startDay(): void {
    const rec = this.rec!;
    this.day = newBizDay(rec.stage, this.hooks.cityEvent(), (Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const r = STAGE_RULES[rec.stage];
    this.plan = clampBizPlan(rec.stage, { cups: Math.round(r.customers * 0.8), price: 5 });
    this.drawPlan();
  }

  private drawPlan(): void {
    const day = this.day!;
    const r = STAGE_RULES[day.stage];
    const fc = day.forecast;
    const weather = (w: WeatherId, chance: number | null) =>
      h('div', { class: 'shop-event' }, [
        h('span', { class: 'shop-event-icon', 'aria-hidden': 'true' }, [WEATHER_ICON[w]]),
        h('div', {}, [h('strong', {}, [t(`weather.${w}`) + (chance !== null ? ` (${Math.round(chance * 100)}%)` : '')]), h('span', {}, [t(`weather.${w}.desc`)])]),
      ]);
    const forecast = h('div', { class: 'shop-forecast' }, [
      h('div', { class: 'shop-forecast-title' }, [t('biz.forecast')]),
      weather(fc.likely, fc.chance < 1 ? fc.chance : null),
      fc.chance < 1 ? weather(fc.other, 1 - fc.chance) : null,
    ]);

    const cupsOut = h('output', { class: 'shop-dough-value', 'aria-live': 'polite' });
    const costOut = h('div', { class: 'shop-cost' });
    const big = r.capacity >= 150 ? 20 : r.capacity >= 70 ? 10 : 5;
    const refresh = () => {
      this.plan = clampBizPlan(day.stage, this.plan);
      cupsOut.textContent = String(this.plan.cups);
      const variable = this.plan.cups * r.cupCost;
      costOut.textContent = r.fixedCost
        ? t('biz.costLineFixed', { cups: this.plan.cups, unit: r.cupCost, variable, fixed: r.fixedCost, total: variable + r.fixedCost })
        : t('biz.costLine', { cups: this.plan.cups, unit: r.cupCost, variable });
      priceRow.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.price) === this.plan.price)));
    };
    const step = (d: number) => h('button', { class: 'shop-step', type: 'button', 'data-step': d, onclick: () => ((this.plan.cups += d), refresh()) }, [d > 0 ? `+${d}` : `${d}`]);
    const cupsRow = h('div', { class: 'shop-row' }, [
      h('span', { class: 'shop-label' }, [t('biz.cupsLabel', { max: r.capacity })]),
      h('div', { class: 'shop-stepper' }, [step(-big), step(-1), cupsOut, step(1), step(big)]),
    ]);
    const priceRow = h('div', { class: 'shop-row' }, [
      h('span', { class: 'shop-label' }, [t('biz.priceLabel')]),
      h('div', { class: 'shop-prices' }, r.prices.map((p) => h('button', { class: 'shop-price', type: 'button', 'data-price': p, onclick: () => ((this.plan.price = p), refresh()) }, [t('shop.coins', { n: p })]))),
    ]);
    refresh();
    this.frame(t('biz.planTitle'), [this.cityBanner(), forecast, cupsRow, priceRow, costOut], [
      this.button(t('biz.openNow'), () => this.play()),
      this.button(t('biz.back'), () => this.drawHome(), false),
    ]);
  }

  /* ------------------------------ result ----------------------------- */

  private play(): void {
    const r = playBizDay(this.day!, this.plan);
    const stars = bizStars(r);
    this.rec = this.hooks.onDay(r, stars);
    this.day = null;
    this.drawResult(r, stars);
  }

  private drawResult(r: BizResult, stars: number): void {
    const money = (n: number) => t('shop.coins', { n });
    const table = h('div', { class: 'shop-table' }, [
      this.line(t('biz.r.customers'), String(r.wanted)),
      this.line(t('biz.r.sold'), String(r.sold)),
      r.missed ? this.line(t('biz.r.missed'), String(r.missed), 'bad') : null,
      r.wasted ? this.line(t('biz.r.wasted'), String(r.wasted), 'bad') : null,
      this.line(t('shop.r.revenue'), money(r.revenue), 'plus'),
      this.line(t('biz.r.cups'), `-${money(r.cupCost)}`, 'minus'),
      r.fixedCost ? this.line(t('shop.r.fixed'), `-${money(r.fixedCost)}`, 'minus') : null,
      this.line(t('shop.r.profit'), money(r.profit), r.profit >= 0 ? 'profit good' : 'profit bad'),
    ]);
    const happened = h('div', { class: 'shop-event happened' }, [
      h('span', { class: 'shop-event-icon', 'aria-hidden': 'true' }, [WEATHER_ICON[r.weather]]),
      h('div', {}, [h('strong', {}, [t('biz.happened', { weather: t(`weather.${r.weather}`) })])]),
    ]);
    const tip = h('p', { class: 'shop-tip' }, [t(`biz.tip.${bizTip(r)}`, { best: r.bestProfit })]);
    const till = h('div', { class: 'card-note' }, [t('biz.tillNow', { n: this.rec!.till })]);
    this.frame(t('biz.resultTitle'), [starRow(stars, t('shop.stars', { n: stars })), happened, table, tip, till], [
      this.button(t('biz.toBusiness'), () => this.drawHome()),
      this.button(t('biz.again'), () => this.startDay(), false),
    ]);
  }
}
