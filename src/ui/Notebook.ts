import { CONCEPT_IDS } from '../content/concepts';
import { CURIOSITIES } from '../content/curiosities';
import { ADVISORS, CLUE_IDS, MAX_REASONS, OPTION_IDS, QUESTIONS, REASONS, REQUIRED_ADVISORS, RISKS, type OptionId } from '../content/missions/branch';
import type { NpcId } from '../content/npcs';
import { advisorsAsked, answer, currentStep, decide, evaluate, questionDone, riskReport, STEPS, stepOpen, submitRisks, type BranchState, type Evaluation, type Step } from '../core/Mission';
import { t } from '../i18n';
import { h, iconButton } from './dom';
import { NPC_EMOJI } from './npcStyle';

export interface NotebookView {
  branch: BranchState;
  flags: string[];
  concepts: string[];
  curiosities: string[];
  /** The player's level: beginners get the simple words first, experienced players the extra depth. */
  level: number;
}

/**
 * A concept in words that fit the player's experience: levels 1-2 read one
 * simple sentence (the full text one tap away), levels 3-5 the full text,
 * and from level 6 an extra line with the formula or the deeper idea.
 */
export function conceptText(id: string, level: number): HTMLElement[] {
  if (level <= 2) {
    return [
      h('p', { class: 'concept-simple' }, [t(`concept.${id}.simple`)]),
      h('details', { class: 'concept-more' }, [h('summary', {}, [t('concept.more')]), h('p', {}, [t(`concept.${id}.body`)])]),
    ];
  }
  const out = [h('p', {}, [t(`concept.${id}.body`)])];
  if (level >= 6) out.push(h('p', { class: 'concept-deep' }, [t(`concept.${id}.deep`)]));
  return out;
}

export interface NotebookOptions {
  view(): NotebookView | null;
  /** Something in the mission state changed (save, refresh the tracker). */
  onChange(): void;
  /** The recommendation was presented to Marco. */
  onDecided(ev: Evaluation): void;
  onGoToNpc(id: NpcId): void;
  onClose(): void;
}

type Tab = 'mission' | 'concepts' | 'curios';

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

/**
 * The player's notebook: the mission workbook (clues, calculations, advisors,
 * risks, the recommendation and its outcome), the concepts collected so far
 * with explanations and examples, and the "Did you know?" collection.
 * Rules live in core/Mission.ts; this file only shows them and collects input.
 */
export class Notebook {
  readonly el: HTMLDivElement;
  private body: HTMLDivElement;
  private tabs: Record<Tab, HTMLButtonElement>;
  private tab: Tab = 'mission';
  /** Feedback lines that are not part of the saved state ("type a number"). */
  private notes: Record<string, string> = {};
  private picks = { risks: new Set<string>(), option: null as OptionId | null, reasons: new Set<string>() };
  private decideError = '';

