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
/** Freshness drifts slowly, so the list redraws now and then rather than every frame. */
const REDRAW_MS = 10_000;

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
    addText(this, area.x, area.y, `${items.length} of ${cap} spaces used`, { color: 'sky', shadow: false });
    addText(this, area.x + area.w - 3, area.y, sale.bundleShare > 0 ? `Bundle +${Math.round(sale.bundleShare * 100)}%` : 'Bundle: keep 2+', {
      color: sale.bundleShare > 0 ? 'gold' : 'slate',
      shadow: false,
      originX: 1,
    });

    // Matching sets: what is earned now, or how close the nearest set is.
    const setLine = sale.sets.length
      ? 'Sets: ' + sale.sets.map((x) => `${x.size} ${(r.rarities.tryGet(x.id)?.name ?? x.id).toLowerCase()} +${Math.round(x.share * 100)}%`).join(', ')
      : this.nearestSet();
    const sl = addText(this, area.x, area.y + 12, setLine, { color: sale.sets.length ? 'gold' : 'slate', shadow: false, maxWidth: area.w - 3 });
    const top = area.y + 12 + sl.textHeight + 4;

    new Button(this, {
      x: area.x,
      y: area.y + area.h - 26,
      w: area.w,
      h: 26,
      label: items.length ? `Sell all +${formatNumber(sale.total)}` : 'Nothing to sell',
      icon: coinIcon,
      variant: 'primary',
      disabled: items.length === 0,
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
      const sizes = CREEL.sets.map((x) => x.size).join(', ');
      addText(
        this,
        area.x + area.w / 2,
        top + 20,
        `Tap Keep on a catch to save it here. Crew catches from your time away land here too.\n\nSell together for a bundle bonus (+${Math.round(CREEL.bundlePerFish * 100)}% per fish after the first) and a set bonus for ${sizes} of one rarity. Rarer sets pay more.\n\nKept fish lose freshness while you play, so sell them soon.`,
        { maxWidth: area.w - 8, originX: 0.5, align: 'center', color: 'sky' },
      );
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
        list.add(addText(this, 22, y + 2, fish.name, { shadow: false, color: rarity?.color ?? 'mist', maxWidth: area.w - 74 }));
      }
      // Freshness under the name; crew catches are marked.
      const f = ctl.freshness(item);
      const fresh = f >= 0.999 ? 'Fresh' : `${Math.round(f * 100)}% fresh`;
      list.add(addText(this, 22, y + 11, item.crew ? `${fresh}, crew` : fresh, { shadow: false, color: f >= 0.999 ? 'sage' : f > 0.8 ? 'sand' : 'coral' }));
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
            this.refresh({ scroll: list.position });
          },
        }),
      );
    });
    list.setContentHeight(items.length * ROW_H);
    if (data?.scroll) list.scrollTo(data.scroll);
    this.time.addEvent({ delay: REDRAW_MS, callback: () => this.refresh({ scroll: list.position }) });
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
