// Fishing layer: line, bobber, ripples, the bite cue, the big Cast button,
// the creel button, and the catch popup. Renders the controller's state only.
import Phaser from 'phaser';
import { getContext, type GameContext } from '../../core/context';
import { getLayout, type Layout } from '../../core/layout';
import { uiState, worldAnchors } from '../../core/sceneState';
import { FISHING } from '../../config/tuning';
import { MOTION, type PaletteName } from '../../design/tokens';
import { Button } from '../../ui/Button';
import { drawPixelEllipse, drawSaggingLine } from '../../ui/pixelDraw';
import { addText, type PixelText } from '../../ui/text';
import { uiSignals } from '../../ui/uiSignals';
import { CatchPopup, type CatchPopupHandlers } from './CatchPopup';
import { getFishingController, type FishingController } from './controller';
import type { SessionEvent } from './fishingSession';

interface Ripple {
  x: number;
  y: number;
  age: number;
  life: number;
  maxR: number;
  color: PaletteName;
}

const LABELS: Record<string, string> = {
  idle: 'Cast',
  missed: 'Cast',
  casting: '...',
  waiting: 'Waiting',
  bite: 'Reel in!',
  reeling: 'Reeling',
  landed: '',
};

export class FishingScene extends Phaser.Scene {
  private ctx!: GameContext;
  private L!: Layout;
  private ctl!: FishingController;
  private line!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private bobber!: Phaser.GameObjects.Sprite;
  private cue!: PixelText;
  private message!: PixelText;
  private castButton!: Button;
  private creelButton!: Button;
  private jumper: Phaser.GameObjects.Image | null = null;
  private ripples: Ripple[] = [];
  private popup: CatchPopup | null = null;
  private popupHandlers: CatchPopupHandlers | null = null;
  private elapsed = 0;
  private offs: (() => void)[] = [];

  constructor() {
    super('Fishing');
  }

