// Glue between the pure fishing session and the rest of the game: rolls the
// catch, emits bus events, and handles selling and keeping.
import { ECONOMY } from '../../config/balance';
import { CATCH, CREEL, FISHING } from '../../config/tuning';
import { bundleBonus } from '../../systems/economy';
import { conditionWeight, fishValue, makeCatch, rarityBoosts } from '../../core/catching';
import { escapeChance, quickBonus } from '../../systems/catchOdds';
import type { GameContext } from '../../core/context';
import type { CatchResult } from '../../core/types';
import { FishingSession, type SessionEvent } from './fishingSession';
import type { FishingSlice } from './state';

export type ControllerListener = (e: SessionEvent) => void;

export class FishingController {
  readonly session: FishingSession;
  /** The catch waiting in the popup, if any. */
  pending: CatchResult | null = null;
  /** The fish rolled at cast time, waiting for a bite. */
  private planned: { made: { result: CatchResult; pity: number | undefined }; escape: number } | null = null;
  /** The last hooked fish that slipped away (for the scene's message). */
  escaped: { result: CatchResult; chance: number } | null = null;
  /** Quick-catch bonus for the fish now landing. */
  quick: { label: string; coins: number } | null = null;
  private listeners = new Set<ControllerListener>();

  constructor(
    private readonly ctx: GameContext,
    readonly state: FishingSlice,
  ) {
    const s = ctx.stats;
    this.session = new FishingSession(
      FISHING,
      {
        waitMinMs: () => s.get('waitMinMs'),
        waitMaxMs: () => s.get('waitMaxMs'),
        castSpeed: () => s.get('castSpeed'),
        biteWindowMs: () => s.get('biteWindowMs'),
      },
      ctx.rng,
      (e) => this.onSession(e),
    );
  }

