// Pixel text built on the baked bitmap font. A 1px shadow is the default; text
// that sits over the moving sky (coins, the water name, hints) can take a full
// 1px outline instead, so it reads on any background.
import Phaser from 'phaser';
import { color, TYPOGRAPHY, type PaletteName } from '../design/tokens';

export interface TextOptions {
  color?: PaletteName;
  shadow?: PaletteName | false;
  /** A 1px outline on all four sides (replaces the shadow). */
  outline?: PaletteName;
  scale?: number;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  originX?: number;
  originY?: number;
}

const ALIGN = { left: 0, center: 1, right: 2 } as const;
/** Outline offsets: the four sides plus the shadow corner, so it stays crisp and heavy enough. */
const OUTLINE: readonly [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [1, 1],
];

export class PixelText extends Phaser.GameObjects.Container {
  readonly main: Phaser.GameObjects.BitmapText;
  private shade: Phaser.GameObjects.BitmapText | null = null;
  private rim: Phaser.GameObjects.BitmapText[] = [];
  private opts: Required<Omit<TextOptions, 'shadow' | 'maxWidth' | 'outline'>> & {
    shadow: PaletteName | false;
    maxWidth: number;
    outline: PaletteName | null;
  };

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
      outline: opts.outline ?? null,
    };
    if (this.opts.outline) {
      this.opts.shadow = false;
      for (let i = 0; i < OUTLINE.length; i++) {
        const t = this.makeText(text, this.opts.outline);
        this.rim.push(t);
        this.add(t);
      }
    }
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
    const s = this.opts.scale;
    this.rim.forEach((t, i) => t.setPosition(ox + OUTLINE[i]![0] * s, oy + OUTLINE[i]![1] * s));
  }

  setText(text: string): this {
    if (this.main.text === text) return this;
    this.main.setText(text);
    this.shade?.setText(text);
    for (const t of this.rim) t.setText(text);
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
