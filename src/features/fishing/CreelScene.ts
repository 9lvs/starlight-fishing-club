// The creel: fish you chose to keep. Sell one or all at today's prices.
import { ECONOMY } from '../../config/balance';
import { CREEL } from '../../config/tuning';
import type { Rect } from '../../core/layout';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { drawPanelBox } from '../../ui/pixelDraw';
import { ScrollArea } from '../../ui/ScrollArea';
import { addText } from '../../ui/text';
import { formatNumber } from '../../ui/format';
import { getFishingController } from './controller';

const ROW_H = 22;

export class CreelScene extends PanelScene {
  readonly title = 'Creel';
  override readonly icon = 'icon_creel';

  constructor() {
    super('Creel');
  }

  protected build(area: Rect): void {
    const ctl = getFishingController();
    const cap = this.ctx.stats.get('storageCap');
    const items = ctl.state.creel;
    const coinIcon = this.ctx.registries.currencies.tryGet(ECONOMY.defaultCurrency)?.icon;
    addText(this, area.x, area.y, `${items.length} of ${cap} spaces used`, { color: 'sky', shadow: false });
    const share = ctl.bundleShare;
    addText(this, area.x + area.w - 3, area.y, share > 0 ? `Bundle +${Math.round(share * 100)}%` : 'Bundle: keep 2+', {
      color: share > 0 ? 'gold' : 'slate',
      shadow: false,
      originX: 1,
    });

    const base = items.reduce((s, _it, i) => s + ctl.creelValue(i), 0);
    const total = base + Math.round(base * share);
    new Button(this, {
      x: area.x,
      y: area.y + area.h - 26,
      w: area.w,
      h: 26,
      label: items.length ? `Sell all +${formatNumber(total)}` : 'Nothing to sell',
      icon: coinIcon,
      variant: 'primary',
      disabled: items.length === 0,
      onClick: () => {
        const got = ctl.sellAllCreel();
        if (got > 0) {
          const extra = got - base;
          this.ctx.ui.toast(extra > 0 ? `Sold everything for ${formatNumber(got)} (bundle +${formatNumber(extra)})` : `Sold for ${formatNumber(got)}`, { icon: coinIcon });
        }
        this.refresh();
      },
    });

    if (items.length === 0) {
      addText(this, area.x + area.w / 2, area.y + 40, `Tap Keep on a catch to save it here.\n\nFish sold together earn a bundle bonus: +${Math.round(CREEL.bundlePerFish * 100)}% for each fish after the first, up to +${Math.round(CREEL.bundleMax * 100)}%.\n\nKept fish also sell at the price you have later, so upgrades raise their value.`, {
        maxWidth: area.w - 8,
        originX: 0.5,
        align: 'center',
        color: 'sky',
      });
      return;
    }

    const list = new ScrollArea(this, { x: area.x, y: area.y + 14, w: area.w, h: area.h - 14 - 30 });
    items.forEach((item, i) => {
      const fish = this.ctx.registries.fish.tryGet(item.fishId);
      const y = i * ROW_H;
      const g = this.add.graphics();
      drawPanelBox(g, 0, y, area.w - 3, ROW_H - 2, { fill: 'ink', border: 'midnight' });
      list.add(g);
      if (fish) {
        list.add(this.add.image(3, y + 2, fish.spriteKey).setOrigin(0, 0));
        list.add(addText(this, 22, y + 4, fish.name, { shadow: false, color: 'mist' }));
      }
      list.add(
        new Button(this, {
          x: area.w - 46,
          y: y + 1,
          w: 42,
          h: 18,
          label: `+${formatNumber(ctl.creelValue(i))}`,
          variant: 'secondary',
          onClick: () => {
            ctl.sellFromCreel(i);
            this.refresh();
          },
        }),
      );
    });
    list.setContentHeight(items.length * ROW_H);
  }
}
