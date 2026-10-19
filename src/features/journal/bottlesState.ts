// Message bottles: the notes as data, what the journal saves about them, and
// the pure rules for when the line brings up a find and which note it holds.
// Found notes stay when the club moves.
import { z } from 'zod';
import type { Rng } from '../../core/rng';

export interface BottlesState {
  /** Note ids found so far, oldest first. */
  found: string[];
  /** Found but not opened yet (the dot on the Journal button). */
  unread: string[];
  /** Wall clock of the last find. */
  lastAt: number;
  /** Hand catches since the last find. */
  dry: number;
}

export const emptyBottles = (): BottlesState => ({ found: [], unread: [], lastAt: 0, dry: 0 });

/** Bottle notes live in content: src/content/<pack>/notes.json. */
export const noteSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  /** Who wrote it, signed at the bottom. */
  from: z.string().min(1).max(30),
  text: z.string().min(1).max(240),
  /** Found at this water first (omit for notes that wash up anywhere). */
  water: z.string().optional(),
  /** The secret fish this note hints at, if any. */
  hintFor: z.string().optional(),
});
export type NoteDef = z.infer<typeof noteSchema>;

export interface FindRules {
  chance: number;
  minGapMs: number;
  guaranteeAfter: number;
  bottleShare: number;
}

/** Does this catch bring up a find? Never twice in a short while; never a long dry spell. */
export function rollFind(s: Pick<BottlesState, 'lastAt' | 'dry'>, now: number, rng: Rng, r: FindRules): boolean {
  if (s.lastAt > 0 && now - s.lastAt < r.minGapMs) return false;
  if (s.dry >= r.guaranteeAfter) return true;
  return rng() < r.chance;
}

/**
 * The next note: one from this water first (hints for its secret fish lead),
 * then one that washes up anywhere, then any other unread one. Null when all
 * notes are found.
 */
export function pickNote(notes: readonly NoteDef[], found: readonly string[], waterId: string, rng: Rng): NoteDef | null {
  const left = notes.filter((n) => !found.includes(n.id));
  const here = left.filter((n) => n.water === waterId);
  const hints = here.filter((n) => n.hintFor);
  const anywhere = left.filter((n) => !n.water);
  const pool = hints.length ? hints : here.length ? here : anywhere.length ? anywhere : left;
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)]!;
}
