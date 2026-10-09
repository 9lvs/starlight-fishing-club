import { describe, expect, it, vi } from 'vitest';
import { StatsService, computeStat, modifierAtLevel, type StatDef } from '../src/core/stats';

const luck: StatDef = { id: 'luck', base: 10 };

describe('modifier pipeline', () => {
  it('applies set, then add, then mult within the same priority', () => {
    const v = computeStat(luck, [
      { stat: 'luck', op: 'mult', value: 2, source: 'a' },
      { stat: 'luck', op: 'add', value: 5, source: 'b' },
      { stat: 'luck', op: 'set', value: 1, source: 'c' },
    ]);
    // set 1 -> add 5 = 6 -> mult 2 = 12
    expect(v).toBe(12);
  });

  it('orders by priority first', () => {
    const v = computeStat(luck, [
      { stat: 'luck', op: 'add', value: 5, priority: 10, source: 'late' },
      { stat: 'luck', op: 'mult', value: 2, priority: 0, source: 'early' },
    ]);
    // (10 * 2) + 5
    expect(v).toBe(25);
  });

  it('clamps and rounds integer stats', () => {
    const def: StatDef = { id: 'slots', base: 1, min: 0, max: 3, integer: true };
    expect(computeStat(def, [{ stat: 'slots', op: 'add', value: 7.6, source: 'x' }])).toBe(3);
    expect(computeStat(def, [{ stat: 'slots', op: 'add', value: 0.6, source: 'x' }])).toBe(2);
  });

  it('scales per-level modifiers', () => {
    expect(modifierAtLevel({ stat: 's', op: 'add', value: 2 }, 3).value).toBe(6);
    expect(modifierAtLevel({ stat: 's', op: 'mult', value: 0.9 }, 2).value).toBeCloseTo(0.81);
    expect(modifierAtLevel({ stat: 's', op: 'set', value: 4 }, 5).value).toBe(4);
    expect(modifierAtLevel({ stat: 's', op: 'mult', value: 0.9 }, 0).value).toBe(1);
  });
});

describe('StatsService', () => {
  it('caches, notifies, and replaces modifiers by source', () => {
    const changed = vi.fn();
    const s = new StatsService(changed);
    s.define(luck);
    s.addModifier({ stat: 'luck', op: 'add', value: 2, source: 'upgrade:charm' });
    expect(s.get('luck')).toBe(12);
    s.setSource('upgrade:charm', [{ stat: 'luck', op: 'add', value: 4 }]);
    expect(s.get('luck')).toBe(14);
    s.removeSource('upgrade:charm');
    expect(s.get('luck')).toBe(10);
    expect(changed).toHaveBeenCalledWith(['luck']);
  });

  it('throws a clear error for unknown stats', () => {
    const s = new StatsService();
    expect(() => s.addModifier({ stat: 'nope', op: 'add', value: 1, source: 'x' })).toThrow(/Unknown stat "nope"/);
  });

  it('previews a change without applying it', () => {
    const s = new StatsService();
    s.define(luck);
    expect(s.preview('luck', [{ stat: 'luck', op: 'add', value: 3, source: 'p' }])).toBe(13);
    expect(s.get('luck')).toBe(10);
  });
});
