// Map feature: choose which water to fish and announce new ones. The world
// state owns the current water; this feature only offers a way to change it.
import type { GameFeature } from '../../core/feature';
import { MapScene } from './MapScene';

export const mapFeature: GameFeature = {
  id: 'map',
  scenes: [{ key: 'Map', scene: MapScene, kind: 'panel' }],
  menuEntries: [{ id: 'map', label: 'Map', icon: 'icon_map', order: 40, sceneKey: 'Map' }],
  init(ctx) {
    ctx.bus.on('waterUnlocked', ({ waterId }) => {
      const name = ctx.registries.waters.tryGet(waterId)?.name ?? waterId;
      ctx.ui.toast(`${name} unlocked! Open the map to sail there.`, { icon: 'icon_map', color: 'gold' });
    });
  },
};
