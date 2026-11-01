import { ITEMS, type ItemId } from '../content/items';
import type { NpcId } from '../content/npcs';
import { QUESTS, type QuestDef } from '../content/quests';
import { levelInfo, type ProgressionState, type QuestProgress, type Reward } from '../core/Progression';
import type { Settings } from '../core/Save';
import { t } from '../i18n';
import { h, iconButton } from './dom';
import { NPC_EMOJI } from './npcStyle';

/**
 * The progression UI: the player card (portrait, level, XP bar, coins), the
 * quest log, the bag, the settings panel and the "Quest complete!" screen.
 * Rules live in core/Progression.ts; this file only shows them.
 */

/* ------------------------------ player card ------------------------------ */

export class PlayerCard {
  readonly el: HTMLButtonElement;
  private face = h('span', { class: 'pc-face', 'aria-hidden': 'true' });
  private name = h('span', { class: 'pc-name' });
  private level = h('span', { class: 'pc-level' });
  private fill = h('span', { class: 'pc-xp-fill' });
  private xpText = h('span', { class: 'pc-xp-text' });
  private coins = h('span', { class: 'pc-coins-n' });
  private stars = h('span', { class: 'pc-stars-n' });
  private shown = { xp: -1, coins: -1 };
  private needs = h('span', { class: 'pc-needs' });
  private needFill: Record<string, HTMLElement> = {};

  constructor(onClick: () => void) {
    this.el = h('button', { class: 'player-card', type: 'button', 'aria-label': t('hud.quests') }, [
      h('span', { class: 'pc-portrait' }, [this.face, this.level]),
      h('span', { class: 'pc-main' }, [
        h('span', { class: 'pc-pills' }, [
          h('span', { class: 'pc-pill pc-star', title: t('complete.xp') }, [h('span', { class: 'pc-star-icon', 'aria-hidden': 'true' }, ['★']), this.stars]),
          h('span', { class: 'pc-pill pc-coins', title: t('hud.coins') }, [h('span', { class: 'pc-coin', 'aria-hidden': 'true' }), this.coins]),
        ]),
        h('span', { class: 'pc-xp', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, [this.fill]),
        h('span', { class: 'pc-top' }, [this.name, this.xpText]),
        this.needs,
      ]),
    ]);
    for (const [id, icon] of [['energy', '⚡'], ['food', '🍔'], ['water', '💧']] as const) {
      const fill = h('span', { class: 'pc-need-fill' });
      this.needFill[id] = fill;
      this.needs.append(h('span', { class: `pc-need ${id}`, title: t(`needs.${id}`) }, [h('span', { class: 'pc-need-icon', 'aria-hidden': 'true' }, [icon]), h('span', { class: 'pc-need-bar' }, [fill])]));
    }
    this.el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  }

  /** Energy, food and water, 0 to 100 (low ones blink gently). */
  setNeeds(n: { energy: number; food: number; water: number }): void {
    for (const id of ['energy', 'food', 'water'] as const) {
      const v = Math.round(n[id]);
      const el = this.needFill[id];
      el.style.width = `${v}%`;
      el.parentElement!.parentElement!.classList.toggle('low', v < 25);
      el.parentElement!.parentElement!.setAttribute('aria-label', `${t(`needs.${id}`)} ${v}%`);
    }
  }

  update(nickname: string, color: string, p: ProgressionState): void {
    this.face.textContent = (nickname.trim()[0] ?? '?').toUpperCase();
    void color;
    this.name.textContent = nickname || '...';
    const L = levelInfo(p.xp);
    this.level.textContent = String(L.level);
    this.level.title = t('hud.level', { n: L.level });
    this.fill.style.width = `${Math.round(L.frac * 100)}%`;
    this.el.querySelector('.pc-xp')!.setAttribute('aria-valuenow', String(Math.round(L.frac * 100)));
    this.xpText.textContent = L.max ? t('hud.xpMax') : t('hud.xp', { into: L.into, need: L.need });
    this.coins.textContent = p.coins.toLocaleString('en-US');
    this.stars.textContent = p.xp.toLocaleString('en-US');
    if (this.shown.xp >= 0 && p.xp > this.shown.xp) this.pop(`+${p.xp - this.shown.xp} XP`, 'xp');
    if (this.shown.coins >= 0 && p.coins > this.shown.coins) this.pop(`+${p.coins - this.shown.coins}`, 'coin');
    this.shown = { xp: p.xp, coins: p.coins };
  }

  /** A short celebration on the card itself (does not take over the toast line). */
  levelUp(text: string): void {
    this.pop(text, 'level');
    this.el.classList.remove('leveled');
    void this.el.offsetWidth;
    this.el.classList.add('leveled');
  }

  private pop(text: string, kind: 'xp' | 'coin' | 'level'): void {
    const el = h('span', { class: `pc-pop pc-pop-${kind}`, 'aria-hidden': 'true' }, [text]);
    this.el.append(el);
    window.setTimeout(() => el.remove(), 1600);
  }
}

/* ------------------------------- modals -------------------------------- */

function modal(cls: string, title: string, onClose: () => void, body: HTMLElement): HTMLDivElement {
  const panel = h('div', { class: `modal-panel ${cls}-panel`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
    iconButton('close', t('hud.close'), onClose, 'modal-close'),
    h('h2', {}, [title]),
    body,
  ]);
  const el = h('div', { class: `modal ${cls}-modal`, hidden: true }, [panel]);
  el.addEventListener('click', (e) => e.target === el && onClose());
  return el;
}

export interface QuestLogView {
  growth: ProgressionState;
  /** Errands: [npc, state] for every errand that was offered. */
  errands: { npc: NpcId; state: 'active' | 'ready' | 'done' }[];
  /** Marco's branch mission line, or null when it is not running. */
  mission: { line: string; done: boolean } | null;
}

function stepText(def: QuestDef, i: number, q: QuestProgress | undefined): string {
  const step = def.steps[i];
  let text = t(`quest.${def.id}.step.${step.id}`);
  if (q && q.status === 'active' && i === q.step && step.goal.kind === 'visit' && step.goal.pois.length > 1) {
    text += ` (${t('quests.progress', { n: q.seen.length, total: step.goal.pois.length })})`;
  }
  return text;
}

/** One line for the HUD tracker: the active quest's current step. */
export function questTracker(p: ProgressionState): { title: string; goal: string } | null {
  for (const def of QUESTS) {
    const q = p.quests[def.id];
    if (q?.status === 'active') return { title: t(`quest.${def.id}.title`), goal: stepText(def, q.step, q) };
  }
  return null;
}

export class QuestLog {
  readonly el: HTMLDivElement;
  private body = h('div', { class: 'ql-body' });

