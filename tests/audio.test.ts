import { describe, expect, it } from 'vitest';
import { SOUNDS } from '../src/config/audio';
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
    for (const key of ['ambient', 'cast', 'bite', 'reel', 'catch', 'ui_click', 'coin', 'purchase', 'unlock']) {
      expect(SOUNDS[key], key).toBeDefined();
    }
  });
});
