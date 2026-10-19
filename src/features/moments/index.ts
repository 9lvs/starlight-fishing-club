// Moments feature: now and then something small happens on the water for a
// minute or two and changes the next casts a little. The moments are data
// (src/content/moments/moments.json).
import type { GameFeature } from '../../core/feature';
import { MomentsScene } from './MomentsScene';
import { getMoments, MomentsService, setMoments } from './service';
import { momentSchema, type MomentDef } from './state';

declare module '../../core/events' {
  interface GameEvents {
    momentStarted: { id: string; visual: string; durationMs: number };
    momentEnded: { id: string };
  }
}

export const momentsFeature: GameFeature = {
  id: 'moments',
  contentTypes: { moments: momentSchema },
  scenes: [{ key: 'Moments', scene: MomentsScene, kind: 'layer' }],
  init(ctx) {
    const svc = new MomentsService(ctx);
    // A typo in a moment's stat should stop boot with a clear message, like other content.
    for (const m of svc.defs()) {
      for (const mod of m.modifiers) {
        if (!ctx.stats.has(mod.stat)) throw new Error(`moments.json > entry "${m.id}" > field "modifiers": unknown stat "${mod.stat}"`);
      }
    }
    setMoments(svc);
    // A moment belongs to the water it happened on.
    ctx.bus.on('waterChanged', () => svc.end());
    ctx.bus.on('clubMoved', () => svc.end());
  },
  onTick(dt) {
    getMoments().tick(dt);
  },
  debugCommands: [
    {
      id: 'moments.start',
      label: 'Start a water moment',
      args: [{ name: 'id', type: 'string', default: 'minnow_run' }],
      run: (ctx, a) => {
        const def = ((ctx.content.extra.moments ?? []) as MomentDef[]).find((m) => m.id === a.id);
        if (!def) return `No moment "${a.id}"`;
        getMoments().start(def);
        return `Started ${def.name}`;
      },
    },
  ],
};
