// Rare fish fight back: the session's dips and hold, and through the real
// controller, the slip chance, the clean landing bonus, and Easy reel.
import { afterEach, describe, expect, it } from 'vitest';
import { FIGHT, FISHING } from '../src/config/tuning';
import { bootstrap } from '../src/core/bootstrap';
import { parseContent } from '../src/core/content/parseContent';
import { debugOverrides } from '../src/core/debugOverrides';
import { seededRng } from '../src/core/rng';
import { FishingController } from '../src/features/fishing/controller';
import { FishingSession, type SessionEvent } from '../src/features/fishing/fishingSession';
import { fishingSlice } from '../src/features/fishing/state';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

const stats = { waitMinMs: () => 1000, waitMaxMs: () => 1000, castSpeed: () => 1, biteWindowMs: () => 1200 };

/** A session already hooked and fighting, with its events. */
function fighting(dips: number, hold: boolean) {
  const events: SessionEvent[] = [];
  const s = new FishingSession(FISHING, stats, seededRng(3), (e) => events.push(e), FIGHT);
  s.tap();
  s.update(FISHING.castAnimMs);
  s.update(1000);
  expect(s.phase).toBe('bite');
  s.tap();
  s.startFight(dips, hold);
  expect(s.phase).toBe('fight');
  return { s, events };
}

/** Wait (in small steps) until the next dip opens. */
function toDip(s: FishingSession): void {
  for (let i = 0; i < 200 && s.fight?.stage !== 'dip'; i++) s.update(20);
  expect(s.fight?.stage).toBe('dip');
}

const done = (events: SessionEvent[]) => events.find((e) => e.type === 'fightDone') as Extract<SessionEvent, { type: 'fightDone' }> | undefined;

describe('the fight', () => {
  it('tapping every dip wins it cleanly, then the fish reels in', () => {
    const { s, events } = fighting(3, false);
    for (let i = 0; i < 3; i++) {
      toDip(s);
      s.tap();
    }
    expect(done(events)).toMatchObject({ hits: 3, dips: 3, held: false });
    expect(s.phase).toBe('reeling');
  });

  it('a dip left alone, or a tap before the dip, counts as missed but the fight goes on', () => {
    const { s, events } = fighting(2, false);
    s.update(FIGHT.graceMs + 10);
    s.tap(); // Too soon.
    expect(events.some((e) => e.type === 'dipMiss' && e.fumble)).toBe(true);
    toDip(s);
    s.update(FIGHT.dipMs + 10); // Let it pass.
    expect(done(events)).toMatchObject({ hits: 0, dips: 2 });
  });

  it('a double tap right after the hook is not a fumble', () => {
    const { s, events } = fighting(2, false);
    s.tap();
    expect(events.some((e) => e.type === 'dipMiss')).toBe(false);
  });

  it('a legendary ends with a hold: letting go pauses it, and it ends on its own if never finished', () => {
    const { s, events } = fighting(0, true);
    expect(s.fight?.stage).toBe('hold');
    s.tap();
    s.update(FIGHT.holdMs / 2);
    s.release();
    s.update(1000);
    expect(done(events)).toBeUndefined();
    s.tap();
    s.update(FIGHT.holdMs / 2 + 20);
    expect(done(events)).toMatchObject({ held: true });

    const quit = fighting(0, true);
    quit.s.update(FIGHT.holdMaxMs + 20);
    expect(done(quit.events)).toMatchObject({ held: false });
  });
});

function boot() {
  const ctx = bootstrap({ features: [], loadContent: () => parseContent(readContentFiles()), storage: new MemoryStorage(), debug: false }).ctx!;
  // High rolls: even a small slip chance never fires, so the tests are steady.
  ctx.rng = () => 0.99;
  const ctl = new FishingController(ctx, fishingSlice.defaults());
  return { ctx, ctl };
}

/** Cast, hook a fish, then win or lose its fight. */
function catchWithFight(ctl: FishingController, tapDips: boolean): void {
  ctl.update(500);
  ctl.tap();
  ctl.update(1000);
  ctl.update(60000);
  ctl.tap();
  for (let i = 0; i < 400 && ctl.session.phase === 'fight'; i++) {
    const f = ctl.session.fight!;
    if (tapDips && (f.stage === 'dip' || (f.stage === 'hold' && !f.holding))) ctl.tap();
    ctl.update(20);
  }
  ctl.update(2000);
}

afterEach(() => {
  debugOverrides.forceRarity = null;
});

describe('fighting rare fish in the game', () => {
  it('only rare fish and up fight; legendaries also need a hold; Easy reel turns it off', () => {
    const { ctl } = boot();
    expect(ctl.fightFor(0)).toBeNull();
    expect(ctl.fightFor(1)).toBeNull();
    expect(ctl.fightFor(2)).toEqual({ dips: 2, hold: false });
    expect(ctl.fightFor(3)).toEqual({ dips: 3, hold: false });
    expect(ctl.fightFor(4)).toEqual({ dips: 3, hold: true });
    ctl.easyReel = true;
    expect(ctl.fightFor(4)).toBeNull();
  });

  it('a clean fight lands the fish with a bonus and marks it', () => {
    const { ctx, ctl } = boot();
    debugOverrides.forceRarity = 'legendary';
    ctx.stats.setSource('test', [{ stat: 'tackle', op: 'add', value: 99 }]);
    const clean: number[] = [];
    ctx.bus.on('cleanLanding', (e) => clean.push(e.coins));
    catchWithFight(ctl, true);
    expect(ctl.pending?.rarityId).toBe('legendary');
    expect(clean).toHaveLength(1);
    expect(clean[0]).toBe(Math.round(ctl.pending!.value * FIGHT.cleanBonus));
  });

  it('a poor fight pays no bonus, and Easy reel lands it with one tap', () => {
    const { ctx, ctl } = boot();
    debugOverrides.forceRarity = 'epic';
    ctx.stats.setSource('test', [{ stat: 'tackle', op: 'add', value: 99 }]);
    const clean: number[] = [];
    ctx.bus.on('cleanLanding', (e) => clean.push(e.coins));
    catchWithFight(ctl, false);
    expect(clean).toHaveLength(0);
    ctl.sellPending();
    ctl.easyReel = true;
    catchWithFight(ctl, false);
    expect(ctl.pending?.rarityId).toBe('epic');
    expect(clean).toHaveLength(0);
  });
});
