// Finds: rolls a bottle or chest on a hand catch and shows it once the catch
// card closes, so it never covers the fish.
import { FINDS } from '../../config/tuning';
import type { GameContext } from '../../core/context';
import type { CatchResult } from '../../core/types';
import { pickNote, rollFind, type FindsSlice, type NoteDef } from './state';

export type Find = { kind: 'bottle'; noteId: string } | { kind: 'chest'; gems: number; coins: number; currency: string };

export class FindsService {
  /** Rolled with the catch, shown after its card closes. */
  private waiting: Find | null = null;

  constructor(
    private readonly ctx: GameContext,
    readonly slice: FindsSlice,
  ) {}

  notes(): NoteDef[] {
    return (this.ctx.content.extra.notes ?? []) as NoteDef[];
  }

  note(id: string): NoteDef | undefined {
    return this.notes().find((n) => n.id === id);
  }

  /** A hand catch landed: maybe something came up with it. The reward is saved now. */
  onCatch(c: CatchResult): Find | null {
    const s = this.slice;
    const now = this.ctx.clock.now();
    if (!rollFind(s, now, this.ctx.rng, FINDS)) {
      s.dry += 1;
      return null;
    }
    s.dry = 0;
    s.lastAt = now;
    const note = this.ctx.rng() < FINDS.bottleShare ? pickNote(this.notes(), s.found, c.waterId, this.ctx.rng) : null;
    let find: Find;
    if (note) {
      s.found.push(note.id);
      s.unread.push(note.id);
      find = { kind: 'bottle', noteId: note.id };
    } else {
      const gem = this.ctx.registries.currencies.tryGet('gems') && this.ctx.rng() < FINDS.chestGemChance;
      const coins = gem ? 0 : Math.max(1, Math.round(c.value * FINDS.chestCoinsMult));
      find = { kind: 'chest', gems: gem ? 1 : 0, coins, currency: c.currency };
      if (gem) this.ctx.wallet.add('gems', 1);
      else this.ctx.wallet.add(c.currency, coins);
    }
    this.waiting = find;
    this.ctx.bus.emit('findFound', { kind: find.kind });
    return find;
  }

  /** The catch card closed: show what came up. */
  reveal(): void {
    const f = this.waiting;
    this.waiting = null;
    if (!f) return;
    this.ctx.bus.emit('audio:play', { key: 'find' });
    if (f.kind === 'bottle') {
      this.ctx.ui.openPanel('Bottles', { noteId: f.noteId, found: true });
      return;
    }
    const what = f.gems > 0 ? `a gem` : `${f.coins} coins`;
    this.ctx.ui.toast(`An old chest came up with the line: ${what}!`, { icon: 'icon_chest', color: f.gems > 0 ? 'lavender' : 'gold' });
  }

  markRead(id: string): void {
    this.slice.unread = this.slice.unread.filter((n) => n !== id);
  }
}

let current: FindsService | null = null;
export function setFinds(s: FindsService): void {
  current = s;
}
export function getFinds(): FindsService {
  if (!current) throw new Error('Finds feature not initialised');
  return current;
}
