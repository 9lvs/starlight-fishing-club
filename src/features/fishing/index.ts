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
    setFishingController(new FishingController(ctx, ctx.save.slice<FishingSlice>('fishing')));
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
