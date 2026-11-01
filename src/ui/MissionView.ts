import { BUILDING_MISSIONS, TIER_RULES, type MissionBuilding } from '../content/missions/buildings';
import { isRight, tierState, type Grade, type MissionRecord } from '../core/BuildingMissions';
import { t } from '../i18n';
import { h, iconButton } from './dom';

export interface MissionHooks {
  level(): number;
  record(): MissionRecord;
  /** A tier was finished; the game grades, records, rewards and saves. */
  onFinish(b: MissionBuilding, tier: number, answers: number[]): { grade: Grade; firstPass: boolean; xp: number; coins: number };
  onClose(): void;
}

/**
 * The building missions panel: the three tiers (with why a locked one is
 * locked), a quiz of three questions with an explanation after each answer,
 * and the result. Rules live in core/BuildingMissions; text in he.missions.json.
 */
export class MissionView {
  readonly el: HTMLDivElement;
  private panel: HTMLDivElement;
  private b: MissionBuilding = 'bank';
  private room = '';

  constructor(private hooks: MissionHooks) {
    this.panel = h('div', { class: 'modal-panel shop-panel mission-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('bm.title') });
    this.el = h('div', { class: 'modal shop-modal mission-modal', hidden: true }, [this.panel]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(b: MissionBuilding, roomName: string): void {
    this.b = b;
    this.room = roomName;
    this.el.hidden = false;
    this.drawTiers();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.hooks.onClose();
  }

  private frame(title: string, body: (HTMLElement | null)[], actions: HTMLElement[]): void {
    this.panel.replaceChildren(
      iconButton('close', t('hud.close'), () => this.close(), 'modal-close'),
      h('div', { class: 'card-kicker' }, [h('span', { class: 'shop-kicker-icon', 'aria-hidden': 'true' }, ['★']), this.room]),
      h('h2', {}, [title]),
      ...body.filter((x): x is HTMLElement => !!x),
      h('div', { class: 'card-actions shop-actions' }, actions),
    );
    (this.panel.querySelector('.mission-answer, .card-actions button') as HTMLButtonElement | null)?.focus();
  }

  private button(label: string, onClick: () => void, primary = true): HTMLButtonElement {
    return h('button', { class: primary ? 'primary-btn' : 'secondary-btn', type: 'button', onclick: onClick }, [label]);
  }

  private stars(n: number): HTMLElement {
    return h('span', { class: 'shop-stars', role: 'img', 'aria-label': t('shop.stars', { n }) }, [0, 1, 2].map((i) => h('span', { class: i < n ? 'on' : 'off' }, ['★'])));
  }

  /* ------------------------------ tiers ------------------------------ */

  private drawTiers(): void {
    const b = this.b;
    const level = this.hooks.level();
    const rec = this.hooks.record();
    const npc = BUILDING_MISSIONS[b].npc;
    const list = h(
      'div',
      { class: 'mission-tiers' },
      BUILDING_MISSIONS[b].tiers.map((_, ti) => {
        const st = tierState(rec, b, ti, level);
        const locked = st.kind === 'needLevel' || st.kind === 'needPrev';
        const note =
          st.kind === 'needLevel' ? t('bm.needLevel', { n: st.level }) : st.kind === 'needPrev' ? t('bm.needPrev') : st.kind === 'done' ? t('bm.replay') : t('bm.reward', { xp: TIER_RULES[ti].xp, coins: TIER_RULES[ti].coins });
        const btn = h('button', { class: `mission-tier ${locked ? 'locked' : ''} ${st.kind}`, type: 'button', 'data-tier': ti, onclick: () => !locked && this.startQuiz(ti) }, [
          h('span', { class: 'mission-tier-badge', 'aria-hidden': 'true' }, [locked ? '🔒' : String(ti + 1)]),
          h('div', { class: 'mission-tier-text' }, [h('small', {}, [t(`bm.tier.${ti}`)]), h('strong', {}, [t(`bm.${b}.${ti}.title`)]), h('span', {}, [note])]),
          st.kind === 'done' ? this.stars(st.stars) : null,
        ]);
        btn.disabled = locked;
        return btn;
      }),
    );
    this.frame(t('bm.hostTitle', { name: t(`npc.${npc}.short`) }), [h('p', { class: 'card-body' }, [t(`bm.${b}.host`)]), list, h('p', { class: 'shop-note' }, [t('bm.levelNote', { n: level })])], [
      this.button(t('bm.close'), () => this.close(), false),
    ]);
  }

  /* ------------------------------ quiz ------------------------------- */

  private startQuiz(tier: number): void {
    this.ask(tier, 0, []);
  }

  private ask(tier: number, q: number, answers: number[]): void {
    const b = this.b;
    const key = `bm.${b}.${tier}`;
    const n = BUILDING_MISSIONS[b].tiers[tier].correct.length;
    const why = h('p', { class: 'shop-tip mission-why', hidden: true });
    const next = this.button(q + 1 < n ? t('bm.next') : t('bm.finish'), () => (q + 1 < n ? this.ask(tier, q + 1, answers) : this.finish(tier, answers)));
    next.hidden = true;
    const opts = [0, 1, 2].map((k) =>
      h('button', { class: 'mission-answer', type: 'button', 'data-answer': k, onclick: () => choose(k) }, [t(`${key}.q${q}.a${k}`)]),
    );
    const choose = (k: number) => {
      if (answers.length > q) return;
      answers.push(k);
      const ok = isRight(b, tier, q, k);
      opts.forEach((o, i) => {
        o.disabled = true;
        if (isRight(b, tier, q, i)) o.classList.add('right');
        else if (i === k) o.classList.add('wrong');
      });
      why.textContent = `${ok ? t('bm.right') : t('bm.wrong')} ${t(`${key}.q${q}.why`)}`;
      why.hidden = false;
      next.hidden = false;
      next.focus();
    };
    const intro = q === 0 ? h('p', { class: 'card-body' }, [t(`${key}.intro`)]) : null;
    this.frame(t(`${key}.title`), [
      intro,
      h('div', { class: 'mission-progress' }, [t('bm.question', { n: q + 1, total: n })]),
      h('p', { class: 'mission-q' }, [t(`${key}.q${q}`)]),
      h('div', { class: 'mission-answers' }, opts),
      why,
    ], [next]);
  }

  private finish(tier: number, answers: number[]): void {
    const r = this.hooks.onFinish(this.b, tier, answers);
    const g = r.grade;
    const body = [
      h('div', { class: 'shop-stars big', role: 'img', 'aria-label': t('shop.stars', { n: g.stars }) }, [0, 1, 2].map((i) => h('span', { class: i < g.stars ? 'on' : 'off' }, ['★']))),
      h('p', { class: 'card-body' }, [t(g.passed ? 'bm.passed' : 'bm.failed', { right: g.right, total: g.total })]),
      r.firstPass ? h('div', { class: 'card-note' }, [t('bm.got', { xp: r.xp, coins: r.coins })]) : null,
      g.passed && tier + 1 < TIER_RULES.length ? h('p', { class: 'shop-note' }, [t('bm.nextTier', { n: TIER_RULES[tier + 1].minLevel })]) : null,
    ];
    this.frame(t(`bm.${this.b}.${tier}.title`), body, [
      this.button(t('bm.back'), () => this.drawTiers()),
      g.passed ? this.button(t('bm.close'), () => this.close(), false) : this.button(t('bm.retry'), () => this.startQuiz(tier), false),
    ]);
  }
}
