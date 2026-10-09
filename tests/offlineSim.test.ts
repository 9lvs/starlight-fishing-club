import { describe, expect, it } from 'vitest';
import { LOOT } from '../src/config/balance';
import { TIME, WEATHER } from '../src/config/time';
import { runCatchUp } from '../src/core/bootstrap';
import type { GameContext } from '../src/core/context';
import { EventBus } from '../src/core/eventBus';
import type { GameEvents } from '../src/core/events';
import { StatsService } from '../src/core/stats';
import { CORE_STATS } from '../src/config/stats';
import { sellValue } from '../src/systems/economy';
import { fishChances } from '../src/systems/lootTable';
import { largestRemainder, rollsInWindow, simulateOffline, type OfflineSimInput } from '../src/systems/offlineSim';
import { segmentsBetween } from '../src/systems/timeOfDay';
import { loadBaseContent } from './helpers/content';

const { content } = loadBaseContent();
const start = 1_700_000_000_000;

function input(over: Partial<OfflineSimInput> = {}): OfflineSimInput {
  return {
    startMs: start,
    elapsedMs: 10 * 60 * 1000,
    crew: [{ id: 'c1', waterId: 'pond', intervalMs: 12000, progressMs: 0, luck: 0, valueMult: 1 }],
    time: TIME,
    weatherList: content.weather,
    weatherCfg: WEATHER,
    rarities: content.rarities,
    fish: content.fish,
    lootCfg: LOOT,
    valueMult: 0.5,
    ...over,
  };
}

describe('rollsInWindow', () => {
  it('counts rolls in half-open and closed windows', () => {
    expect(rollsInWindow(0, 10, 0, 100)).toBe(10);
    expect(rollsInWindow(0, 10, 0, 100, true)).toBe(11);
    expect(rollsInWindow(5, 10, 0, 100)).toBe(10);
    expect(rollsInWindow(5, 10, 20, 40)).toBe(2);
  });
});

describe('largestRemainder', () => {
  it('always sums to the total', () => {
    const m = new Map([
      ['a', 3.7],
      ['b', 1.2],
      ['c', 0.1],
    ]);
    const r = largestRemainder(m, 5);
    expect(Object.values(r).reduce((s, x) => s + x, 0)).toBe(5);
    expect(r.a).toBe(4);
  });
});

describe('simulateOffline', () => {
  it('10 minutes at a 12 s interval is exactly 50 crew rolls', () => {
    const r = simulateOffline(input());
    expect(r.rolls).toBe(50);
    expect(r.perCrew[0]!.progressMs).toBe(0);
    expect(Object.values(r.catches).reduce((s, x) => s + x, 0)).toBe(50);
  });

  it('carries partial progress in and out', () => {
    const r = simulateOffline(input({ crew: [{ id: 'c1', waterId: 'pond', intervalMs: 12000, progressMs: 7000, luck: 0, valueMult: 1 }], elapsedMs: 30000 }));
    // 7 s + 30 s = 37 s -> 3 rolls, 1 s left over
    expect(r.rolls).toBe(3);
    expect(r.perCrew[0]!.progressMs).toBe(1000);
  });

  it('coins equal the expected value of every roll, segment by segment', () => {
    const inp = input({ elapsedMs: 3 * 3600 * 1000 });
    const r = simulateOffline(inp);
    let ev = 0;
    let rolls = 0;
    const segs = segmentsBetween(inp.startMs, inp.startMs + inp.elapsedMs, TIME, content.weather, WEATHER);
    segs.forEach((seg, i) => {
      const n = rollsInWindow(inp.startMs + 12000, 12000, seg.start, seg.end, i === segs.length - 1);
      rolls += n;
      const ch = fishChances(content.rarities, content.fish, { waterId: 'pond', phase: seg.phase, weather: seg.weather }, 0, LOOT);
      for (const [id, p] of ch) ev += n * p * sellValue(content.fish.find((f) => f.id === id)!.baseValue, 0.5);
    });
    expect(rolls).toBe(900);
    expect(r.rolls).toBe(900);
    expect(r.coins).toBe(Math.round(ev));
  });

  it('matches a brute force 1 s tick loop on roll count', () => {
    const elapsed = 2 * 3600 * 1000 + 4321;
    const r = simulateOffline(input({ elapsedMs: elapsed, crew: [{ id: 'c1', waterId: 'pond', intervalMs: 9500, progressMs: 2000, luck: 0, valueMult: 1 }] }));
    let progress = 2000;
    let rolls = 0;
    for (let t = 0; t < elapsed; t += 1) {
      progress += 1;
      if (progress >= 9500) {
        progress -= 9500;
        rolls++;
      }
    }
    expect(r.rolls).toBe(rolls);
    expect(r.perCrew[0]!.progressMs).toBe(progress);
  });

  it('is deterministic and fast for a full 24 hours with three crew', () => {
    const crew = ['pond', 'river', 'cove'].map((w, i) => ({ id: `c${i}`, waterId: w, intervalMs: 8000, progressMs: 0, luck: 2, valueMult: 1.1 }));
    const t0 = performance.now();
    const a = simulateOffline(input({ crew, elapsedMs: 24 * 3600 * 1000 }));
    const b = simulateOffline(input({ crew, elapsedMs: 24 * 3600 * 1000 }));
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(a).toEqual(b);
    expect(a.rolls).toBe(3 * 10800);
  });
});

describe('runCatchUp', () => {
  function fakeCtx(capHours: number) {
    const stats = new StatsService();
    CORE_STATS.forEach((s) => stats.define(s));
    stats.addModifier({ stat: 'offlineCapHours', op: 'set', value: capHours, source: 'test' });
    const bus = new EventBus<GameEvents>();
    return { stats, bus, save: { save: () => true } } as unknown as GameContext;
  }

  it('caps the simulated time at offlineCapHours', () => {
    const ctx = fakeCtx(8);
    let seen = 0;
    let done: GameEvents['offlineCatchUpDone'] | null = null;
    ctx.bus.on('offlineCatchUpDone', (e) => (done = e));
    runCatchUp(ctx, [{ id: 'x', init: () => {}, onOfflineCatchUp: (ms) => void (seen = ms) }], 20 * 3600 * 1000);
    expect(seen).toBe(8 * 3600 * 1000);
    expect(done!.elapsedMs).toBe(20 * 3600 * 1000);
    expect(done!.appliedMs).toBe(8 * 3600 * 1000);
  });

  it('ignores tiny gaps', () => {
    const ctx = fakeCtx(8);
    let called = false;
    runCatchUp(ctx, [{ id: 'x', init: () => {}, onOfflineCatchUp: () => void (called = true) }], 1000);
    expect(called).toBe(false);
  });
});
