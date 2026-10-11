// The calm backdrop: sky, stars, sun or moon, clouds, hills, water, the boat
// with its fisher and decorations, foreground, weather, and fireflies. It only
// renders and reacts to bus events; it holds no gameplay state.
import Phaser from 'phaser';
import { getContext, type GameContext } from '../core/context';
import { getLayout, type Layout } from '../core/layout';
import { worldAnchors } from '../core/sceneState';
import { TIME } from '../config/time';
import { FISHING } from '../config/tuning';
import { MOTION, PALETTE_NAMES, SCENE_PALETTES, color, type PaletteName, type ScenePalette } from '../design/tokens';
import { FISHER_HAND, RIG_RAISE } from '../art/placeholderGenerator';
import { phaseAt } from '../systems/timeOfDay';
import { drawPixelLine } from '../ui/pixelDraw';
import { uiSignals } from '../ui/uiSignals';
import { PhasedLayer } from './world/PhasedLayer';
import {
  paintClouds,
  paintForeground,
  paintHillsFar,
  paintHillsNear,
  paintSky,
  paintWater,
  sceneSeed,
  type SceneShape,
} from './world/painters';

const ANCHORS: Record<string, { x: number; y: number; ox: number; oy: number }> = {
  mast: { x: 17, y: 3, ox: 1, oy: 0 },
  bow: { x: 28, y: 16, ox: 0.5, oy: 1 },
  stern: { x: 4, y: 17, ox: 0.5, oy: 1 },
  water: { x: 16, y: 30, ox: 0.5, oy: 0 },
  sky: { x: 16, y: -30, ox: 0.5, oy: 0.5 },
};

/** Rod length the ROD table was drawn for; rod looks give their own length. */
const ROD_BASE_LEN = 17;

function isPalette(v: unknown): v is PaletteName {
  return typeof v === 'string' && (PALETTE_NAMES as readonly string[]).includes(v);
}

/** Rod angle (radians, 0 = right, negative = up) and length per fisher pose. */
const ROD = [
  { angle: -0.95, len: 17 },
  { angle: -0.95, len: 17 },
  { angle: -0.35, len: 18 },
  { angle: -1.25, len: 16 },
];

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

export class WorldScene extends Phaser.Scene {
  private ctx!: GameContext;
  private L!: Layout;
  private layers: { layer: PhasedLayer; objs: Phaser.GameObjects.Image[]; drift: number }[] = [];
  private shapeCache!: SceneShape;
  private pal!: ScenePalette;
  private celestial!: Phaser.GameObjects.Image;
  private stars!: Phaser.GameObjects.Graphics;
  private starList: { x: number; y: number; tw: number }[] = [];
  private shimmer!: Phaser.GameObjects.Graphics;
  private boat!: Phaser.GameObjects.Container;
  private fisher!: Phaser.GameObjects.Sprite;
  private hull!: Phaser.GameObjects.Image;
  private rig!: Phaser.GameObjects.Image;
  private rod!: Phaser.GameObjects.Graphics;
  private decorations: Phaser.GameObjects.Image[] = [];
  private weatherGfx!: Phaser.GameObjects.Graphics;
  private fog: Phaser.GameObjects.TileSprite[] = [];
  private dim!: Phaser.GameObjects.Rectangle;
  private fireflyGfx!: Phaser.GameObjects.Graphics;
  private fireflies: Mote[] = [];
  private rain: Mote[] = [];
  private pose = 0;
  private poseUntil = 0;
  private elapsed = 0;
  private nextShootingStar = 0;
  private transitionTimer: Phaser.Time.TimerEvent | null = null;
  private offs: (() => void)[] = [];
  private driftAcc = 0;

  constructor() {
    super('World');
  }

