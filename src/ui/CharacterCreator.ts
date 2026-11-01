import {
  BACKWEAR,
  BOTTOM_STYLES,
  BUILDS,
  CLOTH_COLORS,
  cleanNickname,
  EYEWEAR,
  HAIR_COLORS,
  HAIR_STYLES,
  HEADWEAR,
  MODELS,
  NICKNAME_MAX,
  PANTS_COLORS,
  randomLook,
  SHOE_COLORS,
  SKIN_TONES,
  TOP_STYLES,
  type CharacterLook,
} from '../content/characterOptions';
import { HERO_IDS, type HeroId } from '../character/hero';
import { t } from '../i18n';
import { HERO_THUMBS } from './heroThumbs';
import { h } from './dom';

type Tab = 'body' | 'hair' | 'clothes' | 'extras' | 'name';
const TABS: Tab[] = ['body', 'hair', 'clothes', 'extras', 'name'];

export interface CreatorOptions {
  look: CharacterLook;
  editing: boolean;
  onChange(look: CharacterLook): void;
  onDrag(dx: number): void;
  onDragEnd(): void;
  onDone(look: CharacterLook): void;
  onCancel?(): void;
}

/**
 * Character creator panel. The 3D preview is drawn behind it by the Studio;
 * this panel only edits a CharacterLook and reports every change.
 */
export class CharacterCreator {
  readonly el: HTMLDivElement;
  private look: CharacterLook;
  private tab: Tab = 'body';
  private body: HTMLDivElement;
  private tabBar: HTMLDivElement;
  private doneBtn: HTMLButtonElement;
  private hint: HTMLParagraphElement;

  constructor(private o: CreatorOptions) {
    this.look = { ...o.look };
    this.tabBar = h('div', { class: 'creator-tabs', role: 'tablist' });
    this.body = h('div', { class: 'creator-body', role: 'tabpanel' });
    this.doneBtn = h('button', { class: 'primary-btn', type: 'button', id: 'creator-done' }, [t(o.editing ? 'char.saveChanges' : 'char.done')]);
    this.doneBtn.addEventListener('click', () => this.finish());
    this.hint = h('p', { class: 'creator-hint', 'aria-live': 'polite' });
    const random = h('button', { class: 'secondary-btn', type: 'button', id: 'creator-random' }, [t('char.random')]);
    random.addEventListener('click', () => {
      this.look = randomLook(Math.random, this.look.nickname);
      this.changed();
      this.render();
    });
    const footer = h('div', { class: 'creator-footer' }, [random]);
    if (o.editing && o.onCancel) {
      const cancel = h('button', { class: 'secondary-btn', type: 'button' }, [t('char.cancel')]);
      cancel.addEventListener('click', () => o.onCancel?.());
      footer.append(cancel);
    }
    footer.append(this.doneBtn);

    const panel = h('div', { class: 'creator-panel' }, [
      h('h1', {}, [t(o.editing ? 'char.editTitle' : 'char.title')]),
      this.tabBar,
      this.body,
      this.hint,
      footer,
    ]);

    // the rest of the screen rotates the preview
    const stage = h('div', { class: 'creator-stage', 'aria-hidden': 'true' }, [h('span', { class: 'creator-rotate-hint' }, [t('char.rotateHint')])]);
    let last: number | null = null;
    stage.addEventListener('pointerdown', (e) => {
      last = e.clientX;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (last === null) return;
      o.onDrag(e.clientX - last);
      last = e.clientX;
    });
    const up = () => {
      last = null;
      o.onDragEnd();
    };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);

