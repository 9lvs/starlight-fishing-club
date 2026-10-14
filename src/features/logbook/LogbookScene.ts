// The Logbook panel: this water's tasks, how far along each one is, and a
// Claim button for finished ones.
import type { Rect } from '../../core/layout';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { formatNumber } from '../../ui/format';
import { drawPanelBox } from '../../ui/pixelDraw';
import { ProgressBar } from '../../ui/ProgressBar';
import { ScrollArea } from '../../ui/ScrollArea';
import { addText } from '../../ui/text';
import { getLogbook } from './service';

const BTN_W = 46;

interface LogbookData {
  scroll?: number;
}

export class LogbookScene extends PanelScene<LogbookData> {
  readonly title = 'Logbook';
  override readonly icon = 'icon_task';

  constructor() {
    super('Logbook');
  }

  protected build(area: Rect, data?: LogbookData): void {
    const svc = getLogbook();
    const r = this.ctx.registries;
    const tasks = svc.current;
    const water = r.waters.tryGet(this.ctx.world.clubWater());
    const done = tasks.filter((t) => svc.isDone(t)).length;
    addText(this, area.x, area.y, water?.name ?? '', { color: 'mist', shadow: false });
    addText(this, area.x + area.w - 3, area.y, `${done} of ${tasks.length} done`, { color: done === tasks.length && tasks.length > 0 ? 'gold' : 'slate', shadow: false, originX: 1 });
    const intro = addText(this, area.x, area.y + 12, 'Tasks for your club. Finish them for coins. Moving the club pays gems.', {
      color: 'slate',
      shadow: false,
      maxWidth: area.w - 3,
    });
    const top = area.y + 12 + intro.textHeight + 5;
    if (tasks.length === 0) {
      addText(this, area.x + area.w / 2, top + 20, 'No tasks here. Enjoy the water!', { originX: 0.5, color: 'sky' });
      return;
    }

    const list = new ScrollArea(this, { x: area.x, y: top, w: area.w, h: area.y + area.h - top });
    let y = 0;
    for (const t of tasks) {
      const isDone = svc.isDone(t);
      const claimed = svc.isClaimed(t);
      const cur = r.currencies.tryGet(t.reward.currency);
      const text = addText(this, 16, y + 4, t.text, { color: claimed ? 'slate' : 'mist', shadow: false, maxWidth: area.w - 16 - BTN_W - 8 });
      const rowH = Math.max(26, text.textHeight + 18);
      const g = this.add.graphics();
      drawPanelBox(g, 0, y, area.w - 3, rowH - 2, { fill: 'ink', border: isDone && !claimed ? 'gold' : 'midnight' });
      list.add(g);
      list.add(this.add.image(3, y + 4, isDone ? 'icon_check' : 'icon_task').setOrigin(0, 0).setAlpha(isDone ? 1 : 0.6));
      list.add(text);
      if (!isDone && t.count > 1) {
        // The bar stops short of the count beside it ("12/80" needs about 26 px).
        const bar = new ProgressBar(this, 16, y + text.textHeight + 7, area.w - 16 - BTN_W - 10 - 30, 4, 'sage');
        bar.setValue(svc.progress(t) / t.count);
        list.add(bar);
        list.add(addText(this, area.w - BTN_W - 10, y + text.textHeight + 5, `${formatNumber(svc.progress(t))}/${formatNumber(t.count)}`, { color: 'slate', shadow: false, originX: 1 }));
      }
      const bx = area.w - BTN_W - 5;
      if (isDone && !claimed) {
        list.add(
          new Button(this, {
            x: bx,
            y: y + Math.round((rowH - 2 - 18) / 2),
            w: BTN_W,
            h: 18,
            label: `+${formatNumber(t.reward.amount)}`,
            icon: cur?.icon,
            variant: 'primary',
            onClick: () => {
              if (svc.claim(t.id)) {
                this.ctx.bus.emit('audio:play', { key: t.reward.currency === 'gems' ? 'gem' : 'purchase' });
                this.ctx.ui.toast(`+${formatNumber(t.reward.amount)} ${cur?.name.toLowerCase() ?? ''}`, { icon: cur?.icon });
              }
              this.refresh({ scroll: list.position });
            },
          }),
        );
      } else {
        if (cur) list.add(this.add.image(bx + 4, y + Math.round((rowH - 2) / 2) - 6, cur.icon).setOrigin(0, 0).setAlpha(claimed ? 0.5 : 1));
        list.add(
          addText(this, bx + 18, y + Math.round((rowH - 2) / 2) - 5, claimed ? 'Paid' : formatNumber(t.reward.amount), {
            color: claimed ? 'slate' : (cur?.color ?? 'gold'),
            shadow: false,
          }),
        );
      }
      y += rowH;
    }
    list.setContentHeight(y);
    if (data?.scroll) list.scrollTo(data.scroll);
    this.listen('logbookTaskDone', () => this.refresh({ scroll: list.position }));
  }
}
