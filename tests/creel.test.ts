// The creel: freshness while you play, matching sets when it sells together,
// and crew catches from time away filling it (and only it).
import { describe, expect, it } from 'vitest';
import { CREEL } from '../src/config/tuning';
import { bootstrap } from '../src/core/bootstrap';
import { parseContent } from '../src/core/content/parseContent';
import type { GameFeature } from '../src/core/feature';
import { CrewService } from '../src/features/crew/service';
import { crewSlice, type CrewSlice } from '../src/features/crew/state';
import { FishingController } from '../src/features/fishing/controller';
import { fishingSlice, type FishingSlice } from '../src/features/fishing/state';
import { freshness, matchingSets } from '../src/systems/economy';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

describe('freshness', () => {
  const cfg = CREEL.freshness;
  it('is full for a few minutes, then drops slowly to a floor', () => {
    expect(freshness(0, cfg)).toBe(1);
    expect(freshness(cfg.graceMs, cfg)).toBe(1);
    expect(freshness(cfg.graceMs + 5 * 60_000, cfg)).toBeCloseTo(1 - 5 * cfg.perMinute);
    expect(freshness(10 * 3_600_000, cfg)).toBe(cfg.floor);
  });

  it('an ice chest slows it down', () => {
    const t = cfg.graceMs + 10 * 60_000;
    expect(freshness(t, cfg, 0.5)).toBeGreaterThan(freshness(t, cfg));
  });
});

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
  ctx.stats.setSource('test', [{ stat: 'crewSlots', op: 'add', value: 1 }]);
  crew.slice.members.push({ id: 'c1', typeId: ctx.registries.crewTypes.list()[0]!.id, waterId: 'pond', progressMs: 0, catches: 0, earned: 0 });
  return { ctx, fishing, crew };
}

describe('crew while you are away', () => {
  it('fill the creel up to its space and earn no coins', () => {
    const { ctx, fishing, crew } = boot();
    const cap = ctx.stats.get('storageCap');
    const report = crew.catchUp(6 * 3_600_000);
    expect(fishing.state.creel).toHaveLength(cap);
    expect(fishing.state.creel.every((i) => i.crew && (i.ageMs ?? 0) === 0)).toBe(true);
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

  it('kept fish lose value only while you play, and the sale adds sets', () => {
    const { ctx, fishing } = boot();
    // A pricey fish, so rounding does not hide the drop.
    const fish = ctx.registries.fish.list().find((f) => f.baseValue >= 100)!;
    fishing.addToCreel([0, 1, 2].map(() => ({ fishId: fish.id, size: 5, at: 0 })));
    const fresh = fishing.creelValue(0);
    fishing.update(CREEL.freshness.graceMs + 20 * 60_000);
    expect(fishing.creelValue(0)).toBeLessThan(fresh);
    const sale = fishing.creelSale();
    expect(sale.sets).toHaveLength(1);
    expect(sale.sets[0]!.size).toBe(3);
    expect(sale.total).toBeGreaterThan(sale.base + sale.bundle);
  });
});
