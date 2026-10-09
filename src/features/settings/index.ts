// Settings feature: sound, volume, reduced motion, and save management.
import type { GameFeature } from '../../core/feature';
import { SettingsScene } from './SettingsScene';
import { applySettings, settingsSlice, type SettingsSlice } from './state';

export const settingsFeature: GameFeature = {
  id: 'settings',
  saveSlice: settingsSlice,
  scenes: [{ key: 'Settings', scene: SettingsScene, kind: 'panel' }],
  menuEntries: [{ id: 'settings', label: 'Settings', icon: 'icon_settings', order: 90, sceneKey: 'Settings' }],
  init(ctx) {
    const s = ctx.save.slice<SettingsSlice>('settings');
    applySettings(ctx, s);
    // Re-broadcast once everything (audio included) is listening.
    ctx.bus.on('saveLoaded', () => applySettings(ctx, s));
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.key !== 'm' && e.key !== 'M') return;
        s.muted = !s.muted;
        applySettings(ctx, s);
        ctx.ui.toast(s.muted ? 'Sound off' : 'Sound on', { icon: s.muted ? 'icon_mute' : 'icon_sound' });
      });
    }
  },
};