  create(): void {
    this.ctx = getContext();
    this.L = getLayout();
    this.layers = [];
    this.decorations = [];
    const { width: W, height: H, horizonY } = this.L;
    this.pal = this.paletteFor(this.ctx.world.phase);
    this.shapeCache = this.shapeFor(this.ctx.world.waterId);

    // Back to front.
    this.addLayer(0, 0, W, horizonY + 8, paintSky, 0);
    this.stars = this.add.graphics();
    this.makeCelestialTextures();
    this.celestial = this.add.image(0, 0, 'world_sun').setOrigin(0.5);
    this.addLayer(0, 4, W, Math.round(horizonY * 0.75), paintClouds, 0.6, true);
    this.addLayer(0, horizonY - 56, W, 56, paintHillsFar, 0.08, true);
    this.addLayer(0, horizonY - 34, W, 34, paintHillsNear, 0.16, true);
    this.addLayer(0, horizonY, W, H - horizonY, paintWater, 0);
    this.shimmer = this.add.graphics();
    this.buildBoat();
    this.addLayer(0, this.L.menuBar.y - 56, W, 60, paintForeground, 0.3, true);
    this.weatherGfx = this.add.graphics();
    const fogTex = this.textures.exists('dither_25') ? 'dither_25' : '__WHITE';
    this.fog = [0, 1].map((i) =>
      this.add
        .tileSprite(0, Math.round(horizonY * 0.6) + i * 30, W, H - Math.round(horizonY * 0.6), fogTex)
        .setOrigin(0, 0)
        .setTint(color('mist'))
        .setAlpha(0),
    );
    this.dim = this.add.rectangle(0, 0, W, H, color('ink'), 0).setOrigin(0, 0);
    this.fireflyGfx = this.add.graphics();

    this.makeStars();
    this.applyPalette(false);
    this.applyWeather();
    this.applyDecorations();
    this.initMotes();

    const bus = this.ctx.bus;
    this.offs.push(
      bus.on('timeOfDayChanged', ({ phase }) => {
        this.pal = this.paletteFor(phase);
        this.applyPalette(true);
      }),
      bus.on('waterChanged', ({ waterId }) => {
        this.shapeCache = this.shapeFor(waterId);
        this.pal = this.paletteFor(this.ctx.world.phase);
        this.applyPalette(true);
      }),
      bus.on('weatherChanged', () => this.applyWeather()),
      bus.on('decorationsChanged', () => this.applyDecorations()),
      bus.on('lookChanged', ({ slot }) => {
        if (slot === 'boat') this.applyBoatLook();
      }),
      bus.on('cast', () => this.setPose(2, FISHING.castAnimMs)),
      bus.on('reel', () => this.setPose(3, FISHING.reelAnimMs)),
      bus.on('viewportChanged', () => this.scene.restart()),
    );
    this.events.once('shutdown', () => this.cleanup());
  }

  private cleanup(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
    this.transitionTimer?.remove();
    this.layers.forEach((l) => l.layer.destroy(this));
    this.layers = [];
  }

  private paletteFor(phase: string): ScenePalette {
    const base = SCENE_PALETTES[phase] ?? SCENE_PALETTES.day!;
    const water = this.ctx.registries.waters.tryGet(this.ctx.world.waterId);
    const tint = (water?.scene.tint[phase] ?? {}) as Partial<ScenePalette>;
    return { ...base, ...tint };
  }

  private shapeFor(waterId: string): SceneShape {
    const w = this.ctx.registries.waters.tryGet(waterId);
    return {
      hills: w?.scene.hills ?? 'rolling',
      foreground: w?.scene.foreground ?? 'reeds',
      seed: sceneSeed(waterId),
      horizonY: this.L.horizonY,
    };
  }

  private addLayer(
    x: number,
    y: number,
    w: number,
    h: number,
    painter: typeof paintSky,
    drift: number,
    tile = false,
  ): void {
    const layer = new PhasedLayer(this, w, h, painter);
    // Drifting layers use two copies side by side that wrap, because Phaser's
    // TileSprite resamples non power-of-two textures and blurs pixel art.
    const objs = [this.add.image(x, y, layer.key).setOrigin(0, 0)];
    if (tile) objs.push(this.add.image(x + w, y, layer.key).setOrigin(0, 0));
    this.layers.push({ layer, objs, drift });
  }

  private applyPalette(animated: boolean): void {
    const reduced = uiSignals.reducedMotion();
    for (const { layer } of this.layers) {
      if (animated && !reduced) layer.transition(this.pal, this.shapeCache);
      else layer.set(this.pal, this.shapeCache);
    }
    this.transitionTimer?.remove();
    if (animated && !reduced) {
      this.transitionTimer = this.time.addEvent({
        delay: TIME.transitionMs / TIME.transitionSteps,
        repeat: TIME.transitionSteps - 1,
        callback: () => this.layers.forEach(({ layer }) => layer.advance(16 / TIME.transitionSteps)),
      });
    }
    this.celestial.setTexture(this.pal.celestialKind === 'moon' ? 'world_moon' : 'world_sun');
    // Underground there is no sun or moon; the glowing specks do the work.
    this.celestial.setVisible(this.shapeCache.hills !== 'cave');
    this.drawStars();
  }

