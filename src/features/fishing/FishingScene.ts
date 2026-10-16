// Fishing layer: line, bobber, ripples, the bite cue, the big Cast button,
// the creel button, and the catch popup. Renders the controller's state only.
import Phaser from 'phaser';
import { getContext, type GameContext } from '../../core/context';
import { getLayout, type Layout } from '../../core/layout';
import { uiState, worldAnchors } from '../../core/sceneState';
import { CREEL, FIGHT, FISHING, FX } from '../../config/tuning';
import { MOTION, PALETTE, color, type PaletteName } from '../../design/tokens';
import { Button } from '../../ui/Button';
import { drawPixelEllipse, drawSaggingLine } from '../../ui/pixelDraw';
import { addText, type PixelText } from '../../ui/text';
import { formatCountdown } from '../../ui/format';
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

/** Show the "more tackle" hint when the slip chance was at least this high. */
const ESCAPE_HINT_AT = 0.3;

const LABELS: Record<string, string> = {
  idle: 'Cast',
  missed: 'Cast',
  casting: '...',
  waiting: 'Waiting',
  bite: 'Reel in!',
  fight: 'Tap the dips!',
  reeling: 'Reeling',
  landed: '',
};

export class FishingScene extends Phaser.Scene {
  private ctx!: GameContext;
  private L!: Layout;
  private ctl!: FishingController;
  private line!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  /** The fish's shadow gliding up to the bobber before a bite. */
  private shadow!: Phaser.GameObjects.Graphics;
  private shadowSide = 1;
  /** This cast's shadow: a random length and plumpness. */
  private shadowShape = { len: 7, h: 1 };
  /** The legendary moment: the gold glow at the screen edges, and its sparkles. */
  private moment: { sparks: Phaser.GameObjects.Graphics; motes: { x: number; y: number; vx: number; vy: number; age: number; life: number; c: PaletteName }[] } | null = null;
  private bobber!: Phaser.GameObjects.Sprite;
  private cue!: PixelText;
  private message!: PixelText;
  private castButton!: Button;
  private creelButton!: Button;
  /** Fresh bait from time away: shows how many catches still pay double. */
  private restedButton!: Button;
  private jumper: Phaser.GameObjects.Image | null = null;
  /** The fight's marks above the bobber: one per dip, then the hold for a legendary. */
  private fightMarks: ('todo' | 'hit' | 'miss')[] = [];
  private fightHold = false;
  private fightGfx!: Phaser.GameObjects.Graphics;
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

    this.shadow = this.add.graphics();
    this.glow = this.add.graphics();
    this.fightGfx = this.add.graphics().setDepth(5);
    this.fightMarks = [];
    this.line = this.add.graphics();
    this.fx = this.add.graphics();
    this.bobber = this.add.sprite(bobber.x, bobber.y, 'bobber', 0).setOrigin(0.5, 0.5).setVisible(false);
    this.cue = addText(this, bobber.x, bobber.y - 18, '!', { color: 'gold', scale: 2, originX: 0.5, outline: 'ink' }).setVisible(false);
    // Messages sit over moving water, so they get a full outline.
    // Anchored by its bottom edge, so a two-line message grows upward, never into the Cast button.
    this.message = addText(this, this.L.width / 2, cb.y - 5, '', { color: 'mist', originX: 0.5, originY: 1, maxWidth: 160, align: 'center', outline: 'ink' });

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

