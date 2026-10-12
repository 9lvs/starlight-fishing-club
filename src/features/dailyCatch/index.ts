// Daily Catch: one shared fish a day at the starting water, with a share grid.
// The ritual and the share text are what spread a web game (see docs/LAUNCH.md).
// Missing a day costs nothing; there is no streak to break.
import type { GameFeature } from '../../core/feature';
import { DailyCatchScene } from './DailyCatchScene';
import { DailyCatchService, getDailyCatch, setDailyCatch } from './service';
import { dailyCatchSlice, type DailyCatchSlice } from './state';

declare module '../../core/events' {
  interface GameEvents {
    dailyCatchCaught: { day: string; casts: number; bonus: number };
  }
}

export const dailyCatchFeature: GameFeature = {
  id: 'dailyCatch',
  saveSlice: dailyCatchSlice,
  scenes: [{ key: 'DailyCatch', scene: DailyCatchScene, kind: 'panel' }],
  menuEntries: [
    {
      id: 'dailyCatch',
      label: 'Daily Catch',
      icon: 'icon_daily',
      order: 45,
      sceneKey: 'DailyCatch',
      badge: () => !getDailyCatch().caught,
    },
  ],
  init(ctx) {
    const svc = new DailyCatchService(ctx, ctx.save.slice<DailyCatchSlice>('dailyCatch'));
    setDailyCatch(svc);
    ctx.bus.on('biteMissed', ({ waterId }) => svc.onMiss(waterId));
    ctx.bus.on('catchLanded', ({ catch: c, source }) => {
      if (source === 'hand') svc.onCatch(c);
    });
    ctx.bus.on('dailyCatchCaught', ({ casts, bonus }) => {
      ctx.bus.emit('audio:play', { key: 'daily' });
      // A toast, not a panel: the catch card is still showing.
      ctx.ui.toast(`Today's fish in ${casts} ${casts === 1 ? 'cast' : 'casts'}! +${bonus} bonus. Share it from Daily Catch.`, {
        icon: 'icon_daily',
        color: 'gold',
      });
    });
  },
  debugCommands: [
    {
      id: 'dailyCatch.reset',
      label: 'Reset Daily Catch',
      run: () => {
        const s = getDailyCatch().slice;
        s.day = '';
        return `Today's fish: ${getDailyCatch().fish()?.name ?? 'none'}`;
      },
    },
  ],
};
