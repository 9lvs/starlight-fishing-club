// Pixel text built on the baked bitmap font. Optional 1px shadow keeps text
// readable over the moving sky without outlines that eat letter space.
import Phaser from 'phaser';
import { color, TYPOGRAPHY, type PaletteName } from '../design/tokens';

export interface TextOptions {
  color?: PaletteName;
  shadow?: PaletteName | false;
  scale?: number;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  originX?: number;
  originY?: number;
}

const ALIGN = { left: 0, center: 1, right: 2 } as const;

export class PixelText extends Phaser.GameObjects.Container {
  readonly main: Phaser.GameObjects.BitmapText;
  private shade: Phaser.GameObjects.BitmapText | null = null;
  private opts: Required<Omit<TextOptions, 'shadow' | 'maxWidth'>> & { shadow: PaletteName | false; maxWidth: number };

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, opts: TextOptions = {}) {
    super(scene, Math.round(x), Math.round(y));
    this.opts = {
      color: opts.color ?? 'mist',
      shadow: opts.shadow === undefined ? 'ink' : opts.shadow,
      scale: opts.scale ?? 1,
      align: opts.align ?? 'left',
      maxWidth: opts.maxWidth ?? 0,
      originX: opts.originX ?? 0,
      originY: opts.originY ?? 0,
    };
    if (this.opts.shadow) {
      this.shade = this.makeText(text, this.opts.shadow);
      this.shade.setPosition(this.opts.scale, this.opts.scale);
      this.add(this.shade);
    }
    this.main = this.makeText(text, this.opts.color);
    this.add(this.main);
    this.applyOrigin();
    scene.add.existing(this);
  }

  private makeText(text: string, c: PaletteName): Phaser.GameObjects.BitmapText {
    const t = new Phaser.GameObjects.BitmapText(this.scene, 0, 0, TYPOGRAPHY.bitmapKey, text);
    t.setScale(this.opts.scale);
    t.setTint(color(c));
    t.align = ALIGN[this.opts.align];
    if (this.opts.maxWidth > 0) t.setMaxWidth(Math.floor(this.opts.maxWidth / this.opts.scale));
    return t;
  }

  /** Whole-pixel origin so centered text never lands on half pixels. */
  private applyOrigin(): void {
    const w = this.main.width;
    const h = this.main.height;
    const ox = -Math.round(w * this.opts.originX);
    const oy = -Math.round(h * this.opts.originY);
    this.main.setPosition(ox, oy);
    this.shade?.setPosition(ox + this.opts.scale, oy + this.opts.scale);
  }

  setText(text: string): this {
    if (this.main.text === text) return this;
    this.main.setText(text);
    this.shade?.setText(text);
    this.applyOrigin();
    return this;
  }

  get text(): string {
    return this.main.text;
  }

  setColor(c: PaletteName): this {
    this.opts.color = c;
    this.main.setTint(color(c));
    return this;
  }

  get textWidth(): number {
    return this.main.width;
  }

  get textHeight(): number {
    return this.main.height;
  }
}

export function addText(scene: Phaser.Scene, x: number, y: number, text: string, opts: TextOptions = {}): PixelText {
  return new PixelText(scene, x, y, text, opts);
}
