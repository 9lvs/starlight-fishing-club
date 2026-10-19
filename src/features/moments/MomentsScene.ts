// Draws the water moment while it lasts, and a small note of what it is and
// how long it has left under the water's name. Presentation only; reduced
// motion keeps the pictures still.
import Phaser from 'phaser';
import { getContext, type GameContext } from '../../core/context';
import { getLayout, type Layout } from '../../core/layout';
import { color, type PaletteName } from '../../design/tokens';
import { formatCountdown } from '../../ui/format';
import { addText, type PixelText } from '../../ui/text';
import { uiSignals } from '../../ui/uiSignals';
import { getMoments } from './service';

/** The note waits until the opening toast has gone. */
const NOTE_DELAY_MS = 4500;

export class MomentsScene extends Phaser.Scene {
  private ctx!: GameContext;
  private L!: Layout;
  private g!: Phaser.GameObjects.Graphics;
  private note!: PixelText;
  private elapsed = 0;
  /** Strength 0..1, so a moment eases in and out instead of popping. */
  private k = 0;
  private visual = 'none';

  constructor() {
    super('Moments');
  }

  create(): void {
    this.ctx = getContext();
    this.L = getLayout();
    this.g = this.add.graphics();
    this.note = addText(this, this.L.width / 2, this.L.topBar.y + this.L.topBar.h + 15, '', { color: 'sky', originX: 0.5, outline: 'ink' });
    const off = this.ctx.bus.on('viewportChanged', () => this.scene.restart());
    this.events.once('shutdown', off);
  }

  override update(_t: number, delta: number): void {
    this.elapsed += delta;
    const a = getMoments().active;
    if (a) this.visual = a.def.visual;
    this.k = Math.max(0, Math.min(1, this.k + (a ? delta : -delta) / 1500));
    const shown = a && a.def.durationMs - a.left > NOTE_DELAY_MS;
    this.note.setText(shown ? `${a.def.name}  ${formatCountdown(a.left)}` : '');
    this.g.clear();
    if (this.k <= 0) return;
    const reduced = uiSignals.reducedMotion();
    switch (this.visual) {
      case 'moon':
        return this.glints(reduced, ['mist', 'sky'], 0.5);
      case 'golden':
        return this.glints(reduced, ['gold', 'sand'], 0.75);
    }
  }

  private px(x: number, y: number, c: PaletteName, a = 1, w = 1): void {
    this.g.fillStyle(color(c), a * this.k);
    this.g.fillRect(Math.round(x), Math.round(y), w, 1);
  }

  /** Light on the water: short dashes that twinkle on and off. */
  private glints(reduced: boolean, colors: PaletteName[], spread: number): void {
    const { width: W, horizonY, menuBar } = this.L;
    const top = horizonY + 4;
    const h = menuBar.y - 60 - top;
    for (let i = 0; i < 48; i++) {
      // A broad path of light down the middle of the water, wider near you.
      const v = ((i * 53) % 97) / 97;
      const u = (((i * 31) % 89) / 89 - 0.5) * spread * (0.4 + v);
      const on = reduced || Math.floor(this.elapsed / 300 + i * 1.3) % 4 !== 0;
      if (!on) continue;
      this.px(W / 2 + u * W, top + v * h, colors[i % colors.length]!, 0.95, 2 + (i % 3));
    }
  }

}
