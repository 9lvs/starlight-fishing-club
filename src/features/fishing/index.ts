// Fishing feature: the hand-fishing loop, catch popup, and creel.
import type { GameFeature } from '../../core/feature';
import { CreelScene } from './CreelScene';
import { FishingController, getFishingController, setFishingController } from './controller';
import { FishingScene } from './FishingScene';
import { fishingSlice, type FishingSlice } from './state';

export const fishingFeature: GameFeature = {
  id: 'fishing',
  saveSlice: fishingSlice,
  scenes: [
    { key: 'Fishing', scene: FishingScene, kind: 'layer' },
    { key: 'Creel', scene: CreelScene, kind: 'panel' },
  ],
  init(ctx) {
    const ctl = new FishingController(ctx, ctx.save.slice<FishingSlice>('fishing'));
    setFishingController(ctl);
    ctx.bus.on('clubMoved', () => ctl.resetForMove());
    // Crew catches from time away go into the creel (see crew/service.ts).
    ctx.bus.on('creelRoom', (q) => (q.room = ctl.creelRoom));
    ctx.bus.on('settingsChanged', ({ key, value }) => {
      if (key === 'easyReel') ctl.easyReel = value === true;
    });
    ctx.bus.on('creelDeposit', (d) => (d.accepted = ctl.addToCreel(d.items)));
  },
  // Time away fills the bait tin: the next catches pay double.
  onOfflineCatchUp(elapsedMs) {
    const ctl = getFishingController();
    const gained = ctl.addRest(elapsedMs);
    if (gained <= 0) return;
    const n = ctl.state.rested;
    return {
      featureId: 'fishing',
      title: 'Fresh bait',
      lines: [`Your next ${n} ${n === 1 ? 'catch pays' : 'catches pay'} double.`],
    };
  },
  onTick(dt) {
    getFishingController().update(dt);
  },
  debugCommands: [
    {
      id: 'fishing.pity',
      label: 'Set pity counter',
      args: [{ name: 'value', type: 'number', default: 39 }],
      run: (_ctx, args) => {
        getFishingController().state.pity = Number(args.value);
        return `Pity counter is now ${args.value}`;
      },
    },
    {
      id: 'fishing.rested',
      label: 'Add rested time (minutes)',
      args: [{ name: 'minutes', type: 'number', default: 60 }],
      run: (_ctx, args) => {
        const ctl = getFishingController();
        ctl.addRest(Number(args.minutes) * 60_000);
        return `Fresh bait: ${ctl.state.rested} catches`;
      },
    },
  ],
};
