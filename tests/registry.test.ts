import { describe, expect, it } from 'vitest';
import { Registry } from '../src/core/registry';

describe('Registry', () => {
  it('registers, gets, lists in order', () => {
    const r = new Registry<{ id: string; v: number }>('thing');
    r.register({ id: 'a', v: 1 });
    r.register({ id: 'b', v: 2 });
    expect(r.get('b').v).toBe(2);
    expect(r.list().map((x) => x.id)).toEqual(['a', 'b']);
    expect(r.has('c')).toBe(false);
    expect(r.tryGet('c')).toBeUndefined();
  });

  it('rejects duplicates unless overriding, and names the kind in errors', () => {
    const r = new Registry<{ id: string }>('currency');
    r.register({ id: 'coins' });
    expect(() => r.register({ id: 'coins' })).toThrow(/currency "coins"/);
    expect(() => r.register({ id: 'coins' }, { override: true })).not.toThrow();
    expect(() => r.get('pearls')).toThrow(/Unknown currency "pearls"/);
  });
});
