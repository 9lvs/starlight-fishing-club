// The tutorial: a guide for new saves only, steps ending on the right events,
// one-time tips that never repeat, and a replay from Settings.
import { describe, expect, it } from 'vitest';
import { bootstrap } from '../src/core/bootstrap';
import { parseContent } from '../src/core/content/parseContent';
import { TutorialService } from '../src/features/tutorial/service';
import { GUIDE } from '../src/features/tutorial/tips';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

function boot() {
  const ctx = bootstrap({ features: [], loadContent: () => parseContent(readContentFiles()), storage: new MemoryStorage(), debug: false }).ctx!;
  return new TutorialService(ctx, { step: -1, seen: [], queue: [], handCatches: 0 });
}

describe('tutorial', () => {
  it('walks a new player through cast, bite, and the first upgrade', () => {
    const t = boot();
    t.decide(true);
    expect(t.current()?.id).toBe('cast');
    t.onReel();
    expect(t.current()?.id).toBe('cast');
    t.onCast();
    expect(t.current()?.id).toBe('wait');
    t.onReel();
    expect(t.current()?.id).toBe('shop');
    t.onPurchase();
    expect(t.current()?.id).toBe('done');
    t.expire('done');
    expect(t.guideDone).toBe(true);
    expect(t.current()).toBeNull();
  });

  it('skips the guide for a save that already existed', () => {
    const t = boot();
    t.decide(false);
    expect(t.slice.step).toBe(GUIDE.length);
    expect(t.current()).toBeNull();
  });

  it('shows each one-time tip once, and following it counts as seen', () => {
    const t = boot();
    t.decide(false);
    t.queue('creel');
    expect(t.current()?.id).toBe('creel');
    t.onPanelOpened('Creel');
    expect(t.current()).toBeNull();
    t.queue('creel');
    expect(t.current()).toBeNull();
  });

  it('hides a tip with a tap, and skips tips whose menu button is not there', () => {
    const t = boot();
    t.decide(false);
    // No features are registered here, so there is no Map button to point at.
    t.queue('move');
    expect(t.current()).toBeNull();
    t.queue('creel');
    expect(t.current()?.id).toBe('creel');
    t.dismiss();
    expect(t.slice.seen).toContain('creel');
    expect(t.current()).toBeNull();
  });

  it('can be replayed from the start', () => {
    const t = boot();
    t.decide(false);
    t.replay();
    expect(t.current()?.id).toBe('cast');
  });
});