  create(): void {
    this.ctx = getContext();
    this.L = getLayout();
    this.ctl = getFishingController();
    this.ripples = [];
    this.offs = [];
    const { fishingZone: z, castButton: cb, bobber } = this.L;

    // Tapping anywhere on the water counts, so the bite window feels generous.
    const zone = this.add.zone(z.x, z.y, z.w, z.h).setOrigin(0, 0).setInteractive();
    zone.on('pointerdown', () => this.tap());

    this.line = this.add.graphics();
    this.fx = this.add.graphics();
    this.bobber = this.add.sprite(bobber.x, bobber.y, 'bobber', 0).setOrigin(0.5, 0.5).setVisible(false);
    this.cue = addText(this, bobber.x, bobber.y - 18, '!', { color: 'gold', scale: 2, originX: 0.5, shadow: 'ink' }).setVisible(false);
    this.message = addText(this, this.L.width / 2, cb.y - 16, '', { color: 'mist', originX: 0.5, maxWidth: 160, align: 'center' });

    this.castButton = new Button(this, {
      x: cb.x,
      y: cb.y,
      w: cb.w,
      h: cb.h,
      label: 'Cast',
      icon: 'icon_rod',
      variant: 'primary',
      fireOnDown: true,
      onClick: () => this.tap(),
    });
    const cr = this.L.creelButton;
    this.creelButton = new Button(this, {
      x: cr.x,
      y: cr.y,
      w: cr.w,
      h: cr.h,
      icon: 'icon_creel',
      label: '0',
      variant: 'secondary',
      onClick: () => this.ctx.ui.openPanel('Creel'),
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => this.keyTap());
    kb?.on('keydown-ENTER', () => this.keyTap());
    kb?.on('keydown-K', () => this.popup && this.popupHandlers && this.popup.trigger('keep', this.popupHandlers));

    this.offs.push(
      this.ctl.onEvent((e) => this.onSession(e)),
      this.ctx.bus.on('viewportChanged', () => this.scene.restart()),
      this.ctx.bus.on('fishSold', () => this.refreshButtons()),
      this.ctx.bus.on('statsChanged', () => this.refreshButtons()),
    );
    this.events.once('shutdown', () => {
      this.offs.forEach((off) => off());
      uiState.modal = false;
    });

    // Restore the popup if the scene restarted while a catch was waiting.
    if (this.ctl.session.phase === 'landed' && this.ctl.pending) this.showPopup();
    if (this.ctl.session.phase === 'idle') this.say('Tap to cast', 'slate');
    this.refreshButtons();
  }

  private keyTap(): void {
    if (this.popup && this.popupHandlers) {
      this.popup.trigger('sell', this.popupHandlers);
      return;
    }
    this.tap();
  }

  private tap(): void {
    if (uiState.openPanel || uiState.modal) return;
    this.ctl.tap();
  }

  private onSession(e: SessionEvent): void {
    const { bobber } = this.L;
    switch (e.type) {
      case 'cast':
        this.say('');
        this.throwBobber();
        break;
      case 'early':
        this.say('Wait for the bite...', 'slate');
        break;
      case 'bite':
        this.bobber.setFrame(1);
        this.cue.setVisible(true).setPosition(bobber.x, bobber.y - 18);
        this.addRipple(bobber.x, bobber.y + 2, 18, 900, 'gold');
        this.addRipple(bobber.x, bobber.y + 2, 10, 600, 'mist');
        if (!uiSignals.reducedMotion()) {
          this.tweens.add({ targets: this.cue, y: bobber.y - 22, duration: 220, yoyo: true, repeat: -1, ease: MOTION.ease });
        }
        break;
      case 'missed':
        this.clearBite();
        this.bobber.setVisible(false);
        this.addRipple(bobber.x, bobber.y + 2, 8, 800, 'sky');
        this.say('It swam away. No worries!', 'sky');
        break;
      case 'hooked':
        this.clearBite();
        this.reelIn();
        break;
      case 'landed':
        this.bobber.setVisible(false);
        this.jumper?.destroy();
        this.jumper = null;
        if (this.ctl.pending) this.showPopup();
        break;
      case 'idle':
        this.say('');
        break;
    }
    this.refreshButtons();
  }

  private clearBite(): void {
    this.tweens.killTweensOf(this.cue);
    this.cue.setVisible(false);
    this.bobber.setFrame(0);
  }

  private throwBobber(): void {
    const { bobber } = this.L;
    const from = { x: worldAnchors.rodTip.x, y: worldAnchors.rodTip.y };
    this.bobber.setVisible(true).setPosition(from.x, from.y).setFrame(0);
    const t = { p: 0 };
    this.tweens.add({
      targets: t,
      p: 1,
      duration: FISHING.castAnimMs,
      ease: MOTION.easeOut,
      onUpdate: () => {
        const x = from.x + (bobber.x - from.x) * t.p;
        const y = from.y + (bobber.y - from.y) * t.p - Math.sin(t.p * Math.PI) * 18;
        this.bobber.setPosition(Math.round(x), Math.round(y));
      },
      onComplete: () => {
        this.addRipple(bobber.x, bobber.y + 2, 12, 1100, 'mist');
        this.addRipple(bobber.x, bobber.y + 2, 6, 700, 'sky');
      },
    });
  }

  private reelIn(): void {
    const { bobber } = this.L;
    const pending = this.ctl.pending;
    this.addRipple(bobber.x, bobber.y + 2, 14, 700, 'mist');
    if (this.textures.exists('fx_splash')) {
      const splash = this.add.sprite(bobber.x, bobber.y - 2, 'fx_splash', 0);
      let frame = 0;
      this.time.addEvent({ delay: 130, repeat: 2, callback: () => splash.setFrame(Math.min(2, ++frame)) });
      this.time.delayedCall(520, () => splash.destroy());
    }
    // The fish leaps from the bobber toward the boat.
    if (pending) {
      const fish = this.ctx.registries.fish.get(pending.fishId);
      this.jumper = this.add.image(bobber.x, bobber.y, fish.spriteKey).setFlipX(true);
      const to = { x: this.L.boat.x + 4, y: this.L.boat.y - 20 };
      const t = { p: 0 };
      const j = this.jumper;
      this.tweens.add({
        targets: t,
        p: 1,
        duration: FISHING.reelAnimMs,
        ease: MOTION.ease,
        onUpdate: () => {
          j.setPosition(
            Math.round(bobber.x + (to.x - bobber.x) * t.p),
            Math.round(bobber.y + (to.y - bobber.y) * t.p - Math.sin(t.p * Math.PI) * 26),
          );
          j.setAngle(Math.round(t.p * 4) * -15);
        },
      });
    }
    this.bobber.setVisible(false);
  }

  private showPopup(): void {
    const c = this.ctl.pending;
    if (!c) return;
    uiState.modal = true;
    const handlers: CatchPopupHandlers = {
      canKeep: !this.ctl.creelFull,
      onSell: () => {
        this.ctl.sellPending();
        this.closePopup();
      },
      onKeep: () => {
        this.ctl.keepPending();
        this.closePopup();
      },
    };
    this.popupHandlers = handlers;
    this.popup = new CatchPopup(this, this.ctx, this.L, c, handlers);
    this.popup.setDepth(100);
  }

  private closePopup(): void {
    this.popup = null;
    this.popupHandlers = null;
    // Let the release of this tap finish before fishing taps count again.
    this.time.delayedCall(FISHING.tapDebounceMs, () => (uiState.modal = false));
    this.refreshButtons();
  }

  private refreshButtons(): void {
    const phase = this.ctl.session.phase;
    this.castButton.setVisible(phase !== 'landed');
    this.castButton.setLabel(LABELS[phase] ?? 'Cast');
    this.castButton.setHighlighted(phase === 'bite');
    this.castButton.setDisabled(phase === 'casting' || phase === 'reeling');
    const cap = this.ctx.stats.get('storageCap');
    this.creelButton.setLabel(`${this.ctl.state.creel.length}/${cap}`);
  }

  private say(text: string, c: PaletteName = 'mist'): void {
    this.message.setText(text).setColor(c).setAlpha(1);
    this.tweens.killTweensOf(this.message);
    if (text) this.tweens.add({ targets: this.message, alpha: 0, delay: 2200, duration: 800 });
  }

  private addRipple(x: number, y: number, maxR: number, life: number, c: PaletteName): void {
    this.ripples.push({ x, y, age: 0, life, maxR, color: c });
  }

  override update(_t: number, delta: number): void {
    this.elapsed += delta;
    const phase = this.ctl.session.phase;
    const { bobber } = this.L;
    const reduced = uiSignals.reducedMotion();

    if (phase === 'waiting') {
      const bob = reduced ? 0 : Math.round(Math.sin(this.elapsed / 500) * FISHING.bobAmplitude);
      this.bobber.setPosition(bobber.x, bobber.y + bob);
      // A tiny nibble ripple now and then keeps the wait lively.
      if (!reduced && Math.random() < delta / 2500) this.addRipple(bobber.x, bobber.y + 2, 5, 600, 'sky');
    } else if (phase === 'bite') {
      const dip = Math.round(Math.abs(Math.sin(this.elapsed / 120))) * FISHING.biteDipPx;
      this.bobber.setPosition(bobber.x, bobber.y + dip);
      if (Math.floor(this.elapsed / 450) !== Math.floor((this.elapsed - delta) / 450)) {
        this.addRipple(bobber.x, bobber.y + 2, 16, 800, 'gold');
      }
    }

    // Line from rod tip to bobber.
    this.line.clear();
    if (this.bobber.visible) {
      const sag = phase === 'bite' ? 2 : 6;
      drawSaggingLine(this.line, worldAnchors.rodTip.x, worldAnchors.rodTip.y, this.bobber.x, this.bobber.y - 3, sag, 'mist');
    } else if (this.jumper) {
      drawSaggingLine(this.line, worldAnchors.rodTip.x, worldAnchors.rodTip.y, this.jumper.x, this.jumper.y, 1, 'mist');
    }

    // Ripples expand and fade in three alpha steps (no smooth gradients).
    this.fx.clear();
    this.ripples = this.ripples.filter((r) => (r.age += delta) < r.life);
    for (const r of this.ripples) {
      const t = r.age / r.life;
      const rad = 2 + t * r.maxR;
      const alpha = t < 0.4 ? 1 : t < 0.75 ? 0.6 : 0.3;
      drawPixelEllipse(this.fx, r.x, r.y, rad, Math.max(1, rad * 0.35), r.color, alpha);
    }
  }
}
