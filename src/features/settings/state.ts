// Settings save slice and helpers.
import { AUDIO } from '../../config/audio';
import type { SaveSliceDef } from '../../core/feature';
import type { GameContext } from '../../core/context';

export type MotionPref = 'system' | 'on' | 'off';

export interface SettingsSlice {
  muted: boolean;
  /** Effects: sounds, water, and rain. */
  volume: number;
  musicVolume: number;
  reducedMotion: MotionPref;
  /** Rare fish land with one tap instead of a short fight. */
  easyReel?: boolean;
}

export const settingsSlice: SaveSliceDef<SettingsSlice> = {
  key: 'settings',
  version: 2,
  defaults: () => ({ muted: false, volume: AUDIO.masterDefault, musicVolume: AUDIO.musicDefault, reducedMotion: 'system' }),
  // v2 adds music, on at the default level.
  migrate: (old) => ({ musicVolume: AUDIO.musicDefault, ...(old as object) }) as SettingsSlice,
};

export const VOLUME_STEP = 0.1;

export function systemPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

/** Push every setting to whoever listens (audio, motion flag). */
export function applySettings(ctx: GameContext, s: SettingsSlice): void {
  ctx.flags.reducedMotion = s.reducedMotion === 'system' ? systemPrefersReducedMotion() : s.reducedMotion === 'on';
  ctx.bus.emit('settingsChanged', { key: 'muted', value: s.muted });
  ctx.bus.emit('settingsChanged', { key: 'volume', value: s.volume });
  ctx.bus.emit('settingsChanged', { key: 'musicVolume', value: s.musicVolume });
  ctx.bus.emit('settingsChanged', { key: 'reducedMotion', value: ctx.flags.reducedMotion });
  ctx.bus.emit('settingsChanged', { key: 'easyReel', value: s.easyReel === true });
}
