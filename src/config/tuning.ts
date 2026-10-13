// Feel and pacing of the hand-fishing loop. All values in ms unless noted.

/** The voyage between waters (scenes/VoyageScene.ts and WorldScene). */
export const VOYAGE = {
  sailOutMs: 900,
  coverMs: 450,
  chartMs: 1700,
  holdMs: 250,
  revealMs: 700,
  sailInMs: 1400,
  titleMs: 2400,
  /** Scenery scrolls this many times faster while the boat sails. */
  driftBoost: 14,
  /** A visit to a water you already have: no chart, about two seconds. */
  quick: { sailOutMs: 450, coverMs: 220, chartMs: 0, holdMs: 0, revealMs: 420, sailInMs: 800, titleMs: 1100 },
};

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
  /** Rarer fish glow softly in the water while you wait: rare (tier 2) and up. */
  glowMinTier: 2,
  glowAlpha: 0.7,
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

/** Landing a fish: slipping the hook, and the quick-catch bonus. */
export const CATCH = {
  escape: {
    perShortfall: 0.05,
    surplusRelief: 0.05,
    minFactor: 0.3,
    max: 0.88,
  },
  /** Reel in this soon after the bite for bonus coins (shares of the bite window). */
  quick: [
    { within: 0.35, bonus: 0.25, label: 'Perfect catch!' },
    { within: 0.65, bonus: 0.1, label: 'Quick catch!' },
  ],
} as const;

/** The creel: why keeping fish is worth it. */
export const CREEL = {
  /** Selling kept fish together pays this much extra per fish beyond the first. */
  bundlePerFish: 0.05,
  /** The bundle bonus never goes past this (+50%, reached at 11 fish). */
  bundleMax: 0.5,
  /** Show the "why keep?" line on the catch card for a player's first this-many catches. */
  hintCatches: 25,
} as const;

/** Daily Catch: one shared fish a day at the starting water, Wordle style. */
export const DAILY_CATCH = {
  /** Rarity tiers the daily fish is drawn from (1 uncommon, 2 rare): findable in a few minutes. */
  tiers: [1, 2],
  /** The daily fish sells for this many times its value (the extra is paid as a bonus). */
  valueMult: 3,
  /** The share shows your first this-many catches of the day: how lucky were your first pulls? */
  firstCount: 5,
  /** Share squares by rarity tier; today's fish gets the hook. */
  tierEmoji: ['⬜', '🟩', '🟦', '🟪', '🟨'],
  targetEmoji: '🎣',
  /** Luck score labels: the first whose minimum the score reaches (score is the sum of tier + 1). */
  luckLabels: [
    { min: 15, text: 'Legendary luck!' },
    { min: 11, text: 'A lucky day!' },
    { min: 8, text: 'Nice pulls.' },
    { min: 0, text: 'A calm start.' },
  ],
} as const;

export const UI_TIMING = {
  toastStackMax: 3,
  coinTickMs: 400,
} as const;
