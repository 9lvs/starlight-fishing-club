// The creel: kept fish are prepped before they can sell, matching sets when
// they sell together, and crew catches from time away filling it (and only it).
import { describe, expect, it } from 'vitest';
import { CREEL } from '../src/config/tuning';
import { bootstrap } from '../src/core/bootstrap';
import { parseContent } from '../src/core/content/parseContent';
import type { GameFeature } from '../src/core/feature';
import { CrewService } from '../src/features/crew/service';
import { crewSlice, type CrewSlice } from '../src/features/crew/state';
import { FishingController } from '../src/features/fishing/controller';
import { fishingSlice, type FishingSlice } from '../src/features/fishing/state';
import { debugOverrides } from '../src/core/debugOverrides';
import { matchingSets } from '../src/systems/economy';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

describe('matching sets', () => {
  const rules = CREEL.sets;
  const set = (count: number, mult = 1, value = 100) => matchingSets([{ id: 'x', count, value, mult }], rules)[0];

  it('only sets of 3, 5, or 10 count, and a bigger set pays more', () => {
    expect(set(2)).toBeUndefined();
    expect(set(3)!.size).toBe(3);
    expect(set(4)!.size).toBe(3);
    expect(set(5)!.share).toBeGreaterThan(set(3)!.share);
    expect(set(10)!.share).toBeGreaterThan(set(5)!.share);
    expect(set(14)!.size).toBe(10);
  });

  it('rarer sets pay a bigger share, and sets of different rarities stack', () => {
    const r = parseContent(readContentFiles()).content.rarities;
    const mult = (id: string) => r.find((x) => x.id === id)!.setMult;
    expect(set(3, mult('legendary'))!.share).toBeGreaterThan(set(3, mult('uncommon'))!.share * 2);
    const both = matchingSets(
      [
        { id: 'common', count: 5, value: 50, mult: mult('common') },
        { id: 'rare', count: 3, value: 300, mult: mult('rare') },
      ],
      rules,
    );
    expect(both.map((x) => x.id)).toEqual(['common', 'rare']);
  });
});

function boot() {
  let fishing!: FishingController;
  let crew!: CrewService;
  const features: GameFeature[] = [
    {
      id: 'fishing',
      saveSlice: fishingSlice,
      init(ctx) {
        fishing = new FishingController(ctx, ctx.save.slice<FishingSlice>('fishing'));
        ctx.bus.on('creelRoom', (q) => (q.room = fishing.creelRoom));
        ctx.bus.on('creelDeposit', (d) => (d.accepted = fishing.addToCreel(d.items)));
      },
    },
    {
      id: 'crew',
      saveSlice: crewSlice,
      init(ctx) {
        crew = new CrewService(ctx, ctx.save.slice<CrewSlice>('crew'));
      },
    },
  ];
  const res = bootstrap({ features, loadContent: () => parseContent(readContentFiles()), storage: new MemoryStorage(), debug: false });
  expect(res.errors).toEqual([]);
  const ctx = res.ctx!;
  ctx.stats.setSource('test', [
    { stat: 'crewSlots', op: 'add', value: 1 },
    { stat: 'crewBunks', op: 'add', value: 1 },
  ]);
  crew.slice.members.push({ id: 'c1', typeId: ctx.registries.crewTypes.list()[0]!.id, waterId: 'pond', progressMs: 0, catches: 0, earned: 0 });
  return { ctx, fishing, crew };
}

