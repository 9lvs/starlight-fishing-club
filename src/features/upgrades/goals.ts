// The next goal: what to buy to reach the next water, one step at a time.
// The journey is the spine of the game, so the goal always points along it:
// the boat that reaches the next water, or the first thing it still needs.
import type { UpgradeDef } from '../../core/content/schemas';

export interface GoalWorld {
  clubRank: number;
  nextWater: string | null;
  waterName: (id: string) => string;
  canMove: boolean;
  upgrades: readonly UpgradeDef[];
  level: (id: string) => number;
  cost: (u: UpgradeDef) => number;
}

export type Goal =
  | { kind: 'move'; waterId: string; text: string; short: string }
  | { kind: 'buy'; upgrade: UpgradeDef; cost: number; text: string; short: string; stepsLeft: number }
  | { kind: 'done'; text: string; short: string };

/** Prerequisites as ids with the level needed. */
function prereqs(u: UpgradeDef): { id: string; level: number }[] {
  return u.prerequisites.map((p) => (typeof p === 'string' ? { id: p, level: 1 } : p));
}

export function nextGoal(w: GoalWorld): Goal {
  if (!w.nextWater) return { kind: 'done', text: 'You reached the last water! Finish your gear and fill the journal.', short: 'Fill the journal' };
  const water = w.waterName(w.nextWater);
  if (w.canMove) return { kind: 'move', waterId: w.nextWater, text: `Move the club to ${water} (Map)`, short: `Move to ${water}` };
  // The boat that reaches the next water from here: the last reach boat you can work toward.
  const reaches = w.upgrades.filter((u) => u.requiresRank <= w.clubRank && u.modifiers.some((m) => m.stat === 'boatRange') && w.level(u.id) < u.maxLevel);
  const reach = reaches.sort((a, b) => b.requiresRank - a.requiresRank || (b.position?.row ?? 0) - (a.position?.row ?? 0))[0];
  if (!reach) return { kind: 'done', text: `Keep fishing to reach ${water}.`, short: 'Keep fishing' };
  // Walk back through what it needs until we find something you can buy now.
  const byId = new Map(w.upgrades.map((u) => [u.id, u]));
  let step = reach;
  let stepsLeft = 1;
  for (let guard = 0; guard < 20; guard++) {
    const missing = prereqs(step).find((p) => w.level(p.id) < p.level);
    const next = missing ? byId.get(missing.id) : undefined;
    if (!next) break;
    step = next;
    stepsLeft += 1;
  }
  const text = step === reach ? `Buy ${step.name} to reach ${water}` : `Buy ${step.name}, on the way to ${water}`;
  return { kind: 'buy', upgrade: step, cost: w.cost(step), text, short: step.name, stepsLeft };
}
