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
    ctx.bus.on('creelDeposit', (d) => (d.accepted = ctl.addToCreel(d.items)));
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
  ],
};
