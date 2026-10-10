// Display configuration. The game always fills the whole screen: the canvas is
// scaled by a whole number of device pixels and the internal size grows on
// whichever axis has room. Positions come from src/core/layout.ts.

export const DISPLAY = {
  /** The design size. Layout and panels are built to look right at this size. */
  baseWidth: 180,
  baseHeight: 320,
  /**
   * Smallest internal size (game px) worth zooming down to, per orientation.
   * The largest whole zoom that keeps at least this much room is picked, so a
   * phone and a 4K monitor both show roughly the same amount of world.
   */
  minGame: {
    portrait: { width: 180, height: 320 },
    landscape: { width: 320, height: 240 },
  },
  maxZoom: 16,
  /** Debounce for window resize handling. */
  resizeDebounceMs: 150,
  /** Second look after a rotation, for browsers that settle late. */
  orientationSettleMs: 500,
  /** Page color behind the canvas (CSS); matches the menu bar. */
  letterboxColor: '#0b1026',
} as const;
