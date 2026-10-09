// Pixel button with normal, hover, pressed, disabled, and highlighted states.
// The hit area never drops below the minimum touch target. Clicks fire on
// release and are cancelled if the pointer moved (so scrolling never clicks).
import Phaser from 'phaser';
import { UI, UI_COLORS, color, type PaletteName } from '../design/tokens';
import { addIcon } from './Icon';
import { drawPanelBox } from './pixelDraw';
import { addText, type PixelText } from './text';
import { uiSignals } from './uiSignals';
import type { Rect } from '../core/layout';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonState = 'normal' | 'hover' | 'pressed' | 'disabled';

export interface ButtonOptions {
  x: number;
  y: number;
  w: number;
  h?: number;
  label?: string;
  icon?: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  onClick: () => void;
  /** Fire on press instead of release. Used where timing matters (reeling in). */
  fireOnDown?: boolean;
}

const DRAG_CANCEL_PX = 6;

const STYLES: Record<ButtonVariant, Record<ButtonState, { fill: PaletteName; border: PaletteName; text: PaletteName }>> = {
  primary: {
    normal: { fill: UI_COLORS.primaryFill, border: 'rose', text: UI_COLORS.primaryText },
    hover: { fill: UI_COLORS.primaryFillHover, border: 'coral', text: UI_COLORS.primaryText },
    pressed: { fill: 'rose', border: 'plum', text: UI_COLORS.primaryText },
    disabled: { fill: UI_COLORS.buttonFillDisabled, border: 'dusk', text: UI_COLORS.buttonTextDisabled },
  },
  secondary: {
    normal: { fill: UI_COLORS.buttonFill, border: 'sky', text: UI_COLORS.buttonText },
    hover: { fill: UI_COLORS.buttonFillHover, border: 'mist', text: UI_COLORS.buttonText },
    pressed: { fill: UI_COLORS.buttonFillPressed, border: 'sky', text: UI_COLORS.buttonText },
    disabled: { fill: UI_COLORS.buttonFillDisabled, border: 'dusk', text: UI_COLORS.buttonTextDisabled },
  },
  ghost: {
    normal: { fill: 'midnight', border: 'midnight', text: UI_COLORS.buttonText },
    hover: { fill: 'dusk', border: 'dusk', text: UI_COLORS.buttonText },
    pressed: { fill: 'ink', border: 'ink', text: UI_COLORS.buttonText },
    disabled: { fill: 'midnight', border: 'midnight', text: UI_COLORS.buttonTextDisabled },
  },
};

