// Creates the Phaser game: core scenes plus every feature's scenes, and the
// per-frame tick that drives feature onTick and offline gap detection.
import Phaser from 'phaser';
import { DISPLAY } from '../config/display';
import { BootScene, type BootData } from '../scenes/BootScene';
import { HudScene } from '../scenes/HudScene';
import { VoyageScene } from '../scenes/VoyageScene';
import { StyleGuideScene } from '../scenes/StyleGuideScene';
import { WorldScene } from '../scenes/WorldScene';
import type { GameContext } from './context';
import type { GameFeature } from './feature';
import type { Viewport } from './scaling';
import type { TickDriver } from './bootstrap';

export interface StartOptions {
  ctx: GameContext;
  features: readonly GameFeature[];
  viewport: Viewport;
  styleguide: boolean;
  ticker: TickDriver;
  onReady: () => void;
}

export function startGame(o: StartOptions): Phaser.Game {
  const layers = o.features.flatMap((f) => f.scenes ?? []).filter((s) => s.kind === 'layer');
  const panels = o.features.flatMap((f) => f.scenes ?? []).filter((s) => s.kind === 'panel');
  // Scene list order is draw order: world, feature layers, HUD, then panels on top.
  const scenes: { key: string; scene: new () => Phaser.Scene }[] = [
    { key: 'Boot', scene: BootScene },
    { key: 'World', scene: WorldScene },
    ...layers,
    { key: 'Hud', scene: HudScene },
    { key: 'Voyage', scene: VoyageScene },
    ...panels,
    { key: 'StyleGuide', scene: StyleGuideScene },
  ];
  const start = o.styleguide ? ['StyleGuide'] : ['World', ...layers.map((s) => s.key), 'Hud'];

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: o.viewport.width,
    height: o.viewport.height,
    backgroundColor: DISPLAY.letterboxColor,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    banner: false,
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.NONE,
      zoom: o.viewport.cssZoom,
      autoRound: false,
    },
    input: { activePointers: 2 },
    render: { powerPreference: 'low-power' },
    scene: [],
  });

  scenes.forEach((s) => game.scene.add(s.key, s.scene, false));
  const bootData: BootData = { start, onReady: o.onReady };
  game.scene.start('Boot', bootData);

  if (!o.styleguide) game.events.on('step', () => o.ticker.tick());
  return game;
}
