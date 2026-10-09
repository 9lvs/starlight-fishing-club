// Small floating label. Shown on hover with a mouse and on long-press on touch.
import Phaser from 'phaser';
import { drawPanelBox } from './pixelDraw';
import { addText } from './text';

export class Tooltip extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, text: string, maxWidth = 110) {
    super(scene, 0, 0);
    const label = addText(scene, 4, 3, text, { maxWidth, shadow: false, color: 'mist' });
    const w = label.textWidth + 8;
    const h = label.textHeight + 6;
    const g = scene.add.graphics();
    drawPanelBox(g, 0, 0, w, h, { fill: 'ink', border: 'slate' });
    this.add([g, label]);
    // Keep inside the screen.
    const sw = scene.scale.width;
    const px = Math.max(2, Math.min(sw - w - 2, Math.round(x - w / 2)));
    const py = Math.max(2, Math.round(y - h - 4));
    this.setPosition(px, py);
    this.setDepth(1000);
    scene.add.existing(this);
  }
}

/** Attach hover and long-press tooltip behaviour to any interactive object. */
export function attachTooltip(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, text: () => string): void {
  let tip: Tooltip | null = null;
  let timer: Phaser.Time.TimerEvent | null = null;
  const show = (p: Phaser.Input.Pointer) => {
    tip?.destroy();
    tip = new Tooltip(scene, p.x, p.y - 4, text());
  };
  const hide = () => {
    timer?.remove();
    timer = null;
    tip?.destroy();
    tip = null;
  };
  target.on('pointerover', (p: Phaser.Input.Pointer) => {
    if (!p.wasTouch) show(p);
  });
  target.on('pointerdown', (p: Phaser.Input.Pointer) => {
    if (p.wasTouch) timer = scene.time.delayedCall(450, () => show(p));
  });
  target.on('pointerout', hide);
  target.on('pointerup', hide);
  target.once('destroy', hide);
}
