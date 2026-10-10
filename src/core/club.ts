// Moving the club: the opt-in fresh start. The club packs up and moves to the
// next water; coins, gear, and crew start over there (each feature resets its
// own progress when it hears clubMoved), and every coin earned from then on is
// worth more. The journal and anything in a keepOnMove branch stay.
import type { GameContext } from './context';

const BONUS_SOURCE = 'club:bonus';

/** Extra coin share from the club's home water (1 = +100%). */
export function clubBonus(ctx: GameContext): number {
  return ctx.registries.waters.tryGet(ctx.world.clubWater())?.clubBonus ?? 0;
}

/** The bonus multiplies sell value after every upgrade, so it scales everything. */
export function applyClubBonus(ctx: GameContext): void {
  const bonus = clubBonus(ctx);
  ctx.stats.setSource(BONUS_SOURCE, bonus > 0 ? [{ stat: 'sellValueMult', op: 'mult', value: 1 + bonus, priority: 10 }] : []);
}

export function moveClub(ctx: GameContext, waterId: string, opts: { force?: boolean } = {}): boolean {
  if (!opts.force && !ctx.world.canMoveTo(waterId)) return false;
  for (const c of ctx.registries.currencies.list()) {
    if (c.keepOnMove) continue;
    const delta = c.start - ctx.wallet.get(c.id);
    if (delta !== 0) ctx.wallet.add(c.id, delta);
  }
  const moved = ctx.world.moveClub(waterId);
  if (!moved) return false;
  applyClubBonus(ctx);
  ctx.bus.emit('clubMoved', { waterId, rank: moved.rank, previousRank: moved.previousRank });
  // Save right away so a closed tab cannot land between the reset and the next autosave.
  ctx.bus.emit('beforeSave', {});
  ctx.save.save();
  return true;
}
