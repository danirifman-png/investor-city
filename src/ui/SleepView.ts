import { t } from '../i18n';
import { h } from './dom';

/** How long a night lasts on screen, in seconds (a Skip button ends it at once). */
export const NIGHT_SECONDS = 7;

/**
 * Sleeping: the screen dims to a starry night over the hero lying in bed,
 * energy fills up, and the morning comes. "Skip" wakes the hero at once with
 * the same result, so sleeping never costs time.
 */
export class SleepView {
  readonly el: HTMLDivElement;
  private fill: HTMLElement;
  private label: HTMLElement;
  private raf = 0;
  private done: (() => void) | null = null;

  constructor() {
    this.fill = h('span', { class: 'sleep-fill' });
    this.label = h('div', { class: 'sleep-label' });
    const skip = h('button', { class: 'primary-btn sleep-skip', type: 'button', onclick: () => this.finish() }, [t('sleep.skip')]);
    this.el = h('div', { class: 'modal sleep-modal', hidden: true, role: 'dialog', 'aria-label': t('sleep.title') }, [
      h('div', { class: 'sleep-sky', 'aria-hidden': 'true' }, [h('span', { class: 'sleep-moon' }, ['🌙']), h('span', { class: 'sleep-z z1' }, ['Z']), h('span', { class: 'sleep-z z2' }, ['z']), h('span', { class: 'sleep-z z3' }, ['z'])]),
      h('div', { class: 'sleep-panel' }, [this.label, h('div', { class: 'sleep-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, [this.fill]), skip]),
    ]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  /** Starts the night; `onDone` runs once, when it ends or is skipped. `from` is the energy before sleeping, `to` after. */
  show(from: number, to: number, onDone: () => void): void {
    this.done = onDone;
    this.el.hidden = false;
    const start = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / (NIGHT_SECONDS * 1000));
      const e = Math.round(from + (to - from) * k);
      this.fill.style.width = `${e}%`;
      this.el.querySelector('.sleep-bar')!.setAttribute('aria-valuenow', String(e));
      this.label.textContent = t('sleep.energy', { n: e });
      if (k >= 1) return this.finish();
      this.raf = requestAnimationFrame(step);
    };
    step();
  }

  /** Wakes up now (also used as the overlay's close). */
  finish(): void {
    cancelAnimationFrame(this.raf);
    if (this.el.hidden) return;
    this.el.hidden = true;
    const d = this.done;
    this.done = null;
    d?.();
  }
}
