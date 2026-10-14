// Heads-up display: currencies, water name, time of day and weather, the menu
// bar built from every feature's menu entries, toasts, and the panel host.
import Phaser from 'phaser';
import { clubBonus } from '../core/club';
import { getContext, type GameContext } from '../core/context';
import { getLayout, menuSlots, type Layout } from '../core/layout';
import { uiState } from '../core/sceneState';
import { TIME } from '../config/time';
import { FX, UI_TIMING } from '../config/tuning';
import { ECONOMY } from '../config/balance';
import { MOTION, color } from '../design/tokens';
import { uiSignals } from '../ui/uiSignals';
import { Button } from '../ui/Button';
import { addIcon } from '../ui/Icon';
import { ToastLayer } from '../ui/Toast';
import { attachTooltip } from '../ui/Tooltip';
import { formatNumber } from '../ui/format';
import { addText, type PixelText } from '../ui/text';

interface CurrencyView {
  id: string;
  icon: Phaser.GameObjects.Image;
  text: PixelText;
  shown: number;
}

export class HudScene extends Phaser.Scene {
  private ctx!: GameContext;
  private L!: Layout;
  private currencies: CurrencyView[] = [];
  private waterText!: PixelText;
  private phaseIcon!: Phaser.GameObjects.Image;
  private weatherIcon!: Phaser.GameObjects.Image;
  private toasts!: ToastLayer;
  private badges: { dot: Phaser.GameObjects.Rectangle; check: (ctx: GameContext) => boolean }[] = [];
  private offs: (() => void)[] = [];
  private badgeTimer = 0;
  /** Coins sold this frame, waiting to fly to the counter (sales arrive in bursts). */
  private flyQueue: { amount: number; fromBoat: boolean } | null = null;
  /** The coin counter waits for flying coins to land before it counts up. */
  private holdCoinsMs = 0;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.ctx = getContext();
    this.L = getLayout();
    this.currencies = [];
    this.badges = [];
    this.offs = [];
    const { topBar, menuBar } = this.L;

    // Top bar: a solid band with a soft edge, so coin numbers read on any sky.
    const barH = topBar.y + topBar.h;
    const bar = this.add.graphics();
    bar.fillStyle(color('ink'), 0.88);
    bar.fillRect(0, 0, this.L.width, barH);
    bar.fillStyle(color('dusk'));
    bar.fillRect(0, barH, this.L.width, 1);
    const dither = this.textures.exists('dither_50') ? 'dither_50' : '__WHITE';
    this.add.tileSprite(0, barH + 1, this.L.width, 2, dither).setOrigin(0, 0).setTint(color('ink')).setAlpha(0.5);

    this.buildCurrencies();
    this.phaseIcon = addIcon(this, topBar.x + topBar.w - 30, topBar.y + 3, 'icon_sun');
    this.weatherIcon = addIcon(this, topBar.x + topBar.w - 15, topBar.y + 3, 'icon_clear');
    this.phaseIcon.setInteractive();
    this.weatherIcon.setInteractive();
    attachTooltip(this, this.phaseIcon, () => TIME.phases.find((p) => p.id === this.ctx.world.phase)?.name ?? '');
    attachTooltip(this, this.weatherIcon, () => this.ctx.registries.weather.tryGet(this.ctx.world.weather)?.name ?? '');
    this.waterText = addText(this, this.L.width / 2, topBar.y + topBar.h + 4, '', { color: 'mist', outline: 'ink' });
    this.refreshWorld();

    this.buildMenu(menuBar.x, menuBar.y, menuBar.w, menuBar.h);
    this.toasts = new ToastLayer(this, Math.round(this.L.width / 2), topBar.y + topBar.h + 16);

