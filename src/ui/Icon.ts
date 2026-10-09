// Icons are 12x12 sprites keyed "icon_<name>" in the sprite manifest.
import type Phaser from 'phaser';

export function addIcon(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  const texture = key.startsWith('icon_') || scene.textures.exists(key) ? key : `icon_${key}`;
  return scene.add.image(Math.round(x), Math.round(y), texture).setOrigin(0, 0);
}
