// Daily Catch: everyone fishes for the same fish at the starting water today,
// and catching it pays extra. Your first five catches of the day (anywhere) make
// a little row of squares with a luck score to share.
import { DAILY_CATCH } from '../../config/tuning';
import type { GameContext } from '../../core/context';
import type { CatchResult } from '../../core/types';
import type { FishDef } from '../../core/content/schemas';
import { dayKey } from '../../systems/calendar';
import { candidates, dailyFishId, firstFiveSquares, luckLabel, luckScore, type DailyCatchSlice, type FirstCatch } from './state';

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

  /** A new day clears yesterday's catches. */
  private roll(): void {
    const day = this.today();
    if (this.slice.day === day) return;
    this.slice.day = day;
    this.slice.first = [];
    this.slice.pondCasts = 0;
    this.slice.caught = null;
  }

  get caught(): DailyCatchSlice['caught'] {
    this.roll();
    return this.slice.caught;
  }

  /** Your first catches today (up to DAILY_CATCH.firstCount). */
  get first(): readonly FirstCatch[] {
    this.roll();
    return this.slice.first;
  }

  get pondCasts(): number {
    this.roll();
    return this.slice.pondCasts;
  }

  /** Sharing opens once the first five are in. */
  get canShare(): boolean {
    return this.first.length >= DAILY_CATCH.firstCount;
  }

  /** A missed bite at the daily water still counts as a try for today's fish. */
  onMiss(waterId: string): void {
    this.roll();
    if (waterId === this.waterId() && !this.slice.caught) this.slice.pondCasts += 1;
  }

  onCatch(c: CatchResult): void {
    this.roll();
    const isDaily = c.waterId === this.waterId() && c.fishId === this.fish()?.id;
    if (this.slice.first.length < DAILY_CATCH.firstCount) {
      this.slice.first.push({ tier: this.ctx.registries.rarities.tryGet(c.rarityId)?.tier ?? 0, daily: isDaily && !this.slice.caught });
    }
    if (c.waterId !== this.waterId() || this.slice.caught) return;
    this.slice.pondCasts += 1;
    if (!isDaily) return;
    this.slice.caught = { casts: this.slice.pondCasts, size: c.size };
    this.slice.daysCaught += 1;
    const bonus = Math.round(c.value * (DAILY_CATCH.valueMult - 1));
    if (bonus > 0) this.ctx.wallet.add(c.currency, bonus);
    this.ctx.bus.emit('dailyCatchCaught', { day: this.slice.day, casts: this.slice.caught.casts, bonus });
  }

  /** Spoiler-free text: your first five catches as squares, and a luck score. */
  shareText(url: string): string {
    const first = this.first;
    const score = luckScore(first);
    const max = DAILY_CATCH.firstCount * DAILY_CATCH.tierEmoji.length;
    const lines = [
      `Starlight Fishing Club 🎣 First Five · ${this.slice.day}`,
      `${firstFiveSquares(first, DAILY_CATCH)}  Luck ${score}/${max}`,
      luckLabel(score, DAILY_CATCH.luckLabels),
    ];
    const caught = this.caught;
    if (caught) lines.push(`Today's fish: caught in ${caught.casts} ${caught.casts === 1 ? 'cast' : 'casts'}`);
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
