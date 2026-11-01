import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NPC_IDS, NPCS } from '../src/content/npcs';

const REQUIRED_CLIPS = ['idle', 'walk', 'nod', 'shake', 'sad'];
const KEY_BONES = ['Hips', 'Spine', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];

describe('realistic avatars', () => {
  const withAvatar = NPC_IDS.filter((id) => NPCS[id].avatar);

  it('Marco has a realistic model in the test', () => {
    expect(withAvatar).toContain('marco');
  });

  for (const id of withAvatar) {
    const a = NPCS[id].avatar!;
    it(`${id}: model and animation files exist and are credited`, () => {
      expect(fs.existsSync(`public/${a.model}`)).toBe(true);
      const credits = fs.readFileSync('public/models/CREDITS.md', 'utf8');
      expect(credits).toContain(a.model.split('/').pop());
      if (a.anims) {
        expect(fs.existsSync(`public/${a.anims}`)).toBe(true);
        expect(credits).toContain(a.anims.split('/').pop());
      }
    });

    if (!a.anims) continue;
    const anims = a.anims;
    it(`${id}: baked clips cover the gestures and are well formed`, () => {
      const { clips } = JSON.parse(fs.readFileSync(`public/${anims}`, 'utf8'));
      const names = clips.map((c: { name: string }) => c.name);
      for (const n of REQUIRED_CLIPS) expect(names, n).toContain(n);
      for (const c of clips) {
        const frames = c.times.length;
        expect(frames).toBeGreaterThan(1);
        expect(c.hips.length).toBe(frames * 3);
        for (const b of KEY_BONES) {
          const q: number[] = c.rot[b];
          expect(q, `${c.name}.${b}`).toBeDefined();
          expect(q.length).toBe(frames * 4);
          for (let i = 0; i < q.length; i += 4) expect(Math.hypot(q[i], q[i + 1], q[i + 2], q[i + 3])).toBeCloseTo(1, 2);
        }
      }
    });
  }
});
