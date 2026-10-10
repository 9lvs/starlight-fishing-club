// Heads-up display: currencies, water name, time of day and weather, the menu
// bar built from every feature's menu entries, toasts, and the panel host.
import Phaser from 'phaser';
import { clubBonus } from '../core/club';
import { getContext, type GameContext } from '../core/context';
import { getLayout, type Layout } from '../core/layout';
import { uiState } from '../core/sceneState';
import { TIME } from '../config/time';
import { UI_TIMING } from '../config/tuning';
import { UI, color } from '../design/tokens';
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
  private bonusText!: PixelText;
  private phaseIcon!: Phaser.GameObjects.Image;
  private weatherIcon!: Phaser.GameObjects.Image;
  private toasts!: ToastLayer;
  private badges: { dot: Phaser.GameObjects.Rectangle; check: (ctx: GameContext) => boolean }[] = [];
  private offs: (() => void)[] = [];
  private badgeTimer = 0;

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

    // Top bar background: a soft dithered strip so numbers stay readable on any sky.
    const dither = this.textures.exists('dither_50') ? 'dither_50' : '__WHITE';
    this.add.tileSprite(0, 0, this.L.width, topBar.y + topBar.h, dither).setOrigin(0, 0).setTint(color('ink')).setAlpha(0.55);

    this.buildCurrencies();
    this.phaseIcon = addIcon(this, topBar.x + topBar.w - 30, topBar.y + 3, 'icon_sun');
    this.weatherIcon = addIcon(this, topBar.x + topBar.w - 15, topBar.y + 3, 'icon_clear');
    this.phaseIcon.setInteractive();
    this.weatherIcon.setInteractive();
    attachTooltip(this, this.phaseIcon, () => TIME.phases.find((p) => p.id === this.ctx.world.phase)?.name ?? '');
    attachTooltip(this, this.weatherIcon, () => this.ctx.registries.weather.tryGet(this.ctx.world.weather)?.name ?? '');
    this.waterText = addText(this, this.L.width / 2, topBar.y + topBar.h + 2, '', { color: 'mist' });
    this.bonusText = addText(this, this.L.width / 2, topBar.y + topBar.h + 2, '', { color: 'gold' });
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
      const text = addText(this, 0, this.L.topBar.y + 4, '0', { color: c.color });
      this.currencies.push({ id: c.id, icon, text, shown: this.ctx.wallet.get(c.id) });
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
    // The club bonus sits next to the water name so the reward for moving stays in view.
    const bonus = clubBonus(this.ctx);
    this.bonusText.setText(bonus > 0 ? `+${Math.round(bonus * 100)}%` : '');
    const total = this.waterText.textWidth + (bonus > 0 ? 4 + this.bonusText.textWidth : 0);
    const x = Math.round(this.L.width / 2 - total / 2);
    this.waterText.setX(x);
    this.bonusText.setX(x + this.waterText.textWidth + 4);
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
    const slot = Math.min(UI.menuSlotMax, Math.floor(w / entries.length));
    const bw = Math.min(30, slot - 2);
    const left = x + Math.floor((w - slot * entries.length) / 2);
    entries.forEach((e, i) => {
      const bx = left + i * slot + Math.round((slot - bw) / 2);
      const btn = new Button(this, {
        x: bx,
        y: y + 2,
        w: bw,
        h: h - 4,
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

  override update(_t: number, delta: number): void {
    // Count currencies up gently instead of jumping.
    for (const v of this.currencies) {
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
