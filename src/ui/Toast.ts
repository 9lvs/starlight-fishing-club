// Gentle notifications that slide in under the top bar and fade away.
import Phaser from 'phaser';
import { MOTION } from '../design/tokens';
import { UI_TIMING } from '../config/tuning';
import { drawPanelBox } from './pixelDraw';
import { addText } from './text';
import { addIcon } from './Icon';
import { uiSignals } from './uiSignals';
import type { PaletteName } from '../design/tokens';

export interface ToastItem {
  text: string;
  icon?: string;
  color?: PaletteName;
}

export class ToastLayer {
  private active: Phaser.GameObjects.Container[] = [];
  private queue: ToastItem[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private x: number,
    private y: number,
    private readonly maxVisible = UI_TIMING.toastStackMax,
  ) {}

  setAnchor(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  push(item: ToastItem): void {
    this.queue.push(item);
    this.pump();
  }

  private pump(): void {
    while (this.active.length < this.maxVisible && this.queue.length > 0) {
      this.show(this.queue.shift()!);
    }
  }

  private show(item: ToastItem): void {
    const s = this.scene;
    const label = addText(s, item.icon ? 18 : 5, 4, item.text, { color: item.color ?? 'mist', shadow: false, maxWidth: 150 });
    const w = Math.min(170, label.textWidth + (item.icon ? 24 : 10));
    const h = Math.max(16, label.textHeight + 8);
    const g = s.add.graphics();
    drawPanelBox(g, 0, 0, w, h, { fill: 'ink', border: 'dusk', highlight: 'midnight' });
    const parts: Phaser.GameObjects.GameObject[] = [g, label];
    if (item.icon) parts.push(addIcon(s, 4, Math.round((h - 12) / 2), item.icon));
    const index = this.active.length;
    const c = s.add.container(Math.round(this.x - w / 2), this.y + index * (h + 2), parts).setDepth(900);
    this.active.push(c);
    const reduced = uiSignals.reducedMotion();
    c.setAlpha(0);
    if (!reduced) c.y -= 4;
    s.tweens.add({ targets: c, alpha: 1, y: this.y + index * (h + 2), duration: MOTION.toastIn, ease: MOTION.easeOut });
    s.time.delayedCall(MOTION.toastIn + MOTION.toastHold, () => {
      s.tweens.add({
        targets: c,
        alpha: 0,
        duration: MOTION.toastOut,
        ease: MOTION.ease,
        onComplete: () => {
          c.destroy();
          this.active = this.active.filter((a) => a !== c);
          this.restack();
          this.pump();
        },
      });
    });
  }

  private restack(): void {
    let y = this.y;
    for (const c of this.active) {
      this.scene.tweens.add({ targets: c, y, duration: 200, ease: MOTION.easeOut });
      y += (c.getBounds().height || 16) + 2;
    }
  }
}
