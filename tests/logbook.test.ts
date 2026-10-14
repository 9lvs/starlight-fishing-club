// The Logbook: tasks are valid content, progress counts the right events,
// coins are claimed by hand, and moving the club pays its gems at once.
import { describe, expect, it } from 'vitest';
import { bootstrap } from '../src/core/bootstrap';
import { moveClub } from '../src/core/club';
import { parseContent } from '../src/core/content/parseContent';
import type { GameFeature } from '../src/core/feature';
import { LogbookService } from '../src/features/logbook/service';
import { logbookSlice, type LogbookSlice } from '../src/features/logbook/state';
import { wireLogbook } from '../src/features/logbook/wire';
import { counts, dailySchema, pickDailies, taskSchema, type DailyDef, type TaskDef } from '../src/features/logbook/state';
import { tidy } from '../src/features/logbook/service';
import { DAILY_TASKS } from '../src/config/tuning';
import { MemoryStorage } from '../src/systems/saveManager';
import { loadBaseContent, readContentFiles } from './helpers/content';

const taskFiles = import.meta.glob('../src/content/logbook/tasks.json', { eager: true, import: 'default' }) as Record<string, unknown[]>;
const tasks = Object.values(taskFiles)[0]!.map((t) => taskSchema.parse(t)) as TaskDef[];
const { content } = loadBaseContent();

describe('logbook content', () => {
  it('every task belongs to a real water and buys a real upgrade', () => {
    const waters = new Set(content.waters.map((w) => w.id));
    const upgrades = new Set(content.upgrades.map((u) => u.id));
    for (const t of tasks) {
      expect(waters.has(t.water), t.id).toBe(true);
      if (t.kind === 'buy') expect(upgrades.has(t.target!), t.id).toBe(true);
      if (t.kind === 'move') expect(waters.has(t.target!), t.id).toBe(true);
    }
  });

  it('every water has tasks, and most pay coins, not gems', () => {
    for (const w of content.waters) expect(tasks.some((t) => t.water === w.id), w.id).toBe(true);
    const gems = tasks.filter((t) => t.reward.currency === 'gems').length;
    expect(gems).toBeLessThan(tasks.length / 4);
  });
});

describe('task progress', () => {
  const t = (over: Partial<TaskDef>): TaskDef => taskSchema.parse({ id: 'x', water: 'pond', text: 'x', kind: 'catch', reward: { currency: 'coins', amount: 1 }, ...over });
  const fish = { kind: 'catch' as const, fishId: 'a', tier: 2, weather: 'rain', phase: 'night' };

  it('counts only matching catches', () => {
    expect(counts(t({ minTier: 3 }), fish)).toBe(0);
    expect(counts(t({ minTier: 2 }), fish)).toBe(1);
    expect(counts(t({ weather: 'any_weather' }), fish)).toBe(1);
    expect(counts(t({ weather: 'any_weather' }), { ...fish, weather: 'clear' })).toBe(0);
    expect(counts(t({ phase: 'day' }), fish)).toBe(0);
    expect(counts(t({ kind: 'set', setSize: 5 }), { kind: 'set', size: 3 })).toBe(0);
  });
});

function boot() {
  const files = { ...readContentFiles(), ...Object.fromEntries(Object.entries(import.meta.glob('../src/content/logbook/*.json', { eager: true, import: 'default' }))) };
  let log!: LogbookService;
  // The logbook feature without its panel, wired the way index.ts wires it.
  const feature: GameFeature = {
    id: 'logbook',
    contentTypes: { tasks: taskSchema, dailies: dailySchema },
    saveSlice: logbookSlice,
    init(ctx) {
      log = new LogbookService(ctx, ctx.save.slice<LogbookSlice>('logbook'));
      wireLogbook(ctx, log);
    },
  };
  const res = bootstrap({ features: [feature], loadContent: (extra, ids) => parseContent(files, extra, ids), storage: new MemoryStorage(), debug: false });
  expect(res.errors).toEqual([]);
  return { ctx: res.ctx!, log };
}

