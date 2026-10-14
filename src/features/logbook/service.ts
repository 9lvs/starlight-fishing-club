// The Logbook: a short list of tasks for the club's home water. Finishing one
// pays coins when you claim it; moving the club pays a few gems right away
// (coins would reset with the move, gems stay).
import { DAILY_TASKS } from '../../config/tuning';
import type { GameContext } from '../../core/context';
import { dayKey } from '../../systems/calendar';
import { emptyDaily, pickDailies, record, type DailyDef, type DailyState, type LogbookSlice, type LogEvent, type TaskDef } from './state';

/** Round a reward to a tidy number: 35, 120, 3,400, 410,000. */
export function tidy(n: number): number {
  if (n < 100) return Math.max(5, Math.round(n / 5) * 5);
  const step = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / step) * step;
}

export class LogbookService {
  constructor(
    private readonly ctx: GameContext,
    readonly slice: LogbookSlice,
  ) {}

  private get all(): TaskDef[] {
    return (this.ctx.content.extra.tasks ?? []) as TaskDef[];
  }

  tasksFor(waterId: string): TaskDef[] {
    return this.all.filter((t) => t.water === waterId).sort((a, b) => a.order - b.order);
  }

  /** The tasks for the club's home water. */
  get current(): TaskDef[] {
    return this.tasksFor(this.ctx.world.clubWater());
  }

  progress(t: TaskDef): number {
    return this.slice.done.includes(t.id) ? t.count : (this.slice.progress[t.id] ?? 0);
  }

  isDone(t: TaskDef): boolean {
    return this.slice.done.includes(t.id);
  }

  isClaimed(t: TaskDef): boolean {
    return this.slice.claimed.includes(t.id);
  }

  get claimable(): number {
    const daily = this.today.filter((d) => this.dailyDone(d) && !this.dailyClaimed(d)).length;
    return this.current.filter((t) => this.isDone(t) && !this.isClaimed(t)).length + daily;
  }

  // Daily tasks.

  private get dailyPool(): DailyDef[] {
    return (this.ctx.content.extra.dailies ?? []) as DailyDef[];
  }

  /** Today's state; a new day draws new tasks (from the ones the club's rank allows). */
  get daily(): DailyState {
    const day = dayKey(this.ctx.clock.now());
    if (this.slice.daily?.day !== day) this.draw(day, day);
    return this.slice.daily;
  }

  /** Start a day's tasks over, drawn with this seed (the date, or anything for testing). */
  draw(day: string, seed: string): void {
    const pool = this.dailyPool.filter((d) => d.minRank <= this.ctx.world.clubRank);
    this.slice.daily = { ...emptyDaily(), day, ids: pickDailies(seed, pool, DAILY_TASKS.count) };
  }

  get today(): DailyDef[] {
    const pool = this.dailyPool;
    return this.daily.ids.map((id) => pool.find((d) => d.id === id)).filter((d): d is DailyDef => !!d);
  }

  dailyProgress(d: DailyDef): number {
    return this.daily.done.includes(d.id) ? d.count : (this.daily.progress[d.id] ?? 0);
  }

  dailyDone(d: DailyDef): boolean {
    return this.daily.done.includes(d.id);
  }

  dailyClaimed(d: DailyDef): boolean {
    return this.daily.claimed.includes(d.id);
  }

  /** Coins for a daily, scaled to the club's water from its regular task rewards. */
  dailyCoins(d: DailyDef): number {
    const coins = this.current.filter((t) => t.reward.currency === 'coins').map((t) => t.reward.amount);
    const base = coins.length > 0 ? (coins.reduce((s, n) => s + n, 0) / coins.length) * DAILY_TASKS.rewardBase : DAILY_TASKS.fallbackCoins;
    return tidy(base * d.share);
  }

  /** Time until tomorrow's tasks, in ms. */
  get resetInMs(): number {
    const now = this.ctx.clock.now();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return next.getTime() - now;
  }

  onDailyEvent(e: LogEvent): DailyDef[] {
    const today = this.today;
    const ids = record(this.daily, today, e);
    return ids.map((id) => today.find((d) => d.id === id)!).filter(Boolean);
  }

  /** Pays the coins, and now and then a gem as well. */
  claimDaily(id: string): { coins: number; gem: boolean } | null {
    const d = this.today.find((x) => x.id === id);
    if (!d || !this.dailyDone(d) || this.dailyClaimed(d)) return null;
    this.daily.claimed.push(d.id);
    const coins = this.dailyCoins(d);
    this.ctx.wallet.add('coins', coins);
    const gem = this.ctx.registries.currencies.has('gems') && this.ctx.rng() < DAILY_TASKS.gemChance;
    if (gem) this.ctx.wallet.add('gems', 1);
    return { coins, gem };
  }

  /** Feed an event; returns tasks that just finished. Moving the club checks every water's move task. */
  onEvent(e: LogEvent): TaskDef[] {
    const pool = e.kind === 'move' ? this.all.filter((t) => t.kind === 'move') : this.current;
    const ids = record(this.slice, pool, e);
    return ids.map((id) => this.all.find((t) => t.id === id)!).filter(Boolean);
  }

  claim(taskId: string): boolean {
    const t = this.all.find((x) => x.id === taskId);
    if (!t || !this.isDone(t) || this.isClaimed(t)) return false;
    if (!this.ctx.registries.currencies.has(t.reward.currency)) return false;
    this.slice.claimed.push(t.id);
    this.ctx.wallet.add(t.reward.currency, t.reward.amount);
    return true;
  }
}

let active: LogbookService | null = null;
export function setLogbook(s: LogbookService): void {
  active = s;
}
export function getLogbook(): LogbookService {
  if (!active) throw new Error('logbook feature is not initialised');
  return active;
}
