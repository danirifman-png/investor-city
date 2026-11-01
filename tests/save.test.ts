import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK } from '../src/content/characterOptions';
import { migrate, newSave, SAVE_KEY, SaveStore, type StorageLike } from '../src/core/Save';

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const look = { ...DEFAULT_LOOK, nickname: 'Dana' };

describe('save system', () => {
  it('round-trips a save through storage', () => {
    const store = new SaveStore(new MemoryStorage());
    const data = newSave(look);
    data.player = { x: 12.5, y: 0.3, z: -40, heading: 1.2 };
    data.progress.visited = ['tech', 'banking'];
    data.settings.night = true;
    expect(store.save(data)).toBe(true);
    const loaded = store.load()!;
    expect(loaded.character.nickname).toBe('Dana');
    expect(loaded.player).toEqual({ x: 12.5, y: 0.3, z: -40, heading: 1.2 });
    expect(loaded.progress.visited).toEqual(['tech', 'banking']);
    expect(loaded.settings.night).toBe(true);
  });

  it('clear removes the save', () => {
    const mem = new MemoryStorage();
    const store = new SaveStore(mem);
    store.save(newSave(look));
    expect(mem.map.has(SAVE_KEY)).toBe(true);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('rejects garbage and unknown versions', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('hello')).toBeNull();
    expect(migrate({ version: 0 })).toBeNull();
    expect(migrate({ version: 99 })).toBeNull();
    const mem = new MemoryStorage();
    mem.setItem(SAVE_KEY, '{not json');
    expect(new SaveStore(mem).load()).toBeNull();
  });

  it('sanitizes tampered fields', () => {
    const s = migrate({
      version: 1,
      character: { nickname: '<script>x</script>', hairStyle: 'mohawk', skin: 'red' },
      player: { x: 1e9, z: 'a', heading: NaN },
      settings: { night: 'yes' },
      progress: { visited: ['tech', 'tech', 'moon', 5], metresWalked: -3 },
    })!;
    expect(s.character.nickname).toBe('scriptxscript');
    expect(s.character.hairStyle).toBe(DEFAULT_LOOK.hairStyle);
    expect(s.character.skin).toBe(DEFAULT_LOOK.skin);
    expect(s.player.x).toBe(200);
    expect(s.player.z).toBe(14);
    expect(Number.isFinite(s.player.heading)).toBe(true);
    expect(s.settings.night).toBe(false);
    expect(s.progress.visited).toEqual(['tech']);
    expect(s.progress.metresWalked).toBe(0);
  });

  it('works without storage and survives quota errors', () => {
    expect(new SaveStore(null).save(newSave(look))).toBe(false);
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => {},
    };
    expect(new SaveStore(full).save(newSave(look))).toBe(false);
  });
});
