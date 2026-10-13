// Tutorial: a short guide for new players and one-time tips when something new
// becomes useful (the creel, crew, moving the club, the Daily Catch). Tips are
// gentle bubbles; nothing waits on them and any tip can be hidden with a tap.
import type { GameFeature } from '../../core/feature';
import { TutorialScene } from './TutorialScene';
import { TutorialService, getTutorial, setTutorial } from './service';
import { tutorialSlice, type TutorialSlice } from './state';

export const tutorialFeature: GameFeature = {
  id: 'tutorial',
  saveSlice: tutorialSlice,
  scenes: [{ key: 'Tutorial', scene: TutorialScene, kind: 'layer' }],
  init(ctx) {
    const svc = new TutorialService(ctx, ctx.save.slice<TutorialSlice>('tutorial'));
    setTutorial(svc);
    const bus = ctx.bus;
    bus.on('saveLoaded', ({ fresh }) => svc.decide(fresh));
    bus.on('cast', () => svc.onCast());
    bus.on('reel', () => svc.onReel());
    bus.on('catchLanded', ({ source }) => {
      if (source === 'hand') svc.onHandCatch();
    });
    bus.on('upgradePurchased', () => svc.onPurchase());
    bus.on('fishKept', () => svc.queue('creel'));
    bus.on('fishEscaped', () => svc.queue('tackle'));
    // These two only make sense in the moment, so they wait until the guide is done.
    bus.on('rareNearby', () => {
      if (svc.guideDone) svc.queue('glow');
    });
    bus.on('weatherChanged', ({ weather }) => {
      if (weather !== 'clear' && svc.guideDone) svc.queue('weather');
    });
    bus.on('waterUnlocked', () => svc.queue('move'));
    bus.on('currencyChanged', ({ currency, delta }) => {
      if (currency === 'gems' && delta > 0) svc.queue('gems');
    });
    bus.on('statsChanged', ({ stats }) => {
      if (stats.includes('crewSlots') && ctx.stats.get('crewSlots') > 0) svc.queue('crew');
    });
    bus.on('ui:openPanel', ({ sceneKey }) => svc.onPanelOpened(sceneKey));
    bus.on('help:replay', () => svc.replay());
  },
  debugCommands: [
    {
      id: 'tutorial.replay',
      label: 'Replay tutorial',
      run: () => {
        getTutorial().replay();
        return 'Tutorial restarted';
      },
    },
  ],
};
