// Daily Catch: everyone fishes for the same fish at the starting water today.
// Casts there fill a little grid; catching the fish pays extra and the grid can
// be shared without spoiling which fish it was.
import { DAILY_CATCH } from '../../config/tuning';
import type { GameContext } from '../../core/context';
import type { CatchResult } from '../../core/types';
import type { FishDef } from '../../core/content/schemas';
import { dayKey } from '../../systems/calendar';
import { formatNumber } from '../../ui/format';
import { candidates, dailyFishId, shareGrid, type DailyCatchSlice } from './state';

export class DailyCatchService {
  constructor(
    private readonly ctx: GameContext,
    readonly slice: DailyCatchSlice,
  ) {}

  today(): string {
    return dayKey(this.ctx.clock.now());
  }

  /** The starting water: everyone has it, so everyone can play. */
  waterId(): string {
    const w = [...this.ctx.registries.waters.list()].filter((x) => !x.comingSoon).sort((a, b) => a.rangeRequired - b.rangeRequired)[0];
    return w?.id ?? this.ctx.world.waterId;
  }

  fish(): FishDef | null {
    const r = this.ctx.registries;
    const pool = candidates(
      r.fish.list().map((f) => ({ ...f, rarityTier: r.rarities.tryGet(f.rarity)?.tier ?? 0 })),
      this.waterId(),
      DAILY_CATCH.tiers,
    );
    const id = dailyFishId(this.today(), pool);
    return id ? r.fish.get(id) : null;
  }

  /** A new day clears yesterday's attempts. */
  private roll(): void {
    const day = this.today();
    if (this.slice.day === day) return;
    this.slice.day = day;
    this.slice.tries = [];
    this.slice.caught = null;
  }

  get caught(): DailyCatchSlice['caught'] {
    this.roll();
    return this.slice.caught;
  }

  get tries(): readonly number[] {
    this.roll();
    return this.slice.tries;
  }

  private record(tier: number): void {
    this.roll();
    if (this.slice.caught || this.slice.tries.length >= DAILY_CATCH.gridMax) return;
    this.slice.tries.push(tier);
  }

  onMiss(waterId: string): void {
    if (waterId === this.waterId()) this.record(-1);
  }

  onCatch(c: CatchResult): void {
    if (c.waterId !== this.waterId() || this.caught) return;
    this.record(this.ctx.registries.rarities.tryGet(c.rarityId)?.tier ?? 0);
    if (c.fishId !== this.fish()?.id) return;
    this.slice.caught = { casts: this.slice.tries.length, size: c.size };
    this.slice.daysCaught += 1;
    const bonus = Math.round(c.value * (DAILY_CATCH.valueMult - 1));
    if (bonus > 0) this.ctx.wallet.add(c.currency, bonus);
    this.ctx.bus.emit('dailyCatchCaught', { day: this.slice.day, casts: this.slice.caught.casts, bonus });
  }

  /** Spoiler-free text for the share sheet. */
  shareText(url: string): string {
    const fish = this.fish();
    const caught = this.caught;
    const head = caught ? `Caught today's fish in ${caught.casts} ${caught.casts === 1 ? 'cast' : 'casts'}` : `Still fishing (${this.tries.length} casts so far)`;
    const grid = shareGrid(this.tries, !!caught, DAILY_CATCH);
    const lines = [`Starlight Fishing Club 🎣 Daily Catch ${this.slice.day}`, head];
    if (grid) lines.push(grid);
    if (caught && fish) lines.push(`${caught.size} cm · ${formatNumber(this.slice.daysCaught)} days caught`);
    lines.push(url);
    return lines.join('\n');
  }
}

let active: DailyCatchService | null = null;
export function setDailyCatch(s: DailyCatchService): void {
  active = s;
}
export function getDailyCatch(): DailyCatchService {
  if (!active) throw new Error('dailyCatch feature is not initialised');
  return active;
}
