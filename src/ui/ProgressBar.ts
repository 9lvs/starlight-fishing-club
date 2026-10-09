// Pixel progress bar. Fill snaps to whole pixels.
import Phaser from 'phaser';
import { UI_COLORS, color, type PaletteName } from '../design/tokens';

export class ProgressBar extends Phaser.GameObjects.Container {
  private gfx: Phaser.GameObjects.Graphics;
  private value = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly bw: number,
    private readonly bh: number,
    private fill: PaletteName = UI_COLORS.progressFill,
  ) {
    super(scene, Math.round(x), Math.round(y));
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    this.redraw();
    scene.add.existing(this);
  }

  setValue(v: number): this {
    const clamped = Math.max(0, Math.min(1, v));
    if (Math.round(clamped * (this.bw - 2)) === Math.round(this.value * (this.bw - 2))) {
      this.value = clamped;
      return this;
    }
    this.value = clamped;
    this.redraw();
    return this;
  }

  setFill(c: PaletteName): this {
    this.fill = c;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const g = this.gfx;
    g.clear();
    g.fillStyle(color('dusk'));
    g.fillRect(1, 0, this.bw - 2, this.bh);
    g.fillRect(0, 1, this.bw, this.bh - 2);
    g.fillStyle(color(UI_COLORS.progressBack));
    g.fillRect(1, 1, this.bw - 2, this.bh - 2);
    const fw = Math.round((this.bw - 2) * this.value);
    if (fw > 0) {
      g.fillStyle(color(this.fill));
      g.fillRect(1, 1, fw, this.bh - 2);
      if (this.bh > 3) {
        g.fillStyle(color('mist'), 0.35);
        g.fillRect(1, 1, fw, 1);
      }
    }
  }
}
