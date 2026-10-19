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
      case 'minnows':
        return this.minnows(reduced);
      case 'moon':
        return this.glints(reduced, ['mist', 'sky'], 0.5);
      case 'golden':
        return this.glints(reduced, ['gold', 'sand'], 0.75);
      case 'lanterns':
        return this.lanterns(reduced);
    }
  }

  private px(x: number, y: number, c: PaletteName, a = 1, w = 1): void {
    this.g.fillStyle(color(c), a * this.k);
    this.g.fillRect(Math.round(x), Math.round(y), w, 1);
  }

  /** A loose school of small fish crossing the water, looping round. */
  private minnows(reduced: boolean): void {
    const { width: W, horizonY, waterlineY } = this.L;
    const t = reduced ? 0.4 : (this.elapsed / 14000) % 1;
    const cx = -30 + t * (W + 60);
    const cy = horizonY + (waterlineY - horizonY) * 0.55;
    for (let i = 0; i < 22; i++) {
      const ox = ((i * 37) % 41) - 20;
      const oy = ((i * 23) % 13) - 6;
      const wig = reduced ? 0 : Math.round(Math.sin(this.elapsed / 180 + i) * 1);
      // A dark back with a silver glint, so the school reads on any water.
      this.px(cx + ox, cy + oy + wig, 'ink', 0.55, 3);
      this.px(cx + ox + 1, cy + oy + wig - 1, i % 3 === 0 ? 'mist' : 'sky', 0.9, 1);
    }
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

  /** Paper lanterns drifting up from the far shore, with a soft warm glow. */
  private lanterns(reduced: boolean): void {
    const { width: W, horizonY } = this.L;
    for (let i = 0; i < 7; i++) {
      const life = 16000 + i * 1300;
      const t = reduced ? 0.3 + i * 0.08 : ((this.elapsed + i * 2900) % life) / life;
      const x = ((i * 47) % 100) / 100 * (W - 20) + 10 + (reduced ? 0 : Math.sin(this.elapsed / 1500 + i) * 3);
      const y = horizonY - 4 - t * horizonY * 0.7;
      const fade = Math.min(1, t * 6, (1 - t) * 4);
      this.g.fillStyle(color('gold'), 0.2 * fade * this.k);
      this.g.fillRect(Math.round(x) - 3, Math.round(y) - 3, 9, 10);
      this.g.fillStyle(color('gold'), 0.25 * fade * this.k);
      this.g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 5, 6);
      this.px(x, y, i % 2 ? 'coral' : 'gold', fade, 3);
      this.px(x, y + 1, i % 2 ? 'coral' : 'gold', fade, 3);
      this.px(x, y + 2, i % 2 ? 'coral' : 'gold', fade, 3);
      this.px(x + 1, y + 3, 'sand', fade * 0.8, 1);
    }
  }
}
