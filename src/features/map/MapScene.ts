// Map: the club's journey, one card per water from waters.json. Waters the club
// has reached can be visited. The next one opens when the boat can reach it, and
// moving there is a fresh start that pays a bigger coin bonus forever. Moving
// asks twice and says exactly what starts over.
import { clubBonus, moveClub } from '../../core/club';
import type { WaterDef } from '../../core/content/schemas';
import type { Rect } from '../../core/layout';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { drawPanelBox } from '../../ui/pixelDraw';
import { ScrollArea } from '../../ui/ScrollArea';
import { addText, type PixelText } from '../../ui/text';

interface MapData {
  /** Water id whose "move the club" confirmation is showing. */
  confirm?: string;
  scroll?: number;
}

const STATUS_H = 22;

export function bonusText(bonus: number): string {
  return `+${Math.round(bonus * 100)}% coins`;
}

export class MapScene extends PanelScene<MapData> {
  readonly title = 'Map';
  override readonly icon = 'icon_map';

  constructor() {
    super('Map');
  }

  /**
   * Which upgrade opens a water: the Nth cheapest upgrade that raises boatRange,
   * where N is the water's rangeRequired. Purely derived from data.
   */
  private unlockHint(rangeRequired: number): string {
    const rangeUps = this.ctx.registries.upgrades
      .list()
      .filter((u) => u.modifiers.some((m) => m.stat === 'boatRange' && m.op === 'add' && m.value > 0))
      .sort((a, b) => a.baseCost - b.baseCost);
    const u = rangeUps[rangeRequired - 1];
    return u ? `Needs the ${u.name}` : 'Needs more boat range';
  }

  protected build(area: Rect, data?: MapData): void {
    const world = this.ctx.world;
    const waters = [...this.ctx.registries.waters.list()].sort((a, b) => a.rangeRequired - b.rangeRequired || a.order - b.order);
    const scroll = new ScrollArea(this, area);
    const next = world.nextWater();
    let y = 0;
    let focusY = 0;
    for (const w of waters) {
      const unlocked = world.isUnlocked(w.id);
      const here = world.waterId === w.id;
      const home = world.clubWater() === w.id;
      const confirming = data?.confirm === w.id && world.canMoveTo(w.id);
      const desc = addText(this, 40, 0, w.description, { color: unlocked || w.id === next ? 'sky' : 'slate', shadow: false, maxWidth: area.w - 46 });
      let statusY = Math.max(30, 16 + desc.textHeight + 2);
      let warn: PixelText | null = null;
      if (confirming) {
        warn = addText(this, 4, 0, 'Coins, rods, boats, bait, and crew start over. Your journal and Club items stay.', {
          color: 'sand',
          shadow: false,
          maxWidth: area.w - 12,
        });
        statusY += warn.textHeight + 4;
      }
      const cardH = statusY + STATUS_H;
      if (here) focusY = y;
      const g = this.add.graphics();
      drawPanelBox(g, 0, y, area.w - 3, cardH, {
        fill: here ? 'dusk' : 'ink',
        border: here ? 'gold' : unlocked ? 'sky' : w.id === next && world.canMoveTo(w.id) ? 'gold' : 'midnight',
      });
      scroll.add(g);
      const icon = this.add.image(4, y + 4, w.spriteKey).setOrigin(0, 0);
      if (!unlocked && w.id !== next) icon.setAlpha(0.35);
      scroll.add(icon);
      scroll.add(addText(this, 40, y + 4, w.name, { color: unlocked || w.id === next ? 'mist' : 'slate', shadow: false }));
      if (w.clubBonus > 0 && !w.comingSoon) {
        scroll.add(addText(this, area.w - 7, y + 4, bonusText(w.clubBonus), { color: 'gold', shadow: false, originX: 1 }));
      }
      desc.setY(y + 16);
      scroll.add(desc);
      if (warn) {
        warn.setY(y + statusY - warn.textHeight - 4);
        scroll.add(warn);
      }
      this.buildStatus(scroll, w, y + statusY, area.w, { unlocked, here, home, confirming, isNext: w.id === next });
      y += cardH + 4;
    }
    scroll.setContentHeight(y);
    scroll.scrollTo(data?.scroll ?? focusY);
    this.listen('statsChanged', () => this.refresh({ ...data, scroll: scroll.position }));
  }

  private buildStatus(
    scroll: ScrollArea,
    w: WaterDef,
    sy: number,
    areaW: number,
    s: { unlocked: boolean; here: boolean; home: boolean; confirming: boolean; isNext: boolean },
  ): void {
    const world = this.ctx.world;
    const note = (text: string, c: 'gold' | 'slate' | 'lavender' | 'sage', x = 6) =>
      scroll.add(addText(this, x, sy + 4, text, { color: c, shadow: false }));
    if (w.comingSoon) return note('Coming soon', 'lavender');
    if (s.unlocked) {
      if (s.home) note(s.here ? 'Club home. You are here' : 'Club home', 'gold', s.here ? 6 : 80);
      else if (s.here) note('You are here', 'gold');
      if (!s.here) {
        scroll.add(
          new Button(this, {
            x: 4,
            y: sy,
            w: 70,
            h: 18,
            label: 'Sail here',
            icon: 'icon_boat',
            variant: 'secondary',
            onClick: () => {
              if (world.setWater(w.id)) this.ctx.ui.toast(`Sailing to ${w.name}`, { icon: 'icon_boat' });
              this.close();
            },
          }),
        );
      }
      return;
    }
    if (!s.isNext) {
      scroll.add(this.add.image(4, sy + 2, 'icon_lock').setOrigin(0, 0));
      return note('Further along the journey', 'slate', 20);
    }
    if (!world.canMoveTo(w.id)) {
      scroll.add(this.add.image(4, sy + 2, 'icon_lock').setOrigin(0, 0));
      return note(this.unlockHint(w.rangeRequired), 'slate', 20);
    }
    if (!s.confirming) {
      scroll.add(
        new Button(this, {
          x: 4,
          y: sy,
          w: 86,
          h: 18,
          label: 'Move club',
          icon: 'icon_flag',
          variant: 'primary',
          onClick: () => this.refresh({ confirm: w.id }),
        }),
      );
      const gain = w.clubBonus - clubBonus(this.ctx);
      if (gain > 0) note(`${bonusText(w.clubBonus)}`, 'sage', 96);
      return;
    }
    scroll.add(
      new Button(this, {
        x: 4,
        y: sy,
        w: 86,
        h: 18,
        label: 'Move now',
        icon: 'icon_check',
        variant: 'primary',
        onClick: () => {
          if (moveClub(this.ctx, w.id)) {
            this.ctx.ui.toast(`Welcome to ${w.name}! Coins now earn ${bonusText(w.clubBonus).replace(' coins', '')}.`, {
              icon: 'icon_flag',
              color: 'gold',
            });
          }
          this.close();
        },
      }),
    );
    scroll.add(
      new Button(this, {
        x: areaW - 63,
        y: sy,
        w: 56,
        h: 18,
        label: 'Not yet',
        variant: 'secondary',
        onClick: () => this.refresh({}),
      }),
    );
  }
}
