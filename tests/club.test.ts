// Moving the club: rank gating for higher tiers, the reset on a move, what is
// kept, the coin bonus, and old saves keeping the waters they reached.
import { describe, expect, it } from 'vitest';
import { SAVE } from '../src/config/tuning';
import { bootstrap } from '../src/core/bootstrap';
import { clubBonus, moveClub } from '../src/core/club';
import { parseContent } from '../src/core/content/parseContent';
import type { GameFeature } from '../src/core/feature';
import { CrewService } from '../src/features/crew/service';
import { crewSlice, type CrewSlice } from '../src/features/crew/state';
import { UpgradeService } from '../src/features/upgrades/service';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

/** Upgrades and crew without their Phaser scenes, wired the way their features wire them. */
function boot(storage = new MemoryStorage()) {
  let upgrades!: UpgradeService;
  let crew!: CrewService;
  const features: GameFeature[] = [
    {
      id: 'upgrades',
      saveSlice: { key: 'upgrades', version: 1, defaults: () => ({ levels: {} }) },
      init(ctx) {
        upgrades = new UpgradeService(ctx, ctx.save.slice('upgrades'));
        upgrades.applyAll();
        ctx.bus.on('clubMoved', () => upgrades.resetForMove());
      },
    },
    {
      id: 'crew',
      saveSlice: crewSlice,
      init(ctx) {
        crew = new CrewService(ctx, ctx.save.slice<CrewSlice>('crew'));
        ctx.bus.on('clubMoved', () => crew.resetForMove());
      },
    },
  ];
  const res = bootstrap({ features, loadContent: () => parseContent(readContentFiles()), storage, debug: false });
  expect(res.errors).toEqual([]);
  return { ctx: res.ctx!, upgrades, crew };
}

/** Buy an upgrade with exactly enough coins. */
function buy(g: ReturnType<typeof boot>, id: string): boolean {
  const u = g.ctx.registries.upgrades.get(id);
  g.ctx.wallet.add(u.currency ?? 'coins', g.upgrades.cost(u));
  return g.upgrades.buy(id);
}

describe('crew bunks', () => {
  it('a helper needs both a crew contract and a bunk on the boat', () => {
    const g = boot();
    expect(buy(g, 'hire_help')).toBe(true);
    expect(buy(g, 'boat_1')).toBe(true);
    g.ctx.wallet.add('coins', 1000);
    expect(g.crew.slots).toBe(0);
    expect(g.crew.hire('deckhand')).toBe(false);
    // The Painted Rowboat has the first bunk (and needs a patched hull first).
    expect(buy(g, 'boat_2')).toBe(false);
    expect(buy(g, 'patched_hull')).toBe(true);
    expect(buy(g, 'boat_2')).toBe(true);
    expect(g.crew.slots).toBe(1);
    expect(g.crew.hire('deckhand')).toBe(true);
  });
});

describe('rod and boat tiers', () => {
  it('higher tiers stay locked until the club reaches a bigger water', () => {
    const g = boot();
    for (const id of ['rod_1', 'rod_2', 'rod_3']) expect(buy(g, id)).toBe(true);
    expect(g.upgrades.state(g.ctx.registries.upgrades.get('rod_4'))).toBe('locked');
    expect(g.upgrades.rankNeeded(g.ctx.registries.upgrades.get('rod_4'))).toBe('Whisper River');
    expect(buy(g, 'rod_4')).toBe(false);
  });

  it('better rods raise luck and change the rod look', () => {
    const g = boot();
    buy(g, 'rod_1');
    buy(g, 'rod_2');
    expect(g.ctx.stats.get('luck')).toBe(2);
    expect(g.ctx.world.look('rod')?.color).toBe('sand');
  });
});

