// Map feature: the club's journey. Choose which reached water to fish, and move
// the club to the next one when the boat can get there. The world state owns the
// water and rank; core/club.ts does the move.
import { moveClub } from '../../core/club';
import type { GameFeature } from '../../core/feature';
import { MapScene } from './MapScene';

export const mapFeature: GameFeature = {
  id: 'map',
  scenes: [{ key: 'Map', scene: MapScene, kind: 'panel' }],
  menuEntries: [{ id: 'map', label: 'Map', icon: 'icon_map', order: 40, sceneKey: 'Map' }],
  init(ctx) {
    ctx.bus.on('waterUnlocked', ({ waterId }) => {
      const name = ctx.registries.waters.tryGet(waterId)?.name ?? waterId;
      ctx.ui.toast(`Your boat can reach ${name}! Open the map to move the club.`, { icon: 'icon_map', color: 'gold' });
    });
  },
  debugCommands: [
    {
      id: 'map.moveNext',
      label: 'Move club to next water',
      run: (ctx) => {
        const next = ctx.world.nextWater();
        if (!next) return 'Already at the last water';
        return moveClub(ctx, next, { force: true }) ? `Club moved to ${next}` : `Could not move to ${next}`;
      },
    },
  ],
};