describe('the logbook in the game', () => {
  it('finishes a catch task, pays coins when claimed, and pays gems on a move', () => {
    const { ctx, log } = boot();
    const fish = ctx.registries.fish.list().find((f) => f.waters.includes('pond'))!;
    for (let i = 0; i < 10; i++) {
      ctx.bus.emit('catchLanded', { catch: { fishId: fish.id, rarityId: fish.rarity, waterId: 'pond', size: 5, value: 1, currency: 'coins', at: 0, flags: {} } as never, source: 'hand' });
    }
    expect(log.isDone(log.current.find((x) => x.id === 'pond_catch')!)).toBe(true);
    const coins = ctx.wallet.get('coins');
    expect(log.claim('pond_catch')).toBe(true);
    expect(log.claim('pond_catch')).toBe(false);
    expect(ctx.wallet.get('coins')).toBe(coins + 40);
    moveClub(ctx, 'river', { force: true });
    expect(ctx.wallet.get('gems')).toBe(3);
    expect(log.current.every((x) => x.water === 'river')).toBe(true);
  });
});

const dailyFiles = import.meta.glob('../src/content/logbook/dailies.json', { eager: true, import: 'default' }) as Record<string, unknown[]>;
const dailies = Object.values(dailyFiles)[0]!.map((d) => dailySchema.parse(d)) as DailyDef[];

describe('daily tasks', () => {
  it('draws the same three for everyone on a day, all different kinds, and others the next day', () => {
    const a = pickDailies('2026-10-14', dailies, 3);
    expect(a).toEqual(pickDailies('2026-10-14', dailies, 3));
    expect(a).toHaveLength(3);
    const kinds = a.map((id) => dailies.find((d) => d.id === id)!.kind);
    expect(new Set(kinds).size).toBe(3);
    const days = Array.from({ length: 10 }, (_, i) => pickDailies(`2026-11-${10 + i}`, dailies, 3).join());
    expect(new Set(days).size).toBeGreaterThan(5);
  });

  it('rounds rewards to tidy numbers', () => {
    expect(tidy(34)).toBe(35);
    expect(tidy(1234)).toBe(1200);
    expect(tidy(345678)).toBe(350000);
  });

  it('counts today, pays coins scaled to the water, and starts over the next day', () => {
    const { ctx, log } = boot();
    let now = new Date(2026, 9, 14, 9).getTime();
    ctx.clock.now = () => now;
    const today = log.today;
    expect(today).toHaveLength(3);
    // The pond only offers dailies that need no rank.
    expect(today.every((d) => d.minRank === 0)).toBe(true);
    for (const d of today) log.daily.done.push(d.id);
    const d = today[0]!;
    const pondCoins = log.dailyCoins(d);
    ctx.rng = () => 0.99; // No gem this time.
    const coins = ctx.wallet.get('coins');
    expect(log.claimDaily(d.id)).toEqual({ coins: pondCoins, gem: false });
    expect(log.claimDaily(d.id)).toBeNull();
    expect(ctx.wallet.get('coins')).toBe(coins + pondCoins);
    ctx.rng = () => 0;
    expect(log.claimDaily(today[1]!.id)!.gem).toBe(true);
    expect(ctx.wallet.get('gems')).toBe(1);
    moveClub(ctx, 'river', { force: true });
    expect(log.dailyCoins(d)).toBeGreaterThan(pondCoins);
    // Midnight: new tasks, nothing done yet.
    now = new Date(2026, 9, 15, 0, 1).getTime();
    expect(log.daily.day).toBe('2026-10-15');
    expect(log.daily.done).toEqual([]);
    expect(DAILY_TASKS.gemChance).toBeLessThan(0.25);
  });

  it('a catch moves the daily catch task along', () => {
    const { ctx, log } = boot();
    log.draw(log.daily.day, 'x');
    log.daily.ids = ['d_catch15'];
    const fish = ctx.registries.fish.list().find((f) => f.waters.includes('pond'))!;
    ctx.bus.emit('catchLanded', { catch: { fishId: fish.id, rarityId: fish.rarity, waterId: 'pond', size: 5, value: 1, currency: 'coins', at: 0, flags: {} } as never, source: 'hand' });
    expect(log.dailyProgress(log.today[0]!)).toBe(1);
  });
});
