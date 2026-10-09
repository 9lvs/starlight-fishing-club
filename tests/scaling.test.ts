import { describe, expect, it } from 'vitest';
import { computeViewport, insetsToGame } from '../src/core/scaling';

const base = { baseWidth: 180, baseHeight: 320, maxExtendRatio: 1.6, maxZoom: 16 };

describe('computeViewport', () => {
  it('letterboxes on desktop with a whole-number device zoom', () => {
    const vp = computeViewport({ ...base, cssWidth: 1440, cssHeight: 900, dpr: 2, fill: false });
    expect(vp.deviceZoom).toBe(5);
    expect(vp.width).toBe(180);
    expect(vp.height).toBe(320);
    expect(vp.cssWidth * 2).toBe(180 * 5);
  });

  it('fills a phone screen by growing the free axis', () => {
    const vp = computeViewport({ ...base, cssWidth: 390, cssHeight: 844, dpr: 3, fill: true });
    expect(vp.deviceZoom).toBe(6);
    expect(vp.width).toBe(195);
    expect(vp.height).toBe(422);
  });

  it('never goes below zoom 1 or the base size', () => {
    const vp = computeViewport({ ...base, cssWidth: 100, cssHeight: 100, dpr: 1, fill: true });
    expect(vp.deviceZoom).toBe(1);
    expect(vp.width).toBeGreaterThanOrEqual(180);
  });

  it('converts safe area insets to game pixels, rounding up', () => {
    const vp = computeViewport({ ...base, cssWidth: 390, cssHeight: 844, dpr: 3, fill: true });
    expect(insetsToGame({ top: 47, right: 0, bottom: 34, left: 0 }, vp)).toEqual({ top: 24, right: 0, bottom: 17, left: 0 });
  });
});
