// Display configuration. Switching to landscape is a one-line change here
// (baseWidth: 320, baseHeight: 180) plus layout tweaks in src/core/layout.ts.

export const DISPLAY = {
  baseWidth: 180,
  baseHeight: 320,
  /** 'auto' fills the screen on touch devices and letterboxes on desktop. */
  fillMode: 'auto' as 'auto' | 'always' | 'never',
  /** How far the canvas may grow past the base size on each axis when filling. */
  maxExtendRatio: 1.6,
  maxZoom: 16,
  /** Debounce for window resize handling. */
  resizeDebounceMs: 150,
  /** Letterbox color around the canvas (CSS). */
  letterboxColor: '#0b1026',
} as const;
