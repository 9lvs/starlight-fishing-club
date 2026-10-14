// Journal feature: records every catch (hand or crew), marks first catches as
// new, and shows the collection.
import type { GameFeature } from '../../core/feature';
import { JournalScene } from './JournalScene';
import { journalSlice, recordCatch, type JournalSlice } from './state';

export const journalFeature: GameFeature = {
  id: 'journal',
  saveSlice: journalSlice,
  scenes: [{ key: 'Journal', scene: JournalScene, kind: 'panel' }],
  menuEntries: [{ id: 'journal', label: 'Journal', icon: 'icon_journal', order: 20, sceneKey: 'Journal' }],
  init(ctx) {
    const slice = ctx.save.slice<JournalSlice>('journal');
    ctx.bus.on('catchLanded', ({ catch: c, source }) => {
      const isNew = recordCatch(slice, c.fishId, c.size, c.at);
      if (!isNew) return;
      // The catch popup reads this flag; crew discoveries get a toast instead.
      c.flags.new = true;
      if (source === 'crew') {
        const name = ctx.registries.fish.tryGet(c.fishId)?.name ?? c.fishId;
        ctx.ui.toast(`New in the journal: ${name}`, { icon: 'icon_journal' });
      }
    });
    ctx.bus.on('cleanLanding', ({ fishId }) => {
      const e = slice.entries[fishId];
      if (e) e.clean = (e.clean ?? 0) + 1;
    });
    // Offline crew catches arrive as one batch per fish type.
    ctx.bus.on('catchesBatched', ({ entries, at }) => {
      for (const e of entries) {
        const isNew = recordCatch(slice, e.fishId, e.size, at);
        if (e.count > 1) slice.entries[e.fishId]!.count += e.count - 1;
        if (isNew) ctx.ui.toast(`New in the journal: ${ctx.registries.fish.tryGet(e.fishId)?.name ?? e.fishId}`, { icon: 'icon_journal' });
      }
    });
  },
  debugCommands: [
    {
      id: 'journal.fill',
      label: 'Discover all fish',
      run: (ctx) => {
        const slice = ctx.save.slice<JournalSlice>('journal');
        for (const f of ctx.registries.fish.list()) recordCatch(slice, f.id, f.size?.[1] ?? 10, ctx.clock.now());
        return `Journal has ${Object.keys(slice.entries).length} fish`;
      },
    },
  ],
};
