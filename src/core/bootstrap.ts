// Builds the GameContext: loads and validates content, fills registries, loads
// the save, and initialises features. No Phaser here, so it is easy to reason about.
import type { ZodType } from 'zod';
import { CORE_STATS } from '../config/stats';
import { OFFLINE, SAVE } from '../config/tuning';
import { PHASE_IDS } from '../config/time';
import { Wallet } from '../systems/economy';
import { SaveManager, type StorageLike } from '../systems/saveManager';
import { Clock } from './clock';
import { formatContentError, validateReferences, type ContentError, type ParsedContent } from './content/parseContent';
import type { GameContext, Registries } from './context';
import { setContext } from './context';
import { EventBus } from './eventBus';
import type { GameEvents } from './events';
import type { GameFeature, SaveSliceDef } from './feature';
import { Registry } from './registry';
import { mathRng } from './rng';
import { StatsService } from './stats';
import type { OfflineReport } from './types';
import { WorldState, worldSliceDef } from './world';

export interface WalletSlice {
  balances: Record<string, number>;
}

export interface BootResult {
  ctx: GameContext | null;
  errors: string[];
}

export interface BootOptions {
  features: readonly GameFeature[];
  loadContent: (extra: Record<string, ZodType>) => { content: ParsedContent; errors: ContentError[] };
  storage: StorageLike;
  debug: boolean;
  flags?: Record<string, boolean>;
}

export function buildRegistries(content: ParsedContent): Registries {
  const r: Registries = {
    fish: new Registry('fish'),
    waters: new Registry('water'),
    rarities: new Registry('rarity'),
    currencies: new Registry('currency'),
    weather: new Registry('weather'),
    branches: new Registry('branch'),
    upgrades: new Registry('upgrade'),
    crewTypes: new Registry('crew type'),
    decorations: new Registry('decoration'),
    effects: new Registry('effect handler'),
  };
  r.fish.registerAll(content.fish);
  r.waters.registerAll(content.waters);
  r.rarities.registerAll(content.rarities);
  r.currencies.registerAll(content.currencies);
  r.weather.registerAll(content.weather);
  r.branches.registerAll(content.branches);
  r.upgrades.registerAll(content.upgrades);
  r.crewTypes.registerAll(content.crew);
  r.decorations.registerAll(content.decorations);
  return r;
}

function registerCoreEffects(r: Registries): void {
  // Shows a decoration from decorations.json on the boat while the upgrade is owned.
  r.effects.register({
    id: 'decoration',
    apply(ctx, args, level) {
      const id = String(args.id ?? '');
      if (!ctx.registries.decorations.has(id)) return;
      if (level > 0) ctx.world.addDecoration(id);
      else ctx.world.removeDecoration(id);
    },
    describe(ctx, args) {
      const d = ctx.registries.decorations.tryGet(String(args.id ?? ''));
      return d ? `Adds ${d.name} to your boat` : '';
    },
  });
}

