// Fishing spots and secret fish: spots come and go on open water, a tap on one
// casts there, and only a cast into a spot can bring up a water's secret fish.
import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/config/tuning';
import { bootstrap } from '../src/core/bootstrap';
import { parseContent } from '../src/core/content/parseContent';
import { seededRng } from '../src/core/rng';
import { FishingController } from '../src/features/fishing/controller';
import { SpotField } from '../src/features/fishing/spots';
import { fishingSlice, type FishingSlice } from '../src/features/fishing/state';
import { filterPool, secretPool } from '../src/systems/lootTable';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

const area = { x: 100, y: 150, w: 60, h: 80, avoid: { x: 60, y: 200, r: 30 } };

describe('fishing spots', () => {
  it('wait for open water, then come and fade on their own', () => {
    const f = new SpotField(SPOTS, seededRng(1));
    f.update(SPOTS.firstMs + 1);
    expect(f.spots).toHaveLength(0);
    f.setArea(area);
    f.update(SPOTS.everyMs[1]! + 1);
    expect(f.spots).toHaveLength(1);
    const s = f.spots[0]!;
    expect(s.x).toBeGreaterThanOrEqual(area.x);
    expect(s.x).toBeLessThanOrEqual(area.x + area.w);
    f.update(SPOTS.lifeMs[1]! + 1);
    expect(f.spots.find((x) => x.id === s.id)).toBeUndefined();
  });

  it('a tap counts on the spot, not beside it, and not while it is still faint', () => {
    const f = new SpotField(SPOTS, seededRng(2));
    f.setArea(area);
    const s = f.spawnNow()!;
    expect(f.hit(s.x, s.y)).toBeNull();
    f.update(SPOTS.fadeMs);
    const s2 = f.spots[0]!;
    expect(f.hit(s2.x + 3, s2.y + 1)?.id).toBe(s.id);
    expect(f.hit(s2.x + SPOTS.radius + 2, s2.y)).toBeNull();
  });
});

describe('secret fish', () => {
  const fish = parseContent(readContentFiles()).content.fish;

  it('never come up in a normal roll, crew or offline pool', () => {
    for (const phase of ['day', 'dusk', 'night', 'dawn']) {
      for (const weather of ['clear', 'rain', 'fog', 'wind', 'storm']) {
        const pool = filterPool(fish, { waterId: 'pond', phase, weather });
        expect(pool.some((f) => f.secret)).toBe(false);
      }
    }
  });

  it('each water has one, matched by its time or weather', () => {
    const waters = ['pond', 'river', 'cove', 'reef', 'glowing_cave', 'sky_lake'];
    for (const w of waters) expect(fish.filter((f) => f.secret && f.waters.includes(w))).toHaveLength(1);
    expect(secretPool(fish, { waterId: 'pond', phase: 'dusk', weather: 'clear' }).map((f) => f.id)).toEqual(['lantern_koi']);
    expect(secretPool(fish, { waterId: 'pond', phase: 'day', weather: 'clear' })).toEqual([]);
  });

  it('a cast into a spot in season can bring one up, and it never slips away', () => {
    let ctl!: FishingController;
    const g = bootstrap({
      features: [{ id: 'fishing', saveSlice: fishingSlice, init: (ctx) => (ctl = new FishingController(ctx, ctx.save.slice<FishingSlice>('fishing'))) }],
      loadContent: () => parseContent(readContentFiles()),
      storage: new MemoryStorage(),
      debug: false,
    });
    const world = g.ctx!.world as unknown as { _phase: string };
    world._phase = 'dusk';
    const chance = SPOTS.secretChance;
    SPOTS.secretChance = 1;
    try {
      ctl.spots.setArea(area);
      const spot = ctl.spots.spawnNow()!;
      ctl.tap(spot);
      const plan = (ctl as unknown as { planned: { made: { result: { fishId: string; flags: Record<string, boolean> } }; escape: number } }).planned;
      expect(plan.made.result.fishId).toBe('lantern_koi');
      expect(plan.made.result.flags.secret).toBe(true);
      expect(plan.escape).toBe(0);
    } finally {
      SPOTS.secretChance = chance;
    }
  });
});
