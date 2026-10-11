// Feel and pacing of the hand-fishing loop. All values in ms unless noted.

export const FISHING = {
  castAnimMs: 650,
  waitMinMs: 2000,
  waitMaxMs: 6000,
  /** Extra forgiveness after the visible bite window closes. */
  biteGraceMs: 180,
  reelAnimMs: 900,
  missMessageMs: 1400,
  /** Taps faster than this after a state change are ignored (avoids double taps). */
  tapDebounceMs: 120,
  /** Bobber float distance from the boat, in internal pixels. */
  castDistance: 46,
  bobAmplitude: 1,
  biteDipPx: 2,
} as const;

export const SAVE = {
  storageKey: 'starlight-fishing-club/save',
  backupKeyPrefix: 'starlight-fishing-club/backup-',
  autosaveMs: 15000,
  exportPrefix: 'SFC1',
} as const;

export const OFFLINE = {
  /** Gaps shorter than this are handled by the live tick, not catch-up. */
  minCatchUpMs: 5000,
  /** Only show the "while you were away" summary after this long. */
  minSummaryMs: 60000,
  /** The live tick clamps dt to this; longer gaps go through catch-up. */
  maxTickMs: 1000,
} as const;

/** Daily Catch: one shared fish a day at the starting water, Wordle style. */
export const DAILY_CATCH = {
  /** Rarity tiers the daily fish is drawn from (1 uncommon, 2 rare): findable in a few minutes. */
  tiers: [1, 2],
  /** The daily fish sells for this many times its value (the extra is paid as a bonus). */
  valueMult: 3,
  /** Casts kept for the share grid. */
  gridMax: 40,
  gridRow: 10,
  /** Share grid squares by rarity tier; a miss and the daily fish have their own. */
  tierEmoji: ['⬜', '🟩', '🟦', '🟪', '🟨'],
  missEmoji: '⬛',
  targetEmoji: '🎣',
} as const;

export const UI_TIMING = {
  toastStackMax: 3,
  coinTickMs: 400,
} as const;
