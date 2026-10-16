// A small, soft burst of confetti in the palette: little pixels that pop up and
// drift down, gone in under a second. Used when a Logbook task is claimed.
import type Phaser from 'phaser';
import { FX } from '../config/tuning';
import { color, type PaletteName } from '../design/tokens';
import { uiSignals } from './uiSignals';

const COLORS: PaletteName[] = ['gold', 'coral', 'sage', 'sky', 'lavender', 'mist'];

export function confettiBurst(scene: Phaser.Scene, x: number, y: number): void {
  if (uiSignals.reducedMotion()) return;
  const c = FX.confetti;
  const g = scene.add.graphics().setDepth(1000);
  const bits = Array.from({ length: c.count }, (_, i) => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const v = c.spread * (0.6 + Math.random() * 0.6);
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col: COLORS[i % COLORS.length]!, wide: Math.random() < 0.4 };
  });
  let age = 0;
  const tick = (_t: number, delta: number) => {
    age += delta;
    g.clear();
    if (age >= c.lifeMs) {
      scene.events.off('update', tick);
      g.destroy();
      return;
    }
    const fade = age > c.lifeMs * 0.6 ? 1 - (age - c.lifeMs * 0.6) / (c.lifeMs * 0.4) : 1;
    for (const b of bits) {
      b.vy += c.gravity * delta;
      b.x += b.vx * delta;
      b.y += b.vy * delta;
      g.fillStyle(color(b.col), fade);
      g.fillRect(Math.round(b.x), Math.round(b.y), b.wide ? 2 : 1, 1);
    }
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => {
    scene.events.off('update', tick);
    g.destroy();
  });
}
