// Base for every menu panel (upgrades, journal, crew, map, settings, ...).
// It draws a dithered backdrop, a framed panel, handles close by button,
// backdrop tap, or Escape, and rebuilds itself if the screen size changes.
import Phaser from 'phaser';
import { getContext, type GameContext } from '../core/context';
import type { GameEvents } from '../core/events';
import { getLayout, type Layout, type Rect } from '../core/layout';
import { uiState } from '../core/sceneState';
import { MOTION, UI, color } from '../design/tokens';
import { Panel } from '../ui/Panel';
import { uiSignals } from '../ui/uiSignals';

export abstract class PanelScene<D = unknown> extends Phaser.Scene {
  protected ctx!: GameContext;
  protected L!: Layout;
  protected panel!: Panel;
  protected data_: D | undefined;
  private offs: (() => void)[] = [];
  private closing = false;

  abstract readonly title: string;
  readonly icon?: string;

  /** Build the panel contents inside `area` (screen coordinates). */
  protected abstract build(area: Rect, data: D | undefined): void;

  create(data: D | undefined): void {
    this.ctx = getContext();
    this.L = getLayout();
    this.data_ = data;
    this.offs = [];
    this.closing = false;
    this.input.enabled = true;
    uiState.openPanel = this.scene.key;
    const { width: W, menuBar, safe } = this.L;

    // Backdrop stops taps reaching the game, but leaves the menu bar usable.
    const backdropH = menuBar.y;
    const dither = this.textures.exists('dither_50') ? 'dither_50' : '__WHITE';
    this.add.tileSprite(0, 0, W, backdropH, dither).setOrigin(0, 0).setTint(color('ink')).setAlpha(0.85);
    const blocker = this.add.zone(0, 0, W, backdropH).setOrigin(0, 0).setInteractive();
    blocker.on('pointerup', (p: Phaser.Input.Pointer) => {
      const b = this.panel.getBounds();
      if (!b.contains(p.x, p.y) && p.getDistance() < 6) this.close();
    });

    // Capped in both directions and centered, so big screens get a tidy card.
    const w = Math.min(W - 6, UI.panelMaxWidth);
    const room = menuBar.y - safe.top - 6;
    const h = Math.min(room, UI.panelMaxHeight);
    const top = safe.top + 3 + Math.floor((room - h) / 2);
    this.panel = new Panel(this, {
      x: Math.round((W - w) / 2),
      y: top,
      w,
      h,
      title: this.title,
      icon: this.icon,
      onClose: () => this.close(),
    });
    const c = this.panel.content;
    this.build({ x: this.panel.x + c.x, y: this.panel.y + c.y, w: c.w, h: c.h }, data);

    if (!uiSignals.reducedMotion()) {
      this.cameras.main.setAlpha(0);
      this.cameras.main.scrollY = -6;
      this.tweens.add({ targets: this.cameras.main, alpha: 1, scrollY: 0, duration: MOTION.panelOpen, ease: MOTION.easeOut });
    }
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.offs.push(this.ctx.bus.on('viewportChanged', () => this.scene.restart(this.data_ as object | undefined)));
    this.events.once('shutdown', () => {
      this.offs.forEach((off) => off());
      if (uiState.openPanel === this.scene.key) uiState.openPanel = null;
    });
  }

  /** Subscribe to a bus event for the lifetime of this panel. */
  protected listen<K extends keyof GameEvents>(type: K, fn: (payload: GameEvents[K]) => void): void {
    this.offs.push(this.ctx.bus.on(type, fn));
  }

  close(): void {
    if (this.closing) return;
    this.closing = true;
    const key = this.scene.key;
    // Fishing taps work again right away; the panel just fades out on top.
    if (uiState.openPanel === key) uiState.openPanel = null;
    this.ctx.bus.emit('ui:panelClosed', { sceneKey: key });
    if (uiSignals.reducedMotion()) {
      this.scene.stop();
      return;
    }
    this.input.enabled = false;
    this.tweens.add({
      targets: this.cameras.main,
      alpha: 0,
      scrollY: -4,
      duration: MOTION.panelClose,
      ease: MOTION.ease,
      onComplete: () => this.scene.stop(),
    });
  }
}
