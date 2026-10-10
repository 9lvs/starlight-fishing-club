import { describe, expect, it } from 'vitest';
import { bootstrap } from '../src/core/bootstrap';
import { parseContent } from '../src/core/content/parseContent';
import { DailyGiftService } from '../src/features/dailyGift/service';
import { canClaim, dayKey } from '../src/features/dailyGift/state';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

const giftPack = {
  '../../content/dailygift/pack.json': { id: 'dailygift', name: 'Daily Gift', requires: ['dailyGift'] },
  '../../content/dailygift/upgrades.json': [
    { id: 'club_mailbox', branch: 'club', name: 'Club Mailbox', description: 'Bigger gifts.', maxLevel: 4, baseCost: 300, modifiers: [{ stat: 'dailyGiftCoins', op: 'add', value: 40 }] },
  ],
};

describe('daily gift rules', () => {
  it('uses the local calendar day', () => {
    const noon = new Date(2026, 9, 10, 12, 0).getTime();
    expect(dayKey(noon)).toBe('2026-10-10');
    expect(canClaim({ lastClaimDay: null, totalClaims: 0 }, noon)).toBe(true);
    expect(canClaim({ lastClaimDay: '2026-10-10', totalClaims: 1 }, noon)).toBe(false);
    expect(canClaim({ lastClaimDay: '2026-10-09', totalClaims: 1 }, noon)).toBe(true);
  });

  it('claims once per day for the stat-driven amount and emits an event', () => {
    const ctx = bootstrap({ features: [], loadContent: () => parseContent(readContentFiles()), storage: new MemoryStorage(), debug: false }).ctx!;
    ctx.stats.define({ id: 'dailyGiftCoins', base: 60, min: 0, integer: true });
    const svc = new DailyGiftService(ctx, { lastClaimDay: null, totalClaims: 0 });
    const seen: number[] = [];
    ctx.bus.on('dailyGiftClaimed' as never, ((e: { coins: number }) => seen.push(e.coins)) as never);
    ctx.stats.setSource('upgrade:club_mailbox', [{ stat: 'dailyGiftCoins', op: 'add', value: 40 }]);
    expect(svc.claim()).toBe(true);
    expect(svc.claim()).toBe(false);
    expect(ctx.wallet.get('coins')).toBe(100);
    expect(seen).toEqual([100]);
  });
});

describe('feature-gated content packs', () => {
  it('skips the pack when its feature is not registered, so the game still boots', () => {
    const files = { ...readContentFiles(), ...giftPack };
    const without = parseContent(files, {}, ['fishing']);
    expect(without.errors).toEqual([]);
    expect(without.content.upgrades.some((u) => u.id === 'club_mailbox')).toBe(false);
    const withIt = parseContent(files, {}, ['fishing', 'dailyGift']);
    expect(withIt.content.upgrades.some((u) => u.id === 'club_mailbox')).toBe(true);
  });
});
