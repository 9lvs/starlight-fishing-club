// The catch card: fish sprite, name, rarity banner, size, value, a NEW tag on
// first catch, and Sell / Keep. Tapping anywhere outside the buttons sells, so
// the loop stays one tap.
import Phaser from 'phaser';
import type { GameContext } from '../../core/context';
import type { Layout } from '../../core/layout';
import type { CatchResult } from '../../core/types';
import { MOTION, color } from '../../design/tokens';
import { Button } from '../../ui/Button';
import { drawPanelBox } from '../../ui/pixelDraw';
import { RarityBanner } from '../../ui/RarityBanner';
import { addText } from '../../ui/text';
import { uiSignals } from '../../ui/uiSignals';
import { formatNumber } from '../../ui/format';

export interface CatchPopupHandlers {
  onSell: () => void;
  onKeep: () => void;
  canKeep: boolean;
}

export const POPUP = { w: 150, h: 156, spriteScale: 3 } as const;

export class CatchPopup extends Phaser.GameObjects.Container {
  private closed = false;

  constructor(scene: Phaser.Scene, ctx: GameContext, L: Layout, c: CatchResult, h: CatchPopupHandlers) {
    super(scene, 0, 0);
    const fish = ctx.registries.fish.get(c.fishId);
    const rarity = ctx.registries.rarities.get(c.rarityId);
    const W = L.width;

    // Dithered backdrop; a tap on it sells.
    const dither = scene.textures.exists('dither_50') ? 'dither_50' : '__WHITE';
    const backdrop = scene.add.tileSprite(0, 0, W, L.height, dither).setOrigin(0, 0).setTint(color('ink')).setAlpha(0.7);
    const blocker = scene.add.zone(0, 0, W, L.height).setOrigin(0, 0).setInteractive();
    blocker.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.getDistance() < 6) this.finish(h.onSell);
    });
    this.add([backdrop, blocker]);

    const px = Math.round((W - POPUP.w) / 2);
    const py = Math.round(L.frame.y + (L.frame.h - POPUP.h) / 2 - 10);
    const card = scene.add.container(px, py);
    const g = scene.add.graphics();
    drawPanelBox(g, 0, 0, POPUP.w, POPUP.h, { fill: 'midnight', border: rarity.frame, highlight: 'dusk', shadow: 'ink' });
    // Soft halo behind the fish in the rarity color.
    g.fillStyle(color(rarity.color), 0.18);
    g.fillRect(POPUP.w / 2 - 30, 10, 60, 50);
    card.add(g);

    const sprite = scene.add.image(POPUP.w / 2, 36, fish.spriteKey).setScale(POPUP.spriteScale);
    card.add(sprite);
    if (!uiSignals.reducedMotion()) {
      scene.tweens.add({ targets: sprite, y: 34, duration: 1300, yoyo: true, repeat: -1, ease: MOTION.ease });
    }

    if (c.flags.new) {
      const tag = scene.add.graphics();
      drawPanelBox(tag, 0, 0, 28, 13, { fill: 'gold', border: 'coral' });
      const t = addText(scene, 14, 1, 'NEW', { color: 'ink', shadow: false, originX: 0.5 });
      card.add(scene.add.container(5, 5, [tag, t]));
    }

    card.add(addText(scene, POPUP.w / 2, 66, fish.name, { originX: 0.5, color: 'mist' }));
    card.add(
      new RarityBanner(scene, POPUP.w / 2, 80, {
        name: rarity.name,
        color: rarity.color,
        frame: rarity.frame,
        glow: rarity.glow,
        pips: rarity.pips,
        shape: rarity.shape,
      }),
    );
    card.add(addText(scene, POPUP.w / 2, 97, `${c.size} cm`, { originX: 0.5, color: 'slate', shadow: false }));
    if (c.pityTriggered) {
      card.add(addText(scene, POPUP.w / 2, 108, 'Lucky streak!', { originX: 0.5, color: 'gold', shadow: false }));
    }

    const sell = new Button(scene, {
      x: 8,
      y: POPUP.h - 34,
      w: 84,
      h: 26,
      label: `Sell +${formatNumber(c.value)}`,
      icon: ctx.registries.currencies.tryGet(c.currency)?.icon,
      variant: 'primary',
      onClick: () => this.finish(h.onSell),
    });
    const keep = new Button(scene, {
      x: 96,
      y: POPUP.h - 34,
      w: 46,
      h: 26,
      label: h.canKeep ? 'Keep' : 'Full',
      variant: 'secondary',
      disabled: !h.canKeep,
      onClick: () => this.finish(h.onKeep),
    });
    card.add([sell, keep]);
    this.add(card);

    if (!uiSignals.reducedMotion()) {
      card.setAlpha(0);
      card.y += 8;
      scene.tweens.add({ targets: card, alpha: 1, y: py, duration: MOTION.popupIn, ease: MOTION.easeOut });
    }
    scene.add.existing(this);
  }

  private finish(fn: () => void): void {
    if (this.closed) return;
    this.closed = true;
    fn();
    this.destroy();
  }

  /** Keyboard shortcuts route here. */
  trigger(action: 'sell' | 'keep', h: CatchPopupHandlers): void {
    if (action === 'keep' && !h.canKeep) return;
    this.finish(action === 'sell' ? h.onSell : h.onKeep);
  }
}
