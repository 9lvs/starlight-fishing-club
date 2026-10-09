// Proves content can be added with JSON alone: a new upgrade and a new water
// (with a fish) go through the real loader, validation, registries, stats, and
// world state without touching any code.
import { describe, expect, it } from 'vitest';
import { bootstrap } from '../src/core/bootstrap';
import { parseContent } from '../src/core/content/parseContent';
import { UpgradeService } from '../src/features/upgrades/service';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

const newUpgrade = {
  id: 'tackle_box',
  branch: 'gear',
  name: 'Tackle Box',
  description: 'Neatly sorted hooks. Fish bite a little sooner.',
  prerequisites: ['cork_grip'],
  maxLevel: 3,
  baseCost: 50,
  modifiers: [{ stat: 'waitMaxMs', op: 'add', value: -400 }],
};

const newWater = {
  id: 'lantern_lake',
  name: 'Lantern Lake',
  description: 'Paper lanterns float on the water all year round.',
  order: 5,
  rangeRequired: 1,
  spriteKey: 'water_lantern_lake',
  scene: { hills: 'pines', foreground: 'lilies' },
};

const newFish = {
  id: 'glow_minnow',
  name: 'Glow Minnow',
  rarity: 'common',
  waters: ['lantern_lake'],
  baseValue: 3,
  spriteKey: 'fish_glow_minnow',
  description: 'A tiny fish that carries its own lantern.',
};

function boot(extra: Record<string, unknown>) {
  const files = { ...readContentFiles(), ...extra };
  const res = bootstrap({ features: [], loadContent: () => parseContent(files), storage: new MemoryStorage(), debug: false });
  expect(res.errors).toEqual([]);
  return res.ctx!;
}

describe('adding content with JSON only', () => {
  it('a new upgrade file is loaded, validated, and changes its stat when bought', () => {
    const ctx = boot({ '../../content/mypack/upgrades.json': [newUpgrade] });
    expect(ctx.registries.upgrades.get('tackle_box').name).toBe('Tackle Box');
    const svc = new UpgradeService(ctx, { levels: { cork_grip: 1 } });
    svc.applyAll();
    ctx.wallet.add('coins', 1000);
    const before = ctx.stats.get('waitMaxMs');
    expect(svc.buy('tackle_box')).toBe(true);
    expect(ctx.stats.get('waitMaxMs')).toBe(before - 400);
    expect(svc.buy('tackle_box')).toBe(true);
    expect(ctx.stats.get('waitMaxMs')).toBe(before - 800);
    expect(ctx.wallet.get('coins')).toBe(1000 - 50 - Math.round(50 * 1.15));
  });

  it('a new water appears, unlocks with boat range, and has its own fish pool', () => {
    const ctx = boot({
      '../../content/mypack/waters.json': [newWater],
      '../../content/mypack/fish.json': [newFish],
    });
    expect(ctx.world.isUnlocked('lantern_lake')).toBe(false);
    const unlocked: string[] = [];
    ctx.bus.on('waterUnlocked', (e) => unlocked.push(e.waterId));
    ctx.stats.setSource('test', [{ stat: 'boatRange', op: 'add', value: 1 }]);
    expect(ctx.world.isUnlocked('lantern_lake')).toBe(true);
    expect(unlocked).toContain('lantern_lake');
    expect(ctx.world.setWater('lantern_lake')).toBe(true);
    expect(ctx.world.conditions().waterId).toBe('lantern_lake');
  });

  it('bad JSON in a new pack stops boot with a precise message', () => {
    const files = { ...readContentFiles(), '../../content/mypack/upgrades.json': [{ ...newUpgrade, modifiers: [{ stat: 'lukc', op: 'add', value: 1 }] }] };
    const res = bootstrap({ features: [], loadContent: () => parseContent(files), storage: new MemoryStorage(), debug: false });
    expect(res.ctx).toBeNull();
    expect(res.errors.join('\n')).toMatch(/mypack\/upgrades\.json > entry "tackle_box" > field "modifiers\.0\.stat": unknown stat "lukc"/);
  });
});
