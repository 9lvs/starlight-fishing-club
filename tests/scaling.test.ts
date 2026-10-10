import { describe, expect, it } from 'vitest';
import { computeViewport, insetsToGame } from '../src/core/scaling';

const base = {
  minGame: { portrait: { width: 180, height: 320 }, landscape: { width: 320, height: 240 } },
  maxZoom: 16,
};

describe('computeViewport', () => {
  it('fills a phone screen in portrait with the same zoom as before', () => {
    const vp = computeViewport({ ...base, cssWidth: 390, cssHeight: 844, dpr: 3 });
    expect(vp.deviceZoom).toBe(6);
    expect(vp.width).toBe(196);
    expect(vp.height).toBe(422);
  });

  it('fills a desktop window in landscape instead of letterboxing', () => {
    const vp = computeViewport({ ...base, cssWidth: 1440, cssHeight: 900, dpr: 1 });
    expect(vp.deviceZoom).toBe(3);
    expect(vp.width).toBe(480);
    expect(vp.height).toBe(300);
  });

  it('keeps a whole-number device zoom on high-DPI screens', () => {
    const vp = computeViewport({ ...base, cssWidth: 1440, cssHeight: 900, dpr: 2 });
    expect(vp.deviceZoom).toBe(7);
    expect(vp.cssZoom * 2).toBe(7);
  });

  it('covers the whole screen with under two game pixels of overhang', () => {
    const screens: [number, number, number][] = [
      [390, 844, 3], [844, 390, 3], [820, 1180, 2], [1180, 820, 2], [1440, 900, 1], [1366, 768, 1], [400, 300, 1], [1920, 1080, 1.25],
    ];
    for (const [w, h, dpr] of screens) {
      const vp = computeViewport({ ...base, cssWidth: w, cssHeight: h, dpr });
      expect(vp.cssWidth).toBeGreaterThanOrEqual(Math.floor(w * dpr) / dpr);
      expect(vp.cssHeight).toBeGreaterThanOrEqual(Math.floor(h * dpr) / dpr);
      expect(vp.cssWidth - w).toBeLessThan(vp.cssZoom * 2);
      expect(vp.cssHeight - h).toBeLessThan(vp.cssZoom * 2);
      expect(vp.width % 2 + vp.height % 2).toBe(0);
    }
  });

  it('keeps at least the minimum room for the orientation when the screen allows it', () => {
    const portrait = computeViewport({ ...base, cssWidth: 820, cssHeight: 1180, dpr: 2 });
    expect(portrait.width).toBeGreaterThanOrEqual(180);
    expect(portrait.height).toBeGreaterThanOrEqual(320);
    const landscape = computeViewport({ ...base, cssWidth: 844, cssHeight: 390, dpr: 3 });
    expect(landscape.width).toBeGreaterThanOrEqual(320);
    expect(landscape.height).toBeGreaterThanOrEqual(240);
  });

  it('never goes below zoom 1 and shrinks to tiny windows instead of overflowing', () => {
    const vp = computeViewport({ ...base, cssWidth: 100, cssHeight: 100, dpr: 1 });
    expect(vp.deviceZoom).toBe(1);
    expect(vp.width).toBe(100);
    expect(vp.height).toBe(100);
  });

  it('converts safe area insets to game pixels, rounding up', () => {
    const vp = computeViewport({ ...base, cssWidth: 390, cssHeight: 844, dpr: 3 });
    expect(insetsToGame({ top: 47, right: 0, bottom: 34, left: 0 }, vp)).toEqual({ top: 24, right: 0, bottom: 17, left: 0 });
  });
});