describe('crew while you are away', () => {
  it('fill the creel up to its space and earn no coins', () => {
    const { ctx, fishing, crew } = boot();
    const cap = ctx.stats.get('storageCap');
    const report = crew.catchUp(6 * 3_600_000);
    expect(fishing.state.creel).toHaveLength(cap);
    expect(fishing.state.creel.every((i) => i.crew && fishing.isReady(i))).toBe(true);
    expect(ctx.wallet.get('coins')).toBe(0);
    expect(report && report.kept).toBe(cap);
    expect(report && report.lines.join(' ')).toContain('creel filled up');
  });

  it('a short trip leaves room, and a full creel means the crew rests', () => {
    const { ctx, fishing, crew } = boot();
    const interval = ctx.stats.get('crewIntervalMs');
    crew.catchUp(interval * 2);
    expect(fishing.state.creel.length).toBe(2);
    crew.catchUp(24 * 3_600_000);
    const before = fishing.state.creel.length;
    const report = crew.catchUp(3_600_000);
    expect(fishing.state.creel.length).toBe(before);
    expect(report && report.lines[0]).toContain('already full');
  });

});

describe('prepping kept fish for market', () => {
  /** Hold the game clock still so prep only moves when the test says so. */
  function frozen() {
    const b = boot();
    let now = 1_000_000;
    b.ctx.clock.now = () => now;
    return { ...b, advance: (ms: number) => (now += ms) };
  }

  it('a kept fish cannot be sold until it is prepped, then sells at full value', () => {
    const { ctx, fishing, advance } = frozen();
    debugOverrides.forceRarity = 'common';
    keepOne(fishing);
    const item = fishing.state.creel[0]!;
    expect(fishing.isReady(item)).toBe(false);
    expect(fishing.prepLeft(item)).toBe(CREEL.prepMs);
    const coins = ctx.wallet.get('coins');
    fishing.sellFromCreel(0);
    expect(fishing.state.creel).toHaveLength(1);
    expect(fishing.creelSale().total).toBe(0);
    advance(CREEL.prepMs);
    expect(fishing.isReady(item)).toBe(true);
    const value = fishing.creelValue(0);
    fishing.sellFromCreel(0);
    expect(fishing.state.creel).toHaveLength(0);
    expect(ctx.wallet.get('coins')).toBe(coins + value);
    debugOverrides.forceRarity = null;
  });

  it('selling all takes the ready fish with sets and leaves the rest prepping', () => {
    const { fishing, advance } = frozen();
    const fish = fishing['ctx'].registries.fish.list().find((f) => f.baseValue >= 100)!;
    const now = () => fishing['ctx'].clock.now();
    fishing.state.creel.push(...[0, 1, 2].map(() => ({ fishId: fish.id, size: 5, at: 0, readyAt: now() })));
    fishing.state.creel.push({ fishId: fish.id, size: 5, at: 0, readyAt: now() + 60_000 });
    const sale = fishing.sellAllCreel();
    expect(sale.count).toBe(3);
    expect(sale.sets[0]!.size).toBe(3);
    expect(sale.total).toBeGreaterThan(sale.base + sale.bundle);
    expect(fishing.state.creel).toHaveLength(1);
    advance(60_000);
    expect(fishing.readyCount).toBe(1);
  });

  it('the Ice Chest shortens prep for fish kept after it', () => {
    const { ctx, fishing } = frozen();
    ctx.stats.setSource('ice', [{ stat: 'prepTimeMult', op: 'mult', value: 0.5 }]);
    expect(fishing.prepMs).toBe(CREEL.prepMs / 2);
  });

  it('old saves keep their creel, ready to sell', () => {
    const migrated = fishingSlice.migrate!({ pity: 0, creel: [{ fishId: 'x', size: 1, at: 0, ageMs: 99999 }], totals: { casts: 0, catches: 0, misses: 0 }, rested: 0, restedMs: 0 }, 3);
    expect(migrated.creel[0]).toEqual({ fishId: 'x', size: 1, at: 0 });
  });
});

/** Cast, hook, and keep whatever bites (Easy reel, so nothing fights). */
function keepOne(fishing: FishingController): void {
  fishing.easyReel = true;
  fishing.update(500);
  fishing.tap();
  fishing.update(1000);
  fishing.update(60000);
  fishing.tap();
  fishing.update(3000);
  expect(fishing.keepPending()).toBe(true);
}
