import { FRIEND_MAX } from '../content/friends';
import { TOWNSFOLK } from '../content/townsfolk';
import { friendCount, friendLevel, type FriendsState } from '../core/Friends';
import { NPC_IDS, NPCS, repLevel, type NpcId } from '../content/npcs';
import { metCount, type SocialState } from '../core/Social';
import { t } from '../i18n';
import { h, iconButton } from './dom';
import { NPC_EMOJI } from './npcStyle';

export interface PeoplePanelOptions {
  /** Where each character stands, as a district name for the "where" line. */
  placeOf(id: NpcId): string;
  onGoTo(id: NpcId): void;
  onEditCharacter(): void;
  onClose(): void;
}

/**
 * The "people of the city" journal: everyone the player has met, how well
 * they get along, and the errands in progress. Characters not met yet show
 * where to find them, so the journal doubles as a guide.
 */
export class PeoplePanel {
  readonly el: HTMLDivElement;
  private body: HTMLDivElement;

  constructor(private o: PeoplePanelOptions) {
    this.body = h('div', { class: 'people-body' });
    const close = iconButton('close', t('hud.close'), () => o.onClose(), 'modal-close');
    const edit = h('button', { class: 'secondary-btn people-edit', type: 'button' }, [t('people.editCharacter')]);
    edit.addEventListener('click', () => o.onEditCharacter());
    const panel = h('div', { class: 'modal-panel people-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('people.title') }, [
      close,
      h('h2', {}, [t('people.title')]),
      this.body,
      edit,
    ]);
    this.el = h('div', { class: 'modal', hidden: true, onclick: (e: Event) => e.target === this.el && o.onClose() }, [panel]);
  }

  render(s: SocialState, friends: FriendsState = {}): void {
    const known = TOWNSFOLK.filter(({ id }) => friends[id]);
    const friendList = known.length
      ? h(
          'div',
          { class: 'people-friends' },
          known.map(({ id }) => {
            const lvl = friendLevel(friends[id].points);
            return h('div', { class: 'people-friend', 'data-friend': id }, [
              h('strong', {}, [t(`friend.${id}.name`)]),
              h('em', {}, [t(`friend.${id}.role`)]),
              h('div', { class: 'friend-hearts' }, [...Array.from({ length: FRIEND_MAX }, (_, i) => h('i', { class: i < lvl ? 'on' : '' }, [i < lvl ? '❤' : '♡']))]),
              friends[id].favor === 'active' || friends[id].favor === 'ready'
                ? h('span', { class: 'people-errand active' }, [`🤝 ${t(friends[id].favor === 'ready' ? 'people.errandReady' : 'people.errandActive')}`])
                : null,
            ]);
          }),
        )
      : h('p', { class: 'people-empty' }, [t('people.friendsNone')]);
    const tasks = NPC_IDS.filter((id) => s.errands[id] === 'active' || s.errands[id] === 'ready');
    const taskList = tasks.length
      ? h(
          'ul',
          { class: 'people-tasks' },
          tasks.map((id) =>
            h('li', { class: s.errands[id] === 'ready' ? 'ready' : '' }, [
              h('strong', {}, [t(`errand.${id}.title`)]),
              h('span', {}, [s.errands[id] === 'ready' ? t('errand.ready', { name: t(`npc.${id}.short`) }) : t(`errand.${id}.goal`)]),
            ]),
          ),
        )
      : h('p', { class: 'people-empty' }, [t('people.noTasks')]);

    const cards = NPC_IDS.map((id) => {
      const n = s.npcs[id];
      const def = NPCS[id];
      const level = repLevel(n.rep);
      const errand = s.errands[id];
      const go = h('button', { class: 'link-btn people-go', type: 'button', 'data-npc': id }, [t('people.findThem')]);
      go.addEventListener('click', () => this.o.onGoTo(id));
      const status =
        errand === 'none'
          ? null
          : h('span', { class: `people-errand ${errand}` }, [
              `${t('people.errand')}: `,
              t(errand === 'done' ? 'people.errandDone' : errand === 'ready' ? 'people.errandReady' : 'people.errandActive'),
            ]);
      const card = h('article', { class: `people-card ${n.met ? 'met' : 'unmet'}`, 'data-npc': id }, [
        h('div', { class: 'people-portrait', 'aria-hidden': 'true' }, [NPC_EMOJI[id]]),
        h('div', { class: 'people-info' }, [
          h('strong', {}, [t(`npc.${id}.name`)]),
          h('em', {}, [t(`npc.${id}.role`)]),
          n.met
            ? h('div', { class: 'dlg-rel' }, [...[0, 1, 2, 3].map((i) => h('i', { class: i <= level ? 'on' : '' })), h('span', {}, [t(`rep.level.${level}`)])])
            : h('span', { class: 'people-unmet' }, [t('people.notMet')]),
          n.met ? h('p', {}, [t(`npc.${id}.bio`)]) : null,
          h('span', { class: 'people-where' }, [t('people.where', { place: this.o.placeOf(id) })]),
          status,
          go,
        ]),
      ]);
      card.style.setProperty('--npc', def.color);
      return card;
    });

    this.body.replaceChildren(
      h('p', { class: 'people-count' }, [t('people.met', { n: metCount(s) })]),
      h('h3', {}, [t('people.tasksTitle')]),
      taskList,
      h('div', { class: 'people-grid' }, cards),
      h('h3', {}, [t('people.friendsTitle')]),
      h('p', { class: 'people-count' }, [t('people.friendsCount', { n: friendCount(friends) })]),
      friendList,
    );
  }
}