export class Button extends Phaser.GameObjects.Container {
  private gfx: Phaser.GameObjects.Graphics;
  private labelText: PixelText | null = null;
  private iconImg: Phaser.GameObjects.Image | null = null;
  private zone: Phaser.GameObjects.Zone;
  private state_: ButtonState = 'normal';
  private disabled: boolean;
  private highlighted = false;
  private downAt: { x: number; y: number } | null = null;
  private readonly bw: number;
  private readonly bh: number;
  private readonly variant: ButtonVariant;
  /** Clicks only count inside this rect (set by ScrollArea). */
  clip: Rect | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly opts: ButtonOptions,
  ) {
    super(scene, Math.round(opts.x), Math.round(opts.y));
    this.bw = Math.round(opts.w);
    this.bh = Math.round(opts.h ?? UI.buttonHeight);
    this.variant = opts.variant ?? 'secondary';
    this.disabled = !!opts.disabled;
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    if (opts.icon) {
      this.iconImg = addIcon(scene, 0, 0, opts.icon);
      this.add(this.iconImg);
    }
    if (opts.label) {
      this.labelText = addText(scene, 0, 0, opts.label, { shadow: false, originX: 0.5, originY: 0.5 });
      this.add(this.labelText);
    }
    // Grow the hit area to the minimum touch size around the visual box.
    const hitW = Math.max(this.bw, UI.minTouch);
    const hitH = Math.max(this.bh, UI.minTouch);
    this.zone = scene.add.zone((this.bw - hitW) / 2, (this.bh - hitH) / 2, hitW, hitH).setOrigin(0, 0);
    this.zone.setInteractive({ useHandCursor: true });
    this.add(this.zone);
    this.bindInput();
    this.redraw();
    scene.add.existing(this);
  }

  private bindInput(): void {
    this.zone.on('pointerover', () => this.setVisualState('hover'));
    this.zone.on('pointerout', () => {
      this.downAt = null;
      this.setVisualState('normal');
    });
    this.zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.insideClip(p)) return;
      this.downAt = { x: p.x, y: p.y };
      this.setVisualState('pressed');
      if (this.opts.fireOnDown && !this.disabled) {
        this.downAt = null;
        uiSignals.click();
        this.opts.onClick();
      }
    });
    this.zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      const down = this.downAt;
      this.downAt = null;
      this.setVisualState(p.wasTouch ? 'normal' : 'hover');
      if (!down || this.disabled || !this.insideClip(p)) return;
      if (Math.hypot(p.x - down.x, p.y - down.y) > DRAG_CANCEL_PX) return;
      uiSignals.click();
      this.opts.onClick();
    });
  }

  private insideClip(p: Phaser.Input.Pointer): boolean {
    if (!this.clip) return true;
    const c = this.clip;
    return p.x >= c.x && p.x < c.x + c.w && p.y >= c.y && p.y < c.y + c.h;
  }

  private setVisualState(s: ButtonState): void {
    this.state_ = s;
    this.redraw();
  }

  private redraw(): void {
    const s = this.disabled ? 'disabled' : this.state_;
    const st = STYLES[this.variant][s];
    const pressed = s === 'pressed' ? 1 : 0;
    this.gfx.clear();
    drawPanelBox(this.gfx, 0, pressed, this.bw, this.bh - pressed, {
      fill: st.fill,
      border: this.highlighted && !this.disabled ? 'gold' : st.border,
      highlight: s === 'pressed' || this.variant === 'ghost' ? undefined : SHADE_HI[st.fill],
    });
    if (!pressed && this.variant !== 'ghost') {
      this.gfx.fillStyle(color('ink'), 0.5);
      this.gfx.fillRect(1, this.bh, this.bw - 2, 1);
    }
    const cy = Math.floor(this.bh / 2) + pressed;
    if (this.iconImg && this.labelText) {
      const total = 12 + 3 + this.labelText.textWidth;
      const left = Math.round((this.bw - total) / 2);
      this.iconImg.setPosition(left, cy - 6);
      this.labelText.setPosition(left + 15 + Math.round(this.labelText.textWidth / 2), cy);
    } else if (this.iconImg) {
      this.iconImg.setPosition(Math.round((this.bw - 12) / 2), cy - 6);
    } else if (this.labelText) {
      this.labelText.setPosition(Math.round(this.bw / 2), cy);
    }
    this.labelText?.setColor(st.text);
    this.iconImg?.setAlpha(this.disabled ? 0.5 : 1);
  }

  setLabel(label: string): this {
    this.labelText?.setText(label);
    this.redraw();
    return this;
  }

  setDisabled(disabled: boolean): this {
    if (this.disabled === disabled) return this;
    this.disabled = disabled;
    this.redraw();
    return this;
  }

  setHighlighted(on: boolean): this {
    if (this.highlighted === on) return this;
    this.highlighted = on;
    this.redraw();
    return this;
  }

  /** The interactive zone, for attaching tooltips. */
  get hit(): Phaser.GameObjects.Zone {
    return this.zone;
  }

  get isDisabled(): boolean {
    return this.disabled;
  }

  get buttonWidth(): number {
    return this.bw;
  }

  get buttonHeight(): number {
    return this.bh;
  }

  /** Force a visual state, used by the style guide to show every state. */
  showState(s: ButtonState): this {
    if (s === 'disabled') this.setDisabled(true);
    else this.setVisualState(s);
    return this;
  }
}

const SHADE_HI: Partial<Record<PaletteName, PaletteName>> = {
  coral: 'gold',
  gold: 'sand',
  rose: 'coral',
  dusk: 'slate',
  slate: 'sky',
  midnight: 'dusk',
};
