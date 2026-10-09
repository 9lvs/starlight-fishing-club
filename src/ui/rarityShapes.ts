// 7x7 rarity shapes. Each rarity has a shape AND a pip count AND a color, so
// rarity is never communicated by color alone.
import type Phaser from 'phaser';
import { color, type PaletteName } from '../design/tokens';

export const RARITY_SHAPES: Record<string, readonly string[]> = {
  circle: ['..xxx..', '.xxxxx.', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..'],
  diamond: ['...x...', '..xxx..', '.xxxxx.', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'],
  star: ['...x...', '...x...', 'xxxxxxx', '.xxxxx.', '..xxx..', '.xx.xx.', '.x...x.'],
  crown: ['x..x..x', 'x.xxx.x', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '.......', 'xxxxxxx'],
  sun: ['x..x..x', '.xxxxx.', '.xxxxx.', 'xxxxxxx', '.xxxxx.', '.xxxxx.', 'x..x..x'],
};

export function drawRarityShape(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  shape: string,
  fill: PaletteName,
  outline?: PaletteName,
): void {
  const rows = RARITY_SHAPES[shape] ?? RARITY_SHAPES.circle!;
  if (outline) {
    g.fillStyle(color(outline));
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== 'x') continue;
        g.fillRect(x + i - 1, y + j, 1, 1);
        g.fillRect(x + i + 1, y + j, 1, 1);
        g.fillRect(x + i, y + j - 1, 1, 1);
        g.fillRect(x + i, y + j + 1, 1, 1);
      }
    });
  }
  g.fillStyle(color(fill));
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === 'x') g.fillRect(x + i, y + j, 1, 1);
  });
}

/** Small pips, one per tier step, drawn 2x2 with 1px gaps. */
export function drawPips(g: Phaser.GameObjects.Graphics, x: number, y: number, count: number, fill: PaletteName): number {
  g.fillStyle(color(fill));
  for (let i = 0; i < count; i++) g.fillRect(x + i * 3, y, 2, 2);
  return count * 3 - 1;
}