    this.el = h('div', { class: 'creator' }, [stage, panel]);
    this.render();
    this.updateDone();
  }

  private changed(): void {
    this.o.onChange({ ...this.look });
    this.updateDone();
  }

  private validName(): boolean {
    return this.look.nickname.trim().length >= 2;
  }

  private updateDone(): void {
    const ok = this.validName();
    this.doneBtn.setAttribute('aria-disabled', String(!ok));
    this.doneBtn.classList.toggle('is-disabled', !ok);
    this.hint.textContent = ok ? '' : t('char.nicknameMissing');
  }

  private finish(): void {
    if (!this.validName()) {
      this.tab = 'name';
      this.render();
      (this.body.querySelector('input') as HTMLInputElement | null)?.focus();
      return;
    }
    this.look.nickname = this.look.nickname.trim();
    this.o.onDone({ ...this.look });
  }

  private render(): void {
    this.tabBar.replaceChildren(
      ...TABS.map((tab) => {
        const b = h('button', { class: `creator-tab ${tab === this.tab ? 'active' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(tab === this.tab), 'data-tab': tab }, [t(`char.tab.${tab}`)]);
        b.addEventListener('click', () => {
          this.tab = tab;
          this.render();
        });
        return b;
      }),
    );
    const L = this.look;
    const set = <K extends keyof CharacterLook>(key: K) => (value: CharacterLook[K]) => {
      this.look[key] = value;
      // any styling choice means "design my own"
      if (key !== 'model' && key !== 'nickname' && key !== 'hero') this.look.model = 'custom';
      this.changed();
      this.render();
    };
    const rows: HTMLElement[] = [];
    switch (this.tab) {
      case 'body':
        rows.push(this.choice('char.model', MODELS, 'char.model', L.model ?? 'hero', set('model')));
        if (L.model !== 'custom') rows.push(this.heroPicker(L.hero ?? 'kid', set('hero')));
        else {
          rows.push(this.choice('char.build', BUILDS, 'char.build', L.build, set('build')));
          rows.push(this.swatches('char.skin', SKIN_TONES, L.skin, set('skin')));
        }
        break;
      case 'hair':
        rows.push(this.choice('char.hairStyle', HAIR_STYLES, 'char.hair', L.hairStyle, set('hairStyle')));
        rows.push(this.swatches('char.hairColor', HAIR_COLORS, L.hairColor, set('hairColor')));
        break;
      case 'clothes':
        rows.push(this.choice('char.top', TOP_STYLES, 'char.top', L.top, set('top')));
        rows.push(this.swatches('char.topColor', CLOTH_COLORS, L.topColor, set('topColor')));
        rows.push(this.choice('char.bottom', BOTTOM_STYLES, 'char.bottom', L.bottom, set('bottom')));
        rows.push(this.swatches('char.bottomColor', PANTS_COLORS, L.bottomColor, set('bottomColor')));
        rows.push(this.swatches('char.shoes', SHOE_COLORS, L.shoeColor, set('shoeColor')));
        break;
      case 'extras':
        rows.push(this.choice('char.headwear', HEADWEAR, 'char.head', L.headwear, set('headwear')));
        if (L.headwear !== 'none') rows.push(this.swatches('char.headwearColor', CLOTH_COLORS, L.headwearColor, set('headwearColor')));
        rows.push(this.choice('char.eyewear', EYEWEAR, 'char.eyes', L.eyewear, set('eyewear')));
        rows.push(this.choice('char.backwear', BACKWEAR, 'char.back', L.backwear, set('backwear')));
        if (L.backwear !== 'none') rows.push(this.swatches('char.backColor', CLOTH_COLORS, L.backwearColor, set('backwearColor')));
        break;
      case 'name':
        rows.push(this.nameField());
        break;
    }
    this.body.replaceChildren(...rows);
  }

  private choice<T extends string>(labelKey: string, values: readonly T[], prefix: string, current: T, onPick: (v: T) => void): HTMLElement {
    const group = h('div', { class: 'chip-group', role: 'radiogroup', 'aria-label': t(labelKey) });
    for (const v of values) {
      const b = h('button', { class: `choice ${v === current ? 'on' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(v === current), 'data-value': v }, [t(`${prefix}.${v}`)]);
      b.addEventListener('click', () => onPick(v));
      group.append(b);
    }
    return h('div', { class: 'creator-row' }, [h('h2', {}, [t(labelKey)]), group]);
  }

  /** The ready-made heroes as portrait buttons. */
  private heroPicker(current: HeroId, onPick: (v: HeroId) => void): HTMLElement {
    const group = h('div', { class: 'hero-group', role: 'radiogroup', 'aria-label': t('char.hero') });
    for (const id of HERO_IDS) {
      const thumb = HERO_THUMBS[id];
      const b = h('button', { class: `hero-pick ${id === current ? 'on' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(id === current), 'aria-label': t(`char.hero.${id}`), title: t(`char.hero.${id}`), 'data-value': id }, [
        thumb ? h('img', { src: thumb, alt: '' }) : h('span', { class: 'hero-pick-star', 'aria-hidden': 'true' }, ['⭐']),
      ]);
      b.addEventListener('click', () => onPick(id));
      group.append(b);
    }
    return h('div', { class: 'creator-row' }, [h('h2', {}, [t('char.hero')]), group]);
  }

  private swatches(labelKey: string, colors: string[], current: string, onPick: (c: string) => void): HTMLElement {
    const group = h('div', { class: 'swatch-group', role: 'radiogroup', 'aria-label': t(labelKey) });
    colors.forEach((c, i) => {
      const b = h('button', {
        class: `swatch ${c === current ? 'on' : ''}`,
        type: 'button',
        role: 'radio',
        'aria-checked': String(c === current),
        'aria-label': t('char.color', { n: i + 1 }),
        'data-value': c,
        style: { background: c },
      });
      b.addEventListener('click', () => onPick(c));
      group.append(b);
    });
    return h('div', { class: 'creator-row' }, [h('h2', {}, [t(labelKey)]), group]);
  }

  private nameField(): HTMLElement {
    const input = h('input', {
      id: 'nickname',
      type: 'text',
      maxlength: NICKNAME_MAX,
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: t('char.nicknamePlaceholder'),
      dir: 'auto',
    });
    input.value = this.look.nickname;
    input.addEventListener('input', () => {
      const clean = cleanNickname(input.value);
      if (clean !== input.value) input.value = clean;
      this.look.nickname = clean;
      this.changed();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.finish();
    });
    const ideas = h('div', { class: 'chip-group' }, [
      h('span', { class: 'ideas-label' }, [t('char.suggestions')]),
      ...[1, 2, 3, 4].map((n) => {
        const b = h('button', { class: 'choice small', type: 'button' }, [t(`char.nick${n}`)]);
        b.addEventListener('click', () => {
          input.value = t(`char.nick${n}`);
          this.look.nickname = input.value;
          this.changed();
        });
        return b;
      }),
    ]);
    queueMicrotask(() => {
      if (!matchMedia('(pointer: coarse)').matches) input.focus();
    });
    return h('div', { class: 'creator-row' }, [
      h('label', { for: 'nickname' }, [h('h2', {}, [t('char.nickname')])]),
      input,
      h('p', { class: 'field-hint' }, [t('char.nicknameHint')]),
      ideas,
    ]);
  }
}
