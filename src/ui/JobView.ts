import type { JobDef } from '../content/jobs';
import type { JobTask, Payslip } from '../core/Jobs';
import { t } from '../i18n';
import { h, iconButton } from './dom';

export interface JobHooks {
  /** A shift ended with `right` tasks done right; the game pays and returns the payslip. */
  onShiftDone(job: JobDef, right: number): Payslip;
  onClose(): void;
}

/**
 * A shift at a job: an intro with the pay, then the tasks one by one (answer,
 * see why, next), then the payslip with gross, tax and net.
 */
export class JobView {
  readonly el: HTMLDivElement;
  private panel: HTMLDivElement;
  private job: JobDef | null = null;
  private tasks: JobTask[] = [];
  private i = 0;
  private right = 0;

  constructor(private hooks: JobHooks) {
    this.panel = h('div', { class: 'modal-panel job-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('job.kicker') });
    this.el = h('div', { class: 'modal job-modal', hidden: true }, [this.panel]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(job: JobDef, tasks: JobTask[], practice: boolean): void {
    this.job = job;
    this.tasks = tasks;
    this.i = 0;
    this.right = 0;
    this.el.hidden = false;
    this.frame([
      h('p', { class: 'card-body' }, [practice ? t('job.introPractice') : t('job.intro', { n: tasks.length, wage: job.wage, base: job.base })]),
      h('div', { class: 'card-actions' }, [h('button', { class: 'primary-btn job-start', type: 'button', onclick: () => this.drawTask() }, [t('job.start')])]),
    ]);
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.hooks.onClose();
  }

  private frame(body: HTMLElement[]): void {
    this.panel.replaceChildren(
      iconButton('close', t('hud.close'), () => this.close(), 'modal-close'),
      h('div', { class: 'card-kicker' }, [t('job.kicker')]),
      h('h2', {}, [t(`job.${this.job!.id}.name`)]),
      ...body,
    );
  }

  private drawTask(): void {
    const task = this.tasks[this.i];
    const label = (c: number | string) => (typeof c === 'number' ? String(c) : t(c));
    const answers = h(
      'div',
      { class: `job-answers ${task.choices.length === 2 ? 'two' : ''}` },
      task.choices.map((c, k) => h('button', { class: 'job-answer', type: 'button', 'data-k': k, onclick: () => this.answer(k) }, [label(c)])),
    );
    this.frame([
      h('div', { class: 'job-progress' }, [
        h('span', {}, [t('job.taskOf', { i: this.i + 1, n: this.tasks.length })]),
        h('div', { class: 'job-dots' }, this.tasks.map((_, k) => h('i', { class: k < this.i ? 'done' : k === this.i ? 'now' : '' }))),
      ]),
      h('p', { class: 'job-question' }, [t(task.key, task.vars)]),
      answers,
      h('div', { class: 'job-feedback', role: 'status' }),
    ]);
  }

  private answer(k: number): void {
    const task = this.tasks[this.i];
    const ok = k === task.answer;
    if (ok) this.right++;
    this.panel.querySelectorAll<HTMLButtonElement>('.job-answer').forEach((b) => {
      b.disabled = true;
      const n = Number(b.dataset.k);
      if (n === task.answer) b.classList.add('right');
      else if (n === k) b.classList.add('wrong');
    });
    const last = this.i >= this.tasks.length - 1;
    const fb = this.panel.querySelector('.job-feedback')!;
    fb.replaceChildren(
      h('strong', { class: ok ? 'good' : 'bad' }, [ok ? t('job.right') : t('job.wrong')]),
      h('span', {}, [t(task.why, task.vars)]),
      h('button', { class: 'primary-btn job-next', type: 'button', onclick: () => (last ? this.finish() : (this.i++, this.drawTask())) }, [last ? t('job.finish') : t('job.next')]),
    );
    (fb.querySelector('button') as HTMLButtonElement).focus();
  }

  private finish(): void {
    const slip = this.hooks.onShiftDone(this.job!, this.right);
    const line = (label: string, value: string, cls = '') => h('div', { class: `shop-line ${cls}` }, [h('span', {}, [label]), h('strong', {}, [value])]);
    const coins = (n: number) => t('shop.coins', { n });
    this.frame([
      h('div', { class: 'job-slip' }, [
        h('div', { class: 'job-slip-title' }, [t('job.slip.title')]),
        line(t('job.slip.right'), t('job.slip.outOf', { n: slip.right, total: slip.tasks })),
        line(t('job.slip.base'), coins(slip.base)),
        line(t('job.slip.wages'), coins(slip.wages)),
        line(t('job.slip.gross'), coins(slip.gross), 'plus'),
        ...(slip.tax ? [line(t('job.slip.tax'), `-${coins(slip.tax)}`, 'minus')] : []),
        line(t('job.slip.net'), coins(slip.net), 'profit good'),
      ]),
      ...(slip.tax ? [h('p', { class: 'shop-note' }, [t('job.slip.taxNote')])] : []),
      ...(!slip.paid ? [h('p', { class: 'shop-tip' }, [t('job.slip.practice')])] : []),
      h('p', { class: 'shop-note' }, [t('job.slip.tired')]),
      h('div', { class: 'card-actions' }, [h('button', { class: 'primary-btn', type: 'button', onclick: () => this.close() }, [t('job.done')])]),
    ]);
  }
}
