// Every event on the bus and its payload. Features add their own events with
// declaration merging:
//
//   declare module '../../core/events' {
//     interface GameEvents { giftClaimed: { day: number } }
//   }
import type { CatchResult, OfflineReport, ToastRequest } from './types';

export interface GameEvents {
  // Fishing loop
  cast: { waterId: string };
  bite: { waterId: string; windowMs: number };
  biteMissed: { waterId: string };
  reel: { waterId: string };
  catchLanded: { catch: CatchResult; source: 'hand' | 'crew'; crewId?: string };
  fishSold: { fishId: string; value: number; currency: string; source: 'hand' | 'crew' | 'creel' };
  fishKept: { catch: CatchResult };
  /** Many catches at once (offline catch-up). One entry per fish type. */
  catchesBatched: { source: 'crew'; entries: { fishId: string; count: number; size: number }[]; at: number };

  // Economy and progression
  currencyChanged: { currency: string; amount: number; delta: number };
  upgradePurchased: { upgradeId: string; level: number };
  statsChanged: { stats: string[] };
  crewHired: { crewId: string; typeId: string };
  crewAssigned: { crewId: string; waterId: string };

  // World
  waterUnlocked: { waterId: string };
  waterChanged: { waterId: string; previous: string };
  timeOfDayChanged: { phase: string; previous: string };
  weatherChanged: { weather: string; previous: string };
  decorationsChanged: { ids: string[] };
  /** A look slot (rod, boat) changed; read it with world.look(slot). */
  lookChanged: { slot: string };
  /**
   * The club moved to a new water (the opt-in fresh start). Coins have already
   * reset; each feature resets its own progress when it hears this.
   */
  clubMoved: { waterId: string; rank: number; previousRank: number };

  // Lifecycle
  saveLoaded: { fresh: boolean };
  beforeSave: Record<string, never>;
  saved: { at: number };
  offlineCatchUpDone: { elapsedMs: number; appliedMs: number; reports: OfflineReport[] };
  viewportChanged: { width: number; height: number };
  settingsChanged: { key: string; value: unknown };

  // UI requests (the HUD and panel host listen for these)
  'ui:toast': ToastRequest;
  'ui:openPanel': { sceneKey: string; data?: unknown };
  'ui:panelClosed': { sceneKey: string };
  'ui:click': Record<string, never>;
  /** A tap on something that cannot be used yet (a disabled button). A soft sound, never a scold. */
  'ui:deny': Record<string, never>;
  /** Show the getting-started tips again (Settings). */
  'help:replay': Record<string, never>;
  'audio:play': { key: string; volume?: number };
}
