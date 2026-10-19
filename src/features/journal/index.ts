// Journal feature: records every catch (hand or crew), marks first catches as
// new, and shows the collection. It also keeps the message bottles: notes and
// little chests that now and then come up with a hand catch.
import type { GameFeature } from '../../core/feature';
import { BottlesService, getBottles, setBottles } from './bottles';
import { noteSchema } from './bottlesState';
import { JournalScene } from './JournalScene';
import { journalSlice, recordCatch, type JournalSlice } from './state';

declare module '../../core/events' {
  interface GameEvents {
    findFound: { kind: 'bottle' | 'chest' };
  }
}

export const journalFeature: GameFeature = {
  id: 'journal',
  contentTypes: { notes: noteSchema },
  saveSlice: journalSlice,
  scenes: [{ key: 'Journal', scene: JournalScene, kind: 'panel' }],
  menuEntries: [
    { id: 'journal', label: 'Journal', icon: 'icon_journal', order: 20, sceneKey: 'Journal', badge: () => getBottles().slice.unread.length > 0 },
  ],
  init(ctx) {
    const slice = ctx.save.slice<JournalSlice>('journal');
    const bottles = new BottlesService(ctx, slice.bottles);
    setBottles(bottles);
    // A find comes up with a hand catch and shows once the catch card closes, whichever way.
    ctx.bus.on('catchLanded', ({ catch: c, source }) => {
      if (source === 'hand') bottles.onCatch(c);
    });
    ctx.bus.on('fishSold', ({ source }) => {
      if (source === 'hand') bottles.reveal();
    });
    ctx.bus.on('fishKept', () => bottles.reveal());
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
      id: 'journal.find',
      label: 'Next catch brings up a find',
      run: () => {
        const s = getBottles().slice;
        s.lastAt = 0;
        s.dry = 999;
        return 'The next hand catch brings up a find';
      },
    },
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
