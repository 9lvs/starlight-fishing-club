// The real-time clock is compressed into a short day so players see every phase.

export const TIME = {
  dayCycleMs: 10 * 60 * 1000,
  /** Phases in order, with their share of the cycle. Shares must sum to 1. */
  phases: [
    { id: 'day', share: 0.4, name: 'Day', icon: 'icon_sun' },
    { id: 'dusk', share: 0.15, name: 'Dusk', icon: 'icon_dusk' },
    { id: 'night', share: 0.3, name: 'Night', icon: 'icon_moon' },
    { id: 'dawn', share: 0.15, name: 'Dawn', icon: 'icon_dawn' },
  ],
  /** Shifts the cycle so a fresh session does not always start at the same phase. */
  cycleOffsetMs: 0,
  /** Visual dissolve between phase palettes. */
  transitionMs: 8000,
  transitionSteps: 16,
} as const;

export const WEATHER = {
  /** Weather is rolled once per period from a deterministic hash of the period index. */
  periodMs: 3 * 60 * 1000,
  seed: 7331,
} as const;

export type PhaseId = (typeof TIME.phases)[number]['id'];
export const PHASE_IDS = TIME.phases.map((p) => p.id) as string[];