  private makeCelestialTextures(): void {
    if (this.textures.exists('world_sun')) return;
    const mk = (key: string, draw: (c: CanvasRenderingContext2D) => void) => {
      const t = this.textures.createCanvas(key, 13, 13);
      if (!t) return;
      draw(t.context);
      t.refresh();
    };
    const disc = (c: CanvasRenderingContext2D, r: number, col: PaletteName, cx = 6.5, cy = 6.5) => {
      c.fillStyle = '#' + color(col).toString(16).padStart(6, '0');
      for (let y = 0; y < 13; y++)
        for (let x = 0; x < 13; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) c.fillRect(x, y, 1, 1);
    };
    mk('world_sun', (c) => {
      disc(c, 6, 'coral');
      disc(c, 5, 'gold');
      disc(c, 2.5, 'sand', 5.5, 5.5);
    });
    mk('world_moon', (c) => {
      disc(c, 5.5, 'mist');
      disc(c, 1.2, 'sky', 4.5, 5);
      disc(c, 1, 'sky', 8, 8);
      disc(c, 0.8, 'sky', 7.5, 3.5);
    });
  }

  private makeStars(): void {
    const rng = Phaser.Math.RND;
    this.starList = [];
    const count = Math.floor((this.L.width * this.L.horizonY) / 600);
    for (let i = 0; i < count; i++) {
      this.starList.push({
        x: rng.between(0, this.L.width - 1),
        y: rng.between(0, Math.round(this.L.horizonY * 0.85)),
        tw: rng.frac(),
      });
    }
    this.drawStars();
  }

  private drawStars(): void {
    if (!this.stars) return;
    this.stars.clear();
    if (this.pal.stars <= 0) return;
    for (const s of this.starList) {
      if (s.tw > this.pal.stars) continue;
      const bright = Math.sin(this.elapsed / 900 + s.tw * 40) > 0.6;
      this.stars.fillStyle(color(bright ? 'mist' : s.tw > 0.5 ? 'sky' : 'gold'), bright ? 1 : 0.7);
      this.stars.fillRect(s.x, s.y, 1, 1);
    }
  }

  private buildBoat(): void {
    const { boat } = this.L;
    const top = boat.y - 23;
    this.boat = this.add.container(boat.x - 16, top);
    this.fisher = this.add.sprite(5, -2, 'fisher', 0).setOrigin(0, 0);
    this.rod = this.add.graphics();
    // Mast and sail sit behind the fisher; the hull sits in front.
    this.rig = this.add.image(0, -RIG_RAISE, '__DEFAULT').setOrigin(0, 0).setVisible(false);
    this.hull = this.add.image(0, 0, 'boat').setOrigin(0, 0);
    this.boat.add([this.rig, this.rod, this.fisher, this.hull]);
    this.applyBoatLook();
  }

  /** The best boat tier owned (a look from upgrades), or the starter boat. */
  private applyBoatLook(): void {
    const look = this.ctx.world.look('boat');
    const sprite = typeof look?.sprite === 'string' && this.textures.exists(look.sprite) ? look.sprite : 'boat';
    const rig = typeof look?.rig === 'string' && this.textures.exists(look.rig) ? look.rig : null;
    this.hull.setTexture(sprite);
    this.rig.setVisible(!!rig);
    if (rig) this.rig.setTexture(rig);
  }

  private applyDecorations(): void {
    this.decorations.forEach((d) => d.destroy());
    this.decorations = [];
    for (const id of this.ctx.world.activeDecorations()) {
      const def = this.ctx.registries.decorations.tryGet(id);
      if (!def || !this.textures.exists(def.spriteKey)) continue;
      const a = ANCHORS[def.anchor] ?? ANCHORS.bow!;
      const img = this.add
        .image(a.x + def.offset[0], a.y + def.offset[1], def.spriteKey)
        .setOrigin(a.ox, a.oy);
      this.boat.add(img);
      this.decorations.push(img);
    }
  }

  private applyWeather(): void {
    const w = this.ctx.registries.weather.tryGet(this.ctx.world.weather);
    const v = w?.visuals ?? { rain: 0, fog: 0, clouds: 0.3, dim: 0 };
    const reduced = uiSignals.reducedMotion();
    const cloudLayer = this.layers[1];
    if (cloudLayer) this.tweens.add({ targets: cloudLayer.objs, alpha: 0.35 + v.clouds * 0.65, duration: 3000 });
    this.fog.forEach((f, i) => this.tweens.add({ targets: f, alpha: v.fog * (i === 0 ? 0.7 : 0.45), duration: 4000 }));
    this.tweens.add({ targets: this.dim, alpha: v.dim * 0.4, duration: 4000 });
    const target = Math.round(v.rain * (reduced ? 30 : 70));
    while (this.rain.length < target) this.rain.push(this.newDrop(true));
    this.rain.length = target;
  }