  onEvent(fn: ControllerListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  tap(): void {
    this.session.tap();
  }

  update(dt: number): void {
    this.session.update(dt);
  }

  private onSession(e: SessionEvent): void {
    const bus = this.ctx.bus;
    const waterId = this.ctx.world.waterId;
    switch (e.type) {
      case 'cast':
        this.state.totals.casts++;
        this.escaped = null;
        this.quick = null;
        // Roll now, so the water can hint at a rare fish while you wait.
        this.planned = this.plan(waterId);
        bus.emit('cast', { waterId });
        if (this.upcomingTier >= FISHING.glowMinTier) bus.emit('rareNearby', { rarityId: this.upcomingRarity! });
        break;
      case 'bite':
        bus.emit('bite', { waterId, windowMs: e.windowMs });
        break;
      case 'missed':
        this.state.totals.misses++;
        this.planned = null;
        bus.emit('biteMissed', { waterId });
        break;
      case 'hooked': {
        const plan = this.planned ?? this.plan(waterId);
        this.planned = null;
        const result = plan?.made.result ?? null;
        if (result && this.ctx.rng() < plan!.escape) {
          // It slipped the hook. The pity counter keeps counting, so luck is never lost.
          this.escaped = { result, chance: plan!.escape };
          this.pending = null;
          this.state.pity += 1;
        } else {
          this.pending = result;
          if (plan?.made.pity !== undefined) this.state.pity = plan.made.pity;
          const tier = result ? quickBonus(e.reactionMs, e.windowMs, CATCH.quick, this.ctx.stats.get('quickWindow')) : null;
          this.quick = tier && result ? { label: tier.label, coins: Math.max(1, Math.round(result.value * tier.bonus)) } : null;
        }
        bus.emit('reel', { waterId });
        break;
      }
      case 'landed':
        if (this.pending) {
          this.state.totals.catches++;
          if (this.quick) {
            this.ctx.wallet.add(this.pending.currency, this.quick.coins);
            bus.emit('quickCatch', this.quick);
          }
          // Listeners (like the journal) may annotate pending.flags before the popup shows.
          bus.emit('catchLanded', { catch: this.pending, source: 'hand' });
        } else {
          if (this.escaped) {
            const c = this.escaped.result;
            bus.emit('fishEscaped', { fishId: c.fishId, rarityId: c.rarityId, waterId: c.waterId, chance: this.escaped.chance });
          }
          this.session.finishLanded();
        }
        break;
    }
    this.listeners.forEach((fn) => fn(e));
  }

  /** Roll the next fish with everything the player has: luck, lures, bait. */
  private plan(waterId: string): { made: { result: CatchResult; pity: number | undefined }; escape: number } | null {
    const made = makeCatch(this.ctx, {
      waterId,
      luck: this.ctx.stats.get('luck'),
      valueMult: this.ctx.stats.get('sellValueMult'),
      pity: this.state.pity,
      boosts: rarityBoosts(this.ctx),
      sizeMult: this.ctx.stats.get('fishSizeMult'),
      fishWeight: conditionWeight(this.ctx),
    });
    return made ? { made, escape: this.escapeChance(made.result) } : null;
  }

  /** Chance this fish slips away, from its rarity, the water, and the player's tackle. */
  escapeChance(c: Pick<CatchResult, 'rarityId' | 'waterId'>): number {
    const r = this.ctx.registries.rarities.tryGet(c.rarityId);
    const w = this.ctx.registries.waters.tryGet(c.waterId);
    if (!r) return 0;
    const need = r.tackleNeed + (w?.tackleNeed ?? 0) * r.waterNeedShare;
    return escapeChance(r.escape, need, this.ctx.stats.get('tackle'), this.ctx.stats.get('escapeMult'), CATCH.escape);
  }

  /** Rarity tier of the fish on its way (for the glow in the water), or -1. */
  get upcomingTier(): number {
    const id = this.planned?.made.result.rarityId;
    return id ? (this.ctx.registries.rarities.tryGet(id)?.tier ?? -1) : -1;
  }

  get upcomingRarity(): string | null {
    return this.planned?.made.result.rarityId ?? null;
  }

  get creelFull(): boolean {
    return this.state.creel.length >= this.ctx.stats.get('storageCap');
  }

  sellPending(): void {
    const c = this.pending;
    if (!c) return;
    this.pending = null;
    this.ctx.wallet.add(c.currency, c.value);
    this.ctx.bus.emit('fishSold', { fishId: c.fishId, value: c.value, currency: c.currency, source: 'hand' });
    this.session.finishLanded();
  }

  keepPending(): boolean {
    const c = this.pending;
    if (!c || this.creelFull) return false;
    this.pending = null;
    this.state.creel.push({ fishId: c.fishId, size: c.size, at: c.at });
    this.ctx.bus.emit('fishKept', { catch: c });
    this.session.finishLanded();
    return true;
  }

  /** Kept fish sell at today's prices, so upgrades bought later still count. */
  creelValue(index: number): number {
    const item = this.state.creel[index];
    if (!item || !this.ctx.registries.fish.has(item.fishId)) return 0;
    return fishValue(this.ctx, item.fishId, this.ctx.stats.get('sellValueMult') * this.ctx.stats.get('fishSizeMult'));
  }

  sellFromCreel(index: number): void {
    const item = this.state.creel[index];
    if (!item) return;
    const value = this.creelValue(index);
    this.state.creel.splice(index, 1);
    this.ctx.wallet.add(ECONOMY.defaultCurrency, value);
    this.ctx.bus.emit('fishSold', { fishId: item.fishId, value, currency: ECONOMY.defaultCurrency, source: 'creel' });
  }

  /** The club moved to a new water: the creel starts empty there. */
  resetForMove(): void {
    this.state.creel.length = 0;
  }

  /** The bundle bonus share if the whole creel were sold now. */
  get bundleShare(): number {
    return bundleBonus(this.state.creel.length, CREEL.bundlePerFish, CREEL.bundleMax);
  }

  /** Sell everything at once: today's prices plus the bundle bonus. Returns the total paid. */
  sellAllCreel(): number {
    const share = this.bundleShare;
    let total = 0;
    while (this.state.creel.length > 0) {
      total += this.creelValue(0);
      this.sellFromCreel(0);
    }
    const bonus = Math.round(total * share);
    if (bonus > 0) {
      this.ctx.wallet.add(ECONOMY.defaultCurrency, bonus);
      this.ctx.bus.emit('audio:play', { key: 'bundle' });
    }
    return total + bonus;
  }
}

let active: FishingController | null = null;

export function setFishingController(c: FishingController): void {
  active = c;
}

export function getFishingController(): FishingController {
  if (!active) throw new Error('fishing feature is not initialised');
  return active;
}
