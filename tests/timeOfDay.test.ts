import { describe, expect, it } from 'vitest';
import { TIME, WEATHER } from '../src/config/time';
import { offsetToPhase, phaseAt, segmentsBetween, weatherAt } from '../src/systems/timeOfDay';

const weather = [
  { id: 'clear', weight: 6 },
  { id: 'rain', weight: 2 },
  { id: 'fog', weight: 2 },
];

describe('time of day', () => {
  it('walks through day, dusk, night, dawn in a 10 minute cycle', () => {
    const cycle = TIME.dayCycleMs;
    expect(cycle).toBe(600000);
    expect(phaseAt(0, TIME).id).toBe('day');
    expect(phaseAt(cycle * 0.45, TIME).id).toBe('dusk');
    expect(phaseAt(cycle * 0.7, TIME).id).toBe('night');
    expect(phaseAt(cycle * 0.95, TIME).id).toBe('dawn');
    expect(phaseAt(cycle * 1.01, TIME).id).toBe('day');
  });

  it('can shift the clock to the start of any phase', () => {
    const now = 123456789;
    for (const p of ['day', 'dusk', 'night', 'dawn']) {
      expect(phaseAt(now + offsetToPhase(now, p, TIME), TIME).id).toBe(p);
    }
  });

  it('weather is deterministic per period', () => {
    expect(weatherAt(1000, weather, WEATHER)).toBe(weatherAt(2000, weather, WEATHER));
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(weatherAt(i * WEATHER.periodMs, weather, WEATHER));
    expect(seen).toEqual(new Set(['clear', 'rain', 'fog']));
  });

  it('splits a span into segments that cover it exactly', () => {
    const start = 5000;
    const end = start + 3 * 3600 * 1000;
    const segs = segmentsBetween(start, end, TIME, weather, WEATHER);
    expect(segs[0]!.start).toBe(start);
    expect(segs[segs.length - 1]!.end).toBe(end);
    for (let i = 1; i < segs.length; i++) expect(segs[i]!.start).toBe(segs[i - 1]!.end);
    const total = segs.reduce((s, x) => s + (x.end - x.start), 0);
    expect(total).toBe(end - start);
  });
});
