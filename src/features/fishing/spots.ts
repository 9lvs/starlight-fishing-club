// Fishing spots: now and then a patch of water stirs. A cast into it gets extra
// luck and, while the time and weather are right, a chance at the water's
// secret fish. Spots drift a little and fade; missing one costs nothing.
// Pure logic (no Phaser): the scene gives the area and draws them.
import type { Rng } from '../../core/rng';

export interface SpotConfig {
  /** The first spot of a session comes a little sooner. */
  firstMs: number;
  everyMs: readonly number[];
  lifeMs: readonly number[];
  fadeMs: number;
  /** Tap within this many pixels (half that up and down, the water is flat). */
  radius: number;
  max: number;
  /** Slow sideways drift, in pixels per second. */
  driftPxPerSec: number;
}

export interface Spot {
  id: number;
  x: number;
  y: number;
  age: number;
  life: number;
  /** Drift direction: -1 or 1. */
  dir: number;
}

export interface SpotArea {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Keep spots this far from this point (the boat). */
  avoid?: { x: number; y: number; r: number };
}

const between = (r: readonly number[], rng: Rng) => r[0]! + rng() * (r[1]! - r[0]!);

export class SpotField {
  spots: Spot[] = [];
  private next: number;
  private seq = 0;
  private area: SpotArea | null = null;

  constructor(
    private readonly cfg: SpotConfig,
    private readonly rng: Rng,
  ) {
    this.next = cfg.firstMs;
  }

  /** Where spots may appear (the open water), set by the scene from the layout. */
  setArea(area: SpotArea | null): void {
    this.area = area;
    // Keep live spots on the water after a resize.
    if (area) for (const s of this.spots) this.clamp(s, area);
  }

  update(dtMs: number): void {
    const step = (this.cfg.driftPxPerSec * dtMs) / 1000;
    for (const s of this.spots) {
      s.age += dtMs;
      s.x += s.dir * step;
      if (this.area) this.clamp(s, this.area);
    }
    this.spots = this.spots.filter((s) => s.age < s.life);
    this.next -= dtMs;
    if (this.next > 0) return;
    this.next = between(this.cfg.everyMs, this.rng);
    if (this.area && this.spots.length < this.cfg.max) this.spawn(this.area);
  }

  /** The spot under a tap, if any. */
  hit(x: number, y: number): Spot | null {
    const r = this.cfg.radius;
    return this.spots.find((s) => this.strength(s) > 0.3 && ((x - s.x) / r) ** 2 + ((y - s.y) / (r / 2)) ** 2 <= 1) ?? null;
  }

  /** 0 to 1: fades in when it appears and out before it goes. */
  strength(s: Spot): number {
    const f = this.cfg.fadeMs;
    return Math.max(0, Math.min(1, s.age / f, (s.life - s.age) / f));
  }

  /** Start a spot now (debug, and the first-time tip). */
  spawnNow(): Spot | null {
    return this.area ? this.spawn(this.area) : null;
  }

  private spawn(a: SpotArea): Spot | null {
    for (let tries = 0; tries < 8; tries++) {
      const x = a.x + this.rng() * a.w;
      const y = a.y + this.rng() * a.h;
      if (a.avoid && Math.hypot(x - a.avoid.x, (y - a.avoid.y) * 2) < a.avoid.r) continue;
      const s: Spot = { id: ++this.seq, x: Math.round(x), y: Math.round(y), age: 0, life: between(this.cfg.lifeMs, this.rng), dir: this.rng() < 0.5 ? -1 : 1 };
      this.spots.push(s);
      return s;
    }
    return null;
  }

  private clamp(s: Spot, a: SpotArea): void {
    if (s.x < a.x || s.x > a.x + a.w) s.dir = s.x < a.x ? 1 : -1;
    s.x = Math.max(a.x, Math.min(a.x + a.w, s.x));
    s.y = Math.max(a.y, Math.min(a.y + a.h, s.y));
  }
}
