// Turns game events into logbook progress (no Phaser, so tests use it as is).
import type { GameContext } from '../../core/context';
import type { LogbookService } from './service';
import type { LogEvent, TaskDef } from './state';

declare module '../../core/events' {
  interface GameEvents {
    logbookTaskDone: { taskId: string };
  }
}

export function wireLogbook(ctx: GameContext, svc: LogbookService): void {
  const tier = (rarityId: string | undefined) => ctx.registries.rarities.tryGet(rarityId ?? '')?.tier ?? 0;
  const announce = (t: TaskDef) => {
    ctx.bus.emit('logbookTaskDone', { taskId: t.id });
    ctx.bus.emit('audio:play', { key: 'unlock' });
    const cur = ctx.registries.currencies.tryGet(t.reward.currency);
    if (t.kind === 'move') {
      // Moving resets coins, so the move task pays at once, in gems.
      svc.claim(t.id);
      ctx.ui.toast(`Logbook: ${t.text}. +${t.reward.amount} ${cur?.name.toLowerCase() ?? ''}`, { icon: cur?.icon ?? 'icon_task', color: 'gold' });
    } else {
      ctx.ui.toast(`Task done: ${t.text}. Claim it in the Logbook`, { icon: 'icon_task', color: 'gold' });
    }
  };
  const feed = (e: LogEvent) => {
    for (const t of svc.onEvent(e)) announce(t);
  };
  ctx.bus.on('catchLanded', ({ catch: c, source }) => {
    if (source === 'hand') feed({ kind: 'catch', fishId: c.fishId, tier: tier(c.rarityId), weather: ctx.world.weather, phase: ctx.world.phase });
  });
  ctx.bus.on('fishKept', () => feed({ kind: 'keep' }));
  ctx.bus.on('creelSetsSold', ({ sets }) => sets.forEach((s) => feed({ kind: 'set', size: s.size })));
  ctx.bus.on('cleanLanding', ({ fishId }) => feed({ kind: 'clean', tier: tier(ctx.registries.fish.tryGet(fishId)?.rarity) }));
  ctx.bus.on('upgradePurchased', ({ upgradeId }) => feed({ kind: 'buy', upgradeId }));
  ctx.bus.on('crewHired', () => feed({ kind: 'hire' }));
  ctx.bus.on('clubMoved', ({ waterId }) => feed({ kind: 'move', waterId }));
}
