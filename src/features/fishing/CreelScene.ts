// The creel: fish you chose to keep. Each is prepped for market first, then
// sells at today's prices, together for the bundle bonus and matching sets.
import { ECONOMY } from '../../config/balance';
import { CREEL } from '../../config/tuning';
import type { Rect } from '../../core/layout';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { drawPanelBox } from '../../ui/pixelDraw';
import { ScrollArea } from '../../ui/ScrollArea';
import { addText } from '../../ui/text';
import { formatCountdown, formatNumber } from '../../ui/format';
import { ProgressBar } from '../../ui/ProgressBar';
import { getFishingController } from './controller';

const ROW_H = 22;
/** While fish are being prepped, the countdowns tick once a second. */
const REDRAW_MS = 1000;

interface CreelData {
  scroll?: number;
}

export class CreelScene extends PanelScene<CreelData> {
  readonly title = 'Creel';
  override readonly icon = 'icon_creel';

  constructor() {
    super('Creel');
  }

  protected build(area: Rect, data?: CreelData): void {
    const ctl = getFishingController();
    const r = this.ctx.registries;
    const cap = this.ctx.stats.get('storageCap');
    const items = ctl.state.creel;
    const coinIcon = r.currencies.tryGet(ECONOMY.defaultCurrency)?.icon;
    const sale = ctl.creelSale();
    const ready = ctl.readyCount;
    const prepping = items.length - ready;
    addText(this, area.x, area.y, prepping > 0 ? `${ready} ready, ${prepping} prepping (${items.length}/${cap})` : `${items.length} of ${cap} spaces used`, { color: 'sky', shadow: false });
    addText(this, area.x + area.w - 3, area.y + 12, sale.bundleShare > 0 ? `Bundle +${Math.round(sale.bundleShare * 100)}%` : 'Bundle: 2+ ready', {
      color: sale.bundleShare > 0 ? 'gold' : 'slate',
      shadow: false,
      originX: 1,
    });

    // Matching sets: what is earned now, or how close the nearest set is.
    const setLine = sale.sets.length
      ? 'Sets: ' + sale.sets.map((x) => `${x.size} ${(r.rarities.tryGet(x.id)?.name ?? x.id).toLowerCase()} +${Math.round(x.share * 100)}%`).join(', ')
      : this.nearestSet();
    const sl = addText(this, area.x, area.y + 24, setLine, { color: sale.sets.length ? 'gold' : 'slate', shadow: false, maxWidth: area.w - 3 });
    const top = area.y + 24 + sl.textHeight + 4;

    new Button(this, {
      x: area.x,
      y: area.y + area.h - 26,
      w: area.w,
      h: 26,
      label: ready > 0 ? `Sell ${ready === items.length ? 'all' : `${ready} ready`} +${formatNumber(sale.total)}` : items.length ? `First ready in ${formatCountdown(ctl.nextReadyIn)}` : 'Nothing to sell',
      icon: ready > 0 ? coinIcon : undefined,
      variant: 'primary',
      disabled: ready === 0,
      onClick: () => {
        const got = ctl.sellAllCreel();
        if (got.total > 0) {
          const setBonus = got.sets.reduce((a, x) => a + x.bonus, 0);
          const extras = [got.bundle > 0 ? `bundle +${formatNumber(got.bundle)}` : '', setBonus > 0 ? `sets +${formatNumber(setBonus)}` : ''].filter(Boolean);
          this.ctx.ui.toast(extras.length ? `Sold for ${formatNumber(got.total)} (${extras.join(', ')})` : `Sold for ${formatNumber(got.total)}`, { icon: coinIcon });
        }
        this.refresh();
      },
    });

    if (items.length === 0) {
      addText(this, area.x + area.w / 2, top + 16, `Tap Keep to save a catch here.\n\nKept fish take ${formatCountdown(ctl.prepMs)} to prep for market. Then they sell together for a bonus, more for 3, 5, or 10 of a rarity.`, {
        maxWidth: area.w - 8,
        originX: 0.5,
        align: 'center',
        color: 'sky',
      });
      return;
    }

    const list = new ScrollArea(this, { x: area.x, y: top, w: area.w, h: area.y + area.h - 30 - top });
    items.forEach((item, i) => {
      const fish = r.fish.tryGet(item.fishId);
      const rarity = fish ? r.rarities.tryGet(fish.rarity) : undefined;
      const y = i * ROW_H;
      const g = this.add.graphics();
      drawPanelBox(g, 0, y, area.w - 3, ROW_H - 2, { fill: 'ink', border: rarity?.frame ?? 'midnight' });
      list.add(g);
      if (fish) {
        list.add(this.add.image(3, y + 2, fish.spriteKey).setOrigin(0, 0));
        list.add(addText(this, 22, y + 1, fish.name, { shadow: false, color: rarity?.color ?? 'mist', maxWidth: area.w - 74 }));
      }
      // A bar under the name fills while the fish is prepped. Ready fish just show their lit sell button.
      const left = ctl.prepLeft(item);
      if (left > 0) {
        const bar = new ProgressBar(this, 22, y + 13, area.w - 74 - 4, 3, 'sand');
        bar.setValue(1 - left / Math.max(1, ctl.prepMs));
        list.add(bar);
      }
      list.add(
        new Button(this, {
          x: area.w - 46,
          y: y + 1,
          w: 42,
          h: 18,
          label: left <= 0 ? `+${formatNumber(ctl.creelValue(i))}` : formatCountdown(left),
          variant: 'secondary',
          disabled: left > 0,
          onClick: () => {
            ctl.sellFromCreel(i);
            this.refresh({ scroll: list.position });
          },
        }),
      );
    });
    list.setContentHeight(items.length * ROW_H);
    if (data?.scroll) list.scrollTo(data.scroll);
    if (prepping > 0) this.time.addEvent({ delay: REDRAW_MS, callback: () => this.refresh({ scroll: list.position }) });
  }

  /** The rarity closest to its next set, as a nudge. */
  private nearestSet(): string {
    const r = this.ctx.registries;
    const counts = new Map<string, number>();
    for (const item of getFishingController().state.creel) {
      const id = r.fish.tryGet(item.fishId)?.rarity;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const smallest = Math.min(...CREEL.sets.map((x) => x.size));
    let best: { id: string; need: number } | null = null;
    for (const [id, n] of counts) if (!best || smallest - n < best.need) best = { id, need: smallest - n };
    if (!best) return `Match ${CREEL.sets.map((x) => x.size).join(', ')} of a rarity for a set bonus.`;
    const name = (r.rarities.tryGet(best.id)?.name ?? best.id).toLowerCase();
    return `${best.need} more ${name} ${best.need === 1 ? 'fish makes' : 'fish make'} a set of ${smallest}.`;
  }
}
