// The catch card: fish sprite, name, rarity banner, size, value, a NEW tag on
// first catch, and Sell / Keep. Tapping anywhere outside the buttons sells, so
// the loop stays one tap.
import Phaser from 'phaser';
import type { GameContext } from '../../core/context';
import type { Layout } from '../../core/layout';
import type { CatchResult } from '../../core/types';
import { MOTION, color, type PaletteName } from '../../design/tokens';
import { Button } from '../../ui/Button';
import { drawPanelBox, fillPixelDisc } from '../../ui/pixelDraw';
import { RarityBanner } from '../../ui/RarityBanner';
import { addText } from '../../ui/text';
import { uiSignals } from '../../ui/uiSignals';
import { formatNumber } from '../../ui/format';

export interface CatchPopupHandlers {
  onSell: () => void;
  onKeep: () => void;
  canKeep: boolean;
  /** A short line under the buttons explaining Sell and Keep (new players). */
  hint?: string;
}

export const POPUP = { w: 150, h: 156, spriteScale: 3 } as const;

export class CatchPopup extends Phaser.GameObjects.Container {
  private closed = false;
  private blocker!: Phaser.GameObjects.Zone;

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
    this.blocker = blocker;
    this.add([backdrop, blocker]);

    const hint = h.hint ? addText(scene, POPUP.w / 2, POPUP.h - 4, h.hint, { originX: 0.5, align: 'center', color: 'sky', shadow: false, maxWidth: POPUP.w - 12 }) : null;
    const cardH = POPUP.h + (hint ? hint.textHeight + 4 : 0);
    const px = Math.round((W - POPUP.w) / 2);
    const py = Math.max(L.safe.top + 4, Math.round(L.frame.y + (L.frame.h - cardH) / 2 - 10));
    const card = scene.add.container(px, py);
    const g = scene.add.graphics();
    drawPanelBox(g, 0, 0, POPUP.w, cardH, { fill: 'midnight', border: rarity.frame, highlight: 'dusk', shadow: 'ink' });
    // Soft round halo behind the fish in the rarity color, in stepped rings
    // (no gradients); rarer fish get a bigger, brighter glow.
    const haloR = 18 + rarity.glow * 2;
    fillPixelDisc(g, POPUP.w / 2, 36, haloR, rarity.color, 0.1);
    fillPixelDisc(g, POPUP.w / 2, 36, haloR - 5, rarity.color, 0.12 + rarity.glow * 0.02);
    fillPixelDisc(g, POPUP.w / 2, 36, haloR - 10, rarity.color, 0.14 + rarity.glow * 0.03);
    card.add(g);
    this.addSparkles(scene, card, rarity.glow, rarity.color);

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
    if (hint) card.add(hint);
    this.add(card);

    if (!uiSignals.reducedMotion()) {
      backdrop.setAlpha(0);
      scene.tweens.add({ targets: backdrop, alpha: 0.7, duration: MOTION.popupIn, ease: MOTION.easeOut });
      card.setAlpha(0);
      card.y += 8;
      scene.tweens.add({ targets: card, alpha: 1, y: py, duration: MOTION.popupIn, ease: MOTION.easeOut });
      // The fish lands a beat after the card, so the eye goes to it.
      sprite.setAlpha(0).setY(42);
      scene.tweens.add({ targets: sprite, alpha: 1, y: 36, delay: MOTION.popupIn / 2, duration: MOTION.popupIn, ease: MOTION.easeOut });
    }
    scene.add.existing(this);
  }

  /** Little four-point stars that twinkle around rarer fish. */
  private addSparkles(scene: Phaser.Scene, card: Phaser.GameObjects.Container, glow: number, tint: PaletteName): void {
    const count = glow * 2;
    const reduced = uiSignals.reducedMotion();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.4;
      const dist = 24 + (i % 2) * 6;
      const x = Math.round(POPUP.w / 2 + Math.cos(angle) * dist * 1.5);
      const y = Math.round(36 + Math.sin(angle) * dist * 0.55);
      const s = scene.add.graphics({ x, y });
      s.fillStyle(color(i % 3 === 0 ? 'mist' : tint));
      s.fillRect(0, -1, 1, 3);
      s.fillRect(-1, 0, 3, 1);
      card.add(s);
      if (reduced) continue;
      s.setAlpha(0);
      scene.tweens.add({
        targets: s,
        alpha: 1,
        delay: MOTION.popupIn + i * (MOTION.sparkleTwinkle / count),
        duration: MOTION.sparkleTwinkle / 2,
        yoyo: true,
        repeat: -1,
        repeatDelay: MOTION.sparkleTwinkle / 2,
        ease: MOTION.ease,
      });
    }
  }

  private finish(fn: () => void): void {
    if (this.closed) return;
    this.closed = true;
    fn();
    if (uiSignals.reducedMotion() || !this.scene) {
      this.destroy();
      return;
    }
    // A short fade so the card does not just blink away.
    this.blocker.disableInteractive();
    this.scene.tweens.add({ targets: this, alpha: 0, duration: MOTION.popupOut, ease: MOTION.ease, onComplete: () => this.destroy() });
  }

  /** Keyboard shortcuts route here. */
  trigger(action: 'sell' | 'keep', h: CatchPopupHandlers): void {
    if (action === 'keep' && !h.canKeep) return;
    this.finish(action === 'sell' ? h.onSell : h.onKeep);
  }
}
