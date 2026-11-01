import { t } from '../i18n';
import { h, iconButton } from './dom';

export type CardKind = 'clue' | 'curio' | 'info' | 'concept';

export interface CardContent {
  kind: CardKind;
  /** Small line above the title ("Did you know?", "New clue"...). */
  kicker: string;
  title: string;
  body: string;
  /** A worked example (concepts) or the key numbers (clues). */
  example?: { label: string; text: string };
  /** A tag under the text, e.g. "added to the notebook". */
  note?: string;
  /** An extra button next to "Got it". */
  action?: { label: string; onClick(): void };
}

/**
 * A big readable card for things found in the world: clues, "Did you know?"
 * facts, info boards and newly learned concepts. One card at a time; a new
 * one replaces the old.
 */
export class InfoCard {
  readonly el: HTMLDivElement;
  private panel: HTMLDivElement;

  constructor(private onClose: () => void) {
    this.panel = h('div', { class: 'modal-panel find-card', role: 'dialog', 'aria-modal': 'true' });
    this.el = h('div', { class: 'modal find-modal', hidden: true, onclick: (e: Event) => e.target === this.el && this.close() }, [this.panel]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(c: CardContent): void {
    const ok = h('button', { class: 'primary-btn card-ok', type: 'button' }, [t('card.ok')]);
    ok.addEventListener('click', () => this.close());
    const actions = h('div', { class: 'card-actions' }, [ok]);
    if (c.action) {
      const a = c.action;
      const extra = h('button', { class: 'secondary-btn card-extra', type: 'button' }, [a.label]);
      extra.addEventListener('click', () => {
        this.close();
        a.onClick();
      });
      actions.append(extra);
    }
    this.panel.className = `modal-panel find-card kind-${c.kind}`;
    this.panel.setAttribute('aria-label', c.title);
    const parts: (HTMLElement | null)[] = [
      iconButton('close', t('hud.close'), () => this.close(), 'modal-close'),
      h('div', { class: 'card-kicker' }, [h('span', { class: 'card-icon', 'aria-hidden': 'true' }), c.kicker]),
      h('h2', {}, [c.title]),
      h('p', { class: 'card-body' }, [c.body]),
      c.example ? h('div', { class: 'card-example' }, [h('strong', {}, [c.example.label]), h('span', {}, [c.example.text])]) : null,
      c.note ? h('div', { class: 'card-note' }, [c.note]) : null,
      actions,
    ];
    this.panel.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
    this.el.hidden = false;
    ok.focus();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose();
  }
}
