import { describe, expect, it } from 'vitest';
import { FishingSession, type SessionEvent } from '../src/features/fishing/fishingSession';
import { seededRng } from '../src/core/rng';

const timing = { castAnimMs: 500, reelAnimMs: 800, missMessageMs: 1000, biteGraceMs: 150, tapDebounceMs: 100 };
const stats = { waitMinMs: () => 2000, waitMaxMs: () => 6000, castSpeed: () => 1, biteWindowMs: () => 1200 };

function make() {
  const events: SessionEvent['type'][] = [];
  const s = new FishingSession(timing, stats, seededRng(1), (e) => events.push(e.type));
  return { s, events };
}

function runUntil(s: FishingSession, phase: string, maxMs = 20000) {
  for (let t = 0; t < maxMs && s.phase !== phase; t += 16) s.update(16);
}

describe('FishingSession', () => {
  it('casts, waits 2-6s, bites, and lands when tapped in time', () => {
    const { s, events } = make();
    expect(s.tap()).toBe('cast');
    s.update(500);
    expect(s.phase).toBe('waiting');
    expect(s.duration).toBeGreaterThanOrEqual(2000);
    expect(s.duration).toBeLessThanOrEqual(6000);
    runUntil(s, 'bite');
    s.update(1000); // still inside the 1.2s window
    expect(s.tap()).toBe('hooked');
    s.update(800);
    expect(s.phase).toBe('landed');
    s.finishLanded();
    expect(s.phase).toBe('idle');
    expect(events).toEqual(['cast', 'bite', 'hooked', 'landed', 'idle']);
  });

  it('honours the grace period after the visible window', () => {
    const { s } = make();
    s.tap();
    runUntil(s, 'bite');
    s.update(1200 + 100);
    expect(s.phase).toBe('bite');
    expect(s.tap()).toBe('hooked');
  });

  it('a missed bite is not a penalty: it returns to idle and can cast right away', () => {
    const { s, events } = make();
    s.tap();
    runUntil(s, 'bite');
    s.update(1400);
    expect(s.phase).toBe('missed');
    s.update(200);
    expect(s.tap()).toBe('cast');
    expect(events).toContain('missed');
  });

  it('early taps do nothing harmful', () => {
    const { s } = make();
    s.tap();
    s.update(500);
    expect(s.tap()).toBe('none'); // debounced right after the phase change
    s.update(200);
    expect(s.tap()).toBe('early');
    expect(s.phase).toBe('waiting');
  });

  it('faster castSpeed shortens the wait', () => {
    const fast = new FishingSession(timing, { ...stats, castSpeed: () => 2 }, seededRng(1), () => {});
    fast.tap();
    fast.update(500);
    expect(fast.duration).toBeLessThanOrEqual(3000);
  });
});
