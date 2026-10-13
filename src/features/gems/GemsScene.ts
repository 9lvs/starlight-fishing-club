// Gem Exchange: how to find gems, and coins traded for gems at a rate that
// rises with the club bonus.
import { ECONOMY } from '../../config/balance';
import { GEMS } from '../../config/tuning';
import type { Rect } from '../../core/layout';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { formatNumber } from '../../ui/format';
import { addText } from '../../ui/text';
import { getGemService } from './service';

export class GemsScene extends PanelScene {
  readonly title = 'Gem Exchange';
  override readonly icon = 'icon_gem';

  constructor() {
    super('Gems');
  }

  protected build(area: Rect): void {
    const svc = getGemService();
    const r = this.ctx.registries;
    const gem = r.currencies.tryGet(GEMS.currency);
    const coin = r.currencies.tryGet(ECONOMY.defaultCurrency);
    const cx = Math.round(area.x + area.w / 2);
    let y = area.y + 2;
    if (gem) this.add.image(cx - 22, y + 2, gem.icon).setOrigin(0, 0);
    addText(this, cx - 6, y + 3, formatNumber(this.ctx.wallet.get(GEMS.currency)), { color: 'lavender', scale: 2 });
    y += 26;
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    const about = addText(
      this,
      area.x + 2,
      y,
      `Gems buy looks for your club, boat, and fisher. They stay with you when the club moves.\n\nAny catch can bring up a gem: ${pct(GEMS.base)} for a common fish, up to ${pct(GEMS.max)} for a legendary. Your crew find them too, even while you are away.`,
      { color: 'sky', shadow: false, maxWidth: area.w - 4 },
    );
    y += about.textHeight + 10;

    addText(this, cx, y, `Trade: ${formatNumber(svc.rate)} coins for 1 gem`, { originX: 0.5, color: 'gold', shadow: false });
    y += 12;
    const note = addText(this, cx, y, 'The price rises with your club bonus.', { originX: 0.5, color: 'slate', shadow: false, maxWidth: area.w - 4, align: 'center' });
    y += note.textHeight + 6;
    const steps = GEMS.tradeSteps;
    const gap = 4;
    const bw = Math.floor((area.w - gap * (steps.length - 1)) / steps.length);
    steps.forEach((n, i) => {
      new Button(this, {
        x: area.x + i * (bw + gap),
        y,
        w: bw,
        h: 22,
        label: `+${n}`,
        icon: gem?.icon,
        variant: svc.canTrade(n) ? 'primary' : 'secondary',
        disabled: !svc.canTrade(n),
        onClick: () => {
          if (svc.trade(n)) this.ctx.ui.toast(`Traded ${formatNumber(svc.rate * n)} coins for ${n} ${n === 1 ? 'gem' : 'gems'}`, { icon: gem?.icon });
          this.refresh();
        },
      });
    });
    y += 26;
    addText(this, cx, y, `You have ${formatNumber(this.ctx.wallet.get(ECONOMY.defaultCurrency))} coins`, { originX: 0.5, color: coin?.color ?? 'gold', shadow: false });
    y += 14;
    const tip = addText(this, cx, y, 'Coins reset when the club moves. Gems do not, so trading before a move keeps some of your savings.', {
      originX: 0.5,
      align: 'center',
      color: 'slate',
      shadow: false,
      maxWidth: area.w - 4,
    });
    y += tip.textHeight + 8;
    new Button(this, {
      x: area.x,
      y: Math.max(y, area.y + area.h - 24),
      w: area.w,
      h: 22,
      label: 'Spend gems in Club',
      icon: 'icon_flag',
      variant: 'secondary',
      onClick: () => {
        this.close();
        this.ctx.ui.openPanel('Upgrades', { branch: 'club' });
      },
    });
    this.listen('currencyChanged', () => this.refresh());
  }
}
