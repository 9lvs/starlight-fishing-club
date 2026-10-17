// Daily gift feature: a small, no-pressure gift once per calendar day.
// Built only from the recipe in docs/ADDING_FEATURES.md.
import type { GameFeature } from '../../core/feature';
import { DailyGiftScene } from './DailyGiftScene';
import { DailyGiftService, getDailyGift, setDailyGift } from './service';
import { dailyGiftSlice, giftNoteSchema, type DailyGiftSlice } from './state';

// New bus event, added by declaration merging. The core does not change.
declare module '../../core/events' {
  interface GameEvents {
    dailyGiftClaimed: { day: string; coins: number };
  }
}

export const dailyGiftFeature: GameFeature = {
  id: 'dailyGift',
  contentTypes: { gifts: giftNoteSchema },
  saveSlice: dailyGiftSlice,
  // Upgrades in JSON can modify "dailyGiftCoins" (the Club Mailbox).
  stats: [{ id: 'dailyGiftCoins', base: 60, min: 0, integer: true, label: 'Daily gift', format: 'int' }],
  scenes: [{ key: 'DailyGift', scene: DailyGiftScene, kind: 'panel' }],
  menuEntries: [
    {
      id: 'dailyGift',
      label: 'Club gift',
      icon: 'icon_gift',
      order: 50,
      sceneKey: 'DailyGift',
      badge: () => getDailyGift().available(),
    },
  ],
  init(ctx) {
    setDailyGift(new DailyGiftService(ctx, ctx.save.slice<DailyGiftSlice>('dailyGift')));
    ctx.bus.on('dailyGiftClaimed', ({ coins }) => {
      ctx.ui.toast(`Opened the club gift: +${coins}`, { icon: 'icon_gift', color: 'gold' });
      ctx.bus.emit('audio:play', { key: 'purchase' });
    });
  },
  start(ctx) {
    if (getDailyGift().available()) ctx.ui.toast('A gift is waiting at the club', { icon: 'icon_gift' });
  },
  debugCommands: [
    {
      id: 'gift.reset',
      label: 'Make the gift available again',
      run: () => {
        getDailyGift().slice.lastClaimDay = null;
        return 'Gift is available';
      },
    },
  ],
};
