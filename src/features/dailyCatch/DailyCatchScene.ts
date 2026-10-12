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
    const svc = getDailyCatch();
    const fish = svc.fish();
    const cx = Math.round(area.x + area.w / 2);
    let y = area.y + 2;
    if (!fish) {
      addText(this, cx, y + 20, 'No daily fish today.', { originX: 0.5, color: 'slate' });
      return;
    }
    const r = this.ctx.registries;
    const rarity = r.rarities.get(fish.rarity);
    const water = r.waters.tryGet(svc.waterId());
    const caught = svc.caught;

    addText(this, cx, y, 'Everyone fishes for the same fish today.', { originX: 0.5, align: 'center', color: 'sky', shadow: false, maxWidth: area.w });
    y += 24;
    const g = this.add.graphics();
    g.fillStyle(color(rarity.color), 0.15);
    g.fillRect(cx - 26, y, 52, 36);
    this.add.image(cx, y + 18, fish.spriteKey).setScale(2);
    y += 40;
    addText(this, cx, y, fish.name, { originX: 0.5, color: 'mist' });
    y += 13;
    new RarityBanner(this, cx, y, { name: rarity.name, color: rarity.color, frame: rarity.frame, glow: rarity.glow, pips: rarity.pips, shape: rarity.shape });
    y += 16;
    const when = fish.timeOfDay.length > 0 ? ` at ${fish.timeOfDay.map((p) => TIME.phases.find((x) => x.id === p)?.name.toLowerCase() ?? p).join(' or ')}` : '';
    addText(this, cx, y, `Bites at ${water?.name ?? 'the pond'}${when}`, { originX: 0.5, align: 'center', color: 'slate', shadow: false, maxWidth: area.w });
    y += 14;

    const status = caught
      ? `Caught in ${caught.casts} ${caught.casts === 1 ? 'cast' : 'casts'}! It sold for ${DAILY_CATCH.valueMult}x.`
      : `Catch it for ${DAILY_CATCH.valueMult}x coins.`;
    const st = addText(this, cx, y, status, { originX: 0.5, align: 'center', color: caught ? 'gold' : 'sand', shadow: false, maxWidth: area.w });
    y += st.textHeight + 8;

    // Your first five catches today: the part you share.
    const first = svc.first;
    const n = DAILY_CATCH.firstCount;
    addText(this, cx, y, `Your first ${n} catches today`, { originX: 0.5, color: 'mist', shadow: false });
    y += 13;
    y = this.drawFirst(cx, y, first, n);
    const score = luckScore(first);
    const scoreLine = svc.canShare
      ? `Luck ${score}/${n * DAILY_CATCH.tierEmoji.length}: ${luckLabel(score, DAILY_CATCH.luckLabels)}`
      : `${first.length} of ${n} so far. Share when all ${n} are in.`;
    const sl = addText(this, cx, y, scoreLine, { originX: 0.5, align: 'center', color: svc.canShare ? 'gold' : 'slate', shadow: false, maxWidth: area.w });
    y += sl.textHeight + 6;

    const btnY = Math.min(y, area.y + area.h - 46);
    if (!caught && this.ctx.world.waterId !== svc.waterId() && this.ctx.world.isUnlocked(svc.waterId())) {
      new Button(this, {
        x: area.x + 4,
        y: btnY,
        w: area.w / 2 - 6,
        h: 20,
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
      x: area.x + area.w / 2 + 2,
      y: btnY,
      w: area.w / 2 - 6,
      h: 20,
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
    addText(this, cx, btnY + 26, `New fish and a fresh five at midnight. Days caught: ${formatNumber(svc.slice.daysCaught)}`, {
      originX: 0.5,
      align: 'center',
      color: 'slate',
      shadow: false,
      maxWidth: area.w,
    });
    this.listen('dailyCatchCaught', () => this.refresh());
    this.listen('catchLanded', () => this.refresh());
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
