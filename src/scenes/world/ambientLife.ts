// Life around the boat: a fish jumps now and then, gulls cross the sky and
// sometimes rest on the mast, and on open sea a whale surfaces far out once in
// a while. All rare, small, and soft; reduced motion turns them off.
// Presentation only.
import type Phaser from 'phaser';
import { FX } from '../../config/tuning';
import type { Layout } from '../../core/layout';
import { color, type PaletteName } from '../../design/tokens';
import { drawPixelEllipse } from '../../ui/pixelDraw';

const A = FX.ambient;
const rand = (r: readonly number[]) => r[0]! + Math.random() * (r[1]! - r[0]!);

interface Ring {
  x: number;
  y: number;
  age: number;
}
interface Jump {
  x: number;
  y: number;
  dir: number;
  size: number;
  age: number;
}
interface Gull {
  x: number;
  y: number;
  dir: number;
  /** flying across, landing on the mast, resting there, or leaving. */
  state: 'cross' | 'land' | 'rest' | 'leave';
  restLeft: number;
}
interface Whale {
  x: number;
  y: number;
  age: number;
}

export interface AmbientOpts {
  reduced: boolean;
  /** Where the mast top is right now, in world pixels (null when the boat has none). */
  mast: { x: number; y: number } | null;
  waterId: string;
  /** Inside the cave there is no sky for gulls. */
  cave: boolean;
}

export class AmbientLife {
  private elapsed = 0;
  private nextJump = rand(A.jumpEveryMs);
  private nextGull = rand(A.gullEveryMs) / 3;
  private nextWhale = rand(A.whaleEveryMs);
  private jumps: Jump[] = [];
  private rings: Ring[] = [];
  private gull: Gull | null = null;
  private whale: Whale | null = null;

  constructor(
    private readonly L: Layout,
    /** Drawn behind the boat (on the water). */
    private readonly water: Phaser.GameObjects.Graphics,
    /** Drawn in front of the boat (gulls). */
    private readonly air: Phaser.GameObjects.Graphics,
  ) {}

  update(delta: number, o: AmbientOpts): void {
    this.elapsed += delta;
    this.water.clear();
    this.air.clear();
    if (o.reduced) {
      this.jumps = [];
      this.gull = null;
      this.whale = null;
      return;
    }
    this.updateJumps(delta);
    this.updateWhale(delta, o);
    this.updateGull(delta, o);
  }

  // ---------------------------------------------------------------- jumping fish

  private updateJumps(delta: number): void {
    const { width: W, horizonY, menuBar, boat } = this.L;
    this.nextJump -= delta;
    if (this.nextJump <= 0) {
      this.nextJump = rand(A.jumpEveryMs);
      for (let tries = 0; tries < 6; tries++) {
        const x = 10 + Math.random() * (W - 20);
        if (Math.abs(x - boat.x) < 46) continue;
        const y = horizonY + 10 + Math.random() * Math.max(10, menuBar.y - 90 - horizonY);
        // Farther fish (near the horizon) look smaller.
        const near = (y - horizonY) / Math.max(1, menuBar.y - horizonY);
        this.jumps.push({ x, y, dir: Math.random() < 0.5 ? -1 : 1, size: near > 0.4 ? 3 : 2, age: 0 });
        this.rings.push({ x: Math.round(x), y: Math.round(y), age: 0 });
        break;
      }
    }
    const g = this.water;
    this.jumps = this.jumps.filter((j) => {
      j.age += delta;
      const t = j.age / A.jumpMs;
      if (t >= 1) {
        this.rings.push({ x: Math.round(j.x + j.dir * 6), y: Math.round(j.y), age: 0 });
        return false;
      }
      const x = Math.round(j.x + j.dir * 6 * t);
      const y = Math.round(j.y - Math.sin(t * Math.PI) * (3 + j.size * 2));
      g.fillStyle(color('slate'), 0.95);
      g.fillRect(x - (j.dir > 0 ? j.size - 1 : 0), y, j.size, 1);
      g.fillStyle(color('mist'), 0.8);
      g.fillRect(x, y, 1, 1);
      // A little tail flick on the way up.
      g.fillStyle(color('slate'), 0.9);
      g.fillRect(x - j.dir * j.size, y + (t < 0.5 ? 1 : -1), 1, 1);
      return true;
    });
    this.rings = this.rings.filter((r) => {
      r.age += delta;
      const t = r.age / 700;
      if (t >= 1) return false;
      drawPixelEllipse(g, r.x, r.y, 1 + t * 5, Math.max(1, (1 + t * 5) * 0.35), 'mist', t < 0.5 ? 0.6 : 0.3);
      return true;
    });
  }

  // ---------------------------------------------------------------- the whale

