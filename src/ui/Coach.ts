import { t } from '../i18n';
import { h } from './dom';

/**
 * Short guided lessons. Each step finishes by doing it (never by a timer),
 * the button it talks about pulses, and the player can skip at any time. A
 * finished or skipped lesson never shows again on this device.
 *
 *  - basics: walk, jump, find Bit the robot, go into a building, talk to someone.
 *  - business: walk to the lemonade stand, open it, run a first day.
 *  - money: open the money panel, put coins in savings, look at shares, buy one.
 *  - shop: walk into the mall (or the market) and buy something.
 */

export type CoachStep = 'move' | 'jump' | 'findBit' | 'enter' | 'talk' | 'goBiz' | 'openBiz' | 'bizDay' | 'openMoney' | 'deposit' | 'sharesTab' | 'buyShare' | 'openStore' | 'buyItem';
export type Lesson = 'basics' | 'business' | 'money' | 'shop';

const LESSONS: Record<Lesson, CoachStep[]> = {
  basics: ['move', 'jump', 'findBit', 'enter', 'talk'],
  business: ['goBiz', 'openBiz', 'bizDay'],
  money: ['openMoney', 'deposit', 'sharesTab', 'buyShare'],
  shop: ['openStore', 'buyItem'],
};

/** The control each step is about; it pulses while the step is shown. */
const HIGHLIGHT: Partial<Record<CoachStep, string>> = {
  jump: '.jump-btn',
  bizDay: '.biz-panel .shop-actions button',
  openMoney: '.btn-money',
  deposit: '.money-deposit',
  sharesTab: '.money-tab[data-tab="shares"]',
  buyShare: '.stock-buy',
  buyItem: '.store-card:not(.locked) .shop-price:not([disabled])',
};

const KEY = 'investor-city.coach.';

export class Coach {
  readonly el: HTMLDivElement;
  private text: HTMLDivElement;
  private dotsEl: HTMLDivElement;
  private lesson: Lesson | null = null;
  private step = -1;
  private walked = 0;

  constructor(private touch: boolean) {
    this.text = h('div', { class: 'coach-text' });
    this.dotsEl = h('div', { class: 'coach-dots' });
    const skip = h('button', { class: 'coach-skip', type: 'button' }, [t('coach.skip')]);
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish();
    });
    this.el = h('div', { class: 'coach', role: 'status', 'aria-live': 'polite', hidden: true }, [this.text, h('div', { class: 'coach-foot' }, [this.dotsEl, skip])]);
    // keep the highlight on the right button as panels open and redraw
    window.setInterval(() => this.highlight(), 400);
  }

  static isDone(lesson: Lesson): boolean {
    try {
      // the first version stored the basics under another key
      return localStorage.getItem(KEY + lesson) === '1' || (lesson === 'basics' && localStorage.getItem('investor-city.coachDone') === '1');
    } catch {
      return false;
    }
  }

  get active(): boolean {
    return this.lesson !== null;
  }

  /** Starts a lesson unless one is running or this one was done. */
  start(lesson: Lesson): void {
    if (this.lesson || Coach.isDone(lesson)) return;
    this.lesson = lesson;
    this.walked = 0;
    this.show(0);
  }

  /** Metres walked this frame. */
  moved(m: number): void {
    if (this.current() !== 'move') return;
    this.walked += m;
    if (this.walked > 6) this.next();
  }

  /** Something the player did; doing a later step early also counts for the ones before it. */
  did(what: CoachStep): void {
    if (!this.lesson) return;
    const i = LESSONS[this.lesson].indexOf(what);
    if (i < this.step) return;
    this.step = i;
    this.next();
  }

  /** The step being shown, if any. */
  get step_(): CoachStep | null {
    return this.current();
  }

  private current(): CoachStep | null {
    return this.lesson ? LESSONS[this.lesson][this.step] : null;
  }

  private next(): void {
    if (!this.lesson) return;
    if (this.step + 1 >= LESSONS[this.lesson].length) this.finish();
    else this.show(this.step + 1);
  }

  private show(i: number): void {
    const steps = LESSONS[this.lesson!];
    this.step = i;
    const device = this.touch ? 'touch' : 'desktop';
    const key = `coach.${steps[i]}`;
    this.text.textContent = t(`${key}.${device}`) || t(key);
    this.dotsEl.replaceChildren(...steps.map((_, k) => h('span', { class: `coach-dot${k <= i ? ' on' : ''}` })));
    this.el.hidden = false;
    this.el.classList.remove('pop');
    void this.el.offsetWidth;
    this.el.classList.add('pop');
    this.highlight();
  }

  private highlight(): void {
    for (const el of document.querySelectorAll('.coach-target')) el.classList.remove('coach-target');
    const step = this.current();
    const sel = step && HIGHLIGHT[step];
    if (!sel) return;
    const el = document.querySelector<HTMLElement>(sel);
    // on phones the money button lives in the folded menu: point at the menu first
    if (el && el.offsetParent === null) document.querySelector('.menu-btn')?.classList.add('coach-target');
    else el?.classList.add('coach-target');
  }

  private finish(): void {
    if (this.lesson) {
      try {
        localStorage.setItem(KEY + this.lesson, '1');
      } catch {
        // shows again next time; harmless
      }
    }
    this.lesson = null;
    this.step = -1;
    this.el.hidden = true;
    this.highlight();
  }
}
