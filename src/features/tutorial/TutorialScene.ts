// Draws the current tip as a speech bubble with a little arrow toward what it
// is about. Runs above every other scene but only the bubble itself takes
// taps, and only for tips you can dismiss, so the water stays tappable.
import Phaser from 'phaser';
import { getContext, type GameContext } from '../../core/context';
import { getLayout, menuSlots, type Layout } from '../../core/layout';
import { uiState } from '../../core/sceneState';
import { MOTION, color } from '../../design/tokens';
import { drawPanelBox } from '../../ui/pixelDraw';
import { addText } from '../../ui/text';
import { uiSignals } from '../../ui/uiSignals';
import { getTutorial } from './service';
import type { TipAnchor, TipDef } from './tips';

const BUBBLE_W = 150;
const PAD = 5;
const ARROW = 4;

export class TutorialScene extends Phaser.Scene {
  private ctx!: GameContext;
  private L!: Layout;
  private bubble: Phaser.GameObjects.Container | null = null;
  private showing: string | null = null;
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  private offs: (() => void)[] = [];

  constructor() {
    super('Tutorial');
  }

  create(): void {
    this.ctx = getContext();
    this.L = getLayout();
    this.showing = null;
    this.bubble = null;
    // Above every panel that exists now and later (panels launch below this scene).
    this.scene.bringToTop();
    this.offs = [
      getTutorial().onChange(() => this.sync()),
      this.ctx.bus.on('viewportChanged', () => this.scene.restart()),
    ];
    this.events.once('shutdown', () => this.offs.forEach((off) => off()));
    this.sync();
  }

  override update(): void {
    // Tips step aside while a panel or the catch card is open.
    if (this.bubble) this.bubble.setVisible(!uiState.openPanel && !uiState.modal && !uiState.voyaging);
  }

  private sync(): void {
    const tip = getTutorial().current();
    if ((tip?.id ?? null) === this.showing) return;
    this.hideTimer?.remove();
    this.hideTimer = null;
    this.bubble?.destroy();
    this.bubble = null;
    this.showing = tip?.id ?? null;
    if (!tip) return;
    this.bubble = this.build(tip);
    this.ctx.bus.emit('audio:play', { key: 'tip' });
    if (tip.autoHideMs) this.hideTimer = this.time.delayedCall(tip.autoHideMs, () => getTutorial().expire(tip.id));
  }

  /**
   * Where the arrow points (x, y), where the bubble's bottom may sit at most, and
   * whether the bubble goes above. Menu tips stay above the Cast row and reach
   * down with a dotted line, so they never cover the Cast button.
   */
  private target(a: TipAnchor): { x: number; y: number; bottom: number; above: boolean } {
    const L = this.L;
    const aboveCast = L.castButton.y - 20;
    switch (a.kind) {
      case 'cast':
        return { x: L.castButton.x + L.castButton.w / 2, y: L.castButton.y - 18, bottom: L.castButton.y - 18, above: true };
      case 'bobber':
        return { x: L.bobber.x, y: L.bobber.y - 26, bottom: L.bobber.y - 26, above: true };
      case 'creel':
        return { x: L.creelButton.x + L.creelButton.w / 2, y: L.creelButton.y - 2, bottom: aboveCast, above: true };
      case 'menu': {
        const entries = this.ctx.features.menuEntries();
        const i = entries.findIndex((m) => m.id === a.entry);
        const r = menuSlots(L.menuBar, entries.length)[Math.max(0, i)]!;
        return { x: r.x + r.w / 2, y: r.y - 1, bottom: aboveCast, above: true };
      }
      case 'center':
        return { x: L.width / 2, y: L.topBar.y + L.topBar.h + 22, bottom: 0, above: false };
    }
  }

  private build(tip: TipDef): Phaser.GameObjects.Container {
    const L = this.L;
    const t = this.target(tip.anchor);
    const w = Math.min(BUBBLE_W, L.width - 8);
    const text = addText(this, PAD, PAD, tip.text, { color: 'mist', shadow: false, maxWidth: w - PAD * 2 });
    const h = text.textHeight + PAD * 2 + (tip.dismissable ? 9 : 0);
    const x = Math.round(Math.max(4, Math.min(L.width - w - 4, t.x - w / 2)));
    const top = L.topBar.y + L.topBar.h + 2;
    let y = t.above ? t.bottom - h - ARROW : t.y;
    if (y < top) y = top;
    y = Math.round(y);
    // A dotted line from the arrow down to a target further below (menu buttons).
    const reach = t.above ? Math.round(t.y - (y + h + ARROW)) : 0;

    const g = this.add.graphics();
    drawPanelBox(g, 0, 0, w, h, { fill: 'ink', border: 'gold', highlight: 'midnight' });
    // Arrow toward the target, kept inside the bubble's width.
    const ax = Math.round(Math.max(6, Math.min(w - 6, t.x - x)));
    g.fillStyle(color('gold'));
    if (t.above) {
      const lineX = Math.round(t.x - x);
      for (let yy = 0; yy < reach; yy += 3) g.fillRect(lineX, h + yy, 1, 2);
      const tipY = h + Math.max(0, reach);
      for (let i = 0; i < ARROW; i++) g.fillRect(lineX - (ARROW - 1 - i), tipY + i, (ARROW - 1 - i) * 2 + 1, 1);
      if (reach > 0) g.fillRect(Math.min(ax, lineX), h, Math.abs(ax - lineX) + 1, 1);
    }
    const parts: Phaser.GameObjects.GameObject[] = [g, text];
    if (tip.dismissable) {
      parts.push(addText(this, w - PAD, h - PAD - 8, 'tap to hide', { color: 'slate', shadow: false, originX: 1 }));
    }
    const c = this.add.container(x, y, parts).setDepth(1000);
    if (tip.dismissable) {
      const zone = this.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive();
      zone.on('pointerup', () => {
        uiSignals.click();
        getTutorial().dismiss();
      });
      c.add(zone);
    }
    if (!uiSignals.reducedMotion()) {
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: MOTION.toastIn, ease: MOTION.easeOut });
      this.tweens.add({ targets: c, y: y - 2, duration: 1400, yoyo: true, repeat: -1, ease: MOTION.ease });
    }
    return c;
  }
}
