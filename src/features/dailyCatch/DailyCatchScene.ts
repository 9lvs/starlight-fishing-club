// Daily Catch panel: today's fish, where and when it bites, your first five
// catches of the day with a luck score, and Share.
import { DAILY_CATCH } from '../../config/tuning';
import { TIME } from '../../config/time';
import type { Rect } from '../../core/layout';
import { color, type PaletteName } from '../../design/tokens';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { formatNumber } from '../../ui/format';
import { RarityBanner } from '../../ui/RarityBanner';
import { gameUrl, shareText } from '../../ui/share';
import { addText } from '../../ui/text';
import { getDailyCatch } from './service';
import { luckLabel, luckScore, type FirstCatch } from './state';

export class DailyCatchScene extends PanelScene {
  readonly title = 'Daily Catch';
  override readonly icon = 'icon_daily';

  constructor() {
    super('DailyCatch');
  }

  protected build(area: Rect): void {
    // Lay out at full size first. If it runs into the buttons (short or wide
    // screens), lay out again in a compact form rather than overlapping.
    const before = this.children.list.length;
    if (!this.layout(area, false)) {
      for (const o of this.children.list.slice(before)) o.destroy();
      this.layout(area, true);
    }
    this.listen('dailyCatchCaught', () => this.refresh());
    this.listen('catchLanded', () => this.refresh());
  }

  /** Returns false when the content did not fit above the buttons. */
  private layout(area: Rect, compact: boolean): boolean {
    const svc = getDailyCatch();
    const fish = svc.fish();
    const cx = Math.round(area.x + area.w / 2);
    let y = area.y + 2;
    if (!fish) {
      addText(this, cx, y + 20, 'No daily fish today.', { originX: 0.5, color: 'slate' });
      return true;
    }
    const r = this.ctx.registries;
    const rarity = r.rarities.get(fish.rarity);
    const water = r.waters.tryGet(svc.waterId());
    const caught = svc.caught;
    const n = DAILY_CATCH.firstCount;
    const line = (text: string, c: PaletteName, gap: number, shadow: PaletteName | false = false): void => {
      const t = addText(this, cx, y, text, { originX: 0.5, align: 'center', color: c, shadow, maxWidth: area.w - 4 });
      y += t.textHeight + gap;
    };

    // The bottom block is placed first, so content above can be checked against it.
    const days = formatNumber(svc.slice.daysCaught);
    const footer = addText(this, cx, 0, compact ? `New fish at midnight. Days caught: ${days}` : `New fish and a fresh five at midnight. Days caught: ${days}`, {
      originX: 0.5,
      originY: 1,
      align: 'center',
      color: 'slate',
      shadow: false,
      maxWidth: area.w - 4,
    });
    footer.setY(area.y + area.h - 2);
    const btnH = 20;
    const btnY = Math.round(footer.y - footer.textHeight - 6 - btnH);

    if (!compact) line('Everyone fishes for the same fish today.', 'sky', 6);
    if (compact) {
      // The fish sits beside its name instead of in a big frame.
      const name = addText(this, cx + 10, y + 1, fish.name, { originX: 0.5, color: 'mist' });
      this.add.image(Math.round(cx + 10 - name.textWidth / 2 - 12), y + 5, fish.spriteKey);
      y += name.textHeight + 4;
    } else {
      const g = this.add.graphics();
      g.fillStyle(color(rarity.color), 0.15);
      g.fillRect(cx - 26, y, 52, 36);
      this.add.image(cx, y + 18, fish.spriteKey).setScale(2);
      y += 40;
      line(fish.name, 'mist', 3, 'ink');
    }
    new RarityBanner(this, cx, y, { name: rarity.name, color: rarity.color, frame: rarity.frame, glow: rarity.glow, pips: rarity.pips, shape: rarity.shape });
    y += 17;
    const when = fish.timeOfDay.length > 0 ? ` at ${fish.timeOfDay.map((p) => TIME.phases.find((x) => x.id === p)?.name.toLowerCase() ?? p).join(' or ')}` : '';
    // It only bites at the starting water, wherever the club lives now: say so plainly.
    line(`Only bites at ${water?.name ?? 'the pond'}${when}`, 'sky', 3);
    line(
      caught
        ? `Caught in ${caught.casts} ${caught.casts === 1 ? 'cast' : 'casts'}! It sold for ${DAILY_CATCH.valueMult}x.`
        : `Catch it for ${DAILY_CATCH.valueMult}x coins.`,
      caught ? 'gold' : 'sand',
      compact ? 6 : 10,
    );

    // Your first five catches today: the part you share.
    const first = svc.first;
    line(`Your first ${n} catches today`, 'mist', 3);
    y = this.drawFirst(cx, y, first, n);
    // Compact screens show the count on the Share button only.
    if (!compact || svc.canShare) line(
      svc.canShare
        ? `Luck ${luckScore(first)}/${n * DAILY_CATCH.tierEmoji.length}: ${luckLabel(luckScore(first), DAILY_CATCH.luckLabels)}`
        : `${first.length} of ${n} so far. Share when all ${n} are in.`,
      svc.canShare ? 'gold' : 'slate',
      0,
    );
    if (y > btnY - 4 && !compact) return false;

    // One button sits centered; two share the row.
    const sail = !caught && this.ctx.world.waterId !== svc.waterId() && this.ctx.world.isUnlocked(svc.waterId());
    const gap = 4;
    const bw = sail ? Math.floor((area.w - gap) / 2) : Math.min(area.w, 110);
    const shareX = sail ? area.x + bw + gap : Math.round(cx - bw / 2);
    if (sail) {
      new Button(this, {
        x: area.x,
        y: btnY,
        w: bw,
        h: btnH,
        label: 'Sail there',
        icon: 'icon_boat',
        variant: 'secondary',
        onClick: () => {
          this.ctx.world.setWater(svc.waterId());
          this.close();
        },
      });
    }
    new Button(this, {
      x: shareX,
      y: btnY,
      w: bw,
      h: btnH,
      label: svc.canShare ? 'Share' : `${first.length}/${n}`,
      icon: 'icon_arrow',
      variant: svc.canShare ? 'primary' : 'secondary',
      disabled: !svc.canShare,
      onClick: () => {
        void shareText('Starlight Fishing Club', svc.shareText(gameUrl())).then((res) => {
          if (res === 'copied') this.ctx.ui.toast('Copied! Paste it anywhere.', { icon: 'icon_daily' });
        });
      },
    });
    return true;
  }

  /** Five slots: filled with rarity colors as you catch, today's fish marked gold. */
  private drawFirst(cx: number, y: number, first: readonly FirstCatch[], n: number): number {
    const tiers = [...this.ctx.registries.rarities.list()].sort((a, b) => a.tier - b.tier);
    const size = 12;
    const gap = 3;
    const left = Math.round(cx - (n * size + (n - 1) * gap) / 2);
    const g = this.add.graphics();
    for (let i = 0; i < n; i++) {
      const x = left + i * (size + gap);
      const c = first[i];
      if (!c) {
        g.lineStyle(1, color('dusk'));
        g.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
        continue;
      }
      const fill: PaletteName = c.daily ? 'gold' : (tiers[c.tier]?.color ?? 'slate');
      g.fillStyle(color(fill));
      g.fillRect(x, y, size, size);
      g.fillStyle(color('mist'), 0.5);
      g.fillRect(x + 1, y + 1, size - 2, 1);
      if (c.daily) {
        g.fillStyle(color('ink'));
        g.fillRect(x + 5, y + 3, 2, 6);
        g.fillRect(x + 3, y + 7, 2, 2);
      }
    }
    return y + size + 4;
  }
}