  private newDrop(anywhere: boolean): Mote {
    return {
      x: Phaser.Math.Between(-20, this.L.width),
      y: anywhere ? Phaser.Math.Between(0, this.L.height) : Phaser.Math.Between(-20, 0),
      vx: 0.012,
      vy: 0.09 + Math.random() * 0.03,
      phase: 0,
    };
  }

  private initMotes(): void {
    this.fireflies = [];
    for (let i = 0; i < 10; i++) {
      this.fireflies.push({
        x: Math.random() * this.L.width,
        y: this.L.horizonY + 10 + Math.random() * (this.L.height - this.L.horizonY - 40),
        vx: 0,
        vy: 0,
        phase: Math.random() * Math.PI * 2,
      });
    }
    this.nextShootingStar = 15000 + Math.random() * 30000;
  }

  private setPose(frame: number, ms: number): void {
    this.pose = frame;
    this.poseUntil = this.elapsed + ms;
  }

  override update(_time: number, delta: number): void {
    this.elapsed += delta;
    const reduced = uiSignals.reducedMotion();
    const { width: W, height: H, horizonY } = this.L;

    // Gentle drift of tiled layers reads as the boat slowly floating along.
    if (!reduced) {
      this.driftAcc += delta / 1000;
      for (const l of this.layers) {
        if (l.objs.length < 2 || l.drift <= 0) continue;
        const w = l.layer.width;
        const off = Math.round(this.driftAcc * l.drift) % w;
        l.objs[0]!.x = -off;
        l.objs[1]!.x = w - off;
      }
      this.fog.forEach((f, i) => (f.tilePositionX = Math.round(this.driftAcc * (i === 0 ? 1.2 : -0.7))));
    }

    // Sun or moon moves along an arc over its phase.
    const info = phaseAt(this.ctx.clock.now(), TIME);
    const isNight = this.pal.celestialKind === 'moon';
    let t = info.progress;
    if (info.id === 'dusk') t = 0.75 + t * 0.25;
    else if (info.id === 'dawn') t = t * 0.25;
    else if (!isNight && info.id !== 'day') t = 0.5;
    const cx = Math.round(12 + t * (W - 24));
    const cy = Math.round(horizonY - 10 - Math.sin(t * Math.PI) * (horizonY * 0.6));
    this.celestial.setPosition(cx, cy);

    // Boat bob.
    const bob = reduced ? 0 : Math.round(Math.sin((this.elapsed / MOTION.bobPeriod) * Math.PI * 2) * FISHING.bobAmplitude);
    this.boat.y = this.L.boat.y - 23 + bob;
    worldAnchors.bob = bob;

    // Fisher pose and rod.
    if (this.elapsed > this.poseUntil) this.pose = Math.floor(this.elapsed / 1300) % 2 === 0 || reduced ? 0 : 1;
    this.fisher.setFrame(this.pose);
    this.drawRod();

    if (Math.floor(this.elapsed / 250) !== Math.floor((this.elapsed - delta) / 250)) {
      this.drawStars();
      this.drawShimmer(cx);
    }
    this.updateWeather(delta, W, H);
    this.updateFireflies(delta, reduced);
    if (!reduced && isNight && this.shapeCache.hills !== 'cave') this.updateShootingStar(delta);
  }

  private drawRod(): void {
    const hand = FISHER_HAND[this.pose] ?? FISHER_HAND[0]!;
    const rod = ROD[this.pose] ?? ROD[0]!;
    // Better rods are longer and take on their own colors (rod tier looks).
    const look = this.ctx.world.look('rod');
    const len = rod.len + (typeof look?.length === 'number' ? look.length - ROD_BASE_LEN : 0);
    const shaft = isPalette(look?.color) ? look.color : 'bark';
    const tip = isPalette(look?.tip) ? look.tip : 'sand';
    const hx = 5 + hand.x;
    const hy = -2 + hand.y;
    const tx = Math.round(hx + Math.cos(rod.angle) * len);
    const ty = Math.round(hy + Math.sin(rod.angle) * len);
    this.rod.clear();
    drawPixelLine(this.rod, hx, hy, tx, ty, shaft);
    this.rod.fillStyle(color(tip));
    this.rod.fillRect(tx, ty, 1, 1);
    // A small reel on rods from the third tier up.
    if (typeof look?.priority === 'number' && look.priority >= 3) {
      this.rod.fillStyle(color(tip));
      this.rod.fillRect(hx + 1, hy - 2, 1, 1);
    }
    worldAnchors.rodTip.x = this.boat.x + tx;
    worldAnchors.rodTip.y = this.boat.y + ty;
  }

