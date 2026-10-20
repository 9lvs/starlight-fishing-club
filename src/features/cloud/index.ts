// Cloud feature: optional sign in (Google or an email link) and a cloud copy
// of the save, opened from Settings > Account. Off when src/config/cloud.ts
// has no project URL; removing it from the registry leaves the game as it was.
import { cloudEnabled } from '../../config/cloud';
import type { GameFeature } from '../../core/feature';
import { AccountScene } from './AccountScene';
import { CloudService, getCloud, setCloud } from './service';
import type { CloudState } from './service';

declare module '../../core/events' {
  interface GameEvents {
    cloudChanged: { state: CloudState };
  }
}

export const cloudFeature: GameFeature = {
  id: 'cloud',
  scenes: [{ key: 'Account', scene: AccountScene, kind: 'panel' }],
  init(ctx) {
    setCloud(new CloudService(ctx));
  },
  start() {
    if (!cloudEnabled() || typeof window === 'undefined') {
      getCloud().state = 'offline';
      return;
    }
    const svc = getCloud();
    // Inside another site's frame (itch.io), Google refuses to show its sign-in page.
    if (window.top !== window.self) {
      svc.state = 'framed';
      return;
    }
    void svc.start();
    // A last copy when the tab is hidden (phones close tabs without warning).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void svc.sync();
    });
  },
  onTick(dt) {
    getCloud().tick(dt);
  },
};
