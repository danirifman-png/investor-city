import type { Line } from '../core/Social';
import { NPCS } from '../content/npcs';
import { t } from '../i18n';
import { h, iconButton } from './dom';
import { NPC_EMOJI } from './npcStyle';

export interface DialogueViewOptions {
  onChoose(index: number): void;
  onNext(): void;
  onClose(): void;
}

const CHARS_PER_SECOND = 55;

/**
 * The conversation screen: a sheet at the bottom with the speaker, their
 * line (typed out), and the player's possible answers. Keyboard: 1-9 picks
 * an answer, Space/Enter continues or skips the typing, Escape leaves.
 */
export class DialogueView {
  readonly el: HTMLDivElement;
  private portrait: HTMLDivElement;
  private nameEl: HTMLElement;
  private roleEl: HTMLElement;
  private relEl: HTMLDivElement;
  private textEl: HTMLParagraphElement;
  private actions: HTMLDivElement;
  private repFx: HTMLDivElement;
  private full = '';
  private shown = 0;
  private timer = 0;
  private line: Line | null = null;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

  constructor(private o: DialogueViewOptions) {
    this.portrait = h('div', { class: 'dlg-portrait', 'aria-hidden': 'true' });
    this.nameEl = h('strong', { class: 'dlg-name' });
    this.roleEl = h('span', { class: 'dlg-role' });
    this.relEl = h('div', { class: 'dlg-rel' });
    this.repFx = h('div', { class: 'dlg-repfx', 'aria-live': 'polite' });
    this.textEl = h('p', { class: 'dlg-text' });
    this.textEl.addEventListener('click', () => this.skip());
    this.actions = h('div', { class: 'dlg-actions' });
    const close = iconButton('close', t('dialog.close'), () => o.onClose(), 'dlg-close');
    this.el = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'false', hidden: true }, [
      h('div', { class: 'dlg-head' }, [this.portrait, h('div', { class: 'dlg-who' }, [this.nameEl, this.roleEl]), this.relEl, close]),
      this.repFx,
      this.textEl,
      this.actions,
    ]);
    // taps inside the sheet must not reach the 3D view
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(line: Line, vars: Record<string, string>, repLevel: number): void {
    const def = NPCS[line.npc];
    const opening = this.el.hidden;
    this.el.hidden = false;
    if (opening) window.addEventListener('keydown', this.keyHandler);
    this.el.style.setProperty('--npc', def.color);
    this.el.dataset.npc = line.npc;
    this.el.dataset.node = line.nodeId;
    this.portrait.textContent = NPC_EMOJI[line.npc];
    this.nameEl.textContent = t(`npc.${line.npc}.name`);
    this.roleEl.textContent = t(`npc.${line.npc}.role`);
    this.setRelation(repLevel);
    this.line = line;
    this.full = t(line.textKey, vars);
    this.shown = 0;
    this.textEl.textContent = '';
    this.textEl.classList.add('typing');
    this.actions.replaceChildren();
    clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      this.shown = Math.min(this.full.length, this.shown + 2);
      this.textEl.textContent = this.full.slice(0, this.shown);
      if (this.shown >= this.full.length) this.finishTyping();
    }, 2000 / CHARS_PER_SECOND);
  }

  setRelation(level: number): void {
    this.relEl.replaceChildren(
      ...[0, 1, 2, 3].map((i) => h('i', { class: i <= level ? 'on' : '' })),
      h('span', {}, [t(`rep.level.${level}`)]),
    );
    this.relEl.title = t('people.relation');
  }

  /** Floating "+ likes you more" / "- offended" note. */
  flashRep(text: string, up: boolean): void {
    this.repFx.textContent = `${up ? '▲' : '▼'} ${text}`;
    this.repFx.className = `dlg-repfx ${up ? 'up' : 'down'}`;
    void this.repFx.offsetWidth;
    this.repFx.classList.add('show');
  }

  hide(): void {
    this.el.hidden = true;
    clearInterval(this.timer);
    window.removeEventListener('keydown', this.keyHandler);
    this.line = null;
  }

  private get typing(): boolean {
    return this.shown < this.full.length;
  }

  private skip(): void {
    if (!this.typing) return;
    this.shown = this.full.length;
    this.textEl.textContent = this.full;
    this.finishTyping();
  }

  private finishTyping(): void {
    clearInterval(this.timer);
    this.textEl.classList.remove('typing');
    const line = this.line;
    if (!line) return;
    if (line.choices.length) {
      this.actions.replaceChildren(
        ...line.choices.map((c, i) => {
          const b = h('button', { class: `dlg-choice tone-${c.tone ?? 'none'}`, type: 'button', 'data-choice': String(c.index) }, [
            h('span', { class: 'dlg-num' }, [String(i + 1)]),
            h('span', { class: 'dlg-choice-text' }, [t(c.textKey)]),
          ]);
          b.addEventListener('click', () => this.o.onChoose(c.index));
          return b;
        }),
      );
    } else {
      const b = h('button', { class: 'primary-btn dlg-next', type: 'button' }, [t(line.end ? 'dialog.end' : 'dialog.continue')]);
      b.addEventListener('click', () => this.o.onNext());
      this.actions.replaceChildren(b);
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (this.el.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.o.onClose();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (this.typing) this.skip();
      else if (this.line && !this.line.choices.length) this.o.onNext();
      return;
    }
    const n = Number(e.key);
    if (!this.typing && this.line && n >= 1 && n <= this.line.choices.length) {
      e.preventDefault();
      this.o.onChoose(this.line.choices[n - 1].index);
    }
  }
}