    // Mirrors the creel button on the other side of Cast.
    this.restedButton = new Button(this, {
      x: Math.min(this.L.width - this.L.safe.right - 4 - cr.w, cb.x + cb.w + 6),
      y: cr.y,
      w: cr.w,
      h: cr.h,
      icon: 'icon_bait',
      label: '0',
      variant: 'secondary',
      onClick: () => {
        const n = this.ctl.state.rested;
        this.ctx.ui.toast(`Fresh bait from your time away: the next ${n} ${n === 1 ? 'catch pays' : 'catches pay'} double.`, { icon: 'icon_bait', color: 'gold' });
      },
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => this.keyTap());
    kb?.on('keydown-ENTER', () => this.keyTap());
    kb?.on('keydown-K', () => this.popup && this.popupHandlers && this.popup.trigger('keep', this.popupHandlers));
    // Letting go matters while holding a legendary.
    this.input.on('pointerup', () => this.ctl.release());
    kb?.on('keyup-SPACE', () => this.ctl.release());
    kb?.on('keyup-ENTER', () => this.ctl.release());

    this.offs.push(
      this.ctl.onEvent((e) => this.onSession(e)),
      this.ctx.bus.on('quickCatch', ({ label, coins }) => this.floatQuick(label, coins)),
      this.ctx.bus.on('viewportChanged', () => this.scene.restart()),
      // The line and prompts step aside while the boat sails to another water.
      this.ctx.bus.on('voyage', ({ active }) =>
        this.tweens.add({ targets: this.cameras.main, alpha: active ? 0 : 1, duration: active ? 300 : 600 }),
      ),
      this.ctx.bus.on('fishSold', () => this.refreshButtons()),
      this.ctx.bus.on('statsChanged', () => this.refreshButtons()),
      this.ctx.bus.on('restedChanged', () => this.refreshButtons()),
    );
    this.events.once('shutdown', () => {
      this.offs.forEach((off) => off());
      if (this.moment) this.ctx.bus.emit('camera:zoom', { reset: true, outMs: 0 });
      uiState.modal = false;
    });

    // Restore the popup if the scene restarted while a catch was waiting.
    if (this.ctl.session.phase === 'landed' && this.ctl.pending) this.showPopup();
    if (this.ctl.session.phase === 'idle') this.say('Tap to cast', 'mist');
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
    if (uiState.openPanel || uiState.modal || uiState.voyaging) return;
    this.ctl.tap();
  }

  private onSession(e: SessionEvent): void {
    const { bobber } = this.L;
    switch (e.type) {
      case 'cast':
        this.say('');
        this.throwBobber();
        this.shadowSide = Math.random() < 0.5 ? -1 : 1;
        // Random on purpose: the shadow says a fish is coming, not which one.
        this.shadowShape = {
          len: FX.shadow.minLen + Math.floor(Math.random() * (FX.shadow.maxLen - FX.shadow.minLen + 1)),
          h: Math.random() < 0.5 ? 1 : 2,
        };
        break;
      case 'early':
        this.say('Wait for the bite...', 'sky');
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
        // A rare fish fights first; the reel-in comes when the fight ends.
        if (this.ctl.session.phase === 'fight') break;
        if (this.ctl.escaped) this.slipAway();
        else this.reelIn();
        break;
      case 'fightStart':
        this.fightMarks = Array.from({ length: e.dips }, () => 'todo' as const);
        this.fightHold = e.hold;
        this.bobber.setVisible(true).setFrame(0);
        // Explained the first time only; after that the ! cues and the button say enough.
        if (!this.teach(e.hold ? 'hold' : 'dips')) this.say('');
        else this.say(e.hold ? 'A legendary! Tap each dip, then hold.' : 'It is fighting! Tap each time it dips.', 'gold');
        this.ctx.bus.emit('audio:play', { key: 'tug' });
        break;
      case 'dip':
        this.bobber.setFrame(1);
        this.cue.setVisible(true).setPosition(bobber.x, bobber.y - 18);
        this.addRipple(bobber.x, bobber.y + 2, 16, 700, 'gold');
        this.ctx.bus.emit('audio:play', { key: 'bite', volume: 0.8 });
        break;
      case 'dipHit':
        this.clearBite();
        this.fightMarks[e.index] = 'hit';
        this.addRipple(bobber.x, bobber.y + 2, 12, 600, 'mist');
        this.ctx.bus.emit('audio:play', { key: 'tug' });
        break;
      case 'dipMiss':
        this.clearBite();
        this.fightMarks[e.index] = 'miss';
        this.addRipple(bobber.x, bobber.y + 2, 8, 600, 'sky');
        if (this.learning) this.say(e.fumble ? 'Too soon! Wait for the dip.' : 'It pulled free a little. Keep going!', 'sky');
        break;
      case 'hold':
        if (this.learning) this.say('Hold to reel it in!', 'gold');
        break;
      case 'fightDone':
        this.fightMarks = [];
        this.fightGfx.clear();
        this.clearBite();
        if (this.ctl.escaped) this.slipAway();
        else this.reelIn();
        break;
      case 'landed':
        this.bobber.setVisible(false);
        this.jumper?.destroy();
        this.jumper = null;
        this.endMoment();
        if (this.ctl.pending) this.showPopup();
        else if (this.ctl.escaped) this.say(this.escapeMessage(), 'sky');
        break;
      case 'idle':
        this.say('');
        break;
    }
    this.refreshButtons();
  }

