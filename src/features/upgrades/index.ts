// Upgrades feature: a data-driven tree. Each node only lists stat modifiers and
// named effects, so new upgrades are pure JSON.
import type { GameFeature } from '../../core/feature';
import { UpgradeService, getUpgradeService, setUpgradeService, type UpgradesSlice } from './service';
import { UpgradesScene } from './UpgradesScene';

export const upgradesFeature: GameFeature = {
  id: 'upgrades',
  saveSlice: { key: 'upgrades', version: 1, defaults: (): UpgradesSlice => ({ levels: {} }) },
  scenes: [{ key: 'Upgrades', scene: UpgradesScene, kind: 'panel' }],
  menuEntries: [
    {
      id: 'upgrades',
      label: 'Upgrades',
      icon: 'icon_star',
      order: 10,
      sceneKey: 'Upgrades',
      badge: () => getUpgradeService().anyAffordable(),
    },
  ],
  init(ctx) {
    const svc = new UpgradeService(ctx, ctx.save.slice<UpgradesSlice>('upgrades'));
    setUpgradeService(svc);
    svc.applyAll();
  },
  debugCommands: [
    {
      id: 'upgrades.max',
      label: 'Max all upgrades',
      run: (ctx) => {
        const svc = getUpgradeService();
        for (const u of ctx.registries.upgrades.list()) svc.setLevel(u.id, u.maxLevel);
        return 'All upgrades maxed';
      },
    },
    {
      id: 'upgrades.reset',
      label: 'Reset upgrades',
      run: (ctx) => {
        const svc = getUpgradeService();
        for (const u of ctx.registries.upgrades.list()) svc.setLevel(u.id, 0);
        return 'All upgrades reset';
      },
    },
  ],
};
