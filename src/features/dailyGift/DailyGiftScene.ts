// "A gift from the club": one gentle gift per calendar day.
import type { Rect } from '../../core/layout';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { addText } from '../../ui/text';
import { formatNumber } from '../../ui/format';
import { getDailyGift } from './service';

export class DailyGiftScene extends PanelScene {
  readonly title = 'Club gift';
  override readonly icon = 'icon_gift';

  constructor() {
    super('DailyGift');
  }

  protected build(area: Rect): void {
    const gift = getDailyGift();
    const cx = area.x + area.w / 2;
    this.add.image(cx, area.y + 30, 'icon_gift').setScale(3);
    if (gift.available()) {
      addText(this, cx, area.y + 60, 'The club left you a little something.', { originX: 0.5, align: 'center', maxWidth: area.w, color: 'sky' });
      addText(this, cx, area.y + 84, `+${formatNumber(gift.amount())}`, { originX: 0.5, color: 'gold', scale: 2 });
      new Button(this, {
        x: Math.round(cx - 45),
        y: area.y + 116,
        w: 90,
        h: 28,
        label: 'Open gift',
        variant: 'primary',
        onClick: () => {
          gift.claim();
          this.scene.restart();
        },
      });
    } else {
      addText(this, cx, area.y + 60, gift.lastNote() ?? 'You opened today\'s gift.', { originX: 0.5, align: 'center', maxWidth: area.w, color: 'mist' });
      addText(this, cx, area.y + 96, 'Another gift arrives tomorrow.\nNo rush, it will wait for you.', {
        originX: 0.5,
        align: 'center',
        maxWidth: area.w,
        color: 'slate',
        shadow: false,
      });
    }
  }
}
