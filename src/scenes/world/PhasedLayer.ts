// One parallax layer backed by a canvas texture. When the palette changes
// (time of day or a new water), it dissolves to the new look with an ordered
// dither instead of an alpha fade, so every frame stays on the palette.
import Phaser from 'phaser';
import type { ScenePalette } from '../../design/tokens';
import { bayer, type Painter, type SceneShape } from './painters';

let uid = 0;

export class PhasedLayer {
  readonly key: string;
  readonly texture: Phaser.Textures.CanvasTexture;
  private from: ImageData | null = null;
  private to: ImageData | null = null;
  private step = 16;

  constructor(
    scene: Phaser.Scene,
    readonly width: number,
    readonly height: number,
    private readonly painter: Painter,
  ) {
    this.key = `layer_${uid++}`;
    const tex = scene.textures.createCanvas(this.key, Math.max(1, width), Math.max(1, height));
    if (!tex) throw new Error('could not create layer texture');
    this.texture = tex;
  }

  private paint(pal: ScenePalette, shape: SceneShape): ImageData {
    const c = document.createElement('canvas');
    c.width = Math.max(1, this.width);
    c.height = Math.max(1, this.height);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2d canvas is not available');
    this.painter(ctx, this.width, this.height, pal, shape);
    return ctx.getImageData(0, 0, c.width, c.height);
  }

  /** Draw immediately with no transition. */
  set(pal: ScenePalette, shape: SceneShape): void {
    this.to = this.paint(pal, shape);
    this.from = null;
    this.step = 16;
    this.blit(this.to);
  }

  /** Start dissolving toward a new look. Call advance() to step it. */
  transition(pal: ScenePalette, shape: SceneShape): void {
    const current = this.texture.context.getImageData(0, 0, this.texture.width, this.texture.height);
    this.from = current;
    this.to = this.paint(pal, shape);
    this.step = 0;
  }

  get transitioning(): boolean {
    return this.from !== null && this.step < 16;
  }

  /** Move one dither step (of 16) toward the target. */
  advance(steps = 1): void {
    if (!this.from || !this.to) return;
    this.step = Math.min(16, this.step + steps);
    if (this.step >= 16) {
      this.blit(this.to);
      this.from = null;
      return;
    }
    const out = new ImageData(this.width, this.height);
    const a = this.from.data;
    const b = this.to.data;
    const o = out.data;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = (y * this.width + x) * 4;
        const src = bayer(x, y) < this.step ? b : a;
        o[i] = src[i]!;
        o[i + 1] = src[i + 1]!;
        o[i + 2] = src[i + 2]!;
        o[i + 3] = src[i + 3]!;
      }
    }
    this.blit(out);
  }

  private blit(data: ImageData): void {
    this.texture.context.clearRect(0, 0, this.width, this.height);
    this.texture.context.putImageData(data, 0, 0);
    this.texture.refresh();
  }

  destroy(scene: Phaser.Scene): void {
    if (scene.textures.exists(this.key)) scene.textures.remove(this.key);
  }
}
