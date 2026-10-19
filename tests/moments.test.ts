// Water moments: only ones that suit the time and weather happen, their stat
// changes last exactly as long as the moment, and leaving the water ends them.
import { describe, expect, it } from 'vitest';
import { MOMENTS } from '../src/config/tuning';
import { bootstrap } from '../src/core/bootstrap';
import { parseContent } from '../src/core/content/parseContent';
import { MomentsService } from '../src/features/moments/service';
import { momentSchema, pickMoment } from '../src/features/moments/state';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';
import momentsJson from '../src/content/moments/moments.json';

const defs = (momentsJson as unknown[]).map((m) => momentSchema.parse(m));

describe('water moments', () => {
  it('pick only moments that suit the water right now', () => {
    const day = { waterId: 'pond', phase: 'day', weather: 'clear' };
    expect(pickMoment(defs, day, () => 0.5)).toBeNull();
    const night = new Set(Array.from({ length: 40 }, (_, i) => pickMoment(defs, { ...day, phase: 'night' }, () => i / 40)!.id));
    expect(night.has('bright_moon')).toBe(true);
    expect(night.has('golden_hour')).toBe(false);
  });

  it('change stats while they last, and end on their own or when ended', () => {
    const g = bootstrap({ features: [], loadContent: () => parseContent(readContentFiles()), storage: new MemoryStorage(), debug: false });
    const ctx = g.ctx!;
    (ctx.content.extra as Record<string, unknown>).moments = defs;
    // Dusk, so only golden hour fits (the real clock would make this vary).
    (ctx.world as unknown as { _phase: string })._phase = 'dusk';
    const svc = new MomentsService(ctx);
    const base = ctx.stats.get('sellValueMult');
    svc.tick(MOMENTS.firstMs + 1);
    expect(svc.active?.def.id).toBe('golden_hour');
    expect(ctx.stats.get('sellValueMult')).toBeCloseTo(base * 1.25);
    svc.tick(svc.active!.def.durationMs);
    expect(svc.active).toBeNull();
    expect(ctx.stats.get('sellValueMult')).toBe(base);
    svc.start(defs.find((m) => m.id === 'bright_moon')!);
    svc.end();
    expect(ctx.stats.get('luck')).toBe(0);
  });
});