  private drawShimmer(celestialX: number): void {
    const g = this.shimmer;
    const { width: W, height: H, horizonY } = this.L;
    g.clear();
    const shine = this.pal.waterShine;
    // Reflection column under the sun or moon (none underground).
    for (let i = 0; i < (this.shapeCache.hills === 'cave' ? 0 : 6); i++) {
      const y = horizonY + 2 + i * 3 + (i > 2 ? i : 0);
      const len = 2 + ((i * 7 + Math.floor(this.elapsed / 400)) % 4);
      g.fillStyle(color(shine), 0.9 - i * 0.12);
      g.fillRect(celestialX - Math.floor(len / 2), y, len, 1);
    }
    // Twinkling streaks scattered over the water.
    const n = Math.floor(W / 14);
    const slot = Math.floor(this.elapsed / 700);
    for (let i = 0; i < n; i++) {
      const seed = (i * 9301 + slot * 49297) % 233280;
      const r = seed / 233280;
      if (r > 0.55) continue;
      const x = Math.floor(((i * 37 + slot * 13) % W) as number);
      const y = horizonY + 6 + Math.floor(r * (H - horizonY - 30));
      g.fillStyle(color(shine), 0.5 + r * 0.5);
      g.fillRect(x, y, 2 + Math.floor(r * 5), 1);
    }
    // Ripple lines either side of the hull.
    const bx = this.L.boat.x;
    const by = this.L.boat.y + 3;
    const spread = Math.floor(this.elapsed / 500) % 3;
    g.fillStyle(color(shine), 0.8);
    g.fillRect(bx - 18 - spread, by, 4, 1);
    g.fillRect(bx + 14 + spread, by - 1, 4, 1);
  }

  private updateWeather(delta: number, W: number, H: number): void {
    const g = this.weatherGfx;
    g.clear();
    if (this.rain.length === 0) return;
    g.fillStyle(color('sky'), 0.8);
    for (let i = 0; i < this.rain.length; i++) {
      const d = this.rain[i]!;
      d.x += d.vx * delta;
      d.y += d.vy * delta;
      if (d.y > H || d.x > W + 4) {
        // Small splash where a drop meets the water.
        if (d.y > this.L.horizonY) g.fillRect(Math.round(d.x) - 1, Math.round(Math.min(d.y, H - 1)), 3, 1);
        this.rain[i] = this.newDrop(false);
        continue;
      }
      g.fillRect(Math.round(d.x), Math.round(d.y), 1, 3);
    }
  }

  private updateFireflies(delta: number, reduced: boolean): void {
    const g = this.fireflyGfx;
    g.clear();
    const count = Math.round(this.pal.fireflies * (reduced ? 4 : this.fireflies.length));
    for (let i = 0; i < count; i++) {
      const f = this.fireflies[i]!;
      f.phase += delta / 1000;
      if (!reduced) {
        f.x += Math.sin(f.phase * 0.7 + i) * 0.006 * delta;
        f.y += Math.cos(f.phase * 0.5 + i * 2) * 0.004 * delta;
      }
      const glow = (Math.sin(f.phase * 1.3 + i) + 1) / 2;
      if (glow < 0.25) continue;
      g.fillStyle(color('gold'), glow);
      g.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
      if (glow > 0.85) {
        g.fillStyle(color('gold'), 0.25);
        g.fillRect(Math.round(f.x) - 1, Math.round(f.y), 3, 1);
        g.fillRect(Math.round(f.x), Math.round(f.y) - 1, 1, 3);
      }
    }
  }

  private shooting: { x: number; y: number; life: number } | null = null;

  private updateShootingStar(delta: number): void {
    this.nextShootingStar -= delta;
    if (!this.shooting && this.nextShootingStar <= 0) {
      this.shooting = { x: Phaser.Math.Between(20, this.L.width - 20), y: Phaser.Math.Between(6, 40), life: 700 };
      this.nextShootingStar = 25000 + Math.random() * 35000;
    }
    if (!this.shooting) return;
    const s = this.shooting;
    s.life -= delta;
    const t = 1 - s.life / 700;
    const x = Math.round(s.x - t * 40);
    const y = Math.round(s.y + t * 16);
    for (let i = 0; i < 5; i++) {
      this.fireflyGfx.fillStyle(color(i === 0 ? 'mist' : 'sky'), (1 - i / 5) * (1 - t * 0.5));
      this.fireflyGfx.fillRect(x + i * 2, y - Math.round(i * 0.8), 1, 1);
    }
    if (s.life <= 0) this.shooting = null;
  }
}