  constructor(private o: { view(): QuestLogView | null; onGoTo(npc: NpcId): void; onMission(): void; onClose(): void }) {
    this.el = modal('ql', t('quests.title'), () => o.onClose(), this.body);
  }

  show(): void {
    this.el.hidden = false;
    this.render();
  }

  hide(): void {
    this.el.hidden = true;
  }

  render(): void {
    const v = this.o.view();
    if (!v) return;
    const active: HTMLElement[] = [];
    const done: HTMLElement[] = [];
    for (const def of QUESTS) {
      const q = v.growth.quests[def.id];
      if (!q) continue;
      const card = this.questCard(def, q);
      (q.status === 'done' ? done : active).push(card);
    }
    if (v.mission && !v.mission.done) {
      active.push(
        h('div', { class: 'ql-quest ql-mission' }, [
          h('div', { class: 'ql-head' }, [h('span', { class: 'ql-icon' }, [NPC_EMOJI.marco]), h('strong', {}, [t('quests.branch')])]),
          h('p', { class: 'ql-step now' }, [v.mission.line]),
          h('button', { class: 'ql-go', type: 'button', onclick: () => this.o.onMission() }, [t('card.openNotebook')]),
        ]),
      );
    }
    const errands = v.errands.filter((e) => e.state !== 'done');
    const sections: HTMLElement[] = [
      h('h3', {}, [t('quests.active')]),
      ...(active.length ? active : [h('p', { class: 'ql-empty' }, [t('quests.none')])]),
    ];
    if (errands.length) {
      sections.push(h('h3', {}, [t('quests.errands')]));
      for (const e of errands) {
        sections.push(
          h('div', { class: `ql-errand ${e.state}` }, [
            h('span', { class: 'ql-icon' }, [NPC_EMOJI[e.npc]]),
            h('span', {}, [h('strong', {}, [t(`errand.${e.npc}.title`)]), h('br'), e.state === 'ready' ? t('errand.ready', { name: t(`npc.${e.npc}.short`) }) : t(`errand.${e.npc}.goal`)]),
            h('button', { class: 'ql-go small', type: 'button', onclick: () => this.o.onGoTo(e.npc) }, [t('quests.go')]),
          ]),
        );
      }
    }
    if (done.length || v.mission?.done) {
      sections.push(h('h3', {}, [t('quests.done')]), ...done);
      if (v.mission?.done) sections.push(h('div', { class: 'ql-quest done' }, [h('div', { class: 'ql-head' }, [h('span', { class: 'ql-icon' }, ['✓']), h('strong', {}, [t('quests.branch')])])]));
    }
    this.body.replaceChildren(...sections);
  }

