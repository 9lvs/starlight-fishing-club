// Lights on the top boats: lamps that flicker and glow at night, sparkles that
// twinkle, thrusters that hum under the Cloud Skimmer, and a slow blink on its
// antenna. Points come from art/boatsHigh.ts. Presentation only, and soft:
// glows are stepped rings of low alpha, never a bright flash.
import type Phaser from 'phaser';
import type { BoatLight } from '../../art/boatsHigh';
import { FX } from '../../config/tuning';
import { color } from '../../design/tokens';

const GLOW = {
  /** Night glow rings around a lamp: radius and alpha, largest first. */
  rings: [
    [6, 0.06],
    [4, 0.1],
    [2, 0.18],
  ] as const,
  flickerMs: 230,
  twinkleMs: 520,
  blinkMs: 1100,
  thrusterMs: 400,
};

export class BoatGlow {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private lights: BoatLight[] = [];
  private elapsed = 0;
  /** How lit the lamps are: rises at dusk, falls at dawn, with a flicker while catching. */
  private lit = 0;

  constructor(scene: Phaser.Scene, boat: Phaser.GameObjects.Container) {
    this.gfx = scene.add.graphics();
    boat.add(this.gfx);
  }

  setLights(lights: BoatLight[]): void {
    this.lights = lights;
  }

  update(delta: number, opts: { dark: boolean; reduced: boolean }): void {
    this.elapsed += delta;
    const g = this.gfx;
    g.clear();
    const t = this.elapsed;
    const target = opts.dark ? 1 : 0;
    const step = delta / FX.lantern.fadeMs;
    this.lit = target > this.lit ? Math.min(1, this.lit + step) : Math.max(0, this.lit - step);
    // While a lamp is catching it flickers on and off, then settles.
    const catching = !opts.reduced && this.lit > 0 && this.lit < 1 && target === 1;
    const lit = catching && Math.random() < 0.35 ? this.lit * 0.3 : this.lit;
    this.lights.forEach((l, i) => {
      const wave = (ms: number) => (opts.reduced ? 0.5 : (Math.sin(t / ms + i * 1.7) + 1) / 2);
      const dot = (x: number, y: number, a: number) => {
        g.fillStyle(color(l.color), a);
        g.fillRect(x, y, 1, 1);
      };
      const ring = (r: number, a: number, squash = 1) => {
        g.fillStyle(color(l.color), a);
        for (let dy = -r; dy <= r; dy++) {
          const half = Math.round(Math.sqrt(r * r - dy * dy));
          g.fillRect(l.x - half, l.y + Math.round(dy * squash), half * 2 + 1, 1);
        }
      };
      switch (l.kind) {
        case 'lamp': {
          const f = 0.75 + 0.25 * wave(GLOW.flickerMs);
          if (lit > 0) for (const [r, a] of GLOW.rings) ring(r, a * f * lit);
          dot(l.x, l.y, 0.6 + 0.4 * f);
          break;
        }
        case 'lantern': {
          // The post and a little lantern, dark by day, warm once lit.
          g.fillStyle(color('bark'));
          g.fillRect(l.x, l.y + 2, 1, 5);
          g.fillRect(l.x - 1, l.y - 1, 3, 1);
          g.fillStyle(color('ink'), 0.9);
          g.fillRect(l.x - 1, l.y, 3, 2);
          if (lit > 0) {
            const f = 0.8 + 0.2 * wave(GLOW.flickerMs);
            g.fillStyle(color('gold'), lit * f);
            g.fillRect(l.x - 1, l.y, 3, 2);
            g.fillStyle(color('mist'), lit * 0.8);
            g.fillRect(l.x, l.y, 1, 1);
            for (const [r, a] of GLOW.rings) ring(r, a * f * lit);
          }
          break;
        }
        case 'twinkle': {
          const w = wave(GLOW.twinkleMs);
          dot(l.x, l.y, 0.35 + 0.65 * w);
          if (w > 0.85 || (opts.dark && w > 0.6)) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) dot(l.x + dx, l.y + dy, 0.5);
          break;
        }
        case 'thruster': {
          const w = 0.6 + 0.4 * wave(GLOW.thrusterMs);
          ring(2, (opts.dark ? 0.35 : 0.22) * w, 0.5);
          if (opts.dark) ring(4, 0.08 * w, 0.4);
          break;
        }
        case 'blink':
          if (opts.reduced || Math.floor(t / GLOW.blinkMs) % 2 === 0) dot(l.x, l.y, 1);
          break;
      }
    });
  }
}