  /** True while the first fight of its kind is being explained. */
  private learning = false;

  /** Mark a fight kind as explained; returns true the first time (show the words). */
  private teach(kind: 'dips' | 'hold'): boolean {
    const t = (this.ctl.state.taught ??= {});
    this.learning = !t[kind];
    t[kind] = true;
    return this.learning;
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
        this.ctx.bus.emit('audio:play', { key: 'plop' });
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
    // The fish leaps from the bobber toward the boat. A legendary leaps high and slow.
    if (pending) {
      const fish = this.ctx.registries.fish.get(pending.fishId);
      const legend = this.ctl.pendingTier >= FX.legendary.minTier && !uiSignals.reducedMotion();
      const rarityColor = this.ctx.registries.rarities.tryGet(pending.rarityId)?.color ?? 'gold';
      this.jumper = this.add.image(bobber.x, bobber.y, fish.spriteKey).setFlipX(true).setDepth(legend ? 45 : 0);
      if (legend) this.startMoment(rarityColor);
      const to = { x: this.L.boat.x + 4, y: this.L.boat.y - 20 };
      const arc = legend ? FX.legendary.arcPx : 26;
      const t = { p: 0 };
      const j = this.jumper;
      let burst = false;
      let trail = 0;
      this.tweens.add({
        targets: t,
        p: 1,
        duration: Math.max(FISHING.reelAnimMs, this.ctl.session.duration),
        ease: MOTION.ease,
        onUpdate: (tw) => {
          j.setPosition(
            Math.round(bobber.x + (to.x - bobber.x) * t.p),
            Math.round(bobber.y + (to.y - bobber.y) * t.p - Math.sin(t.p * Math.PI) * arc),
          );
          j.setAngle(Math.round(t.p * 4) * -15);
          if (!legend) return;
          // A soft gold trail, and one burst of sparkles at the top of the leap.
          const now = tw.elapsed;
          if (now - trail > FX.legendary.trailEveryMs) {
            trail = now;
            this.addMote(j.x + (Math.random() * 6 - 3), j.y + (Math.random() * 4 - 2), 0, 0.006, 700, rarityColor);
          }
          if (!burst && t.p >= 0.5) {
            burst = true;
            this.sparkBurst(j.x, j.y, rarityColor);
          }
        },
      });
    }
    this.bobber.setVisible(false);
  }

  /** A legendary's leap: the screen eases in a little toward it and a warm gold glow rims the screen. */
  private startMoment(tint: PaletteName): void {
    this.endMoment();
    const cfg = FX.legendary;
    const sparks = this.add.graphics().setDepth(46);
    const { bobber, boat } = this.L;
    this.ctx.bus.emit('camera:zoom', { x: Math.round((bobber.x + boat.x) / 2), y: Math.round(Math.min(bobber.y, boat.y) - cfg.arcPx / 2), scale: cfg.zoom, inMs: cfg.zoomInMs, glow: `#${PALETTE[tint].toString(16).padStart(6, '0')}` });
    this.moment = { sparks, motes: [] };
  }

  /** The catch card takes over: the zoom and glow ease back, and the sparkles finish on their own. */
  private endMoment(): void {
    const m = this.moment;
    if (!m) return;
    this.moment = null;
    this.ctx.bus.emit('camera:zoom', { reset: true, outMs: FX.legendary.zoomOutMs });
    this.time.delayedCall(900, () => m.sparks.destroy());
    // Let the last sparkles fade under the card.
    const left = m.motes;
    const fade = this.time.addEvent({
      delay: 16,
      repeat: 55,
      callback: () => {
        for (const o of left) this.stepMote(o, 16);
        this.drawMotes(m.sparks, left);
        if (fade.getRepeatCount() === 0) left.length = 0;
      },
    });
  }

  private addMote(x: number, y: number, vx: number, vy: number, life: number, c: PaletteName): void {
    this.moment?.motes.push({ x, y, vx, vy, age: 0, life, c });
  }