  private questCard(def: QuestDef, q: QuestProgress): HTMLElement {
    const steps = def.steps.map((_, i) => {
      const state = q.status === 'done' || i < q.step ? 'done' : i === q.step ? 'now' : 'later';
      return h('li', { class: `ql-step ${state}`, 'data-step': def.steps[i].id }, [h('span', { class: 'ql-check', 'aria-hidden': 'true' }, [state === 'done' ? '✓' : state === 'now' ? '●' : '○']), stepText(def, i, q)]);
    });
    const r = def.reward;
    return h('div', { class: `ql-quest ${q.status}`, 'data-quest': def.id }, [
      h('div', { class: 'ql-head' }, [h('span', { class: 'ql-icon' }, [def.giver ? NPC_EMOJI[def.giver] : '★']), h('strong', {}, [t(`quest.${def.id}.title`)])]),
      q.status === 'active' ? h('p', { class: 'ql-desc' }, [t(`quest.${def.id}.desc`)]) : null,
      h('ol', { class: 'ql-steps' }, steps),
      h('p', { class: 'ql-reward' }, [t('quests.reward', { xp: r.xp, coins: r.coins }), ...(r.items ?? []).map((it) => ` ${ITEMS[it].icon}`)]),
      q.status === 'active' && def.giver ? h('button', { class: 'ql-go', type: 'button', onclick: () => this.o.onGoTo(def.giver!) }, [t('quests.go')]) : null,
    ]);
  }
}

/* --------------------------------- bag ---------------------------------- */

export class Bag {
  readonly el: HTMLDivElement;
  private body = h('div', { class: 'bag-body' });
  private picked: ItemId | null = null;

  constructor(private o: { view(): ProgressionState | null; onClose(): void }) {
    this.el = modal('bag', t('bag.title'), () => o.onClose(), this.body);
  }

  show(): void {
    this.el.hidden = false;
    this.picked = null;
    this.render();
  }

  hide(): void {
    this.el.hidden = true;
  }

  private render(): void {
    const p = this.o.view();
    if (!p) return;
    const slots = p.items.map((id) => {
      const b = h('button', { class: `bag-slot${this.picked === id ? ' on' : ''}`, type: 'button', 'data-item': id, 'aria-label': t(`item.${id}.name`) }, [
        h('span', { class: 'bag-icon', 'aria-hidden': 'true' }, [ITEMS[id].icon]),
        h('span', { class: 'bag-name' }, [t(`item.${id}.name`)]),
      ]);
      b.addEventListener('click', () => {
        this.picked = id;
        this.render();
      });
      return b;
    });
    // empty slots so the bag reads as a bag
    while (slots.length < 8) slots.push(h('div', { class: 'bag-slot empty', 'aria-hidden': 'true' }) as unknown as HTMLButtonElement);
    const parts: (HTMLElement | null)[] = [
      h('p', { class: 'bag-coins' }, [h('span', { class: 'pc-coin', 'aria-hidden': 'true' }), t('bag.coins', { n: p.coins })]),
      p.items.length ? null : h('p', { class: 'bag-empty' }, [t('bag.empty')]),
      h('div', { class: 'bag-grid' }, slots),
      this.picked ? h('div', { class: 'bag-detail' }, [h('strong', {}, [`${ITEMS[this.picked].icon} ${t(`item.${this.picked}.name`)}`]), h('p', {}, [t(`item.${this.picked}.desc`)])]) : null,
      h('p', { class: 'bag-note' }, [t('bag.note')]),
    ];
    this.body.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
  }
}

/* ------------------------------- settings ------------------------------- */

export class SettingsPanel {
  readonly el: HTMLDivElement;
  private body = h('div', { class: 'set-body' });
  private confirming = false;

  constructor(
    private o: {
      view(): Settings | null;
      quality: 'high' | 'low';
      onChange(s: Partial<Settings>): void;
      onReset(): void;
      onClose(): void;
    },
  ) {
    this.el = modal('set', t('settings.title'), () => o.onClose(), this.body);
  }

  show(): void {
    this.el.hidden = false;
    this.confirming = false;
    this.render();
  }

  hide(): void {
    this.el.hidden = true;
  }