describe('moving the club', () => {
  it('needs the boat that reaches the next water', () => {
    const g = boot();
    expect(g.ctx.world.nextWater()).toBe('river');
    expect(g.ctx.world.canMoveTo('river')).toBe(false);
    expect(moveClub(g.ctx, 'river')).toBe(false);
    // Boats also need gear from other branches: a patched hull, then the first rod.
    for (const id of ['boat_1', 'patched_hull', 'boat_2']) expect(buy(g, id)).toBe(true);
    expect(buy(g, 'boat_3')).toBe(false);
    for (const id of ['rod_1', 'boat_3']) expect(buy(g, id)).toBe(true);
    expect(g.ctx.world.canMoveTo('river')).toBe(true);
    expect(g.ctx.world.canMoveTo('cove')).toBe(false);
  });

  it('starts coins, gear, and crew over, keeps the journal side of things, and pays the bonus', () => {
    const g = boot();
    for (const id of ['boat_1', 'patched_hull', 'boat_2', 'rod_1', 'boat_3', 'hire_help', 'paper_lanterns']) expect(buy(g, id)).toBe(true);
    g.ctx.wallet.add('coins', 100);
    expect(g.crew.hire('deckhand')).toBe(true);
    g.ctx.wallet.add('coins', 5000);
    const sellBefore = g.ctx.stats.get('sellValueMult');

    expect(moveClub(g.ctx, 'river')).toBe(true);
    expect(g.ctx.world.clubRank).toBe(1);
    expect(g.ctx.world.waterId).toBe('river');
    expect(g.ctx.wallet.get('coins')).toBe(0);
    expect(g.upgrades.level('rod_1')).toBe(0);
    expect(g.upgrades.level('boat_3')).toBe(0);
    expect(g.ctx.stats.get('boatRange')).toBe(0);
    expect(g.ctx.stats.get('luck')).toBe(0);
    expect(g.crew.slice.members).toEqual([]);
    // Club cosmetics (bought with gems) are kept, and so are gems.
    expect(g.upgrades.level('paper_lanterns')).toBe(1);
    expect(g.ctx.world.activeDecorations()).toContain('lanterns');
    // +5% coins at Whisper River (its fish pay more on their own).
    expect(clubBonus(g.ctx)).toBe(0.05);
    expect(g.ctx.stats.get('sellValueMult')).toBeCloseTo(sellBefore * 1.05);
    // The pond can still be visited, and river tiers are now for sale.
    expect(g.ctx.world.isUnlocked('pond')).toBe(true);
    expect(g.ctx.world.setWater('pond')).toBe(true);
    for (const id of ['rod_1', 'rod_2', 'rod_3']) buy(g, id);
    expect(buy(g, 'rod_4')).toBe(true);
  });

  it('remembers the club home and bonus across a reload', () => {
    const storage = new MemoryStorage();
    const g = boot(storage);
    for (const id of ['boat_1', 'patched_hull', 'boat_2', 'rod_1', 'boat_3']) buy(g, id);
    moveClub(g.ctx, 'river');
    g.ctx.save.save();
    const again = boot(storage);
    expect(again.ctx.world.clubRank).toBe(1);
    expect(clubBonus(again.ctx)).toBe(0.05);
    expect(again.upgrades.level('boat_3')).toBe(0);
  });

  it('old saves keep every water they had reached', () => {
    const storage = new MemoryStorage();
    const g = boot(storage);
    g.ctx.save.save();
    // Rewrite the world slice as v1 would have stored it: river and cove unlocked by boat range.
    const raw = JSON.parse(storage.getItem(SAVE.storageKey)!);
    raw.slices.world = { v: 1, data: { waterId: 'cove', knownUnlocked: ['pond', 'river', 'cove'] } };
    storage.setItem(SAVE.storageKey, JSON.stringify(raw));
    const old = boot(storage);
    expect(old.ctx.world.clubRank).toBe(2);
    expect(old.ctx.world.waterId).toBe('cove');
    expect(clubBonus(old.ctx)).toBe(0.1);
  });

  it('saves from before Sunlit Reef keep their home water', () => {
    const storage = new MemoryStorage();
    const g = boot(storage);
    g.ctx.save.save();
    const raw = JSON.parse(storage.getItem(SAVE.storageKey)!);
    // v2 stored the Glowing Cave as rank 3 (now 4) and the cove as rank 2 (unchanged).
    for (const [rank, water, want] of [
      [3, 'glowing_cave', 4],
      [4, 'sky_lake', 5],
      [2, 'cove', 2],
    ] as const) {
      raw.slices.world = { v: 2, data: { waterId: water, knownUnlocked: ['pond'], clubRank: rank } };
      storage.setItem(SAVE.storageKey, JSON.stringify(raw));
      const old = boot(storage);
      expect(old.ctx.world.clubRank).toBe(want);
      expect(old.ctx.world.waterId).toBe(water);
    }
  });
});
