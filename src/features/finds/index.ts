// Finds feature: message bottles and little chests that come up with the line.
// Bottles hold notes from old club members, some with clues to secret fish.
import type { GameFeature } from '../../core/feature';
import { BottlesScene } from './BottlesScene';
import { FindsService, getFinds, setFinds } from './service';
import { findsSlice, noteSchema, type FindsSlice } from './state';

declare module '../../core/events' {
  interface GameEvents {
    findFound: { kind: 'bottle' | 'chest' };
  }
}

export const findsFeature: GameFeature = {
  id: 'finds',
  contentTypes: { notes: noteSchema },
  saveSlice: findsSlice,
  scenes: [{ key: 'Bottles', scene: BottlesScene, kind: 'panel' }],
  menuEntries: [
    {
      id: 'bottles',
      label: 'Bottles',
      icon: 'icon_bottle',
      order: 22,
      sceneKey: 'Bottles',
      badge: () => getFinds().slice.unread.length > 0,
    },
  ],
  init(ctx) {
    const svc = new FindsService(ctx, ctx.save.slice<FindsSlice>('finds'));
    setFinds(svc);
    ctx.bus.on('catchLanded', ({ catch: c, source }) => {
      if (source === 'hand') svc.onCatch(c);
    });
    // Shown once the catch card closes, whichever way it closed.
    ctx.bus.on('fishSold', ({ source }) => {
      if (source === 'hand') svc.reveal();
    });
    ctx.bus.on('fishKept', () => svc.reveal());
  },
  debugCommands: [
    {
      id: 'finds.next',
      label: 'Next catch brings up a find',
      run: () => {
        const s = getFinds().slice;
        s.lastAt = 0;
        s.dry = 999;
        return 'The next hand catch brings up a find';
      },
    },
  ],
};
