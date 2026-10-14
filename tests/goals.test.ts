// Upgrade guidance: what each upgrade helps (from its stats), and the next goal
// on the journey, walked back to the first thing you can buy now.
import { describe, expect, it } from 'vitest';
import { focusesOf } from '../src/config/focus';
import { nextGoal, type GoalWorld } from '../src/features/upgrades/goals';
import { loadBaseContent } from './helpers/content';

const { content } = loadBaseContent();
const byId = (id: string) => content.upgrades.find((u) => u.id === id)!;

function world(levels: Record<string, number>, over: Partial<GoalWorld> = {}): GoalWorld {
  return {
    clubRank: 0,
    nextWater: 'river',
    waterName: (id) => content.waters.find((w) => w.id === id)?.name ?? id,
    canMove: false,
    upgrades: [...content.upgrades].sort((a, b) => a.requiresRank - b.requiresRank),
    level: (id) => levels[id] ?? 0,
    cost: (u) => u.baseCost,
    ...over,
  };
}

describe('upgrade focus tags', () => {
  it('come from the stats an upgrade changes', () => {
    expect(focusesOf(byId('rod_1')).map((f) => f.id)).toEqual(['rare']);
    expect(focusesOf(byId('boat_1')).map((f) => f.id)).toEqual(['speed', 'rare', 'creel']);
    expect(focusesOf(byId('boat_3')).map((f) => f.id)).toContain('travel');
    expect(focusesOf(byId('hire_help')).map((f) => f.id)).toEqual(['crew']);
    expect(focusesOf(byId('paper_lanterns')).map((f) => f.id)).toEqual(['looks']);
  });

  it('every upgrade has at least one tag', () => {
    for (const u of content.upgrades) expect(focusesOf(u).length, u.id).toBeGreaterThan(0);
  });
});

describe('the next goal', () => {
  it('is not always a boat: the Sturdy Skiff needs the first rod, the Painted Rowboat a patched hull', () => {
    const g = nextGoal(world({}));
    expect(g.kind).toBe('buy');
    expect(g.kind === 'buy' && g.upgrade.id).toBe('rod_1');
    expect(g.text).toBe('Buy Willow Switch, on the way to Whisper River');
    const next = nextGoal(world({ rod_1: 1 }));
    expect(next.kind === 'buy' && next.upgrade.id).toBe('patched_hull');
    expect(nextGoal(world({ rod_1: 1, patched_hull: 1 })).kind === 'buy' && nextGoal(world({ rod_1: 1, patched_hull: 1 }))).toMatchObject({ upgrade: { id: 'boat_1' } });
  });

  it('then names the reach boat itself', () => {
    const g = nextGoal(world({ rod_1: 1, patched_hull: 1, boat_1: 1, boat_2: 1 }));
    expect(g.kind === 'buy' && g.upgrade.id).toBe('boat_3');
    expect(g.text).toBe('Buy Sturdy Skiff to reach Whisper River');
  });

  it('says to move once the boat can reach, and is done at the last water', () => {
    expect(nextGoal(world({}, { canMove: true })).kind).toBe('move');
    expect(nextGoal(world({}, { nextWater: null })).kind).toBe('done');
  });
});

describe('the goal deeper in the journey', () => {
  it('points at the boat that reaches the next water, walked back to what you can buy', () => {
    const boats = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [`boat_${n}`, 1]));
    const rods = Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`rod_${n}`, 1]));
    const bait = { bait_1: 1, bait_2: 1, bait_3: 1, bait_4: 1 };
    // The Glowshell Barge needs the seventh rod first...
    const g = nextGoal(world({ ...boats, ...rods, ...bait, patched_hull: 5 }, { clubRank: 3, nextWater: 'glowing_cave' }));
    expect(g.kind === 'buy' && g.upgrade.id).toBe('rod_7');
    // ...then it is the goal itself.
    const g2 = nextGoal(world({ ...boats, ...rods, rod_7: 1, ...bait, patched_hull: 5 }, { clubRank: 3, nextWater: 'glowing_cave' }));
    expect(g2.kind === 'buy' && g2.upgrade.id).toBe('boat_8');
    expect(g2.text).toBe('Buy Glowshell Barge to reach Glowing Cave');
  });
});
