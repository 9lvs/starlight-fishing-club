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
import { counts, taskSchema, type TaskDef } from '../src/features/logbook/state';
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
    contentTypes: { tasks: taskSchema },
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
