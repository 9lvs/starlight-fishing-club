// Daily gift logic that touches the game: the stat, the wallet, the bus.
import { ECONOMY } from '../../config/balance';
import type { GameContext } from '../../core/context';
import { canClaim, dayKey, type DailyGiftSlice, type GiftNote } from './state';

export class DailyGiftService {
  private note: string | null = null;

  constructor(
    private readonly ctx: GameContext,
    readonly slice: DailyGiftSlice,
  ) {}

  available(): boolean {
    return canClaim(this.slice, this.ctx.clock.now());
  }

  /** Gift size comes from a stat, so upgrades can raise it with plain JSON. */
  amount(): number {
    return Math.round(this.ctx.stats.get('dailyGiftCoins'));
  }

  lastNote(): string | null {
    return this.note;
  }

  claim(): boolean {
    if (!this.available()) return false;
    const day = dayKey(this.ctx.clock.now());
    const coins = this.amount();
    this.slice.lastClaimDay = day;
    this.slice.totalClaims += 1;
    this.ctx.wallet.add(ECONOMY.defaultCurrency, coins);
    const notes = (this.ctx.content.extra.gifts ?? []) as GiftNote[];
    this.note = notes.length ? notes[Math.floor(this.ctx.rng() * notes.length)]!.text : null;
    this.ctx.bus.emit('dailyGiftClaimed', { day, coins });
    return true;
  }
}

let active: DailyGiftService | null = null;
export function setDailyGift(s: DailyGiftService): void {
  active = s;
}
export function getDailyGift(): DailyGiftService {
  if (!active) throw new Error('dailyGift feature is not initialised');
  return active;
}