  constructor(private o: NotebookOptions) {
    this.body = h('div', { class: 'nb-body' });
    const tab = (id: Tab) => {
      const b = h('button', { class: 'nb-tab', type: 'button', role: 'tab', 'data-tab': id }, [t(`nb.tab.${id}`)]);
      b.addEventListener('click', () => this.show(id));
      return b;
    };
    this.tabs = { mission: tab('mission'), concepts: tab('concepts'), curios: tab('curios') };
    const panel = h('div', { class: 'modal-panel nb-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('nb.title') }, [
      iconButton('close', t('hud.close'), () => o.onClose(), 'modal-close'),
      h('h2', {}, [t('nb.title')]),
      h('div', { class: 'nb-tabs', role: 'tablist' }, Object.values(this.tabs)),
      this.body,
    ]);
    this.el = h('div', { class: 'modal nb-modal', hidden: true, onclick: (e: Event) => e.target === this.el && o.onClose() }, [panel]);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(tab: Tab = this.tab): void {
    this.tab = tab;
    this.el.hidden = false;
    this.render(true);
  }

  hide(): void {
    this.el.hidden = true;
  }

  /** Redraws the current tab; keeps the scroll position unless `top`. */
  render(top = false): void {
    const v = this.o.view();
    if (!v || this.el.hidden) return;
    const scroll = this.body.scrollTop;
    for (const [id, b] of Object.entries(this.tabs)) {
      b.classList.toggle('on', id === this.tab);
      b.setAttribute('aria-selected', String(id === this.tab));
    }
    const content = this.tab === 'mission' ? this.mission(v) : this.tab === 'concepts' ? this.concepts(v) : this.curios(v);
    this.body.replaceChildren(...content);
    this.body.scrollTop = top ? 0 : scroll;
  }

  /* ------------------------------- mission ------------------------------- */

  private mission(v: NotebookView): HTMLElement[] {
    const s = v.branch;
    const out: HTMLElement[] = [h('h3', { class: 'nb-mission-title' }, [t('nb.missionTitle')]), h('p', { class: 'nb-intro' }, [t('nb.missionIntro')])];
    if (s.status === 'locked') {
      out.push(h('p', { class: 'nb-locked' }, [t('nb.locked')]));
      return out;
    }
    out.push(this.steps(v));
    out.push(this.section('clues', v, this.clues(s)));
    out.push(this.section('calc', v, this.calc(s)));
    out.push(this.section('consult', v, this.consult(v)));
    out.push(this.section('risks', v, this.risks(s)));
    if (s.status === 'done') out.push(this.result(v));
    else out.push(this.section('decide', v, this.decide(v)));
    return out;
  }

  private steps(v: NotebookView): HTMLElement {
    const s = v.branch;
    const now = currentStep(s, v.flags);
    const counts: Partial<Record<Step, { n: number; total: number }>> = {
      clues: { n: s.clues.length, total: CLUE_IDS.length },
      calc: { n: QUESTIONS.filter((q) => questionDone(s, q.id)).length, total: QUESTIONS.length },
      consult: { n: Math.min(advisorsAsked(v.flags), REQUIRED_ADVISORS), total: REQUIRED_ADVISORS },
    };
    const items = STEPS.filter((st) => st !== 'done').map((st) => {
      const done = STEPS.indexOf(st) < STEPS.indexOf(now) || s.status === 'done' || (st === 'consult' && advisorsAsked(v.flags) >= REQUIRED_ADVISORS);
      const cls = done ? 'done' : st === now ? 'now' : '';
      return h('li', { class: cls, 'data-step': st }, [h('span', { class: 'nb-check', 'aria-hidden': 'true' }, [done ? '✓' : '']), t(`nb.step.${st}`, counts[st] ?? {})]);
    });
    return h('ol', { class: 'nb-steps' }, items);
  }

  private section(step: Step, v: NotebookView, content: (HTMLElement | null)[]): HTMLElement {
    const open = stepOpen(v.branch, v.flags, step) || v.branch.status === 'done';
    return h('section', { class: `nb-sec${open ? '' : ' locked'}`, 'data-sec': step }, [
      h('h4', {}, [t(`nb.sec.${step}`)]),
      ...(open ? content : [h('p', { class: 'nb-muted' }, [t('nb.sectionLocked')])]),
    ]);
  }

  private clues(s: BranchState): HTMLElement[] {
    return [
      h(
        'ul',
        { class: 'nb-clues' },
        CLUE_IDS.map((id) =>
          s.clues.includes(id)
            ? h('li', { class: 'found', 'data-clue': id }, [h('strong', {}, [t(`clue.${id}.title`)]), h('span', {}, [t(`clue.${id}.fact`)])])
            : h('li', { class: 'missing', 'data-clue': id }, [h('strong', {}, ['?']), h('span', {}, [t('nb.clueMissing')])]),
        ),
      ),
    ];
  }

  private calc(s: BranchState): HTMLElement[] {
    return QUESTIONS.map((q) => {
      const a = s.answers[q.id];
      const done = questionDone(s, q.id);
      const row = h('div', { class: `nb-q${done ? ' done' : ''}`, 'data-q': q.id }, [h('p', { class: 'nb-q-text' }, [t(`q.${q.id}.text`)])]);
      if (done) {
        row.append(
          h('p', { class: a!.correct ? 'nb-good' : 'nb-reveal' }, [a!.correct ? t('nb.correct') : t('nb.revealed')]),
          h('p', { class: 'nb-explain' }, [t(`q.${q.id}.explain`)]),
        );
        return row;
      }
      const input = h('input', { class: 'nb-input', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: t('nb.answerPlaceholder'), 'aria-label': t(`q.${q.id}.text`) });
      const check = h('button', { class: 'secondary-btn nb-checkbtn', type: 'button' }, [t('nb.check')]);
      const submit = () => {
        const r = answer(s, q.id, input.value);
        this.notes[q.id] = r === 'invalid' ? t('nb.invalid') : '';
        if (r !== 'invalid') this.o.onChange();
        this.render();
        if (r === 'wrong' || r === 'invalid') (this.body.querySelector(`[data-q="${q.id}"] input`) as HTMLInputElement | null)?.focus();
      };
      check.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') submit();
      });
      row.append(h('div', { class: 'nb-answer' }, [input, check]));
      const note = this.notes[q.id] || (a && a.tries > 0 ? t('nb.wrong', { hint: t(`q.${q.id}.hint`) }) : '');
      if (note) row.append(h('p', { class: 'nb-bad' }, [note]));
      return row;
    });
  }

  private consult(v: NotebookView): HTMLElement[] {
    return [
      h('p', { class: 'nb-muted' }, [t('nb.consultIntro')]),
      h(
        'ul',
        { class: 'nb-advisors' },
        ADVISORS.map((a) => {
          const asked = v.flags.includes(a.flag);
          const go = h('button', { class: 'link-btn nb-go', type: 'button', 'data-npc': a.id }, [t('nb.goTalk')]);
          go.addEventListener('click', () => this.o.onGoToNpc(a.id));
          return h('li', { class: asked ? 'asked' : '', 'data-advisor': a.id }, [
            h('span', { class: 'nb-emoji', 'aria-hidden': 'true' }, [NPC_EMOJI[a.id]]),
            h('span', { class: 'nb-adv-name' }, [t(`nb.advisor.${a.id}`)]),
            asked ? h('span', { class: 'nb-asked' }, ['✓ ', t('nb.asked')]) : v.branch.status === 'done' ? null : go,
          ]);
        }),
      ),
    ];
  }

  private risks(s: BranchState): HTMLElement[] {
    if (s.risks) {
      const rep = riskReport(s);
      return [
        h('p', { class: 'nb-good' }, [t('nb.risksReport', { found: rep.found, real: rep.real }) + (rep.falseAlarms ? t('nb.falseAlarms', { n: rep.falseAlarms }) : '')]),
        h(
          'ul',
          { class: 'nb-risks done' },
          RISKS.map((r) => {
            const picked = s.risks!.includes(r.id);
            const right = picked === r.real;
            return h('li', { class: `${r.real ? 'real' : 'fake'} ${right ? 'right' : 'wrong'}`, 'data-risk': r.id }, [
              h('span', { class: 'nb-check', 'aria-hidden': 'true' }, [picked ? '☑' : '☐']),
              h('div', {}, [h('strong', {}, [t(`risk.${r.id}`)]), h('small', {}, [`${t(r.real ? 'nb.riskReal' : 'nb.riskFake')}: ${t(`risk.${r.id}.why`)}`])]),
            ]);
          }),
        ),
      ];
    }
    const list = h(
      'ul',
      { class: 'nb-risks' },
      RISKS.map((r) => {
        const box = h('input', { type: 'checkbox', 'data-risk': r.id });
        box.checked = this.picks.risks.has(r.id);
        box.addEventListener('change', () => (box.checked ? this.picks.risks.add(r.id) : this.picks.risks.delete(r.id)));
        return h('li', {}, [h('label', {}, [box, h('span', {}, [t(`risk.${r.id}`)])])]);
      }),
    );
    const submit = h('button', { class: 'secondary-btn nb-risks-submit', type: 'button' }, [t('nb.risksSubmit')]);
    submit.addEventListener('click', () => {
      submitRisks(s, [...this.picks.risks]);
      this.o.onChange();
      this.render();
    });
    return [h('p', { class: 'nb-muted' }, [t('nb.risksIntro')]), list, submit];
  }

  private decide(v: NotebookView): HTMLElement[] {
    const options = h(
      'ul',
      { class: 'nb-options' },
      OPTION_IDS.map((id) => {
        const radio = h('input', { type: 'radio', name: 'nb-option', value: id, 'data-option': id });
        radio.checked = this.picks.option === id;
        radio.addEventListener('change', () => (this.picks.option = id));
        return h('li', {}, [h('label', {}, [radio, h('span', {}, [t(`option.${id}`)])])]);
      }),
    );
    const reasons = h(
      'ul',
      { class: 'nb-reasons' },
      REASONS.map((r) => {
        const box = h('input', { type: 'checkbox', 'data-reason': r.id });
        box.checked = this.picks.reasons.has(r.id);
        box.addEventListener('change', () => {
          if (box.checked && this.picks.reasons.size >= MAX_REASONS) box.checked = false;
          else if (box.checked) this.picks.reasons.add(r.id);
          else this.picks.reasons.delete(r.id);
        });
        return h('li', {}, [h('label', {}, [box, h('span', {}, [t(`reason.${r.id}`)])])]);
      }),
    );
    const present = h('button', { class: 'primary-btn nb-present', type: 'button' }, [t('nb.present')]);
    present.addEventListener('click', () => {
      const choice = this.picks.option;
      if (!choice) this.decideError = t('nb.pickOption');
      else if (!this.picks.reasons.size) this.decideError = t('nb.pickReason');
      else {
        const ev = decide(v.branch, choice, [...this.picks.reasons], v.flags);
        if (ev) {
          this.decideError = '';
          this.o.onDecided(ev);
          this.render();
          this.body.querySelector('.nb-result')?.scrollIntoView({ block: 'start' });
          return;
        }
      }
      this.render();
    });
    const parts: (HTMLElement | null)[] = [
      h('p', { class: 'nb-muted' }, [t('nb.decideIntro')]),
      options,
      h('p', { class: 'nb-muted' }, [t('nb.reasonsIntro')]),
      reasons,
      this.decideError ? h('p', { class: 'nb-bad' }, [this.decideError]) : null,
      present,
    ];
    return parts.filter((x): x is HTMLElement => !!x);
  }

  private result(v: NotebookView): HTMLElement {
    const s = v.branch;
    const ev = evaluate(s.choice!, s.reasons, s, v.flags);
    return h('section', { class: 'nb-sec nb-result', 'data-sec': 'result' }, [
      h('h4', {}, [t('nb.sec.result')]),
      h('div', { class: 'nb-stars', 'aria-label': `${s.stars}/3` }, [stars(s.stars)]),
      h('h3', {}, [t(`outcome.${s.choice}.title`)]),
      h('p', {}, [t(`outcome.${s.choice}.body`)]),
      h('div', { class: 'card-example' }, [h('strong', {}, [t('nb.lesson')]), h('span', {}, [t(`outcome.${s.choice}.lesson`)])]),
      h('h5', {}, [t('nb.yourChoice')]),
      h('p', {}, [t(`option.${s.choice}`)]),
      h('h5', {}, [t('nb.yourReasons')]),
      h(
        'ul',
        { class: 'nb-verdicts' },
        ev.verdicts.map((x) => h('li', { class: x.verdict }, [h('span', {}, [t(`reason.${x.id}`)]), h('small', {}, [t(`nb.verdict.${x.verdict}`)])])),
      ),
      h('h5', {}, [t('nb.score')]),
      h('ul', { class: 'nb-score' }, [
        h('li', {}, [t('nb.scoreClues', { n: ev.clues, total: CLUE_IDS.length })]),
        h('li', {}, [t('nb.scoreCalc', { n: ev.firstTry, total: ev.questions })]),
        h('li', {}, [t('nb.scoreAdvisors', { n: ev.advisors })]),
        h('li', {}, [t('nb.scoreRisks', { n: ev.risks.found, total: ev.risks.real })]),
      ]),
    ]);
  }

  /* ------------------------------ collections ----------------------------- */

  private concepts(v: NotebookView): HTMLElement[] {
    return [
      h('p', { class: 'nb-count' }, [t('nb.conceptsCount', { n: v.concepts.length, total: CONCEPT_IDS.length })]),
      h(
        'ul',
        { class: 'nb-concepts' },
        CONCEPT_IDS.map((id) =>
          v.concepts.includes(id)
            ? h('li', { class: 'found', 'data-concept': id }, [
                h('strong', {}, [t(`concept.${id}.title`)]),
                ...conceptText(id, v.level),
                h('div', { class: 'card-example' }, [h('strong', {}, [t('concept.example')]), h('span', {}, [t(`concept.${id}.example`)])]),
              ])
            : h('li', { class: 'missing', 'data-concept': id }, [h('strong', {}, ['🔒']), h('p', {}, [t('nb.conceptLocked')])]),
        ),
      ),
    ];
  }

  private curios(v: NotebookView): HTMLElement[] {
    return [
      h('p', { class: 'nb-count' }, [t('nb.curiosCount', { n: v.curiosities.length, total: CURIOSITIES.length })]),
      h(
        'ul',
        { class: 'nb-concepts nb-curios' },
        CURIOSITIES.map((c) =>
          v.curiosities.includes(c.id)
            ? h('li', { class: 'found', 'data-curio': c.id }, [h('strong', {}, [t(`curio.${c.id}.title`)]), h('p', {}, [t(`curio.${c.id}.body`)])])
            : h('li', { class: 'missing', 'data-curio': c.id }, [h('strong', {}, ['?']), h('p', {}, [t('nb.curioLocked')])]),
        ),
      ),
    ];
  }
}
