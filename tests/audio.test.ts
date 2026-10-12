import { describe, expect, it } from 'vitest';
import { SOUNDS } from '../src/config/audio';
import { GAME_VERSION } from '../src/config/links';
import { bundleBonus } from '../src/systems/economy';
import { AudioManager } from '../src/systems/audioManager';
import { loadBaseContent } from './helpers/content';

describe('audio', () => {
  it('stays silent and safe before the first user gesture', () => {
    const a = new AudioManager();
    expect(a.unlocked).toBe(false);
    expect(() => a.play('cast')).not.toThrow();
    expect(() => a.setMuted(true)).not.toThrow();
    expect(() => a.setVolume(2)).not.toThrow();
  });

  it('every rarity sting named in content has a sound entry', () => {
    const { content } = loadBaseContent();
    for (const r of content.rarities) if (r.sting) expect(SOUNDS[r.sting], r.sting).toBeDefined();
  });

  it('every core sound key exists', () => {
    const keys = ['ambient', 'cast', 'plop', 'bite', 'miss', 'reel', 'catch', 'keep', 'coin', 'bundle', 'ui_click', 'ui_open', 'ui_close', 'ui_deny'];
    for (const key of [...keys, 'purchase', 'hire', 'unlock', 'club_move', 'daily', 'phase', 'tip']) {
      expect(SOUNDS[key], key).toBeDefined();
    }
  });
});

describe('creel bundle bonus', () => {
  it('pays nothing for one fish, grows per fish, and stops at the cap', () => {
    expect(bundleBonus(0, 0.05, 0.5)).toBe(0);
    expect(bundleBonus(1, 0.05, 0.5)).toBe(0);
    expect(bundleBonus(3, 0.05, 0.5)).toBeCloseTo(0.1);
    expect(bundleBonus(40, 0.05, 0.5)).toBe(0.5);
  });
});

describe('version', () => {
  it('matches package.json', () => {
    const pkg = import.meta.glob('../package.json', { eager: true, import: 'default' })['../package.json'] as { version: string };
    expect(pkg.version).toBe(GAME_VERSION);
  });
});
