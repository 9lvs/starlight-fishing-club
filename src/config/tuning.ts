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

/**
 * Rare fish fight back after the hook: the bobber dips and you tap each dip;
 * a legendary also needs a short hold at the end. A good fight lowers the
 * slip chance and a clean one pays a bonus. A poor fight never loses the
 * fish by itself, it only raises the slip chance a little.
 */
export const FIGHT = {
  /** Lowest rarity tier that fights (2 = rare). */
  minTier: 2,
  /** Dips by rarity tier: rare 2, epic 3, legendary 3. */
  dipsByTier: [0, 0, 2, 3, 3],
  /** Tiers that end with a hold (legendary). */
  holdMinTier: 4,
  dipMs: 900,
  gapMinMs: 600,
  gapMaxMs: 1100,
  /** Taps this soon after the hook or a dip are ignored, so a double tap is not a fumble. */
  graceMs: 280,
  holdMs: 1400,
  /** The hold ends on its own after this long (counted as not quite clean). */
  holdMaxMs: 7000,
  /** Slip chance multiplier: a clean fight halves it, a fight with every dip missed raises it. */
  escapeClean: 0.5,
  escapeMissed: 1.3,
  /** A clean fight pays this share of the fish's value. */
  cleanBonus: 0.25,
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
  /**
   * Kept fish are prepped for market (cleaned and iced) before they can sell.
   * Each takes this long, all at once, and the clock runs while you are away.
   * The choice: sell a catch now, or keep it and wait for the bundle and sets.
   */
  prepMs: 2 * 60_000,
  /** Matching sets when the creel sells together: 3, 5, or 10 of one rarity. Scaled by each rarity's setMult. */
  sets: [
    { size: 3, share: 0.12 },
    { size: 5, share: 0.25 },
    { size: 10, share: 0.6 },
  ],
};

/**
 * Rested bonus: time away fills a tin of fresh bait, and each of your next hand
 * catches pays its value again as a bonus. It only adds, it never blocks play.
 */
export const RESTED = {
  /** One charge for this much time away (counted up to the offline cap). */
  perChargeMs: 10 * 60_000,
  max: 15,
  /** Extra share of the fish's value per rested catch (1 = pays double). */
  bonus: 1,
};

/** Daily Logbook tasks: three small ones a day, paid in coins, with a small gem chance. */
export const DAILY_TASKS = {
  count: 3,
  /** Coins are this share of the average task reward at the club's water, times each task's share. */
  rewardBase: 0.6,
  /** Used when a water has no regular tasks to scale from. */
  fallbackCoins: 50,
  /** Chance a claimed daily task also brings up a gem. */
  gemChance: 0.1,
};

/**
 * Small touches of life. All of them stay soft and short, and reduced motion
 * turns the moving parts off.
 */
export const FX = {
  /**
   * A fish shadow glides up to the bobber just before the bite. Only a dark
   * shape: its size and shape are random, so it never gives the fish away.
   */
  shadow: { leadMs: 1800, startDx: 26, minLen: 5, maxLen: 11, alpha: 0.35 },
  /** Landing a legendary: the leap slows, the screen zooms in a little, a gold glow rims the edges, and sparkles burst. */
  legendary: { minTier: 4, slow: 2.2, arcPx: 40, zoom: 1.12, zoomInMs: 600, zoomOutMs: 700, sparkles: 14, burstPx: 22, trailEveryMs: 50 },
  /** Crew on deck: a hop for a rare catch, their own little lines, and dozing at night. */
  crew: { cheerMinTier: 2, hopPx: 3, hopMs: 150, staggerMs: 90, zEveryMs: 2600, zRisePx: 10, zLifeMs: 1800 },
  /**
   * Life around the boat, all rare and small: a fish jumps now and then, gulls
   * cross the sky and sometimes rest on the mast, the ship cat strolls the deck,
   * and on open sea a whale surfaces far out once in a while.
   */
  ambient: {
    jumpEveryMs: [16_000, 40_000],
    jumpMs: 650,
    gullEveryMs: [35_000, 80_000],
    gullSpeed: 0.018,
    gullLandChance: 0.45,
    gullRestMs: [8_000, 18_000],
    catSpeed: 0.006,
    catPauseMs: [3_000, 9_000],
    whaleEveryMs: [150_000, 320_000],
    whaleMs: 5200,
    whaleWaters: ['cove', 'reef', 'sky_lake'],
  },
  /** A lantern on every boat lights up at dusk, with a little flicker as it catches. */
  lantern: { fadeMs: 1600 },
  /** Rain leaves small rings where it meets the water. */
  rainRings: { lifeMs: 450, max: 40 },
  /** The fishing line sways gently while you wait (sag in pixels). */
  lineSway: { sag: 6, amp: 1.5, periodMs: 1100, windAmp: 1.5 },
  /** Confetti when a Logbook task is claimed. */
  confetti: { count: 16, lifeMs: 900, spread: 0.09, gravity: 0.00035 },
  /** The journal turns a page when you open a fish or go back. */
  pageTurnMs: 260,
  /** Coins fly from the boat to the coin counter when you sell. */
  coins: { min: 2, max: 6, flyMs: 650, staggerMs: 55, liftPx: 18 },
};

/** Gems: a rare find while fishing, spent on looks that stay when the club moves. */
export const GEMS = {
  currency: 'gems',
  /** Chance a catch brings up a gem: base plus this much per rarity tier, never above max (1% to 3%). */
  base: 0.01,
  perTier: 0.005,
  max: 0.03,
  /** Coins for one gem at Willow Pond. It rises with what fish pay at the club's water, so it stays a choice later on. */
  tradeCoins: 1000,
  /** The price is rounded to this, so it reads cleanly. */
  tradeRound: 50,
  /** Amounts offered in the exchange. */
  tradeSteps: [1, 5, 10],
};

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
