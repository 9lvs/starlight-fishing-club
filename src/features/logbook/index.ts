// Logbook feature: tasks for each water that teach the game as you play.
// Progress comes from bus events; nothing here touches other features.
import type { GameFeature } from '../../core/feature';
import { LogbookScene } from './LogbookScene';
import { LogbookService, getLogbook, setLogbook } from './service';
import { logbookSlice, taskSchema, type LogbookSlice } from './state';
import { wireLogbook } from './wire';

export const logbookFeature: GameFeature = {
  id: 'logbook',
  contentTypes: { tasks: taskSchema },
  saveSlice: logbookSlice,
  scenes: [{ key: 'Logbook', scene: LogbookScene, kind: 'panel' }],
  menuEntries: [
    {
      id: 'logbook',
      label: 'Logbook',
      icon: 'icon_task',
      order: 25,
      sceneKey: 'Logbook',
      badge: () => getLogbook().claimable > 0,
    },
  ],
  init(ctx) {
    const svc = new LogbookService(ctx, ctx.save.slice<LogbookSlice>('logbook'));
    setLogbook(svc);
    wireLogbook(ctx, svc);
  },
  debugCommands: [
    {
      id: 'logbook.finish',
      label: 'Finish logbook tasks here',
      run: (ctx) => {
        const svc = getLogbook();
        for (const t of svc.current) if (!svc.isDone(t) && t.kind !== 'move') svc.slice.done.push(t.id);
        return `${svc.claimable} tasks ready to claim at ${ctx.world.clubWater()}`;
      },
    },
  ],
};
