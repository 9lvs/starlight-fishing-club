// Core debug commands. Features add their own through GameFeature.debugCommands.
import { ECONOMY, LOOT } from '../config/balance';
import { TIME, PHASE_IDS } from '../config/time';
import { lootFish, lootRarities } from '../core/catching';
import type { GameContext } from '../core/context';
import { debugOverrides } from '../core/debugOverrides';
import type { DebugCommand } from '../core/feature';
import { seededRng } from '../core/rng';
import { rollCatch, byTier } from '../systems/lootTable';
import { offsetToPhase } from '../systems/timeOfDay';

/** Roll N catches with current luck and conditions and report rarity rates. */
export function simulateCasts(ctx: GameContext, n: number, seed = Date.now()): string {
  const rng = seededRng(seed);
  const rarities = lootRarities(ctx);
  const counts = new Map<string, number>(rarities.map((r) => [r.id, 0]));
  let pity = 0;
  let pityHits = 0;
  for (let i = 0; i < n; i++) {
    const roll = rollCatch({
      rarities,
      fish: lootFish(ctx),
      conditions: ctx.world.conditions(),
      luck: ctx.stats.get('luck'),
      rng,
      cfg: LOOT,
      pity,
    });
    if (!roll) continue;
    pity = roll.pity ?? 0;
    if (roll.pityTriggered) pityHits++;
    counts.set(roll.rarityId, (counts.get(roll.rarityId) ?? 0) + 1);
  }
  const lines = byTier(rarities).map((r) => {
    const c = counts.get(r.id) ?? 0;
    return `${r.name.padEnd(10)} ${((c / n) * 100).toFixed(2).padStart(6)}%  (${c})`;
  });
  return [`${n} casts at ${ctx.world.waterId} (${ctx.world.phase}, ${ctx.world.weather}), luck ${ctx.stats.get('luck')}`, ...lines, `pity triggered ${pityHits}x`].join('\n');
}

export function coreDebugCommands(): DebugCommand[] {
  return [
    {
      id: 'coins',
      label: 'Add coins',
      args: [{ name: 'amount', type: 'number', default: 1000 }],
      run: (ctx, a) => {
        ctx.wallet.add(ECONOMY.defaultCurrency, Number(a.amount));
        return `+${a.amount} coins`;
      },
    },
    {
      id: 'rarity',
      label: 'Force rarity',
      args: [{ name: 'rarity', type: 'select', options: ['off'], default: 'off' }],
      run: (_ctx, a) => {
        debugOverrides.forceRarity = a.rarity === 'off' ? null : String(a.rarity);
        return debugOverrides.forceRarity ? `Next catches will be ${a.rarity}` : 'Rarity no longer forced';
      },
    },
    {
      id: 'time',
      label: 'Set time of day',
      args: [{ name: 'phase', type: 'select', options: PHASE_IDS, default: 'night' }],
      run: (ctx, a) => {
        ctx.clock.shift(offsetToPhase(ctx.clock.now(), String(a.phase), TIME));
        ctx.world.update();
        return `Time is now ${ctx.world.phase}`;
      },
    },
    {
      id: 'weather',
      label: 'Set weather',
      args: [{ name: 'weather', type: 'select', options: ['auto'], default: 'auto' }],
      run: (ctx, a) => {
        ctx.world.forceWeather(a.weather === 'auto' ? null : String(a.weather));
        return `Weather is now ${ctx.world.weather}`;
      },
    },
    {
      id: 'offline',
      label: 'Fast-forward (min)',
      args: [{ name: 'minutes', type: 'number', default: 10 }],
      run: (ctx, a) => {
        // Shifting the clock makes the next tick see a gap, exactly like a closed tab.
        ctx.clock.shift(Number(a.minutes) * 60 * 1000);
        return `Skipped ${a.minutes} minutes`;
      },
    },
    {
      id: 'waters',
      label: 'Unlock all waters',
      run: (ctx) => {
        ctx.stats.setSource('debug:waters', [{ stat: 'boatRange', op: 'add', value: 99 }]);
        return `Unlocked: ${ctx.world.unlockedWaters().join(', ')}`;
      },
    },
    {
      id: 'simulate',
      label: 'Simulate casts',
      args: [{ name: 'casts', type: 'number', default: 10000 }],
      run: (ctx, a) => simulateCasts(ctx, Number(a.casts)),
    },
    {
      id: 'reset',
      label: 'Reset save',
      run: (ctx) => {
        ctx.save.reset();
        location.reload();
        return 'Resetting...';
      },
    },
  ];
}

/** Fill select options that depend on loaded content. */
export function withContentOptions(ctx: GameContext, cmds: DebugCommand[]): DebugCommand[] {
  return cmds.map((c) => {
    if (c.id === 'rarity') return { ...c, args: [{ name: 'rarity', type: 'select', options: ['off', ...ctx.registries.rarities.ids()], default: 'off' }] };
    if (c.id === 'weather') return { ...c, args: [{ name: 'weather', type: 'select', options: ['auto', ...ctx.registries.weather.ids()], default: 'auto' }] };
    return c;
  });
}
