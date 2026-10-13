// Small moving touches that make each water feel alive: willow leaves, river
// current, chimney smoke, a lighthouse beam, gulls, a harbor buoy, reef fish,
// a turtle, cave drips, a waterfall off the sky island, a balloon, and sky
// lanterns. Which ones play comes from the water's `scene.effects` list. All
// are soft and slow; with reduced motion only the still parts are drawn.
import Phaser from 'phaser';
import type { Layout } from '../../core/layout';
import { color, type PaletteName, type ScenePalette } from '../../design/tokens';
import { landmarkAnchors, LANDMARK_LAYER_H, type LandmarkAnchors } from './landmarks';
import type { SceneShape } from './painters';

const FX = {
  leaves: 5,
  currentStreaks: 9,
  smokePuffs: 7,
  beamLen: 70,
  beamPeriodMs: 9000,
  beamAlpha: 0.16,
  gulls: 3,
  schoolSize: 9,
  turtleEveryMs: 26000,
  turtleShowMs: 7000,
  dripEveryMs: 1800,
  lanterns: 6,
  fireworkEveryMs: 22000,
  fireworkMs: 2600,
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}

export interface EffectFrame {
  pal: ScenePalette;
  /** How far the landmark layer has drifted, in pixels. */
  offset: number;
  wind: number;
  reduced: boolean;
  phase: string;
}

export class SceneEffects {
  private shape: SceneShape | null = null;
  private anchors: LandmarkAnchors = { canopies: [] };
  private parts = new Map<string, Particle[]>();
  private elapsed = 0;
  private nextDrip = 0;
  private ripples: Particle[] = [];

  constructor(
    private readonly g: Phaser.GameObjects.Graphics,
    private readonly L: Layout,
  ) {}

  setShape(shape: SceneShape): void {
    this.shape = shape;
    this.anchors = landmarkAnchors(shape, this.L.width);
    this.parts.clear();
    this.ripples = [];
  }

  private has(id: string): boolean {
    return !!this.shape?.effects.includes(id);
  }

  /** Landmark layer pixels to screen pixels, following the drift. */
  private toScreen(x: number, y: number, offset: number): { x: number; y: number } {
    const W = this.L.width;
    return { x: (((x - offset) % W) + W) % W, y: this.L.horizonY - LANDMARK_LAYER_H + 3 + y };
  }

  private pool(id: string, n: number, make: (i: number) => Particle): Particle[] {
    let p = this.parts.get(id);
    if (!p) {
      p = Array.from({ length: n }, (_, i) => make(i));
      this.parts.set(id, p);
    }
    return p;
  }

  private px(x: number, y: number, c: PaletteName, a = 1, w = 1, h = 1): void {
    this.g.fillStyle(color(c), a);
    this.g.fillRect(Math.round(x), Math.round(y), w, h);
  }

  update(delta: number, f: EffectFrame): void {
    this.g.clear();
    if (!this.shape) return;
    this.elapsed += delta;
    const night = f.pal.celestialKind === 'moon';
    const dark = night || f.phase === 'dusk';
    if (this.has('beam')) this.beam(f, dark);
    if (this.has('buoy')) this.buoy(f, dark);
    if (f.reduced) return;
    if (this.has('leaves')) this.leaves(delta, f);
    if (this.has('dragonflies') && !dark) this.dragonflies(f);
    if (this.has('current')) this.current(delta, f);
    if (this.has('smoke')) this.smoke(delta, f, night);
    if (this.has('gulls') && !night) this.gulls(delta, f, dark);
    if (this.has('fish_school')) this.school(f);
    if (this.has('turtle')) this.turtle(f);
    if (this.has('drips')) this.drips(delta, f);
    if (this.has('waterfall')) this.waterfall(f);
    if (this.has('balloon') && !night) this.balloon(f);
    if (this.has('sky_lanterns') && dark) this.lanterns(delta, f);
    if (dark && this.shape.clubDecor.includes('club_fireworks')) this.fireworks(f);
  }