  private render(): void {
    const s = this.o.view();
    if (!s) return;
    const toggle = (key: 'night' | 'bubbles' | 'calm' | 'guide') => {
      const input = h('input', { type: 'checkbox', 'data-setting': key }) as HTMLInputElement;
      input.checked = s[key];
      input.addEventListener('change', () => this.o.onChange({ [key]: input.checked }));
      return h('label', { class: 'set-row' }, [input, h('span', {}, [t(`settings.${key}`)])]);
    };
    const speed = h('input', { type: 'range', min: '0.5', max: '2', step: '0.25', value: String(s.camSpeed), 'data-setting': 'camSpeed' }) as HTMLInputElement;
    speed.addEventListener('input', () => this.o.onChange({ camSpeed: Number(speed.value) }));
    const reset = this.confirming
      ? h('div', { class: 'set-confirm' }, [
          h('p', {}, [t('settings.resetConfirm')]),
          h('button', { class: 'secondary-btn danger', type: 'button', onclick: () => this.o.onReset() }, [t('settings.resetYes')]),
          h('button', { class: 'secondary-btn', type: 'button', onclick: () => ((this.confirming = false), this.render()) }, [t('settings.close')]),
        ])
      : h('button', { class: 'secondary-btn set-reset', type: 'button', onclick: () => ((this.confirming = true), this.render()) }, [t('settings.reset')]);
    this.body.replaceChildren(
      toggle('night'),
      toggle('bubbles'),
      toggle('guide'),
      toggle('calm'),
      h('label', { class: 'set-row set-range' }, [h('span', {}, [t('settings.camSpeed')]), speed]),
      h('p', { class: 'set-quality' }, [t('settings.quality', { q: t(this.o.quality === 'high' ? 'settings.qualityHigh' : 'settings.qualityLow') }), h('br'), h('small', {}, [t('settings.qualityHint')])]),
      reset,
    );
  }
}

/* ---------------------------- quest complete ---------------------------- */

export class CompleteScreen {
  readonly el: HTMLDivElement;
  private panel = h('div', { class: 'qc-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('complete.title') });
  private queue: (() => void)[] = [];

  constructor(private onClose: () => void) {
    this.el = h('div', { class: 'modal qc-modal', hidden: true }, [this.panel]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(questId: string, r: Reward, level: number, levelUp: boolean, bonus: boolean): void {
    const run = () => {
      const confetti = h('div', { class: 'qc-confetti', 'aria-hidden': 'true' });
      for (let i = 0; i < 28; i++) {
        const c = h('i', { style: { left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.12}s`, background: ['#ffd84d', '#ff6b8a', '#4fc79a', '#3fb6e8', '#a57cf2'][i % 5] } });
        confetti.append(c);
      }
      const rows: HTMLElement[] = [
        h('div', { class: 'qc-row qc-xp' }, [h('span', { class: 'qc-big' }, [`+${r.xp}`]), h('span', {}, [t('complete.xp')])]),
        h('div', { class: 'qc-row qc-coins' }, [h('span', { class: 'pc-coin', 'aria-hidden': 'true' }), h('span', { class: 'qc-big' }, [`+${r.coins}`]), h('span', {}, [t('complete.coins')])]),
      ];
      if (r.items.length) rows.push(h('div', { class: 'qc-row qc-items' }, [h('span', {}, [t('complete.items')]), ...r.items.map((it) => h('span', { class: 'qc-item' }, [`${ITEMS[it].icon} ${t(`item.${it}.name`)}`]))]));
      if (r.unlock.length) rows.push(h('div', { class: 'qc-row qc-unlock' }, [h('span', {}, [`🔓 ${t('complete.unlock')}: `]), h('strong', {}, [r.unlock.map((a) => t(`area.${a}`)).join(', ')])]));
      const parts: (HTMLElement | null)[] = [
        confetti,
        h('div', { class: 'qc-stars', 'aria-hidden': 'true' }, ['★', '★', '★'].map((s) => h('span', {}, [s]))),
        h('h2', { class: 'qc-title' }, [t('complete.title')]),
        h('p', { class: 'qc-quest' }, [t(`quest.${questId}.title`)]),
        ...rows,
        bonus ? h('p', { class: 'qc-bonus' }, [t('complete.bonus')]) : null,
        levelUp ? h('p', { class: 'qc-level' }, [t('complete.levelUp', { level })]) : null,
        h('button', { class: 'primary-btn qc-ok', type: 'button', onclick: () => this.close() }, [t('complete.ok')]),
      ];
      this.panel.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
      this.el.hidden = false;
      (this.panel.querySelector('.qc-ok') as HTMLButtonElement).focus();
    };
    if (this.open) this.queue.push(run);
    else run();
  }

  close(): void {
    this.el.hidden = true;
    const next = this.queue.shift();
    if (next) next();
    else this.onClose();
  }
}
