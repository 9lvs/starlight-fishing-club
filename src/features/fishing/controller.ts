// Glue between the pure fishing session and the rest of the game: rolls the
// catch, emits bus events, and handles selling and keeping.
import { ECONOMY } from '../../config/balance';
import { FISHING } from '../../config/tuning';
import { fishValue, makeCatch } from '../../core/catching';
import type { GameContext } from '../../core/context';
import type { CatchResult } from '../../core/types';
import { FishingSession, type SessionEvent } from './fishingSession';
import type { FishingSlice } from './state';

export type ControllerListener = (e: SessionEvent) => void;

export class FishingController {
  readonly session: FishingSession;
  /** The catch waiting in the popup, if any. */
  pending: CatchResult | null = null;
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
        bus.emit('cast', { waterId });
        break;
      case 'bite':
        bus.emit('bite', { waterId, windowMs: e.windowMs });
        break;
      case 'missed':
        this.state.totals.misses++;
        bus.emit('biteMissed', { waterId });
        break;
      case 'hooked': {
        const made = makeCatch(this.ctx, {
          waterId,
          luck: this.ctx.stats.get('luck'),
          valueMult: this.ctx.stats.get('sellValueMult'),
          pity: this.state.pity,
        });
        this.pending = made?.result ?? null;
        if (made?.pity !== undefined) this.state.pity = made.pity;
        bus.emit('reel', { waterId });
        break;
      }
      case 'landed':
        if (this.pending) {
          this.state.totals.catches++;
          // Listeners (like the journal) may annotate pending.flags before the popup shows.
          bus.emit('catchLanded', { catch: this.pending, source: 'hand' });
        } else {
          this.session.finishLanded();
        }
        break;
    }
    this.listeners.forEach((fn) => fn(e));
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
    return fishValue(this.ctx, item.fishId, this.ctx.stats.get('sellValueMult'));
  }

  sellFromCreel(index: number): void {
    const item = this.state.creel[index];
    if (!item) return;
    const value = this.creelValue(index);
    this.state.creel.splice(index, 1);
    this.ctx.wallet.add(ECONOMY.defaultCurrency, value);
    this.ctx.bus.emit('fishSold', { fishId: item.fishId, value, currency: ECONOMY.defaultCurrency, source: 'creel' });
  }

  sellAllCreel(): number {
    let total = 0;
    while (this.state.creel.length > 0) {
      total += this.creelValue(0);
      this.sellFromCreel(0);
    }
    return total;
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