  private leaves(delta: number, f: EffectFrame): void {
    const src = this.anchors.canopies;
    if (src.length === 0) return;
    const spawn = (i: number): Particle => {
      const a = src[i % src.length]!;
      const s = this.toScreen(a.x + Phaser.Math.Between(-8, 8), a.y, f.offset);
      return { x: s.x, y: s.y, vx: 0.004 + f.wind * 0.02, vy: 0.006 + Math.random() * 0.004, t: Math.random() * 6 };
    };
    const ps = this.pool('leaves', FX.leaves, spawn);
    const floor = this.L.horizonY + 30;
    ps.forEach((p, i) => {
      p.t += delta / 1000;
      p.x += (p.vx + Math.sin(p.t * 2) * 0.008) * delta;
      p.y += p.vy * delta;
      if (p.y > floor) ps[i] = spawn(i + Math.floor(Math.random() * 4));
      this.px(p.x, p.y, Math.sin(p.t * 3) > 0 ? f.pal.foregroundAccent : 'gold', 0.9);
    });
  }

  private dragonflies(f: EffectFrame): void {
    const t = this.elapsed / 1000;
    for (let i = 0; i < 2; i++) {
      const x = this.L.width * (i === 0 ? 0.18 : 0.8) + Math.sin(t * 0.7 + i * 3) * 14 + Math.sin(t * 2.3 + i) * 3;
      const y = this.L.horizonY + 26 + Math.cos(t * 0.9 + i * 2) * 6;
      this.px(x, y, 'teal', 1, 3, 1);
      const flap = Math.floor(this.elapsed / 60 + i) % 2 === 0;
      this.px(x + 1, y - (flap ? 1 : 0), 'mist', 0.7, 1, 1);
      this.px(x + 1, y + (flap ? 0 : 1), 'mist', 0.5, 1, 1);
      void f;
    }
  }

  /** River current: soft streaks gliding across the water, faster near you. */
  private current(delta: number, f: EffectFrame): void {
    const W = this.L.width;
    const top = this.L.horizonY + 4;
    const span = this.L.menuBar.y - top - 30;
    const spawn = (anywhere: boolean): Particle => {
      const d = Math.random();
      return { x: anywhere ? Math.random() * W : -10, y: top + d * span, vx: 0.006 + d * 0.014, vy: 0, t: 3 + Math.floor(d * 6) };
    };
    const ps = this.pool('current', FX.currentStreaks, () => spawn(true));
    ps.forEach((p, i) => {
      p.x += p.vx * delta;
      if (p.x > W + 10) ps[i] = spawn(false);
      this.px(p.x, p.y, f.pal.waterShine, 0.3, p.t, 1);
    });
  }

  private smoke(delta: number, f: EffectFrame, night: boolean): void {
    const a = this.anchors.chimney;
    if (!a) return;
    const spawn = (i: number): Particle => ({ x: 0, y: 0, vx: 0.002 + f.wind * 0.01, vy: -0.006, t: i * 0.9 });
    const ps = this.pool('smoke', FX.smokePuffs, spawn);
    const origin = this.toScreen(a.x, a.y, f.offset);
    ps.forEach((p) => {
      p.t += delta / 1000;
      const life = p.t % (FX.smokePuffs * 0.9);
      const x = origin.x + life * 6 * (1 + f.wind * 2) + Math.sin(life * 1.7) * 1.5;
      const y = origin.y - life * 4.5;
      const fade = Math.max(0, 1 - life / (FX.smokePuffs * 0.9));
      const size = 1 + Math.floor(life / 2.2);
      this.px(x, y, night ? 'slate' : 'mist', 0.45 * fade, size, size);
    });
  }

  /** The lighthouse beam turns slowly; it reads as a soft fan that grows and shrinks. */
  private beam(f: EffectFrame, dark: boolean): void {
    const a = this.anchors.lamp;
    if (!a) return;
    const o = this.toScreen(a.x, a.y, f.offset);
    if (!dark) return;
    const turn = ((this.elapsed % FX.beamPeriodMs) / FX.beamPeriodMs) * Math.PI * 2;
    const reach = Math.cos(turn) * FX.beamLen;
    const dir = Math.sign(reach) || 1;
    const len = Math.abs(reach);
    for (let i = 2; i < len; i++) {
      const spread = Math.floor(i / 14);
      this.px(o.x + dir * i, o.y - spread, f.pal.lamp, FX.beamAlpha * (1 - i / FX.beamLen), 1, spread * 2 + 1);
    }
    // The lamp flares when the beam faces you.
    if (Math.abs(Math.sin(turn)) > 0.97) this.px(o.x - 1, o.y - 1, 'mist', 0.8, 3, 3);
  }

