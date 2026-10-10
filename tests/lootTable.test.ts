import { describe, expect, it } from 'vitest';
import { LOOT } from '../src/config/balance';
import { seededRng } from '../src/core/rng';
import {
  filterPool,
  fishChances,
  maxEffectiveLuck,
  rarityChances,
  rarityWeights,
  resolveTier,
  rollCatch,
  type LootFish,
} from '../src/systems/lootTable';
import { loadBaseContent } from './helpers/content';

const { content } = loadBaseContent();
const rarities = content.rarities;
const day = { waterId: 'pond', phase: 'day', weather: 'clear' };

function fish(id: string, rarity: string, extra: Partial<LootFish> = {}): LootFish {
  return { id, rarity, waters: ['pond'], timeOfDay: [], weather: [], weight: 1, ...extra };
}

describe('rarity weights', () => {
  it('match the table at zero luck', () => {
    const w = Object.fromEntries(rarityWeights(rarities, 0, LOOT).map((x) => [x.id, x.weight]));
    expect(w).toEqual({ common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 });
  });

  it('luck moves weight from common into higher tiers and keeps the total', () => {
    const w = rarityWeights(rarities, 20, LOOT);
    const total = w.reduce((s, x) => s + x.weight, 0);
    expect(total).toBeCloseTo(100);
    const byId = Object.fromEntries(w.map((x) => [x.id, x.weight]));
    expect(byId.common).toBeCloseTo(40);
    expect(byId.uncommon).toBeGreaterThan(25);
    expect(byId.legendary).toBeGreaterThan(1);
  });

  it('caps luck so legendary never exceeds 6 percent', () => {
    expect(maxEffectiveLuck(rarities, LOOT)).toBeCloseTo(50);
    for (const luck of [50, 80, 1000, 1e9]) {
      expect(rarityChances(rarities, luck, LOOT).get('legendary')!).toBeLessThanOrEqual(0.06 + 1e-9);
    }
  });

  it('lures move weight into one rarity only, taken from the lowest tier', () => {
    const byId = Object.fromEntries(rarityWeights(rarities, 0, LOOT, { rare: 6 }).map((x) => [x.id, x.weight]));
    expect(byId).toEqual({ common: 54, uncommon: 25, rare: 16, epic: 4, legendary: 1 });
  });

  it('lures never push the lowest tier below zero or a tier past its cap', () => {
    const w = rarityWeights(rarities, 50, LOOT, { uncommon: 500, legendary: 500 });
    const total = w.reduce((s, x) => s + x.weight, 0);
    expect(total).toBeCloseTo(100);
    for (const x of w) expect(x.weight).toBeGreaterThanOrEqual(0);
    expect(rarityChances(rarities, 50, LOOT, { legendary: 500 }).get('legendary')!).toBeLessThanOrEqual(0.06 + 1e-9);
  });

  it('treats negative luck as zero', () => {
    expect(rarityChances(rarities, -10, LOOT).get('common')).toBeCloseTo(0.6);
  });
});

describe('pool filtering and fallback', () => {
  const pool = [
    fish('a', 'common'),
    fish('night_only', 'rare', { timeOfDay: ['night'] }),
    fish('rain_only', 'uncommon', { weather: ['rain'] }),
    fish('river', 'common', { waters: ['river'] }),
  ];

  it('filters by water, time of day, and weather', () => {
    expect(filterPool(pool, day).map((f) => f.id)).toEqual(['a']);
    expect(filterPool(pool, { ...day, phase: 'night' }).map((f) => f.id)).toEqual(['a', 'night_only']);
    expect(filterPool(pool, { ...day, weather: 'rain' }).map((f) => f.id)).toEqual(['a', 'rain_only']);
  });

  it('falls back one tier lower when the rolled tier has no valid fish', () => {
    const p = [fish('c', 'common'), fish('u', 'uncommon')];
    expect(resolveTier(p, 'rare', rarities)).toBe('uncommon');
    expect(resolveTier(p, 'legendary', rarities)).toBe('uncommon');
    expect(resolveTier([fish('e', 'epic')], 'common', rarities)).toBe('epic');
    expect(resolveTier([], 'common', rarities)).toBeNull();
  });

  it('fish chances include fallback and sum to 1', () => {
    const p = [fish('c', 'common'), fish('u1', 'uncommon'), fish('u2', 'uncommon', { weight: 3 })];
    const ch = fishChances(rarities, p, day, 0, LOOT);
    const sum = [...ch.values()].reduce((s, x) => s + x, 0);
    expect(sum).toBeCloseTo(1);
    // uncommon gets its own 25% plus rare/epic/legendary falling back (15%), split 1:3
    expect(ch.get('u1')).toBeCloseTo(0.4 * 0.25);
    expect(ch.get('u2')).toBeCloseTo(0.4 * 0.75);
  });
});

describe('pity counter', () => {
  const pool = content.fish;

  it('guarantees rare or better after 40 rolls without one, then resets', () => {
    const rng = seededRng(42);
    const roll = rollCatch({ rarities, fish: pool, conditions: day, luck: 0, rng, cfg: LOOT, pity: 40 });
    expect(roll).not.toBeNull();
    expect(roll!.pityTriggered).toBe(true);
    const tier = rarities.find((r) => r.id === roll!.rarityId)!.tier;
    expect(tier).toBeGreaterThanOrEqual(LOOT.pityMinTier);
    expect(roll!.pity).toBe(0);
  });

  it('counts up on lower tiers and never triggers before the threshold', () => {
    const rng = seededRng(7);
    let pity = 0;
    let longestDry = 0;
    let dry = 0;
    for (let i = 0; i < 20000; i++) {
      const r = rollCatch({ rarities, fish: pool, conditions: day, luck: 0, rng, cfg: LOOT, pity })!;
      if (r.pityTriggered) expect(pity).toBe(LOOT.pityThreshold);
      pity = r.pity!;
      const tier = rarities.find((x) => x.id === r.rarityId)!.tier;
      dry = tier >= LOOT.pityMinTier ? 0 : dry + 1;
      longestDry = Math.max(longestDry, dry);
    }
    expect(longestDry).toBeLessThanOrEqual(LOOT.pityThreshold);
  });

  it('crew and offline rolls skip pity entirely', () => {
    const r = rollCatch({ rarities, fish: pool, conditions: day, luck: 0, rng: seededRng(1), cfg: LOOT });
    expect(r!.pity).toBeUndefined();
    expect(r!.pityTriggered).toBe(false);
  });
});

describe('10,000 cast simulation', () => {
  it('lands within 1 percentage point of the rarity table', () => {
    const rng = seededRng(20240601);
    const n = 10000;
    const counts: Record<string, number> = {};
    let pity = 0;
    for (let i = 0; i < n; i++) {
      const r = rollCatch({ rarities, fish: content.fish, conditions: day, luck: 0, rng, cfg: LOOT, pity })!;
      pity = r.pity!;
      counts[r.rarityId] = (counts[r.rarityId] ?? 0) + 1;
    }
    const expected = { common: 0.6, uncommon: 0.25, rare: 0.1, epic: 0.04, legendary: 0.01 };
    for (const [id, p] of Object.entries(expected)) {
      expect(Math.abs((counts[id] ?? 0) / n - p)).toBeLessThan(0.01);
    }
  });
});
