// Pure viewport math. The canvas renders at the internal resolution and is
// upscaled by a whole number of DEVICE pixels, so every game pixel is crisp.

export interface ViewportInput {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  baseWidth: number;
  baseHeight: number;
  /** Grow the internal size on the free axis to fill the screen. */
  fill: boolean;
  maxExtendRatio: number;
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

export function computeViewport(v: ViewportInput): Viewport {
  const devW = Math.max(1, Math.floor(v.cssWidth * v.dpr));
  const devH = Math.max(1, Math.floor(v.cssHeight * v.dpr));
  const fit = Math.min(Math.floor(devW / v.baseWidth), Math.floor(devH / v.baseHeight));
  const deviceZoom = Math.max(1, Math.min(v.maxZoom, fit));
  let width = v.baseWidth;
  let height = v.baseHeight;
  if (v.fill) {
    width = Math.min(Math.floor(devW / deviceZoom), Math.floor(v.baseWidth * v.maxExtendRatio));
    height = Math.min(Math.floor(devH / deviceZoom), Math.floor(v.baseHeight * v.maxExtendRatio));
    width = Math.max(v.baseWidth, width);
    height = Math.max(v.baseHeight, height);
  }
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
