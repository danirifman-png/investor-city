import * as THREE from 'three';
import { DISTRICT_IDS, ZONE_GRID, ZONES, type ZoneId } from '../content/cityPlan';
import type { CameraController } from '../camera/CameraController';
import { INTERIORS } from '../content/interiors';
import type { NpcId } from '../content/npcs';
import type { SocialState } from '../core/Social';
import { t } from '../i18n';
import { HALF_CITY, type ZoneLayout } from '../world/cityLayout';
import type { Poi } from '../world/types';
import { PlayerCard } from './Progress';
import { h, iconButton, ICONS } from './dom';
import { Joystick } from './Joystick';
import { NPC_EMOJI } from './npcStyle';
import { PeoplePanel } from './PeoplePanel';

export interface StartInfo {
  hasSave: boolean;
  nickname: string;
  visited: number;
}

export interface HudOptions {
  camera: CameraController;
  layout: ZoneLayout[];
  pois: Poi[];
  isTouch: boolean;
  start: StartInfo;
  onNewGame(): void;
  onContinue(): void;
  onToggleNight(): boolean;
  /** Mutes or unmutes; returns whether sound is now muted. */
  onToggleSound(): boolean;
  muted(): boolean;
  onSelectPoi(id: string | null): void;
  onTravel(zone: ZoneId): void;
  onVisitPoi(id: string): void;
  onInteract(): void;
  onSave(): void;
  onEditCharacter(): void;
  /** Current graphics style, and switching it (reloads the game). */
  graphics(): 'vivid' | 'classic';
  onGraphics(g: 'vivid' | 'classic'): void;
  /** Data for the people journal. */
  social(): SocialState | null;
  placeOf(id: NpcId): string;
  onGoToNpc(id: NpcId): void;
  onTapNpc(id: NpcId): void;
  onJoystick(x: number, y: number): void;
  onRunToggle(on: boolean): void;
  onJump(): void;
  /** Gets on or off the scooter; returns whether the player now rides. */
  onScooter(): boolean;
  onNotebook(): void;
  /** The tracker line under the badge was clicked. */
  onTracker(): void;
  onQuests(): void;
  onBag(): void;
  onMoney(): void;
  onSettings(): void;
}

/** What the game is, for parents and teachers (a native disclosure, so it needs no modal). */
function parentsNote(): HTMLDetailsElement {
  return h('details', { class: 'parents-note' }, [
    h('summary', {}, [t('parents.title')]),
    ...['p1', 'p2', 'p3', 'p4', 'p5'].map((k) => h('p', {}, [t(`parents.${k}`)])),
  ]);
}

/** Landmarks that will gain gameplay in later phases. */
const COMING_SOON = new Set(['exchange', 'newsTower', 'academy', 'portfolioHQ']);
/** Buildings with a walk-in interior. */
const ENTERABLE = new Set(Object.values(INTERIORS).map((i) => i.poi));

interface Label {
  poi: Poi;
  el: HTMLButtonElement;
  pos: THREE.Vector3;
}

/** What the HUD needs to know about a character in the world. */
export interface NpcMarker {
  id: NpcId;
  pos: THREE.Vector3;
  height: number;
  color: string;
  met: boolean;
  /** '!' = something to talk about, '?' = an errand to hand in. */
  mark: '' | '!' | '?';
}

interface NpcTag {
  id: NpcId;
  el: HTMLButtonElement;
  markEl: HTMLSpanElement;
}

/**
 * All screen-space UI. Plain DOM + CSS (no framework): the HUD is small, and
 * keeping it framework-free avoids a second render loop next to Three.js.
 * Layout is RTL; geographic widgets (minimap, map grid) stay west-to-east.
 */
export class Hud {
  readonly root: HTMLDivElement;
  private badge: HTMLDivElement;
  private counter: HTMLDivElement;
  private banner: HTMLDivElement;
  private bannerTimer = 0;
  private card: HTMLDivElement;
  private minimap: HTMLCanvasElement;
  private minimapBase: HTMLCanvasElement;
  private labels: Label[] = [];
  private labelLayer: HTMLDivElement;
  private nameTag: HTMLDivElement;
  private bubbleEl: HTMLDivElement;
  private bubbleAt: THREE.Vector3 | null = null;
  private prompt: HTMLButtonElement;
  private toastEl: HTMLDivElement;
  private toastTimer = 0;
  private start: HTMLDivElement;
  private help: HTMLDivElement;
  private mapOverlay: HTMLDivElement;
  private nightBtn: HTMLButtonElement;
  private runBtn: HTMLButtonElement | null = null;
  private currentZone: ZoneId | null = null;
  private selected: string | null = null;
  private promptId: string | null = null;
  private people: PeoplePanel;
  private tracker: HTMLButtonElement;
  readonly playerCard: PlayerCard;
  private npcTags: NpcTag[] = [];
  private npcMarkers: NpcMarker[] = [];
  private mapTargets: { x: number; z: number }[] = [];
  private tmp = new THREE.Vector3();
  private player: { pos: THREE.Vector3; height: number } | null = null;
  playing = false;

