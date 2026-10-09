// Offline feature: shows the summary after the core runs every feature's
// offline catch-up. The math lives in each feature (crew uses systems/offlineSim).
import { OFFLINE } from '../../config/tuning';
import type { GameFeature } from '../../core/feature';
import { OfflineSummaryScene } from './OfflineSummaryScene';

export const offlineFeature: GameFeature = {
  id: 'offline',
  scenes: [{ key: 'OfflineSummary', scene: OfflineSummaryScene, kind: 'panel' }],
  init(ctx) {
    ctx.bus.on('offlineCatchUpDone', (e) => {
      if (e.elapsedMs < OFFLINE.minSummaryMs) return;
      ctx.ui.openPanel('OfflineSummary', e);
    });
  },
};
