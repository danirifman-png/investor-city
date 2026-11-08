import { TICKETS, TRIP_CLASSES, buyTicket, comfortExtra, type TripClass } from '../content/travel';
import { t } from '../i18n';
import { h, iconButton } from './dom';

export interface TravelHooks {
  wallet(): number | null;
  /** The player chose a class they can pay for. */
  buy(cls: TripClass): void;
  onClose(): void;
}

/**
 * The travel agency in the mall: a return trip to Adventure Island in two
 * classes. Each ticket shows what you get and what it costs; a ticket you
 * cannot pay for says how many coins are missing, so saving up has a goal.
 */
export class TravelView {
  readonly el: HTMLDivElement;
  private panel: HTMLDivElement;

  constructor(private hooks: TravelHooks) {
    this.panel = h('div', { class: 'modal-panel shop-panel life-panel travel-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('travel.title') });
    this.el = h('div', { class: 'modal shop-modal life-modal travel-modal', hidden: true }, [this.panel]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(): void {
    this.el.hidden = false;
    this.draw();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.hooks.onClose();
  }

  private draw(): void {
    const wallet = this.hooks.wallet();
    if (wallet === null) return;
    const tickets = TRIP_CLASSES.map((cls) => {
      const tk = TICKETS[cls];
      const r = buyTicket(wallet, cls);
      const btn = h('button', { class: cls === 'economy' ? 'primary-btn' : 'secondary-btn', type: 'button', onclick: () => r.ok && this.hooks.buy(cls) }, [r.ok ? t('travel.buy', { n: tk.price }) : t('travel.missing', { n: r.missing })]);
      btn.disabled = !r.ok;
      return h('div', { class: `life-choice travel-ticket ticket-${cls}` }, [
        h('strong', { class: 'life-choice-title' }, [`${tk.icon} ${t(`travel.${cls}.title`)}`]),
        h('p', { class: 'life-facts' }, [t(`travel.${cls}.facts`)]),
        h('p', { class: 'decision-gain' }, [h('strong', {}, [`${t('life.gain')}: `]), t(`travel.${cls}.gain`)]),
        h('p', { class: 'decision-cost' }, [h('strong', {}, [`${t('life.cost')}: `]), t('travel.cost', { n: tk.price })]),
        h('div', { class: 'life-action' }, [btn]),
      ]);
    });
    this.panel.replaceChildren(
      iconButton('close', t('hud.close'), () => this.close(), 'modal-close'),
      h('div', { class: 'card-kicker' }, [h('span', { class: 'shop-kicker-icon', 'aria-hidden': 'true' }, ['✈️']), t('travel.kicker')]),
      h('h2', {}, [t('travel.title')]),
      h('p', { class: 'life-facts travel-intro' }, [t('travel.intro')]),
      h('div', { class: 'money-wallet' }, [h('span', { class: 'pc-coin', 'aria-hidden': 'true' }), t('life.wallet', { n: wallet })]),
      ...tickets,
      h('div', { class: 'card-note travel-tip' }, [t('travel.tip', { n: comfortExtra() })]),
    );
  }
}

/** How long a flight lasts on screen, in seconds (Skip lands at once). */
export const FLIGHT_SECONDS = 6;

/**
 * The flight: a plane crossing a sky of drifting clouds, with a money fact to
 * read on the way. Going out it flies toward the island, coming home back
 * toward the city. "Skip" lands at once with the same result.
 */
export class FlightView {
  readonly el: HTMLDivElement;
  private title: HTMLElement;
  private fact: HTMLElement;
  private fill: HTMLElement;
  private plane: HTMLElement;
  private raf = 0;
  private done: (() => void) | null = null;
  private factIndex = 0;

  constructor() {
    this.title = h('div', { class: 'flight-title' });
    this.fact = h('p', { class: 'flight-fact' });
    this.fill = h('span', { class: 'flight-fill' });
    this.plane = h('span', { class: 'flight-plane', 'aria-hidden': 'true' }, ['✈️']);
    const skip = h('button', { class: 'primary-btn flight-skip', type: 'button', onclick: () => this.finish() }, [t('travel.skip')]);
    const clouds = [1, 2, 3, 4, 5].map((i) => h('span', { class: `flight-cloud c${i}`, 'aria-hidden': 'true' }, ['☁️']));
    this.el = h('div', { class: 'modal flight-modal', hidden: true, role: 'dialog', 'aria-label': t('travel.flying') }, [
      h('div', { class: 'flight-sky', 'aria-hidden': 'true' }, [...clouds, this.plane]),
      h('div', { class: 'flight-panel' }, [this.title, this.fact, h('div', { class: 'sleep-bar flight-bar' }, [this.fill]), skip]),
    ]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  /** Takes off; `onDone` runs once, when the plane lands or the flight is skipped. */
  show(home: boolean, cls: TripClass | null, onDone: () => void): void {
    this.done = onDone;
    this.el.classList.toggle('home', home);
    this.el.classList.toggle('comfort', cls === 'comfort');
    this.title.textContent = home ? t('travel.flyingHome') : t(cls === 'comfort' ? 'travel.flyingComfort' : 'travel.flyingOut');
    this.fact.textContent = t(`travel.fact${(this.factIndex++ % 4) + 1}`);
    this.el.hidden = false;
    const start = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / (FLIGHT_SECONDS * 1000));
      this.fill.style.width = `${Math.round(k * 100)}%`;
      this.plane.style.setProperty('--k', String(k));
      if (k >= 1) return this.finish();
      this.raf = requestAnimationFrame(step);
    };
    step();
  }

  /** Lands now (also the overlay's close). */
  finish(): void {
    cancelAnimationFrame(this.raf);
    if (this.el.hidden) return;
    this.el.hidden = true;
    const d = this.done;
    this.done = null;
    d?.();
  }
}