  private gulls(delta: number, f: EffectFrame, dusk: boolean): void {
    const W = this.L.width;
    const spawn = (anywhere: boolean): Particle => ({
      x: anywhere ? Math.random() * W : -12,
      y: 14 + Math.random() * this.L.horizonY * 0.45,
      vx: 0.01 + Math.random() * 0.008 + f.wind * 0.01,
      vy: 0,
      t: Math.random() * 10,
    });
    const ps = this.pool('gulls', FX.gulls, () => spawn(true));
    const c: PaletteName = dusk ? 'ink' : 'mist';
    ps.forEach((p, i) => {
      p.t += delta / 1000;
      p.x += p.vx * delta;
      const y = p.y + Math.sin(p.t * 0.8) * 3;
      if (p.x > W + 12) ps[i] = spawn(false);
      const up = Math.floor(p.t * 3) % 3 === 0;
      this.px(p.x, y, c);
      this.px(p.x - 1, y - (up ? 1 : 0), c);
      this.px(p.x + 1, y - (up ? 1 : 0), c);
      this.px(p.x - 2, y - (up ? 2 : 0), c);
      this.px(p.x + 2, y - (up ? 2 : 0), c);
    });
  }

  private buoy(f: EffectFrame, dark: boolean): void {
    const x = Math.round(this.L.width * 0.24);
    const bob = f.reduced ? 0 : Math.round(Math.sin(this.elapsed / 900));
    const y = this.L.horizonY + 14 + bob;
    this.px(x - 1, y, 'coral', 1, 3, 3);
    this.px(x - 1, y + 1, 'mist', 1, 3, 1);
    this.px(x, y - 3, f.pal.wallShade, 1, 1, 3);
    const on = Math.floor(this.elapsed / 1000) % 3 === 0;
    if (on || f.reduced) this.px(x, y - 4, dark ? 'gold' : 'sand', 1);
    if (on && dark) this.px(x - 1, y - 5, 'gold', 0.3, 3, 3);
  }

  /** A loose school of small fish shadows turning together under the surface. */
  private school(f: EffectFrame): void {
    const t = this.elapsed / 1000;
    const W = this.L.width;
    const cx = W * 0.5 + Math.sin(t * 0.12) * W * 0.35;
    const cy = this.L.horizonY + 40 + Math.sin(t * 0.21) * 10;
    for (let i = 0; i < FX.schoolSize; i++) {
      const x = cx + Math.sin(i * 2.4 + t * 0.6) * 9;
      const y = cy + Math.cos(i * 1.7 + t * 0.5) * 4;
      const flash = Math.sin(t * 2 + i) > 0.9;
      this.px(x, y, flash ? f.pal.waterShine : f.pal.waterDeep === 'teal' ? 'dusk' : 'ink', flash ? 0.7 : 0.5, 2, 1);
    }
  }

  private turtle(f: EffectFrame): void {
    const cycle = this.elapsed % FX.turtleEveryMs;
    if (cycle > FX.turtleShowMs) return;
    const k = cycle / FX.turtleShowMs;
    const x = this.L.width * (0.15 + k * 0.25);
    const y = this.L.horizonY + 22;
    const rise = Math.min(1, Math.min(k, 1 - k) * 6);
    const a = rise;
    this.px(x - 3, y, f.pal.waterShine, 0.4 * a, 9, 1);
    this.px(x - 2, y - 1, 'moss', a, 5, 1);
    this.px(x + 3, y - 2, 'sage', a, 2, 2);
  }

  private drips(delta: number, f: EffectFrame): void {
    this.nextDrip -= delta;
    const W = this.L.width;
    const drops = this.pool('drips', 3, () => ({ x: -1, y: 0, vx: 0, vy: 0, t: 0 }));
    if (this.nextDrip <= 0) {
      this.nextDrip = FX.dripEveryMs * (0.6 + Math.random());
      const d = drops.find((p) => p.x < 0);
      if (d) Object.assign(d, { x: 10 + Math.random() * (W - 20), y: 10 + Math.random() * 10, vy: 0.02, t: 0 });
    }
    const water = this.L.horizonY + 8 + 0;
    for (const d of drops) {
      if (d.x < 0) continue;
      d.vy += 0.0003 * delta;
      d.y += d.vy * delta;
      if (d.y >= water) {
        this.ripples.push({ x: d.x, y: water + Math.random() * 30, vx: 0, vy: 0, t: 0 });
        d.x = -1;
        continue;
      }
      this.px(d.x, d.y, f.pal.foregroundAccent, 0.9, 1, 2);
    }
    this.ripples = this.ripples.filter((r) => (r.t += delta) < 1400);
    for (const r of this.ripples) {
      const k = r.t / 1400;
      const rad = 1 + Math.floor(k * 6);
      this.g.lineStyle(1, color(f.pal.waterShine), 0.5 * (1 - k));
      this.g.strokeEllipse(Math.round(r.x), Math.round(r.y), rad * 2 + 1, rad);
    }
  }

