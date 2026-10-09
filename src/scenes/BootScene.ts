// Boot: loads real art if any, generates placeholders for every other sprite
// key, bakes the pixel font, then starts the world, feature layers, and HUD.
import Phaser from 'phaser';
import { getContext } from '../core/context';
import { generatePlaceholder, type PlaceholderHints } from '../art/placeholderGenerator';
import { resolveSprite, staticSprites, type SpriteEntry } from '../art/spriteManifest';
import { bakeBitmapFont, loadPixelFont } from '../art/fontBaker';
import { bayer } from './world/painters';

export interface BootData {
  /** Scene keys to start once assets are ready, back to front. */
  start: string[];
  onReady?: () => void;
}

export class BootScene extends Phaser.Scene {
  private entries: SpriteEntry[] = [];

  constructor() {
    super('Boot');
  }

  preload(): void {
    this.entries = collectSpriteEntries();
    for (const e of this.entries) {
      if (!e.file) continue;
      this.load.spritesheet(e.key, e.file, { frameWidth: e.width, frameHeight: e.height });
    }
    // A missing PNG falls back to its placeholder instead of breaking boot.
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn(`[art] could not load ${file.src}, using placeholder`));
  }

  create(data: BootData): void {
    const hints = collectHints();
    for (const e of this.entries) {
      if (this.textures.exists(e.key)) continue;
      addSheet(this, e.key, generatePlaceholder(e, hints), e.width, e.height, e.frames);
    }
    makeDitherTextures(this);
    loadPixelFont().then((ok) => {
      bakeBitmapFont(this, ok);
      for (const key of data.start) this.scene.launch(key);
      data.onReady?.();
      this.scene.stop();
    });
  }
}

/** Every sprite key the game might draw: the static manifest plus keys named in content. */
export function collectSpriteEntries(): SpriteEntry[] {
  const ctx = getContext();
  const keys = new Set<string>(staticSprites().map((s) => s.key));
  const r = ctx.registries;
  r.fish.list().forEach((f) => keys.add(f.spriteKey));
  r.crewTypes.list().forEach((c) => keys.add(c.spriteKey));
  r.waters.list().forEach((w) => keys.add(w.spriteKey));
  r.decorations.list().forEach((d) => keys.add(d.spriteKey));
  r.currencies.list().forEach((c) => keys.add(c.icon));
  r.weather.list().forEach((w) => keys.add(w.icon));
  r.branches.list().forEach((b) => keys.add(b.icon));
  r.upgrades.list().forEach((u) => u.icon && keys.add(u.icon));
  ctx.features.menuEntries().forEach((m) => keys.add(m.icon));
  return [...keys].map(resolveSprite);
}

function collectHints(): PlaceholderHints {
  const ctx = getContext();
  const fish = new Map(ctx.registries.fish.list().map((f) => [f.spriteKey, f.art ?? {}]));
  const water = new Map(ctx.registries.waters.list().map((w) => [w.spriteKey, { hills: w.scene.hills, foreground: w.scene.foreground }]));
  return { fish, water };
}

function addSheet(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, w: number, h: number, frames: number): void {
  const tex = scene.textures.addCanvas(key, canvas);
  if (!tex) return;
  for (let i = 0; i < frames; i++) tex.add(i, 0, i * w, 0, w, h);
}

/** Ordered-dither tiles used for fog, backdrops, and soft overlays. */
function makeDitherTextures(scene: Phaser.Scene): void {
  for (const [key, level] of [
    ['dither_25', 4],
    ['dither_50', 8],
    ['dither_75', 12],
  ] as const) {
    if (scene.textures.exists(key)) continue;
    const t = scene.textures.createCanvas(key, 4, 4);
    if (!t) continue;
    t.context.fillStyle = '#ffffff';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (bayer(x, y) < level) t.context.fillRect(x, y, 1, 1);
    t.refresh();
  }
}
