import type { RecipeStep, ServiceRun } from '../core/Service';
import { t } from '../i18n';
import { h } from './dom';

export interface ServiceHooks {
  step(s: RecipeStep): boolean;
  serve(): void;
  /** Close early: whoever waits goes home. */
  end(): void;
}

/**
 * The counter panel during a business day: the clock, the cups left, the
 * till, the first customer's order with how patient they still are, the
 * drink (or pizza) taking shape, and one big button per recipe step. The
 * next step glows, so younger players always know what to press.
 */
export class ServiceView {
  readonly el: HTMLDivElement;
  private clock: HTMLElement;
  private stock: HTMLElement;
  private till: HTMLElement;
  private order: HTMLElement;
  private patience: HTMLSpanElement;
  private lineInfo: HTMLElement;
  private dish: HTMLDivElement;
  private steps: HTMLDivElement;
  private serveBtn: HTMLButtonElement;
  private note: HTMLElement;
  private recipe = '';
  private price = 0;

  constructor(private hooks: ServiceHooks) {
    this.clock = h('strong', { class: 'svc-clock' });
    this.stock = h('span', { class: 'svc-chip' });
    this.till = h('span', { class: 'svc-chip gold' });
    this.order = h('strong', { class: 'svc-order' });
    this.patience = h('span');
    this.lineInfo = h('span', { class: 'svc-line' });
    this.dish = h('div', { class: 'svc-dish', 'aria-hidden': 'true' });
    this.steps = h('div', { class: 'svc-steps' });
    this.note = h('div', { class: 'svc-note', role: 'status' });
    this.serveBtn = h('button', { class: 'primary-btn svc-serve', type: 'button', onclick: () => this.hooks.serve() }, [t('service.serve')]);
    const end = h('button', { class: 'secondary-btn svc-end', type: 'button', onclick: () => this.hooks.end() }, [t('service.closeEarly')]);
    this.el = h('div', { class: 'svc-panel', hidden: true, role: 'region', 'aria-label': t('service.title') }, [
      h('div', { class: 'svc-top' }, [this.clock, this.stock, this.till, end]),
      h('div', { class: 'svc-main' }, [
        this.dish,
        h('div', { class: 'svc-customer' }, [this.order, h('div', { class: 'svc-patience' }, [this.patience]), this.lineInfo]),
      ]),
      this.steps,
      this.serveBtn,
      this.note,
    ]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(run: ServiceRun, price: number): void {
    this.recipe = run.recipe.id;
    this.price = price;
    this.dish.className = `svc-dish ${run.recipe.id}`;
    this.dish.replaceChildren(...run.recipe.steps.map((s) => h('i', { class: `layer ${s}` })));
    this.steps.replaceChildren(
      ...run.recipe.steps.map((s, i) =>
        h(
          'button',
          {
            class: `svc-step ${s}`,
            type: 'button',
            'data-step': s,
            onclick: (e: Event) => {
              const b = e.currentTarget as HTMLElement;
              if (!this.hooks.step(s)) {
                b.classList.remove('wrong');
                void b.offsetWidth;
                b.classList.add('wrong');
              }
            },
          },
          [h('span', { class: 'svc-num' }, [String(i + 1)]), t(`service.step.${s}`)],
        ),
      ),
    );
    this.note.textContent = t(`service.hint.${run.recipe.id}`);
    this.el.hidden = false;
    this.render(run, 0);
  }

  hide(): void {
    this.el.hidden = true;
  }

  say(text: string): void {
    this.note.textContent = text;
  }

  render(run: ServiceRun, till: number): void {
    const k = Math.min(1, run.time / run.seconds);
    const minutes = 9 * 60 + Math.round(k * 8 * 60);
    this.clock.textContent = run.time >= run.seconds ? t('service.closing') : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
    this.stock.textContent = t(`service.stock.${this.recipe}`, { n: run.stock });
    this.till.textContent = t('service.till', { n: till });
    const first = run.line[0];
    if (first) {
      this.order.textContent = t(`service.wants.${this.recipe}`, { n: first.order.cups, pay: first.order.cups * this.price });
      const left = Math.max(0, 1 - first.waited / first.order.patience);
      this.patience.style.width = `${Math.round(left * 100)}%`;
      this.patience.className = left < 0.3 ? 'low' : left < 0.6 ? 'mid' : '';
    } else {
      this.order.textContent = run.time >= run.seconds ? t('service.lastOne') : t('service.nobody');
      this.patience.style.width = '0%';
    }
    this.lineInfo.textContent = run.line.length > 1 ? t('service.inLine', { n: run.line.length - 1 }) : '';
    this.dish.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < run.progress));
    this.dish.classList.toggle('baking', run.waiting > 0);
    this.dish.classList.toggle('ready', run.ready);
    this.steps.querySelectorAll<HTMLButtonElement>('.svc-step').forEach((b) => {
      b.classList.toggle('next', b.dataset.step === run.nextStep && run.waiting <= 0);
      b.classList.toggle('done', run.recipe.steps.indexOf(b.dataset.step as RecipeStep) < run.progress);
    });
    this.serveBtn.disabled = !run.ready || !first;
    this.serveBtn.classList.toggle('next', run.ready && !!first);
  }
}
