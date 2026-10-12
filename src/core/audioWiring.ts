// Maps bus events to sounds. Features never call audio directly; they emit
// events, or 'audio:play' for anything custom. Every player action has a sound.
import type { AudioManager } from '../systems/audioManager';
import type { GameContext } from './context';

export function wireAudio(ctx: GameContext, audio: AudioManager): void {
  const bus = ctx.bus;
  // Fishing.
  bus.on('cast', () => audio.play('cast'));
  bus.on('bite', () => audio.play('bite'));
  bus.on('biteMissed', () => audio.play('miss'));
  bus.on('reel', () => audio.play('reel'));
  bus.on('catchLanded', ({ catch: c, source }) => {
    if (source !== 'hand') return;
    audio.play('catch');
    const sting = ctx.registries.rarities.tryGet(c.rarityId)?.sting;
    if (sting) audio.play(sting);
  });
  bus.on('fishKept', () => audio.play('keep'));
  bus.on('fishSold', ({ source }) => {
    if (source !== 'crew') audio.play('coin');
  });
  // Progress.
  bus.on('upgradePurchased', () => audio.play('purchase'));
  bus.on('crewHired', () => audio.play('hire'));
  bus.on('waterUnlocked', () => audio.play('unlock'));
  bus.on('clubMoved', () => audio.play('club_move'));
  // Menus.
  bus.on('ui:click', () => audio.play('ui_click'));
  bus.on('ui:deny', () => audio.play('ui_deny'));
  bus.on('ui:openPanel', () => audio.play('ui_open'));
  bus.on('ui:panelClosed', () => audio.play('ui_close'));
  bus.on('audio:play', ({ key, volume }) => audio.play(key, volume));
  // World: music follows the time of day, and rain falls on the water.
  const rainLevel = () => ctx.registries.weather.tryGet(ctx.world.weather)?.visuals.rain ?? 0;
  audio.setMood(ctx.world.phase);
  audio.setRain(rainLevel());
  bus.on('timeOfDayChanged', ({ phase }) => {
    audio.setMood(phase);
    audio.play('phase');
  });
  bus.on('weatherChanged', () => audio.setRain(rainLevel()));
  bus.on('settingsChanged', ({ key, value }) => {
    if (key === 'muted') audio.setMuted(value === true);
    if (key === 'volume' && typeof value === 'number') audio.setVolume(value);
    if (key === 'musicVolume' && typeof value === 'number') audio.setMusicVolume(value);
  });

  // Audio starts only after the first user gesture.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => audio.suspend(document.visibilityState === 'hidden'));
}
