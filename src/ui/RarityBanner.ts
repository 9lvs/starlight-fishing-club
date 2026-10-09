// Rarity ribbon: shape + name + pips, with a glow that escalates by tier but
// stays soft (slow alpha pulse and a few sparkles, never flashing).
import Phaser from 'phaser';
import { RARITY_GLOW, color, type PaletteName } from '../design/tokens';
import { drawPips, drawRarityShape } from './rarityShapes';
import { addText } from './text';
import { uiSignals } from './uiSignals';

export interface RarityLook {
  name: string;
  color: PaletteName;
  frame: PaletteName;
  glow: number;
  pips: number;
  shape: string;
}

export class RarityBanner extends Phaser.GameObjects.Container {
  readonly bannerWidth: number;

  constructor(scene: Phaser.Scene, cx: number, y: number, look: RarityLook, animate = true) {
    super(scene, 0, Math.round(y));
    const label = addText(scene, 0, 0, look.name.toUpperCase(), { color: 'ink', shadow: false, originY: 0 });
    const pipsW = look.pips * 3 - 1;
    const w = 4 + 7 + 3 + label.textWidth + 4 + pipsW + 5;
    const h = 13;
    this.bannerWidth = w;
    const glow = scene.add.graphics();
    const g = scene.add.graphics();
    // Ribbon with notched ends.
    g.fillStyle(color(look.frame));
    g.fillRect(-3, 2, 3, h - 4);
    g.fillRect(w, 2, 3, h - 4);
    g.fillStyle(color('ink'), 0.6);
    g.fillRect(-3, 5, 1, 3);
    g.fillRect(w + 2, 5, 1, 3);
    g.fillStyle(color(look.frame));
    g.fillRect(1, 0, w - 2, h);
    g.fillRect(0, 1, w, h - 2);
    g.fillStyle(color(look.color));
    g.fillRect(1, 1, w - 2, h - 2);
    drawRarityShape(g, 4, 3, look.shape, 'ink');
    label.setPosition(4 + 7 + 3, 1);
    drawPips(g, 4 + 7 + 3 + label.textWidth + 4, 5, look.pips, 'ink');
    this.add([glow, g, label]);
    this.setX(Math.round(cx - w / 2));

    const level = RARITY_GLOW[Math.min(4, Math.max(0, look.glow)) as 0 | 1 | 2 | 3 | 4];
    if (level.pulse > 0) {
      glow.fillStyle(color(look.color));
      glow.fillRect(-2, -2, w + 4, h + 4);
      glow.setAlpha(0);
      if (animate && !uiSignals.reducedMotion()) {
        scene.tweens.add({ targets: glow, alpha: level.pulse, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else {
        glow.setAlpha(level.pulse * 0.6);
      }
    }
    if (animate && level.sparkles > 0 && scene.textures.exists('fx_sparkle') && !uiSignals.reducedMotion()) {
      for (let i = 0; i < level.sparkles; i++) {
        const s = scene.add.sprite(0, 0, 'fx_sparkle', 0).setOrigin(0.5);
        this.add(s);
        const place = () => {
          s.setPosition(Math.round(Math.random() * w), Math.round(Math.random() < 0.5 ? -3 : h + 2));
          s.setFrame(Math.random() < 0.5 ? 0 : 1);
        };
        place();
        s.setAlpha(0);
        scene.tweens.add({
          targets: s,
          alpha: 1,
          duration: 500,
          yoyo: true,
          delay: i * 300,
          repeat: -1,
          repeatDelay: 600 + i * 150,
          onRepeat: place,
        });
      }
    }
    scene.add.existing(this);
  }
}
