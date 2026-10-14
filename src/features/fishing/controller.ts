// Glue between the pure fishing session and the rest of the game: rolls the
// catch, emits bus events, and handles selling and keeping.
import { ECONOMY } from '../../config/balance';
import { CATCH, CREEL, FIGHT, FISHING, FX, RESTED } from '../../config/tuning';
import { bundleBonus, matchingSets, type SetResult } from '../../systems/economy';
import { conditionWeight, fishValue, makeCatch, rarityBoosts } from '../../core/catching';
import { escapeChance, quickBonus } from '../../systems/catchOdds';
import type { GameContext } from '../../core/context';
import type { CatchResult } from '../../core/types';
import { FishingSession, type SessionEvent } from './fishingSession';
import { addRest, type CreelItem, type FishingSlice } from './state';

export interface CreelSale {
  /** Value of every ready fish at today's prices. */
  base: number;
  /** How many fish this sale includes (only prepped ones sell). */
  count: number;
  bundleShare: number;
  bundle: number;
  sets: SetResult[];
  total: number;
}

export type ControllerListener = (e: SessionEvent) => void;

type Plan = { made: { result: CatchResult; pity: number | undefined }; escape: number };

export class FishingController {
  readonly session: FishingSession;
  /** The catch waiting in the popup, if any. */
  pending: CatchResult | null = null;
  /** The fish rolled at cast time, waiting for a bite. */
  private planned: Plan | null = null;
  /** The last hooked fish that slipped away (for the scene's message). */
  escaped: { result: CatchResult; chance: number } | null = null;
  /** Quick-catch bonus for the fish now landing. */
  quick: { label: string; coins: number } | null = null;
  /** Bonus for a clean fight with the fish now landing. */
  clean: { coins: number } | null = null;
  /** Rested bonus paid on the fish now landing (fresh bait from time away). */
  rested: { coins: number } | null = null;
  /** A rare fish on the line, fighting, with what is needed to land it after. */
  private fighting: { plan: Plan; reactionMs: number; windowMs: number } | null = null;
  /** Easy reel (Settings): rare fish land with one tap, no fight. */
  easyReel = false;
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
      FIGHT,
    );
  }

  /** Lift a finger or a key (legendary fish need a hold). */
  release(): void {
    this.session.release();
  }

  /** Dips to tap and whether a hold follows, for a fish of this rarity tier. */
  fightFor(tier: number): { dips: number; hold: boolean } | null {
    if (this.easyReel || tier < FIGHT.minTier) return null;
    const dips = FIGHT.dipsByTier[Math.min(tier, FIGHT.dipsByTier.length - 1)] ?? 0;
    return { dips, hold: tier >= FIGHT.holdMinTier };
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
        this.clean = null;
        this.rested = null;
        this.fighting = null;
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
        // Rare fish fight first; how the fight goes changes the slip chance.
        const tier = plan ? (this.ctx.registries.rarities.tryGet(plan.made.result.rarityId)?.tier ?? 0) : 0;
        const fight = plan ? this.fightFor(tier) : null;
        if (plan && fight) {
          this.fighting = { plan, reactionMs: e.reactionMs, windowMs: e.windowMs };
          this.session.startFight(fight.dips, fight.hold);
          bus.emit('fishFight', { rarityId: plan.made.result.rarityId, dips: fight.dips, hold: fight.hold });
          break;
        }
        this.resolveHook(plan, e.reactionMs, e.windowMs, 1);
        this.slowForLegend();
        bus.emit('reel', { waterId });
        break;
      }
      case 'fightDone': {
        const f = this.fighting;
        this.fighting = null;
        if (!f) break;
        // Share of the fight done well: each dip, plus the hold for a legendary.
        const parts = e.dips + (e.hold ? 1 : 0);
        const quality = parts > 0 ? (e.hits + (e.hold && e.held ? 1 : 0)) / parts : 1;
        const mult = FIGHT.escapeMissed + (FIGHT.escapeClean - FIGHT.escapeMissed) * quality;
        this.resolveHook(f.plan, f.reactionMs, f.windowMs, mult);
        if (this.pending && quality >= 1) this.clean = { coins: Math.max(1, Math.round(this.pending.value * FIGHT.cleanBonus)) };
        this.slowForLegend();
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
          if (this.clean) this.ctx.wallet.add(this.pending.currency, this.clean.coins);
          if (this.state.rested > 0) {
            this.state.rested -= 1;
            this.rested = { coins: Math.max(1, Math.round(this.pending.value * RESTED.bonus)) };
            this.ctx.wallet.add(this.pending.currency, this.rested.coins);
            bus.emit('restedCatch', { coins: this.rested.coins, left: this.state.rested });
          }
          // Listeners (like the journal) may annotate pending.flags before the popup shows.
          bus.emit('catchLanded', { catch: this.pending, source: 'hand' });
          // After catchLanded, so the journal already has this fish to mark.
          if (this.clean) bus.emit('cleanLanding', { fishId: this.pending.fishId, coins: this.clean.coins });
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

  /** Tier of the fish now landing, or -1. */
  get pendingTier(): number {
    return this.pending ? (this.ctx.registries.rarities.tryGet(this.pending.rarityId)?.tier ?? 0) : -1;
  }

  /** A legendary on its way in leaps in slow motion (the scene draws the moment). */
  private slowForLegend(): void {
    if (this.pendingTier >= FX.legendary.minTier) this.session.stretchReel(FX.legendary.slow);
  }

  /** Did the hooked fish slip? If not, it is pending, with its quick-catch bonus. */
  private resolveHook(plan: Plan | null, reactionMs: number, windowMs: number, escapeMult: number): void {
    const result = plan?.made.result ?? null;
    const escape = plan ? Math.min(1, plan.escape * escapeMult) : 0;
    if (result && this.ctx.rng() < escape) {
      // It slipped the hook. The pity counter keeps counting, so luck is never lost.
      this.escaped = { result, chance: escape };
      this.pending = null;
      this.state.pity += 1;
      return;
    }
    this.pending = result;
    if (plan?.made.pity !== undefined) this.state.pity = plan.made.pity;
    const tier = result ? quickBonus(reactionMs, windowMs, CATCH.quick, this.ctx.stats.get('quickWindow')) : null;
    this.quick = tier && result ? { label: tier.label, coins: Math.max(1, Math.round(result.value * tier.bonus)) } : null;
  }

  /** Roll the next fish with everything the player has: luck, lures, bait. */
  private plan(waterId: string): Plan | null {
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

  /** Time away fills the bait tin. Returns the charges it added. */
  addRest(ms: number): number {
    const gained = addRest(this.state, ms, RESTED);
    if (gained > 0) this.ctx.bus.emit('restedChanged', { left: this.state.rested });
    return gained;
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
    this.state.creel.push({ fishId: c.fishId, size: c.size, at: c.at, readyAt: this.ctx.clock.now() + this.prepMs });
    this.ctx.bus.emit('fishKept', { catch: c });
    this.session.finishLanded();
    return true;
  }

  /** How long a fish kept now takes to prep for market (the Ice Chest shortens it). */
  get prepMs(): number {
    return Math.round(CREEL.prepMs * this.ctx.stats.get('prepTimeMult'));
  }

  /** Time until this kept fish can be sold (0 = ready). */
  prepLeft(item: CreelItem): number {
    return Math.max(0, (item.readyAt ?? 0) - this.ctx.clock.now());
  }

  isReady(item: CreelItem): boolean {
    return this.prepLeft(item) <= 0;
  }

  /** Fish in the creel that can be sold now. */
  get readyCount(): number {
    return this.state.creel.filter((i) => this.isReady(i)).length;
  }

  /** Time until the next fish is ready, or 0 if one is ready (or the creel is empty). */
  get nextReadyIn(): number {
    const waits = this.state.creel.map((i) => this.prepLeft(i));
    return waits.length === 0 || waits.some((w) => w <= 0) ? 0 : Math.min(...waits);
  }

  /** Kept fish sell at today's prices, so upgrades bought later still count. Crew catches from time away sell at the crew price. */
  creelValue(index: number): number {
    const item = this.state.creel[index];
    if (!item || !this.ctx.registries.fish.has(item.fishId)) return 0;
    const s = this.ctx.stats;
    const mult = s.get('sellValueMult') * s.get('fishSizeMult') * (item.crew ? s.get('crewSellMult') : 1);
    return Math.max(1, Math.round(fishValue(this.ctx, item.fishId, mult)));
  }

  /** Free creel slots. */
  get creelRoom(): number {
    return Math.max(0, this.ctx.stats.get('storageCap') - this.state.creel.length);
  }

  /** Crew catches from time away land in the creel, as many as fit, already prepped. Returns how many fit. */
  addToCreel(items: readonly CreelItem[]): number {
    const fit = items.slice(0, this.creelRoom);
    this.state.creel.push(...fit.map(({ readyAt: _r, ...i }) => i));
    return fit.length;
  }

  /** What selling every ready fish now would pay: values, the bundle bonus, and matching sets. */
  creelSale(): CreelSale {
    const r = this.ctx.registries;
    const groups = new Map<string, { count: number; value: number }>();
    let base = 0;
    let count = 0;
    this.state.creel.forEach((item, i) => {
      if (!this.isReady(item)) return;
      count += 1;
      const v = this.creelValue(i);
      base += v;
      const rarity = r.fish.tryGet(item.fishId)?.rarity;
      if (!rarity) return;
      const g = groups.get(rarity) ?? { count: 0, value: 0 };
      g.count += 1;
      g.value += v;
      groups.set(rarity, g);
    });
    const sets = matchingSets(
      [...groups].map(([id, g]) => ({ id, ...g, mult: r.rarities.tryGet(id)?.setMult ?? 1 })),
      CREEL.sets,
    ).sort((a, b) => (r.rarities.tryGet(b.id)?.tier ?? 0) - (r.rarities.tryGet(a.id)?.tier ?? 0));
    const bundleShare = bundleBonus(count, CREEL.bundlePerFish, CREEL.bundleMax);
    const bundle = Math.round(base * bundleShare);
    const total = base + bundle + sets.reduce((s, x) => s + x.bonus, 0);
    return { base, count, bundleShare, bundle, sets, total };
  }

  /** Sell one ready fish. Fish still being prepped stay put. */
  sellFromCreel(index: number): void {
    const item = this.state.creel[index];
    if (!item || !this.isReady(item)) return;
    const value = this.creelValue(index);
    this.state.creel.splice(index, 1);
    this.ctx.wallet.add(ECONOMY.defaultCurrency, value);
    this.ctx.bus.emit('fishSold', { fishId: item.fishId, value, currency: ECONOMY.defaultCurrency, source: 'creel' });
  }

  /** The club moved to a new water: the creel starts empty there. */
  resetForMove(): void {
    this.state.creel.length = 0;
  }

  /** Sell every ready fish at once: today's prices, the bundle bonus, and matching sets. */
  sellAllCreel(): CreelSale {
    const sale = this.creelSale();
    for (let i = this.state.creel.length - 1; i >= 0; i--) this.sellFromCreel(i);
    const bonus = sale.total - sale.base;
    if (bonus > 0) {
      this.ctx.wallet.add(ECONOMY.defaultCurrency, bonus);
      this.ctx.bus.emit('audio:play', { key: sale.sets.length > 0 ? 'set' : 'bundle' });
    }
    if (sale.sets.length > 0) this.ctx.bus.emit('creelSetsSold', { sets: sale.sets.map((s) => ({ rarityId: s.id, size: s.size, bonus: s.bonus })) });
    return sale;
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
