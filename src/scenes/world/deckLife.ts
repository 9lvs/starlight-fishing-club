// The crew on deck feel alive: each has a little line over the side, they hop
// when you land a rare fish, their bobber dips when they catch one, and at
// night they doze with a soft "z" now and then. Presentation only.
import Phaser from 'phaser';
import { FX } from '../../config/tuning';
import { MOTION, color } from '../../design/tokens';

/** Where a crew sprite holds its rod, and where its bobber sits, inside the boat container. */
const HAND = { x: 12, y: 9 };
const TIP = { x: 15, y: 3 };
const BOBBER_Y = 31;
const BASE_Y = -2;

interface Z {
  x: number;
  y: number;
  age: number;
}

export class DeckLife {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private crew: Phaser.GameObjects.Sprite[] = [];
  private zs: Z[] = [];
  private dips: number[] = [];
  private nextZ = 0;
  private elapsed = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    boat: Phaser.GameObjects.Container,
  ) {
    // In front of the hull, so the lines hang over the side.
    this.gfx = scene.add.graphics();
    boat.add(this.gfx);
  }

  setCrew(sprites: Phaser.GameObjects.Sprite[]): void {
    this.crew = sprites;
    this.dips = sprites.map(() => 0);
  }

  /** Everyone hops, one after another (twice for a legendary). */
  cheer(times: number, reduced: boolean): void {
    if (reduced) return;
    this.crew.forEach((s, i) => this.hop(s, i * FX.crew.staggerMs, times));
  }

  /** One crew member landed a fish: their bobber dips and they give a small hop. */
  crewCatch(reduced: boolean): void {
    if (this.crew.length === 0) return;
    const i = Math.floor(Math.random() * this.crew.length);
    this.dips[i] = 500;
    if (!reduced) this.hop(this.crew[i]!, 0, 1);
  }

  private hop(s: Phaser.GameObjects.Sprite, delay: number, times: number): void {
    this.scene.tweens.killTweensOf(s);
    s.y = BASE_Y;
    this.scene.tweens.add({
      targets: s,
      y: BASE_Y - FX.crew.hopPx,
      delay,
      duration: FX.crew.hopMs,
      yoyo: true,
      repeat: times - 1,
      ease: MOTION.easeOut,
      onComplete: () => (s.y = BASE_Y),
    });
  }

  update(delta: number, opts: { night: boolean; reduced: boolean }): void {
    this.elapsed += delta;
    const g = this.gfx;
    g.clear();
    if (this.crew.length === 0) {
      this.zs = [];
      return;
    }
    this.crew.forEach((s, i) => {
      // Their own little rod and line, with a bobber that rides the water.
      const hx = Math.round(s.x + HAND.x);
      const hy = Math.round(s.y + HAND.y);
      const tx = Math.round(s.x + TIP.x);
      const ty = Math.round(s.y + TIP.y);
      g.fillStyle(color('bark'));
      for (let k = 0; k <= 3; k++) g.fillRect(Math.round(hx + ((tx - hx) * k) / 3), Math.round(hy + ((ty - hy) * k) / 3), 1, 1);
      this.dips[i] = Math.max(0, (this.dips[i] ?? 0) - delta);
      const bob = opts.reduced ? 0 : Math.round(Math.sin(this.elapsed / 700 + i * 1.7) * 0.6);
      const by = BOBBER_Y + bob + (this.dips[i]! > 0 ? 1 : 0);
      // The line leans out a little from the boat to the bobber.
      const bx = tx + 3;
      g.fillStyle(color('mist'), 0.45);
      for (let yy = ty + 1; yy < by - 1; yy++) g.fillRect(Math.round(tx + 1 + ((bx - tx - 1) * (yy - ty)) / (by - ty)), yy, 1, 1);
      g.fillStyle(color('mist'));
      g.fillRect(bx, by - 1, 1, 1);
      g.fillStyle(color('coral'));
      g.fillRect(bx, by, 1, 1);
      if (this.dips[i]! > 0) {
        g.fillStyle(color('mist'), 0.7);
        g.fillRect(bx - 2, by + 1, 1, 1);
        g.fillRect(bx + 2, by + 1, 1, 1);
      }
    });
    if (!opts.night || opts.reduced) {
      this.zs = [];
      return;
    }
    // Dozing: a small "z" drifts up from one of them now and then.
    this.nextZ -= delta;
    if (this.nextZ <= 0) {
      this.nextZ = FX.crew.zEveryMs / Math.max(1, this.crew.length * 0.6);
      const s = this.crew[Math.floor(Math.random() * this.crew.length)]!;
      this.zs.push({ x: s.x + 9, y: s.y + 1, age: 0 });
    }
    this.zs = this.zs.filter((z) => (z.age += delta) < FX.crew.zLifeMs);
    for (const z of this.zs) {
      const t = z.age / FX.crew.zLifeMs;
      const x = Math.round(z.x + Math.sin(t * Math.PI * 2) * 1.5);
      const y = Math.round(z.y - t * FX.crew.zRisePx);
      g.fillStyle(color('mist'), t < 0.6 ? 0.85 : 0.4);
      g.fillRect(x, y, 3, 1);
      g.fillRect(x + 1, y + 1, 1, 1);
      g.fillRect(x, y + 2, 3, 1);
    }
  }
}
