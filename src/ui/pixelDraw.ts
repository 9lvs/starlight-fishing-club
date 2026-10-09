// Pixel-perfect drawing helpers on Phaser Graphics. Everything lands on whole
// pixels and uses palette colors, so UI matches the art.
import type Phaser from 'phaser';
import { color, type PaletteName } from '../design/tokens';

export interface PanelStyle {
  fill: PaletteName;
  border: PaletteName;
  highlight?: PaletteName;
  shadow?: PaletteName;
}

/** A box with 1px chamfered corners, a border, and optional inner highlight and shadow lines. */
export function drawPanelBox(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, s: PanelStyle): void {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  g.fillStyle(color(s.border));
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle(color(s.fill));
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  if (s.highlight) {
    g.fillStyle(color(s.highlight));
    g.fillRect(x + 2, y + 1, w - 4, 1);
  }
  if (s.shadow) {
    g.fillStyle(color(s.shadow));
    g.fillRect(x + 2, y + h - 2, w - 4, 1);
  }
}

/** 1px pixel ellipse outline (midpoint algorithm), for ripples and rings. */
export function drawPixelEllipse(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  c: PaletteName,
  alpha = 1,
): void {
  rx = Math.max(1, Math.round(rx));
  ry = Math.max(1, Math.round(ry));
  cx = Math.round(cx);
  cy = Math.round(cy);
  g.fillStyle(color(c), alpha);
  const plot = (x: number, y: number) => {
    g.fillRect(cx + x, cy + y, 1, 1);
    g.fillRect(cx - x, cy + y, 1, 1);
    g.fillRect(cx + x, cy - y, 1, 1);
    g.fillRect(cx - x, cy - y, 1, 1);
  };
  let x = 0;
  let y = ry;
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  let d1 = ry2 - rx2 * ry + 0.25 * rx2;
  let dx = 2 * ry2 * x;
  let dy = 2 * rx2 * y;
  while (dx < dy) {
    plot(x, y);
    if (d1 < 0) {
      x++;
      dx += 2 * ry2;
      d1 += dx + ry2;
    } else {
      x++;
      y--;
      dx += 2 * ry2;
      dy -= 2 * rx2;
      d1 += dx - dy + ry2;
    }
  }
  let d2 = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2;
  while (y >= 0) {
    plot(x, y);
    if (d2 > 0) {
      y--;
      dy -= 2 * rx2;
      d2 += rx2 - dy;
    } else {
      y--;
      x++;
      dx += 2 * ry2;
      dy -= 2 * rx2;
      d2 += dx - dy + rx2;
    }
  }
}

/** Bresenham line made of 1x1 rects, so it stays crisp at any angle. */
export function drawPixelLine(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: PaletteName,
  alpha = 1,
): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  g.fillStyle(color(c), alpha);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 2000; guard++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** A sagging fishing line: a quadratic curve sampled into pixel segments. */
export function drawSaggingLine(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sag: number,
  c: PaletteName,
): void {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2 + sag;
  const steps = Math.max(4, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
  let px = x0;
  let py = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1;
    drawPixelLine(g, px, py, x, y, c);
    px = x;
    py = y;
  }
}
