import type { DialogueDef, DNode } from './types';

/**
 * DATA: Oliver's part of the first quest, "Meet your first mentor". Once the
 * player has explored the square and walked up to him (`mentor.ready`), his
 * next conversation is a short money decision. A wrong answer gets an
 * explanation and another try; the right one sets `mentor.solved` and leads
 * into his usual errand offer.
 */

const nodes: Record<string, DNode> = {
  mentor1: { mood: 'wave', do: [{ flag: 'mentor.met' }], next: 'mentor2' },
  mentor2: { mood: 'think', next: 'mentorQ' },
  mentorQ: {
    mood: 'think',
    choices: [
      { to: 'mentorSpend', tone: 'joke' },
      { to: 'mentorRight', tone: 'smart', do: [{ rep: 10 }, { flag: 'mentor.solved' }, { flag: 'learn.savings' }, { flag: 'learn.opportunityCost' }] },
      { to: 'mentorRumor', tone: 'curious' },
    ],
  },
  mentorSpend: { mood: 'shake', do: [{ flag: 'mentor.wrong' }], next: 'mentorAgain' },
  mentorRumor: { mood: 'surprised', do: [{ flag: 'mentor.wrong' }, { flag: 'learn.rumor' }], next: 'mentorAgain' },
  mentorAgain: { mood: 'nod', next: 'mentorQ' },
  mentorRight: { mood: 'cheer', next: 'mentorGift' },
  mentorGift: { mood: 'happy', next: 'hub' },
};

/** Puts the mentor lines in front of Oliver's usual openings. */
export function addMentorQuest(oliver: DialogueDef): void {
  Object.assign(oliver.nodes, nodes);
  oliver.entry.unshift({ if: { flag: 'mentor.ready', notFlag: 'mentor.solved' }, node: 'mentor1' });
}
