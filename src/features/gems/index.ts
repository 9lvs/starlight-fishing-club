// Gems feature: gem finds on catches (yours and your crew's, also while you are
// away) and the Gem Exchange panel, opened from the Club upgrades tab.
import { GEMS } from '../../config/tuning';
import type { GameFeature } from '../../core/feature';
import { GemsScene } from './GemsScene';
import { GemService, getGemService, setGemService } from './service';

export const gemsFeature: GameFeature = {
  id: 'gems',
  scenes: [{ key: 'Gems', scene: GemsScene, kind: 'panel' }],
  init(ctx) {
    const svc = new GemService(ctx);
    setGemService(svc);
    const icon = ctx.registries.currencies.tryGet(GEMS.currency)?.icon;
    ctx.bus.on('catchLanded', ({ catch: c, source }) => {
      if (svc.rollCatch(c.fishId) === 0) return;
      ctx.bus.emit('audio:play', { key: 'gem' });
      ctx.ui.toast(source === 'hand' ? 'A gem was tangled in the line!' : 'Your crew found a gem!', { icon, color: 'lavender' });
    });
    ctx.bus.on('catchesBatched', ({ entries }) => {
      const found = svc.rollBatch(entries);
      if (found > 0) ctx.ui.toast(`Your crew found ${found} ${found === 1 ? 'gem' : 'gems'} while you were away`, { icon, color: 'lavender' });
    });
  },
  debugCommands: [
    {
      id: 'gems.add',
      label: 'Add gems',
      args: [{ name: 'amount', type: 'number', default: 20 }],
      run: (ctx, a) => {
        ctx.wallet.add(GEMS.currency, Number(a.amount));
        return `Gems: ${ctx.wallet.get(GEMS.currency)} (rate ${getGemService().rate} coins each)`;
      },
    },
  ],
};
