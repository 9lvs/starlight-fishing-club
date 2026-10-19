// Runs water moments: waits a few minutes, starts one that suits the water,
// applies its stat changes while it lasts, then waits again. Nothing is saved:
// a moment is a small surprise, not something to keep track of.
import { MOMENTS } from '../../config/tuning';
import type { GameContext } from '../../core/context';
import { pickMoment, type MomentDef } from './state';

const SOURCE = 'moment';
const between = (r: readonly number[], rng: () => number) => r[0]! + rng() * (r[1]! - r[0]!);

export class MomentsService {
  active: { def: MomentDef; left: number } | null = null;
  private next = MOMENTS.firstMs;

  constructor(private readonly ctx: GameContext) {}

  defs(): MomentDef[] {
    return (this.ctx.content.extra.moments ?? []) as MomentDef[];
  }

  tick(dtMs: number): void {
    if (this.active) {
      this.active.left -= dtMs;
      if (this.active.left <= 0) this.end();
      return;
    }
    this.next -= dtMs;
    if (this.next > 0) return;
    this.next = between(MOMENTS.everyMs, this.ctx.rng);
    const def = pickMoment(this.defs(), this.ctx.world.conditions(), this.ctx.rng);
    if (def) this.start(def);
  }

  start(def: MomentDef): void {
    this.end();
    this.active = { def, left: def.durationMs };
    this.ctx.stats.setSource(SOURCE, def.modifiers);
    this.ctx.ui.toast(def.text, { icon: 'icon_star', color: 'sky' });
    this.ctx.bus.emit('audio:play', { key: 'moment' });
    this.ctx.bus.emit('momentStarted', { id: def.id, visual: def.visual, durationMs: def.durationMs });
  }

  /** Ends the current moment (also when the boat leaves for another water). */
  end(): void {
    if (!this.active) return;
    const id = this.active.def.id;
    this.active = null;
    this.ctx.stats.removeSource(SOURCE);
    this.ctx.bus.emit('momentEnded', { id });
  }
}

let current: MomentsService | null = null;
export function setMoments(s: MomentsService): void {
  current = s;
}
export function getMoments(): MomentsService {
  if (!current) throw new Error('Moments feature not initialised');
  return current;
}
