import { t } from '../i18n';
import { h } from './dom';

/**
 * A short first-play guide: walk, jump, go into a building, then meet the
 * mentor. Each step finishes by doing it (never by a timer), and the player
 * can skip at any time. Once finished or skipped it never shows again on
 * this device.
 */

export type CoachStep = 'move' | 'jump' | 'enter' | 'talk';
const STEPS: CoachStep[] = ['move', 'jump', 'enter', 'talk'];
const KEY = 'investor-city.coachDone';

export class Coach {
  readonly el: HTMLDivElement;
  private text: HTMLDivElement;
  private dots: HTMLSpanElement[];
  private step = -1;
  private walked = 0;

  constructor(private touch: boolean) {
    this.text = h('div', { class: 'coach-text' });
    this.dots = STEPS.map(() => h('span', { class: 'coach-dot' }));
    const skip = h('button', { class: 'coach-skip', type: 'button' }, [t('coach.skip')]);
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish();
    });
    this.el = h('div', { class: 'coach', role: 'status', 'aria-live': 'polite', hidden: true }, [
      this.text,
      h('div', { class: 'coach-foot' }, [h('div', { class: 'coach-dots' }, this.dots), skip]),
    ]);
  }

  static isDone(): boolean {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  }

  get active(): boolean {
    return this.step >= 0;
  }

  start(): void {
    if (Coach.isDone() || this.active) return;
    this.show(0);
  }

  /** Metres walked this frame. */
  moved(m: number): void {
    if (STEPS[this.step] !== 'move') return;
    this.walked += m;
    if (this.walked > 6) this.next();
  }

  /** Something the player did. */
  did(what: CoachStep): void {
    if (!this.active) return;
    // doing a later step early also counts for the steps before it
    const i = STEPS.indexOf(what);
    if (i < this.step) return;
    this.step = i;
    this.next();
  }

  private next(): void {
    if (this.step + 1 >= STEPS.length) this.finish();
    else this.show(this.step + 1);
  }

  private show(i: number): void {
    this.step = i;
    const step = STEPS[i];
    const device = this.touch ? 'touch' : 'desktop';
    this.text.textContent = t(`coach.${step}.${device}`);
    this.dots.forEach((d, k) => d.classList.toggle('on', k <= i));
    this.el.hidden = false;
    this.el.classList.remove('pop');
    void this.el.offsetWidth;
    this.el.classList.add('pop');
  }

  private finish(): void {
    this.step = -1;
    this.el.hidden = true;
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // shows again next time; harmless
    }
  }
}
