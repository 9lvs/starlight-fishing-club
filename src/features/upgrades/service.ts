// Applies owned upgrade levels to the game: stat modifiers and effect handlers.
// Upgrades never hardcode effects; everything comes from upgrades.json.
import type { GameContext } from '../../core/context';
import type { UpgradeDef } from '../../core/content/schemas';
import { modifierAtLevel } from '../../core/stats';
import { currencyOf, levelOf, missingPrereqs, nextCost, nodeState, rankLocked, type Levels, type NodeState } from './logic';

export interface UpgradesSlice {
  levels: Levels;
}

export class UpgradeService {
  constructor(
    private readonly ctx: GameContext,
    readonly slice: UpgradesSlice,
  ) {}

  /** Re-apply every owned level (on load). */
  applyAll(): void {
    this.ctx.stats.batch(() => {
      for (const u of this.ctx.registries.upgrades.list()) {
        const level = levelOf(this.slice.levels, u.id);
        if (level > 0) this.apply(u, level);
      }
    });
  }

  private apply(u: UpgradeDef, level: number): void {
    this.ctx.stats.setSource(
      `upgrade:${u.id}`,
      u.modifiers.map((m) => modifierAtLevel(m, level)),
    );
    for (const e of u.effects) this.ctx.registries.effects.tryGet(e.handler)?.apply(this.ctx, e.args ?? {}, level);
  }

  level(id: string): number {
    return levelOf(this.slice.levels, id);
  }

  cost(u: UpgradeDef): number {
    return nextCost(u, this.level(u.id));
  }

  state(u: UpgradeDef): NodeState {
    return nodeState(u, this.slice.levels, (c) => this.ctx.wallet.get(c), this.ctx.world.clubRank);
  }

  /** Name of the water the club must reach first, or null when the rank is already met. */
  rankNeeded(u: UpgradeDef): string | null {
    if (!rankLocked(u, this.ctx.world.clubRank)) return null;
    const w = this.ctx.registries.waters.list().find((x) => x.rangeRequired === u.requiresRank);
    return w?.name ?? `club rank ${u.requiresRank}`;
  }

  /** The club moved: everything outside keepOnMove branches starts over. */
  resetForMove(): void {
    const keep = new Set(this.ctx.registries.branches.list().filter((b) => b.keepOnMove).map((b) => b.id));
    this.ctx.stats.batch(() => {
      for (const u of this.ctx.registries.upgrades.list()) {
        if (keep.has(u.branch) || this.level(u.id) === 0) continue;
        this.setLevel(u.id, 0);
      }
    });
  }

  missing(u: UpgradeDef): UpgradeDef[] {
    return missingPrereqs(u, this.slice.levels)
      .map((p) => this.ctx.registries.upgrades.tryGet(p.id))
      .filter((x): x is UpgradeDef => !!x);
  }

  anyAffordable(): boolean {
    return this.ctx.registries.upgrades.list().some((u) => this.state(u) === 'affordable');
  }

  buy(id: string): boolean {
    const u = this.ctx.registries.upgrades.get(id);
    if (this.state(u) !== 'affordable') return false;
    if (!this.ctx.wallet.spend(currencyOf(u), this.cost(u))) return false;
    const level = this.level(id) + 1;
    this.slice.levels[id] = level;
    this.apply(u, level);
    this.ctx.bus.emit('upgradePurchased', { upgradeId: id, level });
    return true;
  }

  /** Debug: set a level directly. */
  setLevel(id: string, level: number): void {
    const u = this.ctx.registries.upgrades.get(id);
    const clamped = Math.max(0, Math.min(u.maxLevel, level));
    if (clamped === 0) delete this.slice.levels[id];
    else this.slice.levels[id] = clamped;
    this.apply(u, clamped);
  }
}

let active: UpgradeService | null = null;
export function setUpgradeService(s: UpgradeService): void {
  active = s;
}
export function getUpgradeService(): UpgradeService {
  if (!active) throw new Error('upgrades feature is not initialised');
  return active;
}
