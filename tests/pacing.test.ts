import { describe, expect, it } from 'vitest';
import { loadBaseContent } from './helpers/content';
import { median, simulateJourney } from './helpers/journeySim';

describe('journey pacing (goal-directed player model, median of 15 runs)', () => {
  const { content } = loadBaseContent();
  const sims = Array.from({ length: 15 }, (_, i) => simulateJourney(content, 1000 + i));
  const runMin = (i: number) => median(sims.map((s) => s.runs[i]?.minutes ?? Infinity));
  const boat3 = (i: number) => median(sims.map((s) => s.runs[i]?.boat3Min ?? Infinity));
  const first = median(sims.map((s) => s.firstUpgradeMin));
  const crew = median(sims.map((s) => s.firstCrewMin));
  const finale = median(sims.map((s) => s.finaleMin));
  const total = median(sims.map((s) => s.totalMin));
  console.log(
    `[pacing] first upgrade ${first.toFixed(2)} min, first crew ${crew.toFixed(1)} min, runs ${[0, 1, 2, 3]
      .map((i) => `${sims[0]!.runs[i]?.waterId} ${runMin(i).toFixed(0)}m`)
      .join(', ')}, Sky Lake finale ${finale.toFixed(0)}m, total ${(total / 60).toFixed(1)} h; Sturdy Skiff at ${[0, 1, 2, 3]
      .map((i) => boat3(i).toFixed(1))
      .join(' / ')} min`,
  );

  it('first upgrade in about a minute', () => {
    expect(first).toBeGreaterThan(0.3);
    expect(first).toBeLessThan(1.5);
  });

  it('first crew helper inside the first run', () => {
    expect(crew).toBeLessThan(runMin(0));
  });

  it('the first move to Whisper River comes in about 20 minutes', () => {
    expect(runMin(0)).toBeGreaterThan(15);
    expect(runMin(0)).toBeLessThan(28);
  });

  it('each later water takes a little longer, never a slog', () => {
    for (let i = 1; i < 4; i++) {
      expect(runMin(i)).toBeGreaterThan(runMin(i - 1) * 0.9);
      expect(runMin(i)).toBeLessThan(80);
    }
  });

  it('the club bonus makes starting over quick: the first boats come back about twice as fast', () => {
    // Not exactly half: after a move, rarer fish need tackle you have not rebought yet.
    for (let i = 1; i < 4; i++) expect(boat3(i)).toBeLessThan(boat3(0) * 0.55);
  });

  it('Sky Lake has a finale of top gear to work toward, and the whole journey is a few hours', () => {
    expect(finale).toBeGreaterThan(30);
    expect(finale).toBeLessThan(150);
    expect(total / 60).toBeLessThan(6);
  });
});
