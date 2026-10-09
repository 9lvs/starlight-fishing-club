// Settings save slice and helpers.
import { AUDIO } from '../../config/audio';
import type { SaveSliceDef } from '../../core/feature';
import type { GameContext } from '../../core/context';

export type MotionPref = 'system' | 'on' | 'off';

export interface SettingsSlice {
  muted: boolean;
  volume: number;
  reducedMotion: MotionPref;
}

export const settingsSlice: SaveSliceDef<SettingsSlice> = {
  key: 'settings',
  version: 1,
  defaults: () => ({ muted: false, volume: AUDIO.masterDefault, reducedMotion: 'system' }),
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
  ctx.bus.emit('settingsChanged', { key: 'reducedMotion', value: ctx.flags.reducedMotion });
}
