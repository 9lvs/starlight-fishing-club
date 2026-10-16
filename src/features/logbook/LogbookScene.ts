// The Logbook panel: today's three tasks, then this water's tasks, how far
// along each one is, and a Claim button for finished ones.
import type { Rect } from '../../core/layout';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { formatDuration, formatNumber } from '../../ui/format';
import { drawPanelBox } from '../../ui/pixelDraw';
import { ProgressBar } from '../../ui/ProgressBar';
import { ScrollArea } from '../../ui/ScrollArea';
import { addText } from '../../ui/text';
import { confettiBurst } from '../../ui/confetti';
import { getLogbook } from './service';

const BTN_W = 46;

interface LogbookData {
  scroll?: number;
  /** Where a task was just claimed: confetti plays there after the rebuild. */
  confetti?: { x: number; y: number };
}

interface TaskRow {
  text: string;
  count: number;
  progress: number;
  done: boolean;
  claimed: boolean;
  reward: number;
  currency: string;
  claim: () => void;
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
    const intro = addText(this, area.x, area.y, 'Finish tasks for coins. Three new ones each day. Moving the club pays gems.', {
      color: 'slate',
      shadow: false,
      maxWidth: area.w - 3,
    });
    const top = area.y + intro.textHeight + 5;
    const list = new ScrollArea(this, { x: area.x, y: top, w: area.w, h: area.y + area.h - top });
    let y = 0;

    // Today: three small tasks that change at midnight.
    const today = svc.today;
    if (today.length > 0) {
      const left = today.filter((d) => !svc.dailyClaimed(d)).length;
      list.add(addText(this, 0, y, 'Today', { color: 'gold', shadow: false }));
      list.add(addText(this, area.w - 3, y, left > 0 ? `new in ${formatDuration(svc.resetInMs)}` : 'All done! New ones tomorrow', { color: 'slate', shadow: false, originX: 1 }));
      y += 12;
      for (const d of today) {
        y += this.row(list, area.w, y, {
          text: d.text,
          count: d.count,
          progress: svc.dailyProgress(d),
          done: svc.dailyDone(d),
          claimed: svc.dailyClaimed(d),
          reward: svc.dailyCoins(d),
          currency: 'coins',
          claim: () => {
            const res = svc.claimDaily(d.id);
            if (!res) return;
            this.ctx.bus.emit('audio:play', { key: res.gem ? 'gem' : 'purchase' });
            this.ctx.ui.toast(res.gem ? `+${formatNumber(res.coins)} coins, and you found a gem!` : `+${formatNumber(res.coins)} coins`, { icon: res.gem ? 'icon_gem' : 'icon_coin' });
          },
        });
      }
      y += 6;
    }

    // This water's tasks.
    list.add(addText(this, 0, y, water?.name ?? '', { color: 'mist', shadow: false }));
    list.add(addText(this, area.w - 3, y, `${done} of ${tasks.length} done`, { color: done === tasks.length && tasks.length > 0 ? 'gold' : 'slate', shadow: false, originX: 1 }));
    y += 12;
    if (tasks.length === 0) {
      list.add(addText(this, area.w / 2, y + 8, 'No tasks here. Enjoy the water!', { originX: 0.5, color: 'sky' }));
      y += 24;
    }
    for (const t of tasks) {
      y += this.row(list, area.w, y, {
        text: t.text,
        count: t.count,
        progress: svc.progress(t),
        done: svc.isDone(t),
        claimed: svc.isClaimed(t),
        reward: t.reward.amount,
        currency: t.reward.currency,
        claim: () => {
          if (!svc.claim(t.id)) return;
          const cur = r.currencies.tryGet(t.reward.currency);
          this.ctx.bus.emit('audio:play', { key: t.reward.currency === 'gems' ? 'gem' : 'purchase' });
          this.ctx.ui.toast(`+${formatNumber(t.reward.amount)} ${cur?.name.toLowerCase() ?? ''}`, { icon: cur?.icon });
        },
      });
    }
    list.setContentHeight(y);
    if (data?.scroll) list.scrollTo(data.scroll);
    if (data?.confetti) confettiBurst(this, data.confetti.x, data.confetti.y);
    this.listen('logbookTaskDone', () => this.refresh({ scroll: list.position }));
  }

  /** One task: its text, a progress bar while it is open, and the reward or a Claim button. Returns the row height. */
  private row(list: ScrollArea, w: number, y: number, t: TaskRow): number {
    const cur = this.ctx.registries.currencies.tryGet(t.currency);
    const text = addText(this, 16, y + 4, t.text, { color: t.claimed ? 'slate' : 'mist', shadow: false, maxWidth: w - 16 - BTN_W - 8 });
    const rowH = Math.max(26, text.textHeight + 18);
    const g = this.add.graphics();
    drawPanelBox(g, 0, y, w - 3, rowH - 2, { fill: 'ink', border: t.done && !t.claimed ? 'gold' : 'midnight' });
    list.add(g);
    list.add(this.add.image(3, y + 4, t.done ? 'icon_check' : 'icon_task').setOrigin(0, 0).setAlpha(t.done ? 1 : 0.6));
    list.add(text);
    if (!t.done && t.count > 1) {
      // The bar stops short of the count beside it ("12/80" needs about 26 px).
      const bar = new ProgressBar(this, 16, y + text.textHeight + 7, w - 16 - BTN_W - 10 - 30, 4, 'sage');
      bar.setValue(t.progress / t.count);
      list.add(bar);
      list.add(addText(this, w - BTN_W - 10, y + text.textHeight + 5, `${formatNumber(t.progress)}/${formatNumber(t.count)}`, { color: 'slate', shadow: false, originX: 1 }));
    }
    const bx = w - BTN_W - 5;
    if (t.done && !t.claimed) {
      list.add(
        new Button(this, {
          x: bx,
          y: y + Math.round((rowH - 2 - 18) / 2),
          w: BTN_W,
          h: 18,
          label: `+${formatNumber(t.reward)}`,
          icon: cur?.icon,
          variant: 'primary',
          onClick: () => {
            t.claim();
            const p = this.input.activePointer;
            this.refresh({ scroll: list.position, confetti: { x: Math.round(p.worldX), y: Math.round(p.worldY) } });
          },
        }),
      );
    } else {
      if (cur) list.add(this.add.image(bx + 4, y + Math.round((rowH - 2) / 2) - 6, cur.icon).setOrigin(0, 0).setAlpha(t.claimed ? 0.5 : 1));
      list.add(
        addText(this, bx + 18, y + Math.round((rowH - 2) / 2) - 5, t.claimed ? 'Paid' : formatNumber(t.reward), {
          color: t.claimed ? 'slate' : (cur?.color ?? 'gold'),
          shadow: false,
        }),
      );
    }
    return rowH;
  }
}
