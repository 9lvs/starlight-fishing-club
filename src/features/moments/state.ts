// Water moments as data, and the pure rule for which one happens next.
import { z } from 'zod';
import { modifierSchema } from '../../core/content/schemas';
import type { Rng } from '../../core/rng';
import { weightedPick } from '../../core/rng';
import type { Conditions } from '../../systems/lootTable';

/** Moments live in content: src/content/<pack>/moments.json. */
export const momentSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(24),
  /** Said softly when it begins. */
  text: z.string().min(1).max(100),
  durationMs: z.number().int().positive(),
  /** Empty lists mean any time, weather, or water. */
  phases: z.array(z.string()).default([]),
  weather: z.array(z.string()).default([]),
  waters: z.array(z.string()).default([]),
  weight: z.number().positive().default(1),
  /** How the layer scene draws it. */
  visual: z.enum(['minnows', 'moon', 'golden', 'lanterns', 'none']).default('none'),
  /** Stat changes while it lasts (a temporary source). */
  modifiers: z.array(modifierSchema).min(1),
});
export type MomentDef = z.infer<typeof momentSchema>;

export function fits(m: MomentDef, c: Conditions): boolean {
  return (
    (m.phases.length === 0 || m.phases.includes(c.phase)) &&
    (m.weather.length === 0 || m.weather.includes(c.weather)) &&
    (m.waters.length === 0 || m.waters.includes(c.waterId))
  );
}

/** A moment that suits the water right now, or null. */
export function pickMoment(defs: readonly MomentDef[], c: Conditions, rng: Rng): MomentDef | null {
  return weightedPick(
    defs.filter((m) => fits(m, c)).map((m) => ({ item: m, weight: m.weight })),
    rng,
  ) ?? null;
}
