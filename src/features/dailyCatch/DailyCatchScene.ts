// Daily Catch panel: today's fish, where and when it bites, today's casts as a
// little grid, and Share.
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

const CELL = 7;

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
      : `Catch it for ${DAILY_CATCH.valueMult}x coins. Your casts there fill the grid.`;
    const st = addText(this, cx, y, status, { originX: 0.5, align: 'center', color: caught ? 'gold' : 'sand', shadow: false, maxWidth: area.w });
    y += st.textHeight + 6;

    y = this.drawGrid(cx, y, svc.tries, !!caught);

    const btnY = Math.min(y + 4, area.y + area.h - 46);
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
      label: 'Share',
      icon: 'icon_arrow',
      variant: caught ? 'primary' : 'secondary',
      onClick: () => {
        void shareText('Starlight Fishing Club', svc.shareText(gameUrl())).then((res) => {
          if (res === 'copied') this.ctx.ui.toast('Copied! Paste it anywhere.', { icon: 'icon_daily' });
        });
      },
    });
    addText(this, cx, btnY + 26, `A new fish at midnight. Days caught: ${formatNumber(svc.slice.daysCaught)}`, {
      originX: 0.5,
      align: 'center',
      color: 'slate',
      shadow: false,
      maxWidth: area.w,
    });
    this.listen('dailyCatchCaught', () => this.refresh());
    this.listen('catchLanded', () => this.refresh());
  }

  /** The same squares as the share text, drawn in palette colors. */
  private drawGrid(cx: number, y: number, tries: readonly number[], caught: boolean): number {
    if (tries.length === 0) return y;
    const tiers = [...this.ctx.registries.rarities.list()].sort((a, b) => a.tier - b.tier);
    const cols = DAILY_CATCH.gridRow;
    const left = Math.round(cx - (cols * CELL) / 2);
    const g = this.add.graphics();
    tries.forEach((t, i) => {
      const last = caught && i === tries.length - 1;
      const c: PaletteName = last ? 'gold' : t < 0 ? 'midnight' : (tiers[t]?.color ?? 'slate');
      const x = left + (i % cols) * CELL;
      const yy = y + Math.floor(i / cols) * CELL;
      g.fillStyle(color(c));
      g.fillRect(x, yy, CELL - 1, CELL - 1);
      if (last) {
        g.fillStyle(color('mist'));
        g.fillRect(x + 2, yy + 2, 2, 2);
      }
    });
    return y + Math.ceil(tries.length / cols) * CELL + 2;
  }
}
