// Maps bus events to sounds. Features never call audio directly; they emit
// events, or 'audio:play' for anything custom.
import type { AudioManager } from '../systems/audioManager';
import type { GameContext } from './context';

export function wireAudio(ctx: GameContext, audio: AudioManager): void {
  const bus = ctx.bus;
  bus.on('cast', () => audio.play('cast'));
  bus.on('bite', () => audio.play('bite'));
  bus.on('reel', () => audio.play('reel'));
  bus.on('catchLanded', ({ catch: c, source }) => {
    if (source !== 'hand') return;
    audio.play('catch');
    const sting = ctx.registries.rarities.tryGet(c.rarityId)?.sting;
    if (sting) audio.play(sting);
  });
  bus.on('fishSold', ({ source }) => {
    if (source !== 'crew') audio.play('coin');
  });
  bus.on('upgradePurchased', () => audio.play('purchase'));
  bus.on('crewHired', () => audio.play('purchase'));
  bus.on('waterUnlocked', () => audio.play('unlock'));
  bus.on('ui:click', () => audio.play('ui_click'));
  bus.on('audio:play', ({ key, volume }) => audio.play(key, volume));
  bus.on('settingsChanged', ({ key, value }) => {
    if (key === 'muted') audio.setMuted(value === true);
    if (key === 'volume' && typeof value === 'number') audio.setVolume(value);
  });

  // Audio starts only after the first user gesture.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => audio.suspend(document.visibilityState === 'hidden'));
}