  constructor(private o: HudOptions) {
    this.root = h('div', { class: o.isTouch ? 'hud touch' : 'hud desktop' });

    // ---- top bar: title + current district (RTL start = right)
    this.badge = h('div', { class: 'district-badge', 'aria-live': 'polite' });
    this.counter = h('div', { class: 'visit-counter', title: '' });
    this.playerCard = new PlayerCard(() => this.o.onQuests());
    this.tracker = h('button', { class: 'tracker', type: 'button', hidden: true });
    this.tracker.addEventListener('click', () => this.o.onTracker());
    const topStart = h('div', { class: 'top-start' }, [this.tracker, this.badge, this.counter]);

    // ---- toolbar (RTL end = left)
    this.nightBtn = iconButton('moon', t('hud.dayNight'), () => this.toggleNight());
    const soundBtn = iconButton(this.o.muted() ? 'soundOff' : 'soundOn', t('hud.sound'), () => {
      soundBtn.innerHTML = this.o.onToggleSound() ? ICONS.soundOff : ICONS.soundOn;
    }, 'btn-sound');
    const toolbar = h('div', { class: 'toolbar' }, [
      soundBtn,
      this.nightBtn,
      iconButton('book', t('hud.notebook'), () => this.o.onNotebook(), 'btn-notebook'),
      iconButton('people', t('hud.people'), () => this.openPeople(), 'btn-people'),
      iconButton('save', t('hud.save'), () => this.o.onSave(), 'btn-save'),
      iconButton('help', t('hud.help'), () => this.openHelp(), 'btn-help'),
    ]);
    // the big round action buttons of the reference art, bottom right
    const action = (icon: keyof typeof ICONS, label: string, cls: string, onClick: () => void) => {
      const b = h('button', { class: `action-btn ${cls}`, type: 'button', 'aria-label': label, title: label });
      b.innerHTML = `<span class="action-icon">${ICONS[icon]}</span><span class="action-label">${label}</span>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      return b;
    };
    const actionBar = h('div', { class: 'action-bar' }, [
      action('quest', t('hud.quests'), 'btn-quests', () => this.o.onQuests()),
      action('wallet', t('hud.money'), 'btn-money', () => this.o.onMoney()),
      action('bag', t('hud.bag'), 'btn-bag', () => this.o.onBag()),
      action('map', t('hud.map'), 'btn-map', () => this.openMap()),
      action('gear', t('hud.settings'), 'btn-settings', () => this.o.onSettings()),
    ]);
    this.nightBtn.classList.add('btn-night');
    this.minimapBase = document.createElement('canvas');
    this.minimap = h('canvas', { class: 'minimap', width: 360, height: 360, 'aria-label': t('hud.map'), role: 'img' });
    this.minimap.addEventListener('click', () => this.openMap());
    const topEnd = h('div', { class: 'top-end' }, [this.playerCard.el, toolbar, this.minimap]);

    this.banner = h('div', { class: 'district-banner', 'aria-hidden': 'true' });
    this.labelLayer = h('div', { class: 'label-layer' });
    this.nameTag = h('div', { class: 'name-tag', hidden: true });
    this.bubbleEl = h('div', { class: 'speech-bubble', hidden: true, 'aria-live': 'polite' });
    this.labelLayer.append(this.nameTag, this.bubbleEl);
    this.card = h('div', { class: 'info-card', role: 'dialog', 'aria-modal': 'false', hidden: true });
    this.prompt = h('button', { class: 'interact-prompt', type: 'button', hidden: true });
    this.prompt.addEventListener('click', (e) => {
      e.stopPropagation();
      this.o.onInteract();
    });
    this.toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite', hidden: true });

    // ---- camera buttons + joystick
    const cam = o.camera;
    const camButtons = h('div', { class: 'cam-buttons' }, [
      ...(o.isTouch
        ? []
        : [
            iconButton('rotR', t('hud.rotateRight'), () => cam.rotateBy(-Math.PI / 4)),
            iconButton('plus', t('hud.zoomIn'), () => cam.zoomBy(0.7)),
            iconButton('minus', t('hud.zoomOut'), () => cam.zoomBy(1.4)),
            iconButton('rotL', t('hud.rotateLeft'), () => cam.rotateBy(Math.PI / 4)),
          ]),
    ]);
    const controls = h('div', { class: 'controls' }, [camButtons]);
    this.scooterBtn = iconButton('scooter', t('hud.scooter'), () => this.setRiding(o.onScooter()), 'scooter-btn');
    this.scooterBtn.setAttribute('aria-pressed', 'false');
    camButtons.prepend(this.scooterBtn);
    if (o.isTouch) camButtons.prepend(iconButton('jump', t('hud.jump'), () => o.onJump(), 'jump-btn'));
    if (o.isTouch) {
      const joy = new Joystick((x, y) => o.onJoystick(x, y), t('controls.touch.move'));
      controls.prepend(joy.el);
      this.runBtn = iconButton('run', t('hud.run'), () => {
        const on = !this.runBtn!.classList.contains('on');
        this.runBtn!.classList.toggle('on', on);
        this.runBtn!.setAttribute('aria-pressed', String(on));
        o.onRunToggle(on);
      }, 'run-btn');
      this.runBtn.setAttribute('aria-pressed', 'false');
      camButtons.prepend(this.runBtn);
    }

    this.start = this.buildStart();
    this.help = this.buildHelp();
    this.mapOverlay = this.buildMap();
    this.people = new PeoplePanel({
      placeOf: (id) => o.placeOf(id),
      onGoTo: (id) => {
        this.closeOverlays();
        o.onGoToNpc(id);
      },
      onEditCharacter: () => {
        this.closeOverlays();
        o.onEditCharacter();
      },
      onClose: () => this.closeOverlays(),
    });

    // phones: the ten buttons fold into one menu so the world stays visible
    let menuSheet: HTMLElement | null = null;
    if (o.isTouch) {
      menuSheet = h('div', { class: 'hud-menu', hidden: true, role: 'menu' }, [actionBar, toolbar]);
      const menuBtn = iconButton('menu', t('hud.menu'), () => {
        menuSheet!.hidden = !menuSheet!.hidden;
        menuBtn.setAttribute('aria-expanded', String(!menuSheet!.hidden));
      }, 'menu-btn');
      menuBtn.setAttribute('aria-expanded', 'false');
      // any choice in the menu closes it
      menuSheet.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) menuSheet!.hidden = true;
      }, true);
      topEnd.append(menuBtn);
    }

    this.root.append(
      this.labelLayer,
      h('div', { class: 'topbar' }, [topStart, topEnd]),
      this.banner,
      this.prompt,
      this.card,
      controls,
      menuSheet ?? actionBar,
      this.toastEl,
      this.help,
      this.mapOverlay,
      this.people.el,
      this.start,
    );
    this.root.classList.add('pre-start');
    document.body.append(this.root);

    this.buildLabels();
    this.drawMinimapBase();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeOverlays();
        this.o.onSelectPoi(null);
      }
    });
  }

  /* ------------------------------ screens ------------------------------ */

  private controlLines(): string[] {
    const k = this.o.isTouch ? 'touch' : 'desktop';
    const keys = this.o.isTouch ? ['move', 'rotate', 'zoom', 'select'] : ['move', 'rotate', 'zoom', 'drag', 'select'];
    return keys.map((x) => t(`controls.${k}.${x}`));
  }

  private buildStart(): HTMLDivElement {
    const actions = h('div', { class: 'start-actions' }, [h('button', { class: 'primary-btn', type: 'button', disabled: true }, [t('start.loading')])]);
    const panel = h('div', { class: 'start-panel' }, [
      h('div', { class: 'start-coin', 'aria-hidden': 'true' }),
      h('h1', {}, [t('game.title')]),
      h('p', { class: 'tagline' }, [t('game.tagline')]),
      h('div', { class: 'start-controls' }, [h('h2', {}, [t('start.controlsTitle')]), h('ul', {}, this.controlLines().map((l) => h('li', {}, [l])))]),
      actions,
      parentsNote(),
      h('p', { class: 'phase-note' }, [t('start.phaseNote')]),
    ]);
    return h('div', { class: 'start-screen' }, [panel]);
  }

  /** Shows the real start buttons once the city is built. */
  ready(): void {
    const actions = this.start.querySelector('.start-actions')!;
    const s = this.o.start;
    if (s.hasSave) {
      const cont = h('button', { class: 'primary-btn', type: 'button', id: 'start-continue' }, [t('start.continue', { name: s.nickname })]);
      cont.addEventListener('click', () => {
        this.hideStart();
        this.o.onContinue();
      });
      const sub = h('p', { class: 'start-sub' }, [t('start.lastPlayed', { visited: s.visited })]);
      const fresh = h('button', { class: 'link-btn', type: 'button', id: 'start-new' }, [t('start.newCharacterAgain')]);
      fresh.addEventListener('click', () => {
        // confirm inline: starting over erases the saved character
        const yes = h('button', { class: 'secondary-btn danger', type: 'button', id: 'start-new-confirm' }, [t('start.confirmYes')]);
        const no = h('button', { class: 'secondary-btn', type: 'button' }, [t('start.confirmNo')]);
        const box = h('div', { class: 'confirm-box', role: 'alertdialog' }, [h('p', {}, [t('start.confirmNew')]), h('div', { class: 'confirm-actions' }, [yes, no])]);
        yes.addEventListener('click', () => {
          this.hideStart();
          this.o.onNewGame();
        });
        no.addEventListener('click', () => box.replaceWith(fresh));
        fresh.replaceWith(box);
        no.focus();
      });
      actions.replaceChildren(cont, sub, fresh);
      cont.focus();
    } else {
      const create = h('button', { class: 'primary-btn', type: 'button', id: 'start-create' }, [t('start.newCharacter')]);
      create.addEventListener('click', () => {
        this.hideStart();
        this.o.onNewGame();
      });
      actions.replaceChildren(create);
      create.focus();
    }
  }

  private hideStart(): void {
    this.start.classList.add('leaving');
    setTimeout(() => this.start.remove(), 600);
  }

  /** Switches the HUD on once the player is in the city. */
  setPlaying(on: boolean): void {
    this.playing = on;
    this.root.classList.toggle('pre-start', !on);
    if (!on) {
      this.showPoi(null);
      this.setPrompt(null);
    }
  }

  /** Vivid / classic art style switch. */
  private graphicsRow(): HTMLElement {
    const current = this.o.graphics();
    const btn = (g: 'vivid' | 'classic') => {
      const b = h('button', { class: `gfx-btn${g === current ? ' on' : ''}`, type: 'button', 'data-gfx': g, 'aria-pressed': String(g === current) }, [t(`gfx.${g}`)]);
      b.addEventListener('click', () => this.o.onGraphics(g));
      return b;
    };
    return h('div', { class: 'gfx-row' }, [h('span', {}, [t('gfx.title')]), btn('vivid'), btn('classic'), h('small', {}, [t('gfx.note')])]);
  }

  private buildHelp(): HTMLDivElement {
    const close = () => this.closeOverlays();
    const panel = h('div', { class: 'modal-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('help.title') }, [
      h('h2', {}, [t('help.title')]),
      h('p', {}, [t('help.body')]),
      h('ul', {}, this.controlLines().map((l) => h('li', {}, [l]))),
      this.graphicsRow(),
      parentsNote(),
      h('button', { class: 'primary-btn', type: 'button', onclick: close }, [t('help.ok')]),
    ]);
    const overlay = h('div', { class: 'modal', hidden: true, onclick: (e: Event) => e.target === overlay && close() }, [panel]);
    return overlay;
  }

  private buildMap(): HTMLDivElement {
    const close = () => this.closeOverlays();
    // The grid keeps real geography (west on the left) even in RTL.
    const grid = h('div', { class: 'map-grid' });
    for (const row of ZONE_GRID) {
      for (const id of row) {
        const landmarks = this.o.pois.filter((p) => p.zone === id && (p.landmark || ZONES[id].kind === 'hub'));
        const tile = h(
          'button',
          {
            class: 'map-tile',
            type: 'button',
            'data-zone': id,
            onclick: () => {
              this.closeOverlays();
              this.o.onTravel(id);
            },
          },
          [
            h('strong', {}, [t(`district.${id}.name`)]),
            h('span', {}, [t(`district.${id}.tagline`)]),
            landmarks.length ? h('em', {}, [landmarks.map((p) => t(`poi.${p.key}.name`)).join(' · ')]) : null,
          ],
        );
        tile.style.setProperty('--zone', ZONES[id].color);
        grid.append(tile);
      }
    }
    const closeBtn = iconButton('close', t('hud.close'), close, 'modal-close');
    const panel = h('div', { class: 'modal-panel map-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('hud.map') }, [
      closeBtn,
      h('h2', {}, [t('hud.travel')]),
      grid,
    ]);
    const overlay = h('div', { class: 'modal', hidden: true, onclick: (e: Event) => e.target === overlay && close() }, [panel]);
    return overlay;
  }

  /** Marks visited districts on the map tiles. */
  setVisited(visited: ZoneId[]): void {
    const n = visited.filter((z) => DISTRICT_IDS.includes(z)).length;
    this.counter.textContent = t('hud.discoveredCount', { n });
    this.mapOverlay.querySelectorAll<HTMLElement>('.map-tile').forEach((tile) => {
      tile.classList.toggle('visited', visited.includes(tile.dataset.zone as ZoneId));
    });
  }

  private extra: { el: HTMLElement; close(): void }[] = [];

  /** Registers another full-screen panel (notebook, cards) so it blocks movement and closes with the rest. */
  addOverlay(el: HTMLElement, close: () => void): void {
    this.extra.push({ el, close });
    this.root.append(el);
  }

  private scooterBtn!: HTMLButtonElement;

  /** Shows whether the player rides the scooter. */
  setRiding(on: boolean): void {
    this.scooterBtn.classList.toggle('on', on);
    this.scooterBtn.setAttribute('aria-pressed', String(on));
  }

  get overlayOpen(): boolean {
    return !this.help.hidden || !this.mapOverlay.hidden || !this.people.el.hidden || this.extra.some((x) => !x.el.hidden);
  }

  openHelp(): void {
    this.closeOverlays();
    this.help.hidden = false;
    this.o.camera.enabled = false;
    (this.help.querySelector('button') as HTMLButtonElement)?.focus();
  }

  openMap(): void {
    this.closeOverlays();
    this.mapOverlay.hidden = false;
    this.o.camera.enabled = false;
    (this.mapOverlay.querySelector('.map-tile') as HTMLButtonElement)?.focus();
  }

  openPeople(): void {
    const s = this.o.social();
    if (!s) return;
    this.closeOverlays();
    this.people.render(s);
    this.people.el.hidden = false;
    this.o.camera.enabled = false;
  }

  closeOverlays(): void {
    this.help.hidden = true;
    this.mapOverlay.hidden = true;
    this.people.el.hidden = true;
    for (const x of this.extra) if (!x.el.hidden) x.close();
    if (this.playing) this.o.camera.enabled = true;
  }

  private toggleNight(): void {
    this.setNight(this.o.onToggleNight());
  }

  setNight(night: boolean): void {
    this.nightBtn.innerHTML = night ? ICONS.sun : ICONS.moon;
    this.root.classList.toggle('night', night);
  }

  toast(text: string, ms = 2200): void {
    this.toastEl.textContent = text;
    this.toastEl.hidden = false;
    this.toastEl.classList.remove('show');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastEl.hidden = true), ms);
  }

  /* --------------------------- district banner --------------------------- */

  setZone(id: ZoneId | null, extra?: string): void {
    if (id === this.currentZone && !extra) return;
    this.currentZone = id;
    if (!id) {
      this.badge.textContent = '';
      return;
    }
    const color = ZONES[id].color;
    this.badge.replaceChildren(h('span', { class: 'dot', style: { background: color } }), t(`district.${id}.name`));
    if (!this.playing) return;
    this.banner.replaceChildren(
      h('small', {}, [extra ?? (ZONES[id].kind === 'district' ? t('hud.youAreIn') : '')]),
      h('strong', { style: { color } }, [t(`district.${id}.name`)]),
      h('span', {}, [t(`district.${id}.tagline`)]),
    );
    this.banner.classList.toggle('discovered', !!extra);
    this.banner.classList.remove('show');
    void this.banner.offsetWidth; // restart the CSS animation
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), 2800);
  }

  /** Inside a building: the badge shows the room and the minimap steps aside. */
  setIndoors(name: string | null): void {
    this.root.classList.toggle('indoors', !!name);
    if (name) {
      this.badge.replaceChildren(h('span', { class: 'dot', style: { background: '#ffd96b' } }), name);
      return;
    }
    const id = this.currentZone;
    if (id) this.badge.replaceChildren(h('span', { class: 'dot', style: { background: ZONES[id].color } }), t(`district.${id}.name`));
    else this.badge.textContent = '';
  }

  /** A passer-by's line above their head; null hides it. */
  setBubble(b: { x: number; y: number; z: number; text: string } | null): void {
    if (!b) {
      this.bubbleAt = null;
      this.bubbleEl.hidden = true;
      return;
    }
    (this.bubbleAt ??= new THREE.Vector3()).set(b.x, b.y, b.z);
    if (this.bubbleEl.textContent !== b.text) {
      this.bubbleEl.textContent = b.text;
      this.bubbleEl.classList.remove('pop');
      void this.bubbleEl.offsetWidth;
      this.bubbleEl.classList.add('pop');
    }
  }

  /* --------------------------- interaction prompt -------------------------- */

  /** Shows the action button for what the player is next to (a building or a character). */
  setPrompt(target: { id: string; text: string } | null): void {
    // the open card already answers the prompt; don't stack them
    if (target && target.id === this.selected && !this.card.hidden) target = null;
    const id = target?.id ?? null;
    if (id === this.promptId && (!target || this.prompt.dataset.text === target.text)) return;
    this.promptId = id;
    if (!target) {
      this.prompt.hidden = true;
      return;
    }
    this.prompt.dataset.text = target.text;
    this.prompt.dataset.target = target.id;
    const key = this.o.isTouch ? null : h('kbd', {}, ['E']);
    this.prompt.replaceChildren(...(key ? [key] : []), h('span', {}, [target.text]));
    this.prompt.hidden = false;
  }

  /** The current errand line under the district badge; null hides it. */
  setTracker(title: string | null, goal = '', ready = false): void {
    this.tracker.hidden = !title;
    if (!title) return;
    this.tracker.classList.toggle('ready', ready);
    this.tracker.replaceChildren(
      h('span', { class: 'tracker-icon', 'aria-hidden': 'true' }, [ready ? '✓' : '!']),
      h('span', { class: 'tracker-text' }, [h('small', {}, [t('hud.currentQuest')]), h('strong', {}, [title]), h('span', { class: 'tracker-goal' }, [goal])]),
      this.trackerDist,
    );
  }

  private trackerDist = h('span', { class: 'tracker-dist', hidden: true });
  private goalArrow = h('div', { class: 'goal-arrow', hidden: true, 'aria-hidden': 'true' }, [h('span', { class: 'goal-arrow-tip' }, ['➤'])]);

  /** An arrow at the screen edge toward a goal that is off screen (null hides it). Angle in radians, 0 = right. */
  setGoalArrow(at: { x: number; y: number; angle: number } | null): void {
    if (!at) {
      this.goalArrow.hidden = true;
      return;
    }
    if (!this.goalArrow.isConnected) this.root.append(this.goalArrow);
    this.goalArrow.hidden = false;
    this.goalArrow.style.transform = `translate(${at.x.toFixed(0)}px, ${at.y.toFixed(0)}px) translate(-50%, -50%) rotate(${at.angle.toFixed(3)}rad)`;
  }

  /** How far the tracked goal is, in metres (null hides it). Rounded so it does not flicker. */
  setTrackerDistance(m: number | null): void {
    if (m === null || !Number.isFinite(m)) {
      this.trackerDist.hidden = true;
      return;
    }
    const text = m < 6 ? t('hud.here') : t('hud.metres', { n: m < 100 ? Math.round(m / 5) * 5 : Math.round(m / 10) * 10 });
    if (this.trackerDist.textContent !== text) this.trackerDist.textContent = text;
    this.trackerDist.hidden = false;
  }


  /** Characters for name tags and the minimap. */
  setNpcs(markers: NpcMarker[]): void {
    this.npcMarkers = markers;
    if (!this.npcTags.length) {
      for (const m of markers) {
        const markEl = h('span', { class: 'npc-mark' });
        const el = h('button', { class: 'npc-tag', type: 'button', hidden: true, 'data-npc': m.id }, [
          h('span', { class: 'npc-emoji', 'aria-hidden': 'true' }, [NPC_EMOJI[m.id]]),
          h('span', {}, [t(`npc.${m.id}.short`)]),
          markEl,
        ]);
        el.style.setProperty('--npc', m.color);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.o.onTapNpc(m.id);
        });
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.labelLayer.append(el);
        this.npcTags.push({ id: m.id, el, markEl });
      }
    }
    for (const tag of this.npcTags) {
      const m = markers.find((x) => x.id === tag.id)!;
      tag.markEl.textContent = m.mark;
      tag.el.classList.toggle('has-mark', !!m.mark);
    }
  }

  /** Places to highlight on the minimap (errand destinations). */
  setMapTargets(targets: { x: number; z: number }[]): void {
    this.mapTargets = targets;
  }

  /* ------------------------------ info card ------------------------------ */

  showPoi(poi: Poi | null): void {
    this.selected = poi?.id ?? null;
    this.labels.forEach((l) => l.el.classList.toggle('selected', l.poi.id === this.selected));
    if (!poi) {
      this.card.hidden = true;
      return;
    }
    const zone = ZONES[poi.zone];
    const kind = poi.landmark || zone.kind === 'hub' ? t('hud.landmark') : t('hud.business');
    const closeBtn = iconButton('close', t('hud.close'), () => this.o.onSelectPoi(null), 'card-close');
    const go = h('button', { class: 'secondary-btn', type: 'button' }, [t('hud.goThere')]);
    go.addEventListener('click', () => this.o.onVisitPoi(poi.id));
    const parts: Node[] = [
      closeBtn,
      h('div', { class: 'card-chips' }, [
        h('span', { class: 'chip', style: { background: zone.color } }, [t(`district.${poi.zone}.name`)]),
        h('span', { class: 'chip ghost' }, [kind]),
      ]),
      h('h3', {}, [t(`poi.${poi.key}.name`)]),
      h('p', {}, [t(`poi.${poi.key}.desc`)]),
    ];
    if (ENTERABLE.has(poi.key)) parts.push(h('p', { class: 'soon enter' }, [t('hud.canEnter')]));
    else if (COMING_SOON.has(poi.key)) parts.push(h('p', { class: 'soon' }, [t('hud.comingSoon')]));
    parts.push(h('div', { class: 'card-actions' }, [go]));
    this.card.replaceChildren(...parts);
    this.card.hidden = false;
  }

  /* ------------------------------- labels ------------------------------- */

  setPlayer(pos: THREE.Vector3 | null, height = 1.8, nickname = ''): void {
    this.player = pos ? { pos, height } : null;
    this.nameTag.textContent = nickname;
  }

  private buildLabels(): void {
    for (const poi of this.o.pois) {
      const el = h('button', { class: `poi-label ${poi.landmark ? 'landmark' : ''}`, type: 'button' }, [t(`poi.${poi.key}.name`)]);
      el.style.setProperty('--zone', ZONES[poi.zone].color);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.o.onSelectPoi(poi.id);
      });
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.labelLayer.append(el);
      this.labels.push({ poi, el, pos: new THREE.Vector3(poi.x, poi.height + 2.5, poi.z) });
    }
  }

  private project(p: THREE.Vector3, camera: THREE.PerspectiveCamera, w: number, hgt: number): [number, number] | null {
    this.tmp.copy(p).project(camera);
    if (this.tmp.z > 1 || Math.abs(this.tmp.x) > 1.1 || Math.abs(this.tmp.y) > 1.1) return null;
    return [(this.tmp.x * 0.5 + 0.5) * w, (-this.tmp.y * 0.5 + 0.5) * hgt];
  }

  private updateLabels(camera: THREE.PerspectiveCamera, w: number, hgt: number): void {
    const camPos = camera.position;
    const follow = this.o.camera.mode === 'follow';
    const ref = follow && this.player ? this.player.pos : camPos;
    for (const l of this.labels) {
      // on foot the camera is low: hang labels on the facade instead of above the roof,
      // where tall buildings would push them out of view
      l.pos.y = follow ? Math.min(l.poi.height + 2.5, 4) : l.poi.height + 2.5;
      const d = ref.distanceTo(l.pos);
      const range = l.poi.landmark ? (follow ? 140 : 320) : follow ? 45 : 130;
      const show = this.playing && (d < range || l.poi.id === this.selected);
      const xy = show ? this.project(l.pos, camera, w, hgt) : null;
      if (!xy) {
        if (!l.el.hidden) l.el.hidden = true;
        continue;
      }
      l.el.hidden = false;
      l.el.style.transform = `translate(${xy[0].toFixed(1)}px, ${xy[1].toFixed(1)}px) translate(-50%, -100%)`;
      l.el.style.opacity = String(Math.min(1, (range - d) / 25 + 0.15));
      l.el.style.zIndex = String(1000 - Math.round(camPos.distanceTo(l.pos)));
    }
    // the player's nickname floats above their head
    const tag = this.player && this.playing ? this.project(this.tmp.copy(this.player.pos).setY(this.player.pos.y + this.player.height + 0.35), camera, w, hgt) : null;
    if (tag && this.nameTag.textContent) {
      this.nameTag.hidden = false;
      this.nameTag.style.transform = `translate(${tag[0].toFixed(1)}px, ${tag[1].toFixed(1)}px) translate(-50%, -100%)`;
    } else this.nameTag.hidden = true;

    const bxy = this.bubbleAt && this.playing ? this.project(this.tmp.copy(this.bubbleAt), camera, w, hgt) : null;
    if (bxy) {
      this.bubbleEl.hidden = false;
      this.bubbleEl.style.transform = `translate(${bxy[0].toFixed(1)}px, ${bxy[1].toFixed(1)}px) translate(-50%, -100%)`;
    } else this.bubbleEl.hidden = true;

    for (const tag of this.npcTags) {
      const m = this.npcMarkers.find((x) => x.id === tag.id);
      const d = m ? ref.distanceTo(m.pos) : Infinity;
      const xy = m && this.playing && d < (follow ? 38 : 90) ? this.project(this.tmp.copy(m.pos).setY(m.pos.y + m.height + 0.3), camera, w, hgt) : null;
      if (!xy) {
        if (!tag.el.hidden) tag.el.hidden = true;
        continue;
      }
      tag.el.hidden = false;
      tag.el.style.transform = `translate(${xy[0].toFixed(1)}px, ${xy[1].toFixed(1)}px) translate(-50%, -100%)`;
      tag.el.style.zIndex = String(1500 - Math.round(camPos.distanceTo(m!.pos)));
    }
  }

  /* ------------------------------- minimap ------------------------------- */

  private readonly mapRange = HALF_CITY + 12;

  private toMap(x: number, z: number, size: number): [number, number] {
    return [((x + this.mapRange) / (2 * this.mapRange)) * size, ((z + this.mapRange) / (2 * this.mapRange)) * size];
  }

  private drawMinimapBase(): void {
    const size = this.minimap.width;
    const c = this.minimapBase;
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#4b5058';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 36);
    ctx.fill();
    for (const zone of this.o.layout) {
      for (const lot of zone.lots) {
        const [x0, z0] = this.toMap(lot.rect.x0, lot.rect.z0, size);
        const [x1, z1] = this.toMap(lot.rect.x1, lot.rect.z1, size);
        ctx.fillStyle = ZONES[zone.id].color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.roundRect(x0, z0, x1 - x0, z1 - z0, 6);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const p of this.o.pois) {
      if (!p.landmark) continue;
      const [x, y] = this.toMap(p.x, p.z, size);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1f2a44';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawMinimap(): void {
    const size = this.minimap.width;
    const ctx = this.minimap.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(this.minimapBase, 0, 0);
    for (const target of this.mapTargets) {
      const [tx, ty] = this.toMap(target.x, target.z, size);
      ctx.strokeStyle = '#ffcf4d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(tx, ty, 13 + Math.sin(performance.now() / 250) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const m of this.npcMarkers) {
      if (!m.met && !m.mark) continue;
      const [nx, ny] = this.toMap(m.pos.x, m.pos.z, size);
      ctx.fillStyle = m.color;
      ctx.strokeStyle = m.mark ? '#ffcf4d' : '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(nx, ny, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const s = this.o.camera.state;
    const px = this.player ? this.player.pos.x : s.x;
    const pz = this.player ? this.player.pos.z : s.z;
    const [x, y] = this.toMap(px, pz, size);
    // view cone, pointing where the camera looks
    const look = Math.atan2(-Math.cos(s.yaw), -Math.sin(s.yaw));
    const r = 30 + s.distance * 0.6;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, look - 0.6, look + 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff5d6c';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /* -------------------------------- frame -------------------------------- */

  update(camera: THREE.PerspectiveCamera, width: number, height: number): void {
    this.updateLabels(camera, width, height);
    this.drawMinimap();
  }
}