  private updateWhale(delta: number, o: AmbientOpts): void {
    const { width: W, horizonY } = this.L;
    if (!this.whale && A.whaleWaters.includes(o.waterId)) {
      this.nextWhale -= delta;
      if (this.nextWhale <= 0) {
        this.nextWhale = rand(A.whaleEveryMs);
        this.whale = { x: Math.round(W * (0.2 + Math.random() * 0.6)), y: horizonY + 8, age: 0 };
      }
    }
    const w = this.whale;
    if (!w) return;
    w.age += delta;
    const t = w.age / A.whaleMs;
    if (t >= 1) {
      this.whale = null;
      return;
    }
    const g = this.water;
    const px = (x: number, y: number, c: PaletteName, a = 1) => {
      g.fillStyle(color(c), a);
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    };
    // The back rises, blows, sinks; then the tail lifts and slips under.
    const back = t < 0.25 ? t / 0.25 : t < 0.55 ? 1 : t < 0.7 ? 1 - (t - 0.55) / 0.15 : 0;
    if (back > 0) {
      // Dark enough to read on the bright water near the horizon.
      const h = Math.round(back * 3);
      for (let dx = -7; dx <= 7; dx++) {
        const top = Math.round(h * (1 - (dx / 8) ** 2));
        for (let dy = 0; dy < top; dy++) px(w.x + dx, w.y - dy - 1, dy === top - 1 ? 'slate' : 'midnight');
      }
    }
    if (t > 0.2 && t < 0.5) {
      const s = (t - 0.2) / 0.3;
      for (let i = 0; i < 5; i++) px(w.x - 2 + (i % 3), w.y - 3 - Math.round(s * 6) + i, 'mist', 0.7 * (1 - s));
    }
    if (t > 0.72 && t < 0.95) {
      const s = (t - 0.72) / 0.23;
      const lift = Math.round(Math.sin(s * Math.PI) * 4);
      const x = w.x + 4;
      px(x, w.y - lift, 'midnight');
      px(x, w.y - lift + 1, 'midnight');
      px(x - 1, w.y - lift - 1, 'midnight');
      px(x + 1, w.y - lift - 1, 'midnight');
      px(x - 2, w.y - lift - 2, 'slate');
      px(x + 2, w.y - lift - 2, 'slate');
    }
    if (t < 0.7 || t > 0.9) drawPixelEllipse(g, w.x, w.y, 9, 1, 'mist', 0.5);
  }

  // ---------------------------------------------------------------- gulls

  private updateGull(delta: number, o: AmbientOpts): void {
    const { width: W, horizonY } = this.L;
    if (o.cave) {
      this.gull = null;
      return;
    }
    if (!this.gull) {
      this.nextGull -= delta;
      if (this.nextGull > 0) return;
      this.nextGull = rand(A.gullEveryMs);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const land = !!o.mast && Math.random() < A.gullLandChance;
      this.gull = { x: dir > 0 ? -6 : W + 6, y: horizonY * (0.3 + Math.random() * 0.3), dir, state: land ? 'land' : 'cross', restLeft: rand(A.gullRestMs) };
    }
    const b = this.gull;
    const step = A.gullSpeed * delta;
    if (b.state === 'land' && o.mast) {
      const tx = o.mast.x;
      const ty = o.mast.y - 2;
      const dx = tx - b.x;
      const dy = ty - b.y;
      const d = Math.hypot(dx, dy);
      if (d <= step * 1.5) {
        b.state = 'rest';
      } else {
        b.x += (dx / d) * step;
        b.y += (dy / d) * step;
        b.dir = dx >= 0 ? 1 : -1;
      }
    } else if (b.state === 'rest' && o.mast) {
      // Riding along with the boat's bob.
      b.x = o.mast.x;
      b.y = o.mast.y - 2;
      b.restLeft -= delta;
      if (b.restLeft <= 0) {
        b.state = 'leave';
        b.dir = Math.random() < 0.5 ? 1 : -1;
      }
    } else {
      if (b.state !== 'cross') b.state = 'leave';
      b.x += b.dir * step;
      b.y += Math.sin(this.elapsed / 500) * 0.01 * delta - (b.state === 'leave' ? 0.006 * delta : 0);
      if (b.x < -10 || b.x > W + 10 || b.y < -10) {
        this.gull = null;
        return;
      }
    }
    this.drawGull(b);
  }

  private drawGull(b: Gull): void {
    const g = this.air;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const px = (dx: number, dy: number, c: PaletteName) => {
      g.fillStyle(color(c));
      g.fillRect(x + dx, y + dy, 1, 1);
    };
    if (b.state === 'rest') {
      // Sitting: a round white body, grey wing, a yellow beak toward where it looks.
      px(0, 0, 'mist');
      px(-1, 0, 'mist');
      px(0, -1, 'mist');
      px(-1, 1, 'slate');
      px(0, 1, 'mist');
      px(b.dir, -1, 'gold');
      return;
    }
    const up = Math.floor(this.elapsed / 180) % 2 === 0;
    px(0, 0, 'mist');
    px(-1, 0, 'mist');
    px(1, 0, 'mist');
    px(-2, up ? -1 : 1, 'slate');
    px(2, up ? -1 : 1, 'slate');
    px(b.dir > 0 ? 2 : -2, 0, 'gold');
  }
}
