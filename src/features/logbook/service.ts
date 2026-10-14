// The Logbook: a short list of tasks for the club's home water. Finishing one
// pays coins when you claim it; moving the club pays a few gems right away
// (coins would reset with the move, gems stay).
import type { GameContext } from '../../core/context';
import { record, type LogbookSlice, type LogEvent, type TaskDef } from './state';

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
    return this.current.filter((t) => this.isDone(t) && !this.isClaimed(t)).length;
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