    const bus = this.ctx.bus;
    this.offs.push(
      bus.on('ui:toast', (t) => this.toasts.push({ text: t.text, icon: t.icon, color: t.color as never })),
      bus.on('timeOfDayChanged', () => this.refreshWorld()),
      bus.on('weatherChanged', () => this.refreshWorld()),
      bus.on('waterChanged', () => this.refreshWorld()),
      bus.on('clubMoved', () => {
        // A fresh start: show the new balance at once rather than counting down.
        for (const v of this.currencies) v.shown = this.ctx.wallet.get(v.id);
        this.layoutCurrencies();
        this.refreshWorld();
      }),
      bus.on('ui:openPanel', ({ sceneKey, data }) => this.openPanel(sceneKey, data)),
      bus.on('currencyChanged', () => this.layoutCurrencies()),
      bus.on('fishSold', ({ value, currency, source }) => {
        if (source === 'crew' || currency !== 'coins') return;
        const q = (this.flyQueue ??= { amount: 0, fromBoat: false });
        q.amount += value;
        // A catch sold by hand flies from the boat; a creel sale from just under the bar (the panel is open).
        if (source === 'hand') q.fromBoat = true;
      }),
      bus.on('viewportChanged', () => this.scene.restart()),
    );
    this.events.once('shutdown', () => this.offs.forEach((off) => off()));
    const pending = this.ctx.ui.drainPending();
    pending.toasts.forEach((t) => this.toasts.push({ text: t.text, icon: t.icon, color: t.color as never }));
    pending.panels.forEach((p) => this.openPanel(p.sceneKey, p.data));
  }

  private buildCurrencies(): void {
    const list = [...this.ctx.registries.currencies.list()].sort((a, b) => a.order - b.order);
    for (const c of list) {
      const icon = addIcon(this, 0, this.L.topBar.y + 3, c.icon);
      const text = addText(this, 0, this.L.topBar.y + 4, '0', { color: c.color, outline: 'ink' });
      this.currencies.push({ id: c.id, icon, text, shown: this.ctx.wallet.get(c.id) });
      // The club bonus lives here, out of the way: tap the coins to see it.
      if (c.id === ECONOMY.defaultCurrency) {
        icon.setInteractive();
        attachTooltip(this, icon, () => {
          const bonus = clubBonus(this.ctx);
          return bonus > 0 ? `Club bonus: +${Math.round(bonus * 100)}% on every sale` : 'Moving the club adds a lasting coin bonus';
        });
      }
    }
    this.layoutCurrencies();
  }

  private layoutCurrencies(): void {
    let x = this.L.topBar.x + 3;
    for (const v of this.currencies) {
      const def = this.ctx.registries.currencies.get(v.id);
      const visible = !def.hidden || this.ctx.wallet.get(v.id) > 0;
      v.icon.setVisible(visible);
      v.text.setVisible(visible);
      if (!visible) continue;
      v.icon.setX(x);
      v.text.setX(x + 14);
      v.text.setText(formatNumber(v.shown));
      x += 14 + Math.max(24, v.text.textWidth) + 8;
    }
  }

  private refreshWorld(): void {
    const w = this.ctx.registries.waters.tryGet(this.ctx.world.waterId);
    this.waterText.setText(w?.name ?? '');
    this.waterText.setX(Math.round(this.L.width / 2 - this.waterText.textWidth / 2));
    const phase = TIME.phases.find((p) => p.id === this.ctx.world.phase);
    if (phase && this.textures.exists(phase.icon)) this.phaseIcon.setTexture(phase.icon);
    const weather = this.ctx.registries.weather.tryGet(this.ctx.world.weather);
    if (weather && this.textures.exists(weather.icon)) this.weatherIcon.setTexture(weather.icon);
  }

  private buildMenu(x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    g.fillStyle(color('ink'), 0.85);
    g.fillRect(0, y, this.L.width, this.L.height - y);
    g.fillStyle(color('dusk'));
    g.fillRect(0, y, this.L.width, 1);
    const entries = this.ctx.features.menuEntries();
    if (entries.length === 0) return;
    const slots = menuSlots({ x, y, w, h }, entries.length);
    entries.forEach((e, i) => {
      const r = slots[i]!;
      const bx = r.x;
      const bw = r.w;
      const btn = new Button(this, {
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        icon: e.icon,
        variant: 'ghost',
        onClick: () => {
          if (e.sceneKey) this.ctx.ui.openPanel(e.sceneKey);
          else e.action?.(this.ctx);
        },
      });
      attachTooltip(this, btn.hit, () => e.label);
      if (e.badge) {
        const dot = this.add.rectangle(bx + bw - 5, y + 4, 3, 3, color('gold')).setOrigin(0, 0).setVisible(false);
        this.badges.push({ dot, check: e.badge });
      }
    });
  }

  private openPanel(sceneKey: string, data: unknown): void {
    if (!this.scene.manager.keys[sceneKey]) {
      console.warn(`[hud] no panel scene "${sceneKey}"`);
      return;
    }
    const current = uiState.openPanel;
    if (current) {
      this.scene.stop(current);
      uiState.openPanel = null;
      if (current === sceneKey) {
        this.ctx.bus.emit('ui:panelClosed', { sceneKey });
        return;
      }
    }
    this.scene.launch(sceneKey, data as object | undefined);
  }

  /** A few coins arc up from the boat to the coin counter, more for a bigger sale. */
  private flyCoins(amount: number, fromBoat: boolean): void {
    const view = this.currencies.find((v) => v.id === 'coins');
    if (!view || !view.icon.visible || uiSignals.reducedMotion()) return;
    if (!this.textures.exists('fx_coin')) {
      const g = this.make.graphics({}, false);
      g.fillStyle(color('bark'));
      g.fillRect(1, 0, 3, 5);
      g.fillRect(0, 1, 5, 3);
      g.fillStyle(color('gold'));
      g.fillRect(1, 1, 3, 3);
      g.fillStyle(color('mist'));
      g.fillRect(1, 1, 1, 1);
      g.generateTexture('fx_coin', 5, 5);
      g.destroy();
    }
    const cfg = FX.coins;
    const n = Math.max(cfg.min, Math.min(cfg.max, Math.round(Math.log10(amount + 1) * 2)));
    const from = fromBoat
      ? { x: this.L.boat.x + 4, y: this.L.boat.y - 18 }
      : { x: Math.round(this.L.width / 2), y: this.L.topBar.y + this.L.topBar.h - 2 };
    const to = { x: view.icon.x + 6, y: view.icon.y + 6 };
    this.holdCoinsMs = cfg.flyMs;
    for (let i = 0; i < n; i++) {
      const coin = this.add.image(from.x + (i % 3) * 2 - 2, from.y, 'fx_coin').setDepth(1000);
      const side = (i % 2 ? 1 : -1) * (6 + (i % 3) * 4);
      const t = { p: 0 };
      const sx = coin.x;
      this.tweens.add({
        targets: t,
        p: 1,
        delay: i * cfg.staggerMs,
        duration: cfg.flyMs,
        ease: 'Sine.easeIn',
        onUpdate: () => {
          // A gentle curve: out to one side and up, then into the counter.
          const q = 1 - t.p;
          const cx = (sx + to.x) / 2 + side;
          const cy = Math.min(from.y, to.y) - cfg.liftPx + (fromBoat ? 0 : cfg.liftPx);
          coin.setPosition(Math.round(q * q * sx + 2 * q * t.p * cx + t.p * t.p * to.x), Math.round(q * q * from.y + 2 * q * t.p * cy + t.p * t.p * to.y));
        },
        onComplete: () => {
          coin.destroy();
          if (i !== 0) return;
          // The counter gives a tiny nod as the first coin lands.
          const base = this.L.topBar.y + 3;
          this.tweens.killTweensOf(view.icon);
          view.icon.setY(base);
          this.tweens.add({ targets: view.icon, y: base - 1, duration: 70, yoyo: true, ease: MOTION.easeOut, onComplete: () => view.icon.setY(base) });
        },
      });
    }
  }

  override update(_t: number, delta: number): void {
    if (this.flyQueue) {
      this.flyCoins(this.flyQueue.amount, this.flyQueue.fromBoat);
      this.flyQueue = null;
    }
    // Count currencies up gently instead of jumping.
    this.holdCoinsMs = Math.max(0, this.holdCoinsMs - delta);
    for (const v of this.currencies) {
      if (v.id === 'coins' && this.holdCoinsMs > 0) continue;
      const target = this.ctx.wallet.get(v.id);
      if (v.shown === target) continue;
      const step = Math.max(1, Math.abs(target - v.shown) * Math.min(1, delta / UI_TIMING.coinTickMs));
      v.shown = target > v.shown ? Math.min(target, v.shown + step) : Math.max(target, v.shown - step);
      if (Math.abs(target - v.shown) < 1) v.shown = target;
      this.layoutCurrencies();
    }
    this.badgeTimer += delta;
    if (this.badgeTimer > 500) {
      this.badgeTimer = 0;
      for (const b of this.badges) b.dot.setVisible(b.check(this.ctx));
    }
  }
}
