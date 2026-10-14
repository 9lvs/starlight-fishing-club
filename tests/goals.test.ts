// Upgrade guidance: what each upgrade helps (from its stats), and the next goal
// on the journey, walked back to the first thing you can buy now.
import { describe, expect, it } from 'vitest';
import { focusesOf } from '../src/features/upgrades/focus';
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
  it('starts with the first boat on the way to Whisper River', () => {
    const g = nextGoal(world({}));
    expect(g.kind).toBe('buy');
    expect(g.kind === 'buy' && g.upgrade.id).toBe('boat_1');
    expect(g.kind === 'buy' && g.stepsLeft).toBe(3);
  });

  it('then names the reach boat itself', () => {
    const g = nextGoal(world({ boat_1: 1, boat_2: 1 }));
    expect(g.kind === 'buy' && g.upgrade.id).toBe('boat_3');
    expect(g.text).toBe('Buy Sturdy Skiff to reach Whisper River');
  });

  it('says to move once the boat can reach, and is done at the last water', () => {
    expect(nextGoal(world({}, { canMove: true })).kind).toBe('move');
    expect(nextGoal(world({}, { nextWater: null })).kind).toBe('done');
  });
});
