// Pure viewport math. The canvas renders at the internal resolution and is
// upscaled by a whole number of DEVICE pixels, so every game pixel is crisp.

export interface ViewportInput {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  /** Smallest internal size worth keeping, per orientation. */
  minGame: {
    portrait: { width: number; height: number };
    landscape: { width: number; height: number };
  };
  maxZoom: number;
}

export interface Viewport {
  /** Internal game size in game pixels. */
  width: number;
  height: number;
  /** Device pixels per game pixel (always a whole number). */
  deviceZoom: number;
  /** CSS pixels per game pixel (deviceZoom / dpr). */
  cssZoom: number;
  cssWidth: number;
  cssHeight: number;
}

/**
 * Fill the whole screen. The zoom is the largest whole number of device pixels
 * per game pixel that still leaves the orientation's minimum room. The internal
 * size is rounded UP (to an even number), so the canvas covers the screen and
 * overhangs it by under two game pixels, split across both edges, instead of
 * leaving bars.
 */
export function computeViewport(v: ViewportInput): Viewport {
  const devW = Math.max(1, Math.floor(v.cssWidth * v.dpr));
  const devH = Math.max(1, Math.floor(v.cssHeight * v.dpr));
  const min = devH >= devW ? v.minGame.portrait : v.minGame.landscape;
  const fit = Math.min(Math.floor(devW / min.width), Math.floor(devH / min.height));
  const deviceZoom = Math.max(1, Math.min(v.maxZoom, fit));
  // Even sizes: Phaser's pixel rounding leaves a 1 px gap at the edge when the
  // camera center lands on a half pixel.
  const even = (n: number) => Math.ceil(n / 2) * 2;
  const width = even(devW / deviceZoom);
  const height = even(devH / deviceZoom);
  const cssZoom = deviceZoom / v.dpr;
  return { width, height, deviceZoom, cssZoom, cssWidth: width * cssZoom, cssHeight: height * cssZoom };
}

export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Convert CSS safe-area insets to whole game pixels (rounded up so nothing hides under a notch). */
export function insetsToGame(css: SafeInsets, vp: Viewport): SafeInsets {
  const conv = (n: number) => Math.ceil(n / vp.cssZoom);
  return { top: conv(css.top), right: conv(css.right), bottom: conv(css.bottom), left: conv(css.left) };
}