export function bootstrap(opts: BootOptions): BootResult {
  const extraSchemas: Record<string, ZodType> = {};
  for (const f of opts.features) Object.assign(extraSchemas, f.contentTypes ?? {});
  const { content, errors } = opts.loadContent(extraSchemas);
  if (errors.length > 0) return { ctx: null, errors: errors.map(formatContentError) };

  const bus = new EventBus<GameEvents>();
  const stats = new StatsService((ids) => bus.emit('statsChanged', { stats: ids }));
  CORE_STATS.forEach((s) => stats.define(s));

  const registries = buildRegistries(content);
  registerCoreEffects(registries);

  const clock = new Clock();
  const save = new SaveManager(opts.storage, () => clock.now(), SAVE);
  const currencies = registries.currencies.list();
  const walletDef: SaveSliceDef<WalletSlice> = {
    key: 'wallet',
    version: 1,
    defaults: () => ({ balances: Object.fromEntries(currencies.map((c) => [c.id, c.start])) }),
  };
  const firstWater = [...registries.waters.list()]
    .filter((w) => !w.comingSoon)
    .sort((a, b) => a.rangeRequired - b.rangeRequired || a.order - b.order)[0];
  if (!firstWater) return { ctx: null, errors: ['content: no playable water defined in waters.json'] };
  save.register(walletDef);
  save.register(worldSliceDef(firstWater.id));
  for (const f of opts.features) if (f.saveSlice) save.register(f.saveSlice);
  const loadResult = save.load();

  const wallet = new Wallet(
    save.slice<WalletSlice>('wallet').balances,
    () => registries.currencies.ids(),
    (currency, amount, delta) => bus.emit('currencyChanged', { currency, amount, delta }),
  );
  const world = new WorldState(save.slice('world'), registries, stats, clock, bus);

  const ctx: GameContext = {
    bus,
    stats,
    registries,
    content,
    wallet,
    save,
    clock,
    rng: mathRng,
    world,
    debug: opts.debug,
    flags: { ...(opts.flags ?? {}) },
    ui: {
      toast: (text, o) => bus.emit('ui:toast', { text, ...(o ?? {}) }),
      openPanel: (sceneKey, data) => bus.emit('ui:openPanel', { sceneKey, data }),
    },
    features: {
      ids: () => opts.features.map((f) => f.id),
      has: (id) => opts.features.some((f) => f.id === id),
      menuEntries: () => opts.features.flatMap((f) => f.menuEntries ?? []).sort((a, b) => a.order - b.order),
      debugCommands: () => opts.features.flatMap((f) => f.debugCommands ?? []),
    },
  };
  setContext(ctx);

  const initErrors: string[] = [];
  for (const f of opts.features) {
    try {
      f.init(ctx);
    } catch (err) {
      initErrors.push(`feature "${f.id}" failed to start: ${(err as Error).message}`);
    }
  }
  const refErrors = validateReferences(content, {
    statIds: stats.ids(),
    effectIds: registries.effects.ids(),
    phaseIds: PHASE_IDS,
  });
  if (initErrors.length > 0 || refErrors.length > 0) {
    return { ctx: null, errors: [...initErrors, ...refErrors.map(formatContentError)] };
  }
  world.checkUnlocks(false);
  for (const f of opts.features) f.start?.(ctx);
  if (loadResult.recovered) {
    ctx.ui.toast('Your old save could not be read. A backup was kept.');
  }
  return { ctx, errors: [] };
}

/**
 * Runs every feature's offline catch-up for a gap and reports it on the bus.
 * The gap is capped by the offlineCapHours stat.
 */
export function runCatchUp(ctx: GameContext, features: readonly GameFeature[], gapMs: number): void {
  if (gapMs < OFFLINE.minCatchUpMs) return;
  const capMs = ctx.stats.get('offlineCapHours') * 3600 * 1000;
  const appliedMs = Math.min(gapMs, capMs);
  const reports: OfflineReport[] = [];
  for (const f of features) {
    if (!f.onOfflineCatchUp) continue;
    try {
      const report = f.onOfflineCatchUp(appliedMs, ctx);
      if (report) reports.push(report);
    } catch (err) {
      console.error(`[offline] feature "${f.id}" catch-up failed`, err);
    }
  }
  ctx.bus.emit('offlineCatchUpDone', { elapsedMs: gapMs, appliedMs, reports });
  ctx.save.save();
}

/** Drives onTick for features and detects gaps (background tab, sleep, debug fast-forward). */
export class TickDriver {
  private lastWall: number;

  constructor(
    private readonly ctx: GameContext,
    private readonly features: readonly GameFeature[],
  ) {
    this.lastWall = ctx.clock.now();
  }

  /** The first tick after load uses the save time, so closed-tab time is caught up. */
  startFrom(wallMs: number): void {
    this.lastWall = wallMs;
  }

  tick(): void {
    const now = this.ctx.clock.now();
    const gap = now - this.lastWall;
    this.lastWall = now;
    if (gap > OFFLINE.minCatchUpMs) {
      runCatchUp(this.ctx, this.features, gap);
      this.ctx.world.update();
      return;
    }
    const dt = Math.max(0, Math.min(gap, OFFLINE.maxTickMs));
    this.ctx.world.update();
    for (const f of this.features) {
      if (!f.onTick) continue;
      try {
        f.onTick(dt, this.ctx);
      } catch (err) {
        console.error(`[tick] feature "${f.id}" threw`, err);
      }
    }
  }
}
