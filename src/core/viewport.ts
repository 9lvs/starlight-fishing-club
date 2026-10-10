// Browser side of scaling: measures the window and safe areas and applies
// the computed viewport to the Phaser game.
import type Phaser from 'phaser';
import { DISPLAY } from '../config/display';
import { computeLayout, setLayout } from './layout';
import { computeViewport, insetsToGame, type SafeInsets, type Viewport } from './scaling';

export function measureSafeArea(): SafeInsets {
  const probe = document.getElementById('safe-area-probe');
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = getComputedStyle(probe);
  const n = (v: string) => parseFloat(v) || 0;
  return { top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft) };
}

export function currentViewport(): Viewport {
  const vv = window.visualViewport;
  return computeViewport({
    cssWidth: vv?.width ?? window.innerWidth,
    cssHeight: vv?.height ?? window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    minGame: DISPLAY.minGame,
    maxZoom: DISPLAY.maxZoom,
  });
}

/** Recompute the layout for a viewport (safe areas included). */
export function updateLayout(vp: Viewport): void {
  setLayout(computeLayout(vp.width, vp.height, insetsToGame(measureSafeArea(), vp)));
}

export function applyViewport(game: Phaser.Game, vp: Viewport): void {
  game.scale.setGameSize(vp.width, vp.height);
  game.scale.setZoom(vp.cssZoom);
  updateLayout(vp);
}

export function sameViewport(a: Viewport, b: Viewport): boolean {
  return a.width === b.width && a.height === b.height && a.deviceZoom === b.deviceZoom && a.cssZoom === b.cssZoom;
}
