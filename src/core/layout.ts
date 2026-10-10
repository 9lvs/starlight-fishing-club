// Where things go on screen, computed from the current game size. Scenes ask
// for a layout instead of hardcoding positions, so a larger phone screen or a
// switch to landscape only changes this file.
import { DISPLAY } from '../config/display';
import { UI } from '../design/tokens';
import type { SafeInsets } from './scaling';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  width: number;
  height: number;
  safe: SafeInsets;
  /** The base-size frame (180x320 by default), centered. Panels live inside it. */
  frame: Rect;
  horizonY: number;
  waterlineY: number;
  boat: { x: number; y: number };
  rodTip: { x: number; y: number };
  bobber: { x: number; y: number };
  topBar: Rect;
  menuBar: Rect;
  castButton: Rect;
  /** The creel button, tucked just left of the Cast button. */
  creelButton: Rect;
  /** Area where a tap counts as a fishing tap. */
  fishingZone: Rect;
}

let current: Layout | null = null;

export function computeLayout(width: number, height: number, safe: SafeInsets): Layout {
  const fw = Math.min(width, DISPLAY.baseWidth);
  const fh = Math.min(height, DISPLAY.baseHeight);
  const frame = { x: Math.floor((width - fw) / 2), y: Math.floor((height - fh) / 2), w: fw, h: fh };
  const horizonY = Math.round(height * 0.42);
  const waterlineY = Math.round(height * 0.62);
  // The boat and its bobber read as one group, centered on any width.
  const boat = { x: Math.round(width / 2) - UI.boatGroupOffset, y: waterlineY };
  const rodTip = { x: boat.x + 22, y: boat.y - 30 };
  const bobber = { x: Math.min(width - 16, rodTip.x + 46), y: waterlineY + 10 };
  const topBar = { x: safe.left, y: safe.top, w: width - safe.left - safe.right, h: UI.topBarHeight };
  const menuBar = {
    x: safe.left,
    y: height - safe.bottom - UI.menuBarHeight,
    w: width - safe.left - safe.right,
    h: UI.menuBarHeight,
  };
  const castW = 88;
  const castButton = {
    x: Math.round(width / 2 - castW / 2),
    y: menuBar.y - UI.bigButtonHeight - 10,
    w: castW,
    h: UI.bigButtonHeight,
  };
  const creelW = 40;
  const creelButton = {
    x: Math.max(safe.left + 4, castButton.x - creelW - 6),
    y: castButton.y + 4,
    w: creelW,
    h: UI.buttonHeight,
  };
  const fishingZone = { x: 0, y: topBar.y + topBar.h, w: width, h: menuBar.y - (topBar.y + topBar.h) };
  return { width, height, safe, frame, horizonY, waterlineY, boat, rodTip, bobber, topBar, menuBar, castButton, creelButton, fishingZone };
}

export function setLayout(l: Layout): void {
  current = l;
}

export function getLayout(): Layout {
  if (!current) current = computeLayout(DISPLAY.baseWidth, DISPLAY.baseHeight, { top: 0, right: 0, bottom: 0, left: 0 });
  return current;
}
