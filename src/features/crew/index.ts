// Crew feature: helpers who fish on a timer, live and while the tab is closed.
import { ECONOMY } from '../../config/balance';
import type { GameFeature } from '../../core/feature';
import { deckState } from '../../core/sceneState';
import { CrewScene } from './CrewScene';
import { CrewService, getCrewService, setCrewService } from './service';
import { crewSlice, type CrewSlice } from './state';

export const crewFeature: GameFeature = {
  id: 'crew',
  saveSlice: crewSlice,
  scenes: [{ key: 'Crew', scene: CrewScene, kind: 'panel' }],
  menuEntries: [
    {
      id: 'crew',
      label: 'Crew',
      icon: 'icon_crew',
      order: 30,
      sceneKey: 'Crew',
      badge: (ctx) => {
        const svc = getCrewService();
        return ctx.registries.crewTypes.list().some((t) => svc.canHire(t));
      },
    },
  ],
  init(ctx) {
    const svc = new CrewService(ctx, ctx.save.slice<CrewSlice>('crew'));
    setCrewService(svc);
    // Hired crew stand on the boat's deck (drawn by the world scene).
    const showOnDeck = () => {
      deckState.crew = svc.slice.members.map((m) => svc.type(m)?.spriteKey ?? '').filter(Boolean);
      ctx.bus.emit('deckChanged', {});
    };
    showOnDeck();
    ctx.bus.on('crewHired', showOnDeck);
    ctx.bus.on('clubMoved', () => {
      svc.resetForMove();
      showOnDeck();
    });
  },
  onTick(dt) {
    getCrewService().tick(dt);
  },
  onOfflineCatchUp(elapsedMs) {
    return getCrewService().catchUp(elapsedMs);
  },
  debugCommands: [
    {
      id: 'crew.hire',
      label: 'Hire one helper',
      args: [{ name: 'type', type: 'string', default: 'deckhand' }],
      run: (ctx, a) => {
        const svc = getCrewService();
        const t = ctx.registries.crewTypes.get(String(a.type));
        if (svc.freeSlots === 0) ctx.stats.setSource('debug:crew', [{ stat: 'crewSlots', op: 'add', value: ctx.registries.crewTypes.size }]);
        ctx.wallet.add(t.currency ?? ECONOMY.defaultCurrency, t.hireCost);
        return svc.hire(t.id) ? `Hired ${t.name}` : `Could not hire ${t.name}`;
      },
    },
    {
      id: 'crew.hireAll',
      label: 'Hire every helper',
      run: (ctx) => {
        const svc = getCrewService();
        ctx.stats.setSource('debug:crew', [{ stat: 'crewSlots', op: 'add', value: ctx.registries.crewTypes.size }]);
        for (const t of ctx.registries.crewTypes.list()) {
          ctx.wallet.add(t.currency ?? ECONOMY.defaultCurrency, t.hireCost);
          svc.hire(t.id);
        }
        return `Crew: ${svc.slice.members.map((m) => m.typeId).join(', ')}`;
      },
    },
  ],
};
