import { describe, expect, it } from 'vitest';
import { CATCH } from '../src/config/tuning';
import { escapeChance, quickBonus } from '../src/systems/catchOdds';

const cfg = CATCH.escape;

describe('escape chance', () => {
  it('is small for a common fish and grows with rarity', () => {
    expect(escapeChance(0, 0, 0, 1, cfg)).toBe(0);
    expect(escapeChance(0.08, 5, 5, 1, cfg)).toBeCloseTo(0.08);
    expect(escapeChance(0.25, 14, 14, 1, cfg)).toBeGreaterThan(escapeChance(0.08, 5, 5, 1, cfg));
  });

  it('climbs steeply without enough tackle, but always leaves a slim chance to land it', () => {
    const short = escapeChance(0.25, 14, 0, 1, cfg);
    expect(short).toBe(cfg.max);
    expect(short).toBeLessThan(1);
    expect(escapeChance(0.08, 5, 2, 1, cfg)).toBeCloseTo(0.08 + 3 * cfg.perShortfall);
  });

  it('eases with surplus tackle and Sharp Hooks, down to a floor', () => {
    const plenty = escapeChance(0.25, 14, 40, 1, cfg);
    expect(plenty).toBeCloseTo(0.25 * cfg.minFactor);
    expect(escapeChance(0.25, 14, 14, 0.5, cfg)).toBeCloseTo(0.125);
  });
});

describe('quick catch bonus', () => {
  it('rewards a fast reel, more for a very fast one, nothing for a slow one', () => {
    expect(quickBonus(300, 1200, CATCH.quick)?.label).toBe('Perfect catch!');
    expect(quickBonus(700, 1200, CATCH.quick)?.label).toBe('Quick catch!');
    expect(quickBonus(1100, 1200, CATCH.quick)).toBeNull();
  });

  it('a wider window (Smooth Reel) turns a slow reel into a quick one', () => {
    expect(quickBonus(1000, 1200, CATCH.quick, 1.6)?.label).toBe('Quick catch!');
  });
});
