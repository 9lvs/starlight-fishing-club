import { describe, expect, it } from 'vitest';
import { loadBaseContent } from './helpers/content';
import { median, simulatePacing } from './helpers/pacingSim';

describe('pacing targets (goal-directed player model, median of 25 runs)', () => {
  const { content } = loadBaseContent();
  const runs = Array.from({ length: 25 }, (_, i) => simulatePacing(content, 1000 + i));
  const first = median(runs.map((r) => r.firstUpgradeMin));
  const water = median(runs.map((r) => r.firstWaterMin));
  const crew = median(runs.map((r) => r.firstCrewMin));
  console.log(`[pacing] first upgrade ${first.toFixed(2)} min, first new water ${water.toFixed(1)} min, first crew ${crew.toFixed(1)} min`);

  it('first upgrade in about 1 minute', () => {
    expect(first).toBeGreaterThan(0.4);
    expect(first).toBeLessThan(1.5);
  });

  it('first new water in about 20 minutes', () => {
    expect(water).toBeGreaterThan(15);
    expect(water).toBeLessThan(25);
  });

  it('first crew hire in about 30 minutes', () => {
    expect(crew).toBeGreaterThan(25);
    expect(crew).toBeLessThan(36);
  });
});
