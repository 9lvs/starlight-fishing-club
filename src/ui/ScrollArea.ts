// Vertical scroll region with drag, inertia, and mouse wheel. Content is
// masked to the rect, and buttons inside only click within it.
import Phaser from 'phaser';
import { UI, color } from '../design/tokens';
import type { Rect } from '../core/layout';
import { Button } from './Button';

export class ScrollArea {
  readonly content: Phaser.GameObjects.Container;
  private maskGfx: Phaser.GameObjects.Graphics;
  private scrollY = 0;
  private contentHeight = 0;
  private dragging = false;
  private lastY = 0;
  private velocity = 0;
  private bar: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    readonly rect: Rect,
  ) {
    this.content = scene.add.container(rect.x, rect.y);
    this.maskGfx = scene.make.graphics({}, false);
    this.maskGfx.fillStyle(0xffffff);
    this.maskGfx.fillRect(rect.x, rect.y, rect.w, rect.h);
    this.content.setMask(this.maskGfx.createGeometryMask());
    this.bar = scene.add.graphics();

    const inside = (p: Phaser.Input.Pointer) =>
      p.x >= rect.x && p.x < rect.x + rect.w && p.y >= rect.y && p.y < rect.y + rect.h;
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!inside(p)) return;
      this.dragging = true;
      this.lastY = p.y;
      this.velocity = 0;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown) return;
      const dy = p.y - this.lastY;
      this.lastY = p.y;
      this.velocity = dy;
      this.scrollTo(this.scrollY - dy);
    });
    scene.input.on('pointerup', () => {
      this.dragging = false;
    });
    scene.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (inside(p)) this.scrollTo(this.scrollY + dy * 0.25);
    });
    scene.events.on('update', this.update, this);
    scene.events.once('shutdown', () => scene.events.off('update', this.update, this));
  }

  add(obj: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]): void {
    const list = Array.isArray(obj) ? obj : [obj];
    for (const o of list) {
      this.content.add(o);
      this.clipButtons(o);
    }
  }

  private clipButtons(o: Phaser.GameObjects.GameObject): void {
    if (o instanceof Button) o.clip = this.rect;
    else if (o instanceof Phaser.GameObjects.Container) o.list.forEach((c) => this.clipButtons(c));
  }

  setContentHeight(h: number): void {
    this.contentHeight = h;
    this.scrollTo(this.scrollY);
  }

  /** Current scroll offset, so a rebuilt panel can come back to the same place. */
  get position(): number {
    return this.scrollY;
  }

  scrollTo(y: number): void {
    const max = Math.max(0, this.contentHeight - this.rect.h);
    this.scrollY = Math.max(0, Math.min(max, y));
    this.content.y = Math.round(this.rect.y - this.scrollY);
    this.drawBar();
  }

  private update(): void {
    if (this.dragging || Math.abs(this.velocity) < 0.2) return;
    this.velocity *= UI.scrollFriction;
    this.scrollTo(this.scrollY - this.velocity);
  }

  private drawBar(): void {
    this.bar.clear();
    if (this.contentHeight <= this.rect.h) return;
    const h = Math.max(8, Math.round((this.rect.h * this.rect.h) / this.contentHeight));
    const max = this.contentHeight - this.rect.h;
    const y = this.rect.y + Math.round(((this.rect.h - h) * this.scrollY) / max);
    this.bar.fillStyle(color('slate'), 0.8);
    this.bar.fillRect(this.rect.x + this.rect.w - 2, y, 1, h);
  }

  destroy(): void {
    this.content.destroy();
    this.maskGfx.destroy();
    this.bar.destroy();
  }
}