  private sparkBurst(x: number, y: number, c: PaletteName): void {
    const n = FX.legendary.sparkles;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const v = FX.legendary.burstPx / 700;
      this.addMote(x, y, Math.cos(a) * v, Math.sin(a) * v * 0.7, 700 + (i % 3) * 120, c);
    }
  }

  private stepMote(o: { x: number; y: number; vx: number; vy: number; age: number }, dt: number): void {
    o.age += dt;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.vx *= 0.97;
    o.vy *= 0.97;
  }

  /** Little plus-shaped sparkles that shrink to a dot as they fade. */
  private drawMotes(g: Phaser.GameObjects.Graphics, motes: { x: number; y: number; age: number; life: number; c: PaletteName }[]): void {
    g.clear();
    for (const o of motes) {
      const t = o.age / o.life;
      if (t >= 1) continue;
      const x = Math.round(o.x);
      const y = Math.round(o.y);
      g.fillStyle(color(o.c), t < 0.6 ? 1 : 0.5);
      if (t < 0.4) {
        g.fillRect(x, y - 1, 1, 3);
        g.fillRect(x - 1, y, 3, 1);
      } else g.fillRect(x, y, 1, 1);
    }
  }

  /**
   * Before the bite, a fish's shadow glides in under the bobber from one side.
   * Just a dark shape of random size: you only see the fish once it leaves the water.
   */
  private drawShadow(phase: string, reduced: boolean): void {
    const g = this.shadow;
    g.clear();
    if (this.ctl.upcomingTier < 0 || (phase !== 'waiting' && phase !== 'bite')) return;
    const s = this.ctl.session;
    const cfg = FX.shadow;
    const left = phase === 'bite' ? 0 : s.duration - s.elapsed;
    if (left > cfg.leadMs) return;
    const p = 1 - left / cfg.leadMs;
    const ease = 1 - (1 - p) ** 2;
    const { bobber } = this.L;
    const { len, h } = this.shadowShape;
    const dx = reduced ? 0 : Math.round(this.shadowSide * cfg.startDx * (1 - ease));
    const wiggle = reduced || phase === 'bite' ? 0 : Math.round(Math.sin(this.elapsed / 160));
    const cx = bobber.x + dx + this.shadowSide * Math.round(len / 2);
    const cy = bobber.y + 5 + wiggle;
    g.fillStyle(color('ink'), cfg.alpha * Math.min(1, p * 2));
    // Body: a soft lozenge, with the tail on the side it came from.
    g.fillRect(cx - Math.floor(len / 2), cy - h + 1, len, h * 2 - 1);
    g.fillRect(cx - Math.floor(len / 2) + 1, cy - h, len - 2, h * 2 + 1);
    const tailX = this.shadowSide > 0 ? cx + Math.ceil(len / 2) : cx - Math.floor(len / 2) - 2;
    g.fillRect(tailX, cy - 1, 2, 1);
    g.fillRect(tailX + (this.shadowSide > 0 ? 1 : 0), cy + 1, 1, 1);
  }

  /** The fish leaps, twists off the hook, and splashes back. */
  private slipAway(): void {
    const { bobber } = this.L;
    const c = this.ctl.escaped!.result;
    const fish = this.ctx.registries.fish.tryGet(c.fishId);
    this.addRipple(bobber.x, bobber.y + 2, 14, 700, 'mist');
    this.bobber.setVisible(false);
    if (!fish) return;
    const j = this.add.image(bobber.x, bobber.y, fish.spriteKey).setFlipX(true);
    this.jumper = j;
    const t = { p: 0 };
    this.tweens.add({
      targets: t,
      p: 1,
      duration: FISHING.reelAnimMs * 0.9,
      ease: MOTION.ease,
      onUpdate: () => {
        j.setPosition(Math.round(bobber.x - t.p * 14), Math.round(bobber.y - Math.sin(t.p * Math.PI) * 22));
        j.setAngle(Math.round(t.p * 6) * 30);
      },
      onComplete: () => {
        this.addRipple(j.x, bobber.y + 2, 16, 900, 'mist');
        this.addRipple(j.x, bobber.y + 2, 8, 600, 'sky');
        j.setVisible(false);
      },
    });
  }

  /** Gentle words, and a hint when more tackle would have helped. */
  private escapeMessage(): string {
    const e = this.ctl.escaped!;
    const rarity = this.ctx.registries.rarities.tryGet(e.result.rarityId);
    const name = rarity ? rarity.name.toLowerCase() : 'fish';
    const article = /^[aeiou]/.test(name) ? 'An' : 'A';
    return e.chance >= ESCAPE_HINT_AT
      ? `${article} ${name} fish slipped away. Better rods, bait, and boats add tackle.`
      : `${article} ${name} fish slipped away. Next time!`;
  }

  /** The bonus line on the catch card: quick catch, clean fight, fresh bait, or several together. */
  private bonusLine(): string | undefined {
    const q = this.ctl.quick;
    const c = this.ctl.clean;
    const r = this.ctl.rested;
    const parts: { short: string; full: string; coins: number }[] = [];
    if (q) parts.push({ short: q.label.replace(' catch!', ''), full: q.label, coins: q.coins });
    if (c) parts.push({ short: 'clean', full: 'Clean landing!', coins: c.coins });
    if (r) parts.push({ short: 'fresh bait', full: 'Fresh bait x2!', coins: r.coins });
    if (parts.length === 0) return undefined;
    const coins = parts.reduce((s, p) => s + p.coins, 0);
    if (parts.length === 1) return `${parts[0]!.full} +${coins}`;
    const words = parts.map((p, i) => (i === 0 ? p.short : p.short.toLowerCase()));
    const last = words.pop()!;
    return `${words.join(', ')} and ${last}! +${coins}`;
  }

  /** "+6 Perfect catch!" rises from the boat (`lift` stacks a second one above). */
  private floatQuick(label: string, coins: number, lift = 0): void {
    const { boat } = this.L;
    const t = addText(this, boat.x + 4, boat.y - 34 - lift, `+${coins} ${label}`, { color: 'gold', originX: 0.5, outline: 'ink' }).setDepth(50);
    if (uiSignals.reducedMotion()) {
      this.time.delayedCall(1400, () => t.destroy());
      return;
    }
    this.tweens.add({ targets: t, y: t.y - 14, alpha: 0, delay: 500, duration: 1300, ease: MOTION.easeOut, onComplete: () => t.destroy() });
  }

  private showPopup(): void {
    const c = this.ctl.pending;
    if (!c) return;
    uiState.modal = true;
    const full = this.ctl.creelFull;
    const handlers: CatchPopupHandlers = {
      quick: this.bonusLine(),
      canKeep: !full,
      hint: full
        ? this.ctl.readyCount > 0
          ? 'Creel full! Sell the ready fish in it to make room.'
          : `Creel full! The next fish is ready in ${formatCountdown(this.ctl.nextReadyIn)}.`
        : this.ctl.state.totals.catches <= CREEL.hintCatches
          ? `Sell for coins now, or Keep: ready in ${formatCountdown(this.ctl.prepMs)}, then sell together for bonuses.`
          : undefined,
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

  /** The bobber tugs during the fight; marks above it show each dip, and a ring fills while you hold. */
  private updateFight(reduced: boolean): void {
    const { bobber } = this.L;
    const f = this.ctl.session.fight;
    const g = this.fightGfx;
    g.clear();
    if (!f) return;
    // The bobber dips hard during a dip, and twitches between them.
    const dy = f.stage === 'dip' ? FISHING.biteDipPx + 1 : reduced ? 0 : Math.round(Math.sin(this.elapsed / 90)) ;
    const dx = f.stage === 'hold' && !reduced ? Math.round(Math.sin(this.elapsed / 60)) : 0;
    this.bobber.setPosition(bobber.x + dx, bobber.y + dy);
    // Marks: one square per dip, then a ring for the hold.
    const n = this.fightMarks.length + (this.fightHold ? 1 : 0);
    const left = Math.round(bobber.x - (n * 6 - 2) / 2);
    const y = bobber.y - 30;
    this.fightMarks.forEach((m, i) => {
      const c = m === 'hit' ? 'sage' : m === 'miss' ? 'coral' : i === f.index ? 'gold' : 'dusk';
      g.fillStyle(color('ink'), 0.8);
      g.fillRect(left + i * 6 - 1, y - 1, 6, 6);
      g.fillStyle(color(c));
      g.fillRect(left + i * 6, y, 4, 4);
    });
    if (this.fightHold) {
      const hx = left + this.fightMarks.length * 6;
      g.fillStyle(color('ink'), 0.8);
      g.fillRect(hx - 1, y - 1, 6, 6);
      g.fillStyle(color(f.stage === 'hold' ? 'gold' : 'dusk'));
      g.fillRect(hx, y, 4, 4);
    }
    if (f.stage === 'hold') {
      // A ring around the bobber fills as you hold.
      const p = Math.min(1, f.heldMs / FIGHT.holdMs);
      const steps = 16;
      for (let i = 0; i < steps; i++) {
        const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
        g.fillStyle(color(i / steps < p ? 'gold' : 'dusk'), i / steps < p ? 1 : 0.6);
        g.fillRect(Math.round(bobber.x + Math.cos(a) * 9) - 1, Math.round(bobber.y - 2 + Math.sin(a) * 6), 2, 1);
      }
    }
    if (Math.floor(this.elapsed / 250) !== Math.floor((this.elapsed - 16) / 250)) this.refreshButtons();
  }

  private refreshButtons(): void {
    const phase = this.ctl.session.phase;
    this.castButton.setVisible(phase !== 'landed');
    const holding = phase === 'fight' && this.ctl.session.fight?.stage === 'hold';
    this.castButton.setLabel(holding ? 'Hold!' : (LABELS[phase] ?? 'Cast'));
    this.castButton.setHighlighted(phase === 'bite' || phase === 'fight');
    this.castButton.setDisabled(phase === 'casting' || phase === 'reeling');
    const cap = this.ctx.stats.get('storageCap');
    this.creelButton.setLabel(`${this.ctl.state.creel.length}/${cap}`);
    const rested = this.ctl.state.rested;
    this.restedButton.setVisible(rested > 0);
    this.restedButton.setLabel(`x${rested}`);
  }

  /**
   * A rarer fish is near: a soft glow in its rarity color around the bobber
   * while you wait (blue for rare, purple for epic, gold for legendary).
   */
  private drawRareGlow(phase: string, reduced: boolean): void {
    const g = this.glow;
    g.clear();
    const tier = this.ctl.upcomingTier;
    if ((phase !== 'waiting' && phase !== 'bite') || tier < FISHING.glowMinTier) return;
    const rarity = this.ctx.registries.rarities.tryGet(this.ctl.upcomingRarity ?? '');
    if (!rarity) return;
    const { bobber } = this.L;
    const pulse = reduced ? 0.5 : (Math.sin(this.elapsed / 700) + 1) / 2;
    const strength = FISHING.glowAlpha * (0.6 + 0.4 * pulse) * (0.7 + 0.15 * (tier - FISHING.glowMinTier));
    // A soft filled pool of light with a clearer rim.
    const rx = 11 + Math.round(pulse * 2);
    const ry = 4;
    g.fillStyle(color(rarity.color), strength * 0.35);
    for (let dy = -ry; dy <= ry; dy++) {
      const half = Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2));
      g.fillRect(bobber.x - half, bobber.y + 2 + dy, half * 2 + 1, 1);
    }
    drawPixelEllipse(g, bobber.x, bobber.y + 2, rx, ry, rarity.color, strength);
    drawPixelEllipse(g, bobber.x, bobber.y + 2, rx + 5, ry + 2, rarity.color, strength * 0.4);
    // A slow twinkle for epic and legendary fish.
    if (tier >= FISHING.glowMinTier + 1 && !reduced && Math.floor(this.elapsed / 600) % 3 === 0) {
      const a = (this.elapsed / 900) % (Math.PI * 2);
      g.fillStyle(color(rarity.color), strength);
      g.fillRect(Math.round(bobber.x + Math.cos(a) * 12), Math.round(bobber.y + 2 + Math.sin(a) * 4), 1, 1);
    }
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
    } else if (phase === 'fight') {
      this.updateFight(reduced);
    }

    // Line from rod tip to bobber.
    this.line.clear();
    if (this.bobber.visible) {
      const sag = phase === 'bite' || phase === 'fight' ? 1 : 6;
      drawSaggingLine(this.line, worldAnchors.rodTip.x, worldAnchors.rodTip.y, this.bobber.x, this.bobber.y - 3, sag, 'mist');
    } else if (this.jumper) {
      drawSaggingLine(this.line, worldAnchors.rodTip.x, worldAnchors.rodTip.y, this.jumper.x, this.jumper.y, 1, 'mist');
    }

    this.drawShadow(phase, reduced);
    this.drawRareGlow(phase, reduced);
    if (this.moment) {
      for (const o of this.moment.motes) this.stepMote(o, delta);
      this.moment.motes = this.moment.motes.filter((o) => o.age < o.life);
      this.drawMotes(this.moment.sparks, this.moment.motes);
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
