// Decides which tip shows now. New players get a short guide (cast, wait for the
// bite, buy an upgrade); after that, one-time tips appear when they become
// useful. Tips never block play: they hide while a panel or the catch card is open.
import type { GameContext } from '../../core/context';
import { DAILY_TIP_AFTER, GUIDE, TIPS, type TipDef } from './tips';
import type { TutorialSlice } from './state';

export class TutorialService {
  private listeners = new Set<() => void>();

  constructor(
    private readonly ctx: GameContext,
    readonly slice: TutorialSlice,
  ) {}

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed(): void {
    this.listeners.forEach((fn) => fn());
  }

  get guideDone(): boolean {
    return this.slice.step >= GUIDE.length;
  }

  /** The tip to show right now, if any. */
  current(): TipDef | null {
    if (this.slice.step >= 0 && !this.guideDone) return GUIDE[this.slice.step]!;
    const next = this.slice.queue.find((id) => TIPS[id] && this.hasAnchor(TIPS[id]!));
    return next ? TIPS[next]! : null;
  }

  private hasAnchor(t: TipDef): boolean {
    return t.anchor.kind !== 'menu' || this.ctx.features.menuEntries().some((m) => m.id === (t.anchor as { entry: string }).entry);
  }

  /** First load decides: a brand new save gets the guide, an older one skips it. */
  decide(fresh: boolean): void {
    if (this.slice.step !== -1) return;
    this.slice.step = fresh ? 0 : GUIDE.length;
    this.changed();
  }

  private advance(fromId: string): void {
    if (this.guideDone || GUIDE[this.slice.step]?.id !== fromId) return;
    this.slice.step += 1;
    this.changed();
  }

  queue(id: string): void {
    if (this.slice.seen.includes(id) || this.slice.queue.includes(id)) return;
    this.slice.queue.push(id);
    this.changed();
  }

  private finish(id: string): void {
    const i = this.slice.queue.indexOf(id);
    if (i >= 0) this.slice.queue.splice(i, 1);
    if (!this.slice.seen.includes(id)) this.slice.seen.push(id);
    this.changed();
  }

  /** The player tapped the bubble. */
  dismiss(): void {
    const tip = this.current();
    if (!tip?.dismissable) return;
    if (!this.guideDone) {
      // Skipping the buy step still moves the guide along.
      this.advance(tip.id);
      return;
    }
    this.finish(tip.id);
  }

  /** A timed tip ran out. */
  expire(id: string): void {
    if (GUIDE[this.slice.step]?.id === id) this.advance(id);
    else this.finish(id);
  }

  onCast(): void {
    this.advance('cast');
  }

  onReel(): void {
    this.advance('wait');
  }

  onHandCatch(): void {
    this.slice.handCatches += 1;
    if (this.guideDone && this.slice.handCatches >= DAILY_TIP_AFTER) this.queue('daily');
  }

  onPurchase(): void {
    this.advance('shop');
  }

  onPanelOpened(sceneKey: string): void {
    const tip = this.current();
    if (tip?.opens === sceneKey) this.finish(tip.id);
    // Following any one-time tip's suggestion also counts, even before it showed.
    for (const id of [...this.slice.queue]) if (TIPS[id]?.opens === sceneKey) this.finish(id);
  }

  replay(): void {
    this.slice.step = 0;
    this.slice.seen = [];
    this.slice.queue = [];
    this.slice.handCatches = 0;
    this.changed();
  }
}

let active: TutorialService | null = null;
export function setTutorial(s: TutorialService): void {
  active = s;
}
export function getTutorial(): TutorialService {
  if (!active) throw new Error('tutorial feature is not initialised');
  return active;
}
