// A framed panel with an optional title bar and close button.
import Phaser from 'phaser';
import { UI, UI_COLORS } from '../design/tokens';
import { Button } from './Button';
import { drawPanelBox } from './pixelDraw';
import { addText, type PixelText } from './text';

export interface PanelOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  icon?: string;
  onClose?: () => void;
}

export const PANEL_TITLE_H = 18;

export class Panel extends Phaser.GameObjects.Container {
  readonly gfx: Phaser.GameObjects.Graphics;
  title: PixelText | null = null;
  closeButton: Button | null = null;
  readonly panelW: number;
  readonly panelH: number;

  constructor(scene: Phaser.Scene, opts: PanelOptions) {
    super(scene, Math.round(opts.x), Math.round(opts.y));
    this.panelW = opts.w;
    this.panelH = opts.h;
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    drawPanelBox(this.gfx, 0, 0, opts.w, opts.h, {
      fill: UI_COLORS.panelFill,
      border: UI_COLORS.panelBorder,
      highlight: 'dusk',
      shadow: 'ink',
    });
    if (opts.title) {
      drawPanelBox(this.gfx, 2, 2, opts.w - 4, PANEL_TITLE_H - 2, { fill: 'dusk', border: 'dusk', highlight: 'slate' });
      let tx = UI.panelPadding;
      if (opts.icon) {
        this.add(scene.add.image(tx, 4, opts.icon).setOrigin(0, 0));
        tx += 15;
      }
      this.title = addText(scene, tx, 5, opts.title, { color: 'mist', shadow: 'midnight' });
      this.add(this.title);
    }
    if (opts.onClose) {
      this.closeButton = new Button(scene, {
        x: opts.w - 18,
        y: 2,
        w: 16,
        h: 16,
        icon: 'icon_close',
        variant: 'ghost',
        onClick: opts.onClose,
      });
      this.add(this.closeButton);
    }
    scene.add.existing(this);
  }

  /** Inner content rect in panel-local coordinates. */
  get content(): { x: number; y: number; w: number; h: number } {
    const top = this.title ? PANEL_TITLE_H + 2 : UI.panelPadding;
    return { x: UI.panelPadding, y: top, w: this.panelW - UI.panelPadding * 2, h: this.panelH - top - UI.panelPadding };
  }
}
