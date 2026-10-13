// Upgrade tree node in one of four states. Locked nodes are visible from the
// start so players can see what is coming.
import Phaser from 'phaser';
import { color, type PaletteName } from '../design/tokens';
import { Button } from './Button';
import { drawPanelBox } from './pixelDraw';
import { addText, type PixelText } from './text';
import { uiSignals } from './uiSignals';

export type NodeState = 'locked' | 'available' | 'affordable' | 'owned' | 'maxed';

export const TREE_NODE = { w: 32, h: 30 } as const;

const LOOK: Record<NodeState, { fill: PaletteName; border: PaletteName; text: PaletteName }> = {
  locked: { fill: 'ink', border: 'midnight', text: 'slate' },
  available: { fill: 'midnight', border: 'dusk', text: 'sky' },
  affordable: { fill: 'midnight', border: 'gold', text: 'gold' },
  owned: { fill: 'midnight', border: 'sage', text: 'sage' },
  maxed: { fill: 'moss', border: 'sage', text: 'mist' },
};

export class TreeNode extends Phaser.GameObjects.Container {
  private gfx: Phaser.GameObjects.Graphics;
  private icon: Phaser.GameObjects.Image;
  private lock: Phaser.GameObjects.Image | null = null;
  /** Shape cue for "you can buy this", so the state never relies on color alone. */
  private buyable: Phaser.GameObjects.Image | null = null;
  private levelText: PixelText;
  private hit: Button;
  private pulse: Phaser.Tweens.Tween | null = null;
  private glow: Phaser.GameObjects.Graphics;
  private _selected = false;
  private _state: NodeState = 'locked';

  constructor(scene: Phaser.Scene, x: number, y: number, iconKey: string, onSelect: () => void) {
    super(scene, Math.round(x), Math.round(y));
    this.glow = scene.add.graphics();
    this.gfx = scene.add.graphics();
    this.icon = scene.add.image(Math.round((TREE_NODE.w - 12) / 2), 3, iconKey).setOrigin(0, 0);
    this.levelText = addText(scene, TREE_NODE.w / 2, 16, '', { originX: 0.5, shadow: false });
    // Invisible button for consistent touch handling and click sounds.
    this.hit = new Button(scene, { x: 0, y: 0, w: TREE_NODE.w, h: TREE_NODE.h, variant: 'ghost', onClick: onSelect });
    this.hit.setAlpha(0.001);
    this.add([this.hit, this.glow, this.gfx, this.icon, this.levelText]);
    scene.add.existing(this);
  }

  setNode(state: NodeState, level: number, maxLevel: number, selected: boolean, label?: string, costIcon = 'icon_coin'): void {
    this._state = state;
    this._selected = selected;
    const look = LOOK[state];
    this.gfx.clear();
    drawPanelBox(this.gfx, 0, 0, TREE_NODE.w, TREE_NODE.h, {
      fill: look.fill,
      border: selected ? 'mist' : look.border,
      highlight: state === 'locked' ? undefined : 'dusk',
    });
    this.icon.setAlpha(state === 'locked' ? 0.35 : 1);
    this.levelText.setText(maxLevel > 1 ? `${level}/${maxLevel}` : (label ?? (level > 0 ? 'OK' : '-')));
    this.levelText.setColor(look.text);
    if (state === 'locked' && !this.lock) {
      this.lock = this.scene.add.image(TREE_NODE.w - 10, -2, 'icon_lock').setOrigin(0, 0);
      this.add(this.lock);
    } else if (state !== 'locked' && this.lock) {
      this.lock.destroy();
      this.lock = null;
    }
    if (state === 'affordable' && !this.buyable && this.scene.textures.exists(costIcon)) {
      this.buyable = this.scene.add.image(-3, -3, costIcon).setOrigin(0, 0);
      this.add(this.buyable);
    } else if (state !== 'affordable' && this.buyable) {
      this.buyable.destroy();
      this.buyable = null;
    }
    this.glow.clear();
    this.pulse?.stop();
    this.pulse = null;
    if (state === 'affordable') {
      this.glow.fillStyle(color('gold'));
      this.glow.fillRect(-1, -1, TREE_NODE.w + 2, TREE_NODE.h + 2);
      this.glow.setAlpha(0.15);
      if (!uiSignals.reducedMotion()) {
        this.pulse = this.scene.tweens.add({ targets: this.glow, alpha: 0.45, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
  }

  get nodeState(): NodeState {
    return this._state;
  }

  get selected(): boolean {
    return this._selected;
  }
}