  private waterfall(f: EffectFrame): void {
    const a = this.anchors.falls;
    if (!a) return;
    const o = this.toScreen(a.x, a.y, f.offset);
    const bottom = this.L.horizonY + 2;
    const len = bottom - o.y;
    for (let i = 0; i < len; i++) {
      const lane = (i + Math.floor(this.elapsed / 70)) % 5;
      const wide = 1 + Math.floor((i / len) * 2);
      this.px(o.x + (lane === 0 ? 1 : 0), o.y + i, lane < 2 ? 'mist' : 'sky', 0.75 - (i / len) * 0.35, wide, 1);
    }
    const spray = Math.floor(this.elapsed / 200) % 3;
    this.px(o.x - 2 - spray, bottom - 1, 'mist', 0.5, 2, 1);
    this.px(o.x + 2 + spray, bottom - 2, 'mist', 0.4, 2, 1);
  }

  private balloon(f: EffectFrame): void {
    const W = this.L.width;
    const x = ((this.elapsed / 1000) * 1.2) % (W + 30) - 15;
    const y = this.L.horizonY * 0.3 + Math.sin(this.elapsed / 3000) * 3;
    for (let dy = 0; dy < 8; dy++) {
      const half = [2, 3, 4, 4, 4, 3, 2, 1][dy]!;
      for (let dx = -half; dx <= half; dx++) this.px(x + dx, y + dy, Math.abs(dx) % 3 === 0 ? 'gold' : 'coral', 1);
    }
    this.px(x - 1, y + 8, f.pal.wallShade, 1, 1, 2);
    this.px(x + 1, y + 8, f.pal.wallShade, 1, 1, 2);
    this.px(x - 1, y + 10, 'bark', 1, 3, 2);
  }

  /** A soft firework over the clubhouse now and then after dark: rise, burst, fade. */
  private fireworks(f: EffectFrame): void {
    const k = this.anchors.club;
    if (!k) return;
    const cycle = this.elapsed % FX.fireworkEveryMs;
    if (cycle > FX.fireworkMs) return;
    const n = Math.floor(this.elapsed / FX.fireworkEveryMs);
    const tones: PaletteName[] = ['gold', 'rose', 'sky', 'sage', 'lavender'];
    const c = tones[n % tones.length]!;
    const o = this.toScreen((k.x0 + k.x1) / 2 + ((n * 7) % 11) - 5, k.top - 26 - (n % 3) * 4, f.offset);
    const rise = 700;
    if (cycle < rise) {
      const y = o.y + (1 - cycle / rise) * 24;
      this.px(o.x, y, 'sand', 0.8, 1, 2);
      return;
    }
    const t = (cycle - rise) / (FX.fireworkMs - rise);
    const r = 2 + t * 9;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.px(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r + t * t * 4, c, 0.85 * (1 - t));
    }
    if (t < 0.2) this.px(o.x - 1, o.y - 1, 'mist', 0.6, 3, 3);
  }

  private lanterns(delta: number, f: EffectFrame): void {
    const W = this.L.width;
    const spawn = (anywhere: boolean): Particle => ({
      x: Math.random() * W,
      y: anywhere ? Math.random() * this.L.horizonY : this.L.horizonY + 4,
      vx: 0,
      vy: -0.004 - Math.random() * 0.003,
      t: Math.random() * 10,
    });
    const ps = this.pool('lanterns', FX.lanterns, () => spawn(true));
    ps.forEach((p, i) => {
      p.t += delta / 1000;
      p.y += p.vy * delta;
      p.x += Math.sin(p.t * 0.6) * 0.003 * delta + f.wind * 0.005 * delta;
      if (p.y < -4) ps[i] = spawn(false);
      const fade = Math.min(1, p.y / (this.L.horizonY * 0.4));
      this.px(p.x, p.y, 'gold', 0.9 * fade, 1, 2);
      this.px(p.x - 1, p.y, 'gold', 0.2 * fade, 3, 3);
    });
  }
}
