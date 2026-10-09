import { describe, expect, it } from 'vitest';
import type { SaveSliceDef } from '../src/core/feature';
import { fishingSlice } from '../src/features/fishing/state';
import { MemoryStorage, SaveManager, checksum, materializeSlice, migrateRoot } from '../src/systems/saveManager';

const opts = { storageKey: 'save', backupKeyPrefix: 'backup-', exportPrefix: 'SFC1' };
const counter: SaveSliceDef<{ n: number; extra: { a: number } }> = {
  key: 'counter',
  version: 1,
  defaults: () => ({ n: 0, extra: { a: 1 } }),
};

function manager(storage = new MemoryStorage(), now = () => 1000) {
  const m = new SaveManager(storage, now, opts);
  m.register(counter);
  m.register(fishingSlice);
  return m;
}

describe('SaveManager', () => {
  it('starts fresh, saves, and reloads every slice', () => {
    const storage = new MemoryStorage();
    const a = manager(storage);
    expect(a.load().fresh).toBe(true);
    a.slice<{ n: number }>('counter').n = 42;
    a.slice<{ pity: number }>('fishing').pity = 7;
    expect(a.save()).toBe(true);
    const b = manager(storage);
    expect(b.load().fresh).toBe(false);
    expect(b.slice<{ n: number }>('counter').n).toBe(42);
    expect(b.slice<{ pity: number }>('fishing').pity).toBe(7);
  });

  it('fills new fields from defaults when loading an older slice', () => {
    const storage = new MemoryStorage();
    storage.setItem('save', JSON.stringify({ version: 1, createdAt: 1, savedAt: 1, slices: { counter: { v: 1, data: { n: 3 } } } }));
    const m = manager(storage);
    m.load();
    expect(m.slice('counter')).toEqual({ n: 3, extra: { a: 1 } });
  });

  it('keeps slices of removed features untouched', () => {
    const storage = new MemoryStorage();
    storage.setItem('save', JSON.stringify({ version: 1, createdAt: 1, savedAt: 1, slices: { gone: { v: 3, data: { keep: true } } } }));
    const m = manager(storage);
    m.load();
    m.save();
    expect(JSON.parse(storage.getItem('save')!).slices.gone).toEqual({ v: 3, data: { keep: true } });
  });

  it('backs up an unreadable save instead of losing it', () => {
    const storage = new MemoryStorage();
    storage.setItem('save', '{not json');
    const m = manager(storage);
    const res = m.load();
    expect(res.recovered).toBe(true);
    expect(storage.getItem('backup-unreadable')).toBe('{not json');
  });

  it('does not write after reset, so a pending autosave cannot undo it', () => {
    const storage = new MemoryStorage();
    const m = manager(storage);
    m.load();
    m.save();
    m.reset();
    expect(storage.getItem('save')).toBeNull();
    expect(m.save()).toBe(false);
    expect(storage.getItem('save')).toBeNull();
    expect(storage.getItem('backup-last')).not.toBeNull();
  });
});

describe('migrations', () => {
  it('migrates the v0 flat prototype save to v1 slices', () => {
    const root = migrateRoot({ coins: 55, savedAt: 9, journal: { pebble_minnow: { count: 1 } } });
    expect(root.version).toBe(1);
    expect(root.slices.wallet).toEqual({ v: 1, data: { balances: { coins: 55 } } });
    expect(root.slices.journal!.data).toEqual({ entries: { pebble_minnow: { count: 1 } } });
  });

  it('migrates the fishing slice from v1 (id list) to v2 (items with size)', () => {
    const data = materializeSlice(fishingSlice, { v: 1, data: { pity: 12, creel: ['pebble_minnow', 'reed_pike'] } });
    expect(data.pity).toBe(12);
    expect(data.creel).toEqual([
      { fishId: 'pebble_minnow', size: 0, at: 0 },
      { fishId: 'reed_pike', size: 0, at: 0 },
    ]);
    expect(data.totals).toEqual({ casts: 0, catches: 0, misses: 0 });
  });

  it('loads an old save file end to end', () => {
    const storage = new MemoryStorage();
    storage.setItem('save', JSON.stringify({ version: 1, createdAt: 1, savedAt: 1, slices: { fishing: { v: 1, data: { pity: 3, creel: ['sand_dab'] } } } }));
    const m = manager(storage);
    m.load();
    expect(m.slice<{ creel: unknown[] }>('fishing').creel).toEqual([{ fishId: 'sand_dab', size: 0, at: 0 }]);
  });

  it('refuses saves from a newer version', () => {
    expect(() => migrateRoot({ version: 99, createdAt: 0, savedAt: 0, slices: {} })).toThrow(/newer/);
  });
});

describe('export and import', () => {
  it('round-trips through the export string', () => {
    const a = manager();
    a.load();
    a.slice<{ n: number }>('counter').n = 9;
    const code = a.exportString();
    expect(code.startsWith('SFC1.')).toBe(true);
    const storage = new MemoryStorage();
    const b = manager(storage);
    b.load();
    expect(b.importString(code)).toEqual({ ok: true });
    const c = manager(storage);
    c.load();
    expect(c.slice<{ n: number }>('counter').n).toBe(9);
  });

  it('a damaged code fails the checksum and leaves the current save untouched', () => {
    const storage = new MemoryStorage();
    const a = manager(storage);
    a.load();
    a.slice<{ n: number }>('counter').n = 5;
    a.save();
    const before = storage.getItem('save');
    const code = a.exportString();
    const [p, payload, sum] = code.split('.');
    const tampered = `${p}.${payload!.slice(0, -4)}AAAA.${sum}`;
    const res = a.importString(tampered);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/checksum/);
    expect(storage.getItem('save')).toBe(before);
    expect(a.save()).toBe(true);
  });

  it('rejects garbage and valid-checksum codes with broken contents', () => {
    const a = manager();
    a.load();
    expect(a.importString('hello').ok).toBe(false);
    const payload = btoa(JSON.stringify({ version: 1, slices: 'nope' }));
    const res = a.importString(`SFC1.${payload}.${checksum(payload)}`);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/could not be read/);
  });
});
